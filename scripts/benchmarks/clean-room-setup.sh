#!/bin/bash

# Clean Room Performance Benchmark Setup
set -e

echo "🧪 Setting up clean room environment for performance benchmarking..."

# Create clean room directory
CLEAN_ROOM_DIR="tests/.tmp/clean-room-$(date +%s)"
mkdir -p "$CLEAN_ROOM_DIR"

echo "📁 Clean room directory: $CLEAN_ROOM_DIR"

# Copy minimal required files
cp package.json "$CLEAN_ROOM_DIR/"
cp tsconfig.json "$CLEAN_ROOM_DIR/" 2>/dev/null || echo "⚠️  No tsconfig.json found"
cp -r src "$CLEAN_ROOM_DIR/" 2>/dev/null || echo "⚠️  No src directory found"

# Create minimal package.json if needed
if [ ! -f "$CLEAN_ROOM_DIR/package.json" ]; then
  cat > "$CLEAN_ROOM_DIR/package.json" << 'EOF'
{
  "name": "unjucks-clean-room-benchmark",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "nunjucks": "^3.2.4",
    "gray-matter": "^4.0.3",
    "fs-extra": "^11.3.1",
    "glob": "^10.4.5"
  }
}
EOF
fi

cd "$CLEAN_ROOM_DIR"

# Install minimal dependencies
echo "📦 Installing minimal dependencies in clean room..."
npm install --production --silent

echo "🎯 Clean room setup complete!"
echo "Directory: $(pwd)"
echo "Size: $(du -sh . | cut -f1)"

# Run baseline measurements
echo "📊 Running baseline measurements..."

echo "System Info:"
echo "- Node.js: $(node --version)"
echo "- NPM: $(npm --version)"
echo "- OS: $(uname -s) $(uname -r)"
echo "- CPU: $(sysctl -n machdep.cpu.brand_string 2>/dev/null || lscpu | grep 'Model name' | cut -d':' -f2 | xargs 2>/dev/null || echo 'Unknown')"
echo "- Memory: $(free -h 2>/dev/null | grep '^Mem' || vm_stat | head -5)"

echo "Package Info:"
npm list --depth=0 2>/dev/null || echo "No packages installed"

# Store clean room path for benchmarks
echo "$PWD" > ../clean-room-path.txt

echo "✅ Clean room environment ready for benchmarking!"