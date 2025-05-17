#!/bin/bash

set -e

# Function to create group and users
create_keylime_users() {
    echo "Creating 'tss' group if it doesn't exist..."
    if ! getent group tss >/dev/null; then
        sudo addgroup --system tss
    fi

    echo "Creating 'tss' user if it doesn't exist..."
    if ! getent passwd tss >/dev/null; then
        sudo adduser --system --ingroup tss --shell /bin/false \
            --home /var/lib/tpm --no-create-home \
            --gecos "TPM software stack" tss
    fi

    echo "Creating 'keylime' user if it doesn't exist..."
    if ! getent passwd keylime >/dev/null; then
        sudo adduser --system --ingroup tss --shell /bin/false \
            --home /var/lib/keylime --no-create-home \
            --gecos "Keylime remote attestation" keylime
    fi
}

# Function to set up /var/lib/keylime directory
setup_keylime_directory() {
    echo "Setting up /var/lib/keylime directory..."
    sudo mkdir -p /var/lib/keylime
    sudo chown -R keylime:tss /var/lib/keylime
}

# Execute functions
create_keylime_users
setup_keylime_directory

echo "✅ Keylime users and directories have been successfully set up."
