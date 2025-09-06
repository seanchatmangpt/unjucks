# Template Engine Architecture

Core template processing system built on Nunjucks with enhanced features for code generation.

## Template Processing Pipeline

### Engine Architecture
```
Template Input → Variable Scanning → Frontmatter Processing → Nunjucks Rendering → File Operations
       ↓               ↓                     ↓                      ↓                 ↓
   .njk files    Extract {{ vars }}    Parse YAML config    Apply filters    Write/Inject files
```

## Template Structure

### Basic Template File
```nunjucks
---
to: "{{ directory }}/{{ name | kebabCase }}.tsx"
inject: false
skipIf: "{{ !withComponent }}"
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

The template scanner identifies variables using these patterns:

```typescript
// Variable patterns detected
{{ variableName }}                    // String variable
{{ variableName | filter }}           // String with filter
{% if variableName %}                 // Boolean variable (if/unless)
{% for item in items %}               // Array variable (items)
{{ componentName | pascalCase }}.tsx  // Filename variables

// Boolean detection heuristics
withTests, hasProps, isActive, shouldShow  // Boolean by naming convention
enableLogging, includeTypes, useStrict     // Boolean prefixes
```

### Variable Type Inference

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

## Built-in Filters

### String Case Conversion
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

### Pluralization
```typescript
// English pluralization
pluralize:    "item" → "items"
              "child" → "children"
              "person" → "people"

singularize:  "items" → "item"
              "children" → "child"
              "people" → "person"

// Usage
export interface {{ entityName | pascalCase }} {
  // Single entity interface
}

export interface {{ entityName | pluralize | pascalCase }} {
  // Collection interface
}
```

### String Manipulation
```typescript
// String utilities
capitalize:   "hello world" → "Hello world"
lowercase:    "Hello World" → "hello world"  
uppercase:    "hello world" → "HELLO WORLD"
trim:         "  hello  " → "hello"
replace:      "hello world" | replace("world", "universe") → "hello universe"

// Advanced string operations
split:        "one,two,three" | split(",") → ["one", "two", "three"]
join:         ["one", "two", "three"] | join(" - ") → "one - two - three"
slice:        "hello world" | slice(0, 5) → "hello"
```

### Code Generation Helpers
```typescript
// Indentation and formatting
indent:       "line1\nline2" | indent(2) → "  line1\n  line2"
dedent:       "  line1\n  line2" | dedent → "line1\nline2"

// Comment generation
comment:      "TODO: implement" | comment("//") → "// TODO: implement"
              "Multi line" | comment("/*", "*/") → "/* Multi line */"

// Import helpers
importPath:   "../utils/helpers" | importPath → "../utils/helpers"
relativePath: "/src/components/Button" | relativePath("/src") → "components/Button"
```

## Frontmatter Configuration

### Basic Configuration
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
---
```

### Advanced Frontmatter Features

#### Conditional Output
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

#### Multi-File Output
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
```yaml
# _templates/base/component.yml
---
to: "src/components/{{ name | pascalCase }}/index.ts"
skipIf: "{{ !name }}"
validate:
  required: ["name"]
  patterns:
    name: "^[A-Z][a-zA-Z0-9]*$"
---
```

## Validation System

### Input Validation
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

## Performance Optimizations

### Template Caching
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
```typescript
// Template compilation on demand
class LazyTemplateLoader {
  private templates = new Map<string, Promise<nunjucks.Template>>();
  
  async getTemplate(templatePath: string): Promise<nunjucks.Template> {
    if (!this.templates.has(templatePath)) {
      this.templates.set(templatePath, this.compileTemplate(templatePath));
    }
    return this.templates.get(templatePath)!;
  }
  
  private async compileTemplate(templatePath: string): Promise<nunjucks.Template> {
    const content = await fs.readFile(templatePath, 'utf-8');
    return nunjucks.compile(content);
  }
}
```

## Error Handling

### Template Syntax Errors
```typescript
// Graceful error handling for template syntax
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
```typescript
// Missing variable handling
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

## Custom Extensions

### Adding Custom Filters
```typescript
// Register custom filters
export class CustomFilters {
  static register(env: nunjucks.Environment): void {
    // Custom business logic filter
    env.addFilter('businessCase', (str: string) => {
      return str
        .split(/[\s_-]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
    });
    
    // File path utilities
    env.addFilter('dirname', (path: string) => {
      return path.substring(0, path.lastIndexOf('/'));
    });
    
    env.addFilter('basename', (path: string) => {
      return path.substring(path.lastIndexOf('/') + 1);
    });
  }
}
```

### Template Hooks
```typescript
// Template processing hooks
export interface TemplateHooks {
  beforeRender?(template: string, variables: Record<string, any>): Promise<void>;
  afterRender?(rendered: string, templatePath: string): Promise<string>;
  beforeWrite?(content: string, outputPath: string): Promise<void>;
  afterWrite?(outputPath: string): Promise<void>;
}
```

---

*This covers the essential template engine features. See the file operations documentation for details on the six file operations and injection capabilities.*