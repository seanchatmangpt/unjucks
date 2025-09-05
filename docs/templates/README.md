# Template Development Guide

Comprehensive guide for creating, managing, and optimizing templates in Unjucks v1.0.

## Overview

Templates in Unjucks are powered by the Nunjucks templating engine with additional features for code generation. This guide covers everything from basic template creation to advanced patterns and best practices.

## Template Basics

### Template Structure

```
_templates/                     # Templates root directory
├── generator-name/            # Generator directory
│   ├── config.yml            # Optional generator configuration
│   ├── template-name/        # Template directory
│   │   ├── file1.txt         # Static template file
│   │   ├── {{ name }}.ts     # Dynamic filename template
│   │   ├── subdir/           # Nested directory structure
│   │   │   └── nested.tsx
│   │   └── config/
│   └── another-template/
└── another-generator/
```

### Directory Conventions

1. **Templates Directory**: `_templates` or `templates` (auto-discovered)
2. **Generator Directory**: First level subdirectory (e.g., `component`, `service`)
3. **Template Directory**: Second level subdirectory (e.g., `react`, `express`)
4. **Template Files**: Files within template directory

## Template Syntax

### Nunjucks Variables

```typescript
// Basic variable
{{ variableName }}

// Variable with filter
{{ componentName | pascalCase }}

// Variable with default
{{ description | default('No description provided') }}
```

### Dynamic Filenames

```typescript
// Dynamic filename examples
{{ componentName | pascalCase }}.tsx        // Button.tsx
{{ serviceName | kebabCase }}.service.ts    // user-auth.service.ts
{{ name }}/index.ts                         // user/index.ts

// Nested dynamic paths
{{ moduleName }}/{{ componentName | pascalCase }}/{{ componentName | pascalCase }}.tsx
// Results in: UserModule/UserButton/UserButton.tsx
```

### Conditional Content

```typescript
{% if withProps %}
interface {{ componentName | pascalCase }}Props {
  // Component props
}
{% endif %}

export const {{ componentName | pascalCase }}: React.FC{% if withProps %}<{{ componentName | pascalCase }}Props>{% endif %} = ({% if withProps %}props{% endif %}) => {
  return (
    <div>
      <h1>{{ componentName | titleCase }}</h1>
    </div>
  );
};
```

### Loops and Iteration

```typescript
// Loop over array variable
{% for method in methods %}
  {{ method | camelCase }}() {
    // Implementation for {{ method }}
  }
{% endfor %}

// Loop with conditional
{% for field in fields %}
  {% if field.required %}
  private {{ field.name }}: {{ field.type }};
  {% endif %}
{% endfor %}

// Loop with index
{% for item in items %}
  // Item {{ loop.index }}: {{ item }}
{% endfor %}
```

### Advanced Nunjucks Features

```typescript
// Include other templates
{% include "common/header.ts" %}

// Extend templates
{% extends "base-component.tsx" %}

// Blocks for inheritance
{% block imports %}
import React from 'react';
{% endblock %}

// Macros for reusable code
{% macro renderProperty(name, type, optional) %}
  {{ name }}{% if optional %}?{% endif %}: {{ type }};
{% endmacro %}

{{ renderProperty('id', 'string', false) }}
{{ renderProperty('name', 'string', true) }}
```

## Built-in Filters

### String Case Conversion

```typescript
// Input: "hello world"
{{ text | camelCase }}     // helloWorld
{{ text | pascalCase }}    // HelloWorld  
{{ text | kebabCase }}     // hello-world
{{ text | snakeCase }}     // hello_world
{{ text | titleCase }}     // Hello World
{{ text | capitalize }}    // Hello world
```

### Pluralization

```typescript
// Singular to plural
{{ 'item' | pluralize }}        // items
{{ 'category' | pluralize }}    // categories
{{ 'child' | pluralize }}       // children

// Plural to singular
{{ 'items' | singularize }}     // item
{{ 'categories' | singularize }} // category
{{ 'children' | singularize }}   // child
```

### Built-in Nunjucks Filters

```typescript
// String manipulation
{{ text | upper }}              // HELLO WORLD
{{ text | lower }}              // hello world  
{{ text | trim }}               // Remove whitespace
{{ text | replace('old', 'new') }} // Replace text

// Array operations
{{ items | join(', ') }}        // Join array elements
{{ items | first }}             // First element
{{ items | last }}              // Last element
{{ items | length }}            // Array length

// Date formatting (if date provided)
{{ date | date('YYYY-MM-DD') }}

// Default values
{{ value | default('fallback') }}
```

## Variable Detection and Types

### Automatic Variable Detection

Unjucks automatically detects variables from templates:

```typescript
// String variables (default type)
{{ componentName }}
{{ description }}
{{ modulePath }}

// Boolean variables (detected by naming patterns)
{{ withProps }}      // Detected as boolean
{{ hasTests }}       // Detected as boolean  
{{ isActive }}       // Detected as boolean
{{ shouldValidate }} // Detected as boolean
{{ includeStyles }}  // Detected as boolean

// Boolean variables (detected by conditional usage)
{% if enableFeature %}  // enableFeature detected as boolean

// Array variables (detected by loop usage)
{% for item in items %}  // items detected as array
{{ methods[0] }}         // methods detected as array
```

### Variable Naming Conventions

**Boolean Variables:**
- Prefix: `with`, `has`, `is`, `should`, `include`, `enable`, `allow`
- Examples: `withTests`, `hasProps`, `isPublic`, `shouldValidate`

**String Variables:**
- Use camelCase: `componentName`, `serviceName`, `moduleDescription`
- Avoid abbreviations: `description` not `desc`

**Array Variables:**
- Use plural nouns: `methods`, `fields`, `dependencies`
- Be descriptive: `importStatements`, `interfaceProperties`

## Generator Configuration

### Basic Configuration (config.yml)

```yaml
name: "component"
description: "Generate React components with TypeScript"
templates:
  - name: "react"
    description: "React functional component"
    files:
      - "{{ componentName | pascalCase }}.tsx"
      - "{{ componentName | pascalCase }}.test.tsx"
      - "index.ts"
    prompts:
      - name: "componentName"
        message: "Component name:"
        type: "input"
        default: "MyComponent"
      - name: "withProps"
        message: "Include props interface?"
        type: "confirm"
        default: true
      - name: "exportType"
        message: "Export type:"
        type: "list"
        choices:
          - "default"
          - "named"
          - "both"
        default: "default"
```

### Advanced Configuration

```yaml
name: "fullstack"
description: "Full-stack application generator"
templates:
  - name: "crud-api"
    description: "CRUD API with database and tests"
    files:
      - "src/controllers/{{ entityName | pascalCase }}Controller.ts"
      - "src/services/{{ entityName | pascalCase }}Service.ts"
      - "src/models/{{ entityName | pascalCase }}.ts"
      - "src/routes/{{ entityName | kebabCase }}.routes.ts"
      - "tests/{{ entityName | kebabCase }}.test.ts"
      - "migrations/create-{{ entityName | kebabCase }}-table.sql"
    prompts:
      - name: "entityName"
        message: "Entity name (singular):"
        type: "input"
        default: "User"
      - name: "fields"
        message: "Entity fields (comma-separated):"
        type: "input"
        default: "name:string,email:string,age:number"
      - name: "withAuth"
        message: "Include authentication?"
        type: "confirm"
        default: false
      - name: "database"
        message: "Database type:"
        type: "list"
        choices: ["postgresql", "mysql", "sqlite"]
        default: "postgresql"
```

### Prompt Types

```yaml
prompts:
  # Text input
  - name: "name"
    type: "input"
    message: "Enter name:"
    default: "default-value"
    
  # Boolean confirmation
  - name: "confirmed"
    type: "confirm" 
    message: "Are you sure?"
    default: true
    
  # Single selection list
  - name: "framework"
    type: "list"
    message: "Choose framework:"
    choices: ["react", "vue", "angular"]
    default: "react"
    
  # Multiple selection
  - name: "features"
    type: "checkbox"
    message: "Select features:"
    choices: ["typescript", "testing", "linting"]
```

## Template Examples

### React Component Template

```typescript
// _templates/component/react/{{ componentName | pascalCase }}.tsx
import React{% if withProps %}, { type FC }{% endif %} from 'react';
{% if withStyles %}
import styles from './{{ componentName | pascalCase }}.module.css';
{% endif %}

{% if withProps %}
interface {{ componentName | pascalCase }}Props {
  {% for prop in props %}
  {{ prop.name }}{% if not prop.required %}?{% endif %}: {{ prop.type }};
  {% endfor %}
}
{% endif %}

{% if withProps %}
export const {{ componentName | pascalCase }}: FC<{{ componentName | pascalCase }}Props> = ({
  {% for prop in props %}{{ prop.name }}{% if not loop.last %}, {% endif %}{% endfor %}
}) => {
{% else %}
export const {{ componentName | pascalCase }}: FC = () => {
{% endif %}
  return (
    <div{% if withStyles %} className={styles.container}{% endif %}>
      <h1>{{ componentName | titleCase }}</h1>
      {% if withProps %}
      {/* Component implementation using props */}
      {% endif %}
    </div>
  );
};

{% if exportDefault %}
export default {{ componentName | pascalCase }};
{% endif %}
```

### API Service Template

```typescript
// _templates/service/api/{{ serviceName | pascalCase }}Service.ts
{% if withDatabase %}
import { Database } from '../database/connection';
{% endif %}
{% if withValidation %}
import { {{ entityName | pascalCase }}Schema } from '../schemas/{{ entityName | pascalCase }}Schema';
{% endif %}

export interface {{ entityName | pascalCase }} {
  id: string;
  {% for field in fields %}
  {{ field.name }}: {{ field.type }};
  {% endfor %}
  createdAt: Date;
  updatedAt: Date;
}

export class {{ serviceName | pascalCase }}Service {
  {% if withDatabase %}
  constructor(private db: Database) {}
  {% endif %}

  async create(data: Omit<{{ entityName | pascalCase }}, 'id' | 'createdAt' | 'updatedAt'>): Promise<{{ entityName | pascalCase }}> {
    {% if withValidation %}
    const validatedData = {{ entityName | pascalCase }}Schema.parse(data);
    {% endif %}
    
    // Implementation
    {% if withDatabase %}
    return this.db.{{ entityName | camelCase }}.create({
      data: {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    {% else %}
    throw new Error('Create method not implemented');
    {% endif %}
  }

  async findById(id: string): Promise<{{ entityName | pascalCase }} | null> {
    {% if withDatabase %}
    return this.db.{{ entityName | camelCase }}.findUnique({ where: { id } });
    {% else %}
    throw new Error('FindById method not implemented');
    {% endif %}
  }

  async update(id: string, data: Partial<{{ entityName | pascalCase }}>): Promise<{{ entityName | pascalCase }}> {
    {% if withValidation %}
    const validatedData = {{ entityName | pascalCase }}Schema.partial().parse(data);
    {% endif %}
    
    {% if withDatabase %}
    return this.db.{{ entityName | camelCase }}.update({
      where: { id },
      data: { ...data, updatedAt: new Date() }
    });
    {% else %}
    throw new Error('Update method not implemented');
    {% endif %}
  }

  async delete(id: string): Promise<void> {
    {% if withDatabase %}
    await this.db.{{ entityName | camelCase }}.delete({ where: { id } });
    {% else %}
    throw new Error('Delete method not implemented');
    {% endif %}
  }

  {% for method in customMethods %}
  async {{ method.name }}({% for param in method.params %}{{ param.name }}: {{ param.type }}{% if not loop.last %}, {% endif %}{% endfor %}): Promise<{{ method.returnType }}> {
    // Custom method implementation
    throw new Error('{{ method.name }} method not implemented');
  }
  {% endfor %}
}
```

### CLI Command Template

```typescript
// _templates/command/citty/{{ commandName | pascalCase }}.ts
import { defineCommand } from 'citty';
import chalk from 'chalk';
{% if withSubcommands %}
// Import subcommands
// import { subCommand1, subCommand2 } from './subcommands';
{% endif %}

export const {{ commandName | camelCase }}Command = defineCommand({
  meta: {
    name: '{{ commandName | kebabCase }}',
    description: '{{ description | default(commandName + " command") }}',
    version: '{{ version | default("1.0.0") }}'
  },
  {% if withSubcommands %}
  subCommands: {
    // Add your subcommands here
    // sub1: subCommand1,
    // sub2: subCommand2,
  },
  {% endif %}
  args: {
    {% for arg in args %}
    {{ arg.name }}: {
      type: '{{ arg.type }}',
      description: '{{ arg.description }}',
      {% if arg.required %}required: true,{% endif %}
      {% if arg.default %}default: {{ arg.default }},{% endif %}
      {% if arg.alias %}alias: '{{ arg.alias }}',{% endif %}
    },
    {% endfor %}
    {% if not args %}
    // Add your command arguments here
    // name: {
    //   type: 'string',
    //   description: 'Name argument',
    //   required: true
    // },
    {% endif %}
  },
  async run({ args }) {
    console.log(chalk.blue.bold('🚀 {{ commandName | titleCase }} Command'));
    
    {% if withLogging %}
    console.log(chalk.gray('Arguments:'), args);
    {% endif %}
    
    try {
      // Command implementation
      {% for step in steps %}
      console.log(chalk.yellow('{{ step.description }}...'));
      // {{ step.implementation }}
      {% endfor %}
      
      console.log(chalk.green('✅ {{ commandName | titleCase }} completed successfully!'));
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  }
});
```

## Advanced Template Patterns

### Template Composition

```typescript
// _templates/common/header.ts
/**
 * Generated by Unjucks
 * @generator {{ generator }}
 * @template {{ template }}
 * @created {{ new Date().toISOString() }}
 */

// _templates/component/react/Component.tsx
{% include "common/header.ts" %}

import React from 'react';
// Rest of component...
```

### Conditional File Generation

```typescript
// Only generate test file if withTests is true
// File: {{ componentName | pascalCase }}.test.tsx
{% if withTests %}
import { render, screen } from '@testing-library/react';
import { {{ componentName | pascalCase }} } from './{{ componentName | pascalCase }}';

describe('{{ componentName | pascalCase }}', () => {
  it('renders without crashing', () => {
    render(<{{ componentName | pascalCase }} />);
  });
  
  {% if withProps %}
  it('renders with props', () => {
    const props = {
      {% for prop in props %}
      {{ prop.name }}: {{ prop.testValue | default('undefined') }},
      {% endfor %}
    };
    render(<{{ componentName | pascalCase }} {...props} />);
  });
  {% endif %}
});
{% endif %}
```

### Complex Data Processing

```typescript
// Process fields from comma-separated string
{% set processedFields = fields.split(',') | map('trim') | map('split', ':') %}

export interface {{ entityName | pascalCase }} {
  id: string;
  {% for field in processedFields %}
  {% set fieldName = field[0] | trim %}
  {% set fieldType = field[1] | default('string') | trim %}
  {{ fieldName }}: {{ fieldType }};
  {% endfor %}
}

// Generate validation schema
export const {{ entityName | camelCase }}Schema = {
  {% for field in processedFields %}
  {% set fieldName = field[0] | trim %}
  {% set fieldType = field[1] | default('string') | trim %}
  {{ fieldName }}: {
    type: '{{ fieldType }}',
    required: {% if field[2] === 'required' %}true{% else %}false{% endif %}
  }{% if not loop.last %},{% endif %}
  {% endfor %}
};
```

### Multi-File Generation with Shared Context

```typescript
// _templates/feature/crud/index.ts
// Re-export all generated files
export { {{ entityName | pascalCase }} } from './{{ entityName | pascalCase }}';
export { {{ entityName | pascalCase }}Service } from './{{ entityName | pascalCase }}Service';
export { {{ entityName | pascalCase }}Controller } from './{{ entityName | pascalCase }}Controller';
{% if withTypes %}
export type { {{ entityName | pascalCase }}CreateInput, {{ entityName | pascalCase }}UpdateInput } from './types';
{% endif %}

// _templates/feature/crud/types.ts
{% if withTypes %}
import { {{ entityName | pascalCase }} } from './{{ entityName | pascalCase }}';

export type {{ entityName | pascalCase }}CreateInput = Omit<{{ entityName | pascalCase }}, 'id' | 'createdAt' | 'updatedAt'>;
export type {{ entityName | pascalCase }}UpdateInput = Partial<{{ entityName | pascalCase }}CreateInput>;
export type {{ entityName | pascalCase }}Response = {{ entityName | pascalCase }};
{% endif %}
```

## Best Practices

### Template Organization

1. **Logical Grouping**: Group related templates under meaningful generators
   ```
   _templates/
   ├── component/      # UI components
   ├── service/        # Business logic
   ├── api/           # API endpoints
   ├── database/      # Database schemas
   └── config/        # Configuration files
   ```

2. **Consistent Naming**: Use consistent naming patterns
   - Generators: lowercase with hyphens (`api-client`, `data-model`)
   - Templates: descriptive names (`express-controller`, `react-component`)
   - Variables: camelCase (`componentName`, `withValidation`)

3. **Modular Templates**: Create reusable template components
   ```
   _templates/
   ├── common/
   │   ├── header.ts          # Common file headers
   │   ├── imports.ts         # Standard imports
   │   └── footer.ts          # Common footers
   └── component/
       └── react/
           ├── Component.tsx  # Uses common templates
           └── index.ts
   ```

### Variable Design

1. **Descriptive Names**: Use clear, descriptive variable names
   ```typescript
   // Good
   {{ componentName }}
   {{ includeTestFiles }}
   {{ databaseConnectionString }}
   
   // Avoid
   {{ name }}
   {{ flag }}
   {{ str }}
   ```

2. **Consistent Types**: Follow type conventions
   ```typescript
   // Booleans: with*, has*, is*, should*
   {{ withProps }}, {{ hasValidation }}, {{ isPublic }}, {{ shouldOptimize }}
   
   // Arrays: plural nouns
   {{ dependencies }}, {{ fields }}, {{ methods }}
   
   // Objects: descriptive names
   {{ configOptions }}, {{ metadata }}
   ```

3. **Sensible Defaults**: Provide reasonable defaults in config
   ```yaml
   prompts:
     - name: "componentName"
       default: "MyComponent"
     - name: "withTests"
       default: true
     - name: "exportType"
       default: "default"
   ```

### Template Content

1. **Clean Output**: Generate clean, well-formatted code
   ```typescript
   // Use proper indentation
   {% if condition %}
     // Indented content
   {% endif %}
   
   // Add spacing between sections
   {% if imports %}
   {{ imports }}

   {% endif %}
   // Code continues...
   ```

2. **Error Handling**: Handle edge cases gracefully
   ```typescript
   {% if items and items.length > 0 %}
     {% for item in items %}
       // Process item
     {% endfor %}
   {% else %}
     // No items case
   {% endif %}
   ```

3. **Documentation**: Include helpful comments
   ```typescript
   /**
    * {{ componentName | pascalCase }} Component
    * 
    * {% if description %}{{ description }}{% else %}Generated component{% endif %}
    * 
    * @generated by unjucks {{ new Date().toISOString() }}
    */
   ```

### Performance Optimization

1. **Minimize Variable Processing**: Cache complex calculations
   ```typescript
   {% set processedName = componentName | pascalCase %}
   {% set fileName = processedName + '.tsx' %}
   
   // Use cached values
   export const {{ processedName }} = ...
   // File: {{ fileName }}
   ```

2. **Conditional Includes**: Only include when needed
   ```typescript
   {% if withStyles %}
   {% include "styles-template.css" %}
   {% endif %}
   ```

3. **Efficient Loops**: Use appropriate loop constructs
   ```typescript
   {% for item in items %}
     {% if loop.first %}// First item setup{% endif %}
     // Process item
     {% if loop.last %}// Last item cleanup{% endif %}
   {% endfor %}
   ```

## Testing Templates

### Template Validation

```bash
# Dry run to validate template
unjucks generate component react --dry --componentName TestComponent

# Validate with all variable combinations
unjucks generate service api --dry --serviceName User --withAuth --withDatabase --database postgresql
```

### Unit Testing Template Logic

```typescript
// tests/templates/template-validation.test.ts
import { Generator } from 'unjucks';
import { describe, it, expect } from 'vitest';

describe('Template Generation', () => {
  const generator = new Generator('./tests/fixtures/_templates');
  
  it('should generate React component with props', async () => {
    const result = await generator.generate({
      generator: 'component',
      template: 'react',
      dest: './test-output',
      dry: true,
      componentName: 'TestButton',
      withProps: true,
      withTests: false
    });
    
    expect(result.files).toHaveLength(1);
    expect(result.files[0].content).toContain('TestButton');
    expect(result.files[0].content).toContain('TestButtonProps');
  });
  
  it('should handle missing variables gracefully', async () => {
    await expect(generator.generate({
      generator: 'component', 
      template: 'react',
      dest: './test-output',
      dry: true
      // Missing componentName
    })).rejects.toThrow();
  });
});
```

### Integration Testing

```bash
# Create test templates
mkdir -p test-templates/test-generator/test-template

# Create simple test template
cat > test-templates/test-generator/test-template/test.txt << 'EOF'
Hello {{ name }}!
EOF

# Test generation
unjucks generate test-generator test-template --name World --dest ./output
```

## Troubleshooting

### Common Issues

1. **Variable Not Recognized**
   ```
   Error: Variable 'componentName' not found in template
   ```
   **Solution**: Check variable spelling and ensure it's used in template

2. **Template Syntax Error**
   ```
   Error: Template syntax error at line 5
   ```
   **Solution**: Validate Nunjucks syntax, check for unclosed tags

3. **File Already Exists**
   ```
   Error: File already exists and --force not specified
   ```
   **Solution**: Use `--force` flag or choose different destination

### Debugging Templates

1. **Add Debug Output**
   ```typescript
   {# Debug: componentName = {{ componentName }} #}
   {# Debug: withProps = {{ withProps }} #}
   ```

2. **Test Variable Processing**
   ```bash
   # Use dry run to see generated content
   unjucks generate component react --dry --componentName Debug
   ```

3. **Validate Configuration**
   ```bash
   # Check if config is valid YAML
   npx yaml-validate _templates/component/config.yml
   ```

### Performance Issues

1. **Slow Template Processing**
   - Check for complex loops in templates
   - Minimize nested conditionals
   - Cache computed values

2. **Large Template Files**
   - Split large templates into smaller components
   - Use includes for common sections
   - Consider template inheritance

## Migration and Versioning

### Template Versioning

```yaml
# _templates/component/config.yml
name: "component"
version: "2.0.0"
description: "React components with hooks support"
compatibility:
  minUnjucksVersion: "1.0.0"
  breaking: true
templates:
  - name: "react"
    version: "2.0.0"
    # template configuration
```

### Migration Strategies

1. **Backward Compatibility**
   - Keep old variable names with deprecation warnings
   - Provide migration scripts
   - Document breaking changes

2. **Gradual Migration**
   - Support both old and new patterns
   - Add feature flags for new behavior
   - Plan deprecation timeline

---

*For more information on CLI usage and API integration, see the [CLI Reference](../cli/README.md) and [API Documentation](../api/README.md).*