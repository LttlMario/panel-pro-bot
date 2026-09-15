@echo off
cd /d "%~dp0"
if not exist node_modules npm install
if "%DISCORD_BOT_TOKEN%"=="" (
  echo Lipseste DISCORD_BOT_TOKEN.
  pause
  exit /b 1
)
if "%SUPABASE_SERVICE_ROLE_KEY%"=="" (
  echo Lipseste SUPABASE_SERVICE_ROLE_KEY.
  pause
  exit /b 1
)
if "%SUPABASE_URL%"=="" set "SUPABASE_URL=https://vkvsabbbawyiurnaiugo.supabase.co"
npm start
pause
