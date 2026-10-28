$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$configPath = Join-Path $projectRoot '.supabase-setup.local.json'

Write-Host ''
Write-Host 'Supabase setup configuration wizard'
Write-Host 'Create the access token in Supabase: Account Settings -> Access Tokens.'
Write-Host ''

$accessToken = (Read-Host 'Paste the sbp_ access token').Trim()
if ($accessToken -notmatch '^sbp_') {
  throw 'Access token must start with sbp_'
}

$projectRef = (Read-Host 'Enter the 20-character project ref').Trim()
if ($projectRef -notmatch '^[a-z]{20}$') {
  throw 'Project ref must be exactly 20 lowercase letters'
}

$adminEmail = (Read-Host 'Admin email [admin@example.com]').Trim()
if (-not $adminEmail) { $adminEmail = 'admin@example.com' }

$securePassword = Read-Host 'Enter the admin password (at least 8 characters)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $adminPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
if (-not $adminPassword -or $adminPassword.Length -lt 8) {
  throw 'Admin password must contain at least 8 characters'
}

$adminNickname = (Read-Host 'Admin nickname [Kitchen Admin]').Trim()
if (-not $adminNickname) { $adminNickname = 'Kitchen Admin' }

$config = [ordered]@{
  accessToken = $accessToken
  projectRef = $projectRef
  adminEmail = $adminEmail
  adminPassword = $adminPassword
  adminNickname = $adminNickname
}

$config | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding utf8

Write-Host ''
Write-Host 'Configuration saved.'
Write-Host "Project ref: $projectRef"
Write-Host "Token prefix: $($accessToken.Substring(0, [Math]::Min(8, $accessToken.Length)))..."
Write-Host 'You may close this window and tell the Codex assistant: saved'
