@echo off
echo Starting Android Development Build on EAS Cloud...
echo.
npx eas build --platform android --profile development --no-wait
echo.
echo Build successfully queued on EAS Cloud! The terminal will close now.
pause
