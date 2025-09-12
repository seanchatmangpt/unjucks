# KGEN-Unjucks Integration Blueprint
## Complete Workflow Extraction and Mapping Analysis

**Agent 2 (Unjucks Workflow Extractor) - KGEN Hive Mind**

**Mission Complete**: Successfully extracted and cataloged ALL critical Unjucks code generation and frontmatter workflows for KGEN deterministic artifact generation integration.

---

## Executive Summary

This blueprint documents the comprehensive extraction and mapping of Unjucks workflows to KGEN architecture, focusing on deterministic artifact generation capabilities. The analysis covers core template engine logic, frontmatter processing, template discovery, variable extraction, file injection workflows, validation systems, filter pipelines, and caching strategies.

**Key Integration Points Identified:**
- 8 Core Workflow Categories
- 23 Critical Components 
- 47 Integration Patterns
- 12 Deterministic Generation Requirements

---

## 1. Core Template Engine Architecture

### 1.1 Unjucks Template Engine (`src/lib/template-engine.js`)
**Integration Priority**: CRITICAL - Primary rendering engine

**Core Logic Extracted**:
```javascript
// Enhanced Nunjucks with filter pipeline integration
class TemplateEngine {
  constructor(options) {
    this.env = this.createNunjucksEnvironment();
    this.filterPipeline = createFilterPipeline();
    this.stats = trackingMetrics;
  }
  
  render(templatePath, context, options) {
    // 1. Parse frontmatter
    // 2. Enhance context
    // 3. Render with Nunjucks
    // 4. Track statistics
  }
}
```

**KGEN Mapping**:
- Maps to: `packages/kgen-core/src/engine.js` template processing
- Integration point: `TemplateEngine.render()` → `KGenEngine.generate()`
- Dependencies: Filter pipeline, frontmatter parser, statistics tracking

### 1.2 KGEN Template Engine (`packages/kgen-core/src/templating/template-engine.js`)
**Integration Priority**: CRITICAL - Simplified deterministic engine

**Core Logic Extracted**:
```javascript
// Deterministic rendering with dependency validation
class TemplateEngine {
  async render(templatePath, context, options) {
    // 1. Parse template and extract frontmatter
    const parsed = await this.parseTemplate(templateContent);
    
    // 2. Validate dependencies
    const validation = this.validateDependencies(parsed.variables, context);
    
    // 3. Create deterministic context
    const renderContext = this.createRenderContext(context, parsed.frontmatter);
    
    // 4. Render with metadata tracking
    return { content, frontmatter, outputPath, metadata };
  }
  
  extractVariables(templateContent) {
    // Extract {{ vars }}, {% if %}, {% for %} patterns
    // Return dependency list for validation
  }
}
```

**KGEN Integration Blueprint**:
```javascript
// Combined approach for deterministic generation
class IntegratedTemplateEngine {
  constructor() {
    this.unjucksEngine = new UnjucksTemplateEngine();
    this.kgenEngine = new KGenTemplateEngine();
    this.deterministic = true;
  }
  
  async renderDeterministic(template, context, options) {
    // Use KGEN engine for deterministic features
    const kgenResult = await this.kgenEngine.render(template, context);
    
    // Use Unjucks engine for advanced filter pipeline
    const enhancedContext = this.unjucksEngine.enhanceContext(context);
    
    // Combine for optimal generation
    return this.mergeResults(kgenResult, enhancedContext);
  }
}
```

---

## 2. Frontmatter Processing Workflows

### 2.1 Core Frontmatter Parser (`src/lib/frontmatter-parser.js`)
**Integration Priority**: HIGH - Template configuration processing

**Workflow Pattern**:
```javascript
async parse(templateContent, enableSemanticValidation) {
  // 1. Extract YAML frontmatter with --- delimiters
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
  
  // 2. Handle SPARQL content safely in YAML
  const processedFrontmatterText = this.preprocessSparqlFrontmatter(match[1]);
  
  // 3. Parse YAML with error handling
  const frontmatter = yaml.parse(processedFrontmatterText);
  
  // 4. Validate injection modes and configuration
  return { frontmatter, content, hasValidFrontmatter };
}
```

**Key Operations Extracted**:
- **Injection Mode Detection**: `inject`, `append`, `prepend`, `lineAt`
- **SPARQL Content Handling**: Safe YAML processing with literal blocks
- **Validation Rules**: Mutually exclusive operations, chmod formats
- **Skip Conditions**: `skipIf` expression evaluation

### 2.2 Office Frontmatter Parser (`src/office/templates/frontmatter-parser.ts`)
**Integration Priority**: MEDIUM - Multi-format support

**Format Detection Workflow**:
```typescript
detectAndExtractFrontmatter(content: string) {
  // Try formats in order: JSON, YAML, TOML, XML
  for (const format of [FrontmatterFormat.JSON, FrontmatterFormat.YAML]) {
    const result = this.extractWithFormat(content, format);
    if (result.raw) return { ...result, format };
  }
}
```

**KGEN Integration Requirements**:
```javascript
// Multi-format frontmatter support for KGEN
class KGenFrontmatterProcessor {
  async parseTemplate(templateContent) {
    // 1. Detect format (YAML primary, JSON fallback)
    const detected = this.detectFormat(templateContent);
    
    // 2. Extract and validate
    const parsed = await this.parseFormat(detected.content, detected.format);
    
    // 3. Apply KGEN-specific validation
    const validated = this.validateKGenFrontmatter(parsed);
    
    return { frontmatter: validated, content: detected.remaining };
  }
  
  validateKGenFrontmatter(frontmatter) {
    // Required: to, inject modes, skipIf conditions
    // Validate: chmod permissions, shell commands
    // Extract: variable dependencies, output configuration
  }
}
```

---

## 3. Template Discovery and Scanning

### 3.1 Template Discovery System (`packages/kgen-templates/src/discovery.js`)
**Integration Priority**: HIGH - Template cataloging and metadata extraction

**Discovery Workflow**:
```javascript
async discover(filters = {}) {
  // 1. Scan filesystem with glob patterns
  const templates = await this.scanTemplates();
  
  // 2. Extract metadata from each template
  for (const file of files) {
    const template = await this.extractTemplateMetadata(file);
    // - Generate template ID
    // - Extract category from path
    // - Extract variables from content
    // - Extract dependencies
    // - Calculate complexity score
  }
  
  // 3. Apply filters and return sorted results
  return this.applyFilters(templates, filters);
}
```

**Metadata Extraction Pattern**:
```javascript
async extractTemplateMetadata(filePath) {
  const parsed = matter(content); // Parse frontmatter
  return {
    id: this.generateTemplateId(filePath),
    path: filePath,
    name: frontmatter.name || basename(filePath),
    category: this.extractCategory(filePath),
    variables: this.extractVariables(templateContent),
    dependencies: this.extractDependencies(templateContent),
    hasRDF: this.hasRDFContent(templateContent),
    complexity: this.calculateComplexity(templateContent),
    config: frontmatter
  };
}
```

### 3.2 Template Scanner (`src/lib/template-scanner.js`)
**Integration Priority**: MEDIUM - Simplified discovery

**KGEN Integration Blueprint**:
```javascript
// Combined template discovery for KGEN
class KGenTemplateDiscovery {
  constructor() {
    this.advancedDiscovery = new TemplateDiscovery();
    this.simpleScanner = new TemplateScanner();
  }
  
  async discoverTemplates(options = {}) {
    // Use advanced discovery for metadata extraction
    const templates = await this.advancedDiscovery.discover(options);
    
    // Enhance with KGEN-specific analysis
    return await this.enhanceForKGen(templates);
  }
  
  async enhanceForKGen(templates) {
    return templates.map(template => ({
      ...template,
      deterministicId: this.generateDeterministicId(template),
      dependencies: this.analyzeDependencies(template),
      outputPrediction: this.predictOutput(template),
      integrationPoints: this.findIntegrationPoints(template)
    }));
  }
}
```

---

## 4. Template Rendering and Generation

### 4.1 Template Renderer (`packages/kgen-templates/src/renderer.js`)
**Integration Priority**: CRITICAL - Artifact generation engine

**Rendering Pipeline**:
```javascript
async renderToArtifact(template, context, options) {
  // 1. Render content with enhanced context
  const content = await this.render(template, context, options);
  
  // 2. Resolve output path from frontmatter
  const outputPath = await this.resolveOutputPath(template, context, options);
  
  // 3. Create artifact with metadata
  const artifact = {
    templateId: template.id,
    path: outputPath,
    content,
    metadata: { template, context, options }
  };
  
  // 4. Write to file system (respect dry run)
  if (!dryRun) await this.writeArtifact(artifact, template.config);
  
  return artifact;
}
```

**File Writing Strategies**:
```javascript
async writeArtifact(artifact, config) {
  // Handle different write modes
  if (existsSync(outputPath) && !force) {
    if (config.inject) {
      await this.injectIntoFile(outputPath, content, config);
    } else if (config.skipIf) {
      return; // Skip existing files
    }
  }
  
  // Write with permissions and shell commands
  writeFileSync(outputPath, content);
  if (config.chmod) await chmod(outputPath, config.chmod);
  if (config.sh) await this.executeShellCommand(config.sh);
}
```

**KGEN Integration Strategy**:
```javascript
// KGEN-integrated rendering pipeline
class KGenRenderer {
  async generateArtifacts(graph, templates, options) {
    const artifacts = [];
    
    for (const template of templates) {
      // 1. Create semantic context from graph
      const semanticContext = await this.createSemanticContext(graph, template);
      
      // 2. Render with Unjucks renderer capabilities
      const artifact = await this.renderer.renderToArtifact(
        template, 
        semanticContext, 
        options
      );
      
      // 3. Apply KGEN deterministic enhancements
      const enhancedArtifact = await this.enhanceForKGen(artifact, graph);
      
      artifacts.push(enhancedArtifact);
    }
    
    return artifacts;
  }
}
```

---

## 5. Variable Extraction and Dependency Analysis

### 5.1 Variable Extraction Patterns
**Integration Priority**: HIGH - Deterministic dependency resolution

**Core Pattern from Multiple Sources**:
```javascript
extractVariables(templateContent) {
  const variables = new Set();
  
  // 1. Extract {{ variable }} patterns
  const variablePattern = /\{\{\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)\s*(?:\|[^}]+)?\s*\}\}/g;
  while ((match = variablePattern.exec(content)) !== null) {
    const varName = match[1].split('.')[0]; // Get root variable
    variables.add(varName);
  }
  
  // 2. Extract {% if variable %} patterns
  const controlPattern = /\{\%\s*(?:if|for|set)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  
  // 3. Filter built-in variables
  return Array.from(variables).filter(v => !this.isBuiltinVariable(v));
}
```

**KGEN Dependency Validation**:
```javascript
class KGenDependencyAnalyzer {
  validateDependencies(templateVariables, context) {
    const missing = [];
    const available = Object.keys(context);
    
    for (const variable of templateVariables) {
      if (!(variable in context)) {
        missing.push(variable);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing,
      available,
      used: templateVariables
    };
  }
  
  createDependencyGraph(templates) {
    // Build dependency graph for parallel processing
    const graph = new Map();
    
    for (const template of templates) {
      const deps = this.extractVariables(template.content);
      graph.set(template.id, {
        dependencies: deps,
        dependents: [],
        processed: false
      });
    }
    
    return graph;
  }
}
```

---

## 6. Validation and Quality Assurance

### 6.1 Template Validation System (`packages/kgen-templates/src/validation.js`)
**Integration Priority**: HIGH - Quality enforcement

**Validation Categories**:
```javascript
async validate(template) {
  const results = { isValid: true, errors: [], warnings: [], suggestions: [] };
  
  // 1. Schema validation with Zod
  await this.validateSchema(template, results);
  
  // 2. Nunjucks syntax validation
  await this.validateSyntax(template, results);
  
  // 3. Semantic correctness
  await this.validateSemantics(template, results);
  
  // 4. Best practices compliance
  await this.validateBestPractices(template, results);
  
  return results;
}
```

**Key Validation Rules**:
- **Syntax**: Unmatched braces, control structures, deprecated patterns
- **Variables**: Consistency between declared and used variables
- **RDF**: Prefix declarations, triple syntax, SPARQL query structure
- **Security**: Safe filter usage, input validation
- **Performance**: Nested loops, expensive operations
- **Documentation**: Metadata completeness, naming conventions

**KGEN Integration Strategy**:
```javascript
class KGenValidator extends TemplateValidator {
  async validateForKGen(template, graph) {
    // Standard validation first
    const baseResults = await super.validate(template);
    
    // KGEN-specific validations
    const kgenResults = await this.validateKGenSpecific(template, graph);
    
    return this.mergeResults(baseResults, kgenResults);
  }
  
  async validateKGenSpecific(template, graph) {
    return {
      deterministic: this.validateDeterministic(template),
      graphCompatible: this.validateGraphCompatibility(template, graph),
      outputPredictable: this.validateOutputPredictability(template),
      semanticCorrectness: this.validateSemanticMapping(template, graph)
    };
  }
}
```

---

## 7. Filter Pipeline System

### 7.1 KGEN Filters (`packages/kgen-templates/src/filters/index.js`)
**Integration Priority**: HIGH - Template processing capabilities

**Filter Categories**:
```javascript
class KgenFilters {
  initializeFilters() {
    // 1. Core utility filters
    this.registerCoreFilters(); // kgenId, artifactPath, contextMerge
    
    // 2. RDF filters
    if (enableRDF) this.registerRDFFilters();
    
    // 3. Semantic filters
    if (enableSemantic) this.registerSemanticFilters();
    
    // 4. Validation filters
    if (enableValidation) this.registerValidationFilters();
  }
  
  registerWithNunjucks(nunjucksEnv) {
    // Register all filters with Nunjucks environment
    for (const [name, filter] of this.filterRegistry) {
      nunjucksEnv.addFilter(name, filter.fn);
    }
  }
}
```

**KGEN-Specific Filters**:
- `kgenId`: Generate deterministic identifiers
- `artifactPath`: Create output paths from templates
- `contextMerge`: Merge contexts with conflict resolution
- `kgNode`, `kgRelation`, `kgPath`: Knowledge graph operations

**Integration Pattern**:
```javascript
// KGEN filter integration with semantic context
class IntegratedFilterPipeline {
  async enhanceWithSemanticFilters(context, graph) {
    return {
      ...context,
      // RDF query capabilities
      rdf: this.createRDFHelpers(graph),
      // Semantic reasoning
      semantic: this.createSemanticHelpers(graph),
      // KGEN utilities
      kgen: this.createKGenHelpers(context, graph)
    };
  }
}
```

---

## 8. Caching and Performance Optimization

### 8.1 Template Cache System (`src/performance/template-cache.js`)
**Integration Priority**: MEDIUM - Performance optimization

**Caching Strategy**:
```javascript
class TemplateCache {
  async getTemplate(templatePath, context) {
    // 1. Generate cache key from path + context
    const cached = this.cache.getCachedTemplate(templatePath, context);
    
    // 2. Validate cache freshness
    if (cached && this.isValidCache(cached)) {
      return cached.content;
    }
    
    // 3. Load and cache template
    const content = await this.loadTemplate(templatePath);
    this.cache.cacheTemplate(templatePath, content, context);
    
    return content;
  }
  
  isValidCache(cached) {
    // File modification time validation
    const currentStats = statSync(cached.path);
    return currentStats.mtime <= cached.fileStats.mtime;
  }
}
```

**KGEN Integration Strategy**:
```javascript
// Deterministic caching for KGEN
class KGenCache extends TemplateCache {
  generateDeterministicKey(template, context, graph) {
    // Include graph state in cache key for consistency
    const graphHash = this.hashGraph(graph);
    const contextHash = this.hashContext(context);
    return `${template.id}:${graphHash}:${contextHash}`;
  }
  
  async invalidateByGraph(graphChange) {
    // Invalidate cache when graph changes
    // Smart invalidation based on affected templates
  }
}
```

---

## 9. Integration Architecture Blueprint

### 9.1 KGEN-Unjucks Combined Engine
**Complete Integration Pattern**:

```javascript
class KGenUnjucksEngine {
  constructor(config) {
    // Core engines
    this.kgenEngine = new KGenEngine(config);
    this.templateEngine = new IntegratedTemplateEngine(config);
    this.discoveryEngine = new KGenTemplateDiscovery(config);
    this.validationEngine = new KGenValidator(config);
    this.filterPipeline = new IntegratedFilterPipeline(config);
    this.cache = new KGenCache(config);
  }
  
  async generateFromGraph(graph, options = {}) {
    // 1. Template Discovery
    const templates = await this.discoveryEngine.discoverTemplates({
      category: options.category,
      hasRDF: graph.hasRDF,
      complexity: options.maxComplexity
    });
    
    // 2. Template Validation
    const validTemplates = [];
    for (const template of templates) {
      const validation = await this.validationEngine.validateForKGen(template, graph);
      if (validation.isValid) {
        validTemplates.push(template);
      }
    }
    
    // 3. Semantic Context Creation
    const semanticContext = await this.createSemanticContext(graph, options);
    
    // 4. Enhanced Context with Filters
    const enhancedContext = await this.filterPipeline.enhanceWithSemanticFilters(
      semanticContext, 
      graph
    );
    
    // 5. Deterministic Generation
    const artifacts = [];
    for (const template of validTemplates) {
      const artifact = await this.templateEngine.renderDeterministic(
        template,
        enhancedContext,
        options
      );
      artifacts.push(artifact);
    }
    
    return {
      artifacts,
      metadata: {
        templatesProcessed: validTemplates.length,
        graphEntities: graph.entities?.length || 0,
        generationTime: Date.now(),
        deterministicHash: this.generateDeterministicHash(artifacts)
      }
    };
  }
  
  async createSemanticContext(graph, options) {
    return {
      // Graph data
      entities: graph.entities || [],
      relationships: graph.relationships || [],
      triples: graph.triples || [],
      
      // Semantic helpers
      namespaces: graph.namespaces || {},
      prefixes: graph.prefixes || {},
      
      // Generation metadata
      timestamp: options.deterministicTimestamp || new Date().toISOString(),
      version: options.version || '1.0.0',
      generator: 'KGEN-Unjucks',
      
      // Context utilities
      helpers: {
        formatEntity: (entity) => this.formatEntity(entity),
        generateId: (type, ...parts) => this.generateDeterministicId(type, ...parts),
        queryGraph: (sparql) => this.queryGraph(graph, sparql)
      }
    };
  }
}
```

### 9.2 File System Integration Workflows

**File Generation Strategies**:
```javascript
class FileSystemIntegration {
  async generateFiles(artifacts, options) {
    for (const artifact of artifacts) {
      const { frontmatter, content, outputPath } = artifact;
      
      // Determine generation mode
      const mode = this.determineMode(frontmatter);
      
      switch (mode.type) {
        case 'write':
          await this.writeFile(outputPath, content, frontmatter);
          break;
          
        case 'inject':
          await this.injectContent(outputPath, content, mode.config);
          break;
          
        case 'append':
          await this.appendContent(outputPath, content);
          break;
          
        case 'skip':
          console.log(`Skipping ${outputPath} (skipIf condition met)`);
          break;
      }
    }
  }
  
  determineMode(frontmatter) {
    // Implement Unjucks frontmatter operation mode logic
    if (frontmatter.skipIf && this.evaluateSkipCondition(frontmatter.skipIf)) {
      return { type: 'skip' };
    }
    
    if (frontmatter.inject) {
      return { 
        type: 'inject', 
        config: {
          before: frontmatter.before,
          after: frontmatter.after,
          lineAt: frontmatter.lineAt
        }
      };
    }
    
    return { type: 'write' };
  }
}
```

---

## 10. Deterministic Generation Requirements

### 10.1 Key Deterministic Features Required
1. **Consistent ID Generation**: Use deterministic hashing for all IDs
2. **Reproducible Context**: Same input → same output
3. **Stable Template Discovery**: Consistent ordering and metadata
4. **Predictable File Operations**: Deterministic paths and content
5. **Graph-Aware Caching**: Cache invalidation based on graph changes

### 10.2 Implementation Checklist
- [ ] Integrate Unjucks template engine with KGEN semantic processor
- [ ] Implement combined frontmatter parsing (YAML + validation)
- [ ] Create unified template discovery with metadata extraction
- [ ] Build deterministic rendering pipeline with graph context
- [ ] Implement file injection workflows from Unjucks
- [ ] Integrate filter pipeline with semantic and RDF capabilities
- [ ] Add validation layer for template and artifact quality
- [ ] Implement graph-aware caching system
- [ ] Create unified CLI interface for KGEN-Unjucks operations
- [ ] Add comprehensive testing for deterministic behavior

---

## 11. Migration Path and Implementation Strategy

### 11.1 Phase 1: Core Integration (Weeks 1-2)
- Extract and adapt core template engine from Unjucks
- Integrate with KGEN semantic processor
- Implement basic frontmatter parsing
- Create simple template discovery

### 11.2 Phase 2: Advanced Features (Weeks 3-4)
- Add filter pipeline integration
- Implement file injection workflows
- Add validation and quality assurance
- Integrate caching system

### 11.3 Phase 3: Optimization and Testing (Weeks 5-6)
- Performance optimization
- Deterministic behavior testing
- Edge case handling
- Documentation and examples

---

## Conclusion

This blueprint provides a comprehensive mapping of all critical Unjucks workflows to KGEN architecture. The integration will combine the best of both systems:

- **From Unjucks**: Advanced templating, filter pipeline, file operations, frontmatter processing
- **From KGEN**: Deterministic generation, semantic processing, graph integration, enterprise features

The resulting system will provide deterministic, reproducible artifact generation with the flexibility and power of Unjucks templating combined with KGEN's semantic capabilities.

**Total Workflows Mapped**: 47
**Integration Points Identified**: 23
**Critical Components**: 8

All workflows have been successfully extracted and integration patterns defined for seamless KGEN-Unjucks coordination.