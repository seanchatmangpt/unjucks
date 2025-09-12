# KGEN Template Migration Guide: UNJUCKS → KGEN

## Overview

This guide documents the migration of UNJUCKS generator discovery patterns to KGEN's simplified template system. The enhanced KGEN CLI now supports both formats, allowing for gradual migration and interoperability.

## Template Structure Comparison

### UNJUCKS Format (Legacy)

```
_templates/
├── generator-name/           # Generator directory
│   ├── template-name/        # Template directory
│   │   ├── template1.njk     # Template files
│   │   ├── template2.njk
│   │   └── subdirs/          # Nested structure supported
│   └── another-template/
└── another-generator/
```

**Usage**: `unjucks generate generator-name template-name`

**Characteristics**:
- Two-level hierarchy: generator → template
- Multiple files per template directory
- Complex discovery logic
- Generator-centric approach

### KGEN Format (Simplified)

```
templates/
├── api-service/
│   ├── controller.ts.njk
│   └── model.ts.njk
├── knowledge-graph/
│   └── entity.njk
└── compliance-report/
    └── gdpr-pia.md.njk
```

**Usage**: `kgen templates show api-service/controller.ts`

**Characteristics**:
- Direct template file approach
- Rich frontmatter metadata
- Template-centric approach
- Simplified discovery

## Template Discovery Enhancement

### Enhanced Scanner Features

The new `KgenTemplateScanner` supports:

1. **Multi-format Detection**: Automatically detects UNJUCKS vs KGEN formats
2. **Multiple Template Sources**: Supports multiple template directories
3. **Rich Metadata Extraction**: Extracts variables, frontmatter, structure analysis
4. **Unified API**: Same commands work for both formats

### Discovery Sources (Priority Order)

1. **UNJUCKS Compatibility**: `_templates/` (generator/template structure)
2. **KGEN Packages**: `packages/kgen-templates/templates/` 
3. **Project Templates**: `templates/`
4. **Config-defined Sources**: Additional directories from `kgen.config.js`

## Migration Patterns

### 1. Variable Extraction

**UNJUCKS Pattern**:
```javascript
// Manual variable scanning in generator.js
extractTemplateVariables(templatePath) {
  const variables = new Set();
  const varMatches = fullContent.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\|[^}]*)?\}\}/g);
  // ... processing logic
}
```

**KGEN Pattern**:
```javascript
// Enhanced variable extraction with frontmatter support
async extractTemplateVariables(templateFiles) {
  const variables = new Set();
  // Extract from both frontmatter and content
  // Support for nested variables (object.property)
  // Filter extraction for loops and conditionals
}
```

### 2. Metadata Handling

**UNJUCKS Frontmatter**:
```yaml
---
to: src/controllers/{{ entityName | pascalCase }}Controller.ts
---
```

**KGEN Enhanced Frontmatter**:
```yaml
---
to: "{{ outputDir | default('kg') }}/{{ entityName | slug }}.ttl"
inject: false
skipIf: false
chmod: 644
name: "Knowledge Graph Entity Generator"
title: "Knowledge Graph Entity Template"
description: "Generates RDF entities for knowledge graph construction"
category: "knowledge-graph"
tags: ["knowledge-graph", "entity", "rdf", "linked-data"]
version: "1.0.0"
author: "KGEN Templates"
license: "MIT"
rdf:
  enabled: true
  prefixes:
    kg: "http://example.org/kg/"
    # ... more prefixes
---
```

### 3. Category Inference

**UNJUCKS**: Categories inferred from generator names
```javascript
inferCategory(generatorName) {
  const categoryMap = {
    'api': 'backend',
    'component': 'frontend',
    'database': 'database'
  };
}
```

**KGEN**: Categories from frontmatter OR path-based inference
```javascript
// Priority: frontmatter.category > path inference > default
category: metadata.frontmatter?.category || category
```

## CLI Commands Comparison

### Template Listing

**UNJUCKS CLI** (Legacy):
```bash
unjucks list                    # List all generators
unjucks list generator-name     # List templates for generator
```

**Enhanced KGEN CLI**:
```bash
kgen templates ls               # List all templates from all sources
kgen templates ls --verbose     # Detailed template information  
kgen templates ls --category=backend    # Filter by category
kgen templates ls --format=unjucks     # Filter by format
kgen templates stats            # Template statistics and sources
```

### Template Details

**UNJUCKS CLI** (Legacy):
```bash
unjucks help generator template # Show template help
```

**Enhanced KGEN CLI**:
```bash
kgen templates show template-id          # Detailed template info
kgen templates show "api/express"        # UNJUCKS format
kgen templates show "knowledge-graph/entity.njk"  # KGEN format
```

### Template Search

**UNJUCKS CLI**: Limited search capability

**Enhanced KGEN CLI**:
```bash
kgen templates search "knowledge-graph"  # Search by name/description/tags
kgen templates search "controller"       # Find all controller templates
```

## Enhanced Features

### 1. Template Statistics

```json
{
  "total": 91,
  "categories": {
    "backend": 23,
    "frontend": 6,
    "knowledge-graph": 11,
    "semantic": 2
  },
  "formats": {
    "kgen": 35,
    "unjucks": 56
  },
  "templateSources": [
    {
      "type": "unjucks",
      "path": "_templates",
      "exists": true
    },
    {
      "type": "kgen", 
      "path": "packages/kgen-templates/templates",
      "exists": true
    }
  ]
}
```

### 2. Template Structure Analysis

```json
{
  "structure": {
    "blocks": [],
    "includes": [],
    "macros": [],
    "complexity": 0,
    "lines": 177,
    "hasConditionals": true,
    "hasLoops": false,
    "hasFrontmatter": true
  }
}
```

### 3. Variable Analysis

Enhanced variable extraction supports:
- Root variables (`entityName`)
- Nested access (`object.property`) → extracts root (`object`)
- Loop iteration variables (`{% for item in items %}` → extracts `items`)
- Conditional variables (`{% if condition %}` → extracts `condition`)

## Configuration Integration

### KGEN Config Support

```javascript
// kgen.config.js
export default {
  directories: {
    templates: '_templates',      // UNJUCKS compatibility
    out: './generated'
  },
  templateSources: [              // Additional template sources
    { type: 'kgen', path: 'custom/templates' },
    { type: 'auto', path: 'shared/templates' }
  ]
}
```

### Template Source Auto-Detection

The scanner automatically detects format based on structure:

1. **Directory Structure**: Generator dirs with template subdirs → UNJUCKS
2. **Direct Templates**: `.njk`/`.j2` files in directories → KGEN
3. **Metadata**: Rich frontmatter → KGEN, minimal frontmatter → UNJUCKS

## Performance Benefits

### UNJUCKS Discovery (Legacy)
- Sequential scanning of generator → template hierarchy
- Limited caching
- Separate metadata extraction per template

### Enhanced KGEN Discovery
- Parallel scanning of multiple template sources
- Unified metadata extraction pipeline
- Template statistics caching
- Batch file operations

## Migration Recommendations

### Phase 1: Enhanced Discovery (✅ Complete)
- Install enhanced KGEN CLI
- Verify existing UNJUCKS templates are discovered
- Test template listing and search functionality

### Phase 2: Template Enrichment
- Add rich frontmatter metadata to high-value templates
- Categorize templates properly
- Add version and authorship information

### Phase 3: Format Migration
- Gradually migrate complex generator/template hierarchies to direct KGEN format
- Consolidate related templates into template packs
- Update template references in workflows

### Phase 4: Optimization
- Remove unused UNJUCKS generators
- Optimize template directory structure
- Configure custom template sources

## Backward Compatibility

The enhanced system maintains full backward compatibility:

- ✅ All existing UNJUCKS templates work unchanged
- ✅ Same template generation behavior
- ✅ Existing frontmatter respected  
- ✅ Variable extraction maintains compatibility
- ✅ File output paths work identically

## Template Examples

### Migrating an API Controller

**Before (UNJUCKS)**:
```
_templates/api/controller/controller.ts.njk
```

**After (KGEN)**:
```
templates/api-service/controller.ts.njk
```

With enhanced metadata:
```yaml
---
to: "src/controllers/{{ entityName | pascalCase }}Controller.ts"
name: "API Controller Generator"
description: "Generates TypeScript API controller with CRUD operations"
category: "backend"
tags: ["api", "controller", "typescript", "crud"]
version: "2.0.0"
variables:
  entityName:
    type: "string"
    required: true
    description: "Name of the entity (e.g., 'User', 'Product')"
  withAuth:
    type: "boolean" 
    default: false
    description: "Include authentication middleware"
---
```

## Testing the Migration

```bash
# Test discovery from all sources
./bin/kgen-enhanced.mjs templates ls --verbose

# Verify UNJUCKS templates work
./bin/kgen-enhanced.mjs templates show "api/express"

# Verify KGEN templates work  
./bin/kgen-enhanced.mjs templates show "knowledge-graph/entity.njk"

# Test search across formats
./bin/kgen-enhanced.mjs templates search "controller"

# Check statistics
./bin/kgen-enhanced.mjs templates stats
```

## Conclusion

The enhanced KGEN template discovery system successfully bridges UNJUCKS and KGEN formats, providing:

1. **Unified Discovery**: Single CLI for multiple template formats
2. **Rich Metadata**: Enhanced template information extraction
3. **Flexible Search**: Advanced filtering and search capabilities
4. **Migration Path**: Clear path from UNJUCKS to KGEN format
5. **Backward Compatibility**: Full compatibility with existing templates

The system discovers **91 total templates** from **3 template sources**, supporting both legacy UNJUCKS generators and modern KGEN template packs.