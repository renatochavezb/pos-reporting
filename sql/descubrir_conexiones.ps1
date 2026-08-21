# ============================================================
#  DESCUBRIR CONEXIONES A LAS 12 SUCURSALES
#  Se ejecuta EN LA PC DE LAS SUPERVISORAS
#
#  SOLO LECTURA: busca archivos de configuracion, no cambia nada
#  ni abre el POS.
#
#  IMPORTANTE: las contrasenas se ENMASCARAN en la salida, para que
#  puedas compartir el resultado sin filtrar credenciales.
#
#  USO:  powershell -ExecutionPolicy Bypass -File descubrir_conexiones.ps1
# ============================================================

$ErrorActionPreference = 'Continue'
$script:sal = New-Object System.Collections.ArrayList
function W($t) { [void]$script:sal.Add($t); Write-Host $t }

function Enmascarar($txt) {
    # oculta password / pwd antes de mostrar o guardar
    $t = $txt -replace '(?i)(password\s*=\s*)([^;]*)', '$1********'
    $t = $t   -replace '(?i)(pwd\s*=\s*)([^;]*)',      '$1********'
    return $t
}

W "=========================================================="
W " DESCUBRIMIENTO DE CONEXIONES  -  $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
W " Equipo: $env:COMPUTERNAME"
W "=========================================================="

# ---------- 1. Carpetas de instalacion ----------
W ""
W "--- CARPETAS DE INSTALACION DEL POS ---"
$raices = @("C:\", "C:\Program Files", "C:\Program Files (x86)",
            "D:\", "$env:LOCALAPPDATA", "$env:APPDATA", "$env:ProgramData")
$dirs = New-Object System.Collections.ArrayList
foreach ($r in $raices) {
    if (-not (Test-Path $r)) { continue }
    Get-ChildItem $r -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '(?i)seattle|oversight|punto.?de.?venta|\bpos\b' } |
        ForEach-Object { W ("  " + $_.FullName); [void]$dirs.Add($_.FullName) }
}
if ($dirs.Count -eq 0) { W "  (no se hallaron carpetas por nombre; se buscara por archivos de config)" }

# ---------- 2. Ejecutables del POS ----------
W ""
W "--- EJECUTABLES ENCONTRADOS ---"
foreach ($d in $dirs) {
    Get-ChildItem $d -Filter *.exe -Recurse -Depth 2 -ErrorAction SilentlyContinue |
        Select-Object -First 20 |
        ForEach-Object { W ("  " + $_.FullName) }
}

# ---------- 3. Archivos de configuracion con cadenas de conexion ----------
W ""
W "--- CADENAS DE CONEXION HALLADAS (password enmascarado) ---"
$exts = @('*.config','*.ini','*.xml','*.udl','*.txt','*.dat','*.json')
$vistos = @{}
$buscar = @($dirs)
if ($buscar.Count -eq 0) { $buscar = @("C:\") }

foreach ($d in $buscar) {
    foreach ($e in $exts) {
        Get-ChildItem $d -Filter $e -Recurse -Depth 3 -ErrorAction SilentlyContinue |
        Where-Object { $_.Length -lt 2MB } |
        ForEach-Object {
            $f = $_.FullName
            try { $txt = Get-Content $f -Raw -ErrorAction Stop } catch { return }
            if ($f -like "$env:SystemRoot*") { return }   # ignorar archivos de Windows
            if ($txt -match '(?i)(data source|server\s*=|initial catalog|catalog\s*=)') {
                foreach ($m in [regex]::Matches($txt, '(?i)[^\r\n<>"]*(?:data source|server)\s*=[^\r\n<>"]*')) {
                    # solo cadenas que de verdad apuntan a una base de datos
                    if ($m.Value -notmatch '(?i)(initial catalog|database\s*=|provider\s*=|user id|integrated security)') { continue }
                    $linea = Enmascarar($m.Value.Trim())
                    $clave = "$f|$linea"
                    if (-not $vistos.ContainsKey($clave)) {
                        $vistos[$clave] = $true
                        W ""
                        W ("  ARCHIVO: " + $f)
                        W ("  CADENA : " + $linea)
                    }
                }
            }
        }
    }
}
if ($vistos.Count -eq 0) { W "  (ninguna cadena hallada en archivos; revisar registro y bases locales)" }

# ---------- 4. Instancias y bases locales ----------
W ""
W "--- SQL SERVER LOCAL EN ESTA PC ---"
$svc = @(Get-Service -ErrorAction SilentlyContinue |
         Where-Object { $_.Name -like 'MSSQL$*' -or $_.Name -eq 'MSSQLSERVER' })
if ($svc.Count -eq 0) { W "  (sin SQL Server local -> confirma que la conexion es REMOTA a cada sucursal)" }
foreach ($s in $svc) { W ("  {0}  [{1}]" -f $s.Name, $s.Status) }

$inst = @()
foreach ($s in ($svc | Where-Object { $_.Status -eq 'Running' })) {
    if ($s.Name -eq 'MSSQLSERVER') { $inst += "." } else { $inst += ".\" + ($s.Name -replace '^MSSQL\$','') }
}

foreach ($i in $inst) {
    W ""
    W "  Bases en $i :"
    $cs = "Server=$i;Database=master;Integrated Security=True;TrustServerCertificate=True;Connect Timeout=8"
    $cn = New-Object System.Data.SqlClient.SqlConnection $cs
    try {
        $cn.Open()
        $cmd = $cn.CreateCommand()
        $cmd.CommandText = "SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name;"
        $rd = $cmd.ExecuteReader()
        while ($rd.Read()) { W ("    " + $rd[0]) }
        $rd.Close()
    } catch { W ("    ERROR: " + $_.Exception.Message) } finally { $cn.Close() }
}

# ---------- 5. Catalogo Sucursales de cada base local ----------
W ""
W "--- TABLA Sucursales EN BASES LOCALES (aqui suelen estar las 12) ---"
foreach ($i in $inst) {
    $cs = "Server=$i;Database=master;Integrated Security=True;TrustServerCertificate=True;Connect Timeout=8"
    $cn = New-Object System.Data.SqlClient.SqlConnection $cs
    $bases = @()
    try {
        $cn.Open(); $cmd = $cn.CreateCommand()
        $cmd.CommandText = "SELECT name FROM sys.databases WHERE database_id > 4;"
        $rd = $cmd.ExecuteReader(); while ($rd.Read()) { $bases += [string]$rd[0] }; $rd.Close()
    } catch {} finally { $cn.Close() }

    foreach ($b in $bases) {
        $cs2 = "Server=$i;Database=$b;Integrated Security=True;TrustServerCertificate=True;Connect Timeout=8"
        $cn2 = New-Object System.Data.SqlClient.SqlConnection $cs2
        try {
            $cn2.Open(); $c2 = $cn2.CreateCommand()
            $c2.CommandText = "IF OBJECT_ID('Sucursales') IS NOT NULL
                               SELECT Sucursal, ISNULL(ConnectionString,'') AS cs FROM Sucursales;"
            $rd2 = $c2.ExecuteReader()
            $hay = $false
            while ($rd2.Read()) {
                if (-not $hay) { W ""; W ("  [$i / $b]"); $hay = $true }
                W ("    " + $rd2[0] + "  ->  " + (Enmascarar([string]$rd2[1])))
            }
            $rd2.Close()
        } catch {} finally { $cn2.Close() }
    }
}

# ---------- 6. Conexiones de red activas hacia SQL (puerto 1433) ----------
W ""
W "--- CONEXIONES ACTIVAS A SQL REMOTO (puerto 1433) ---"
W "    Si aparecen IPs aqui, esa es la ruta directa a las sucursales."
try {
    $c = Get-NetTCPConnection -State Established -ErrorAction Stop |
         Where-Object { $_.RemotePort -eq 1433 }
    if ($c) { $c | Select-Object RemoteAddress,RemotePort,OwningProcess |
              ForEach-Object { W ("    " + $_.RemoteAddress + ":" + $_.RemotePort + "  pid=" + $_.OwningProcess) } }
    else { W "    (ninguna ahora; abre el POS de una sucursal y vuelve a correr este script)" }
} catch { W "    (no disponible)" }

# ---------- guardar ----------
$dest = Join-Path ([Environment]::GetFolderPath('Desktop')) "conexiones_$env:COMPUTERNAME.txt"
$script:sal | Out-File -FilePath $dest -Encoding utf8
Write-Host ""
Write-Host "=========================================================="
Write-Host " LISTO -> $dest"
Write-Host " (las contrasenas salen enmascaradas)"
Write-Host "=========================================================="
