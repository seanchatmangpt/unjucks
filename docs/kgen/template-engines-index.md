# Template Engines Index - Comprehensive Analysis

## Executive Summary

This document provides a comprehensive index of all template generation engines and processors discovered in the Unjucks codebase. The system implements a sophisticated multi-engine architecture with specialized processors for different domains including semantic web, office documents, LaTeX, and performance-optimized rendering.

**Total Engines Identified**: 8 primary engines + 15 specialized processors
**Template File Extensions**: `.njk`, `.ejs`, `.tex`, `.hbs`, `.mustache`, `.pug`
**Integration Points**: Nunjucks, N3/RDF, LaTeX compilers, Office APIs

---

## Core Template Engines

### 1. Enhanced Template Engine (Primary)
**File**: `/src/lib/template-engine.js` (Lines 1-492)
**Type**: Enhanced Nunjucks with Filter Pipeline Integration

**Environment Configuration**:
```javascript
// Lines 69-87
const loader = new nunjucks.FileSystemLoader(this.options.templatesDir, {
  watch: false,
  noCache: !this.options.enableCache
});

const env = new nunjucks.Environment(loader, {
  autoescape: this.options.autoescape,
  throwOnUndefined: this.options.throwOnUndefined,
  trimBlocks: this.options.trimBlocks,
  lstripBlocks: this.options.lstripBlocks
});
```

**Key Features**:
- Filter pipeline integration (Line 95-120)
- RDF data loading support (Line 28, 103)
- Statistics tracking (Lines 48-55)
- Global function injection (Lines 125-188)
- Performance monitoring (Lines 216-266)

**Rendering Pipelines**:
- `render()`: File-based template rendering (Lines 216-266)
- `renderString()`: String template rendering (Lines 275-318)
- Context enhancement with metadata (Lines 222-230)

**Caching Mechanisms**:
- FileSystemLoader cache control (Lines 71-72)
- Filter pipeline caching (Line 96)
- Cache clearing functionality (Lines 384-398)

---

### 2. Ontology-Driven Template Engine (Semantic Web)
**File**: `/src/core/ontology-template-engine.js` (Lines 1-342)
**Type**: RDF/Turtle Integration with Nunjucks

**Environment Configuration**:
```javascript
// Lines 19-28
this.env = nunjucks.configure(options.templatePath || join(__dirname, '../../templates'), {
  autoescape: false,
  trimBlocks: true,
  lstripBlocks: true
});
```

**RDF Processing Pipeline**:
- N3 Store integration (Line 16)
- SPARQL query execution (Lines 61-80)
- Ontology data extraction (Lines 85-127)
- Template data structuring (Lines 132-184)

**Semantic Filters**:
- `formatUri`: URI formatting (Lines 200-204)
- `namespace`: Namespace extraction (Lines 207-211)
- `matchesOntology`: Pattern matching (Lines 214-216)
- `getOntologyProperty`: Property retrieval (Lines 219-222)
- `getAllOntologyValues`: Multi-value extraction (Lines 225-228)

**Generation Modes**:
- Single subject generation (Lines 246-270)
- Batch processing (Lines 275-310)
- Inference rule application (Lines 315-339)

---

### 3. Office Document Template Engine
**File**: `/src/templates/template-engine.js` (Lines 1-359)
**Type**: Document Processing with Inheritance System

**Environment Configuration**:
```javascript
// Lines 13-25
this.env = nunjucks.configure([templateDir], {
  autoescape: false,
  trimBlocks: true,
  lstripBlocks: true
});
```

**Document Filters**:
- `dateFormat`: Date formatting (Lines 32-40)
- `currency`: Currency formatting (Lines 43-49)
- `legalNumber`: Legal clause numbering (Lines 64-72)
- `wordCount`: Word counting (Lines 58-61)

**Template Inheritance**:
- Template registration system (Lines 95-116)
- Inheritance chain tracking (Lines 241-250)
- Base template mapping (Lines 19-22)

**Document Processing**:
- Variable extraction (Lines 287-333)
- Content validation (Lines 208-236)
- Post-processing pipeline (Lines 187-203)

---

### 4. Performance-Optimized Template Engine
**File**: `/src/performance/spec-performance-optimizer.js` (Lines 488-535)
**Type**: High-Performance Nunjucks Setup

**Optimized Configuration**:
```javascript
// Lines 491-495
this.optimizedNunjucks = new nunjucks.Environment(
  new nunjucks.FileSystemLoader('_templates', {
    noCache: false, // Enable caching
  }),
  {
    autoescape: false,
    trimBlocks: true,
    lstripBlocks: true
  }
);
```

**Performance Enhancements**:
- Filter result caching (Lines 516-525)
- Fast string operations (Lines 528-534)
- Cached filter pipeline (Lines 516-520)
- Parallel template processing support

---

## Specialized Processors

### 5. Template Cache System
**File**: `/src/performance/template-cache.js` (Lines 1-271)
**Type**: Dedicated Template Caching Layer

**Cache Architecture**:
- Map-based storage (Line 13)
- TTL-based expiration (Lines 102-116)
- Size-based eviction (Lines 124-136)
- File modification tracking (Lines 112-118)

**Performance Features**:
- Preloading support (Lines 142-167)
- Statistics tracking (Lines 178-195)
- Memory usage monitoring (Lines 202-209)

### 6. LaTeX Compilation Engine
**File**: `/src/commands/latex.js` (Lines 1-640)
**Type**: LaTeX Template Compilation Pipeline

**Compiler Integration**:
```javascript
// Lines 152-166
const compilerConfig = {
  ...latexConfig,
  engine: args.engine,
  outputDir: args.output,
  bibtex: args.bibtex,
  cleanup: args.cleanup
};

const compiler = new LaTeXCompiler(compilerConfig);
```

**Compilation Modes**:
- Single file compilation (Lines 179-189)
- Watch mode (Lines 168-177)
- Metrics collection (Lines 634-638)

### 7. Semantic Query Engine
**File**: `/src/lib/semantic-query-engine.js`
**Type**: SPARQL Query Processing for Templates

### 8. Math Rendering Engine  
**File**: `/src/math/math-renderer.js` (Lines 28-41)
**Type**: Mathematical Expression Processing

**Configuration**:
```javascript
// Lines 28-41
cacheMaxSize: 1000,
this.cache = new Map();
```

---

## Office Document Processors

### 9. Word Processor
**File**: `/src/office/processors/word-processor.js`
**Type**: Microsoft Word Document Template Processing

### 10. Excel Processor
**File**: `/src/office/processors/excel-processor.js`
**Type**: Excel Spreadsheet Template Processing

### 11. PowerPoint Processor  
**File**: `/src/office/processors/powerpoint-processor.js`
**Type**: PowerPoint Presentation Template Processing

### 12. Office Template Processor (TypeScript)
**File**: `/src/office/office-template-processor.ts`
**Type**: Unified Office Document Processing

### 13. Base Processor
**File**: `/src/office/core/base-processor.ts`
**Type**: Abstract Base for Office Processors

---

## Template Loaders & File System Integration

### FileSystemLoader Configurations

1. **Primary Loader** (`/src/lib/template-engine.js:70-73`):
```javascript
new nunjucks.FileSystemLoader(this.options.templatesDir, {
  watch: false,
  noCache: !this.options.enableCache
});
```

2. **Ontology Loader** (`/src/core/ontology-template-engine.js:20`):
```javascript
nunjucks.configure(options.templatePath || join(__dirname, '../../templates'), {
  autoescape: false,
  trimBlocks: true,
  lstripBlocks: true
});
```

3. **Performance Loader** (`/src/performance/spec-performance-optimizer.js:492`):
```javascript
new nunjucks.FileSystemLoader('_templates', {
  noCache: false, // Enable caching
});
```

---

## Compilation Pipelines

### Template Compilation Process

1. **Discovery Phase**:
   - Template scanning (`templates/**/*.njk`)
   - Frontmatter parsing
   - Variable extraction

2. **Preprocessing Phase**:
   - Security validation
   - Path sanitization  
   - Context preparation

3. **Compilation Phase**:
   - Nunjucks compilation
   - Filter application
   - Template inheritance resolution

4. **Rendering Phase**:
   - Context injection
   - Template execution
   - Post-processing

5. **Optimization Phase**:
   - Cache storage
   - Statistics collection
   - Performance metrics

### Async/Sync Rendering Paths

**Synchronous Rendering**:
- `env.render()` - Standard sync rendering
- `env.renderString()` - String template sync rendering
- Used for simple templates without async operations

**Asynchronous Rendering**:
- `await this.renderTemplate()` - Promise-based rendering
- Used for RDF data loading, file I/O operations
- Ontology data processing requires async patterns

---

## Template Preprocessing & Postprocessing

### Preprocessing Steps

1. **Security Validation** (`/src/security/path-security.js:65-85`):
   - Path traversal prevention
   - Symlink validation
   - Cache-based security checks

2. **Variable Extraction** (`/src/templates/template-engine.js:287-333`):
   - Regex-based variable detection
   - Control flow analysis
   - Reserved word filtering

3. **Frontmatter Parsing** (`/src/office/templates/frontmatter-parser.ts`):
   - YAML metadata extraction
   - Template configuration parsing

### Postprocessing Pipeline

1. **Content Sanitization**:
   - Whitespace normalization
   - Security escaping
   - Output validation

2. **Format Conversion**:
   - LaTeX compilation to PDF
   - Markdown to HTML
   - Office document generation

3. **Quality Assurance**:
   - Syntax validation
   - Template compliance checking
   - Performance metrics collection

---

## Performance Optimizations

### Caching Strategies

1. **Template Cache** (`/src/performance/template-cache.js`):
   - File modification-based invalidation
   - Memory usage monitoring
   - Preloading strategies

2. **Filter Cache** (`/src/performance/spec-performance-optimizer.js:514-520`):
   - Result memoization
   - Key-based storage
   - Automatic cleanup

3. **Security Cache** (`/src/security/path-security.js:15-17`):
   - Path validation caching
   - Symlink resolution caching
   - TTL-based expiration

### Concurrent Processing

1. **Parallel Template Discovery**:
   - Multi-threaded file scanning
   - Concurrent frontmatter parsing
   - Batch processing capabilities

2. **Streaming Operations**:
   - Large file handling
   - Memory-efficient processing
   - Progressive rendering

---

## Integration Points

### RDF/Semantic Web Integration

1. **N3 Store Integration** (`/src/core/ontology-template-engine.js:16`):
   - Triple storage and querying
   - SPARQL query processing
   - Ontology reasoning

2. **Schema.org Integration**:
   - Structured data generation
   - JSON-LD output
   - Microdata embedding

### Office API Integration

1. **Microsoft Office APIs**:
   - Word document manipulation
   - Excel spreadsheet processing
   - PowerPoint slide generation

2. **Open Document Format**:
   - ODF template processing
   - Cross-platform compatibility

### LaTeX Integration

1. **Compiler Integration** (`/src/commands/latex.js:165-166`):
   - Multiple engine support (pdflatex, xelatex, lualatex)
   - Watch mode compilation
   - Error handling and logging

---

## Template Discovery & Metadata

### Template Scanning

1. **Directory Traversal**:
   - Recursive template discovery
   - Pattern-based filtering
   - Metadata extraction

2. **Template Registry**:
   - Central template catalog
   - Dependency tracking
   - Version management

### Metadata Processing

1. **Frontmatter Support**:
   - YAML configuration parsing
   - Template parameter extraction
   - Conditional rendering rules

2. **Template Analytics**:
   - Usage statistics
   - Performance metrics
   - Error tracking

---

## Security Considerations

### Template Injection Prevention

1. **Input Sanitization**:
   - Variable validation
   - Content escaping
   - Path sanitization

2. **Execution Sandboxing**:
   - Restricted function access
   - Safe filter implementation
   - Resource limitations

### Access Control

1. **Template Permissions**:
   - Read/write access control
   - User-based restrictions
   - Audit logging

2. **File System Security**:
   - Path traversal prevention
   - Symlink validation
   - Cache poisoning protection

---

## Error Handling & Recovery

### Error Types

1. **Template Compilation Errors**:
   - Syntax validation
   - Variable resolution
   - Filter application failures

2. **Runtime Errors**:
   - Context validation errors
   - File I/O failures
   - Memory exhaustion

### Recovery Strategies

1. **Graceful Degradation**:
   - Fallback templates
   - Default value substitution
   - Error message templates

2. **Error Reporting**:
   - Comprehensive logging
   - Performance impact tracking
   - User-friendly error messages

---

## Future Enhancement Opportunities

### Performance Improvements

1. **Advanced Caching**:
   - Distributed cache support
   - Intelligent preloading
   - Memory usage optimization

2. **Parallel Processing**:
   - Worker thread utilization
   - Streaming template processing
   - GPU acceleration for complex operations

### Feature Enhancements

1. **Template Language Extensions**:
   - Custom DSL support
   - Advanced control structures
   - Built-in validation rules

2. **Integration Expansions**:
   - Additional document formats
   - Cloud service integration
   - Real-time collaboration features

---

## Conclusion

The Unjucks template engine system represents a comprehensive, multi-faceted approach to template processing with specialized engines for different domains. The architecture emphasizes performance, security, and extensibility while maintaining compatibility with industry-standard template formats and processing pipelines.

**Key Strengths**:
- Modular engine architecture
- Comprehensive caching strategies
- Strong security implementation
- Extensive format support
- Performance optimization focus

**Areas for Optimization**:
- Memory usage monitoring
- Concurrent processing expansion
- Template validation automation
- Performance benchmarking enhancement

This index serves as a foundation for understanding the template processing capabilities and can guide future development and optimization efforts.