# Troubleshooting Guide

> **Quick Fix**: 90% of issues are solved by `unjucks list` (check templates exist) and `unjucks --version` (check installation).

Common issues and solutions for Unjucks users.

## Installation Issues

### ❌ Command Not Found: `unjucks`

**Symptoms**:
```bash
$ unjucks list
zsh: command not found: unjucks
```

**Solutions**:
```bash
# Check if installed globally
npm list -g unjucks

# Install globally
npm install -g unjucks

# Or use npx
npx unjucks list

# Check PATH
echo $PATH | grep npm
```

### ❌ Wrong Version

**Symptoms**:
```bash
$ unjucks --version
0.5.2  # Should be 1.x
```

**Solution**:
```bash
# Update to latest
npm install -g unjucks@latest

# Check version
unjucks --version
```

## Template Issues

### ❌ No Templates Found

**Symptoms**:
```bash
$ unjucks list
No generators found in _templates directory
```

**Solutions**:
```bash
# Check directory exists
ls -la _templates/

# Initialize templates
unjucks init

# Check config points to right directory
cat unjucks.config.ts

# Verify structure
tree _templates/
```

### ❌ Template Not Rendering Variables

**Symptoms**:
```bash
# Output shows literal {{ name }} instead of actual value
cat src/Component.tsx
// Shows: export const {{ name }} = ...
```

**Solutions**:
```bash
# 1. Check frontmatter quotes
cat _templates/component/new/index.njk
# Should be:
---
to: "src/components/{{ name }}.tsx"  # ✅ Quoted
---

# 2. Check variable is passed
unjucks generate component new --name=Button

# 3. Debug with --dry
unjucks generate component new --name=Button --dry
```

### ❌ Filters Not Working

**Symptoms**:
```bash
# {{ name | pascalCase }} shows as literal text
```

**Solutions**:
```bash
# Check Unjucks version (filters added in v1.0)
unjucks --version

# Test basic filters first
{{ name | upper }}  # Should work

# Custom filters need config
# unjucks.config.ts
export default {
  filters: {
    myFilter: (str) => str.toUpperCase()
  }
}
```

## Generation Issues

### ❌ File Not Created

**Symptoms**:
```bash
$ unjucks generate component new --name=Button
✅ Generated component/new
$ ls src/components/
# Nothing there
```

**Solutions**:
```bash
# 1. Check template path in frontmatter
cat _templates/component/new/index.njk
---
to: src/components/{{ name }}.tsx  # Correct path?
---

# 2. Check directory exists
mkdir -p src/components

# 3. Use absolute path for testing
---
to: "/tmp/test/{{ name }}.tsx"
---

# 4. Check permissions
ls -la src/components/
```

### ❌ Variables Not Passed

**Symptoms**:
```bash
# CLI flags not working
unjucks generate component new --name=Button --withProps=true
# Template doesn't receive withProps
```

**Solutions**:
```bash
# 1. Use format: --flag=value (not --flag value)
unjucks generate component new --name=Button --withProps=true

# 2. Check template uses correct variable name
{{ withProps }}  # Should match CLI flag exactly

# 3. Debug with help
unjucks help component new
# Shows expected variables

# 4. Check boolean handling
{% if withProps %}  # For true/false
{% if withProps == 'true' %}  # If passed as string
```

## File Injection Issues

### ❌ Injection Not Working

**Symptoms**:
```bash
# Files not being updated with inject: true
```

**Solutions**:
```bash
# 1. Check target file exists
ls -la src/index.ts

# 2. Check injection markers exist in target file
cat src/index.ts
# Should contain: // EXPORTS (if using after: "// EXPORTS")

# 3. Test injection markers
grep "// EXPORTS" src/index.ts

# 4. Use skipIf to prevent duplicates
---
inject: true
after: "// EXPORTS"
skipIf: "{{ name }}"  # Skip if name already exists
---
```

## Configuration Issues

### ❌ Config Not Loading

**Symptoms**:
```bash
# unjucks.config.ts changes not taking effect
```

**Solutions**:
```bash
# 1. Check file name
ls unjucks.config.*
# Should be: unjucks.config.ts, .js, or .json

# 2. Check TypeScript syntax
npx tsc --noEmit unjucks.config.ts

# 3. Try .js version for testing
mv unjucks.config.ts unjucks.config.js

# 4. Debug config loading
unjucks --debug list
```

### ❌ TypeScript Errors

**Symptoms**:
```bash
# Config file has TypeScript errors
```

**Solution**:
```typescript
// unjucks.config.ts
import { defineConfig } from 'unjucks';

export default defineConfig({
  templatesDir: '_templates',
  outputDir: 'src'
});
```

## Performance Issues

### ❌ Slow Template Generation

**Symptoms**:
```bash
# Templates taking >5 seconds to generate
```

**Solutions**:
```bash
# 1. Check template size
find _templates -name "*.njk" -exec wc -l {} +

# 2. Profile with debug
unjucks --debug generate component new --name=Test

# 3. Simplify templates
# Avoid complex loops/conditions in templates

# 4. Cache templates
# Set caching in config if available
```

## CLI Issues

### ❌ Help Not Working

**Symptoms**:
```bash
$ unjucks help component new
Template not found
```

**Solutions**:
```bash
# 1. Check exact names
unjucks list  # Shows: component/new

# 2. Use exact path
unjucks help component/new

# 3. Check template exists
ls _templates/component/new/
```

### ❌ Flags Not Recognized

**Symptoms**:
```bash
$ unjucks generate component new --unknown-flag=value
Unknown option: --unknown-flag
```

**Solutions**:
```bash
# 1. Check available flags
unjucks help component new

# 2. Flags come from template variables
# Add {{ unknownFlag }} to template to enable --unknown-flag

# 3. Use -- to pass extra args
unjucks generate component new -- --extra-arg
```

## Debugging Steps

### Basic Debug Checklist

```bash
# 1. Version
unjucks --version

# 2. Installation
which unjucks
npm list -g unjucks

# 3. Templates
unjucks list
ls -la _templates/

# 4. Config
ls unjucks.config.*
cat unjucks.config.ts

# 5. Generation test
unjucks generate component new --name=Debug --dry
```

### Advanced Debugging

```bash
# Enable debug mode
DEBUG=unjucks* unjucks generate component new --name=Debug

# Or use --debug flag
unjucks --debug generate component new --name=Debug

# Check template structure
tree _templates/

# Validate template syntax
# (Create a minimal template to test)
```

## Getting Help

### Before Asking for Help

1. ✅ Check this troubleshooting guide
2. ✅ Run `unjucks --version` and `unjucks list`  
3. ✅ Try with a minimal template
4. ✅ Check existing GitHub issues

### How to Report Issues

```bash
# Include these in your issue:
unjucks --version
node --version
npm --version
cat unjucks.config.ts
ls -la _templates/
```

### Community Resources

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/unjs/unjucks/issues)
- 💬 **Questions**: [GitHub Discussions](https://github.com/unjs/unjucks/discussions)
- 📚 **Examples**: `/examples/` directory in repo

---

**Still stuck?** Create a minimal reproduction case and file an issue on GitHub.