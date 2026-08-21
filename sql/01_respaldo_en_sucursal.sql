/* ============================================================
   PASO 1 - SE EJECUTA EN LA PC DE LA SUCURSAL (la del POS)
   ------------------------------------------------------------
   Genera un respaldo COPY_ONLY de la base real.

   POR QUE COPY_ONLY:
   Si la sucursal ya tiene una rutina de respaldos, un BACKUP normal
   ROMPE la cadena de diferenciales y deja a la tienda sin poder
   restaurar bien ante una falla. COPY_ONLY saca la copia sin tocar
   esa cadena. NO lo quites.

   Es solo lectura: no modifica datos ni interrumpe el POS.
   Correr de preferencia fuera de horario pico.
   ============================================================ */

-- 1) Ver que bases hay en esta PC (identificar el nombre real)
SELECT name, state_desc,
       CAST(SUM(size) * 8.0 / 1024 AS decimal(10,1)) AS MB
FROM sys.databases d
CROSS APPLY (SELECT size FROM sys.master_files WHERE database_id = d.database_id) f
WHERE name LIKE 'Seattle%'
GROUP BY name, state_desc;
GO

-- 2) Ajustar el nombre de la base y la ruta de salida, luego ejecutar
DECLARE @bd     sysname       = N'SeattlePOS';                    -- <-- CAMBIAR al nombre real del paso 1
DECLARE @salida nvarchar(500) = N'C:\Respaldos\sucursal.bak';     -- <-- CAMBIAR (la carpeta debe existir)

DECLARE @sql nvarchar(max) = N'
BACKUP DATABASE ' + QUOTENAME(@bd) + N'
TO DISK = @out
WITH COPY_ONLY,          -- no rompe la cadena de respaldos de la tienda
     COMPRESSION,        -- archivo mucho mas chico para enviarlo
     INIT,
     STATS = 10;';

EXEC sp_executesql @sql, N'@out nvarchar(500)', @out = @salida;
GO

/* 3) Enviar el .bak resultante (Drive, WeTransfer, USB).
      Si COMPRESSION falla por ser Express, quitalo y comprime el
      archivo con 7-Zip/ZIP antes de enviarlo.                      */
