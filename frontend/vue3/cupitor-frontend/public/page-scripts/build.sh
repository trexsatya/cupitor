#!/bin/sh
# Compatibility entry point; the sidebar is shared with the language app.
set -e
cd "$(dirname "$0")/../.."
node scripts/build-page-scripts.cjs "$@"
