# Configuration Reference

## unjucks.config.ts

Complete reference for the Unjucks configuration file.

### Basic Configuration

```typescript
import { defineConfig } from 'unjucks';

export default defineConfig({
  // Template source directory
  templates: '_templates',
  
  // Default output directory
  outDir: 'src',
  
  // Global variables available to all templates
  globals: {
    author: 'Your Name',
    organization: 'Your Organization',
    year: new Date().getFullYear()
  }
});
```

### Advanced Configuration

```typescript
import { defineConfig } from 'unjucks';

export default defineConfig({
  // Template configuration
  templates: '_templates',
  outDir: 'src',
  
  // Global variables
  globals: {
    author: 'Development Team',
    organization: 'ACME Corporation',
    year: new Date().getFullYear(),
    license: 'MIT'
  },
  
  // Template processing options
  processing: {
    // Enable dry run mode by default
    dryRun: false,
    
    // Force overwrite existing files
    force: false,
    
    // Skip files that match skipIf conditions
    respectSkipIf: true,
    
    // Execute shell commands after generation
    executeShellCommands: true
  },
  
  // File handling
  files: {
    // Default file permissions
    defaultChmod: '644',
    
    // Backup existing files before overwrite
    backup: false,
    
    // File extension handling
    preserveExtensions: ['.md', '.json', '.yaml'],
    
    // Ignore patterns
    ignore: [
      'node_modules/**',
      '.git/**',
      '**/*.log'
    ]
  },
  
  // Integration settings
  integrations: {
    // Git integration
    git: {
      autoCommit: false,
      commitMessage: 'Generated files with Unjucks'
    },
    
    // Package manager integration
    packageManager: 'npm', // 'npm' | 'yarn' | 'pnpm'
    
    // IDE integration
    ide: {
      openInVSCode: false,
      formatOnGenerate: true
    }
  },
  
  // AI and MCP settings
  ai: {
    // Enable AI-assisted generation
    enabled: false,
    
    // MCP server configuration
    mcp: {
      servers: [
        {
          name: 'claude-flow',
          command: 'npx',
          args: ['claude-flow@alpha', 'mcp', 'start']
        }
      ]
    }
  },
  
  // Development settings
  dev: {
    // Watch for template changes
    watch: false,
    
    // Hot reload configuration
    hotReload: {
      enabled: false,
      port: 3001
    },
    
    // Debugging
    debug: false,
    verbose: false
  },
  
  // Plugin system
  plugins: [
    // Example plugin configuration
    {
      name: 'typescript-plugin',
      options: {
        generateTypes: true,
        strictMode: true
      }
    }
  ],
  
  // Custom filters for Nunjucks
  filters: {
    // Example custom filter
    reverse: (str: string) => str.split('').reverse().join(''),
    
    // Case conversion filters (built-in)
    pascalCase: true,
    camelCase: true,
    kebabCase: true,
    snakeCase: true,
    constantCase: true
  },
  
  // Template inheritance and extensions
  extends: {
    // Base template directory for inheritance
    baseTemplates: 'node_modules/unjucks-templates',
    
    // Template resolution order
    resolution: ['local', 'inherited', 'builtin']
  }
});
```

## Environment Variables

Unjucks respects the following environment variables:

### Core Settings

- `UNJUCKS_TEMPLATES_DIR`: Override templates directory
- `UNJUCKS_OUT_DIR`: Override output directory  
- `UNJUCKS_DRY_RUN`: Enable dry run mode (`true`/`false`)
- `UNJUCKS_FORCE`: Force overwrite existing files (`true`/`false`)

### Development

- `UNJUCKS_DEBUG`: Enable debug logging (`true`/`false`)
- `UNJUCKS_VERBOSE`: Enable verbose output (`true`/`false`)
- `UNJUCKS_WATCH`: Enable watch mode (`true`/`false`)

### AI Integration

- `UNJUCKS_AI_ENABLED`: Enable AI features (`true`/`false`)
- `CLAUDE_API_KEY`: API key for Claude integration
- `OPENAI_API_KEY`: API key for OpenAI integration

## Package.json Scripts

Common npm scripts for Unjucks projects:

```json
{
  "scripts": {
    "generate": "unjucks generate",
    "gen:component": "unjucks generate component",
    "gen:page": "unjucks generate page",
    "gen:api": "unjucks generate api",
    "gen:dry": "unjucks generate --dry",
    "gen:list": "unjucks list",
    "gen:help": "unjucks help",
    "templates:validate": "unjucks validate",
    "templates:watch": "unjucks dev --watch"
  },
  "devDependencies": {
    "unjucks": "^2.0.0"
  }
}
```

## Template Frontmatter Reference

### Basic Frontmatter

```yaml
---
to: "src/{{ folder }}/{{ pascalCase name }}.ts"
inject: false
force: false
---
```

### Advanced Frontmatter

```yaml
---
# Output file path (supports templates)
to: "src/{{ folder }}/{{ pascalCase name }}.ts"

# Injection settings
inject: true
before: "// END EXPORTS"
after: "// START IMPORTS"
lineAt: 10
prepend: true
append: false

# Conditional generation
skipIf: "class {{ pascalCase name }}"
when: "{{ hasFeature('authentication') }}"

# File permissions
chmod: "755"

# Shell commands to run after generation
sh: |
  npm run format {{ to }}
  npm run lint {{ to }}

# Template metadata
description: "Generate a TypeScript service class"
version: "1.2.0"
author: "Development Team"

# Variable schema (for validation)
schema:
  name:
    type: "string"
    required: true
    description: "Service name"
  folder:
    type: "string"
    default: "services"
    description: "Output folder"
  methods:
    type: "array"
    default: []
    description: "Service methods to generate"
---
```

## CLI Command Reference

### Core Commands

```bash
# List available generators
unjucks list

# Generate code
unjucks generate <generator> [name] [options]

# Get help for specific generator
unjucks help <generator>

# Validate templates
unjucks validate

# Development mode
unjucks dev [options]
```

### Common Options

- `--dry`: Preview generation without creating files
- `--force`: Overwrite existing files
- `--templates <dir>`: Specify templates directory
- `--out <dir>`: Specify output directory
- `--config <file>`: Use specific configuration file
- `--verbose`: Enable verbose output
- `--debug`: Enable debug mode

### Examples

```bash
# Generate a React component
unjucks generate component UserProfile --with-tests

# Generate API endpoint
unjucks generate api users --methods get,post,put,delete

# Preview generation
unjucks generate page Dashboard --dry

# Force overwrite
unjucks generate service AuthService --force

# Use custom templates directory
unjucks generate component Header --templates ./custom-templates
```

## Built-in Filters

Unjucks includes these Nunjucks filters by default:

### Case Conversion
- `pascalCase`: PascalCase conversion
- `camelCase`: camelCase conversion
- `kebabCase`: kebab-case conversion
- `snakeCase`: snake_case conversion
- `constantCase`: CONSTANT_CASE conversion

### String Manipulation
- `plural`: Pluralize strings
- `singular`: Singularize strings  
- `capitalize`: Capitalize first letter
- `lowercase`: Convert to lowercase
- `uppercase`: Convert to uppercase

### Path and File
- `dirname`: Get directory name
- `basename`: Get file name
- `extname`: Get file extension
- `normalize`: Normalize file path

### Utility
- `default`: Provide default value
- `json`: Convert to JSON string
- `yaml`: Convert to YAML string
- `indent`: Indent text by specified amount

## Error Codes

Common Unjucks error codes and their meanings:

- `UNJUCKS_001`: Template not found
- `UNJUCKS_002`: Invalid template syntax
- `UNJUCKS_003`: Missing required variable
- `UNJUCKS_004`: File already exists (when not forcing)
- `UNJUCKS_005`: Permission denied
- `UNJUCKS_006`: Invalid configuration
- `UNJUCKS_007`: Template validation failed
- `UNJUCKS_008`: Shell command execution failed
- `UNJUCKS_009`: Injection target not found
- `UNJUCKS_010`: AI integration error