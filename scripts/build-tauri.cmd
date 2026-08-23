@echo off
setlocal
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat" -arch=amd64
if errorlevel 1 exit /b 1
set "CARGO_HOME=%USERPROFILE%\.cargo"
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
cd /d "%~dp0.."
where cargo
node "%~dp0..\node_modules\@tauri-apps\cli\tauri.js" build --no-bundle
