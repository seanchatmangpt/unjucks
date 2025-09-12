/**
 * KGEN Deterministic Filters for Template Engine
 * 
 * Collection of filters that ensure byte-for-byte identical output
 * for the same inputs, removing non-deterministic behaviors.
 */

import crypto from 'crypto';

/**
 * Create deterministic filter collection
 * @param {Object} options - Filter configuration
 * @returns {Object} Collection of deterministic filters
 */
export function createDeterministicFilters(options = {}) {
  const { enableCache = true, deterministic = true } = options;
  
  // Filter cache for performance
  const filterCache = new Map();
  
  const filters = {
    // String manipulation filters
    camelCase: (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      }).replace(/\s+/g, '');
    },
    
    pascalCase: (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => {
        return word.toUpperCase();
      }).replace(/\s+/g, '');
    },
    
    kebabCase: (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/\s+/g, '-')
                .toLowerCase();
    },
    
    snakeCase: (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/([a-z])([A-Z])/g, '$1_$2')
                .replace(/\s+/g, '_')
                .toLowerCase();
    },
    
    constantCase: (str) => {
      if (typeof str !== 'string') return str;
      return filters.snakeCase(str).toUpperCase();
    },
    
    // Deterministic hashing
    hash: (content, algorithm = 'sha256') => {
      if (content == null) return '';
      const str = typeof content === 'string' ? content : JSON.stringify(content);
      return crypto.createHash(algorithm).update(str).digest('hex');
    },
    
    shortHash: (content, length = 8) => {
      return filters.hash(content).substring(0, length);
    },
    
    // Object manipulation with sorted keys
    sortKeys: (obj) => {
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        return obj;
      }
      
      const sorted = {};
      Object.keys(obj).sort().forEach(key => {
        sorted[key] = filters.sortKeys(obj[key]);
      });
      return sorted;
    },
    
    // Array operations
    unique: (arr) => {
      if (!Array.isArray(arr)) return arr;
      return [...new Set(arr)];
    },
    
    sortBy: (arr, key) => {
      if (!Array.isArray(arr)) return arr;
      return [...arr].sort((a, b) => {
        const aVal = key ? a[key] : a;
        const bVal = key ? b[key] : b;
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
        return 0;
      });
    },
    
    groupBy: (arr, key) => {
      if (!Array.isArray(arr)) return {};
      
      const groups = arr.reduce((acc, item) => {
        const groupKey = typeof key === 'function' ? key(item) : item[key];
        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(item);
        return acc;
      }, {});
      
      // Return with sorted keys for deterministic output
      return filters.sortKeys(groups);
    },
    
    // Filtering operations
    where: (arr, property, value) => {
      if (!Array.isArray(arr)) return arr;
      if (value === undefined) {
        // Filter truthy values
        return arr.filter(item => item[property]);
      }
      return arr.filter(item => item[property] === value);
    },
    
    // String formatting
    indent: (str, spaces = 2) => {
      if (typeof str !== 'string') return str;
      const indentation = ' '.repeat(spaces);
      return str.split('\n').map(line => line ? indentation + line : line).join('\n');
    },
    
    trim: (str) => {
      return typeof str === 'string' ? str.trim() : str;
    },
    
    // Code generation helpers
    stringify: (obj, indent = 2) => {
      if (obj === null || obj === undefined) return 'null';
      
      // Sort object keys for deterministic output
      const sortedObj = filters.sortKeys(obj);
      return JSON.stringify(sortedObj, null, indent);
    },
    
    // Path manipulation
    dirname: (filepath) => {
      if (typeof filepath !== 'string') return filepath;
      const lastSlash = filepath.lastIndexOf('/');
      return lastSlash === -1 ? '.' : filepath.substring(0, lastSlash);
    },
    
    basename: (filepath, ext) => {
      if (typeof filepath !== 'string') return filepath;
      let base = filepath.substring(filepath.lastIndexOf('/') + 1);
      if (ext && base.endsWith(ext)) {
        base = base.substring(0, base.length - ext.length);
      }
      return base;
    },
    
    extname: (filepath) => {
      if (typeof filepath !== 'string') return '';
      const lastDot = filepath.lastIndexOf('.');
      return lastDot === -1 ? '' : filepath.substring(lastDot);
    },
    
    // Type checking
    isString: (value) => typeof value === 'string',
    isNumber: (value) => typeof value === 'number',
    isBoolean: (value) => typeof value === 'boolean',
    isArray: (value) => Array.isArray(value),
    isObject: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
    
    // Utility filters
    default: (value, defaultValue) => {
      return (value !== null && value !== undefined && value !== '') ? value : defaultValue;
    },
    
    length: (value) => {
      if (typeof value === 'string' || Array.isArray(value)) {
        return value.length;
      }
      if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length;
      }
      return 0;
    },
    
    // Deterministic date formatting (removes current time dependencies)
    dateFormat: (dateStr, format = 'iso') => {
      // Only format if we have a fixed date string
      if (typeof dateStr !== 'string') return dateStr;
      
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        
        switch (format) {
          case 'iso':
            return date.toISOString();
          case 'date':
            return date.toISOString().split('T')[0];
          case 'year':
            return date.getFullYear().toString();
          default:
            return date.toISOString();
        }
      } catch {
        return dateStr;
      }
    },
    
    // Math operations
    add: (a, b) => Number(a) + Number(b),
    subtract: (a, b) => Number(a) - Number(b),
    multiply: (a, b) => Number(a) * Number(b),
    divide: (a, b) => Number(a) / Number(b),
    modulo: (a, b) => Number(a) % Number(b),
    
    // List operations
    first: (arr, n = 1) => {
      if (!Array.isArray(arr)) return arr;
      return n === 1 ? arr[0] : arr.slice(0, n);
    },
    
    last: (arr, n = 1) => {
      if (!Array.isArray(arr)) return arr;
      return n === 1 ? arr[arr.length - 1] : arr.slice(-n);
    },
    
    slice: (arr, start, end) => {
      if (!Array.isArray(arr) && typeof arr !== 'string') return arr;
      return arr.slice(start, end);
    },
    
    // Template utilities
    comment: (text) => `<!-- ${text} -->`,
    
    // Encoding/decoding
    base64: (str) => {
      if (typeof str !== 'string') return str;
      return Buffer.from(str, 'utf8').toString('base64');
    },
    
    base64decode: (str) => {
      if (typeof str !== 'string') return str;
      try {
        return Buffer.from(str, 'base64').toString('utf8');
      } catch {
        return str;
      }
    },
    
    // URL encoding
    urlEncode: (str) => {
      if (typeof str !== 'string') return str;
      return encodeURIComponent(str);
    },
    
    urlDecode: (str) => {
      if (typeof str !== 'string') return str;
      try {
        return decodeURIComponent(str);
      } catch {
        return str;
      }
    }
  };
  
  // Add caching wrapper if enabled
  if (enableCache) {
    const cachedFilters = {};
    
    for (const [name, filter] of Object.entries(filters)) {
      cachedFilters[name] = (...args) => {
        if (args.length === 0) return filter();
        
        const cacheKey = `${name}:${JSON.stringify(args)}`;
        
        if (filterCache.has(cacheKey)) {
          return filterCache.get(cacheKey);
        }
        
        const result = filter(...args);
        filterCache.set(cacheKey, result);
        return result;
      };
    }
    
    return cachedFilters;
  }
  
  return filters;
}

/**
 * Get filter documentation/help
 * @returns {Object} Filter documentation
 */
export function getFilterHelp() {
  return {
    string: {
      camelCase: 'Convert string to camelCase format',
      pascalCase: 'Convert string to PascalCase format',
      kebabCase: 'Convert string to kebab-case format',
      snakeCase: 'Convert string to snake_case format',
      constantCase: 'Convert string to CONSTANT_CASE format',
      indent: 'Indent each line of string by specified spaces',
      trim: 'Remove leading and trailing whitespace'
    },
    hash: {
      hash: 'Generate deterministic hash of content',
      shortHash: 'Generate short hash (8 chars by default)'
    },
    object: {
      sortKeys: 'Sort object keys recursively for deterministic output',
      stringify: 'Convert to JSON string with sorted keys'
    },
    array: {
      unique: 'Remove duplicate values from array',
      sortBy: 'Sort array by property or value',
      groupBy: 'Group array items by property',
      where: 'Filter array by property value',
      first: 'Get first n items',
      last: 'Get last n items',
      slice: 'Extract portion of array'
    },
    utility: {
      default: 'Provide default value if input is null/undefined/empty',
      length: 'Get length of string, array, or object',
      comment: 'Wrap text in HTML comment',
      isString: 'Check if value is string',
      isNumber: 'Check if value is number',
      isBoolean: 'Check if value is boolean',
      isArray: 'Check if value is array',
      isObject: 'Check if value is object'
    },
    encoding: {
      base64: 'Encode string to base64',
      base64decode: 'Decode base64 string',
      urlEncode: 'URL encode string',
      urlDecode: 'URL decode string'
    },
    path: {
      dirname: 'Get directory path',
      basename: 'Get filename with optional extension removal',
      extname: 'Get file extension'
    },
    math: {
      add: 'Add two numbers',
      subtract: 'Subtract second number from first',
      multiply: 'Multiply two numbers',
      divide: 'Divide first number by second',
      modulo: 'Get remainder of division'
    },
    date: {
      dateFormat: 'Format date string (deterministic only)'
    }
  };
}

export default createDeterministicFilters;