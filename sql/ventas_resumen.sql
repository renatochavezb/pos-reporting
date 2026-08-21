/* ============================================================
   REPORTE DE VENTAS  -  SeattlePOS
   ------------------------------------------------------------
   Construido sobre los tickets COBRADOS (estado 3 = PAGADO).
   Entrega 7 bloques:
     1. Resumen por sucursal + ticket promedio + margen  <- el KPI
     2. Venta por dia (tendencia y comparativo)
     3. Top productos (mix de venta)
     4. Formas de pago (para cuadrar contra el corte de caja)
     5. Tipo de venta y hora pico (para staffing)
     6. Descuentos y cortesias (control)
     7. Calidad del dato (antes de creerle a los numeros)

   Ver ventas_movimientos.sql para las trampas del esquema.
   ============================================================ */

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;  -- no bloquear el POS en vivo
SET NOCOUNT ON;

/* Base en NIVEL DE COMPATIBILIDAD 100 (SQL 2008): sin TRY_CONVERT,
   IIF, CONCAT, STRING_AGG ni LAG/LEAD. Sintaxis 2008 a proposito. */
SET DATEFORMAT dmy;   -- el turno viene como d/M/yyyy

DECLARE @FechaIni date          = DATEADD(day, -30, CAST(GETDATE() AS date));
DECLARE @FechaFin date          = CAST(GETDATE() AS date);
DECLARE @Sucursal nvarchar(120) = NULL;   -- NULL = todas las sucursales

-- ============================================================
-- Tickets cobrados del periodo, con su dia de negocio
-- ============================================================
IF OBJECT_ID('tempdb..#tk') IS NOT NULL DROP TABLE #tk;

SELECT  t.Sucursal,
        t.NoTicket,
        t.Letra,
        t.NoCaja,
        t.TurnoDeVenta,
        t.NoTipoDeVenta,
        t.NoFormaDePago,
        t.Usuario,
        c.UsuarioAlCobrar,
        c.FolioDeNotaDeVenta,
        COALESCE(c.FechaHoraAlCobrar, t.FechaHora) AS FechaHoraCobro,
        /* dia de negocio = el del turno, no el del reloj.
           Ver trampa 5 en ventas_movimientos.sql.            */
        CASE WHEN CHARINDEX('-', t.TurnoDeVenta) > 1
              AND ISDATE(LEFT(t.TurnoDeVenta, CHARINDEX('-', t.TurnoDeVenta) - 1)) = 1
             THEN CONVERT(date, LEFT(t.TurnoDeVenta,
                          CHARINDEX('-', t.TurnoDeVenta) - 1), 103)
             ELSE CAST(COALESCE(c.FechaHoraAlCobrar, t.FechaHora) AS date)
        END AS Dia,
        t.Subtotal,
        t.Descuento,
        t.Incremento,
        t.IVA,
        t.Propina,
        t.Total,
        /* COSTO: se suma del DETALLE, no del encabezado.
           Verificado contra datos reales de FUENTES MARES: la columna
           Tickets.Costo trae basura (sumaba $3.8M de costo contra $1.1M
           de venta, margen -232%). El costo por renglon de TicketDetalles
           si es correcto (da margenes de 30-48%, normales en pasteleria).
           Se excluyen los renglones borrados: no son producto vendido.   */
        ISNULL((SELECT SUM(d.Costo) FROM TicketDetalles d
                 WHERE d.NoTicket = t.NoTicket AND d.Letra = t.Letra
                   AND d.Sucursal = t.Sucursal
                   AND (d.UsuarioDelete IS NULL OR LTRIM(d.UsuarioDelete) = N'')
                   /* GUARDA DE COSTO MAL CAPTURADO: se ignoran los renglones
                      donde el costo supera al precio de venta (imposible en
                      pasteleria). Ej. real: CAJA MACARRON se vende en $300 y
                      tiene costo capturado de $720,300 en el catalogo. Sin
                      esta guarda, 3 renglones inflaban el costo en millones y
                      daban margen de -232%. Ver bloque 8.                    */
                   AND d.Costo <= ABS(d.Importe)), 0) AS Costo
INTO #tk
FROM Tickets t
LEFT JOIN TicketCobro c
       ON  c.NoTicket = t.NoTicket
       AND c.Letra    = t.Letra
       AND c.Sucursal = t.Sucursal   -- la llave son 3 columnas, no una
WHERE t.NoEstadoTicket = 3           -- 3 = PAGADO. El 1 (IMPRESO) es cuenta abierta.
  AND (@Sucursal IS NULL OR t.Sucursal = @Sucursal);

DELETE FROM #tk WHERE Dia < @FechaIni OR Dia > @FechaFin;

-- ============================================================
PRINT '########## 1. RESUMEN POR SUCURSAL  (KPI: venta neta y ticket promedio) ##########';
-- ============================================================
/* VentaNeta = Total - IVA. Es la cifra comparable entre
   sucursales; el Total incluye impuesto y ensucia el margen.
   La propina NO es venta: es dinero del mesero. Se reporta
   aparte para que nadie la sume al resultado.                */
SELECT  Sucursal,
        COUNT(1)                                              AS Tickets,
        CAST(SUM(Total - IVA)        AS decimal(18,2))        AS VentaNeta,
        CAST(SUM(IVA)                AS decimal(18,2))        AS IVA,
        CAST(SUM(Total)              AS decimal(18,2))        AS VentaConIVA,
        CAST(SUM(Total - IVA) / NULLIF(COUNT(1),0) AS decimal(18,2)) AS TicketPromedio,
        CAST(SUM(Costo)              AS decimal(18,2))        AS Costo,
        CAST(SUM(Total - IVA - Costo) AS decimal(18,2))       AS UtilidadBruta,
        CAST(100.0 * SUM(Total - IVA - Costo)
             / NULLIF(SUM(Total - IVA),0) AS decimal(6,2))    AS PctMargen,
        CAST(SUM(Descuento)          AS decimal(18,2))        AS Descuentos,
        CAST(SUM(Propina)            AS decimal(18,2))        AS Propinas,
        COUNT(DISTINCT Dia)                                   AS DiasConVenta
FROM #tk
GROUP BY Sucursal
ORDER BY VentaNeta DESC;

-- ============================================================
PRINT '';
PRINT '########## 2. VENTA POR DIA (tendencia) ##########';
-- ============================================================
SELECT  Dia,
        DATENAME(weekday, Dia)                                AS DiaSemana,
        Sucursal,
        COUNT(1)                                              AS Tickets,
        CAST(SUM(Total - IVA) AS decimal(18,2))               AS VentaNeta,
        CAST(SUM(Total - IVA) / NULLIF(COUNT(1),0) AS decimal(18,2)) AS TicketPromedio,
        CAST(SUM(Descuento)   AS decimal(18,2))               AS Descuentos
FROM #tk
GROUP BY Dia, Sucursal
ORDER BY Dia DESC, VentaNeta DESC;

-- ============================================================
PRINT '';
PRINT '########## 3. TOP 30 PRODUCTOS (mix de venta) ##########';
PRINT '(los importes salen del detalle: sirven para el MIX, no para cuadrar el total)';
-- ============================================================
/* Se excluyen las lineas borradas (UsuarioDelete lleno): son
   productos que la cajera quito de la cuenta antes de cobrar.
   Si se dejan, el mix inventa demanda que nunca se vendio.    */
SELECT TOP 30
        d.Sucursal,
        d.NoProducto,
        MAX(ISNULL(p.Producto, d.DescripcionCorta))           AS Producto,
        MAX(p.CategoriaDeProducto)                            AS Categoria,
        CAST(SUM(d.Cantidad) AS decimal(18,2))                AS Piezas,
        CAST(SUM(d.Importe - d.IVA) AS decimal(18,2))         AS VentaNeta,
        CAST(SUM(d.Costo)    AS decimal(18,2))                AS Costo,
        CAST(100.0 * SUM(d.Importe - d.IVA - d.Costo)
             / NULLIF(SUM(d.Importe - d.IVA),0) AS decimal(6,2)) AS PctMargen,
        COUNT(DISTINCT CAST(d.NoTicket AS varchar(20)) + d.Letra) AS TicketsConEsteProducto
FROM TicketDetalles d
JOIN #tk t ON  t.NoTicket = d.NoTicket
           AND t.Letra    = d.Letra
           AND t.Sucursal = d.Sucursal
LEFT JOIN Productos p ON p.NoProducto = d.NoProducto
WHERE d.UsuarioDelete IS NULL OR LTRIM(d.UsuarioDelete) = N''
GROUP BY d.Sucursal, d.NoProducto
ORDER BY VentaNeta DESC;

-- ============================================================
PRINT '';
PRINT '########## 4. FORMAS DE PAGO (para cuadrar contra el corte de caja) ##########';
-- ============================================================
/* OJO: la forma de pago vive en TicketCobroFormaPago, NO en
   Tickets.NoFormaDePago (esa es la condicion: contado/credito/
   cortesia). Un ticket puede tener VARIOS renglones aqui: pago
   mixto (mitad efectivo, mitad tarjeta).                      */
SELECT  t.Sucursal,
        f.IDFormaPago,
        MAX(LTRIM(RTRIM(fp.FormaPago)))                       AS FormaDePago,
        COUNT(1)                                              AS Movimientos,
        CAST(SUM(f.Importe) AS decimal(18,2))                 AS Importe,
        CAST(100.0 * SUM(f.Importe)
             / NULLIF(SUM(SUM(f.Importe)) OVER (PARTITION BY t.Sucursal),0)
             AS decimal(6,2))                                 AS PctDelTotal
FROM TicketCobroFormaPago f
JOIN TicketCobro c ON c.FolioDeNotaDeVenta = f.FolioDeNotaDeVenta
JOIN #tk t ON  t.NoTicket = c.NoTicket
           AND t.Letra    = c.Letra
           AND t.Sucursal = c.Sucursal
LEFT JOIN FormaPagoID fp ON fp.IDFormaPago = f.IDFormaPago
GROUP BY t.Sucursal, f.IDFormaPago
ORDER BY t.Sucursal, Importe DESC;

-- ============================================================
PRINT '';
PRINT '########## 5. TIPO DE VENTA Y HORA PICO (para staffing) ##########';
-- ============================================================
SELECT  Sucursal,
        CASE NoTipoDeVenta WHEN 1 THEN 'COMEDOR'
                           WHEN 2 THEN 'PARA LLEVAR'
                           WHEN 3 THEN 'DOMICILIO'
                           ELSE 'OTRO' END                    AS TipoDeVenta,
        COUNT(1)                                              AS Tickets,
        CAST(SUM(Total - IVA) AS decimal(18,2))               AS VentaNeta,
        CAST(SUM(Total - IVA) / NULLIF(COUNT(1),0) AS decimal(18,2)) AS TicketPromedio
FROM #tk
GROUP BY Sucursal, NoTipoDeVenta
ORDER BY Sucursal, VentaNeta DESC;

PRINT '';
PRINT '--- venta por hora del dia ---';
SELECT  Sucursal,
        DATEPART(hour, FechaHoraCobro)                        AS Hora,
        COUNT(1)                                              AS Tickets,
        CAST(SUM(Total - IVA) AS decimal(18,2))               AS VentaNeta
FROM #tk
GROUP BY Sucursal, DATEPART(hour, FechaHoraCobro)
ORDER BY Sucursal, Hora;

-- ============================================================
PRINT '';
PRINT '########## 6. DESCUENTOS, CORTESIAS Y CANCELACIONES (control) ##########';
PRINT '(quien autoriza y cuanto: aqui se ven las fugas)';
-- ============================================================
SELECT  t.Sucursal,
        ISNULL(NULLIF(LTRIM(c.UsuarioAutorizoDescuento), N''), '(sin autorizacion)') AS Autorizo,
        COUNT(1)                                              AS Tickets,
        CAST(SUM(t.Descuento) AS decimal(18,2))               AS Descuento,
        CAST(100.0 * SUM(t.Descuento)
             / NULLIF(SUM(t.Subtotal),0) AS decimal(6,2))     AS PctSobreSubtotal
FROM #tk t
LEFT JOIN TicketCobro c ON  c.NoTicket = t.NoTicket
                        AND c.Letra    = t.Letra
                        AND c.Sucursal = t.Sucursal
/* <> 0 y no > 0: en la base hay descuentos NEGATIVOS (recargos
   capturados como descuento). Filtrar por > 0 los esconde justo
   cuando son los que hay que revisar.                          */
WHERE t.Descuento <> 0
GROUP BY t.Sucursal, ISNULL(NULLIF(LTRIM(c.UsuarioAutorizoDescuento), N''), '(sin autorizacion)')
ORDER BY Descuento DESC;

PRINT '';
PRINT '--- tickets CANCELADOS del periodo (no entran en la venta, pero se vigilan) ---';
SELECT  t.Sucursal,
        CAST(t.FechaHora AS date)                             AS Fecha,
        COUNT(1)                                              AS TicketsCancelados,
        CAST(SUM(t.Total) AS decimal(18,2))                   AS ImporteCancelado,
        MAX(ISNULL(x.Usuario, ''))                            AS UltimoUsuario,
        MAX(ISNULL(x.Motivo,  ''))                            AS UltimoMotivo
FROM Tickets t
LEFT JOIN TicketCancelacion x ON  x.NoTicket = t.NoTicket
                             AND x.Letra    = t.Letra
                             AND x.Sucursal = t.Sucursal
WHERE t.NoEstadoTicket = 2
  AND CAST(t.FechaHora AS date) BETWEEN @FechaIni AND @FechaFin
  AND (@Sucursal IS NULL OR t.Sucursal = @Sucursal)
GROUP BY t.Sucursal, CAST(t.FechaHora AS date)
ORDER BY ImporteCancelado DESC;

-- ============================================================
PRINT '';
PRINT '########## 7. CALIDAD DEL DATO (leer ANTES de creerle a los numeros) ##########';
-- ============================================================
/* Cada renglon que salga distinto de 0 cambia como se interpreta
   el reporte. No son errores del query: son avisos del negocio. */
SELECT 'Tickets cobrados en el periodo' AS Indicador,
       COUNT(1) AS Valor, '' AS Nota FROM #tk
UNION ALL
SELECT 'Sin registro de cobro (TicketCobro)',
       SUM(CASE WHEN FolioDeNotaDeVenta IS NULL THEN 1 ELSE 0 END),
       'pagados sin fila de cobro: revisar, la forma de pago no se puede saber'
FROM #tk
UNION ALL
SELECT 'Sin costo capturado',
       SUM(CASE WHEN Costo = 0 THEN 1 ELSE 0 END),
       'el margen de esos tickets sale inflado al 100%'
FROM #tk
UNION ALL
SELECT 'Turno cruzado (dia del turno <> dia del reloj)',
       SUM(CASE WHEN CAST(FechaHoraCobro AS date) <> Dia THEN 1 ELSE 0 END),
       'turno que quedo abierto: la venta pertenece al dia del turno'
FROM #tk
UNION ALL
SELECT 'Encabezado no cuadra con sus detalles',
       SUM(CASE WHEN ABS(t.Subtotal - ISNULL(d.suma,0)) > 0.01 THEN 1 ELSE 0 END),
       'por eso los totales se toman del encabezado y no del detalle'
FROM #tk t
OUTER APPLY (SELECT SUM(x.Importe) AS suma FROM TicketDetalles x
              WHERE x.NoTicket = t.NoTicket AND x.Letra = t.Letra
                AND x.Sucursal = t.Sucursal) d
UNION ALL
SELECT 'Sucursales con venta',
       COUNT(DISTINCT Sucursal), 'contra las 12 esperadas' FROM #tk;

PRINT '';
PRINT '--- nombres de sucursal: catalogo vs datos (deben coincidir) ---';
SELECT s.Sucursal AS en_catalogo, d.Sucursal AS en_datos, d.tickets
FROM (SELECT Sucursal, COUNT(1) AS tickets FROM #tk GROUP BY Sucursal) d
FULL OUTER JOIN Sucursales s ON s.Sucursal = d.Sucursal;

-- ============================================================
PRINT '';
PRINT '########## 8. PRODUCTOS CON COSTO MAL CAPTURADO (corregir en el POS) ##########';
PRINT '(el costo unitario es mayor al precio de venta: error de captura en el catalogo)';
PRINT 'Estos renglones se EXCLUYEN del calculo de margen para no distorsionarlo.';
-- ============================================================
SELECT  d.NoProducto,
        MAX(d.DescripcionCorta)                       AS Producto,
        CAST(MAX(d.PrecioUnitario) AS decimal(18,2))  AS PrecioVenta,
        CAST(MAX(d.CostoUnitario)  AS decimal(18,2))  AS CostoCapturado,
        COUNT(1)                                      AS RenglonesAfectados
FROM TicketDetalles d
JOIN #tk t ON t.NoTicket = d.NoTicket AND t.Letra = d.Letra AND t.Sucursal = d.Sucursal
WHERE d.Costo > ABS(d.Importe)
  AND (d.UsuarioDelete IS NULL OR LTRIM(d.UsuarioDelete) = N'')
GROUP BY d.NoProducto
ORDER BY MAX(d.CostoUnitario) DESC;

DROP TABLE #tk;
