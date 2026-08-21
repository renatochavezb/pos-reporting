/* ============================================================
   REPORTE DE MERMA  -  SeattlePOS
   ------------------------------------------------------------
   Construido sobre el kardex (fuente unica de movimientos).
   Entrega 4 bloques:
     1. Resumen por sucursal + % de merma sobre consumo  <- el KPI
     2. Top insumos con mas merma en pesos
     3. Desglose por tipo (18 mermas PV vs 30 bajas directas)
     4. Merma por dia (para ver tendencia y picos)
   ============================================================ */

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;  -- no bloquear el POS en vivo
SET NOCOUNT ON;

DECLARE @FechaIni date          = DATEADD(day, -30, CAST(GETDATE() AS date));
DECLARE @FechaFin date          = CAST(GETDATE() AS date);
DECLARE @Sucursal nvarchar(120) = NULL;   -- NULL = todas las sucursales

/* Tipos que cuentan como merma. El 30 (BAJAS DIRECTAS) NO entra:
   verificado contra FUENTES MARES, es la pareja del 29 (ALTAS) en
   sesiones de conciliacion de inventario, no merma real.
   Ver nota en kardex_movimientos.sql.                              */
DECLARE @tMerma TABLE (k tinyint PRIMARY KEY);
INSERT INTO @tMerma VALUES (18),(19);             -- 19 = cancelacion, revierte al 18
DECLARE @tAjuste TABLE (k tinyint PRIMARY KEY);
INSERT INTO @tAjuste VALUES (29),(30);            -- correcciones de inventario
DECLARE @tVenta TABLE (k tinyint PRIMARY KEY);
INSERT INTO @tVenta VALUES (8),(9),(10),(11),(12),(13),(14),(15),(16),(17),(23),(24),(31),(32);

-- ============================================================
-- Movimientos del periodo, ya valorizados
-- ============================================================
IF OBJECT_ID('tempdb..#mov') IS NOT NULL DROP TABLE #mov;

SELECT  k.Sucursal,
        CAST(k.FechaHora AS date) AS Fecha,
        k.NoTransaccionKey        AS Tipo,
        k.Transaccion,
        k.NoInsumo,
        i.Insumo,
        i.CategoriaDeInsumo,
        i.UnidadDeMedida,
        k.Usuario,
        k.Modulo,
        k.Cantidad,
        CASE WHEN EXISTS (SELECT 1 FROM @tMerma  m WHERE m.k = k.NoTransaccionKey) THEN 'MERMA'
             WHEN EXISTS (SELECT 1 FROM @tAjuste a WHERE a.k = k.NoTransaccionKey) THEN 'AJUSTE'
             WHEN EXISTS (SELECT 1 FROM @tVenta  v WHERE v.k = k.NoTransaccionKey) THEN 'VENTA'
             ELSE 'OTRO' END AS Clase,
        COALESCE(
            (SELECT TOP 1 c.CostoActual FROM KardexInsumoCosto c
              WHERE c.NoInsumo = k.NoInsumo AND c.Sucursal = k.Sucursal
                AND c.FechaHora <= k.FechaHora
              ORDER BY c.FechaHora DESC, c.NoTransaccion DESC),
            (SELECT TOP 1 c.CostoActual FROM KardexInsumoCosto c
              WHERE c.NoInsumo = k.NoInsumo AND c.Sucursal = k.Sucursal
              ORDER BY c.FechaHora ASC, c.NoTransaccion ASC)
        ) AS CostoUnitario
INTO #mov
FROM KardexInsumoPuntoDeVenta k
LEFT JOIN Insumos i ON i.NoInsumo = k.NoInsumo
WHERE k.FechaHora >= @FechaIni
  AND k.FechaHora <  DATEADD(day, 1, @FechaFin)
  AND (@Sucursal IS NULL OR k.Sucursal = @Sucursal);

-- ============================================================
PRINT '########## 1. RESUMEN POR SUCURSAL  (KPI: % merma sobre consumo) ##########';
-- ============================================================
/* Se usa -SUM(Cantidad) porque las salidas vienen negativas en el
   kardex. Sumar sin invertir el signo da merma negativa.
   Las cancelaciones (tipo 19) entran con signo contrario y se netean
   solas: por eso NO hay que excluirlas.                              */
WITH agr AS (
    SELECT Sucursal,
           -SUM(CASE WHEN Clase = 'MERMA' THEN Cantidad ELSE 0 END) AS QtyMerma,
           -SUM(CASE WHEN Clase = 'VENTA' THEN Cantidad ELSE 0 END) AS QtyVenta,
           -SUM(CASE WHEN Clase = 'MERMA' THEN Cantidad * ISNULL(CostoUnitario,0) ELSE 0 END) AS ImpMerma,
           -SUM(CASE WHEN Clase = 'VENTA' THEN Cantidad * ISNULL(CostoUnitario,0) ELSE 0 END) AS ImpVenta
    FROM #mov GROUP BY Sucursal
)
SELECT Sucursal,
       CAST(ImpMerma AS decimal(18,2))              AS MermaPesos,
       CAST(ImpVenta AS decimal(18,2))              AS ConsumoVentaPesos,
       CAST(100.0 * ImpMerma / NULLIF(ImpMerma + ImpVenta, 0) AS decimal(6,2)) AS PctMerma,
       CAST(QtyMerma AS decimal(18,2))              AS MermaUnidades
FROM agr ORDER BY MermaPesos DESC;

-- ============================================================
PRINT '';
PRINT '########## 2. TOP 25 INSUMOS CON MAS MERMA ($) ##########';
-- ============================================================
SELECT TOP 25
       Sucursal, NoInsumo, Insumo, CategoriaDeInsumo, UnidadDeMedida,
       CAST(-SUM(Cantidad) AS decimal(18,2))        AS Cantidad,
       CAST(-SUM(Cantidad * ISNULL(CostoUnitario,0)) AS decimal(18,2)) AS MermaPesos,
       SUM(CASE WHEN CostoUnitario IS NULL THEN 1 ELSE 0 END) AS movs_sin_costo
FROM #mov WHERE Clase = 'MERMA'
GROUP BY Sucursal, NoInsumo, Insumo, CategoriaDeInsumo, UnidadDeMedida
ORDER BY MermaPesos DESC;

-- ============================================================
PRINT '';
PRINT '########## 3. MERMA vs AJUSTES  (deben verse como cosas distintas) ##########';
-- ============================================================
SELECT Sucursal, Clase, Tipo, Transaccion,
       COUNT(1)                                     AS movs,
       CAST(-SUM(Cantidad) AS decimal(18,2))        AS Cantidad,
       CAST(-SUM(Cantidad * ISNULL(CostoUnitario,0)) AS decimal(18,2)) AS Pesos
FROM #mov WHERE Clase IN ('MERMA','AJUSTE')
GROUP BY Sucursal, Clase, Tipo, Transaccion ORDER BY Sucursal, Clase, Tipo;

-- ============================================================
PRINT '';
PRINT '########## 3b. QUIEN CAPTURA LA MERMA (cobertura del proceso) ##########';
PRINT '(si un solo usuario concentra el 100%, la merma solo existe cuando esa persona la captura)';
-- ============================================================
SELECT Sucursal, Usuario, Modulo,
       COUNT(1)                                     AS movs,
       COUNT(DISTINCT Fecha)                        AS dias_con_captura,
       CAST(-SUM(Cantidad) AS decimal(18,2))        AS Cantidad
FROM #mov WHERE Clase = 'MERMA'
GROUP BY Sucursal, Usuario, Modulo ORDER BY movs DESC;

-- ============================================================
PRINT '';
PRINT '########## 4. MERMA POR DIA (tendencia y picos) ##########';
-- ============================================================
SELECT Fecha, Sucursal,
       CAST(-SUM(Cantidad * ISNULL(CostoUnitario,0)) AS decimal(18,2)) AS MermaPesos,
       COUNT(1) AS movs
FROM #mov WHERE Clase = 'MERMA'
GROUP BY Fecha, Sucursal ORDER BY Fecha DESC, MermaPesos DESC;

DROP TABLE #mov;
