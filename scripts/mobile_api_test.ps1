$ErrorActionPreference = 'Continue'
$t = (Get-Content 'D:\xampp\htdocs\word\wp-content\plugins\investor-network\token.txt' -Raw).Trim()
$hdr = @{ Authorization = "Bearer $t"; Origin = 'http://localhost:3001'; 'Content-Type' = 'application/json' }

Write-Output '---GET PROPOSALS---'
try { Invoke-RestMethod -Uri 'http://localhost/word/wp-json/investor-network/v1/proposals' -Headers $hdr | ConvertTo-Json -Depth 5 | Write-Output } catch { Write-Output "Proposals request failed: $($_.Exception.Message)" }

Write-Output '---GET LISTINGS---'
try { Invoke-RestMethod -Uri 'http://localhost/word/wp-json/investor-network/v1/listings' -Headers $hdr | ConvertTo-Json -Depth 5 | Write-Output } catch { Write-Output "Listings request failed: $($_.Exception.Message)" }

Write-Output '---GET PAYMENTS CONFIG---'
try { Invoke-RestMethod -Uri 'http://localhost/word/wp-json/investor-network/v1/payments/config' -Headers $hdr | ConvertTo-Json -Depth 5 | Write-Output } catch { Write-Output "Payments config failed: $($_.Exception.Message)" }

Write-Output '---GET LISTING 6 DETAILS---'
try { Invoke-RestMethod -Uri 'http://localhost/word/wp-json/investor-network/v1/listings/6' -Headers $hdr | ConvertTo-Json -Depth 8 | Write-Output } catch { Write-Output "Listing details failed: $($_.Exception.Message)" }

Write-Output '---POST PURCHASE LISTING 6 (bank)---'
$payload = @{ quantity=1; payment_method='bank'; payment_payload=@{ note='E2E mobile checkout - listing 6' } } | ConvertTo-Json -Depth 5
try { Invoke-RestMethod -Uri 'http://localhost/word/wp-json/investor-network/v1/listings/6/purchase' -Method Post -Headers $hdr -Body $payload -ContentType 'application/json' | ConvertTo-Json -Depth 8 | Write-Output } catch { Write-Output "Purchase failed: $($_.Exception.Message)" }

Write-Output '---GET INVOICES---'
try { Invoke-RestMethod -Uri 'http://localhost/word/wp-json/investor-network/v1/invoices' -Headers $hdr | ConvertTo-Json -Depth 8 | Write-Output } catch { Write-Output "Get invoices failed: $($_.Exception.Message)" }

Write-Output '---GET CURRENT WP USER---'
try { $me = Invoke-RestMethod -Uri 'http://localhost/word/wp-json/wp/v2/users/me' -Headers $hdr; $me | ConvertTo-Json -Depth 5 | Write-Output } catch { Write-Output "Get current user failed: $($_.Exception.Message)" }

Write-Output '---GET MEMBER HOLDINGS (members/me/portfolio?type=holdings)---'
try { Invoke-RestMethod -Uri 'http://localhost/word/wp-json/investor-network/v1/members/me/portfolio?type=holdings&per_page=200' -Headers $hdr | ConvertTo-Json -Depth 8 | Write-Output } catch { Write-Output "Get holdings failed: $($_.Exception.Message)" }

Write-Output '---GET SELL REQUESTS (members/{id}/sell-requests)---'
try { if ($me -and $me.id) { Invoke-RestMethod -Uri "http://localhost/word/wp-json/investor-network/v1/members/$($me.id)/sell-requests" -Headers $hdr | ConvertTo-Json -Depth 8 | Write-Output } else { Write-Output 'Skipping sell-requests: could not determine current user id' } } catch { Write-Output "Get sell-requests failed: $($_.Exception.Message)" }

Write-Output '---DONE---'
