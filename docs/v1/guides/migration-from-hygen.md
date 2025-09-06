# Migration from Hygen to Unjucks

> **TL;DR**: Change `.ejs.t` → `.njk`, update `<%= var %>` → `{{ var }}`, frontmatter stays the same. Done in 5 minutes.

This guide helps you migrate existing Hygen templates to Unjucks with minimal effort. Most templates work with just syntax changes.

## Quick Migration Checklist

- [ ] Rename `.ejs.t` files to `.njk`
- [ ] Update variable syntax: `<%= name %>` → `{{ name }}`
- [ ] Test generators: `unjucks list` and `unjucks generate`
- [ ] Update any custom helpers to Nunjucks filters

## Side-by-Side Comparison

### File Extensions
```bash
# Hygen
_templates/component/new/index.ejs.t
_templates/component/new/test.ejs.t

# Unjucks
_templates/component/new/index.njk
_templates/component/new/test.njk
```

### Variable Syntax
```diff
# Hygen (EJS)
- <%= name %>
- <%= name.toLowerCase() %>
- <%- include('partial') %>

# Unjucks (Nunjucks)
+ {{ name }}
+ {{ name | lower }}
+ {% include 'partial.njk' %}
```

### Frontmatter (Same!)
```yaml
---
to: src/components/<%= name %>.tsx    # Hygen
to: src/components/{{ name }}.tsx     # Unjucks
inject: true
before: "// NEW COMPONENT"
---
```

## Common Migration Patterns

### 1. Basic Component Template

**Before (Hygen)**:
```ejs
---
to: src/components/<%= name %>.tsx
---
import React from 'react';

interface <%= name %>Props {
  <% if (withProps) { %>className?: string;<% } %>
}

export const <%= name %>: React.FC<<%= name %>Props> = () => {
  return <div><%= name %></div>;
};
```

**After (Unjucks)**:
```nunjucks
---
to: src/components/{{ name | pascalCase }}.tsx
---
import React from 'react';

interface {{ name | pascalCase }}Props {
  {% if withProps %}className?: string;{% endif %}
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = () => {
  return <div>{{ name | pascalCase }}</div>;
};
```

### 2. Conditional File Creation

**Before (Hygen)**:
```ejs
---
to: <%= withTests ? `src/components/${name}.test.tsx` : null %>
---
```

**After (Unjucks)**:
```nunjucks
---
to: {% if withTests %}src/components/{{ name }}.test.tsx{% endif %}
skipIf: "{{ not withTests }}"
---
```

### 3. File Injection

**Before (Hygen)**:
```ejs
---
to: src/index.ts
inject: true
after: "// EXPORTS"
---
export { <%= name %> } from './components/<%= name %>';
```

**After (Unjucks)**:
```nunjucks
---
to: src/index.ts
inject: true
after: "// EXPORTS"
---
export { {{ name | pascalCase }} } from './components/{{ name | pascalCase }}';
```

## Filter Mappings

Common EJS helpers to Nunjucks filters:

| Hygen/EJS | Unjucks/Nunjucks | Example |
|-----------|------------------|---------|
| `name.toLowerCase()` | `name \| lower` | `{{ name \| lower }}` |
| `name.toUpperCase()` | `name \| upper` | `{{ name \| upper }}` |
| Custom `pascalCase()` | `name \| pascalCase` | `{{ name \| pascalCase }}` |
| Custom `camelCase()` | `name \| camelCase` | `{{ name \| camelCase }}` |
| Custom `kebabCase()` | `name \| kebabCase` | `{{ name \| kebabCase }}` |

## Migration Script

Here's a quick script to migrate your templates:

```bash
#!/bin/bash
# migrate-hygen.sh

echo "🔄 Migrating Hygen templates to Unjucks..."

# Rename .ejs.t to .njk
find _templates -name "*.ejs.t" -exec sh -c '
  for file do
    newname="${file%.ejs.t}.njk"
    mv "$file" "$newname"
    echo "Renamed: $file → $newname"
  done
' _ {} +

# Replace variable syntax (basic regex)
find _templates -name "*.njk" -exec sed -i '' -e 's/<%=/{{/g' -e 's/%>/}}/g' {} +

echo "✅ Basic migration complete!"
echo "ℹ️  Review files manually for:"
echo "   - Complex EJS logic → Nunjucks syntax"
echo "   - Custom helpers → Nunjucks filters"
echo "   - Includes and partials"
echo ""
echo "Test with: unjucks list"
```

## Testing Your Migration

After migration, verify everything works:

```bash
# 1. List generators (should show your migrated templates)
unjucks list

# 2. Get help for a specific generator
unjucks help component new

# 3. Generate a test file
unjucks generate component new --name=TestComponent --withProps

# 4. Check the output
cat src/components/TestComponent.tsx
```

## Common Migration Issues

### Issue: Variables Not Rendering
```bash
# Problem: Still seeing {{ name }} in output
# Solution: Check quotes in frontmatter
---
to: "src/components/{{ name }}.tsx"  # ✅ Quoted
to: src/components/{{ name }}.tsx    # ❌ May not parse
---
```

### Issue: Filters Not Working
```bash
# Problem: {{ name | pascalCase }} shows as literal text
# Solution: Ensure Unjucks has the filter registered
npm list unjucks  # Check version has case filters
```

### Issue: Complex Logic
```bash
# Problem: Complex EJS logic doesn't translate directly
# Solution: Simplify or use Nunjucks macros
```

## Advanced Migration

For complex Hygen setups with custom helpers:

```typescript
// unjucks.config.ts
import { defineConfig } from 'unjucks';

export default defineConfig({
  templatesDir: '_templates',
  // Custom filters (replaces Hygen helpers)
  filters: {
    myCustomFilter: (str: string) => str.toUpperCase()
  }
});
```

## What You Get After Migration

- ✅ **Same workflow**: `unjucks generate` instead of `hygen generate`
- ✅ **Better performance**: Nunjucks is faster than EJS
- ✅ **More features**: RDF metadata, file injection, TypeScript
- ✅ **Better CLI**: Auto-generated flags from template variables
- ✅ **Testing**: Built-in BDD testing with Vitest+Cucumber

## Need Help?

- 🔍 **Compare templates**: Look at example migrations in `/examples/`
- 🐛 **Issues**: File migration problems on GitHub
- 💬 **Ask**: Use GitHub Discussions for migration questions

---

*Migration completed successfully? Delete this file and start creating amazing templates with Unjucks!*