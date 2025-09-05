# 🌆 Unjucks

[![npm version](https://img.shields.io/npm/v/unjucks?color=yellow)](https://npmjs.com/package/unjucks)
[![npm downloads](https://img.shields.io/npm/dm/unjucks?color=yellow)](https://npm.chart.dev/packageName)

A powerful Hygen-style CLI generator with full Nunjucks templating support for creating templates and scaffolding projects.

## Features

- 🚀 **Fast and lightweight** - Built with Citty for elegant CLI experience
- 🎨 **Full Nunjucks support** - Complete templating engine with filters, inheritance, and more
- 📁 **Template discovery** - Automatic template detection and configuration
- 🔧 **Interactive prompts** - Smart prompting system for template variables
- 📦 **Multiple generators** - Support for multiple generator types in one project
- 🎯 **TypeScript ready** - Full TypeScript support with type definitions

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

## Usage

### CLI Commands

#### `unjucks init [type] [dest]`
Initialize a new project with generators and example templates.

```sh
unjucks init react ./my-project
unjucks init nextjs
```

#### `unjucks generate <generator> <template> [options]`
Generate files from templates.

```sh
# Interactive mode
unjucks generate

# Direct mode
unjucks generate component react --name="Button" --dest="./src/components"

# With options
unjucks generate page nextjs --pageName="Dashboard" --force --dry
```

**Options:**
- `--dest <path>` - Destination directory (default: ".")
- `--force` - Overwrite existing files without prompting
- `--dry` - Show what would be generated without creating files

#### `unjucks list [generator]`
List available generators and templates.

```sh
# List all generators
unjucks list

# List templates for specific generator
unjucks list component
```

#### `unjucks version`
Show version information.

### Template Syntax

Unjucks uses [Nunjucks](https://mozilla.github.io/nunjucks/) templating engine, providing powerful features:

#### Variables
```njk
{{ componentName }}
{{ user.email }}
{{ config.apiUrl }}
```

#### Filters
```njk
{{ componentName | kebabCase }}    <!-- UserProfile -> user-profile -->
{{ componentName | camelCase }}    <!-- user-profile -> userProfile -->
{{ componentName | pascalCase }}   <!-- user-profile -> UserProfile -->
{{ componentName | snakeCase }}    <!-- user-profile -> user_profile -->
{{ componentName | pluralize }}    <!-- user -> users -->
{{ componentName | singularize }}  <!-- users -> user -->
{{ componentName | titleCase }}    <!-- user profile -> User Profile -->
```

#### Conditionals
```njk
{% if withTests %}
import { render, screen } from '@testing-library/react';
{% endif %}

{% if framework == 'react' %}
import React from 'react';
{% elif framework == 'vue' %}
import { defineComponent } from 'vue';
{% endif %}
```

#### Loops
```njk
{% for prop in props %}
  {{ prop.name }}: {{ prop.type }};
{% endfor %}

{% for file in files %}
  <li>{{ file.name }}</li>
{% endfor %}
```

#### Template Inheritance
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
{% endblock %}
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
