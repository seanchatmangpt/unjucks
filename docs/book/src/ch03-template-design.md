# Chapter 3: Template Design - Modern Template Architecture

## The Art and Science of Template Design

Template design in 2026 is both an art and a science. It requires creativity to envision the perfect developer experience while applying scientific principles to ensure reliability, maintainability, and scalability. This chapter explores the modern approach to template architecture, where templates are not just text files but sophisticated programs that understand context, adapt to environments, and evolve with your codebase.

> **🏗️ Unjucks v2 Case Study: Template Architecture Revolution**
>
> The Unjucks v2 refactor represents a complete reimagining of template architecture. This transformation demonstrates every principle covered in this chapter through real-world application.
>
> **The Challenge:** Legacy v1 templates were monolithic, fragile, and difficult to maintain:
> ```javascript
> // Legacy v1: Monolithic template approach
> const componentTemplate = `
> import React from 'react';
> {{#if withState}}
> import { useState } from 'react';
> {{/if}}
> {{#if withRouter}}
> import { useRouter } from 'next/router';
> {{/if}}
> 
> export const {{name}} = ({{#each props}}{{name}}{{#unless @last}}, {{/unless}}{{/each}}) => {
>   {{#if withState}}
>   const [state, setState] = useState(null);
>   {{/if}}
>   {{#if withRouter}}
>   const router = useRouter();
>   {{/if}}
>   
>   return <div>{/* Implementation */}</div>;
> };
> `;
> ```
>
> **Problems Identified:**
> - Monolithic templates (500+ lines common)
> - No composition or reuse patterns  
> - Brittle conditional logic
> - No validation or type safety
> - Manual dependency management
>
> **The Solution:** Modern v2 embraces sophisticated template architecture principles covered in this chapter.

## Architectural Principles for Modern Templates

### 1. Single Responsibility Principle (SRP) for Templates

Just as functions and classes should have a single responsibility, templates should focus on one specific generation task. This creates more maintainable, testable, and composable templates.

```yaml
# ❌ Bad: Monolithic template
---
name: "everything-component"
to: "src/components/{{ pascalCase name }}/index.ts"
---
// Component + Tests + Stories + Docs + API + Styles all in one template
```

```yaml
# ✅ Good: Focused templates
---
name: "component-base"
to: "src/components/{{ pascalCase name }}/{{ pascalCase name }}.tsx"
---
import React from 'react';
import { {{ pascalCase name }}Props } from './types';

export const {{ pascalCase name }}: React.FC<{{ pascalCase name }}Props> = (props) => {
  return <div>{/* Implementation */}</div>;
};
```

```yaml
# ✅ Good: Separate test template
---
name: "component-test"
to: "src/components/{{ pascalCase name }}/{{ pascalCase name }}.test.tsx"
---
import { render, screen } from '@testing-library/react';
import { {{ pascalCase name }} } from './{{ pascalCase name }}';

describe('{{ pascalCase name }}', () => {
  it('renders correctly', () => {
    render(<{{ pascalCase name }} />);
    // Test implementation
  });
});
```

### 2. Open/Closed Principle for Templates

Templates should be open for extension but closed for modification. This is achieved through inheritance, composition, and plugin systems.

```yaml
# Base template - closed for modification
---
name: "base-component"
abstract: true
schema:
  name:
    type: string
    required: true
  props:
    type: array
    default: []
---
import React from 'react';

export const {{ pascalCase name }}: React.FC<{% block props_type %}{{ pascalCase name }}Props{% endblock %}> = ({
  {% for prop in props %}{{ prop.name }}{% if not loop.last %}, {% endif %}{% endfor %}
}) => {
  {% block hooks %}{% endblock %}
  
  {% block render %}
  return (
    <div className="{{ kebabCase name }}">
      {% block content %}{{ name }} Component{% endblock %}
    </div>
  );
  {% endblock %}
};
```

```yaml
# Extended template - open for extension
---
name: "form-component"
extends: "base-component"
schema:
  validation:
    type: object
    default: {}
  onSubmit:
    type: string
    default: "handleSubmit"
---
{% block hooks %}
const [formData, setFormData] = useState({});
const [errors, setErrors] = useState({});

{% if validation %}
const validate = (data: any) => {
  // Validation logic based on {{ validation }}
};
{% endif %}
{% endblock %}

{% block render %}
return (
  <form onSubmit={{ onSubmit }} className="{{ kebabCase name }}-form">
    {% block content %}
    {/* Form fields */}
    {% endblock %}
  </form>
);
{% endblock %}
```

### 3. Dependency Inversion for Templates

High-level templates should not depend on low-level details. Instead, both should depend on abstractions.

```typescript
// Abstract interface for data sources
interface DataSource {
  getSchema(): Promise<Schema>;
  getRecords(): Promise<Record[]>;
  getRelationships(): Promise<Relationship[]>;
}

// Template depends on abstraction, not concrete implementation
interface TemplateContext {
  dataSource: DataSource;
  outputFormat: 'typescript' | 'javascript' | 'graphql';
  conventions: NamingConventions;
}
```

```yaml
# Template uses abstraction
---
name: "api-endpoint"
dependencies:
  - dataSource: "interface:DataSource"
  - logger: "interface:Logger"
---
{% set schema = dataSource.getSchema() %}
{% set relationships = dataSource.getRelationships() %}

export const {{ camelCase name }}API = {
  {% for operation in schema.operations %}
  {{ operation.name }}: async ({{ operation.params | join(', ') }}) => {
    logger.debug('Executing {{ operation.name }}');
    // Implementation
  },
  {% endfor %}
};
```

## Template Composition Patterns

> **🧩 Unjucks v2 Case Study: Composition Revolution**
>
> The v2 refactor completely transformed how templates are composed, moving from monolithic files to sophisticated composition patterns.
>
> **Legacy v1 Approach: Duplication Everywhere**
> ```
> templates/
> ├── react-component.hbs        # 347 lines
> ├── vue-component.hbs          # 289 lines  (80% duplication)
> ├── angular-component.hbs      # 412 lines  (75% duplication)
> └── component-with-state.hbs   # 423 lines  (85% duplication)
> ```
> 
> **Modern v2 Approach: Composable Architecture**
> ```
> templates/
> ├── base/
> │   ├── component.njk          # 15 lines - core structure
> │   ├── imports.njk            # 8 lines - import management  
> │   └── exports.njk            # 6 lines - export patterns
> ├── mixins/
> │   ├── with-state.njk         # 12 lines - state management
> │   ├── with-router.njk        # 9 lines - routing integration
> │   ├── with-form.njk          # 18 lines - form handling
> │   └── with-query.njk         # 14 lines - data fetching
> ├── frameworks/
> │   ├── react.njk              # 23 lines - React-specific
> │   ├── vue.njk                # 21 lines - Vue-specific
> │   └── angular.njk            # 26 lines - Angular-specific
> └── generators/
>     ├── component.js           # 45 lines - composition logic
>     ├── page.js                # 38 lines - page generator  
>     └── service.js             # 41 lines - service generator
> ```
>
> **Composition Results:**
> - **Reduced duplication**: From 85% to 3% duplicate code
> - **Modular templates**: Average 18 lines vs 347 lines
> - **Consistent patterns**: 100% reuse of base components
> - **Maintainable architecture**: Single change updates all variants

### 1. Mixin Pattern

Mixins allow templates to share common functionality without inheritance hierarchies:

```yaml
# Mixin: Loading state functionality
---
name: "with-loading-state"
type: mixin
---
const [isLoading, setIsLoading] = useState(false);

const withLoadingWrapper = (asyncFn: (...args: any[]) => Promise<any>) => {
  return async (...args: any[]) => {
    setIsLoading(true);
    try {
      return await asyncFn(...args);
    } finally {
      setIsLoading(false);
    }
  };
};
```

```yaml
# Mixin: Error handling functionality
---
name: "with-error-handling"
type: mixin
---
const [error, setError] = useState<Error | null>(null);

const withErrorHandling = (fn: (...args: any[]) => any) => {
  return (...args: any[]) => {
    try {
      setError(null);
      return fn(...args);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  };
};
```

```yaml
# Component using mixins
---
name: "async-component"
mixins:
  - "with-loading-state"
  - "with-error-handling"
---
import React, { useState } from 'react';

export const {{ pascalCase name }}: React.FC = () => {
  <!-- Mixin: with-loading-state -->
  <!-- Mixin: with-error-handling -->
  
  const fetchData = withErrorHandling(withLoadingWrapper(async () => {
    // Data fetching logic
  }));

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      {/* Component content */}
    </div>
  );
};
```

### 2. Decorator Pattern

Decorators add functionality to templates without modifying their core structure:

```typescript
// Decorator interface
interface TemplateDecorator {
  name: string;
  priority: number;
  transform(template: string, context: any): string;
}

// TypeScript decorator
class TypeScriptDecorator implements TemplateDecorator {
  name = 'typescript';
  priority = 100;
  
  transform(template: string, context: any): string {
    if (context.language === 'typescript') {
      return template
        .replace(/\.js/g, '.ts')
        .replace(/\.jsx/g, '.tsx')
        .replace(/export default/g, 'export default')
        .replace(/React\.FC/g, 'React.FC');
    }
    return template;
  }
}

// Testing decorator
class TestDecorator implements TemplateDecorator {
  name = 'testing';
  priority = 50;
  
  transform(template: string, context: any): string {
    if (context.withTests) {
      return template + '\n\n' + this.generateTests(context);
    }
    return template;
  }
  
  private generateTests(context: any): string {
    return `
describe('${context.name}', () => {
  it('should render without crashing', () => {
    // Test implementation
  });
});`;
  }
}
```

### 3. Strategy Pattern

Different generation strategies for different contexts:

```yaml
# Strategy configuration
strategies:
  react:
    component: "react-component.njk"
    test: "react-test.njk"
    story: "react-story.njk"
  
  vue:
    component: "vue-component.njk"
    test: "vue-test.njk"
    story: "vue-story.njk"
  
  angular:
    component: "angular-component.njk"
    test: "angular-test.njk"
    story: "angular-story.njk"
```

```typescript
// Strategy selector
const selectStrategy = (context: GenerationContext): TemplateStrategy => {
  if (context.framework === 'react') return new ReactStrategy();
  if (context.framework === 'vue') return new VueStrategy();
  if (context.framework === 'angular') return new AngularStrategy();
  
  throw new Error(`Unsupported framework: ${context.framework}`);
};
```

## Advanced Template Features

### 1. Conditional Generation with Smart Guards

Modern templates use sophisticated conditional logic to generate contextually appropriate code:

```yaml
---
name: "smart-component"
to: "src/components/{{ pascalCase name }}/{{ pascalCase name }}.{% if typescript %}tsx{% else %}jsx{% endif %}"
guards:
  - condition: "{{ framework === 'react' }}"
    error: "This template requires React framework"
  - condition: "{{ name | length > 2 }}"
    error: "Component name must be at least 3 characters"
---
{% if typescript %}
import React{% if withState %}, { useState }{% endif %}{% if withEffect %}, { useEffect }{% endif %} from 'react';
{% if withRouter %}
import { useRouter } from '{% if framework.version >= "13" %}next/navigation{% else %}next/router{% endif %}';
{% endif %}

interface {{ pascalCase name }}Props {
  {% for prop in props %}
  {{ prop.name }}{% if prop.optional %}?{% endif %}: {{ prop.type }};
  {% endfor %}
}
{% else %}
import React{% if withState %}, { useState }{% endif %}{% if withEffect %}, { useEffect }{% endif %} from 'react';
{% if withRouter %}
import { useRouter } from 'next/router';
{% endif %}
{% endif %}

{% if typescript %}
export const {{ pascalCase name }}: React.FC<{{ pascalCase name }}Props> = ({
{% else %}
export const {{ pascalCase name }} = ({
{% endif %}
  {% for prop in props %}{{ prop.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% if typescript %}
}: {{ pascalCase name }}Props) => {
{% else %}
}) => {
{% endif %}
  {% if withState %}
  const [state, setState] = useState({% if stateDefault %}{{ stateDefault }}{% else %}null{% endif %});
  {% endif %}
  
  {% if withEffect %}
  useEffect(() => {
    // Effect logic
  }, []);
  {% endif %}
  
  {% if withRouter %}
  const router = useRouter();
  {% endif %}

  return (
    <div className="{{ kebabCase name }}{% if styling.module %}-module{% endif %}">
      {/* Component implementation */}
    </div>
  );
};
```

### 2. Dynamic Path Generation

Templates can generate dynamic paths based on context and conventions:

```yaml
---
name: "feature-module"
paths:
  component: "src/{% if features %}features/{{ kebabCase feature }}/{% endif %}components/{{ pascalCase name }}/index.{% if typescript %}tsx{% else %}jsx{% endif %}"
  test: "src/{% if features %}features/{{ kebabCase feature }}/{% endif %}components/{{ pascalCase name }}/{{ pascalCase name }}.test.{% if typescript %}tsx{% else %}jsx{% endif %}"
  story: "src/{% if features %}features/{{ kebabCase feature }}/{% endif %}components/{{ pascalCase name }}/{{ pascalCase name }}.stories.{% if typescript %}tsx{% else %}jsx{% endif %}"
  styles: "src/{% if features %}features/{{ kebabCase feature }}/{% endif %}components/{{ pascalCase name }}/{{ kebabCase name }}.{% if styling.preprocessor %}{{ styling.preprocessor }}{% else %}css{% endif %}"
---
```

### 3. Context-Aware Imports

Templates intelligently manage imports based on usage and context:

```yaml
---
name: "smart-imports"
imports:
  react:
    default: "React"
    named:
      - condition: "{{ withState }}"
        import: "useState"
      - condition: "{{ withEffect }}"
        import: "useEffect"
      - condition: "{{ withCallback }}"
        import: "useCallback"
      - condition: "{{ withMemo }}"
        import: "useMemo"
  
  next:
    - condition: "{{ withRouter }}"
      from: "{% if nextVersion >= 13 %}next/navigation{% else %}next/router{% endif %}"
      import: "useRouter"
    
    - condition: "{{ withImage }}"
      from: "next/image"
      import: "Image"
  
  external:
    {% for dep in dependencies %}
    - from: "{{ dep.package }}"
      {% if dep.default %}default: "{{ dep.default }}"{% endif %}
      {% if dep.named %}named: {{ dep.named | list }}{% endif %}
    {% endfor %}
---
{# Generate imports based on usage #}
import React{% if imports.react.named %}, { {{ imports.react.named | join(', ') }} }{% endif %} from 'react';
{% for imp in imports.next %}
import { {{ imp.import }} } from '{{ imp.from }}';
{% endfor %}
{% for imp in imports.external %}
{% if imp.default %}import {{ imp.default }}{% if imp.named %}, { {{ imp.named | join(', ') }} }{% endif %} from '{{ imp.from }}';{% else %}import { {{ imp.named | join(', ') }} } from '{{ imp.from }}';{% endif %}
{% endfor %}
```

## Template Testing and Validation

### 1. Schema-Driven Validation

Define schemas for template variables to ensure type safety and completeness:

```typescript
// JSON Schema for component template
const componentSchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: {
      type: 'string',
      pattern: '^[A-Z][a-zA-Z0-9]*$',
      description: 'Component name in PascalCase'
    },
    props: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string' },
          optional: { type: 'boolean', default: false },
          description: { type: 'string' }
        }
      }
    },
    features: {
      type: 'object',
      properties: {
        state: { type: 'boolean', default: false },
        effect: { type: 'boolean', default: false },
        router: { type: 'boolean', default: false },
        testing: { type: 'boolean', default: true }
      }
    }
  }
};

// Template validation
const validateTemplate = (variables: any): ValidationResult => {
  const ajv = new Ajv();
  const validate = ajv.compile(componentSchema);
  const valid = validate(variables);
  
  return {
    valid,
    errors: validate.errors || []
  };
};
```

### 2. Generated Code Testing

Test that generated code meets quality standards:

```typescript
// Test suite for template output
describe('ComponentTemplate', () => {
  it('generates valid TypeScript', async () => {
    const variables = {
      name: 'TestComponent',
      typescript: true,
      props: [
        { name: 'title', type: 'string', optional: false },
        { name: 'onClick', type: '() => void', optional: true }
      ]
    };
    
    const result = await generateTemplate('component', variables);
    
    // Syntax validation
    expect(() => parse(result.content, { sourceType: 'module' })).not.toThrow();
    
    // TypeScript validation
    const diagnostics = await validateTypeScript(result.content);
    expect(diagnostics).toHaveLength(0);
    
    // ESLint validation
    const lintResults = await lint(result.content);
    expect(lintResults.errorCount).toBe(0);
  });
  
  it('includes required imports', async () => {
    const variables = {
      name: 'TestComponent',
      withState: true,
      withRouter: true
    };
    
    const result = await generateTemplate('component', variables);
    
    expect(result.content).toMatch(/import React, { useState } from 'react'/);
    expect(result.content).toMatch(/import { useRouter } from/);
  });
  
  it('follows naming conventions', async () => {
    const variables = { name: 'MyTestComponent' };
    const result = await generateTemplate('component', variables);
    
    expect(result.content).toMatch(/export const MyTestComponent:/);
    expect(result.content).toMatch(/className="my-test-component"/);
  });
});
```

### 3. Template Performance Testing

Ensure templates perform well with various inputs:

```typescript
describe('Template Performance', () => {
  it('handles large prop lists efficiently', async () => {
    const variables = {
      name: 'LargeComponent',
      props: Array.from({ length: 100 }, (_, i) => ({
        name: `prop${i}`,
        type: 'string',
        optional: i % 2 === 0
      }))
    };
    
    const startTime = performance.now();
    const result = await generateTemplate('component', variables);
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
    expect(result.content).toMatch(/prop99: string;/);
  });
  
  it('scales with template complexity', async () => {
    const complexVariables = {
      name: 'ComplexComponent',
      mixins: ['with-loading', 'with-errors', 'with-validation'],
      features: {
        state: true,
        effect: true,
        router: true,
        query: true,
        mutation: true
      },
      props: Array.from({ length: 50 }, (_, i) => ({
        name: `prop${i}`,
        type: 'ComplexType<GenericParam>',
        optional: true
      }))
    };
    
    const startTime = performance.now();
    await generateTemplate('complex-component', complexVariables);
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(200);
  });
});
```

## Template Documentation and Metadata

### 1. Self-Documenting Templates

Templates should include comprehensive metadata:

```yaml
---
# Template metadata
name: "react-component"
version: "2.1.0"
description: "Generates a modern React component with TypeScript support"
author: "Development Team"
tags: ["react", "typescript", "component"]
category: "frontend"

# Documentation
documentation:
  description: |
    This template generates a React functional component with optional features
    like state management, effects, routing, and comprehensive testing.
  
  examples:
    - name: "Basic Component"
      description: "Simple component with props"
      variables:
        name: "Button"
        props:
          - name: "children"
            type: "React.ReactNode"
          - name: "onClick"
            type: "() => void"
            optional: true
    
    - name: "Stateful Component"
      description: "Component with state and effects"
      variables:
        name: "Counter"
        withState: true
        withEffect: true
        stateDefault: "0"

# Schema definition
schema:
  type: "object"
  required: ["name"]
  properties:
    name:
      type: "string"
      pattern: "^[A-Z][a-zA-Z0-9]*$"
      description: "Component name in PascalCase"
      examples: ["Button", "UserProfile", "NavigationMenu"]
    
    props:
      type: "array"
      description: "Component props definition"
      items:
        type: "object"
        required: ["name", "type"]
        properties:
          name:
            type: "string"
            description: "Property name"
          type:
            type: "string"
            description: "TypeScript type"
          optional:
            type: "boolean"
            default: false
            description: "Whether the prop is optional"

# Template dependencies
dependencies:
  templates: []
  packages:
    - name: "react"
      version: ">=18.0.0"
    - name: "typescript"
      version: ">=4.9.0"
      optional: true

# Output files
outputs:
  - path: "src/components/{{ pascalCase name }}/{{ pascalCase name }}.tsx"
    description: "Main component file"
  - path: "src/components/{{ pascalCase name }}/types.ts"
    description: "Type definitions"
    condition: "{{ typescript && props.length > 0 }}"
  - path: "src/components/{{ pascalCase name }}/{{ pascalCase name }}.test.tsx"
    description: "Test file"
    condition: "{{ withTests }}"

# File generation rules
to: "src/components/{{ pascalCase name }}/{{ pascalCase name }}.tsx"
inject: false
skipIf: false
chmod: "644"
---

{# Template content follows #}
```

### 2. Interactive Template Help

Generate interactive help and examples:

```typescript
// Template help generator
const generateTemplateHelp = (template: TemplateMetadata): string => {
  return `
# ${template.name} - ${template.description}

## Usage
\`\`\`bash
unjucks generate ${template.name} MyComponent --with-state --with-tests
\`\`\`

## Options
${template.schema.properties.map(prop => 
  `- **${prop.name}** (${prop.type}): ${prop.description}`
).join('\n')}

## Examples
${template.documentation.examples.map(example => `
### ${example.name}
${example.description}

\`\`\`bash
unjucks generate ${template.name} ${Object.entries(example.variables)
  .map(([key, value]) => `--${key} ${JSON.stringify(value)}`)
  .join(' ')}
\`\`\`
`).join('\n')}

## Generated Files
${template.outputs.map(output => 
  `- \`${output.path}\`: ${output.description}`
).join('\n')}
  `;
};
```

## Template Versioning and Migration

### 1. Semantic Versioning for Templates

```yaml
---
name: "component"
version: "2.1.0"
compatibleWith: ["2.0.0", "2.0.1", "2.1.0"]
breaking_changes: []
migrations:
  "1.x.x": "migrate-v1-to-v2.js"
---
```

### 2. Template Migration Scripts

```typescript
// Migration script
export const migrateV1ToV2 = (oldVariables: any): any => {
  const newVariables = { ...oldVariables };
  
  // Rename 'hasState' to 'withState'
  if ('hasState' in oldVariables) {
    newVariables.withState = oldVariables.hasState;
    delete newVariables.hasState;
  }
  
  // Convert old prop format to new format
  if (oldVariables.props && typeof oldVariables.props[0] === 'string') {
    newVariables.props = oldVariables.props.map((prop: string) => ({
      name: prop,
      type: 'any',
      optional: false
    }));
  }
  
  return newVariables;
};
```

## Anti-Patterns and Common Pitfalls

### 1. Template Anti-Patterns

❌ **The God Template**: Templates that try to do everything
```yaml
# Don't create monolithic templates
---
name: "everything-template"
# Generates components + tests + stories + docs + API + database + deployment
---
```

❌ **Hard-coded Paths**: Templates with inflexible output paths
```yaml
# Avoid hard-coded paths
to: "src/components/Button/Button.tsx"  # Inflexible
```

❌ **No Error Handling**: Templates without validation or error handling
```yaml
# Missing validation and error handling
---
to: "{{ outputPath }}"  # Could be undefined
---
import { {{ componentName }} } from './{{ fileName }}';  # No validation
```

### 2. Common Mistakes and Solutions

**Problem**: Templates become unmaintainable as they grow
**Solution**: Use composition and inheritance patterns

**Problem**: Generated code doesn't follow project conventions
**Solution**: Implement context-aware generation

**Problem**: Templates break when project structure changes
**Solution**: Use dynamic path generation and configuration

**Problem**: Developers don't know how to use templates
**Solution**: Include comprehensive documentation and examples

## Future-Proofing Template Design

### 1. Preparing for AI Integration

Design templates to work well with AI assistance:

```yaml
---
name: "ai-enhanced-component"
ai_hints:
  context: "React functional component with modern patterns"
  patterns: ["hooks", "typescript", "testing-library"]
  avoid: ["class-components", "prop-types"]
suggestions:
  - trigger: "withQuery: true"
    hint: "Consider adding error boundaries and loading states"
  - trigger: "props.length > 5"
    hint: "Consider breaking down into smaller components"
---
```

### 2. Extensibility Points

Design templates with clear extension points:

```yaml
---
name: "extensible-component"
extension_points:
  - name: "before_imports"
    description: "Add custom imports before standard ones"
  - name: "after_props"
    description: "Add custom props after standard ones"
  - name: "custom_hooks"
    description: "Add custom hook implementations"
  - name: "before_return"
    description: "Add logic before return statement"
---

{% block before_imports %}{% endblock %}
import React from 'react';

interface {{ pascalCase name }}Props {
  // Standard props
  {% block after_props %}{% endblock %}
}

export const {{ pascalCase name }}: React.FC<{{ pascalCase name }}Props> = () => {
  {% block custom_hooks %}{% endblock %}
  
  {% block before_return %}{% endblock %}
  return (
    <div>
      {% block content %}Default content{% endblock %}
    </div>
  );
};
```

## Conclusion

Modern template design is a sophisticated discipline that combines software engineering principles with creative problem-solving. The templates we've explored in this chapter represent more than just text generation—they're intelligent systems that understand context, adapt to environments, and evolve with your codebase.

Key takeaways for modern template design:

1. **Apply SOLID principles** to template architecture
2. **Use composition patterns** for maintainable templates
3. **Implement comprehensive validation** and error handling
4. **Design for extensibility** and future enhancement
5. **Include thorough documentation** and examples
6. **Test templates** as rigorously as application code
7. **Plan for migration** and versioning

As we move forward, the next chapter will explore how to configure these powerful templates through sophisticated configuration systems that make template management scalable and maintainable across large development teams.

The future of code generation lies not just in creating better templates, but in creating template systems that are intelligent, adaptable, and truly serve the needs of modern development teams. The patterns and practices outlined in this chapter provide the foundation for building such systems.