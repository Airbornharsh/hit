# Distribution Guide for Hit

This guide explains how to distribute the Hit binary across different platforms.

## 1. GitHub Releases (Automatic)

When you push a tag starting with `v` (e.g., `v0.0.1`), GitHub Actions will automatically:
- Build binaries for all platforms (Linux, macOS, Windows)
- Create a GitHub Release with all binaries
- Generate SHA256 checksums

### To create a release:

```bash
git tag v0.0.1
git push origin v0.0.1
```

## 2. Homebrew (macOS)

### Option A: Create a Homebrew Tap (Recommended)

1. Create a new repository: `github.com/airbornharsh/homebrew-hit`

2. Add the formula file `hit.rb`:

```ruby
class Hit < Formula
  desc "A fast, minimal version control system"
  homepage "https://github.com/Airbornharsh/hit"
  url "https://github.com/Airbornharsh/hit/releases/download/v0.0.1/hit-0.0.1-darwin-amd64.tar.gz"
  sha256 "" # Get from GitHub release
  license "MIT"

  def install
    bin.install "hit"
  end

  test do
    system "#{bin}/hit", "version"
  end
end
```

3. Users can install with:
```bash
brew tap airbornharsh/hit
brew install hit
```

### Option B: Submit to Homebrew Core

For broader distribution, submit to [Homebrew Core](https://docs.brew.sh/Adding-Software-to-Homebrew).

## 3. APT Repository (Linux - Debian/Ubuntu)

### Setup APT Repository

1. **Install required tools on your server:**
```bash
sudo apt install reprepro gnupg2 nginx
```

2. **Create repository structure:**
```bash
mkdir -p /var/www/repos/apt/hit/{conf,dists,pool}
```

3. **Create GPG key:**
```bash
gpg --full-generate-key
# Export public key:
gpg --armor --export YOUR_EMAIL > /var/www/repos/apt/hit/gpg.key
```

4. **Create `conf/distributions`:**
```
Origin: Hit
Label: Hit Repository
Codename: stable
Architectures: amd64 arm64
Components: main
Description: Hit version control system
SignWith: YOUR_GPG_KEY_ID
```

5. **Add packages:**
```bash
reprepro -b /var/www/repos/apt/hit includedeb stable hit_0.0.1_linux-amd64.deb
```

6. **Create .deb package script** (`scripts/build-deb.sh`):
```bash
#!/bin/bash
VERSION=$1
ARCH=$2

mkdir -p hit_${VERSION}_${ARCH}/{usr/bin,DEBIAN}

# Copy binary
cp hit_${VERSION}-linux-${ARCH} hit_${VERSION}_${ARCH}/usr/bin/hit
chmod +x hit_${VERSION}_${ARCH}/usr/bin/hit

# Create control file
cat > hit_${VERSION}_${ARCH}/DEBIAN/control <<EOF
Package: hit
Version: ${VERSION}
Section: devel
Priority: optional
Architecture: ${ARCH}
Maintainer: airbornharsh <your-email@example.com>
Description: A fast, minimal version control system
 Hit is a lightweight version control system built in Go
EOF

# Build package
dpkg-deb --build hit_${VERSION}_${ARCH}
```

### User Installation:

```bash
curl -fsSL https://apt.airbornharsh.dev/hit/gpg.key | sudo apt-key add -
echo "deb https://apt.airbornharsh.dev/hit/ stable main" | sudo tee /etc/apt/sources.list.d/hit.list
sudo apt update
sudo apt install hit
```

## 4. Windows Distribution

### Option A: Scoop (Recommended)

1. Create repository: `github.com/airbornharsh/scoop-bucket`

2. Add `hit.json`:
```json
{
  "version": "0.0.1",
  "description": "A fast, minimal version control system",
  "homepage": "https://github.com/Airbornharsh/hit",
  "license": "MIT",
  "url": "https://github.com/Airbornharsh/hit/releases/download/v0.0.1/hit-0.0.1-windows-amd64.zip",
  "hash": "",
  "bin": "hit.exe",
  "checkver": "github",
  "autoupdate": {
    "url": "https://github.com/Airbornharsh/hit/releases/download/v$version/hit-$version-windows-amd64.zip"
  }
}
```

3. Users install with:
```powershell
scoop bucket add airbornharsh https://github.com/airbornharsh/scoop-bucket
scoop install hit
```

### Option B: Chocolatey

1. Create `hit.nuspec`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://schemas.microsoft.com/packaging/2015/06/nuspec.xsd">
  <metadata>
    <id>hit</id>
    <version>0.0.1</version>
    <title>Hit</title>
    <authors>airbornharsh</authors>
    <description>A fast, minimal version control system</description>
    <projectUrl>https://github.com/Airbornharsh/hit</projectUrl>
    <licenseUrl>https://github.com/Airbornharsh/hit/blob/main/LICENSE</licenseUrl>
  </metadata>
  <files>
    <file src="hit.exe" target="tools\" />
  </files>
</package>
```

2. Package and push to Chocolatey.org

### Option C: Direct Download

Users can download from GitHub Releases and add to PATH manually.

## 5. Manual Installation Scripts

### Linux/macOS Install Script

Create `install.sh`:
```bash
#!/bin/bash
set -e

VERSION="0.0.1"
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

if [ "$ARCH" == "x86_64" ]; then
    ARCH="amd64"
elif [ "$ARCH" == "arm64" ] || [ "$ARCH" == "aarch64" ]; then
    ARCH="arm64"
fi

URL="https://github.com/Airbornharsh/hit/releases/download/v${VERSION}/hit-${VERSION}-${OS}-${ARCH}.tar.gz"

echo "Downloading Hit ${VERSION} for ${OS}-${ARCH}..."
curl -L "${URL}" -o /tmp/hit.tar.gz

echo "Installing..."
tar -xzf /tmp/hit.tar.gz -C /tmp
sudo mv /tmp/hit /usr/local/bin/hit
chmod +x /usr/local/bin/hit

echo "Hit installed successfully!"
hit version
```

### Windows Install Script (PowerShell)

Create `install.ps1`:
```powershell
$version = "0.0.1"
$url = "https://github.com/Airbornharsh/hit/releases/download/v$version/hit-$version-windows-amd64.zip"
$output = "$env:TEMP\hit.zip"

Write-Host "Downloading Hit $version..."
Invoke-WebRequest -Uri $url -OutFile $output

Write-Host "Installing..."
Expand-Archive -Path $output -DestinationPath "$env:ProgramFiles\Hit" -Force
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$env:ProgramFiles\Hit", [EnvironmentVariableTarget]::Machine)

Write-Host "Hit installed successfully!"
```

## Quick Start Summary

1. **Tag and Release**: `git tag v0.0.1 && git push origin v0.0.1`
2. **Homebrew**: Create `airbornharsh/homebrew-hit` repo with formula
3. **APT**: Set up reprepro repository (optional, for Linux users)
4. **Scoop**: Create `airbornharsh/scoop-bucket` repo (optional, for Windows users)

## Updating Releases

When releasing a new version:
1. Update version in workflow
2. Update formula/spec files in tap repositories
3. Update install scripts with new version

