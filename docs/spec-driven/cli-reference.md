# CLI Reference

Complete reference for all Unjucks CLI commands, options, and configurations for spec-driven development.

## 📋 Command Overview

```bash
unjucks [command] [options]
```

### Core Commands
- [`create-spec`](#create-spec) - Create new specifications
- [`generate-from-spec`](#generate-from-spec) - Generate code from specifications
- [`validate-spec`](#validate-spec) - Validate specification syntax and structure
- [`ai`](#ai-commands) - AI-powered workflows and enhancements

### Analysis & Migration
- [`analyze-project`](#analyze-project) - Analyze existing projects for migration
- [`reverse-engineer`](#reverse-engineer) - Generate specs from existing code
- [`migrate`](#migrate) - Migration utilities

### Utilities
- [`list`](#list) - List available generators and templates
- [`help`](#help) - Display help information
- [`version`](#version) - Show version information

## 🎯 Core Commands

### `create-spec`

Create new specification files interactively or from templates.

```bash
unjucks create-spec [options]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--type` | string | - | Specification type (`rest-api`, `frontend`, `microservice`) |
| `--interactive` | boolean | false | Interactive specification builder |
| `--template` | string | - | Use template as starting point |
| `--output` | string | `./spec.yaml` | Output file path |
| `--format` | string | `yaml` | Output format (`yaml`, `json`) |
| `--ai-assist` | boolean | false | Enable AI assistance |
| `--minimal` | boolean | false | Create minimal specification |

#### Examples

```bash
# Interactive REST API specification
unjucks create-spec --type rest-api --interactive

# From template
unjucks create-spec --template ecommerce --output ./api.spec.yaml

# AI-assisted creation
unjucks create-spec --ai-assist --description "Task management API with teams"

# Minimal specification
unjucks create-spec --type microservice --minimal --output ./service.spec.yaml
```

#### Interactive Mode

When using `--interactive`, you'll be guided through:

1. **Project Information**
   - Name, description, version
   - Target framework and language
   - Database preferences

2. **Entity Definition**
   - Entity names and relationships
   - Field types and validations
   - Indexes and constraints

3. **API Endpoints**
   - Route definitions
   - HTTP methods and parameters
   - Request/response schemas

4. **Additional Features**
   - Authentication/authorization
   - Middleware configuration
   - Testing preferences

### `generate-from-spec`

Generate code from specification files.

```bash
unjucks generate-from-spec <spec-file> [options]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--output` | string | `./src` | Output directory |
| `--components` | string[] | `all` | Components to generate |
| `--merge` | boolean | false | Merge with existing code |
| `--dry-run` | boolean | false | Show what would be generated |
| `--force` | boolean | false | Overwrite existing files |
| `--templates` | string | - | Custom templates directory |
| `--config` | string | - | Configuration file path |
| `--parallel` | boolean | true | Enable parallel generation |
| `--watch` | boolean | false | Watch for specification changes |

#### Components

Available components for generation:

- `models` - Database models/entities
- `controllers` - HTTP controllers/handlers
- `routes` - Route definitions
- `services` - Business logic services
- `middleware` - Custom middleware
- `tests` - Test suites
- `docs` - API documentation
- `config` - Configuration files
- `types` - TypeScript type definitions
- `validators` - Input validation schemas

#### Examples

```bash
# Generate complete project
unjucks generate-from-spec api.spec.yaml --output ./src

# Generate specific components
unjucks generate-from-spec api.spec.yaml \
  --components models,controllers,routes \
  --output ./src

# Merge with existing code
unjucks generate-from-spec api.spec.yaml \
  --output ./src \
  --merge

# Dry run to preview changes
unjucks generate-from-spec api.spec.yaml \
  --dry-run \
  --output ./src

# Use custom templates
unjucks generate-from-spec api.spec.yaml \
  --templates ./my-templates \
  --output ./src

# Watch for changes and regenerate
unjucks generate-from-spec api.spec.yaml \
  --watch \
  --output ./src
```

#### Merge Strategies

When using `--merge`, several strategies are available:

- **Conservative** (default): Only add new files, preserve existing
- **Smart**: Merge compatible changes, preserve custom logic
- **Aggressive**: Overwrite generated sections, preserve marked custom code
- **Interactive**: Prompt for each conflict

```bash
# Configure merge strategy
unjucks generate-from-spec api.spec.yaml \
  --merge \
  --merge-strategy smart \
  --preserve-custom-markers \
  --output ./src
```

### `validate-spec`

Validate specification files for syntax, structure, and best practices.

```bash
unjucks validate-spec <spec-file> [options]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--schema` | string | - | JSON Schema file for validation |
| `--strict` | boolean | false | Enable strict validation |
| `--warnings` | boolean | true | Show warnings |
| `--suggestions` | boolean | false | Provide improvement suggestions |
| `--format` | string | `text` | Output format (`text`, `json`, `html`) |
| `--output` | string | - | Save validation report |
| `--watch` | boolean | false | Watch file for changes |

#### Examples

```bash
# Basic validation
unjucks validate-spec api.spec.yaml

# Strict validation with suggestions
unjucks validate-spec api.spec.yaml --strict --suggestions

# Generate HTML report
unjucks validate-spec api.spec.yaml \
  --format html \
  --output ./validation-report.html

# Continuous validation
unjucks validate-spec api.spec.yaml --watch
```

#### Validation Levels

- **Syntax**: YAML/JSON syntax errors
- **Structure**: Required fields and schema validation
- **Logic**: Entity relationships and endpoint consistency
- **Best Practices**: Performance, security, and maintainability
- **AI Analysis**: Advanced pattern recognition and optimization

## 🤖 AI Commands

### `ai generate-spec`

Generate specifications using AI from natural language descriptions.

```bash
unjucks ai generate-spec [options]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--description` | string | - | Natural language description |
| `--type` | string | - | Target specification type |
| `--framework` | string | - | Preferred framework |
| `--database` | string | - | Preferred database |
| `--features` | string[] | - | Required features |
| `--output` | string | - | Output specification file |
| `--model` | string | `claude-3.5-sonnet` | AI model to use |
| `--temperature` | number | 0.1 | AI creativity level |
| `--interactive` | boolean | false | Interactive refinement |

#### Examples

```bash
# Generate from description
unjucks ai generate-spec \
  --description "E-commerce platform with user auth, product catalog, shopping cart" \
  --type rest-api \
  --framework express \
  --database postgresql \
  --output ./ecommerce.spec.yaml

# Interactive AI generation
unjucks ai generate-spec \
  --description "Blog platform" \
  --interactive \
  --output ./blog.spec.yaml

# Specify required features
unjucks ai generate-spec \
  --description "Task management system" \
  --features auth,teams,notifications,file-upload \
  --output ./tasks.spec.yaml
```

### `ai enhance-spec`

Enhance existing specifications with AI insights and improvements.

```bash
unjucks ai enhance-spec <spec-file> [options]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--focus` | string[] | - | Enhancement focus areas |
| `--preserve` | string[] | - | Areas to preserve unchanged |
| `--output` | string | - | Enhanced specification file |
| `--backup` | boolean | true | Create backup of original |
| `--interactive` | boolean | false | Interactive enhancement |
| `--model` | string | `claude-3.5-sonnet` | AI model to use |

#### Focus Areas

- `security` - Security improvements and best practices
- `performance` - Performance optimizations
- `scalability` - Scalability enhancements
- `maintainability` - Code maintainability improvements
- `testing` - Testing strategy enhancements
- `documentation` - Documentation improvements
- `accessibility` - Accessibility features

#### Examples

```bash
# Security-focused enhancement
unjucks ai enhance-spec api.spec.yaml \
  --focus security,performance \
  --output ./enhanced-api.spec.yaml

# Interactive enhancement
unjucks ai enhance-spec api.spec.yaml \
  --interactive \
  --preserve entities \
  --output ./improved-api.spec.yaml
```

### `ai generate-code`

Generate code using coordinated AI agents.

```bash
unjucks ai generate-code <spec-file> [options]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--agents` | string[] | `all` | AI agents to use |
| `--coordination` | string | `mesh` | Agent coordination pattern |
| `--output` | string | `./src` | Output directory |
| `--parallel` | boolean | true | Parallel agent execution |
| `--monitoring` | boolean | false | Enable agent monitoring |

#### Available Agents

- `researcher` - Requirements analysis and best practices
- `architect` - System design and architecture
- `coder` - Code generation and implementation
- `tester` - Test strategy and generation
- `reviewer` - Code review and optimization

#### Examples

```bash
# Full AI-coordinated generation
unjucks ai generate-code api.spec.yaml \
  --agents researcher,architect,coder,tester,reviewer \
  --coordination mesh \
  --output ./src

# Focused generation with specific agents
unjucks ai generate-code api.spec.yaml \
  --agents architect,coder \
  --output ./src

# Monitor AI agent coordination
unjucks ai generate-code api.spec.yaml \
  --monitoring \
  --output ./src
```

## 🔍 Analysis Commands

### `analyze-project`

Analyze existing projects for migration readiness and optimization opportunities.

```bash
unjucks analyze-project [directory] [options]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--migration-assessment` | boolean | false | Assess migration readiness |
| `--frameworks` | string[] | - | Frameworks to detect |
| `--output` | string | - | Save analysis report |
| `--format` | string | `text` | Report format |
| `--depth` | number | 3 | Analysis depth level |

#### Examples

```bash
# Basic project analysis
unjucks analyze-project ./my-app

# Migration assessment
unjucks analyze-project ./my-app --migration-assessment

# Detailed analysis with report
unjucks analyze-project ./my-app \
  --depth 5 \
  --format json \
  --output ./analysis-report.json
```

### `reverse-engineer`

Generate specifications from existing codebases.

```bash
unjucks reverse-engineer <directory> [options]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--type` | string | - | Target specification type |
| `--framework` | string | - | Framework to analyze |
| `--output` | string | - | Output specification file |
| `--include-tests` | boolean | false | Include test analysis |
| `--include-docs` | boolean | false | Include documentation |
| `--ai-enhance` | boolean | false | AI-enhance generated spec |
| `--preserve-structure` | boolean | true | Preserve original structure |

#### Examples

```bash
# Basic reverse engineering
unjucks reverse-engineer ./src \
  --type rest-api \
  --framework express \
  --output ./generated.spec.yaml

# Enhanced reverse engineering with AI
unjucks reverse-engineer ./src \
  --ai-enhance \
  --include-tests \
  --include-docs \
  --output ./enhanced.spec.yaml
```

## 🔄 Migration Commands

### `migrate`

Comprehensive migration utilities and workflows.

```bash
unjucks migrate <subcommand> [options]
```

#### Subcommands

- `project` - Migrate entire project to spec-driven development
- `feature` - Migrate specific feature or module
- `config` - Migrate configuration files
- `tests` - Migrate test suites

#### Examples

```bash
# Full project migration
unjucks migrate project ./src \
  --spec ./api.spec.yaml \
  --output ./src-new \
  --strategy incremental

# Feature migration
unjucks migrate feature ./src/auth \
  --spec ./api.spec.yaml \
  --output ./src-new/auth

# Configuration migration
unjucks migrate config ./config \
  --spec ./api.spec.yaml \
  --output ./config-new
```

## 🛠️ Utility Commands

### `list`

List available generators, templates, and components.

```bash
unjucks list [type] [options]
```

#### Types

- `generators` - Available code generators
- `templates` - Available specification templates  
- `components` - Available generation components
- `examples` - Available example projects

#### Examples

```bash
# List all generators
unjucks list generators

# List REST API templates
unjucks list templates --filter rest-api

# List available components
unjucks list components --detailed
```

### `help`

Display help information for commands.

```bash
unjucks help [command]
```

#### Examples

```bash
# General help
unjucks help

# Command-specific help
unjucks help generate-from-spec

# AI command help
unjucks help ai
```

## ⚙️ Configuration

### Configuration File

Create `unjucks.config.ts` or `unjucks.config.js`:

```typescript
import { defineConfig } from 'unjucks';

export default defineConfig({
  // Default output directory
  outputDir: './src',
  
  // Template directories
  templateDirs: [
    './templates',
    './node_modules/@unjucks/templates'
  ],
  
  // Default specification type
  defaultSpecType: 'rest-api',
  
  // Generation options
  generation: {
    parallel: true,
    merge: {
      strategy: 'smart',
      preserveCustom: true
    },
    formatting: {
      prettier: true,
      eslint: true
    }
  },
  
  // AI configuration
  ai: {
    enabled: true,
    model: 'claude-3.5-sonnet',
    temperature: 0.1,
    maxTokens: 8192,
    
    // Agent configuration
    agents: {
      researcher: { capabilities: ['analysis', 'best-practices'] },
      architect: { capabilities: ['system-design', 'patterns'] },
      coder: { capabilities: ['typescript', 'node', 'testing'] },
      tester: { capabilities: ['unit-testing', 'integration'] },
      reviewer: { capabilities: ['code-review', 'security'] }
    }
  },
  
  // Validation options
  validation: {
    strict: false,
    warnings: true,
    suggestions: true
  },
  
  // Plugin configuration
  plugins: [
    '@unjucks/typescript-plugin',
    '@unjucks/testing-plugin',
    '@unjucks/docs-plugin'
  ]
});
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `UNJUCKS_CONFIG` | Configuration file path | `./unjucks.config.ts` |
| `UNJUCKS_OUTPUT_DIR` | Default output directory | `./src` |
| `UNJUCKS_TEMPLATE_DIR` | Template directory | `./templates` |
| `ANTHROPIC_API_KEY` | API key for AI features | - |
| `UNJUCKS_AI_MODEL` | Default AI model | `claude-3.5-sonnet` |
| `UNJUCKS_LOG_LEVEL` | Logging level | `info` |

### Global Options

Available for all commands:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--config` | string | - | Configuration file path |
| `--verbose` | boolean | false | Verbose output |
| `--quiet` | boolean | false | Suppress output |
| `--no-color` | boolean | false | Disable colored output |
| `--debug` | boolean | false | Enable debug mode |
| `--version` | boolean | false | Show version information |

## 📊 Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | File not found |
| 4 | Validation error |
| 5 | Generation error |
| 6 | AI service error |
| 10 | Configuration error |

## 🔧 Troubleshooting

### Common Issues

#### Specification Validation Errors
```bash
# Enable detailed validation
unjucks validate-spec api.spec.yaml --verbose --suggestions
```

#### Generation Failures
```bash
# Use debug mode to see detailed error information
unjucks generate-from-spec api.spec.yaml --debug --dry-run
```

#### AI Service Issues
```bash
# Check AI service status
unjucks ai status

# Use alternative model
unjucks ai generate-spec --model claude-3-sonnet --description "..."
```

#### Performance Issues
```bash
# Disable parallel processing
unjucks generate-from-spec api.spec.yaml --no-parallel

# Reduce generation scope
unjucks generate-from-spec api.spec.yaml --components models,controllers
```

### Debug Mode

Enable comprehensive debugging:

```bash
export DEBUG=unjucks:*
unjucks generate-from-spec api.spec.yaml --debug
```

This will show:
- Template resolution process
- Variable substitution
- File generation steps
- AI agent coordination
- Performance metrics

### Log Files

Unjucks maintains logs in:
- `~/.unjucks/logs/` - General logs
- `~/.unjucks/ai-logs/` - AI interaction logs
- `~/.unjucks/performance/` - Performance metrics

## 📚 Advanced Usage

### Scripting and Automation

```bash
#!/bin/bash
# Automated spec-driven development workflow

# Generate specification from requirements
unjucks ai generate-spec \
  --description "$1" \
  --type rest-api \
  --output ./api.spec.yaml

# Validate specification
unjucks validate-spec ./api.spec.yaml --strict

# Generate code
unjucks generate-from-spec ./api.spec.yaml \
  --output ./src \
  --components all

# Generate tests
unjucks ai generate-tests ./api.spec.yaml \
  --output ./tests \
  --coverage 90

# Generate documentation
unjucks generate-docs ./api.spec.yaml \
  --format openapi \
  --output ./docs
```

### CI/CD Integration

```yaml
# .github/workflows/spec-driven.yml
name: Spec-Driven Development

on:
  push:
    paths: ['*.spec.yaml']

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
          
      - name: Install Unjucks
        run: npm install -g unjucks
        
      - name: Validate Specifications
        run: unjucks validate-spec *.spec.yaml --strict
        
      - name: Generate Code
        run: unjucks generate-from-spec api.spec.yaml --output ./src
        
      - name: Run Tests
        run: npm test
        
      - name: Commit Generated Code
        uses: stefanzweifel/git-auto-commit-action@v4
        with:
          commit_message: 'Auto-generate code from specification changes'
```

---

*This completes the comprehensive CLI reference. For more examples and use cases, see the [Examples](./examples/) directory.*