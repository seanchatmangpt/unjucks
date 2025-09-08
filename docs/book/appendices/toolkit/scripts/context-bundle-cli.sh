#!/bin/bash
# Context Bundle Management CLI

COMMAND=${1:-"help"}
BUNDLE_DIR="docs/book/appendices/toolkit/bundles"

case $COMMAND in
  "create")
    PHASE=${2:-"development"}
    echo "📦 Creating context bundle for $PHASE phase..."
    
    npx tsx -e "
    import { ContextBundleGenerator } from './scripts/context-bundle-generator';
    
    const generator = new ContextBundleGenerator();
    const agents = []; // Collect current agents
    const memory = {}; // Collect current memory
    
    generator.createBundle('$PHASE', agents, memory, { compress: true })
      .then(id => console.log('✅ Bundle created:', id));
    "
    ;;
    
  "list")
    echo "📋 Available context bundles:"
    ls -la $BUNDLE_DIR/*.bundle 2>/dev/null | while read -r line; do
      echo "  $line"
    done
    ;;
    
  "load")
    BUNDLE_ID=${2}
    if [ -z "$BUNDLE_ID" ]; then
      echo "❌ Bundle ID required"
      echo "Usage: $0 load <bundle-id>"
      exit 1
    fi
    
    echo "📂 Loading bundle: $BUNDLE_ID"
    npx tsx -e "
    import { ContextBundleGenerator } from './scripts/context-bundle-generator';
    
    const generator = new ContextBundleGenerator();
    generator.loadBundle('$BUNDLE_ID')
      .then(bundle => console.log(JSON.stringify(bundle, null, 2)))
      .catch(err => console.error('❌ Error:', err.message));
    "
    ;;
    
  "report")
    echo "📊 Generating bundle report..."
    npx tsx -e "
    import { ContextBundleGenerator } from './scripts/context-bundle-generator';
    
    const generator = new ContextBundleGenerator();
    console.log(generator.getBundleReport());
    "
    ;;
    
  "compress")
    echo "🗜️  Compressing all uncompressed bundles..."
    # Implementation for batch compression
    ;;
    
  "archive")
    DAYS=${2:-30}
    echo "📁 Archiving bundles older than $DAYS days..."
    find $BUNDLE_DIR -name "*.bundle" -mtime +$DAYS -exec mv {} $BUNDLE_DIR/archive/ \;
    echo "✅ Archival complete"
    ;;
    
  "help"|*)
    cat << EOF
Context Bundle CLI Tool
======================

Usage: $0 <command> [options]

Commands:
  create <phase>     Create new context bundle
  list              List available bundles  
  load <bundle-id>  Load and display bundle
  report            Generate bundle usage report
  compress          Compress all uncompressed bundles
  archive <days>    Archive old bundles (default: 30 days)
  help              Show this help message

Examples:
  $0 create production
  $0 load bundle-dev-1234567890-abc123
  $0 archive 7
EOF
    ;;
esac