# KGEN Document Generation Integration

This module integrates Unjucks' mature document generation capabilities into KGEN's architecture, providing enterprise-grade document generation with deterministic output, semantic reasoning, and comprehensive provenance tracking.

## 🚀 Key Features

### Document Processing Capabilities
- **Office Documents**: Full Word, Excel, and PowerPoint processing with content injection
- **LaTeX Compilation**: Professional PDF generation with multiple compiler support
- **Semantic Integration**: Knowledge graph-driven data injection and reasoning
- **Deterministic Generation**: Reproducible outputs with cryptographic verification
- **Enterprise Security**: Compliance validation, attestation, and audit trails

### Architecture Integration
- **Template Engine**: Extends KGEN's Nunjucks template engine
- **Frontmatter Processing**: Document-specific frontmatter with validation
- **Semantic Injector**: RDF/SPARQL integration for intelligent data binding
- **Attestation System**: Cryptographic provenance and compliance validation
- **Security Manager**: Enterprise-grade security and access controls

## 📁 Module Structure

```
src/documents/
├── document-engine.js           # Main document generation engine
├── frontmatter-processor.js     # Document-specific frontmatter processing
├── semantic-injector.js         # Knowledge graph integration
├── document-attestation.js      # Provenance and attestation system
├── index.js                    # Public API exports
├── integration-example.js      # Complete integration demonstration
└── README.md                   # This documentation
```

## 🎯 Quick Start

### Basic Document Generation

```javascript
import { generateDocument, DocumentType } from '@kgen/documents';

// Generate Word document
const result = await generateDocument({
  template: './templates/business-report.md',
  data: {
    title: 'Q4 Financial Report',
    author: 'John Doe',
    date: new Date(),
    revenue: 1500000
  },
  output: './reports/q4-report.docx',
  type: DocumentType.WORD
});

console.log('Generated:', result.outputPath);
```

### Semantic Data Injection

```javascript
import { DocumentEngine, DocumentMode } from '@kgen/documents';

const engine = new DocumentEngine({
  enableSemanticInjection: true,
  enableProvenanceTracking: true
});

const result = await engine.generateDocument({
  template: './templates/financial-dashboard.md',
  documentType: 'excel',
  documentMode: DocumentMode.SEMANTIC,
  context: { companyName: 'Acme Corp' },
  knowledgeGraph: './knowledge/company-data.ttl',
  semanticBindings: {
    revenue: 'fin:totalRevenue',
    employees: 'org:headCount',
    growth: {
      type: 'computed',
      dependencies: ['fin:revenue'],
      computation: (data) => calculateGrowth(data)
    }
  }
});
```

### Document Templates with Frontmatter

```markdown
---
documentType: word
documentMode: injection
to: "{{ outputDir }}/{{ reportType }}-{{ date | date('YYYY-MM') }}.docx"
officeTemplate: business-report-template.docx
injectionPoints:
  - id: title
    target: "bookmark:ReportTitle"
    content: "{{ title }}"
    required: true
  - id: financial_data
    target: "table:FinancialTable"
    content: "{{ financialData }}"
    type: table
semanticBindings:
  revenue: "fin:totalRevenue"
  growth: "fin:growthRate"
securityLevel: confidential
complianceTags: ["sox", "financial-reporting"]
---

# {{ title }}

This report contains confidential financial information.
```

## 🔧 Advanced Configuration

### Full-Featured Document Engine

```javascript
import { DocumentEngine, AttestationLevel } from '@kgen/documents';

const engine = new DocumentEngine({
  // Directories
  documentsDir: './templates/documents',
  outputDir: './generated-documents',
  
  // Features
  enableSemanticInjection: true,
  enableProvenanceTracking: true,
  enableAttestation: true,
  enableCryptographicSigning: true,
  
  // Security
  attestationLevel: AttestationLevel.ENTERPRISE,
  attestationDir: './.kgen/attestations',
  securityLevel: 'high',
  
  // Performance
  cacheSemanticResults: true,
  enableReasoning: true,
  reasoningTimeout: 30000,
  
  // Compliance
  complianceFramework: 'sox',
  enableComplianceValidation: true
});
```

### Semantic Knowledge Graph Integration

```javascript
// Define semantic bindings
const semanticBindings = {
  // Direct property mapping
  companyName: {
    type: 'direct',
    property: 'org:legalName',
    required: true
  },
  
  // Computed values
  revenueGrowth: {
    type: 'computed',
    dependencies: ['fin:revenue'],
    computation: (data, context) => {
      const revenues = data['fin:revenue'];
      return calculateYearOverYearGrowth(revenues);
    }
  },
  
  // Temporal queries
  currentMetrics: {
    type: 'temporal',
    property: 'fin:metrics',
    timeConstraint: '{{ reportDate }}'
  },
  
  // Inference-based
  riskAssessment: {
    type: 'inferred',
    query: `
      SELECT ?risk WHERE {
        ?company fin:debtRatio ?debt .
        ?company fin:liquidityRatio ?liquidity .
        BIND(IF(?debt > 0.7 && ?liquidity < 1.2, "HIGH", "LOW") AS ?risk)
      }
    `
  }
};
```

## 📊 Document Types and Modes

### Supported Document Types

| Type | Extension | Processor | Features |
|------|-----------|-----------|----------|
| `word` | .docx | Office | Content injection, bookmarks, tables |
| `excel` | .xlsx | Office | Cell ranges, charts, formulas |
| `powerpoint` | .pptx | Office | Slide content, charts, images |
| `latex` | .tex | LaTeX | Professional typesetting |
| `pdf` | .pdf | LaTeX→PDF | Compiled output |
| `markdown` | .md | Template | Simple markup |
| `html` | .html | Template | Web documents |

### Generation Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `template` | Standard template rendering | Simple variable substitution |
| `injection` | Content injection into existing docs | Preserving complex formatting |
| `compilation` | LaTeX to PDF compilation | Professional documents |
| `semantic` | Knowledge graph-driven | Data-driven generation |
| `hybrid` | Multiple modes combined | Complex workflows |

## 🔒 Security and Compliance

### Security Classifications

```javascript
const securityContext = {
  classification: 'confidential',
  complianceTags: ['sox', 'gdpr', 'hipaa'],
  attestationRequired: true,
  encryptionRequired: true,
  accessControl: {
    readers: ['finance-team', 'executives'],
    writers: ['report-generators']
  }
};
```

### Compliance Frameworks

- **SOX**: Sarbanes-Oxley financial controls
- **GDPR**: EU data protection compliance
- **HIPAA**: Healthcare information security
- **ISO 27001**: Information security management
- **Generic**: Basic security and audit controls

### Attestation and Provenance

```javascript
// Document attestation includes:
{
  attestationId: 'attest_abc123',
  attestationLevel: 'enterprise',
  provenance: {
    inputs: {
      templateHash: 'sha256:...',
      dataHash: 'sha256:...'
    },
    processing: {
      generationStrategy: 'semantic',
      processingTime: 1250,
      semanticQueries: 5
    },
    outputs: {
      outputHash: 'sha256:...',
      size: 245760
    }
  },
  signatures: {
    primary: 'RSA-SHA256:...',
    timestamp: 'TSA:...'
  },
  compliance: {
    framework: 'sox',
    validations: [
      { type: 'data-integrity', compliant: true },
      { type: 'audit-trail', compliant: true }
    ]
  }
}
```

## 🧪 Testing and Validation

### Template Validation

```javascript
import { validateDocumentTemplate } from '@kgen/documents';

const validation = await validateDocumentTemplate('./template.md', {
  strictValidation: true,
  checkDependencies: true
});

if (!validation.valid) {
  console.error('Template errors:', validation.errors);
  console.warn('Template warnings:', validation.warnings);
}

console.log('Required processors:', validation.requirements.processors);
console.log('Dependencies:', validation.requirements.dependencies);
```

### Document Verification

```javascript
// Verify document attestation
const verification = await engine.attestationSystem.verifyDocumentAttestation(
  attestationId
);

console.log('Verification result:', verification.overallValid);
console.log('Checks performed:', verification.verifications.length);
```

### Integration Testing

```javascript
// Run the integration example
import { runIntegrationDemos } from './integration-example.js';

await runIntegrationDemos();
```

## 📈 Performance and Monitoring

### Statistics and Metrics

```javascript
// Document generation statistics
const stats = engine.getDocumentStats();
console.log('Documents generated:', stats.documentsGenerated);
console.log('Average generation time:', stats.averageGenerationTime);
console.log('Error rate:', stats.errorRate);

// Semantic injection statistics
const semanticStats = engine.semanticInjector.getSemanticStats();
console.log('Semantic queries:', semanticStats.semanticQueriesExecuted);
console.log('Cache hit rate:', semanticStats.cacheHitRate);

// Attestation statistics
const attestationStats = engine.attestationSystem.getAttestationStats();
console.log('Attestations created:', attestationStats.attestationsGenerated);
console.log('Signatures created:', attestationStats.signaturesCreated);
```

### Performance Optimization

- **Template Caching**: Enabled by default for faster renders
- **Semantic Query Caching**: Reduces knowledge graph query time
- **Parallel Processing**: Batch operations run concurrently
- **Incremental Compilation**: LaTeX recompilation optimization
- **Memory Management**: Automatic cleanup of large documents

## 🔗 Integration with KGEN

### KGEN CLI Integration

```bash
# Generate document through KGEN CLI
kgen artifact generate \
  --template ./templates/report.md \
  --graph ./knowledge/data.ttl \
  --output ./reports/generated.docx \
  --attestation-level enterprise

# Validate document template
kgen templates validate ./templates/report.md

# List available document templates
kgen templates ls --category documents
```

### KGEN Configuration

```javascript
// kgen.config.js
export default {
  documents: {
    templates: './templates/documents',
    output: './generated-documents',
    semantic: {
      enabled: true,
      knowledgeGraphs: './knowledge',
      reasoningRules: './rules'
    },
    security: {
      attestationLevel: 'standard',
      complianceFramework: 'sox',
      enableSigning: true
    }
  }
};
```

## 🚀 Migration from Unjucks

### Compatibility

- **100% Template Compatibility**: Existing Unjucks templates work unchanged
- **Enhanced Frontmatter**: Additional document-specific fields
- **Semantic Extensions**: Optional semantic bindings
- **Deterministic Output**: Consistent generation results

### Migration Steps

1. **Copy Templates**: Move templates to KGEN documents directory
2. **Update Frontmatter**: Add document-specific configuration
3. **Add Semantic Bindings**: Optional knowledge graph integration
4. **Enable Features**: Configure provenance and attestation
5. **Update Scripts**: Use KGEN document API

### Example Migration

```javascript
// Before: Pure Unjucks
import nunjucks from 'nunjucks';
const template = nunjucks.render('report.html', data);

// After: KGEN Documents
import { generateDocument } from '@kgen/documents';
const result = await generateDocument({
  template: './templates/report.md',
  data,
  type: 'html'
});
```

## 🤝 Contributing

### Development Setup

```bash
# Install dependencies
npm install

# Run integration tests
npm run test:integration

# Run document generation demos
node src/documents/integration-example.js

# Generate documentation
npm run docs:generate
```

### Architecture Overview

```
KGEN Document Engine
├── Template Engine (Nunjucks)
├── Office Processor (Unjucks Office)
├── LaTeX Processor (Template Selector)
├── Semantic Injector (RDF/SPARQL)
├── Security Manager (RBAC/Policies)
├── Provenance Generator (Attestation)
└── Attestation System (Cryptographic)
```

## 📚 Related Documentation

- [KGEN Core Documentation](../README.md)
- [Template Engine Documentation](../templating/README.md)
- [Office Processing Documentation](../office/README.md)
- [LaTeX Integration Documentation](../latex/README.md)
- [Semantic Processing Documentation](../query/README.md)
- [Security Framework Documentation](../security/README.md)
- [Provenance System Documentation](../provenance/README.md)

---

**Document Generation Agent 11 Integration Complete** ✅

This integration successfully brings together:
- ✅ Unjucks' mature Office document processing
- ✅ LaTeX compilation and PDF generation  
- ✅ KGEN's deterministic template engine
- ✅ Semantic knowledge graph integration
- ✅ Enterprise-grade security and compliance
- ✅ Cryptographic provenance and attestation
- ✅ Document-specific frontmatter workflows
- ✅ Comprehensive testing and validation

The system maintains 100% compatibility with existing Unjucks templates while adding powerful new capabilities for enterprise document generation workflows.