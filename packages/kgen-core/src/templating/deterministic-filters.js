/**
 * KGEN Deterministic Filters
 * 
 * Provides deterministic template filters for consistent, reproducible rendering.
 * All filters are designed to produce identical output given identical input.
 */

import crypto from 'crypto';

/**
 * Create deterministic filter collection
 * @param {Object} options - Filter configuration options
 * @returns {Object} Collection of deterministic filters
 */
export function createDeterministicFilters(options = {}) {
  const { enableCache = true, deterministic = true } = options;
  
  const filters = {
    // String manipulation filters
    camelCase: (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/[-_\s]+([a-z])/g, (_, char) => char.toUpperCase())
                .replace(/^[A-Z]/, char => char.toLowerCase());
    },
    
    pascalCase: (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/[-_\s]+([a-z])/g, (_, char) => char.toUpperCase())
                .replace(/^[a-z]/, char => char.toUpperCase());
    },
    
    kebabCase: (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/([A-Z])/g, '-$1')
                .replace(/[-_\s]+/g, '-')
                .toLowerCase()
                .replace(/^-/, '');
    },
    
    snakeCase: (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/([A-Z])/g, '_$1')
                .replace(/[-\s]+/g, '_')
                .toLowerCase()
                .replace(/^_/, '');
    },
    
    constantCase: (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/([A-Z])/g, '_$1')
                .replace(/[-\s]+/g, '_')
                .toUpperCase()
                .replace(/^_/, '');
    },
    
    upper: (str) => {
      if (typeof str !== 'string') return str;
      return str.toUpperCase();
    },
    
    lower: (str) => {
      if (typeof str !== 'string') return str;
      return str.toLowerCase();
    },
    
    capitalize: (str) => {
      if (typeof str !== 'string') return str;
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },
    
    title: (str) => {
      if (typeof str !== 'string') return str;
      return str.split(/\s+/).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    },
    
    // Array manipulation filters
    join: (arr, separator = '') => {
      if (!Array.isArray(arr)) return arr;
      return arr.join(separator);
    },
    
    sort: (arr, key = null) => {
      if (!Array.isArray(arr)) return arr;
      const sorted = [...arr]; // Create copy to avoid mutation
      
      if (key) {
        return sorted.sort((a, b) => {
          const aVal = typeof a === 'object' ? a[key] : a;
          const bVal = typeof b === 'object' ? b[key] : b;
          
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return aVal.localeCompare(bVal);
          }
          
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        });
      }
      
      return sorted.sort();
    },
    
    unique: (arr) => {
      if (!Array.isArray(arr)) return arr;
      return [...new Set(arr)];
    },
    
    reverse: (arr) => {
      if (!Array.isArray(arr)) return arr;
      return [...arr].reverse(); // Create copy to avoid mutation
    },
    
    // Number formatting filters
    number: (val) => {
      const num = Number(val);
      return isNaN(num) ? val : num;
    },
    
    round: (num, precision = 0) => {
      const n = Number(num);
      if (isNaN(n)) return num;
      return Math.round(n * Math.pow(10, precision)) / Math.pow(10, precision);
    },
    
    // Object manipulation filters
    keys: (obj) => {
      if (typeof obj !== 'object' || obj === null) return [];
      return Object.keys(obj).sort(); // Sorted for determinism
    },
    
    values: (obj) => {
      if (typeof obj !== 'object' || obj === null) return [];
      const keys = Object.keys(obj).sort(); // Sorted for determinism
      return keys.map(key => obj[key]);
    },
    
    // Hash and encoding filters
    hash: (content, algorithm = 'sha256') => {
      if (typeof content !== 'string') {
        content = JSON.stringify(content);
      }
      return crypto.createHash(algorithm).update(content).digest('hex');
    },
    
    base64: (str) => {
      if (typeof str !== 'string') return str;
      return Buffer.from(str).toString('base64');
    },
    
    // JSON filters
    json: (obj, indent = null) => {
      try {
        if (deterministic && typeof obj === 'object' && obj !== null) {
          // Sort object keys for deterministic output
          obj = sortObjectKeys(obj);
        }
        return JSON.stringify(obj, null, indent);
      } catch (e) {
        return obj;
      }
    },
    
    // Date filters (deterministic when given fixed input)
    dateFormat: (date, format = 'YYYY-MM-DD') => {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return date;
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      
      return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
    },
    
    // Template-specific filters
    indent: (str, spaces = 2) => {
      if (typeof str !== 'string') return str;
      const indent = ' '.repeat(spaces);
      return str.split('\n').map(line => line ? indent + line : line).join('\n');
    },
    
    comment: (str, style = '//') => {
      if (typeof str !== 'string') return str;
      return str.split('\n').map(line => line ? `${style} ${line}` : line).join('\n');
    },
    
    // Code generation filters
    quote: (str, quoteChar = '"') => {
      if (typeof str !== 'string') return str;
      return `${quoteChar}${str.replace(new RegExp(quoteChar, 'g'), '\\' + quoteChar)}${quoteChar}`;
    },
    
    escape: (str) => {
      if (typeof str !== 'string') return str;
      return str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    },
    
    // Validation filters
    required: (val, message = 'Value is required') => {
      if (val === null || val === undefined || val === '') {
        throw new Error(message);
      }
      return val;
    },
    
    default: (val, defaultVal = '') => {
      return (val === null || val === undefined || val === '') ? defaultVal : val;
    },
    
    // Utility filters
    length: (val) => {
      if (Array.isArray(val) || typeof val === 'string') {
        return val.length;
      }
      if (typeof val === 'object' && val !== null) {
        return Object.keys(val).length;
      }
      return 0;
    },
    
    slice: (arr, start = 0, end) => {
      if (!Array.isArray(arr) && typeof arr !== 'string') return arr;
      return arr.slice(start, end);
    },
    
    first: (arr) => {
      if (!Array.isArray(arr)) return arr;
      return arr[0];
    },
    
    last: (arr) => {
      if (!Array.isArray(arr)) return arr;
      return arr[arr.length - 1];
    }
  };
  
  return filters;
}

/**
 * Sort object keys recursively for deterministic output
 * @param {any} obj - Object to sort
 * @returns {any} Object with sorted keys
 */
function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  
  const sortedKeys = Object.keys(obj).sort();
  const sortedObj = {};
  
  for (const key of sortedKeys) {
    sortedObj[key] = sortObjectKeys(obj[key]);
  }
  
  return sortedObj;
}

export default createDeterministicFilters;