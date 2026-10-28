param(
  [string]$ConfigPath = (Join-Path (Split-Path $PSScriptRoot -Parent) '.supabase-setup.local.json')
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  throw "Config not found: $ConfigPath. Copy .supabase-setup.example.json and fill it in."
}

$config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $config.accessToken) { throw 'accessToken is required' }
if ($config.projectRef -notmatch '^[a-z]{20}$') {
  throw 'projectRef must be a 20-character lowercase project ref'
}
if (-not $config.adminEmail) { throw 'adminEmail is required' }
if (-not $config.adminPassword -or $config.adminPassword.Length -lt 8) {
  throw 'adminPassword must contain at least 8 characters'
}
if (-not $config.adminNickname) { $config.adminNickname = 'Kitchen Admin' }

$managementBase = 'https://api.supabase.com/v1'
$managementHeaders = @{
  Authorization = "Bearer $($config.accessToken)"
  Accept = 'application/json'
}

function Invoke-Management {
  param(
    [string]$Method,
    [string]$Path,
    $Body = $null,
    [int]$TimeoutSec = 120
  )
  $parameters = @{
    Method = $Method
    Uri = "$managementBase$Path"
    Headers = $managementHeaders
    TimeoutSec = $TimeoutSec
  }
  if ($null -ne $Body) {
    $parameters.ContentType = 'application/json'
    $parameters.Body = ($Body | ConvertTo-Json -Depth 30 -Compress)
  }
  try {
    Invoke-RestMethod @parameters
  } catch {
    $detail = ''
    if ($_.ErrorDetails.Message) { $detail = $_.ErrorDetails.Message }
    throw "Supabase API failed: $Method $Path`n$detail"
  }
}

Write-Host '[1/6] Checking project...'
$project = Invoke-Management -Method GET -Path "/projects/$($config.projectRef)"
$projectUrl = "https://$($config.projectRef).supabase.co"
Write-Host "Project: $($project.name)"

Write-Host '[2/6] Enabling Anonymous Sign-Ins...'
Invoke-Management -Method PATCH -Path "/projects/$($config.projectRef)/config/auth" -Body @{
  external_anonymous_users_enabled = $true
} | Out-Null

Write-Host '[3/6] Reading project API keys...'
$keys = Invoke-Management -Method GET -Path "/projects/$($config.projectRef)/api-keys?reveal=true"
$publishable = $keys |
  Where-Object { $_.type -eq 'publishable' -and $_.api_key } |
  Select-Object -First 1
$secret = $keys |
  Where-Object { $_.type -eq 'secret' -and $_.api_key } |
  Select-Object -First 1
if (-not $publishable) {
  throw 'Publishable key was not returned. Copy it manually into .env.local.'
}
if (-not $secret) {
  throw 'Secret key was not returned. Create the admin user in Authentication -> Users first.'
}

Write-Host '[4/6] Running database migration...'
$migrationPath = Join-Path $projectRoot 'supabase/migrations/202610240001_community.sql'
$migration = Get-Content -LiteralPath $migrationPath -Raw -Encoding UTF8
$cronWarning = $false
try {
  Invoke-Management -Method POST -Path "/projects/$($config.projectRef)/database/query" -Body @{
    query = $migration
    read_only = $false
  } | Out-Null
} catch {
  if ($_.Exception.Message -match 'pg_cron|cron\.schedule|schema "cron"') {
    Write-Host 'pg_cron is unavailable. Running migration without the scheduled cron statement.'
    $withoutCron = $migration `
      -replace 'create extension if not exists pg_cron;', '' `
      -replace '(?s)select cron\.schedule\(.*?\$\);\s*$', ''
    Invoke-Management -Method POST -Path "/projects/$($config.projectRef)/database/query" -Body @{
      query = $withoutCron
      read_only = $false
    } | Out-Null
    $cronWarning = $true
  } else {
    throw
  }
}

Write-Host '[5/6] Creating or updating admin account...'
$adminHeaders = @{
  apikey = $secret.api_key
  Authorization = "Bearer $($secret.api_key)"
  Accept = 'application/json'
}
try {
  Invoke-RestMethod `
    -Method POST `
    -Uri "$projectUrl/auth/v1/admin/users" `
    -Headers $adminHeaders `
    -ContentType 'application/json' `
    -Body (@{
      email = $config.adminEmail
      password = $config.adminPassword
      email_confirm = $true
    } | ConvertTo-Json -Compress) | Out-Null
} catch {
  $statusCode = $null
  if ($_.Exception.Response) { $statusCode = $_.Exception.Response.StatusCode.value__ }
  if ($statusCode -notin @(409,422)) {
    throw "Admin user creation failed: $($_.Exception.Message)"
  }
  Write-Host 'Admin user already exists. Updating its community profile.'
}

$escapedNickname = $config.adminNickname.Replace("'", "''")
$escapedEmail = $config.adminEmail.Replace("'", "''")
$adminSql = @"
insert into public.community_profiles (id, nickname, avatar_color, is_admin)
select id, '$escapedNickname', '#39724b', true
from auth.users
where email = '$escapedEmail'
on conflict (id) do update
set is_admin = true,
    nickname = excluded.nickname;
"@
Invoke-Management -Method POST -Path "/projects/$($config.projectRef)/database/query" -Body @{
  query = $adminSql
  read_only = $false
} | Out-Null

Write-Host '[6/6] Writing .env.local...'
$envPath = Join-Path $projectRoot '.env.local'
@"
NEXT_PUBLIC_SUPABASE_URL=$projectUrl
NEXT_PUBLIC_SUPABASE_ANON_KEY=$($publishable.api_key)
"@ | Set-Content -LiteralPath $envPath -Encoding utf8

Write-Host ''
Write-Host 'Supabase community setup completed.'
Write-Host "Project URL: $projectUrl"
Write-Host 'Admin: http://localhost:3000/community/admin/'
if ($cronWarning) {
  Write-Host 'Action required: call public.community_prune_lobby() hourly.'
}
