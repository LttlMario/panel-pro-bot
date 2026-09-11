@echo off
cd /d "%~dp0"
if not exist node_modules npm install
if "%DISCORD_BOT_TOKEN%"=="" (
  echo Seteaza DISCORD_BOT_TOKEN inainte de pornire.
  pause
  exit /b 1
)
npm run start:forwarder
