# Frontmatter Guide - Essential Operations

Practical frontmatter examples for common template operations in Unjucks v1.

## What is Frontmatter?

Frontmatter is YAML configuration at the top of template files that controls how Unjucks processes and generates files.

```yaml
---
to: src/components/{{ componentName | pascalCase }}.tsx
inject: false  
skipIf: '{{ !withComponent }}'
---
// Your template content here
import React from 'react';
```

## Core Frontmatter Properties

### `to:` - File Destination
```yaml
# Basic file path
---
to: {{ componentName | pascalCase }}.tsx
---

# Dynamic nested path
---
to: src/{{ moduleName }}/{{ componentName | pascalCase }}/index.ts
---

# With file extension logic
---
to: {{ fileName }}{% if withTypeScript %}.ts{% else %}.js{% endif %}
---
```

### `inject:` - Modify Existing Files
```yaml
# Create new file (default)
---
to: src/routes.ts
inject: false
---

# Inject into existing file
---
to: src/routes.ts
inject: true
after: '// Add new routes here'
---
```

### `skipIf:` - Conditional Generation
```yaml
# Skip if component not needed
---
to: {{ componentName }}.test.tsx
skipIf: '{{ !withTests }}'
---

# Skip if file exists
---
to: package.json
skipIf: exists
---

# Skip with complex condition
---
to: {{ componentName }}.stories.tsx
skipIf: '{{ !withStorybook or framework !== "react" }}'
---
```

## File Operations

### Creating New Files
```yaml
---
to: src/components/{{ componentName | pascalCase }}.tsx
---
import React from 'react';

export const {{ componentName | pascalCase }} = () => {
  return <div>{{ componentName | titleCase }}</div>;
};
```

### Conditional File Creation
```yaml
---
to: src/components/{{ componentName | pascalCase }}.test.tsx
skipIf: '{{ !withTests }}'
---
import { render } from '@testing-library/react';
import { {{ componentName | pascalCase }} } from './{{ componentName | pascalCase }}';

describe('{{ componentName | pascalCase }}', () => {
  it('renders correctly', () => {
    render(<{{ componentName | pascalCase }} />);
  });
});
```

## Injection Operations

### Append to File
```yaml
---
to: src/index.ts
inject: true
append: true
---
export { {{ componentName | pascalCase }} } from './components/{{ componentName | pascalCase }}';
```

### Insert After Specific Line
```yaml
---
to: src/routes.ts
inject: true
after: '// Component routes'
---
  { path: '/{{ componentName | kebabCase }}', component: {{ componentName | pascalCase }} },
```

### Insert Before Specific Line
```yaml
---
to: src/app.ts
inject: true
before: '// End of imports'
---
import { {{ componentName | pascalCase }} } from './components/{{ componentName | pascalCase }}';
```

### Insert at Line Number
```yaml
---
to: src/config.ts
inject: true
lineAt: 10
---
  {{ configKey }}: '{{ configValue }}',
```

### Prepend to File
```yaml
---
to: src/types.ts
inject: true
prepend: true
---
import type { {{ componentName | pascalCase }}Props } from './components/{{ componentName | pascalCase }}';
```

## Advanced Injection Patterns

### Pattern Matching
```yaml
---
to: src/components/index.ts
inject: true
after: |
  /^export.*from.*components.*;$/
---
export { {{ componentName | pascalCase }} } from './{{ componentName | pascalCase }}';
```

### Multiple Injection Points
```yaml
---
to: src/App.tsx
inject: true
after: '// Import components here'
---
import { {{ componentName | pascalCase }} } from './components/{{ componentName | pascalCase }}';
---

---
to: src/App.tsx
inject: true
after: '// Add routes here'
---
        <Route path="/{{ componentName | kebabCase }}" element={<{{ componentName | pascalCase }} />} />
```

## Conditional Logic Examples

### Framework-Specific Generation
```yaml
---
to: src/components/{{ componentName | pascalCase }}.{% if framework === 'react' %}tsx{% elseif framework === 'vue' %}vue{% else %}js{% endif %}
skipIf: '{{ !componentName }}'
---
{% if framework === 'react' %}
import React from 'react';

export const {{ componentName | pascalCase }} = () => {
  return <div>{{ componentName }}</div>;
};
{% elseif framework === 'vue' %}
<template>
  <div>{{ "{{ componentName }}" }}</div>
</template>

<script setup>
// Vue component logic
</script>
{% endif %}
```

### Environment-Specific Files
```yaml
---
to: .env.{{ environment }}
skipIf: '{{ environment === "production" and !includeEnvFile }}'
---
NODE_ENV={{ environment }}
API_URL={{ apiUrl | default('http://localhost:3000') }}
{% if environment === 'development' %}
DEBUG=true
{% endif %}
```

### Database Migrations
```yaml
---
to: migrations/{{ timestamp }}_create_{{ tableName | snakeCase }}_table.sql
---
CREATE TABLE {{ tableName | snakeCase }} (
  id SERIAL PRIMARY KEY,
  {% for field in fields %}
  {{ field.name }} {{ field.type }}{% if not field.nullable %} NOT NULL{% endif %}{% if not loop.last %},{% endif %}
  {% endfor %}
);
```

## File Permissions

### Executable Scripts
```yaml
---
to: scripts/{{ scriptName }}.sh
chmod: '+x'
---
#!/bin/bash
echo "Running {{ scriptName }}"
```

### Configuration Files
```yaml
---
to: config/{{ environment }}.json
chmod: '644'
---
{
  "environment": "{{ environment }}",
  "settings": {{ settings | tojson }}
}
```

## Post-Generation Commands

### Run After Generation
```yaml
---
to: package.json
sh: 'npm install'
---
{
  "name": "{{ projectName }}",
  "dependencies": {
    "{{ dependency }}": "{{ version }}"
  }
}
```

### Multiple Commands
```yaml
---
to: src/{{ componentName | pascalCase }}.tsx
sh: |
  npm run format
  npm run lint
---
// Component code here
```

## Common Patterns

### API Route Generation
```yaml
---
to: src/routes/{{ entityName | kebabCase }}.ts
inject: false
---
import { Router } from 'express';
import { {{ entityName | pascalCase }}Controller } from '../controllers/{{ entityName | pascalCase }}Controller';

const router = Router();
const controller = new {{ entityName | pascalCase }}Controller();

router.get('/', controller.findAll.bind(controller));
router.get('/:id', controller.findById.bind(controller));
{% if withMutations %}
router.post('/', controller.create.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));
{% endif %}

export default router;
```

### Adding Routes to Main Router
```yaml
---
to: src/routes/index.ts
inject: true
after: '// Add new routes here'
---
router.use('/{{ entityName | kebabCase }}', {{ entityName | camelCase }}Routes);
---

---
to: src/routes/index.ts
inject: true
after: 'import { Router } from'
---
import {{ entityName | camelCase }}Routes from './{{ entityName | kebabCase }}';
```

### Component Export Pattern
```yaml
---
to: src/components/{{ componentName | pascalCase }}/index.ts
---
export { {{ componentName | pascalCase }} } from './{{ componentName | pascalCase }}';
{% if withTypes %}
export type { {{ componentName | pascalCase }}Props } from './{{ componentName | pascalCase }}';
{% endif %}
---

---
to: src/components/index.ts
inject: true
append: true
---
export * from './{{ componentName | pascalCase }}';
```

### Test File Generation
```yaml
---
to: src/components/{{ componentName | pascalCase }}/{{ componentName | pascalCase }}.test.tsx
skipIf: '{{ !withTests }}'
---
import { render, screen } from '@testing-library/react';
import { {{ componentName | pascalCase }} } from './{{ componentName | pascalCase }}';

describe('{{ componentName | pascalCase }}', () => {
  it('renders without crashing', () => {
    render(<{{ componentName | pascalCase }} />);
  });

  {% if withProps %}
  it('renders with props', () => {
    const props = { testProp: 'test value' };
    render(<{{ componentName | pascalCase }} {...props} />);
    // Add assertions here
  });
  {% endif %}
});
```

## Troubleshooting

### Common Issues

**File not generated:**
- Check `skipIf` condition
- Verify `to:` path is valid
- Ensure required variables are provided

**Injection not working:**
- Verify target file exists
- Check `after:`/`before:` patterns match exactly
- Ensure proper escaping in patterns

**Permissions error:**
- Check `chmod:` values (use quotes)
- Verify write permissions to target directory

### Debug Techniques

```yaml
---
# Add debug output to see variable values
to: debug-{{ componentName }}.txt
---
componentName: {{ componentName }}
withProps: {{ withProps }}
framework: {{ framework }}
Generated at: {{ new Date().toISOString() }}
```

This covers the essential frontmatter operations you'll use in most templates. The key is starting simple and adding complexity as needed for your specific use cases.