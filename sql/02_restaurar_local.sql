/* ============================================================
   PASO 2 - SE EJECUTA EN TU MAQUINA (.\SQLEXPRESS)
   ------------------------------------------------------------
   Restaura el .bak de la sucursal como una base APARTE, para no
   tocar SeattlePOS_pruebas ni SeattlePOS_18.

   Convencion de nombre: SeattlePOS_real_<SUCURSAL>
   Asi puedes tener las 12 sucursales conviviendo y comparar.
   ============================================================ */

-- 1) Ver que contiene el archivo y como se llaman sus archivos logicos
RESTORE FILELISTONLY
FROM DISK = N'C:\Respaldos\sucursal.bak';
GO

-- 2) Ver de que base y de que fecha viene (confirmar que es la real, no otra demo)
RESTORE HEADERONLY
FROM DISK = N'C:\Respaldos\sucursal.bak';
GO

/* 3) Restaurar.
      Sustituye 'SeattlePOS' y 'SeattlePOS_log' por los LogicalName
      que devolvio el paso 1. Ajusta @nueva al nombre de la sucursal. */

DECLARE @nueva  sysname       = N'SeattlePOS_real_MATRIZ';        -- <-- CAMBIAR por sucursal
DECLARE @origen nvarchar(500) = N'C:\Respaldos\sucursal.bak';
DECLARE @datos  nvarchar(500) = N'C:\Users\renat\SQLData\';       -- carpeta destino (debe existir)

DECLARE @sql nvarchar(max) = N'
RESTORE DATABASE ' + QUOTENAME(@nueva) + N'
FROM DISK = @src
WITH MOVE N''SeattlePOS''     TO N''' + @datos + @nueva + N'.mdf'',   -- <-- LogicalName datos
     MOVE N''SeattlePOS_log'' TO N''' + @datos + @nueva + N'_log.ldf'', -- <-- LogicalName log
     REPLACE,
     RECOVERY,
     STATS = 10;';

EXEC sp_executesql @sql, N'@src nvarchar(500)', @src = @origen;
GO

-- 4) Dejarla en SIMPLE y solo lectura: es una copia de analisis, no operativa.
--    READ_ONLY te protege de modificar por accidente datos de la tienda.
DECLARE @nueva sysname = N'SeattlePOS_real_MATRIZ';               -- <-- mismo nombre de arriba
DECLARE @sql   nvarchar(max) = N'
ALTER DATABASE ' + QUOTENAME(@nueva) + N' SET RECOVERY SIMPLE;
ALTER DATABASE ' + QUOTENAME(@nueva) + N' SET READ_ONLY WITH ROLLBACK IMMEDIATE;';
EXEC sp_executesql @sql;
GO
