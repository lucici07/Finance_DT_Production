param([switch]$UseTemporaryBuild)
$ErrorActionPreference = 'Stop'
$buildScript = Join-Path $PSScriptRoot 'build.mjs'
if ($UseTemporaryBuild) { node $buildScript --temporary } else { node $buildScript }
if ($LASTEXITCODE -ne 0) { throw 'SharePoint build failed.' }
