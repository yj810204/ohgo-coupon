# Windows PowerShell script for testing Android build
# This is the Windows equivalent of test-build.sh

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Set-Location android

# Run the assembleRelease task to test the build process
.\gradlew.bat :app:assembleRelease

