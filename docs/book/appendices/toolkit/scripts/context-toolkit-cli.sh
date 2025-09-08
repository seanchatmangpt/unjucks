#!/bin/bash
# Context Engineering Toolkit CLI - Master Control Script

COMMAND=${1:-"help"}
TOOLKIT_DIR="docs/book/appendices/toolkit"

echo "🧰 Context Engineering Toolkit for AI Swarms"
echo "=============================================="

case $COMMAND in
  "init")
    echo "🚀 Initializing Context Engineering Toolkit..."
    
    # Create directory structure
    mkdir -p "$TOOLKIT_DIR"/{scripts,templates,configs,examples,monitoring,bundles}
    
    # Install dependencies
    npm install --save-dev ws typescript tsx @types/node
    
    # Generate configuration files
    npx tsx -e "
    import { MCPProfileManager, MCP_PROFILES } from './configs/mcp-profiles';
    
    const manager = new MCPProfileManager();
    const devConfig = manager.generateConfigFile('development');
    console.log('Generated MCP development profile');
    "
    
    echo "✅ Toolkit initialized successfully"
    echo "📁 Files created in: $TOOLKIT_DIR"
    ;;
    
  "analyze")
    LOG_FILE=${2:-"conversation.log"}
    echo "🔍 Analyzing context usage from $LOG_FILE..."
    
    if [ ! -f "$LOG_FILE" ]; then
      echo "❌ Log file not found: $LOG_FILE"
      echo "Usage: $0 analyze <log-file>"
      exit 1
    fi
    
    npx tsx scripts/context-analyzer.ts "$LOG_FILE"
    ;;
    
  "monitor")
    PORT=${2:-3001}
    echo "📊 Starting performance monitor on port $PORT..."
    npx tsx monitoring/dashboard-server.ts $PORT &
    
    echo "🔗 Dashboard available at: http://localhost:$PORT"
    echo "⏹️  Stop with: kill %1"
    ;;
    
  "profile")
    PROFILE_NAME=${2:-"development"}
    echo "⚙️  Loading MCP profile: $PROFILE_NAME"
    ./scripts/mcp-manager.sh load "$PROFILE_NAME"
    ;;
    
  "bundle")
    ACTION=${2:-"create"}
    case $ACTION in
      "create")
        PHASE=${3:-"development"}
        ./scripts/context-bundle-cli.sh create "$PHASE"
        ;;
      "list")
        ./scripts/context-bundle-cli.sh list
        ;;
      "report")
        ./scripts/context-bundle-cli.sh report
        ;;
      *)
        echo "Bundle actions: create, list, report"
        ;;
    esac
    ;;
    
  "optimize")
    TEMPLATE=${2:-"rapid-prototyping"}
    echo "⚡ Generating optimization script for $TEMPLATE..."
    
    npx tsx -e "
    import { generatePrimingScript, createPrimingScript } from './scripts/context-primers';
    
    createPrimingScript('$TEMPLATE', './scripts/prime-$TEMPLATE.sh')
      .then(() => console.log('✅ Optimization script created: ./scripts/prime-$TEMPLATE.sh'));
    "
    ;;
    
  "benchmark")
    echo "🏃 Running context engineering benchmarks..."
    
    npx tsx -e "
    import { UnjucksContextOptimizedWorkflow } from './examples/unjucks-context-optimization';
    
    const workflow = new UnjucksContextOptimizedWorkflow();
    workflow.generateBenchmarkReport().then(console.log);
    "
    ;;
    
  "patterns")
    echo "🔄 Available coordination patterns:"
    
    npx tsx -e "
    import { COORDINATION_PATTERNS } from './templates/coordination-patterns';
    
    Object.entries(COORDINATION_PATTERNS).forEach(([key, pattern]) => {
      console.log(\`\n🔧 \${key}\`);
      console.log(\`   Name: \${pattern.name}\`);
      console.log(\`   Topology: \${pattern.topology}\`);
      console.log(\`   Roles: \${pattern.agentRoles.join(', ')}\`);
      console.log(\`   Use Cases: \${pattern.useCase.join(', ')}\`);
    });
    "
    ;;
    
  "agents")
    echo "🤖 Available optimized agent templates:"
    
    npx tsx -e "
    import { OPTIMIZED_AGENT_TEMPLATES } from './templates/agent-templates';
    
    Object.entries(OPTIMIZED_AGENT_TEMPLATES).forEach(([key, template]) => {
      console.log(\`\n👤 \${key}\`);
      console.log(\`   Name: \${template.name}\`);
      console.log(\`   Role: \${template.role}\`);
      console.log(\`   Max Tokens: \${template.maxTokensRecommended.toLocaleString()}\`);
      console.log(\`   Strategy: \${template.batchingStrategy}\`);
      console.log(\`   Memory: \${template.memoryPattern}\`);
    });
    "
    ;;
    
  "demo")
    echo "🎬 Running Unjucks v2 optimization demo..."
    
    npx tsx -e "
    import { runOptimizedWorkflow } from './examples/unjucks-context-optimization';
    runOptimizedWorkflow().catch(console.error);
    "
    ;;
    
  "status")
    echo "📈 Context Engineering Toolkit Status:"
    echo ""
    
    # Check if monitoring is running
    if pgrep -f "dashboard-server" > /dev/null; then
      echo "✅ Performance monitoring: Running"
    else
      echo "❌ Performance monitoring: Stopped"
    fi
    
    # Check MCP status
    if [ -f "$HOME/.config/claude/claude_desktop_config.json" ]; then
      echo "✅ MCP configuration: Found"
    else
      echo "❌ MCP configuration: Not found"
    fi
    
    # Check bundle storage
    BUNDLE_COUNT=$(ls -1 "$TOOLKIT_DIR/bundles/"*.bundle 2>/dev/null | wc -l)
    echo "📦 Context bundles: $BUNDLE_COUNT stored"
    
    # Check agent templates
    echo "🤖 Agent templates: $(npx tsx -e "console.log(Object.keys(require('./templates/agent-templates').OPTIMIZED_AGENT_TEMPLATES).length)") available"
    
    # Check coordination patterns  
    echo "🔄 Coordination patterns: $(npx tsx -e "console.log(Object.keys(require('./templates/coordination-patterns').COORDINATION_PATTERNS).length)") available"
    ;;
    
  "help"|*)
    cat << EOF

Context Engineering Toolkit Commands
===================================

Setup & Management:
  init              Initialize toolkit and dependencies
  status            Show toolkit status and health
  
Analysis & Monitoring:  
  analyze <file>    Analyze context usage from log file
  monitor [port]    Start performance monitoring dashboard
  
Configuration:
  profile <name>    Load MCP profile (development/production/research/lightweight)
  patterns          List available coordination patterns
  agents            List optimized agent templates
  
Context Bundles:
  bundle create <phase>   Create context bundle
  bundle list            List stored bundles  
  bundle report          Generate bundle usage report
  
Optimization:
  optimize <template>     Generate priming script for development phase
  benchmark              Run performance benchmarks
  
Examples & Demos:
  demo                   Run Unjucks v2 optimization demo

Examples:
  $0 init                          # Setup toolkit
  $0 analyze conversation.log      # Analyze context usage
  $0 monitor 3001                  # Start dashboard on port 3001
  $0 profile development           # Load development MCP profile
  $0 bundle create production      # Create production context bundle
  $0 optimize rapid-prototyping    # Generate prototyping primer
  $0 demo                         # See optimization in action

For detailed documentation, see: docs/book/appendices/appendix-e-context-toolkit.md
EOF
    ;;
esac