#!/bin/bash

# This script attempts to find a Java 17 installation on the system
# and updates gradle.properties to use it

# Common locations for Java installations
POSSIBLE_LOCATIONS=(
  # macOS Homebrew
  "/opt/homebrew/Cellar/openjdk@17"
  "/usr/local/Cellar/openjdk@17"
  # macOS system Java
  "/Library/Java/JavaVirtualMachines"
  # Linux
  "/usr/lib/jvm"
  # Windows (via WSL)
  "/mnt/c/Program Files/Java"
  "/mnt/c/Program Files (x86)/Java"
)

# Function to find Java 17 in a directory
find_java17() {
  local dir="$1"
  if [ -d "$dir" ]; then
    # Find directories that might contain Java 17
    for java_dir in $(find "$dir" -maxdepth 2 -type d -name "*17*" 2>/dev/null); do
      # Check if this is a valid Java home
      if [ -f "$java_dir/bin/java" ] || [ -f "$java_dir/Contents/Home/bin/java" ]; then
        # For macOS, we need to append Contents/Home
        if [ -f "$java_dir/Contents/Home/bin/java" ]; then
          echo "$java_dir/Contents/Home"
        else
          echo "$java_dir"
        fi
        return 0
      fi
    done
  fi
  return 1
}

# Try to find Java 17
JAVA17_HOME=""
for location in "${POSSIBLE_LOCATIONS[@]}"; do
  if JAVA17_HOME=$(find_java17 "$location"); then
    echo "Found Java 17 at: $JAVA17_HOME"
    break
  fi
done

if [ -z "$JAVA17_HOME" ]; then
  echo "Could not find Java 17 installation. Please install Java 17 and try again."
  exit 1
fi

# Update gradle.properties
GRADLE_PROPS="./gradle.properties"
if [ -f "$GRADLE_PROPS" ]; then
  # Create a backup
  cp "$GRADLE_PROPS" "${GRADLE_PROPS}.bak"
  
  # Update the Java home path
  sed -i.tmp "s|org.gradle.java.home=.*|org.gradle.java.home=$JAVA17_HOME|g" "$GRADLE_PROPS"
  rm "${GRADLE_PROPS}.tmp"
  
  echo "Updated $GRADLE_PROPS to use Java 17 at $JAVA17_HOME"
else
  echo "Could not find $GRADLE_PROPS"
  exit 1
fi

echo "Done. You can now run Gradle with Java 17."