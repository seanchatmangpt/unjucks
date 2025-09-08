# Specification Validation System

A comprehensive specification validation system that validates specification format and completeness using Zod schemas, integrates with MCP tools for AI-powered validation, and checks specifications against enterprise compliance requirements.

## Features

- **🔍 Format Validation**: Zod schema-based validation for specification structure
- **📋 Completeness Checking**: Validates requirements, architecture, and cross-section consistency  
- **🤖 AI-Powered Validation**: MCP integration for intelligent specification analysis
- **⚖️ Enterprise Compliance**: Checks against ISO 27001, GDPR, PCI DSS, SOX, and NIST CSF
- **📊 Detailed Reporting**: Multi-format reports (JSON, HTML, Markdown, PDF)
- **⚡ High Performance**: Parallel validation with caching and optimization
- **🔧 Configurable**: Flexible rule engine with custom validators

## Quick Start

```typescript
import { specValidation } from './src/core/spec-validation/index.js';

// Validate a specification
const result = await specValidation.validateSpecification(specification, {
  includeAI: true,
  includeCompliance: true,
  format: 'json'
});

console.log(`Status: ${result.status}`);
console.log(`Issues: ${result.summary.errors} errors, ${result.summary.warnings} warnings`);
```

## Architecture

```
src/core/spec-validation/
├── schemas/                    # Zod validation schemas
│   ├── specification.schema.ts # Main specification structure
│   └── validation-config.schema.ts # Configuration schema
├── validators/                 # Core validation logic  
│   └── specification.validator.ts # Format & completeness validation
├── integration/               # External integrations
│   └── mcp.integration.ts     # MCP tools for AI validation
├── compliance/                # Enterprise compliance checking
│   └── enterprise.compliance.ts # Standards validation
├── reports/                   # Report generation
│   └── validation.reporter.ts # Multi-format reporting
├── config/                    # Configuration management
│   └── validation.config.ts   # Config loading & defaults
├── types/                     # TypeScript definitions
│   └── validation.types.ts    # Core type definitions
└── index.ts                   # Main pipeline orchestrator
```

## Validation Pipeline

The validation system follows a structured pipeline:

1. **🔍 Format Validation**: Zod schema validation for structure
2. **📋 Completeness Validation**: Business logic and consistency checks
3. **🤖 AI-Powered Analysis**: Optional MCP integration for insights
4. **⚖️ Compliance Checking**: Enterprise standards validation  
5. **📊 Report Generation**: Multi-format output with recommendations

## Specification Schema

The system validates specifications against a comprehensive schema:

```typescript
interface Specification {
  metadata: {
    id: string;
    name: string; 
    version: string; // Semantic version
    description: string;
    author: AuthorInfo;
    created: string; // ISO datetime
    lastModified: string;
    tags: string[];
    category: 'api' | 'component' | 'service' | 'module' | 'system' | 'process';
    status: 'draft' | 'review' | 'approved' | 'deprecated';
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
  summary: {
    purpose: string;
    scope: string; 
    stakeholders: Stakeholder[];
    assumptions?: string[];
    constraints?: string[];
  };
  requirements: Requirement[];
  architecture?: Architecture;
  implementation?: Implementation;
  testing?: Testing;
  documentation?: Documentation;
  compliance?: ComplianceInfo[];
}
```

## Validation Rules

### Format Rules
- **schema-validation**: Validates against Zod schema
- **requirement-completeness**: Ensures adequate requirement detail
- **requirement-traceability**: Validates dependencies and uniqueness
- **architecture-consistency**: Checks component relationships

### AI Rules (via MCP)
- **ai-completeness-check**: AI analysis of specification completeness
- **ai-consistency-check**: Cross-section consistency analysis 
- **ai-quality-assessment**: Overall quality and clarity evaluation
- **ai-risk-analysis**: Risk identification and mitigation suggestions

### Compliance Rules
- **compliance-iso-27001**: ISO 27001 security requirements
- **compliance-gdpr**: GDPR data protection requirements
- **compliance-pci-dss**: Payment card security standards
- **compliance-sox**: Sarbanes-Oxley financial controls
- **compliance-nist-csf**: NIST Cybersecurity Framework

## Configuration

Configure validation behavior through `ValidationConfig`:

```typescript
const config = {
  version: '1.0.0',
  rules: [
    {
      id: 'schema-validation',
      name: 'Schema Validation',
      category: 'format',
      severity: 'error', 
      enabled: true
    }
  ],
  ai: {
    enabled: true,
    models: [{
      provider: 'claude',
      model: 'claude-3-sonnet',
      temperature: 0.1
    }],
    confidence: { threshold: 0.8 }
  },
  reports: {
    formats: ['json', 'html'],
    outputPath: './validation-reports'
  }
};
```

## Enterprise Compliance

The system supports major enterprise compliance standards:

### ISO 27001 (Information Security)
- Information security policies (A.5.1)
- Asset management (A.8.1) 
- Access control (A.9)
- Cryptography (A.10)

### GDPR (Data Protection)
- Data protection by design (Art. 25)
- Lawfulness of processing (Art. 5)
- Security of processing (Art. 32)
- Breach notification (Art. 33)

### PCI DSS (Payment Security)
- Network security controls (Req. 1)
- Data encryption (Req. 3-4)
- Access controls (Req. 8)

### SOX (Financial Controls)
- Corporate responsibility (302)
- Internal controls (404)
- Real-time disclosure (409)

### NIST CSF (Cybersecurity)
- Identify (ID)
- Protect (PR) 
- Detect (DE)
- Respond (RS)
- Recover (RC)

## MCP Integration

The system integrates with MCP (Model Context Protocol) tools for AI-powered validation:

```typescript
// MCP tools used for AI validation
await mcp__claude_flow__task_orchestrate({
  task: 'specification-completeness-analysis',
  strategy: 'adaptive', 
  priority: 'high'
});
```

AI validation provides:
- **Completeness Analysis**: Identifies missing sections and details
- **Consistency Checking**: Detects contradictions between sections
- **Quality Assessment**: Evaluates clarity and precision
- **Risk Analysis**: Identifies implementation and business risks

## Validation Results

Results include comprehensive metrics and recommendations:

```typescript
interface ValidationResult {
  id: string;
  status: 'passed' | 'failed' | 'warning';
  issues: ValidationIssue[];
  metrics: {
    totalRules: number;
    rulesPassed: number; 
    rulesFailed: number;
    executionTime: number;
    coverage: CoverageMetrics;
    complexity: ComplexityMetrics;
  };
  recommendations: Recommendation[];
  aiInsights?: AIValidationInsight[];
  complianceStatus?: ComplianceStatus[];
}
```

## Report Formats

Generate reports in multiple formats:

- **JSON**: Machine-readable structured data
- **HTML**: Interactive web report with charts
- **Markdown**: Documentation-friendly format  
- **PDF**: Print-ready professional report (via HTML conversion)

## Performance

The system is optimized for performance:

- **Parallel Validation**: Rules execute concurrently
- **Caching**: Results cached with TTL
- **Streaming**: Large specifications processed efficiently
- **Timeout Management**: Configurable timeouts prevent hanging
- **Memory Optimization**: Efficient processing of large specifications

## Error Handling

Robust error handling ensures reliable operation:

- **Graceful Degradation**: AI failures don't stop validation
- **Detailed Error Context**: Clear error messages with context
- **Recovery**: Automatic retry for transient failures
- **Logging**: Comprehensive logging for debugging

## Testing

Comprehensive test coverage:

```bash
# Run validation system tests
npm test -- tests/core/spec-validation

# Run specific test suite
npm test -- tests/core/spec-validation/schemas
npm test -- tests/core/spec-validation/validators  
npm test -- tests/core/spec-validation/integration
```

## Usage Examples

### Basic Validation

```typescript
import { SpecificationValidationPipeline } from './src/core/spec-validation/index.js';

const pipeline = new SpecificationValidationPipeline();
const result = await pipeline.validateSpecification(specification);

if (result.status === 'passed') {
  console.log('✅ Specification is valid');
} else {
  console.log('❌ Validation failed');
  result.issues.forEach(issue => {
    console.log(`${issue.severity}: ${issue.message}`);
  });
}
```

### Batch Validation

```typescript
const specifications = [
  { id: 'spec-1', data: spec1 },
  { id: 'spec-2', data: spec2 }
];

const results = await pipeline.validateBatch(specifications, {
  parallel: true,
  includeAI: true
});
```

### Custom Configuration

```typescript
const config = pipeline.getConfig();

// Add custom rule
config.addRule({
  id: 'custom-naming',
  name: 'Custom Naming Convention', 
  category: 'format',
  severity: 'warning',
  enabled: true
});

// Disable AI validation
pipeline.updateConfig({
  ai: { enabled: false }
});
```

### Compliance-Only Validation

```typescript
const result = await pipeline.validateSpecification(specification, {
  includeCompliance: true,
  includeAI: false,
  standardIds: ['iso-27001', 'gdpr']
});
```

## Sample Specification

See [examples/sample-specification.json](examples/sample-specification.json) for a complete specification example that demonstrates all features and passes validation.

## API Reference

### Main Classes

- **`SpecificationValidationPipeline`**: Main orchestrator class
- **`SpecificationValidator`**: Core format/completeness validation
- **`MCPValidationIntegration`**: AI-powered validation via MCP
- **`EnterpriseComplianceChecker`**: Standards compliance validation
- **`ValidationReporter`**: Multi-format report generation
- **`ValidationConfigManager`**: Configuration management

### Key Methods

```typescript
// Validate single specification
validateSpecification(spec: unknown, options?: ValidationOptions): Promise<ValidationResult>

// Validate multiple specifications  
validateBatch(specs: Array<{id: string, data: unknown}>, options?: ValidationOptions): Promise<ValidationResult[]>

// Get/update configuration
getConfig(): ValidationConfigManager
updateConfig(updates: Partial<ValidationConfig>): void
```

## Contributing

1. Follow the established patterns in the codebase
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure compliance checks work with new standards
5. Test MCP integration thoroughly

## License

This specification validation system is part of the unjucks project and follows the same licensing terms.