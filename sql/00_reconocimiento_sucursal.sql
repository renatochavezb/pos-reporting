/* ============================================================
   RECONOCIMIENTO DE UNA SUCURSAL REAL  -  SeattlePOS
   ------------------------------------------------------------
   Primer contacto con la base de produccion. Contesta:
     - que servidor y que version es
     - cuantos datos hay y de que fechas
     - si desde aqui se ven otras sucursales
     - si el kardex y la merma sirven como fuente

   ES SOLO LECTURA. No crea, no borra, no modifica nada.
   READ UNCOMMITTED: el POS esta en vivo con turno abierto; un
   lock nuestro puede dejar a la cajera sin poder cobrar.

   USO (desde esta PC, por Hamachi):
     sqlcmd -S 25.0.165.166,1433 -U sa -P "" -C -d SeattlePOS ^
            -i sql\00_reconocimiento_sucursal.sql -W -s "|"
   ============================================================ */

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SET NOCOUNT ON;

PRINT '########## 1. QUE SERVIDOR ES ##########';
SELECT  @@SERVERNAME                        AS Servidor,
        DB_NAME()                           AS BaseDeDatos,
        CAST(SERVERPROPERTY('ProductVersion') AS varchar(30)) AS Version,
        CAST(SERVERPROPERTY('Edition')        AS varchar(60)) AS Edicion,
        (SELECT compatibility_level FROM sys.databases WHERE name = DB_NAME()) AS NivelCompat,
        CONVERT(varchar(19), GETDATE(), 120) AS HoraDelServidor;

PRINT '';
PRINT '########## 2. TAMANO DE LA BASE (para saber si el .bak es viable) ##########';
SELECT  CAST(SUM(size) * 8.0 / 1024 AS decimal(10,1)) AS MB_totales
FROM sys.master_files
WHERE database_id = DB_ID();

PRINT '';
PRINT '########## 3. CATALOGO DE SUCURSALES ##########';
PRINT '(si aqui salen las 12 con ConnectionString, tenemos la ruta a todas)';
/* La contrasena se enmascara para que puedas pegar esta salida
   sin filtrar credenciales.                                    */
SELECT  Sucursal,
        Marca,
        Letra,
        Ciudad,
        CASE WHEN ISNULL(ConnectionString, N'') = N'' THEN '(vacio)'
             ELSE REPLACE(
                    SUBSTRING(ConnectionString, 1,
                      CASE WHEN CHARINDEX('Password=', ConnectionString) > 0
                           THEN CHARINDEX('Password=', ConnectionString) + 8
                           ELSE LEN(ConnectionString) END) + '********',
                    'Password=********', 'Password=********')
        END AS Conexion_enmascarada
FROM Sucursales
ORDER BY Sucursal;

PRINT '';
PRINT '########## 4. VOLUMEN Y RANGO DE LOS DATOS ##########';
SELECT 'Tickets' AS Tabla, COUNT(1) AS Filas,
       CONVERT(varchar(10), MIN(FechaHora), 120) AS Desde,
       CONVERT(varchar(10), MAX(FechaHora), 120) AS Hasta
FROM Tickets
UNION ALL
SELECT 'TicketDetalles', COUNT(1), '', '' FROM TicketDetalles
UNION ALL
SELECT 'KardexInsumoPuntoDeVenta', COUNT(1),
       CONVERT(varchar(10), MIN(FechaHora), 120),
       CONVERT(varchar(10), MAX(FechaHora), 120)
FROM KardexInsumoPuntoDeVenta
UNION ALL
SELECT 'KardexInsumoCosto', COUNT(1),
       CONVERT(varchar(10), MIN(FechaHora), 120),
       CONVERT(varchar(10), MAX(FechaHora), 120)
FROM KardexInsumoCosto;

PRINT '';
PRINT '########## 5. QUE SUCURSALES APARECEN EN LOS DATOS ##########';
PRINT '(si sale solo una, esta base es de una sola tienda y hay que repetir por sucursal)';
SELECT Sucursal, COUNT(1) AS Tickets,
       CONVERT(varchar(10), MAX(FechaHora), 120) AS UltimaVenta
FROM Tickets GROUP BY Sucursal ORDER BY Tickets DESC;

PRINT '';
PRINT '########## 6. LA MERMA LLEGA AL KARDEX? ##########';
PRINT '(la duda central: en la base de pruebas no habia con que comprobarlo)';
SELECT NoTransaccionKey, Transaccion, COUNT(1) AS Movs,
       CONVERT(varchar(10), MIN(FechaHora), 120) AS Desde,
       CONVERT(varchar(10), MAX(FechaHora), 120) AS Hasta
FROM KardexInsumoPuntoDeVenta
WHERE NoTransaccionKey IN (18, 19, 29, 30)
GROUP BY NoTransaccionKey, Transaccion
ORDER BY NoTransaccionKey;

PRINT '';
PRINT '########## 7. COBERTURA DE COSTOS ##########';
PRINT '(sin costo la merma solo se puede reportar en piezas, no en pesos)';
SELECT COUNT(DISTINCT i.NoInsumo) AS InsumosTotales,
       COUNT(DISTINCT k.NoInsumo) AS ConCosto,
       CAST(100.0 * COUNT(DISTINCT k.NoInsumo)
            / NULLIF(COUNT(DISTINCT i.NoInsumo), 0) AS decimal(5,1)) AS PctCobertura
FROM Insumos i
LEFT JOIN KardexInsumoCosto k ON k.NoInsumo = i.NoInsumo;

PRINT '';
PRINT '########## 8. TURNOS: SE CONFIRMA EL FORMATO d/M/yyyy-NoCaja? ##########';
SELECT TOP 10 TurnoDeVenta, Sucursal, NoCaja,
       CONVERT(varchar(19), FechaHora, 120) AS Abierto,
       CASE WHEN Actual = 1 THEN 'ABIERTO AHORA' ELSE '' END AS Estado
FROM TurnosDeVenta ORDER BY FechaHora DESC;

PRINT '';
PRINT '########## 9. VENTA DE LOS ULTIMOS 7 DIAS (prueba de vida) ##########';
PRINT '(si estos numeros le cuadran a la supervisora, la fuente sirve)';
SELECT  CAST(FechaHora AS date)                     AS Fecha,
        COUNT(1)                                    AS Tickets,
        CAST(SUM(Total - IVA) AS decimal(18,2))     AS VentaNeta,
        CAST(SUM(Total)       AS decimal(18,2))     AS VentaConIVA
FROM Tickets
WHERE NoEstadoTicket = 3
  AND FechaHora >= DATEADD(day, -7, CAST(GETDATE() AS date))
GROUP BY CAST(FechaHora AS date)
ORDER BY Fecha DESC;
