$ErrorActionPreference = 'Stop'
# Official upstream binary; keep the license files alongside the executable.
$installRoot = Join-Path $env:LOCALAPPDATA 'ConveyorLayoutStudio\tools\libredwg-0.14'
New-Item -ItemType Directory -Force -Path $installRoot | Out-Null
$archivePath = Join-Path $installRoot 'libredwg.zip'
Invoke-WebRequest 'https://github.com/LibreDWG/libredwg/releases/download/0.14/libredwg-0.14-win64.zip' -OutFile $archivePath -UseBasicParsing
if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne '1ad7e15344d20b3426c3435b078d82fb84b35062815946b2cca9c5fc9810fea8') { throw 'LibreDWG checksum mismatch; installation stopped.' }
Expand-Archive -LiteralPath $archivePath -DestinationPath $installRoot -Force
if (!(Test-Path -LiteralPath (Join-Path $installRoot 'dwg2dxf.exe'))) { throw 'dwg2dxf.exe missing' }
Write-Host 'Free LibreDWG is ready. Start the local simulator and select CAD import.'
