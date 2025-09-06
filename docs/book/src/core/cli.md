# CLI Interface

The Unjucks CLI provides a powerful and intuitive command-line interface that automatically adapts to your templates. It features dynamic argument generation, interactive prompts, and comprehensive validation - all derived directly from your template structure.

## Command Architecture

### Core Design Principles

1. **Auto-Discovery**: CLI arguments are generated from template variables
2. **Type-Aware**: Boolean flags, string arguments, and array inputs are handled intelligently
3. **Interactive**: Missing variables trigger contextual prompts
4. **Safe by Default**: Dry-run mode and conflict detection prevent accidents

### Command Structure

```bash
unjucks <command> [generator] [template] [options] [variables...]
```

The CLI follows a consistent pattern where each command operates on generators and templates, with options and variables automatically discovered from template content.

## Core Commands

### `unjucks generate`

The primary command for creating files from templates.

```bash
unjucks generate <generator> <template> [options] [variables...]
```

**Dynamic Argument Discovery**:
- Variables like `{{ componentName }}` become `--componentName` flags
- Boolean patterns like `{% if withProps %}` become `--withProps` flags
- Array variables like `{% for item in items %}` accept JSON arrays

**Examples**:

```bash
# Basic generation with automatic CLI arguments
unjucks generate command citty --commandName=user --dest=./src

# Complex generation with multiple variable types
unjucks generate component react \
  --componentName=Button \
  --withProps \
  --withTests \
  --methods='["onClick", "onHover"]' \
  --dest=./src/components \
  --force

# Interactive mode (prompts for missing variables)
unjucks generate component react --dest=./src

# Preview mode (no files written)
unjucks generate command citty --dry --commandName=test
```

### `unjucks list`

Discover available generators and templates with detailed information.

```bash
unjucks list [--verbose]
```

**Basic Output**:
```
📦 Available Generators:

command
├── citty - Citty command with subcommands
└── Description: Generate Citty CLI commands

component  
├── react - React functional component
├── vue - Vue 3 composition API component
└── Description: Generate UI components
```

**Verbose Output** (`--verbose`):
```
command (Generate Citty CLI commands)
├── 📁 Templates:
│   └── citty
│       ├── 📄 {{ commandName | pascalCase }}.ts
│       └── 📄 {{ commandName | pascalCase }}.test.ts (if withTests)
├── 🔧 Variables:
│   ├── commandName (string, required) - Command name
│   ├── withTests (boolean, default: true) - Include test files
│   └── withSubcommands (boolean, default: false) - Include subcommand support
└── 📍 Location: _templates/command/
```

### `unjucks help`

Get detailed information about specific templates including variable definitions and usage examples.

```bash
unjucks help <generator> <template>
```

**Example Output**:
```
📋 Template Help: command/citty

📝 Description: 
Generate Citty CLI commands with automatic argument parsing, 
subcommand support, and TypeScript integration.

🔧 Variables:
┌─────────────────┬─────────┬─────────────┬─────────────────────────────┐
│ Name            │ Type    │ Default     │ Description                 │
├─────────────────┼─────────┼─────────────┼─────────────────────────────┤
│ commandName     │ string  │ myCommand   │ Command name (PascalCase)   │
│ withTests       │ boolean │ true        │ Include test files          │
│ withSubcommands │ boolean │ false       │ Support subcommands         │
│ description     │ string  │ ""          │ Command description         │
└─────────────────┴─────────┴─────────────┴─────────────────────────────┘

📄 Generated Files:
├── {{ commandName | pascalCase }}.ts
└── {{ commandName | pascalCase }}.test.ts (if withTests)

💡 Usage Examples:
# Basic command
unjucks generate command citty --commandName=User --dest=./src

# With subcommands and no tests
unjucks generate command citty \
  --commandName=Database \
  --withSubcommands \
  --no-withTests \
  --description="Database management commands"

# Interactive mode
unjucks generate command citty --dest=./src
```

### `unjucks init`

Bootstrap new projects with template generators.

```bash
unjucks init [--type <type>] [--dest <path>]
```

**Project Types**:
- `cli` - CLI application with command generators
- `component` - Component library with React/Vue templates  
- `service` - Backend service with API templates
- `fullstack` - Full-stack application with multiple generators
- `custom` - Empty project structure for custom generators

**Examples**:
```bash
# Interactive project initialization
unjucks init

# CLI project setup
unjucks init --type=cli --dest=./my-cli-tool

# Component library
unjucks init --type=component --dest=./my-components
```

## Dynamic Argument System

### Variable Type Detection

The CLI automatically generates appropriate argument types based on template analysis:

```typescript
// Template analysis results in CLI arguments
{{ componentName }}           → --componentName <string>
{% if withProps %}           → --withProps / --no-withProps (boolean)
{% for method in methods %}  → --methods <json-array>
{{ config.database.host }}   → --config-database-host <string>
```

### Boolean Variable Handling

Boolean variables are detected by naming patterns and usage:

```bash
# Auto-detected boolean patterns
--withProps          # Sets withProps = true
--no-withProps       # Sets withProps = false  
--hasTests           # Sets hasTests = true
--isPublic           # Sets isPublic = true
--shouldValidate     # Sets shouldValidate = true
```

### Array and Object Variables

Complex data types are supported through JSON formatting:

```bash
# Array variables
--methods='["create", "update", "delete"]'
--dependencies='["react", "typescript", "vite"]'

# Object variables  
--config='{"host": "localhost", "port": 3000}'

# Nested object paths (dot notation)
--config.database.host=localhost
--config.database.port=5432
```

### Variable Name Flexibility

The CLI accepts multiple naming conventions for the same variable:

```bash
# All equivalent ways to set the same variable
--componentName=Button     # camelCase (preferred)
--component-name=Button    # kebab-case
--COMPONENT_NAME=Button    # UPPER_CASE
--component_name=Button    # snake_case
```

## Interactive Mode

### Smart Prompting

When variables are missing, the CLI provides contextual prompts:

```bash
$ unjucks generate component react --dest ./src

? Component name: Button
? Include props interface? (Y/n) y
? Include test file? (Y/n) y  
? Include Storybook stories? (y/N) n
? Export type (default, named, both): default

✨ Generated 2 files:
  📄 src/components/Button/index.tsx
  📄 src/components/Button/Button.test.tsx
```

### Validation During Prompts

Input validation happens in real-time:

```bash
? Component name: my-component
✗ Component name must be PascalCase (e.g., MyComponent)

? Component name: MyComponent  
✓ Valid component name

? Include database connection? (y/N) y
? Database type (postgres, mysql, sqlite): oracle
✗ Invalid database type. Choose from: postgres, mysql, sqlite

? Database type: postgres
✓ Valid database type
```

### Prompt Customization

Templates can customize prompts through frontmatter:

```yaml
---
prompts:
  componentName:
    message: "What should we call this component?"
    type: "input"
    validate: "^[A-Z][a-zA-Z0-9]*$"
    hint: "Use PascalCase (e.g., MyComponent)"
  
  withProps:
    message: "Include props interface?"
    type: "confirm"
    default: true
    
  framework:
    message: "Choose framework:"
    type: "select"
    choices: ["react", "vue", "svelte"]
---
```

## Configuration System

### Project Configuration

Unjucks automatically discovers configuration files in this priority order:

1. `unjucks.config.ts` (TypeScript)
2. `unjucks.config.js` (JavaScript)  
3. `unjucks.yml` (YAML)
4. `unjucks.yaml` (YAML)
5. `unjucks.json` (JSON)
6. `package.json` (under `unjucks` key)

**TypeScript Configuration Example**:
```typescript
// unjucks.config.ts
import { defineConfig } from 'unjucks';

export default defineConfig({
  generators: '_templates',
  defaultDest: './src',
  globalVariables: {
    author: 'John Doe',
    license: 'MIT'
  },
  filters: {
    businessCase: (str: string) => {
      return str.split(/[\s_-]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
    }
  },
  hooks: {
    beforeGenerate: async (context) => {
      console.log(`Generating ${context.template}...`);
    },
    afterGenerate: async (context) => {
      console.log(`✅ Generated ${context.filesGenerated.length} files`);
    }
  }
});
```

**YAML Configuration Example**:
```yaml
# unjucks.yml
version: "1.0.0"
generators: "_templates"
defaultDest: "./src"

globalVariables:
  author: "John Doe"
  license: "MIT"
  
validation:
  componentName:
    pattern: "^[A-Z][a-zA-Z0-9]*$"
    message: "Component name must be PascalCase"
    
formatting:
  prettier: true
  eslint: true
```

### Generator-Level Configuration

Individual generators can have their own configuration:

```yaml
# _templates/component/config.yml
name: "component"
description: "Generate React components with TypeScript"

defaultVariables:
  withProps: true
  withTests: true
  exportType: "default"

templates:
  - name: "react"
    description: "React functional component"
  - name: "class"
    description: "React class component (legacy)"

prompts:
  componentName:
    message: "Component name:"
    type: "input"
    required: true
    validate: "^[A-Z][a-zA-Z0-9]*$"
```

## Safety Features

### Dry Run Mode

Preview exactly what will be generated without creating files:

```bash
unjucks generate component react --dry --componentName=Button

📋 Dry Run Preview:

Would generate 3 files:
├── 📄 src/components/Button/index.tsx (142 bytes)
│   └── export { Button } from './Button';
├── 📄 src/components/Button/Button.tsx (856 bytes)  
│   └── React functional component with props interface
└── 📄 src/components/Button/Button.test.tsx (324 bytes)
    └── Jest test suite with basic rendering test

No files were created. Use without --dry to generate.
```

### Conflict Detection

The CLI detects existing files and prevents accidental overwrites:

```bash
$ unjucks generate component react --componentName=Button --dest=./src

⚠️  Conflicts detected:
├── 📄 src/components/Button/index.tsx (exists)
└── 📄 src/components/Button/Button.tsx (exists)

Choose action:
  [s] Skip conflicting files
  [o] Overwrite all files  
  [r] Review each conflict
  [c] Cancel generation

? Action (s/o/r/c): r

📄 src/components/Button/index.tsx
Current content (3 lines):
export { Button } from './Button';
export type { ButtonProps } from './Button';

New content (2 lines):  
export { Button } from './Button';

? Overwrite this file? (y/N/d/e): d
[Content diff shown...]

? Overwrite this file? (y/N): n
⏭️  Skipped src/components/Button/index.tsx
```

### Force Mode

Override safety checks when intentional:

```bash
# Force overwrite all conflicting files
unjucks generate component react --componentName=Button --force

# Combine with dry run to see what would be overwritten  
unjucks generate component react --componentName=Button --force --dry
```

## Advanced CLI Features

### Environment Variables

Control CLI behavior through environment variables:

```bash
# Customize templates directory
UNJUCKS_TEMPLATES_DIR=./my-templates unjucks list

# Disable interactive prompts (for CI/CD)
UNJUCKS_NO_PROMPTS=true unjucks generate component react --dest=./src

# Enable debug logging
UNJUCKS_DEBUG=true unjucks generate command citty --commandName=test

# Set default destination
UNJUCKS_DEFAULT_DEST=./src unjucks generate component react
```

### Batch Operations

Generate multiple items efficiently:

```bash
# Generate multiple components
for name in Button Input Modal Alert; do
  unjucks generate component react --componentName=$name --dest=./src/components
done

# Using parameter expansion
unjucks generate component react --componentName={Button,Input,Modal} --dest=./src
```

### Pipeline Integration

The CLI integrates well with build pipelines and automation:

```bash
# CI/CD friendly (no prompts, exit codes)
UNJUCKS_NO_PROMPTS=true unjucks generate api endpoint \
  --endpointName=users \
  --withAuth \
  --httpMethods='["GET", "POST", "PUT", "DELETE"]' \
  --dest=./src/api || exit 1

# Return structured output for parsing
unjucks generate component react --componentName=Button --json
```

### Exit Codes

The CLI uses semantic exit codes for automation:

| Code | Description | Usage |
|------|-------------|-------|
| 0 | Success | Generation completed successfully |
| 1 | General error | Template not found, syntax error |
| 2 | Validation error | Invalid variable values |
| 3 | File system error | Permission denied, disk full |
| 4 | User cancellation | User chose to cancel operation |

## Troubleshooting

### Common Issues and Solutions

**Template not found:**
```bash
Error: Template 'react' not found in generator 'component'

# Solutions:
unjucks list --verbose  # Check available templates
ls _templates/component/ # Verify template exists
```

**Variable validation errors:**
```bash
Error: Required variable 'componentName' not provided

# Solutions:  
unjucks help component react  # See required variables
unjucks generate component react --componentName=MyComponent
```

**File permission errors:**
```bash  
Error: Permission denied writing to './protected/file.ts'

# Solutions:
chmod +w ./protected/        # Fix permissions
unjucks generate ... --dest=./writable/  # Different destination
```

**Template syntax errors:**
```bash
Error: Template syntax error in react.njk:15: unexpected token

# Solutions:
# Check template syntax with --dry first
unjucks generate component react --dry --componentName=Test
```

### Debug Mode

Enable detailed logging for troubleshooting:

```bash
UNJUCKS_DEBUG=true unjucks generate component react --componentName=Button

🔍 Debug Information:
├── Template discovery: _templates/component/react.njk (found)
├── Variable extraction: componentName, withProps, withTests (3 found)
├── Variable inference: 
│   ├── componentName: string (required)
│   ├── withProps: boolean (default: true)
│   └── withTests: boolean (default: true)
├── Frontmatter parsing: 3 operations configured
├── Template compilation: success
├── Variable validation: passed
├── Content rendering: 2 files queued
└── File operations: 2 writes, 0 injections
```

The CLI Interface provides a seamless experience from template creation to file generation, adapting dynamically to your templates while maintaining safety and providing helpful feedback throughout the process.