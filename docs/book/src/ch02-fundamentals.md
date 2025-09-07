# Chapter 2: Fundamentals - Core Principles and Patterns

## The Foundation of Modern Code Generation

Understanding the fundamentals of modern code generation requires a shift in perspective. We're not just talking about text replacement or simple templating—we're discussing a sophisticated system of declarative programming that transforms intent into executable code. This chapter establishes the core principles that make Unjucks and similar modern generation tools powerful and reliable.

## Principle 1: Declarative Over Imperative

### The Declarative Mindset

Traditional development often follows an imperative approach: "Create a file here, add this function there, import that module." Modern code generation embraces declarative principles: "I want a user authentication system with these characteristics."

```yaml
# Imperative (traditional)
steps:
  - create: "src/auth/login.ts"
  - add_import: "import bcrypt from 'bcrypt'"
  - create_function: "validatePassword"
  - export_function: "validatePassword"

# Declarative (modern)
---
to: "src/auth/{{ feature }}.ts"
inject: true
before: "// END FEATURES"
when: "{{ hasAuthentication }}"
dependencies:
  - bcrypt
  - jsonwebtoken
---
```

### Benefits of Declarative Generation

**Maintainability**: Declarative templates are easier to understand and modify. The intent is clear, and the implementation details are abstracted.

**Consistency**: Declarative patterns ensure that similar intentions produce similar results, regardless of who implements them or when.

**Adaptability**: Declarative templates can adapt to different contexts without changing the core template logic.

```typescript
// Declarative template configuration
interface TemplateConfig {
  intent: 'component' | 'service' | 'page';
  features: string[];
  context: ProjectContext;
  constraints: GenerationConstraints;
}

// The generator adapts based on intent
const generateByIntent = (config: TemplateConfig) => {
  switch (config.intent) {
    case 'component':
      return adaptComponentTemplate(config);
    case 'service':
      return adaptServiceTemplate(config);
    case 'page':
      return adaptPageTemplate(config);
  }
};
```

## Principle 2: Context-Aware Generation

### Understanding Project Context

Modern code generation tools must understand the environment they're operating in. This includes:

- **Framework Detection**: Recognizing React vs. Vue vs. Angular
- **Architecture Patterns**: Understanding Clean Architecture, MVC, or DDD
- **Tooling Ecosystem**: Detecting TypeScript, testing frameworks, and build tools
- **Team Conventions**: Adapting to established coding standards

```typescript
// Context analysis system
interface ProjectContext {
  framework: {
    name: string;
    version: string;
    plugins: string[];
  };
  architecture: {
    pattern: string;
    layers: string[];
    conventions: Record<string, any>;
  };
  tooling: {
    typescript: boolean;
    testing: string[];
    linting: string[];
    formatting: string[];
  };
  conventions: {
    naming: NamingConvention;
    structure: StructureConvention;
    imports: ImportConvention;
  };
}
```

### Context-Driven Template Selection

Templates should automatically adapt based on detected context:

```yaml
# React-specific component template
---
to: "src/components/{{ pascalCase name }}/{{ pascalCase name }}.tsx"
when: "{{ context.framework.name === 'React' }}"
inject: false
---
import React from 'react';
import { {{ pascalCase name }}Props } from './types';

export const {{ pascalCase name }}: React.FC<{{ pascalCase name }}Props> = ({
  {{ properties }}
}) => {
  return (
    <div className="{{ kebabCase name }}">
      {/* Component content */}
    </div>
  );
};
```

```yaml
# Vue-specific component template
---
to: "src/components/{{ pascalCase name }}/{{ pascalCase name }}.vue"
when: "{{ context.framework.name === 'Vue' }}"
inject: false
---
<template>
  <div class="{{ kebabCase name }}">
    <!-- Component content -->
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: '{{ pascalCase name }}',
  props: {
    {{ properties }}
  }
});
</script>
```

## Principle 3: Idempotent Operations

### The Importance of Idempotency

In mathematics and computer science, an idempotent operation is one that can be applied multiple times without changing the result beyond the initial application. This principle is crucial for code generation because:

1. **Reliability**: Running the same generator multiple times produces consistent results
2. **Safety**: Accidental re-runs don't break your codebase
3. **Incremental Updates**: Templates can be improved and re-run safely

```yaml
# Idempotent injection example
---
to: "src/index.ts"
inject: true
after: "// BEGIN EXPORTS"
before: "// END EXPORTS"
skipIf: "export.*{{ pascalCase name }}"
---
export { {{ pascalCase name }} } from './components/{{ pascalCase name }}';
```

### Implementing Idempotency

**Skip Conditions**: Use `skipIf` to prevent duplicate entries:

```yaml
---
skipIf: "interface {{ pascalCase name }}Props"
---
interface {{ pascalCase name }}Props {
  {{ properties }}
}
```

**Content Hashing**: Generate content hashes to detect changes:

```typescript
interface GeneratedContent {
  content: string;
  hash: string;
  timestamp: Date;
  generator: string;
}

const generateIdempotent = (template: string, data: any): GeneratedContent => {
  const content = render(template, data);
  const hash = createHash('sha256').update(content).digest('hex');
  
  return {
    content,
    hash,
    timestamp: new Date(),
    generator: template
  };
};
```

**Merge Strategies**: Define how to handle conflicts:

```typescript
enum MergeStrategy {
  SKIP = 'skip',           // Don't modify existing content
  REPLACE = 'replace',     // Replace entirely
  MERGE = 'merge',         // Intelligently merge
  APPEND = 'append',       // Add to existing content
  PREPEND = 'prepend'      // Add before existing content
}
```

## Principle 4: Template Composition and Inheritance

### Modular Template Design

Modern templates should be composed of smaller, reusable parts rather than monolithic blocks:

```yaml
# Base component template
---
name: "base-component"
abstract: true
---
import React from 'react';

export const {{ pascalCase name }}: React.FC<{{ pascalCase name }}Props> = () => {
  {% block content %}
  return <div>{{ name }}</div>;
  {% endblock %}
};
```

```yaml
# Specialized form component
---
extends: "base-component"
to: "src/components/forms/{{ pascalCase name }}.tsx"
---
{% block content %}
const [formData, setFormData] = useState({});
const [errors, setErrors] = useState({});

return (
  <form onSubmit={handleSubmit}>
    {{ formFields }}
  </form>
);
{% endblock %}
```

### Template Inheritance Patterns

**Single Inheritance**: Templates extend a single base template
```yaml
extends: "base-component"
```

**Mixin Composition**: Templates include multiple mixins
```yaml
mixins:
  - "with-loading-state"
  - "with-error-handling"
  - "with-form-validation"
```

**Trait-Based**: Templates compose specific traits
```typescript
interface TemplateTraits {
  loadingState?: boolean;
  errorHandling?: boolean;
  formValidation?: boolean;
  authentication?: boolean;
}

const applyTraits = (base: Template, traits: TemplateTraits): Template => {
  return Object.entries(traits).reduce((template, [trait, enabled]) => {
    return enabled ? mixinTrait(template, trait) : template;
  }, base);
};
```

## Principle 5: Type Safety and Validation

### Template Variable Validation

Modern code generation tools should validate template variables at generation time:

```typescript
// Variable schema definition
interface ComponentSchema {
  name: string;                    // Required: Component name
  props?: PropertyDefinition[];    // Optional: Component props
  features?: FeatureFlag[];       // Optional: Feature toggles
  styling?: StylingOptions;       // Optional: Styling configuration
}

// Runtime validation
const validateTemplate = (variables: any, schema: Schema): ValidationResult => {
  const errors: ValidationError[] = [];
  
  // Required field validation
  if (!variables.name) {
    errors.push({ field: 'name', message: 'Component name is required' });
  }
  
  // Type validation
  if (variables.props && !Array.isArray(variables.props)) {
    errors.push({ field: 'props', message: 'Props must be an array' });
  }
  
  return { valid: errors.length === 0, errors };
};
```

### Generated Code Validation

Validate that generated code meets quality standards:

```typescript
interface CodeQualityCheck {
  syntax: boolean;        // Valid syntax
  types: boolean;         // Type correctness
  imports: boolean;       // Valid imports
  patterns: boolean;      // Follows patterns
  performance: boolean;   // Performance considerations
}

const validateGeneratedCode = async (
  code: string,
  language: string
): Promise<CodeQualityCheck> => {
  const checks: CodeQualityCheck = {
    syntax: await validateSyntax(code, language),
    types: await validateTypes(code, language),
    imports: await validateImports(code),
    patterns: await validatePatterns(code),
    performance: await analyzePerformance(code)
  };
  
  return checks;
};
```

## Principle 6: Progressive Enhancement

### Layered Generation Strategy

Generate code in layers, from basic to advanced features:

```typescript
interface GenerationLayer {
  name: string;
  description: string;
  dependencies: string[];
  template: string;
  optional: boolean;
}

const generationLayers: GenerationLayer[] = [
  {
    name: 'base',
    description: 'Basic component structure',
    dependencies: [],
    template: 'component-base.njk',
    optional: false
  },
  {
    name: 'props',
    description: 'Component props interface',
    dependencies: ['base'],
    template: 'component-props.njk',
    optional: false
  },
  {
    name: 'state',
    description: 'State management',
    dependencies: ['base', 'props'],
    template: 'component-state.njk',
    optional: true
  },
  {
    name: 'testing',
    description: 'Test suite',
    dependencies: ['base', 'props'],
    template: 'component-tests.njk',
    optional: true
  }
];
```

### Feature Flags and Conditional Generation

Use feature flags to control what gets generated:

```yaml
# Component with optional features
---
to: "src/components/{{ pascalCase name }}/{{ pascalCase name }}.tsx"
---
import React{% if withState %}, { useState }{% endif %} from 'react';
{% if withRouter %}
import { useRouter } from 'next/router';
{% endif %}
{% if withQuery %}
import { useQuery } from '@tanstack/react-query';
{% endif %}

interface {{ pascalCase name }}Props {
  {% for prop in props %}
  {{ prop.name }}: {{ prop.type }};
  {% endfor %}
}

export const {{ pascalCase name }}: React.FC<{{ pascalCase name }}Props> = ({
  {% for prop in props %}{{ prop.name }}{% if not loop.last %}, {% endif %}{% endfor %}
}) => {
  {% if withState %}
  const [state, setState] = useState();
  {% endif %}
  
  {% if withRouter %}
  const router = useRouter();
  {% endif %}
  
  {% if withQuery %}
  const { data, isLoading } = useQuery(['{{ kebabCase name }}'], fetchData);
  {% endif %}

  return (
    <div className="{{ kebabCase name }}">
      {/* Component implementation */}
    </div>
  );
};
```

## Common Patterns and Practices

### 1. The Registry Pattern

Maintain a registry of available generators and their capabilities:

```typescript
interface GeneratorRegistry {
  generators: Map<string, GeneratorMetadata>;
  
  register(name: string, metadata: GeneratorMetadata): void;
  find(criteria: GeneratorCriteria): GeneratorMetadata[];
  get(name: string): GeneratorMetadata | undefined;
}

interface GeneratorMetadata {
  name: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  schema: Schema;
  templates: TemplateReference[];
  examples: Example[];
}
```

### 2. The Plugin Pattern

Allow third-party extensions through plugins:

```typescript
interface GeneratorPlugin {
  name: string;
  version: string;
  
  beforeGeneration?(context: GenerationContext): void;
  afterGeneration?(context: GenerationContext, result: GenerationResult): void;
  transformTemplate?(template: string, variables: any): string;
  validateVariables?(variables: any, schema: Schema): ValidationResult;
}

class PluginManager {
  private plugins: GeneratorPlugin[] = [];
  
  register(plugin: GeneratorPlugin): void {
    this.plugins.push(plugin);
  }
  
  async executeHook(
    hookName: keyof GeneratorPlugin,
    ...args: any[]
  ): Promise<void> {
    for (const plugin of this.plugins) {
      const hook = plugin[hookName];
      if (typeof hook === 'function') {
        await hook.apply(plugin, args);
      }
    }
  }
}
```

### 3. The Strategy Pattern

Different generation strategies for different use cases:

```typescript
interface GenerationStrategy {
  name: string;
  description: string;
  
  generate(
    template: Template,
    variables: any,
    context: GenerationContext
  ): Promise<GenerationResult>;
}

class FileGenerationStrategy implements GenerationStrategy {
  name = 'file';
  description = 'Generate new files';
  
  async generate(template, variables, context) {
    // File generation logic
  }
}

class InjectionStrategy implements GenerationStrategy {
  name = 'injection';
  description = 'Inject into existing files';
  
  async generate(template, variables, context) {
    // Injection logic
  }
}
```

## Error Handling and Recovery

### Graceful Failure Patterns

```typescript
enum GenerationErrorType {
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  FILE_CONFLICT = 'FILE_CONFLICT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SYNTAX_ERROR = 'SYNTAX_ERROR'
}

class GenerationError extends Error {
  constructor(
    public type: GenerationErrorType,
    public message: string,
    public context?: any,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'GenerationError';
  }
}

const handleGenerationError = (error: GenerationError): RecoveryAction => {
  switch (error.type) {
    case GenerationErrorType.FILE_CONFLICT:
      return {
        type: 'PROMPT_USER',
        options: ['overwrite', 'merge', 'skip', 'rename']
      };
      
    case GenerationErrorType.VALIDATION_FAILED:
      return {
        type: 'REQUEST_INPUT',
        fields: error.context.missingFields
      };
      
    case GenerationErrorType.TEMPLATE_NOT_FOUND:
      return {
        type: 'SUGGEST_ALTERNATIVES',
        suggestions: findSimilarTemplates(error.context.templateName)
      };
      
    default:
      return { type: 'FAIL', retry: error.recoverable };
  }
};
```

### Rollback Mechanisms

Implement transactional generation with rollback capabilities:

```typescript
class GenerationTransaction {
  private operations: GenerationOperation[] = [];
  private completed: GenerationOperation[] = [];
  
  addOperation(operation: GenerationOperation): void {
    this.operations.push(operation);
  }
  
  async execute(): Promise<GenerationResult> {
    try {
      for (const operation of this.operations) {
        await operation.execute();
        this.completed.push(operation);
      }
      return { success: true, operations: this.completed };
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
  
  private async rollback(): Promise<void> {
    for (const operation of this.completed.reverse()) {
      await operation.rollback();
    }
  }
}
```

## Performance Considerations

### Template Compilation and Caching

```typescript
class TemplateCache {
  private cache = new Map<string, CompiledTemplate>();
  
  compile(template: string, options: CompileOptions): CompiledTemplate {
    const cacheKey = this.getCacheKey(template, options);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    const compiled = compileTemplate(template, options);
    this.cache.set(cacheKey, compiled);
    
    return compiled;
  }
  
  private getCacheKey(template: string, options: CompileOptions): string {
    return `${hashString(template)}-${hashObject(options)}`;
  }
}
```

### Parallel Generation

```typescript
const generateParallel = async (
  generators: GeneratorTask[]
): Promise<GenerationResult[]> => {
  const chunks = chunkArray(generators, CPU_CORES);
  
  const results = await Promise.all(
    chunks.map(chunk => 
      Promise.all(chunk.map(generator => generator.execute()))
    )
  );
  
  return results.flat();
};
```

## Security Considerations

### Template Sandboxing

```typescript
interface SandboxOptions {
  allowedModules: string[];
  timeout: number;
  memoryLimit: number;
  fileSystemAccess: 'none' | 'readonly' | 'restricted';
}

const executeSandboxed = (
  template: string,
  variables: any,
  options: SandboxOptions
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const sandbox = createSandbox(options);
    
    try {
      const result = sandbox.execute(template, variables);
      resolve(result);
    } catch (error) {
      reject(new SecurityError('Template execution failed', error));
    } finally {
      sandbox.cleanup();
    }
  });
};
```

### Input Validation and Sanitization

```typescript
const sanitizeInput = (input: any): any => {
  if (typeof input === 'string') {
    // Remove potentially dangerous characters
    return input.replace(/[<>\"'&]/g, '');
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[sanitizeInput(key)] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
};
```

## Conclusion

The fundamentals of modern code generation extend far beyond simple text templating. They encompass declarative programming principles, context awareness, idempotent operations, and sophisticated error handling. Understanding these fundamentals is crucial for building reliable, maintainable, and powerful generation systems.

As we move forward in this book, we'll build upon these principles to explore advanced template design, configuration patterns, testing strategies, and deployment techniques. Each concept reinforces these fundamental principles, creating a cohesive approach to modern code generation.

The next chapter will dive deep into template design, showing how to apply these principles to create powerful, maintainable, and reusable templates that serve as the foundation for your generation system.