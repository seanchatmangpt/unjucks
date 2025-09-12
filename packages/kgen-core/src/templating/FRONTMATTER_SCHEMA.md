# KGEN Enhanced Frontmatter Schema

The KGEN Enhanced Frontmatter Parser combines the powerful features of UNJUCKS with KGEN-specific capabilities for deterministic generation, content addressing, and provenance tracking.

## Core Schema

### Basic Structure

```yaml
---
# Output configuration
to: "{{ path }}/{{ filename }}.{{ extension }}"

# KGEN-specific fields
deterministic: true|false
contentAddressed: true|false
attestations: true|false

# Template metadata
name: "Template Name"
title: "Human-readable title"
description: "Template description"
category: "template-category"
tags: ["tag1", "tag2", "tag3"]
version: "1.0.0"
author: "Author Name"
license: "MIT"

# Injection directives
inject: true|false
append: true|false
prepend: true|false
lineAt: number
before: "search-pattern"
after: "search-pattern"
skipIf: "condition"

# File permissions
chmod: "755" | 0755

# Provenance metadata
provenance:
  source: "template-source"
  version: "1.0.0"
  maintainer: "team@company.com"

# RDF/SPARQL support (from UNJUCKS)
rdf:
  enabled: true
  source: "data.ttl"
  type: "file|inline|uri"
  prefixes:
    - "foaf: <http://xmlns.com/foaf/0.1/>"

sparql: |
  PREFIX foaf: <http://xmlns.com/foaf/0.1/>
  SELECT ?name WHERE {
    ?person foaf:name ?name
  }
---
Template content here...
```

## KGEN-Specific Fields

### Deterministic Generation

Controls whether template generation produces deterministic output:

```yaml
---
deterministic: true  # Ensures reproducible output
contentAddressed: true  # Enable content-based addressing
attestations: true  # Generate cryptographic attestations
---
```

**Behavior:**
- `deterministic: true` - All timestamps, UUIDs, and random values are made deterministic
- `contentAddressed: true` - Output files are named based on content hash
- `attestations: true` - Generates `.attest.json` files with cryptographic proofs

### Template Metadata

Comprehensive metadata for template discovery and management:

```yaml
---
name: "React Component Generator"
title: "TypeScript React Component with Tests"
description: "Generates a React functional component with TypeScript and Jest tests"
category: "components"
tags: ["react", "typescript", "testing", "frontend"]
version: "2.1.0"
author: "Frontend Team"
license: "MIT"
complexity: "medium"
dependencies: ["react", "@types/react", "jest"]
capabilities: ["typescript", "testing", "storybook"]
---
```

### Provenance Tracking

Track template lineage and authorship:

```yaml
---
provenance:
  source: "enterprise-templates"
  version: "3.2.1"
  maintainer: "platform-team@company.com"
  repository: "https://github.com/company/templates"
  branch: "main"
  commit: "abc123def456"
  buildId: "build-789"
---
```

## Injection Directives

Enhanced injection capabilities for modifying existing files:

### Injection Modes

```yaml
---
# Basic injection at marker
inject: true
after: "// INSERT_POINT"

# Append to end of file
append: true

# Prepend to beginning of file  
prepend: true

# Insert at specific line number
lineAt: 42
---
```

### Advanced Injection

```yaml
---
inject: true
before: "class MyClass {"
after: "// End of class"
skipIf: "hasFeature"  # Skip if condition is true
---
```

### Conditional Generation

```yaml
---
skipIf: "framework==vue"     # Skip if framework equals vue
skipIf: "!hasTests"          # Skip if hasTests is falsy
skipIf: "environment!=prod"  # Skip if environment is not prod
---
```

## RDF/SPARQL Support

Inherited from UNJUCKS for semantic template processing:

### RDF Configuration

```yaml
---
rdf:
  enabled: true
  source: "ontology.ttl"
  type: "file"  # file|inline|uri
  format: "text/turtle"
  prefixes:
    owl: "http://www.w3.org/2002/07/owl#"
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
    rdfs: "http://www.w3.org/2000/01/rdf-schema#"
---
```

### SPARQL Queries

```yaml
---
sparql: |
  PREFIX foaf: <http://xmlns.com/foaf/0.1/>
  PREFIX dc: <http://purl.org/dc/elements/1.1/>
  
  SELECT ?name ?email ?title WHERE {
    ?person foaf:name ?name ;
            foaf:mbox ?email ;
            dc:title ?title .
    FILTER(?title = "Developer")
  }
  ORDER BY ?name
---
```

### Inline RDF Data

```yaml
---
turtle: |
  @prefix foaf: <http://xmlns.com/foaf/0.1/> .
  @prefix dc: <http://purl.org/dc/elements/1.1/> .
  
  :john a foaf:Person ;
        foaf:name "John Doe" ;
        foaf:mbox <mailto:john@example.com> ;
        dc:title "Senior Developer" .
---
```

## Validation Rules

### Required Fields

- `to` - Output path (can use template variables)

### Mutually Exclusive

- Only one injection mode: `inject`, `append`, `prepend`, or `lineAt`
- `before`/`after` requires `inject: true`

### Type Validation

```yaml
---
# Boolean fields
deterministic: true|false
contentAddressed: true|false
attestations: true|false
inject: true|false
append: true|false
prepend: true|false

# Number fields
lineAt: 1..∞  # Positive integers only

# String fields
chmod: /^[0-7]{3,4}$/  # Octal format like "755" or "0644"

# Array fields
tags: ["string", "array"]
dependencies: ["string", "array"]

# Object fields
rdf: { source: string, type: "file|inline|uri" }
provenance: { source: string, version: string }
---
```

### Semantic Validation

When `enableSemanticValidation` is enabled:

- SPARQL queries are syntax-validated
- RDF/Turtle content is parsed for errors  
- URI formats are validated
- Ontology references are checked

## Configuration Options

### Parser Initialization

```javascript
import { FrontmatterParser } from '@kgen/core';

const parser = new FrontmatterParser({
  enableValidation: true,
  trackProvenance: true,
  enableSemanticValidation: true,
  strictMode: false,
  
  kgenConfig: {
    enableAttestations: true,
    enableContentAddressing: true,
    enableProvenanceTracking: true,
    defaultDeterministic: false
  },
  
  validatorConfig: {
    strictMode: false,
    maxErrors: 100,
    timeout: 5000
  }
});
```

### Parse Options

```javascript
const result = await parser.parse(templateContent, {
  enableSemanticValidation: true,
  extractMetadata: true,
  validateKgenFields: true,
  templatePath: '/templates/component.njk'
});
```

## Result Structure

### Parse Result

```javascript
{
  frontmatter: {
    // Parsed frontmatter with KGEN enhancements
    to: "components/Button.tsx",
    deterministic: true,
    contentAddressed: true,
    attestations: true,
    _generated: {
      kgenVersion: "1.0.0",
      timestamp: "2023-12-01T10:00:00.000Z"
    }
  },
  
  content: "// Template body content",
  
  hasValidFrontmatter: true,
  
  metadata: {
    name: "Button Component",
    category: "components",
    templatePath: "/templates/button.njk",
    extractedAt: "2023-12-01T10:00:00.000Z",
    kgen: {
      deterministic: true,
      contentAddressed: true,
      attestations: true,
      operationMode: { mode: "write" },
      hasRdfConfig: false
    }
  },
  
  provenance: {
    templatePath: "/templates/button.njk", 
    templateHash: "abc123...",
    frontmatterHash: "def456...",
    parsedAt: "2023-12-01T10:00:00.000Z",
    parserVersion: "2.0.0-enhanced"
  },
  
  validationResult: {
    valid: true,
    errors: [],
    warnings: []
  }
}
```

### Validation Errors

```javascript
{
  valid: false,
  errors: [
    {
      code: "EXCLUSIVE_INJECTION_MODES",
      message: "Only one injection mode allowed",
      severity: "error"
    }
  ],
  warnings: [
    {
      code: "CONFLICTING_DETERMINISTIC_SETTINGS", 
      message: "contentAddressed=true with deterministic=false may cause inconsistent behavior",
      severity: "warning"
    }
  ]
}
```

## Migration from UNJUCKS

### Automatic Compatibility

The enhanced parser maintains full backward compatibility with UNJUCKS frontmatter:

- All UNJUCKS injection directives work unchanged
- SPARQL/RDF preprocessing is preserved
- Semantic validation is enhanced but optional

### New KGEN Features

```yaml
---
# UNJUCKS frontmatter (still supported)
to: "{{ name }}.js"
inject: true
after: "// INSERT_POINT"

# Add KGEN enhancements
deterministic: true
attestations: true
name: "Component Generator"
category: "components"
---
```

### Gradual Migration

1. **Phase 1**: Use enhanced parser with existing UNJUCKS templates
2. **Phase 2**: Add KGEN metadata fields for better discovery
3. **Phase 3**: Enable deterministic generation and attestations
4. **Phase 4**: Add provenance tracking for compliance

## Best Practices

### Template Organization

```yaml
---
# Required: Output configuration
to: "{{ domain }}/{{ name | pascalCase }}.{{ extension }}"

# Recommended: Template metadata
name: "{{ templateName }}"
description: "{{ templateDescription }}"
category: "{{ templateCategory }}"
tags: {{ templateTags | json }}

# Optional: KGEN features
deterministic: {{ isDeterministic | default(false) }}
attestations: {{ needsAttestations | default(true) }}

# Optional: Enterprise features
provenance:
  source: "{{ templateSource }}"
  version: "{{ templateVersion }}"
---
```

### Error Handling

```javascript
const result = await parser.parse(templateContent, options);

if (!result.hasValidFrontmatter) {
  console.warn('Invalid frontmatter:', result.error?.message);
  // Handle fallback
}

if (result.validationResult && !result.validationResult.valid) {
  console.error('Validation errors:', result.validationResult.errors);
  // Handle validation failures
}

if (result.validationResult?.warnings?.length > 0) {
  console.warn('Validation warnings:', result.validationResult.warnings);
  // Handle warnings
}
```

### Performance Optimization

```javascript
// For production: disable expensive validations
const productionParser = new FrontmatterParser({
  enableValidation: false,
  enableSemanticValidation: false,
  trackProvenance: false
});

// For development: full validation and tracking
const devParser = new FrontmatterParser({
  enableValidation: true,
  enableSemanticValidation: true,
  trackProvenance: true,
  strictMode: true
});
```