#!/bin/bash
# Development Phase Primer for Context Engineering Toolkit
# Optimizes AI swarm configuration for specific development phases

set -e

PHASE=${1:-"discovery"}
PROJECT_ROOT=$(pwd)
SWARM_ID="dev-phase-$(date +%s)"
TOOLKIT_DIR="docs/book/appendices/toolkit"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_phase() { echo -e "${PURPLE}🎯 $1${NC}"; }

echo -e "${CYAN}🚀 Development Phase Primer${NC}"
echo -e "${CYAN}===========================${NC}"

case $PHASE in
    "discovery")
        log_phase "📋 Initializing Discovery Phase"
        
        # Create discovery context directory
        mkdir -p "$TOOLKIT_DIR/contexts/discovery"
        
        log_info "Setting up hierarchical swarm topology (3 agents max)"
        log_info "Focus: Analysis, documentation, architecture review"
        
        # Create discovery context configuration
        cat > "$TOOLKIT_DIR/contexts/discovery/config.json" << EOF
{
  "phase": "discovery",
  "swarmId": "$SWARM_ID",
  "topology": "hierarchical",
  "maxAgents": 3,
  "agentTypes": ["researcher", "code-analyzer", "system-architect"],
  "objectives": [
    "Analyze existing codebase structure",
    "Identify key patterns and architectures",
    "Document critical dependencies",
    "Map integration points"
  ],
  "constraints": [
    "Focus on high-impact areas only",
    "Prioritize maintainability concerns",
    "Document security considerations",
    "Keep findings actionable"
  ],
  "successCriteria": [
    "Clear architectural overview",
    "Identified optimization opportunities",
    "Security audit summary",
    "Integration complexity map"
  ],
  "contextSettings": {
    "maxTokensPerAgent": 12000,
    "batchingStrategy": "sequential",
    "memoryPattern": "persistent"
  }
}
EOF

        # Create discovery context primer
        cat > "$TOOLKIT_DIR/contexts/discovery/context.md" << 'EOF'
# Discovery Phase Context

## Objectives
- Analyze existing codebase structure and identify architectural patterns
- Map critical dependencies and integration points  
- Document security considerations and potential vulnerabilities
- Identify optimization opportunities and technical debt

## Agent Coordination Strategy
- **Hierarchical topology**: Senior researcher coordinates analysis efforts
- **Sequential processing**: Methodical examination of codebase sections
- **Persistent memory**: Maintain findings across analysis sessions

## Focus Areas
1. **Architecture Analysis**: Core patterns, design decisions, modularity
2. **Dependency Mapping**: Internal/external dependencies, version compatibility
3. **Security Review**: Authentication, authorization, data handling
4. **Performance Assessment**: Bottlenecks, resource usage, scalability

## Constraints
- Focus on high-impact areas that affect maintainability
- Document findings in actionable format
- Prioritize security and performance concerns
- Maintain context efficiency (<70% usage per agent)

## Success Criteria
- Comprehensive architectural overview document
- Prioritized list of optimization opportunities
- Security risk assessment with mitigation strategies
- Integration complexity analysis with recommendations

## Coordination Protocol
```bash
# Before analysis
npx claude-flow@alpha hooks pre-task --description "discovery-analysis"

# During analysis  
npx claude-flow@alpha hooks post-edit --file "<analyzed-file>" --memory-key "discovery/findings/<section>"

# After analysis
npx claude-flow@alpha hooks post-task --task-id "discovery-complete"
```
EOF

        log_success "Discovery phase context created"
        log_info "🆔 Swarm ID: $SWARM_ID"
        log_info "📁 Context files: $TOOLKIT_DIR/contexts/discovery/"
        
        echo ""
        echo "Next steps for Discovery Phase:"
        echo "1. Review context configuration: cat $TOOLKIT_DIR/contexts/discovery/context.md"
        echo "2. Load appropriate MCP profile: ./scripts/mcp-manager.sh load research"  
        echo "3. Start performance monitoring: ./scripts/context-toolkit-cli.sh monitor"
        echo "4. Begin coordinated analysis with context-aware agents"
        ;;

    "implementation")
        log_phase "⚡ Initializing Implementation Phase"
        
        mkdir -p "$TOOLKIT_DIR/contexts/implementation"
        
        log_info "Setting up mesh swarm topology (6 agents max)"
        log_info "Focus: High-throughput parallel development with continuous integration"
        
        # Create implementation context configuration
        cat > "$TOOLKIT_DIR/contexts/implementation/config.json" << EOF
{
  "phase": "implementation", 
  "swarmId": "$SWARM_ID",
  "topology": "mesh",
  "maxAgents": 6,
  "agentTypes": ["coder", "tester", "reviewer", "backend-dev", "cicd-engineer", "performance-analyst"],
  "executionStrategy": [
    "Parallel development streams",
    "Continuous integration ready",
    "Test-driven development",
    "Performance-first mindset"
  ],
  "qualityGates": [
    "All changes must include tests",
    "Code coverage minimum 80%", 
    "Performance benchmarks required",
    "Security checks automated"
  ],
  "coordinationProtocol": [
    "Daily sync via memory store",
    "Conflict resolution via consensus", 
    "Progress tracking via metrics",
    "Knowledge sharing mandatory"
  ],
  "contextSettings": {
    "maxTokensPerAgent": 15000,
    "batchingStrategy": "parallel",
    "memoryPattern": "selective"
  }
}
EOF

        # Create implementation context primer
        cat > "$TOOLKIT_DIR/contexts/implementation/context.md" << 'EOF'
# Implementation Phase Context

## Execution Strategy
- **Parallel development streams**: Multiple features developed concurrently
- **Continuous integration ready**: All code changes integrate automatically
- **Test-driven development**: Tests written before implementation
- **Performance-first mindset**: Optimization considered during development

## Agent Coordination Strategy
- **Mesh topology**: Direct communication between all agents
- **Parallel processing**: Maximum throughput with coordinated execution
- **Selective memory**: Store only critical coordination state
- **Real-time sync**: Immediate updates on code changes and conflicts

## Quality Gates (All Must Pass)
1. **Code Coverage**: Minimum 80% test coverage for all new code
2. **Performance Benchmarks**: No regression in key performance metrics  
3. **Security Validation**: Automated security scanning passes
4. **Integration Tests**: Full integration test suite passes
5. **Code Review**: At least one peer review approval required

## Coordination Protocol
```bash
# Team synchronization (daily)
npx claude-flow@alpha hooks session-restore --session-id "$SWARM_ID"

# During development (per feature)
npx claude-flow@alpha hooks pre-task --description "implement-feature-X"
npx claude-flow@alpha hooks post-edit --file "<modified-file>" --memory-key "implementation/features/<feature-name>"
npx claude-flow@alpha hooks notify --message "Feature X implementation complete" 

# End of sprint
npx claude-flow@alpha hooks session-end --export-metrics true
```

## Memory Organization
- `implementation/features/<name>`: Feature implementation state
- `implementation/tests/<name>`: Test coverage and results
- `implementation/reviews/<name>`: Code review feedback and approvals
- `implementation/performance/<name>`: Performance benchmark results
- `implementation/integration/<name>`: Integration status and dependencies

## Success Metrics  
- Feature delivery velocity: >2 features per sprint
- Code quality score: >8.5/10
- Test coverage: >80% across all modules
- Performance regression: 0 critical issues
- Integration failures: <5% of builds

## Conflict Resolution
- **Merge conflicts**: Automatic resolution via consensus algorithm
- **Design disagreements**: Architecture review board (senior agents)
- **Performance trade-offs**: Data-driven decision using benchmarks
- **Testing disputes**: Comprehensive test coverage wins
EOF

        log_success "Implementation phase context created"
        log_info "🆔 Swarm ID: $SWARM_ID"
        log_info "📁 Context files: $TOOLKIT_DIR/contexts/implementation/"
        
        echo ""
        echo "Next steps for Implementation Phase:"
        echo "1. Load development MCP profile: ./scripts/mcp-manager.sh load development"
        echo "2. Start performance monitoring: ./scripts/context-toolkit-cli.sh monitor 3001"
        echo "3. Create context bundle: ./scripts/context-toolkit-cli.sh bundle create implementation"
        echo "4. Begin parallel development with mesh coordination"
        ;;

    "optimization")
        log_phase "🎯 Initializing Optimization Phase"
        
        mkdir -p "$TOOLKIT_DIR/contexts/optimization"
        
        log_info "Setting up star swarm topology (4 agents max)"
        log_info "Focus: Performance tuning and context efficiency improvements"
        
        # Create optimization context configuration  
        cat > "$TOOLKIT_DIR/contexts/optimization/config.json" << EOF
{
  "phase": "optimization",
  "swarmId": "$SWARM_ID", 
  "topology": "star",
  "maxAgents": 4,
  "agentTypes": ["performance-coordinator", "context-optimizer", "benchmark-analyst", "memory-manager"],
  "performanceTargets": {
    "contextWindowEfficiency": ">70%",
    "agentCoordinationLatency": "<2s", 
    "memoryUsageReduction": "40%",
    "tokenEfficiencyImprovement": "30%"
  },
  "measurementStrategy": [
    "Baseline metrics collection",
    "A/B testing implementation", 
    "Performance regression detection",
    "Real-time monitoring setup"
  ],
  "optimizationAreas": [
    "Context management algorithms",
    "Agent communication protocols",
    "Memory access patterns", 
    "Token utilization strategies"
  ],
  "contextSettings": {
    "maxTokensPerAgent": 10000,
    "batchingStrategy": "sequential",
    "memoryPattern": "ephemeral"
  }
}
EOF

        # Create optimization context primer
        cat > "$TOOLKIT_DIR/contexts/optimization/context.md" << 'EOF'
# Optimization Phase Context

## Performance Targets (Must Achieve)
- **Context Window Efficiency**: >70% (currently measured via context-analyzer)
- **Agent Coordination Latency**: <2s average response time  
- **Memory Usage Reduction**: 40% reduction in memory overhead
- **Token Efficiency Improvement**: 30% better token utilization

## Agent Coordination Strategy  
- **Star topology**: Central coordinator manages optimization efforts
- **Sequential processing**: Methodical optimization of each component
- **Ephemeral memory**: Minimal memory footprint during optimization
- **Metrics-driven**: All decisions backed by performance data

## Measurement Strategy
1. **Baseline Collection**: Capture current performance metrics across all dimensions
2. **A/B Testing**: Compare optimized vs original implementations  
3. **Regression Detection**: Automated alerts for performance degradation
4. **Real-time Monitoring**: Continuous tracking of optimization impact

## Optimization Areas (Priority Order)
1. **Context Management**: 
   - Implement smart context pruning algorithms
   - Add context compression for large conversations
   - Optimize context window utilization patterns

2. **Agent Communication**:
   - Reduce coordination overhead in mesh topologies
   - Implement efficient message passing protocols
   - Add intelligent conflict resolution mechanisms

3. **Memory Access Patterns**:
   - Optimize memory store access patterns
   - Implement smart caching strategies  
   - Reduce memory fragmentation

4. **Token Utilization**:
   - Implement token-aware prompt optimization
   - Add smart batching for token efficiency
   - Optimize agent template token usage

## Coordination Protocol
```bash
# Baseline measurement
npx claude-flow@alpha hooks pre-task --description "collect-baseline-metrics"
./scripts/context-toolkit-cli.sh benchmark > baselines/pre-optimization.json

# During optimization
npx claude-flow@alpha hooks pre-task --description "optimize-<component>"
./scripts/context-toolkit-cli.sh analyze optimization.log
npx claude-flow@alpha hooks post-edit --memory-key "optimization/<component>"

# Performance validation
./scripts/context-toolkit-cli.sh benchmark > results/post-<component>.json
npx claude-flow@alpha hooks post-task --task-id "optimization-<component>"
```

## Success Criteria
- All performance targets achieved and sustained over 7 days
- No regression in existing functionality
- Optimization changes documented and reproducible
- Performance improvements validated through A/B testing

## Risk Mitigation
- **Performance Regression**: Automated rollback triggers
- **Functionality Breaking**: Comprehensive test suite validation
- **Over-optimization**: Regular reality checks against business requirements  
- **Context Loss**: Backup and restore mechanisms for critical state
EOF

        log_success "Optimization phase context created"
        log_info "🆔 Swarm ID: $SWARM_ID"
        log_info "📁 Context files: $TOOLKIT_DIR/contexts/optimization/"
        
        echo ""
        echo "Next steps for Optimization Phase:"
        echo "1. Run baseline benchmark: ./scripts/context-toolkit-cli.sh benchmark"
        echo "2. Load lightweight profile: ./scripts/mcp-manager.sh load lightweight"
        echo "3. Start monitoring: ./scripts/context-toolkit-cli.sh monitor 3002" 
        echo "4. Begin systematic optimization with performance validation"
        ;;

    "maintenance")
        log_phase "🔧 Initializing Maintenance Phase"
        
        mkdir -p "$TOOLKIT_DIR/contexts/maintenance"
        
        log_info "Setting up ring swarm topology (3 agents max)"
        log_info "Focus: System health, monitoring, and incremental improvements"
        
        # Create maintenance context configuration
        cat > "$TOOLKIT_DIR/contexts/maintenance/config.json" << EOF
{
  "phase": "maintenance",
  "swarmId": "$SWARM_ID",
  "topology": "ring", 
  "maxAgents": 3,
  "agentTypes": ["health-monitor", "maintenance-coordinator", "system-updater"],
  "maintenanceAreas": [
    "System health monitoring",
    "Performance trend analysis", 
    "Security patch management",
    "Dependency updates",
    "Documentation updates"
  ],
  "scheduleStrategy": [
    "Weekly performance reviews",
    "Monthly security updates",
    "Quarterly dependency audits", 
    "Continuous health monitoring"
  ],
  "contextSettings": {
    "maxTokensPerAgent": 8000,
    "batchingStrategy": "sequential", 
    "memoryPattern": "persistent"
  }
}
EOF

        # Create maintenance context primer
        cat > "$TOOLKIT_DIR/contexts/maintenance/context.md" << 'EOF'
# Maintenance Phase Context

## Maintenance Schedule
- **Daily**: System health checks and performance monitoring
- **Weekly**: Performance trend analysis and minor optimizations  
- **Monthly**: Security patches and vulnerability assessments
- **Quarterly**: Major dependency updates and architecture reviews

## Agent Coordination Strategy
- **Ring topology**: Sequential processing of maintenance tasks
- **Sequential execution**: Ensure system stability during maintenance
- **Persistent memory**: Track maintenance history and patterns
- **Automated scheduling**: Proactive maintenance based on metrics

## Health Monitoring Areas
1. **Performance Metrics**: Context usage, response times, throughput
2. **Error Rates**: Agent failures, coordination issues, timeout events  
3. **Resource Usage**: Memory consumption, disk space, network activity
4. **Security Status**: Vulnerability scans, dependency audit results

## Maintenance Protocols
```bash
# Daily health check
npx claude-flow@alpha hooks pre-task --description "daily-health-check"
./scripts/context-toolkit-cli.sh status > health-reports/daily-$(date +%Y%m%d).txt

# Weekly performance review  
./scripts/context-toolkit-cli.sh benchmark > performance-reports/weekly-$(date +%Y%W).json

# Monthly security update
npx claude-flow@alpha hooks pre-task --description "security-maintenance"
# Run security scans and update dependencies
npx claude-flow@alpha hooks post-task --task-id "security-update-$(date +%Y%m)"
```

## Success Criteria
- System uptime >99.5%
- Performance regression <5% month-over-month
- Security vulnerabilities patched within 7 days
- Documentation accuracy >95%
EOF

        log_success "Maintenance phase context created"
        log_info "🆔 Swarm ID: $SWARM_ID"
        ;;

    *)
        log_error "Unknown phase: $PHASE"
        echo ""
        echo "Available development phases:"
        echo "  discovery      - Analyze codebase and architecture (hierarchical, 3 agents)"
        echo "  implementation - High-throughput parallel development (mesh, 6 agents)" 
        echo "  optimization   - Performance tuning and efficiency (star, 4 agents)"
        echo "  maintenance    - System health and monitoring (ring, 3 agents)"
        echo ""
        echo "Usage: $0 <phase>"
        echo "Example: $0 discovery"
        exit 1
        ;;
esac

# Create phase monitoring script
cat > "$TOOLKIT_DIR/contexts/$PHASE/monitor.sh" << EOF
#!/bin/bash
# Phase-specific monitoring script for $PHASE

echo "📊 $PHASE Phase Monitoring"
echo "========================="
echo ""

# Display phase configuration
echo "Configuration:"
if [ -f "$TOOLKIT_DIR/contexts/$PHASE/config.json" ]; then
    grep -E "(phase|topology|maxAgents)" "$TOOLKIT_DIR/contexts/$PHASE/config.json" | sed 's/^/  /'
fi
echo ""

# Show active processes related to this phase
echo "Active Processes:"
ps aux | grep -E "(claude|node|tsx)" | head -5 | sed 's/^/  /'
echo ""

# Monitor performance
echo "Performance Status:"
./scripts/context-toolkit-cli.sh status | grep -A 5 "Performance Status" | sed 's/^/  /'
echo ""

# Show recent logs  
echo "Recent Activity:"
if [ -f ".swarm/memory.db" ]; then
    echo "  Memory store: Active"
else
    echo "  Memory store: Not initialized"
fi
echo ""

echo "Monitor Updates: $(date)"
EOF

chmod +x "$TOOLKIT_DIR/contexts/$PHASE/monitor.sh"

log_success "Phase monitoring script created"
log_info "📊 Monitor progress: $TOOLKIT_DIR/contexts/$PHASE/monitor.sh"
echo ""
echo "🎯 Phase: $PHASE | Swarm ID: $SWARM_ID"
log_success "Development phase priming complete!"