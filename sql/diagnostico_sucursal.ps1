# ============================================================
#  DIAGNOSTICO DE SUCURSAL - SeattlePOS
#  Se ejecuta EN LA PC DE LA SUCURSAL (por TeamViewer)
#
#  SOLO LECTURA: no modifica absolutamente nada.
#  Detecta la instancia, elige la base con MAS movimientos en el
#  kardex (la productiva real), corre las validaciones y deja el
#  resultado en el Escritorio como diagnostico_<EQUIPO>.txt
#
#  USO: PowerShell como administrador ->
#       powershell -ExecutionPolicy Bypass -File diagnostico_sucursal.ps1
# ============================================================

$ErrorActionPreference = 'Continue'
$script:sal = New-Object System.Collections.ArrayList
function W($t) { [void]$script:sal.Add($t); Write-Host $t }

W "=========================================================="
W " DIAGNOSTICO SeattlePOS  -  $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
W " Equipo: $env:COMPUTERNAME"
W "=========================================================="

# ---------- helpers ----------
function Consulta($servidor, $base, $sql) {
    $cs = "Server=$servidor;Database=$base;Integrated Security=True;TrustServerCertificate=True;Connect Timeout=8"
    $cn = New-Object System.Data.SqlClient.SqlConnection $cs
    try {
        $cn.Open()
        $cmd = $cn.CreateCommand(); $cmd.CommandText = $sql; $cmd.CommandTimeout = 180
        $da = New-Object System.Data.SqlClient.SqlDataAdapter $cmd
        $ds = New-Object System.Data.DataSet
        [void]$da.Fill($ds)
        if ($ds.Tables.Count -eq 0) { return $null }
        return ,$ds.Tables[0]        # la coma evita que PowerShell desenrolle la tabla
    } catch {
        W ("  ERROR: " + $_.Exception.Message)
        return $null
    } finally { $cn.Close() }
}

function Mostrar($tabla) {
    if ($null -eq $tabla) { return }
    if ($tabla.Rows.Count -eq 0) { W "  (sin filas)"; return }
    $cols = @($tabla.Columns | ForEach-Object { $_.ColumnName })
    W ("  " + ($cols -join " | "))
    W ("  " + (($cols | ForEach-Object { "-" * $_.Length }) -join "-|-"))
    foreach ($r in $tabla.Rows) {
        $v = @(foreach ($c in $cols) { "$($r[$c])" })
        W ("  " + ($v -join " | "))
    }
}

function Escalar($servidor, $base, $sql) {
    $t = Consulta $servidor $base $sql
    if ($null -eq $t -or $t.Rows.Count -eq 0) { return $null }
    return $t.Rows[0][0]
}

# ---------- 1. Instancias ----------
W ""
W "--- INSTANCIAS DE SQL SERVER EN ESTE EQUIPO ---"
$svc = @(Get-Service -ErrorAction SilentlyContinue |
         Where-Object { $_.Name -like 'MSSQL$*' -or $_.Name -eq 'MSSQLSERVER' })
if ($svc.Count -eq 0) { W "  NO se encontro SQL Server instalado." }
foreach ($s in $svc) { W ("  {0}  [{1}]" -f $s.Name, $s.Status) }

$inst = @()
foreach ($s in ($svc | Where-Object { $_.Status -eq 'Running' })) {
    if ($s.Name -eq 'MSSQLSERVER') { $inst += "." }
    else { $inst += ".\" + ($s.Name -replace '^MSSQL\$', '') }
}
if ($inst.Count -eq 0) { $inst = @(".", ".\SQLEXPRESS") }

# ---------- 2. Elegir la base productiva ----------
$cands = @()
foreach ($i in $inst) {
    W ""
    W "--- BASES EN LA INSTANCIA $i ---"
    $t = Consulta $i "master" "SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name;"
    Mostrar $t
    if ($null -ne $t) {
        foreach ($r in $t.Rows) {
            $n = [string]$r["name"]
            if ($n -like "*Seattle*") {
                $movs = Escalar $i $n "SELECT COUNT(1) FROM KardexInsumoPuntoDeVenta;"
                if ($null -eq $movs) { $movs = -1 }
                $cands += [PSCustomObject]@{ Instancia = $i; Base = $n; Movimientos = [int]$movs }
            }
        }
    }
}

if ($cands.Count -eq 0) {
    W ""
    W "!! No se encontro ninguna base 'Seattle*'. Revisa la lista de arriba."
} else {
    W ""
    W "--- CANDIDATAS (se elige la de mas movimientos = la productiva) ---"
    foreach ($c in ($cands | Sort-Object Movimientos -Descending)) {
        W ("  {0}  base={1}  movimientos_kardex={2}" -f $c.Instancia, $c.Base, $c.Movimientos)
    }
    $elegida = ($cands | Sort-Object Movimientos -Descending)[0]
    $srv = $elegida.Instancia; $bd = $elegida.Base

    W ""
    W "=========================================================="
    W " BASE ANALIZADA: $bd   (instancia $srv)"
    W "=========================================================="

    $bloques = [ordered]@{
"1. SUCURSAL Y RANGO DE DATOS" = @"
SELECT Sucursal, COUNT(1) AS movs,
       CONVERT(varchar(10),MIN(FechaHora),120) AS desde,
       CONVERT(varchar(10),MAX(FechaHora),120) AS hasta
FROM KardexInsumoPuntoDeVenta GROUP BY Sucursal ORDER BY COUNT(1) DESC;
"@
"2. LA MERMA LLEGA AL KARDEX?  <<< PREGUNTA CLAVE" = @"
SELECT NoTransaccionKey, Transaccion, COUNT(1) AS movs,
       CONVERT(varchar(10),MIN(FechaHora),120) AS desde,
       CONVERT(varchar(10),MAX(FechaHora),120) AS hasta
FROM KardexInsumoPuntoDeVenta WHERE NoTransaccionKey IN (18,19,29,30)
GROUP BY NoTransaccionKey, Transaccion;
"@
"2b. VEREDICTO" = @"
SELECT CASE WHEN EXISTS (SELECT 1 FROM KardexInsumoPuntoDeVenta
        WHERE NoTransaccionKey IN (18,19,29,30))
   THEN 'SI - el kardex sirve como fuente unica de merma'
   ELSE 'NO - hay que leer merma/bajas por separado' END AS veredicto;
"@
"3. QUE TABLA DE MERMA SE USA REALMENTE" = @"
SELECT 'MermasPuntoDeVenta' AS tabla, COUNT(1) AS filas FROM MermasPuntoDeVenta
UNION ALL SELECT 'MermaPuntoDeVentaDetalles', COUNT(1) FROM MermaPuntoDeVentaDetalles
UNION ALL SELECT 'InventarioBajasDirectasColor', COUNT(1) FROM InventarioBajasDirectasColor
UNION ALL SELECT 'InventarioBajasDirectasDetallesColor', COUNT(1) FROM InventarioBajasDirectasDetallesColor
UNION ALL SELECT 'InventarioBajasDirectas', COUNT(1) FROM InventarioBajasDirectas;
"@
"4. INTEGRIDAD DEL KARDEX" = @"
SELECT COUNT(1) AS movs,
  SUM(CASE WHEN ExistenciaActual = ExistenciaAnterior + Cantidad THEN 1 ELSE 0 END) AS cuadran,
  SUM(CASE WHEN ExistenciaActual <> ExistenciaAnterior + Cantidad THEN 1 ELSE 0 END) AS descuadrados,
  SUM(CASE WHEN Folio IS NULL OR LTRIM(Folio)=N'' THEN 1 ELSE 0 END) AS sin_folio
FROM KardexInsumoPuntoDeVenta;
"@
"5. DIRECCION DE LA BAJA Y FORMULA DE CANTIDAD" = @"
SELECT COUNT(1) AS filas,
  SUM(CASE WHEN ExistenciaActual = 0 THEN 1 ELSE 0 END) AS existencia_cero,
  SUM(CASE WHEN ExistenciaFinal = ExistenciaActual - Conversion THEN 1 ELSE 0 END) AS como_BAJA,
  SUM(CASE WHEN ExistenciaFinal = ExistenciaActual + Conversion THEN 1 ELSE 0 END) AS como_ALTA,
  SUM(CASE WHEN ABS(Conversion-(CantidadDeAlta*Multiplicador))<0.0001 THEN 1 ELSE 0 END) AS conversion_ok
FROM InventarioBajasDirectasDetallesColor;
"@
"6. COBERTURA DE COSTOS (merma en pesos)" = @"
SELECT COUNT(DISTINCT i.NoInsumo) AS insumos,
       COUNT(DISTINCT k.NoInsumo) AS con_costo,
       CAST(100.0*COUNT(DISTINCT k.NoInsumo)/NULLIF(COUNT(DISTINCT i.NoInsumo),0) AS decimal(5,1)) AS pct
FROM Insumos i LEFT JOIN KardexInsumoCosto k ON k.NoInsumo = i.NoInsumo;
"@
"7. WATERMARK PARA EXTRACCION INCREMENTAL" = @"
SELECT COUNT(1) AS filas, COUNT(DISTINCT NoTransaccion) AS ids_distintos,
       MIN(NoTransaccion) AS min_id, MAX(NoTransaccion) AS max_id
FROM KardexInsumoPuntoDeVenta;
"@
"8. CATALOGO DE SUCURSALES" = @"
SELECT Sucursal, Marca, UtilizaTransferenciaAutomatica AS auto_transf,
       CASE WHEN ISNULL(ConnectionString,N'')=N'' THEN '(vacio)' ELSE 'configurado' END AS conn
FROM Sucursales;
"@
"9. TAMANO DE LA BASE" = @"
SELECT CAST(SUM(size)*8.0/1024 AS decimal(10,1)) AS MB
FROM sys.master_files WHERE database_id = DB_ID();
"@
"10. TOP 30 TABLAS CON DATOS" = @"
SELECT TOP 30 t.name AS tabla, r.filas FROM sys.tables t
CROSS APPLY (SELECT SUM(p.rows) AS filas FROM sys.partitions p
  WHERE p.object_id=t.object_id AND p.index_id IN (0,1)) r
WHERE r.filas > 0 ORDER BY r.filas DESC;
"@
    }

    foreach ($k in $bloques.Keys) {
        W ""
        W "--- $k ---"
        Mostrar (Consulta $srv $bd $bloques[$k])
    }
}

# ---------- 3. Guardar ----------
$dest = Join-Path ([Environment]::GetFolderPath('Desktop')) "diagnostico_$env:COMPUTERNAME.txt"
$script:sal | Out-File -FilePath $dest -Encoding utf8
Write-Host ""
Write-Host "=========================================================="
Write-Host " LISTO. Archivo guardado en:"
Write-Host " $dest"
Write-Host "=========================================================="
