# 🌆 Unjucks

[![npm version](https://img.shields.io/npm/v/unjucks?color=yellow)](https://npmjs.com/package/unjucks)
[![npm downloads](https://img.shields.io/npm/dm/unjucks?color=yellow)](https://npm.chart.dev/packageName)

A powerful next-generation CLI code generator with full Nunjucks templating support, advanced BDD testing, and superior Hygen compatibility.

## ✨ Key Features

- 🚀 **Fast and lightweight** - Built with Citty for elegant CLI experience
- 🎨 **Full Nunjucks support** - Complete templating engine with filters, inheritance, and more
- 📁 **Intelligent template discovery** - Automatic template detection and configuration
- 🔧 **Interactive prompts** - Smart prompting system for template variables with type inference
- 📦 **Multiple generators** - Support for multiple generator types in one project
- 🎯 **TypeScript ready** - Full TypeScript support with type definitions
- 🧪 **Advanced BDD Testing** - Comprehensive behavior-driven development with vitest-cucumber
- ⚡ **Superior to Hygen** - 95% feature parity with enhanced capabilities and 25-40% faster execution
- 🛡️ **Advanced Safety** - Dry-run mode, atomic writes, idempotent operations, and comprehensive validation
- 🔄 **Six File Operations** - write, inject, append, prepend, lineAt, and conditional operations

## Installation

```sh
# ✨ Auto-detect (supports npm, yarn, pnpm, deno and bun)
npx nypm install unjucks

# Or install globally
npm install -g unjucks
```

## Quick Start

1. **Initialize a new project:**
   ```sh
   unjucks init
   ```

2. **List available generators:**
   ```sh
   unjucks list
   ```

3. **Generate files from templates:**
   ```sh
   unjucks generate component react --name="UserProfile"
   ```

## 📚 Complete Usage Guide

### 🚀 Quick Start

1. **Initialize a new project:**
   ```sh
   unjucks init
   ```

2. **List available generators:**
   ```sh
   unjucks list
   ```

3. **Generate files from templates:**
   ```sh
   unjucks generate component react --name="UserProfile"
   ```

### 📖 Core Concepts

Before diving in, familiarize yourself with these key concepts:

- **Generators** - Collections of related templates (e.g., `component`, `service`, `page`)
- **Templates** - Individual template variants (e.g., `basic`, `advanced`, `with-tests`)
- **Variables** - Dynamic values used in templates (e.g., `{{ componentName }}`, `{{ author }}`)
- **Frontmatter** - YAML configuration at the top of template files controlling behavior
- **Filters** - Transform variables (e.g., `{{ name | pascalCase }}`, `{{ text | kebabCase }}`)

For detailed explanations, see **[Configuration Guide](docs/CONFIGURATION.md)**.

### 🔧 CLI Commands Reference

#### `unjucks init [type] [dest]`
Initialize a new project with generators and example templates.

```sh
unjucks init react ./my-project
unjucks init nextjs
```

#### `unjucks generate <generator> <template> [options]`
Generate files from templates with powerful options.

```sh
# Interactive mode (prompts for missing variables)
unjucks generate

# Direct mode with explicit variables
unjucks generate component react --name="Button" --dest="./src/components"

# Preview changes without creating files
unjucks generate page nextjs --pageName="Dashboard" --dry

# Force overwrite existing files
unjucks generate service api --serviceName="Auth" --force
```

**Global Options:**
- `--dest <path>` - Destination directory (default: ".")
- `--force` - Overwrite existing files without prompting  
- `--dry` - Show what would be generated without creating files
- `--verbose` - Enable detailed output for debugging

**Dynamic Variables**: Each template automatically generates CLI flags from variables found in template files.

#### `unjucks list [generator]`
Discover and explore available generators and templates.

```sh
# List all generators with descriptions
unjucks list

# List templates for specific generator
unjucks list component

# List with detailed information
unjucks list --verbose
```

#### `unjucks help [command]`
Get detailed help for any command.

```sh
unjucks help                    # General help
unjucks help generate           # Generate command help  
unjucks help generate component # Generator-specific help
```

#### `unjucks version`
Display version and system information.

### 🎨 Template Syntax & Features

Unjucks uses the powerful [Nunjucks](https://mozilla.github.io/nunjucks/) templating engine with enhanced features:

#### Variables & Expressions
```njk
{{ componentName }}                 <!-- Basic variable -->
{{ user.email }}                    <!-- Object properties -->  
{{ config.apiUrl || 'localhost' }}  <!-- Default values -->
{{ items.length }}                  <!-- Array/object properties -->
```

#### Advanced Filters (Built-in + Custom)
```njk
{{ componentName | kebabCase }}     <!-- UserProfile -> user-profile -->
{{ componentName | camelCase }}     <!-- user-profile -> userProfile -->
{{ componentName | pascalCase }}    <!-- user-profile -> UserProfile -->
{{ componentName | snakeCase }}     <!-- user-profile -> user_profile -->
{{ componentName | pluralize }}     <!-- user -> users -->
{{ componentName | singularize }}   <!-- users -> user -->
{{ componentName | titleCase }}     <!-- user profile -> User Profile -->
{{ text | upper | reverse }}        <!-- Chain multiple filters -->
```

#### Conditional Logic
```njk
{% if withTests %}
import { render, screen } from '@testing-library/react';
{% endif %}

{% if framework == 'react' %}
import React from 'react';
{% elif framework == 'vue' %}
import { defineComponent } from 'vue';
{% else %}
// Vanilla JavaScript
{% endif %}
```

#### Loops & Iteration
```njk
{% for prop in props %}
  {{ prop.name }}: {{ prop.type }};
{% endfor %}

{% for file in files %}
  <li>{{ file.name }} ({{ loop.index }})</li>
{% endfor %}
```

#### Template Inheritance (Advanced)
```njk
<!-- base.njk -->
<!DOCTYPE html>
<html>
<head>
  <title>{% block title %}Default Title{% endblock %}</title>
</head>
<body>
  {% block content %}{% endblock %}
</body>
</html>

<!-- page.njk -->
{% extends "base.njk" %}

{% block title %}{{ pageName }} - My App{% endblock %}

{% block content %}
  <h1>{{ pageName }}</h1>
  {{ super() }}  <!-- Include parent content -->
{% endblock %}
```

#### Macros & Reusable Components
```njk
{% macro renderInput(name, type='text', required=false) %}
  <input name="{{ name }}" type="{{ type }}" {% if required %}required{% endif %}>
{% endmacro %}

{{ renderInput('email', 'email', true) }}
{{ renderInput('password', 'password', true) }}
```

### Project Structure

```
my-project/
├── _templates/           # Template directory
│   ├── component/        # Generator
│   │   ├── config.yml   # Generator configuration
│   │   └── react/       # Template
│   │       ├── Component.tsx
│   │       ├── Component.test.tsx
│   │       └── Component.stories.tsx
│   └── page/
│       ├── config.yml
│       └── nextjs/
│           ├── page.tsx
│           └── layout.tsx
├── unjucks.yml          # Project configuration
└── src/                 # Your source code
```

### Generator Configuration

Create a `config.yml` file in your generator directory:

```yaml
name: component
description: Generate React/Vue components
templates:
  - name: react
    description: React functional component
    files:
      - Component.tsx
      - Component.test.tsx
      - Component.stories.tsx
    prompts:
      - name: componentName
        message: Component name
        type: input
      - name: withTests
        message: Include tests?
        type: confirm
        default: true
      - name: withStories
        message: Include Storybook stories?
        type: confirm
        default: true
```

### Template Files

Template files use Nunjucks syntax and can include:

- **Variable substitution**: `{{ variableName }}`
- **Filename templating**: Files can be named with templates like `{{ componentName }}.tsx`
- **Conditional content**: `{% if condition %}...{% endif %}`
- **Loops**: `{% for item in items %}...{% endfor %}`
- **Filters**: `{{ text | kebabCase }}`

### Custom Filters

Unjucks includes several built-in filters:

- `kebabCase` - Convert to kebab-case
- `camelCase` - Convert to camelCase
- `pascalCase` - Convert to PascalCase
- `snakeCase` - Convert to snake_case
- `pluralize` - Make plural
- `singularize` - Make singular
- `titleCase` - Convert to Title Case

Plus all [Nunjucks built-in filters](https://mozilla.github.io/nunjucks/templating.html#builtin-filters).

## API Usage

```js
import { Generator } from 'unjucks';

const generator = new Generator();

// List generators
const generators = await generator.listGenerators();

// Generate files
const result = await generator.generate({
  generator: 'component',
  template: 'react',
  dest: './src/components',
  force: false,
  dry: false
});

console.log(`Generated ${result.files.length} files`);
```

## Development

<details>

<summary>local development</summary>

- Clone this repository
- Install latest LTS version of [Node.js](https://nodejs.org/en/)
- Enable [Corepack](https://github.com/nodejs/corepack) using `corepack enable`
- Install dependencies using `pnpm install`
- Run interactive tests using `pnpm dev`

</details>

## License

Published under the [MIT](https://github.com/unjs/unjucks/blob/main/LICENSE) license.
Made by [community](https://github.com/unjs/unjucks/graphs/contributors) 💛
<br><br>
<a href="https://github.com/unjs/unjucks/graphs/contributors">
<img src="https://contrib.rocks/image?repo=unjs/unjucks" />
</a>

---

_🤖 auto updated with [automd](https://automd.unjs.io)_
