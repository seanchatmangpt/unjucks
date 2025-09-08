#!/bin/bash
# Context Bundle Management CLI
# Advanced context bundling system for AI swarm state management

set -e

COMMAND=${1:-"help"}
BUNDLE_DIR="docs/book/appendices/toolkit/bundles"
ARCHIVE_DIR="$BUNDLE_DIR/archive"
TEMP_DIR="/tmp/context-bundles"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_debug() { [ "${DEBUG:-false}" = "true" ] && echo -e "${PURPLE}🔍 [DEBUG] $1${NC}"; }

# Ensure required directories exist
ensure_directories() {
    mkdir -p "$BUNDLE_DIR"
    mkdir -p "$ARCHIVE_DIR"
    mkdir -p "$TEMP_DIR"
}

# Calculate checksum for bundle integrity
calculate_checksum() {
    local file="$1"
    if command -v sha256sum &> /dev/null; then
        sha256sum "$file" | cut -d' ' -f1
    elif command -v shasum &> /dev/null; then
        shasum -a 256 "$file" | cut -d' ' -f1
    else
        # Fallback to md5
        md5sum "$file" 2>/dev/null | cut -d' ' -f1 || echo "no-checksum"
    fi
}

# Get bundle metadata
get_bundle_info() {
    local bundle_file="$1"
    if [ ! -f "$bundle_file" ]; then
        echo "Bundle not found"
        return 1
    fi
    
    # Try to extract basic info
    if command -v jq &> /dev/null; then
        jq -r '.id + " | " + .phase + " | " + .timestamp' "$bundle_file" 2>/dev/null || echo "Invalid bundle format"
    else
        # Fallback without jq
        grep -o '"id":"[^"]*"' "$bundle_file" | cut -d'"' -f4 | tr '\n' ' '
        grep -o '"phase":"[^"]*"' "$bundle_file" | cut -d'"' -f4 | tr '\n' ' '  
        grep -o '"timestamp":"[^"]*"' "$bundle_file" | cut -d'"' -f4
    fi
}

case $COMMAND in
    "create")
        PHASE=${2:-"development"}
        ensure_directories
        
        log_info "📦 Creating context bundle for $PHASE phase..."
        
        # Generate unique bundle ID
        TIMESTAMP=$(date +%s)
        RANDOM_ID=$(head -c 8 /dev/urandom | base64 | tr -d '/+=' | head -c 8 2>/dev/null || echo "$(printf "%08x" $RANDOM)")
        BUNDLE_ID="bundle-$PHASE-$TIMESTAMP-$RANDOM_ID"
        BUNDLE_FILE="$BUNDLE_DIR/$BUNDLE_ID.bundle"
        
        log_debug "Generated bundle ID: $BUNDLE_ID"
        
        # Collect current system state
        log_info "🔍 Collecting system state..."
        
        # Check for active agents/processes
        ACTIVE_AGENTS=()
        if pgrep -f "claude" > /dev/null; then
            ACTIVE_AGENTS+=("claude-process")
        fi
        if pgrep -f "node.*mcp" > /dev/null; then
            ACTIVE_AGENTS+=("mcp-server") 
        fi
        
        # Collect memory store data if available
        MEMORY_DATA="{}"
        if [ -f ".swarm/memory.db" ]; then
            MEMORY_DATA='{"swarm_memory": "available", "last_updated": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'
        fi
        
        # Calculate context metrics
        CONTEXT_USAGE=0
        if [ -f "conversation.log" ]; then
            CHAR_COUNT=$(wc -c < conversation.log)
            CONTEXT_USAGE=$((CHAR_COUNT / 4)) # Rough token estimate
        fi
        
        # Create bundle structure
        cat > "$BUNDLE_FILE" << EOF
{
  "id": "$BUNDLE_ID",
  "version": "2.0.0",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "phase": "$PHASE",
  "system": {
    "hostname": "$(hostname 2>/dev/null || echo 'unknown')",
    "platform": "$(uname -s 2>/dev/null || echo 'unknown')",
    "nodejs_version": "$(node --version 2>/dev/null || echo 'not-available')"
  },
  "agents": [
$(IFS=,; printf '    {"type": "%s", "status": "detected", "timestamp": "%s"}\n' ${ACTIVE_AGENTS[*]// /\", \"status\": \"detected\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}\n    {\"type\": \"} | sed '$ s/,$//')
  ],
  "memory": $MEMORY_DATA,
  "context": {
    "estimated_tokens": $CONTEXT_USAGE,
    "files_analyzed": $(find . -name "*.ts" -o -name "*.js" -o -name "*.md" 2>/dev/null | wc -l),
    "project_size": "$(du -sh . 2>/dev/null | cut -f1 || echo 'unknown')"
  },
  "metrics": {
    "totalTokens": 200000,
    "usedTokens": $CONTEXT_USAGE,
    "efficiency": $(echo "scale=2; $CONTEXT_USAGE / 200000 * 100" | bc -l 2>/dev/null || echo "0"),
    "fragmentationRatio": 0.0,
    "agentDistribution": {
      "active_processes": ${#ACTIVE_AGENTS[@]}
    },
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  },
  "checksum": "placeholder",
  "compressed": false
}
EOF

        # Calculate and update checksum
        CHECKSUM=$(calculate_checksum "$BUNDLE_FILE")
        sed -i.bak "s/\"checksum\": \"placeholder\"/\"checksum\": \"$CHECKSUM\"/" "$BUNDLE_FILE"
        rm -f "$BUNDLE_FILE.bak"
        
        log_success "Bundle created successfully"
        log_info "📄 Bundle ID: $BUNDLE_ID"
        log_info "📁 Location: $BUNDLE_FILE"
        log_info "📊 Size: $(du -h "$BUNDLE_FILE" | cut -f1)"
        
        # Display bundle summary
        echo ""
        echo "Bundle Summary:"
        echo "  Phase: $PHASE"
        echo "  Agents: ${#ACTIVE_AGENTS[@]} detected"
        echo "  Context tokens: $CONTEXT_USAGE"
        echo "  Checksum: ${CHECKSUM:0:16}..."
        ;;
        
    "list")
        ensure_directories
        log_info "📋 Available context bundles:"
        echo ""
        
        if [ "$(find "$BUNDLE_DIR" -name "*.bundle" -type f 2>/dev/null | wc -l)" -eq 0 ]; then
            log_warning "No bundles found"
            echo "  Create your first bundle with: $0 create <phase>"
            exit 0
        fi
        
        # List bundles with details
        printf "%-25s %-15s %-20s %-10s\n" "Bundle ID" "Phase" "Created" "Size"
        printf "%-25s %-15s %-20s %-10s\n" "-------------------------" "---------------" "--------------------" "----------"
        
        find "$BUNDLE_DIR" -name "*.bundle" -type f | sort -t- -k3nr | while read -r bundle_file; do
            BUNDLE_NAME=$(basename "$bundle_file" .bundle)
            BUNDLE_INFO=$(get_bundle_info "$bundle_file")
            BUNDLE_SIZE=$(du -h "$bundle_file" | cut -f1)
            
            # Parse bundle info
            IFS=' | ' read -r BUNDLE_ID PHASE TIMESTAMP <<< "$BUNDLE_INFO"
            
            # Format timestamp
            if [ -n "$TIMESTAMP" ] && [ "$TIMESTAMP" != "Invalid bundle format" ]; then
                FORMATTED_TIME=$(date -d "$TIMESTAMP" "+%Y-%m-%d %H:%M" 2>/dev/null || echo "$TIMESTAMP")
            else
                FORMATTED_TIME="Unknown"
            fi
            
            printf "%-25s %-15s %-20s %-10s\n" "${BUNDLE_ID:-$BUNDLE_NAME}" "${PHASE:-unknown}" "$FORMATTED_TIME" "$BUNDLE_SIZE"
        done
        
        echo ""
        TOTAL_BUNDLES=$(find "$BUNDLE_DIR" -name "*.bundle" -type f | wc -l)
        TOTAL_SIZE=$(du -sh "$BUNDLE_DIR" 2>/dev/null | cut -f1 || echo "unknown")
        echo "Total: $TOTAL_BUNDLES bundles, $TOTAL_SIZE storage used"
        ;;
        
    "load")
        BUNDLE_ID=${2}
        if [ -z "$BUNDLE_ID" ]; then
            log_error "Bundle ID required"
            echo "Usage: $0 load <bundle-id>"
            echo "Use '$0 list' to see available bundles"
            exit 1
        fi
        
        ensure_directories
        
        # Find bundle file
        BUNDLE_FILE="$BUNDLE_DIR/$BUNDLE_ID.bundle"
        if [ ! -f "$BUNDLE_FILE" ]; then
            # Try to find by partial match
            MATCHES=$(find "$BUNDLE_DIR" -name "*$BUNDLE_ID*.bundle" -type f)
            if [ -z "$MATCHES" ]; then
                log_error "Bundle not found: $BUNDLE_ID"
                exit 1
            elif [ "$(echo "$MATCHES" | wc -l)" -gt 1 ]; then
                log_error "Multiple bundles match '$BUNDLE_ID':"
                echo "$MATCHES" | sed 's/^/  /'
                exit 1
            else
                BUNDLE_FILE="$MATCHES"
                log_info "Found bundle: $(basename "$BUNDLE_FILE")"
            fi
        fi
        
        log_info "📂 Loading bundle: $(basename "$BUNDLE_FILE" .bundle)"
        
        # Verify checksum
        if command -v jq &> /dev/null; then
            STORED_CHECKSUM=$(jq -r '.checksum' "$BUNDLE_FILE" 2>/dev/null)
            if [ "$STORED_CHECKSUM" != "null" ] && [ -n "$STORED_CHECKSUM" ]; then
                CURRENT_CHECKSUM=$(calculate_checksum "$BUNDLE_FILE")
                if [ "$STORED_CHECKSUM" != "$CURRENT_CHECKSUM" ]; then
                    log_error "Bundle checksum mismatch - file may be corrupted"
                    log_info "Expected: $STORED_CHECKSUM"
                    log_info "Actual: $CURRENT_CHECKSUM"
                    exit 1
                fi
                log_success "Bundle integrity verified"
            fi
        fi
        
        # Display bundle contents
        if command -v jq &> /dev/null; then
            echo ""
            echo "Bundle Contents:"
            echo "================"
            jq . "$BUNDLE_FILE"
        else
            log_warning "jq not available - displaying raw bundle data"
            echo ""
            cat "$BUNDLE_FILE"
        fi
        ;;
        
    "report")
        ensure_directories
        log_info "📊 Generating bundle usage report..."
        echo ""
        
        TOTAL_BUNDLES=$(find "$BUNDLE_DIR" -name "*.bundle" -type f 2>/dev/null | wc -l)
        
        if [ $TOTAL_BUNDLES -eq 0 ]; then
            echo "Context Bundle Report"
            echo "===================="
            echo "No bundles found."
            echo ""
            echo "Create your first bundle with: $0 create development"
            exit 0
        fi
        
        TOTAL_SIZE=$(du -sh "$BUNDLE_DIR" 2>/dev/null | cut -f1 || echo "unknown")
        ARCHIVE_COUNT=$(find "$ARCHIVE_DIR" -name "*.bundle" -type f 2>/dev/null | wc -l)
        
        echo "Context Bundle Report"
        echo "===================="
        echo "Active Bundles: $TOTAL_BUNDLES"
        echo "Archived Bundles: $ARCHIVE_COUNT"
        echo "Total Storage: $TOTAL_SIZE"
        echo ""
        
        # Phase distribution
        echo "Bundle Distribution by Phase:"
        find "$BUNDLE_DIR" -name "*.bundle" -type f -exec grep -o '"phase":"[^"]*"' {} \; 2>/dev/null | \
            cut -d'"' -f4 | sort | uniq -c | sort -nr | sed 's/^/  /' || echo "  Unable to analyze phases"
        echo ""
        
        # Recent bundles
        echo "Recent Bundles (Last 5):"
        find "$BUNDLE_DIR" -name "*.bundle" -type f -printf "%T@ %f\n" 2>/dev/null | \
            sort -nr | head -5 | while read -r timestamp filename; do
                DATE_STR=$(date -d "@${timestamp%.*}" "+%Y-%m-%d %H:%M" 2>/dev/null || echo "Unknown")
                SIZE=$(du -h "$BUNDLE_DIR/$filename" 2>/dev/null | cut -f1 || echo "?")
                printf "  %-20s %s (%s)\n" "${filename%.bundle}" "$DATE_STR" "$SIZE"
            done 2>/dev/null || echo "  No recent bundles found"
        echo ""
        
        # Storage analysis
        if [ $TOTAL_BUNDLES -gt 20 ]; then
            log_warning "High bundle count detected ($TOTAL_BUNDLES bundles)"
            echo "  Recommendation: Archive old bundles with '$0 archive 30'"
        fi
        
        # Check for large bundles
        LARGE_BUNDLES=$(find "$BUNDLE_DIR" -name "*.bundle" -size +1M 2>/dev/null | wc -l)
        if [ $LARGE_BUNDLES -gt 0 ]; then
            log_info "$LARGE_BUNDLES bundles are larger than 1MB"
            echo "  Recommendation: Enable compression with '$0 compress'"
        fi
        
        echo ""
        echo "Storage Recommendations:"
        if [ $TOTAL_BUNDLES -lt 5 ]; then
            echo "  ✅ Bundle count is optimal"
        elif [ $TOTAL_BUNDLES -lt 15 ]; then
            echo "  📦 Consider periodic cleanup"
        else
            echo "  🧹 Regular archival recommended"
        fi
        
        echo "  💾 Enable compression for new bundles"
        echo "  🔄 Set up automated archival schedule"
        ;;
        
    "compress")
        ensure_directories
        log_info "🗜️  Compressing uncompressed bundles..."
        
        COMPRESSED_COUNT=0
        find "$BUNDLE_DIR" -name "*.bundle" -type f | while read -r bundle_file; do
            # Check if already compressed
            if command -v jq &> /dev/null; then
                IS_COMPRESSED=$(jq -r '.compressed' "$bundle_file" 2>/dev/null)
                if [ "$IS_COMPRESSED" = "true" ]; then
                    continue
                fi
            fi
            
            log_info "Compressing $(basename "$bundle_file")..."
            
            # Create compressed version
            TEMP_FILE="$TEMP_DIR/$(basename "$bundle_file").tmp"
            if command -v gzip &> /dev/null; then
                gzip -c "$bundle_file" > "$TEMP_FILE.gz"
                
                # Update compressed flag if possible
                if command -v jq &> /dev/null; then
                    jq '.compressed = true' "$bundle_file" > "$TEMP_FILE"
                    mv "$TEMP_FILE" "$bundle_file"
                fi
                
                log_success "Compressed $(basename "$bundle_file")"
                COMPRESSED_COUNT=$((COMPRESSED_COUNT + 1))
            else
                log_warning "gzip not available - skipping compression"
                break
            fi
        done
        
        if [ $COMPRESSED_COUNT -gt 0 ]; then
            log_success "Compressed $COMPRESSED_COUNT bundles"
        else
            log_info "No uncompressed bundles found"
        fi
        ;;
        
    "archive")
        DAYS=${2:-30}
        ensure_directories
        
        log_info "📁 Archiving bundles older than $DAYS days..."
        
        # Find old bundles
        OLD_BUNDLES=$(find "$BUNDLE_DIR" -name "*.bundle" -type f -mtime +$DAYS 2>/dev/null)
        
        if [ -z "$OLD_BUNDLES" ]; then
            log_info "No bundles older than $DAYS days found"
            exit 0
        fi
        
        ARCHIVE_COUNT=0
        echo "$OLD_BUNDLES" | while read -r bundle_file; do
            if [ -n "$bundle_file" ]; then
                BUNDLE_NAME=$(basename "$bundle_file")
                mv "$bundle_file" "$ARCHIVE_DIR/"
                log_success "Archived $BUNDLE_NAME"
                ARCHIVE_COUNT=$((ARCHIVE_COUNT + 1))
            fi
        done
        
        FINAL_COUNT=$(echo "$OLD_BUNDLES" | wc -l)
        log_success "Archived $FINAL_COUNT bundles to $ARCHIVE_DIR"
        ;;
        
    "restore")
        BUNDLE_ID=${2}
        if [ -z "$BUNDLE_ID" ]; then
            log_error "Bundle ID required"
            echo "Usage: $0 restore <bundle-id>"
            exit 1
        fi
        
        ensure_directories
        
        # Look for bundle in archive
        ARCHIVED_BUNDLE="$ARCHIVE_DIR/$BUNDLE_ID.bundle"
        if [ ! -f "$ARCHIVED_BUNDLE" ]; then
            # Try partial match
            MATCHES=$(find "$ARCHIVE_DIR" -name "*$BUNDLE_ID*.bundle" -type f)
            if [ -z "$MATCHES" ]; then
                log_error "Archived bundle not found: $BUNDLE_ID"
                exit 1
            elif [ "$(echo "$MATCHES" | wc -l)" -gt 1 ]; then
                log_error "Multiple archived bundles match '$BUNDLE_ID':"
                echo "$MATCHES" | sed 's/^/  /'
                exit 1
            else
                ARCHIVED_BUNDLE="$MATCHES"
            fi
        fi
        
        BUNDLE_NAME=$(basename "$ARCHIVED_BUNDLE")
        log_info "📦 Restoring archived bundle: $BUNDLE_NAME"
        
        mv "$ARCHIVED_BUNDLE" "$BUNDLE_DIR/"
        log_success "Bundle restored to active storage"
        ;;
        
    "validate")
        BUNDLE_ID=${2}
        ensure_directories
        
        if [ -n "$BUNDLE_ID" ]; then
            # Validate specific bundle
            BUNDLE_FILE="$BUNDLE_DIR/$BUNDLE_ID.bundle"
            if [ ! -f "$BUNDLE_FILE" ]; then
                log_error "Bundle not found: $BUNDLE_ID"
                exit 1
            fi
            BUNDLES_TO_CHECK="$BUNDLE_FILE"
        else
            # Validate all bundles
            BUNDLES_TO_CHECK=$(find "$BUNDLE_DIR" -name "*.bundle" -type f)
        fi
        
        log_info "🔍 Validating bundle integrity..."
        
        VALID_COUNT=0
        INVALID_COUNT=0
        
        echo "$BUNDLES_TO_CHECK" | while read -r bundle_file; do
            if [ -n "$bundle_file" ]; then
                BUNDLE_NAME=$(basename "$bundle_file" .bundle)
                
                # Check JSON validity
                if command -v jq &> /dev/null; then
                    if jq . "$bundle_file" > /dev/null 2>&1; then
                        # Check required fields
                        REQUIRED_FIELDS=("id" "version" "timestamp" "phase")
                        ALL_PRESENT=true
                        
                        for field in "${REQUIRED_FIELDS[@]}"; do
                            if [ "$(jq -r ".$field" "$bundle_file")" = "null" ]; then
                                ALL_PRESENT=false
                                break
                            fi
                        done
                        
                        if [ "$ALL_PRESENT" = "true" ]; then
                            echo "  ✅ $BUNDLE_NAME"
                            VALID_COUNT=$((VALID_COUNT + 1))
                        else
                            echo "  ❌ $BUNDLE_NAME (missing required fields)"
                            INVALID_COUNT=$((INVALID_COUNT + 1))
                        fi
                    else
                        echo "  ❌ $BUNDLE_NAME (invalid JSON)"
                        INVALID_COUNT=$((INVALID_COUNT + 1))
                    fi
                else
                    echo "  ⚠️  $BUNDLE_NAME (cannot validate - jq not available)"
                fi
            fi
        done
        ;;
        
    "help"|*)
        cat << 'EOF'

Context Bundle CLI Tool
======================

Usage: ./scripts/context-bundle-cli.sh <command> [options]

Commands:
  create <phase>     Create new context bundle for specified phase
  list              List all available bundles with details  
  load <bundle-id>  Load and display specific bundle contents
  report            Generate comprehensive bundle usage report
  compress          Compress all uncompressed bundles to save space
  archive <days>    Move bundles older than N days to archive (default: 30)
  restore <id>      Restore archived bundle to active storage
  validate [id]     Validate bundle integrity (specific bundle or all)
  help              Show this help message

Bundle Phases:
  discovery         Analysis and architecture review phase
  implementation    Active development and feature building  
  optimization      Performance tuning and efficiency improvements
  maintenance       System health monitoring and updates
  production        Production deployment and monitoring

Examples:
  ./scripts/context-bundle-cli.sh create production
      Create a new bundle capturing current production state
      
  ./scripts/context-bundle-cli.sh list
      Show all available bundles with creation dates and sizes
      
  ./scripts/context-bundle-cli.sh load bundle-prod-1234567890-abc123
      Display the contents of a specific bundle
      
  ./scripts/context-bundle-cli.sh report
      Generate detailed usage report with recommendations
      
  ./scripts/context-bundle-cli.sh archive 7
      Archive bundles older than 7 days to free up space
      
  ./scripts/context-bundle-cli.sh compress
      Compress all uncompressed bundles to reduce storage

Bundle Structure:
  Each bundle contains:
  - Unique ID and metadata
  - System configuration snapshot  
  - Active agent states
  - Memory store data
  - Performance metrics
  - Integrity checksum

Storage Locations:
  Active bundles: docs/book/appendices/toolkit/bundles/
  Archived bundles: docs/book/appendices/toolkit/bundles/archive/

For advanced bundle management, see the Context Engineering Toolkit documentation.

EOF
        ;;
esac