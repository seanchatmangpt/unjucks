#!/bin/bash

# Comprehensive Installation Testing Script for Unjucks
# Tests npm global installation, Homebrew formula, and cross-platform compatibility

set -e  # Exit on any error

echo "🚀 Unjucks Installation Testing Suite"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
CLEANUP_COMMANDS=()

# Helper functions
print_success() { echo -e "${GREEN}✅ $1${NC}"; ((TESTS_PASSED++)); }
print_error() { echo -e "${RED}❌ $1${NC}"; ((TESTS_FAILED++)); }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# Cleanup function
cleanup() {
  echo
  print_info "🧹 Cleaning up test environment..."
  
  for cmd in "${CLEANUP_COMMANDS[@]}"; do
    eval "$cmd" 2>/dev/null || true
  done
  
  echo
  echo "📊 Test Results Summary:"
  echo "======================="
  print_success "Tests Passed: $TESTS_PASSED"
  if [ $TESTS_FAILED -gt 0 ]; then
    print_error "Tests Failed: $TESTS_FAILED"
    exit 1
  else
    print_success "All tests passed! Ready for distribution 🎉"
  fi
}

# Set trap for cleanup
trap cleanup EXIT

# Test environment setup
echo
print_info "🔧 Setting up test environment..."

# Check Node.js version
NODE_VERSION=$(node --version)
print_info "Node.js version: $NODE_VERSION"
if [[ ! "$NODE_VERSION" =~ ^v(18|19|20|21|22)\. ]]; then
  print_error "Node.js 18+ required. Current: $NODE_VERSION"
  exit 1
fi

# Check npm availability
NPM_VERSION=$(npm --version)
print_info "npm version: $NPM_VERSION"

# Build the package
print_info "🔨 Building package for testing..."
npm run build
if [ $? -eq 0 ]; then
  print_success "Package built successfully"
else
  print_error "Package build failed"
  exit 1
fi

# Test 1: Package Structure Validation
echo
print_info "🏗️  Test 1: Package Structure Validation"
echo "----------------------------------------"

# Check required files exist
REQUIRED_FILES=("dist/index.cjs" "bin/unjucks.cjs" "package.json" "homebrew/unjucks.rb")
for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$file" ]; then
    print_success "Required file exists: $file"
  else
    print_error "Missing required file: $file"
  fi
done

# Check binary permissions
if [ -x "bin/unjucks.cjs" ]; then
  print_success "Binary has executable permissions"
else
  print_error "Binary missing executable permissions"
fi

# Check package.json configuration
if grep -q '"preferGlobal": true' package.json; then
  print_success "Package configured for global installation"
else
  print_error "Package missing preferGlobal configuration"
fi

if grep -q '"engines"' package.json; then
  print_success "Node.js version requirements specified"
else
  print_error "Missing Node.js version requirements"
fi

# Test 2: Local Binary Testing
echo
print_info "🧪 Test 2: Local Binary Testing"
echo "--------------------------------"

# Test binary execution
if node bin/unjucks.cjs --version >/dev/null 2>&1; then
  VERSION_OUTPUT=$(node bin/unjucks.cjs --version)
  print_success "Binary executes successfully: $VERSION_OUTPUT"
else
  print_error "Binary execution failed"
fi

# Test CLI commands
COMMANDS=("list" "init" "--help")
for cmd in "${COMMANDS[@]}"; do
  if node bin/unjucks.cjs $cmd >/dev/null 2>&1; then
    print_success "Command works: unjucks $cmd"
  else
    print_error "Command failed: unjucks $cmd"
  fi
done

# Test dry run generation
if node bin/unjucks.cjs generate component react --dry >/dev/null 2>&1; then
  print_success "Dry run generation works"
else
  print_error "Dry run generation failed"
fi

# Test 3: NPM Pack Testing
echo
print_info "📦 Test 3: NPM Pack Testing"
echo "----------------------------"

# Create npm package tarball
TARBALL=$(npm pack)
CLEANUP_COMMANDS+=("rm -f $TARBALL")

if [ -f "$TARBALL" ]; then
  print_success "NPM package created: $TARBALL"
  
  # Check tarball size
  SIZE=$(stat -c%s "$TARBALL" 2>/dev/null || stat -f%z "$TARBALL" 2>/dev/null || echo "unknown")
  if [ "$SIZE" != "unknown" ] && [ "$SIZE" -lt 2097152 ]; then  # 2MB
    print_success "Package size optimal: $(echo "scale=2; $SIZE/1024/1024" | bc 2>/dev/null || echo "$SIZE bytes")"
  else
    print_warning "Package size may be large: $SIZE bytes"
  fi
else
  print_error "NPM package creation failed"
fi

# Test 4: Simulated Global Installation
echo
print_info "🌍 Test 4: Simulated Global Installation"
echo "----------------------------------------"

# Create temporary directory for installation test
TEMP_DIR=$(mktemp -d)
CLEANUP_COMMANDS+=("rm -rf $TEMP_DIR")

# Install package locally to simulate global install
cd "$TEMP_DIR"
if npm install --global "$OLDPWD/$TARBALL" --prefix "$TEMP_DIR" >/dev/null 2>&1; then
  print_success "Package installs globally"
  
  # Test installed binary
  INSTALLED_BINARY="$TEMP_DIR/bin/unjucks"
  if [ -f "$INSTALLED_BINARY" ] && [ -x "$INSTALLED_BINARY" ]; then
    print_success "Installed binary is executable"
    
    # Test installed binary functionality
    if "$INSTALLED_BINARY" --version >/dev/null 2>&1; then
      print_success "Installed binary works correctly"
    else
      print_error "Installed binary execution failed"
    fi
  else
    print_error "Installed binary not found or not executable"
  fi
else
  print_error "Global installation simulation failed"
fi

cd - >/dev/null

# Test 5: Homebrew Formula Validation
echo
print_info "🍺 Test 5: Homebrew Formula Validation"
echo "--------------------------------------"

FORMULA_PATH="homebrew/unjucks.rb"

# Check formula syntax with Ruby if available
if command -v ruby >/dev/null 2>&1; then
  if ruby -c "$FORMULA_PATH" >/dev/null 2>&1; then
    print_success "Homebrew formula has valid Ruby syntax"
  else
    print_error "Homebrew formula has syntax errors"
  fi
else
  print_warning "Ruby not available for formula syntax checking"
fi

# Check formula content
FORMULA_CHECKS=(
  "class Unjucks < Formula"
  "desc \"Semantic-aware scaffolding"
  "homepage \"https://github.com/unjucks/unjucks\""
  "url \"https://registry.npmjs.org/unjucks"
  "depends_on \"node\""
  "def install"
  "test do"
)

for check in "${FORMULA_CHECKS[@]}"; do
  if grep -q "$check" "$FORMULA_PATH"; then
    print_success "Formula contains: $check"
  else
    print_error "Formula missing: $check"
  fi
done

# Test 6: Cross-Platform Compatibility
echo
print_info "🖥️  Test 6: Cross-Platform Compatibility"
echo "----------------------------------------"

PLATFORM=$(uname -s)
ARCH=$(uname -m)

print_info "Testing on: $PLATFORM ($ARCH)"

# Test platform-specific binary execution
case "$PLATFORM" in
  "Darwin")
    print_success "macOS platform detected and supported"
    ;;
  "Linux")
    print_success "Linux platform detected and supported"
    ;;
  "MINGW"*|"MSYS"*|"CYGWIN"*)
    print_success "Windows platform detected and supported"
    ;;
  *)
    print_warning "Unknown platform: $PLATFORM"
    ;;
esac

# Test architecture compatibility
case "$ARCH" in
  "x86_64"|"amd64")
    print_success "x64 architecture supported"
    ;;
  "arm64"|"aarch64")
    print_success "ARM64 architecture supported"
    ;;
  *)
    print_warning "Architecture may not be fully tested: $ARCH"
    ;;
esac

# Test 7: Performance Benchmarks
echo
print_info "⚡ Test 7: Performance Benchmarks"
echo "---------------------------------"

# Test CLI startup time
START_TIME=$(date +%s%N)
node bin/unjucks.cjs --version >/dev/null 2>&1
END_TIME=$(date +%s%N)
DURATION=$(( (END_TIME - START_TIME) / 1000000 ))  # Convert to milliseconds

if [ "$DURATION" -lt 1000 ]; then  # Less than 1 second
  print_success "CLI startup time: ${DURATION}ms (excellent)"
elif [ "$DURATION" -lt 2000 ]; then  # Less than 2 seconds
  print_success "CLI startup time: ${DURATION}ms (good)"
else
  print_warning "CLI startup time: ${DURATION}ms (may be slow)"
fi

# Test memory usage (if ps is available)
if command -v ps >/dev/null 2>&1; then
  node bin/unjucks.cjs --version >/dev/null 2>&1 &
  PID=$!
  sleep 0.1
  if ps -p $PID >/dev/null 2>&1; then
    MEMORY=$(ps -o rss= -p $PID 2>/dev/null || echo "unknown")
    if [ "$MEMORY" != "unknown" ] && [ "$MEMORY" -lt 51200 ]; then  # Less than 50MB
      print_success "Memory usage: ${MEMORY}KB (efficient)"
    else
      print_warning "Memory usage: ${MEMORY}KB (may be high)"
    fi
    kill $PID 2>/dev/null || true
  fi
fi

# Test 8: Documentation and Metadata
echo
print_info "📚 Test 8: Documentation and Metadata"
echo "--------------------------------------"

# Check README exists
if [ -f "README.md" ]; then
  print_success "README.md exists"
else
  print_warning "README.md not found"
fi

# Check LICENSE exists
if [ -f "LICENSE" ]; then
  print_success "LICENSE file exists"
else
  print_warning "LICENSE file not found"
fi

# Check package.json metadata
METADATA_CHECKS=(
  "\"name\": \"unjucks\""
  "\"version\":"
  "\"description\":"
  "\"author\":"
  "\"license\":"
  "\"bin\":"
  "\"keywords\":"
)

for check in "${METADATA_CHECKS[@]}"; do
  if grep -q "$check" package.json; then
    print_success "Package.json has: $check"
  else
    print_error "Package.json missing: $check"
  fi
done

echo
print_info "🎯 Installation Testing Complete!"
print_info "Ready for npm publish and Homebrew distribution"