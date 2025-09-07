# Filter Troubleshooting Guide

Common filter errors, solutions, and debugging techniques for Unjucks templates.

## Common Filter Errors

### 1. Unknown Filter Errors

#### Error Message
```
Template render error: filter not found: myFilter
```

#### Cause
The filter is not registered with the Nunjucks environment.

#### Solutions

**Check filter registration:**
```javascript
// Ensure filters are properly registered
import { addCommonFilters } from './lib/nunjucks-filters.js';

const nunjucksEnv = new nunjucks.Environment(loader);
addCommonFilters(nunjucksEnv); // Add built-in filters

// For custom filters
nunjucksEnv.addFilter('myCustomFilter', myCustomFilterFunction);
```

**Verify filter name spelling:**
```njk
<!-- ❌ Wrong -->
{{ componentName | pascalcase }}

<!-- ✅ Correct -->
{{ componentName | pascalCase }}
```

**Available filter aliases:**
```njk
<!-- These are equivalent -->
{{ text | kebabCase }}
{{ text | kebab-case }}

{{ text | snakeCase }}  
{{ text | snake_case }}

{{ text | constantCase }}
{{ text | CONSTANT_CASE }}
```

### 2. Date Filter Errors

#### Error Message
```
Template render error: Invalid date format
```

#### Cause
Date input is not in a recognized format or is null/undefined.

#### Solutions

**Use defensive programming:**
```njk
<!-- ❌ Unsafe - fails if createdDate is invalid -->
{{ createdDate | formatDate('YYYY-MM-DD') }}

<!-- ✅ Safe - provides fallback -->
{{ createdDate | default(now()) | formatDate('YYYY-MM-DD') }}

<!-- ✅ Safe with validation -->
{% if createdDate %}
  {{ createdDate | formatDate('YYYY-MM-DD') }}
{% else %}
  {{ now() | formatDate('YYYY-MM-DD') }}
{% endif %}
```

**Common date input formats:**
```njk
<!-- These work -->
{{ "2023-12-25" | formatDate }}                    <!-- ISO date -->
{{ "2023-12-25T10:30:00Z" | formatDate }}          <!-- ISO datetime -->
{{ 1703512200000 | formatDate }}                   <!-- Unix timestamp (ms) -->
{{ now() | formatDate }}                           <!-- Dayjs instance -->

<!-- These don't work -->
{{ "Dec 25, 2023" | formatDate }}                  <!-- Ambiguous format -->
{{ "25/12/2023" | formatDate }}                    <!-- Ambiguous format -->
{{ "" | formatDate }}                              <!-- Empty string -->
{{ null | formatDate }}                            <!-- Null value -->
```

**Debug date parsing:**
```njk
---
to: debug/date-debug.txt
---
Input: {{ dateInput }}
Parsed: {{ dateInput | default('NULL') }}
Is valid: {{ dateInput | formatDate | length > 0 }}
Unix: {{ dateInput | dateUnix | default('INVALID') }}
ISO: {{ dateInput | dateIso | default('INVALID') }}
```

### 3. Faker Filter Errors

#### Error Message
```
Template render error: faker method not available
```

#### Cause
Faker.js method doesn't exist or locale not supported.

#### Solutions

**Use fallback values:**
```njk
<!-- ❌ Fails if faker method unavailable -->
{{ '' | fakeBusinessType }}

<!-- ✅ Safe with fallback -->
{{ '' | fakeCompany | default('Sample Company') }}

<!-- ✅ Multiple fallbacks -->
{{ userName | default('' | fakeName) | default('Anonymous User') }}
```

**Check faker locale:**
```njk
<!-- Set locale and verify -->
{{ 'en' | fakeLocale }}
Name: {{ '' | fakeName }}

<!-- For unsupported locales -->
{% if localeSupported %}
  {{ locale | fakeLocale }}
  Name: {{ '' | fakeName }}
{% else %}
  <!-- Use default locale -->
  Name: {{ '' | fakeName }}
{% endif %}
```

**Faker debugging:**
```njk
---
to: debug/faker-debug.json
---
{
  "locale": "{{ 'en' | fakeLocale }}",
  "seed": "{{ 12345 | fakeSeed }}",
  "samples": {
    "name": "{{ '' | fakeName }}",
    "email": "{{ '' | fakeEmail }}",
    "uuid": "{{ '' | fakeUuid }}",
    "number": {{ '' | fakeNumber }},
    "boolean": {{ '' | fakeBoolean }},
    "date": "{{ '' | fakeDate | dateIso }}"
  }
}
```

### 4. String Filter Errors

#### Error Message
```
Template render error: Cannot read property 'replace' of undefined
```

#### Cause
Filter received null, undefined, or non-string input.

#### Solutions

**Type safety:**
```njk
<!-- ❌ Unsafe -->
{{ componentName | pascalCase }}

<!-- ✅ Safe -->
{{ componentName | default('DefaultComponent') | pascalCase }}

<!-- ✅ Type check -->
{% if componentName and componentName | length > 0 %}
  {{ componentName | pascalCase }}
{% else %}
  DefaultComponent
{% endif %}
```

**Debug string inputs:**
```njk
---
to: debug/string-debug.txt
---
Input: "{{ stringInput }}"
Type: {{ stringInput | dump | slice(0, 20) }}...
Length: {{ stringInput | length | default(0) }}
Is string: {{ stringInput is string }}

Transformations:
- Pascal: {{ stringInput | default('') | pascalCase }}
- Camel: {{ stringInput | default('') | camelCase }}
- Kebab: {{ stringInput | default('') | kebabCase }}
- Snake: {{ stringInput | default('') | snakeCase }}
```

### 5. RDF/Semantic Filter Errors

#### Error Message
```
Template render error: RDF store not initialized
```

#### Cause
Semantic filters require an RDF store to be loaded.

#### Solutions

**Check RDF data loading:**
```javascript
// Ensure RDF data is loaded before template rendering
import { RDFFilters } from './lib/rdf-filters.js';

const rdfFilters = new RDFFilters({
  store: loadedRDFStore,
  prefixes: {
    foaf: 'http://xmlns.com/foaf/0.1/',
    ex: 'http://example.org/'
  }
});

// Register RDF filters
Object.entries(rdfFilters.getAllFilters()).forEach(([name, filter]) => {
  nunjucksEnv.addFilter(name, filter);
});
```

**Defensive RDF queries:**
```njk
<!-- ❌ Unsafe -->
{{ 'foaf:Person' | rdfSubjects('rdf:type') }}

<!-- ✅ Safe with fallback -->
{% set persons = 'foaf:Person' | rdfSubjects('rdf:type') | default([]) %}
{% if persons | length > 0 %}
  Found {{ persons | length }} persons
{% else %}
  No persons found in RDF store
{% endif %}
```

## Debugging Techniques

### 1. Filter Debug Template

Create a debug template to test filter behavior:

```njk
---
to: debug/filter-test-{{ now() | formatDate('YYYY-MM-DD-HH-mm') }}.json
---
{
  "input": "{{ testInput | default('test input') }}",
  "metadata": {
    "generated": "{{ now() | dateIso }}",
    "template": "filter-debug",
    "inputType": "{{ testInput | dump | slice(0, 10) }}"
  },
  "stringFilters": {
    "original": "{{ testInput }}",
    "pascalCase": "{{ testInput | default('') | pascalCase }}",
    "camelCase": "{{ testInput | default('') | camelCase }}",
    "kebabCase": "{{ testInput | default('') | kebabCase }}",
    "snakeCase": "{{ testInput | default('') | snakeCase }}",
    "constantCase": "{{ testInput | default('') | constantCase }}",
    "titleCase": "{{ testInput | default('') | titleCase }}",
    "humanize": "{{ testInput | default('') | humanize }}",
    "slug": "{{ testInput | default('') | slug }}"
  },
  "dateFilters": {
    "now": "{{ now() | dateIso }}",
    "formatted": "{{ now() | formatDate('YYYY-MM-DD HH:mm:ss') }}",
    "unix": {{ now() | dateUnix }},
    "relative": "{{ now() | dateFrom }}",
    "addWeek": "{{ now() | dateAdd(1, 'week') | dateIso }}",
    "startOfDay": "{{ now() | dateStart('day') | dateIso }}"
  },
  "fakerSamples": {
    "name": "{{ '' | fakeName }}",
    "email": "{{ '' | fakeEmail }}",
    "uuid": "{{ '' | fakeUuid }}",
    "company": "{{ '' | fakeCompany }}",
    "number": {{ '' | fakeNumber(1, 100) }},
    "boolean": {{ '' | fakeBoolean }},
    "text": "{{ '' | fakeText(1) }}",
    "date": "{{ '' | fakeDate | dateIso }}"
  },
  "utilityFilters": {
    "dump": {{ testInput | dump }},
    "default": "{{ testInput | default('DEFAULT_VALUE') }}",
    "length": {{ testInput | default('') | length }},
    "truncate": "{{ testInput | default('very long text that will be truncated') | truncate(20) }}"
  }
}
```

### 2. Step-by-Step Debugging

Debug complex filter chains by breaking them down:

```njk
---
to: debug/chain-debug-{{ now() | formatDate('YYYY-MM-DD') }}.txt
---
Original: {{ componentName }}

Step 1 - Default: {{ componentName | default('DefaultComponent') }}
Step 2 - Humanize: {{ componentName | default('DefaultComponent') | humanize }}
Step 3 - Title Case: {{ componentName | default('DefaultComponent') | humanize | titleCase }}
Step 4 - Truncate: {{ componentName | default('DefaultComponent') | humanize | titleCase | truncate(20) }}

Final Result: {{ componentName | default('DefaultComponent') | humanize | titleCase | truncate(20) }}
```

### 3. Error Context Logging

Add context to error messages:

```javascript
// enhanced-error-handling.js
export function addErrorHandling(nunjucksEnv) {
  const originalAddFilter = nunjucksEnv.addFilter.bind(nunjucksEnv);
  
  nunjucksEnv.addFilter = function(name, filter) {
    const wrappedFilter = function(...args) {
      try {
        return filter.apply(this, args);
      } catch (error) {
        console.error(`Filter Error: ${name}`, {
          filterName: name,
          args: args,
          error: error.message,
          stack: error.stack
        });
        
        // Return safe fallback
        return args[0] || '';
      }
    };
    
    return originalAddFilter(name, wrappedFilter);
  };
}
```

### 4. Performance Debugging

Monitor filter performance:

```javascript
// filter-performance.js
export function addPerformanceMonitoring(nunjucksEnv) {
  const filterTimes = new Map();
  
  const originalAddFilter = nunjucksEnv.addFilter.bind(nunjucksEnv);
  
  nunjucksEnv.addFilter = function(name, filter) {
    const timedFilter = function(...args) {
      const start = performance.now();
      const result = filter.apply(this, args);
      const end = performance.now();
      
      if (!filterTimes.has(name)) {
        filterTimes.set(name, { total: 0, count: 0, max: 0 });
      }
      
      const stats = filterTimes.get(name);
      const duration = end - start;
      
      stats.total += duration;
      stats.count += 1;
      stats.max = Math.max(stats.max, duration);
      stats.avg = stats.total / stats.count;
      
      // Log slow filters
      if (duration > 10) { // 10ms threshold
        console.warn(`Slow filter: ${name} took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    };
    
    return originalAddFilter(name, timedFilter);
  };
  
  // Expose performance stats
  nunjucksEnv.getFilterPerformance = () => {
    return Array.from(filterTimes.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.total - a.total);
  };
}
```

## Common Solutions

### 1. Template Validation

Validate templates before rendering:

```javascript
// template-validator.js
export class TemplateValidator {
  constructor(nunjucksEnv) {
    this.env = nunjucksEnv;
    this.errors = [];
  }
  
  validateTemplate(templatePath, context = {}) {
    this.errors = [];
    
    try {
      // Parse template
      const template = this.env.getTemplate(templatePath);
      
      // Try rendering with context
      const result = template.render(context);
      
      return {
        valid: true,
        result,
        errors: []
      };
    } catch (error) {
      return {
        valid: false,
        result: null,
        errors: [this.parseError(error)]
      };
    }
  }
  
  parseError(error) {
    const message = error.message || 'Unknown error';
    
    if (message.includes('filter not found')) {
      const filterName = this.extractFilterName(message);
      return {
        type: 'unknown_filter',
        filter: filterName,
        message: `Filter '${filterName}' not found. Check if it's properly registered.`,
        suggestions: this.suggestFilters(filterName)
      };
    }
    
    if (message.includes('undefined') || message.includes('null')) {
      return {
        type: 'null_reference',
        message: 'Null or undefined value passed to filter',
        suggestion: 'Use | default() filter to provide fallback values'
      };
    }
    
    if (message.includes('Invalid date')) {
      return {
        type: 'date_error',
        message: 'Invalid date format',
        suggestion: 'Ensure date is in ISO format or use | default(now()) for fallback'
      };
    }
    
    return {
      type: 'generic',
      message: message,
      suggestion: 'Check template syntax and variable names'
    };
  }
  
  extractFilterName(message) {
    const match = message.match(/filter not found: (\w+)/);
    return match ? match[1] : 'unknown';
  }
  
  suggestFilters(filterName) {
    const availableFilters = [
      'pascalCase', 'camelCase', 'kebabCase', 'snakeCase', 'constantCase',
      'titleCase', 'humanize', 'slug', 'formatDate', 'dateAdd', 'dateSub',
      'fakeName', 'fakeEmail', 'fakeUuid', 'dump', 'default', 'join'
    ];
    
    // Simple similarity check
    return availableFilters
      .filter(filter => 
        filter.toLowerCase().includes(filterName.toLowerCase()) ||
        filterName.toLowerCase().includes(filter.toLowerCase())
      )
      .slice(0, 3);
  }
}
```

### 2. Safe Filter Helpers

Create safe wrapper functions:

```javascript
// safe-filters.js
export function createSafeFilters(nunjucksEnv) {
  // Safe string filter wrapper
  const safeStringFilter = (filterName, filterFn) => {
    return (input, ...args) => {
      if (input === null || input === undefined) {
        return '';
      }
      
      if (typeof input !== 'string') {
        input = String(input);
      }
      
      try {
        return filterFn(input, ...args);
      } catch (error) {
        console.warn(`Safe filter ${filterName} error:`, error);
        return input;
      }
    };
  };
  
  // Safe date filter wrapper
  const safeDateFilter = (filterName, filterFn) => {
    return (input, ...args) => {
      if (!input) {
        return '';
      }
      
      try {
        return filterFn(input, ...args);
      } catch (error) {
        console.warn(`Safe date filter ${filterName} error:`, error);
        return input;
      }
    };
  };
  
  // Apply safe wrappers
  const stringFilters = ['pascalCase', 'camelCase', 'kebabCase', 'snakeCase'];
  const dateFilters = ['formatDate', 'dateAdd', 'dateSub', 'dateFrom'];
  
  stringFilters.forEach(name => {
    const original = nunjucksEnv.getFilter(name);
    if (original) {
      nunjucksEnv.addFilter(name, safeStringFilter(name, original));
    }
  });
  
  dateFilters.forEach(name => {
    const original = nunjucksEnv.getFilter(name);
    if (original) {
      nunjucksEnv.addFilter(name, safeDateFilter(name, original));
    }
  });
}
```

### 3. Template Testing Framework

```javascript
// template-test-framework.js
export class TemplateTestFramework {
  constructor(templatesDir = '_templates') {
    this.templatesDir = templatesDir;
    this.results = [];
  }
  
  async testAllTemplates() {
    const templates = this.findAllTemplates();
    
    for (const template of templates) {
      await this.testTemplate(template);
    }
    
    return this.generateReport();
  }
  
  async testTemplate(templatePath) {
    const testCases = this.generateTestCases(templatePath);
    
    for (const testCase of testCases) {
      try {
        const result = await this.renderTemplate(templatePath, testCase.context);
        
        this.results.push({
          template: templatePath,
          testCase: testCase.name,
          success: true,
          output: result.length
        });
      } catch (error) {
        this.results.push({
          template: templatePath,
          testCase: testCase.name,
          success: false,
          error: error.message
        });
      }
    }
  }
  
  generateTestCases(templatePath) {
    // Generate different test contexts
    return [
      {
        name: 'minimal',
        context: {}
      },
      {
        name: 'complete',
        context: {
          componentName: 'TestComponent',
          entityName: 'user',
          withTests: true,
          createdDate: '2023-12-25T10:30:00Z'
        }
      },
      {
        name: 'edge_cases',
        context: {
          componentName: '',
          entityName: null,
          withTests: false,
          createdDate: 'invalid-date'
        }
      }
    ];
  }
  
  generateReport() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    
    const report = {
      summary: {
        total,
        passed,
        failed,
        success_rate: (passed / total * 100).toFixed(2) + '%'
      },
      failures: this.results.filter(r => !r.success),
      templates_tested: [...new Set(this.results.map(r => r.template))].length
    };
    
    return report;
  }
}
```

## Prevention Best Practices

### 1. Always Use Defaults

```njk
<!-- ❌ Risky -->
{{ componentName | pascalCase }}

<!-- ✅ Safe -->
{{ componentName | default('DefaultComponent') | pascalCase }}
```

### 2. Validate Inputs

```njk
<!-- Check before processing -->
{% if componentName and componentName | length > 0 %}
  {{ componentName | pascalCase }}
{% else %}
  DefaultComponent
{% endif %}
```

### 3. Use Type-Safe Patterns

```njk
<!-- Safe string handling -->
{% set safeName = (componentName | string | default('Component')) %}
{{ safeName | pascalCase }}

<!-- Safe date handling -->
{% set safeDate = (inputDate | default(now())) %}
{{ safeDate | formatDate('YYYY-MM-DD') }}
```

### 4. Test with Edge Cases

Always test templates with:
- Empty strings
- Null/undefined values
- Invalid dates
- Non-string inputs
- Very long strings
- Special characters

This troubleshooting guide should help resolve most common filter-related issues in Unjucks templates.