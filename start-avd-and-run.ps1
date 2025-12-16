<#
Start-AVD-and-Run.ps1

Usage:
  .\start-avd-and-run.ps1 -AvdName "Pixel_4_API_33"

What it does:
 - Locates emulator.exe
 - Lists AVDs (if -AvdName not provided)
 - Starts the requested AVD
 - Waits for boot completion
 - Updates `constants.ts` in this repo to use http://10.0.2.2/word (backup created)
 - Opens the subscribe page in emulator browser
 - Runs `npx react-native run-android` in the `mobile` folder

Notes:
 - Ensure Android SDK (emulator & adb) is installed and on PATH or in standard locations.
 - Run this from a PowerShell prompt with appropriate rights.
#>

param(
    [string]$AvdName,
    [switch]$RevertAfterRun = $true
)

# Helper: find emulator.exe
$possibleEmulators = @(
    "$env:ANDROID_SDK_ROOT\emulator\emulator.exe",
    "$env:ANDROID_HOME\emulator\emulator.exe",
    "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe"
) | Where-Object { Test-Path $_ }

if (-not $possibleEmulators) {
    Write-Error "Could not find emulator.exe. Ensure ANDROID_SDK_ROOT / ANDROID_HOME or SDK at %LOCALAPPDATA% is installed."
    exit 1
}
$emulatorExe = $possibleEmulators[0]
Write-Output "Using emulator: $emulatorExe"

# If no AVD provided, list available AVDs and exit
if (-not $AvdName) {
    Write-Output "Available AVDs:";
    & $emulatorExe -list-avds
    Write-Output "\nRun the script again with -AvdName 'Your_AVD_Name' to start one.";
    exit 0
}

# Start AVD
Write-Output "Starting AVD: $AvdName"
Start-Process -FilePath $emulatorExe -ArgumentList "-avd `"$AvdName`"" -NoNewWindow

# Ensure adb is available
$adb = "adb"
try {
    & $adb version > $null 2>&1
} catch {
    Write-Error "adb not found in PATH. Ensure Android platform-tools are available."
    exit 1
}

# Wait for device
Write-Output "Waiting for emulator (adb device)..."
& $adb wait-for-device

Write-Output "Waiting for emulator to finish booting (sys.boot_completed)..."
while (($(& $adb shell getprop sys.boot_completed 2>$null).Trim()) -ne '1') {
    Start-Sleep -Seconds 1
}
Write-Output "Emulator fully booted."

# Determine repo root (this script should be placed in the project root)
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = $scriptPath
Write-Output "Assuming repo root is: $repoRoot"

# Path to constants.ts (project root)
$constantsPath = Join-Path $repoRoot 'constants.ts'
if (-not (Test-Path $constantsPath)) {
    Write-Error "constants.ts not found at $constantsPath. Please adjust the script location or update the path."
    exit 1
}

# Backup and update constants.ts to use emulator host mapping
$backup = $constantsPath + '.bak'
Copy-Item -Path $constantsPath -Destination $backup -Force
Write-Output "Backed up constants.ts to $backup"

# Replace API_BASE_URL line
$content = Get-Content $constantsPath -Raw
$pattern = "export\s+const\s+API_BASE_URL\s*=\s*'[^']*'\s*;"
$replacement = "export const API_BASE_URL = 'http://10.0.2.2/word';"
if ($content -match $pattern) {
    $newContent = [regex]::Replace($content, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $replacement })
    Set-Content -Path $constantsPath -Value $newContent -Encoding UTF8
    Write-Output "Updated API_BASE_URL to http://10.0.2.2/word in constants.ts"
} else {
    Write-Warning "API_BASE_URL export not found in constants.ts. No changes made."
}

# Open subscribe page in emulator browser
$subscribeUrl = 'http://10.0.2.2/word/member-subscribe-form/'
Write-Output "Opening subscribe page in emulator: $subscribeUrl"
& $adb shell am start -a android.intent.action.VIEW -d $subscribeUrl

# Run the Android app using RN CLI
$mobileDir = Join-Path $repoRoot 'mobile'
if (-not (Test-Path $mobileDir)) {
    Write-Error "Mobile folder not found at $mobileDir. Expected React Native project in 'mobile' subfolder."
    exit 1
}

Write-Output "Running 'npx react-native run-android' in $mobileDir"
Push-Location $mobileDir
try {
    # Run the CLI and stream output
    & npx react-native run-android
} catch {
    Write-Error "Failed to run the Android app: $_"
} finally {
    Pop-Location

    if ($RevertAfterRun) {
        try {
            if (Test-Path $backup) {
                Copy-Item -Path $backup -Destination $constantsPath -Force
                Remove-Item -Path $backup -Force
                Write-Output "Reverted constants.ts from backup and removed $backup"
            } else {
                Write-Warning "Backup not found, nothing to revert."
            }
        } catch {
            Write-Warning "Failed to revert constants.ts: $_"
        }
    } else {
        Write-Output "Leaving modified constants.ts in place (no revert). Backup at: $backup"
    }
}

Write-Output "Script finished."
