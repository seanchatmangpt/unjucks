# Getting Started with Unjucks

This guide will help you get up and running with Unjucks quickly. You'll learn how to install, configure, and create your first templates.

## Installation

### Global Installation

```bash
npm install -g unjucks
```

### Local Installation

```bash
npm install --save-dev unjucks
```

### Using with npx

```bash
npx unjucks --help
```

## Your First Project

### 1. Initialize a New Project

```bash
# Create a new directory
mkdir my-cli-project
cd my-cli-project

# Initialize with Unjucks templates
unjucks init --type cli --dest .
```

This creates:
- `_templates/` directory with example generators
- `unjucks.yml` configuration file
- Example templates for CLI commands

### 2. Explore Available Generators

```bash
# List all generators
unjucks list
```

Expected output:
```
📦 Available Generators:

command
├── citty - Citty command with subcommands
└── Description: Generate Citty CLI commands

cli
└── citty - Citty CLI application
    Description: Generate CLI applications
```

### 3. Generate Your First Command

```bash
# Generate a new CLI command
unjucks generate command citty --commandName=user --withTests --withSubcommands --dest=./src
```

This will:
1. Scan the template for variables
2. Use provided CLI arguments
3. Generate files based on the template

### 4. Check What Was Generated

```bash
# See the generated files
ls -la src/
```

You should see:
- `User.ts` - Main command file
- `User.test.ts` - Test file (if --withTests was used)

## Understanding Templates

### Template Structure

```
_templates/
├── command/              # Generator name
│   ├── config.yml       # Generator configuration
│   └── citty/           # Template name
│       ├── {{ commandName | pascalCase }}.ts
│       └── {{ commandName | pascalCase }}.test.ts
└── cli/
    ├── config.yml
    └── citty/
        ├── cli.ts
        └── package.json
```

### Template Variables

Variables in templates use Nunjucks syntax:
```typescript
// In template: {{ commandName | pascalCase }}.ts
export const {{ commandName | pascalCase }}Command = defineCommand({
  meta: {
    name: "{{ commandName | kebabCase }}",
    description: "{{ commandName | titleCase }} command",
  },
  // ... rest of template
});
```

### Custom Filters

Unjucks includes powerful filters for string transformation:

- `{{ name | camelCase }}` - `myCommand`
- `{{ name | pascalCase }}` - `MyCommand`
- `{{ name | kebabCase }}` - `my-command`
- `{{ name | snakeCase }}` - `my_command`
- `{{ name | titleCase }}` - `My Command`
- `{{ name | pluralize }}` - `commands`
- `{{ name | singularize }}` - `command`

## Configuration

### Basic Configuration

Create or edit `unjucks.yml` in your project root:

```yaml
version: "1.0.0"
generators: "_templates"
```

### Generator Configuration

Each generator can have a `config.yml` file:

```yaml
name: "command"
description: "Generate CLI commands"
templates:
  - name: "citty"
    description: "Citty command with subcommands"
    files:
      - "{{ commandName | pascalCase }}.ts"
      - "{{ commandName | pascalCase }}.test.ts"
    prompts:
      - name: "commandName"
        message: "Command name:"
        type: "input"
        default: "myCommand"
      - name: "withTests"
        message: "Include tests?"
        type: "confirm"
        default: true
      - name: "withSubcommands"
        message: "Include subcommands?"
        type: "confirm"
        default: false
```

## Advanced Usage

### Interactive Mode

If you don't provide all required variables, Unjucks will prompt you:

```bash
# This will prompt for missing variables
unjucks generate command citty --dest=./src
```

### Dry Run Mode

Test what would be generated without creating files:

```bash
unjucks generate command citty --dry --commandName=test --dest=./src
```

### Force Overwrite

Overwrite existing files without prompting:

```bash
unjucks generate command citty --force --commandName=user --dest=./src
```

### Get Help for Templates

See available variables and options for a specific template:

```bash
unjucks help command citty
```

## Creating Custom Templates

### 1. Create a New Generator

```bash
mkdir -p _templates/component/react
```

### 2. Create Template Files

```typescript
// _templates/component/react/{{ componentName | pascalCase }}.tsx
import React from 'react';

interface {{ componentName | pascalCase }}Props {
  {% if withProps %}
  // Add your props here
  {% endif %}
}

export const {{ componentName | pascalCase }}: React.FC<{{ componentName | pascalCase }}Props> = (props) => {
  return (
    <div>
      <h1>{{ componentName | titleCase }}</h1>
    </div>
  );
};
```

### 3. Create Generator Config

```yaml
# _templates/component/config.yml
name: "component"
description: "Generate React components"
templates:
  - name: "react"
    description: "React functional component"
    files:
      - "{{ componentName | pascalCase }}.tsx"
    prompts:
      - name: "componentName"
        message: "Component name:"
        type: "input"
      - name: "withProps"
        message: "Include props interface?"
        type: "confirm"
        default: true
```

### 4. Test Your Template

```bash
unjucks generate component react --componentName=Button --withProps --dest=./src/components
```

## Best Practices

### Template Organization

1. **Use descriptive generator names** - `component`, `service`, `page`
2. **Group related templates** - Put all React components under `component/`
3. **Include configuration** - Always add `config.yml` for better UX

### Variable Naming

1. **Use camelCase for variable names** - `componentName`, `withTests`
2. **Be descriptive** - `includeStyles` vs `styles`
3. **Use boolean flags** - `withTests`, `includeProps`

### File Naming

1. **Use template variables in filenames** - `{{ name | pascalCase }}.ts`
2. **Match project conventions** - Follow your project's naming patterns
3. **Include file extensions** - Always specify the correct extension

## Common Patterns

### Conditional Content

```typescript
{% if withTests %}
import { describe, it, expect } from 'vitest';

describe('{{ componentName | pascalCase }}', () => {
  it('should render', () => {
    expect(true).toBe(true);
  });
});
{% endif %}
```

### Loop Content

```typescript
{% for method in methods %}
  {{ method | camelCase }}() {
    // Implementation here
  }
{% endfor %}
```

### File Path Variables

```typescript
// Template: _templates/feature/crud/{{ featureName | kebabCase }}/service.ts
// Generated: src/user-management/service.ts
```

## Next Steps

1. **Explore the [CLI Reference](cli/README.md)** - Learn all available commands and options
2. **Read [Template Development](templates/README.md)** - Deep dive into advanced template features
3. **Check [API Documentation](api/README.md)** - Use Unjucks programmatically
4. **See [Testing Guide](testing/README.md)** - Learn about the BDD test suite

## Troubleshooting

### Template Not Found

```bash
Error: Template 'react' not found in generator 'component'
```

**Solution**: Ensure the template directory exists and has files:
```bash
ls -la _templates/component/react/
```

### Variables Not Recognized

If variables aren't being detected, check:
1. Template syntax: `{{ variableName }}` not `{variableName}`
2. File permissions on template files
3. Template directory structure

### Permission Errors

```bash
Error: EACCES: permission denied
```

**Solution**: Ensure you have write permissions to the destination directory.

---

*Need help? Check out our [troubleshooting guide](cli/README.md#troubleshooting) or [open an issue](https://github.com/unjs/unjucks/issues).*