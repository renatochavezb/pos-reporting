/* ============================================================
   OPCION B - CONEXION DIRECTA A LA SUCURSAL (solo si hay red/VPN)
   ------------------------------------------------------------
   Se ejecuta EN LA PC DE LA SUCURSAL, una sola vez.
   Crea un login que SOLO PUEDE LEER.

   POR QUE NO USAR 'sa':
   El ConnectionString que trae el POS de fabrica usa 'User ID=sa'
   con password vacio. Si tu reporte se conecta asi, cualquier bug
   o query mal escrita puede borrar o alterar datos de la tienda.
   Un login db_datareader no puede escribir NADA aunque quieras.
   ============================================================ */

USE master;
GO

-- 1) Crear el login (cambia la contrasena por una fuerte y real)
CREATE LOGIN reportes_ro
    WITH PASSWORD = N'CAMBIA_ESTA_CONTRASENA_2026!',
         CHECK_POLICY = ON,
         DEFAULT_DATABASE = [master];
GO

-- 2) Darle acceso de SOLO LECTURA a la base del POS
DECLARE @bd sysname = N'SeattlePOS';   -- <-- CAMBIAR al nombre real
DECLARE @sql nvarchar(max) = N'
USE ' + QUOTENAME(@bd) + N';
CREATE USER reportes_ro FOR LOGIN reportes_ro;
ALTER ROLE db_datareader ADD MEMBER reportes_ro;';
EXEC sp_executesql @sql;
GO

/* 3) Ademas hay que habilitar en la PC de la sucursal:
      - SQL Server Configuration Manager > Protocolos > TCP/IP = Habilitado
      - Autenticacion mixta (SQL Server and Windows Authentication mode)
      - Regla de firewall entrante: puerto TCP 1433
      - Reiniciar el servicio SQL Server
      Cada uno de estos pasos abre la PC de la tienda a la red.
      No los hagas sin avisar a quien administra esos equipos.        */

-- 4) Verificar que quedo solo-lectura (debe FALLAR el insert):
--    sqlcmd -S <IP_SUCURSAL> -U reportes_ro -P <pass> -d SeattlePOS ^
--      -Q "SELECT COUNT(1) FROM KardexInsumoPuntoDeVenta;"
