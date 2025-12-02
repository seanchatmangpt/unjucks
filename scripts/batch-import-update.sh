#!/bin/bash

# Batch Import Update Script
# High-performance import replacement using sed and awk

set -e

echo "🚀 Starting batch import update..."

# Set the base directory
BASE_DIR="/Users/sac/unjucks"
PACKAGES_DIR="$BASE_DIR/packages"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counter variables
TOTAL_FILES=0
UPDATED_FILES=0

# Function to update a single file
update_file() {
    local file="$1"
    local temp_file="${file}.tmp"
    local modified=false
    
    # Copy original file to temp
    cp "$file" "$temp_file"
    
    # Apply replacements using sed
    
    # 1. Local index imports
    sed -i '' "s|from './index'|from './cli-entry'|g" "$temp_file"
    sed -i '' 's|from "./index"|from "./cli-entry"|g' "$temp_file"
    
    # 2. Command route mappings
    sed -i '' "s|from './commands/artifact/index'|from './commands/artifact/route'|g" "$temp_file"
    sed -i '' 's|from "./commands/artifact/index"|from "./commands/artifact/route"|g' "$temp_file"
    sed -i '' "s|from './commands/cache/index'|from './commands/cache/route'|g" "$temp_file"
    sed -i '' 's|from "./commands/cache/index"|from "./commands/cache/route"|g' "$temp_file"
    sed -i '' "s|from './commands/graph/index'|from './commands/graph/route'|g" "$temp_file"
    sed -i '' 's|from "./commands/graph/index"|from "./commands/graph/route"|g' "$temp_file"
    sed -i '' "s|from './commands/project/index'|from './commands/project/route'|g" "$temp_file"
    sed -i '' 's|from "./commands/project/index"|from "./commands/project/route"|g' "$temp_file"
    sed -i '' "s|from './commands/templates/index'|from './commands/templates/route'|g" "$temp_file"
    sed -i '' 's|from "./commands/templates/index"|from "./commands/templates/route"|g' "$temp_file"
    sed -i '' "s|from './commands/rules/index'|from './commands/rules/route'|g" "$temp_file"
    sed -i '' 's|from "./commands/rules/index"|from "./commands/rules/route"|g' "$temp_file"
    sed -i '' "s|from './commands/metrics/index'|from './commands/metrics/route'|g" "$temp_file"
    sed -i '' 's|from "./commands/metrics/index"|from "./commands/metrics/route"|g' "$temp_file"
    sed -i '' "s|from './commands/validate/index'|from './commands/validate/route'|g" "$temp_file"
    sed -i '' 's|from "./commands/validate/index"|from "./commands/validate/route"|g' "$temp_file"
    sed -i '' "s|from './commands/drift/index'|from './commands/drift/route'|g" "$temp_file"
    sed -i '' 's|from "./commands/drift/index"|from "./commands/drift/route"|g' "$temp_file"
    sed -i '' "s|from './commands/query/index'|from './commands/query/route'|g" "$temp_file"
    sed -i '' 's|from "./commands/query/index"|from "./commands/query/route"|g' "$temp_file"
    
    # 3. Cross-package imports - Core
    sed -i '' "s|from '@kgen/core'|from '@kgen/core/core'|g" "$temp_file"
    sed -i '' 's|from "@kgen/core"|from "@kgen/core/core"|g' "$temp_file"
    sed -i '' "s|from '@kgen/core/cache'|from '@kgen/core/cache/cache-entry'|g" "$temp_file"
    sed -i '' 's|from "@kgen/core/cache"|from "@kgen/core/cache/cache-entry"|g' "$temp_file"
    sed -i '' "s|from '@kgen/core/config'|from '@kgen/core/config/config-entry'|g" "$temp_file"
    sed -i '' 's|from "@kgen/core/config"|from "@kgen/core/config/config-entry"|g' "$temp_file"
    sed -i '' "s|from '@kgen/core/utils'|from '@kgen/core/utils/utils-entry'|g" "$temp_file"
    sed -i '' 's|from "@kgen/core/utils"|from "@kgen/core/utils/utils-entry"|g' "$temp_file"
    
    # 4. Cross-package imports - Templates
    sed -i '' "s|from '@kgen/templates'|from '@kgen/templates/templates-entry'|g" "$temp_file"
    sed -i '' 's|from "@kgen/templates"|from "@kgen/templates/templates-entry"|g' "$temp_file"
    
    # 5. Cross-package imports - Rules
    sed -i '' "s|from '@kgen/rules'|from '@kgen/rules/rules-entry'|g" "$temp_file"
    sed -i '' 's|from "@kgen/rules"|from "@kgen/rules/rules-entry"|g' "$temp_file"
    
    # 6. Cross-package imports - CLI
    sed -i '' "s|from '@kgen/cli'|from '@kgen/cli/cli-entry'|g" "$temp_file"
    sed -i '' 's|from "@kgen/cli"|from "@kgen/cli/cli-entry"|g' "$temp_file"
    
    # 7. Specific sub-module mappings
    sed -i '' "s|from '@kgen/core/cache/optimized-cache-manager'|from '@kgen/core/src/cache/optimized-cache-manager'|g" "$temp_file"
    sed -i '' 's|from "@kgen/core/cache/optimized-cache-manager"|from "@kgen/core/src/cache/optimized-cache-manager"|g' "$temp_file"
    
    # Check if file was modified
    if ! diff -q "$file" "$temp_file" > /dev/null 2>&1; then
        mv "$temp_file" "$file"
        echo -e "${GREEN}✅ Updated:${NC} $file"
        UPDATED_FILES=$((UPDATED_FILES + 1))
    else
        rm "$temp_file"
    fi
    
    TOTAL_FILES=$((TOTAL_FILES + 1))
}

# Function to show progress
show_progress() {
    local current=$1
    local total=$2
    local percent=$((current * 100 / total))
    local bar_length=50
    local filled_length=$((percent * bar_length / 100))
    
    printf "\r${BLUE}Progress: ${NC}["
    for ((i=0; i<bar_length; i++)); do
        if [ $i -lt $filled_length ]; then
            printf "="
        else
            printf " "
        fi
    done
    printf "] %d%% (%d/%d)" "$percent" "$current" "$total"
}

echo "📁 Finding source files..."

# Find all TypeScript and JavaScript files, excluding node_modules and dist
FILES=($(find "$BASE_DIR" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.mjs" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/dist/*" \
    ! -path "*/.git/*" \
    ! -path "*/build/*"))

TOTAL_FILE_COUNT=${#FILES[@]}
echo "📊 Found $TOTAL_FILE_COUNT files to process"

# Process files in batches for better performance
BATCH_SIZE=10
CURRENT_BATCH=0

echo -e "\n🔄 Processing files..."

for ((i=0; i<TOTAL_FILE_COUNT; i++)); do
    update_file "${FILES[$i]}"
    
    # Show progress every 10 files
    if [ $((i % 10)) -eq 0 ]; then
        show_progress $((i + 1)) $TOTAL_FILE_COUNT
    fi
done

# Final progress update
show_progress $TOTAL_FILE_COUNT $TOTAL_FILE_COUNT

echo -e "\n\n📊 ${GREEN}Import update complete!${NC}"
echo "📈 Summary:"
echo "   - Total files processed: $TOTAL_FILES"
echo "   - Files with updates: $UPDATED_FILES"
echo "   - Files unchanged: $((TOTAL_FILES - UPDATED_FILES))"

# Verification step
echo -e "\n🔍 Running verification..."

# Check for remaining index imports
echo "   Checking for remaining index imports..."
REMAINING_INDEX=$(find "$BASE_DIR" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.mjs" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/dist/*" \
    ! -path "*/.git/*" \
    -exec grep -l "from ['\"]\\./index['\"]\\|from ['\"]\\./commands/.*/index['\"]" {} \; 2>/dev/null | wc -l)

echo "   Found $REMAINING_INDEX files with remaining index imports"

# Check for unresolved @kgen imports
echo "   Checking for basic @kgen imports..."
BASIC_KGEN=$(find "$BASE_DIR" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.mjs" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/dist/*" \
    ! -path "*/.git/*" \
    -exec grep -l "from ['\"]@kgen/core['\"]\\|from ['\"]@kgen/templates['\"]\\|from ['\"]@kgen/rules['\"]" {} \; 2>/dev/null | wc -l)

echo "   Found $BASIC_KGEN files with basic @kgen imports"

if [ $REMAINING_INDEX -eq 0 ] && [ $BASIC_KGEN -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}All imports successfully updated!${NC}"
    echo "✅ Next steps:"
    echo "   1. Run: npm run build"
    echo "   2. Run: npm test"
    echo "   3. Check for any TypeScript compilation errors"
else
    echo -e "\n⚠️  ${YELLOW}Some imports may need manual review${NC}"
    if [ $REMAINING_INDEX -gt 0 ]; then
        echo "   - $REMAINING_INDEX files still have index imports"
        echo "   Run: grep -r \"from ['\\\"]\\./index\" $BASE_DIR/packages --include=\"*.ts\" --include=\"*.js\" --include=\"*.mjs\""
    fi
    if [ $BASIC_KGEN -gt 0 ]; then
        echo "   - $BASIC_KGEN files still have basic @kgen imports"
        echo "   Run: grep -r \"from ['\\\"]@kgen/core['\\\"]\" $BASE_DIR/packages --include=\"*.ts\" --include=\"*.js\" --include=\"*.mjs\""
    fi
fi

echo -e "\n✨ ${GREEN}Batch import update completed!${NC}"