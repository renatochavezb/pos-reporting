/* ============================================================
   CREAR USUARIO DE SOLO LECTURA PARA REPORTES
   ------------------------------------------------------------
   SE CORRE UNA SOLA VEZ, EN LA PC DE LA SUCURSAL (donde vive
   el SQL Server del POS), abriendo SSMS con AUTENTICACION DE
   WINDOWS (sin escribir contrasena).

   Crea una cuenta 'reportes_ro' que SOLO PUEDE LEER. No puede
   borrar, cambiar ni escribir nada, aunque se quisiera. Es
   seguro para la tienda.

   Es idempotente: si ya existe, no truena; lo deja bien.
   ============================================================
   >>> UNICO CAMBIO OBLIGATORIO: pon una contrasena real abajo. <<<
   ============================================================ */

DECLARE @pass sysname = N'DulceNov_Reportes_2026!';   -- <== CAMBIAR por una contrasena real
DECLARE @bd   sysname = N'SeattlePOS';                -- nombre de la base del POS (normalmente asi)

SET NOCOUNT ON;

/* --- 0) Verificacion de seguridad: no dejar corriendo con la de ejemplo --- */
IF @pass = N'DulceNov_Reportes_2026!'
    PRINT '*** AVISO: estas usando la contrasena de ejemplo. Cambiala arriba y vuelve a correr. ***';

/* --- 1) Crear o actualizar el LOGIN a nivel servidor --- */
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'reportes_ro')
BEGIN
    DECLARE @c nvarchar(max) =
        N'CREATE LOGIN reportes_ro WITH PASSWORD = ' + QUOTENAME(@pass, '''') +
        N', CHECK_POLICY = OFF, DEFAULT_DATABASE = ' + QUOTENAME(@bd) + N';';
    EXEC sp_executesql @c;
    PRINT '1) Login reportes_ro CREADO.';
END
ELSE
BEGIN
    DECLARE @c2 nvarchar(max) =
        N'ALTER LOGIN reportes_ro WITH PASSWORD = ' + QUOTENAME(@pass, '''') + N';';
    EXEC sp_executesql @c2;
    PRINT '1) Login reportes_ro ya existia: contrasena actualizada.';
END

/* --- 2) Darle SOLO LECTURA dentro de la base del POS --- */
DECLARE @sql nvarchar(max) = N'
USE ' + QUOTENAME(@bd) + N';
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N''reportes_ro'')
    CREATE USER reportes_ro FOR LOGIN reportes_ro;
ALTER ROLE db_datareader ADD MEMBER reportes_ro;   -- puede leer TODO
-- (no se agrega db_datawriter ni ningun otro rol: no puede escribir)
';
EXEC sp_executesql @sql;
PRINT '2) Usuario reportes_ro con SOLO LECTURA en la base ' + @bd + '.';

/* --- 3) Confirmacion --- */
PRINT '';
PRINT '=== LISTO. Datos para la conexion remota: ===';
PRINT '    Servidor : 25.0.165.166 , puerto 1433   (por Hamachi)';
PRINT '    Base     : ' + @bd;
PRINT '    Usuario  : reportes_ro';
PRINT '    Password : (la que pusiste arriba)';
PRINT '';
PRINT 'Puedes cerrar SSMS. No hay que reiniciar nada.';
