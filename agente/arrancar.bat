@echo off
cd /d "%~dp0"
echo ==== %DATE% %TIME% -- arrancando ==== >> registro.log
"C:\Program Files\nodejs\node.exe" k2-puente.js >> registro.log 2>&1
echo ==== %DATE% %TIME% -- termino con codigo %ERRORLEVEL% ==== >> registro.log
