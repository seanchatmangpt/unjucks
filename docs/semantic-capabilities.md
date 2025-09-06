# Semantic Capabilities

Unjucks provides advanced semantic web capabilities using N3/TTL integration for enterprise code generation with intelligent reasoning and compliance validation.

## Overview

The semantic features enable:

- **RDF-based template validation** using enterprise compliance schemas
- **N3 rule-based reasoning** for intelligent code generation context
- **SPARQL-like querying** of enterprise knowledge graphs
- **Semantic compliance checking** against governance policies (SOX, GDPR, HIPAA, etc.)

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Templates     │    │   Semantic       │    │   Compliance    │
│   + Metadata    │───▶│   Server         │───▶│   Validation    │
└─────────────────┘    │   (N3 Reasoning) │    └─────────────────┘
                       └──────────────────┘
                                │
                       ┌──────────────────┐
                       │   Knowledge      │
                       │   Graph Query    │
                       └──────────────────┘
```

## MCP Tools

### 1. `unjucks_semantic_validate`

Validates templates using RDF-based semantic schemas and N3 reasoning.

```typescript
// Usage example
const request = {
  templatePath: 'src/templates/api-service.njk',
  compliance: ['SOX', 'GDPR', 'API_GOVERNANCE'],
  strictMode: false,
  outputFormat: 'json'
};

// Returns validation results with compliance score and violations
```

**Features:**
- Enterprise compliance schema validation
- Multi-format output (JSON, Turtle, Summary)
- Detailed violation reports with remediation suggestions
- Configurable strictness levels

### 2. `unjucks_reasoning_apply`

Applies N3 rule-based reasoning to enhance template context for intelligent code generation.

```typescript
// Usage example
const request = {
  templateVars: {
    isPublic: true,
    processesFinancialData: true,
    expectedRpm: 2000
  },
  rules: ['path/to/enterprise-governance.n3'],
  premises: ['path/to/sox-compliance.ttl'],
  depth: 3,
  mode: 'forward'
};

// Returns enhanced template context with inferred properties
```

**Features:**
- Forward/backward/hybrid reasoning modes
- Configurable reasoning depth
- Template context enhancement
- Inference tracking and explanation

### 3. `unjucks_knowledge_query`

Queries enterprise knowledge graphs using SPARQL-like patterns.

```typescript
// Usage example
const request = {
  query: {
    pattern: {
      predicate: 'http://unjucks.dev/api/generatesEndpoint'
    },
    reasoning: true,
    limit: 10
  },
  outputFormat: 'table'
};

// Returns formatted query results with enterprise insights
```

**Features:**
- Pattern-based querying
- Multiple output formats (JSON, CSV, Table, Turtle)
- Reasoning-enhanced queries
- Enterprise pattern detection

### 4. `unjucks_compliance_check`

Validates template compliance with enterprise governance policies.

```typescript
// Usage example
const request = {
  templatePath: 'src/templates/financial-service.njk',
  policies: ['SOX', 'GDPR', 'API_GOVERNANCE'],
  generateReport: true,
  outputFormat: 'html'
};

// Returns comprehensive compliance report with recommendations
```

**Features:**
- Multi-policy compliance checking
- Detailed HTML/Markdown/PDF reports
- Remediation recommendations
- Governance workflow integration

## Enterprise Compliance Schemas

### SOX (Sarbanes-Oxley) Compliance

```turtle
@prefix sox: <http://compliance.enterprise.org/sox/> .
@prefix template: <http://unjucks.dev/template/> .

# Financial data requires audit trails
{ ?template template:hasFinancialData true }
=> { ?template sox:requiresAuditTrail true ;
               sox:dataRetentionPeriod "P7Y" ;
               sox:requiresAccessControl true } .
```

**Key Requirements:**
- Audit trail implementation
- 7-year data retention
- Role-based access control
- Change management controls
- Segregation of duties

### GDPR Compliance

```turtle
@prefix gdpr: <http://compliance.enterprise.org/gdpr/> .
@prefix data: <http://unjucks.dev/data/> .

# Personal data processing requires consent
{ ?template data:processesPersonalData true }
=> { ?template gdpr:requiresConsent true ;
               gdpr:dataRetentionMax "P2Y" ;
               gdpr:supportsErasure true } .
```

**Key Requirements:**
- Consent collection and management
- Data subject rights (access, erasure, portability)
- Privacy by design principles
- Data protection impact assessments
- Breach notification procedures

### API Governance

```turtle
@prefix api: <http://unjucks.dev/api/> .
@prefix security: <http://unjucks.dev/security/> .

# Public APIs require security controls
{ ?template api:isPublic true }
=> { ?template api:requiresAuthentication true ;
               api:requiresRateLimiting true ;
               api:requiresInputValidation true } .
```

**Key Requirements:**
- Authentication and authorization
- Rate limiting and throttling
- Input validation and output sanitization
- API versioning and documentation
- Security monitoring and logging

## N3 Reasoning Rules

### Enterprise Governance Rules

The system includes comprehensive N3 rules for enterprise scenarios:

```n3
# Rule: High-volume APIs need advanced rate limiting
{ 
  ?template api:generatesEndpoint true .
  ?template api:expectedRequestsPerMinute ?rpm .
  ?rpm math:greaterThan 1000
}
=>
{
  ?template api:requiresAdvancedRateLimiting true ;
            api:requiresLoadBalancing true ;
            monitoring:requiresRealTimeMetrics true .
} .
```

### Pattern Categories

- **API Security Patterns** - Authentication, authorization, rate limiting
- **Data Protection Patterns** - Encryption, anonymization, access controls
- **Compliance Patterns** - Audit trails, retention policies, reporting
- **Performance Patterns** - Caching, load balancing, monitoring
- **Architecture Patterns** - Microservices, event-driven, real-time

## Knowledge Graph Integration

### Enterprise Ontologies

The system provides rich ontologies for:

```turtle
# Template categorization
template:Template a owl:Class ;
    rdfs:label "Template"@en ;
    rdfs:comment "Code generation template with semantic annotations"@en .

# Enterprise specializations
enterprise:ComplianceTemplate rdfs:subClassOf template:Template ;
    rdfs:label "Compliance Template"@en .

enterprise:SecurityTemplate rdfs:subClassOf template:Template ;
    rdfs:label "Security Template"@en .
```

### Semantic Properties

Templates can be annotated with semantic properties:

```turtle
template:processesFinancialData a owl:DatatypeProperty ;
    rdfs:domain template:Template ;
    rdfs:range xsd:boolean .

template:isRealTimeSystem a owl:DatatypeProperty ;
    rdfs:domain template:Template ;
    rdfs:range xsd:boolean .
```

## Usage Examples

### 1. Financial Service Template Validation

```bash
# Validate financial service template against SOX
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "method": "unjucks_semantic_validate",
    "params": {
      "templatePath": "templates/financial-service.njk",
      "compliance": ["SOX", "API_GOVERNANCE"],
      "outputFormat": "json"
    }
  }'
```

### 2. API Template with Reasoning Enhancement

```bash
# Apply reasoning to enhance API template context
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "method": "unjucks_reasoning_apply",
    "params": {
      "templateVars": {
        "isPublic": true,
        "expectedRpm": 5000,
        "processesPersonalData": true
      },
      "rules": ["rules/enterprise-governance.n3"],
      "depth": 3
    }
  }'
```

### 3. Compliance Report Generation

```bash
# Generate comprehensive compliance report
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "method": "unjucks_compliance_check",
    "params": {
      "templatePath": "templates/user-service.njk",
      "policies": ["GDPR", "API_GOVERNANCE"],
      "generateReport": true,
      "outputFormat": "html"
    }
  }'
```

## Integration with Existing Features

### RDF Filters Enhancement

The semantic server enhances existing RDF filters:

```typescript
import { SemanticServer } from 'unjucks/semantic-server';
import { RDFFilters } from 'unjucks/rdf-filters';

const semanticServer = new SemanticServer();
const rdfFilters = new RDFFilters({ 
  store: semanticServer.getStore() 
});

// Use enhanced RDF filters in templates
```

### Template Processing Pipeline

```typescript
// Semantic-enhanced template processing
const templateProcessor = new TemplateProcessor({
  semanticValidation: true,
  complianceSchemas: ['SOX', 'GDPR'],
  reasoningRules: ['enterprise-governance.n3']
});

const result = await templateProcessor.generate(
  'api-service.njk', 
  variables
);
```

## Development and Testing

### Running Semantic Tests

```bash
# Run semantic server unit tests
npm run test tests/unit/semantic-server.test.ts

# Run MCP tools integration tests
npm run test tests/integration/semantic-mcp-tools.test.ts

# Run semantic capabilities demo
npm run demo:semantic
```

### Custom Compliance Schemas

Create custom compliance schemas in Turtle format:

```turtle
# custom-compliance.ttl
@prefix custom: <http://myorg.com/compliance/> .
@prefix template: <http://unjucks.dev/template/> .

custom:InternalApiPolicy a owl:Class ;
    rdfs:label "Internal API Policy" .

{ ?template template:isInternalApi true }
=> { ?template custom:requiresVpnAccess true ;
               custom:requiresInternalAuth true } .
```

### Custom Reasoning Rules

Add domain-specific reasoning rules:

```n3
# custom-rules.n3
@prefix myorg: <http://myorg.com/ontology/> .
@prefix template: <http://unjucks.dev/template/> .

# Custom business logic rules
{ ?template myorg:isCustomerFacing true }
=> { ?template myorg:requiresUxReview true ;
               myorg:requiresAccessibilityTesting true } .
```

## Performance Considerations

### Reasoning Depth

- **Depth 1-2**: Basic compliance checking (fast)
- **Depth 3-5**: Comprehensive inference (moderate)
- **Depth 5+**: Deep reasoning (slower, for complex scenarios)

### Knowledge Graph Size

- Templates: ~1K-10K triples typical
- Enterprise schemas: ~10K-100K triples
- Rule bases: ~100-1K rules

### Caching Strategy

- Compiled rule sets cached in memory
- Template validation results cached by content hash
- Knowledge graph queries cached by pattern

## Security Considerations

- **Schema Validation**: All RDF inputs validated before processing
- **Rule Sandboxing**: N3 rules executed in isolated context
- **Access Control**: Semantic APIs require proper authentication
- **Audit Logging**: All semantic operations logged for compliance

## Best Practices

### Template Design

1. **Semantic Annotations**: Use RDF frontmatter for rich metadata
2. **Compliance Tags**: Tag templates with applicable policies
3. **Reasoning Context**: Provide sufficient context for rule inference
4. **Documentation**: Document semantic properties and expectations

### Rule Development

1. **Modular Rules**: Organize rules by domain and policy
2. **Rule Testing**: Test rules with representative data
3. **Performance**: Profile rule execution for optimization
4. **Validation**: Validate rule syntax and semantics

### Schema Management

1. **Versioning**: Version control all schemas and rules
2. **Documentation**: Document schema purposes and usage
3. **Testing**: Test schemas against real-world templates
4. **Evolution**: Plan for schema evolution and migration

## Troubleshooting

### Common Issues

1. **N3 Parsing Errors**: Check rule syntax with N3 validator
2. **Memory Issues**: Reduce reasoning depth or optimize rules
3. **Performance**: Profile queries and add appropriate indexing
4. **Validation Failures**: Check template metadata completeness

### Debug Mode

Enable debug logging:

```typescript
const semanticServer = new SemanticServer({
  debug: true,
  logLevel: 'debug'
});
```

### Monitoring

Monitor semantic operations:

```typescript
// Track reasoning performance
console.log(`Reasoning completed: ${result.metadata.executionTime}ms`);
console.log(`Facts derived: ${result.derivedFacts.length}`);
console.log(`Rules applied: ${result.metadata.rulesApplied}`);
```

## Future Enhancements

### Planned Features

- **SHACL Validation**: Shape-based validation support
- **SWRL Rules**: More expressive rule language
- **Federated Queries**: Query across distributed knowledge graphs
- **Machine Learning**: AI-enhanced rule discovery
- **Visual Tools**: GUI for rule and schema development

### Integration Roadmap

- **IDE Plugins**: VS Code extension for semantic validation
- **CI/CD Integration**: Automated compliance checking in pipelines
- **Enterprise Systems**: Integration with governance platforms
- **API Management**: Integration with API gateway policies

## Resources

### W3C Standards

- [RDF 1.1](https://www.w3.org/TR/rdf11-concepts/)
- [Turtle](https://www.w3.org/TR/turtle/)
- [N3](https://www.w3.org/TeamSubmission/n3/)
- [OWL 2](https://www.w3.org/TR/owl2-overview/)
- [SPARQL 1.1](https://www.w3.org/TR/sparql11-query/)

### Libraries and Tools

- [N3.js](https://github.com/rdfjs/N3.js) - RDF processing library
- [SHACL.js](https://github.com/TopQuadrant/shacl-js) - Shape validation
- [Comunica](https://comunica.dev/) - Federated query engine

### Compliance Resources

- [SOX Compliance](https://www.sec.gov/about/laws/soa2002.pdf)
- [GDPR Guide](https://gdpr.eu/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [API Security OWASP](https://owasp.org/www-project-api-security/)

The semantic capabilities provide a powerful foundation for enterprise-grade code generation with built-in intelligence, compliance, and governance. By leveraging semantic web technologies, Unjucks can understand template context, apply business rules, and ensure generated code meets enterprise requirements automatically.