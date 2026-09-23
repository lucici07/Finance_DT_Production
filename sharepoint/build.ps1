$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$localNode = Join-Path $projectRoot 'runtime/node22/node_modules/node/bin/node.exe'
$nodeExecutable = if (Test-Path -LiteralPath $localNode) { $localNode } else { (Get-Command node).Source }
$version = & $nodeExecutable --version
if ($version -notmatch '^v22\.') { throw 'SPFx 1.22.2 requires Node 22. Install Node 22 before building.' }
$solutionPath = Join-Path $PSScriptRoot 'finance-weekly-sharepoint'
Push-Location $solutionPath
try {
  & $nodeExecutable ../prepare.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Asset preparation failed.' }
  $heftExecutable = Join-Path $solutionPath 'node_modules/@rushstack/heft/lib/start.js'
  if (!(Test-Path -LiteralPath $heftExecutable)) { throw 'Install package dependencies with npm ci in finance-weekly-sharepoint first.' }
  & $nodeExecutable $heftExecutable build --production
  if ($LASTEXITCODE -ne 0) { throw 'SPFx build failed.' }
  & $nodeExecutable $heftExecutable package-solution --production
  if ($LASTEXITCODE -ne 0) { throw 'SPFx packaging failed.' }
} finally { Pop-Location }
