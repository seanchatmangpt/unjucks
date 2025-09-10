# Frontmatter Capabilities Analysis

## Overview

This document analyzes the frontmatter processing capabilities discovered in the Unjucks codebase. The system implements a sophisticated file injection and template processing engine with YAML frontmatter support.

## Frontmatter Processing Implementation

### Core Processing

**Location**: `src/commands/generate.js` (lines 484, 335)
- Uses `gray-matter` library for frontmatter parsing
- Processes frontmatter to extract metadata and inject directives
- Separates content from frontmatter configuration

```javascript
const { data: frontmatter, content } = matter(templateContent);
```

### Template Engine Integration

**Security Engine**: `SecureTemplateEngine` and `PerfectTemplateEngine`
- Primary: SecureTemplateEngine with autoescape enabled
- Fallback: PerfectTemplateEngine for legacy compatibility
- Both support frontmatter-driven processing

## Injection System

### File Modification Patterns

The system supports multiple injection modes discovered in template files:

#### 1. Standard File Creation
```yaml
---
to: src/{{ componentName | pascalCase }}.ts
---
```

#### 2. File Injection Mode
```yaml
---
to: src/config/database.js
inject: true
after: "// Database config"
---
```

#### 3. Append Operations
```yaml
---
to: package.json
append: true
---
```

#### 4. Prepend Operations
```yaml
---
to: src/index.js
prepend: true
---
```

#### 5. Line-based Injection
```yaml
---
to: src/router.js
lineAt: 15
---
```

#### 6. Before/After Pattern Injection
```yaml
---
to: src/app.js
inject: true
before: "module.exports"
---
```

### Injection Directives Found

Based on template analysis and test fixtures:

| Directive | Purpose | Example |
|-----------|---------|---------|
| `inject:` | Enable injection mode | `inject: true` |
| `to:` | Target file path (with template processing) | `to: src/{{ name }}.js` |
| `append:` | Append to end of file | `append: true` |
| `prepend:` | Prepend to start of file | `prepend: true` |
| `before:` | Insert before pattern | `before: "pattern"` |
| `after:` | Insert after pattern | `after: "pattern"` |
| `lineAt:` | Insert at specific line | `lineAt: 42` |
| `skipIf:` | Conditional processing | `skipIf: "{{ condition }}"` |
| `chmod:` | Set file permissions | `chmod: 0755` |
| `sh:` | Execute shell command | `sh: "npm install"` |

## Conditional Processing (skipIf)

### Implementation
Found in `tests/fixtures/frontmatter/injection-modes.njk`:
```yaml
skip_if: '{{ skipCondition }}'
```

And in test files:
```yaml
skipIf: "{{ shouldSkip === true }}"
skipIf: "model {{ entityName }}"
```

### Pattern Matching
The system supports:
- Variable conditions: `{{ variable === value }}`
- Content existence checks: `model {{ entityName }}`
- Complex expressions with template processing

## Multi-operation Support

### Template Example from `injection-modes.njk`
```yaml
---
to: src/{{ moduleType }}/{{ name | kebabCase }}.{{ extension | default('ts') }}
inject: {{ injectMode | default('false') }}
{% if injectMode === 'before' %}before: '{{ beforePattern }}'
{% elif injectMode === 'after' %}after: '{{ afterPattern }}'
{% elif injectMode === 'append' %}append: '{{ appendContent }}'
{% elif injectMode === 'prepend' %}prepend: '{{ prependContent }}'
{% elif injectMode === 'lineAt' %}lineAt: {{ lineNumber | default('1') }}
{% endif %}
skip_if: '{{ skipCondition }}'
chmod: {{ permissions | default('0644') }}
sh: {{ shellCommand }}
---
```

## Template Metadata Handling

### Variable Processing
From `src/commands/generate.js`:
- Scans templates for `{{ variable }}` patterns
- Extracts variables from both frontmatter and content
- Builds CLI flag mapping automatically
- Supports dynamic `to:` path rendering

### Filter Support
Template paths support Nunjucks filters:
- `{{ componentName | pascalCase }}`
- `{{ name | kebabCase }}`  
- `{{ now | formatDate('YYYY-MM-DD') }}`

## Security Implementation

### Path Validation
From `file-injector.ts.backup`:
- Validates file paths against dangerous system directories
- Prevents path traversal attacks
- File size limits (100MB)
- Template depth limits (max 10)

### Operation Timeouts
- Template processing: 30 seconds
- File operations: 5 seconds each
- Lock timeout handling

## Working Code Patterns

### 1. Basic Template with Injection
```yaml
---
to: src/components/{{ componentName | pascalCase }}.tsx
---
// Component content here
```

### 2. Database Model with Conditional Injection
```yaml
---
to: prisma/schema.prisma
inject: true
skipIf: "model {{ entityName }}"
---
model {{ entityName }} {
  // Model definition
}
```

### 3. Multi-mode Template
```yaml
---
to: src/{{ name }}.js
inject: {{ inject | default('false') }}
{% if inject %}after: "// Insert point"{% endif %}
chmod: 0644
---
// Generated content
```

### 4. Command with Shell Execution
```yaml
---
to: package.json
inject: true
after: '"dependencies": {'
sh: "npm install"
---
"{{ packageName }}": "{{ version }}"
```

## File Injector Architecture

### SimpleFileInjectorOrchestrator
Used in `src/commands/generate.js`:
- Orchestrates all file operations
- Handles atomic writes
- Manages backups
- Executes post-processing commands

### Process Flow
1. Parse frontmatter with `gray-matter`
2. Extract injection directives
3. Render template content
4. Process dynamic `to:` path
5. Execute injection based on mode
6. Apply chmod if specified
7. Run shell commands if present

## Template Discovery Integration

Templates are discovered across multiple locations:
- `_templates/` directory
- `node_modules/@seanchatmangpt/unjucks/_templates`
- Recursive scanning for `.njk`, `.ejs`, `.hbs` files

## Error Handling

### Idempotent Operations
- Uses `skipIf` for duplicate prevention
- Content existence checking
- Marker-based injection points

### Validation
- Required variable checking
- Template syntax validation
- Security path validation
- Permission verification

## Summary

The Unjucks frontmatter system provides:

1. **Comprehensive Injection Modes**: append, prepend, before, after, lineAt
2. **Conditional Processing**: skipIf with template expressions
3. **Multi-operation Support**: Single template can handle multiple scenarios
4. **Security Features**: Path validation, timeouts, size limits
5. **Shell Integration**: Post-processing command execution
6. **Permission Management**: Automatic chmod support
7. **Template Metadata**: Dynamic path generation with filters

This creates a powerful, secure, and flexible file generation and modification system that goes beyond simple template rendering to provide sophisticated file injection capabilities.