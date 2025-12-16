param([int]$proposalId = 1)
$paths = @('..\\investor-network\\token.txt','D:\\\xampp\\htdocs\\word\\wp-content\\plugins\\investor-network\\token.txt')
$t = $null
foreach ($p in $paths) { if (Test-Path $p) { $t = (Get-Content $p -Raw).Trim(); Write-Output "Using token $p"; break } }
$headers = @{}
if ($t) { $headers = @{ Authorization = "Bearer $t" } }
function Normalize($r) { if ($null -eq $r) { return @() } if ($r -is [System.Array]) { return $r } if ($r.PSObject.Properties.Name -contains 'value') { return $r.value } if ($r.PSObject.Properties.Name -contains 'listings') { return $r.listings } return @() }
try { $baseRes = Invoke-RestMethod -Uri 'http://localhost/word/wp-json/investor-network/v1/listings' -Headers $headers -ErrorAction Stop } catch { Write-Error "Failed to fetch listings: $_"; exit 1 }
$base = Normalize $baseRes
try { $secRes = Invoke-RestMethod -Uri "http://localhost/word/wp-json/investor-network/v1/proposals/$proposalId/secondary-listings" -Headers $headers -ErrorAction Stop } catch { $secRes = $null }
$sec = Normalize $secRes
$byId = @{}
foreach ($it in $base) { if ($it -and $it.id -ne $null) { $byId[[string]$it.id] = $it } }
foreach ($s in $sec) {
    if (-not $s -or $s.id -eq $null) { continue }
    $sid = [string]$s.id
    $existing = $null
    if ($byId.ContainsKey($sid)) { $existing = $byId[$sid] }
    $merged = @{}
    if ($existing) { foreach ($p in $existing.psobject.Properties) { $merged[$p.Name] = $p.Value } }
    foreach ($p in $s.psobject.Properties) { $merged[$p.Name] = $p.Value }
    if (-not $merged.ContainsKey('price') -or -not $merged['price']) { if ($merged.ContainsKey('price_per_share') -and $merged['price_per_share']) { $merged['price'] = $merged['price_per_share'] } elseif ($merged.ContainsKey('unit_price') -and $merged['unit_price']) { $merged['price'] = $merged['unit_price'] } }
    if (-not $merged.ContainsKey('price_per_share') -or -not $merged['price_per_share']) { if ($merged.ContainsKey('unit_price') -and $merged['unit_price']) { $merged['price_per_share'] = $merged['unit_price'] } elseif ($merged.ContainsKey('price') -and $merged['price']) { $merged['price_per_share'] = $merged['price'] } }
    if (-not $merged.ContainsKey('seller_display_name') -or -not $merged['seller_display_name']) { if ($merged.ContainsKey('sellerName')) { $merged['seller_display_name'] = $merged['sellerName'] } elseif ($merged.ContainsKey('seller_name')) { $merged['seller_display_name'] = $merged['seller_name'] } }
    $byId[$sid] = (New-Object PSObject -Property $merged)
}
$mergedArray = @($byId.Keys | ForEach-Object { $byId[$_] })
$uiRows = $mergedArray | Where-Object { [int]($_.proposal_id) -eq $proposalId }
$fromSec = @()
foreach ($s in $sec) { $avail = $null; if ($s.PSObject.Properties.Name -contains 'available_quantity') { $avail = [int]$s.available_quantity } elseif ($s.PSObject.Properties.Name -contains 'availableQuantity') { $avail = [int]$s.availableQuantity } elseif ($s.PSObject.Properties.Name -contains 'available') { $avail = [int]$s.available } elseif ($s.PSObject.Properties.Name -contains 'quantity') { $avail = [int]$s.quantity } if ($avail -and $avail -gt 0) { $fromSec += $s } }
$dedup = @{}
foreach ($s in $fromSec) { if ($s -and $s.id -ne $null) { $dedup[[string]$s.id] = $s } }
$secondarySource = @($dedup.Keys | ForEach-Object { $dedup[$_] })
function pickFirstString($obj, $keys) { foreach ($k in $keys) { if ($obj.PSObject.Properties.Name -contains $k) { $v = $obj.$k; if ($v -ne $null -and [string]::IsNullOrWhiteSpace([string]$v) -eq $false) { return $v } } } return $null }
$uiRowsSlim = $uiRows | ForEach-Object { $title = pickFirstString $_ @('proposal_title','title','name'); $seller = pickFirstString $_ @('seller_display_name','sellerName','seller_name'); $avail = pickFirstString $_ @('available_quantity','availableQuantity','quantity','available'); $unit = pickFirstString $_ @('unit_price','price_per_share','price'); [PSCustomObject]@{ id = $_.id; proposal_id = $_.proposal_id; title = $title; seller = $seller; available_quantity = ($avail -as [int]) ; unit_price = ($unit -as [decimal]) } }
$secSlim = $secondarySource | ForEach-Object { $title = pickFirstString $_ @('proposal_title','title','name'); $seller = pickFirstString $_ @('seller_display_name','sellerName','seller_name'); $avail = pickFirstString $_ @('available_quantity','availableQuantity','quantity','available'); $unit = pickFirstString $_ @('unit_price','price_per_share','price'); [PSCustomObject]@{ id = $_.id; proposal_id = $_.proposal_id; title = $title; seller = $seller; available_quantity = ($avail -as [int]); unit_price = ($unit -as [decimal]) } }
$out = @{ proposal = $proposalId; baseCount = [int]($base.Count); baseIds = @($base | ForEach-Object { $_.id }); mergedCount = [int]($mergedArray.Count); uiRows = @($uiRowsSlim); secondarySource = @($secSlim) }
$out | ConvertTo-Json -Depth 6 | Set-Content -Path "$PSScriptRoot\..\merged_ui_preview_proposal_${proposalId}.json"
Write-Output "Wrote $PSScriptRoot\..\merged_ui_preview_proposal_${proposalId}.json"
