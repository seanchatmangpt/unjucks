# Frontmatter Parsing and Execution Report

## Executive Summary

This report provides a comprehensive analysis of frontmatter parsing and execution architecture in the codebase. The system implements multiple parser implementations with varying capabilities, sophisticated execution flows for template processing, and extensive integration points across the application.

**Key Findings:**
- **4 Core Parser Implementations** with distinct capabilities and use cases
- **Multiple Execution Flows** supporting deterministic rendering, CLI operations, and document processing
- **6+ Integration Points** connecting frontmatter processing to various subsystems
- **Comprehensive Execution Logic** for injection modes, conditional processing, and file operations

---

## 1. Parser Implementations Analysis

### 1.1 Core Parser Implementations

#### 1.1.1 Deterministic Frontmatter Parser
**Location:** `packages/kgen-core/src/deterministic/frontmatter.js`

**Purpose:** Pure JavaScript parser optimized for deterministic, byte-for-byte identical output.

**Key Features:**
- YAML and JSON frontmatter support
- Deterministic key sorting for consistent output
- Canonical encoding and hash computation
- Template configuration extraction (to, inject, before, after, etc.)
- Built-in validation for frontmatter structure

**Architecture:**
```12:107:packages/kgen-core/src/deterministic/frontmatter.js
class FrontmatterParser {
  constructor(options = {}) {
    this.config = {
      // Deterministic settings
      sortKeys: options.sortKeys !== false,
      canonicalEncoding: options.canonicalEncoding || 'utf8',
      strictMode: options.strictMode !== false,
      
      // Template configuration keys
      reservedKeys: [
        'to', 'inject', 'before', 'after', 'append', 'prepend',
        'lineAt', 'skipIf', 'chmod', 'sh', 'force', 'encoding',
        'minify', 'trimBlocks', 'stripTemporal'
      ],
      
      ...options
    };
    
    this.logger = this._createLogger('kgen-frontmatter-parser');
  }
  
  /**
   * Parse frontmatter from template content
   * @param {string} content - Template content with optional frontmatter
   * @returns {Object} { data, content, metadata }
   */
  parse(content) {
    if (typeof content !== 'string') {
      return {
        data: {},
        content: '',
        metadata: {
          hasFrontmatter: false,
          format: null,
          hash: this._computeHash('')
        }
      };
    }
    
    // Normalize line endings
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Try YAML frontmatter first
    const yamlResult = this._parseYamlFrontmatter(normalizedContent);
    if (yamlResult.hasFrontmatter) {
      return {
        data: this.config.sortKeys ? this._sortKeysRecursive(yamlResult.data) : yamlResult.data,
        content: yamlResult.content,
        metadata: {
          hasFrontmatter: true,
          format: 'yaml',
          hash: this._computeHash(JSON.stringify(yamlResult.data)),
          raw: yamlResult.raw,
          config: this._extractTemplateConfig(yamlResult.data)
        }
      };
    }
    
    // Try JSON frontmatter
    const jsonResult = this._parseJsonFrontmatter(normalizedContent);
    if (jsonResult.hasFrontmatter) {
      return {
        data: this.config.sortKeys ? this._sortKeysRecursive(jsonResult.data) : jsonResult.data,
        content: jsonResult.content,
        metadata: {
          hasFrontmatter: true,
          format: 'json',
          hash: this._computeHash(JSON.stringify(jsonResult.data)),
          raw: jsonResult.raw,
          config: this._extractTemplateConfig(jsonResult.data)
        }
      };
    }
    
    // No frontmatter found
    return {
      data: {},
      content: normalizedContent,
      metadata: {
        hasFrontmatter: false,
        format: null,
        hash: this._computeHash('{}'),
        config: {}
      }
    };
  }
```

**Use Cases:**
- Deterministic template rendering
- Reproducible build systems
- Content-addressed caching

#### 1.1.2 Enhanced Frontmatter Parser (SPARQL/RDF Support)
**Location:** `packages/kgen-core/src/templating/frontmatter.js`

**Purpose:** Enhanced parser with specialized support for SPARQL queries and RDF content in frontmatter.

**Key Features:**
- SPARQL query preprocessing and post-processing
- RDF configuration extraction (turtle, prefixes, knowledge graphs)
- Variable extraction from frontmatter and template body
- Context validation
- Operation mode determination (inject, append, prepend, lineAt)

**Architecture:**
```24:84:packages/kgen-core/src/templating/frontmatter.js
  async parse(templateContent) {
    // Handle empty or whitespace-only content
    if (!templateContent || typeof templateContent !== 'string' || templateContent.trim().length === 0) {
      return {
        frontmatter: {},
        content: templateContent || '',
        hasValidFrontmatter: false
      };
    }

    // Enhanced frontmatter regex that properly handles SPARQL content
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
    const match = templateContent.match(frontmatterRegex);

    if (!match) {
      return {
        frontmatter: {},
        content: templateContent,
        hasValidFrontmatter: false
      };
    }

    try {
      // Pre-process frontmatter to handle SPARQL queries safely
      const processedFrontmatterText = this.preprocessSparqlFrontmatter(match[1]);
      
      const frontmatter = yaml.parse(processedFrontmatterText, {
        keepUndefined: true,
        strict: this.options.strictMode
      }) || {};
      
      // Post-process to restore SPARQL content
      const processedFrontmatter = this.postprocessSparqlFrontmatter(frontmatter);
      const content = match[2].trim();

      const result = {
        frontmatter: processedFrontmatter || {},
        content,
        hasValidFrontmatter: true
      };

      // Validate if enabled
      if (this.options.enableValidation) {
        const validation = this.validate(processedFrontmatter);
        if (!validation.valid) {
          result.validationErrors = validation.errors;
        }
      }

      return result;

    } catch (error) {
      console.warn('Warning: Invalid YAML frontmatter, treating as content:', error.message);
      return {
        frontmatter: {},
        content: templateContent,
        hasValidFrontmatter: false,
        parseError: error.message
      };
    }
  }
```

**Use Cases:**
- Templates with SPARQL queries
- RDF/semantic data processing
- Knowledge graph integration

#### 1.1.3 Document-Specific Frontmatter Processor
**Location:** `packages/kgen-core/src/documents/frontmatter-processor.js`

**Purpose:** Extends base parser with document-specific capabilities for Office documents, LaTeX, and PDF generation.

**Key Features:**
- Document type and mode processing (Word, Excel, PowerPoint, LaTeX, PDF)
- Office document injection points
- LaTeX compilation settings
- Semantic data binding
- Hybrid processing pipeline generation
- Security and compliance settings

**Architecture:**
```61:101:packages/kgen-core/src/documents/frontmatter-processor.js
export class DocumentFrontmatterProcessor extends FrontmatterParser {
  constructor(options = {}) {
    super(options);
    
    this.documentOptions = {
      defaultDocumentType: options.defaultDocumentType || DocumentType.WORD,
      defaultDocumentMode: options.defaultDocumentMode || DocumentMode.TEMPLATE,
      validateInjectionPoints: options.validateInjectionPoints !== false,
      enableSemanticValidation: options.enableSemanticValidation !== false,
      strictValidation: options.strictValidation || false,
      ...options
    };

    // Register document-specific validators
    this.registerDocumentValidators();
  }

  /**
   * Parse document frontmatter with document-specific validation
   * 
   * @param {string} content - Template content with frontmatter
   * @param {boolean} enableSemanticValidation - Enable semantic validation
   * @returns {Promise<Object>} Parsed frontmatter with document metadata
   */
  async parseDocumentFrontmatter(content, enableSemanticValidation = true) {
    // Parse base frontmatter
    const result = await this.parse(content, enableSemanticValidation);
    
    // Process document-specific fields
    const documentMetadata = this.processDocumentFields(result.frontmatter);
    
    // Validate document configuration
    const validation = await this.validateDocumentConfiguration(documentMetadata);
    
    return {
      ...result,
      documentMetadata,
      validation,
      isDocumentTemplate: this.isDocumentTemplate(documentMetadata)
    };
  }
```

**Use Cases:**
- Office document generation
- LaTeX document compilation
- PDF generation workflows
- Hybrid document processing

#### 1.1.4 Advanced Frontmatter Processor (Performance-Optimized)
**Location:** `src/performance/advanced-frontmatter-processor.js`

**Purpose:** High-performance parser with multi-format support (YAML, TOML, JSON) and performance metrics.

**Key Features:**
- Multi-format support (YAML, TOML, JSON)
- Performance caching with TTL
- Performance metrics and health checks
- Target: <5ms parsing for complex frontmatter
- Schema validation

**Architecture:**
```105:153:src/performance/advanced-frontmatter-processor.js
  parseFrontmatter(content, filePath = 'unknown') {
    const startTime = performance.now();
    
    try {
      if (!content || typeof content !== 'string') {
        return { data: {}, content: content || '', format: null };
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(content);
      if (this.enableCaching) {
        const cached = this.getCachedResult(cacheKey);
        if (cached) {
          this.metrics.cacheHits++;
          return cached;
        }
        this.metrics.cacheMisses++;
      }

      const result = this.detectAndParse(content);
      
      // Cache result
      if (this.enableCaching) {
        this.setCachedResult(cacheKey, result);
      }
      
      // Update metrics
      const duration = performance.now() - startTime;
      this.metrics.parseTimes.push(duration);
      
      if (result.format) {
        const count = this.metrics.formatUsage.get(result.format) || 0;
        this.metrics.formatUsage.set(result.format, count + 1);
      }
      
      // Performance warning
      if (duration > 5) {
        console.warn(`⚠️ Frontmatter parsing exceeded 5ms target: ${filePath} (${duration.toFixed(2)}ms)`);
      }
      
      return result;
```

**Use Cases:**
- High-throughput template processing
- Performance-critical applications
- Stress testing and benchmarking

### 1.2 Parser Comparison

| Feature | Deterministic Parser | Enhanced Parser | Document Processor | Advanced Processor |
|---------|---------------------|-----------------|-------------------|-------------------|
| **YAML Support** | ✅ Custom parser | ✅ yaml library | ✅ Inherited | ✅ yaml library |
| **JSON Support** | ✅ | ❌ | ✅ Inherited | ✅ |
| **TOML Support** | ❌ | ❌ | ❌ | ✅ |
| **SPARQL/RDF** | ❌ | ✅ | ❌ | ❌ |
| **Deterministic** | ✅ | ❌ | ❌ | ❌ |
| **Document-Specific** | ❌ | ❌ | ✅ | ❌ |
| **Performance Caching** | ❌ | ❌ | ❌ | ✅ |
| **Performance Metrics** | ❌ | ❌ | ❌ | ✅ |
| **Validation** | ✅ Basic | ✅ Enhanced | ✅ Document-specific | ✅ Schema-based |
| **Variable Extraction** | ❌ | ✅ | ✅ Inherited | ❌ |
| **Operation Mode** | ✅ | ✅ | ✅ Inherited | ❌ |

### 1.3 Parser Architecture Patterns

**Factory Functions:**
- `createFrontmatterParser()` - Creates deterministic parser instances
- `createDocumentFrontmatterProcessor()` - Creates document-specific processors
- Convenience function: `parseFrontmatter()` for one-off parsing

**Inheritance Hierarchy:**
```
FrontmatterParser (base)
  └── DocumentFrontmatterProcessor (extends base)
```

**Design Patterns:**
- **Strategy Pattern**: Different parsers for different formats
- **Template Method**: Base parser with extensible hooks
- **Factory Pattern**: Creation functions for parser instances
- **Singleton-like**: Shared parser instances in workflow engines

---

## 2. Execution Flow Analysis

### 2.1 Deterministic Renderer Flow

**Location:** `src/kgen/deterministic/core-renderer.js`

**Flow:**
1. **Template Loading**: Load template content from filesystem
2. **Frontmatter Parsing**: Extract frontmatter using gray-matter fallback
3. **Context Merging**: Merge frontmatter data with rendering context
4. **Template Rendering**: Render template with enriched context
5. **Post-Processing**: Apply determinism transformations
6. **Caching**: Store result in cache for reproducibility

**Key Implementation:**
```240:305:src/kgen/deterministic/core-renderer.js
  async render(templatePath, context = {}, options = {}) {
    try {
      // Normalize and validate input
      const normalizedContext = this._normalizeContext(context);
      const templateKey = this._getTemplateKey(templatePath, normalizedContext);
      
      // Check cache for existing render
      if (this.config.enableCaching && this.cache.has(templateKey)) {
        this.logger.debug(`Cache hit for template: ${templatePath}`);
        return this.cache.get(templateKey);
      }
      
      // Load and parse template with frontmatter
      const templateContent = await this._loadTemplate(templatePath);
      const { data: frontmatter, content: template } = grayMatter.default(templateContent);
      
      // Merge frontmatter with context
      const enrichedContext = this._mergeContext(normalizedContext, frontmatter);
      
      // Render template
      const rendered = this.environment.renderString(template, enrichedContext);
      
      // Post-process for determinism
      const deterministicOutput = this._postProcessForDeterminism(rendered, options);
      
      // Create render result
      const result = {
        content: deterministicOutput,
        contentHash: crypto.createHash('sha256').update(deterministicOutput).digest('hex'),
        templatePath,
        frontmatter,
        context: enrichedContext,
        renderedAt: this.config.staticBuildTime,
        deterministic: true,
        metadata: {
          templateHash: crypto.createHash('sha256').update(template).digest('hex'),
          contextHash: crypto.createHash('sha256').update(JSON.stringify(enrichedContext)).digest('hex'),
          engineVersion: this._getEngineVersion()
        }
      };
      
      // Cache result
      if (this.config.enableCaching) {
        this.cache.set(templateKey, result);
      }
      
      this.emit('template:rendered', { templatePath, result });
      
      return result;
```

**Context Merging:**
```489:499:src/kgen/deterministic/core-renderer.js
  _mergeContext(context, frontmatter) {
    return {
      ...frontmatter,
      ...context,
      // Ensure deterministic merge order
      __merged: true,
      __mergeHash: crypto.createHash('sha256')
        .update(JSON.stringify({ context, frontmatter }))
        .digest('hex').substring(0, 8)
    };
  }
```

### 2.2 CLI Integration Flow

**Location:** `src/cli/deterministic-integration.js`

**Flow:**
1. **Template Discovery**: Scan templates directory
2. **Template Analysis**: Parse frontmatter and extract variables
3. **Validation**: Validate frontmatter structure
4. **Artifact Generation**: Render and write to output files

**Key Implementation:**
```128:170:src/cli/deterministic-integration.js
  async analyzeTemplate(templatePath) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const { FrontmatterParser } = await import('../../packages/kgen-templates/src/parser/frontmatter.js');

      const content = fs.readFileSync(templatePath, 'utf8');
      const parser = new FrontmatterParser({ debug: this.kgenEngine.debug });
      const { frontmatter, content: templateBody } = parser.parse(content);

      // Extract variables from both frontmatter and template body
      const variables = new Set();
      
      // Extract from frontmatter
      const frontmatterVars = parser.extractVariables(frontmatter);
      frontmatterVars.forEach(v => variables.add(v));
      
      // Extract from template body
      this.extractTemplateVariables(templateBody, variables);

      const stats = fs.statSync(templatePath);

      return {
        name: path.basename(templatePath, path.extname(templatePath)),
        path: templatePath,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        frontmatter,
        variables: Array.from(variables),
        outputFormat: this.inferOutputFormat(frontmatter, templatePath),
        injection: {
          enabled: frontmatter.inject === true,
          mode: this.getInjectionMode(frontmatter),
          target: frontmatter.to
        }
      };
```

### 2.3 Office Processor Flow

**Location:** `packages/kgen-core/src/office/index.js`

**Flow:**
1. **Template Loading**: Load Office document template
2. **Frontmatter Extraction**: Parse frontmatter from document properties or content
3. **Variable Extraction**: Extract variables from template and frontmatter
4. **Data Validation**: Validate data against frontmatter requirements
5. **Document Generation**: Process template with data

**Key Implementation:**
```183:189:packages/kgen-core/src/office/index.js
  // Load template and extract variables
  const template = await documentProcessor.loadTemplate(filePath);
  const frontmatter = await documentProcessor.parseFrontmatter(template);
  const variables = await documentProcessor.extractVariables(template, frontmatter);
  
  // Analyze and return structured variable information
  return documentProcessor.variableExtractor.analyzeVariables(variables, frontmatter);
```

### 2.4 Frontmatter Workflow Engine Flow

**Location:** `src/kgen/core/frontmatter/workflow-engine.js`

**Flow:**
1. **Initialization**: Initialize parser, path resolver, conditional processor, operation engine
2. **Template Processing**:
   - Parse frontmatter
   - Extract metadata
   - Validate schema
   - Evaluate conditional logic (skipIf)
   - Resolve output paths
   - Execute operations (write, inject, append, etc.)
3. **Provenance Tracking**: Track all operations for audit trail

**Key Implementation:**
```131:254:src/kgen/core/frontmatter/workflow-engine.js
  async processTemplate(templateContent, context = {}, options = {}) {
    const operationId = this._generateOperationId();
    
    try {
      this.logger.info(`Starting frontmatter workflow ${operationId}`);
      
      // Start provenance tracking
      const provenanceContext = await this._startProvenance(operationId, {
        type: 'frontmatter_processing',
        templateContent,
        context,
        options,
        timestamp: this.getDeterministicDate()
      });
      
      // Parse frontmatter and extract metadata
      const parseResult = await this.parser.parse(templateContent, this.config.enableSchemaValidation);
      
      if (!parseResult.hasValidFrontmatter && options.requireFrontmatter) {
        throw new Error('Template requires valid frontmatter but none found');
      }
      
      // Extract comprehensive metadata
      const metadata = await this.metadataExtractor.extract(parseResult.frontmatter, {
        templateContent: parseResult.content,
        context,
        operationId,
        provenanceContext
      });
      
      // Validate frontmatter schema if enabled
      if (this.config.enableSchemaValidation && parseResult.hasValidFrontmatter) {
        const schemaValidation = await this.schemaValidator.validate(
          parseResult.frontmatter, 
          options.schema || 'default'
        );
        
        if (!schemaValidation.valid) {
          throw new Error(`Schema validation failed: ${schemaValidation.errors.join(', ')}`);
        }
        
        metadata.schemaValidation = schemaValidation;
      }
      
      // Process conditional logic
      const conditionalResult = await this.conditionalProcessor.evaluate(
        parseResult.frontmatter,
        context,
        {
          operationId,
          provenanceContext,
          metadata
        }
      );
      
      // Check if processing should be skipped
      if (conditionalResult.skip) {
        await this._completeProvenance(operationId, {
          status: 'skipped',
          reason: conditionalResult.reason,
          metadata
        });
        
        this.logger.info(`Template processing skipped: ${conditionalResult.reason}`);
        
        return {
          operationId,
          status: 'skipped',
          reason: conditionalResult.reason,
          metadata,
          artifacts: []
        };
      }
      
      // Resolve output paths dynamically
      const pathResolution = await this.pathResolver.resolve(
        parseResult.frontmatter,
        context,
        {
          operationId,
          metadata,
          deterministic: this.config.deterministic
        }
      );
      
      // Execute template operations
      const operationResult = await this.operationEngine.execute({
        frontmatter: parseResult.frontmatter,
        content: parseResult.content,
        context,
        metadata,
        pathResolution,
        conditionalResult,
        operationId,
        provenanceContext
      });
      
      // Complete provenance tracking
      await this._completeProvenance(operationId, {
        status: 'success',
        operationResult,
        metadata,
        pathResolution,
        conditionalResult,
        parseResult
      });
```

---

## 3. Integration Points

### 3.1 CLI Enhancements
**Location:** `src/cli-enhancements.js`

**Integration Pattern:** Simple frontmatter parsing for basic CLI operations

**Usage:**
```264:282:src/cli-enhancements.js
  parseFrontmatter(templateContent) {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = templateContent.match(frontmatterRegex);
    
    if (!match) {
      return { frontmatter: {}, content: templateContent };
    }
    
    try {
      // Simple YAML parsing for frontmatter
      const yamlContent = match[1];
      const frontmatter = this.parseSimpleYAML(yamlContent);
      const content = match[2];
      
      return { frontmatter, content };
    } catch (error) {
      throw new Error(`Invalid frontmatter: ${error.message}`);
    }
  }
```

### 3.2 Resolver Integration
**Location:** `src/resolver.mjs`

**Integration Pattern:** Frontmatter parsing during template resolution

**Usage:**
```1448:1483:src/resolver.mjs
      // Parse frontmatter if present
      let frontmatter = {};
      let templateBody = templateContent;
      
      if (templateContent.startsWith('---')) {
        // Try to load gray-matter
        if (!matter) {
          matter = await importModule('gray-matter');
        }
        
        if (matter) {
          const parsed = matter.default ? matter.default(templateContent) : matter(templateContent);
          frontmatter = parsed.data;
          templateBody = parsed.content;
        } else {
          // Fallback frontmatter parsing
          const parts = templateContent.split('---');
          if (parts.length >= 3) {
            try {
              frontmatter = JSON.parse(parts[1].trim());
              templateBody = parts.slice(2).join('---');
            } catch (e) {
              // If JSON parsing fails, try simple key-value parsing
              frontmatter = {};
              const lines = parts[1].trim().split('\n');
              for (const line of lines) {
                const match = line.match(/^(\w+):\s*(.+)$/);
                if (match) {
                  frontmatter[match[1]] = match[2].trim();
                }
              }
              templateBody = parts.slice(2).join('---');
            }
          }
        }
      }
```

### 3.3 Workflow Engine Integration
**Location:** `src/kgen/core/frontmatter/workflow-engine.js`

**Integration Pattern:** Comprehensive frontmatter-driven workflow processing

**Components:**
- Parser: `FrontmatterParser`
- Path Resolver: `PathResolver`
- Conditional Processor: `ConditionalProcessor`
- Operation Engine: `OperationEngine`
- Schema Validator: `SchemaValidator`
- Metadata Extractor: `MetadataExtractor`
- Provenance Tracker: `ProvenanceTracker`

### 3.4 Variable Resolution System Integration
**Location:** `src/kgen/integration/variable-resolution-system.js`

**Integration Pattern:** Frontmatter parsing for variable extraction and resolution

**Usage:**
```164:171:src/kgen/integration/variable-resolution-system.js
      // Parse frontmatter
      const parseResult = await this.frontmatterParser.parse(templateContent, true);
      
      // Extract base variables using metadata extractor
      const baseVariables = await this.metadataExtractor.extractVariables(
        parseResult.frontmatter,
        parseResult.content
      );
```

### 3.5 Template Bridge Integration
**Location:** `src/kgen/integration/unjucks-template-bridge.js`

**Integration Pattern:** Frontmatter processing in template discovery and generation

**Usage:**
```321:345:src/kgen/integration/unjucks-template-bridge.js
      // Parse frontmatter and extract metadata
      const parseResult = await this.frontmatterParser.parse(templateContent, true);
      
      // Extract comprehensive metadata
      const metadata = await this.metadataExtractor.extract(parseResult.frontmatter, {
        templateContent: parseResult.content,
        context,
        operationId,
        provenanceContext: options.provenanceContext
      });
      
      // Process through workflow engine if enabled
      if (this.config.enableFrontmatterWorkflow && parseResult.hasValidFrontmatter) {
        const workflowResult = await this.frontmatterWorkflow.processTemplate(
          templateContent,
          context,
          { ...options, operationId }
        );
```

### 3.6 Integration Summary

| Integration Point | Parser Used | Purpose | Complexity |
|-------------------|------------|---------|------------|
| CLI Enhancements | Simple regex parser | Basic CLI operations | Low |
| Resolver | gray-matter with fallback | Template resolution | Medium |
| Workflow Engine | FrontmatterParser | Full workflow processing | High |
| Variable Resolution | FrontmatterParser | Variable extraction | Medium |
| Template Bridge | FrontmatterParser | Template discovery | High |
| Office Processors | Document-specific | Office document processing | High |
| Deterministic Renderer | gray-matter fallback | Deterministic rendering | Medium |

---

## 4. Execution Logic Analysis

### 4.1 Injection Modes

#### 4.1.1 Operation Mode Determination
**Location:** `packages/kgen-core/src/templating/frontmatter.js`

**Implementation:**
```254:278:packages/kgen-core/src/templating/frontmatter.js
  getOperationMode(frontmatter) {
    if (frontmatter.lineAt !== undefined) {
      return { mode: 'lineAt', lineNumber: frontmatter.lineAt };
    }

    if (frontmatter.append) {
      return { mode: 'append' };
    }

    if (frontmatter.prepend) {
      return { mode: 'prepend' };
    }

    if (frontmatter.inject) {
      if (frontmatter.before) {
        return { mode: 'inject', target: frontmatter.before };
      }
      if (frontmatter.after) {
        return { mode: 'inject', target: frontmatter.after };
      }
      return { mode: 'inject' };
    }

    return { mode: 'write' };
  }
```

**Priority Order:**
1. `lineAt` - Highest priority
2. `append` / `prepend` - Second priority
3. `inject` with `before`/`after` - Third priority
4. `inject` (default) - Fourth priority
5. `write` (default) - Lowest priority

#### 4.1.2 Inject Operation Execution
**Location:** `src/kgen/core/frontmatter/operation-engine.js`

**Implementation:**
```490:551:src/kgen/core/frontmatter/operation-engine.js
  async _executeInject(targetPath, content, frontmatter, operationId) {
    if (!await this._fileExists(targetPath)) {
      throw new Error(`Target file does not exist for injection: ${targetPath}`);
    }
    
    let existingContent = await fs.readFile(targetPath, { encoding: this.options.encoding });
    const originalSize = existingContent.length;
    let injected = false;
    let injectionPoint = null;
    
    // Handle before/after markers
    if (frontmatter.before) {
      const beforeIndex = existingContent.indexOf(frontmatter.before);
      if (beforeIndex !== -1) {
        existingContent = existingContent.slice(0, beforeIndex) + 
                         content + this.options.lineEnding +
                         existingContent.slice(beforeIndex);
        injected = true;
        injectionPoint = `before: ${frontmatter.before}`;
      }
    } else if (frontmatter.after) {
      const afterIndex = existingContent.indexOf(frontmatter.after);
      if (afterIndex !== -1) {
        const insertIndex = afterIndex + frontmatter.after.length;
        existingContent = existingContent.slice(0, insertIndex) + 
                         this.options.lineEnding + content +
                         existingContent.slice(insertIndex);
        injected = true;
        injectionPoint = `after: ${frontmatter.after}`;
      }
    } else {
      // Default injection at end of file
      existingContent += this.options.lineEnding + content;
      injected = true;
      injectionPoint = 'end of file';
    }
    
    if (!injected && (frontmatter.before || frontmatter.after)) {
      throw new Error(`Injection marker not found: ${frontmatter.before || frontmatter.after}`);
    }
    
    // Write modified content
    await fs.writeFile(targetPath, existingContent, {
      encoding: this.options.encoding
    });
    
    const stats = await fs.stat(targetPath);
    
    return {
      operationType: 'inject',
      artifacts: [{
        type: 'file',
        path: targetPath,
        size: stats.size,
        originalSize,
        injectionPoint,
        created: false,
        modified: this.getDeterministicDate(),
        operationId
      }]
    };
  }
```

#### 4.1.3 Append/Prepend Operations
**Location:** `src/kgen/core/frontmatter/operation-engine.js`

**Append Implementation:**
```561:599:src/kgen/core/frontmatter/operation-engine.js
  async _executeAppend(targetPath, content, frontmatter, operationId) {
    let existingContent = '';
    let created = false;
    
    if (await this._fileExists(targetPath)) {
      existingContent = await fs.readFile(targetPath, { encoding: this.options.encoding });
    } else {
      created = true;
      // Ensure directory exists
      if (this.options.createDirectories || frontmatter.createDirectories !== false) {
        await this._ensureDirectory(path.dirname(targetPath));
      }
    }
    
    const originalSize = existingContent.length;
    const newContent = existingContent + 
                      (existingContent.length > 0 ? this.options.lineEnding : '') + 
                      content;
    
    await fs.writeFile(targetPath, newContent, {
      encoding: this.options.encoding,
      mode: this.options.defaultFileMode
    });
    
    const stats = await fs.stat(targetPath);
    
    return {
      operationType: 'append',
      artifacts: [{
        type: 'file',
        path: targetPath,
        size: stats.size,
        originalSize,
        created,
        modified: this.getDeterministicDate(),
        operationId
      }]
    };
  }
```

### 4.2 Conditional Execution (skipIf)

#### 4.2.1 skipIf Evaluation
**Location:** `packages/kgen-core/src/templating/frontmatter.js`

**Implementation:**
```283:327:packages/kgen-core/src/templating/frontmatter.js
  shouldSkip(frontmatter, variables) {
    if (!frontmatter.skipIf || typeof frontmatter.skipIf !== 'string' || 
        frontmatter.skipIf.trim().length === 0) {
      return false;
    }

    try {
      const condition = frontmatter.skipIf.trim();

      // Check for simple variable existence: skipIf: "variableName"
      if (variables[condition] !== undefined) {
        return Boolean(variables[condition]);
      }

      // Check for negation: skipIf: "!variableName"
      if (condition.startsWith('!')) {
        const varName = condition.slice(1);
        return !variables[varName];
      }

      // Check for equality: skipIf: "variableName==value"
      const equalityMatch = condition.match(/^(\w+)\s*==\s*(.+)$/);
      if (equalityMatch) {
        const [, varName, value] = equalityMatch;
        const actualValue = variables[varName];
        const expectedValue = value.replace(/^["'](.*)["']$/, '$1');
        return String(actualValue) === expectedValue;
      }

      // Check for inequality: skipIf: "variableName!=value"
      const inequalityMatch = condition.match(/^(\w+)\s*!=\s*(.+)$/);
      if (inequalityMatch) {
        const [, varName, value] = inequalityMatch;
        const actualValue = variables[varName];
        const expectedValue = value.replace(/^["'](.*)["']$/, '$1');
        return String(actualValue) !== expectedValue;
      }

      return false;

    } catch (error) {
      console.warn(`Warning: Error evaluating skipIf condition: ${frontmatter.skipIf}`, error);
      return false;
    }
  }
```

**Supported Patterns:**
1. **Variable Existence**: `skipIf: "variableName"` - Skips if variable is truthy
2. **Negation**: `skipIf: "!variableName"` - Skips if variable is falsy
3. **Equality**: `skipIf: "variableName==value"` - Skips if variable equals value
4. **Inequality**: `skipIf: "variableName!=value"` - Skips if variable doesn't equal value

#### 4.2.2 Conditional Processor
**Location:** `src/kgen/core/frontmatter/conditional-processor.js`

**Advanced Evaluation:**
- Expression caching for deterministic evaluation
- Provenance tracking for conditional decisions
- Complex expression support (future enhancement)

### 4.3 File Operations

#### 4.3.1 chmod Permissions
**Location:** `src/kgen/core/frontmatter/operation-engine.js`

**Implementation:**
```774:779:src/kgen/core/frontmatter/operation-engine.js
  async _setFilePermissions(filePath, chmod) {
    try {
      const mode = typeof chmod === 'string' ? parseInt(chmod, 8) : chmod;
      await fs.chmod(filePath, mode);
```

**Validation:**
```608:626:src/kgen/core/frontmatter/parser.js
  _validateChmod(chmod) {
    if (typeof chmod === 'string') {
      if (!/^[0-7]{3,4}$/.test(chmod)) {
        return {
          valid: false,
          errors: ['chmod string must be octal format (e.g., "755", "0644")']
        };
      }
    } else if (typeof chmod === 'number') {
      if (chmod < 0 || chmod > 0o777) {
        return {
          valid: false,
          errors: ['chmod number must be between 0 and 0o777']
        };
      }
    } else {
      return {
        valid: false,
        errors: ['chmod must be a string or number']
      };
    }
    
    return { valid: true, errors: [] };
  }
```

#### 4.3.2 Shell Command Execution (sh)
**Location:** `src/kgen/core/frontmatter/operation-engine.js`

**Implementation:** Shell commands specified in frontmatter `sh` field are executed after file operations. Security validation is performed to prevent dangerous commands.

#### 4.3.3 Force Flag
**Location:** `src/kgen/core/frontmatter/operation-engine.js`

**Implementation:**
```450:454:src/kgen/core/frontmatter/operation-engine.js
  async _executeWrite(targetPath, content, frontmatter, operationId) {
    // Check if file exists and overwrite is not forced
    if (await this._fileExists(targetPath) && !frontmatter.overwrite && !this.options.enableForceOverwrite) {
      throw new Error(`File already exists and overwrite not enabled: ${targetPath}`);
    }
```

### 4.4 RDF/SPARQL Processing

**Location:** `packages/kgen-core/src/templating/frontmatter.js`

**Special Handling:**
- SPARQL queries are preprocessed to handle YAML parsing safely
- Multiline SPARQL queries use literal block scalars (`|`)
- RDF configuration extraction (turtle, prefixes, knowledge graphs)
- SPARQL syntax validation

**Implementation:**
```89:106:packages/kgen-core/src/templating/frontmatter.js
  preprocessSparqlFrontmatter(frontmatterText) {
    // Handle multiline SPARQL queries using literal block scalar (|)
    return frontmatterText.replace(
      /^(\s*(?:sparql|query|rdf|turtle):\s*)([\s\S]*?)(?=^\s*[a-zA-Z_]|\s*$)/gm,
      (match, header, content) => {
        // If content doesn't start with | or >, add | for literal block
        if (!content.trim().startsWith('|') && !content.trim().startsWith('>')) {
          const trimmedContent = content.trim();
          if (this.isSparqlLikeContent(trimmedContent)) {
            return header + '|\n' + content.split('\n').map(line => 
              line.trim() ? '  ' + line : line
            ).join('\n');
          }
        }
        return match;
      }
    );
  }
```

### 4.5 Document Processing

**Location:** `packages/kgen-core/src/documents/frontmatter-processor.js`

**Document-Specific Features:**
- Office document injection points (bookmarks, tables, paragraphs, cells)
- LaTeX compilation settings (compiler, packages, bibliography)
- PDF generation options (quality, compression, metadata)
- Semantic bindings for knowledge graph integration
- Hybrid processing pipelines

---

## 5. Code Quality and Patterns

### 5.1 Parser Design Patterns

**Factory Functions:**
- `createFrontmatterParser(options)` - Creates deterministic parser
- `createDocumentFrontmatterProcessor(options)` - Creates document processor
- `parseFrontmatter(content, options)` - Convenience function

**Class Hierarchies:**
- Base `FrontmatterParser` class
- `DocumentFrontmatterProcessor` extends base parser
- Specialized processors for different use cases

### 5.2 Error Handling

**Validation Strategies:**
- **Strict Mode**: Throws errors on invalid frontmatter
- **Lenient Mode**: Returns warnings, continues processing
- **Error Recovery**: Fallback parsing when primary parser fails

**Error Types:**
- Parse errors (invalid YAML/JSON)
- Validation errors (invalid structure)
- Execution errors (file operations, injection failures)

### 5.3 Determinism Features

**Key Sorting:**
```301:318:packages/kgen-core/src/deterministic/frontmatter.js
  _sortKeysRecursive(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._sortKeysRecursive(item));
    }
    
    const sorted = {};
    const keys = Object.keys(obj).sort();
    
    for (const key of keys) {
      sorted[key] = this._sortKeysRecursive(obj[key]);
    }
    
    return sorted;
  }
```

**Hash Computation:**
```323:326:packages/kgen-core/src/deterministic/frontmatter.js
  _computeHash(input) {
    const canonical = typeof input === 'string' ? input.trim() : JSON.stringify(input);
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }
```

**Canonical Encoding:**
- UTF-8 encoding normalization
- Line ending normalization (CRLF → LF)
- Whitespace trimming

### 5.4 Performance Optimizations

**Caching:**
- Parse result caching (Advanced Processor)
- Expression evaluation caching (Conditional Processor)
- Template content caching (Deterministic Renderer)

**Lazy Loading:**
- Parser instantiation on demand
- Component initialization deferred until use

**Batch Processing:**
- Concurrent template processing
- Batch frontmatter validation

---

## 6. Summary and Recommendations

### 6.1 Architecture Strengths

1. **Multiple Parser Implementations**: Different parsers optimized for different use cases
2. **Comprehensive Execution Logic**: Support for various injection modes and conditional processing
3. **Extensive Integration**: Frontmatter processing integrated throughout the application
4. **Determinism Support**: Built-in support for reproducible builds
5. **Document-Specific Processing**: Specialized handling for Office documents and LaTeX

### 6.2 Areas for Improvement

1. **Parser Consolidation**: Consider consolidating similar parsers to reduce maintenance burden
2. **Standardization**: Standardize on a single parser API across all integration points
3. **Error Handling**: Improve error recovery strategies across all parsers
4. **Performance**: Add performance metrics to all parsers, not just Advanced Processor
5. **Documentation**: Enhance inline documentation for complex execution flows

### 6.3 Recommendations

1. **Create Parser Registry**: Implement a registry pattern for parser selection based on use case
2. **Unify Parser Interface**: Define a common interface that all parsers implement
3. **Enhance Testing**: Add comprehensive integration tests for all execution flows
4. **Performance Monitoring**: Add performance monitoring to all parser implementations
5. **Security Hardening**: Enhance security validation for shell command execution

---

## Appendix: Code References

### Parser Implementations
- Deterministic Parser: `packages/kgen-core/src/deterministic/frontmatter.js`
- Enhanced Parser: `packages/kgen-core/src/templating/frontmatter.js`
- Document Processor: `packages/kgen-core/src/documents/frontmatter-processor.js`
- Advanced Processor: `src/performance/advanced-frontmatter-processor.js`

### Execution Flows
- Deterministic Renderer: `src/kgen/deterministic/core-renderer.js`
- CLI Integration: `src/cli/deterministic-integration.js`
- Office Processors: `packages/kgen-core/src/office/index.js`
- Workflow Engine: `src/kgen/core/frontmatter/workflow-engine.js`

### Integration Points
- CLI Enhancements: `src/cli-enhancements.js`
- Resolver: `src/resolver.mjs`
- Variable Resolution: `src/kgen/integration/variable-resolution-system.js`
- Template Bridge: `src/kgen/integration/unjucks-template-bridge.js`

### Execution Logic
- Operation Engine: `src/kgen/core/frontmatter/operation-engine.js`
- Conditional Processor: `src/kgen/core/frontmatter/conditional-processor.js`
- Path Resolver: `src/kgen/core/frontmatter/path-resolver.js`

---

**Report Generated:** 2025-01-12  
**Codebase Version:** Current  
**Analysis Scope:** Frontmatter parsing and execution (excluding template files)

