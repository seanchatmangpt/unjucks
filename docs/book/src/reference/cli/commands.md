# CLI Reference - Complete Command Documentation

This comprehensive reference covers all Unjucks CLI commands, their options, arguments, and usage patterns.

## Table of Contents

- [Global Options](#global-options)
- [Command Overview](#command-overview)  
- [Command Details](#command-details)
- [Exit Codes](#exit-codes)
- [Environment Variables](#environment-variables)
- [Examples](#examples)

## Global Options

These options are available for all commands:

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--version` | `-v` | boolean | false | Show version information |
| `--help` | `-h` | boolean | false | Show help information |
| `--verbose` | `-V` | boolean | false | Enable verbose logging |
| `--quiet` | `-q` | boolean | false | Suppress non-essential output |

## Command Overview

| Command | Purpose | Since |
|---------|---------|-------|
| `generate` | Generate files from templates | 1.0.0 |
| `list` | List available generators and templates | 1.0.0 |
| `init` | Initialize project with scaffolding | 1.0.0 |
| `inject` | Inject content into existing files | 1.0.0 |
| `help` | Show template variable help | 1.0.0 |
| `semantic` | Generate code from RDF/OWL ontologies | 1.0.0 |
| `version` | Show version information | 1.0.0 |

## Command Details

### `unjucks generate`

Generate files from templates with intelligent scaffolding.

#### Syntax
```bash
# Positional syntax (Hygen-style)
unjucks generate <generator> <template> [name] [args...]

# Explicit syntax  
unjucks generate --generator <generator> --template <template>
```

#### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `generator` | string | false | Name of the generator to use |
| `template` | string | false | Name of the template within the generator |
| `name` | string | false | Name/identifier for the generated entity |

#### Options

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--dest` | | string | "." | Destination directory for generated files |
| `--force` | `-f` | boolean | false | Overwrite existing files without confirmation |
| `--dry` | | boolean | false | Preview mode - show what would be generated |
| `--backup` | `-b` | boolean | false | Create backup copies before overwriting |
| `--skip-prompts` | `-y` | boolean | false | Skip interactive prompts and use defaults |
| `--verbose` | `-v` | boolean | false | Enable verbose logging |
| `--quiet` | `-q` | boolean | false | Suppress non-essential output |

#### Dynamic Arguments

Templates can define custom arguments that become CLI flags:

```bash
# Template defines: withTests, componentType
unjucks generate component react Button --withTests --componentType=functional
```

#### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Validation error (missing args, invalid paths) |
| 2 | Template not found |
| 3 | File system error |
| 4 | Generation failed |

#### Examples

```bash
# Interactive mode
unjucks generate

# Direct generation
unjucks generate component react MyButton --withTests --dest src/components

# Dry run to preview
unjucks generate api express UserService --dry

# Force overwrite with backup  
unjucks generate model sequelize User --force --backup

# Positional arguments (Hygen-style)
unjucks generate component react MyButton
unjucks component react MyButton  # Shorthand
```

### `unjucks list`

List available generators and templates with filtering options.

#### Syntax
```bash
unjucks list [generator]
```

#### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `generator` | string | false | Name of specific generator to list templates for |

#### Options

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--category` | `-c` | string | | Filter by category |
| `--search` | `-s` | string | | Search generators/templates by name |
| `--format` | `-f` | string | "table" | Output format (table, json, yaml, simple) |
| `--sort` | | string | "name" | Sort by field (name, modified, created, usage) |
| `--direction` | `-d` | string | "asc" | Sort direction (asc, desc) |
| `--detailed` | `-D` | boolean | false | Show detailed information |
| `--stats` | | boolean | false | Include usage statistics |
| `--quiet` | `-q` | boolean | false | Suppress headers and formatting |
| `--verbose` | `-v` | boolean | false | Show verbose output |

#### Output Formats

**Table Format (default)**
```bash
┌─────────────┬────────────────────────────┬─────────────────┐
│ Generator   │ Description                │ Templates       │
├─────────────┼────────────────────────────┼─────────────────┤
│ component   │ Generate React components  │ react, vue      │
│ api         │ Generate API endpoints     │ express, fastify│
└─────────────┴────────────────────────────┴─────────────────┘
```

**JSON Format**
```json
[
  {
    "name": "component",
    "description": "Generate React components",
    "templates": [
      {
        "name": "react",
        "description": "React functional component",
        "variables": ["name", "withTests"],
        "outputs": ["Component.tsx", "Component.test.tsx"]
      }
    ]
  }
]
```

#### Examples

```bash
# List all generators
unjucks list

# List templates for specific generator
unjucks list component

# Search generators
unjucks list --search react

# JSON output for automation
unjucks list --format json

# Detailed view with variables
unjucks list --detailed

# Sort by usage
unjucks list --sort usage --direction desc
```

### `unjucks init`

Initialize a new project with comprehensive scaffolding.

#### Syntax
```bash
unjucks init [type]
```

#### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | false | Type of project to initialize |

#### Project Types

| Type | Description |
|------|-------------|
| `node-library` | Node.js library with TypeScript |
| `node-cli` | Node.js CLI application |
| `express-api` | Express.js REST API |
| `fastify-api` | Fastify REST API |
| `nestjs-api` | NestJS application |
| `react-app` | React application |
| `next-app` | Next.js application |
| `vue-app` | Vue.js application |
| `svelte-app` | SvelteKit application |
| `astro-app` | Astro application |

#### Options

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--dest` | | string | "." | Destination directory |
| `--name` | `-n` | string | | Project name |
| `--description` | `-d` | string | | Project description |
| `--git` | | boolean | true | Initialize Git repository |
| `--install` | `-i` | boolean | true | Install dependencies |
| `--skip-prompts` | `-y` | boolean | false | Skip interactive prompts |
| `--source` | `-s` | string | | Template source |
| `--force` | `-f` | boolean | false | Overwrite existing files |
| `--verbose` | `-v` | boolean | false | Enable verbose logging |
| `--quiet` | `-q` | boolean | false | Suppress non-essential output |

#### Examples

```bash
# Interactive initialization
unjucks init

# Direct project type
unjucks init node-cli --name my-cli --git --install

# Custom destination
unjucks init react-app --dest ./my-app --description "My React application"

# Skip prompts with defaults
unjucks init --skip-prompts --type node-library
```

### `unjucks inject`

Inject or modify content in existing files with precision control.

#### Syntax
```bash
unjucks inject <file> [options]
```

#### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `file` | string | true | Target file to modify |

#### Options

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--content` | `-c` | string | | Content to inject directly |
| `--template` | `-t` | string | | Template name to render and inject |
| `--generator` | `-g` | string | | Generator containing the template |
| `--mode` | `-m` | string | "inject" | Injection mode |
| `--target` | `-T` | string | | Target marker/pattern for injection |
| `--line` | `-l` | number | | Line number for line-based injection |
| `--force` | `-f` | boolean | false | Overwrite without confirmation |
| `--dry` | | boolean | false | Preview changes without modifying |
| `--backup` | `-b` | boolean | false | Create backup before modifying |
| `--skip-if` | `-s` | string | | Skip injection if condition is met |
| `--verbose` | `-v` | boolean | false | Enable verbose logging |
| `--quiet` | `-q` | boolean | false | Suppress non-essential output |

#### Injection Modes

| Mode | Description |
|------|-------------|
| `inject` | Smart injection near target or at line |
| `append` | Add content to end of file |
| `prepend` | Add content to beginning of file |  
| `before` | Insert content before target marker |
| `after` | Insert content after target marker |
| `replace` | Replace content matching target |

#### Examples

```bash
# Append content to a file
unjucks inject --file src/app.js --content "console.log('injected');" --mode append

# Inject using template
unjucks inject --file package.json --template dependency --generator node --mode inject --target "dependencies"

# Insert at specific line
unjucks inject --file src/index.ts --content "import { Logger } from './logger';" --mode inject --line 3

# Dry run to preview
unjucks inject --file config.js --template config-update --dry

# With backup
unjucks inject --file important.json --content '{"newKey": "value"}' --mode replace --backup
```

### `unjucks help`

Show template variable help and positional parameter information.

#### Syntax
```bash
unjucks help <generator> <template>
```

#### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `generator` | string | true | Generator name |
| `template` | string | true | Template name |

#### Examples

```bash
# Show help for specific template
unjucks help component react

# Shows output like:
# Positional Parameters:
#   name (string, required) - Component name
#   
# Flag Parameters:
#   --withTests (boolean) - Include test files
#   --componentType (string) - Component type (functional, class)
```

### `unjucks semantic`

Generate code from RDF/OWL ontologies with semantic awareness.

#### Syntax
```bash
unjucks semantic <command> [options]
```

#### Subcommands

| Command | Description |
|---------|-------------|
| `generate` | Generate code from semantic templates |
| `types` | Generate TypeScript types from RDF ontology |
| `scaffold` | Scaffold complete application from ontology |
| `validate` | Validate RDF ontology and generated code |

#### `semantic generate` Options

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--ontology` | `-o` | string | | Path to RDF/OWL ontology file |
| `--templates` | `-t` | string | "_templates" | Template directory path |
| `--output` | `-out` | string | "./generated" | Output directory |
| `--enterprise` | `-e` | boolean | false | Enable enterprise scaffolding |
| `--types` | | boolean | true | Generate TypeScript interfaces |
| `--schemas` | | boolean | true | Generate Zod validation schemas |
| `--validators` | | boolean | true | Generate validation helpers |
| `--tests` | | boolean | false | Generate test suites |
| `--docs` | | boolean | false | Generate documentation |
| `--validate` | | boolean | true | Validate generated output |
| `--cross-package` | | boolean | false | Enable cross-package type sharing |
| `--watch` | `-w` | boolean | false | Watch for changes and regenerate |

#### Examples

```bash
# Generate from ontology
unjucks semantic generate --ontology schema.ttl --enterprise

# Generate TypeScript types only
unjucks semantic types --ontology schema.ttl --output ./types

# Scaffold complete application
unjucks semantic scaffold --ontology schema.ttl --name MyApp --template fullstack

# Validate ontology
unjucks semantic validate --ontology schema.ttl --generated ./generated
```

### `unjucks version`

Show version information.

#### Syntax
```bash
unjucks version
```

#### Output Format
```
1.0.0
```

## Exit Codes

Unjucks follows standard Unix exit code conventions:

| Code | Meaning | Description |
|------|---------|-------------|
| 0 | Success | Command completed successfully |
| 1 | General Error | Unknown or general error |
| 2 | Misuse | Invalid command line arguments |
| 3 | File Not Found | Required file or directory not found |
| 4 | Permission Denied | Insufficient permissions |
| 5 | Template Error | Template parsing or rendering error |
| 6 | Validation Error | Input validation failed |
| 7 | Network Error | Network-related error (downloads, etc.) |
| 8 | Configuration Error | Configuration file error |

## Environment Variables

Unjucks recognizes these environment variables:

| Variable | Type | Description | Default |
|----------|------|-------------|---------|
| `UNJUCKS_TEMPLATES_DIR` | string | Default templates directory | "_templates" |
| `UNJUCKS_CONFIG_FILE` | string | Configuration file path | "unjucks.yml" |
| `UNJUCKS_CACHE_DIR` | string | Cache directory location | ".unjucks-cache" |
| `UNJUCKS_FORCE_COLOR` | boolean | Force color output | false |
| `UNJUCKS_NO_COLOR` | boolean | Disable color output | false |
| `DEBUG_UNJUCKS` | boolean | Enable debug logging | false |
| `UNJUCKS_TELEMETRY` | boolean | Enable telemetry collection | true |
| `NODE_ENV` | string | Environment mode | "development" |

## Dynamic Argument Generation

Unjucks automatically generates CLI arguments based on template variables:

### Template Analysis
When you run a command, Unjucks scans the template files to discover:
- Variable names and types
- Default values
- Required/optional status  
- Descriptions from comments

### Argument Types

| Template Type | CLI Type | Example |
|---------------|----------|---------|
| `string` | string | `--name="MyComponent"` |
| `boolean` | boolean | `--withTests` |
| `number` | number | `--port=3000` |
| `array` | repeated | `--tags=frontend --tags=react` |

### Type Inference

Unjucks performs intelligent type inference:

```nunjucks
{# String variable #}
{{ name }}

{# Boolean variable (if/unless context) #}
{% if withTests %}

{# Number variable (arithmetic context) #}
{{ port + 1000 }}

{# Array variable (loop context) #}  
{% for tag in tags %}
```

### Positional Parameter Mapping

Common variable names are automatically mapped to positional parameters:

| Variable | Position | Description |
|----------|----------|-------------|
| `name` | 1st | Primary entity name |
| `type` | 2nd | Entity type or variant |
| `destination` | 3rd | Output location |

## Advanced Usage Patterns

### Chaining Commands

```bash
# Initialize, then generate
unjucks init node-cli --name my-tool && \
unjucks generate command citty MainCommand --dest src/commands

# Generate and inject  
unjucks generate model user User --dry && \
unjucks inject package.json --template deps --generator node
```

### Batch Operations

```bash
# Generate multiple components
for name in Header Footer Sidebar; do
  unjucks generate component react "$name" --dest src/components
done

# List and generate
unjucks list component | grep -E "(react|vue)" | while read template; do
  unjucks generate component "$template" "My$template" 
done
```

### Configuration-driven Generation

```bash
# Use config file for default values
export UNJUCKS_CONFIG_FILE="./project.unjucks.yml"
unjucks generate component react Button  # Uses config defaults

# Environment-specific generation  
NODE_ENV=production unjucks generate config docker Production
```

### Error Handling in Scripts

```bash
#!/bin/bash
set -e  # Exit on any error

if ! unjucks list | grep -q "component"; then
  echo "Component generator not found"
  exit 1
fi

unjucks generate component react "$1" --dest src/components || {
  echo "Generation failed for $1"
  exit 1
}

echo "Successfully generated component $1"
```

## Performance Tips

### Template Caching
- First run analyzes and caches template variables
- Subsequent runs use cached analysis for faster execution
- Clear cache with `rm -rf .unjucks-cache` if needed

### Batch Generation
- Use `--quiet` flag for batch operations to reduce output
- Consider `--skip-prompts` for automated scripts
- Use `--dry` first to validate before actual generation

### Large Projects
- Use `--verbose` sparingly (only for debugging)
- Configure appropriate `UNJUCKS_CACHE_DIR` on fast storage
- Consider template organization for better discovery performance