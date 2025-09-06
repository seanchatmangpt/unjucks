#!/bin/bash

# Unjucks Documentation Deployment Script
# Builds and deploys mdbook to GitHub Pages

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCS_DIR="docs/book"
BUILD_DIR="$DOCS_DIR/book"
GITHUB_REPO="ruvnet/unjucks"
CUSTOM_DOMAIN="unjucks.dev"

echo -e "${BLUE}🚀 Unjucks Documentation Deployment${NC}"
echo -e "${BLUE}=================================${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "$DOCS_DIR" ]; then
    echo -e "${RED}❌ Error: Run this script from the project root directory${NC}"
    exit 1
fi

# Check if mdbook is installed
if ! command -v mdbook &> /dev/null; then
    echo -e "${YELLOW}📦 Installing mdbook...${NC}"
    
    # Install Rust if not present
    if ! command -v cargo &> /dev/null; then
        echo -e "${YELLOW}🦀 Installing Rust...${NC}"
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env"
    fi
    
    # Install mdbook and plugins
    cargo install mdbook
    cargo install mdbook-toc
    echo -e "${GREEN}✅ mdbook installed successfully${NC}"
fi

# Check mdbook version
MDBOOK_VERSION=$(mdbook --version)
echo -e "${BLUE}📖 Using $MDBOOK_VERSION${NC}"

# Navigate to docs directory
cd "$DOCS_DIR"

echo -e "${YELLOW}🔨 Building documentation...${NC}"

# Clean previous build
if [ -d "book" ]; then
    rm -rf book
fi

# Build the book
if mdbook build; then
    echo -e "${GREEN}✅ Documentation built successfully${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Add CNAME file for custom domain
echo "$CUSTOM_DOMAIN" > book/CNAME
echo -e "${GREEN}✅ CNAME file created for $CUSTOM_DOMAIN${NC}"

# Check if this is a dry run
if [ "$1" = "--dry-run" ]; then
    echo -e "${YELLOW}🔍 Dry run completed. Build artifacts in: $BUILD_DIR${NC}"
    echo -e "${BLUE}📋 Contents:${NC}"
    ls -la book/
    cd ../..
    exit 0
fi

# Return to project root
cd ../..

echo -e "${BLUE}📊 Deployment Summary${NC}"
echo -e "${BLUE}===================${NC}"
echo -e "📁 Source: $DOCS_DIR"
echo -e "🏗️  Build: $BUILD_DIR"
echo -e "🌐 Domain: $CUSTOM_DOMAIN"
echo -e "📱 GitHub: https://github.com/$GITHUB_REPO"

# Instructions for GitHub Pages setup
cat << 'EOF'

🔧 GITHUB PAGES SETUP INSTRUCTIONS:
===================================

1. Repository Settings → Pages:
   ✅ Source: GitHub Actions
   ✅ Custom domain: unjucks.dev

2. DNS Configuration for unjucks.dev:
   📡 CNAME record: unjucks.dev → ruvnet.github.io
   📡 A records (if using apex domain):
      • 185.199.108.153
      • 185.199.109.153  
      • 185.199.110.153
      • 185.199.111.153

3. Automated Deployment:
   🤖 Push to main branch triggers automatic deployment
   🔄 Monitor: Actions tab in GitHub repository

4. Verification:
   🌐 GitHub Pages: https://ruvnet.github.io/unjucks/
   🎯 Custom Domain: https://unjucks.dev (after DNS setup)

EOF

echo -e "${GREEN}🎉 Documentation deployment setup complete!${NC}"
echo -e "${YELLOW}💡 Run with --dry-run to test build without deployment${NC}"

# Test the build locally if requested
if [ "$1" = "--serve" ]; then
    echo -e "${BLUE}🌐 Starting local server...${NC}"
    cd "$DOCS_DIR"
    mdbook serve --open
fi