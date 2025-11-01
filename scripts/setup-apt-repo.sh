#!/bin/bash
# Setup script for APT repository
# This is a guide script - adjust paths and settings as needed

set -e

REPO_DIR="/var/www/repos/apt/hit"
GPG_EMAIL="your-email@example.com"

echo "Setting up APT repository for Hit..."

# Install required packages
sudo apt update
sudo apt install -y reprepro gnupg2 nginx

# Create repository structure
sudo mkdir -p ${REPO_DIR}/{conf,dists,pool}

# Generate GPG key (if not exists)
if ! gpg --list-secret-keys --keyid-format LONG | grep -q "$GPG_EMAIL"; then
    echo "Generating GPG key..."
    gpg --batch --gen-key <<EOF
%no-protection
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: Hit Repository
Name-Email: ${GPG_EMAIL}
Expire-Date: 0
EOF
fi

GPG_KEY_ID=$(gpg --list-secret-keys --keyid-format LONG | grep -A1 "$GPG_EMAIL" | grep "sec" | awk '{print $2}' | cut -d'/' -f2)

# Export public key
echo "Exporting GPG public key..."
gpg --armor --export ${GPG_KEY_ID} | sudo tee ${REPO_DIR}/gpg.key > /dev/null

# Create distributions file
sudo tee ${REPO_DIR}/conf/distributions > /dev/null <<EOF
Origin: Hit
Label: Hit Repository
Codename: stable
Architectures: amd64 arm64
Components: main
Description: Hit version control system
SignWith: ${GPG_KEY_ID}
EOF

# Create options file
sudo tee ${REPO_DIR}/conf/options > /dev/null <<EOF
verbose
basedir ${REPO_DIR}
EOF

echo "APT repository structure created at ${REPO_DIR}"
echo "GPG Key ID: ${GPG_KEY_ID}"
echo ""
echo "Next steps:"
echo "1. Add .deb packages: reprepro -b ${REPO_DIR} includedeb stable hit_*.deb"
echo "2. Serve via nginx or other web server"
echo "3. Share GPG key: ${REPO_DIR}/gpg.key"
echo ""
echo "Users can add repository with:"
echo "  curl -fsSL https://your-domain.com/hit/gpg.key | sudo apt-key add -"
echo "  echo 'deb https://your-domain.com/hit/ stable main' | sudo tee /etc/apt/sources.list.d/hit.list"
echo "  sudo apt update && sudo apt install hit"

