# Unjucks Migration Guide

🔄 **Complete guide to migrating from Hygen to Unjucks with 95% template compatibility**

## Table of Contents

1. [Quick Migration](#quick-migration)
2. [Migration Tool](#migration-tool)
3. [Syntax Conversion](#syntax-conversion)
4. [Configuration Migration](#configuration-migration)
5. [Manual Fixes](#manual-fixes)
6. [Validation & Testing](#validation--testing)
7. [Common Issues](#common-issues)
8. [Best Practices](#best-practices)

## Quick Migration

The fastest way to migrate your Hygen templates:

```bash
# Install Unjucks
npm install unjucks

# Run automated migration
unjucks migrate --source _templates --target templates --backup

# Validate migration
unjucks list

# Test a template
unjucks generate component new TestComponent
```

## Migration Tool

### Basic Usage

```bash
# Basic migration with backup
unjucks migrate --backup

# Dry run to preview changes
unjucks migrate --dry --verbose

# Force overwrite existing templates
unjucks migrate --force --backup

# Custom source/target directories
unjucks migrate --source my-templates --target generators
```

### Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--source, -s` | Source directory with Hygen templates | `_templates` |
| `--target, -t` | Target directory for Unjucks templates | `templates` |
| `--dry, -d` | Preview changes without modifying files | `false` |
| `--backup, -b` | Create backup of original templates | `false` |
| `--force, -f` | Overwrite existing target directory | `false` |
| `--verbose, -v` | Enable detailed output | `false` |
| `--validate` | Validate templates after migration | `true` |
| `--report, -r` | Generate migration report | `true` |

### Migration Reports

The migration tool generates comprehensive reports:

- **JSON Report**: `migration-report.json` - Machine-readable data
- **HTML Report**: `migration-report.html` - Visual dashboard
- **Console Summary**: Real-time migration progress

## Syntax Conversion

### Template Syntax

| Hygen (EJS) | Unjucks (Nunjucks) | Notes |
|-------------|---------------------|--------|
| `<%= variable %>` | `{{ variable }}` | Output variables |
| `<%- htmlContent %>` | `{{ htmlContent \| safe }}` | Raw HTML output |
| `<% if (condition) { %>` | `{% if condition %}` | Conditionals |
| `<% } else { %>` | `{% else %}` | Else clause |
| `<% } %>` | `{% endif %}` | End conditional |
| `<% for (item in items) { %>` | `{% for item in items %}` | For loops |
| `<% items.forEach(fn) { %>` | `{% for item in items %}` | Array iteration |
| `<% } %>` | `{% endfor %}` | End loop |
| `<%- include('file') %>` | `{% include 'file' %}` | Template includes |
| `<%# comment %>` | `{# comment #}` | Comments |
| `<% var x = value; %>` | `{% set x = value %}` | Variable assignment |

### String Methods & Filters

| Hygen | Unjucks | Example |
|-------|---------|---------|
| `name.toUpperCase()` | `name \| upper` | `{{ name \| upper }}` |
| `name.toLowerCase()` | `name \| lower` | `{{ name \| lower }}` |
| `items.join(', ')` | `items \| join(', ')` | `{{ tags \| join(', ') }}` |
| `text.split(' ')` | `text \| split(' ')` | `{{ text \| split(' ') }}` |
| `items.length` | `items \| length` | `{{ items \| length }}` |
| `obj['key']` | `obj.key` | `{{ obj.key }}` |

### Inflection Functions

| Hygen | Unjucks | Description |
|-------|---------|-------------|
| `inflection.camelize(name, true)` | `name \| camelCase` | PascalCase conversion |
| `inflection.underscore(name)` | `name \| snakeCase` | snake_case conversion |
| `inflection.capitalize(name)` | `name \| capitalize` | Capitalize first letter |
| `inflection.pluralize(name)` | `name \| pluralize` | Make plural |
| `inflection.singularize(name)` | `name \| singularize` | Make singular |

### Frontmatter Changes

| Hygen | Unjucks | Notes |
|-------|---------|-------|
| `unless: condition` | `skipIf: condition` | Skip template condition |
| All other fields | Same | Compatible as-is |

**Compatible Frontmatter Fields:**
- `to:` - Target file path
- `inject:` - Enable injection mode
- `after:` - Inject after pattern
- `before:` - Inject before pattern
- `append:` - Append to end of file
- `prepend:` - Prepend to start of file
- `lineAt:` - Inject at specific line
- `skipIf:` - Skip template condition
- `sh:` - Shell command to run
- `chmod:` - File permissions

## Configuration Migration

### Automatic Configuration Migration

The migration tool automatically converts Hygen configuration:

**Before** (`.hygenrc`):
```json
{
  "templates": "_templates",
  "helpers": "helpers",
  "exec": {
    "pre-commit": "npm run lint",
    "post-generate": "npm run format"
  },
  "inquirer": {
    "prompts": "custom-prompts.js"
  }
}
```

**After** (`unjucks.config.ts`):
```typescript
import { defineConfig } from "unjucks";

export default defineConfig({
  templates: "templates",
  helpers: "helpers",
  filters: "helpers/filters",
  extensions: [".njk", ".nunjucks", ".html", ".md", ".txt"],
  hooks: {
    pre: ["npm run lint"],
    post: ["npm run format"]
  },
  prompts: {
    prompts: "custom-prompts.js"
  }
});
```

### Package.json Scripts

The migration tool updates your package.json scripts:

**Before**:
```json
{
  "scripts": {
    "gen": "hygen",
    "generate": "hygen"
  }
}
```

**After**:
```json
{
  "scripts": {
    "gen": "unjucks generate",
    "generate": "unjucks generate",
    "gen:list": "unjucks list",
    "gen:help": "unjucks help"
  }
}
```

## Manual Fixes

Some complex patterns may need manual adjustment after migration:

### Complex Nested Logic

**Before (Hygen)**:
```javascript
<% if (modules && modules.length > 0) { %>
  <% modules.forEach(function(module) { %>
    <% if (module.enabled && module.dependencies) { %>
      <% module.dependencies.forEach(function(dep) { %>
        import { <%= dep.name %> } from '<%= dep.path %>';
      <% }); %>
    <% } %>
  <% }); %>
<% } %>
```

**After (Unjucks)**:
```nunjucks
{% if modules and modules.length > 0 %}
  {% for module in modules %}
    {% if module.enabled and module.dependencies %}
      {% for dep in module.dependencies %}
        import { {{ dep.name }} } from '{{ dep.path }}';
      {% endfor %}
    {% endif %}
  {% endfor %}
{% endif %}
```

### Custom JavaScript Functions

**Before (Hygen)**:
```javascript
<% 
function formatDate(date) {
  return date.toISOString().split('T')[0];
}
%>
Generated on: <%= formatDate(new Date()) %>
```

**After (Unjucks)** - Move to helpers:
```typescript
// helpers/filters.ts
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
```

```nunjucks
Generated on: {{ new Date() | formatDate }}
```

### Dynamic Property Access

**Before (Hygen)**:
```javascript
<% Object.keys(config).forEach(function(key) { %>
  <%= key %>: <%= config[key] %>
<% }); %>
```

**After (Unjucks)**:
```nunjucks
{% for key, value in config %}
  {{ key }}: {{ value }}
{% endfor %}
```

## Validation & Testing

### Automatic Validation

The migration tool runs comprehensive validation:

1. **Template Discovery** - Ensures all templates are found
2. **Frontmatter Parsing** - Validates frontmatter syntax
3. **Template Rendering** - Tests template rendering
4. **File Generation** - Validates 'to' field syntax
5. **Injection Capabilities** - Tests injection directives
6. **Syntax Validation** - Checks for unconverted EJS
7. **Compatibility Rate** - Calculates success percentage

### Manual Testing

After migration, test your templates:

```bash
# List available generators
unjucks list

# Test file generation
unjucks generate component new TestComponent --dry

# Test injection
unjucks generate inject export NewExport --dry

# Validate specific template
unjucks help component new
```

### Compatibility Verification

Run the compatibility test suite:

```bash
# Run migration with validation
unjucks migrate --validate --verbose

# Check generated report
open migration-report.html

# Test realistic scenarios
unjucks generate component new TestComponent
unjucks generate api endpoint users
unjucks generate test spec UserSpec
```

## Common Issues

### Issue: Unmatched Braces

**Problem**: 
```
Warning: Unmatched control structures: 3 opening, 2 closing
```

**Solution**: Check for missing `{% endif %}` or `{% endfor %}` tags

### Issue: Unconverted EJS Syntax

**Problem**:
```nunjucks
<!-- Still has EJS syntax -->
export const <%= name %> = {};
```

**Solution**: Manually convert to `{{ name }}`

### Issue: Complex JavaScript Logic

**Problem**: Complex JavaScript in templates fails conversion

**Solution**: Move logic to helper functions:

```typescript
// helpers/utils.ts
export function complexLogic(data: any) {
  // Your complex logic here
  return result;
}
```

### Issue: Missing Template Variables

**Problem**: Template renders but variables are undefined

**Solution**: Check variable names and update template calls:

```bash
# Old Hygen style
hygen component new MyComponent

# New Unjucks style  
unjucks generate component new --name MyComponent
```

### Issue: File Injection Not Working

**Problem**: Injection templates don't modify target files

**Solution**: Verify frontmatter syntax and target file exists:

```yaml
---
to: src/index.js
inject: true
after: "// EXPORTS"
skipIf: "export { {{ name }} }"
---
export { {{ name }} } from './{{ name }}';
```

## Best Practices

### 1. Always Create Backups

```bash
unjucks migrate --backup --force
```

### 2. Start with Dry Run

```bash
unjucks migrate --dry --verbose
```

### 3. Validate After Migration

```bash
unjucks migrate --validate --report
```

### 4. Test All Generators

```bash
# Test each generator
unjucks list
unjucks generate component new TestComponent --dry
unjucks generate api endpoint test --dry
```

### 5. Update CI/CD Scripts

Update your deployment scripts:

```diff
- hygen component new $COMPONENT_NAME
+ unjucks generate component new --name $COMPONENT_NAME
```

### 6. Organize Templates

Follow Unjucks directory structure:

```
templates/
├── component/
│   ├── new/
│   │   ├── component.tsx
│   │   └── test.spec.tsx
│   └── story/
│       └── story.stories.tsx
├── api/
│   └── endpoint/
│       └── route.ts
└── helpers/
    ├── filters.ts
    └── utils.ts
```

### 7. Use Type-Safe Configuration

```typescript
// unjucks.config.ts
import { defineConfig } from "unjucks";

export default defineConfig({
  templates: "templates",
  helpers: "helpers",
  extensions: [".ts", ".tsx", ".js", ".jsx", ".md"],
  defaults: {
    author: "Your Name",
    license: "MIT"
  }
});
```

## Migration Checklist

- [ ] Backup original `_templates` directory
- [ ] Run migration tool with `--dry` flag first
- [ ] Review migration report for issues
- [ ] Run actual migration with `--backup`
- [ ] Update package.json scripts
- [ ] Test all generators with `--dry` flag
- [ ] Move complex logic to helper functions
- [ ] Update CI/CD scripts
- [ ] Train team on new Unjucks syntax
- [ ] Update documentation

## Support

If you encounter issues during migration:

1. **Check the migration report** - Look for specific error messages
2. **Run with `--verbose`** - Get detailed conversion logs
3. **Test incrementally** - Migrate one generator at a time
4. **Review manual fixes** - Some patterns need hand-tuning
5. **Create an issue** - Report bugs or compatibility problems

## Examples

### Complete Migration Example

```bash
# 1. Backup and migrate
unjucks migrate --source _templates --target templates --backup --verbose

# 2. Review results
open migration-report.html

# 3. Test generators
unjucks list
unjucks generate component new TestComponent --dry

# 4. Update package.json
# (automatically done by migration tool)

# 5. Update CI/CD scripts
sed -i 's/hygen/unjucks generate/g' .github/workflows/deploy.yml

# 6. Train team
echo "Migration complete! Use 'unjucks generate' instead of 'hygen'"
```

### Real-World Template Migration

**Before (Hygen)**:
```javascript
---
to: src/components/<%= name %>.tsx
---
import React from 'react';
<% if (withProps) { %>
interface <%= name %>Props {
  <% props.forEach(function(prop) { %>
  <%= prop.name %><%= prop.optional ? '?' : '' %>: <%= prop.type %>;
  <% }); %>
}
<% } %>

export const <%= name %><% if (withProps) { %>: React.FC<<%= name %>Props><% } %> = (<% if (withProps) { %>{ <%= props.map(p => p.name).join(', ') %> }<% } %>) => {
  return (
    <<%= htmlTag || 'div' %><% if (className) { %> className="<%= className %>"<% } %>>
      <% if (withProps && title) { %>
      <h1>{<%= title %>}</h1>
      <% } else { %>
      <h1><%= name %></h1>
      <% } %>
    </<%= htmlTag || 'div' %>>
  );
};
```

**After (Unjucks)**:
```nunjucks
---
to: src/components/{{ name }}.tsx
---
import React from 'react';
{% if withProps %}
interface {{ name }}Props {
  {% for prop in props %}
  {{ prop.name }}{{ prop.optional and '?' or '' }}: {{ prop.type }};
  {% endfor %}
}
{% endif %}

export const {{ name }}{% if withProps %}: React.FC<{{ name }}Props>{% endif %} = ({% if withProps %}{ {{ props | map(attribute='name') | join(', ') }} }{% endif %}) => {
  return (
    <{{ htmlTag | default('div') }}{% if className %} className="{{ className }}"{% endif %}>
      {% if withProps and title %}
      <h1>{{{ title }}}</h1>
      {% else %}
      <h1>{{ name }}</h1>
      {% endif %}
    </{{ htmlTag | default('div') }}>
  );
};
```

This migration maintains 100% functionality while using Unjucks syntax!

---

**🎉 Your Hygen templates are now ready for the future with Unjucks!**