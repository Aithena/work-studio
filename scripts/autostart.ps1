# Install / uninstall Windows startup for 我的工作台
# Usage:
#   pnpm autostart:install
#   pnpm autostart:uninstall

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Action = if ($args.Count -gt 0) { $args[0].ToLowerInvariant() } else { 'install' }

$StartupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$ShortcutPath = Join-Path $StartupDir 'work-studio.lnk'
$StartScript = Join-Path $Root 'scripts\start-workbench.ps1'

function Install-Autostart {
  if (-not (Test-Path $StartupDir)) {
    New-Item -ItemType Directory -Path $StartupDir -Force | Out-Null
  }

  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  $shortcut.TargetPath = 'powershell.exe'
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$StartScript`""
  $shortcut.WorkingDirectory = $Root
  $shortcut.WindowStyle = 7
  $shortcut.Description = 'Start work-studio on login'
  $shortcut.Save()

  Write-Host "Autostart installed:"
  Write-Host "  $ShortcutPath"
  Write-Host "On next login it will start at http://127.0.0.1:18811 (no browser)"
  Write-Host "Manual start with browser: pnpm autostart:run"
}

function Uninstall-Autostart {
  if (Test-Path $ShortcutPath) {
    Remove-Item -Force $ShortcutPath
    Write-Host "Autostart removed: $ShortcutPath"
  } else {
    Write-Host "Autostart shortcut not found."
  }
}

switch ($Action) {
  'install' { Install-Autostart }
  'uninstall' { Uninstall-Autostart }
  default {
    Write-Host "Unknown action: $Action (install | uninstall)"
    exit 1
  }
}
