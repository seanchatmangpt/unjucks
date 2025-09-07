# Comprehensive Swarm Command Guide

The enhanced `unjucks swarm` command provides complete access to ALL MCP swarm-related capabilities, offering a unified interface for:

- 🏗️ **Swarm Management** - Initialize, scale, and destroy swarms
- 🤖 **Agent Orchestration** - Spawn, train, and coordinate specialized agents  
- 🧠 **Neural Networks** - Train patterns, run predictions, optimize models
- 🔗 **DAA Systems** - Decentralized autonomous agents with self-learning
- 💾 **Memory Coordination** - Persistent storage and cross-session sync
- 📋 **Workflow Management** - Complex multi-agent task orchestration
- 📊 **Performance Analytics** - Benchmarking and optimization insights

## Command Structure

```bash
unjucks swarm <subcommand> [options]
```

## 🏗️ Core Swarm Management

### Initialize Swarm
```bash
# Basic mesh topology with 5 agents
unjucks swarm init --topology mesh --agents 5

# Advanced hierarchical swarm with auto-scaling
unjucks swarm init \
  --topology hierarchical \
  --agents 10 \
  --strategy adaptive \
  --memory \
  --hooks \
  --auto-scale \
  --persistence

# Load from configuration file
unjucks swarm init --config ./swarm-config.yaml
```

### Spawn Specialized Agents
```bash
# Backend development agent
unjucks swarm spawn \
  --type backend-dev \
  --name "APIBuilder" \
  --capabilities "api,database,auth,security" \
  --domain "backend" \
  --memory 1024 \
  --persistent

# ML developer with custom capabilities
unjucks swarm spawn \
  --type ml-developer \
  --capabilities "pytorch,tensorflow,data-science" \
  --domain "ml"

# Research agent with specific expertise
unjucks swarm spawn \
  --type researcher \
  --name "TechScout" \
  --capabilities "analysis,documentation,requirements"
```

### Monitor Swarm Status
```bash
# Basic status overview
unjucks swarm status

# Detailed status with performance metrics
unjucks swarm status --detailed --agents --tasks --performance

# Real-time monitoring (updates every 5 seconds)
unjucks swarm status --watch --interval 5

# JSON output for automation
unjucks swarm status --json
```

### Orchestrate Tasks
```bash
# Simple task orchestration
unjucks swarm orchestrate \
  --task "Build REST API with authentication" \
  --strategy adaptive \
  --priority high \
  --max-agents 3

# Complex workflow execution
unjucks swarm orchestrate \
  --workflow ./workflows/full-stack-app.yaml \
  --async \
  --priority critical
```

### Scale Swarm
```bash
# Scale to 20 agents
unjucks swarm scale --target 20

# Enable auto-scaling with balanced strategy
unjucks swarm scale --target 15 --auto --strategy balanced
```

### Train Neural Patterns
```bash
# Train coordination patterns
unjucks swarm train --pattern coordination --epochs 100

# Train with custom data
unjucks swarm train \
  --pattern optimization \
  --epochs 50 \
  --data "./training-data.json"
```

## 🧠 Neural Network Management

### Train Neural Patterns
```bash
# Train coordination patterns with 50 epochs
unjucks swarm neural --action train --pattern coordination --epochs 50

# Train optimization patterns with custom data
unjucks swarm neural \
  --action train \
  --pattern optimization \
  --epochs 100 \
  --data "./optimization-data.json"

# Train prediction patterns
unjucks swarm neural --action train --pattern prediction --epochs 75
```

### Run Neural Predictions
```bash
# Make predictions with a trained model
unjucks swarm neural \
  --action predict \
  --model "model-coordination-001" \
  --input '{"task":"optimize","agents":5,"complexity":"high"}'

# Predict with divergent thinking pattern
unjucks swarm neural \
  --action predict \
  --model "model-divergent-002" \
  --input '{"problem":"creative_solution","domain":"ui_design"}'
```

### Neural Network Status and Analysis
```bash
# Check neural network status
unjucks swarm neural --action status

# Detailed neural status with system info
unjucks swarm neural --action status --detailed

# List available cognitive patterns
unjucks swarm neural --action patterns

# Explain model architecture
unjucks swarm neural --action explain --model "model-coordination-001"

# Compress model for production
unjucks swarm neural \
  --action compress \
  --model "model-optimization-002" \
  --compress 0.7
```

## 🤖 DAA (Decentralized Autonomous Agents)

### Initialize DAA Service
```bash
# Initialize DAA with full capabilities
unjucks swarm daa --action init --coordination --learning

# Initialize with custom persistence
unjucks swarm daa \
  --action init \
  --coordination \
  --learning \
  --persistence disk
```

### Create Autonomous Agents
```bash
# Create autonomous agent with adaptive pattern
unjucks swarm daa \
  --action create \
  --id "agent-adaptive-001" \
  --type autonomous \
  --pattern adaptive \
  --capabilities "learning,adaptation,decision-making"

# Create cognitive agent with multiple capabilities
unjucks swarm daa \
  --action create \
  --id "agent-cognitive-002" \
  --type cognitive \
  --pattern convergent \
  --capabilities "analysis,pattern-recognition,optimization"
```

### Agent Adaptation and Learning
```bash
# Adapt agent based on performance feedback
unjucks swarm daa \
  --action adapt \
  --id "agent-001" \
  --feedback "Improve task completion speed" \
  --score 0.85

# Check learning progress
unjucks swarm daa --action learn

# Detailed learning status
unjucks swarm daa --action learn --detailed
```

### Knowledge Sharing Between Agents
```bash
# Share knowledge between agents
unjucks swarm daa \
  --action share \
  --id "agent-001" \
  --targets "agent-002,agent-003" \
  --knowledge "optimization-patterns"

# Share across domains
unjucks swarm daa \
  --action share \
  --id "agent-cognitive-001" \
  --targets "agent-adaptive-002" \
  --knowledge "problem-solving"
```

### Agent Consensus Building
```bash
# Build consensus on decisions
unjucks swarm daa --action consensus

# Check DAA system status
unjucks swarm daa --action status

# Detailed DAA status with performance metrics
unjucks swarm daa --action status --detailed
```

## 💾 Memory Coordination

### Store and Retrieve Data
```bash
# Store configuration data
unjucks swarm memory \
  --action store \
  --key "app-config" \
  --value '{"theme":"dark","agents":10,"features":["auth","api"]}' \
  --namespace "production"

# Retrieve stored data
unjucks swarm memory \
  --action retrieve \
  --key "app-config" \
  --namespace "production"

# Store with TTL (time to live)
unjucks swarm memory \
  --action store \
  --key "temp-session" \
  --value '{"user":"admin","session":"abc123"}' \
  --ttl 3600
```

### Memory Management
```bash
# List all memory keys
unjucks swarm memory --action list --namespace "production"

# Search memory by pattern
unjucks swarm memory --action search --pattern "config"

# List all namespaces
unjucks swarm memory --action list
```

### Backup and Restore
```bash
# Create memory backup
unjucks swarm memory \
  --action backup \
  --namespace "production" \
  --backup "./memory-backup.json"

# Restore from backup
unjucks swarm memory \
  --action restore \
  --backup "./memory-backup.json" \
  --namespace "production"
```

## 📋 Workflow Management

### Create Workflows
```bash
# Create simple workflow
unjucks swarm workflow \
  --action create \
  --name "API Development" \
  --priority high

# Create complex workflow with custom steps
unjucks swarm workflow \
  --action create \
  --name "Full Stack App" \
  --steps '[
    {"action":"generate","description":"Setup project structure"},
    {"action":"validate","description":"Check dependencies"},
    {"action":"test","description":"Run test suite"}
  ]'
```

### Execute Workflows
```bash
# Execute workflow by ID
unjucks swarm workflow \
  --action execute \
  --id "workflow-123" \
  --data '{"project":"my-app","framework":"express"}'

# Asynchronous execution
unjucks swarm workflow \
  --action execute \
  --id "workflow-456" \
  --async \
  --data '{"environment":"production"}'
```

### Workflow Management
```bash
# List all workflows
unjucks swarm workflow --action list

# Check workflow status
unjucks swarm workflow --action status --id "workflow-123"

# List available templates
unjucks swarm workflow --action template

# Validate workflow definition
unjucks swarm workflow \
  --action validate \
  --file "./my-workflow.json"
```

## 📊 Performance Benchmarking

### Run Benchmarks
```bash
# Run all benchmarks
unjucks swarm benchmark

# Specific benchmark types
unjucks swarm benchmark --type wasm --iterations 20
unjucks swarm benchmark --type swarm --agents 10 --duration 60
unjucks swarm benchmark --type neural --iterations 15

# Save results to file
unjucks swarm benchmark \
  --type all \
  --output "./benchmark-results.json" \
  --format json
```

### Benchmark Analysis
```bash
# Compare with previous results
unjucks swarm benchmark \
  --type swarm \
  --compare "./previous-benchmark.json"

# Memory-specific benchmarks
unjucks swarm benchmark --type memory --iterations 50

# Agent performance benchmarks
unjucks swarm benchmark --type agent --agents 8 --duration 45
```

## 🔧 Advanced Usage Patterns

### Combined Operations
```bash
# Initialize, spawn agents, and start workflow
unjucks swarm init --topology mesh --agents 5
unjucks swarm spawn --type backend-dev --capabilities "api,auth"
unjucks swarm spawn --type frontend-dev --capabilities "react,ui"
unjucks swarm workflow --action execute --name "full-stack-setup"

# Neural training pipeline
unjucks swarm neural --action train --pattern coordination --epochs 50
unjucks swarm neural --action train --pattern optimization --epochs 75
unjucks swarm benchmark --type neural --iterations 10
```

### Production Monitoring
```bash
# Real-time monitoring with all details
unjucks swarm status --watch --detailed --agents --tasks --performance

# Memory usage monitoring
unjucks swarm memory --action list --format json | jq '.keys | length'

# Workflow status monitoring
unjucks swarm workflow --action list --format json
```

### Cleanup and Maintenance
```bash
# Graceful shutdown with cleanup
unjucks swarm destroy --force --cleanup

# Memory cleanup
unjucks swarm memory --action backup --backup "./final-backup.json"
unjucks swarm memory --action list | grep "temp-" # Check temp keys
```

## 🎯 Integration with Existing Commands

The swarm command integrates seamlessly with other Unjucks commands:

```bash
# Generate templates using swarm agents
unjucks generate api express UserService --swarm-agent backend-dev

# List generators with swarm analysis
unjucks list --detailed --swarm-insights

# Inject code with swarm optimization
unjucks inject --file app.js --content "new code" --swarm-optimize
```

## 📊 Performance Metrics

The enhanced swarm command provides comprehensive metrics:

- **Agent Performance**: Task completion rates, learning efficiency, adaptation speed
- **Memory Usage**: Cache hit rates, serialization times, compression ratios  
- **Neural Networks**: Accuracy, inference time, training speed, convergence
- **System Resources**: CPU usage, memory consumption, I/O operations
- **Swarm Coordination**: Consensus time, scaling efficiency, coordination overhead

## 🚀 Best Practices

1. **Start Small**: Begin with basic topologies and scale up
2. **Monitor Actively**: Use real-time monitoring for production systems
3. **Train Regularly**: Keep neural patterns updated with fresh data
4. **Backup Memory**: Regular backups prevent data loss
5. **Benchmark Often**: Track performance changes over time
6. **Use DAA Wisely**: Autonomous agents work best for repetitive tasks
7. **Optimize Workflows**: Validate and refine workflow definitions

## 🔗 MCP Integration

This command exposes ALL available MCP swarm capabilities through these tool categories:

- **ruv-swarm**: Core swarm initialization and agent spawning
- **flow-nexus**: Advanced workflows, neural networks, and DAA systems
- **claude-flow**: Memory coordination, performance analytics, and monitoring

The unified interface provides seamless access to distributed computing, AI coordination, and autonomous agent management - all through a single, comprehensive command.