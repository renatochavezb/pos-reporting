/* ============================================================
   MERMA UNIFICADA - SeattlePOS  (Dulce Noviembre)
   ------------------------------------------------------------
   Une los 2 mecanismos con que el POS registra merma:
     A) MermasPuntoDeVenta / MermaPuntoDeVentaDetalles
        -> modulo formal de merma del punto de venta
     B) InventarioBajasDirectasColor / ...DetallesColor
        -> bajas directas de inventario (lo que se usa en la practica)

   Valoriza contra el ultimo costo vigente a la fecha del evento
   (KardexInsumoCosto), con fallback al costo mas antiguo cuando el
   evento es anterior al primer costo registrado.

   Parametros: @FechaIni, @FechaFin, @Sucursal (NULL = todas)
   ============================================================ */

SET NOCOUNT ON;

DECLARE @FechaIni date          = '2020-01-01';
DECLARE @FechaFin date          = '2030-12-31';
DECLARE @Sucursal nvarchar(120) = NULL;   -- NULL = todas las sucursales

WITH merma AS (
    -- A) Modulo de mermas del punto de venta
    SELECT  m.Sucursal,
            m.Fecha,
            m.Usuario,
            CAST(m.NoMerma AS varchar(20)) AS Folio,
            'MERMA PV'                     AS Origen,
            d.NoInsumo,
            d.Insumo,
            d.Presentacion,
            CAST(NULL AS nvarchar(60))     AS Color,
            d.Conversion                   AS Cantidad,   -- Conversion = Cantidad * Multiplicador (unidad base)
            d.UnidadDeMedida,
            d.Motivo
    FROM MermasPuntoDeVenta m
    JOIN MermaPuntoDeVentaDetalles d
      ON d.NoMerma = m.NoMerma AND d.Sucursal = m.Sucursal
    WHERE m.NoEstado = 1                                  -- 1=ACTIVA, 2=CANCELADA

    UNION ALL

    -- B) Bajas directas de inventario
    SELECT  b.Sucursal,
            b.Fecha,
            b.Usuario,
            CAST(b.NoCaptura AS varchar(20)),
            'BAJA DIRECTA',
            d.NoInsumo,
            d.Insumo,
            d.Presentacion,
            NULLIF(d.Color, '-'),
            d.Conversion,                                 -- OJO: NO multiplicar por CantidadDeAlta (se duplicaria)
            d.UnidadDeMedida,
            CAST(NULL AS nvarchar(510))
    FROM InventarioBajasDirectasColor b
    JOIN InventarioBajasDirectasDetallesColor d
      ON d.NoCaptura = b.NoCaptura AND d.Sucursal = b.Sucursal
    WHERE b.NoEstado = 1
),
costeada AS (
    SELECT  m.*,
            COALESCE(
                (SELECT TOP 1 k.CostoActual                -- costo vigente a la fecha
                   FROM KardexInsumoCosto k
                  WHERE k.NoInsumo = m.NoInsumo
                    AND k.Sucursal = m.Sucursal
                    AND k.FechaHora <= m.Fecha
                  ORDER BY k.FechaHora DESC, k.NoTransaccion DESC),
                (SELECT TOP 1 k.CostoActual                -- fallback: costo mas antiguo
                   FROM KardexInsumoCosto k
                  WHERE k.NoInsumo = m.NoInsumo
                    AND k.Sucursal = m.Sucursal
                  ORDER BY k.FechaHora ASC, k.NoTransaccion ASC)
            ) AS CostoUnitario
    FROM merma m
    WHERE m.Fecha >= @FechaIni
      AND m.Fecha <  DATEADD(day, 1, @FechaFin)
      AND (@Sucursal IS NULL OR m.Sucursal = @Sucursal)
)
SELECT  Sucursal,
        CONVERT(varchar(10), Fecha, 120) AS Fecha,
        Origen,
        Folio,
        Usuario,
        NoInsumo,
        Insumo,
        Color,
        Cantidad,
        UnidadDeMedida,
        CostoUnitario,
        CAST(Cantidad * ISNULL(CostoUnitario, 0) AS decimal(18,2)) AS ImporteMerma,
        CASE WHEN CostoUnitario IS NULL OR CostoUnitario = 0
             THEN 'SIN COSTO' ELSE '' END AS Alerta,
        Motivo
FROM costeada
ORDER BY Sucursal, Fecha, Folio, Insumo;
