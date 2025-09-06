# Template Reference - Complete Syntax Documentation

This comprehensive reference covers all Unjucks template syntax, filters, frontmatter options, and variable system.

## Table of Contents

- [Template Syntax Overview](#template-syntax-overview)
- [Nunjucks Syntax Reference](#nunjucks-syntax-reference)
- [Frontmatter Configuration](#frontmatter-configuration)
- [Built-in Filters](#built-in-filters)
- [Variable System](#variable-system)
- [File Operations](#file-operations)
- [Advanced Features](#advanced-features)
- [Examples](#examples)

## Template Syntax Overview

Unjucks templates use Nunjucks syntax with enhanced frontmatter support and custom filters.

### Basic Template Structure

```nunjucks
---
to: {{ name | kebabCase }}/{{ name | pascalCase }}.tsx
inject: false
skipIf: "!withReact"
---
import React from 'react';

interface {{ name | pascalCase }}Props {
  className?: string;
  children?: React.ReactNode;
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({
  className,
  children
}) => {
  return (
    <div className={`{{ name | kebabCase }} ${className || ''}`}>
      {children}
    </div>
  );
};

export default {{ name | pascalCase }};
```

### Template File Extensions

| Extension | Description |
|-----------|-------------|
| `.njk` | Standard Nunjucks template |
| `.ejs.t` | EJS-style template (legacy Hygen compatibility) |
| `.md.njk` | Markdown template with Nunjucks processing |
| `.json.njk` | JSON template with Nunjucks processing |

## Nunjucks Syntax Reference

### Variables

```nunjucks
{# Basic variable output #}
{{ variableName }}

{# With default value #}
{{ variableName | default('defaultValue') }}

{# Safe output (no escaping) #}
{{ variableName | safe }}

{# Conditional output #}
{{ variableName if condition else 'alternative' }}
```

### Conditionals

```nunjucks
{# Basic if statement #}
{% if condition %}
  Content when true
{% endif %}

{# If-else #}
{% if withTests %}
  import { describe, test } from 'vitest';
{% else %}
  // No tests
{% endif %}

{# Multiple conditions #}
{% if framework === 'react' %}
  import React from 'react';
{% elif framework === 'vue' %}
  import { defineComponent } from 'vue';
{% else %}
  // Vanilla JavaScript
{% endif %}

{# Complex conditions #}
{% if (withTests and framework === 'react') or forceTesting %}
  // Include React testing setup
{% endif %}
```

### Loops

```nunjucks
{# Basic loop #}
{% for item in items %}
  {{ item }}
{% endfor %}

{# Loop with index #}
{% for item in items %}
  {{ loop.index }}: {{ item }}
{% endfor %}

{# Loop with conditions #}
{% for prop in properties %}
  {% if not prop.private %}
    {{ prop.name }}: {{ prop.type }};
  {% endif %}
{% endfor %}

{# Loop variables #}
{% for item in items %}
  {# loop.index - 1-based index #}
  {# loop.index0 - 0-based index #}
  {# loop.first - true for first item #}
  {# loop.last - true for last item #}
  {# loop.length - total number of items #}
  {{ item }}{{ ',' if not loop.last }}
{% endfor %}
```

### Includes and Extends

```nunjucks
{# Include another template #}
{% include "header.njk" %}

{# Include with context #}
{% include "component.njk" with context %}

{# Extend base template #}
{% extends "base.njk" %}

{% block content %}
  Custom content here
{% endblock %}
```

### Macros

```nunjucks
{# Define a macro #}
{% macro renderProperty(name, type, required) %}
  {{ name }}{{ '?' if not required }}: {{ type }};
{% endmacro %}

{# Use the macro #}
interface {{ componentName }}Props {
  {% for prop in properties %}
    {{ renderProperty(prop.name, prop.type, prop.required) }}
  {% endfor %}
}
```

### Comments

```nunjucks
{# Single line comment #}

{#
  Multi-line comment
  Can span multiple lines
#}

{# TODO: Add error handling #}
```

## Frontmatter Configuration

Frontmatter controls how templates are processed and where files are created.

### Basic Frontmatter

```yaml
---
# Required: Output file path (supports templating)
to: src/{{ name | kebabCase }}/index.ts

# Optional: Enable/disable injection mode
inject: false

# Optional: Skip generation based on condition
skipIf: "!includeComponent"
---
```

### Complete Frontmatter Options

```yaml
---
# File Destination
to: src/components/{{ name | pascalCase }}/{{ name | pascalCase }}.tsx

# File Operation Mode
inject: true          # Enable injection mode
append: false         # Append to end of file
prepend: false        # Prepend to beginning of file

# Injection Targets
before: "export default"   # Insert before this pattern
after: "import React"      # Insert after this pattern
lineAt: 10                # Insert at specific line number

# Conditional Generation
skipIf: "componentType === 'class'"

# File Permissions
chmod: "755"          # File permissions (octal or string)

# Shell Commands
sh: npm install       # Single command
sh:                   # Multiple commands
  - npm install
  - npm run build

# RDF/Semantic Data Sources
rdf:
  type: file
  source: ./schema.ttl
  
turtle: ./data.ttl    # Shorthand for Turtle files

# Semantic Validation
semanticValidation:
  enabled: true
  ontologies: 
    - "./schemas/core.ttl"
  strictMode: false
  complianceFrameworks: ['GDPR', 'HIPAA']

# Enterprise Data Sources
dataSources:
  - type: sparql
    endpoint: "https://api.example.com/sparql"
    query: "SELECT ?name ?type WHERE { ?s ?p ?o }"
    
  - type: graphql
    endpoint: "https://api.github.com/graphql"
    headers:
      Authorization: "Bearer TOKEN"

# Template Enhancement
variableEnhancement:
  semanticMapping: true
  typeInference: true
  crossOntologyMapping: false
---
```

### Frontmatter Validation Rules

| Field | Type | Validation |
|-------|------|------------|
| `to` | string | Required, must be valid path template |
| `inject` | boolean | Cannot be used with `append`/`prepend` |
| `before`/`after` | string | Requires `inject: true` |
| `lineAt` | number | Must be positive integer |
| `chmod` | string/number | Must be valid octal permissions |
| `sh` | string/array | Must be valid shell commands |
| `skipIf` | string | Must be valid expression |

### Dynamic Frontmatter

Frontmatter values can use template syntax:

```yaml
---
# Dynamic file paths
to: "{{ destDir }}/{{ name | kebabCase }}/{{ name | pascalCase }}.tsx"

# Dynamic conditions
skipIf: "framework !== '{{ targetFramework }}'"

# Dynamic commands
sh: "{{ packageManager }} install {{ dependencies | join(' ') }}"

# Environment-based configuration
chmod: "{{ filePermissions | default('644') }}"
---
```

## Built-in Filters

### String Transformation Filters

#### `kebabCase`
Convert to kebab-case (lowercase with hyphens).
```nunjucks
{{ "MyComponent" | kebabCase }}
{# Output: my-component #}
```

#### `camelCase`  
Convert to camelCase.
```nunjucks
{{ "my-component" | camelCase }}
{# Output: myComponent #}
```

#### `pascalCase`
Convert to PascalCase.
```nunjucks
{{ "my-component" | pascalCase }}
{# Output: MyComponent #}
```

#### `snakeCase`
Convert to snake_case.
```nunjucks
{{ "MyComponent" | snakeCase }}
{# Output: my_component #}
```

#### `titleCase`
Convert to Title Case.
```nunjucks
{{ "myAwesome component" | titleCase }}
{# Output: My Awesome Component #}
```

#### `capitalize`
Capitalize first letter.
```nunjucks
{{ "hello world" | capitalize }}
{# Output: Hello world #}
```

### Pluralization Filters

#### `pluralize`
Convert to plural form.
```nunjucks
{{ "user" | pluralize }}      {# users #}
{{ "category" | pluralize }}  {# categories #}
{{ "person" | pluralize }}    {# people #}
```

#### `singularize`
Convert to singular form.
```nujucks
{{ "users" | singularize }}      {# user #}
{{ "categories" | singularize }} {# category #}
```

### Built-in Nunjucks Filters

#### `default`
Provide default value for undefined variables.
```nunjucks
{{ name | default("DefaultName") }}
```

#### `length`
Get array or string length.
```nunjucks
{{ items | length }}
{{ "hello" | length }}  {# 5 #}
```

#### `join`
Join array elements with separator.
```nunjucks
{{ ['a', 'b', 'c'] | join(', ') }}  {# a, b, c #}
```

#### `sort`
Sort an array.
```nunjucks
{{ ['c', 'a', 'b'] | sort }}  {# ['a', 'b', 'c'] #}
```

#### `reverse`
Reverse an array or string.
```nunjucks
{{ [1, 2, 3] | reverse }}     {# [3, 2, 1] #}
{{ "hello" | reverse }}       {# olleh #}
```

#### `slice`
Extract portion of array or string.
```nunjucks
{{ [1, 2, 3, 4, 5] | slice(1, 4) }}  {# [2, 3, 4] #}
```

### Advanced Filters

#### `json`
Convert to JSON string.
```nunjucks
{{ { name: "test", value: 42 } | json }}
{# {"name":"test","value":42} #}
```

#### `json(indent)`
Pretty-print JSON.
```nunjucks
{{ object | json(2) }}
{# 
{
  "name": "test", 
  "value": 42
}
#}
```

### Filter Chaining

Combine multiple filters:
```nunjucks
{{ "my awesome component" | camelCase | capitalize }}
{# Output: MyAwesomeComponent #}

{{ items | sort | join(', ') | upper }}
{# Sort items, join with commas, then uppercase #}
```

## Variable System

### Variable Types and Discovery

Unjucks automatically discovers variables and infers their types:

#### String Variables
```nunjucks
{# String usage patterns #}
{{ componentName }}
{{ "prefix-" + componentName }}
{{ componentName | pascalCase }}
```

#### Boolean Variables  
```nunjucks
{# Boolean usage patterns #}
{% if withTests %}
{% endif %}

{% unless skipValidation %}
{% endunless %}
```

#### Number Variables
```nunjucks
{# Number usage patterns #}
{{ port + 1000 }}
{% for i in range(count) %}
```

#### Array Variables
```nunjucks
{# Array usage patterns #}
{% for item in items %}
{{ items | length }}
{{ items | join(', ') }}
```

### Variable Defaults and Validation

#### In Template
```nunjucks
{# Provide defaults in templates #}
{{ name | default('MyComponent') }}
{{ port | default(3000) }}
{{ features | default(['basic']) }}
```

#### In Configuration
```yaml
# Generator config.yml
variables:
  - name: componentName
    type: string
    required: true
    pattern: "^[A-Z][a-zA-Z0-9]*$"
    description: "Component name in PascalCase"
    
  - name: withTests  
    type: boolean
    default: true
    description: "Include test files"
    
  - name: features
    type: array
    default: ["basic"]
    choices: ["basic", "advanced", "premium"]
```

### Dynamic Variable Generation

Templates can dynamically create variables:

```nunjucks
{# Generate related names #}
{% set componentFile = name | pascalCase %}
{% set testFile = componentFile + '.test' %}
{% set storyFile = componentFile + '.stories' %}

// {{ componentFile }}.tsx
// {{ testFile }}.tsx  
// {{ storyFile }}.tsx
```

### Environment Variables

Access environment variables in templates:

```nunjucks
{# Access Node.js environment #}
NODE_ENV: {{ NODE_ENV | default('development') }}
API_URL: {{ API_URL | default('http://localhost:3000') }}

{# Custom environment variables #}
AUTHOR: {{ AUTHOR | default('Development Team') }}
```

## File Operations

### Write Mode (Default)

Create new files with atomic write operations:

```yaml
---
to: src/{{ name }}.ts
---
// New file content
export const {{ name }} = "value";
```

### Injection Mode

Modify existing files with precise control:

```yaml
---
to: src/index.ts
inject: true
after: "// Auto-generated imports"
---
export * from './{{ name }}';
```

### Append/Prepend Modes

Add content to beginning or end of files:

```yaml
---
to: README.md
append: true
---

## {{ name }}

{{ description }}
```

### Line-specific Operations

Insert content at exact line positions:

```yaml
---
to: src/config.ts
inject: true
lineAt: 10
---
export const {{ name }}Config = {{ config | json(2) }};
```

### Conditional Operations

Skip file generation based on conditions:

```yaml
---
to: src/{{ name }}.test.ts
skipIf: "!withTests"
---
import { describe, test } from 'vitest';
// Test content here
```

## Advanced Features

### Template Inheritance

Create reusable base templates:

```nunjucks
{# templates/base/component.njk #}
---
to: src/components/{{ name | pascalCase }}/{{ name | pascalCase }}.tsx
---
{% block imports %}
import React from 'react';
{% endblock %}

{% block interface %}
interface {{ name | pascalCase }}Props {
  {% block props %}
  className?: string;
  {% endblock %}
}
{% endblock %}

{% block component %}
export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = (props) => {
  {% block body %}
  return <div>{{ name }}</div>;
  {% endblock %}
};
{% endblock %}

export default {{ name | pascalCase }};
```

Extended template:
```nunjucks
{# templates/component/advanced.njk #}
{% extends "base/component.njk" %}

{% block imports %}
{{ super() }}
import { useState } from 'react';
{% endblock %}

{% block props %}
{{ super() }}
onAction?: () => void;
disabled?: boolean;
{% endblock %}

{% block body %}
const [state, setState] = useState(false);

return (
  <button 
    className={props.className}
    disabled={props.disabled}
    onClick={props.onAction}
  >
    {{ name }}
  </button>
);
{% endblock %}
```

### Macros for Reusability

Define reusable template functions:

```nunjucks
{# Macro definition #}
{% macro renderInterface(name, properties) %}
interface {{ name }}Props {
  {% for prop in properties %}
  {{ prop.name }}{{ '?' if not prop.required }}: {{ prop.type }};
  {% endfor %}
}
{% endmacro %}

{# Macro usage #}
{{ renderInterface(componentName, [
  { name: 'title', type: 'string', required: true },
  { name: 'count', type: 'number', required: false }
]) }}
```

### Multi-file Templates

Generate multiple related files from one template:

```nunjucks
{# Component template generating multiple files #}

{# Main component file #}
---
to: src/components/{{ name | pascalCase }}/{{ name | pascalCase }}.tsx
---
import React from 'react';
export const {{ name | pascalCase }} = () => <div>{{ name }}</div>;

{# Test file #}
{% if withTests %}
---
to: src/components/{{ name | pascalCase }}/{{ name | pascalCase }}.test.tsx
---
import { describe, test } from 'vitest';
import { {{ name | pascalCase }} } from './{{ name | pascalCase }}';

describe('{{ name | pascalCase }}', () => {
  test('renders correctly', () => {
    // Test implementation
  });
});
{% endif %}

{# Story file #}
{% if withStories %}
---
to: src/components/{{ name | pascalCase }}/{{ name | pascalCase }}.stories.tsx
---
export default { title: '{{ name | pascalCase }}' };
export const Default = () => <{{ name | pascalCase }} />;
{% endif %}

{# Index file #}
---
to: src/components/{{ name | pascalCase }}/index.ts
---
export * from './{{ name | pascalCase }}';
```

### Dynamic Content Inclusion

Include content based on conditions:

```nunjucks
{% if framework === 'react' %}
  {% include 'react-imports.njk' %}
{% elif framework === 'vue' %}  
  {% include 'vue-imports.njk' %}
{% endif %}

{# Generic implementation #}
{% include framework + '-component.njk' %}
```

## Examples

### React Component Template

```nunjucks
---
to: src/components/{{ name | pascalCase }}/{{ name | pascalCase }}.tsx
inject: false
skipIf: "framework !== 'react'"
---
import React{% if withHooks %}, { useState, useEffect }{% endif %} from 'react';
{% if withStyles %}
import './{{ name | pascalCase }}.{{ styleExtension }}';
{% endif %}

interface {{ name | pascalCase }}Props {
  className?: string;
  children?: React.ReactNode;
  {% if withEvents %}
  onClick?: () => void;
  {% endif %}
  {% for prop in customProps %}
  {{ prop.name }}{{ '?' if not prop.required }}: {{ prop.type }};
  {% endfor %}
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({
  className,
  children,
  {% if withEvents %}onClick,{% endif %}
  {% for prop in customProps %}
  {{ prop.name }},
  {% endfor %}
}) => {
  {% if withHooks %}
  const [isActive, setIsActive] = useState(false);
  
  useEffect(() => {
    // Component lifecycle logic
  }, []);
  {% endif %}

  const handleClick = () => {
    {% if withEvents %}
    onClick?.();
    {% endif %}
    {% if withHooks %}
    setIsActive(!isActive);
    {% endif %}
  };

  return (
    <div 
      className={`{{ name | kebabCase }}${className ? ` ${className}` : ''}`}
      {% if withEvents %}onClick={handleClick}{% endif %}
    >
      {children}
    </div>
  );
};

export default {{ name | pascalCase }};
```

### API Endpoint Template

```nunjucks
---
to: src/api/{{ resourceName | kebabCase }}/{{ operation }}.ts
---
import { Request, Response } from 'express';
{% if withValidation %}
import { z } from 'zod';
{% endif %}
{% if withAuth %}
import { authenticateToken } from '../middleware/auth';
{% endif %}

{% if withValidation %}
const {{ operation }}{{ resourceName | pascalCase }}Schema = z.object({
  {% for field in requestFields %}
  {{ field.name }}: z.{{ field.zodType }}(){{ '.optional()' if not field.required }},
  {% endfor %}
});
{% endif %}

export async function {{ operation }}{{ resourceName | pascalCase }}(
  req: Request,
  res: Response
) {
  try {
    {% if withValidation %}
    const validatedData = {{ operation }}{{ resourceName | pascalCase }}Schema.parse(req.body);
    {% endif %}

    {% if operation === 'get' %}
    // GET implementation
    const {{ resourceName }} = await {{ resourceName | pascalCase }}.findById(req.params.id);
    
    if (!{{ resourceName }}) {
      return res.status(404).json({ error: '{{ resourceName | pascalCase }} not found' });
    }
    
    res.json({{ resourceName }});
    
    {% elif operation === 'post' %}
    // POST implementation
    const new{{ resourceName | pascalCase }} = await {{ resourceName | pascalCase }}.create(
      {% if withValidation %}validatedData{% else %}req.body{% endif %}
    );
    
    res.status(201).json(new{{ resourceName | pascalCase }});
    
    {% elif operation === 'put' %}
    // PUT implementation  
    const updated{{ resourceName | pascalCase }} = await {{ resourceName | pascalCase }}.findByIdAndUpdate(
      req.params.id,
      {% if withValidation %}validatedData{% else %}req.body{% endif %},
      { new: true }
    );
    
    if (!updated{{ resourceName | pascalCase }}) {
      return res.status(404).json({ error: '{{ resourceName | pascalCase }} not found' });
    }
    
    res.json(updated{{ resourceName | pascalCase }});
    
    {% elif operation === 'delete' %}
    // DELETE implementation
    const deleted{{ resourceName | pascalCase }} = await {{ resourceName | pascalCase }}.findByIdAndDelete(req.params.id);
    
    if (!deleted{{ resourceName | pascalCase }}) {
      return res.status(404).json({ error: '{{ resourceName | pascalCase }} not found' });
    }
    
    res.status(204).send();
    {% endif %}
    
  } catch (error) {
    console.error('{{ operation | capitalize }} {{ resourceName }} error:', error);
    {% if withValidation %}
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors 
      });
    }
    {% endif %}
    
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Configuration File Template

```nunjucks
---
to: {{ configPath | default('config') }}/{{ environment }}.{{ configFormat }}
skipIf: "!includeEnvironment"
---
{% if configFormat === 'json' %}
{
  "app": {
    "name": "{{ appName }}",
    "version": "{{ version | default('1.0.0') }}",
    "environment": "{{ environment }}"
  },
  "server": {
    "port": {{ port | default(3000) }},
    "host": "{{ host | default('localhost') }}"
  },
  {% if database %}
  "database": {
    "type": "{{ database.type }}",
    "host": "{{ database.host }}",
    "port": {{ database.port }},
    "name": "{{ database.name }}"
  },
  {% endif %}
  {% if redis %}
  "redis": {
    "host": "{{ redis.host }}",
    "port": {{ redis.port }}
  },
  {% endif %}
  "logging": {
    "level": "{{ logLevel | default('info') }}",
    "format": "{{ logFormat | default('json') }}"
  }
}
{% elif configFormat === 'yaml' %}
app:
  name: {{ appName }}
  version: {{ version | default('1.0.0') }}
  environment: {{ environment }}

server:
  port: {{ port | default(3000) }}
  host: {{ host | default('localhost') }}

{% if database %}
database:
  type: {{ database.type }}
  host: {{ database.host }}  
  port: {{ database.port }}
  name: {{ database.name }}
{% endif %}

{% if redis %}
redis:
  host: {{ redis.host }}
  port: {{ redis.port }}
{% endif %}

logging:
  level: {{ logLevel | default('info') }}
  format: {{ logFormat | default('json') }}
{% endif %}
```

This comprehensive template reference provides all the tools needed to create powerful, flexible templates for any use case.