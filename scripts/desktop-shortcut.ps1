# Create / remove Desktop shortcut for 我的工作台
# Usage:
#   pnpm desktop:install
#   pnpm desktop:uninstall

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Action = if ($args.Count -gt 0) { $args[0].ToLowerInvariant() } else { 'install' }

$DesktopDir = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopDir '我的工作台.lnk'
$StartScript = Join-Path $Root 'scripts\start-workbench.ps1'
$IconPath = Join-Path $Root 'src-tauri\icons\icon.ico'
$PowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

function Install-DesktopShortcut {
  if (-not (Test-Path $DesktopDir)) {
    throw "Desktop folder not found: $DesktopDir"
  }
  if (-not (Test-Path $StartScript)) {
    throw "Start script not found: $StartScript"
  }

  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  $shortcut.TargetPath = $PowerShell
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$StartScript`" -OpenBrowser"
  $shortcut.WorkingDirectory = $Root
  $shortcut.WindowStyle = 7
  $shortcut.Description = '我的工作台'
  if (Test-Path $IconPath) {
    $shortcut.IconLocation = "$IconPath,0"
  }
  $shortcut.Save()

  Write-Host "Desktop shortcut created:"
  Write-Host "  $ShortcutPath"
}

function Uninstall-DesktopShortcut {
  if (Test-Path $ShortcutPath) {
    Remove-Item -Force $ShortcutPath
    Write-Host "Desktop shortcut removed: $ShortcutPath"
  } else {
    Write-Host "Desktop shortcut not found."
  }
}

switch ($Action) {
  'install' { Install-DesktopShortcut }
  'uninstall' { Uninstall-DesktopShortcut }
  default {
    Write-Host "Unknown action: $Action (install | uninstall)"
    exit 1
  }
}
