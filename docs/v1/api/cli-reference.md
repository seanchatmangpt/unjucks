# CLI Reference

Complete command line interface for Unjucks v1.0.

## Installation

```bash
npm install -g unjucks
# or
npx unjucks <command>
```

## Quick Commands

```bash
# List generators
unjucks list

# Generate from template
unjucks generate <generator> <template> --dest ./src [variables...]

# Show template help
unjucks help <generator> <template>

# Initialize project
unjucks init --type cli
```

## Core Commands

### `unjucks generate`

Generate files from templates with automatic variable discovery.

```bash
unjucks generate <generator> <template> [options] [variables...]
```

**Arguments:**
- `generator` - Generator name (e.g., `component`, `command`)
- `template` - Template name (e.g., `react`, `citty`)

**Options:**
- `--dest <path>` - Destination directory (default: current directory)
- `--dry` - Preview changes without writing files
- `--force` - Overwrite existing files

**Examples:**

```bash
# Basic generation
unjucks generate command citty --commandName=user --dest=./src

# With all options
unjucks generate component react \
  --componentName=Button \
  --withProps \
  --withTests \
  --dest=./src/components \
  --force

# Dry run (preview only)
unjucks generate command citty --dry --commandName=test

# Interactive mode
unjucks generate component react --dest=./src
```

**Variable Types:**
- **String** - Default type: `--componentName Button`
- **Boolean** - Auto-detected: `--withProps` (true), `--no-withProps` (false)
- **Array** - JSON format: `--methods '["get", "post"]'`

**Variable Naming:**
All formats supported:
```bash
--componentName Button    # camelCase
--component-name Button   # kebab-case
--COMPONENT_NAME Button   # UPPER_CASE
```

### `unjucks list`

List available generators and templates.

```bash
unjucks list [--verbose]
```

**Basic output:**
```
📦 Available Generators:

command
├── citty - Citty command with subcommands
└── Description: Generate Citty CLI commands
```

**Verbose output (`--verbose`):**
```
command (Generate Citty CLI commands)
├── 📁 Templates:
│   └── citty
│       ├── 📄 {{ commandName | pascalCase }}.ts
│       └── 📄 {{ commandName | pascalCase }}.test.ts
├── 🔧 Variables:
│   ├── commandName (string) - Command name
│   └── withTests (boolean) - Include tests
└── 📍 Location: _templates/command/
```

### `unjucks help`

Show detailed template information and usage examples.

```bash
unjucks help <generator> <template>
```

**Example output:**
```
📋 Template Help: command/citty

📝 Description: Citty command with subcommands

🔧 Variables:
┌─────────────────┬─────────┬─────────────┬─────────────────────┐
│ Name            │ Type    │ Default     │ Description         │
├─────────────────┼─────────┼─────────────┼─────────────────────┤
│ commandName     │ string  │ myCommand   │ Command name        │
│ withTests       │ boolean │ true        │ Include test files  │
└─────────────────┴─────────┴─────────────┴─────────────────────┘

💡 Usage:
unjucks generate command citty --commandName MyCommand --dest ./src
```

### `unjucks init`

Initialize new project with template generators.

```bash
unjucks init [--type <type>] [--dest <path>]
```

**Project types:**
- `cli` - CLI application with command generators
- `component` - Component library with React/Vue templates
- `service` - Backend service with API templates
- `fullstack` - Full-stack application

**Examples:**
```bash
# Interactive
unjucks init

# CLI project
unjucks init --type cli --dest ./my-cli

# Component library
unjucks init --type component --dest ./my-components
```

## Variable System

### Auto-Detection

Variables are extracted from templates automatically:

```typescript
// Template: {{ componentName | pascalCase }}.tsx
// CLI: --componentName Button

// Template: {% if withProps %}
// CLI: --withProps (boolean)

// Template: {% for method in methods %}
// CLI: --methods '["get", "post"]' (array)
```

### Boolean Variables

Auto-detected by naming patterns:
- `with*`, `has*`, `is*`, `should*`, `include*`, `enable*`, `allow*`

```bash
# These create boolean flags
--withProps          # true
--no-withProps       # false
--hasTests           # true
--isPublic           # true
```

### Interactive Prompts

Missing variables trigger prompts:

```bash
$ unjucks generate component react --dest ./src
? Component name: Button
? Include props interface? (Y/n) y
? Include test file? (Y/n) y
```

## Configuration

### Project Config

Auto-discovered in this order:
1. `unjucks.yml`
2. `unjucks.yaml` 
3. `unjucks.json`
4. `package.json` (under `unjucks` key)

```yaml
# unjucks.yml
version: "1.0.0"
generators: "_templates"
```

### Generator Config

```yaml
# _templates/component/config.yml
name: "component"
description: "Generate React components"
templates:
  - name: "react"
    description: "React functional component"
    prompts:
      - name: "componentName"
        message: "Component name:"
        type: "input"
        default: "MyComponent"
      - name: "withProps"
        message: "Include props?"
        type: "confirm"
        default: true
```

## Template Filters

Built-in string transformation filters:

```typescript
// Case conversion
{{ name | camelCase }}    // myVariableName
{{ name | pascalCase }}   // MyVariableName
{{ name | kebabCase }}    // my-variable-name
{{ name | snakeCase }}    // my_variable_name
{{ name | capitalize }}   // My variable name

// Pluralization
{{ name | pluralize }}    // names
{{ name | singularize }}  // name
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `UNJUCKS_TEMPLATES_DIR` | Templates directory | `_templates` |
| `UNJUCKS_NO_PROMPTS` | Disable prompts | `false` |

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Template/generator not found |
| 3 | Variable validation error |
| 4 | File system error |

## Advanced Usage

### Batch Generation

```bash
# Generate multiple components
for name in Button Input Modal; do
  unjucks generate component react --componentName $name --dest ./src/components
done
```

### Custom Templates Directory

```bash
UNJUCKS_TEMPLATES_DIR=./my-templates unjucks list
```

### Non-Interactive Mode

```bash
UNJUCKS_NO_PROMPTS=true unjucks generate component react --dest ./src
```

## Troubleshooting

**Template not found:**
```bash
Error: Template 'react' not found in generator 'component'
# Solution: Check available templates with `unjucks list --verbose`
```

**File conflicts:**
```bash
Error: File 'Button.tsx' already exists. Use --force to overwrite
# Solution: Use --force or --dry to preview changes
```

**Variable validation:**
```bash
Error: Required variable 'componentName' not provided
# Solution: Provide via CLI flag or interactive prompt
```

### Debug Mode

Use `--dry` to preview what would be generated:

```bash
unjucks generate component react --dry --componentName Button
```

---

For programmatic usage, see the [Programmatic API](./programmatic-api.md) documentation.