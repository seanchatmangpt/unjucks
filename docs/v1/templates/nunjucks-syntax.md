# Nunjucks Syntax - Essential Reference

Core Nunjucks syntax you'll use in 95% of templates.

## Variables

### Basic Variable Output
```typescript
{{ variableName }}                    // Simple output
{{ user.name }}                       // Object property
{{ items[0] }}                        // Array access
{{ componentName | pascalCase }}      // With filter
{{ description | default('None') }}   // With default value
```

### Variable Types in Templates
```typescript
// Strings (most common)
{{ componentName }}        // "Button"
{{ modulePath }}          // "src/components"

// Booleans 
{{ withProps }}           // true/false
{{ isPublic }}            // true/false

// Arrays
{{ methods }}             // ["create", "update", "delete"]
{{ dependencies }}        // ["react", "typescript"]

// Objects
{{ config.database }}    // Nested object access
```

## Conditionals

### Basic If Statements
```typescript
{% if withProps %}
interface Props {
  // Component props here
}
{% endif %}

// With else
{% if withTests %}
import { describe, test, expect } from 'vitest';
{% else %}
// No tests
{% endif %}

// With elseif
{% if framework === 'react' %}
import React from 'react';
{% elseif framework === 'vue' %}
import { defineComponent } from 'vue';
{% else %}
// Default framework
{% endif %}
```

### Common Boolean Patterns
```typescript
{% if hasAuth %}
// Authentication logic
{% endif %}

{% if withDatabase %}
import { Database } from './database';
{% endif %}

{% if includeStyles %}
import './{{ componentName | kebabCase }}.css';
{% endif %}
```

### Conditional Content
```typescript
export const {{ componentName | pascalCase }}{% if withProps %}: React.FC<Props>{% endif %} = ({% if withProps %}props{% endif %}) => {
  return <div>Content</div>;
};
```

## Loops

### Basic For Loops
```typescript
{% for method in methods %}
{{ method | camelCase }}() {
  // Implementation for {{ method }}
}
{% endfor %}

// With object properties
{% for field in fields %}
{{ field.name }}: {{ field.type }};
{% endfor %}
```

### Loop Variables
```typescript
{% for item in items %}
  // Item {{ loop.index }}: {{ item }}        // 1-based index
  // Item {{ loop.index0 }}: {{ item }}       // 0-based index
  {% if loop.first %}// First item{% endif %}
  {% if loop.last %}// Last item{% endif %}
  // Total items: {{ loop.length }}
{% endfor %}
```

### Conditional Loops
```typescript
{% for field in fields %}
  {% if field.required %}
  private {{ field.name }}: {{ field.type }};
  {% endif %}
{% endfor %}

// Empty check
{% if methods and methods.length > 0 %}
{% for method in methods %}
// Process {{ method }}
{% endfor %}
{% else %}
// No methods defined
{% endif %}
```

### Loop with Separators
```typescript
// Join with commas
{% for param in parameters %}{{ param.name }}: {{ param.type }}{% if not loop.last %}, {% endif %}{% endfor %}

// Results in: name: string, age: number, email: string
```

## Comments

```typescript
{# This is a comment - won't appear in output #}

{# 
Multi-line comment
for complex explanations
#}

{# TODO: Add error handling here #}
```

## Whitespace Control

```typescript
// Remove whitespace before/after tags
{{- variable -}}       // Removes whitespace on both sides
{%- if condition -%}   // Removes whitespace around block
{% for item in items -%}
{{ item }}
{%- endfor %}          // Clean loop output
```

## Advanced Conditionals

### Multiple Conditions
```typescript
{% if withProps and withTypes %}
interface {{ componentName | pascalCase }}Props {
  // Typed props
}
{% endif %}

{% if framework === 'react' or framework === 'preact' %}
import { FC } from '{{ framework }}';
{% endif %}
```

### Existence Checks
```typescript
{% if description %}
/**
 * {{ description }}
 */
{% endif %}

{% if config and config.database %}
// Database config exists
{% endif %}

{% if methods and methods.length > 0 %}
// Has methods to process
{% endif %}
```

### Value Comparisons
```typescript
{% if exportType === 'default' %}
export default {{ componentName | pascalCase }};
{% elseif exportType === 'named' %}
export { {{ componentName | pascalCase }} };
{% else %}
export default {{ componentName | pascalCase }};
export { {{ componentName | pascalCase }} };
{% endif %}
```

## String Operations

### Built-in Filters
```typescript
{{ text | upper }}              // UPPERCASE
{{ text | lower }}              // lowercase
{{ text | capitalize }}         // First letter uppercase
{{ text | trim }}               // Remove whitespace
{{ text | replace('old', 'new') }} // Replace text
```

### String Checks
```typescript
{% if componentName | length > 10 %}
// Long component name
{% endif %}

{% if description | trim %}
// Non-empty description after trimming
{% endif %}
```

## Common Template Patterns

### Imports Section
```typescript
{% set imports = [] %}
{% if withReact %}{% set imports = imports + ['React'] %}{% endif %}
{% if withTypes %}{% set imports = imports + ['type FC'] %}{% endif %}
{% if imports.length > 0 %}
import { {{ imports | join(', ') }} } from 'react';
{% endif %}
```

### Property Lists
```typescript
interface {{ componentName | pascalCase }}Props {
  {% for prop in props %}
  {{ prop.name }}{% if not prop.required %}?{% endif %}: {{ prop.type }};
  {% endfor %}
}
```

### Method Definitions
```typescript
export class {{ serviceName | pascalCase }} {
  {% for method in methods %}
  async {{ method.name }}({% for param in method.params %}{{ param.name }}: {{ param.type }}{% if not loop.last %}, {% endif %}{% endfor %}): Promise<{{ method.returnType }}> {
    // Implementation for {{ method.name }}
  }
  {% endfor %}
}
```

### Conditional Exports
```typescript
{% if exportDefault %}
export default {{ componentName | pascalCase }};
{% endif %}
{% if exportNamed %}
export { {{ componentName | pascalCase }} };
{% endif %}
```

## Debugging Templates

### Debug Variables
```typescript
{# Debug: componentName = {{ componentName }} #}
{# Debug: withProps = {{ withProps }} #}
{# Debug: methods = {{ methods | join(', ') }} #}
```

### Conditional Debug
```typescript
{% if debug %}
console.log('Template variables:', {
  componentName: '{{ componentName }}',
  withProps: {{ withProps }},
  methods: {{ methods | tojson }}
});
{% endif %}
```

## Quick Reference

| Syntax | Purpose | Example |
|--------|---------|---------|
| `{{ var }}` | Output variable | `{{ componentName }}` |
| `{% if %}` | Condition | `{% if withProps %}` |
| `{% for %}` | Loop | `{% for item in items %}` |
| `{# comment #}` | Comment | `{# TODO: implement #}` |
| `\| filter` | Apply filter | `{{ name \| pascalCase }}` |
| `var.prop` | Object property | `{{ user.name }}` |
| `var[0]` | Array access | `{{ items[0] }}` |
| `not` | Negation | `{% if not withProps %}` |
| `and` | Logical AND | `{% if a and b %}` |
| `or` | Logical OR | `{% if a or b %}` |

This covers the essential Nunjucks syntax you'll use in most templates. For advanced features like macros, template inheritance, or complex expressions, refer to the comprehensive documentation.