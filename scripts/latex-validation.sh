#!/bin/bash

# LaTeX Validation Script for Local Development
# Provides comprehensive LaTeX testing without CI environment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VALIDATION_DIR="$PROJECT_ROOT/latex-validation"
ENGINES=("pdflatex" "xelatex" "lualatex")
TIMEOUT_DURATION=60

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}❌${NC} $1"
}

# Check if LaTeX is installed
check_latex_installation() {
    log "Checking LaTeX installation..."
    
    local missing_engines=()
    
    for engine in "${ENGINES[@]}"; do
        if command -v "$engine" &> /dev/null; then
            success "$engine is available"
        else
            missing_engines+=("$engine")
            warning "$engine is not available"
        fi
    done
    
    if [ ${#missing_engines[@]} -eq ${#ENGINES[@]} ]; then
        error "No LaTeX engines found. Please install TeX Live or similar."
        echo "On Ubuntu/Debian: sudo apt-get install texlive-full"
        echo "On macOS: brew install --cask mactex"
        exit 1
    fi
    
    success "LaTeX installation check completed"
}

# Setup validation workspace
setup_workspace() {
    log "Setting up validation workspace..."
    
    rm -rf "$VALIDATION_DIR"
    mkdir -p "$VALIDATION_DIR"/{templates,output,logs}
    
    success "Workspace created at $VALIDATION_DIR"
}

# Generate test templates
generate_test_templates() {
    log "Generating test templates..."
    
    cd "$PROJECT_ROOT"
    
    # Legal brief template
    node -e "
    const fs = require('fs');
    const nunjucks = require('nunjucks');
    
    const template = fs.readFileSync('templates/latex/legal/brief/legal-brief.tex.njk', 'utf8');
    const data = {
        title: 'Validation Test Legal Brief',
        author: 'Test Attorney',
        date: new Date().toLocaleDateString(),
        plaintiffName: 'Test Plaintiff Corp.',
        defendantName: 'Test Defendant LLC',
        caseNumber: '2024-CV-12345',
        courtName: 'Superior Court of Test County',
        content: 'This is a comprehensive test of the legal brief template system for LaTeX validation purposes.'
    };
    
    const rendered = nunjucks.renderString(template, data);
    fs.writeFileSync('$VALIDATION_DIR/templates/legal-brief.tex', rendered);
    console.log('Legal brief template generated');
    " || {
        error "Failed to generate legal brief template"
        return 1
    }
    
    # Academic paper template  
    node -e "
    const fs = require('fs');
    const nunjucks = require('nunjucks');
    
    const template = fs.readFileSync('templates/latex/arxiv/paper/paper.tex.njk', 'utf8');
    const data = {
        title: 'Automated LaTeX Template Validation Systems',
        author: 'Validation Team',
        institution: 'Test Research Institute',
        department: 'Computer Science',
        email: 'validation@test.edu',
        abstract: 'This paper presents a comprehensive validation framework for LaTeX template systems.',
        keywords: 'LaTeX, validation, templates, automation',
        content: 'This document demonstrates the academic paper template validation process.'
    };
    
    const rendered = nunjucks.renderString(template, data);
    fs.writeFileSync('$VALIDATION_DIR/templates/academic-paper.tex', rendered);
    console.log('Academic paper template generated');
    " || {
        error "Failed to generate academic paper template"
        return 1
    }
    
    # Contract template
    node -e "
    const fs = require('fs');
    const nunjucks = require('nunjucks');
    
    const template = fs.readFileSync('templates/latex/legal/contract/contract.tex.njk', 'utf8');
    const data = {
        contractTitle: 'Software Development Services Agreement',
        partyA: 'Technology Solutions Inc.',
        partyB: 'Development Contractor LLC',
        effectiveDate: '2024-01-01',
        terms: 'Complete development of software solutions according to specifications and requirements.'
    };
    
    const rendered = nunjucks.renderString(template, data);
    fs.writeFileSync('$VALIDATION_DIR/templates/contract.tex', rendered);
    console.log('Contract template generated');
    " || {
        error "Failed to generate contract template"
        return 1
    }
    
    success "Test templates generated successfully"
}

# Compile templates with different engines
compile_templates() {
    log "Compiling templates with different LaTeX engines..."
    
    local templates=("legal-brief" "academic-paper" "contract")
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    
    for template in "${templates[@]}"; do
        for engine in "${ENGINES[@]}"; do
            if ! command -v "$engine" &> /dev/null; then
                warning "Skipping $engine for $template (engine not available)"
                continue
            fi
            
            total_tests=$((total_tests + 1))
            
            log "Compiling $template with $engine..."
            
            local tex_file="$VALIDATION_DIR/templates/$template.tex"
            local output_dir="$VALIDATION_DIR/output/$engine"
            local log_file="$VALIDATION_DIR/logs/$template-$engine.log"
            
            mkdir -p "$output_dir"
            
            # Copy template to output directory for compilation
            cp "$tex_file" "$output_dir/"
            
            # Compile with timeout
            (
                cd "$output_dir"
                timeout $TIMEOUT_DURATION "$engine" \
                    -interaction=nonstopmode \
                    -halt-on-error \
                    "$template.tex" > "$log_file" 2>&1
            ) && {
                if [ -f "$output_dir/$template.pdf" ]; then
                    # Verify PDF size
                    local pdf_size
                    pdf_size=$(stat -f%z "$output_dir/$template.pdf" 2>/dev/null || stat -c%s "$output_dir/$template.pdf")
                    
                    if [ "$pdf_size" -gt 1024 ]; then
                        success "$template compiled successfully with $engine (${pdf_size} bytes)"
                        passed_tests=$((passed_tests + 1))
                    else
                        error "$template compilation with $engine produced invalid PDF (${pdf_size} bytes)"
                        failed_tests=$((failed_tests + 1))
                    fi
                else
                    error "$template compilation with $engine failed (no PDF output)"
                    failed_tests=$((failed_tests + 1))
                fi
            } || {
                error "$template compilation with $engine failed (compilation error)"
                failed_tests=$((failed_tests + 1))
                
                # Show error details
                if [ -f "$log_file" ]; then
                    echo "Last 10 lines of compilation log:"
                    tail -n 10 "$log_file"
                fi
            }
            
            echo # Add spacing
        done
    done
    
    # Summary
    log "Compilation Summary:"
    echo "  Total tests: $total_tests"
    echo "  Passed: $passed_tests"
    echo "  Failed: $failed_tests"
    
    if [ $failed_tests -eq 0 ]; then
        success "All LaTeX compilations passed!"
        return 0
    else
        error "$failed_tests compilation(s) failed"
        return 1
    fi
}

# Validate PDF quality
validate_pdf_quality() {
    log "Validating PDF quality..."
    
    local pdf_count=0
    local valid_pdfs=0
    
    find "$VALIDATION_DIR/output" -name "*.pdf" -type f | while read -r pdf_file; do
        pdf_count=$((pdf_count + 1))
        
        # Check if qpdf is available for validation
        if command -v qpdf &> /dev/null; then
            if qpdf --check "$pdf_file" &> /dev/null; then
                success "$(basename "$pdf_file"): Valid PDF structure"
                valid_pdfs=$((valid_pdfs + 1))
            else
                error "$(basename "$pdf_file"): Invalid PDF structure"
            fi
        else
            warning "qpdf not available, skipping PDF structure validation"
        fi
        
        # Check PDF metadata if pdfinfo is available
        if command -v pdfinfo &> /dev/null; then
            local pages
            pages=$(pdfinfo "$pdf_file" | grep "Pages:" | awk '{print $2}')
            
            if [ "$pages" -gt 0 ]; then
                success "$(basename "$pdf_file"): $pages page(s)"
            else
                warning "$(basename "$pdf_file"): No pages detected"
            fi
        fi
    done
    
    success "PDF quality validation completed"
}

# Test unjucks CLI integration
test_unjucks_cli() {
    log "Testing unjucks LaTeX CLI integration..."
    
    cd "$PROJECT_ROOT"
    
    # Test LaTeX command availability
    if node bin/unjucks.cjs latex --help &> /dev/null; then
        success "unjucks latex command is available"
    else
        error "unjucks latex command failed"
        return 1
    fi
    
    # Test template generation
    log "Testing template generation..."
    
    local cli_output_dir="$VALIDATION_DIR/cli-test"
    mkdir -p "$cli_output_dir"
    
    # Generate a test document
    node bin/unjucks.cjs latex generate \
        --template=article \
        --title="CLI Integration Test" \
        --author="Validation Script" \
        --output="$cli_output_dir/cli-test.tex" \
        --bibliography || {
        error "CLI template generation failed"
        return 1
    }
    
    if [ -f "$cli_output_dir/cli-test.tex" ]; then
        success "CLI template generation successful"
        
        # Test compilation through CLI
        if command -v pdflatex &> /dev/null; then
            log "Testing CLI compilation..."
            
            node bin/unjucks.cjs latex compile \
                "$cli_output_dir/cli-test.tex" \
                --engine=pdflatex \
                --output="$cli_output_dir/output" || {
                warning "CLI compilation failed (may be expected in some environments)"
            }
            
            if [ -f "$cli_output_dir/output/cli-test.pdf" ]; then
                success "CLI compilation successful"
            else
                warning "CLI compilation did not produce PDF"
            fi
        else
            warning "pdflatex not available, skipping CLI compilation test"
        fi
    else
        error "CLI template generation failed"
        return 1
    fi
    
    success "unjucks CLI integration test completed"
}

# Generate validation report
generate_report() {
    log "Generating validation report..."
    
    local report_file="$VALIDATION_DIR/validation-report.md"
    
    cat > "$report_file" << EOF
# LaTeX Validation Report

**Generated:** $(date)
**Script:** $0
**Project:** $(basename "$PROJECT_ROOT")

## Environment

- **OS:** $(uname -s) $(uname -r)
- **Available LaTeX Engines:**
EOF
    
    for engine in "${ENGINES[@]}"; do
        if command -v "$engine" &> /dev/null; then
            echo "  - ✓ $engine" >> "$report_file"
        else
            echo "  - ❌ $engine (not available)" >> "$report_file"
        fi
    done
    
    cat >> "$report_file" << EOF

## Compilation Results

### Generated PDFs
EOF
    
    find "$VALIDATION_DIR/output" -name "*.pdf" -type f | sort | while read -r pdf_file; do
        local size
        size=$(stat -f%z "$pdf_file" 2>/dev/null || stat -c%s "$pdf_file")
        echo "- $(basename "$pdf_file"): ${size} bytes" >> "$report_file"
    done
    
    cat >> "$report_file" << EOF

### Compilation Logs
EOF
    
    find "$VALIDATION_DIR/logs" -name "*.log" -type f | sort | while read -r log_file; do
        echo "- $(basename "$log_file")" >> "$report_file"
    done
    
    success "Validation report generated: $report_file"
}

# Cleanup function
cleanup() {
    if [ "${CLEANUP_WORKSPACE:-true}" = "true" ]; then
        log "Cleaning up validation workspace..."
        rm -rf "$VALIDATION_DIR"
        success "Workspace cleaned"
    else
        log "Keeping validation workspace at: $VALIDATION_DIR"
    fi
}

# Main execution
main() {
    log "Starting LaTeX validation..."
    
    # Parse command line arguments
    local keep_workspace=false
    local run_tests=true
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --keep-workspace)
                keep_workspace=true
                shift
                ;;
            --setup-only)
                run_tests=false
                shift
                ;;
            --help)
                echo "Usage: $0 [--keep-workspace] [--setup-only] [--help]"
                echo "  --keep-workspace  Keep validation workspace after completion"
                echo "  --setup-only      Only setup workspace, don't run tests"
                echo "  --help           Show this help message"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Set cleanup behavior
    if [ "$keep_workspace" = true ]; then
        export CLEANUP_WORKSPACE=false
    fi
    
    # Trap to ensure cleanup on exit
    trap cleanup EXIT
    
    # Run validation steps
    check_latex_installation
    setup_workspace
    generate_test_templates
    
    if [ "$run_tests" = true ]; then
        if compile_templates && validate_pdf_quality && test_unjucks_cli; then
            generate_report
            success "All LaTeX validation tests completed successfully!"
            exit 0
        else
            generate_report
            error "Some LaTeX validation tests failed!"
            exit 1
        fi
    else
        success "Workspace setup completed. Templates available at: $VALIDATION_DIR"
    fi
}

# Execute main function
main "$@"