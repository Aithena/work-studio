# Start work-studio in production mode (single port)
# Default port 18811
#
# Usage:
#   ./start-workbench.ps1              # boot / silent: no browser
#   ./start-workbench.ps1 -OpenBrowser # manual: open browser

param(
  [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Port = if ($env:WORK_STUDIO_PORT) { $env:WORK_STUDIO_PORT } else { '18811' }
$Url = "http://127.0.0.1:$Port"
$LogDir = Join-Path $Root 'data'
$LogFile = Join-Path $LogDir 'autostart.log'

if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir | Out-Null
}

function Write-Log([string]$Message) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

Write-Log "starting work-studio at $Url (OpenBrowser=$OpenBrowser)"

$listening = Get-NetTCPConnection -LocalPort ([int]$Port) -State Listen -ErrorAction SilentlyContinue
if ($listening) {
  Write-Log "port $Port already in use, skip start"
  if ($OpenBrowser) {
    Start-Process $Url
  }
  exit 0
}

if (-not (Test-Path (Join-Path $Root 'dist\index.html'))) {
  Write-Log 'dist missing, building...'
  pnpm build
  if ($LASTEXITCODE -ne 0) {
    Write-Log 'build failed'
    exit 1
  }
}

$env:NODE_ENV = 'production'
$env:PORT = $Port

$pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmCmd) {
  Write-Log 'pnpm not found in PATH'
  exit 1
}

$proc = Start-Process -FilePath $pnpmCmd.Source `
  -ArgumentList @('start') `
  -WorkingDirectory $Root `
  -WindowStyle Minimized `
  -PassThru

Write-Log "server pid=$($proc.Id)"

$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $res = Invoke-WebRequest -Uri "$Url/api/health" -UseBasicParsing -TimeoutSec 2
    if ($res.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {
    # keep waiting
  }
}

if ($ready) {
  Write-Log "ready at $Url"
} else {
  Write-Log "server not ready in time; check $Url later"
}

if ($OpenBrowser) {
  Write-Log 'opening browser'
  Start-Process $Url
}
