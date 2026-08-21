/* ============================================================
   PASO 3 - VALIDAR SUPUESTOS CONTRA LA BASE REAL
   ------------------------------------------------------------
   Todo lo que concluimos salio de SeattlePOS_pruebas, que es demo
   y puede mentir. Este script vuelve a hacer las MISMAS preguntas
   sobre la base real. Correlo apuntando a la base restaurada.

   Cada bloque imprime un veredicto. Si alguno sale distinto de lo
   esperado, la logica del reporte se tiene que ajustar.
   ============================================================ */

SET NOCOUNT ON;
-- USE SeattlePOS_real_MATRIZ;   <-- descomentar/ajustar

PRINT '########## 1. VOLUMEN Y RANGO REAL ##########';
SELECT 'KardexInsumoPuntoDeVenta' AS tabla, COUNT(1) AS filas,
       CONVERT(varchar(10), MIN(FechaHora), 120) AS desde,
       CONVERT(varchar(10), MAX(FechaHora), 120) AS hasta
FROM KardexInsumoPuntoDeVenta
UNION ALL
SELECT 'Tickets', COUNT(1), CONVERT(varchar(10), MIN(FechaHora), 120),
       CONVERT(varchar(10), MAX(FechaHora), 120) FROM Tickets;

PRINT '';
PRINT '########## 2. LA MERMA SI LLEGA AL KARDEX? ##########';
PRINT '(la duda central: en la demo salio 0 solo porque las mermas eran previas al kardex)';
SELECT NoTransaccionKey, Transaccion, COUNT(1) AS movs,
       CONVERT(varchar(10), MIN(FechaHora), 120) AS desde,
       CONVERT(varchar(10), MAX(FechaHora), 120) AS hasta
FROM KardexInsumoPuntoDeVenta
WHERE NoTransaccionKey IN (18, 19, 29, 30)
GROUP BY NoTransaccionKey, Transaccion;

SELECT CASE WHEN EXISTS (SELECT 1 FROM KardexInsumoPuntoDeVenta
                          WHERE NoTransaccionKey IN (18,19,29,30))
            THEN 'SI -> usar el kardex como fuente unica de merma'
            ELSE 'NO -> hay que leer las tablas de merma/bajas por separado'
       END AS VEREDICTO_MERMA;

PRINT '';
PRINT '########## 3. INTEGRIDAD DEL KARDEX ##########';
PRINT '(en la demo: 351/351 cuadraron. Si aqui no cuadra, el kardex no sirve de base)';
SELECT COUNT(1) AS movs,
       SUM(CASE WHEN ExistenciaActual = ExistenciaAnterior + Cantidad THEN 1 ELSE 0 END) AS cuadran,
       SUM(CASE WHEN ExistenciaActual <> ExistenciaAnterior + Cantidad THEN 1 ELSE 0 END) AS descuadrados,
       SUM(CASE WHEN Folio IS NULL OR LTRIM(Folio) = N'' THEN 1 ELSE 0 END) AS sin_folio
FROM KardexInsumoPuntoDeVenta;

PRINT '';
PRINT '########## 4. LA TRAMPA DE LAS CANTIDADES ##########';
PRINT '(se debe cumplir Conversion = CantidadDeAlta * Multiplicador en el 100%)';
SELECT COUNT(1) AS filas,
       SUM(CASE WHEN ABS(Conversion - (CantidadDeAlta * Multiplicador)) < 0.0001
                THEN 1 ELSE 0 END) AS cumplen,
       COUNT(DISTINCT Multiplicador) AS valores_distintos_multiplicador
FROM InventarioBajasDirectasDetallesColor;

PRINT '';
PRINT '########## 5. DIRECCION DEL MOVIMIENTO DE BAJA ##########';
PRINT '(en la demo ExistenciaActual era 0 en todas las filas, no se pudo determinar)';
SELECT COUNT(1) AS filas,
       SUM(CASE WHEN ExistenciaActual = 0 THEN 1 ELSE 0 END) AS con_existencia_cero,
       SUM(CASE WHEN ExistenciaFinal = ExistenciaActual - Conversion THEN 1 ELSE 0 END) AS como_BAJA,
       SUM(CASE WHEN ExistenciaFinal = ExistenciaActual + Conversion THEN 1 ELSE 0 END) AS como_ALTA
FROM InventarioBajasDirectasDetallesColor;

PRINT '';
PRINT '########## 6. COBERTURA DE COSTOS ##########';
PRINT '(sin costo no hay merma en pesos. En la demo faltaba en 4 de 6 insumos)';
SELECT COUNT(DISTINCT i.NoInsumo) AS insumos_totales,
       COUNT(DISTINCT k.NoInsumo) AS insumos_con_costo,
       CAST(100.0 * COUNT(DISTINCT k.NoInsumo)
            / NULLIF(COUNT(DISTINCT i.NoInsumo), 0) AS decimal(5,1)) AS pct_cobertura
FROM Insumos i
LEFT JOIN KardexInsumoCosto k ON k.NoInsumo = i.NoInsumo;

PRINT '';
PRINT '########## 7. NOMBRES DE SUCURSAL (normalizacion) ##########';
PRINT '(en la demo habia 7 nombres en datos contra 3 en el catalogo)';
SELECT s.Sucursal AS en_catalogo, d.Sucursal AS en_datos, d.movs
FROM (SELECT Sucursal, COUNT(1) AS movs
        FROM KardexInsumoPuntoDeVenta GROUP BY Sucursal) d
FULL OUTER JOIN Sucursales s ON s.Sucursal = d.Sucursal;

PRINT '';
PRINT '########## 8. TABLAS CON DATOS (para saber que mas hay) ##########';
SELECT TOP 40 t.name AS tabla, r.filas
FROM sys.tables t
CROSS APPLY (SELECT SUM(p.rows) AS filas FROM sys.partitions p
              WHERE p.object_id = t.object_id AND p.index_id IN (0,1)) r
WHERE r.filas > 0
ORDER BY r.filas DESC;
