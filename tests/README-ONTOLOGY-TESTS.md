# Ontology-to-Project Generation BDD Tests

Comprehensive BDD test suite for ontology-to-project scaffolding using **London School TDD**.

## Test Coverage

### Feature Files
- `/tests/features/ontology-project-generation.feature` - Complete BDD scenarios

### Step Definitions
- `/tests/features/step_definitions/ontology_project_steps.js` - London School implementation with mocks

### Fixtures
- `/tests/fixtures/ontologies/simple.ttl` - 5 classes, 15 properties, 8 relationships
- `/tests/fixtures/ontologies/complex.ttl` - 1000+ classes for performance testing
- `/tests/fixtures/ontologies/with-imports.ttl` - FOAF + W3C Time imports
- `/tests/fixtures/ontologies/circular.ttl` - Circular dependency testing
- `/tests/fixtures/ontologies/incomplete.ttl` - Invalid ontology (missing classes)
- `/tests/fixtures/ontologies/i18n.ttl` - Multi-language labels (en, es, fr)
- `/tests/fixtures/ontologies/shapes.ttl` - SHACL validation shapes

## Running Tests

```bash
# Run all ontology tests
npm run test:ontology

# Run with coverage
npm run test:ontology -- --coverage

# Run specific scenario
npm run test:ontology -- -t "Generate TypeScript interfaces"

# Watch mode for TDD
npm run test:ontology -- --watch

# Generate coverage report
npm run test:ontology -- --coverage --reporter=html
```

## Test Scenarios

### ✅ Core Generation (15 scenarios)

1. **Generate TypeScript interfaces from ontology classes**
   - Creates `src/models/*.ts` with interfaces
   - Maps RDF properties to TypeScript types
   - Handles relationships and imports

2. **Generate API routes from relationships**
   - Creates REST endpoints (GET, POST, PUT, DELETE)
   - Generates relationship routes (e.g., `/api/person/:id/organization`)

3. **Generate database schemas with relationships**
   - Creates SQL schema files with foreign keys
   - Maps RDF types to SQL types

4. **Generate validation rules from constraints**
   - Creates Zod validators from SHACL shapes
   - Enforces min/max, patterns, required fields

5. **Generate BDD tests for generated code**
   - Creates `.feature` files for each entity
   - Generates step definitions

### ⚡ Performance & Scalability (2 scenarios)

6. **Handle large ontology (1000+ classes)**
   - Completes in < 30 seconds
   - Memory usage < 500MB

7. **Incremental generation preserves custom code**
   - Detects `// CUSTOM CODE START/END` blocks
   - Merges new generation with existing customizations

### 🔗 Advanced Features (8 scenarios)

8. **Handle ontology with imports**
   - Resolves FOAF, W3C Time, etc.
   - Generates type definitions for external vocabularies

9. **Dry-run mode**
   - Shows what would be generated
   - Doesn't create files

10. **Custom templates**
    - Uses user-provided Nunjucks templates
    - Supports TypeORM, Prisma, etc.

11. **Multiple output formats**
    - TypeScript + JSON Schema + GraphQL

12. **Internationalization support**
    - Extracts labels in multiple languages
    - Generates i18n JSON files

13. **SHACL validation integration**
    - Generates runtime validators from SHACL shapes

14. **Performance benchmarks**
    - Creates benchmark files for CRUD operations

15. **OpenAPI specification**
    - Generates OpenAPI 3.0 YAML from ontology

### 🐛 Error Handling (3 scenarios)

16. **Handle invalid TTL syntax**
    - Fails with clear error messages
    - Shows line numbers

17. **Handle missing required classes**
    - Detects incomplete ontologies
    - Provides actionable error messages

18. **Handle circular dependencies**
    - Resolves with TypeScript `import type`
    - Prevents infinite loops

## London School TDD

### Test Doubles Used

```javascript
// Mock RDF Parser
mockRDFParser.parse.mockResolvedValue({
  classes: [...],
  properties: [...],
  relationships: [...]
});

// Mock File System (no disk I/O)
mockFileSystem.writeFile.mockResolvedValue();
mockFileSystem.readFile.mockResolvedValue(content);

// Mock Template Engine
mockTemplateEngine.render.mockResolvedValue(renderedContent);
```

### Benefits

- **Fast**: No actual file I/O or RDF parsing
- **Isolated**: Each test runs independently
- **Predictable**: Mocks ensure consistent behavior
- **Focused**: Tests verify behavior, not implementation

## Coverage Requirements

| Metric       | Minimum | Target |
|--------------|---------|--------|
| Statements   | 80%     | 90%    |
| Branches     | 75%     | 85%    |
| Functions    | 80%     | 90%    |
| Lines        | 80%     | 90%    |

## Test Utilities

### Generate Large Ontology

```javascript
import { generateLargeOntology } from './helpers/ontology-test-utils.js';

await generateLargeOntology('./complex.ttl', 1000);
```

### Validate TypeScript Syntax

```javascript
import { validateTypeScriptSyntax } from './helpers/ontology-test-utils.js';

const { valid, errors } = await validateTypeScriptSyntax(generatedCode);
```

### Extract Project Metrics

```javascript
import { extractProjectMetrics } from './helpers/ontology-test-utils.js';

const metrics = await extractProjectMetrics('./generated/project');
// { fileCount, totalLines, typeScriptFiles, sqlFiles, testFiles }
```

## CI/CD Integration

```yaml
# .github/workflows/test-ontology.yml
name: Ontology Generation Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:ontology -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./tests/coverage/ontology/lcov.info
```

## Debugging

```bash
# Run with debug logging
DEBUG=unjucks:* npm run test:ontology

# Run single test file
npm run test:ontology -- ontology_project_steps.test.js

# Update snapshots
npm run test:ontology -- -u

# Run in CI mode (no watch, strict coverage)
npm run test:ontology -- --run --coverage
```

## Contributing

When adding new scenarios:

1. Write feature in Gherkin (`.feature` file)
2. Implement step definitions using mocks
3. Add fixtures if needed
4. Ensure 80%+ coverage
5. Verify all assertions use London School style

## Resources

- [Cucumber.js Documentation](https://github.com/cucumber/cucumber-js)
- [Vitest Testing Guide](https://vitest.dev/)
- [London School TDD](https://github.com/testdouble/contributing-tests/wiki/London-school-TDD)
- [SHACL Specification](https://www.w3.org/TR/shacl/)
- [RDF 1.1 Turtle](https://www.w3.org/TR/turtle/)
