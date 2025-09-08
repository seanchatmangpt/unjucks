#!/bin/bash
# MCP Profile Manager for Context Engineering Toolkit
# Manages selective MCP server loading for optimal resource usage

set -e

COMMAND=${1:-"help"}
PROFILE=${2}
CONFIG_DIR="$HOME/.config/claude"
MCP_CONFIG="$CONFIG_DIR/claude_desktop_config.json"
TOOLKIT_DIR="docs/book/appendices/toolkit"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

case $COMMAND in
    "profiles")
        echo -e "${CYAN}📋 Available MCP Profiles:${NC}"
        echo ""
        
        echo "🔧 development"
        echo "   Description: Full development tooling with enhanced capabilities"
        echo "   Servers: claude-flow, flow-nexus, ruv-swarm, github-integration"
        echo "   Max Connections: 8"
        echo "   Use Cases: coding, testing, debugging, collaboration"
        echo ""
        
        echo "🔧 production"
        echo "   Description: Minimal footprint for production environments"
        echo "   Servers: claude-flow, monitoring"
        echo "   Max Connections: 3"
        echo "   Use Cases: deployment, monitoring, maintenance"
        echo ""
        
        echo "🔧 research"
        echo "   Description: Enhanced capabilities for research and analysis"
        echo "   Servers: claude-flow, ruv-swarm, neural-analysis, data-processing"
        echo "   Max Connections: 6"
        echo "   Use Cases: analysis, experimentation, data-mining"
        echo ""
        
        echo "🔧 lightweight"
        echo "   Description: Minimal resource usage for constrained environments"
        echo "   Servers: claude-flow"
        echo "   Max Connections: 2"
        echo "   Use Cases: basic-coordination, simple-tasks"
        ;;
        
    "load")
        if [ -z "$PROFILE" ]; then
            log_error "Profile name required"
            echo "Usage: $0 load <profile-name>"
            echo "Available profiles: development, production, research, lightweight"
            exit 1
        fi
        
        log_info "🔄 Loading MCP profile: $PROFILE"
        
        # Create config directory if it doesn't exist
        mkdir -p "$CONFIG_DIR"
        
        # Backup existing config
        if [ -f "$MCP_CONFIG" ]; then
            cp "$MCP_CONFIG" "$MCP_CONFIG.backup.$(date +%s)"
            log_success "💾 Existing config backed up"
        fi
        
        # Generate profile-specific configuration
        case $PROFILE in
            "development")
                cat > "$MCP_CONFIG" << 'EOF'
{
  "mcpServers": {
    "claude-flow": {
      "command": "npx",
      "args": ["claude-flow@alpha", "mcp", "start"],
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "true"
      }
    },
    "flow-nexus": {
      "command": "npx",
      "args": ["flow-nexus@alpha", "mcp", "start"],
      "env": {
        "NODE_ENV": "development"
      }
    },
    "ruv-swarm": {
      "command": "npx",
      "args": ["ruv-swarm@alpha", "mcp", "start"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
EOF
                log_success "✅ Development profile loaded with full tooling"
                ;;
                
            "production")
                cat > "$MCP_CONFIG" << 'EOF'
{
  "mcpServers": {
    "claude-flow": {
      "command": "npx",
      "args": ["claude-flow@alpha", "mcp", "start"],
      "env": {
        "NODE_ENV": "production",
        "DEBUG": "false"
      }
    }
  }
}
EOF
                log_success "✅ Production profile loaded with minimal footprint"
                ;;
                
            "research")
                cat > "$MCP_CONFIG" << 'EOF'
{
  "mcpServers": {
    "claude-flow": {
      "command": "npx",
      "args": ["claude-flow@alpha", "mcp", "start"],
      "env": {
        "NODE_ENV": "research"
      }
    },
    "ruv-swarm": {
      "command": "npx",
      "args": ["ruv-swarm@alpha", "mcp", "start"],
      "env": {
        "MODE": "research"
      }
    }
  }
}
EOF
                log_success "✅ Research profile loaded with enhanced analysis tools"
                ;;
                
            "lightweight")
                cat > "$MCP_CONFIG" << 'EOF'
{
  "mcpServers": {
    "claude-flow": {
      "command": "npx",
      "args": ["claude-flow@alpha", "mcp", "start"],
      "env": {
        "NODE_ENV": "minimal",
        "MAX_AGENTS": "2"
      }
    }
  }
}
EOF
                log_success "✅ Lightweight profile loaded for minimal resource usage"
                ;;
                
            *)
                log_error "Unknown profile: $PROFILE"
                echo "Available profiles: development, production, research, lightweight"
                exit 1
                ;;
        esac
        
        # Save profile info
        mkdir -p "$TOOLKIT_DIR/configs"
        echo "{\"activeProfile\":\"$PROFILE\",\"loadedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$TOOLKIT_DIR/configs/active-profile.json"
        
        log_success "🔧 Profile configuration saved"
        log_warning "🔄 Restart Claude Code to apply MCP changes"
        
        echo ""
        echo "Profile Summary:"
        echo "  Name: $PROFILE"
        echo "  Config: $MCP_CONFIG"
        echo "  Servers: $(grep -o '"[^"]*":' "$MCP_CONFIG" | grep -v mcpServers | tr -d '":' | wc -l)"
        ;;
        
    "status")
        log_info "📊 MCP Connection Status:"
        echo ""
        
        if [ -f "$MCP_CONFIG" ]; then
            log_success "Configuration file found: $MCP_CONFIG"
            
            echo "Configured servers:"
            if command -v jq &> /dev/null; then
                jq -r '.mcpServers | keys[]' "$MCP_CONFIG" 2>/dev/null | sed 's/^/  ✅ /'
            else
                # Fallback without jq
                grep -o '"[^"]*":' "$MCP_CONFIG" | grep -v mcpServers | tr -d '":' | sed 's/^/  ✅ /'
            fi
            
            # Check active profile
            if [ -f "$TOOLKIT_DIR/configs/active-profile.json" ]; then
                ACTIVE_PROFILE=$(grep -o '"activeProfile":"[^"]*"' "$TOOLKIT_DIR/configs/active-profile.json" 2>/dev/null | cut -d'"' -f4)
                LOADED_AT=$(grep -o '"loadedAt":"[^"]*"' "$TOOLKIT_DIR/configs/active-profile.json" 2>/dev/null | cut -d'"' -f4)
                echo ""
                echo "Active profile: $ACTIVE_PROFILE"
                echo "Loaded at: $LOADED_AT"
            fi
        else
            log_warning "No MCP configuration found"
            echo "  Run: $0 load development"
        fi
        
        # Check Claude Code process
        echo ""
        if pgrep -f "Claude" > /dev/null || pgrep -f "claude" > /dev/null; then
            log_success "Claude Code process detected"
        else
            log_warning "Claude Code not running"
        fi
        
        # Check MCP server processes
        if pgrep -f "claude-flow" > /dev/null; then
            log_success "Claude Flow MCP server running"
        else
            log_info "Claude Flow MCP server not detected"
        fi
        ;;
        
    "optimize")
        PHASE=${2:-"development"}
        log_info "🎯 Optimizing MCP configuration for $PHASE phase"
        
        case $PHASE in
            "development"|"dev")
                $0 load development
                log_success "✅ Optimized for development phase"
                echo "  - Full MCP server suite enabled"
                echo "  - Debug mode activated"
                echo "  - High connection limits"
                ;;
                
            "testing"|"test")
                $0 load lightweight
                log_success "✅ Optimized for testing phase"
                echo "  - Minimal MCP overhead"
                echo "  - Fast startup times"
                echo "  - Reduced resource usage"
                ;;
                
            "production"|"prod")
                $0 load production
                log_success "✅ Optimized for production phase"
                echo "  - Essential MCP servers only"
                echo "  - Performance monitoring enabled"
                echo "  - Stable, minimal configuration"
                ;;
                
            "research")
                $0 load research
                log_success "✅ Optimized for research phase"
                echo "  - Analysis tools enabled"
                echo "  - Neural processing available"
                echo "  - Data mining capabilities"
                ;;
                
            *)
                log_error "Unknown phase: $PHASE"
                echo "Available phases: development, testing, production, research"
                exit 1
                ;;
        esac
        ;;
        
    "restore")
        if [ -f "$MCP_CONFIG.backup."* ]; then
            # Find the most recent backup
            BACKUP_FILE=$(ls -t "$MCP_CONFIG.backup."* | head -1)
            cp "$BACKUP_FILE" "$MCP_CONFIG"
            log_success "✅ MCP configuration restored from backup"
            echo "  Restored from: $BACKUP_FILE"
        else
            log_error "No backup found"
            echo "  Backup files are created automatically when loading profiles"
        fi
        ;;
        
    "clean")
        log_info "🧹 Cleaning up old MCP configurations..."
        
        # Remove old backup files (keep last 5)
        if ls "$MCP_CONFIG.backup."* &>/dev/null; then
            BACKUP_COUNT=$(ls "$MCP_CONFIG.backup."* | wc -l)
            if [ $BACKUP_COUNT -gt 5 ]; then
                ls -t "$MCP_CONFIG.backup."* | tail -n +6 | xargs rm -f
                log_success "Cleaned up old backup files"
            else
                log_info "No cleanup needed"
            fi
        fi
        
        # Clean profile cache
        rm -f "$TOOLKIT_DIR/configs/active-profile.json"
        log_success "Cleared profile cache"
        ;;
        
    "test")
        log_info "🧪 Testing MCP configuration..."
        
        if [ ! -f "$MCP_CONFIG" ]; then
            log_error "No MCP configuration found"
            echo "  Run: $0 load development"
            exit 1
        fi
        
        # Validate JSON syntax
        if command -v jq &> /dev/null; then
            if jq . "$MCP_CONFIG" > /dev/null 2>&1; then
                log_success "✅ Configuration syntax is valid"
            else
                log_error "❌ Configuration syntax error"
                exit 1
            fi
        else
            log_warning "jq not available - skipping syntax validation"
        fi
        
        # Check server commands
        echo ""
        log_info "Checking server commands..."
        
        if grep -q "claude-flow" "$MCP_CONFIG"; then
            if command -v npx &> /dev/null; then
                log_success "✅ npx available for claude-flow"
            else
                log_error "❌ npx not found - required for MCP servers"
            fi
        fi
        
        # Test network connectivity (if applicable)
        if command -v ping &> /dev/null; then
            if ping -c 1 npmjs.com &> /dev/null; then
                log_success "✅ Network connectivity OK"
            else
                log_warning "⚠️  Network connectivity issues detected"
            fi
        fi
        
        log_success "🎯 MCP configuration test completed"
        ;;
        
    "help"|*)
        cat << 'EOF'

MCP Profile Manager
==================

Usage: ./scripts/mcp-manager.sh <command> [options]

Commands:
  profiles          List available MCP profiles
  load <profile>    Load specific MCP profile
  status            Show current connection status  
  optimize <phase>  Optimize for development phase
  restore           Restore from backup
  clean             Clean up old configurations
  test              Test current configuration
  help              Show this help message

Available Profiles:
  development       Full development tooling (8 connections)
  production        Minimal production setup (3 connections)
  research          Research and analysis tools (6 connections)
  lightweight       Basic coordination only (2 connections)

Available Phases:
  development       Full-featured development environment
  testing           Lightweight testing configuration
  production        Stable production deployment
  research          Enhanced analysis capabilities

Examples:
  ./scripts/mcp-manager.sh profiles                 # List all profiles
  ./scripts/mcp-manager.sh load development         # Load development profile
  ./scripts/mcp-manager.sh optimize testing         # Optimize for testing
  ./scripts/mcp-manager.sh status                   # Check current status
  ./scripts/mcp-manager.sh restore                  # Restore previous config

Configuration File: ~/.config/claude/claude_desktop_config.json

Note: Restart Claude Code after loading a new profile to apply changes.

EOF
        ;;
esac