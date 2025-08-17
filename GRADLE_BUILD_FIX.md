# Gradle Build Fix

## Latest Issue (2025-08-11)
The Android build was failing with the following error:

```
BUG! exception in phase 'semantic analysis' in source unit '_BuildScript_' Unsupported class file major version 68
```

### Root Cause
This error occurs when the Java version used to run Gradle is incompatible with the Gradle version:
- **Class file major version 68** corresponds to **Java 24**
- **Gradle 8.13** (used in this project) is not compatible with Java 24
- Gradle 8.13 is compatible with Java versions 17 through 21

### Solution
The fix was to re-enable the Java 17 path in the `android/gradle.properties` file:

```properties
# Specify Java version for Gradle to use
# The project requires Java 17-21 for compatibility with Gradle 8.13
# Class file major version 68 (Java 24) is not compatible with this Gradle version
org.gradle.java.home=/opt/homebrew/Cellar/openjdk@17/17.0.15/libexec/openjdk.jdk/Contents/Home
```

This directs Gradle to use Java 17 instead of the system default Java 24.

### Note for Deployment
For CI/CD environments or other developers' machines where this specific Java path doesn't exist:
1. Modify the path to point to a valid Java 17-21 installation
2. Or remove this line and ensure the system's default Java version is compatible (17-21)

## Previous Issue (2025-08-08)
The Android build was failing with the following error:

```
Value '/opt/homebrew/Cellar/openjdk@17/17.0.15/libexec/openjdk.jdk/Contents/Home' given for org.gradle.java.home Gradle property is invalid (Java home supplied is invalid)
```

### Root Cause
The `gradle.properties` file contained a hardcoded Java home path that was specific to a macOS Homebrew installation. This path didn't exist in other environments (like CI/CD systems or other developers' machines), causing the build to fail.

### Solution
The hardcoded Java home path was commented out in the `gradle.properties` file to allow Gradle to use the default Java installation in the build environment.

## Gradle-Java Compatibility Matrix
- Gradle 8.x: Java 17-21
- Gradle 7.x: Java 8-19
- Gradle 6.x: Java 8-15