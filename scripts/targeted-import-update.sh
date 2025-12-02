#!/bin/bash

# Targeted Import Update Script - Focus on packages directory only
set -e

echo "🎯 Starting targeted import update for packages..."

BASE_DIR="/Users/sac/unjucks/packages"
UPDATED=0
TOTAL=0

# Function to update imports in a file
update_imports() {
    local file="$1"
    local temp="${file}.tmp"
    
    cp "$file" "$temp"
    
    # Core replacements - most common patterns first
    sed -i '' "s|from './index'|from './cli-entry'|g" "$temp"
    sed -i '' 's|from "./index"|from "./cli-entry"|g' "$temp"
    
    # Command imports
    sed -i '' "s|from './commands/\([^/]*\)/index'|from './commands/\1/route'|g" "$temp"
    sed -i '' 's|from "./commands/\([^/]*\)/index"|from "./commands/\1/route"|g' "$temp"
    
    # Cross-package imports
    sed -i '' "s|from '@kgen/core'[^/]|from '@kgen/core/core'|g" "$temp"
    sed -i '' 's|from "@kgen/core"[^/]|from "@kgen/core/core"|g' "$temp"
    sed -i '' "s|from '@kgen/templates'[^/]|from '@kgen/templates/templates-entry'|g" "$temp"
    sed -i '' 's|from "@kgen/templates"[^/]|from "@kgen/templates/templates-entry"|g' "$temp"
    sed -i '' "s|from '@kgen/rules'[^/]|from '@kgen/rules/rules-entry'|g" "$temp"
    sed -i '' 's|from "@kgen/rules"[^/]|from "@kgen/rules/rules-entry"|g' "$temp"
    
    # Sub-module mappings
    sed -i '' "s|@kgen/core/cache'|@kgen/core/cache/cache-entry'|g" "$temp"
    sed -i '' 's|@kgen/core/cache"|@kgen/core/cache/cache-entry"|g' "$temp"
    sed -i '' "s|@kgen/core/config'|@kgen/core/config/config-entry'|g" "$temp"
    sed -i '' 's|@kgen/core/config"|@kgen/core/config/config-entry"|g' "$temp"
    sed -i '' "s|@kgen/core/utils'|@kgen/core/utils/utils-entry'|g" "$temp"
    sed -i '' 's|@kgen/core/utils"|@kgen/core/utils/utils-entry"|g' "$temp"
    
    if ! diff -q "$file" "$temp" > /dev/null 2>&1; then
        mv "$temp" "$file"
        echo "✅ Updated: $(basename "$file")"
        UPDATED=$((UPDATED + 1))
    else
        rm "$temp"
    fi
    
    TOTAL=$((TOTAL + 1))
}

echo "📁 Finding TypeScript/JavaScript files in packages..."

# Process only source files in packages
find "$BASE_DIR" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.mjs" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/dist/*" \
    ! -path "*/build/*" | while read -r file; do
    update_imports "$file"
done

echo ""
echo "📊 Summary:"
echo "   - Files processed: $TOTAL" 
echo "   - Files updated: $UPDATED"

echo ""
echo "🔍 Checking for remaining issues..."

# Check for remaining problematic imports
REMAINING=$(find "$BASE_DIR" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.mjs" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/dist/*" \
    -exec grep -l "from ['\"]\\./index['\"]\\|from ['\"]@kgen/core['\"]\\|from ['\"]@kgen/templates['\"]\\|from ['\"]@kgen/rules['\"]" {} \; 2>/dev/null | wc -l)

if [ "$REMAINING" -eq 0 ]; then
    echo "🎉 All major import patterns updated!"
else
    echo "⚠️ $REMAINING files may still need attention"
fi

echo "✅ Targeted update complete!"