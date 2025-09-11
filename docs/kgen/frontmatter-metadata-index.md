# Unjucks Frontmatter and Metadata Processing Index

## Overview

This comprehensive index documents all frontmatter processing and metadata patterns in the Unjucks codebase, including parsing implementations, validation schemas, injection markers, and semantic web integrations.

## Table of Contents

1. [Frontmatter Parsing Libraries](#frontmatter-parsing-libraries)
2. [Core Frontmatter Parser Implementations](#core-frontmatter-parser-implementations)
3. [Injection Markers and Directives](#injection-markers-and-directives)
4. [Metadata Schema Definitions](#metadata-schema-definitions)
5. [Validation Patterns](#validation-patterns)
6. [SPARQL and RDF Integration](#sparql-and-rdf-integration)
7. [Template Variable Processing](#template-variable-processing)
8. [Office Document Frontmatter](#office-document-frontmatter)
9. [Testing Patterns](#testing-patterns)

## Frontmatter Parsing Libraries

### Primary Dependencies

- **gray-matter (v4.0.3)**: Primary frontmatter parsing library
  - Location: `package.json`, used throughout codebase
  - Purpose: Extract and parse YAML/JSON frontmatter from template files
  - Key files: `src/commands/generate.js`, `src/commands/export.js`, `src/commands/preview.js`

- **js-yaml (v4.1.0)**: YAML parsing and serialization
  - Used by gray-matter internally
  - Direct usage in: `src/cli/commands/specify/`, compliance validators
  - Patterns: `yaml.parse()`, `yaml.load()`, `yaml.stringify()`

### Import Patterns

```javascript
// Standard gray-matter imports
import matter from 'gray-matter';
import grayMatter from 'gray-matter';

// YAML library usage
import yaml from 'js-yaml';
const spec = yaml.parse(content);

// Dynamic imports for performance
const matter = await import('gray-matter');
```

## Core Frontmatter Parser Implementations

### Primary Parser: `/src/lib/frontmatter-parser.js`

**Key Features:**
- SPARQL/RDF content preprocessing
- Multi-format support (YAML, JSON)
- Semantic validation integration
- Template variable preservation

**API Methods:**
```javascript
class FrontmatterParser {
  async parse(templateContent, enableSemanticValidation = false)
  validate(frontmatter)
  hasRDFConfig(frontmatter)
  isSparqlLikeContent(content)
  isValidSparqlSyntax(sparqlQuery)
  preprocessSparqlFrontmatter(frontmatterText)
  postprocessSparqlFrontmatter(frontmatter)
}
```

### Office Document Parser: `/src/office/templates/frontmatter-parser.ts`

**Advanced Features:**
- Multi-format support (YAML, JSON, TOML, XML)
- Document-specific validation
- Variable extraction
- Injection point management

**Supported Formats:**
```typescript
enum FrontmatterFormat {
  YAML = 'yaml',
  JSON = 'json', 
  TOML = 'toml',
  XML = 'xml'
}
```

### Performance-Optimized Parser: `/src/performance/spec-performance-optimizer.js`

**Features:**
- Lazy module loading for gray-matter
- Cached parser instances
- Memory-efficient processing

```javascript
this.registerLazyModule('gray-matter', () => import('gray-matter'));
const matter = this.lazyModules.get('gray-matter_instance') || require('gray-matter');
```

## Injection Markers and Directives

### Standard Injection Markers

**File Operation Directives:**
- `to:` - Output file path (with template variables)
- `inject:` - Boolean flag for file injection mode
- `append:` - Append content to existing file
- `prepend:` - Prepend content to existing file
- `lineAt:` - Insert at specific line number

**Positioning Directives:**
- `before:` - Insert before marker string
- `after:` - Insert after marker string
- `at:` - Specific line number for insertion

**Conditional Directives:**
- `skipIf:` - Conditional skip expression
- `chmod:` - File permissions (octal format)
- `sh:` - Shell command to execute

### Examples from Templates

```yaml
# Basic injection pattern
---
to: "src/{{ name | kebabCase }}.ts"
inject: true
after: "// COMPONENTS"
skipIf: "{{ name | pascalCase }}"
chmod: 755
sh: "npm run format {{ to }}"
---

# Prisma model injection
---
inject: true
before: "// End of generated models"
skipIf: "model {{ entityName }}"
---

# Working test template
---
inject: false
---
```

## Metadata Schema Definitions

### Core Frontmatter Schema

**Required Fields:**
- `to`: string - Output path with template variables

**Optional Fields:**
- `inject`: boolean - File injection mode
- `append`: boolean - Append mode
- `prepend`: boolean - Prepend mode
- `lineAt`: number - Line-based insertion
- `before`: string - Insert before marker
- `after`: string - Insert after marker
- `skipIf`: string - Skip condition expression
- `chmod`: string|number - File permissions
- `sh`: string - Post-processing shell command

### Office Document Schema

**TypeScript Interfaces:**
```typescript
interface TemplateFrontmatter {
  type?: DocumentType;
  syntax?: VariableSyntax;
  mode?: ProcessingMode;
  variables?: TemplateVariable[];
  injectionPoints?: InjectionPoint[];
  output?: OutputConfiguration;
}

interface TemplateVariable {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: any;
  description?: string;
}
```

### RDF/Semantic Schema

**RDF Configuration:**
```yaml
rdf:
  source: "data.ttl"
  type: "file" | "inline" | "uri"
  prefixes:
    - "PREFIX foaf: <http://xmlns.com/foaf/0.1/>"
    - "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>"
```

**SPARQL Integration:**
```yaml
sparql: |
  PREFIX foaf: <http://xmlns.com/foaf/0.1/>
  SELECT ?name WHERE {
    ?person foaf:name ?name .
  }
```

## Validation Patterns

### Primary Validation Rules

**Injection Mode Validation:**
- Only one injection mode allowed (inject, append, prepend, lineAt)
- `before`/`after` requires `inject: true`
- `lineAt` must be positive number

**File Permission Validation:**
```javascript
// String format: octal digits
if (!/^[0-7]{3,4}$/.test(frontmatter.chmod)) {
  errors.push("chmod string must be octal format (e.g., '755', '0644')");
}

// Number format: within valid range
if (frontmatter.chmod < 0 || frontmatter.chmod > 0o777) {
  errors.push("chmod number must be between 0 and 0o777");
}
```

### RDF Validation

**RDF Configuration Validation:**
```javascript
// Requires source or prefixes
if (!frontmatter.rdf.source && !frontmatter.rdf.prefixes) {
  errors.push("RDF configuration requires a 'source' property or 'prefixes' array");
}

// Type validation
if (!["file", "inline", "uri"].includes(frontmatter.rdf.type)) {
  errors.push("RDF type must be 'file', 'inline', or 'uri'");
}
```

**SPARQL Syntax Validation:**
```javascript
isValidSparqlSyntax(sparqlQuery) {
  const sparqlKeywords = [
    'SELECT', 'CONSTRUCT', 'ASK', 'DESCRIBE', 'INSERT', 'DELETE',
    'PREFIX', 'WHERE', 'FILTER', 'OPTIONAL', 'UNION', 'GRAPH'
  ];
  
  return sparqlKeywords.some(keyword => 
    sparqlQuery.toUpperCase().includes(keyword)
  );
}
```

### Validation Error Types

**ValidationResult Interface:**
```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

interface ValidationError {
  message: string;
  code: string;
  severity: ErrorSeverity;
  field?: string;
}

enum ErrorSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}
```

## SPARQL and RDF Integration

### RDF Detection Patterns

**RDF Configuration Detection:**
```javascript
hasRDFConfig(frontmatter) {
  return !!(
    frontmatter.rdf ||
    frontmatter.turtle ||
    frontmatter.turtleData ||
    frontmatter.rdfData ||
    frontmatter.sparql ||
    frontmatter.query
  );
}
```

### SPARQL Content Processing

**Pre-processing for YAML Safety:**
```javascript
preprocessSparqlFrontmatter(frontmatterText) {
  return frontmatterText.replace(
    /^(\s*(?:sparql|query|rdf|turtle):\s*)([\s\S]*?)(?=^\s*[a-zA-Z_]|\s*$)/gm,
    (match, header, content) => {
      if (this.isSparqlLikeContent(content.trim())) {
        return header + '|\n' + content.split('\n').map(line => 
          line.trim() ? '  ' + line : line
        ).join('\n');
      }
      return match;
    }
  );
}
```

### RDF Template Fixtures

**Template Examples:**
- `/tests/fixtures/sparql/` - SPARQL query templates
- `/tests/fixtures/linked-data/` - Turtle/RDF templates
- `/tests/fixtures/schema-org/` - Schema.org JSON-LD templates

**Example SPARQL Template:**
```sparql
---
to: "queries/{{ queryName }}.sparql"
description: "{{ description }}"
---
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT ?{{ variable }} WHERE {
  ?person foaf:name ?{{ variable }} .
}
```

## Template Variable Processing

### Variable Syntax Support

**Nunjucks Variables:**
- `{{ variable }}` - Simple variable output
- `{{ variable | filter }}` - Filtered output
- `{% if condition %}...{% endif %}` - Conditionals
- `{% for item in array %}...{% endfor %}` - Loops

**Template Expression Preservation:**
```yaml
to: "{{ baseDir }}/{{ name | kebabCase }}.{{ extension }}"
inject: "{{ shouldInject }}"
condition: "{{ name !== 'skip' }}"
```

### Variable Type Inference

**Pattern-Based Type Detection:**
```javascript
inferVariableType(varName) {
  const booleanPatterns = /^(is|has|can|should|with|enable)/i;
  const numberPatterns = /^(count|index|id|port|max|min|size)/i;
  
  if (booleanPatterns.test(varName)) return 'boolean';
  if (numberPatterns.test(varName)) return 'number';
  return 'string';
}
```

## Office Document Frontmatter

### Document Types

```typescript
enum DocumentType {
  WORD = 'word',
  EXCEL = 'excel',
  POWERPOINT = 'powerpoint',
  PDF = 'pdf'
}

enum VariableSyntax {
  NUNJUCKS = 'nunjucks',
  HANDLEBARS = 'handlebars',
  MUSTACHE = 'mustache'
}

enum ProcessingMode {
  REPLACE = 'replace',
  INJECT = 'inject',
  MERGE = 'merge'
}
```

### Office Template Examples

**Word Document Template:**
```yaml
---
type: "word"
syntax: "nunjucks"
mode: "replace"
variables:
  - name: "clientName"
    type: "string"
    required: true
  - name: "contractDate"
    type: "string"
    required: true
injectionPoints:
  - id: "client-info"
    marker: "{{CLIENT_INFO}}"
    type: "text"
output:
  extension: ".docx"
  compression:
    enabled: true
    level: 6
---
```

### Office-Specific Validation

**Document Validation Rules:**
- Document type validation against enum
- Variable syntax compatibility
- Processing mode validation
- Injection point uniqueness
- Output configuration validation

## Testing Patterns

### Property-Based Testing

**Frontmatter Parsing Properties:**
- Valid YAML should parse successfully
- Malformed YAML should be handled gracefully
- Parsing should be deterministic
- All properties should be preserved

### Test File Locations

**Unit Tests:**
- `/tests/unit/frontmatter-parser.test.js` - Core parser tests
- `/tests/unit/frontmatter-parser-real.test.js` - Real functionality tests
- `/tests/unit/property/frontmatter-scanner.property.test.js` - Property tests

**Integration Tests:**
- `/tests/integration/frontmatter-filters.test.js`
- `/tests/sparql-frontmatter-validation.test.js`
- `/tests/steps/frontmatter.steps.js` - BDD steps

### Test Data Patterns

**Valid Configuration Examples:**
```javascript
const validConfigs = [
  { inject: true, after: 'marker' },
  { inject: true, before: 'marker' },
  { append: true },
  { prepend: true },
  { lineAt: 5 }
];
```

**Error Scenarios:**
```javascript
const invalidConfigs = [
  { inject: true, append: true, prepend: true }, // Multiple modes
  { before: 'marker' }, // Missing inject: true
  { lineAt: 0 }, // Invalid line number
  { chmod: 'invalid' } // Invalid chmod format
];
```

## File Locations Summary

### Core Implementation Files

**Primary Parsers:**
- `/src/lib/frontmatter-parser.js` - Main parser with SPARQL support
- `/src/office/templates/frontmatter-parser.ts` - Office document parser
- `/src/performance/spec-performance-optimizer.js` - Performance optimized

**Command Integration:**
- `/src/commands/generate.js` - Template generation
- `/src/commands/export.js` - Export functionality  
- `/src/commands/preview.js` - Preview functionality
- `/src/commands/help.js` - Dynamic help generation

**CLI Integration:**
- `/src/cli/commands/specify/validate.js` - Specification validation
- `/src/cli/commands/specify/tasks.js` - Task processing
- `/src/cli/commands/specify/plan.js` - Planning functionality

### Template Examples

**Generator Templates:**
- `/_templates/semantic-db/prisma-model.prisma.njk` - Database models
- `/_templates/working-test/demo/class.js.njk` - Class generation
- `/_templates/office/` - Office document templates

### Test Coverage

**Comprehensive Testing:**
- 15+ test files specifically for frontmatter parsing
- Property-based testing for robustness
- Integration tests with actual file operations
- BDD scenarios for user workflows
- Performance and stress testing

## Performance Considerations

### Optimization Patterns

**Lazy Loading:**
```javascript
this.registerLazyModule('gray-matter', () => import('gray-matter'));
const matter = this.lazyModules.get('gray-matter_instance');
```

**Caching:**
- Parser instance caching
- Validation result caching
- Template scanning caches

**Memory Management:**
- Streaming for large files
- Memory-efficient regex patterns
- Cleanup of temporary objects

## Security Considerations

### Input Validation

- YAML parsing with safety flags
- SPARQL query validation
- File path sanitization
- Permission validation

### Safe Defaults

- Strict mode disabled for flexibility
- Error handling without exposure
- Limited shell command execution
- Controlled file system access

## Future Enhancement Areas

### Planned Improvements

1. **Additional Format Support:**
   - TOML frontmatter parsing
   - JSON5 support
   - Custom delimiter support

2. **Enhanced Validation:**
   - JSON Schema validation
   - Custom validation rules
   - Async validation support

3. **Performance Optimizations:**
   - Streaming parser for large files
   - Web Worker support
   - Memory-mapped files

4. **Semantic Web Enhancements:**
   - SHACL validation integration
   - OWL reasoning support
   - RDF graph querying

This comprehensive index provides a complete reference for all frontmatter and metadata processing patterns in the Unjucks codebase, enabling developers to understand, extend, and maintain the system effectively.