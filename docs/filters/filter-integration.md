# Filter Integration Guide

How to use filters effectively in frontmatter, template bodies, and advanced patterns.

## Understanding Filter Contexts

Unjucks filters work in two main contexts with different behaviors and capabilities.

### Frontmatter Filters

Filters in frontmatter are evaluated during template processing to determine file paths, injection settings, and conditional logic.

```njk
---
to: src/components/{{ componentName | pascalCase }}/index.ts
inject: true
skip_if: '{{ not withTests }}'
before: '// Generated components'
after: '// End of generated components'
chmod: '644'
---
```

**Frontmatter Filter Rules:**
- Executed first, before template body rendering
- Results affect file system operations
- Must be wrapped in `{{ }}` or `{% %}` syntax
- Available in: `to`, `skip_if`, `inject`, `before`, `after`, `append_to`, `prepend_to`
- Can use all filter types: string, date, faker, semantic

### Template Body Filters

Filters in template body generate the actual file content.

```njk
export class {{ className | pascalCase }} {
  constructor(
    private {{ serviceName | camelCase }}: {{ serviceName | pascalCase }}Service
  ) {}
  
  async {{ actionName | camelCase }}(): Promise<{{ returnType | pascalCase }}> {
    // Generated on {{ now() | formatDate('YYYY-MM-DD HH:mm:ss') }}
    const id = '{{ '' | fakeUuid }}';
    
    return {
      id,
      name: '{{ entityName | humanize }}',
      slug: '{{ entityName | kebabCase }}',
      created: '{{ now() | dateIso }}'
    };
  }
}
```

**Template Body Filter Rules:**
- Executed after frontmatter evaluation
- Generate actual file content
- No quotes needed around filter expressions
- Full access to all filters and globals
- Can use complex filter chaining

## Filter Execution Order

Understanding the order of filter execution is crucial for complex templates:

```njk
---
# 1. Frontmatter filters execute first
to: src/{{ moduleName | kebabCase }}/{{ componentName | kebabCase }}.component.ts
inject: '{{ injectMode }}'
skip_if: '{{ not (withComponent and withTests) }}'
lineAt: '{{ insertionLine | default(10) }}'
---
// 2. Template body filters execute after frontmatter
import { Component } from '@angular/core';
import { {{ serviceName | pascalCase }}Service } from '../services';

// 3. Nested filters are evaluated left-to-right
@Component({
  selector: 'app-{{ componentName | kebabCase }}',
  template: `
    <div class="{{ componentName | kebabCase }}-container">
      <h1>{{ title | default(componentName | humanize) | titleCase }}</h1>
      <p>Created: {{ now() | formatDate('dddd, MMMM D, YYYY') }}</p>
    </div>
  `
})
export class {{ componentName | pascalCase }}Component {
  // 4. Complex chaining with conditional logic
  {% set displayName = componentName | humanize | titleCase if useHumanNames else componentName | pascalCase %}
  title = '{{ displayName }}';
  
  constructor(
    private {{ serviceName | camelCase }}: {{ serviceName | pascalCase }}Service
  ) {}
}
```

## Advanced Filter Patterns

### Conditional Filter Application

Apply different filters based on variables or conditions:

```njk
---
to: >-
  {%- if isApiRoute -%}
    api/{{ routeName | kebabCase }}.ts
  {%- elif isComponent -%}
    components/{{ componentName | pascalCase }}/{{ componentName | kebabCase }}.vue
  {%- else -%}
    utils/{{ utilityName | camelCase }}.ts
  {%- endif -%}
---
{% if isApiRoute %}
// API Route: {{ routeName | titleCase }}
export const {{ routeName | camelCase }}Handler = {
  path: '/{{ routeName | kebabCase }}',
  method: '{{ httpMethod | upper }}',
  // Generated: {{ now() | formatDate('YYYY-MM-DD') }}
};
{% elif isComponent %}
<template>
  <div class="{{ componentName | kebabCase }}">
    <h2>{{ componentName | humanize | titleCase }}</h2>
    <!-- ID: {{ '' | fakeUuid }} -->
  </div>
</template>

<script>
export default {
  name: '{{ componentName | pascalCase }}'
}
</script>
{% else %}
// Utility: {{ utilityName | titleCase }}
export const {{ utilityName | camelCase }} = {
  version: '{{ version | default("1.0.0") }}',
  created: '{{ now() | dateIso }}'
};
{% endif %}
```

### Dynamic Filter Selection

Use variables to determine which filters to apply:

```njk
---
to: src/{{ entityName | 
  (caseStyle === 'kebab' ? kebabCase : 
   caseStyle === 'snake' ? snakeCase : 
   caseStyle === 'pascal' ? pascalCase : camelCase) 
}}.ts
---
{% set transformedName = entityName | 
  (caseStyle === 'kebab' ? kebabCase : 
   caseStyle === 'snake' ? snakeCase : 
   caseStyle === 'pascal' ? pascalCase : camelCase) %}

export const {{ transformedName }} = {
  name: '{{ entityName | humanize }}',
  slug: '{{ entityName | slug }}',
  constant: '{{ entityName | constantCase }}'
};
```

### Filter Composition Functions

Create reusable filter combinations:

```njk
{# Define filter composition macros #}
{% macro apiName(name) -%}
  {{- name | camelCase | replace('Api', '') + 'API' -}}
{%- endmacro %}

{% macro componentPath(name) -%}
  components/{{ name | pascalCase }}/{{ name | kebabCase }}.vue
{%- endmacro %}

{% macro dbTableName(entity) -%}
  {{- entity | snakeCase | pluralize -}}
{%- endmacro %}

---
to: src/{{ componentPath(componentName) }}
inject: true
skip_if: '{{ not withComponent }}'
---
<template>
  <div class="{{ componentName | kebabCase }}">
    <h1>{{ componentName | humanize | titleCase }}</h1>
  </div>
</template>

<script>
import { {{ apiName(serviceName) }} } from '@/services';

export default {
  name: '{{ componentName | pascalCase }}',
  table: '{{ dbTableName(entityName) }}', // users, blog_posts, categories
  api: {{ apiName(serviceName) }}
}
</script>
```

## Filter Chain Optimization

### Performance-Conscious Chaining

```njk
{# Good: Cache complex transformations #}
{% set processedName = componentName | pascalCase %}
{% set serviceInstance = serviceName | camelCase %}
{% set apiEndpoint = entityName | kebabCase | pluralize %}

export class {{ processedName }}Service {
  constructor(
    private {{ serviceInstance }}: {{ serviceName | pascalCase }}
  ) {}
  
  getEndpoint(): string {
    return '/api/{{ apiEndpoint }}';
  }
}

{# Avoid: Repeated complex transformations #}
{# 
export class {{ componentName | pascalCase }}Service {
  constructor(
    private {{ serviceName | camelCase }}: {{ serviceName | pascalCase }}
  ) {}
  
  getEndpoint(): string {
    return '/api/{{ entityName | kebabCase | pluralize }}';
  }
}
#}
```

### Error-Safe Filter Chaining

Handle potential errors in filter chains:

```njk
---
to: src/{{ componentName | default('DefaultComponent') | pascalCase | lower }}/index.ts
inject: true
skip_if: '{{ not (componentName and componentName | length > 0) }}'
---
export const config = {
  name: '{{ componentName | default("Unknown") | humanize | titleCase }}',
  slug: '{{ componentName | default("unknown") | kebabCase }}',
  created: '{{ createdDate | default(now()) | formatDate }}',
  version: '{{ version | default("1.0.0") }}',
  active: {{ isActive | default(true) | lower }}
};

// Faker data with fallbacks
export const mockData = {
  user: {
    name: '{{ userName | default('' | fakeName) }}',
    email: '{{ userEmail | default('' | fakeEmail) }}',
    id: '{{ userId | default('' | fakeUuid) }}'
  }
};
```

## Working with Complex Data Structures

### Nested Object Filtering

```njk
---
to: src/types/{{ entityName | kebabCase }}.types.ts
---
{% set entity = {
  name: entityName,
  fields: entityFields,
  relationships: entityRelations
} %}

export interface {{ entityName | pascalCase }} {
{% for field in entity.fields %}
  {{ field.name | camelCase }}{% if not field.required %}?{% endif %}: {{ field.type | pascalCase }};
{% endfor %}
}

export const {{ entityName | constantCase }}_CONFIG = {
  tableName: '{{ entity.name | tableize }}',
  primaryKey: '{{ entity.fields | first | get('name') | snakeCase }}',
  timestamps: true,
  fields: [
{% for field in entity.fields %}
    {
      name: '{{ field.name | snakeCase }}',
      type: '{{ field.type | lower }}',
      required: {{ field.required | default(false) | lower }}
    }{% if not loop.last %},{% endif %}
{% endfor %}
  ]
};
```

### Array Processing with Filters

```njk
---
to: src/enums/{{ enumName | kebabCase }}.enum.ts
---
export enum {{ enumName | pascalCase }} {
{% for value in enumValues %}
  {{ value | constantCase }} = '{{ value | kebabCase }}',
{% endfor %}
}

export const {{ enumName | constantCase }}_LABELS = {
{% for value in enumValues %}
  [{{ enumName | pascalCase }}.{{ value | constantCase }}]: '{{ value | humanize | titleCase }}',
{% endfor %}
};

export const {{ enumName | constantCase }}_OPTIONS = [
{% for value in enumValues %}
  {
    value: {{ enumName | pascalCase }}.{{ value | constantCase }},
    label: '{{ value | humanize | titleCase }}',
    slug: '{{ value | kebabCase }}'
  }{% if not loop.last %},{% endif %}
{% endfor %}
];
```

## Date/Time Filter Integration

### Comprehensive Date Handling

```njk
---
to: src/utils/{{ moduleName | kebabCase }}/date-helpers.ts
---
import dayjs from 'dayjs';

export const DateHelpers = {
  // Current timestamp
  now: '{{ now() | dateIso }}',
  
  // Formatted timestamps
  buildDate: '{{ now() | formatDate('YYYY-MM-DD HH:mm:ss') }}',
  buildTimestamp: '{{ timestamp() }}',
  
  // Relative dates
  weekAgo: '{{ now() | dateSub(1, 'week') | formatDate }}',
  monthFromNow: '{{ now() | dateAdd(1, 'month') | formatDate }}',
  
  // Time ranges
  currentWeekStart: '{{ now() | dateStart('week') | dateIso }}',
  currentWeekEnd: '{{ now() | dateEnd('week') | dateIso }}',
  
  // Utilities
  formatters: {
    iso: (date: Date) => dayjs(date).toISOString(),
    display: (date: Date) => dayjs(date).format('{{ displayFormat | default("MMM D, YYYY") }}'),
    relative: (date: Date) => dayjs(date).fromNow()
  }
};

// Test data with realistic dates
export const TestDates = {
  recent: '{{ now() | dateSub(2, 'days') | dateIso }}',
  future: '{{ now() | dateAdd(30, 'days') | dateIso }}',
  birthday: '{{ '' | fakeDate('1980-01-01', '2000-12-31') | dateIso }}',
  meeting: '{{ now() | dateAdd(1, 'week') | dateStart('day') | dateAdd(9, 'hours') | dateIso }}'
};
```

## Faker Integration Patterns

### Deterministic Fake Data

```njk
---
to: tests/fixtures/{{ entityName | kebabCase }}.fixtures.ts
---
// Set deterministic seed for consistent test data
{{ 42 | fakeSeed }}

export const {{ entityName | pascalCase }}Fixtures = {
  valid: {
    id: '{{ '' | fakeUuid }}',
    name: '{{ '' | fakeName }}',
    email: '{{ '' | fakeEmail }}',
    company: '{{ '' | fakeCompany }}',
    address: '{{ '' | fakeAddress }}',
    city: '{{ '' | fakeCity }}',
    phone: '{{ '' | fakePhone }}',
    active: {{ '' | fakeBoolean }},
    score: {{ '' | fakeNumber(1, 100) }},
    description: '{{ '' | fakeText(2) }}',
    createdAt: '{{ '' | fakeDate('2023-01-01', '2023-12-31') | dateIso }}',
    tags: [
      '{{ ['important', 'urgent', 'draft', 'published'] | fakeArrayElement }}',
      '{{ ['frontend', 'backend', 'mobile', 'devops'] | fakeArrayElement }}'
    ]
  },
  
  // Schema-based generation
  schemaGenerated: {{ {
    name: 'name',
    email: 'email',
    age: { type: 'number', min: 18, max: 65 },
    department: { type: 'arrayElement', array: ['Engineering', 'Marketing', 'Sales'] },
    startDate: { type: 'date', from: '2020-01-01', to: '2023-12-31' },
    active: 'boolean'
  } | fakeSchema | dump }},
  
  // Multiple records
  list: [
{% for i in range(5) %}
    {
      id: '{{ '' | fakeUuid }}',
      name: '{{ '' | fakeName }}',
      role: '{{ ['admin', 'user', 'moderator'] | fakeArrayElement }}'
    }{% if not loop.last %},{% endif %}
{% endfor %}
  ]
};
```

### Localized Fake Data

```njk
---
to: src/i18n/{{ locale }}/fake-data.ts
---
// Set locale for culturally appropriate fake data
{{ locale | fakeLocale }}

export const {{ locale | upper }}FakeData = {
  users: [
{% for i in range(3) %}
    {
      name: '{{ '' | fakeName }}',
      email: '{{ '' | fakeEmail }}',
      city: '{{ '' | fakeCity }}',
      company: '{{ '' | fakeCompany }}',
      phone: '{{ '' | fakePhone }}'
    }{% if not loop.last %},{% endif %}
{% endfor %}
  ],
  
  content: {
    title: '{{ '' | fakeText(1) | titleCase }}',
    description: '{{ '' | fakeParagraph }}',
    keywords: [
{% for i in range(5) %}
      '{{ '' | fakeText(1) | lower | replace('.', '') | trim }}'{% if not loop.last %},{% endif %}
{% endfor %}
    ]
  }
};
```

## Semantic/RDF Filter Integration

### Ontology-Driven Code Generation

```njk
---
to: src/ontology/{{ ontologyName | kebabCase }}.ts
# Requires RDF data to be loaded
---
import { RDF, RDFS, OWL, FOAF } from '@/ontologies';

// Extract classes from ontology
{% set classes = '' | rdfQuery('?s rdf:type owl:Class') %}
export const Classes = {
{% for class in classes %}
  {% set className = class[0].value | rdfLabel | default(class[0].value | rdfCompact) %}
  {{ className | constantCase }}: '{{ class[0].value }}',
{% endfor %}
};

// Extract properties
{% set properties = '' | rdfQuery('?s rdf:type owl:ObjectProperty') %}
export const Properties = {
{% for prop in properties %}
  {% set propName = prop[0].value | rdfLabel | default(prop[0].value | rdfCompact) %}
  {{ propName | constantCase }}: '{{ prop[0].value }}',
{% endfor %}
};

// Generate TypeScript interfaces from RDF classes
{% for class in classes %}
{% set className = class[0].value | rdfLabel | default(class[0].value | rdfCompact) %}
{% set classProps = class[0].value | rdfObject('rdfs:subPropertyOf') %}
export interface {{ className | pascalCase }} {
{% for prop in classProps %}
  {{ prop.value | rdfCompact | camelCase }}: string;
{% endfor %}
}
{% endfor %}
```

## Filter Performance Considerations

### Optimization Strategies

```njk
{# Good: Pre-compute expensive operations #}
{% set entitySlug = entityName | kebabCase %}
{% set entityClass = entityName | pascalCase %}
{% set entityConstant = entityName | constantCase %}
{% set currentDate = now() | formatDate('YYYY-MM-DD') %}

---
to: src/entities/{{ entitySlug }}.entity.ts
---
// Cached transformations used throughout template
export class {{ entityClass }}Entity {
  static readonly TABLE_NAME = '{{ entityName | tableize }}';
  static readonly CONSTANT_NAME = '{{ entityConstant }}';
  static readonly GENERATED_ON = '{{ currentDate }}';
  
  constructor() {
    this.slug = '{{ entitySlug }}';
    this.className = '{{ entityClass }}';
  }
}

{# Avoid: Repeated expensive computations #}
{#
export class {{ entityName | pascalCase }}Entity {
  static readonly TABLE_NAME = '{{ entityName | tableize }}';
  
  getSlug() {
    return '{{ entityName | kebabCase }}'; // Computed every time
  }
  
  getFormattedDate() {
    return '{{ now() | formatDate('YYYY-MM-DD') }}'; // Always different
  }
}
#}
```

### Memory-Efficient Filter Usage

```njk
{# Efficient: Use simple filters for repetitive tasks #}
---
to: src/constants/{{ moduleName | kebabCase }}.constants.ts
---
export const API_ENDPOINTS = {
{% for endpoint in apiEndpoints %}
  {{ endpoint | constantCase }}: '/api/{{ endpoint | kebabCase }}',
{% endfor %}
};

{# Less efficient: Complex filter chains in loops #}
{#
export const COMPLEX_ENDPOINTS = {
{% for endpoint in apiEndpoints %}
  {{ endpoint | pascalCase | replace('Endpoint', '') | constantCase }}: '/api/v{{ apiVersion | default(1) }}/{{ endpoint | kebabCase | pluralize }}/{{ now() | formatDate('YYYY') }}',
{% endfor %}
};
#}
```

## Error Handling and Debugging

### Filter Error Prevention

```njk
---
to: src/{{ componentName | default('component') | kebabCase }}/index.ts
inject: true
skip_if: '{{ not componentName or componentName | length < 1 }}'
---
// Safe filter usage with defaults and checks
{% if componentName and componentName | length > 0 %}
export const ComponentConfig = {
  name: '{{ componentName | pascalCase }}',
  slug: '{{ componentName | kebabCase }}',
  displayName: '{{ componentName | humanize | titleCase }}'
};
{% else %}
export const ComponentConfig = {
  name: 'DefaultComponent',
  slug: 'default-component',
  displayName: 'Default Component'
};
{% endif %}

// Faker with fallbacks
export const TestData = {
  id: '{{ userId | default('' | fakeUuid) }}',
  name: '{{ userName | default('' | fakeName) }}',
  email: '{{ userEmail | default('' | fakeEmail) }}'
};

// Date with validation
{% set validDate = inputDate | default(now()) %}
export const Timestamps = {
  created: '{{ validDate | formatDate }}',
  modified: '{{ validDate | dateAdd(1, 'day') | formatDate }}',
  expires: '{{ validDate | dateAdd(30, 'days') | formatDate }}'
};
```

### Debug Helper Filters

```njk
---
to: debug/{{ componentName | kebabCase }}-debug.json
---
{
  "original": "{{ componentName }}",
  "transformations": {
    "pascalCase": "{{ componentName | pascalCase }}",
    "camelCase": "{{ componentName | camelCase }}",
    "kebabCase": "{{ componentName | kebabCase }}",
    "snakeCase": "{{ componentName | snakeCase }}",
    "constantCase": "{{ componentName | constantCase }}",
    "humanize": "{{ componentName | humanize }}",
    "titleCase": "{{ componentName | titleCase }}"
  },
  "metadata": {
    "generated": "{{ now() | dateIso }}",
    "template": "{{ _template_name | default('unknown') }}",
    "variables": {{ _context | default({}) | dump }}
  }
}
```

This integration guide provides comprehensive patterns for using filters effectively across different contexts in Unjucks templates.