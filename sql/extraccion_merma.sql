/* ============================================================
   EXTRACCION DE MERMA  ->  almacen (Supabase)
   ------------------------------------------------------------
   Una fila por movimiento de merma del kardex:
     tipo 18 = MERMAS EN PUNTO DE VENTA
     tipo 19 = su cancelacion (entra con signo contrario y netea)
   Ventana: la decide el extractor por sucursal. Piso 2026-07-01
   en la primera corrida de una sucursal (backfill del historico
   desde julio 2026); despues, solo el incremento del dia.
   Valorizada contra el costo vigente a la fecha.
   Motivo enlazado por Folio = NoMerma (verificado).

   SQL Server 2008 R2: sin TRY_CONVERT, IIF, etc.  SOLO LECTURA.
   La corre el extractor (extractor/extraer_merma.mjs).
   ============================================================ */
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SET NOCOUNT ON;

/* @desde lo manda el extractor como parametro:
     - sucursal sin datos en Supabase -> '2026-07-01' (backfill)
     - sucursal con datos             -> ultima fecha extraida menos un dia
   Para correr esta consulta a mano en SSMS, descomenta la linea siguiente:
   DECLARE @desde datetime = '2026-07-01'; */

SELECT
    k.Sucursal                                        AS sucursal,
    k.NoTransaccion                                   AS no_transaccion,
    k.NoTransaccionKey                                AS tipo,
    CONVERT(char(10), k.FechaHora, 23)                AS fecha,        -- yyyy-mm-dd
    CONVERT(char(19), k.FechaHora, 120)               AS fecha_hora,   -- yyyy-mm-dd hh:mi:ss
    CASE WHEN ISNUMERIC(k.Folio) = 1 THEN CAST(k.Folio AS bigint) END AS folio,
    k.NoInsumo                                        AS no_insumo,
    i.Insumo                                          AS insumo,
    i.CategoriaDeInsumo                               AS categoria,
    i.UnidadDeMedida                                  AS unidad,
    CAST(-k.Cantidad AS decimal(18,3))                AS cantidad,       -- piezas
    CAST(cst.CostoUnitario AS decimal(18,4))          AS costo_unitario,
    CAST(-k.Cantidad * ISNULL(cst.CostoUnitario, 0) AS decimal(18,2)) AS importe,
    /* costo_confiable = 0 cuando el costo unitario es imposible para
       pasteleria (error de captura en el catalogo; ej. MACARRONS con
       $72,030/pza). Los costos reales rondan < $500. Umbral $2000 los
       separa limpio. Esas filas se reportan en PIEZAS pero no en pesos. */
    CASE WHEN ISNULL(cst.CostoUnitario, 0) > 2000 THEN 0 ELSE 1 END AS costo_confiable,
    mot.Motivo                                        AS motivo,
    k.Usuario                                         AS usuario,
    k.Modulo                                          AS modulo
FROM KardexInsumoPuntoDeVenta k
LEFT JOIN Insumos i
       ON i.NoInsumo = k.NoInsumo
-- costo vigente a la fecha del movimiento (o el mas antiguo si no hay previo)
OUTER APPLY (
    SELECT TOP 1 c.CostoActual AS CostoUnitario
    FROM KardexInsumoCosto c
    WHERE c.NoInsumo = k.NoInsumo AND c.Sucursal = k.Sucursal
      AND c.FechaHora <= k.FechaHora
    ORDER BY c.FechaHora DESC, c.NoTransaccion DESC
) cst
-- motivo de la sesion de captura (Folio = NoMerma). TOP 1 evita duplicar la fila.
OUTER APPLY (
    SELECT TOP 1 d.Motivo
    FROM MermaPuntoDeVentaDetalles d
    WHERE ISNUMERIC(k.Folio) = 1
      AND d.NoMerma  = CAST(k.Folio AS bigint)
      AND d.Sucursal = k.Sucursal
      AND d.NoInsumo = k.NoInsumo
) mot
WHERE k.NoTransaccionKey IN (18, 19)
  AND k.FechaHora >= @desde
ORDER BY k.FechaHora, k.NoTransaccion;
