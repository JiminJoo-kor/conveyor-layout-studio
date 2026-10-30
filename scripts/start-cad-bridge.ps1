$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if (![Environment]::Is64BitOperatingSystem) { throw 'This helper requires 64-bit Windows.' }
$toolsRoot = Join-Path $env:LOCALAPPDATA 'ConveyorLayoutStudio\tools'
Write-Host '[1/3] Checking free DWG converter...'
$converterPath = Join-Path $toolsRoot 'libredwg-0.14\dwg2dxf.exe'
if (!(Test-Path -LiteralPath $converterPath)) { & (Join-Path $PSScriptRoot 'install-libredwg.ps1') }
$env:LIBREDWG_CONVERTER = $converterPath
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
  $versionText = & $nodeCommand.Source --version
  if ($LASTEXITCODE -ne 0 -or $versionText -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 22) { $nodeCommand = $null }
}
Write-Host '[2/3] Checking runtime...'
if ($nodeCommand) { $nodePath = $nodeCommand.Source } else {
  $version = 'v24.20.0'
  $archiveName = "node-$version-win-x64.zip"
  $runtimeRoot = Join-Path $toolsRoot "node-$version-win-x64"
  $nodePath = Join-Path $runtimeRoot 'node.exe'
  if (!(Test-Path -LiteralPath $nodePath)) {
    New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
    $archivePath = Join-Path $toolsRoot $archiveName
    $expectedHash = '6cac9ffbca8f6a47091e4b5c772e0606049c3871cb67d900c0cedde630e545ba'
    Invoke-WebRequest "https://nodejs.org/dist/$version/$archiveName" -OutFile $archivePath -UseBasicParsing
    if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Node.js checksum mismatch' }
    Expand-Archive -LiteralPath $archivePath -DestinationPath $toolsRoot -Force
  }
}
Write-Host '[3/3] Free CAD ready. On the website click Auto connect. Keep this window open.'
& $nodePath (Join-Path $PSScriptRoot 'cad-bridge.mjs')
exit $LASTEXITCODE
