# API Reference

> *"A comprehensive reference for all Unjucks 2026 APIs, command-line interfaces, configuration options, and integration points."*

## Core CLI Commands

### Generation Commands

#### `unjucks generate`
Generate code from templates with semantic understanding.

```bash
unjucks generate <template> [target] [options]
```

**Arguments:**
- `template` - Template name or path to generator
- `target` - Output directory (optional, defaults to current directory)

**Options:**
```bash
--dry-run, -d          # Preview generation without writing files
--force, -f            # Overwrite existing files without prompting
--interactive, -i      # Interactive mode for variable input
--config, -c <path>    # Path to configuration file
--context <context>    # Additional context for generation
--agents <agents>      # Specify which AI agents to use
--quality <threshold>  # Minimum quality threshold (0.0-1.0)
--semantic             # Enable semantic analysis and reasoning
```

**Examples:**
```bash
# Basic component generation
unjucks generate component Button --dest ./src/components

# Interactive API generation with multiple agents
unjucks generate api-rest --interactive --agents architect,coder,tester

# High-quality generation with semantic analysis
unjucks generate microservice UserService --semantic --quality 0.9

# Dry run with custom configuration
unjucks generate fullstack-app --dry-run --config ./custom.config.ts
```

#### `unjucks list`
List available generators and templates.

```bash
unjucks list [options]
```

**Options:**
```bash
--detailed, -d         # Show detailed information about each generator
--category <cat>       # Filter by category (web, api, mobile, etc.)
--quality <threshold>  # Filter by minimum quality rating
--tags <tags>          # Filter by comma-separated tags
--format <format>      # Output format (table, json, yaml)
```

**Examples:**
```bash
# List all available generators
unjucks list

# Show detailed information about web generators
unjucks list --detailed --category web

# List high-quality generators in JSON format
unjucks list --quality 0.8 --format json
```

#### `unjucks scaffold`
Create complete project scaffolding with architectural intelligence.

```bash
unjucks scaffold <project-type> <name> [options]
```

**Project Types:**
- `webapp` - Web application with frontend and backend
- `api` - REST/GraphQL API service
- `microservice` - Microservice with observability
- `library` - Reusable library package
- `monorepo` - Multi-package repository

**Options:**
```bash
--architecture <arch>  # Architecture pattern (mvc, hexagonal, clean, etc.)
--tech-stack <stack>   # Technology stack (react-node, vue-python, etc.)
--features <features>  # Comma-separated feature list
--deployment <target>  # Deployment target (docker, k8s, serverless)
--semantic-model       # Include semantic web features
--ai-workflow         # Setup AI-powered development workflow
```

**Examples:**
```bash
# Create a modern web application
unjucks scaffold webapp MyApp --tech-stack react-node-postgres --features auth,payments

# Create a microservice with observability
unjucks scaffold microservice UserService --architecture hexagonal --deployment k8s

# Create a library with AI workflow
unjucks scaffold library DataUtils --ai-workflow --semantic-model
```

### Project Management Commands

#### `unjucks init`
Initialize Unjucks in an existing project.

```bash
unjucks init [options]
```

**Options:**
```bash
--config-only          # Only create configuration file
--analyze              # Analyze existing codebase for patterns
--semantic             # Enable semantic analysis
--git-hooks            # Install git hooks for quality control
--ai-agents            # Configure AI agent workflows
```

#### `unjucks analyze`
Analyze codebase for patterns, quality, and improvement opportunities.

```bash
unjucks analyze [path] [options]
```

**Options:**
```bash
--output, -o <path>    # Output analysis report to file
--format <format>      # Report format (html, json, markdown)
--semantic             # Include semantic analysis
--quality              # Include quality metrics
--patterns             # Identify architectural patterns
--suggestions          # Include improvement suggestions
--depth <level>        # Analysis depth (1-5)
```

## Configuration API

### Configuration File Structure

#### `unjucks.config.ts`
Main configuration file with TypeScript support.

```typescript
import { defineConfig } from 'unjucks';

export default defineConfig({
  // Core configuration
  generators: {
    directory: './templates',
    extensions: ['.njk', '.hbs', '.ejs'],
    semantic: {
      enabled: true,
      ontology: './ontology.ttl',
      reasoning: true
    }
  },

  // AI Agent configuration
  agents: {
    enabled: true,
    coordination: {
      topology: 'hierarchical',
      maxAgents: 8,
      timeout: 300000
    },
    capabilities: {
      architect: { weight: 0.9, timeout: 60000 },
      coder: { weight: 0.8, timeout: 45000 },
      tester: { weight: 0.7, timeout: 30000 },
      reviewer: { weight: 0.8, timeout: 45000 }
    }
  },

  // MCP Integration
  mcp: {
    servers: [
      {
        name: 'claude-flow',
        command: 'npx',
        args: ['claude-flow@alpha', 'mcp', 'start'],
        env: {}
      }
    ],
    resources: {
      caching: true,
      timeout: 30000
    }
  },

  // Quality configuration
  quality: {
    thresholds: {
      overall: 0.8,
      security: 0.9,
      performance: 0.7,
      maintainability: 0.8
    },
    validation: {
      typescript: true,
      eslint: true,
      prettier: true,
      semantic: true
    }
  },

  // Output configuration
  output: {
    directory: './src',
    preserveStructure: true,
    overwrite: 'prompt',
    backup: true,
    gitIntegration: true
  }
});
```

#### Environment Configuration

```bash
# .env file configuration
UNJUCKS_SEMANTIC_ENABLED=true
UNJUCKS_AI_AGENTS_ENABLED=true
UNJUCKS_MCP_TIMEOUT=30000
UNJUCKS_QUALITY_THRESHOLD=0.8
UNJUCKS_LOG_LEVEL=info

# Claude-Flow integration
CLAUDE_FLOW_API_KEY=your-api-key
CLAUDE_FLOW_ENDPOINT=https://api.claude-flow.dev

# Optional: Custom ontology endpoint
UNJUCKS_ONTOLOGY_ENDPOINT=https://your-ontology.example.com
```

## Template API

### Template Structure

#### Generator Metadata
```yaml
# _templates/component/new/index.yaml
name: React Component Generator
description: Generate React components with TypeScript, tests, and stories
version: 2.1.0
category: frontend
tags: [react, typescript, testing, storybook]

# Semantic metadata
ontology:
  type: ui_component
  patterns: [composition, hooks, accessibility]
  domain: user_interface

# AI agent preferences
agents:
  preferred: [architect, coder, tester]
  required: [coder]
  
# Quality requirements
quality:
  minimum: 0.8
  aspects: [maintainability, testability, accessibility]

# Variable definitions
variables:
  - name: componentName
    type: string
    required: true
    description: Name of the React component
    validation: /^[A-Z][a-zA-Z0-9]*$/
    
  - name: withTests
    type: boolean
    default: true
    description: Generate test files
    
  - name: withStories
    type: boolean
    default: true
    description: Generate Storybook stories
    
  - name: accessibility
    type: boolean
    default: true
    description: Include accessibility features
```

#### Template Files
```typescript
// _templates/component/new/component.tsx.njk
import React{% if hooks %}, { useState, useEffect }{% endif %} from 'react';
{% if withPropTypes %}import PropTypes from 'prop-types';{% endif %}

// Semantic metadata for generated component
/**
 * @semantic-type ui_component
 * @semantic-patterns composition{% if hooks %}, hooks{% endif %}
 * @semantic-domain user_interface
 * @quality-score {{ qualityScore | default(0.85) }}
 */

interface {{ componentName }}Props {
  className?: string;
  children?: React.ReactNode;
  {% for prop in customProps %}
  {{ prop.name }}{% if not prop.required %}?{% endif %}: {{ prop.type }};
  {% endfor %}
}

const {{ componentName }}: React.FC<{{ componentName }}Props> = ({
  className = '',
  children,
  {% for prop in customProps %}
  {{ prop.name }}{% if prop.default %} = {{ prop.default }}{% endif %},
  {% endfor %}
}) => {
  {% if hooks %}
  // Component state
  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    setIsLoaded(true);
  }, []);
  {% endif %}

  return (
    <div 
      className={`{{ componentName | lower }}-component ${className}`}
      {% if accessibility %}
      role="region"
      aria-label="{{ componentName }} component"
      {% endif %}
    >
      {children}
    </div>
  );
};

{% if withPropTypes %}
{{ componentName }}.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  {% for prop in customProps %}
  {{ prop.name }}: PropTypes.{{ prop.propType }}{% if not prop.required %}.isRequired{% endif %},
  {% endfor %}
};
{% endif %}

export default {{ componentName }};
```

### Template Helpers and Filters

#### Built-in Filters
```typescript
// String manipulation
{{ componentName | pascalCase }}    // PascalCase conversion
{{ componentName | camelCase }}     // camelCase conversion
{{ componentName | kebabCase }}     // kebab-case conversion
{{ componentName | snakeCase }}     // snake_case conversion

// Semantic helpers
{{ componentName | semanticType }}  // Infer semantic type
{{ pattern | ontologyUri }}         // Convert to ontology URI
{{ quality | formatScore }}         // Format quality score

// Code generation helpers
{{ imports | sortImports }}         // Sort import statements
{{ props | generateInterface }}     // Generate TypeScript interface
{{ dependencies | analyzeDeps }}    // Analyze dependencies
```

#### Custom Filters
```typescript
// In unjucks.config.ts
export default defineConfig({
  filters: {
    // Custom business logic filter
    businessLogic: (value: string) => {
      return `// Business logic for ${value}`;
    },
    
    // Semantic annotation filter
    semanticAnnotation: (componentName: string, patterns: string[]) => {
      return `@semantic-component(name="${componentName}", patterns=[${patterns.join(', ')}])`;
    },
    
    // Quality score calculation
    calculateQuality: (metrics: QualityMetrics) => {
      return (metrics.maintainability + metrics.testability + metrics.performance) / 3;
    }
  }
});
```

## Programmatic API

### Core API Classes

#### `UnjucksGenerator`
Main class for programmatic code generation.

```typescript
import { UnjucksGenerator, GenerationOptions } from 'unjucks';

class UnjucksGenerator {
  constructor(config?: UnjucksConfig);
  
  // Core generation methods
  async generate(template: string, variables: Variables, options?: GenerationOptions): Promise<GenerationResult>;
  async generateMultiple(requests: GenerationRequest[]): Promise<GenerationResult[]>;
  async generateWithAgents(template: string, variables: Variables, agents: AgentConfig): Promise<GenerationResult>;
  
  // Analysis methods
  async analyze(path: string): Promise<AnalysisResult>;
  async analyzeSemantics(code: string): Promise<SemanticAnalysis>;
  async suggestImprovements(path: string): Promise<Improvement[]>;
  
  // Template management
  async listTemplates(): Promise<TemplateInfo[]>;
  async validateTemplate(path: string): Promise<ValidationResult>;
  async installTemplate(source: string): Promise<InstallResult>;
  
  // Quality assurance
  async validateOutput(code: string, quality: QualityConfig): Promise<QualityResult>;
  async testGenerated(path: string): Promise<TestResult>;
  
  // Semantic operations
  async buildKnowledgeGraph(codebase: string): Promise<KnowledgeGraph>;
  async querySemantics(query: string): Promise<QueryResult>;
}
```

#### Usage Examples

```typescript
// Basic generation
const generator = new UnjucksGenerator();
const result = await generator.generate('react-component', {
  componentName: 'UserProfile',
  withTests: true,
  accessibility: true
});

// AI-assisted generation
const aiResult = await generator.generateWithAgents('microservice', {
  serviceName: 'UserService',
  domain: 'authentication'
}, {
  agents: ['architect', 'coder', 'tester', 'documenter'],
  coordination: 'hierarchical',
  quality: { minimum: 0.9 }
});

// Semantic analysis
const analysis = await generator.analyzeSemantics('./src');
console.log('Identified patterns:', analysis.patterns);
console.log('Quality metrics:', analysis.quality);
console.log('Suggestions:', analysis.suggestions);
```

#### `SemanticEngine`
Semantic web and RDF integration.

```typescript
import { SemanticEngine, RDFGraph } from 'unjucks/semantic';

class SemanticEngine {
  constructor(ontologyPath?: string);
  
  // RDF operations
  async parseCode(code: string): Promise<RDFGraph>;
  async generateFromRDF(graph: RDFGraph): Promise<GeneratedCode>;
  async queryGraph(sparql: string): Promise<QueryResults>;
  
  // Reasoning
  async infer(graph: RDFGraph): Promise<InferenceResults>;
  async validateConsistency(graph: RDFGraph): Promise<ValidationResult>;
  async suggestPatterns(context: SemanticContext): Promise<Pattern[]>;
  
  // Knowledge management
  async exportTurtle(): Promise<string>;
  async importOntology(path: string): Promise<void>;
  async updateKnowledge(facts: RDFTriple[]): Promise<void>;
}
```

#### `AgentOrchestrator`
AI agent coordination and workflow management.

```typescript
import { AgentOrchestrator, AgentConfig } from 'unjucks/agents';

class AgentOrchestrator {
  constructor(config: AgentConfig);
  
  // Agent management
  async spawnAgent(type: AgentType, config: AgentSpecification): Promise<Agent>;
  async coordinateAgents(agents: Agent[], task: Task): Promise<CoordinationResult>;
  async monitorProgress(agents: Agent[]): Promise<ProgressReport>;
  
  // Workflow execution
  async executeWorkflow(workflow: Workflow): Promise<WorkflowResult>;
  async pauseWorkflow(workflowId: string): Promise<void>;
  async resumeWorkflow(workflowId: string): Promise<void>;
  
  // Quality control
  async validateAgentOutput(agent: Agent, output: any): Promise<ValidationResult>;
  async optimizeCoordination(metrics: PerformanceMetrics): Promise<OptimizationPlan>;
}
```

## Integration APIs

### MCP Integration

#### Server Configuration
```typescript
interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  timeout?: number;
  capabilities?: MCPCapability[];
}

interface MCPIntegration {
  servers: MCPServerConfig[];
  resources: {
    caching: boolean;
    timeout: number;
    retries: number;
  };
  tools: {
    timeout: number;
    concurrent: number;
  };
}
```

#### MCP Client API
```typescript
import { MCPClient } from 'unjucks/mcp';

const mcpClient = new MCPClient({
  serverConfigs: [
    {
      name: 'claude-flow',
      command: 'npx',
      args: ['claude-flow@alpha', 'mcp', 'start']
    }
  ]
});

// Resource operations
const resources = await mcpClient.listResources();
const resource = await mcpClient.readResource('unjucks://templates/react-component');

// Tool operations
const tools = await mcpClient.listTools();
const result = await mcpClient.callTool('generate_component', {
  name: 'UserProfile',
  type: 'functional'
});
```

### Webhook Integration

#### Event Types
```typescript
enum WebhookEvent {
  GENERATION_STARTED = 'generation.started',
  GENERATION_COMPLETED = 'generation.completed',
  GENERATION_FAILED = 'generation.failed',
  QUALITY_CHECK_FAILED = 'quality.check.failed',
  SEMANTIC_ANALYSIS_COMPLETED = 'semantic.analysis.completed',
  AGENT_WORKFLOW_COMPLETED = 'agent.workflow.completed'
}

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: any;
  metadata: {
    projectId?: string;
    userId?: string;
    sessionId: string;
  };
}
```

#### Webhook Configuration
```typescript
// In unjucks.config.ts
export default defineConfig({
  webhooks: {
    enabled: true,
    url: 'https://your-app.com/webhooks/unjucks',
    secret: process.env.WEBHOOK_SECRET,
    events: [
      'generation.completed',
      'quality.check.failed',
      'semantic.analysis.completed'
    ],
    retry: {
      attempts: 3,
      backoff: 'exponential'
    }
  }
});
```

## Error Handling

### Error Types

```typescript
// Generation errors
class GenerationError extends Error {
  code: string;
  template: string;
  variables: Variables;
  cause?: Error;
}

class TemplateNotFoundError extends GenerationError {
  code = 'TEMPLATE_NOT_FOUND';
}

class VariableValidationError extends GenerationError {
  code = 'VARIABLE_VALIDATION_FAILED';
  invalidVariables: string[];
}

// Quality errors
class QualityThresholdError extends Error {
  code = 'QUALITY_THRESHOLD_NOT_MET';
  actualScore: number;
  requiredScore: number;
  failedAspects: string[];
}

// Semantic errors
class SemanticValidationError extends Error {
  code = 'SEMANTIC_VALIDATION_FAILED';
  inconsistencies: SemanticInconsistency[];
}

// Agent errors
class AgentCoordinationError extends Error {
  code = 'AGENT_COORDINATION_FAILED';
  failedAgents: string[];
  lastSuccessfulState: AgentState;
}
```

### Error Handling Patterns

```typescript
try {
  const result = await generator.generate('complex-template', variables);
} catch (error) {
  if (error instanceof QualityThresholdError) {
    console.log('Quality issues found:', error.failedAspects);
    // Attempt regeneration with different parameters
    const retryResult = await generator.generate('complex-template', {
      ...variables,
      quality: { minimum: error.actualScore }
    });
  } else if (error instanceof AgentCoordinationError) {
    console.log('Agent coordination failed:', error.failedAgents);
    // Resume from last successful state
    const resumeResult = await generator.resumeFromState(error.lastSuccessfulState);
  } else {
    throw error; // Re-throw unknown errors
  }
}
```

This comprehensive API reference provides the foundation for integrating Unjucks 2026 into any development workflow, from simple command-line usage to sophisticated programmatic orchestration.

---

**Next:** [Configuration Guide](./configuration.md) - Detailed configuration options and best practices →