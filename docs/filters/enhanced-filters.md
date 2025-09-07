# Enhanced Nunjucks Filters

This document describes the comprehensive set of string transformation filters available in Unjucks templates.

## Inflection Filters

### Case Conversion
- `titleCase(str)` - Convert to Title Case: `"hello world"` → `"Hello World"`
- `sentenceCase(str)` - Convert to Sentence case: `"hello_world"` → `"Hello world"`
- `pascalCase(str)` - Convert to PascalCase: `"hello_world"` → `"HelloWorld"`
- `camelCase(str)` - Convert to camelCase: `"hello_world"` → `"helloWorld"`
- `kebabCase(str)` - Convert to kebab-case: `"HelloWorld"` → `"hello-world"`
- `snakeCase(str)` - Convert to snake_case: `"HelloWorld"` → `"hello_world"`
- `constantCase(str)` - Convert to CONSTANT_CASE: `"HelloWorld"` → `"HELLO_WORLD"`

### Aliases & Variations
- `underscore(str)` - Alias for `snakeCase`
- `dasherize(str)` - Alias for `kebabCase`
- `camelize(str, firstLetter=false)` - Enhanced camelCase with optional first letter capitalization

### Specialized Transformations
- `classify(str)` - Convert to singular PascalCase (for class names): `"user_posts"` → `"UserPost"`
- `tableize(str)` - Convert to plural snake_case (for table names): `"UserPost"` → `"user_posts"`
- `humanize(str)` - Convert to human readable format: `"user_name"` → `"User name"`
- `demodulize(str)` - Remove module namespaces: `"Admin::Users::User"` → `"User"`

### URL & Content Formatting
- `slug(str, separator='-')` - Create URL-safe slugs: `"Hello World!"` → `"hello-world"`

## Advanced String Utilities

### Text Processing
- `truncate(str, length=30, suffix='...')` - Truncate with suffix: `"Long text"` → `"Long..."`
- `wrap(str, width=80)` - Word wrap at specified width
- `pad(str, length, padString=' ')` - Pad string to center within length
- `repeat(str, count)` - Repeat string n times: `"abc" | repeat(3)` → `"abcabcabc"`

### Character Manipulation  
- `reverse(str)` - Reverse character order: `"hello"` → `"olleh"`
- `swapCase(str)` - Swap upper/lower case: `"Hello World"` → `"hELLO wORLD"`

### Pluralization
- `pluralize(str)` - Convert to plural form: `"user"` → `"users"`
- `singular(str)` - Convert to singular form: `"users"` → `"user"`

## Template Usage Examples

### Entity Code Generation
```njk
---
to: src/models/{{ entityName | classify }}.js
entityName: user_posts
---
export class {{ entityName | classify }} {
  static tableName = '{{ entityName | tableize }}';
  
  get slug() {
    return '{{ title | slug }}';
  }
}
```

### API Route Generation  
```njk
---
to: src/routes/{{ entityName | kebabCase }}.js
---
app.get('/api/{{ entityName | kebabCase }}', (req, res) => {
  // Handle {{ entityName | humanize | lower }} requests
});
```

### Database Schema
```njk
---
to: migrations/{{ timestamp() }}_create_{{ entityName | tableize }}.sql
---
CREATE TABLE {{ entityName | tableize }} (
  id SERIAL PRIMARY KEY,
  {{ entityName | singular | snakeCase }}_name VARCHAR(255),
  slug VARCHAR(255) UNIQUE
);
```

### Documentation Generation
```njk
---
to: docs/api/{{ entityName | kebabCase }}.md
---
# {{ entityName | titleCase }} API

## Overview
{{ description | wrap(80) }}

## Endpoints
- GET /api/{{ entityName | kebabCase }}
- POST /api/{{ entityName | kebabCase }}

{{ description | truncate(100) }}
```

## Chaining Filters

Filters can be chained together for complex transformations:

```njk
{{ "user_management_system" | classify | reverse | lower }}
<!-- Output: metsystnemegamresu -->

{{ "Admin::Users::UserProfile" | demodulize | tableize }}
<!-- Output: user_profiles -->

{{ "long description text here" | truncate(20) | titleCase }}
<!-- Output: Long Description... -->
```

## Error Handling

All filters gracefully handle invalid inputs:
- Non-string inputs are returned unchanged
- `null` and `undefined` values pass through
- Empty strings are handled appropriately

```njk
{{ null | titleCase | default('N/A') }}
<!-- Output: N/A -->

{{ 123 | slug }}
<!-- Output: 123 -->
```

## Performance Considerations

- Filters are optimized for template processing
- String operations are efficient for typical template sizes
- Consider caching results for repeated transformations in loops

## Migration from Basic Filters

All existing filters remain unchanged and backwards compatible:
- `pascalCase`, `camelCase`, `kebabCase`, `snakeCase` work as before
- New filters extend functionality without breaking changes
- Existing templates continue to work without modification