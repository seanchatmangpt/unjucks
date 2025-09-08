# Migration Guide

## Migrating from Hygen to Unjucks

### Overview

Unjucks is designed as a modern successor to Hygen, providing enhanced functionality while maintaining familiar concepts. This guide helps you migrate existing Hygen templates and workflows to Unjucks.

### Key Differences

| Feature | Hygen | Unjucks |
|---------|--------|---------|
| Configuration | `.hygen.js` | `unjucks.config.ts` |
| Template Engine | EJS | Nunjucks |
| File Structure | `_templates/` | `_templates/` |
| Frontmatter | Basic YAML | Extended YAML with injection |
| AI Integration | None | Built-in MCP support |
| Type Safety | JavaScript | TypeScript-first |

### Step-by-Step Migration

#### 1. Project Setup

**Before (Hygen)**:
```bash
npm install -g hygen
hygen init self
```

**After (Unjucks)**:
```bash
npm install -g unjucks
unjucks init
```

#### 2. Configuration Migration

**Hygen (`.hygen.js`)**:
```javascript
module.exports = {
  templates: `${__dirname}/_templates`
}
```

**Unjucks (`unjucks.config.ts`)**:
```typescript
import { defineConfig } from 'unjucks';

export default defineConfig({
  templates: '_templates',
  globals: {
    author: 'Your Name',
    organization: 'Your Organization'
  }
});
```

#### 3. Template Syntax Migration

**Template Engine Changes**

Hygen uses EJS syntax (`<%= %>`), while Unjucks uses Nunjucks syntax (`{{ }}`):

**Hygen Template**:
```ejs
---
to: src/components/<%= name %>.jsx
---
import React from 'react';

const <%= name %> = () => {
  return <div><%= name %> Component</div>;
};

export default <%= name %>;
```

**Unjucks Template**:
```yaml
---
to: "src/components/{{ pascalCase name }}.tsx"
---
import React from 'react';

const {{ pascalCase name }}: React.FC = () => {
  return <div>{{ pascalCase name }} Component</div>;
};

export default {{ pascalCase name }};
```

#### 4. Frontmatter Enhancements

**Basic Migration**

**Hygen**:
```yaml
---
to: src/pages/<%= name %>.js
---
```

**Unjucks**:
```yaml
---
to: "src/pages/{{ kebabCase name }}.tsx"
---
```

**Advanced Features**

Unjucks adds powerful injection capabilities:

```yaml
---
to: "src/components/index.ts"
inject: true
before: "// END EXPORTS"
skipIf: "export.*{{ pascalCase name }}"
---
export { {{ pascalCase name }} } from './{{ kebabCase name }}';
```

#### 5. Generator Structure Migration

**Hygen Generator**:
```
_templates/
└── component/
    └── new/
        └── component.ejs.t
```

**Unjucks Generator**:
```
_templates/
└── component/
    ├── index.js          # Optional generator logic
    ├── component.njk     # Main template
    ├── test.njk          # Test template
    └── story.njk         # Storybook template
```

#### 6. Case Conversion Updates

**Hygen**: Uses helper functions
```ejs
<%= h.inflection.camelize(name) %>
<%= h.inflection.underscore(name) %>
```

**Unjucks**: Built-in filters
```yaml
{{ name | pascalCase }}
{{ name | camelCase }}
{{ name | kebabCase }}
{{ name | snakeCase }}
{{ name | constantCase }}
```

### Advanced Migration Patterns

#### Multi-file Generation

**Hygen**: Multiple template files
```
_templates/
└── component/
    └── new/
        ├── component.ejs.t
        ├── test.ejs.t
        └── story.ejs.t
```

**Unjucks**: Single generator with multiple templates
```yaml
# _templates/component/index.js
module.exports = {
  templates: [
    'component.njk',
    'test.njk', 
    'story.njk'
  ]
};
```

#### Conditional Generation

**Hygen**: Logic in templates
```ejs
<% if (locals.withTests) { %>
// Test imports and setup
<% } %>
```

**Unjucks**: Frontmatter conditions
```yaml
---
to: "src/components/{{ pascalCase name }}/{{ pascalCase name }}.test.tsx"
when: "{{ withTests }}"
---
```

### Migration Automation

#### Automated Migration Script

Create a migration script to convert Hygen templates:

```typescript
// scripts/migrate-from-hygen.ts
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const migrateTemplate = (hygeneTemplate: string): string => {
  // Convert EJS syntax to Nunjucks
  let template = hygeneTemplate
    .replace(/<%=\s*([^%]+)\s*%>/g, '{{ $1 }}')
    .replace(/<%\s*([^%]+)\s*%>/g, '{% $1 %}');
  
  // Convert helper functions to filters
  template = template
    .replace(/h\.inflection\.camelize\(([^)]+)\)/g, '$1 | pascalCase')
    .replace(/h\.inflection\.underscore\(([^)]+)\)/g, '$1 | snakeCase');
  
  return template;
};

// Find all Hygen templates
const templates = glob.sync('_templates/**/*.ejs.t');

templates.forEach(templatePath => {
  const content = readFileSync(templatePath, 'utf-8');
  const migrated = migrateTemplate(content);
  const newPath = templatePath
    .replace('.ejs.t', '.njk')
    .replace('/new/', '/');
  
  writeFileSync(newPath, migrated);
  console.log(`Migrated: ${templatePath} → ${newPath}`);
});
```

#### Validation Script

Verify migrated templates work correctly:

```typescript
// scripts/validate-migration.ts
import { execSync } from 'child_process';

const testCases = [
  'component UserProfile',
  'page Dashboard --with-tests',
  'api users --methods get,post'
];

testCases.forEach(testCase => {
  try {
    execSync(`unjucks generate ${testCase} --dry`, { 
      stdio: 'inherit' 
    });
    console.log(`✅ ${testCase}`);
  } catch (error) {
    console.error(`❌ ${testCase}: ${error.message}`);
  }
});
```

### Common Migration Issues

#### 1. Template Syntax Errors

**Problem**: EJS syntax not converted properly

**Solution**: Use automated migration script and manual review

#### 2. Missing Variables

**Problem**: Variables available in Hygen not available in Unjucks

**Solution**: Define globals in configuration:
```typescript
export default defineConfig({
  globals: {
    // Add missing variables here
    currentYear: new Date().getFullYear(),
    author: process.env.USER || 'Unknown'
  }
});
```

#### 3. Generator Logic

**Problem**: Complex Hygen generator logic needs conversion

**Solution**: Use Unjucks generator index.js:
```javascript
// _templates/component/index.js
module.exports = {
  prompt: ({ inquirer }) => {
    return inquirer
      .prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Component name:'
        },
        {
          type: 'confirm', 
          name: 'withTests',
          message: 'Include tests?'
        }
      ]);
  }
};
```

### Testing Migration

#### Create Test Suite

```typescript
// tests/migration.test.ts
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';

describe('Migration Tests', () => {
  it('should generate component', () => {
    execSync('unjucks generate component TestComponent --dry');
    // Verify expected output
  });
  
  it('should generate with tests', () => {
    execSync('unjucks generate component TestComponent --with-tests --dry');
    // Verify test files included
  });
});
```

#### Regression Testing

Compare outputs between Hygen and Unjucks:

```bash
# Generate with Hygen
hygen component new TestComponent

# Generate with Unjucks  
unjucks generate component TestComponent

# Compare outputs
diff -r hygen-output unjucks-output
```

### Post-Migration Optimization

#### 1. Leverage New Features

After migration, enhance templates with Unjucks-specific features:

```yaml
---
to: "src/components/{{ pascalCase name }}/index.ts"
inject: true
before: "// END EXPORTS"
skipIf: "export.*{{ pascalCase name }}"
sh: |
  npm run lint {{ to }}
  npm run format {{ to }}
---
```

#### 2. AI Integration

Add AI-powered enhancements:

```typescript
export default defineConfig({
  ai: {
    enabled: true,
    mcp: {
      servers: [{
        name: 'claude-flow',
        command: 'npx',
        args: ['claude-flow@alpha', 'mcp', 'start']
      }]
    }
  }
});
```

#### 3. TypeScript Integration

Convert JavaScript configs to TypeScript:

```typescript
// Enhanced type safety
interface ComponentProps {
  name: string;
  withTests?: boolean;
  withStories?: boolean;
}

export default defineConfig<ComponentProps>({
  // Configuration with type checking
});
```

## Migrating from Other Tools

### From Yeoman

Key differences and migration strategies for Yeoman users.

### From Plop

Migration patterns for Plop.js users.

### From Custom Scripts

Converting shell scripts and custom generators to Unjucks templates.

## Best Practices After Migration

1. **Validate All Templates**: Test every migrated template
2. **Update Documentation**: Reflect new Unjucks commands and features  
3. **Train Team**: Ensure everyone understands new syntax and capabilities
4. **Gradual Enhancement**: Add new features incrementally
5. **Performance Monitoring**: Track generation speed and reliability

The migration to Unjucks opens up new possibilities for code generation while maintaining the familiar patterns that made Hygen effective. Take advantage of the enhanced features while ensuring a smooth transition for your development team.