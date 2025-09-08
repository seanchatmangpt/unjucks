#!/bin/bash
# MCP Profile Management Script

COMMAND=${1:-"help"}
PROFILE=${2}
CONFIG_DIR="$HOME/.config/claude"
MCP_CONFIG="$CONFIG_DIR/claude_desktop_config.json"

case $COMMAND in
  "profiles")
    echo "📋 Available MCP Profiles:"
    echo ""
    npx tsx -e "
    import { MCP_PROFILES } from './configs/mcp-profiles';
    
    Object.entries(MCP_PROFILES).forEach(([key, profile]) => {
      console.log(\`🔧 \${key}\`);
      console.log(\`   Description: \${profile.description}\`);
      console.log(\`   Servers: \${profile.servers.join(', ')}\`);
      console.log(\`   Use Cases: \${profile.useCase.join(', ')}\`);
      console.log('');
    });
    "
    ;;
    
  "load")
    if [ -z "$PROFILE" ]; then
      echo "❌ Profile name required"
      echo "Usage: $0 load <profile-name>"
      exit 1
    fi
    
    echo "🔄 Loading MCP profile: $PROFILE"
    
    # Backup existing config
    if [ -f "$MCP_CONFIG" ]; then
      cp "$MCP_CONFIG" "$MCP_CONFIG.backup"
      echo "💾 Existing config backed up"
    fi
    
    # Generate new config
    npx tsx -e "
    import { MCPProfileManager } from './configs/mcp-profiles';
    
    const manager = new MCPProfileManager();
    const config = manager.generateConfigFile('$PROFILE');
    console.log(config);
    " > "$MCP_CONFIG"
    
    echo "✅ MCP profile loaded: $PROFILE"
    echo "🔧 Config saved to: $MCP_CONFIG"
    echo "🔄 Restart Claude Code to apply changes"
    ;;
    
  "status")
    echo "📊 MCP Connection Status:"
    npx tsx -e "
    import { MCPProfileManager } from './configs/mcp-profiles';
    
    const manager = new MCPProfileManager();
    const status = manager.getConnectionStatus();
    
    status.forEach(({server, connected}) => {
      const icon = connected ? '✅' : '❌';
      console.log(\`  \${icon} \${server}\`);
    });
    "
    ;;
    
  "optimize")
    PHASE=${2:-"development"}
    echo "🎯 Optimizing MCP configuration for $PHASE phase"
    
    npx tsx -e "
    import { MCPProfileManager } from './configs/mcp-profiles';
    
    const manager = new MCPProfileManager();
    manager.optimizeForPhase('$PHASE').then(() => {
      console.log('✅ MCP configuration optimized for $PHASE');
    });
    "
    ;;
    
  "restore")
    if [ -f "$MCP_CONFIG.backup" ]; then
      cp "$MCP_CONFIG.backup" "$MCP_CONFIG"
      echo "✅ MCP configuration restored from backup"
    else
      echo "❌ No backup found"
    fi
    ;;
    
  "help"|*)
    cat << EOF
MCP Profile Manager
==================

Usage: $0 <command> [options]

Commands:
  profiles          List available MCP profiles
  load <profile>    Load specific MCP profile
  status            Show current connection status  
  optimize <phase>  Optimize for development phase
  restore           Restore from backup
  help              Show this help message

Available Profiles:
  development       Full development tooling
  production        Minimal production setup
  research          Research and analysis tools
  lightweight       Basic coordination only

Examples:
  $0 profiles
  $0 load development
  $0 optimize testing
  $0 restore
EOF
    ;;
esac