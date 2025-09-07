# Template Filters Documentation

Comprehensive documentation for all template filters available in Unjucks.

## Documentation Structure

This directory contains complete documentation for using filters in Unjucks templates:

### 📖 [Filter Reference](./filters-reference.md)
Complete catalog of all available filters organized by category:
- **String Inflection**: `pascalCase`, `camelCase`, `kebabCase`, `snakeCase`, etc.
- **Date/Time**: Day.js powered filters like `formatDate`, `dateAdd`, `fromNow`  
- **Fake Data**: Faker.js integration with `fakeName`, `fakeEmail`, `fakeUuid`
- **Utility**: `dump`, `join`, `default`, `truncate` and more
- **Semantic/RDF**: Advanced filters for semantic data processing

### 🔧 [Integration Guide](./filter-integration.md)
How filters work in different contexts:
- **Frontmatter vs Template Body**: Understanding execution order and context
- **Filter Chaining**: Advanced patterns and composition
- **Performance Optimization**: Best practices for efficient filter usage
- **Error Handling**: Safe filter usage with fallbacks and validation

### 👨‍🍳 [Filter Cookbook](./filter-cookbook.md)
Real-world examples and patterns:
- **Component Generation**: React, Vue, Angular component templates
- **API Scaffolding**: REST endpoints, GraphQL schemas, route handlers
- **Database Migrations**: SQL migrations, Prisma schemas, table definitions
- **Test Generation**: Jest unit tests, Cypress E2E tests with realistic data

### 🔄 [Migration Guide](./filter-migration.md)
Upgrading between filter versions:
- **Breaking Changes**: Version compatibility matrix and change logs
- **Migration Scripts**: Automated tools for updating templates
- **Compatibility Layers**: Gradual migration strategies
- **Testing Migration**: Validation and testing approaches

### 🛠️ [Custom Filters](./custom-filters.md)
Extending Unjucks with custom functionality:
- **Creating Custom Filters**: Basic to advanced filter development
- **Plugin System**: Modular filter registration and management
- **Context-Aware Filters**: Accessing template context and metadata
- **Testing Custom Filters**: Comprehensive testing strategies

### 🐛 [Troubleshooting](./troubleshooting.md)
Common errors and solutions:
- **Unknown Filter Errors**: Registration and naming issues
- **Date Filter Problems**: Invalid dates and formatting errors
- **Faker Integration Issues**: Locale and method availability
- **Performance Debugging**: Monitoring and optimizing filter performance

## Quick Start Examples

### Basic String Transformations
```njk
---
to: src/components/{{ componentName | pascalCase }}/index.ts
---
export const {{ componentName | pascalCase }} = {
  name: '{{ componentName | humanize | titleCase }}',
  slug: '{{ componentName | kebabCase }}',
  constant: '{{ componentName | constantCase }}',
  file: '{{ componentName | snakeCase }}.component.ts'
};
```

### Date and Time
```njk
---
to: build/{{ now() | formatDate('YYYY-MM-DD') }}/metadata.json
---
{
  "buildDate": "{{ now() | formatDate('YYYY-MM-DD HH:mm:ss') }}",
  "timestamp": {{ now() | dateUnix }},
  "expires": "{{ now() | dateAdd(30, 'days') | dateIso }}",
  "version": "{{ version | default('1.0.0') }}"
}
```

### Realistic Test Data
```njk
---
to: tests/fixtures/{{ entityName | kebabCase }}.fixtures.ts
---
// Deterministic test data
{{ 42 | fakeSeed }}

export const {{ entityName | pascalCase }}Fixtures = {
  valid: {
    id: '{{ '' | fakeUuid }}',
    name: '{{ '' | fakeName }}',
    email: '{{ '' | fakeEmail }}',
    company: '{{ '' | fakeCompany }}',
    createdAt: '{{ '' | fakeDate('2023-01-01', '2023-12-31') | dateIso }}'
  }
};
```

### Complex Filter Chains
```njk
---
to: src/{{ moduleName | kebabCase }}/{{ componentName | kebabCase }}.component.ts
inject: true
skip_if: '{{ not (componentName and withComponent) }}'
---
@Component({
  selector: 'app-{{ componentName | kebabCase }}',
  template: `
    <div class="{{ componentName | kebabCase }}-container">
      <h1>{{ title | default(componentName | humanize) | titleCase | truncate(50) }}</h1>
      <p>Created: {{ now() | formatDate('dddd, MMMM D, YYYY') }}</p>
      <span>ID: {{ '' | fakeUuid | truncate(8, '') }}</span>
    </div>
  `
})
export class {{ componentName | pascalCase }}Component {
  title = '{{ componentName | humanize | titleCase }}';
}
```

## Filter Categories Overview

| Category | Count | Examples | Use Cases |
|----------|-------|----------|-----------|
| **String Inflection** | 15+ | `pascalCase`, `kebabCase`, `snakeCase` | Naming conventions, file paths |
| **Date/Time** | 20+ | `formatDate`, `dateAdd`, `fromNow` | Timestamps, expiration, scheduling |
| **Fake Data** | 15+ | `fakeName`, `fakeEmail`, `fakeUuid` | Testing, fixtures, demos |
| **Utility** | 10+ | `dump`, `default`, `join`, `truncate` | Data processing, formatting |
| **Semantic/RDF** | 12+ | `rdfQuery`, `rdfLabel`, `semanticValue` | Ontology-driven generation |

## Performance Characteristics

| Filter Type | Performance | Memory Usage | Notes |
|-------------|-------------|--------------|-------|
| String filters | Fast | Low | Simple transformations |
| Date filters | Fast | Low | Day.js optimized |
| Faker filters | Medium | Medium | Random generation overhead |
| RDF filters | Slow | High | Requires loaded data store |

## Best Practices

### ✅ Do
- Always use `| default()` for potentially undefined values
- Chain filters logically from left to right
- Use semantic naming for better readability
- Test templates with edge cases (empty, null, invalid data)
- Batch similar operations to avoid repeated processing

### ❌ Don't  
- Chain too many complex filters (impacts performance)
- Ignore filter errors without fallbacks
- Use filters for complex business logic (create custom filters instead)
- Hardcode values that could be parameterized
- Forget to validate filter inputs in production templates

## Getting Help

1. **Check the Reference**: Start with [filters-reference.md](./filters-reference.md) for syntax and examples
2. **Search Troubleshooting**: Look in [troubleshooting.md](./troubleshooting.md) for common issues
3. **Review Examples**: The [cookbook](./filter-cookbook.md) has real-world patterns
4. **Create Custom Filters**: Follow [custom-filters.md](./custom-filters.md) for extensions
5. **Migration Issues**: Use [migration guide](./filter-migration.md) for version upgrades

## Contributing

To contribute to filter documentation:

1. **Add Examples**: Real-world use cases are always welcome
2. **Report Issues**: Document any bugs or unclear behavior
3. **Suggest Filters**: Propose new filters with use cases
4. **Improve Docs**: Fix typos, add clarifications, enhance examples

## Version History

- **v1.0**: Basic string filters
- **v1.1**: Enhanced inflection filters
- **v2.0**: Day.js date filters, breaking changes
- **v2.1**: Faker.js integration
- **v2.2**: Semantic/RDF filters
- **v2.3**: Performance optimizations and troubleshooting tools

---

*This documentation covers all aspects of template filter usage in Unjucks. Start with the [Filter Reference](./filters-reference.md) for a complete catalog of available filters.*