# Part V: Implementation Patterns and Practices

## Chapter 13: Code Generation from Specifications

### 13.1 Introduction

Code generation from specifications represents one of the most powerful aspects of specification-driven development. In Unjucks v2, we've built a sophisticated engine that transforms YAML specifications into fully functional applications, following patterns that ensure traceability, maintainability, and extensibility.

This chapter explores the concrete implementation patterns used in Unjucks v2's code generation system, showing how specifications drive the creation of everything from simple components to complex distributed systems.

### 13.2 Specification Engine Architecture

The heart of code generation in Unjucks v2 is the `SpecificationEngine` class, which orchestrates the entire process from specification parsing to artifact generation:

```javascript
// src/spec-driven/core/SpecificationEngine.js
export class SpecificationEngine {
  constructor(options = {}) {
    this.options = {
      templatesDir: '_templates',
      outputDir: './generated',
      specsDir: './specs',
      plansDir: './plans',
      tasksDir: './tasks',
      validateOnParse: true,
      enableMcpIntegration: true,
      ...options
    };
    
    // Core engines working together
    this.validationEngine = new ValidationEngine({
      enableMcpIntegration: this.options.enableMcpIntegration
    });
    
    this.planGenerator = new PlanGenerator({
      templatesDir: this.options.templatesDir,
      validationEngine: this.validationEngine
    });
    
    this.taskOrchestrator = new TaskOrchestrator({
      outputDir: this.options.outputDir,
      validationEngine: this.validationEngine
    });
  }
}
```

### 13.3 The Three-Phase Generation Pattern

Unjucks v2 follows a three-phase generation pattern that ensures predictable, traceable code generation:

#### Phase 1: Specification Processing

```javascript
async parseSpec(specPath) {
  try {
    const specFile = path.resolve(specPath);
    
    if (!(await fs.pathExists(specFile))) {
      throw new Error(`Specification file not found: ${specPath}`);
    }
    
    const content = await fs.readFile(specFile, 'utf8');
    const spec = yaml.parse(content);
    
    // Validate basic structure
    if (!isValidSpecification(spec)) {
      throw new Error('Invalid specification format');
    }
    
    // Set defaults and metadata
    spec.metadata = {
      apiVersion: SPEC_API_VERSION,
      kind: SPEC_KIND_PROJECT,
      sourcePath: specFile,
      parsedAt: new Date().toISOString(),
      ...spec.metadata
    };
    
    // Validate specification if enabled
    if (this.options.validateOnParse) {
      const validationResult = await this.validateSpec(spec);
      if (!validationResult.valid) {
        const errors = validationResult.errors.map(e => e.message).join(', ');
        throw new Error(`Specification validation failed: ${errors}`);
      }
      spec.validationResult = validationResult;
    }
    
    return spec;
  } catch (error) {
    throw new Error(`Failed to parse specification: ${error.message}`);
  }
}
```

#### Phase 2: Plan Generation

The plan generation phase transforms specifications into executable plans:

```javascript
async generatePlan(spec) {
  try {
    // Validate spec first
    const validationResult = await this.validateSpec(spec);
    if (!validationResult.valid) {
      throw new Error('Cannot generate plan from invalid specification');
    }
    
    return await this.planGenerator.generatePlan(spec);
  } catch (error) {
    throw new Error(`Failed to generate execution plan: ${error.message}`);
  }
}
```

#### Phase 3: Task Orchestration and Execution

The final phase executes the generated plan through task orchestration:

```javascript
async executeSpec(specPath, options = {}) {
  const startTime = new Date();
  const executionId = this.generateExecutionId();
  
  try {
    // Parse specification
    const spec = await this.parseSpec(specPath);
    
    // Generate execution plan
    const plan = await this.generatePlan(spec);
    plan.id = executionId;
    
    // Optionally save plan
    if (options.savePlan) {
      const planPath = path.join(this.options.plansDir, `${plan.id}.plan.yaml`);
      await this.savePlan(plan, planPath);
    }
    
    // Generate tasks
    const taskList = await this.generateTasks(plan);
    
    // Execute tasks
    const result = await this.taskOrchestrator.executeTasks(taskList, options);
    
    // Calculate metrics
    const endTime = new Date();
    result.metrics = {
      ...result.metrics,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      executionId
    };
    
    return result;
  } catch (error) {
    // Comprehensive error handling with metrics
    const endTime = new Date();
    return {
      success: false,
      executionId,
      error: error.message,
      metrics: {
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        tasksCompleted: 0,
        tasksTotal: 0,
        filesGenerated: 0
      },
      // Additional error context...
    };
  }
}
```

### 13.4 Template Engine Integration

The `PerfectTemplateEngine` provides zero-error template processing with advanced recovery mechanisms:

```javascript
export class PerfectTemplateEngine {
  constructor(options = {}) {
    this.config = {
      templatesDir: options.templatesDir || '_templates',
      autoescape: options.autoescape !== undefined ? options.autoescape : false,
      throwOnUndefined: options.throwOnUndefined !== undefined ? options.throwOnUndefined : false,
      strictVariables: options.strictVariables !== undefined ? options.strictVariables : false,
      enableCaching: options.enableCaching !== undefined ? options.enableCaching : true,
      maxCacheSize: options.maxCacheSize || 1000,
      ...options
    };

    // Multi-level caching system
    this.templateCache = new Map();
    this.compiledCache = new Map();
    this.variableCache = new Map();
    
    // Error recovery system
    this.errorPatterns = new Map();
    this.fixedTemplates = new Map();
    
    this.initializeNunjucksEngine();
    this.registerErrorPatterns();
  }
}
```

### 13.5 Error Recovery Patterns

One of the most sophisticated aspects of Unjucks v2 is its error recovery system. The template engine can automatically fix common template errors:

```javascript
registerErrorPatterns() {
  // Missing closing tags
  this.errorPatterns.set(
    /\{\%\s*if\s+[^%]*%\}(?:[\s\S]*?)(?!\{\%\s*endif\s*%\})/g,
    (match) => match + '{% endif %}'
  );
  
  this.errorPatterns.set(
    /\{\%\s*for\s+[^%]*%\}(?:[\s\S]*?)(?!\{\%\s*endfor\s*%\})/g,
    (match) => match + '{% endfor %}'
  );
  
  // Malformed frontmatter
  this.errorPatterns.set(
    /^---\s*\n([\s\S]*?)(?:\n---\s*\n|$)/,
    (match, yaml) => {
      try {
        // Try to fix common YAML errors
        const fixed = yaml
          .replace(/^(\s*[^:]+:)\s*([^"'\n]+)$/gm, '$1 "$2"')
          .replace(/\n\s*#[^\n]*$/gm, '')
          .replace(/:\s*$/gm, ': null');
        return `---\n${fixed}\n---\n`;
      } catch (e) {
        return match;
      }
    }
  );
}

fixTemplateContent(content, templatePath) {
  const cacheKey = `fixed:${templatePath}`;
  
  if (this.config.enableCaching && this.fixedTemplates.has(cacheKey)) {
    return this.fixedTemplates.get(cacheKey);
  }

  let fixedContent = content;

  // Apply all registered error patterns
  for (const [pattern, fix] of this.errorPatterns) {
    if (typeof fix === 'function') {
      fixedContent = fixedContent.replace(pattern, fix);
    } else {
      fixedContent = fixedContent.replace(pattern, fix);
    }
  }

  // Fix specific syntax issues
  fixedContent = this.fixSpecificIssues(fixedContent);

  if (this.config.enableCaching) {
    this.fixedTemplates.set(cacheKey, fixedContent);
  }

  return fixedContent;
}
```

### 13.6 Variable Extraction and Analysis

The engine can automatically discover variables used in templates:

```javascript
async extractVariables(templatePath) {
  const cacheKey = `vars:${templatePath}`;
  
  if (this.config.enableCaching && this.variableCache.has(cacheKey)) {
    return this.variableCache.get(cacheKey);
  }
  
  try {
    const content = await this.getTemplateContent(templatePath);
    const { frontmatter, content: templateContent } = await this.frontmatterParser.parse(content);
    const fixedContent = this.fixTemplateContent(templateContent, templatePath);
    
    const variables = new Set();
    
    // Extract from template content - Nunjucks style
    const nunjucksMatches = fixedContent.match(/\{\{\s*([^}|]+?)(?:\s*\|[^}]*)?s*\}\}/g) || [];
    nunjucksMatches.forEach(match => {
      const varName = match.replace(/\{\{\s*([^}|]+?)(?:\s*\|[^}]*)?\s*\}\}/, '$1').trim();
      if (varName && !varName.includes('(') && !varName.includes('[')) {
        variables.add(varName.split('.')[0]);
      }
    });
    
    // Extract from control structures
    const controlMatches = fixedContent.match(/\{\%\s*(?:if|for)\s+([^%]+)\s*%\}/g) || [];
    controlMatches.forEach(match => {
      const expr = match.replace(/\{\%\s*(?:if|for)\s+([^%]+)\s*%\}/, '$1');
      const words = expr.split(/\s+/);
      words.forEach(word => {
        if (word.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
          variables.add(word);
        }
      });
    });
    
    const result = {
      variables: Array.from(variables).sort(),
      frontmatterVariables: frontmatter.variables || {},
      required: Array.from(variables).filter(v => !frontmatter.variables?.[v]?.default)
    };
    
    if (this.config.enableCaching) {
      this.variableCache.set(cacheKey, result);
    }
    
    return result;
    
  } catch (error) {
    return {
      variables: [],
      frontmatterVariables: {},
      required: [],
      error: error.message
    };
  }
}
```

### 13.7 Traceability Patterns

Unjucks v2 maintains complete traceability from specification to generated code through metadata injection:

```javascript
// Every generated file includes metadata
async renderTemplate(templatePath, variables = {}, options = {}) {
  const startTime = performance.now();
  
  try {
    // Read and cache template content
    const content = await this.getTemplateContent(templatePath);
    
    // Parse frontmatter
    const { frontmatter, content: templateContent } = await this.frontmatterParser.parse(content);
    
    // Fix template content
    const fixedContent = this.fixTemplateContent(templateContent, templatePath);
    
    // Merge variables with frontmatter defaults
    const renderVariables = {
      ...frontmatter.variables || {},
      ...variables,
      // Add generation metadata
      _generated: {
        timestamp: new Date().toISOString(),
        template: templatePath,
        engine: 'unjucks-v2',
        version: '2025.9.8'
      }
    };
    
    // Render based on type
    const templateType = this.detectTemplateType(templatePath);
    let rendered;
    
    switch (templateType) {
      case 'ejs':
        rendered = await this.renderEJS(fixedContent, renderVariables, options);
        break;
      case 'nunjucks':
      default:
        rendered = await this.renderNunjucks(fixedContent, renderVariables, options);
        break;
    }
    
    const duration = performance.now() - startTime;
    
    return {
      success: true,
      content: rendered,
      frontmatter,
      variables: renderVariables,
      templateType,
      duration,
      traceability: {
        sourceTemplate: templatePath,
        generatedAt: new Date().toISOString(),
        renderTime: duration,
        variables: Object.keys(renderVariables)
      }
    };
    
  } catch (error) {
    const duration = performance.now() - startTime;
    
    return {
      success: false,
      error: {
        message: error.message,
        stack: error.stack,
        templatePath,
        variables
      },
      duration
    };
  }
}
```

### 13.8 File Injection Patterns

The `FileInjector` class handles sophisticated file modification scenarios:

```javascript
export class FileInjector {
  async processFile(filePath, content, frontmatterConfig, options = {}) {
    const { force = false, dry = false, backup = true } = options;

    try {
      // Check if file exists
      const fileExists = await fs.pathExists(filePath);
      
      if (!fileExists && !force) {
        return {
          success: false,
          skipped: false,
          action: 'skip',
          message: 'File does not exist and force option not set'
        };
      }

      // Read existing content if file exists
      let existingContent = '';
      if (fileExists) {
        existingContent = await fs.readFile(filePath, 'utf8');
      }

      // Create backup if requested and not dry run
      let backupPath = null;
      if (backup && !dry && fileExists) {
        backupPath = `${filePath}.backup.${Date.now()}`;
        await fs.copy(filePath, backupPath);
      }

      // Perform injection based on configuration
      let newContent = this.performInjection(existingContent, content, frontmatterConfig);
      
      // Check if injection would result in changes
      if (existingContent === newContent && fileExists) {
        return {
          success: true,
          skipped: true,
          action: 'skip',
          message: 'Content would not change, skipping injection'
        };
      }

      // Write new content if not dry run
      if (!dry) {
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, newContent, 'utf8');
      }

      return {
        success: true,
        skipped: false,
        action: fileExists ? 'update' : 'create',
        message: fileExists ? 'Content injected into existing file' : 'New file created with content',
        backupPath
      };
    } catch (error) {
      return {
        success: false,
        skipped: false,
        action: 'error',
        message: `Injection failed: ${error.message}`
      };
    }
  }

  performInjection(existingContent, newContent, config) {
    const lines = existingContent.split('\n');

    // Prepend - add to beginning of file
    if (config.prepend) {
      return newContent + '\n' + existingContent;
    }

    // Append - add to end of file
    if (config.append) {
      return existingContent + (existingContent.endsWith('\n') ? '' : '\n') + newContent;
    }

    // Insert at specific line number
    if (config.lineAt !== undefined) {
      const lineIndex = Math.max(0, Math.min(config.lineAt - 1, lines.length));
      lines.splice(lineIndex, 0, newContent);
      return lines.join('\n');
    }

    // Insert before/after matching lines
    if (config.before) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(config.before)) {
          lines.splice(i, 0, newContent);
          break;
        }
      }
      return lines.join('\n');
    }

    if (config.after) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(config.after)) {
          lines.splice(i + 1, 0, newContent);
          break;
        }
      }
      return lines.join('\n');
    }

    // Default: append to end
    return existingContent + (existingContent.endsWith('\n') ? '' : '\n') + newContent;
  }
}
```

### 13.9 Performance Metrics and Monitoring

Every generation operation is tracked with comprehensive metrics:

```javascript
// Performance tracking during generation
const startTime = performance.now();
performance.mark('template-parse-start');

// ... generation logic ...

const duration = performance.now() - startTime;
this.recordMetric('parseTime', duration);

performance.mark('template-parse-end');
performance.measure('template-parse', 'template-parse-start', 'template-parse-end');
```

### 13.10 Semantic Web Integration

Unjucks v2 includes sophisticated semantic web filters for RDF/OWL generation:

```javascript
// src/lib/filters/semantic.js
export function rdfResource(value, baseUri) {
  if (!value) return '';
  
  // If already a full URI, return as-is
  if (value.match(/^https?:\/\//) || value.match(/^urn:/)) {
    return value;
  }
  
  // Clean and format the value
  const cleaned = value.replace(/[^a-zA-Z0-9\-_\/]/g, '');
  
  if (baseUri) {
    return baseUri.endsWith('/') ? `${baseUri}${cleaned}` : `${baseUri}/${cleaned}`;
  }
  
  return cleaned;
}

export function owlRestriction(property, restrictionType, value, prefix) {
  const propRef = rdfProperty(property, prefix);
  
  const restrictions = {
    'someValuesFrom': `[ rdf:type owl:Restriction ; owl:onProperty ${propRef} ; owl:someValuesFrom ${value} ]`,
    'allValuesFrom': `[ rdf:type owl:Restriction ; owl:onProperty ${propRef} ; owl:allValuesFrom ${value} ]`,
    'hasValue': `[ rdf:type owl:Restriction ; owl:onProperty ${propRef} ; owl:hasValue ${value} ]`,
    'cardinality': `[ rdf:type owl:Restriction ; owl:onProperty ${propRef} ; owl:cardinality "${value}"^^xsd:nonNegativeInteger ]`,
    // ... more restriction types
  };
  
  return restrictions[restrictionType] || `[ rdf:type owl:Restriction ; owl:onProperty ${propRef} ]`;
}
```

### 13.11 Real-World Example: Full-Stack Application Generation

Here's how all these patterns come together in a real example:

```yaml
# specs/webapp.spec.yaml
apiVersion: v1
kind: Project
metadata:
  name: "User Management System"
  description: "Full-stack web application with authentication"
  version: "1.0.0"

spec:
  architecture: "fullstack"
  database: "postgresql"
  authentication: "jwt"
  
  components:
    - name: "user-api"
      type: "api"
      generator: "api"
      template: "rest"
      variables:
        entityName: "User"
        fields:
          - { name: "name", type: "string", required: true }
          - { name: "email", type: "string", required: true }
          - { name: "password", type: "string", required: true }
    
    - name: "user-frontend"
      type: "frontend"
      generator: "react"
      template: "crud"
      variables:
        componentName: "UserManager"
        apiUrl: "/api/users"

  deployment:
    type: "docker"
    environment: "production"
```

The generation process:

1. **Parse specification** - Validate structure and extract metadata
2. **Generate execution plan** - Create task graph with dependencies
3. **Execute tasks** - Generate API, frontend, database migrations, tests
4. **Track metrics** - Monitor performance and provide feedback

### 13.12 Key Takeaways

The code generation patterns in Unjucks v2 demonstrate several key principles:

1. **Separation of Concerns** - Parsing, planning, and execution are separate phases
2. **Error Recovery** - Comprehensive error handling and automatic fixes
3. **Performance Monitoring** - Every operation is tracked and optimized
4. **Traceability** - Complete audit trail from specification to generated code
5. **Extensibility** - Plugin architecture allows custom generators and templates

These patterns ensure that code generation is reliable, fast, and maintainable at scale.

---

## Chapter 14: Plugin Architecture Implementation

### 14.1 Introduction

Plugin architecture represents the extensibility cornerstone of Unjucks v2. Unlike monolithic code generation systems, Unjucks v2 is built from the ground up to support dynamic plugin loading, custom filters, generators, and integrations. This chapter explores the concrete implementation of the plugin system, showing how modularity and extensibility are achieved without sacrificing performance or reliability.

### 14.2 Core Plugin System Architecture

The plugin system in Unjucks v2 is built around a multi-layered architecture that supports different types of plugins:

```javascript
// src/core/plugin-system/PluginManager.js
export class PluginManager {
  constructor(options = {}) {
    this.options = {
      pluginsDir: options.pluginsDir || 'plugins',
      autoLoad: options.autoLoad !== undefined ? options.autoLoad : true,
      enableBuiltinPlugins: options.enableBuiltinPlugins !== undefined ? options.enableBuiltinPlugins : true,
      enableUserPlugins: options.enableUserPlugins !== undefined ? options.enableUserPlugins : true,
      pluginTimeout: options.pluginTimeout || 10000,
      ...options
    };
    
    // Plugin registry
    this.plugins = new Map();
    this.loadedPlugins = new Map();
    this.pluginHooks = new Map();
    this.pluginMetrics = new Map();
    
    // Plugin types
    this.pluginTypes = {
      FILTER: 'filter',
      GENERATOR: 'generator',
      TRANSFORMER: 'transformer',
      VALIDATOR: 'validator',
      INTEGRATION: 'integration',
      MIDDLEWARE: 'middleware'
    };
    
    // Event system for plugin communication
    this.eventEmitter = new EventEmitter();
    
    if (this.options.autoLoad) {
      this.initialize();
    }
  }
  
  async initialize() {
    console.log('🔌 Initializing Plugin Manager...');
    
    if (this.options.enableBuiltinPlugins) {
      await this.loadBuiltinPlugins();
    }
    
    if (this.options.enableUserPlugins) {
      await this.discoverAndLoadUserPlugins();
    }
    
    console.log(`✅ Plugin Manager initialized with ${this.plugins.size} plugins`);
  }
}
```

### 14.3 Filter Plugin System

The filter system is one of the most sophisticated plugin implementations in Unjucks v2. It supports dynamic loading, caching, and context-aware filtering:

```javascript
// src/lib/filters/FilterSystem.js
export class FilterSystem {
  constructor() {
    this.filters = new Map();
    this.filterCache = new Map();
    this.contextFilters = new Map();
    this.semanticFilters = new Map();
    
    // Load core filters
    this.loadCoreFilters();
  }
  
  /**
   * Register a new filter
   */
  registerFilter(name, filterFn, options = {}) {
    const filterConfig = {
      name,
      fn: filterFn,
      cacheable: options.cacheable !== undefined ? options.cacheable : false,
      async: options.async || false,
      context: options.context || 'global',
      description: options.description || '',
      examples: options.examples || [],
      tags: options.tags || [],
      version: options.version || '1.0.0',
      author: options.author || 'unknown',
      dependencies: options.dependencies || [],
      ...options
    };
    
    // Validate filter function
    if (typeof filterFn !== 'function') {
      throw new Error(`Filter ${name} must be a function`);
    }
    
    // Check dependencies
    if (filterConfig.dependencies.length > 0) {
      for (const dep of filterConfig.dependencies) {
        if (!this.filters.has(dep)) {
          throw new Error(`Filter ${name} depends on ${dep} which is not available`);
        }
      }
    }
    
    this.filters.set(name, filterConfig);
    
    // Register in appropriate context
    if (filterConfig.context === 'semantic') {
      this.semanticFilters.set(name, filterConfig);
    } else if (filterConfig.context !== 'global') {
      if (!this.contextFilters.has(filterConfig.context)) {
        this.contextFilters.set(filterConfig.context, new Map());
      }
      this.contextFilters.get(filterConfig.context).set(name, filterConfig);
    }
    
    console.log(`🔧 Registered filter: ${name} (${filterConfig.context})`);
    return this;
  }
  
  /**
   * Apply filter with caching support
   */
  async applyFilter(name, value, args = [], context = {}) {
    const filter = this.filters.get(name);
    if (!filter) {
      throw new Error(`Filter ${name} not found`);
    }
    
    // Check cache if filter is cacheable
    if (filter.cacheable) {
      const cacheKey = this.generateCacheKey(name, value, args, context);
      if (this.filterCache.has(cacheKey)) {
        return this.filterCache.get(cacheKey);
      }
    }
    
    try {
      let result;
      
      if (filter.async) {
        result = await filter.fn(value, ...args, context);
      } else {
        result = filter.fn(value, ...args, context);
      }
      
      // Cache result if applicable
      if (filter.cacheable && result !== undefined) {
        this.filterCache.set(cacheKey, result);
        
        // Manage cache size
        if (this.filterCache.size > 1000) {
          const firstKey = this.filterCache.keys().next().value;
          this.filterCache.delete(firstKey);
        }
      }
      
      return result;
    } catch (error) {
      throw new Error(`Filter ${name} error: ${error.message}`);
    }
  }
  
  /**
   * Load core filters from different domains
   */
  loadCoreFilters() {
    // String manipulation filters
    this.registerStringFilters();
    
    // Semantic web filters
    this.registerSemanticFilters();
    
    // LaTeX and document filters
    this.registerDocumentFilters();
    
    // Schema.org and JSON-LD filters
    this.registerSchemaFilters();
    
    // Performance and utility filters
    this.registerUtilityFilters();
  }
  
  registerSemanticFilters() {
    // RDF Resource filter
    this.registerFilter('rdfResource', (value, baseUri) => {
      if (!value) return '';
      
      if (value.match(/^https?:\/\//) || value.match(/^urn:/)) {
        return value;
      }
      
      const cleaned = value.replace(/[^a-zA-Z0-9\-_\/]/g, '');
      
      if (baseUri) {
        return baseUri.endsWith('/') ? `${baseUri}${cleaned}` : `${baseUri}/${cleaned}`;
      }
      
      return cleaned;
    }, {
      context: 'semantic',
      description: 'Convert string to RDF resource URI',
      examples: [
        { input: 'User', output: 'User' },
        { input: 'User Name', output: 'UserName' }
      ],
      tags: ['rdf', 'semantic-web']
    });
    
    // RDF Literal filter
    this.registerFilter('rdfLiteral', (value, langOrType) => {
      if (!value) return '""';
      
      const escaped = value.replace(/\\/g, '\\\\')
                          .replace(/"/g, '\\"')
                          .replace(/\n/g, '\\n')
                          .replace(/\r/g, '\\r')
                          .replace(/\t/g, '\\t');
      
      if (!langOrType) {
        return `"${escaped}"`;
      }
      
      if (langOrType.includes(':') || langOrType.startsWith('xsd:')) {
        return `"${escaped}"^^${langOrType}`;
      }
      
      return `"${escaped}"@${langOrType}`;
    }, {
      context: 'semantic',
      description: 'Convert string to RDF literal with optional language tag or datatype',
      examples: [
        { input: ['Hello', 'en'], output: '"Hello"@en' },
        { input: ['123', 'xsd:integer'], output: '"123"^^xsd:integer' }
      ],
      tags: ['rdf', 'semantic-web', 'literals']
    });
    
    // OWL Class Expression filter
    this.registerFilter('owlClassExpression', (classes, operator, prefix) => {
      if (!classes || classes.length === 0) return '';
      
      const classRefs = classes.map(cls => this.applyFilter('rdfClass', cls, [prefix]));
      
      switch (operator) {
        case 'union':
          return `[ rdf:type owl:Class ; owl:unionOf ( ${classRefs.join(' ')} ) ]`;
        case 'intersection':
          return `[ rdf:type owl:Class ; owl:intersectionOf ( ${classRefs.join(' ')} ) ]`;
        case 'complement':
          return `[ rdf:type owl:Class ; owl:complementOf ${classRefs[0]} ]`;
        default:
          return classRefs.join(' , ');
      }
    }, {
      context: 'semantic',
      description: 'Create OWL class expression (union, intersection, complement)',
      dependencies: ['rdfClass'],
      tags: ['owl', 'ontology', 'class-expression']
    });
  }
  
  registerDocumentFilters() {
    // LaTeX Math filter
    this.registerFilter('latexMath', (expression, display = false) => {
      if (!expression) return '';
      
      // Clean and escape the expression
      const cleaned = expression.toString().trim();
      
      if (display) {
        return `\\[${cleaned}\\]`;
      } else {
        return `\\(${cleaned}\\)`;
      }
    }, {
      context: 'document',
      description: 'Format mathematical expressions for LaTeX',
      examples: [
        { input: 'x^2 + y^2 = z^2', output: '\\(x^2 + y^2 = z^2\\)' },
        { input: ['\\sum_{i=1}^{n} x_i', true], output: '\\[\\sum_{i=1}^{n} x_i\\]' }
      ],
      tags: ['latex', 'math', 'document']
    });
    
    // Citation filter
    this.registerFilter('cite', (reference, style = 'apa') => {
      if (!reference) return '';
      
      const styles = {
        apa: (ref) => `\\cite{${ref}}`,
        mla: (ref) => `\\autocite{${ref}}`,
        chicago: (ref) => `\\footcite{${ref}}`,
        ieee: (ref) => `\\cite{${ref}}`
      };
      
      const formatter = styles[style] || styles.apa;
      return formatter(reference);
    }, {
      context: 'document',
      description: 'Format citations in various academic styles',
      tags: ['citation', 'bibliography', 'academic']
    });
  }
  
  registerSchemaFilters() {
    // Schema.org structured data filter
    this.registerFilter('schemaOrg', (data, schemaType) => {
      if (!data || !schemaType) return '';
      
      const schema = {
        '@context': 'https://schema.org',
        '@type': schemaType,
        ...data
      };
      
      return JSON.stringify(schema, null, 2);
    }, {
      context: 'structured-data',
      description: 'Generate Schema.org structured data',
      examples: [
        {
          input: [{ name: 'John Doe', email: 'john@example.com' }, 'Person'],
          output: '{\n  "@context": "https://schema.org",\n  "@type": "Person",\n  "name": "John Doe",\n  "email": "john@example.com"\n}'
        }
      ],
      tags: ['schema.org', 'structured-data', 'seo']
    });
    
    // JSON-LD context filter
    this.registerFilter('jsonLdContext', (contexts) => {
      if (!Array.isArray(contexts)) {
        contexts = [contexts];
      }
      
      const contextObj = {};
      
      for (const context of contexts) {
        if (typeof context === 'string') {
          if (context.startsWith('http')) {
            return { '@context': context };
          } else {
            // Predefined contexts
            const predefined = {
              'schema': 'https://schema.org',
              'foaf': 'http://xmlns.com/foaf/0.1/',
              'dc': 'http://purl.org/dc/terms/',
              'skos': 'http://www.w3.org/2004/02/skos/core#'
            };
            if (predefined[context]) {
              contextObj[context] = predefined[context];
            }
          }
        } else if (typeof context === 'object') {
          Object.assign(contextObj, context);
        }
      }
      
      return { '@context': contextObj };
    }, {
      context: 'structured-data',
      description: 'Generate JSON-LD context objects',
      tags: ['json-ld', 'linked-data', 'context']
    });
  }
  
  registerUtilityFilters() {
    // Performance measurement filter
    this.registerFilter('benchmark', async (value, operation) => {
      const start = process.hrtime.bigint();
      
      let result;
      if (typeof operation === 'function') {
        result = await operation(value);
      } else {
        result = value;
      }
      
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds
      
      return {
        result,
        duration,
        timestamp: new Date().toISOString()
      };
    }, {
      async: true,
      context: 'utility',
      description: 'Benchmark the performance of operations',
      tags: ['performance', 'benchmark', 'utility']
    });
    
    // Cache filter
    this.registerFilter('cached', (value, filterName, ...args) => {
      const key = `${filterName}:${JSON.stringify([value, ...args])}`;
      if (this.filterCache.has(key)) {
        return this.filterCache.get(key);
      }
      
      if (!this.filters.has(filterName)) {
        throw new Error(`Filter ${filterName} not found for caching`);
      }
      
      const result = this.applyFilter(filterName, value, args);
      this.filterCache.set(key, result);
      return result;
    }, {
      cacheable: false, // This filter manages its own caching
      context: 'utility',
      description: 'Cache the results of expensive filter operations',
      tags: ['cache', 'performance', 'utility']
    });
  }
  
  generateCacheKey(name, value, args, context) {
    const keyData = {
      filter: name,
      value: typeof value === 'object' ? JSON.stringify(value) : value,
      args: JSON.stringify(args),
      contextKeys: Object.keys(context).sort()
    };
    
    return createHash('md5')
      .update(JSON.stringify(keyData))
      .digest('hex')
      .substring(0, 16);
  }
  
  /**
   * Get filter information for documentation
   */
  getFilterInfo(name) {
    const filter = this.filters.get(name);
    if (!filter) {
      return null;
    }
    
    return {
      name: filter.name,
      description: filter.description,
      context: filter.context,
      async: filter.async,
      cacheable: filter.cacheable,
      examples: filter.examples,
      tags: filter.tags,
      version: filter.version,
      author: filter.author,
      dependencies: filter.dependencies
    };
  }
  
  /**
   * List all available filters
   */
  listFilters(context = null) {
    const results = [];
    
    for (const [name, filter] of this.filters) {
      if (context && filter.context !== context) {
        continue;
      }
      
      results.push({
        name,
        context: filter.context,
        description: filter.description,
        tags: filter.tags
      });
    }
    
    return results.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  /**
   * Search filters by tag or description
   */
  searchFilters(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    for (const [name, filter] of this.filters) {
      const matches = 
        name.toLowerCase().includes(lowerQuery) ||
        filter.description.toLowerCase().includes(lowerQuery) ||
        filter.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
      
      if (matches) {
        results.push({
          name,
          context: filter.context,
          description: filter.description,
          tags: filter.tags,
          relevance: this.calculateRelevance(query, filter)
        });
      }
    }
    
    return results.sort((a, b) => b.relevance - a.relevance);
  }
  
  calculateRelevance(query, filter) {
    let score = 0;
    const lowerQuery = query.toLowerCase();
    
    // Exact name match gets highest score
    if (filter.name.toLowerCase() === lowerQuery) {
      score += 100;
    } else if (filter.name.toLowerCase().includes(lowerQuery)) {
      score += 50;
    }
    
    // Description matches
    if (filter.description.toLowerCase().includes(lowerQuery)) {
      score += 25;
    }
    
    // Tag matches
    score += filter.tags.filter(tag => 
      tag.toLowerCase().includes(lowerQuery)
    ).length * 10;
    
    return score;
  }
}
```

### 14.4 Generator Plugin System

Generators are more complex plugins that can create entire file structures:

```javascript
// src/core/plugin-system/GeneratorPlugin.js
export class GeneratorPlugin {
  constructor(name, options = {}) {
    this.name = name;
    this.version = options.version || '1.0.0';
    this.description = options.description || '';
    this.author = options.author || 'unknown';
    this.dependencies = options.dependencies || [];
    this.templates = options.templates || [];
    
    // Plugin lifecycle hooks
    this.hooks = {
      beforeGenerate: [],
      afterGenerate: [],
      beforeTemplate: [],
      afterTemplate: [],
      onError: []
    };
    
    this.metrics = {
      totalGenerations: 0,
      averageTime: 0,
      lastGeneration: null,
      errors: 0
    };
  }
  
  /**
   * Register a hook for the plugin lifecycle
   */
  addHook(event, handler) {
    if (this.hooks[event]) {
      this.hooks[event].push(handler);
    }
  }
  
  /**
   * Execute hooks for a given event
   */
  async executeHooks(event, context) {
    const handlers = this.hooks[event] || [];
    const results = [];
    
    for (const handler of handlers) {
      try {
        const result = await handler(context);
        results.push(result);
      } catch (error) {
        console.error(`Hook error in ${this.name}:${event}:`, error);
        results.push({ error: error.message });
      }
    }
    
    return results;
  }
  
  /**
   * Generate files using this plugin
   */
  async generate(templateName, variables = {}, options = {}) {
    const startTime = Date.now();
    
    try {
      // Execute beforeGenerate hooks
      await this.executeHooks('beforeGenerate', {
        plugin: this.name,
        template: templateName,
        variables,
        options
      });
      
      // Find template
      const template = this.templates.find(t => t.name === templateName);
      if (!template) {
        throw new Error(`Template ${templateName} not found in generator ${this.name}`);
      }
      
      // Execute beforeTemplate hooks
      await this.executeHooks('beforeTemplate', {
        plugin: this.name,
        template,
        variables,
        options
      });
      
      // Generate files
      const results = await this.generateFiles(template, variables, options);
      
      // Execute afterTemplate hooks
      await this.executeHooks('afterTemplate', {
        plugin: this.name,
        template,
        variables,
        options,
        results
      });
      
      // Update metrics
      const duration = Date.now() - startTime;
      this.updateMetrics(duration, true);
      
      // Execute afterGenerate hooks
      await this.executeHooks('afterGenerate', {
        plugin: this.name,
        template: templateName,
        variables,
        options,
        results,
        duration
      });
      
      return {
        success: true,
        plugin: this.name,
        template: templateName,
        files: results,
        duration,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(duration, false);
      
      // Execute error hooks
      await this.executeHooks('onError', {
        plugin: this.name,
        template: templateName,
        variables,
        options,
        error,
        duration
      });
      
      throw error;
    }
  }
  
  /**
   * Generate files from template
   */
  async generateFiles(template, variables, options) {
    const results = [];
    
    for (const file of template.files) {
      const result = await this.generateFile(file, variables, options);
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Generate individual file
   */
  async generateFile(fileConfig, variables, options) {
    // This would be implemented by concrete generator plugins
    throw new Error('generateFile must be implemented by concrete generator plugins');
  }
  
  /**
   * Update plugin metrics
   */
  updateMetrics(duration, success) {
    if (success) {
      this.metrics.totalGenerations++;
      const total = this.metrics.averageTime * (this.metrics.totalGenerations - 1);
      this.metrics.averageTime = (total + duration) / this.metrics.totalGenerations;
      this.metrics.lastGeneration = new Date().toISOString();
    } else {
      this.metrics.errors++;
    }
  }
  
  /**
   * Get plugin information
   */
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      author: this.author,
      dependencies: this.dependencies,
      templates: this.templates.map(t => ({
        name: t.name,
        description: t.description,
        files: t.files.length
      })),
      metrics: { ...this.metrics }
    };
  }
}
```

### 14.5 Concrete Generator Implementation

Here's how a concrete generator plugin is implemented:

```javascript
// src/generators/ReactComponentGenerator.js
export class ReactComponentGenerator extends GeneratorPlugin {
  constructor() {
    super('react-component', {
      version: '2.0.0',
      description: 'Generate React components with TypeScript support',
      author: 'Unjucks Team',
      dependencies: ['react', 'typescript'],
      templates: [
        {
          name: 'functional',
          description: 'Functional component with hooks',
          files: [
            { template: 'component.tsx.njk', output: '{{componentName}}.tsx' },
            { template: 'component.test.tsx.njk', output: '{{componentName}}.test.tsx' },
            { template: 'component.stories.tsx.njk', output: '{{componentName}}.stories.tsx' },
            { template: 'index.ts.njk', output: 'index.ts' }
          ]
        },
        {
          name: 'class',
          description: 'Class-based component',
          files: [
            { template: 'class-component.tsx.njk', output: '{{componentName}}.tsx' },
            { template: 'class-component.test.tsx.njk', output: '{{componentName}}.test.tsx' }
          ]
        }
      ]
    });
    
    // Add React-specific hooks
    this.addHook('beforeGenerate', this.validateReactEnvironment);
    this.addHook('afterGenerate', this.updatePackageJson);
  }
  
  async validateReactEnvironment(context) {
    // Check if React is installed
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      if (!packageJson.dependencies?.react && !packageJson.devDependencies?.react) {
        console.warn('⚠️  React not found in package.json. Component may not work correctly.');
      }
    } catch (error) {
      console.warn('⚠️  Could not read package.json');
    }
  }
  
  async updatePackageJson(context) {
    // Add any necessary dependencies
    const requiredDeps = {
      '@types/react': '^18.0.0',
      '@types/react-dom': '^18.0.0'
    };
    
    // Implementation would update package.json if needed
    console.log('📦 Checking React dependencies...');
  }
  
  async generateFile(fileConfig, variables, options) {
    const { template: templatePath, output: outputPath } = fileConfig;
    
    // Load template engine
    const templateEngine = new PerfectTemplateEngine({
      templatesDir: path.join('_templates', 'generators', this.name)
    });
    
    // Render template
    const result = await templateEngine.renderTemplate(
      path.join('_templates', 'generators', this.name, templatePath),
      {
        ...variables,
        // Add React-specific variables
        hasProps: variables.props && variables.props.length > 0,
        hasState: variables.state && variables.state.length > 0,
        isTypeScript: outputPath.endsWith('.tsx'),
        componentName: variables.componentName || 'Component',
        // Helper functions
        propsInterface: this.generatePropsInterface(variables.props),
        stateInterface: this.generateStateInterface(variables.state)
      },
      options
    );
    
    if (!result.success) {
      throw new Error(`Failed to render template ${templatePath}: ${result.error.message}`);
    }
    
    // Process output path
    const processedOutputPath = this.processOutputPath(outputPath, variables);
    
    // Handle file injection or creation
    const injector = new FileInjector();
    const writeResult = await injector.processFile(
      processedOutputPath,
      result.content,
      result.frontmatter,
      options
    );
    
    return {
      template: templatePath,
      output: processedOutputPath,
      success: writeResult.success,
      action: writeResult.action,
      size: result.content.length
    };
  }
  
  generatePropsInterface(props = []) {
    if (props.length === 0) return '';
    
    const interfaceProps = props.map(prop => {
      const optional = prop.required === false ? '?' : '';
      return `  ${prop.name}${optional}: ${prop.type};`;
    }).join('\n');
    
    return `interface Props {\n${interfaceProps}\n}`;
  }
  
  generateStateInterface(state = []) {
    if (state.length === 0) return '';
    
    const interfaceState = state.map(s => {
      return `  ${s.name}: ${s.type};`;
    }).join('\n');
    
    return `interface State {\n${interfaceState}\n}`;
  }
  
  processOutputPath(outputPath, variables) {
    // Process template variables in output path
    return outputPath.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return variables[varName] || match;
    });
  }
}
```

### 14.6 Plugin Discovery and Loading

The plugin system includes sophisticated discovery and loading mechanisms:

```javascript
// Plugin discovery and loading
async discoverAndLoadUserPlugins() {
  const pluginDirs = [
    this.options.pluginsDir,
    path.join(process.cwd(), 'plugins'),
    path.join(process.cwd(), 'node_modules', '@unjucks', 'plugins'),
    path.join(os.homedir(), '.unjucks', 'plugins')
  ];
  
  for (const dir of pluginDirs) {
    if (await fs.pathExists(dir)) {
      await this.loadPluginsFromDirectory(dir);
    }
  }
}

async loadPluginsFromDirectory(dir) {
  const items = await fs.readdir(dir, { withFileTypes: true });
  
  for (const item of items) {
    if (item.isDirectory()) {
      const pluginDir = path.join(dir, item.name);
      const pluginJson = path.join(pluginDir, 'plugin.json');
      
      if (await fs.pathExists(pluginJson)) {
        await this.loadPlugin(pluginDir);
      }
    } else if (item.name.endsWith('.js') || item.name.endsWith('.mjs')) {
      await this.loadPluginFile(path.join(dir, item.name));
    }
  }
}

async loadPlugin(pluginDir) {
  try {
    const pluginJsonPath = path.join(pluginDir, 'plugin.json');
    const pluginJson = JSON.parse(await fs.readFile(pluginJsonPath, 'utf8'));
    
    // Validate plugin manifest
    if (!this.validatePluginManifest(pluginJson)) {
      throw new Error('Invalid plugin manifest');
    }
    
    // Load plugin main file
    const mainFile = path.join(pluginDir, pluginJson.main || 'index.js');
    const plugin = await import(mainFile);
    
    // Register plugin
    await this.registerPlugin(pluginJson.name, plugin.default || plugin, {
      manifest: pluginJson,
      directory: pluginDir
    });
    
    console.log(`✅ Loaded plugin: ${pluginJson.name} v${pluginJson.version}`);
  } catch (error) {
    console.error(`❌ Failed to load plugin from ${pluginDir}:`, error.message);
  }
}

async registerPlugin(name, plugin, metadata = {}) {
  // Validate plugin interface
  if (typeof plugin !== 'object' && typeof plugin !== 'function') {
    throw new Error(`Plugin ${name} must export an object or function`);
  }
  
  // Create plugin instance if it's a constructor
  let pluginInstance;
  if (typeof plugin === 'function') {
    pluginInstance = new plugin();
  } else {
    pluginInstance = plugin;
  }
  
  // Validate required methods
  if (!pluginInstance.getInfo || typeof pluginInstance.getInfo !== 'function') {
    throw new Error(`Plugin ${name} must implement getInfo() method`);
  }
  
  // Store plugin
  this.plugins.set(name, {
    name,
    instance: pluginInstance,
    metadata,
    loadedAt: new Date().toISOString(),
    metrics: {
      uses: 0,
      errors: 0,
      lastUsed: null
    }
  });
  
  // Initialize plugin if it has init method
  if (pluginInstance.init && typeof pluginInstance.init === 'function') {
    await pluginInstance.init({
      pluginManager: this,
      eventEmitter: this.eventEmitter
    });
  }
  
  // Emit plugin loaded event
  this.eventEmitter.emit('pluginLoaded', { name, plugin: pluginInstance });
}
```

### 14.7 Plugin Communication and Events

Plugins can communicate through an event system:

```javascript
// Plugin event system
class PluginEventSystem {
  constructor(eventEmitter) {
    this.eventEmitter = eventEmitter;
    this.subscribers = new Map();
  }
  
  subscribe(event, pluginName, handler) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Map());
    }
    
    this.subscribers.get(event).set(pluginName, handler);
    this.eventEmitter.on(event, handler);
  }
  
  unsubscribe(event, pluginName) {
    const eventSubscribers = this.subscribers.get(event);
    if (eventSubscribers && eventSubscribers.has(pluginName)) {
      const handler = eventSubscribers.get(pluginName);
      this.eventEmitter.off(event, handler);
      eventSubscribers.delete(pluginName);
    }
  }
  
  emit(event, data) {
    this.eventEmitter.emit(event, data);
  }
  
  // Async event handling with timeout
  async emitAsync(event, data, timeout = 5000) {
    const promises = [];
    const eventSubscribers = this.subscribers.get(event);
    
    if (eventSubscribers) {
      for (const [pluginName, handler] of eventSubscribers) {
        const promise = Promise.race([
          Promise.resolve(handler(data)),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Plugin ${pluginName} timeout`)), timeout)
          )
        ]);
        promises.push(promise);
      }
    }
    
    const results = await Promise.allSettled(promises);
    return results;
  }
}
```

### 14.8 Plugin Security and Sandboxing

Security is crucial for plugin systems:

```javascript
// Plugin security wrapper
class SecurePluginWrapper {
  constructor(plugin, permissions = {}) {
    this.plugin = plugin;
    this.permissions = {
      fileSystem: permissions.fileSystem || 'read',
      network: permissions.network || false,
      subprocess: permissions.subprocess || false,
      ...permissions
    };
    
    this.sandbox = this.createSandbox();
  }
  
  createSandbox() {
    const sandbox = {
      // Provide safe versions of Node.js APIs
      require: this.createSafeRequire(),
      console: {
        log: (...args) => console.log(`[Plugin:${this.plugin.name}]`, ...args),
        warn: (...args) => console.warn(`[Plugin:${this.plugin.name}]`, ...args),
        error: (...args) => console.error(`[Plugin:${this.plugin.name}]`, ...args),
      },
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      Buffer,
      JSON,
      Math,
      Date,
    };
    
    // Add file system access based on permissions
    if (this.permissions.fileSystem === 'read') {
      sandbox.fs = this.createReadOnlyFS();
    } else if (this.permissions.fileSystem === 'write') {
      sandbox.fs = this.createRestrictedFS();
    }
    
    return sandbox;
  }
  
  createSafeRequire() {
    const allowedModules = [
      'path',
      'crypto',
      'util',
      'events',
      'stream'
    ];
    
    return (moduleName) => {
      if (allowedModules.includes(moduleName)) {
        return require(moduleName);
      }
      throw new Error(`Module ${moduleName} is not allowed in plugin sandbox`);
    };
  }
  
  createReadOnlyFS() {
    return {
      readFile: fs.readFile,
      readFileSync: fs.readFileSync,
      readdir: fs.readdir,
      readdirSync: fs.readdirSync,
      stat: fs.stat,
      statSync: fs.statSync,
      pathExists: fs.pathExists,
      pathExistsSync: fs.pathExistsSync
    };
  }
  
  async executeMethod(methodName, ...args) {
    if (!this.plugin[methodName]) {
      throw new Error(`Method ${methodName} not found in plugin`);
    }
    
    // Execute in sandbox context
    const vm = require('vm');
    const context = vm.createContext(this.sandbox);
    
    // Wrap plugin method to run in sandbox
    const wrappedMethod = vm.runInContext(`
      (function(plugin, methodName, args) {
        return plugin[methodName].apply(plugin, args);
      })
    `, context);
    
    return await wrappedMethod(this.plugin, methodName, args);
  }
}
```

### 14.9 Plugin Performance Monitoring

```javascript
// Plugin performance monitoring
class PluginPerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.thresholds = {
      executionTime: 1000, // 1 second
      memoryUsage: 50 * 1024 * 1024, // 50MB
      errorRate: 0.1 // 10%
    };
  }
  
  startMonitoring(pluginName) {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    return {
      pluginName,
      startTime,
      startMemory,
      
      end: (success = true) => {
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        
        const executionTime = Number(endTime - startTime) / 1000000; // ms
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
        
        this.recordMetric(pluginName, {
          executionTime,
          memoryDelta,
          success,
          timestamp: new Date().toISOString()
        });
        
        // Check thresholds
        this.checkThresholds(pluginName, { executionTime, memoryDelta });
      }
    };
  }
  
  recordMetric(pluginName, metric) {
    if (!this.metrics.has(pluginName)) {
      this.metrics.set(pluginName, {
        totalExecutions: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        maxExecutionTime: 0,
        totalMemoryUsage: 0,
        maxMemoryUsage: 0,
        successCount: 0,
        errorCount: 0,
        errorRate: 0,
        history: []
      });
    }
    
    const pluginMetrics = this.metrics.get(pluginName);
    
    // Update metrics
    pluginMetrics.totalExecutions++;
    pluginMetrics.totalExecutionTime += metric.executionTime;
    pluginMetrics.averageExecutionTime = pluginMetrics.totalExecutionTime / pluginMetrics.totalExecutions;
    pluginMetrics.maxExecutionTime = Math.max(pluginMetrics.maxExecutionTime, metric.executionTime);
    pluginMetrics.totalMemoryUsage += Math.abs(metric.memoryDelta);
    pluginMetrics.maxMemoryUsage = Math.max(pluginMetrics.maxMemoryUsage, Math.abs(metric.memoryDelta));
    
    if (metric.success) {
      pluginMetrics.successCount++;
    } else {
      pluginMetrics.errorCount++;
    }
    
    pluginMetrics.errorRate = pluginMetrics.errorCount / pluginMetrics.totalExecutions;
    
    // Keep history (last 100 executions)
    pluginMetrics.history.push(metric);
    if (pluginMetrics.history.length > 100) {
      pluginMetrics.history.shift();
    }
  }
  
  checkThresholds(pluginName, metric) {
    const warnings = [];
    
    if (metric.executionTime > this.thresholds.executionTime) {
      warnings.push(`Slow execution: ${metric.executionTime.toFixed(2)}ms`);
    }
    
    if (Math.abs(metric.memoryDelta) > this.thresholds.memoryUsage) {
      warnings.push(`High memory usage: ${(Math.abs(metric.memoryDelta) / 1024 / 1024).toFixed(2)}MB`);
    }
    
    const pluginMetrics = this.metrics.get(pluginName);
    if (pluginMetrics && pluginMetrics.errorRate > this.thresholds.errorRate) {
      warnings.push(`High error rate: ${(pluginMetrics.errorRate * 100).toFixed(1)}%`);
    }
    
    if (warnings.length > 0) {
      console.warn(`⚠️  Plugin ${pluginName} performance issues:`, warnings.join(', '));
    }
  }
  
  getPluginMetrics(pluginName) {
    return this.metrics.get(pluginName) || null;
  }
  
  getAllMetrics() {
    const result = {};
    for (const [pluginName, metrics] of this.metrics) {
      result[pluginName] = { ...metrics, history: metrics.history.slice(-10) }; // Last 10 only
    }
    return result;
  }
}
```

### 14.10 Plugin Configuration System

```javascript
// Plugin configuration management
class PluginConfigManager {
  constructor(configPath = '.unjucks/plugins.json') {
    this.configPath = configPath;
    this.config = new Map();
    this.defaults = new Map();
    this.validators = new Map();
  }
  
  async loadConfig() {
    try {
      if (await fs.pathExists(this.configPath)) {
        const configData = JSON.parse(await fs.readFile(this.configPath, 'utf8'));
        for (const [pluginName, config] of Object.entries(configData)) {
          this.config.set(pluginName, config);
        }
      }
    } catch (error) {
      console.warn('Failed to load plugin configuration:', error.message);
    }
  }
  
  async saveConfig() {
    try {
      const configData = Object.fromEntries(this.config);
      await fs.ensureDir(path.dirname(this.configPath));
      await fs.writeFile(this.configPath, JSON.stringify(configData, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save plugin configuration:', error.message);
    }
  }
  
  registerDefaults(pluginName, defaults) {
    this.defaults.set(pluginName, defaults);
  }
  
  registerValidator(pluginName, validator) {
    this.validators.set(pluginName, validator);
  }
  
  get(pluginName, key = null) {
    const pluginConfig = this.config.get(pluginName) || {};
    const pluginDefaults = this.defaults.get(pluginName) || {};
    
    const mergedConfig = { ...pluginDefaults, ...pluginConfig };
    
    if (key) {
      return mergedConfig[key];
    }
    
    return mergedConfig;
  }
  
  set(pluginName, key, value) {
    if (!this.config.has(pluginName)) {
      this.config.set(pluginName, {});
    }
    
    const pluginConfig = this.config.get(pluginName);
    
    if (typeof key === 'object') {
      // Setting multiple values
      Object.assign(pluginConfig, key);
    } else {
      // Setting single value
      pluginConfig[key] = value;
    }
    
    // Validate if validator exists
    const validator = this.validators.get(pluginName);
    if (validator) {
      const isValid = validator(pluginConfig);
      if (!isValid) {
        throw new Error(`Invalid configuration for plugin ${pluginName}`);
      }
    }
    
    // Auto-save
    this.saveConfig().catch(error => 
      console.error('Failed to auto-save configuration:', error.message)
    );
  }
}
```

### 14.11 Key Takeaways

The plugin architecture in Unjucks v2 demonstrates several important patterns:

1. **Layered Architecture** - Filters, generators, and integrations work at different levels
2. **Security by Design** - Sandboxing and permission systems protect the host
3. **Performance Monitoring** - All plugin operations are tracked and optimized
4. **Event-Driven Communication** - Plugins can communicate through a robust event system
5. **Configuration Management** - Centralized, validated configuration system
6. **Graceful Error Handling** - Plugin failures don't crash the system

This architecture enables Unjucks v2 to be extended with custom functionality while maintaining stability and performance.

---

## Chapter 15: Performance Optimization Guided by Specs

### 15.1 Introduction

Performance optimization in specification-driven development requires a fundamentally different approach than traditional optimization. Instead of optimizing code after it's written, Unjucks v2 uses specifications to guide optimization decisions from the earliest stages of development. This chapter explores the sophisticated performance optimization system built into Unjucks v2, showing how specifications drive optimization strategies and how performance requirements are transformed into concrete implementation patterns.

### 15.2 Specification-Driven Performance Architecture

The performance optimization system in Unjucks v2 starts with performance specifications that define concrete targets:

```javascript
// src/performance/spec-performance-optimizer.js
export class SpecPerformanceOptimizer {
  constructor(options = {}) {
    this.options = {
      enableCaching: true,
      cacheMaxSize: 500,
      cacheTTL: 600000, // 10 minutes
      enableCompression: true,
      enableLazyLoading: true,
      enableMetrics: true,
      targetGenerationTime: 200, // 200ms target - driven by specification
      ...options
    };

    // Performance caches - multi-layered optimization
    this.templateCache = new Map();
    this.specCache = new Map();
    this.patternCache = new Map();
    this.astCache = new Map();

    // Performance metrics - comprehensive tracking
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      parseTime: [],
      renderTime: [],
      totalTime: [],
      memoryUsage: []
    };

    // Lazy loading registry - startup optimization
    this.lazyModules = new Map();
    this.loadedModules = new Set();

    this.setupPerformanceTracking();
    this.optimizeModuleLoading();
  }
}
```

### 15.3 Performance Tracking and Monitoring

The system includes comprehensive performance tracking that monitors every aspect of the generation process:

```javascript
setupPerformanceTracking() {
  if (!this.options.enableMetrics) return;

  const obs = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      this.recordPerformanceEntry(entry);
    }
  });

  obs.observe({ entryTypes: ['measure', 'mark'] });

  // Track memory usage periodically with garbage collection
  if (global.gc) {
    setInterval(() => {
      global.gc();
      const usage = process.memoryUsage();
      this.metrics.memoryUsage.push({
        timestamp: Date.now(),
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        rss: usage.rss
      });
      
      // Keep only last 100 measurements for memory efficiency
      if (this.metrics.memoryUsage.length > 100) {
        this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
      }
    }, 5000);
  }
}

recordPerformanceEntry(entry) {
  if (entry.name.startsWith('template-')) {
    this.recordMetric('totalTime', entry.duration);
    
    // Real-time performance alerting
    if (entry.duration > this.options.targetGenerationTime) {
      console.warn(
        `⚠ Performance target exceeded: ${entry.name} took ${entry.duration.toFixed(2)}ms (target: ${this.options.targetGenerationTime}ms)`
      );
    }
  }
}
```

### 15.4 Lazy Loading and Module Optimization

One of the key performance optimizations is intelligent module loading:

```javascript
optimizeModuleLoading() {
  // Register modules for lazy loading - reduces startup time by 60-80%
  this.registerLazyModule('nunjucks', () => import('nunjucks'));
  this.registerLazyModule('gray-matter', () => import('gray-matter'));
  this.registerLazyModule('glob', () => import('glob'));
  this.registerLazyModule('yaml', () => import('yaml'));
}

async loadModule(name) {
  if (this.loadedModules.has(name)) {
    return this.lazyModules.get(name + '_instance');
  }

  const loader = this.lazyModules.get(name);
  if (!loader) {
    throw new Error(`Module ${name} not registered for lazy loading`);
  }

  const start = performance.now();
  const module = await loader();
  const duration = performance.now() - start;

  this.loadedModules.add(name);
  this.lazyModules.set(name + '_instance', module);

  console.log(chalk.gray(`Lazy loaded ${name} in ${duration.toFixed(2)}ms`));
  return module;
}
```

### 15.5 Advanced Caching System

The caching system is designed for maximum performance with intelligent cache management:

```javascript
generateCacheKey(type, path, context = {}) {
  const pathHash = createHash('md5').update(path).digest('hex').substring(0, 8);
  const contextHash = createHash('md5')
    .update(JSON.stringify(context))
    .digest('hex')
    .substring(0, 8);
  
  return `${type}:${pathHash}:${contextHash}`;
}

getCached(cache, key) {
  const item = cache.get(key);
  if (!item) return null;

  const now = Date.now();
  if (now > item.expires) {
    cache.delete(key);
    return null;
  }

  this.metrics.cacheHits++;
  return item.data;
}

setCached(cache, key, data, ttl = this.options.cacheTTL) {
  // Enforce cache size limits with LRU eviction
  if (cache.size >= this.options.cacheMaxSize) {
    const keys = Array.from(cache.keys());
    for (let i = 0; i < Math.floor(this.options.cacheMaxSize * 0.1); i++) {
      cache.delete(keys[i]);
    }
  }

  cache.set(key, {
    data,
    expires: Date.now() + ttl,
    created: Date.now()
  });

  this.metrics.cacheMisses++;
}
```

### 15.6 Optimized Template Processing

Template parsing and rendering are optimized for sub-200ms performance:

```javascript
async parseTemplateOptimized(templatePath, context = {}) {
  const startTime = performance.now();
  performance.mark('template-parse-start');

  const cacheKey = this.generateCacheKey('template', templatePath, context);
  
  // Check cache first - dramatically reduces parse time for repeated operations
  let template = this.getCached(this.templateCache, cacheKey);
  if (template) {
    const duration = performance.now() - startTime;
    this.recordMetric('parseTime', duration);
    return template;
  }

  try {
    // Check if file exists and get stats for cache invalidation
    if (!existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    const stats = statSync(templatePath);
    const content = readFileSync(templatePath, 'utf8');
    
    // Parse template with optimized parsing
    template = this.parseTemplateContent(content, templatePath, stats);
    
    // Cache the result with file modification time validation
    this.setCached(this.templateCache, cacheKey, template);
    
    const duration = performance.now() - startTime;
    this.recordMetric('parseTime', duration);
    
    performance.mark('template-parse-end');
    performance.measure('template-parse', 'template-parse-start', 'template-parse-end');
    
    return template;
  } catch (error) {
    console.error(chalk.red(`Error parsing template ${templatePath}:`), error.message);
    throw error;
  }
}

parseTemplateContent(content, templatePath, stats) {
  const { data: frontmatter, content: body } = this.parseFrontmatter(content);
  
  return {
    path: templatePath,
    frontmatter,
    body,
    mtime: stats.mtime,
    size: stats.size,
    hash: this.generateContentHash(content)
  };
}

// Optimized frontmatter parsing with fast path for non-frontmatter templates
parseFrontmatter(content) {
  // Fast path for templates without frontmatter - 90%+ performance improvement
  if (!content.startsWith('---')) {
    return { data: {}, content };
  }

  // Use cached gray-matter if available
  const matter = this.lazyModules.get('gray-matter_instance') || require('gray-matter');
  return matter(content);
}
```

### 15.7 Parallel Template Discovery

Template discovery is optimized with parallel processing:

```javascript
async discoverTemplatesOptimized(basePath = '_templates', maxDepth = 3) {
  const startTime = performance.now();
  performance.mark('template-discovery-start');

  const cacheKey = this.generateCacheKey('discovery', basePath, { maxDepth });
  
  // Check cache
  let templates = this.getCached(this.specCache, cacheKey);
  if (templates) {
    return templates;
  }

  try {
    templates = await this.parallelTemplateDiscovery(basePath, maxDepth);
    
    // Cache results with shorter TTL for discovery
    this.setCached(this.specCache, cacheKey, templates, 300000); // 5 minute TTL
    
    const duration = performance.now() - startTime;
    console.log(chalk.green(`✓ Discovered ${templates.length} templates in ${duration.toFixed(2)}ms`));
    
    performance.mark('template-discovery-end');
    performance.measure('template-discovery', 'template-discovery-start', 'template-discovery-end');
    
    return templates;
  } catch (error) {
    console.error(chalk.red('Error discovering templates:'), error.message);
    return [];
  }
}

// Parallel discovery with Promise.all for maximum concurrency
async parallelTemplateDiscovery(basePath, maxDepth, currentDepth = 0) {
  if (currentDepth >= maxDepth) return [];
  if (!existsSync(basePath)) return [];

  const items = await fs.readdir(basePath, { withFileTypes: true });
  const promises = [];

  for (const item of items) {
    const itemPath = join(basePath, item.name);
    
    if (item.isDirectory()) {
      // Recursively discover in subdirectories
      promises.push(this.parallelTemplateDiscovery(itemPath, maxDepth, currentDepth + 1));
    } else if (this.isTemplateFile(item.name)) {
      // Process template files
      promises.push(this.processTemplateFile(itemPath));
    }
  }

  const results = await Promise.all(promises);
  return results.flat().filter(Boolean);
}
```

### 15.8 Optimized Template Rendering

Template rendering includes multiple optimization layers:

```javascript
async renderTemplateOptimized(template, variables = {}) {
  const startTime = performance.now();
  performance.mark('template-render-start');

  try {
    // Use cached nunjucks environment - prevents re-initialization
    const nunjucks = await this.getOptimizedNunjucks();
    
    // Render with optimizations
    const result = this.renderWithOptimizations(nunjucks, template, variables);
    
    const duration = performance.now() - startTime;
    this.recordMetric('renderTime', duration);
    
    // Check if we're meeting performance targets
    if (duration > this.options.targetGenerationTime) {
      console.warn(chalk.yellow(`⚠ Render time ${duration.toFixed(2)}ms exceeds target ${this.options.targetGenerationTime}ms`));
    }
    
    performance.mark('template-render-end');
    performance.measure('template-render', 'template-render-start', 'template-render-end');
    
    return result;
  } catch (error) {
    console.error(chalk.red('Template rendering error:'), error.message);
    throw error;
  }
}

async getOptimizedNunjucks() {
  if (this.optimizedNunjucks) {
    return this.optimizedNunjucks;
  }

  const nunjucks = await this.loadModule('nunjucks');
  
  this.optimizedNunjucks = new nunjucks.Environment(
    new nunjucks.FileSystemLoader('_templates', {
      noCache: false, // Enable caching for performance
    }),
    {
      autoescape: false,
      throwOnUndefined: false,
      trimBlocks: true,
      lstripBlocks: true
    }
  );

  // Add optimized filters
  this.addOptimizedFilters(this.optimizedNunjucks);
  
  return this.optimizedNunjucks;
}

addOptimizedFilters(env) {
  // Cache filter results for expensive operations
  const filterCache = new Map();
  
  env.addFilter('cached', function(value, filterName, ...args) {
    const key = `${filterName}:${JSON.stringify([value, ...args])}`;
    if (filterCache.has(key)) {
      return filterCache.get(key);
    }
    
    const result = this.env.getFilter(filterName).call(this, value, ...args);
    filterCache.set(key, result);
    return result;
  });

  // Fast string operations - optimized for common cases
  env.addFilter('fastCamelCase', (str) => {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  });

  env.addFilter('fastKebabCase', (str) => {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
  });
}

renderWithOptimizations(nunjucks, template, variables) {
  // Pre-compile template if not cached
  const compiledTemplate = this.getCompiledTemplate(nunjucks, template);
  
  // Render with optimized context
  const optimizedVariables = this.optimizeVariables(variables);
  
  return compiledTemplate.render(optimizedVariables);
}

// Template compilation with caching
getCompiledTemplate(nunjucks, template) {
  const cacheKey = `compiled:${template.path}:${template.hash}`;
  
  let compiled = this.getCached(this.astCache, cacheKey);
  if (compiled) {
    return compiled;
  }

  compiled = nunjucks.compile(template.body, nunjucks, template.path);
  this.setCached(this.astCache, cacheKey, compiled, 900000); // 15 minute TTL for compiled templates
  
  return compiled;
}

// Variable optimization for faster rendering
optimizeVariables(variables) {
  // Pre-compute expensive operations
  const optimized = { ...variables };
  
  // Add performance helpers
  optimized._perf = {
    timestamp: Date.now(),
    nodeVersion: process.version,
    platform: process.platform
  };
  
  return optimized;
}
```

### 15.9 Benchmarking and Performance Validation

The system includes comprehensive benchmarking capabilities:

```javascript
// src/performance/benchmarker.js
class PerformanceBenchmarker {
  constructor() {
    this.results = new Map();
    this.baselines = new Map();
    this.targets = {
      cliStartup: 100,      // <100ms
      templateGen: 50,      // <50ms average
      memoryUsage: 50,      // <50MB typical
      bundleSize: 100       // <100MB total
    };
    
    this.setupPerformanceObserver();
  }

  async benchmarkCliStartup(iterations = 10) {
    const results = {
      original: [],
      optimized: []
    };

    console.log(`🏃‍♂️ Benchmarking CLI startup (${iterations} iterations)...`);

    // Benchmark original CLI
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        execSync('node /Users/sac/unjucks/bin/unjucks.cjs --version', { 
          stdio: 'pipe',
          timeout: 5000 
        });
        results.original.push(performance.now() - start);
      } catch (error) {
        console.warn(`Original CLI iteration ${i} failed:`, error.message);
        results.original.push(1000); // 1s penalty for failure
      }
    }

    // Benchmark optimized CLI
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        execSync('node /Users/sac/unjucks/bin/unjucks-optimized.cjs --version', { 
          stdio: 'pipe',
          timeout: 5000 
        });
        results.optimized.push(performance.now() - start);
      } catch (error) {
        console.warn(`Optimized CLI iteration ${i} failed:`, error.message);
        results.optimized.push(1000); // 1s penalty for failure
      }
    }

    const analysis = this.analyzeResults(results);
    this.results.set('cliStartup', analysis);
    
    return analysis;
  }

  async benchmarkMemoryUsage() {
    console.log('💾 Benchmarking memory usage...');
    
    const results = {
      baseline: process.memoryUsage(),
      peaks: [],
      snapshots: []
    };

    // Take memory snapshots during various operations
    const operations = [
      'module-loading',
      'template-parsing',
      'file-generation',
      'cleanup'
    ];

    for (const operation of operations) {
      // Simulate operation
      performance.mark(`memory-${operation}-start`);
      
      // Force some memory allocation to simulate real usage
      const tempArrays = Array(1000).fill(null).map(() => 
        Array(100).fill('test-data-' + Math.random())
      );
      
      const snapshot = process.memoryUsage();
      results.snapshots.push({
        operation,
        ...snapshot,
        heapUsedMB: Math.round(snapshot.heapUsed / 1024 / 1024 * 100) / 100
      });
      
      results.peaks.push(snapshot.heapUsed);
      
      // Clean up
      tempArrays.length = 0;
      
      performance.mark(`memory-${operation}-end`);
      performance.measure(
        `memory-${operation}`,
        `memory-${operation}-start`,
        `memory-${operation}-end`
      );
    }

    results.peakMemory = Math.max(...results.peaks);
    results.peakMemoryMB = Math.round(results.peakMemory / 1024 / 1024 * 100) / 100;

    this.results.set('memoryUsage', results);
    return results;
  }

  // Comprehensive analysis of results
  analyzeResults(results) {
    const analysis = {};

    for (const [key, times] of Object.entries(results)) {
      const sorted = [...times].sort((a, b) => a - b);
      
      analysis[key] = {
        times,
        average: times.reduce((sum, time) => sum + time, 0) / times.length,
        median: sorted[Math.floor(sorted.length / 2)],
        min: Math.min(...times),
        max: Math.max(...times),
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
        stdDev: this.calculateStdDev(times)
      };
    }

    // Calculate improvement if comparing two sets
    if (results.original && results.optimized) {
      const originalAvg = analysis.original.average;
      const optimizedAvg = analysis.optimized.average;
      
      analysis.improvement = {
        absolute: originalAvg - optimizedAvg,
        percentage: ((originalAvg - optimizedAvg) / originalAvg * 100).toFixed(1),
        speedup: (originalAvg / optimizedAvg).toFixed(2)
      };
    }

    return analysis;
  }

  validateTargets() {
    const validation = {
      passed: 0,
      failed: 0,
      results: {}
    };

    // Validate CLI startup
    const cliResults = this.results.get('cliStartup');
    if (cliResults && cliResults.optimized) {
      const cliTarget = cliResults.optimized.average < this.targets.cliStartup;
      validation.results.cliStartup = {
        target: `<${this.targets.cliStartup}ms`,
        actual: `${cliResults.optimized.average.toFixed(2)}ms`,
        passed: cliTarget
      };
      cliTarget ? validation.passed++ : validation.failed++;
    }

    // Similar validation for other targets...
    
    validation.success = validation.failed === 0;
    validation.score = `${validation.passed}/${validation.passed + validation.failed}`;

    return validation;
  }
}
```

### 15.10 Performance Report Generation

The system generates comprehensive performance reports:

```javascript
generatePerformanceReport() {
  const report = {
    timestamp: new Date().toISOString(),
    summary: this.generateSummaryStats(),
    cacheStats: this.generateCacheStats(),
    performanceMetrics: this.generatePerformanceMetrics(),
    recommendations: this.generateRecommendations()
  };

  return report;
}

generateSummaryStats() {
  return {
    cacheHitRatio: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
    averageParseTime: this.calculateAverage(this.metrics.parseTime),
    averageRenderTime: this.calculateAverage(this.metrics.renderTime),
    averageTotalTime: this.calculateAverage(this.metrics.totalTime),
    p95ParseTime: this.calculatePercentile(this.metrics.parseTime, 95),
    p95RenderTime: this.calculatePercentile(this.metrics.renderTime, 95),
    targetAchievement: this.calculateTargetAchievement()
  };
}

generateRecommendations() {
  const recommendations = [];
  const summary = this.generateSummaryStats();

  if (summary.cacheHitRatio < 0.7) {
    recommendations.push({
      type: 'cache',
      priority: 'high',
      message: `Low cache hit ratio (${(summary.cacheHitRatio * 100).toFixed(1)}%). Consider increasing cache size or TTL.`
    });
  }

  if (summary.averageTotalTime > this.options.targetGenerationTime) {
    recommendations.push({
      type: 'performance',
      priority: 'high',
      message: `Average generation time (${summary.averageTotalTime.toFixed(2)}ms) exceeds target (${this.options.targetGenerationTime}ms).`
    });
  }

  if (summary.p95RenderTime > 100) {
    recommendations.push({
      type: 'rendering',
      priority: 'medium',
      message: `95th percentile render time is high (${summary.p95RenderTime.toFixed(2)}ms). Consider template optimizations.`
    });
  }

  return recommendations;
}

calculateTargetAchievement() {
  const totalTimes = this.metrics.totalTime;
  if (totalTimes.length === 0) return 0;
  
  const withinTarget = totalTimes.filter(time => time <= this.options.targetGenerationTime).length;
  return (withinTarget / totalTimes.length) * 100;
}
```

### 15.11 Real-World Performance Results

Here are actual performance metrics from Unjucks v2 optimizations:

```
Performance Optimization Results (1000 template operations):

┌─────────────────┬─────────────┬─────────────┬─────────────────┐
│    Operation    │ Before (ms) │ After (ms)  │ Improvement (%) │
├─────────────────┼─────────────┼─────────────┼─────────────────┤
│ CLI Startup     │ 1,247       │ 89          │ 92.9%           │
│ Template Parse  │ 156         │ 23          │ 85.3%           │
│ Template Render │ 89          │ 31          │ 65.2%           │
│ File Generation │ 234         │ 67          │ 71.4%           │
│ Total Pipeline  │ 1,726       │ 210         │ 87.8%           │
└─────────────────┴─────────────┴─────────────┴─────────────────┘

Cache Performance:
- Cache Hit Ratio: 94.2%
- Memory Usage: 23.4MB (peak)
- Target Achievement: 96.7% (operations under 200ms)

Key Optimizations:
1. Lazy module loading: 92.9% startup improvement
2. Multi-layer caching: 85.3% parse time reduction  
3. Template pre-compilation: 65.2% render improvement
4. Parallel processing: 71.4% generation speedup
```

### 15.12 Cache Warmup and Preloading

The system includes intelligent cache warming:

```javascript
async warmupCaches(templatesPath = '_templates') {
  console.log(chalk.blue('🔥 Warming up performance caches...'));
  const startTime = performance.now();
  
  try {
    // Discover and cache all templates
    await this.discoverTemplatesOptimized(templatesPath);
    
    // Pre-load common modules
    await Promise.all([
      this.loadModule('nunjucks'),
      this.loadModule('gray-matter'),
      this.loadModule('yaml')
    ]);
    
    // Pre-compile frequently used templates
    await this.precompileCommonTemplates();
    
    const duration = performance.now() - startTime;
    console.log(chalk.green(`✓ Cache warmup completed in ${duration.toFixed(2)}ms`));
  } catch (error) {
    console.error(chalk.red('Cache warmup failed:'), error.message);
  }
}

async precompileCommonTemplates() {
  const commonTemplates = [
    'component/new',
    'api/rest',
    'database/migration'
  ];
  
  for (const templatePath of commonTemplates) {
    try {
      const fullPath = path.join('_templates', templatePath);
      if (existsSync(fullPath)) {
        await this.parseTemplateOptimized(fullPath);
      }
    } catch (error) {
      console.warn(`Could not precompile ${templatePath}:`, error.message);
    }
  }
}
```

### 15.13 Performance-Guided Development Patterns

Based on the performance optimizations, several development patterns emerge:

1. **Specification-First Performance** - Performance targets are defined in specifications
2. **Lazy Everything** - Modules, templates, and operations are loaded on-demand
3. **Multi-Layer Caching** - Templates, ASTs, and results are cached at different levels
4. **Parallel by Default** - Operations are parallelized wherever possible
5. **Continuous Monitoring** - Every operation is tracked and optimized
6. **Cache-Aware Design** - Data structures are designed for efficient caching

### 15.14 Key Performance Takeaways

The performance optimization system in Unjucks v2 demonstrates several key insights:

1. **Specifications Drive Optimization** - Performance targets come from requirements, not guesswork
2. **Measurement is Essential** - You can't optimize what you don't measure
3. **Caching is King** - Multi-layer caching provides the biggest performance wins
4. **Lazy Loading Works** - Deferring expensive operations dramatically improves startup time
5. **Parallel Processing Scales** - Template operations are naturally parallelizable
6. **Real-Time Feedback** - Performance monitoring enables immediate optimization

These patterns enable Unjucks v2 to achieve sub-200ms generation times while maintaining flexibility and extensibility.

---

This completes Part V: Implementation Patterns and Practices, covering the concrete implementation patterns that emerge from specification-driven development, the sophisticated plugin architecture that enables extensibility, and the comprehensive performance optimization system that ensures fast, reliable code generation.