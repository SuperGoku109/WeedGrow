param(
  [Parameter(Mandatory=$true)][string]$PlantId,
  [string]$AppId = 'com.zg.weedgrow',
  [string]$Maestro = "$env:LOCALAPPDATA\WeedGrowTools\maestro\bin\maestro.bat",
  [string]$Device
)
$ErrorActionPreference = 'Stop'
$env:MAESTRO_CLI_NO_ANALYTICS = '1'
$env:MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED = 'true'
if ($PlantId -notmatch '^[A-Za-z0-9_-]+$') { throw 'Supply a valid plant ID in the signed-in test account.' }
if (!(Test-Path -LiteralPath $Maestro)) { throw 'Install Maestro from the official documentation or supply -Maestro.' }
$maestroArgs = @()
if ($Device) { $maestroArgs += @('--device', $Device) }
$maestroArgs += @('test', '--format', 'junit', '--output', '.maestro-results/results.xml', '-e', "APP_ID=$AppId", '-e', "PLANT_LINK=weedgrowapp://plant/${PlantId}?id=${PlantId}&returnToPlants=1", '.maestro')
& $Maestro @maestroArgs
if ($LASTEXITCODE -ne 0) { throw 'Device checks failed. Inspect .maestro-results and the Maestro output.' }
