# Captures README screenshots from the web build in demo mode (fictional data).
# Requires the dev server: npm run web   (http://localhost:5199)
param(
  [string]$Base = 'http://localhost:5199/',
  [string]$Out = (Join-Path $PSScriptRoot '..\docs\screenshots')
)

$browser = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Edge oder Chrome nicht gefunden' }

New-Item -ItemType Directory -Force $Out | Out-Null
$profileDir = Join-Path $env:TEMP "ember-shots-$(Get-Random)"

$shots = [ordered]@{
  'planen-woche'      = '?demo&page=plan&view=week'
  'planen-monat'      = '?demo&page=plan&view=month&tab=today'
  'todo-details'      = '?demo&page=plan&view=week&todo=1'
  'todos'             = '?demo&page=todos&picked=3'
  'uebersicht'        = '?demo&page=overview'
  'schnelleingabe'    = '?demo&page=plan&view=week&add=Karte zeichnen bis Fr ~Mi %23dnd !! 2h'
  'befehlspalette'    = '?demo&page=plan&view=week&palette=sess'
  'theme-rose'        = '?demo&page=plan&view=week&theme=rose'
}

foreach ($name in $shots.Keys) {
  $file = Join-Path (Resolve-Path $Out) "$name.png"
  $url = $Base + $shots[$name]
  & $browser --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
    --window-size=1440,900 --virtual-time-budget=6000 --user-data-dir="$profileDir" `
    --screenshot="$file" "$url" 2>$null | Out-Null
  Write-Output "$name -> $(if (Test-Path $file) { (Get-Item $file).Length } else { 'FEHLT' })"
}
Remove-Item -Recurse -Force $profileDir -ErrorAction SilentlyContinue
