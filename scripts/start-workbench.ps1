# Start work-studio in production mode (single port)
# Default port 18900
#
# Usage:
#   ./start-workbench.ps1              # boot / silent: no window
#   ./start-workbench.ps1 -OpenBrowser # manual: open Tauri window

param(
  [switch]$OpenBrowser
)

function Resolve-AppBrowser {
  $candidates = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
  )
  foreach ($path in $candidates) {
    if ($path -and (Test-Path $path)) { return $path }
  }
  return $null
}

function Resolve-TauriExe {
  $candidates = @(
    (Join-Path $Root 'src-tauri\target\release\work-studio.exe'),
    (Join-Path $Root 'src-tauri\target\debug\work-studio.exe')
  )
  foreach ($path in $candidates) {
    if (Test-Path $path) { return $path }
  }
  return $null
}

function Show-ExistingWindow {
  $running = Get-Process -Name 'work-studio' -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
    Select-Object -First 1
  if (-not $running) { return $false }

  if (-not ('Win32.AppWindow' -as [type])) {
    Add-Type -Namespace Win32 -Name AppWindow -MemberDefinition @'
      [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
      [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
'@
  }
  [void][Win32.AppWindow]::ShowWindowAsync($running.MainWindowHandle, 9)
  [void][Win32.AppWindow]::SetForegroundWindow($running.MainWindowHandle)
  return $true
}

function Open-AppWindow([string]$TargetUrl) {
  $exe = Resolve-TauriExe
  if ($exe) {
    if (Show-ExistingWindow) {
      Write-Log 'tauri window already running, focused'
      return
    }
    Start-Process -FilePath $exe
    Write-Log "opened tauri window via $exe"
    return
  }

  Write-Log 'tauri exe missing, fallback to Edge/Chrome --app (run pnpm tauri:build once)'
  $browser = Resolve-AppBrowser
  if ($browser) {
    Start-Process -FilePath $browser -ArgumentList "--app=$TargetUrl"
    Write-Log "opened app window via $browser"
  } else {
    Write-Log 'Edge/Chrome not found, fallback to default browser'
    Start-Process $TargetUrl
  }
}

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Port = if ($env:WORK_STUDIO_PORT) { $env:WORK_STUDIO_PORT } else { '18900' }
$Url = "http://127.0.0.1:$Port"
# Tauri / 桌面窗口默认打开 CF；本机服务仍启动供调试
$AppUrl = if ($env:WORK_STUDIO_APP_URL) { $env:WORK_STUDIO_APP_URL } else { 'https://work.awall.cc' }
$LogDir = Join-Path $Root 'data'
$LogFile = Join-Path $LogDir 'autostart.log'

if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir | Out-Null
}

function Write-Log([string]$Message) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Resolve-PnpmCmd {
  $cmd = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $nodeDir = Split-Path -Parent (Get-Command node -ErrorAction SilentlyContinue).Source
  if ($nodeDir) {
    $candidate = Join-Path $nodeDir 'pnpm.cmd'
    if (Test-Path $candidate) { return $candidate }
  }

  return $null
}

Write-Log "starting local server at $Url; app window → $AppUrl (OpenBrowser=$OpenBrowser)"

$listening = Get-NetTCPConnection -LocalPort ([int]$Port) -State Listen -ErrorAction SilentlyContinue
if ($listening) {
  Write-Log "port $Port already in use, skip start"
  if ($OpenBrowser) {
    Open-AppWindow $AppUrl
  }
  exit 0
}

$pnpmCmd = Resolve-PnpmCmd
if (-not $pnpmCmd) {
  Write-Log 'pnpm.cmd not found in PATH'
  exit 1
}

if (-not (Test-Path (Join-Path $Root 'dist\index.html'))) {
  Write-Log 'dist missing, building...'
  & $pnpmCmd build
  if ($LASTEXITCODE -ne 0) {
    Write-Log 'build failed'
    exit 1
  }
}

$env:NODE_ENV = 'production'
$env:PORT = $Port

# Start via node.exe + tsx CLI (not tsx.cmd) so Windows does not open a visible cmd window
$nodeCmd = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodeCmd) {
  Write-Log 'node not found in PATH'
  exit 1
}

$tsxCli = Join-Path $Root 'node_modules\tsx\dist\cli.mjs'
if (-not (Test-Path $tsxCli)) {
  Write-Log "tsx CLI missing: $tsxCli"
  exit 1
}

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $nodeCmd
$psi.Arguments = "`"$tsxCli`" server/index.ts"
$psi.WorkingDirectory = $Root
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$psi.EnvironmentVariables['NODE_ENV'] = 'production'
$psi.EnvironmentVariables['PORT'] = $Port

$proc = [System.Diagnostics.Process]::Start($psi)
if (-not $proc) {
  Write-Log 'failed to start server process'
  exit 1
}

Write-Log "server pid=$($proc.Id) via node + tsx (hidden)"

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
  Write-Log "opening app window → $AppUrl"
  Open-AppWindow $AppUrl
}
