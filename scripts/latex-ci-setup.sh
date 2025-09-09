#!/bin/bash

# LaTeX CI Environment Setup Script
# Optimized for GitHub Actions and CI environments

set -euo pipefail

# Configuration
TEXLIVE_INSTALL_DIR="/tmp/texlive"
TEXLIVE_YEAR="2024"
TEXLIVE_PROFILE="texlive-ci.profile"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[CI-SETUP]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}❌${NC} $1"
}

# Create TeX Live installation profile
create_texlive_profile() {
    log "Creating TeX Live installation profile..."
    
    cat > "$TEXLIVE_PROFILE" << 'EOF'
selected_scheme scheme-medium
TEXDIR /tmp/texlive/2024
TEXMFCONFIG ~/.texlive2024/texmf-config
TEXMFHOME ~/texmf
TEXMFLOCAL /tmp/texlive/texmf-local
TEXMFSYSCONFIG /tmp/texlive/2024/texmf-config
TEXMFSYSVAR /tmp/texlive/2024/texmf-var
TEXMFVAR ~/.texlive2024/texmf-var
binary_x86_64-linux 1
# Essential collections for LaTeX compilation
collection-basic 1
collection-latex 1
collection-latexrecommended 1
collection-fontsrecommended 1
collection-fontutils 1
collection-langenglish 1
collection-mathscience 1
collection-pictures 1
collection-plaingeneric 1
collection-bibtexextra 1
collection-latexextra 1
collection-publishers 1
# Installation options (optimized for CI)
instopt_adjustpath 0
instopt_adjustrepo 1
instopt_letter 0
instopt_portable 0
instopt_write18_restricted 1
# Database options (minimal for CI)
tlpdbopt_autobackup 0
tlpdbopt_backupdir tlpkg/backups
tlpdbopt_create_formats 1
tlpdbopt_desktop_integration 0
tlpdbopt_file_assocs 0
tlpdbopt_generate_updmap 0
tlpdbopt_install_docfiles 0
tlpdbopt_install_srcfiles 0
tlpdbopt_post_code 1
tlpdbopt_sys_bin /usr/local/bin
tlpdbopt_sys_info /usr/local/share/info
tlpdbopt_sys_man /usr/local/share/man
tlpdbopt_w32_multi_user 1
EOF
    
    success "TeX Live profile created: $TEXLIVE_PROFILE"
}

# Install TeX Live
install_texlive() {
    log "Installing TeX Live $TEXLIVE_YEAR..."
    
    # Create installation directory
    mkdir -p "$TEXLIVE_INSTALL_DIR"
    cd "$TEXLIVE_INSTALL_DIR"
    
    # Download installer
    log "Downloading TeX Live installer..."
    wget -q --timeout=30 --tries=3 \
        http://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz \
        -O install-tl-unx.tar.gz
    
    # Extract installer
    tar -xzf install-tl-unx.tar.gz
    cd install-tl-*
    
    # Copy profile
    cp "/$TEXLIVE_PROFILE" .
    
    # Install TeX Live
    log "Running TeX Live installation (this may take 10-15 minutes)..."
    ./install-tl --profile="$TEXLIVE_PROFILE" --no-interaction
    
    success "TeX Live installation completed"
}

# Setup PATH and environment
setup_environment() {
    log "Setting up TeX Live environment..."
    
    # Add to PATH
    export PATH="/tmp/texlive/$TEXLIVE_YEAR/bin/x86_64-linux:$PATH"
    
    # Verify installation
    if command -v tex &> /dev/null; then
        success "TeX Live is properly installed and accessible"
        tex --version | head -n 1
    else
        error "TeX Live installation failed - tex command not found"
        return 1
    fi
    
    # Test basic engines
    for engine in pdflatex xelatex lualatex; do
        if command -v "$engine" &> /dev/null; then
            success "$engine is available"
        else
            error "$engine is not available"
        fi
    done
}

# Install essential packages
install_essential_packages() {
    log "Installing essential LaTeX packages..."
    
    export PATH="/tmp/texlive/$TEXLIVE_YEAR/bin/x86_64-linux:$PATH"
    
    # Essential packages for legal documents and academic papers
    local packages=(
        # Core packages
        "geometry" "fancyhdr" "setspace" "titlesec" "enumitem"
        # Math and symbols
        "amsmath" "amsfonts" "amssymb" "mathtools"
        # Graphics and figures
        "graphicx" "xcolor" "tikz" "pgfplots"
        # Tables and lists
        "booktabs" "longtable" "array" "tabularx" "multirow"
        # Bibliography
        "natbib" "biblatex" "biber"
        # Fonts and encoding
        "fontspec" "xunicode" "xltxtra" "polyglossia"
        # Quality and formatting
        "microtype" "csquotes" "hyperref"
        # Legal document specific
        "etoolbox" "xparse" "l3packages"
        # Additional useful packages
        "listings" "caption" "subcaption" "float" "rotating"
        # Academic writing
        "fontawesome5" "academicons"
    )
    
    log "Installing ${#packages[@]} essential packages..."
    
    # Install packages in batches to avoid timeout
    local batch_size=5
    local batch=()
    
    for package in "${packages[@]}"; do
        batch+=("$package")
        
        if [ ${#batch[@]} -eq $batch_size ]; then
            log "Installing batch: ${batch[*]}"
            if tlmgr install "${batch[@]}" || true; then
                success "Batch installed successfully"
            else
                log "Some packages in batch may have failed (continuing)"
            fi
            batch=()
        fi
    done
    
    # Install remaining packages
    if [ ${#batch[@]} -gt 0 ]; then
        log "Installing final batch: ${batch[*]}"
        tlmgr install "${batch[@]}" || true
    fi
    
    success "Package installation completed"
}

# Verify installation
verify_installation() {
    log "Verifying TeX Live installation..."
    
    export PATH="/tmp/texlive/$TEXLIVE_YEAR/bin/x86_64-linux:$PATH"
    
    # Create test document
    local test_dir="/tmp/latex-test"
    mkdir -p "$test_dir"
    cd "$test_dir"
    
    cat > test.tex << 'EOF'
\documentclass{article}
\usepackage[utf8]{inputenc}
\usepackage{amsmath}
\usepackage{graphicx}
\usepackage{hyperref}
\title{LaTeX Installation Test}
\author{CI Test}
\date{\today}
\begin{document}
\maketitle
\section{Test Section}
This is a test document to verify LaTeX installation.
\subsection{Math Test}
\begin{equation}
E = mc^2
\end{equation}
\subsection{List Test}
\begin{itemize}
\item First item
\item Second item
\end{itemize}
\end{document}
EOF
    
    # Test compilation with different engines
    local engines=("pdflatex" "xelatex" "lualatex")
    local successful_engines=()
    
    for engine in "${engines[@]}"; do
        if command -v "$engine" &> /dev/null; then
            log "Testing $engine compilation..."
            
            if timeout 60 "$engine" -interaction=nonstopmode test.tex &> /dev/null; then
                if [ -f "test.pdf" ]; then
                    local pdf_size
                    pdf_size=$(stat -c%s test.pdf)
                    if [ "$pdf_size" -gt 1024 ]; then
                        success "$engine compilation successful (${pdf_size} bytes)"
                        successful_engines+=("$engine")
                    else
                        error "$engine produced invalid PDF (${pdf_size} bytes)"
                    fi
                else
                    error "$engine compilation failed - no PDF output"
                fi
            else
                error "$engine compilation failed"
            fi
            
            # Clean up for next test
            rm -f test.pdf test.aux test.log test.out
        else
            log "$engine not available, skipping test"
        fi
    done
    
    if [ ${#successful_engines[@]} -gt 0 ]; then
        success "Verification completed. Working engines: ${successful_engines[*]}"
        return 0
    else
        error "No LaTeX engines working properly"
        return 1
    fi
}

# Cache optimization for CI
optimize_for_ci() {
    log "Optimizing installation for CI caching..."
    
    # Remove unnecessary files to reduce cache size
    find "/tmp/texlive/$TEXLIVE_YEAR" -name "*.log" -delete 2>/dev/null || true
    find "/tmp/texlive/$TEXLIVE_YEAR" -name "*.aux" -delete 2>/dev/null || true
    
    # Create cache info file
    cat > "/tmp/texlive/cache-info.txt" << EOF
TeX Live Installation Cache
Generated: $(date)
Version: $TEXLIVE_YEAR
Profile: $TEXLIVE_PROFILE
Size: $(du -sh /tmp/texlive | cut -f1)
EOF
    
    success "CI optimization completed"
}

# Main installation function
main() {
    log "Starting TeX Live CI setup..."
    
    # Parse arguments
    local force_install=false
    local verify_only=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                force_install=true
                shift
                ;;
            --verify-only)
                verify_only=true
                shift
                ;;
            --help)
                echo "Usage: $0 [--force] [--verify-only] [--help]"
                echo "  --force       Force fresh installation even if cache exists"
                echo "  --verify-only Only verify existing installation"
                echo "  --help        Show this help message"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Check if TeX Live is already installed
    if [ "$verify_only" = true ]; then
        log "Verification mode - checking existing installation..."
        export PATH="/tmp/texlive/$TEXLIVE_YEAR/bin/x86_64-linux:$PATH"
        verify_installation
        exit $?
    fi
    
    if [ -d "/tmp/texlive/$TEXLIVE_YEAR" ] && [ "$force_install" = false ]; then
        log "TeX Live installation found in cache"
        setup_environment
        verify_installation
    else
        if [ "$force_install" = true ]; then
            log "Force installation requested - removing existing installation"
            rm -rf "$TEXLIVE_INSTALL_DIR"
        fi
        
        create_texlive_profile
        install_texlive
        setup_environment
        install_essential_packages
        verify_installation
        optimize_for_ci
    fi
    
    success "TeX Live CI setup completed successfully!"
}

# Cleanup on exit
cleanup() {
    rm -f "$TEXLIVE_PROFILE" 2>/dev/null || true
}

trap cleanup EXIT

# Execute main function
main "$@"