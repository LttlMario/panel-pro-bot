$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { throw 'Python nu este instalat.' }
Write-Host 'Serviciul MP4 pornește pe http://127.0.0.1:8770 ...'
& $python.Source (Join-Path $project 'promo-export-server.py')
