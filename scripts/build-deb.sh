#!/bin/bash
# Build .deb package for Debian/Ubuntu
# Usage: ./scripts/build-deb.sh <version> <arch>

set -e

VERSION=${1:-"0.0.1"}
ARCH=${2:-"amd64"}
BINARY_NAME="hit-${VERSION}-linux-${ARCH}"

if [ ! -f "$BINARY_NAME" ]; then
    echo "Error: Binary $BINARY_NAME not found"
    echo "Please build it first: GOOS=linux GOARCH=${ARCH} go build -o $BINARY_NAME ./main.go"
    exit 1
fi

PACKAGE_NAME="hit_${VERSION}_${ARCH}"
PACKAGE_DIR="/tmp/${PACKAGE_NAME}"

# Create package structure
mkdir -p "${PACKAGE_DIR}/usr/bin"
mkdir -p "${PACKAGE_DIR}/DEBIAN"

# Copy binary
cp "$BINARY_NAME" "${PACKAGE_DIR}/usr/bin/hit"
chmod +x "${PACKAGE_DIR}/usr/bin/hit"

# Create control file
cat > "${PACKAGE_DIR}/DEBIAN/control" <<EOF
Package: hit
Version: ${VERSION}
Section: devel
Priority: optional
Architecture: ${ARCH}
Maintainer: airbornharsh <your-email@example.com>
Description: A fast, minimal version control system
 Hit is a lightweight version control system built in Go, inspired by Git.
 It provides a simple and fast alternative to Git for version control.
Homepage: https://github.com/Airbornharsh/hit
EOF

# Build package
dpkg-deb --build "${PACKAGE_DIR}" "${PACKAGE_NAME}.deb"

echo "Package built: ${PACKAGE_NAME}.deb"

