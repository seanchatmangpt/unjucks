# Appendix A: SPARC Command Reference

## Overview

This appendix provides a comprehensive reference for all SPARC methodology commands and tools used throughout the spec-driven development process.

## Core SPARC Commands

### Specification Phase Commands

#### Requirements Analysis
```bash
# Analyze requirements from multiple sources
npx claude-flow sparc analyze-requirements --sources ./requirements --output ./specs

# Validate specification completeness
npx claude-flow sparc validate-spec --spec ./specs/main.yaml --rules ./validation-rules

# Generate traceability matrix
npx claude-flow sparc trace-requirements --spec ./specs --output ./traceability.md
```

#### Stakeholder Validation
```bash
# Generate validation materials
npx claude-flow sparc generate-validation --spec ./specs --format executive-summary

# Facilitate stakeholder review
npx claude-flow sparc review-session --spec ./specs --stakeholders ./stakeholders.yaml
```

### Pseudocode Phase Commands

#### Algorithm Design
```bash
# Generate pseudocode from specifications
npx claude-flow sparc generate-pseudocode --spec ./specs --output ./pseudocode

# Validate algorithm correctness
npx claude-flow sparc validate-algorithms --pseudocode ./pseudocode --rules ./algorithm-rules

# Optimize algorithms for performance
npx claude-flow sparc optimize-algorithms --pseudocode ./pseudocode --metrics performance
```

### Architecture Phase Commands

#### System Design
```bash
# Design system architecture
npx claude-flow sparc design-architecture --spec ./specs --patterns ./patterns --output ./architecture

# Validate architectural decisions
npx claude-flow sparc validate-architecture --arch ./architecture --quality-attributes ./qa-requirements

# Generate architecture documentation
npx claude-flow sparc document-architecture --arch ./architecture --format c4-diagrams
```

#### Technology Selection
```bash
# Analyze technology options
npx claude-flow sparc analyze-tech-stack --requirements ./specs --constraints ./constraints

# Generate technology recommendation report
npx claude-flow sparc recommend-tech --analysis ./tech-analysis --output ./tech-recommendations.md
```

### Refinement Phase Commands

#### Test-Driven Development
```bash
# Generate test cases from specifications
npx claude-flow sparc generate-tests --spec ./specs --test-types unit,integration,e2e

# Implement features using TDD
npx claude-flow sparc tdd-implement --tests ./tests --arch ./architecture --output ./src

# Run TDD cycles with AI assistance
npx claude-flow sparc tdd-cycle --feature user-authentication --iterations 5
```

#### Code Quality Assurance
```bash
# Analyze code quality
npx claude-flow sparc analyze-quality --src ./src --metrics complexity,maintainability,coverage

# Refactor code with AI suggestions
npx claude-flow sparc refactor --src ./src --rules ./refactoring-rules --output ./refactored

# Generate quality report
npx claude-flow sparc quality-report --src ./src --output ./quality-report.html
```

### Completion Phase Commands

#### Integration and Deployment
```bash
# Validate system integration
npx claude-flow sparc validate-integration --system ./dist --tests ./integration-tests

# Generate deployment pipeline
npx claude-flow sparc generate-pipeline --arch ./architecture --env production --output ./.github/workflows

# Setup monitoring and observability
npx claude-flow sparc setup-monitoring --system ./dist --metrics ./monitoring-config
```

## Multi-Agent Workflow Commands

### Swarm Management
```bash
# Initialize development swarm
npx claude-flow swarm init --topology mesh --max-agents 8 --project unjucks-v2

# Spawn specialized agents
npx claude-flow agent spawn --type researcher --capabilities requirements-analysis
npx claude-flow agent spawn --type coder --capabilities typescript,testing
npx claude-flow agent spawn --type reviewer --capabilities code-quality,security

# Orchestrate complex tasks
npx claude-flow task orchestrate --task "Implement template processing pipeline" --strategy adaptive
```

### Agent Coordination
```bash
# Monitor swarm status
npx claude-flow swarm status --detailed

# Scale swarm based on workload
npx claude-flow swarm scale --target-agents 12 --reason increased-complexity

# Coordinate agent handoffs
npx claude-flow coordinate handoff --from-phase specification --to-phase pseudocode
```

## Utility Commands

### Project Management
```bash
# Initialize SPARC project
npx claude-flow sparc init --project-name unjucks-v2 --methodology sparc

# Generate project status report
npx claude-flow sparc status --project ./unjucks-v2 --format dashboard

# Export project artifacts
npx claude-flow sparc export --project ./unjucks-v2 --format zip --output ./project-export.zip
```

### Configuration Management
```bash
# Configure SPARC settings
npx claude-flow sparc config --set ai-provider=claude --set quality-threshold=0.9

# List available configurations
npx claude-flow sparc config --list

# Reset to default settings
npx claude-flow sparc config --reset
```

### Template and Generator Commands

```bash
# List available templates
unjucks list

# Show template help
unjucks help component react

# Generate from template
unjucks generate component react --name UserProfile --with-tests --dest ./src/components

# Generate with dry run
unjucks generate api-service --name UserService --dry-run

# Force generation (overwrite existing)
unjucks generate component --name Dashboard --force
```

## Environment Variables

### AI Service Configuration
```bash
# Claude AI configuration
export CLAUDE_API_KEY=your-claude-api-key
export CLAUDE_MODEL=claude-3-sonnet

# OpenAI configuration (alternative)
export OPENAI_API_KEY=your-openai-api-key
export OPENAI_MODEL=gpt-4

# AI service timeout and retry settings
export AI_REQUEST_TIMEOUT=30000
export AI_MAX_RETRIES=3
```

### Project Settings
```bash
# Project configuration
export SPARC_PROJECT_ROOT=./unjucks-v2
export SPARC_CONFIG_FILE=./sparc.config.js

# Quality thresholds
export SPARC_QUALITY_THRESHOLD=0.9
export SPARC_COVERAGE_THRESHOLD=0.95

# Agent coordination settings
export SPARC_MAX_AGENTS=10
export SPARC_COORDINATION_TIMEOUT=120000
```

## Configuration Files

### sparc.config.js
```javascript
module.exports = {
  phases: {
    specification: {
      validators: ['completeness', 'consistency', 'testability'],
      outputFormat: 'yaml',
      stakeholderValidation: true
    },
    pseudocode: {
      optimizationLevel: 'performance',
      validationRules: './validation/algorithm-rules.js'
    },
    architecture: {
      patterns: ['clean-architecture', 'dependency-injection'],
      qualityAttributes: ['scalability', 'maintainability', 'performance']
    },
    refinement: {
      testFramework: 'jest',
      codeStyle: 'airbnb',
      coverageThreshold: 0.95
    },
    completion: {
      deploymentTargets: ['npm', 'github-packages'],
      monitoringEnabled: true
    }
  },
  
  agents: {
    maxConcurrent: 8,
    coordinationPattern: 'mesh',
    communicationTimeout: 30000
  },
  
  ai: {
    provider: 'claude',
    model: 'claude-3-sonnet',
    temperature: 0.7,
    maxTokens: 4000
  }
};
```

### .sparc.yml
```yaml
project:
  name: unjucks-v2
  version: 2.0.0
  methodology: sparc
  
phases:
  current: refinement
  completed:
    - specification
    - pseudocode
    - architecture
  
agents:
  active:
    - id: agent-001
      type: coder
      status: active
      assigned_tasks: ['template-processor', 'cli-interface']
    - id: agent-002
      type: tester
      status: active  
      assigned_tasks: ['unit-tests', 'integration-tests']
      
metrics:
  quality_score: 0.94
  coverage: 0.96
  completion: 0.78
```

## Error Codes and Troubleshooting

### Common Error Codes

- **SPARC_001**: Invalid specification format
- **SPARC_002**: Missing required configuration
- **SPARC_003**: Agent coordination timeout
- **SPARC_004**: Quality threshold not met
- **SPARC_005**: Deployment validation failed

### Troubleshooting Commands

```bash
# Diagnose project issues
npx claude-flow sparc diagnose --project ./unjucks-v2

# Repair corrupted project state
npx claude-flow sparc repair --issue SPARC_003 --auto-fix

# Validate environment setup
npx claude-flow sparc validate-env

# Generate debug report
npx claude-flow sparc debug-report --output ./debug-report.json
```

## Integration Examples

### CI/CD Integration

```yaml
# .github/workflows/sparc-workflow.yml
name: SPARC Development Workflow

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  sparc-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install SPARC CLI
        run: npm install -g claude-flow
        
      - name: Validate SPARC project
        run: npx claude-flow sparc validate --project . --strict
        
      - name: Run quality checks
        run: npx claude-flow sparc quality-check --threshold 0.9
        
      - name: Generate status report
        run: npx claude-flow sparc status --format github-summary >> $GITHUB_STEP_SUMMARY
```

This comprehensive command reference provides all the tools needed to implement spec-driven development using the SPARC methodology with AI assistance.