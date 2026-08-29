<#
  crear_usuario_reportes.ps1
  ---------------------------------------------------------------
  Crea la cuenta 'reportes_ro' de SOLO LECTURA en el SQL Server
  del POS. Se corre UNA VEZ, en la PC servidor de la sucursal,
  en PowerShell (usa autenticacion de Windows, sin contrasena SQL).

  Compatible con SQL Server 2008 R2 (usa sp_addrolemember).
  No cambia nada del POS: la cuenta solo puede LEER.

  Uso:
      .\crear_usuario_reportes.ps1 -Pass 'AmericasDB2026'
  (opcional -Base si la BD no se llama SeattlePOS)
#>
param(
  [Parameter(Mandatory = $true)][string]$Pass,
  [string]$Base = 'SeattlePOS'
)

$ErrorActionPreference = 'Stop'

# 1) Detectar la instancia de SQL Server instalada en esta PC
$svc = Get-Service | Where-Object { $_.Name -eq 'MSSQLSERVER' -or $_.Name -like 'MSSQL$*' } | Select-Object -First 1
if (-not $svc) { Write-Host "ERROR: no encontre SQL Server en esta PC." -ForegroundColor Red; return }
$inst = if ($svc.Name -eq 'MSSQLSERVER') { '.' } else { '.\' + ($svc.Name -replace '^MSSQL\$','') }
Write-Host "Instancia detectada: $inst"

# 2) Confirmar que existe la base
sqlcmd -S $inst -E -h -1 -Q "SET NOCOUNT ON; SELECT 'Servidor: ' + @@SERVERNAME; SELECT '  base: ' + name FROM sys.databases WHERE database_id > 4"

# 3) Crear login + usuario + rol de solo lectura (idempotente)
$sql = @"
DECLARE @pass sysname = N'$Pass';
DECLARE @bd   sysname = N'$Base';
SET NOCOUNT ON;
DECLARE @c nvarchar(max);
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'reportes_ro')
BEGIN
  SET @c = N'CREATE LOGIN reportes_ro WITH PASSWORD=' + QUOTENAME(@pass,'''') + N', CHECK_POLICY=OFF, DEFAULT_DATABASE=' + QUOTENAME(@bd) + N';';
  EXEC sp_executesql @c;
  PRINT '1) Login reportes_ro CREADO.';
END
ELSE
BEGIN
  SET @c = N'ALTER LOGIN reportes_ro WITH PASSWORD=' + QUOTENAME(@pass,'''') + N';';
  EXEC sp_executesql @c;
  PRINT '1) Login reportes_ro ya existia: contrasena actualizada.';
END
DECLARE @s nvarchar(max) = N'USE ' + QUOTENAME(@bd) + N';
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N''reportes_ro'') CREATE USER reportes_ro FOR LOGIN reportes_ro;
EXEC sp_addrolemember N''db_datareader'', N''reportes_ro'';';
EXEC sp_executesql @s;
PRINT '2) LISTO: reportes_ro con SOLO LECTURA en ' + @bd;
"@

sqlcmd -S $inst -E -b -Q $sql

# 4) Verificacion
Write-Host "`n--- Verificacion (debe listar db_datareader) ---"
sqlcmd -S $inst -E -h -1 -Q "SET NOCOUNT ON; USE $Base; SELECT dp.name + ' -> ' + r.name FROM sys.database_role_members m JOIN sys.database_principals dp ON dp.principal_id = m.member_principal_id JOIN sys.database_principals r ON r.principal_id = m.role_principal_id WHERE dp.name = 'reportes_ro';"
