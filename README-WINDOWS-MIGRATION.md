# Windows 마이그레이션 가이드

이 프로젝트를 macOS에서 Windows로 마이그레이션하기 위한 가이드입니다.

## 주요 변경 사항

### 1. 스크립트 파일

- **test-build.sh** → **test-build.ps1** (PowerShell 버전)
- **android/find-java17.sh** → **android/find-java17.ps1** (PowerShell 버전)

### 2. Java 경로 설정

Windows에서 Android 빌드를 위해 Java 17이 필요합니다.

#### 방법 1: 자동 감지 스크립트 사용 (권장)

```powershell
cd android
.\find-java17.ps1
```

이 스크립트는 다음 위치에서 Java 17을 자동으로 찾습니다:
- `C:\Program Files\Java`
- `C:\Program Files (x86)\Java`
- `%LOCALAPPDATA%\Programs\Eclipse Adoptium`
- `%LOCALAPPDATA%\Programs\Microsoft`
- JAVA_HOME 환경 변수

#### 방법 2: 수동 설정

`android/gradle.properties` 파일을 열고 다음 라인의 주석을 해제하고 경로를 설정하세요:

```properties
org.gradle.java.home=C:\\Program Files\\Java\\jdk-17
```

> **참고**: Windows 경로에서 백슬래시는 이스케이프되어 `\\`로 표기됩니다.

### 3. Android 빌드 테스트

```powershell
.\test-build.ps1
```

또는 직접 실행:

```powershell
cd android
.\gradlew.bat :app:assembleRelease
```

### 4. 라인 엔딩 설정

`.gitattributes` 파일이 생성되어 있어서 Git에서 자동으로 라인 엔딩을 관리합니다:
- 텍스트 파일: LF (Unix 스타일)
- PowerShell 스크립트: CRLF (Windows 스타일)
- 바이너리 파일: 변경 없음

### 5. 필수 소프트웨어

Windows에서 개발하려면 다음이 필요합니다:

1. **Node.js** (v18 이상 권장)
2. **Java 17-21** (Android 빌드용)
   - [Eclipse Adoptium](https://adoptium.net/temurin/releases/?version=17) 다운로드
   - 또는 [Microsoft Build of OpenJDK](https://learn.microsoft.com/en-us/java/openjdk/download)
3. **Android Studio** (Android SDK 포함)
4. **Expo CLI** (`npm install -g expo-cli` 또는 `npm install` 후 `npx expo` 사용)

### 6. 환경 변수 설정 (선택사항)

Java를 시스템 전체에서 사용하려면 JAVA_HOME 환경 변수를 설정하세요:

```powershell
# PowerShell에서 임시로 설정
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"

# 영구적으로 설정하려면 시스템 환경 변수에서 설정
# 제어판 > 시스템 > 고급 시스템 설정 > 환경 변수
```

### 7. 문제 해결

#### "expo는 내부 또는 외부 명령이 아닙니다" 오류

```powershell
npm install
```

#### "SyntaxError: Unexpected character" 오류 (macOS 리소스 포크 파일)

macOS에서 Windows로 파일을 전송할 때 생성된 `._*` 리소스 포크 파일들이 Metro 번들러를 방해할 수 있습니다.

**해결 방법:**

```powershell
# 모든 macOS 리소스 포크 파일 삭제 (node_modules와 .git 제외)
Get-ChildItem -Path . -Recurse -Filter "._*" -Force -ErrorAction SilentlyContinue | 
    Where-Object { $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*\.git\*" } | 
    Remove-Item -Force -ErrorAction SilentlyContinue

# .DS_Store 파일도 삭제
Get-ChildItem -Path . -Recurse -Filter ".DS_Store" -Force | Remove-Item -Force

# Expo 캐시 클리어
Remove-Item -Path .expo -Recurse -Force -ErrorAction SilentlyContinue
```

이 파일들은 `.gitignore`에 추가되어 있어서 앞으로는 Git에 추가되지 않습니다.

#### Gradle 빌드 실패

1. Java 17이 설치되어 있는지 확인:
   ```powershell
   java -version
   ```

2. `find-java17.ps1` 스크립트 실행:
   ```powershell
   cd android
   .\find-java17.ps1
   ```

3. Android SDK 경로 확인:
   - Android Studio에서 SDK Manager를 열어 Android SDK가 설치되어 있는지 확인
   - `ANDROID_HOME` 또는 `ANDROID_SDK_ROOT` 환경 변수가 설정되어 있는지 확인

#### PowerShell 스크립트 실행 오류

PowerShell 실행 정책 때문에 스크립트가 실행되지 않을 수 있습니다:

```powershell
# 현재 실행 정책 확인
Get-ExecutionPolicy

# 실행 정책 변경 (관리자 권한 필요)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 추가 참고사항

- macOS와 Windows 간 경로 구분자 차이 (`/` vs `\`)는 Node.js의 `path.join()`을 사용하면 자동으로 처리됩니다.
- 대부분의 설정 파일은 상대 경로를 사용하므로 플랫폼 독립적입니다.
- `.sh` 파일은 WSL(Windows Subsystem for Linux)에서도 사용할 수 있습니다.

