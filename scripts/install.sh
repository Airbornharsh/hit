#!/bin/bash
# Installation script for Hit
# Usage: curl -fsSL https://raw.githubusercontent.com/Airbornharsh/hit/main/scripts/install.sh | bash

set -e

VERSION=${HIT_VERSION:-"latest"}
GITHUB_REPO="Airbornharsh/hit"

if [ "$VERSION" == "latest" ]; then
    VERSION=$(curl -s "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' | sed 's/^v//')
fi

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Map architecture
case "$ARCH" in
    x86_64)
        ARCH="amd64"
        ;;
    arm64|aarch64)
        ARCH="arm64"
        ;;
    *)
        echo "Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

# Map OS
case "$OS" in
    darwin)
        OS="darwin"
        EXT=".tar.gz"
        ;;
    linux)
        OS="linux"
        EXT=".tar.gz"
        ;;
    *)
        echo "Unsupported OS: $OS"
        exit 1
        ;;
esac

DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/v${VERSION}/hit-${VERSION}-${OS}-${ARCH}${EXT}"
TEMP_DIR=$(mktemp -d)

echo "Installing Hit v${VERSION} for ${OS}-${ARCH}..."

# Download and extract
curl -fsSL "${DOWNLOAD_URL}" -o "${TEMP_DIR}/hit${EXT}"
tar -xzf "${TEMP_DIR}/hit${EXT}" -C "${TEMP_DIR}"

# Install to /usr/local/bin (requires sudo)
if [ -w /usr/local/bin ]; then
    INSTALL_DIR="/usr/local/bin"
    sudo_cmd=""
else
    INSTALL_DIR="/usr/local/bin"
    sudo_cmd="sudo"
fi

$sudo_cmd mv "${TEMP_DIR}/hit" "${INSTALL_DIR}/hit"
$sudo_cmd chmod +x "${INSTALL_DIR}/hit"

# Cleanup
rm -rf "${TEMP_DIR}"

echo "Hit v${VERSION} installed successfully!"
echo "Run 'hit version' to verify installation."

