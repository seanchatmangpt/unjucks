# Creating Templates - v1 Quick Guide

The essential guide covering 80% of template creation use cases in Unjucks v1.

## Basic Template Structure

Templates are organized in a simple directory structure:

```
_templates/
├── generator-name/          # Your generator (e.g., "component", "service")
│   ├── template-name/       # Template variant (e.g., "react", "express")
│   │   ├── {{ name }}.ts    # Dynamic filename
│   │   ├── config.yml       # Optional: Custom configuration
│   │   └── subfolder/       # Nested structure supported
│   │       └── file.txt
│   └── another-template/
└── another-generator/
```

## Essential Variable Usage

### String Variables (Most Common)
```typescript
// Template file: {{ componentName }}.tsx
import React from 'react';

export const {{ componentName | pascalCase }} = () => {
  return <div>{{ componentName | titleCase }}</div>;
};
```

### Boolean Variables
```typescript
{% if withProps %}
interface {{ componentName | pascalCase }}Props {
  // Component props
}
{% endif %}

export const {{ componentName | pascalCase }}{% if withProps %}: React.FC<{{ componentName | pascalCase }}Props>{% endif %} = ({% if withProps %}props{% endif %}) => {
  return <div>Hello {{ componentName | titleCase }}</div>;
};
```

### Array Variables
```typescript
{% for method in methods %}
{{ method | camelCase }}() {
  // Implementation for {{ method }}
}
{% endfor %}
```

## Core Filters (95% Usage)

### Case Conversion
```typescript
{{ text | camelCase }}     // helloWorld
{{ text | pascalCase }}    // HelloWorld  
{{ text | kebabCase }}     // hello-world
{{ text | snakeCase }}     // hello_world
{{ text | titleCase }}     // Hello World
```

### Pluralization
```typescript
{{ 'item' | pluralize }}        // items
{{ 'items' | singularize }}     // item
```

### Common Built-ins
```typescript
{{ text | upper }}              // UPPERCASE
{{ text | lower }}              // lowercase
{{ text | default('fallback') }} // Use fallback if empty
{{ items | join(', ') }}        // Join array with commas
{{ items | length }}            // Array/string length
```

## Dynamic Filenames

Most common patterns:

```typescript
// Basic dynamic filename
{{ componentName | pascalCase }}.tsx

// With subfolder
{{ moduleName }}/{{ componentName | pascalCase }}.tsx

// Multiple filters
{{ serviceName | kebabCase }}.service.ts

// Complex paths
src/components/{{ componentName | pascalCase }}/index.ts
```

## Template Examples

### React Component (Most Popular)
```typescript
// File: {{ componentName | pascalCase }}.tsx
import React{% if withProps %}, { type FC }{% endif %} from 'react';

{% if withProps %}
interface {{ componentName | pascalCase }}Props {
  className?: string;
  children?: React.ReactNode;
}
{% endif %}

export const {{ componentName | pascalCase }}{% if withProps %}: FC<{{ componentName | pascalCase }}Props>{% endif %} = ({% if withProps %}{ className, children }{% endif %}) => {
  return (
    <div{% if withProps %} className={className}{% endif %}>
      {% if withProps %}
      {children}
      {% else %}
      <h1>{{ componentName | titleCase }}</h1>
      {% endif %}
    </div>
  );
};

export default {{ componentName | pascalCase }};
```

### API Service
```typescript
// File: {{ serviceName | pascalCase }}Service.ts
export interface {{ entityName | pascalCase }} {
  id: string;
  {% for field in fields %}
  {{ field.name }}: {{ field.type }};
  {% endfor %}
}

export class {{ serviceName | pascalCase }}Service {
  async findById(id: string): Promise<{{ entityName | pascalCase }} | null> {
    // Implementation
    return null;
  }

  async create(data: Omit<{{ entityName | pascalCase }}, 'id'>): Promise<{{ entityName | pascalCase }}> {
    // Implementation
    throw new Error('Not implemented');
  }
}
```

### CLI Command
```typescript
// File: {{ commandName | pascalCase }}.ts
import { defineCommand } from 'citty';

export const {{ commandName | camelCase }}Command = defineCommand({
  meta: {
    name: '{{ commandName | kebabCase }}',
    description: '{{ description | default("Command description") }}'
  },
  args: {
    name: {
      type: 'string',
      description: 'Name argument',
      required: true
    }
  },
  async run({ args }) {
    console.log(`Hello, ${args.name}!`);
  }
});
```

## Generator Configuration

Basic `config.yml` for most use cases:

```yaml
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
        message: "Include props interface?"
        type: "confirm"
        default: true
      - name: "withTests"
        message: "Generate test file?"
        type: "confirm"
        default: false
```

## Variable Types

Unjucks automatically detects variable types:

**Boolean Variables** (detected by naming):
- `with*`, `has*`, `is*`, `should*`, `include*`, `enable*`
- Examples: `withProps`, `hasTests`, `isPublic`

**Arrays** (detected by loop usage):
- Use plural nouns: `methods`, `fields`, `dependencies`
- Detected when used in `{% for %}` loops

**Strings** (default):
- Everything else: `componentName`, `description`, `modulePath`

## Quick Start Steps

1. **Create generator directory**: `mkdir -p _templates/my-generator/basic`
2. **Add template file**: Create `{{ name }}.txt` with your content
3. **Use variables**: Add `{{ name }}`, `{{ description }}`, etc.
4. **Test**: Run `unjucks generate my-generator basic --name Test --dry`
5. **Refine**: Add conditionals, loops, and filters as needed

## Common Patterns

### File Headers
```typescript
/**
 * {{ componentName | pascalCase }}
 * Generated by Unjucks on {{ new Date().toISOString().split('T')[0] }}
 */
```

### Conditional Imports
```typescript
{% if withReact %}
import React from 'react';
{% endif %}
{% if withTypes %}
import type { {{ componentName | pascalCase }}Props } from './types';
{% endif %}
```

### Loop with Conditionals
```typescript
{% for field in fields %}
{% if field.required %}
private {{ field.name }}: {{ field.type }};
{% endif %}
{% endfor %}
```

## Best Practices

1. **Use descriptive variable names**: `componentName` not `name`
2. **Apply consistent filters**: Always `pascalCase` for class names
3. **Provide sensible defaults**: In config.yml prompts
4. **Keep templates focused**: One responsibility per template
5. **Test with `--dry`**: Always test before generating files

This covers the essential 80% of template creation scenarios. For advanced features like template inheritance, macros, or complex data processing, refer to the comprehensive template documentation.