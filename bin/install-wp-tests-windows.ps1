param(
    [Parameter(Mandatory=$true)][string]$DB_NAME,
    [Parameter(Mandatory=$true)][string]$DB_USER,
    [Parameter(Mandatory=$true)][string]$DB_PASS,
    [string]$DB_HOST = 'localhost',
    [string]$WP_VERSION = 'latest',
    [string]$SKIP_DB_CREATE = 'false'
)

Write-Host "Installing WP tests for version: $WP_VERSION to temporary directories"

$TMPDIR = Join-Path -Path ([IO.Path]::GetTempPath()) -ChildPath "wp-tests"
if (-Not (Test-Path $TMPDIR)) { New-Item -ItemType Directory -Path $TMPDIR | Out-Null }

$WP_CORE_DIR = Join-Path $TMPDIR 'wordpress'
$WP_TESTS_DIR = Join-Path $TMPDIR 'wordpress-tests-lib'

function Download-File($url, $out) {
    Write-Host "Downloading $url"
    Invoke-WebRequest -Uri $url -UseBasicParsing -OutFile $out
}

if ($WP_VERSION -eq 'latest') {
    $coreUrl = 'https://wordpress.org/latest.zip'
} else {
    $coreUrl = "https://wordpress.org/wordpress-$WP_VERSION.zip"
}

$coreZip = Join-Path $TMPDIR 'wordpress-core.zip'
Download-File $coreUrl $coreZip

if (Test-Path $WP_CORE_DIR) { Remove-Item -Recurse -Force $WP_CORE_DIR }
New-Item -ItemType Directory -Path $WP_CORE_DIR | Out-Null
Write-Host "Extracting core to $WP_CORE_DIR"
Expand-Archive -Path $coreZip -DestinationPath $WP_CORE_DIR -Force

# Attempt to download wordpress-develop tests from GitHub (try master then main)
$devZip = Join-Path $TMPDIR 'wordpress-develop.zip'
$devUrls = @("https://github.com/WordPress/wordpress-develop/archive/refs/heads/master.zip", "https://github.com/WordPress/wordpress-develop/archive/refs/heads/main.zip", "https://github.com/WordPress/wordpress-develop/archive/refs/heads/trunk.zip")
$gotDev = $false
foreach ($u in $devUrls) {
    try {
        Download-File $u $devZip
        $gotDev = $true
        break
    } catch {
        Write-Host "Failed to download $u, trying next"
    }
}
if (-Not $gotDev) { Write-Error "Could not download wordpress-develop archive. Aborting."; exit 1 }

# Extract dev zip and copy tests/phpunit/includes and data
$devExtract = Join-Path $TMPDIR 'wordpress-develop'
if (Test-Path $devExtract) { Remove-Item -Recurse -Force $devExtract }
New-Item -ItemType Directory -Path $devExtract | Out-Null
Expand-Archive -Path $devZip -DestinationPath $devExtract -Force

# locate extracted root that contains tests/
$root = Get-ChildItem -Path $devExtract | Where-Object { $_.PSIsContainer } | Select-Object -First 1
if (-Not $root) { Write-Error "Extracted wordpress-develop has unexpected layout"; exit 1 }

$includesSrc = Join-Path $root.FullName 'tests\phpunit\includes'
$dataSrc = Join-Path $root.FullName 'tests\phpunit\data'

if (-Not (Test-Path $includesSrc)) { Write-Error "Could not find tests/phpunit/includes in wordpress-develop archive"; exit 1 }

if (Test-Path $WP_TESTS_DIR) { Remove-Item -Recurse -Force $WP_TESTS_DIR }
New-Item -ItemType Directory -Path $WP_TESTS_DIR | Out-Null
Copy-Item -Path $includesSrc -Destination (Join-Path $WP_TESTS_DIR 'includes') -Recurse
if (Test-Path $dataSrc) { Copy-Item -Path $dataSrc -Destination (Join-Path $WP_TESTS_DIR 'data') -Recurse }

# Copy wp-tests-config-sample.php from dev root if present
$sample = Join-Path $root.FullName 'wp-tests-config-sample.php'
if (-Not (Test-Path $sample)) {
    Write-Error "Could not find wp-tests-config-sample.php in wordpress-develop archive"
    exit 1
}
Copy-Item -Path $sample -Destination (Join-Path $WP_TESTS_DIR 'wp-tests-config.php') -Force

# Update wp-tests-config.php placeholders
$configPath = Join-Path $WP_TESTS_DIR 'wp-tests-config.php'
((Get-Content $configPath) -replace "youremptytestdbnamehere", $DB_NAME) | Set-Content $configPath
((Get-Content $configPath) -replace "yourusernamehere", $DB_USER) | Set-Content $configPath
((Get-Content $configPath) -replace "yourpasswordhere", $DB_PASS) | Set-Content $configPath
((Get-Content $configPath) -replace "localhost", $DB_HOST) | Set-Content $configPath
((Get-Content $configPath) -replace "__DIR__ \. '/src/'", ("$($WP_CORE_DIR.Replace('\\','/'))/")) | Set-Content $configPath

Write-Host "WP tests installed to: $WP_TESTS_DIR"

# Create database using XAMPP mysql if available
$mysqlExeCandidates = @("D:\xampp\mysql\bin\mysql.exe", "C:\xampp\mysql\bin\mysql.exe", "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe")
$mysqlExe = $mysqlExeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-Not $mysqlExe) {
    Write-Warning "mysql client not found on typical XAMPP paths. You must create the test database manually."
    exit 0
}

if ($SKIP_DB_CREATE -ne 'true') {
    Write-Host "Creating test database '$DB_NAME' using $mysqlExe"
    $createCmd = "CREATE DATABASE IF NOT EXISTS `$DB_NAME`;"
    $args = @("-u$DB_USER")
    if ($DB_PASS -ne '') { $args += "-p$DB_PASS" }
    $args += @("-e", $createCmd)
    & $mysqlExe @args
    if ($LASTEXITCODE -ne 0) { Write-Warning "mysql client returned exit code $LASTEXITCODE. You may need to create DB manually." }
}

Write-Host "Done. Set environment variable WP_TESTS_DIR to '$WP_TESTS_DIR' and run vendor\bin\phpunit -c phpunit.xml.dist"
