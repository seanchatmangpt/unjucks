#!/bin/bash

# Conservative Test Data Cleanup Script for Unjucks
# This script ONLY removes clearly identifiable test data without touching important files

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DRY_RUN=${DRY_RUN:-false}
VERBOSE=${VERBOSE:-false}
FORCE=${FORCE:-false}

log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

show_help() {
    cat << EOF
Conservative Test Data Cleanup Script for Unjucks

This script ONLY removes clearly identifiable test data:
- test-cli-* directories (temporary CLI test directories)
- test-mcp-* directories (temporary MCP test directories)  
- test-*-workspace directories (temporary test workspaces)
- Generated test files (*-results.json, *.log files)
- Temporary cache directories (.unjucks-cache, reports/, logs/)

It will NOT delete:
- Source code files
- Configuration files
- Documentation
- Templates
- Important scripts

Usage: $0 [OPTIONS]

OPTIONS:
    -d, --dry-run     Show what would be deleted without actually deleting
    -v, --verbose     Show detailed output
    -f, --force       Skip confirmation prompts
    -h, --help        Show this help message

EXAMPLES:
    $0 --dry-run      # Preview what would be cleaned
    $0 --force        # Clean without prompts

EOF
}

confirm() {
    if [[ "$FORCE" == "true" ]]; then
        return 0
    fi
    
    local prompt="$1"
    local default="${2:-n}"
    
    if [[ "$default" == "y" ]]; then
        read -p "$prompt [Y/n]: " -r
        [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]
    else
        read -p "$prompt [y/N]: " -r
        [[ $REPLY =~ ^[Yy]$ ]]
    fi
}

# Conservative patterns - only clearly identifiable test data
cleanup_test_directories() {
    local count=0
    
    log "Cleaning up temporary test directories..."
    
    # Only remove directories that are clearly test-related with timestamps
    for pattern in "test-cli-*" "test-mcp-*" "test-*-workspace"; do
        while IFS= read -r -d '' dir; do
            if [[ -d "$dir" ]]; then
                if [[ "$DRY_RUN" == "true" ]]; then
                    echo "Would remove directory: $dir"
                else
                    if [[ "$VERBOSE" == "true" ]]; then
                        log "Removing directory: $dir"
                    fi
                    rm -rf "$dir"
                    ((count++))
                fi
            fi
        done < <(find . -maxdepth 1 -name "$pattern" -type d -print0 2>/dev/null || true)
    done
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "Dry run complete. Found $count directories to clean."
    else
        success "Cleaned up $count test directories."
    fi
}

cleanup_test_files() {
    local count=0
    
    log "Cleaning up test result files..."
    
    # Only remove clearly identifiable test result files
    for pattern in "*-results.json" "*-output.log" "*.log"; do
        while IFS= read -r -d '' file; do
            if [[ -f "$file" ]]; then
                # Skip important log files
                if [[ "$file" == "./package-lock.json" ]] || [[ "$file" == "./yarn.lock" ]]; then
                    continue
                fi
                
                if [[ "$DRY_RUN" == "true" ]]; then
                    echo "Would remove file: $file"
                else
                    if [[ "$VERBOSE" == "true" ]]; then
                        log "Removing file: $file"
                    fi
                    rm -f "$file"
                    ((count++))
                fi
            fi
        done < <(find . -maxdepth 1 -name "$pattern" -type f -print0 2>/dev/null || true)
    done
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "Dry run complete. Found $count files to clean."
    else
        success "Cleaned up $count test files."
    fi
}

cleanup_cache_directories() {
    local count=0
    
    log "Cleaning up cache and temporary directories..."
    
    # Only remove clearly identifiable cache/temp directories
    local cache_dirs=(".unjucks-cache" "reports" "logs" "coverage")
    
    for dir in "${cache_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            if [[ "$DRY_RUN" == "true" ]]; then
                echo "Would remove directory: $dir"
            else
                if [[ "$VERBOSE" == "true" ]]; then
                    log "Removing directory: $dir"
                fi
                rm -rf "$dir"
                ((count++))
            fi
        fi
    done
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "Dry run complete. Found $count cache directories to clean."
    else
        success "Cleaned up $count cache directories."
    fi
}

show_summary() {
    local total_size=0
    
    log "Calculating cleanup impact..."
    
    # Count test directories
    for pattern in "test-cli-*" "test-mcp-*" "test-*-workspace"; do
        while IFS= read -r -d '' item; do
            if [[ -d "$item" ]]; then
                size=$(du -sb "$item" 2>/dev/null | cut -f1 || echo "0")
                total_size=$((total_size + size))
            fi
        done < <(find . -maxdepth 1 -name "$pattern" -print0 2>/dev/null || true)
    done
    
    # Count cache directories
    for dir in ".unjucks-cache" "reports" "logs" "coverage"; do
        if [[ -d "$dir" ]]; then
            size=$(du -sb "$dir" 2>/dev/null | cut -f1 || echo "0")
            total_size=$((total_size + size))
        fi
    done
    
    if [[ $total_size -gt 0 ]]; then
        local size_mb=$((total_size / 1024 / 1024))
        log "Total space to be freed: ${size_mb}MB"
    else
        log "No test data found to clean up."
    fi
}

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        error "Not in a git repository. Please run this script from the project root."
        exit 1
    fi
    
    log "Starting conservative test data cleanup..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN MODE - No files will be deleted"
    fi
    
    # Show summary before cleanup
    show_summary
    
    if [[ "$DRY_RUN" == "false" ]]; then
        if ! confirm "Do you want to proceed with conservative cleanup?"; then
            log "Cleanup cancelled."
            exit 0
        fi
    fi
    
    # Perform conservative cleanup
    cleanup_test_directories
    cleanup_test_files
    cleanup_cache_directories
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "Dry run completed. Use without --dry-run to perform actual cleanup."
    else
        success "Conservative test data cleanup completed successfully!"
        log "Only clearly identifiable test data was removed."
    fi
}

# Run main function
main "$@"


