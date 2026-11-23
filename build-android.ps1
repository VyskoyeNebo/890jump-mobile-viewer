param([string]$JavaHome = $env:JAVA_HOME, [string]$SdkPath = $env:ANDROID_HOME)
$ErrorActionPreference = 'Stop'
if (-not $JavaHome) { $JavaHome = 'C:/Program Files/Java/jdk-17' }
$env:JAVA_HOME = $JavaHome
if (-not (Test-Path -LiteralPath "$JavaHome/bin/java.exe")) { throw 'Set JAVA_HOME to JDK 17 or later.' }
if ($SdkPath) {
    $escapedSdk = $SdkPath.Replace('\','\\').Replace(':','\:')
    [IO.File]::WriteAllText("$PSScriptRoot/android/local.properties", "sdk.dir=$escapedSdk`n")
}
Push-Location $PSScriptRoot
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Web asset build failed.' }
    $signing = Join-Path $PSScriptRoot '.signing'
    New-Item -ItemType Directory -Path $signing -Force | Out-Null
    $passFile = Join-Path $signing 'key-password.txt'
    $keyFile = Join-Path $signing '890jump.jks'
    if (-not (Test-Path -LiteralPath $passFile)) {
        if (Test-Path -LiteralPath $keyFile) { throw 'Restore the signing password for the existing key.' }
        [IO.File]::WriteAllText($passFile,[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N'))
    }
    $env:VIEWER_SIGN_PASSWORD = [IO.File]::ReadAllText($passFile)
    if (-not (Test-Path -LiteralPath $keyFile)) {
        & "$JavaHome/bin/keytool.exe" -genkeypair -noprompt -keystore $keyFile -alias origin890 -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=890 Jump Viewer, O=GAOTAIN' -storepass:env VIEWER_SIGN_PASSWORD -keypass:env VIEWER_SIGN_PASSWORD
        if ($LASTEXITCODE -ne 0) { throw 'Signing key generation failed.' }
    }
    & './android/gradlew.bat' :app:lintRelease :app:assembleRelease --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Android validation or build failed.' }
    New-Item -ItemType Directory -Path './dist' -Force | Out-Null
    Copy-Item -LiteralPath './android/app/build/outputs/apk/release/app-release.apk' -Destination './dist/890Jump-Android9-12-v1.0.0-beta.1.apk' -Force
    $hash=(Get-FileHash -LiteralPath './dist/890Jump-Android9-12-v1.0.0-beta.1.apk' -Algorithm SHA256).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText("$PSScriptRoot/dist/SHA256SUMS.txt","$hash  890Jump-Android9-12-v1.0.0-beta.1.apk`n")
} finally {
    Remove-Item Env:VIEWER_SIGN_PASSWORD -ErrorAction SilentlyContinue
    Pop-Location
}
