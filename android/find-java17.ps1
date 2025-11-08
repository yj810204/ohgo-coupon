# PowerShell script to find Java 17 on Windows
# This is the Windows equivalent of find-java17.sh

# Common locations for Java installations on Windows
$possibleLocations = @(
    "$env:ProgramFiles\Java",
    "${env:ProgramFiles(x86)}\Java",
    "$env:LOCALAPPDATA\Programs\Eclipse Adoptium",
    "$env:LOCALAPPDATA\Programs\Microsoft",
    "$env:ProgramFiles\Eclipse Adoptium",
    "$env:ProgramFiles\Microsoft",
    "C:\Program Files\Java",
    "C:\Program Files (x86)\Java"
)

# Function to find Java 17 in a directory
function Find-Java17 {
    param([string]$dir)
    
    if (Test-Path $dir) {
        # Find directories that might contain Java 17
        $javaDirs = Get-ChildItem -Path $dir -Directory -ErrorAction SilentlyContinue | Where-Object { 
            $_.Name -match ".*17.*" -or $_.Name -match "jdk-17" -or $_.Name -match "jdk17" 
        }
        
        foreach ($javaDir in $javaDirs) {
            $javaExe = Join-Path $javaDir.FullName "bin\java.exe"
            if (Test-Path $javaExe) {
                return $javaDir.FullName
            }
        }
    }
    return $null
}

# Try to find Java 17
$java17Home = $null
foreach ($location in $possibleLocations) {
    $java17Home = Find-Java17 -dir $location
    if ($java17Home) {
        Write-Host "Found Java 17 at: $java17Home" -ForegroundColor Green
        break
    }
}

# Also check JAVA_HOME environment variable
if (-not $java17Home -and $env:JAVA_HOME) {
    $javaExe = Join-Path $env:JAVA_HOME "bin\java.exe"
    if (Test-Path $javaExe) {
        $version = & "$javaExe" -version 2>&1 | Select-Object -First 1
        if ($version -match "17") {
            $java17Home = $env:JAVA_HOME
            Write-Host "Found Java 17 in JAVA_HOME: $java17Home" -ForegroundColor Green
        }
    }
}

if (-not $java17Home) {
    Write-Host "Could not find Java 17 installation. Please install Java 17 and try again." -ForegroundColor Red
    Write-Host ""
    Write-Host "You can download Java 17 from:" -ForegroundColor Yellow
    Write-Host "  - Eclipse Adoptium: https://adoptium.net/temurin/releases/?version=17" -ForegroundColor Yellow
    Write-Host "  - Microsoft Build of OpenJDK: https://learn.microsoft.com/en-us/java/openjdk/download" -ForegroundColor Yellow
    exit 1
}

# Update gradle.properties
$gradleProps = Join-Path $PSScriptRoot "gradle.properties"
if (Test-Path $gradleProps) {
    # Create a backup
    $backupPath = "$gradleProps.bak"
    Copy-Item $gradleProps $backupPath -Force
    
    # Read the file content
    $content = Get-Content $gradleProps -Raw
    
    # Update the Java home path (handle both Windows and Unix-style paths)
    $content = $content -replace "org\.gradle\.java\.home=.*", "org.gradle.java.home=$java17Home"
    
    # Write back to file
    Set-Content $gradleProps $content -NoNewline
    
    Write-Host "Updated $gradleProps to use Java 17 at $java17Home" -ForegroundColor Green
    Write-Host "Backup saved to: $backupPath" -ForegroundColor Gray
} else {
    Write-Host "Could not find $gradleProps" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Done. You can now run Gradle with Java 17." -ForegroundColor Green

