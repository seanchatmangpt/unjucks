#!/bin/bash
# Advanced Registry Cleanup Automation
# Manages container registry artifacts with retention policies

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY=${REGISTRY:-"ghcr.io"}
REPOSITORY=${REPOSITORY:-"unjucks/unjucks"}
GITHUB_TOKEN=${GITHUB_TOKEN:-""}
DRY_RUN=${DRY_RUN:-"false"}

# Retention policies
KEEP_LATEST_PRODUCTION=10
KEEP_LATEST_TESTING=5
KEEP_LATEST_PERFORMANCE=3
KEEP_LATEST_COORDINATION=3
KEEP_TAGS_DAYS=30
KEEP_UNTAGGED_DAYS=7

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

dry_run_notice() {
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY RUN]${NC} $1"
    else
        echo -e "${GREEN}[EXECUTE]${NC} $1"
    fi
}

# Function to check prerequisites
check_prerequisites() {
    log "🔍 Checking prerequisites..."
    
    if [[ -z "$GITHUB_TOKEN" ]]; then
        error "GITHUB_TOKEN environment variable is required"
    fi
    
    if ! command -v curl >/dev/null 2>&1; then
        error "curl is required but not installed"
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        error "jq is required but not installed"
    fi
    
    info "✅ Prerequisites check passed"
}

# Function to authenticate with GitHub Container Registry
authenticate_registry() {
    log "🔐 Authenticating with GitHub Container Registry..."
    
    # Test authentication
    local auth_test=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
        "https://api.github.com/user" | jq -r '.login // "error"')
    
    if [[ "$auth_test" == "error" ]]; then
        error "Failed to authenticate with GitHub API"
    fi
    
    info "✅ Authenticated as: $auth_test"
}

# Function to list packages
list_packages() {
    local package_type=${1:-"container"}
    
    log "📦 Listing packages of type: $package_type"
    
    local packages=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
        "https://api.github.com/orgs/$(echo $REPOSITORY | cut -d'/' -f1)/packages?package_type=$package_type" \
        | jq -r '.[].name' 2>/dev/null || echo "")
    
    if [[ -z "$packages" ]]; then
        # Try user packages if org packages not found
        packages=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
            "https://api.github.com/users/$(echo $REPOSITORY | cut -d'/' -f1)/packages?package_type=$package_type" \
            | jq -r '.[].name' 2>/dev/null || echo "")
    fi
    
    echo "$packages"
}

# Function to get package versions
get_package_versions() {
    local package_name="$1"
    local owner=$(echo $REPOSITORY | cut -d'/' -f1)
    
    info "🔍 Getting versions for package: $package_name"
    
    # Try organization first
    local versions=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
        "https://api.github.com/orgs/$owner/packages/container/$package_name/versions" \
        2>/dev/null || echo "[]")
    
    # If org fails, try user
    if [[ "$versions" == "[]" ]]; then
        versions=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
            "https://api.github.com/users/$owner/packages/container/$package_name/versions" \
            2>/dev/null || echo "[]")
    fi
    
    echo "$versions"
}

# Function to delete package version
delete_package_version() {
    local package_name="$1"
    local version_id="$2"
    local owner=$(echo $REPOSITORY | cut -d'/' -f1)
    
    dry_run_notice "Deleting package version: $package_name (ID: $version_id)"
    
    if [[ "$DRY_RUN" != "true" ]]; then
        local response=$(curl -s -o /dev/null -w "%{http_code}" \
            -X DELETE \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            "https://api.github.com/orgs/$owner/packages/container/$package_name/versions/$version_id" \
            2>/dev/null || echo "500")
        
        # Try user endpoint if org fails
        if [[ "$response" != "204" ]]; then
            response=$(curl -s -o /dev/null -w "%{http_code}" \
                -X DELETE \
                -H "Authorization: Bearer $GITHUB_TOKEN" \
                "https://api.github.com/users/$owner/packages/container/$package_name/versions/$version_id" \
                2>/dev/null || echo "500")
        fi
        
        if [[ "$response" == "204" ]]; then
            info "✅ Successfully deleted version $version_id"
        else
            warn "❌ Failed to delete version $version_id (HTTP: $response)"
        fi
    fi
}

# Function to cleanup by retention policy
cleanup_by_retention() {
    local package_name="$1"
    local keep_count="$2"
    
    log "🧹 Cleaning up $package_name (keeping latest $keep_count versions)"
    
    local versions=$(get_package_versions "$package_name")
    
    if [[ "$versions" == "[]" ]] || [[ -z "$versions" ]]; then
        info "No versions found for package: $package_name"
        return
    fi
    
    # Parse versions and sort by creation date (newest first)
    local sorted_versions=$(echo "$versions" | jq -r '.[] | "\(.created_at) \(.id) \(.metadata.container.tags // [] | join(","))"' | sort -r)
    
    local count=0
    while IFS=' ' read -r created_at version_id tags; do
        count=$((count + 1))
        
        if [[ $count -gt $keep_count ]]; then
            info "Marking for deletion: $package_name:$tags (created: $created_at)"
            delete_package_version "$package_name" "$version_id"
        else
            info "Keeping: $package_name:$tags (created: $created_at)"
        fi
    done <<< "$sorted_versions"
}

# Function to cleanup by age
cleanup_by_age() {
    local package_name="$1"
    local max_age_days="$2"
    
    log "🕒 Cleaning up $package_name (removing versions older than $max_age_days days)"
    
    local versions=$(get_package_versions "$package_name")
    
    if [[ "$versions" == "[]" ]] || [[ -z "$versions" ]]; then
        info "No versions found for package: $package_name"
        return
    fi
    
    local cutoff_date=$(date -d "$max_age_days days ago" -u '+%Y-%m-%dT%H:%M:%SZ')
    
    echo "$versions" | jq -r '.[] | "\(.created_at) \(.id) \(.metadata.container.tags // [] | join(","))"' | \
    while IFS=' ' read -r created_at version_id tags; do
        if [[ "$created_at" < "$cutoff_date" ]]; then
            info "Marking for deletion (age): $package_name:$tags (created: $created_at)"
            delete_package_version "$package_name" "$version_id"
        else
            info "Keeping (recent): $package_name:$tags (created: $created_at)"
        fi
    done
}

# Function to cleanup untagged images
cleanup_untagged() {
    local package_name="$1"
    local max_age_days="$2"
    
    log "🏷️ Cleaning up untagged images for $package_name (older than $max_age_days days)"
    
    local versions=$(get_package_versions "$package_name")
    
    if [[ "$versions" == "[]" ]] || [[ -z "$versions" ]]; then
        info "No versions found for package: $package_name"
        return
    fi
    
    local cutoff_date=$(date -d "$max_age_days days ago" -u '+%Y-%m-%dT%H:%M:%SZ')
    
    echo "$versions" | jq -r '.[] | select(.metadata.container.tags | length == 0) | "\(.created_at) \(.id)"' | \
    while IFS=' ' read -r created_at version_id; do
        if [[ "$created_at" < "$cutoff_date" ]]; then
            info "Marking untagged for deletion: $package_name (ID: $version_id, created: $created_at)"
            delete_package_version "$package_name" "$version_id"
        else
            info "Keeping recent untagged: $package_name (ID: $version_id, created: $created_at)"
        fi
    done
}

# Function to cleanup cache images
cleanup_cache_images() {
    log "🗄️ Cleaning up cache images..."
    
    local packages=$(list_packages "container")
    
    echo "$packages" | while read -r package_name; do
        if [[ "$package_name" == *"-cache" ]] || [[ "$package_name" == *"cache"* ]]; then
            info "Processing cache package: $package_name"
            cleanup_by_age "$package_name" 7  # Keep cache for 7 days
        fi
    done
}

# Function to generate cleanup report
generate_cleanup_report() {
    log "📊 Generating cleanup report..."
    
    local report_file="/tmp/registry-cleanup-report.md"
    local packages=$(list_packages "container")
    
    cat > "$report_file" << EOF
# Registry Cleanup Report

Generated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')
Registry: $REGISTRY
Repository: $REPOSITORY
Dry Run: $DRY_RUN

## 📦 Package Summary

EOF
    
    echo "$packages" | while read -r package_name; do
        if [[ -n "$package_name" ]]; then
            local versions=$(get_package_versions "$package_name")
            local version_count=$(echo "$versions" | jq length 2>/dev/null || echo "0")
            
            echo "### $package_name" >> "$report_file"
            echo "- Total versions: $version_count" >> "$report_file"
            
            if [[ "$version_count" -gt 0 ]]; then
                local tagged_count=$(echo "$versions" | jq '[.[] | select(.metadata.container.tags | length > 0)] | length' 2>/dev/null || echo "0")
                local untagged_count=$(echo "$versions" | jq '[.[] | select(.metadata.container.tags | length == 0)] | length' 2>/dev/null || echo "0")
                
                echo "- Tagged versions: $tagged_count" >> "$report_file"
                echo "- Untagged versions: $untagged_count" >> "$report_file"
                
                # Latest version info
                local latest=$(echo "$versions" | jq -r '.[0] | "\(.created_at) \(.metadata.container.tags // [] | join(","))"' 2>/dev/null || echo "unknown unknown")
                echo "- Latest: $latest" >> "$report_file"
            fi
            
            echo "" >> "$report_file"
        fi
    done
    
    cat >> "$report_file" << EOF

## 🧹 Cleanup Policies Applied

### Production Images
- Keep latest: $KEEP_LATEST_PRODUCTION versions
- Max age: $KEEP_TAGS_DAYS days

### Testing Images  
- Keep latest: $KEEP_LATEST_TESTING versions
- Max age: $KEEP_TAGS_DAYS days

### Performance Images
- Keep latest: $KEEP_LATEST_PERFORMANCE versions
- Max age: $KEEP_TAGS_DAYS days

### Coordination Images
- Keep latest: $KEEP_LATEST_COORDINATION versions
- Max age: $KEEP_TAGS_DAYS days

### Untagged Images
- Max age: $KEEP_UNTAGGED_DAYS days

## 📈 Cleanup Results

$(if [[ "$DRY_RUN" == "true" ]]; then echo "⚠️ This was a dry run - no actual deletions were performed"; else echo "✅ Cleanup operations completed"; fi)

EOF
    
    info "Cleanup report generated: $report_file"
    cat "$report_file"
}

# Function to perform smart cleanup based on image types
smart_cleanup() {
    log "🤖 Performing smart cleanup based on image types..."
    
    local packages=$(list_packages "container")
    
    echo "$packages" | while read -r package_name; do
        if [[ -n "$package_name" ]]; then
            case "$package_name" in
                *"-production")
                    cleanup_by_retention "$package_name" $KEEP_LATEST_PRODUCTION
                    ;;
                *"-testing")
                    cleanup_by_retention "$package_name" $KEEP_LATEST_TESTING
                    ;;
                *"-performance")
                    cleanup_by_retention "$package_name" $KEEP_LATEST_PERFORMANCE
                    ;;
                *"-coordination")
                    cleanup_by_retention "$package_name" $KEEP_LATEST_COORDINATION
                    ;;
                *"-cache" | *"cache"*)
                    cleanup_by_age "$package_name" 7
                    ;;
                *)
                    # Default cleanup for unknown image types
                    cleanup_by_age "$package_name" $KEEP_TAGS_DAYS
                    cleanup_untagged "$package_name" $KEEP_UNTAGGED_DAYS
                    ;;
            esac
        fi
    done
}

# Function to display usage
usage() {
    cat << EOF
Registry Cleanup Script

Usage: $0 [OPTIONS]

Options:
    --dry-run               Perform dry run without actual deletions
    --production-keep N     Keep N latest production images (default: $KEEP_LATEST_PRODUCTION)
    --testing-keep N        Keep N latest testing images (default: $KEEP_LATEST_TESTING)
    --performance-keep N    Keep N latest performance images (default: $KEEP_LATEST_PERFORMANCE)
    --coordination-keep N   Keep N latest coordination images (default: $KEEP_LATEST_COORDINATION)
    --max-age-days N        Keep tagged images for N days (default: $KEEP_TAGS_DAYS)
    --untagged-days N       Keep untagged images for N days (default: $KEEP_UNTAGGED_DAYS)
    --cache-only            Only cleanup cache images
    --report-only           Generate report without cleanup
    --help                  Show this help message

Environment Variables:
    REGISTRY                Container registry URL (default: ghcr.io)
    REPOSITORY              Repository name (default: unjucks/unjucks)
    GITHUB_TOKEN            GitHub token for authentication (required)
    DRY_RUN                 Set to 'true' for dry run mode (default: false)

Examples:
    $0 --dry-run
    $0 --production-keep 5 --testing-keep 3
    $0 --cache-only
    $0 --report-only

EOF
}

# Main execution function
main() {
    local cache_only=false
    local report_only=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --production-keep)
                KEEP_LATEST_PRODUCTION="$2"
                shift 2
                ;;
            --testing-keep)
                KEEP_LATEST_TESTING="$2"
                shift 2
                ;;
            --performance-keep)
                KEEP_LATEST_PERFORMANCE="$2"
                shift 2
                ;;
            --coordination-keep)
                KEEP_LATEST_COORDINATION="$2"
                shift 2
                ;;
            --max-age-days)
                KEEP_TAGS_DAYS="$2"
                shift 2
                ;;
            --untagged-days)
                KEEP_UNTAGGED_DAYS="$2"
                shift 2
                ;;
            --cache-only)
                cache_only=true
                shift
                ;;
            --report-only)
                report_only=true
                shift
                ;;
            --help)
                usage
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    log "🚀 Starting Registry Cleanup"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        warn "🔍 DRY RUN MODE - No actual deletions will be performed"
    fi
    
    # Check prerequisites
    check_prerequisites
    authenticate_registry
    
    # Perform cleanup based on options
    if [[ "$report_only" == "true" ]]; then
        info "📊 Generating report only..."
        generate_cleanup_report
    elif [[ "$cache_only" == "true" ]]; then
        info "🗄️ Performing cache-only cleanup..."
        cleanup_cache_images
        generate_cleanup_report
    else
        info "🧹 Performing full cleanup..."
        smart_cleanup
        cleanup_cache_images
        generate_cleanup_report
    fi
    
    log "✅ Registry cleanup completed successfully!"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "To perform actual cleanup, run without --dry-run flag"
    fi
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi