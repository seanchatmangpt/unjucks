# Variable System

The Variable System is Unjucks' intelligent engine for extracting, inferring, and managing template variables. It automatically discovers variables from templates, infers their types, and creates dynamic CLI interfaces that adapt to your templates.

## Variable Discovery Pipeline

### Automatic Variable Extraction

The variable extraction process analyzes templates to identify all variable references:

```typescript
// Template analysis identifies these patterns:
{{ variableName }}                    // Simple variable reference
{{ user.profile.name }}              // Nested object access
{{ items[0] }}                       // Array access
{{ componentName | pascalCase }}      // Variable with filter
{% if withProps %}                   // Boolean variable in conditional
{% for method in methods %}          // Array variable in loop
{{ description | default('None') }}  // Variable with default value
```

**Extraction Algorithm**:
```typescript
class VariableExtractor {
  extractVariables(template: string): TemplateVariable[] {
    const variables = new Map<string, TemplateVariable>();
    
    // Extract from variable expressions {{ var }}
    const variableMatches = template.match(/\{\{\s*([^}]+)\s*\}\}/g) || [];
    variableMatches.forEach(match => {
      const variable = this.parseVariableExpression(match);
      this.addVariable(variables, variable);
    });
    
    // Extract from control structures {% if var %}
    const controlMatches = template.match(/\{\%\s*(if|unless|for)\s+([^%]+)\s*\%\}/g) || [];
    controlMatches.forEach(match => {
      const variables = this.parseControlStructure(match);
      variables.forEach(v => this.addVariable(variables, v));
    });
    
    // Extract from frontmatter variable references
    const frontmatterVars = this.extractFromFrontmatter(template);
    frontmatterVars.forEach(v => this.addVariable(variables, v));
    
    return Array.from(variables.values());
  }
}
```

### Variable Context Analysis

Variables are analyzed within their usage context to improve type inference:

```nunjucks
{# Context: Conditional usage suggests boolean #}
{% if withTests %}
import { describe, test, expect } from 'vitest';
{% endif %}

{# Context: Loop usage indicates array type #}
{% for method in httpMethods %}
app.{{ method.toLowerCase() }}('{{ route }}', handler);
{% endfor %}

{# Context: Object property access #}
{{ config.database.host }}:{{ config.database.port }}

{# Context: Filter usage suggests string type #}
{{ componentName | pascalCase }}Component
```

## Type Inference System

### Intelligent Type Detection

The system uses multiple heuristics to determine variable types:

```typescript
interface TemplateVariable {
  name: string;
  type: 'string' | 'boolean' | 'number' | 'array' | 'object';
  required: boolean;
  default?: any;
  description?: string;
  validation?: ValidationRule[];
  examples?: string[];
}

class TypeInferenceEngine {
  inferType(variableName: string, usageContexts: UsageContext[]): VariableType {
    // Boolean detection by naming patterns
    if (this.isBooleanByName(variableName)) {
      return 'boolean';
    }
    
    // Type detection by usage context
    for (const context of usageContexts) {
      if (context.type === 'conditional') return 'boolean';
      if (context.type === 'loop') return 'array';
      if (context.type === 'objectAccess') return 'object';
      if (context.type === 'arithmetic') return 'number';
    }
    
    // Default to string if no specific type detected
    return 'string';
  }
  
  private isBooleanByName(name: string): boolean {
    const booleanPrefixes = [
      'with', 'has', 'is', 'should', 'will', 'can', 'could',
      'enable', 'disable', 'allow', 'include', 'exclude',
      'use', 'show', 'hide', 'visible', 'active', 'inactive'
    ];
    
    return booleanPrefixes.some(prefix => 
      name.toLowerCase().startsWith(prefix) || 
      name.toLowerCase().includes(prefix)
    );
  }
}
```

### Advanced Type Patterns

Complex type inference handles sophisticated patterns:

```typescript
// Boolean detection patterns
const booleanPatterns = {
  // Prefix patterns
  with: /^with[A-Z]/,           // withProps, withTests
  has: /^has[A-Z]/,             // hasAuth, hasDatabase  
  is: /^is[A-Z]/,               // isActive, isPublic
  should: /^should[A-Z]/,       // shouldValidate, shouldCache
  
  // Suffix patterns  
  enabled: /Enabled$/,          // authEnabled, debugEnabled
  disabled: /Disabled$/,        // loggingDisabled
  
  // Modal verbs
  can: /^can[A-Z]/,             // canEdit, canDelete
  will: /^will[A-Z]/,           // willRedirect
  
  // State patterns
  active: /Active$/,            // isActive, setActive
  visible: /Visible$/           // isVisible, makeVisible
};

// Array detection patterns  
const arrayPatterns = {
  pluralNouns: /s$/,            // methods, components, routes
  collections: /(list|items|collection|set)$/i,
  forLoops: /for\s+\w+\s+in\s+(\w+)/  // {% for item in items %}
};

// Object detection patterns
const objectPatterns = {
  dotAccess: /\w+\.\w+/,        // config.database, user.profile
  nested: /\w+\.\w+\.\w+/,      // deeply.nested.property
  configWords: /(config|settings|options|params)$/i
};
```

### Type Validation

Ensure inferred types match actual usage:

```typescript
class TypeValidator {
  validateInference(variable: TemplateVariable, usages: VariableUsage[]): ValidationResult {
    const errors: string[] = [];
    
    for (const usage of usages) {
      // Validate boolean usage
      if (variable.type === 'boolean' && usage.context === 'string-interpolation') {
        errors.push(`Boolean variable '${variable.name}' used in string context`);
      }
      
      // Validate array usage
      if (variable.type === 'array' && usage.context !== 'loop' && !usage.hasIndexAccess) {
        errors.push(`Array variable '${variable.name}' used outside of loop context`);
      }
      
      // Validate object usage
      if (variable.type === 'object' && !usage.hasPropertyAccess) {
        errors.push(`Object variable '${variable.name}' used without property access`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      suggestions: this.generateSuggestions(variable, errors)
    };
  }
}
```

## Dynamic CLI Generation

### Automatic Argument Creation

Variables are automatically converted to CLI arguments with appropriate types:

```typescript
class CLIArgumentGenerator {
  generateArguments(variables: TemplateVariable[]): CLIArgument[] {
    return variables.map(variable => {
      switch (variable.type) {
        case 'boolean':
          return {
            name: variable.name,
            type: 'boolean',
            flags: [`--${variable.name}`, `--no-${variable.name}`],
            default: variable.default ?? false,
            description: variable.description
          };
          
        case 'array':
          return {
            name: variable.name,
            type: 'array',
            flags: [`--${variable.name}`],
            parser: 'json',
            default: variable.default ?? [],
            description: `${variable.description} (JSON array format)`
          };
          
        case 'object':
          return {
            name: variable.name,
            type: 'object',
            flags: [`--${variable.name}`],
            parser: 'json',
            dotNotation: true, // Support --config.database.host
            default: variable.default ?? {},
            description: `${variable.description} (JSON object or dot notation)`
          };
          
        case 'number':
          return {
            name: variable.name,
            type: 'number',
            flags: [`--${variable.name}`],
            validation: variable.validation,
            default: variable.default ?? 0,
            description: variable.description
          };
          
        default: // string
          return {
            name: variable.name,
            type: 'string',
            flags: [`--${variable.name}`],
            validation: variable.validation,
            required: variable.required,
            default: variable.default,
            description: variable.description
          };
      }
    });
  }
}
```

### Flexible Naming Conventions

The CLI accepts multiple naming formats for the same variable:

```bash
# All these set the same variable: componentName
--componentName=Button     # camelCase (preferred)
--component-name=Button    # kebab-case  
--COMPONENT_NAME=Button    # UPPER_CASE
--component_name=Button    # snake_case

# Boolean variables support multiple formats
--withProps               # Set to true
--no-withProps           # Set to false
--withProps=true         # Explicit true
--withProps=false        # Explicit false
```

```typescript
class VariableNameResolver {
  resolveVariableName(input: string, availableVariables: string[]): string | null {
    const normalizedInput = this.normalize(input);
    
    // Find matching variable using different naming conventions
    return availableVariables.find(variable => {
      const variations = [
        variable,                                    // exact match
        this.toCamelCase(variable),                 // camelCase
        this.toKebabCase(variable),                 // kebab-case
        this.toSnakeCase(variable),                 // snake_case  
        this.toUpperCase(variable)                  // UPPER_CASE
      ];
      
      return variations.some(v => this.normalize(v) === normalizedInput);
    });
  }
  
  private normalize(str: string): string {
    return str.toLowerCase().replace(/[-_]/g, '');
  }
}
```

## Context Merging and Precedence

### Variable Sources

Variables can come from multiple sources with defined precedence:

```typescript
interface VariableContext {
  // Source precedence (highest to lowest)
  cliArguments: Record<string, any>;        // --flag values
  environmentVariables: Record<string, any>; // UNJUCKS_* env vars
  configFile: Record<string, any>;          // unjucks.config.js
  promptResponses: Record<string, any>;     // Interactive prompts
  templateDefaults: Record<string, any>;    // Template-defined defaults
  globalDefaults: Record<string, any>;      // System defaults
}

class ContextMerger {
  mergeContexts(contexts: VariableContext): Record<string, any> {
    const merged = {};
    
    // Apply in reverse precedence order (lowest to highest)
    Object.assign(merged, contexts.globalDefaults);
    Object.assign(merged, contexts.templateDefaults);
    Object.assign(merged, contexts.promptResponses);
    Object.assign(merged, contexts.configFile);
    Object.assign(merged, contexts.environmentVariables);
    Object.assign(merged, contexts.cliArguments); // Highest precedence
    
    return this.validateMergedContext(merged);
  }
}
```

### Environment Variable Mapping

Map environment variables to template variables:

```bash
# Environment variables automatically mapped to variables
export UNJUCKS_COMPONENT_NAME=Button      # → componentName
export UNJUCKS_WITH_TESTS=true            # → withTests  
export UNJUCKS_HTTP_METHODS='["GET","POST"]' # → httpMethods

# Prefix can be customized
export MYAPP_SERVICE_NAME=UserService     # → serviceName (with prefix MYAPP_)
```

```typescript
class EnvironmentVariableMapper {
  mapEnvironmentVariables(prefix = 'UNJUCKS_'): Record<string, any> {
    const mapped = {};
    
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const variableName = this.envKeyToVariableName(key, prefix);
        mapped[variableName] = this.parseEnvironmentValue(value);
      }
    }
    
    return mapped;
  }
  
  private envKeyToVariableName(envKey: string, prefix: string): string {
    return envKey
      .replace(prefix, '')
      .toLowerCase()
      .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }
  
  private parseEnvironmentValue(value: string): any {
    // Try to parse as JSON first
    try {
      return JSON.parse(value);
    } catch {
      // Parse boolean strings
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
      
      // Parse numbers
      if (/^\d+$/.test(value)) return parseInt(value, 10);
      if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
      
      // Return as string
      return value;
    }
  }
}
```

## Global Variables and Filters

### Global Variable System

Define variables available to all templates:

```typescript
// unjucks.config.ts
export default defineConfig({
  globalVariables: {
    // Author information
    author: 'John Doe',
    authorEmail: 'john@example.com',
    
    // Project metadata  
    license: 'MIT',
    currentYear: new Date().getFullYear(),
    
    // Build information
    version: process.env.npm_package_version,
    buildDate: new Date().toISOString(),
    
    // Environment
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    
    // Company/organization info
    organization: 'ACME Corp',
    website: 'https://acme.com'
  }
});
```

**Usage in Templates**:
```nunjucks
/**
 * {{ componentName }} Component
 * 
 * @author {{ author }} <{{ authorEmail }}>
 * @copyright {{ currentYear }} {{ organization }}
 * @license {{ license }}
 * @version {{ version }}
 */

{% if isDevelopment %}
// Development-only code
console.log('{{ componentName }} component loaded');
{% endif %}

export const {{ componentName | pascalCase }} = () => {
  return (
    <div>
      <p>Built on {{ buildDate }}</p>
      <p>Visit {{ website }}</p>
    </div>
  );
};
```

### Custom Filter Registration

Extend the template system with custom filters:

```typescript
// unjucks.config.ts
export default defineConfig({
  filters: {
    // Business-specific formatting
    businessCase: (str: string) => {
      return str
        .split(/[\s_-]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
    },
    
    // File path utilities
    dirname: (path: string) => path.substring(0, path.lastIndexOf('/')),
    basename: (path: string) => path.substring(path.lastIndexOf('/') + 1),
    extname: (path: string) => path.substring(path.lastIndexOf('.')),
    
    // Date formatting
    formatDate: (date: string | Date, format = 'YYYY-MM-DD') => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return format
        .replace('YYYY', d.getFullYear().toString())
        .replace('MM', (d.getMonth() + 1).toString().padStart(2, '0'))
        .replace('DD', d.getDate().toString().padStart(2, '0'));
    },
    
    // Code generation helpers
    indent: (text: string, spaces = 2) => {
      const indentation = ' '.repeat(spaces);
      return text.split('\n').map(line => `${indentation}${line}`).join('\n');
    },
    
    // String manipulation
    wrap: (text: string, width = 80) => {
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';
      
      for (const word of words) {
        if (currentLine.length + word.length + 1 <= width) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);
      
      return lines.join('\n');
    }
  }
});
```

### Dynamic Global Variables

Generate global variables dynamically:

```typescript
export default defineConfig({
  globalVariables: async () => {
    const packageJson = await readFile('package.json', 'utf-8');
    const pkg = JSON.parse(packageJson);
    
    const gitCommit = await exec('git rev-parse HEAD');
    const gitBranch = await exec('git branch --show-current');
    
    return {
      // Package information
      projectName: pkg.name,
      projectVersion: pkg.version,
      projectDescription: pkg.description,
      dependencies: Object.keys(pkg.dependencies || {}),
      
      // Git information
      gitCommit: gitCommit.trim().slice(0, 7),
      gitBranch: gitBranch.trim(),
      
      // Build timestamp
      buildTimestamp: Date.now(),
      buildDate: new Date().toISOString(),
      
      // Environment detection
      ci: !!process.env.CI,
      nodeVersion: process.version,
      platform: process.platform
    };
  }
});
```

## Variable Validation

### Built-in Validation Rules

```typescript
interface ValidationRule {
  type: 'required' | 'pattern' | 'length' | 'range' | 'custom';
  value?: any;
  message?: string;
}

// Template frontmatter validation
---
validate:
  componentName:
    - type: "required"
      message: "Component name is required"
    - type: "pattern" 
      value: "^[A-Z][a-zA-Z0-9]*$"
      message: "Component name must be PascalCase"
    - type: "length"
      value: { min: 3, max: 50 }
      message: "Component name must be 3-50 characters"
  
  methods:
    - type: "required"
      message: "At least one HTTP method is required"
    - type: "custom"
      value: "validateHttpMethods"
      message: "Invalid HTTP method specified"
---
```

### Custom Validation Functions

```typescript
const customValidators = {
  validateHttpMethods: (methods: string[]): boolean => {
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    return methods.every(method => validMethods.includes(method.toUpperCase()));
  },
  
  validateComponentName: (name: string): boolean => {
    // Must be PascalCase
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) return false;
    
    // Must not be a reserved word
    const reserved = ['Component', 'Element', 'Fragment', 'React'];
    if (reserved.includes(name)) return false;
    
    return true;
  },
  
  validateServiceName: (name: string): boolean => {
    // Must end with 'Service'
    if (!name.endsWith('Service')) return false;
    
    // Must be at least 3 characters before 'Service'
    return name.length > 'Service'.length + 2;
  }
};
```

## Advanced Variable Features

### Computed Variables

Variables calculated from other variables:

```typescript
export default defineConfig({
  computedVariables: {
    // Derive filename from component name
    filename: (vars) => `${vars.componentName}.${vars.fileExtension || 'tsx'}`,
    
    // Generate import path
    importPath: (vars) => `./components/${vars.componentName}`,
    
    // Create test filename
    testFilename: (vars) => vars.withTests ? `${vars.componentName}.test.tsx` : null,
    
    // Generate class names
    cssClassName: (vars) => vars.componentName
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .substring(1),
    
    // Determine file structure
    isComplexComponent: (vars) => 
      vars.withProps || vars.withTests || vars.withStorybook
  }
});
```

### Variable Transformations

Transform variables during processing:

```typescript
class VariableTransformer {
  transform(variables: Record<string, any>): Record<string, any> {
    const transformed = { ...variables };
    
    // Normalize string variables
    Object.keys(transformed).forEach(key => {
      if (typeof transformed[key] === 'string') {
        transformed[key] = transformed[key].trim();
      }
    });
    
    // Convert array strings to arrays
    Object.keys(transformed).forEach(key => {
      if (typeof transformed[key] === 'string' && this.isArrayString(transformed[key])) {
        try {
          transformed[key] = JSON.parse(transformed[key]);
        } catch {
          // Invalid JSON, keep as string
        }
      }
    });
    
    // Apply computed variables
    const computed = this.computeVariables(transformed);
    Object.assign(transformed, computed);
    
    return transformed;
  }
}
```

The Variable System provides intelligent automation for template variable management, making Unjucks templates self-describing and creating dynamic, type-aware CLI interfaces that adapt to your specific needs.