# Filter Migration Guide

Guide for upgrading filters, handling breaking changes, and migrating between versions.

## Migration Overview

This guide helps you migrate between different versions of Unjucks filters and understand breaking changes.

### Version Compatibility Matrix

| Unjucks Version | Filter API | Breaking Changes | Migration Required |
|-----------------|------------|-----------------|-------------------|
| 1.0.x           | Basic      | N/A             | N/A               |
| 1.1.x           | Enhanced   | None            | Optional          |
| 2.0.x           | Advanced   | Major           | Required          |
| 2.1.x           | Extended   | Minor           | Recommended       |

## Migration from Basic to Enhanced Filters

### Before: Basic String Filters (v1.0.x)

```njk
---
to: src/{{ componentName }}.js
---
// Old basic filters
export const {{ componentName }} = {
  name: '{{ componentName | upper }}',
  slug: '{{ componentName | lower | replace(" ", "-") }}',
  className: '{{ componentName | replace(" ", "") }}'
};
```

### After: Enhanced String Filters (v1.1.x+)

```njk
---
to: src/{{ componentName | kebabCase }}.js
---
// New enhanced filters
export const {{ componentName | pascalCase }} = {
  name: '{{ componentName | titleCase }}',
  slug: '{{ componentName | slug }}',
  className: '{{ componentName | pascalCase }}',
  constant: '{{ componentName | constantCase }}',
  humanReadable: '{{ componentName | humanize }}'
};
```

**Migration Steps:**

1. Replace `| upper` with `| constantCase` for constants
2. Replace `| lower | replace(" ", "-")` with `| kebabCase` or `| slug`
3. Replace manual replacements with `| pascalCase` for class names
4. Add `| humanize` for display names

### Automated Migration Script

```bash
#!/bin/bash
# migrate-basic-filters.sh

find . -name "*.njk" -type f -exec sed -i.bak \
  -e 's/| upper/| constantCase/g' \
  -e 's/| lower | replace(" ", "-")/| kebabCase/g' \
  -e 's/| replace(" ", "")/| pascalCase/g' \
  {} +

echo "Basic filter migration completed. Review changes and test templates."
```

## Migration to Date/Time Filters (v2.0.x)

### Before: Manual Date Handling

```njk
---
to: src/generated-{{ timestamp() }}.js
---
// Old timestamp approach
export const metadata = {
  generated: '{{ timestamp() }}', // YYYYMMDDHHMMSS format
  date: new Date().toISOString()
};
```

### After: Day.js Powered Filters

```njk
---
to: src/generated-{{ now() | formatDate('YYYY-MM-DD') }}.js
---
// New date filters
export const metadata = {
  generated: '{{ now() | formatDate('YYYY-MM-DD HH:mm:ss') }}',
  timestamp: '{{ now() | dateUnix }}',
  iso: '{{ now() | dateIso }}',
  buildDate: '{{ now() | formatDate('MMM D, YYYY') }}',
  expires: '{{ now() | dateAdd(30, 'days') | dateIso }}'
};
```

**Breaking Changes:**
- `timestamp()` format changed from `YYYYMMDDHHMMSS` to configurable
- New `now()` function returns dayjs instance
- Date arithmetic now uses `dateAdd`/`dateSub`

**Migration Script:**

```javascript
// migrate-dates.js
const fs = require('fs');
const glob = require('glob');

const files = glob.sync('**/*.njk');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Migrate timestamp calls
  content = content.replace(
    /\{\{\s*timestamp\(\)\s*\}\}/g, 
    "{{ now() | formatDate('YYYYMMDDHHMMSS') }}"
  );
  
  // Migrate date creation
  content = content.replace(
    /new Date\(\)\.toISOString\(\)/g,
    "{{ now() | dateIso }}"
  );
  
  fs.writeFileSync(file, content);
});

console.log(`Migrated ${files.length} template files`);
```

## Migration to Faker Integration (v2.1.x)

### Before: Manual Mock Data

```njk
---
to: tests/fixtures/{{ entityName }}.fixtures.js
---
export const fixtures = {
  user: {
    id: 'user-123',
    name: 'John Doe',
    email: 'john@example.com'
  }
};
```

### After: Faker-Powered Data

```njk
---
to: tests/fixtures/{{ entityName | kebabCase }}.fixtures.js
---
// Set consistent seed for reproducible tests
{{ 42 | fakeSeed }}

export const fixtures = {
  user: {
    id: '{{ '' | fakeUuid }}',
    name: '{{ '' | fakeName }}',
    email: '{{ '' | fakeEmail }}',
    company: '{{ '' | fakeCompany }}',
    address: '{{ '' | fakeAddress }}',
    phone: '{{ '' | fakePhone }}',
    active: {{ '' | fakeBoolean }},
    score: {{ '' | fakeNumber(1, 100) }},
    bio: '{{ '' | fakeText(2) }}',
    joinDate: '{{ '' | fakeDate('2020-01-01', '2023-12-31') | dateIso }}'
  }
};
```

**Migration Benefits:**
- Realistic test data
- Deterministic with seeds
- Localization support
- Complex schema generation

## Semantic/RDF Filter Integration (Advanced)

### Before: Manual RDF Handling

```njk
---
to: src/ontology/{{ className }}.js
---
// Manual RDF processing
export const PersonClass = 'http://xmlns.com/foaf/0.1/Person';
export const nameProperty = 'http://xmlns.com/foaf/0.1/name';
```

### After: RDF-Aware Filters

```njk
---
to: src/ontology/{{ className | kebabCase }}.js
---
// RDF-aware generation with semantic filters
export const PersonClass = '{{ 'foaf:Person' | rdfExpand }}';
export const nameProperty = '{{ 'foaf:name' | rdfExpand }}';

// Query-driven code generation
{% set persons = '' | rdfQuery('?s rdf:type foaf:Person') %}
export const knownPersons = [
{% for person in persons %}
  {
    uri: '{{ person[0].value }}',
    label: '{{ person[0].value | rdfLabel }}',
    name: '{{ person[0].value | rdfObject('foaf:name') | first.value }}'
  }{% if not loop.last %},{% endif %}
{% endfor %}
];
```

## Breaking Changes by Version

### v2.0.x Breaking Changes

#### Date Filter Changes

**BREAKING:** `formatDate` signature changed

```njk
<!-- Before v2.0 -->
{{ someDate | formatDate }}  <!-- Always used default format -->

<!-- After v2.0 -->
{{ someDate | formatDate('YYYY-MM-DD') }}  <!-- Explicit format required for custom formatting -->
```

**Migration:**
- Review all `formatDate` usage
- Add explicit format strings where needed
- Use `now()` instead of `new Date()` in templates

#### Filter Registration Changes

**BREAKING:** Custom filter registration API changed

```javascript
// Before v2.0
nunjucksEnv.addFilter('myFilter', myFilterFunction);

// After v2.0  
import { addCommonFilters } from './lib/nunjucks-filters.js';
addCommonFilters(nunjucksEnv); // Registers all built-in filters
nunjucksEnv.addFilter('myCustomFilter', myCustomFilterFunction);
```

### v2.1.x Minor Breaking Changes

#### Faker Configuration

**BREAKING:** Faker locale setting changed

```njk
<!-- Before v2.1 -->
{{ 'es' | setFakerLocale }}

<!-- After v2.1 -->
{{ 'es' | fakeLocale }}
```

## Custom Filter Migration

### Migrating Custom Filters to New API

#### Before: Manual Filter Definition

```javascript
// old-custom-filters.js
export function addCustomFilters(env) {
  env.addFilter('myCase', (str) => {
    return str.toLowerCase().replace(/\s+/g, '_');
  });
  
  env.addFilter('myDate', (date) => {
    return new Date(date).toLocaleDateString();
  });
}
```

#### After: Extended Filter System

```javascript
// enhanced-custom-filters.js
import { addCommonFilters } from './lib/nunjucks-filters.js';

export function addEnhancedFilters(env) {
  // First add all built-in filters
  addCommonFilters(env);
  
  // Then add custom filters that extend built-ins
  env.addFilter('myCase', (str) => {
    // Use built-in snakeCase as base
    return str | snakeCase;
  });
  
  env.addFilter('myDate', (date, format = 'MM/DD/YYYY') => {
    // Use day.js powered date formatting
    return formatDate(date, format);
  });
  
  // New semantic-aware filter
  env.addFilter('apiEndpoint', (resourceName) => {
    return `/api/${resourceName | kebabCase | pluralize}`;
  });
}
```

### Filter Extension Pattern

Create filters that compose with built-ins:

```javascript
// composable-filters.js
export function addComposableFilters(env) {
  // Component path generator
  env.addFilter('componentPath', (name, type = 'vue') => {
    const baseName = name | pascalCase;
    const fileName = name | kebabCase;
    
    switch (type) {
      case 'react':
        return `src/components/${baseName}/${baseName}.tsx`;
      case 'vue':
        return `src/components/${baseName}/${fileName}.vue`;
      case 'angular':
        return `src/app/components/${fileName}/${fileName}.component.ts`;
      default:
        return `src/components/${fileName}.js`;
    }
  });
  
  // Database naming convention
  env.addFilter('dbName', (entityName, convention = 'snake') => {
    switch (convention) {
      case 'snake':
        return entityName | snakeCase | pluralize;
      case 'kebab':
        return entityName | kebabCase | pluralize;
      case 'camel':
        return entityName | camelCase | pluralize;
      default:
        return entityName | snakeCase | pluralize;
    }
  });
}
```

## Migration Testing Strategy

### Test Template Migration

```njk
---
to: tests/migration/{{ testName | kebabCase }}.test.js
---
import { {{ testName | pascalCase }}Migration } from '../migrations';

describe('{{ testName | pascalCase }} Migration', () => {
  const testCases = [
    {
      input: '{{ oldSyntax }}',
      expected: '{{ newSyntax }}',
      description: 'should migrate {{ feature }}'
    }
  ];
  
  testCases.forEach(({ input, expected, description }) => {
    it(description, () => {
      const result = {{ testName | pascalCase }}Migration.transform(input);
      expect(result).toBe(expected);
    });
  });
  
  it('should preserve unchanged syntax', () => {
    const unchanged = '{{ validSyntax }}';
    const result = {{ testName | pascalCase }}Migration.transform(unchanged);
    expect(result).toBe(unchanged);
  });
});
```

### Migration Validation

```javascript
// migration-validator.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class MigrationValidator {
  constructor(templateDir = '_templates') {
    this.templateDir = templateDir;
    this.errors = [];
    this.warnings = [];
  }
  
  validateMigration() {
    console.log('🔍 Validating filter migration...');
    
    this.checkDeprecatedFilters();
    this.checkDateFilterUsage();
    this.checkFakerIntegration();
    this.validateTemplateCompilation();
    
    this.reportResults();
  }
  
  checkDeprecatedFilters() {
    const deprecatedPatterns = [
      /\|\s*upper(?!\w)/g,
      /\|\s*lower\s*\|\s*replace\(/g,
      /timestamp\(\)/g
    ];
    
    this.scanTemplates(deprecatedPatterns, 'deprecated filter usage');
  }
  
  checkDateFilterUsage() {
    const datePatterns = [
      /new\s+Date\(/g,
      /\.toISOString\(/g,
      /formatDate\(\s*\)/g // formatDate without parameters
    ];
    
    this.scanTemplates(datePatterns, 'potentially outdated date usage');
  }
  
  validateTemplateCompilation() {
    try {
      execSync('npm run test:templates', { stdio: 'pipe' });
      console.log('✅ All templates compile successfully');
    } catch (error) {
      this.errors.push('Template compilation failed');
      console.error('❌ Template compilation errors detected');
    }
  }
  
  scanTemplates(patterns, issueType) {
    const templates = this.getAllTemplates();
    
    templates.forEach(templatePath => {
      const content = fs.readFileSync(templatePath, 'utf8');
      const relativePath = path.relative(process.cwd(), templatePath);
      
      patterns.forEach((pattern, index) => {
        const matches = content.match(pattern);
        if (matches) {
          this.warnings.push({
            file: relativePath,
            issue: issueType,
            matches: matches.length
          });
        }
      });
    });
  }
  
  getAllTemplates() {
    const glob = require('glob');
    return glob.sync(`${this.templateDir}/**/*.{njk,hbs}`);
  }
  
  reportResults() {
    console.log('\n📊 Migration Validation Results:');
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ No migration issues found');
      return;
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      this.warnings.forEach(warning => {
        console.log(`  - ${warning.file}: ${warning.issue} (${warning.matches} occurrences)`);
      });
    }
    
    console.log('\n💡 Run migration scripts to fix these issues automatically.');
  }
}

// Usage
if (require.main === module) {
  const validator = new MigrationValidator();
  validator.validateMigration();
}

module.exports = { MigrationValidator };
```

## Best Practices for Smooth Migration

### 1. Incremental Migration

Migrate templates in phases rather than all at once:

```bash
# Phase 1: Basic string filters
npm run migrate:basic-filters

# Phase 2: Date/time filters  
npm run migrate:date-filters

# Phase 3: Faker integration
npm run migrate:faker-filters

# Phase 4: Semantic filters (if applicable)
npm run migrate:semantic-filters
```

### 2. Template Versioning

Add version comments to templates:

```njk
---
# Template version: 2.1.0
# Last migrated: {{ now() | formatDate('YYYY-MM-DD') }}
# Migration notes: Updated to use enhanced string filters and faker integration
to: src/{{ componentName | pascalCase }}/index.ts
---
```

### 3. Compatibility Layer

Create compatibility filters for gradual migration:

```javascript
// compatibility-filters.js
export function addCompatibilityFilters(env) {
  // Provide old filter names as aliases
  env.addFilter('upperFirst', (str) => {
    console.warn('upperFirst is deprecated, use titleCase instead');
    return str | titleCase;
  });
  
  // Wrapper for old timestamp format
  env.addFilter('legacyTimestamp', () => {
    console.warn('legacyTimestamp is deprecated, use now() | formatDate() instead');
    return now() | formatDate('YYYYMMDDHHMMSS');
  });
}
```

### 4. Migration Documentation

Document migration decisions:

```markdown
# Migration Log

## 2024-01-15: v2.0.x Migration

### Changes Made:
- Replaced `| upper` with `| constantCase` (47 files)
- Updated date handling to use dayjs (23 files)  
- Added faker integration (12 test files)

### Breaking Changes:
- `formatDate()` now requires explicit format parameter
- `timestamp()` format changed

### Files Affected:
- `_templates/component/new/` (complete rewrite)
- `_templates/api/rest/` (date filter updates)
- `tests/fixtures/` (faker integration)

### Rollback Plan:
Revert commit abc123f to restore previous filter usage.
```

This migration guide provides comprehensive strategies for handling filter upgrades and breaking changes while maintaining template functionality.