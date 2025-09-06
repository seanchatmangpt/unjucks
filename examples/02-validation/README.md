# Semantic Validation Examples

This example demonstrates how to validate generated files against semantic rules using SHACL (Shapes Constraint Language) and RDF validation.

## Files Structure

- `data/validation-rules.ttl` - SHACL shapes defining validation constraints
- `data/invalid-data.ttl` - Example data that violates constraints
- `data/valid-data.ttl` - Example data that passes validation
- `scripts/validate.js` - Validation script using SHACL

## Validation Types

### 1. Schema Validation
- Ensures required fields are present
- Validates data types and formats
- Checks cardinality constraints

### 2. Business Rule Validation
- Validates business logic constraints
- Checks relationships between entities
- Enforces domain-specific rules

### 3. Template Output Validation
- Validates generated code syntax
- Ensures semantic consistency
- Checks for missing required sections

## Running Validation

```bash
# Validate data against SHACL shapes
node ./scripts/validate.js ./data/valid-data.ttl
node ./scripts/validate.js ./data/invalid-data.ttl

# Generate and validate in one step
unjucks generate api-client --data ./data/api-schema.ttl --validate
```

## Key Concepts

### SHACL Shapes

```turtle
:UserShape a sh:NodeShape ;
    sh:targetClass :User ;
    sh:property [
        sh:path :name ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:minLength 1 ;
        sh:maxLength 255
    ] .
```

### Validation Results

The validator returns:
- **Conforms**: Boolean indicating if data is valid
- **Results**: List of validation violations
- **Severity**: Error levels (sh:Violation, sh:Warning, sh:Info)

## Benefits

1. **Early Error Detection**: Catch issues before code generation
2. **Consistency**: Ensure all generated code follows the same patterns
3. **Documentation**: Validation rules serve as living documentation
4. **Quality Assurance**: Automated quality checks for generated artifacts