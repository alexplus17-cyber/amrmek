# REST checks: token, members/me, members/me/dashboard, listings
$ErrorActionPreference = 'Stop'
Set-Location -Path 'D:\xampp\htdocs\word\wp-content\plugins\investor-network-mobile\mobile'
$creds = @{ username='test2@example.com'; password='$wp$2y$10$LNfT6ZImUZ' } | ConvertTo-Json
try {
  $tokenResp = Invoke-RestMethod -Uri 'http://localhost/word/wp-json/jwt-auth/v1/token' -Method Post -Body $creds -ContentType 'application/json' -UseBasicParsing
} catch {
  Write-Output '===TOKEN_ERROR==='
  if ($_.Exception.Response) { (New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() } else { $_.ToString() }
  exit 1
}
Write-Output '===RAW_TOKEN_RESPONSE==='
# Some installs may return a quoted JSON string; normalize
if ($tokenResp -is [string]) { Write-Output $tokenResp } else { $tokenResp | ConvertTo-Json -Depth 5 }

# Robustly extract the token string regardless of how the response is returned
$token = $null
try {
  if ($tokenResp -is [string]) {
    $parsed = $tokenResp | ConvertFrom-Json -ErrorAction Stop
    $token = $parsed.token
  } elseif ($tokenResp -ne $null -and $tokenResp.PSObject.Properties.Match('token').Count -gt 0) {
    $token = $tokenResp.token
  } else {
    # Fallback: stringify and regex-extract
    $raw = $tokenResp | Out-String
    if ($raw -match '"token"\s*:\s*"([^"]+)"') { $token = $matches[1] }
  }
} catch {
  # Last-resort: try regex on JSON text
  $raw = ($tokenResp | Out-String)
  if ($raw -match '"token"\s*:\s*"([^"]+)"') { $token = $matches[1] }
}

Write-Output '===TOKEN==='
if ($token) { Write-Output $token } else { Write-Output '<<NO_TOKEN_EXTRACTED>>'; Write-Output ($tokenResp | ConvertTo-Json -Depth 5) }

# members/me
try {
  $me = Invoke-RestMethod -Uri 'http://localhost/word/wp-json/investor-network/v1/members/me' -Method Get -Headers @{ Authorization = "Bearer $token" }
  Write-Output '===MEMBER==='
  $me | ConvertTo-Json -Depth 10
} catch {
  Write-Output '===MEMBER_ERROR==='
  if ($_.Exception.Response) { (New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() } else { $_.ToString() }
}

# members/me/dashboard
try {
  $dash = Invoke-RestMethod -Uri 'http://localhost/word/wp-json/investor-network/v1/members/me/dashboard' -Method Get -Headers @{ Authorization = "Bearer $token" }
  Write-Output '===DASH==='
  $dash | ConvertTo-Json -Depth 10
} catch {
  Write-Output '===DASH_ERROR==='
  if ($_.Exception.Response) { (New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() } else { $_.ToString() }
}

# listings (public)
try {
  $listings = Invoke-RestMethod -Uri 'http://localhost/word/wp-json/investor-network/v1/listings' -Method Get -UseBasicParsing
  Write-Output '===LISTINGS==='
  $listings | ConvertTo-Json -Depth 10
} catch {
  Write-Output '===LISTINGS_ERROR==='
  if ($_.Exception.Response) { (New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() } else { $_.ToString() }
}
