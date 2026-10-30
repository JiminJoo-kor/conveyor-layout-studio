$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$toolsRoot = Join-Path $env:USERPROFILE 'Documents\Codex\tools'
$converterPath = Join-Path $toolsRoot 'libredwg-0.14\dwg2dxf.exe'
if (!(Test-Path -LiteralPath $converterPath)) { & (Join-Path $PSScriptRoot 'install-libredwg.ps1') }
$env:LIBREDWG_CONVERTER = $converterPath
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) { $nodePath = $nodeCommand.Source } else {
  $version = 'v24.20.0'
  $archiveName = "node-$version-win-x64.zip"
  $runtimeRoot = Join-Path $toolsRoot "node-$version-win-x64"
  $nodePath = Join-Path $runtimeRoot 'node.exe'
  if (!(Test-Path -LiteralPath $nodePath)) {
    New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
    $archivePath = Join-Path $toolsRoot $archiveName
    $hashList = (Invoke-WebRequest "https://nodejs.org/dist/$version/SHASUMS256.txt" -UseBasicParsing).Content
    $hashLine = ($hashList -split "`n" | Where-Object { $_.Trim().EndsWith("  $archiveName") })
    if (!$hashLine) { throw 'Official Node.js checksum not found' }
    $expectedHash = ($hashLine.Trim() -split '\s+')[0]
    Invoke-WebRequest "https://nodejs.org/dist/$version/$archiveName" -OutFile $archivePath -UseBasicParsing
    if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Node.js checksum mismatch' }
    Expand-Archive -LiteralPath $archivePath -DestinationPath $toolsRoot -Force
  }
}
Write-Host 'Free CAD ready. On the website click Auto connect. Keep this window open.'
& $nodePath (Join-Path $PSScriptRoot 'cad-bridge.mjs')
