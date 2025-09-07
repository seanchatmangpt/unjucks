# Custom Filter Extension Guide

How to create, register, and extend Unjucks filters for specialized use cases.

## Creating Custom Filters

### Basic Custom Filter Structure

```javascript
// custom-filters.js
export function addCustomFilters(nunjucksEnv) {
  // Simple string transformation
  nunjucksEnv.addFilter('reverse', (str) => {
    if (typeof str !== 'string') return str;
    return str.split('').reverse().join('');
  });
  
  // Filter with parameters
  nunjucksEnv.addFilter('repeat', (str, count = 1) => {
    if (typeof str !== 'string') return str;
    return str.repeat(Math.max(0, count));
  });
  
  // Async filter (for I/O operations)
  nunjucksEnv.addFilter('fileExists', async (filePath) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }, true); // Third parameter 'true' marks filter as async
}
```

### Advanced Custom Filter Patterns

#### 1. Composable Filter Factory

Create filters that build on existing ones:

```javascript
// composable-filters.js
import { pascalCase, kebabCase, snakeCase } from '../lib/nunjucks-filters.js';

export function createComposableFilters(nunjucksEnv) {
  // Framework-specific component naming
  nunjucksEnv.addFilter('reactComponent', (name) => {
    if (!name) return 'Component';
    return `${pascalCase(name)}Component`;
  });
  
  nunjucksEnv.addFilter('vueComponent', (name) => {
    if (!name) return 'Component';
    return {
      className: `${pascalCase(name)}`,
      fileName: `${kebabCase(name)}.vue`,
      selector: `${kebabCase(name)}-component`
    };
  });
  
  // Database-specific naming
  nunjucksEnv.addFilter('dbTable', (entityName, dialect = 'postgresql') => {
    if (!entityName) return 'table';
    
    const baseName = snakeCase(entityName);
    
    switch (dialect) {
      case 'mysql':
        return `\`${baseName}s\``;
      case 'postgresql':
        return `"${baseName}s"`;
      case 'sqlite':
        return `[${baseName}s]`;
      default:
        return `${baseName}s`;
    }
  });
  
  // API endpoint generator
  nunjucksEnv.addFilter('apiEndpoint', (resourceName, options = {}) => {
    if (!resourceName) return '/api';
    
    const {
      version = 'v1',
      namespace = '',
      pluralize = true
    } = options;
    
    const resource = kebabCase(resourceName);
    const plural = pluralize ? `${resource}s` : resource;
    const ns = namespace ? `/${kebabCase(namespace)}` : '';
    
    return `/api/${version}${ns}/${plural}`;
  });
}
```

#### 2. Context-Aware Filters

Filters that access template context:

```javascript
// context-aware-filters.js
export function addContextFilters(nunjucksEnv) {
  // Generate unique IDs based on context
  nunjucksEnv.addFilter('contextId', function(prefix = 'id') {
    // 'this' refers to template context
    const context = this.ctx || this;
    const timestamp = Date.now();
    const hash = context._template_name || 'template';
    
    return `${prefix}-${hash}-${timestamp}`;
  });
  
  // Conditional transformation based on context
  nunjucksEnv.addFilter('contextCase', function(str, rules = {}) {
    const context = this.ctx || this;
    
    // Apply different case based on context variables
    if (context.isReact) return pascalCase(str);
    if (context.isVue) return kebabCase(str);
    if (context.isAngular) return camelCase(str);
    
    return str;
  });
  
  // Access template metadata
  nunjucksEnv.addFilter('templateMeta', function(property) {
    const context = this.ctx || this;
    const meta = {
      name: context._template_name,
      path: context._template_path,
      variables: Object.keys(context).filter(k => !k.startsWith('_'))
    };
    
    return property ? meta[property] : meta;
  });
}
```

#### 3. Validation Filters

Filters for input validation and sanitization:

```javascript
// validation-filters.js
export function addValidationFilters(nunjucksEnv) {
  // Validate and sanitize strings
  nunjucksEnv.addFilter('validateString', (str, rules = {}) => {
    const {
      minLength = 0,
      maxLength = Infinity,
      pattern = null,
      allowEmpty = true,
      sanitize = false
    } = rules;
    
    if (!str && !allowEmpty) {
      throw new Error('String cannot be empty');
    }
    
    const stringValue = String(str || '');
    
    if (stringValue.length < minLength) {
      throw new Error(`String must be at least ${minLength} characters`);
    }
    
    if (stringValue.length > maxLength) {
      throw new Error(`String cannot exceed ${maxLength} characters`);
    }
    
    if (pattern && !new RegExp(pattern).test(stringValue)) {
      throw new Error(`String does not match required pattern: ${pattern}`);
    }
    
    if (sanitize) {
      return stringValue
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/[<>]/g, '')
        .trim();
    }
    
    return stringValue;
  });
  
  // Validate identifiers (variable names, etc.)
  nunjucksEnv.addFilter('validateId', (str) => {
    if (!str) throw new Error('Identifier cannot be empty');
    
    const cleaned = String(str).trim();
    
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(cleaned)) {
      throw new Error('Invalid identifier format');
    }
    
    const reserved = [
      'class', 'const', 'let', 'var', 'function', 'return',
      'if', 'else', 'for', 'while', 'do', 'switch', 'case'
    ];
    
    if (reserved.includes(cleaned)) {
      throw new Error(`"${cleaned}" is a reserved keyword`);
    }
    
    return cleaned;
  });
  
  // Validate file paths
  nunjucksEnv.addFilter('validatePath', (path, options = {}) => {
    const { 
      allowAbsolute = true, 
      extensions = [],
      maxLength = 255 
    } = options;
    
    if (!path) throw new Error('Path cannot be empty');
    
    const pathStr = String(path);
    
    if (pathStr.length > maxLength) {
      throw new Error(`Path exceeds maximum length of ${maxLength}`);
    }
    
    if (!allowAbsolute && pathStr.startsWith('/')) {
      throw new Error('Absolute paths not allowed');
    }
    
    if (pathStr.includes('..')) {
      throw new Error('Path traversal not allowed');
    }
    
    if (extensions.length > 0) {
      const ext = pathStr.split('.').pop();
      if (!extensions.includes(ext)) {
        throw new Error(`Invalid extension. Allowed: ${extensions.join(', ')}`);
      }
    }
    
    return pathStr;
  });
}
```

#### 4. Format-Specific Filters

Filters for different output formats:

```javascript
// format-filters.js
export function addFormatFilters(nunjucksEnv) {
  // HTML escaping with custom rules
  nunjucksEnv.addFilter('escapeHtml', (str, options = {}) => {
    if (!str) return str;
    
    const { 
      quotes = true, 
      spaces = false,
      newlines = false 
    } = options;
    
    let escaped = String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    if (quotes) {
      escaped = escaped
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
    
    if (spaces) {
      escaped = escaped.replace(/ /g, '&nbsp;');
    }
    
    if (newlines) {
      escaped = escaped.replace(/\n/g, '<br>');
    }
    
    return escaped;
  });
  
  // SQL escaping
  nunjucksEnv.addFilter('escapeSql', (str) => {
    if (!str) return str;
    
    return String(str)
      .replace(/'/g, "''")
      .replace(/\\/g, '\\\\')
      .replace(/\x00/g, '\\0')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\x1a/g, '\\Z');
  });
  
  // JSON safe strings
  nunjucksEnv.addFilter('jsonString', (str) => {
    if (str === null || str === undefined) {
      return 'null';
    }
    
    return JSON.stringify(String(str));
  });
  
  // CSS class names
  nunjucksEnv.addFilter('cssClass', (str, prefix = '', suffix = '') => {
    if (!str) return '';
    
    const cleaned = String(str)
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    return `${prefix}${cleaned}${suffix}`;
  });
  
  // URL slug generation
  nunjucksEnv.addFilter('urlSlug', (str, options = {}) => {
    if (!str) return '';
    
    const { 
      maxLength = 50,
      separator = '-',
      lowercase = true 
    } = options;
    
    let slug = String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .trim();
    
    if (lowercase) {
      slug = slug.toLowerCase();
    }
    
    slug = slug
      .replace(/[\s_-]+/g, separator)
      .substring(0, maxLength)
      .replace(new RegExp(`${separator}$`), '');
    
    return slug;
  });
}
```

#### 5. Development Utility Filters

Filters for development and debugging:

```javascript
// dev-utils-filters.js
export function addDevUtilityFilters(nunjucksEnv) {
  // Pretty print with syntax highlighting hints
  nunjucksEnv.addFilter('prettyPrint', (obj, language = 'json') => {
    if (obj === null || obj === undefined) {
      return 'null';
    }
    
    if (language === 'json') {
      return JSON.stringify(obj, null, 2);
    }
    
    if (language === 'yaml') {
      // Simple YAML-like output
      return JSON.stringify(obj, null, 2)
        .replace(/"/g, '')
        .replace(/,$/gm, '')
        .replace(/^\{$/gm, '')
        .replace(/^\}$/gm, '');
    }
    
    return String(obj);
  });
  
  // Generate Lorem Ipsum with control
  nunjucksEnv.addFilter('lorem', (type = 'paragraph', count = 1) => {
    const words = [
      'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 
      'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor',
      'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua'
    ];
    
    switch (type) {
      case 'word':
        return words[Math.floor(Math.random() * words.length)];
      case 'words':
        return Array.from({ length: count }, () => 
          words[Math.floor(Math.random() * words.length)]
        ).join(' ');
      case 'sentence':
        const sentenceLength = Math.floor(Math.random() * 10) + 5;
        const sentence = Array.from({ length: sentenceLength }, () => 
          words[Math.floor(Math.random() * words.length)]
        ).join(' ');
        return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
      case 'paragraph':
        const sentences = Array.from({ length: count }, () => 
          nunjucksEnv.getFilter('lorem')('sentence', 1)
        );
        return sentences.join(' ');
      default:
        return 'Lorem ipsum dolor sit amet.';
    }
  });
  
  // File size formatter
  nunjucksEnv.addFilter('fileSize', (bytes, precision = 2) => {
    if (!bytes || bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(precision)} ${sizes[i]}`;
  });
  
  // Color manipulation
  nunjucksEnv.addFilter('hexToRgb', (hex) => {
    if (!hex) return null;
    
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  });
  
  // Template performance timing
  const timers = new Map();
  
  nunjucksEnv.addFilter('timerStart', (label = 'default') => {
    timers.set(label, performance.now());
    return '';
  });
  
  nunjucksEnv.addFilter('timerEnd', (label = 'default') => {
    const start = timers.get(label);
    if (!start) return 'Timer not found';
    
    const duration = performance.now() - start;
    timers.delete(label);
    
    return `${duration.toFixed(2)}ms`;
  });
}
```

### Filter Registration Patterns

#### 1. Modular Registration

```javascript
// filter-registry.js
import { addCommonFilters } from '../lib/nunjucks-filters.js';
import { addCustomFilters } from './custom-filters.js';
import { addFormatFilters } from './format-filters.js';
import { addValidationFilters } from './validation-filters.js';

export function registerAllFilters(nunjucksEnv, options = {}) {
  const {
    includeBuiltIn = true,
    includeCustom = true,
    includeValidation = false,
    includeFormat = true,
    includeDevUtils = process.env.NODE_ENV === 'development'
  } = options;
  
  // Always register built-in filters first
  if (includeBuiltIn) {
    addCommonFilters(nunjucksEnv);
  }
  
  // Add filter categories based on options
  if (includeCustom) {
    addCustomFilters(nunjucksEnv);
  }
  
  if (includeValidation) {
    addValidationFilters(nunjucksEnv);
  }
  
  if (includeFormat) {
    addFormatFilters(nunjucksEnv);
  }
  
  if (includeDevUtils) {
    const { addDevUtilityFilters } = await import('./dev-utils-filters.js');
    addDevUtilityFilters(nunjucksEnv);
  }
  
  console.log(`Registered ${Object.keys(nunjucksEnv.filters).length} filters`);
}
```

#### 2. Plugin-Style Registration

```javascript
// filter-plugin-system.js
export class FilterPlugin {
  constructor(name, version = '1.0.0') {
    this.name = name;
    this.version = version;
    this.filters = new Map();
    this.dependencies = [];
  }
  
  addFilter(name, filter, options = {}) {
    this.filters.set(name, { filter, options });
    return this;
  }
  
  depends(pluginName) {
    this.dependencies.push(pluginName);
    return this;
  }
  
  register(nunjucksEnv) {
    // Check dependencies
    for (const dep of this.dependencies) {
      if (!nunjucksEnv._registeredPlugins?.has(dep)) {
        throw new Error(`Plugin ${this.name} depends on ${dep} which is not loaded`);
      }
    }
    
    // Register filters
    for (const [name, { filter, options }] of this.filters) {
      if (options.async) {
        nunjucksEnv.addFilter(name, filter, true);
      } else {
        nunjucksEnv.addFilter(name, filter);
      }
    }
    
    // Track registration
    if (!nunjucksEnv._registeredPlugins) {
      nunjucksEnv._registeredPlugins = new Set();
    }
    nunjucksEnv._registeredPlugins.add(this.name);
    
    console.log(`Registered plugin: ${this.name} v${this.version}`);
  }
}

// Example plugin
export const StringUtilsPlugin = new FilterPlugin('string-utils', '1.0.0')
  .addFilter('initials', (name) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase();
  })
  .addFilter('wordCount', (text) => {
    return text.split(/\s+/).length;
  })
  .addFilter('readingTime', (text, wordsPerMinute = 200) => {
    const words = text.split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return `${minutes} min read`;
  });
```

### Testing Custom Filters

```javascript
// custom-filter-tests.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import nunjucks from 'nunjucks';
import { addCustomFilters } from './custom-filters.js';

describe('Custom Filters', () => {
  let env;
  
  beforeEach(() => {
    env = new nunjucks.Environment();
    addCustomFilters(env);
  });
  
  describe('reverse filter', () => {
    it('should reverse string', () => {
      const result = env.renderString('{{ "hello" | reverse }}');
      expect(result).toBe('olleh');
    });
    
    it('should handle empty string', () => {
      const result = env.renderString('{{ "" | reverse }}');
      expect(result).toBe('');
    });
    
    it('should handle non-string input', () => {
      const result = env.renderString('{{ 123 | reverse }}');
      expect(result).toBe('123'); // Should return as-is for non-strings
    });
  });
  
  describe('repeat filter', () => {
    it('should repeat string', () => {
      const result = env.renderString('{{ "hi" | repeat(3) }}');
      expect(result).toBe('hihihi');
    });
    
    it('should handle zero count', () => {
      const result = env.renderString('{{ "hi" | repeat(0) }}');
      expect(result).toBe('');
    });
    
    it('should handle negative count', () => {
      const result = env.renderString('{{ "hi" | repeat(-1) }}');
      expect(result).toBe('');
    });
  });
  
  describe('validation filters', () => {
    it('should validate string length', () => {
      expect(() => {
        env.renderString('{{ "hi" | validateString({minLength: 5}) }}');
      }).toThrow('String must be at least 5 characters');
    });
    
    it('should validate identifiers', () => {
      const result = env.renderString('{{ "validId123" | validateId }}');
      expect(result).toBe('validId123');
      
      expect(() => {
        env.renderString('{{ "123invalid" | validateId }}');
      }).toThrow('Invalid identifier format');
    });
  });
});
```

## Usage in Templates

### Basic Custom Filter Usage

```njk
---
to: src/{{ componentName | validateId | pascalCase }}.tsx
skip_if: '{{ not componentName }}'
---
import React from 'react';

/**
 * Component: {{ componentName | humanize | titleCase }}
 * Generated: {{ now() | formatDate('YYYY-MM-DD HH:mm:ss') }}
 * Template ID: {{ 'component' | contextId }}
 */
export const {{ componentName | pascalCase }} = () => {
  return (
    <div className="{{ componentName | cssClass('component-') }}">
      <h1>{{ componentName | humanize | titleCase }}</h1>
      <p>Reading time: {{ description | default('' | lorem('paragraph', 2)) | readingTime }}</p>
      <div className="metadata">
        <span>{{ componentName | initials }}</span>
        <span>{{ description | wordCount }} words</span>
        <time>{{ now() | formatDate('MMM D, YYYY') }}</time>
      </div>
    </div>
  );
};

export default {{ componentName | pascalCase }};
```

### Advanced Filter Composition

```njk
---
to: database/migrations/{{ now() | formatDate('YYYYMMDD_HHmmss') }}_create_{{ tableName | validateString | dbTable('postgresql') | replace('"', '') }}.sql
---
-- Migration generated with custom filters
-- Table: {{ tableName | validateString | dbTable('postgresql') }}
-- API: {{ tableName | apiEndpoint({version: 'v2', namespace: 'admin'}) }}

CREATE TABLE {{ tableName | validateString | dbTable('postgresql') }} (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL DEFAULT '{{ tableName | urlSlug }}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_{{ tableName | snakeCase }}_slug ON {{ tableName | dbTable('postgresql') }} (slug);
CREATE INDEX idx_{{ tableName | snakeCase }}_created ON {{ tableName | dbTable('postgresql') }} (created_at);

-- Sample data
INSERT INTO {{ tableName | dbTable('postgresql') }} (name, slug) VALUES
  ('{{ '' | lorem('words', 2) | titleCase }}', '{{ '' | lorem('words', 2) | urlSlug }}'),
  ('{{ '' | lorem('words', 3) | titleCase }}', '{{ '' | lorem('words', 3) | urlSlug }}');
```

This custom filter guide provides comprehensive patterns for extending Unjucks with specialized functionality tailored to your specific use cases.