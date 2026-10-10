#!/usr/bin/env bash

set -euo pipefail

DOWNLOADS="$HOME/Downloads"

# Directory containing this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# L = parent directory of the directory containing this script
LOCATION_L="$(dirname "$SCRIPT_DIR")"

echo "📍 Destination root: $LOCATION_L"

# 1. Find newest ZIP beginning with "xx"
ZIP_FILE=$(find "$DOWNLOADS" -maxdepth 1 -type f -name 'xx*.zip' \
    -print0 | xargs -0 ls -t 2>/dev/null | head -n 1)

if [[ -z "${ZIP_FILE:-}" ]]; then
    echo "❌ No ZIP file starting with 'xx' found in $DOWNLOADS"
    exit 1
fi

echo "📦 Found latest ZIP:"
echo "$ZIP_FILE"

ZIP_NAME=$(basename "$ZIP_FILE" .zip)
EXTRACT_DIR="$DOWNLOADS/$ZIP_NAME"

rm -rf "$EXTRACT_DIR"
mkdir -p "$EXTRACT_DIR"

# 2. Extract ZIP
echo "📂 Extracting to:"
echo "$EXTRACT_DIR"

unzip -q "$ZIP_FILE" -d "$EXTRACT_DIR"

# Find public/groundless-ground-assets
ASSETS_DIR=$(find "$EXTRACT_DIR" \
    -type d \
    -path '*/public/groundless-ground-assets' \
    -print \
    -quit)

if [[ -z "${ASSETS_DIR:-}" ]]; then
    echo "❌ public/groundless-ground-assets not found"
    exit 1
fi

# Copy assets into L
echo "📁 Copying groundless-ground-assets to:"
echo "$LOCATION_L"

rm -rf "$LOCATION_L/groundless-ground-assets"
cp -R "$ASSETS_DIR" "$LOCATION_L/"

# 3. Find groundless-ground*.json
JSON_FILE=$(find "$EXTRACT_DIR" \
    -type f \
    -name 'groundless-ground*.json' \
    -print \
    -quit)

if [[ -z "${JSON_FILE:-}" ]]; then
    echo "❌ No groundless-ground*.json file found"
    exit 1
fi

JSON_FILE="$(cd "$(dirname "$JSON_FILE")" && pwd)/$(basename "$JSON_FILE")"

# Copy full JSON path to clipboard
if command -v pbcopy >/dev/null 2>&1; then
    printf '%s' "$JSON_FILE" | pbcopy
elif command -v wl-copy >/dev/null 2>&1; then
    printf '%s' "$JSON_FILE" | wl-copy
elif command -v xclip >/dev/null 2>&1; then
    printf '%s' "$JSON_FILE" | xclip -selection clipboard
elif command -v xsel >/dev/null 2>&1; then
    printf '%s' "$JSON_FILE" | xsel --clipboard --input
else
    echo "⚠️ No clipboard utility found"
fi

echo "📋 JSON path copied:"
echo "$JSON_FILE"

# 4. Delete ZIP
rm "$ZIP_FILE"

echo "🗑️ Deleted ZIP:"
echo "$ZIP_FILE"

echo "✅ Done"