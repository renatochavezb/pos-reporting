/* ============================================================
   CAPA BASE: MOVIMIENTOS DEL KARDEX  -  SeattlePOS
   ------------------------------------------------------------
   Fuente unica para todos los reportes de inventario.
   Clasifica los 40 tipos de transaccion en categorias de negocio
   y valoriza cada movimiento contra el costo vigente a la fecha.

   Encima de esto salen: merma, consumo por ventas, compras,
   transferencias, transformaciones y rotacion.

   PARAMETROS: @FechaIni, @FechaFin, @Sucursal, @Categoria
   ============================================================ */

/* CRITICO: se lee de una base PRODUCTIVA en vivo.
   READ UNCOMMITTED evita tomar locks compartidos que podrian
   bloquear el INSERT de un ticket y dejar a una cajera sin poder
   cerrar una venta.
   Es seguro aqui porque el kardex es append-only: solo leemos
   filas ya confirmadas, nunca renglones en modificacion.        */
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SET NOCOUNT ON;

DECLARE @FechaIni  date          = DATEADD(day, -30, CAST(GETDATE() AS date));
DECLARE @FechaFin  date          = CAST(GETDATE() AS date);
DECLARE @Sucursal  nvarchar(120) = NULL;   -- NULL = todas
DECLARE @Categoria varchar(20)   = NULL;   -- NULL = todas. Ej: 'MERMA', 'VENTA', 'COMPRA'

/* ------------------------------------------------------------
   Mapeo de los 40 tipos a categorias de negocio.
   EsCancelacion marca los movimientos que revierten a otro:
   NO hay que excluirlos, porque el neto correcto sale de sumar
   todo junto. Excluirlos infla los totales.
   ------------------------------------------------------------ */
WITH tipos(NoTransaccionKey, Categoria, EsCancelacion) AS (
    SELECT * FROM (VALUES
        ( 1, 'INICIAL',        0), ( 2, 'COMPRA',         0),
        ( 3, 'TRANSFERENCIA',  0), ( 4, 'COMPRA',         1),
        ( 5, 'TRANSFERENCIA',  1), ( 6, 'TRANSFORMACION', 0),
        ( 7, 'TRANSFORMACION', 1), ( 8, 'VENTA',          0),
        ( 9, 'VENTA',          0), (10, 'VENTA',          0),
        (11, 'VENTA',          0), (12, 'VENTA',          0),
        (13, 'VENTA',          1), (14, 'VENTA',          1),
        (15, 'VENTA',          1), (16, 'VENTA',          1),
        (17, 'VENTA',          1), (18, 'MERMA',          0),
        (19, 'MERMA',          1), (20, 'COMPRA',         0),
        (21, 'COMPRA',         1), (22, 'INICIAL',        0),
        (23, 'VENTA',          0), (24, 'VENTA',          1),
        (25, 'TRANSFERENCIA',  0), (26, 'TRANSFERENCIA',  1),
        (27, 'TRANSFERENCIA',  0), (28, 'TRANSFERENCIA',  1),
        (29, 'AJUSTE',         0),   -- ALTAS DIRECTAS  \ pareja de correccion de
        (30, 'AJUSTE',         0),   -- BAJAS DIRECTAS  / inventario: NO es merma
        (31, 'VENTA',          0), (32, 'VENTA',          1),
        (33, 'TRANSFORMACION', 0), (34, 'TRANSFORMACION', 1),
        (35, 'TRANSFORMACION', 0), (36, 'TRANSFORMACION', 1),
        (37, 'TRANSFORMACION', 0), (38, 'TRANSFORMACION', 1),
        (39, 'OTRO',           0), (40, 'OTRO',           0)
    ) v(a, b, c)
),
movs AS (
    SELECT  k.Sucursal,
            CAST(k.FechaHora AS date)          AS Fecha,
            k.FechaHora,
            k.NoTransaccion,                   -- watermark para extraccion incremental
            k.NoTransaccionKey,
            k.Transaccion,
            ISNULL(t.Categoria, 'OTRO')        AS Categoria,
            ISNULL(t.EsCancelacion, 0)         AS EsCancelacion,
            k.NoInsumo,
            k.Cantidad,                        -- signo ya viene correcto: - salida, + entrada
            k.ExistenciaActual,
            k.Folio,
            k.Usuario,
            k.Modulo
    FROM KardexInsumoPuntoDeVenta k
    LEFT JOIN tipos t ON t.NoTransaccionKey = k.NoTransaccionKey
    WHERE k.FechaHora >= @FechaIni
      AND k.FechaHora <  DATEADD(day, 1, @FechaFin)
      AND (@Sucursal  IS NULL OR k.Sucursal = @Sucursal)
      AND (@Categoria IS NULL OR ISNULL(t.Categoria,'OTRO') = @Categoria)
),
costeado AS (
    SELECT  m.*,
            i.Insumo,
            i.UnidadDeMedida,
            i.CategoriaDeInsumo,
            COALESCE(
                (SELECT TOP 1 c.CostoActual
                   FROM KardexInsumoCosto c
                  WHERE c.NoInsumo = m.NoInsumo
                    AND c.Sucursal = m.Sucursal
                    AND c.FechaHora <= m.FechaHora
                  ORDER BY c.FechaHora DESC, c.NoTransaccion DESC),
                (SELECT TOP 1 c.CostoActual
                   FROM KardexInsumoCosto c
                  WHERE c.NoInsumo = m.NoInsumo
                    AND c.Sucursal = m.Sucursal
                  ORDER BY c.FechaHora ASC, c.NoTransaccion ASC)
            ) AS CostoUnitario
    FROM movs m
    LEFT JOIN Insumos i ON i.NoInsumo = m.NoInsumo
)
SELECT  Sucursal,
        Fecha,
        Categoria,
        NoTransaccionKey                                  AS Tipo,
        Transaccion,
        EsCancelacion,
        NoInsumo,
        Insumo,
        CategoriaDeInsumo,
        UnidadDeMedida,
        Cantidad,
        ABS(Cantidad)                                     AS CantidadAbs,
        CostoUnitario,
        CAST(ABS(Cantidad) * ISNULL(CostoUnitario,0) AS decimal(18,2)) AS Importe,
        CASE WHEN CostoUnitario IS NULL THEN 'SIN COSTO' ELSE '' END  AS Alerta,
        Folio,
        Usuario,
        NoTransaccion                                     AS Watermark
FROM costeado
ORDER BY Sucursal, FechaHora, NoTransaccion;

/* ------------------------------------------------------------
   POR QUE EL TIPO 30 ES 'AJUSTE' Y NO 'MERMA'
   ------------------------------------------------------------
   Verificado contra datos reales de FUENTES MARES (1-14 ago 2026):

   Los tipos 29 (ALTAS DIRECTAS) y 30 (BAJAS DIRECTAS) siempre
   aparecen juntos, capturados por la misma persona con minutos de
   diferencia. Ejemplo del 2 de agosto:
       15:29  folio 373  MERMAS EN PUNTO DE VENTA
       15:31  folio 463  BAJAS DE INSUMOS DIRECTAS
       15:32  folio 622  ALTAS DE INSUMOS DIRECTAS
   Es una sesion de conciliacion: cuenta fisico, marca la merma y
   luego corrige hacia arriba y hacia abajo lo que no cuadra.

   En el periodo hubo 25 altas (+27) contra 9 bajas (-10). Si las
   bajas fueran merma real, no habria casi tres veces mas altas.

   Meter el tipo 30 en MERMA inflaba el indicador ~21%
   (10 unidades sobre 47 de merma real).

   Si en alguna sucursal se usa distinto, se cambia aqui arriba y
   todos los reportes se corrigen solos.
   ------------------------------------------------------------ */
