@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "$procs=Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'panel-pro-presence|presence.js' }; foreach($p in $procs){ Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }; Write-Host 'Panel Pro Rich Presence a fost oprit.'; Start-Sleep -Seconds 2"
