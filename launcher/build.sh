#!/usr/bin/env bash
# Rebuilds "The Gauntlet.app" from main.swift. After rebuilding, macOS treats it as a new app:
# remove and re-add it under System Settings → Privacy & Security → Full Disk Access.
set -euo pipefail
cd "$(dirname "$0")"
APP="../The Gauntlet.app"
mkdir -p "$APP/Contents/MacOS"
swiftc -O main.swift -o "$APP/Contents/MacOS/Gauntlet" -framework Cocoa
rm -f "$APP/Contents/MacOS/launch"
codesign --force --deep -s - "$APP"
touch "$APP"
echo "Built $APP"
