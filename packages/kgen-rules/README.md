# KGEN Rules - Validation Engine

Single validator entry point for KGEN with JSON reporting and boolean status.

## Features

- **Single Validator Function**: `validateGraph({ttl, shacl})` 
- **JSON Report Format**: Structured validation results with `ok` boolean
- **SHACL Constraint Validation**: Detailed error reporting with paths, messages, and constraint types
- **Direct Function Calls**: No shell execution, direct CLI integration
- **Performance Metrics**: Validation duration and graph statistics

## Installation

```bash
npm install @kgen/rules
```

## Usage

### Basic Validation

```javascript
import { validateGraph } from '@kgen/rules';

const result = await validateGraph({
  ttl: `
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    
    ex:person1 a foaf:Person ;
        foaf:name "John Doe" ;
        foaf:age 30 .
  `,
  shacl: `
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    
    ex:PersonShape a sh:NodeShape ;
        sh:targetClass foaf:Person ;
        sh:property [
            sh:path foaf:name ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
        ] .
  `
});

console.log(result.ok); // true/false
console.log(result.errors); // Array of validation errors
```

## Report Format

```javascript
{
  ok: boolean,                    // Overall validation status
  errors: [                      // Array of validation errors
    {
      path: string|null,          // Focus node path
      message: string,            // Error message
      constraint: string,         // Constraint type that failed
      value: string|null          // Value that caused the error
    }
  ],
  graph: {
    tripleCount: number,          // Number of triples in graph
    valid: boolean               // Graph validation status
  },
  validation: {
    duration: number,             // Validation time in milliseconds
    shapesCount: number          // Number of SHACL shapes
  }
}
```

## CLI Integration

The validator is designed for direct CLI usage without shell execution:

```javascript
import { validateGraph } from '@kgen/rules';

// Direct function call - no subprocess
const report = await validateGraph({ ttl, shacl });

// Check validation status
if (report.ok) {
  console.log('✅ Validation passed');
} else {
  console.log('❌ Validation failed');
  report.errors.forEach(error => {
    console.log(`  ${error.constraint}: ${error.message}`);
  });
}
```

## Multiple Graph Validation

```javascript
import { validateMultipleGraphs, createSummaryReport } from '@kgen/rules';

const validations = [
  { ttl: graph1, shacl: shapes1 },
  { ttl: graph2, shacl: shapes2 }
];

const results = await validateMultipleGraphs(validations);
const summary = createSummaryReport(results);

console.log(`${summary.summary.validGraphs}/${summary.summary.totalGraphs} graphs passed validation`);
```

## Custom Constraints

```javascript
import { validateGraphWithCustomConstraints } from '@kgen/rules';

const customConstraint = {
  async validate(ttl) {
    // Custom validation logic
    return []; // Return array of errors or empty array
  }
};

const result = await validateGraphWithCustomConstraints({
  ttl,
  shacl,
  customConstraints: [customConstraint]
});
```

## Error Types

- **system-error**: Parsing or system errors
- **shape-constraint**: SHACL shape violations  
- **minCount**: Minimum cardinality violations
- **maxCount**: Maximum cardinality violations
- **datatype**: Datatype constraint violations
- **minInclusive/maxInclusive**: Numeric range violations
- **pattern**: Regex pattern violations
- **custom-constraint**: Custom validation errors

## Performance

- Validation duration reported in milliseconds
- Triple count and shapes count included in metrics
- Optimized for direct CLI integration
- No shell execution overhead

## API Reference

### validateGraph(options)

Main validation function.

**Parameters:**
- `options.ttl` (string): RDF graph in Turtle format
- `options.shacl` (string): SHACL shapes in Turtle format

**Returns:** Promise<ValidationReport>

### validateMultipleGraphs(validations)

Validates multiple graphs in sequence.

**Parameters:**
- `validations` (Array): Array of {ttl, shacl} objects

**Returns:** Promise<Array<ValidationReport>>

### createSummaryReport(reports)

Creates summary from multiple validation reports.

**Parameters:**
- `reports` (Array): Array of validation reports

**Returns:** SummaryReport

### validateGraphWithCustomConstraints(options)

Validates with additional custom constraints.

**Parameters:**
- `options.ttl` (string): RDF graph
- `options.shacl` (string): SHACL shapes  
- `options.customConstraints` (Array): Custom constraint checkers

**Returns:** Promise<ValidationReport>

## License

MIT