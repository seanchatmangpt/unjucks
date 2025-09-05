# Configuration Reference

Unjucks provides flexible configuration options at multiple levels - project-wide settings, generator configuration, template frontmatter, and CLI options.

## Table of Contents

- [Project Configuration](#project-configuration)
- [Generator Configuration](#generator-configuration)
- [Template Frontmatter](#template-frontmatter)
- [CLI Configuration](#cli-configuration)
- [Environment Variables](#environment-variables)
- [Directory Structure](#directory-structure)
- [Configuration Precedence](#configuration-precedence)

## Project Configuration

### unjucks.config.js/ts

Create an `unjucks.config.js` or `unjucks.config.ts` file in your project root for project-wide settings:

```typescript
// unjucks.config.ts
export default {
  templatesDir: '_templates',
  defaultGenerator: 'component',
  variables: {
    author: 'Your Name',
    license: 'MIT'
  },
  filters: {
    // Custom Nunjucks filters
    upperSnake: (str: string) => str.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  }
}
```

```javascript
// unjucks.config.js
module.exports = {
  templatesDir: '_templates',
  defaultGenerator: 'component',
  variables: {
    author: 'Your Name',
    license: 'MIT'
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `templatesDir` | `string` | `'_templates'` | Directory containing generators |
| `defaultGenerator` | `string` | `undefined` | Default generator to use |
| `variables` | `object` | `{}` | Global template variables |
| `filters` | `object` | `{}` | Custom Nunjucks filters |

## Generator Configuration

Each generator can have a `config.yml` file defining its structure and behavior:

```yaml
# _templates/component/config.yml
name: component
description: React component generator
templates:
  - name: basic
    description: Basic functional component
    files:
      - "{{ componentName | pascalCase }}.tsx"
      - "{{ componentName | pascalCase }}.test.tsx"
    prompts:
      - name: componentName
        message: What is the component name?
        type: input
        default: MyComponent
      - name: withProps
        message: Include props interface?
        type: confirm
        default: true
      - name: testFramework
        message: Choose test framework
        type: list
        choices:
          - Jest
          - Vitest
          - React Testing Library
  - name: advanced
    description: Component with hooks and context
    files:
      - "{{ componentName | pascalCase }}.tsx"
      - "{{ componentName | pascalCase }}.test.tsx"
      - "{{ componentName | pascalCase }}.stories.tsx"
```

### Generator Configuration Schema

#### Root Level

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Generator name |
| `description` | `string` | No | Generator description |
| `templates` | `TemplateConfig[]` | Yes | Array of template configurations |

#### TemplateConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Template name |
| `description` | `string` | No | Template description |
| `files` | `string[]` | Yes | Template file patterns |
| `prompts` | `PromptConfig[]` | No | Interactive prompts |

#### PromptConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Variable name |
| `message` | `string` | Yes | Prompt message |
| `type` | `'input' \| 'confirm' \| 'list' \| 'checkbox'` | Yes | Prompt type |
| `default` | `any` | No | Default value |
| `choices` | `string[]` | No | Available choices (for list/checkbox) |

## Template Frontmatter

Control template behavior with YAML frontmatter at the top of template files:

```typescript
---
to: src/components/<%= componentName %>.tsx
inject: true
after: // INJECT_IMPORTS
skipIf: import.*<%= componentName %>
---
import { <%= componentName %> } from './<%= componentName %>';
```

### Frontmatter Configuration

#### File Operations

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `to` | `string` | Target file path (supports templates) | `src/<%= name %>.ts` |
| `inject` | `boolean` | Inject into existing file instead of creating new | `true` |
| `append` | `boolean` | Append to end of file | `true` |
| `prepend` | `boolean` | Prepend to beginning of file | `true` |

#### Injection Control

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `before` | `string` | Inject before this pattern | `// END_IMPORTS` |
| `after` | `string` | Inject after this pattern | `// INJECT_HERE` |
| `lineAt` | `number` | Inject at specific line number | `10` |
| `skipIf` | `string` | Skip if pattern exists in target file | `interface.*Props` |

#### System Operations

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `chmod` | `string \| number` | Set file permissions | `'755'` or `0o755` |
| `sh` | `string \| string[]` | Run shell commands after file creation | `['npm install', 'git add .']` |

### Frontmatter Examples

#### Basic File Creation
```yaml
---
to: src/utils/<%= name | kebabCase %>.ts
---
export function <%= name | camelCase %>() {
  // Implementation here
}
```

#### Code Injection
```yaml
---
to: src/index.ts
inject: true
after: // EXPORT_MARKER
skipIf: export.*<%= name %>
---
export { <%= name | camelCase %> } from './utils/<%= name | kebabCase %>';
```

#### Conditional Operations
```yaml
---
to: <%= withTests ? 'src/' + name + '.test.ts' : null %>
skipIf: <%= !withTests %>
---
import { <%= name %> } from './<%= name %>';

describe('<%= name %>', () => {
  it('should work', () => {
    expect(<%= name %>).toBeDefined();
  });
});
```

## CLI Configuration

### Global Flags

All commands support these flags:

| Flag | Type | Description | Default |
|------|------|-------------|---------|
| `--dry` | `boolean` | Show what would be generated without creating files | `false` |
| `--force` | `boolean` | Overwrite existing files without confirmation | `false` |
| `--dest` | `string` | Target directory for generated files | `'.'` |
| `--verbose` | `boolean` | Enable verbose output | `false` |

### Command-Specific Options

#### `unjucks generate`

```bash
unjucks generate <generator> <template> [options]
```

| Option | Type | Description |
|--------|------|-------------|
| `--dest` | `string` | Destination directory |
| `--force` | `boolean` | Force overwrite existing files |
| `--dry` | `boolean` | Dry run mode |

Dynamic options are generated from template variables:

```bash
# For a template with {{ componentName }} variable
unjucks generate component basic --componentName=Button --withProps=true
```

#### `unjucks list`

```bash
unjucks list [generator]
```

No additional options.

#### `unjucks init`

```bash
unjucks init [type] [options]
```

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--dest` | `string` | Target directory | `'.'` |
| `--force` | `boolean` | Overwrite existing files | `false` |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `UNJUCKS_TEMPLATES_DIR` | Override templates directory | `_templates` |
| `UNJUCKS_LOG_LEVEL` | Set logging level (error, warn, info, debug) | `info` |
| `UNJUCKS_NO_COLOR` | Disable colored output | `false` |

```bash
# Use custom templates directory
UNJUCKS_TEMPLATES_DIR=generators unjucks list

# Enable debug logging
UNJUCKS_LOG_LEVEL=debug unjucks generate component basic --name=Button
```

## Directory Structure

### Default Structure

```
project/
├── _templates/                 # Templates directory
│   ├── component/             # Generator directory
│   │   ├── config.yml         # Generator configuration
│   │   ├── basic/             # Template directory
│   │   │   ├── Component.tsx  # Template file
│   │   │   └── Component.test.tsx
│   │   └── advanced/
│   │       └── ...
│   └── service/
│       └── ...
├── unjucks.config.ts          # Project configuration
└── package.json
```

### Alternative Structure

```
project/
├── generators/                 # Alternative templates directory
├── templates/                  # Another alternative
├── .unjucksrc                 # Alternative config file
└── unjucks.config.json        # JSON configuration
```

### Templates Directory Discovery

Unjucks searches for templates in this order:

1. `--templates-dir` CLI flag
2. `UNJUCKS_TEMPLATES_DIR` environment variable
3. `templatesDir` in configuration file
4. `_templates` in current directory
5. `templates` in current directory
6. Walk up directory tree looking for `package.json` and adjacent templates

## Configuration Precedence

Configuration is resolved in this order (highest to lowest precedence):

1. **CLI arguments** - `--componentName=Button`
2. **Environment variables** - `UNJUCKS_TEMPLATES_DIR=generators`
3. **Project configuration** - `unjucks.config.ts`
4. **Generator configuration** - `_templates/component/config.yml`
5. **Template frontmatter** - `---\nto: ...\n---`
6. **Built-in defaults**

### Example Precedence

```bash
# CLI flag overrides everything
unjucks generate component basic --componentName=Button --dest=src/components

# Environment variable used if no CLI flag
UNJUCKS_TEMPLATES_DIR=generators unjucks generate component basic

# Project config used as fallback
# unjucks.config.ts: { templatesDir: 'custom-templates' }
```

## Advanced Configuration

### Custom Filters

Register custom Nunjucks filters:

```typescript
// unjucks.config.ts
export default {
  filters: {
    reverse: (str: string) => str.split('').reverse().join(''),
    slugify: (str: string) => str.toLowerCase().replace(/\s+/g, '-'),
    upperSnake: (str: string) => str.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  }
}
```

Use in templates:

```typescript
---
to: src/<%= name | slugify %>.ts
---
export const <%= name | upperSnake %> = '<%= name | reverse %>';
```

### Global Variables

Set variables available to all templates:

```typescript
// unjucks.config.ts
export default {
  variables: {
    author: process.env.USER || 'Anonymous',
    year: new Date().getFullYear(),
    license: 'MIT'
  }
}
```

Use in any template:

```typescript
/**
 * Created by <%= author %> in <%= year %>
 * Licensed under <%= license %>
 */
```

### Conditional Configuration

```typescript
// unjucks.config.ts
const isDev = process.env.NODE_ENV === 'development';

export default {
  templatesDir: isDev ? 'dev-templates' : '_templates',
  variables: {
    env: process.env.NODE_ENV,
    debug: isDev
  }
}
```

## Validation and Error Handling

### Configuration Validation

Unjucks validates configuration files on startup:

```yaml
# Invalid config.yml
name: component
templates:
  - name: basic
    # Missing required 'files' field - will show error
```

### Template Validation

Templates are validated during generation:

```typescript
---
to: <%= invalidVariable %>  # Error: undefined variable
inject: true
append: true                # Error: conflicting operations
---
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Templates directory not found" | Invalid templates path | Check `templatesDir` setting |
| "Generator not found" | Typo in generator name | Use `unjucks list` to see available generators |
| "Invalid YAML frontmatter" | Syntax error in frontmatter | Validate YAML syntax |
| "Variable not defined" | Missing template variable | Check variable names and prompts |

## Migration and Upgrades

### From v0.x to v1.x

Configuration file format changes:

```typescript
// Old format (v0.x)
module.exports = {
  templateRoot: 'generators'  // Renamed to templatesDir
}

// New format (v1.x)
export default {
  templatesDir: 'generators'
}
```

### Hygen Migration

Converting from Hygen templates:

```yaml
# Hygen _templates/component/new/config.yml
prompt: true

# Unjucks equivalent
name: component
templates:
  - name: new
    prompts:
      - name: name
        message: Component name?
        type: input
```

## Best Practices

### Configuration Organization

1. **Use TypeScript configuration** for type safety
2. **Group related generators** in the same directory
3. **Document custom filters** with JSDoc comments
4. **Version control configuration** files
5. **Use environment variables** for environment-specific settings

### Template Configuration

1. **Keep frontmatter minimal** - only what's necessary
2. **Use descriptive prompts** with good default values
3. **Validate inputs** with skipIf conditions
4. **Group related templates** in the same generator

### Performance

1. **Minimize template scanning** by organizing files well
2. **Use specific file patterns** instead of wildcards
3. **Cache frequently used variables** in project config
4. **Avoid deep directory nesting** in templates

This configuration reference provides comprehensive control over Unjucks behavior at every level, from project-wide settings to individual template operations.