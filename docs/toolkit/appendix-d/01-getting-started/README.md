# Getting Started with Unjucks

## Introduction

Welcome to the Unjucks getting started guide! This tutorial will walk you through creating your first templates, understanding the core concepts, and building practical examples that demonstrate the power of specification-driven code generation.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+**: Download from [nodejs.org](https://nodejs.org/)
- **Package Manager**: npm (comes with Node.js), yarn, or pnpm
- **Text Editor**: VS Code recommended with Unjucks extension
- **Git**: For version control (optional but recommended)

## Installation

### Global Installation (Recommended)

```bash
# Install Unjucks CLI globally
npm install -g @unjucks/cli

# Verify installation
unjucks --version

# Get help
unjucks --help
```

### Local Project Installation

```bash
# Create new project
mkdir my-unjucks-project
cd my-unjucks-project

# Initialize package.json
npm init -y

# Install Unjucks locally
npm install --save-dev @unjucks/cli

# Add npm script
echo '{"scripts": {"generate": "unjucks"}}' > .unjucksrc
```

## Your First Template

Let's create a simple template that generates a JavaScript function.

### Step 1: Initialize Project Structure

```bash
# Create project structure
mkdir -p templates/function
cd templates/function

# Create the main template file
touch index.njk
touch template.yml
```

### Step 2: Create Template Configuration

Edit `template.yml`:

```yaml
name: "JavaScript Function Generator"
description: "Generates a JavaScript function with documentation"
version: "1.0.0"
category: "javascript"

variables:
  functionName:
    type: string
    required: true
    description: "Name of the function"
    pattern: "^[a-zA-Z_$][a-zA-Z0-9_$]*$"
    example: "calculateTotal"
  
  description:
    type: string
    required: false
    description: "Function description"
    default: "Generated function"
  
  parameters:
    type: array
    required: false
    description: "Function parameters"
    items:
      type: object
      properties:
        name:
          type: string
          required: true
        type:
          type: string
          default: "any"
        description:
          type: string
  
  returnType:
    type: string
    default: "any"
    description: "Return type for TypeScript"
  
  useTypeScript:
    type: boolean
    default: false
    description: "Generate TypeScript code"
```

### Step 3: Create Template Content

Edit `index.njk`:

```nunjucks
---
to: "src/{{ functionName | kebab }}.{{ 'ts' if useTypeScript else 'js' }}"
---
/**
 * {{ description }}
 {% if parameters %}
 *
 {% for param in parameters %}
 * @param {{"{"}}{{ param.type }}{{"}"}} {{ param.name }} - {{ param.description | default('Parameter description') }}
 {% endfor %}
 {% endif %}
 * @returns {{"{"}}{{ returnType }}{{"}"}} {{ returnDescription | default('Function result') }}
 */
{% if useTypeScript %}
export function {{ functionName }}(
  {% for param in parameters %}
  {{ param.name }}: {{ param.type }}{% if not loop.last %},{% endif %}
  {% endfor %}
): {{ returnType }} {
{% else %}
export function {{ functionName }}({% for param in parameters %}{{ param.name }}{% if not loop.last %}, {% endif %}{% endfor %}) {
{% endif %}
  // TODO: Implement function logic
  {% if parameters and parameters.length > 0 %}
  console.log('Parameters:', { {% for param in parameters %}{{ param.name }}{% if not loop.last %}, {% endif %}{% endfor %} });
  {% endif %}
  
  {% if returnType != 'void' %}
  return {{ defaultReturnValue | default('null') }};
  {% endif %}
}

export default {{ functionName }};
```

### Step 4: Test Your Template

```bash
# Go back to project root
cd ../..

# Generate a JavaScript function
unjucks generate function \
  --functionName "calculateSum" \
  --description "Calculates the sum of two numbers" \
  --parameters '[
    {"name": "a", "type": "number", "description": "First number"},
    {"name": "b", "type": "number", "description": "Second number"}
  ]' \
  --returnType "number" \
  --useTypeScript true

# Check the generated file
cat src/calculate-sum.ts
```

Expected output in `src/calculate-sum.ts`:

```typescript
/**
 * Calculates the sum of two numbers
 *
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Function result
 */
export function calculateSum(
  a: number,
  b: number
): number {
  // TODO: Implement function logic
  console.log('Parameters:', { a, b });
  
  return null;
}

export default calculateSum;
```

## Understanding Template Structure

### Frontmatter Configuration

The YAML frontmatter at the top of your template controls how files are generated:

```yaml
---
to: "{{ outputDir }}/{{ fileName }}"  # Output path with variables
inject: false                        # Whether to inject into existing file
skipIf: "{{ condition }}"            # Skip generation if condition is true
---
```

### Variable Usage

Variables defined in `template.yml` can be used throughout your template:

```nunjucks
{# Simple variable substitution #}
{{ functionName }}

{# Variable with filter #}
{{ functionName | camelCase }}

{# Conditional content based on variable #}
{% if useTypeScript %}
  // TypeScript-specific code
{% endif %}

{# Loops over array variables #}
{% for param in parameters %}
  {{ param.name }}: {{ param.type }}
{% endfor %}
```

### Built-in Filters

Unjucks provides many useful filters:

```nunjucks
{{ text | camelCase }}      {# myVariableName #}
{{ text | pascalCase }}     {# MyVariableName #}
{{ text | kebabCase }}      {# my-variable-name #}
{{ text | snakeCase }}      {# my_variable_name #}
{{ text | upperCase }}      {# MY VARIABLE NAME #}
{{ text | lowerCase }}      {# my variable name #}

{{ date | date('YYYY-MM-DD') }}     {# 2024-01-01 #}
{{ array | join(', ') }}            {# item1, item2, item3 #}
{{ object | dump }}                 {# JSON.stringify(object) #}
```

## Interactive Mode

Unjucks supports interactive template generation:

```bash
# Start interactive mode
unjucks generate function --interactive

# Follow the prompts:
? Function name: calculateAverage
? Description: Calculates the average of an array of numbers
? Use TypeScript? Yes
? Add parameters? Yes
? Parameter name: numbers
? Parameter type: number[]
? Parameter description: Array of numbers to average
? Add another parameter? No
? Return type: number
```

## Template Discovery

List available templates in your project:

```bash
# List all templates
unjucks list

# Get detailed information about a template
unjucks info function

# Show template variables
unjucks variables function
```

## Configuration Files

Create configuration files for common variable sets:

### YAML Configuration

Create `configs/api-function.yml`:

```yaml
functionName: "fetchUserData"
description: "Fetches user data from the API"
useTypeScript: true
parameters:
  - name: "userId"
    type: "string"
    description: "User identifier"
  - name: "options"
    type: "RequestOptions"
    description: "Request options"
returnType: "Promise<User>"
```

Use the configuration:

```bash
unjucks generate function --config configs/api-function.yml
```

### JSON Configuration

Create `configs/utility-function.json`:

```json
{
  "functionName": "formatCurrency",
  "description": "Formats a number as currency",
  "useTypeScript": true,
  "parameters": [
    {
      "name": "amount",
      "type": "number",
      "description": "Amount to format"
    },
    {
      "name": "currency",
      "type": "string",
      "description": "Currency code (e.g., 'USD')"
    }
  ],
  "returnType": "string"
}
```

## Project Configuration

Create a global project configuration file `unjucks.config.ts`:

```typescript
import { defineConfig } from '@unjucks/cli';

export default defineConfig({
  // Default output directory
  outputDir: './src',
  
  // Template directories to search
  templateDirs: ['./templates', './shared-templates'],
  
  // Global variables available to all templates
  globalVariables: {
    author: 'Your Name',
    organization: 'Your Organization',
    license: 'MIT',
    version: '1.0.0'
  },
  
  // Default variable values
  defaults: {
    useTypeScript: true,
    generateTests: true,
    includeComments: true
  },
  
  // Post-generation hooks
  hooks: {
    postGenerate: [
      'prettier --write {{generatedFiles}}',
      'eslint --fix {{generatedFiles}}'
    ]
  },
  
  // Plugin configuration
  plugins: [
    '@unjucks/plugin-prettier',
    '@unjucks/plugin-eslint'
  ]
});
```

## Validation and Error Handling

Unjucks provides comprehensive validation:

```bash
# Validate a template
unjucks validate templates/function

# Dry run (preview without generating)
unjucks generate function --dry-run \
  --functionName "testFunction" \
  --useTypeScript true

# Debug mode for troubleshooting
unjucks generate function --debug \
  --functionName "debugFunction"
```

## Common Patterns

### Conditional File Generation

Generate different files based on conditions:

```nunjucks
---
to: >
  {% if useTypeScript %}
    src/{{ functionName }}.ts
  {% else %}
    src/{{ functionName }}.js
  {% endif %}
---
```

### Multi-file Generation

Generate multiple related files:

```yaml
# In template.yml
files:
  implementation:
    to: "src/{{ functionName }}.{{ 'ts' if useTypeScript else 'js' }}"
    template: "implementation.njk"
  
  test:
    to: "test/{{ functionName }}.test.{{ 'ts' if useTypeScript else 'js' }}"
    template: "test.njk"
    condition: "{{ generateTests | default(true) }}"
  
  documentation:
    to: "docs/{{ functionName }}.md"
    template: "docs.njk"
    condition: "{{ generateDocs | default(false) }}"
```

### Template Composition

Break templates into reusable parts:

```nunjucks
{# partials/file-header.njk #}
/**
 * {{ description }}
 * 
 * @author {{ author }}
 * @version {{ version }}
 * @generated {{ now | date('YYYY-MM-DD HH:mm:ss') }}
 */

{# Use in main template #}
{% include "partials/file-header.njk" %}

export function {{ functionName }}() {
  // Function implementation
}
```

## Next Steps

Now that you've created your first template, you can:

1. **Explore Advanced Features**: Learn about template inheritance, hooks, and plugins
2. **Build Real-World Templates**: Create templates for your common development patterns
3. **Share Templates**: Publish templates for your team or the community
4. **Integrate with Tools**: Set up VS Code integration and CI/CD workflows

Continue to the [Template Syntax](../02-template-syntax/README.md) guide to learn more advanced templating techniques!