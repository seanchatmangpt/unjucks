# Template System

The Template System is the heart of Unjucks, combining the power of the Nunjucks template engine with advanced code generation features. This chapter covers the template processing pipeline, variable extraction system, and frontmatter configuration.

## Template Architecture

### Processing Pipeline

```
Template Input → Variable Scanning → Frontmatter Processing → Nunjucks Rendering → File Operations
       ↓               ↓                     ↓                      ↓                 ↓
   .njk files    Extract {{ vars }}    Parse YAML config    Apply filters    Write/Inject files
```

The template system follows a systematic approach:
1. **Template Discovery**: Locate templates in the `_templates` directory structure
2. **Variable Extraction**: Automatically scan for `{{ variables }}` and control structures
3. **Frontmatter Processing**: Parse YAML configuration for file operations
4. **Nunjucks Rendering**: Apply variables and filters to generate content
5. **File Operations**: Execute the six file operations (write, inject, append, prepend, lineAt, skipIf)

### Template Structure

A complete Unjucks template consists of:
- **Frontmatter** (YAML configuration)
- **Template Body** (Nunjucks markup)
- **Variable References** (dynamic placeholders)

```nunjucks
---
to: "{{ directory }}/{{ name | kebabCase }}.tsx"
inject: false
skipIf: "{{ !withComponent }}"
chmod: "644"
---
import React from 'react';

interface {{ name | pascalCase }}Props {
  {% if withProps -%}
  className?: string;
  children?: React.ReactNode;
  {%- endif %}
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({
  {% if withProps -%}
  className,
  children
  {%- endif %}
}) => {
  return (
    <div{% if withProps %} className={className}{% endif %}>
      {% if withProps -%}
      {children}
      {%- else -%}
      <p>{{ name | titleCase }} component</p>
      {%- endif %}
    </div>
  );
};

export default {{ name | pascalCase }};
```

## Variable Extraction System

### Automatic Variable Detection

The template scanner identifies variables using sophisticated pattern recognition:

```typescript
// Variable patterns detected
{{ variableName }}                    // String variable
{{ variableName | filter }}           // String with filter
{% if variableName %}                 // Boolean variable (if/unless)
{% for item in items %}               // Array variable (items)
{{ componentName | pascalCase }}.tsx  // Filename variables
```

### Type Inference Algorithm

The system automatically infers variable types based on usage patterns:

```typescript
interface TemplateVariable {
  name: string;
  type: 'string' | 'boolean' | 'array' | 'object';
  required: boolean;
  default?: any;
  description?: string;
}

// Inference rules
const inferType = (variableName: string, usage: string): VariableType => {
  // Boolean patterns
  if (/^(with|has|is|should|enable|include|use|can|will)/.test(variableName)) {
    return 'boolean';
  }
  
  // Array patterns (for loops)
  if (usage.includes('for') && usage.includes('in')) {
    return 'array';
  }
  
  // Default to string
  return 'string';
};
```

### Boolean Detection Heuristics

Boolean variables are detected through naming conventions:

```typescript
// Boolean prefixes and patterns
withTests, hasProps, isActive, shouldShow     // Boolean by naming convention
enableLogging, includeTypes, useStrict       // Action-based booleans
canEdit, willUpdate, doesExist              // Modal verbs
```

## Built-in Filters

### String Case Conversion

Essential for consistent naming across different programming languages and conventions:

```typescript
// Case transformation filters
camelCase:    "hello world" → "helloWorld"
pascalCase:   "hello world" → "HelloWorld" 
kebabCase:    "hello world" → "hello-world"
snakeCase:    "hello world" → "hello_world"
titleCase:    "hello world" → "Hello World"
constantCase: "hello world" → "HELLO_WORLD"

// Usage in templates
{{ componentName | pascalCase }}Component.tsx
{{ functionName | camelCase }}
{{ CSS_VAR_NAME | constantCase }}
```

### Pluralization Support

Built-in English pluralization for entity generation:

```typescript
// English pluralization rules
pluralize:    "item" → "items"
              "child" → "children"
              "person" → "people"
              "datum" → "data"

singularize:  "items" → "item"
              "children" → "child"
              "people" → "person"

// Usage example
export interface {{ entityName | pascalCase }} {
  // Single entity interface
}

export interface {{ entityName | pluralize | pascalCase }} {
  // Collection interface
}
```

### Advanced String Manipulation

```typescript
// String utilities
capitalize:   "hello world" → "Hello world"
lowercase:    "Hello World" → "hello world"  
uppercase:    "hello world" → "HELLO WORLD"
trim:         "  hello  " → "hello"
replace:      "hello world" | replace("world", "universe") → "hello universe"

// Array operations
split:        "one,two,three" | split(",") → ["one", "two", "three"]
join:         ["one", "two", "three"] | join(" - ") → "one - two - three"
slice:        "hello world" | slice(0, 5) → "hello"

// Code generation helpers
indent:       "line1\nline2" | indent(2) → "  line1\n  line2"
comment:      "TODO: implement" | comment("//") → "// TODO: implement"
```

## Frontmatter System

### Basic Configuration

Frontmatter controls how templates are processed and where files are written:

```yaml
---
# File output configuration
to: "{{ outputPath }}/{{ name | kebabCase }}.ts"

# Conditional generation
skipIf: "{{ !includeFile }}"

# Injection mode (instead of creating new file)
inject: true
before: "// INJECT_IMPORTS_HERE"
after: "// END_IMPORTS"

# File permissions (Unix)
chmod: "755"

# Shell command to execute after generation
sh: "prettier --write {{ outputPath }}/{{ name | kebabCase }}.ts"
---
```

### The Six File Operations

Frontmatter controls which of the six file operations to perform:

1. **write** (default) - Create new files
2. **inject** - Insert content into existing files at markers
3. **append** - Add content to end of files
4. **prepend** - Add content to beginning of files
5. **lineAt** - Insert content at specific line numbers
6. **skipIf** - Conditional operation control

### Dynamic Filename Generation

Templates can generate dynamic file paths based on variables and conditions:

```yaml
---
# Conditional file paths
to: >
  {% if type === 'component' -%}
  src/components/{{ name }}/index.ts
  {%- else -%}
  src/utils/{{ name }}.ts
  {%- endif %}

# Multiple conditions
skipIf: "{{ !withTests || environment === 'production' }}"
---
```

### Multi-File Output

Generate multiple related files from a single template:

```yaml
---
# Generate multiple files from one template
outputs:
  - path: "{{ name }}.ts"
    template: "main"
  - path: "{{ name }}.test.ts"
    template: "test"
    skipIf: "{{ !withTests }}"
  - path: "{{ name }}.stories.ts"
    template: "stories"
    skipIf: "{{ !withStorybook }}"
---
```

## Template Inheritance

### Extending Base Templates

Templates can inherit from base configurations:

```yaml
---
# Inherit from base template
extends: "../base/component.yml"

# Override specific configurations
overrides:
  to: "custom/{{ name }}.ts"
  inject: false

# Additional configuration
customField: "value"
---
```

### Base Template Example

Create reusable base configurations:

```yaml
# _templates/base/component.yml
---
to: "src/components/{{ name | pascalCase }}/index.ts"
skipIf: "{{ !name }}"
validate:
  required: ["name"]
  patterns:
    name: "^[A-Z][a-zA-Z0-9]*$"
chmod: "644"
---
```

## Validation System

### Input Validation

Templates can specify validation rules for variables:

```yaml
---
# Validation rules in frontmatter
validate:
  required: ["name", "type"]
  patterns:
    name: "^[A-Z][a-zA-Z0-9]*$"    # PascalCase pattern
    type: "^(component|util|service)$"
  custom:
    - rule: "nameNotReserved"
      message: "Name cannot be a reserved keyword"
---
```

### Custom Validation Rules

Extend validation with custom logic:

```typescript
// Register custom validation
export class CustomValidators {
  static nameNotReserved(value: string): boolean {
    const reserved = ['class', 'function', 'var', 'let', 'const'];
    return !reserved.includes(value.toLowerCase());
  }
  
  static validComponentName(value: string): boolean {
    return /^[A-Z][a-zA-Z0-9]*$/.test(value) && value.length > 2;
  }
}
```

## Advanced Template Features

### Template Macros

Reusable template snippets:

```nunjucks
{# Define macro #}
{% macro renderMethod(name, returnType, params) -%}
async {{ name }}({{ params | join(', ') }}): Promise<{{ returnType }}> {
  // Implementation for {{ name }}
}
{%- endmacro %}

{# Use macro #}
{% for method in methods %}
{{ renderMethod(method.name, method.returnType, method.params) }}
{% endfor %}
```

### Conditional Template Sections

Complex conditional rendering:

```nunjucks
{% set hasDatabase = withDatabase and databaseType %}
{% set hasAuth = withAuth or authProvider %}

{% if hasDatabase %}
import { {{ databaseType | pascalCase }} } from './database';
{% endif %}

{% if hasAuth %}
import { AuthProvider } from './auth';
{% endif %}

export class {{ serviceName | pascalCase }} {
  {% if hasDatabase %}
  private db: {{ databaseType | pascalCase }};
  {% endif %}
  
  {% if hasAuth %}
  private auth: AuthProvider;
  {% endif %}
}
```

### Template Context Objects

Access structured data within templates:

```nunjucks
{# Context object: config.database #}
{% if config.database.enabled %}
import { {{ config.database.driver | pascalCase }} } from '{{ config.database.driver }}';

const dbConfig = {
  host: '{{ config.database.host }}',
  port: {{ config.database.port }},
  database: '{{ config.database.name }}'
};
{% endif %}
```

## Performance Optimizations

### Template Caching

The system caches compiled templates for performance:

```typescript
interface TemplateCache {
  // Compiled template cache
  compiledTemplates: Map<string, nunjucks.Template>;
  
  // Variable scan cache
  variableScans: Map<string, TemplateVariable[]>;
  
  // Frontmatter cache
  frontmatterCache: Map<string, FrontmatterConfig>;
  
  get(key: string): CacheEntry | null;
  set(key: string, value: CacheEntry): void;
  invalidate(templatePath: string): void;
}
```

### Lazy Loading

Templates are compiled on-demand to reduce memory usage:

```typescript
class LazyTemplateLoader {
  private templates = new Map<string, Promise<nunjucks.Template>>();
  
  async getTemplate(templatePath: string): Promise<nunjucks.Template> {
    if (!this.templates.has(templatePath)) {
      this.templates.set(templatePath, this.compileTemplate(templatePath));
    }
    return this.templates.get(templatePath)!;
  }
}
```

## Error Handling

### Template Syntax Errors

Graceful handling of template compilation errors:

```typescript
try {
  const template = nunjucks.compile(templateContent);
  const rendered = template.render(variables);
} catch (error) {
  if (error instanceof nunjucks.TemplateSyntaxError) {
    throw new TemplateSyntaxError(
      `Template syntax error in ${templatePath}:${error.lineno}: ${error.message}`
    );
  }
  throw error;
}
```

### Variable Validation Errors

Handle missing or invalid variables:

```typescript
export class VariableValidator {
  validate(template: string, variables: Record<string, any>): ValidationResult {
    const required = this.extractRequiredVariables(template);
    const missing = required.filter(name => !(name in variables));
    
    if (missing.length > 0) {
      return {
        valid: false,
        errors: [`Missing required variables: ${missing.join(', ')}`],
        suggestions: missing.map(name => `Provide --${name} argument or set in prompt`)
      };
    }
    
    return { valid: true, errors: [] };
  }
}
```

## Best Practices

### Template Organization

- Keep templates focused and single-purpose
- Use descriptive filenames that match the generated content
- Organize related templates in generator directories
- Use consistent naming conventions for variables

### Variable Naming

- Use descriptive, self-documenting variable names
- Follow consistent case conventions (camelCase for JavaScript/TypeScript)
- Use boolean prefixes (`with`, `has`, `is`, `should`) for clarity
- Group related variables with common prefixes

### Error Prevention

- Always provide default values for optional variables
- Use validation rules to catch input errors early
- Include helpful error messages and suggestions
- Test templates with various input combinations

The Template System provides a powerful foundation for code generation, combining the flexibility of Nunjucks with advanced features specifically designed for software development workflows.