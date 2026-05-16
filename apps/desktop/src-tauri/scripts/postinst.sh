#!/bin/sh
# Post-installation script for LouvorJA (deb/rpm)
# Generates bible.db from bundled .sqlite source files.
#
# Runs as root during package installation. Generates bible.db next to the
# source files so the app can copy it to the user's data directory on first
# launch without needing to regenerate.

set -e

INSTALL_DIR="/usr/lib/com.louvorja"
BIBLE_SOURCE="$INSTALL_DIR/resources/bible"
BIBLE_OUTPUT="$INSTALL_DIR/resources/bible.db"

if [ -d "$BIBLE_SOURCE" ] && [ -x "$INSTALL_DIR/LouvorJA" ]; then
    echo "[louvorja] Generating bible.db from bundled translations..."
    "$INSTALL_DIR/LouvorJA" --build-bible \
        --input "$BIBLE_SOURCE" \
        --output "$BIBLE_OUTPUT" || {
        echo "[louvorja] Bible generation failed (will retry on first launch)" >&2
    }
else
    echo "[louvorja] Skipping bible.db generation (missing resources or binary)" >&2
fi
