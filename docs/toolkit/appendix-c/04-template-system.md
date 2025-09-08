# 4. Template System

## 4.1 Overview

The Unjucks v2 template system represents a significant evolution from traditional template engines, incorporating frontmatter-driven configuration, dynamic path generation, and intelligent context awareness. Built on the robust Nunjucks foundation, it extends capabilities to support modern development workflows and AI-powered code generation.

## 4.2 Core Architecture

### 4.2.1 Template Structure

Every Unjucks template follows a consistent structure:

```
template-name/
├── index.njk              # Main template file
├── template.yml           # Template metadata and configuration
├── variables.yml          # Variable definitions and validation
├── hooks/                 # Pre/post processing hooks
│   ├── pre-generate.js
│   └── post-generate.js
├── partials/              # Reusable template components
│   ├── header.njk
│   └── footer.njk
└── examples/              # Usage examples and test cases
    ├── basic.yml
    └── advanced.yml
```

### 4.2.2 Frontmatter System

Templates use YAML frontmatter for configuration and metadata:

```yaml
---
# Basic template configuration
to: "{{ outputPath }}/{{ name | kebab }}.{{ extension | default('ts') }}"
inject: false
skipIf: "{{ skipExisting | default(false) }}"

# Template metadata
meta:
  name: "React Component Generator"
  description: "Generates a React functional component with TypeScript"
  version: "2.1.0"
  author: "Unjucks Team"
  category: "react"
  tags: ["react", "typescript", "component"]

# Variable definitions
variables:
  name:
    type: string
    required: true
    description: "Component name in PascalCase"
    pattern: "^[A-Z][a-zA-Z0-9]*$"
    example: "UserProfile"
  
  props:
    type: array
    required: false
    description: "Component props definition"
    items:
      type: object
      properties:
        name:
          type: string
          required: true
        type:
          type: string
          required: true
        optional:
          type: boolean
          default: false

# Conditional generation
conditions:
  hasProps: "{{ props && props.length > 0 }}"
  hasState: "{{ useState | default(false) }}"
  hasEffects: "{{ useEffect | default(false) }}"

# Dependencies and imports
dependencies:
  - name: "react"
    version: "^18.0.0"
    type: "peerDependency"
  - name: "@types/react"
    version: "^18.0.0"
    type: "devDependency"
    condition: "{{ typescript | default(true) }}"

# Template inheritance
extends: "base/typescript-file"

# Plugin configuration
plugins:
  - name: "prettier"
    config:
      parser: "typescript"
      singleQuote: true
  - name: "eslint"
    config:
      extends: ["@typescript-eslint/recommended"]
---
```

## 4.3 Template Language Features

### 4.3.1 Enhanced Nunjucks Syntax

Unjucks extends Nunjucks with additional features:

```nunjucks
{# Standard Nunjucks features #}
{% if hasProps %}
interface {{ name }}Props {
  {% for prop in props %}
  {{ prop.name }}{{ '?' if prop.optional }}: {{ prop.type }};
  {% endfor %}
}
{% endif %}

{# Unjucks-specific extensions #}
{% spec requirement="REQ-001" %}
const {{ name }}: React.FC<{{ name }}Props> = ({ 
  {% for prop in props %}{{ prop.name }}{% if not loop.last %}, {% endif %}{% endfor %}
}) => {
{% endspec %}

{# AI-powered code completion #}
{% ai_complete context="react-component-body" %}
  // Component implementation will be AI-generated based on requirements
{% end_ai_complete %}

{# Conditional blocks with complex logic #}
{% when hasState and not hasProps %}
const [state, setState] = useState<{{ stateType | default('any') }}>({{ initialState | default('null') }});
{% endwhen %}

{# Template composition #}
{% include "partials/react-hooks.njk" with { hooks: requiredHooks } %}

{# Dynamic imports based on features #}
{% imports %}
import React{% if hasState %}, { useState }{% endif %}{% if hasEffects %}, { useEffect }{% endif %} from 'react';
{% if hasProps %}import type { {{ name }}Props } from './types';{% endif %}
{% endimports %}
```

### 4.3.2 Built-in Filters

Unjucks provides an extensive set of filters for common transformations:

```nunjucks
{# Text transformations #}
{{ name | camelCase }}           {# userProfile #}
{{ name | pascalCase }}          {# UserProfile #}
{{ name | kebabCase }}           {# user-profile #}
{{ name | snakeCase }}           {# user_profile #}
{{ name | upperCase }}           {# USER PROFILE #}
{{ name | lowerCase }}           {# user profile #}
{{ name | titleCase }}           {# User Profile #}

{# Pluralization #}
{{ model | pluralize }}          {# user -> users #}
{{ model | singularize }}        {# users -> user #}

{# Code formatting #}
{{ code | indent(2) }}           {# Add 2-space indentation #}
{{ json | prettify }}            {# Format JSON with proper spacing #}
{{ sql | formatSql }}            {# Format SQL with proper indentation #}

{# File and path operations #}
{{ path | dirname }}             {# Get directory name #}
{{ path | basename }}            {# Get file name #}
{{ path | extname }}             {# Get file extension #}
{{ path | relative }}            {# Make path relative to current #}

{# Date and time #}
{{ now | date('YYYY-MM-DD') }}   {# Current date in ISO format #}
{{ timestamp | age }}            {# Human-readable age #}

{# Development helpers #}
{{ value | debug }}              {# Debug output with type info #}
{{ obj | keys }}                 {# Get object keys #}
{{ arr | unique }}               {# Remove duplicates from array #}
{{ str | hash }}                 {# Generate hash of string #}
```

### 4.3.3 Custom Global Functions

Global functions provide reusable logic across templates:

```nunjucks
{# File system operations #}
{% if fileExists('src/types.ts') %}
import type { BaseProps } from './types';
{% endif %}

{# Project analysis #}
{% set packageJson = readPackageJson() %}
{% set hasReact = hasDevDependency('react') %}
{% set tsConfig = readTsConfig() %}

{# Code generation helpers #}
{% set interfaceName = generateInterfaceName(name) %}
{% set fileName = generateFileName(name, options) %}
{% set imports = analyzeImports(dependencies) %}

{# Template utilities #}
{% set templateVersion = getTemplateVersion() %}
{% set generationTime = now() %}
{% set gitBranch = getCurrentBranch() %}
```

## 4.4 Dynamic Path Generation

### 4.4.1 Path Templates

Output paths are generated dynamically using template expressions:

```yaml
# Simple path template
to: "src/components/{{ name | kebab }}/index.tsx"

# Conditional path based on project structure
to: >
  {% if projectStructure.components.atomic %}
    src/components/{{ category | default('atoms') }}/{{ name | kebab }}/{{ name }}.tsx
  {% else %}
    src/components/{{ name }}.tsx
  {% endif %}

# Multi-file generation with dynamic paths
files:
  component:
    to: "src/components/{{ name }}/index.tsx"
    template: "component.njk"
  
  test:
    to: "src/components/{{ name }}/{{ name }}.test.tsx"
    template: "component.test.njk"
    condition: "{{ generateTests | default(true) }}"
  
  story:
    to: "src/components/{{ name }}/{{ name }}.stories.tsx"
    template: "component.stories.njk"
    condition: "{{ generateStories | default(false) }}"
  
  types:
    to: "src/components/{{ name }}/types.ts"
    template: "types.njk"
    condition: "{{ hasComplexProps }}"
```

### 4.4.2 Path Resolution Rules

The path resolution system follows these rules:

1. **Absolute Paths**: Paths starting with `/` are treated as absolute
2. **Relative Paths**: Paths are resolved relative to the current working directory
3. **Template Paths**: Variables in paths are resolved using the template context
4. **Conditional Paths**: Paths can include conditional logic for dynamic resolution
5. **Validation**: All paths are validated for security and correctness

```javascript
// Path resolution examples
const pathResolver = new PathResolver({
  workingDirectory: '/project/src',
  templateContext: { name: 'UserProfile', type: 'component' }
});

pathResolver.resolve('components/{{ name | kebab }}.tsx');
// Result: /project/src/components/user-profile.tsx

pathResolver.resolve('{{ type }}s/{{ name }}/index.ts');
// Result: /project/src/components/UserProfile/index.ts
```

## 4.5 Template Inheritance and Composition

### 4.5.1 Template Inheritance

Templates can extend base templates for shared functionality:

```yaml
# base/typescript-file.yml
---
meta:
  name: "Base TypeScript File"
  abstract: true

variables:
  typescript:
    type: boolean
    default: true
    description: "Generate TypeScript code"
  
  strict:
    type: boolean
    default: true
    description: "Use strict TypeScript settings"

plugins:
  - name: "prettier"
    config:
      parser: "{{ 'typescript' if typescript else 'javascript' }}"
---

{# Base template content #}
{% block fileHeader %}
/**
 * Generated by Unjucks v{{ version }}
 * Date: {{ now | date('YYYY-MM-DD HH:mm:ss') }}
 * Template: {{ templateName }}
 */
{% endblock %}

{% if typescript %}
{% block typeImports %}
// Type imports will be defined in child templates
{% endblock %}
{% endif %}

{% block content %}
// Content will be defined in child templates
{% endblock %}

{% block exports %}
// Exports will be defined in child templates
{% endblock %}
```

Child templates extend the base:

```yaml
# components/react-component.yml
---
extends: "base/typescript-file"

meta:
  name: "React Component"
  
variables:
  componentType:
    type: string
    enum: ["functional", "class"]
    default: "functional"
---

{% extends "base/typescript-file.njk" %}

{% block typeImports %}
import React{% if hasState %}, { useState }{% endif %} from 'react';
{% if hasProps %}
import type { {{ name }}Props } from './types';
{% endif %}
{% endblock %}

{% block content %}
{% if componentType === 'functional' %}
export const {{ name }}: React.FC<{{ name }}Props> = ({{ propsList }}) => {
  {% if hasState %}
  const [{{ stateVar }}, set{{ stateVar | pascalCase }}] = useState({{ initialState }});
  {% endif %}
  
  return (
    <div className="{{ name | kebab }}">
      {/* Component content */}
    </div>
  );
};
{% else %}
export class {{ name }} extends React.Component<{{ name }}Props> {
  render() {
    return (
      <div className="{{ name | kebab }}">
        {/* Component content */}
      </div>
    );
  }
}
{% endif %}
{% endblock %}
```

### 4.5.2 Template Composition

Templates can include and compose other templates:

```nunjucks
{# Main component template #}
{% include "partials/file-header.njk" %}

{% include "partials/imports.njk" with {
  imports: requiredImports,
  typescript: true
} %}

{% if hasTypes %}
{% include "partials/type-definitions.njk" %}
{% endif %}

{% include "partials/component-body.njk" with {
  componentType: "functional",
  props: componentProps
} %}

{% include "partials/export-statement.njk" %}
```

## 4.6 Variable System and Validation

### 4.6.1 Variable Definitions

Variables are defined with full type information and validation rules:

```yaml
variables:
  # String variables
  name:
    type: string
    required: true
    description: "Component name"
    pattern: "^[A-Z][a-zA-Z0-9]*$"
    example: "UserProfile"
    minLength: 2
    maxLength: 50
  
  # Number variables
  port:
    type: number
    required: false
    default: 3000
    description: "Server port number"
    minimum: 1000
    maximum: 65535
  
  # Boolean variables
  typescript:
    type: boolean
    default: true
    description: "Use TypeScript"
  
  # Array variables
  dependencies:
    type: array
    required: false
    description: "Package dependencies"
    items:
      type: string
      pattern: "^[@a-z0-9][a-z0-9-]*(/[a-z0-9-]+)*$"
    uniqueItems: true
  
  # Object variables
  database:
    type: object
    required: false
    description: "Database configuration"
    properties:
      type:
        type: string
        enum: ["mysql", "postgresql", "mongodb"]
        required: true
      host:
        type: string
        default: "localhost"
      port:
        type: number
        default: 5432
    additionalProperties: false
  
  # Conditional variables
  authProvider:
    type: string
    enum: ["auth0", "firebase", "cognito", "custom"]
    required: true
    when: "{{ authentication | default(false) }}"
    description: "Authentication provider (required when authentication is enabled)"
```

### 4.6.2 Variable Validation

The validation system ensures data integrity and provides clear error messages:

```javascript
class VariableValidator {
  validate(variables, values) {
    const errors = [];
    
    for (const [name, definition] of Object.entries(variables)) {
      const value = values[name];
      
      // Check required variables
      if (definition.required && (value === undefined || value === null)) {
        errors.push(`Variable '${name}' is required but not provided`);
        continue;
      }
      
      // Skip validation for undefined optional variables
      if (value === undefined || value === null) {
        continue;
      }
      
      // Type validation
      if (!this.validateType(value, definition.type)) {
        errors.push(`Variable '${name}' must be of type ${definition.type}, got ${typeof value}`);
        continue;
      }
      
      // Pattern validation for strings
      if (definition.type === 'string' && definition.pattern) {
        const regex = new RegExp(definition.pattern);
        if (!regex.test(value)) {
          errors.push(`Variable '${name}' does not match required pattern: ${definition.pattern}`);
        }
      }
      
      // Range validation for numbers
      if (definition.type === 'number') {
        if (definition.minimum !== undefined && value < definition.minimum) {
          errors.push(`Variable '${name}' must be at least ${definition.minimum}`);
        }
        if (definition.maximum !== undefined && value > definition.maximum) {
          errors.push(`Variable '${name}' must be at most ${definition.maximum}`);
        }
      }
      
      // Array validation
      if (definition.type === 'array') {
        if (definition.minItems && value.length < definition.minItems) {
          errors.push(`Variable '${name}' must have at least ${definition.minItems} items`);
        }
        if (definition.maxItems && value.length > definition.maxItems) {
          errors.push(`Variable '${name}' must have at most ${definition.maxItems} items`);
        }
        if (definition.uniqueItems && new Set(value).size !== value.length) {
          errors.push(`Variable '${name}' must have unique items`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

## 4.7 Conditional Generation

### 4.7.1 Conditional Blocks

Templates support complex conditional logic:

```nunjucks
{# Simple conditions #}
{% if hasDatabase %}
import { Database } from './database';
{% endif %}

{# Complex conditions with multiple variables #}
{% if authentication and (authProvider === 'auth0' or authProvider === 'firebase') %}
import { AuthProvider } from '@auth/{{ authProvider }}';
{% endif %}

{# Conditional file generation #}
{% if generateTests %}
{# This entire file will only be generated if generateTests is true #}
describe('{{ name }}', () => {
  it('should render correctly', () => {
    // Test implementation
  });
});
{% endif %}

{# Conditional sections with fallbacks #}
{% if hasCustomStyling %}
const styles = {
  {% for style in customStyles %}
  {{ style.name }}: '{{ style.value }}',
  {% endfor %}
};
{% else %}
const styles = {
  container: 'default-container-class',
  content: 'default-content-class'
};
{% endif %}
```

### 4.7.2 Advanced Conditional Logic

The template system supports sophisticated conditional expressions:

```yaml
# Conditional variable definitions
variables:
  port:
    type: number
    default: "{{ environment === 'production' ? 8080 : 3000 }}"
  
  sslEnabled:
    type: boolean
    default: "{{ environment === 'production' }}"
  
  databaseUrl:
    type: string
    required: "{{ useDatabase | default(false) }}"
    when: "{{ useDatabase }}"

# Conditional template inclusion
includes:
  - template: "auth/setup.njk"
    when: "{{ authentication }}"
  
  - template: "database/migrations.njk"
    when: "{{ useDatabase and generateMigrations }}"
  
  - template: "testing/setup.njk"
    when: "{{ generateTests and testFramework }}"

# Conditional file generation
files:
  dockerfile:
    to: "Dockerfile"
    template: "docker/dockerfile.njk"
    condition: "{{ deploymentTarget === 'docker' }}"
  
  kubernetes:
    to: "k8s/deployment.yaml"
    template: "k8s/deployment.njk"
    condition: "{{ deploymentTarget === 'kubernetes' }}"
```

## 4.8 Template Hooks and Lifecycle

### 4.8.1 Hook System

Templates can define hooks for pre and post-processing:

```javascript
// hooks/pre-generate.js
module.exports = {
  async execute(context) {
    // Validate project structure
    if (!context.fileExists('package.json')) {
      throw new Error('package.json not found. Is this a Node.js project?');
    }
    
    // Read and analyze package.json
    const packageJson = context.readJson('package.json');
    context.set('hasReact', packageJson.dependencies?.react !== undefined);
    context.set('hasTypeScript', packageJson.devDependencies?.typescript !== undefined);
    
    // Analyze existing code structure
    const componentExists = context.fileExists(`src/components/${context.get('name')}.tsx`);
    if (componentExists && !context.get('force')) {
      throw new Error(`Component ${context.get('name')} already exists. Use --force to overwrite.`);
    }
    
    // Set up additional context
    context.set('timestamp', new Date().toISOString());
    context.set('author', context.getGitUser());
  }
};

// hooks/post-generate.js
module.exports = {
  async execute(context, generatedFiles) {
    // Format generated files
    for (const file of generatedFiles) {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        await context.runCommand(`prettier --write "${file}"`);
      }
    }
    
    // Update imports in existing files
    if (context.get('updateImports')) {
      await this.updateImports(context, generatedFiles);
    }
    
    // Run linting
    if (context.get('runLint')) {
      await context.runCommand('npm run lint:fix');
    }
    
    // Update documentation
    if (context.get('updateDocs')) {
      await this.updateDocumentation(context, generatedFiles);
    }
  },
  
  async updateImports(context, files) {
    // Implementation for updating imports
  },
  
  async updateDocumentation(context, files) {
    // Implementation for updating documentation
  }
};
```

### 4.8.2 Lifecycle Events

The template system provides comprehensive lifecycle event handling:

```javascript
class TemplateLifecycle {
  constructor(template) {
    this.template = template;
    this.hooks = template.hooks || {};
  }
  
  async execute(context) {
    try {
      // Pre-validation phase
      await this.runHook('pre-validate', context);
      await this.validateVariables(context);
      
      // Pre-generation phase
      await this.runHook('pre-generate', context);
      await this.setupContext(context);
      
      // Generation phase
      await this.runHook('before-render', context);
      const renderedContent = await this.renderTemplate(context);
      await this.runHook('after-render', context, renderedContent);
      
      // File writing phase
      await this.runHook('before-write', context, renderedContent);
      const writtenFiles = await this.writeFiles(context, renderedContent);
      await this.runHook('after-write', context, writtenFiles);
      
      // Post-generation phase
      await this.runHook('post-generate', context, writtenFiles);
      
      return {
        success: true,
        files: writtenFiles,
        context: context.export()
      };
      
    } catch (error) {
      await this.runHook('on-error', context, error);
      throw error;
    }
  }
  
  async runHook(hookName, context, ...args) {
    const hook = this.hooks[hookName];
    if (hook && typeof hook.execute === 'function') {
      await hook.execute(context, ...args);
    }
  }
}
```

## 4.9 Performance Optimization

### 4.9.1 Template Compilation

Templates are compiled to optimized JavaScript for maximum performance:

```javascript
class TemplateCompiler {
  compile(template) {
    // Parse template and frontmatter
    const { frontmatter, content } = this.parseTemplate(template);
    
    // Compile Nunjucks template
    const compiledTemplate = nunjucks.compile(content);
    
    // Generate optimized rendering function
    const renderFunction = this.generateRenderFunction(compiledTemplate, frontmatter);
    
    return {
      render: renderFunction,
      metadata: frontmatter,
      dependencies: this.extractDependencies(content),
      cacheKey: this.generateCacheKey(template)
    };
  }
  
  generateRenderFunction(compiledTemplate, frontmatter) {
    return function(context) {
      // Optimized rendering with context preprocessing
      const processedContext = this.preprocessContext(context, frontmatter);
      return compiledTemplate.render(processedContext);
    };
  }
  
  preprocessContext(context, frontmatter) {
    // Pre-process context for better performance
    const processed = { ...context };
    
    // Add computed variables
    if (frontmatter.computed) {
      for (const [key, expression] of Object.entries(frontmatter.computed)) {
        processed[key] = this.evaluateExpression(expression, processed);
      }
    }
    
    return processed;
  }
}
```

### 4.9.2 Caching Strategy

Comprehensive caching system for optimal performance:

```javascript
class TemplateCache {
  constructor(options = {}) {
    this.memoryCache = new Map();
    this.diskCache = options.diskCache;
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 3600000; // 1 hour
  }
  
  async get(key) {
    // Check memory cache first
    const memoryCached = this.memoryCache.get(key);
    if (memoryCached && !this.isExpired(memoryCached)) {
      return memoryCached.value;
    }
    
    // Check disk cache
    if (this.diskCache) {
      const diskCached = await this.diskCache.get(key);
      if (diskCached && !this.isExpired(diskCached)) {
        // Promote to memory cache
        this.memoryCache.set(key, diskCached);
        return diskCached.value;
      }
    }
    
    return null;
  }
  
  async set(key, value) {
    const entry = {
      value,
      timestamp: Date.now(),
      accessed: Date.now()
    };
    
    // Store in memory cache
    this.memoryCache.set(key, entry);
    
    // Enforce memory cache size limit
    if (this.memoryCache.size > this.maxSize) {
      this.evictLeastUsed();
    }
    
    // Store in disk cache
    if (this.diskCache) {
      await this.diskCache.set(key, entry);
    }
  }
  
  evictLeastUsed() {
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].accessed - b[1].accessed);
    
    const toRemove = entries.slice(0, Math.floor(this.maxSize * 0.1));
    toRemove.forEach(([key]) => this.memoryCache.delete(key));
  }
}
```

## 4.10 Error Handling and Debugging

### 4.10.1 Error Reporting

Comprehensive error reporting with context information:

```javascript
class TemplateError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'TemplateError';
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
  
  toDetailedString() {
    const details = [];
    
    details.push(`Error: ${this.message}`);
    
    if (this.context.template) {
      details.push(`Template: ${this.context.template}`);
    }
    
    if (this.context.line && this.context.column) {
      details.push(`Location: Line ${this.context.line}, Column ${this.context.column}`);
    }
    
    if (this.context.variables) {
      details.push('Variables:');
      for (const [key, value] of Object.entries(this.context.variables)) {
        details.push(`  ${key}: ${JSON.stringify(value)}`);
      }
    }
    
    if (this.context.suggestion) {
      details.push(`Suggestion: ${this.context.suggestion}`);
    }
    
    return details.join('\n');
  }
}
```

### 4.10.2 Debug Mode

Enhanced debugging capabilities for template development:

```javascript
class TemplateDebugger {
  constructor(options = {}) {
    this.enabled = options.debug || false;
    this.verbose = options.verbose || false;
    this.outputFile = options.outputFile;
  }
  
  debug(message, context = {}) {
    if (!this.enabled) return;
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      message,
      context,
      stack: new Error().stack
    };
    
    if (this.verbose) {
      console.log('[DEBUG]', JSON.stringify(debugInfo, null, 2));
    } else {
      console.log('[DEBUG]', message);
    }
    
    if (this.outputFile) {
      this.writeDebugLog(debugInfo);
    }
  }
  
  traceVariable(name, value, location) {
    this.debug(`Variable '${name}' = ${JSON.stringify(value)}`, {
      type: 'variable-trace',
      name,
      value,
      location
    });
  }
  
  traceTemplate(templateName, phase, data) {
    this.debug(`Template '${templateName}' - ${phase}`, {
      type: 'template-trace',
      template: templateName,
      phase,
      data
    });
  }
}
```

This template system provides the foundation for Unjucks v2's advanced code generation capabilities, combining flexibility, performance, and developer experience in a powerful and intuitive package.