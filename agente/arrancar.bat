@echo off
cd /d "%~dp0"
:otra_vez
echo ==== %DATE% %TIME% -- arrancando ==== >> registro.log
"C:\Program Files\nodejs\node.exe" k2-puente.js >> registro.log 2>&1
echo ==== %DATE% %TIME% -- termino con codigo %ERRORLEVEL%, reintentando en 5s ==== >> registro.log
timeout /t 5 /nobreak >nul
goto otra_vez
