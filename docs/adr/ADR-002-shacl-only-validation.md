# ADR-002: SHACL-Only Validation

## Status
**Accepted** - 2024-12-01

## Context

KGEN v1 requires comprehensive validation of:
- RDF knowledge graphs for semantic consistency
- Generated artifacts for structural correctness  
- Template contexts for completeness and type safety
- Policy compliance for governance requirements

Traditional validation approaches mix imperative validation logic with declarative data models, creating maintenance overhead and reducing portability. Custom validation frameworks require specialized expertise and lack standardization.

The Web standards community has developed SHACL (Shapes Constraint Language) as a W3C recommendation for RDF graph validation, providing a mature, declarative approach to constraint specification.

## Decision

**Use SHACL exclusively for all validation in KGEN v1.**

All validation logic will be expressed as SHACL shapes with zero custom validation code:

### Validation Architecture
```
rules/
├── knowledge-shapes.ttl    # RDF graph structure validation
├── artifact-shapes.ttl     # Generated artifact constraints
├── template-shapes.ttl     # Template context requirements
├── policy-shapes.ttl       # Governance policy enforcement
└── meta-shapes.ttl        # SHACL shape validation
```

### Implementation Approach
- **Shape Libraries**: Reusable constraint patterns for common validation scenarios
- **Composition**: Complex validations built from primitive shape components
- **Reporting**: Standardized SHACL validation reports with actionable error messages
- **Integration**: SHACL validation integrated into all KGEN processing pipelines

## Consequences

### Positive
✅ **Declarative Constraints**: All validation logic expressed as data, not code  
✅ **Standard Compliance**: W3C recommendation ensures long-term stability  
✅ **Tool Interoperability**: SHACL shapes work with any compliant validator  
✅ **No Custom Logic**: Eliminates maintenance overhead of custom validation frameworks  
✅ **Composable Patterns**: Reusable shape libraries accelerate constraint development  
✅ **Machine Readable**: Validation rules become part of the knowledge graph  
✅ **Version Control**: Shape evolution tracked alongside other project artifacts  

### Negative
❗ **Learning Curve**: Teams must learn SHACL syntax and constraint patterns  
❗ **Performance**: SHACL validation may be slower than optimized custom code  
❗ **Expressiveness Limits**: Some validation patterns difficult to express in SHACL  
❗ **Tooling Maturity**: SHACL tooling less mature than general-purpose validation  
❗ **Error Messages**: Generic SHACL errors may be less user-friendly than custom messages  

### Mitigations
- **Training Materials**: Comprehensive SHACL guides and pattern libraries
- **Performance Testing**: Benchmark SHACL validation against performance targets  
- **Custom Functions**: SPARQL functions for complex validation patterns when needed
- **Tooling Investment**: Contribute to SHACL tooling ecosystem improvements
- **Message Templates**: Standardized error message templates for common violations

## Implementation Details

### Core Validation Patterns

#### Knowledge Graph Structure
```turtle
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix kgen: <https://kgen.dev/ontology#> .

kgen:DomainEntityShape
  a sh:NodeShape ;
  sh:targetClass kgen:DomainEntity ;
  sh:property [
    sh:path kgen:hasName ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
  ] ;
  sh:property [
    sh:path kgen:hasDescription ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
  ] .
```

#### Template Context Requirements
```turtle
kgen:RestAPIContextShape
  a sh:NodeShape ;
  sh:targetClass kgen:RestAPIContext ;
  sh:property [
    sh:path kgen:hasServiceName ;
    sh:datatype xsd:string ;
    sh:pattern "^[a-zA-Z][a-zA-Z0-9-]*$" ;
    sh:minCount 1 ;
  ] ;
  sh:property [
    sh:path kgen:hasEndpoints ;
    sh:minCount 1 ;
    sh:node kgen:EndpointShape ;
  ] .
```

#### Policy Compliance
```turtle
kgen:SecurityPolicyShape
  a sh:NodeShape ;
  sh:targetClass kgen:GeneratedArtifact ;
  sh:property [
    sh:path kgen:hasSecurityAnnotations ;
    sh:minCount 1 ;
    sh:message "Generated artifacts must include security annotations" ;
  ] ;
  sh:property [
    sh:path kgen:usesDeprecatedPatterns ;
    sh:hasValue false ;
    sh:message "Deprecated patterns are not allowed in generated code" ;
  ] .
```

### Validation Pipeline Integration
```javascript
// Core validation function
async function validateWithSHACL(dataGraph, shapesGraph) {
  const validator = new SHACLValidator(shapesGraph);
  const report = await validator.validate(dataGraph);
  
  return {
    conforms: report.conforms,
    violations: report.violations.map(formatViolation),
    summary: generateValidationSummary(report)
  };
}
```

### Performance Optimizations
- **Shape Compilation**: Pre-compile SHACL shapes for faster validation
- **Incremental Validation**: Validate only changed graph portions when possible
- **Parallel Processing**: Concurrent validation of independent shape constraints
- **Caching**: Cache validation results for unchanged graph/shape combinations

## Shape Library Organization

### Core Shapes
- **kgen:ArtifactShape**: Base constraints for all generated artifacts
- **kgen:TemplateShape**: Requirements for template structure and metadata
- **kgen:ContextShape**: Base class for template context validation
- **kgen:ProvenanceShape**: Attestation and provenance data requirements

### Domain-Specific Shapes
- **kgen:APIShape**: REST/GraphQL API artifact constraints
- **kgen:ConfigShape**: Configuration file structure requirements
- **kgen:DocumentationShape**: Generated documentation quality standards
- **kgen:TestShape**: Test artifact completeness and structure

### Policy Shapes
- **kgen:SecurityShape**: Security policy compliance validation
- **kgen:QualityShape**: Code quality and maintainability standards
- **kgen:ComplianceShape**: Regulatory and organizational requirements
- **kgen:PerformanceShape**: Performance and efficiency constraints

## Error Handling and Reporting

### Standardized Error Messages
```turtle
kgen:ValidationErrorTemplate
  sh:message "Required property {$property} missing from {$focusNode}" ;
  sh:severity sh:Violation ;
  kgen:suggestedAction "Add the required property to satisfy the constraint" ;
  kgen:documentationLink "https://docs.kgen.dev/validation#required-properties" .
```

### Validation Report Structure
```json
{
  "conforms": false,
  "violations": [
    {
      "severity": "Violation", 
      "focusNode": "ex:Entity123",
      "property": "kgen:hasName",
      "message": "Required property kgen:hasName missing from ex:Entity123",
      "suggestedAction": "Add the required property to satisfy the constraint",
      "documentationLink": "https://docs.kgen.dev/validation#required-properties"
    }
  ],
  "summary": {
    "totalViolations": 1,
    "violationsBySeverity": { "Violation": 1, "Warning": 0 },
    "affectedNodes": 1
  }
}
```

## Related Decisions
- **ADR-001**: Git-First Workflow provides version control for SHACL shapes
- **ADR-003**: Provenance Model uses SHACL shapes for attestation validation

## Migration Strategy

### Phase 1: Core Infrastructure
- Implement SHACL validation engine integration
- Create base shape library with fundamental constraints
- Establish validation reporting and error handling

### Phase 2: Domain Expansion  
- Develop domain-specific shapes for common artifact types
- Create policy enforcement shapes for governance requirements
- Establish shape composition patterns and best practices

### Phase 3: Advanced Features
- Implement custom SPARQL functions for complex patterns
- Develop shape testing and validation frameworks
- Create automated shape generation from examples

## Review Date
**Next Review**: 2025-03-01  
**Trigger Events**: SHACL specification updates, performance issues, or expressiveness limitations

---
**Decision Record Metadata**
- **Authors**: KGEN Architecture Team, Semantic Web Working Group
- **Reviewers**: Development Teams, Governance Stakeholders
- **Status**: Accepted  
- **Implementation**: Complete in KGEN v1.0.0
- **Dependencies**: SHACL-Engine library, RDF processing infrastructure