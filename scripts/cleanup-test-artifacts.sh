#!/bin/bash
# Test artifact cleanup script

echo "🧹 Cleaning up test artifacts..."

# Remove test directories
echo "Removing test-* directories..."
find . -name "test-*" -type d -exec rm -rf {} \; 2>/dev/null || true

# Remove Windows device names (security test artifacts)
echo "Removing Windows device name artifacts..."
rm -rf "COM1" "COM2" "CON" "LPT1" "LPT2" "NUL" "PRN" 2>/dev/null || true

# Remove path traversal test artifacts
echo "Removing path traversal artifacts..."
find . -path "*/Users/Administrator/*" -exec rm -rf {} \; 2>/dev/null || true
find . -path "*/windows/*" -exec rm -rf {} \; 2>/dev/null || true

# Remove injection test artifacts with special characters
echo "Removing injection test artifacts..."
find . -name "*\$(id)*" -exec rm -rf {} \; 2>/dev/null || true
find . -name "*\`id\`*" -exec rm -rf {} \; 2>/dev/null || true
find . -name "*<script>*" -exec rm -rf {} \; 2>/dev/null || true
find . -name "*rm -rf*" -exec rm -rf {} \; 2>/dev/null || true
find . -name "*--force*" -type d -exec rm -rf {} \; 2>/dev/null || true
find . -name "*--generator=evil*" -type d -exec rm -rf {} \; 2>/dev/null || true

# Remove files with special characters (tabs, newlines)
echo "Removing files with control characters..."
find . -name $'*\t*' -exec rm -rf {} \; 2>/dev/null || true
find . -name $'*\r\n*' -exec rm -rf {} \; 2>/dev/null || true

# Remove debug files
echo "Removing debug files..."
rm -f debug-*.mjs 2>/dev/null || true

echo "✅ Test artifact cleanup complete!"