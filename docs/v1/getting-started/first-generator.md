# Create Your First Generator

Learn to build custom templates and generators for your specific needs. This guide focuses on practical, testable examples.

## Overview

A generator consists of:
- **Template files** with variable placeholders
- **Configuration** defining prompts and options
- **Directory structure** organizing related templates

## Step-by-Step Generator Creation

### Step 1: Set Up Project Structure

```bash
# Create project directory
mkdir my-generator-project && cd my-generator-project

# Initialize basic structure
mkdir -p _templates/component/react
```

### Step 2: Create Your First Template

Create the template file with Nunjucks syntax:

```bash
# Create the React component template
cat > _templates/component/react/{{ componentName | pascalCase }}.tsx << 'EOF'
import React from 'react';

interface {{ componentName | pascalCase }}Props {
{% if withProps %}
  // Add your props here
  className?: string;
  children?: React.ReactNode;
{% endif %}
}

export const {{ componentName | pascalCase }}: React.FC<{{ componentName | pascalCase }}Props> = ({% if withProps %}props{% endif %}) => {
  return (
    <div{% if withProps %} className={props.className}{% endif %}>
      <h2>{{ componentName | titleCase }}</h2>
      {% if withProps %}
      {props.children}
      {% endif %}
    </div>
  );
};

export default {{ componentName | pascalCase }};
EOF
```

### Step 3: Add Test Template (Optional)

```bash
# Create test template
cat > '_templates/component/react/{{ componentName | pascalCase }}.test.tsx' << 'EOF'
{% if withTests %}
import { render, screen } from '@testing-library/react';
import { {{ componentName | pascalCase }} } from './{{ componentName | pascalCase }}';

describe('{{ componentName | pascalCase }}', () => {
  it('should render component title', () => {
    render(<{{ componentName | pascalCase }} />);
    
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.getByText('{{ componentName | titleCase }}')).toBeInTheDocument();
  });

  {% if withProps %}
  it('should render children when provided', () => {
    render(
      <{{ componentName | pascalCase }}>
        <span>Test content</span>
      </{{ componentName | pascalCase }}>
    );
    
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });
  {% endif %}
});
{% endif %}
EOF
```

### Step 4: Create Generator Configuration

```bash
# Create configuration file
cat > _templates/component/config.yml << 'EOF'
name: "component"
description: "Generate React components"
templates:
  - name: "react"
    description: "React functional component with TypeScript"
    files:
      - "{{ componentName | pascalCase }}.tsx"
      - "{{ componentName | pascalCase }}.test.tsx"
    prompts:
      - name: "componentName"
        message: "Component name:"
        type: "input"
        required: true
        validate: "^[a-zA-Z][a-zA-Z0-9]*$"
      - name: "withProps"
        message: "Include props interface?"
        type: "confirm"
        default: true
      - name: "withTests"
        message: "Include test file?"
        type: "confirm"
        default: true
EOF
```

### Step 5: Create Project Configuration

```bash
# Create main config file
cat > unjucks.yml << 'EOF'
version: "1.0.0"
generators: "_templates"
EOF
```

## Test Your Generator

### Basic Tests

```bash
# 1. List generators
unjucks list
```
**Expected output:**
```
📦 Available Generators:

component
├── react - React functional component with TypeScript
└── Description: Generate React components
```

```bash
# 2. Get help for your template
unjucks help component react
```
**Expected output:**
```
Template: react
Description: React functional component with TypeScript

Variables:
  --componentName   Component name (required)
  --withProps       Include props interface? (default: true)
  --withTests       Include test file? (default: true)
```

```bash
# 3. Dry run generation
unjucks generate component react --dry --componentName=Button --dest=./src/components
```
**Expected output:**
```
🔍 Dry run - no files will be created

Would create:
  src/components/Button.tsx
  src/components/Button.test.tsx
```

```bash
# 4. Generate files
unjucks generate component react --componentName=Button --withProps --withTests --dest=./src/components
```

### Verify Generated Files

```bash
# Check files were created
ls -la src/components/
```
**Expected files:**
- `Button.tsx`
- `Button.test.tsx`

```bash
# Verify content
cat src/components/Button.tsx
```
**Expected content includes:**
- `export const Button: React.FC<ButtonProps>`
- Props interface (if `--withProps` was true)
- Proper TypeScript syntax

## Advanced Template Features

### 1. Conditional File Generation

Modify config to conditionally create test files:

```yaml
# In config.yml
templates:
  - name: "react"
    files:
      - path: "{{ componentName | pascalCase }}.tsx"
      - path: "{{ componentName | pascalCase }}.test.tsx"
        skipIf: "{{ withTests == false }}"
```

### 2. File Injection

Inject into existing files:

```yaml
# Add to config.yml
  - name: "react-with-index"
    files:
      - "{{ componentName | pascalCase }}.tsx"
      - path: "index.ts"
        inject: true
        after: "// Export components"
        content: "export { {{ componentName | pascalCase }} } from './{{ componentName | pascalCase }}';"
```

### 3. Complex Variables

Add advanced prompts:

```yaml
prompts:
  - name: "componentType"
    message: "Component type:"
    type: "select"
    choices:
      - "functional"
      - "class" 
      - "hook"
  - name: "stateManagement"
    message: "State management:"
    type: "multiselect"
    choices:
      - "useState"
      - "useEffect"
      - "useContext"
    when: "{{ componentType == 'functional' }}"
```

### 4. Template Inheritance

Create base template:

```typescript
// _templates/component/base/base.tsx
import React from 'react';

{% block imports %}{% endblock %}

{% block interface %}
interface {{ componentName | pascalCase }}Props {
  className?: string;
}
{% endblock %}

{% block component %}
export const {{ componentName | pascalCase }}: React.FC<{{ componentName | pascalCase }}Props> = (props) => {
  return (
    {% block content %}
    <div className={props.className}>
      {{ componentName | titleCase }}
    </div>
    {% endblock %}
  );
};
{% endblock %}
```

Use inheritance in specific templates:

```typescript
// _templates/component/react/{{ componentName | pascalCase }}.tsx
{% extends "base.tsx" %}

{% block imports %}
{% if withState %}
import { useState } from 'react';
{% endif %}
{% endblock %}

{% block content %}
<div className={props.className}>
  <h2>{{ componentName | titleCase }}</h2>
  {% if withState %}
  <p>State: {state}</p>
  {% endif %}
</div>
{% endblock %}
```

## Testing Your Generator

### Automated Tests

Create test script:

```bash
#!/bin/bash
# test-generator.sh

echo "Testing generator..."

# Cleanup
rm -rf test-output

# Test 1: Basic generation
echo "Test 1: Basic component generation"
unjucks generate component react --componentName=TestComponent --withProps --withTests --dest=./test-output

if [[ -f "test-output/TestComponent.tsx" && -f "test-output/TestComponent.test.tsx" ]]; then
  echo "✅ Test 1 passed"
else
  echo "❌ Test 1 failed"
  exit 1
fi

# Test 2: No tests
echo "Test 2: Component without tests"
unjucks generate component react --componentName=NoTestComponent --withProps --no-withTests --dest=./test-output --force

if [[ -f "test-output/NoTestComponent.tsx" && ! -f "test-output/NoTestComponent.test.tsx" ]]; then
  echo "✅ Test 2 passed"
else
  echo "❌ Test 2 failed"
  exit 1
fi

# Test 3: Dry run
echo "Test 3: Dry run"
output=$(unjucks generate component react --dry --componentName=DryRun --dest=./test-output)
if [[ $output == *"Would create"* ]]; then
  echo "✅ Test 3 passed"
else
  echo "❌ Test 3 failed"
  exit 1
fi

echo "🎉 All tests passed!"
rm -rf test-output
```

```bash
# Make executable and run
chmod +x test-generator.sh
./test-generator.sh
```

### Manual Testing Checklist

- [ ] `unjucks list` shows your generator
- [ ] `unjucks help component react` shows variables
- [ ] Dry run preview shows expected files
- [ ] Generation creates files with correct names
- [ ] Generated code has proper variable substitution
- [ ] Conditional logic works (with/without tests)
- [ ] Force overwrite works
- [ ] Interactive prompts work when variables missing

## Best Practices

### Template Design
1. **Keep templates focused** - One responsibility per template
2. **Use descriptive variables** - `componentName` vs `name`
3. **Provide sensible defaults** - Most common use case should need minimal input
4. **Include validation** - Use regex patterns for variable validation

### File Organization
```
_templates/
├── component/          # Generator
│   ├── config.yml     # Configuration
│   ├── react/         # Template variant
│   │   ├── {{ componentName | pascalCase }}.tsx
│   │   └── {{ componentName | pascalCase }}.test.tsx
│   └── vue/           # Alternative template
│       └── {{ componentName | pascalCase }}.vue
└── page/              # Another generator
    └── next/
        └── page.tsx
```

### Variable Conventions
- Use `camelCase` for variable names
- Include type prefixes: `with*` (boolean), `has*` (boolean), `*Name` (string)
- Group related variables: `api*`, `component*`, `test*`

## Troubleshooting

### Template Not Rendering
```
Variables not being replaced: {{ componentName }}
```
**Check:**
- Correct Nunjucks syntax: `{{ }}` not `{ }`
- Variable name matches config
- File has proper extension

### Config Not Found
```
Error: Generator 'component' not found
```
**Solutions:**
```bash
# Check file exists
ls -la _templates/component/config.yml

# Validate YAML syntax
cat _templates/component/config.yml | python -c "import yaml,sys;yaml.safe_load(sys.stdin)"
```

### Permission Issues
```bash
# Ensure template files are readable
chmod -R 644 _templates/
chmod -R 755 _templates/*/
```

## Next Steps

1. **[Template Development](../templates/README.md)** - Advanced template features
2. **[CLI Reference](../cli/README.md)** - Complete command documentation  
3. **[Configuration Guide](../configuration/README.md)** - Advanced configuration options
4. **[Testing Guide](../testing/README.md)** - BDD testing strategies

---

**Ready to share?** Consider contributing your generators to the [community templates repository](https://github.com/unjs/unjucks-templates)!