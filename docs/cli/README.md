# CLI Reference

Complete command line interface reference for Unjucks v1.0.

## Overview

Unjucks provides a Hygen-style CLI for generating files from templates. The CLI automatically discovers generators and templates, extracts variables, and provides dynamic help.

```bash
unjucks <command> [options]
```

## Global Options

All commands support these global options:

| Option | Description | Default |
|--------|-------------|---------|
| `--help`, `-h` | Show help information | - |
| `--version`, `-v` | Show version information | - |

## Commands

### `unjucks` (Default)

Show available commands and usage information.

```bash
unjucks
```

**Output:**
```
🌆 Unjucks CLI
A Hygen-style CLI generator for creating templates and scaffolding projects

Available commands:
  generate  Generate files from templates
  list      List available generators
  init      Initialize a new project
  help      Show template variable help
  version   Show version information

Use --help with any command for more information.
```

### `unjucks generate <generator> <template>`

Generate files from a template.

#### Syntax

```bash
unjucks generate <generator> <template> [options] [variables...]
```

#### Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `generator` | Generator name (e.g., `component`, `command`) | Yes |
| `template` | Template name (e.g., `react`, `citty`) | Yes |

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dest <path>` | Destination directory | Current directory |
| `--dry` | Preview changes without writing files | `false` |
| `--force` | Overwrite existing files without prompting | `false` |

#### Dynamic Variables

Variables are automatically extracted from templates and become CLI options. For example, if a template uses `{{ componentName }}`, the CLI will accept:

```bash
--componentName <value>
--component-name <value>  # kebab-case alternative
```

#### Examples

**Basic generation:**
```bash
unjucks generate command citty --commandName=user --dest=./src
```

**With all options:**
```bash
unjucks generate component react \
  --componentName=Button \
  --withProps \
  --withTests \
  --dest=./src/components \
  --force
```

**Dry run (preview only):**
```bash
unjucks generate command citty --dry --commandName=test
```

**Interactive mode (prompts for missing variables):**
```bash
unjucks generate component react --dest=./src
```

#### Variable Types

Variables are automatically typed based on usage:

- **String** - Default type for all variables
- **Boolean** - Variables starting with `with`, `has`, `is`, `should`, `include`
- **Array** - Variables containing brackets or array syntax

#### Variable Naming Conventions

Variables support multiple naming formats:

```bash
# These are all equivalent:
--componentName Button
--component-name Button
--COMPONENT_NAME Button
```

### `unjucks list`

List all available generators and templates.

#### Syntax

```bash
unjucks list [options]
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--verbose`, `-v` | Show detailed information | `false` |

#### Examples

**Basic listing:**
```bash
unjucks list
```

**Output:**
```
📦 Available Generators:

command
├── citty - Citty command with subcommands
└── Description: Generate Citty CLI commands

cli
└── citty - Citty CLI application
    Description: Generate CLI applications
```

**Verbose listing:**
```bash
unjucks list --verbose
```

**Verbose Output:**
```
📦 Available Generators:

command (Generate Citty CLI commands)
├── 📁 Templates:
│   └── citty
│       ├── 📄 {{ commandName | pascalCase }}.ts
│       └── 📄 {{ commandName | pascalCase }}.test.ts
├── 🔧 Variables:
│   ├── commandName (string) - Command name
│   ├── withTests (boolean) - Include tests
│   └── withSubcommands (boolean) - Include subcommands
└── 📍 Location: _templates/command/
```

### `unjucks init`

Initialize a new project with template generators.

#### Syntax

```bash
unjucks init [options]
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--type <type>` | Project type | Prompts if not provided |
| `--dest <path>` | Destination directory | Current directory |

#### Supported Project Types

- `cli` - CLI application with command generators
- `component` - Component library with React/Vue templates
- `service` - Backend service with API templates
- `fullstack` - Full-stack application with multiple generators

#### Examples

**Interactive initialization:**
```bash
unjucks init
```

**CLI project:**
```bash
unjucks init --type cli --dest ./my-cli
```

**Component library:**
```bash
unjucks init --type component --dest ./my-components
```

#### Generated Structure

For `--type cli`:
```
my-cli/
├── _templates/
│   ├── command/
│   │   ├── config.yml
│   │   └── citty/
│   │       ├── {{ commandName | pascalCase }}.ts
│   │       └── {{ commandName | pascalCase }}.test.ts
│   └── cli/
│       ├── config.yml
│       └── citty/
│           ├── cli.ts
│           └── package.json
└── unjucks.yml
```

### `unjucks help <generator> <template>`

Show detailed help for a specific template, including available variables.

#### Syntax

```bash
unjucks help <generator> <template>
```

#### Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `generator` | Generator name | Yes |
| `template` | Template name | Yes |

#### Examples

**Show template help:**
```bash
unjucks help command citty
```

**Output:**
```
📋 Template Help: command/citty

📝 Description:
Citty command with subcommands

🔧 Variables:
┌─────────────────┬─────────┬─────────────┬─────────────────────────────────┐
│ Name            │ Type    │ Default     │ Description                     │
├─────────────────┼─────────┼─────────────┼─────────────────────────────────┤
│ commandName     │ string  │ myCommand   │ Command name                    │
│ withTests       │ boolean │ true        │ Include test files              │
│ withSubcommands │ boolean │ true        │ Include subcommand structure    │
└─────────────────┴─────────┴─────────────┴─────────────────────────────────┘

📄 Files:
├── {{ commandName | pascalCase }}.ts - Main command file
└── {{ commandName | pascalCase }}.test.ts - Test file (if withTests)

💡 Usage:
unjucks generate command citty --commandName MyCommand --withTests --withSubcommands --dest ./src

🎯 Example:
unjucks generate command citty --commandName user --dest ./src/commands
```

### `unjucks version`

Show version information.

#### Syntax

```bash
unjucks version
```

#### Output

```
unjucks v1.0.0
Node.js v18.17.0
Platform: darwin arm64
```

## Configuration

### Project Configuration

Unjucks looks for configuration in these locations (in order):

1. `unjucks.yml`
2. `unjucks.yaml`
3. `unjucks.json`
4. `package.json` (under `unjucks` key)

#### Configuration Schema

```yaml
# unjucks.yml
version: "1.0.0"
generators: "_templates"  # Templates directory
```

#### Package.json Configuration

```json
{
  "name": "my-project",
  "unjucks": {
    "generators": "_templates"
  }
}
```

### Generator Configuration

Each generator can have a `config.yml` file:

```yaml
# _templates/component/config.yml
name: "component"
description: "Generate React components"
templates:
  - name: "react"
    description: "React functional component"
    files:
      - "{{ componentName | pascalCase }}.tsx"
      - "{{ componentName | pascalCase }}.test.tsx"
    prompts:
      - name: "componentName"
        message: "Component name:"
        type: "input"
        default: "MyComponent"
      - name: "withProps"
        message: "Include props interface?"
        type: "confirm"
        default: true
      - name: "withTests"
        message: "Include test file?"
        type: "confirm"
        default: true
```

## Template Discovery

Unjucks automatically discovers templates using this process:

1. **Find template directory** - Looks for `_templates` or `templates` directory starting from current directory and walking up to package.json
2. **Scan generators** - Each subdirectory in the templates directory is a generator
3. **Scan templates** - Each subdirectory in a generator is a template
4. **Load configuration** - Reads `config.yml` if present, otherwise uses auto-discovery

### Directory Structure

```
_templates/
├── generator1/           # Generator name
│   ├── config.yml       # Optional generator config
│   ├── template1/       # Template name
│   │   ├── file1.txt    # Template files
│   │   └── file2.ts
│   └── template2/
│       └── file3.tsx
└── generator2/
    └── template3/
        └── file4.js
```

## Variable Extraction

Variables are automatically extracted from templates using these patterns:

### Nunjucks Variables

```typescript
{{ variableName }}           // String variable
{{ variableName | filter }}  // String with filter
```

### File Names

```typescript
// Template file: {{ componentName | pascalCase }}.tsx
// Variable: componentName (string)
```

### Boolean Variables

Variables are automatically detected as boolean if they:
- Start with: `with`, `has`, `is`, `should`, `include`, `enable`, `allow`
- Are used in conditional blocks: `{% if variableName %}`

### Array Variables

Variables containing array syntax or used in loops are detected as arrays:
```typescript
{{ methods[0] }}        // methods (array)
{% for item in items %} // items (array)
```

## Filters

Unjucks includes these built-in filters for string transformation:

### Case Conversion

- `{{ name | camelCase }}` - `myVariableName`
- `{{ name | pascalCase }}` - `MyVariableName`
- `{{ name | kebabCase }}` - `my-variable-name`
- `{{ name | snakeCase }}` - `my_variable_name`
- `{{ name | titleCase }}` - `My Variable Name`
- `{{ name | capitalize }}` - `My variable name`

### Pluralization

- `{{ name | pluralize }}` - `names` (name → names)
- `{{ name | singularize }}` - `name` (names → name)

### Examples

```typescript
// Template
export class {{ serviceName | pascalCase }}Service {
  private {{ serviceName | camelCase }}Repository;
  
  async create{{ serviceName | pascalCase }}() {
    // Implementation
  }
}

// Generated (serviceName: "user")
export class UserService {
  private userRepository;
  
  async createUser() {
    // Implementation
  }
}
```

## Error Handling

### Common Errors

**Template not found:**
```bash
Error: Template 'react' not found in generator 'component'
```

**Generator not found:**
```bash
Error: Generator 'component' not found
```

**Variable validation:**
```bash
Error: Required variable 'componentName' not provided
```

**File conflicts:**
```bash
Error: File 'Button.tsx' already exists. Use --force to overwrite
```

### Debugging

Use `--dry` flag to preview what would be generated:

```bash
unjucks generate component react --dry --componentName Button
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `UNJUCKS_TEMPLATES_DIR` | Templates directory | `_templates` |
| `UNJUCKS_CONFIG_FILE` | Configuration file path | Auto-discovery |
| `UNJUCKS_NO_PROMPTS` | Disable interactive prompts | `false` |

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Template/generator not found |
| 3 | Variable validation error |
| 4 | File system error |
| 5 | Configuration error |

## Advanced Usage

### Custom Template Directory

```bash
# Use custom templates directory
UNJUCKS_TEMPLATES_DIR=./my-templates unjucks list
```

### Non-Interactive Mode

```bash
# Disable prompts (use defaults or fail)
UNJUCKS_NO_PROMPTS=true unjucks generate component react --dest ./src
```

### Batch Generation

```bash
# Generate multiple components
for name in Button Input Modal; do
  unjucks generate component react --componentName $name --dest ./src/components
done
```

### Programmatic Usage

See [API Reference](../api/README.md) for programmatic usage.

## Troubleshooting

### Permission Errors

```bash
# Fix permissions
chmod -R 755 _templates/
```

### Template Syntax Errors

Validate Nunjucks syntax:
```bash
# Test template rendering
node -e "
  const nunjucks = require('nunjucks');
  console.log(nunjucks.renderString('{{ name | pascalCase }}', {name: 'test'}));
"
```

### Configuration Issues

Validate configuration:
```bash
# Check if config is valid YAML
npx yaml-validate unjucks.yml
```

---

*For more examples and advanced usage, see the [Getting Started Guide](../getting-started.md) and [Template Development Guide](../templates/README.md).*