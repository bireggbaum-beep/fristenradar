@echo off
echo.
echo  ==========================================
echo   Fristenradar wird aktualisiert...
echo  ==========================================
echo.

ssh root@192.168.1.17 "cd /opt/fristenradar-ui && git pull origin main && npm ci --prefer-offline && npm run build && echo. && echo Deployment erfolgreich!"

echo.
echo  Fertig. Browser-Seite neu laden: http://192.168.1.17:8000
echo.
pause
