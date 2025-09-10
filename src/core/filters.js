/**
 * Unjucks Filter Pipeline System
 * 
 * Comprehensive filter system with 65+ filters organized into functional categories.
 * Provides powerful chaining, composition, and error handling capabilities.
 * 
 * Categories:
 * - Basic String Filters (20+ filters)
 * - Date & Time Filters (8+ filters) 
 * - Collection Filters (12+ filters)
 * - RDF/Semantic Filters (12+ filters)
 * - LaTeX/Academic Filters (8+ filters)
 * - Advanced Utility Filters (5+ filters)
 */

import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { createRDFFilters } from '../lib/rdf-filters.js';

// Configure dayjs plugins
dayjs.extend(customParseFormat);
dayjs.extend(relativeTime);
dayjs.extend(timezone);
dayjs.extend(utc);

/**
 * Filter Pipeline System
 * 
 * Provides a comprehensive filter registration and execution system
 * with error handling, caching, and composition capabilities.
 */
export class FilterPipeline {
  constructor(options = {}) {
    this.options = {
      enableCache: true,
      maxCacheSize: 1000,
      enableErrorRecovery: true,
      strictMode: false,
      ...options
    };

    // Filter storage
    this.filters = new Map();
    this.categories = new Map();
    this.cache = new Map();
    this.errorLog = [];

    // Performance tracking
    this.stats = {
      filterCalls: 0,
      cacheHits: 0,
      errors: 0,
      totalExecutionTime: 0
    };

    // Initialize default filters
    this.initializeFilters();
  }

  /**
   * Initialize all default filter categories
   */
  initializeFilters() {
    // Register filter categories
    this.registerBasicStringFilters();
    this.registerDateTimeFilters();
    this.registerCollectionFilters();
    this.registerRDFFilters();
    this.registerLaTeXFilters();
    this.registerAdvancedFilters();
  }

  /**
   * Register a single filter
   * @param {string} name - Filter name
   * @param {Function} fn - Filter function
   * @param {string} category - Filter category
   * @param {Object} options - Filter options
   */
  registerFilter(name, fn, category = 'custom', options = {}) {
    const filter = {
      name,
      fn: this.wrapFilter(fn, name),
      category,
      options: {
        cacheable: true,
        async: false,
        ...options
      }
    };

    this.filters.set(name, filter);
    
    // Add to category
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set());
    }
    this.categories.get(category).add(name);
  }

  /**
   * Wrap filter function with error handling and caching
   */
  wrapFilter(fn, name) {
    return (...args) => {
      const startTime = performance.now();
      this.stats.filterCalls++;

      try {
        // Check cache
        const cacheKey = this.getCacheKey(name, args);
        if (this.options.enableCache && this.cache.has(cacheKey)) {
          this.stats.cacheHits++;
          return this.cache.get(cacheKey);
        }

        // Execute filter
        const result = fn(...args);
        
        // Cache result if cacheable
        const filter = this.filters.get(name);
        if (filter?.options.cacheable && this.cache.size < this.options.maxCacheSize) {
          this.cache.set(cacheKey, result);
        }

        // Record performance
        this.stats.totalExecutionTime += performance.now() - startTime;
        
        return result;

      } catch (error) {
        this.stats.errors++;
        this.errorLog.push({
          filter: name,
          args: args,
          error: error.message,
          timestamp: new Date().toISOString()
        });

        if (this.options.strictMode) {
          throw error;
        }

        // Return fallback value
        return this.getFallbackValue(args[0], error);
      }
    };
  }

  /**
   * Generate cache key for filter call
   */
  getCacheKey(name, args) {
    return `${name}:${JSON.stringify(args)}`;
  }

  /**
   * Get fallback value for failed filter
   */
  getFallbackValue(input, error) {
    if (this.options.enableErrorRecovery) {
      // Return original input if error recovery enabled
      return input;
    }
    return `[Filter Error: ${error.message}]`;
  }

  // =================== BASIC STRING FILTERS ===================

  registerBasicStringFilters() {
    const category = 'string';

    // Case transformation filters
    this.registerFilter('pascalCase', (str) => {
      if (typeof str !== 'string') return String(str);
      return str.replace(/(?:^|[-_\s])(\w)/g, (_, char) => char.toUpperCase()).replace(/[-_\s]/g, '');
    }, category);

    this.registerFilter('camelCase', (str) => {
      if (typeof str !== 'string') return String(str);
      const pascal = str.replace(/(?:^|[-_\s])(\w)/g, (_, char) => char.toUpperCase()).replace(/[-_\s]/g, '');
      return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    }, category);

    this.registerFilter('kebabCase', (str) => {
      if (typeof str !== 'string') return String(str);
      return str.replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[\s_]+/g, '-')
                .toLowerCase();
    }, category);

    this.registerFilter('snakeCase', (str) => {
      if (typeof str !== 'string') return String(str);
      return str.replace(/([a-z])([A-Z])/g, '$1_$2')
                .replace(/[\s-]+/g, '_')
                .toLowerCase();
    }, category);

    this.registerFilter('upperCase', (str) => {
      if (typeof str !== 'string') return String(str);
      return str.toUpperCase();
    }, category);

    this.registerFilter('lowerCase', (str) => {
      if (typeof str !== 'string') return String(str);
      return str.toLowerCase();
    }, category);

    this.registerFilter('titleCase', (str) => {
      if (typeof str !== 'string') return String(str);
      return str.replace(/\w\S*/g, (txt) => 
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      );
    }, category);

    this.registerFilter('constantCase', (str) => {
      if (typeof str !== 'string') return String(str);
      return str.replace(/([a-z])([A-Z])/g, '$1_$2')
                .replace(/[\s-]+/g, '_')
                .toUpperCase();
    }, category);

    // String manipulation filters
    this.registerFilter('capitalize', (str) => {
      if (typeof str !== 'string') return String(str);
      return str.charAt(0).toUpperCase() + str.slice(1);
    }, category);

    this.registerFilter('slug', (str) => {
      if (typeof str !== 'string') return String(str);
      return str.toLowerCase()
                .trim()
                .replace(/[^\w\s-]/g, '')
                .replace(/[\s_-]+/g, '-')
                .replace(/^-+|-+$/g, '');
    }, category);

    this.registerFilter('humanize', (str) => {
      if (typeof str !== 'string') return String(str);
      return str.replace(/[-_]/g, ' ')
                .replace(/([a-z])([A-Z])/g, '$1 $2')
                .replace(/\b\w/g, l => l.toUpperCase())
                .trim();
    }, category);

    this.registerFilter('trim', (str) => {
      if (typeof str !== 'string') return String(str);
      return str.trim();
    }, category);

    this.registerFilter('pad', (str, length, char = ' ') => {
      if (typeof str !== 'string') str = String(str);
      const padLength = Math.max(0, length - str.length);
      const leftPad = Math.floor(padLength / 2);
      const rightPad = padLength - leftPad;
      return char.repeat(leftPad) + str + char.repeat(rightPad);
    }, category);

    this.registerFilter('truncate', (str, length = 50, suffix = '...') => {
      if (typeof str !== 'string') return String(str);
      if (str.length <= length) return str;
      return str.substring(0, length - suffix.length) + suffix;
    }, category);

    this.registerFilter('replace', (str, search, replacement = '') => {
      if (typeof str !== 'string') return String(str);
      const regex = new RegExp(search, 'g');
      return str.replace(regex, replacement);
    }, category);

    this.registerFilter('stripTags', (str) => {
      if (typeof str !== 'string') return String(str);
      return str.replace(/<[^>]*>/g, '');
    }, category);

    // Formatting filters
    this.registerFilter('wrap', (str, prefix = '', suffix = '') => {
      if (typeof str !== 'string') return String(str);
      return prefix + str + suffix;
    }, category);

    this.registerFilter('indent', (str, spaces = 2) => {
      if (typeof str !== 'string') return String(str);
      const indent = ' '.repeat(spaces);
      return str.split('\n').map(line => indent + line).join('\n');
    }, category);

    this.registerFilter('escape', (str) => {
      if (typeof str !== 'string') return String(str);
      return str.replace(/[&<>"']/g, (match) => {
        const escapeMap = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        };
        return escapeMap[match];
      });
    }, category);

    this.registerFilter('unescape', (str) => {
      if (typeof str !== 'string') return String(str);
      return str.replace(/&(amp|lt|gt|quot|#39);/g, (match) => {
        const unescapeMap = {
          '&amp;': '&',
          '&lt;': '<',
          '&gt;': '>',
          '&quot;': '"',
          '&#39;': "'"
        };
        return unescapeMap[match];
      });
    }, category);

    this.registerFilter('quote', (str, quote = '"') => {
      if (typeof str !== 'string') return String(str);
      return quote + str + quote;
    }, category);

    this.registerFilter('unquote', (str) => {
      if (typeof str !== 'string') return String(str);
      if ((str.startsWith('"') && str.endsWith('"')) ||
          (str.startsWith("'") && str.endsWith("'"))) {
        return str.slice(1, -1);
      }
      return str;
    }, category);
  }

  // =================== DATE & TIME FILTERS ===================

  registerDateTimeFilters() {
    const category = 'datetime';

    this.registerFilter('dateFormat', (date, format = 'YYYY-MM-DD') => {
      return dayjs(date).format(format);
    }, category);

    this.registerFilter('fromNow', (date) => {
      return dayjs(date).fromNow();
    }, category);

    this.registerFilter('timezone', (date, tz) => {
      return dayjs(date).tz(tz);
    }, category);

    this.registerFilter('addDays', (date, days) => {
      return dayjs(date).add(days, 'day').toISOString();
    }, category);

    this.registerFilter('subtractDays', (date, days) => {
      return dayjs(date).subtract(days, 'day').toISOString();
    }, category);

    this.registerFilter('startOf', (date, unit = 'day') => {
      return dayjs(date).startOf(unit).toISOString();
    }, category);

    this.registerFilter('endOf', (date, unit = 'day') => {
      return dayjs(date).endOf(unit).toISOString();
    }, category);

    this.registerFilter('toISOString', (date) => {
      return dayjs(date).toISOString();
    }, category);
  }

  // =================== COLLECTION FILTERS ===================

  registerCollectionFilters() {
    const category = 'collection';

    this.registerFilter('sort', (arr, key) => {
      if (!Array.isArray(arr)) return arr;
      if (!key) return [...arr].sort();
      return [...arr].sort((a, b) => {
        const aVal = typeof a === 'object' ? a[key] : a;
        const bVal = typeof b === 'object' ? b[key] : b;
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      });
    }, category);

    this.registerFilter('filter', (arr, key, value) => {
      if (!Array.isArray(arr)) return arr;
      return arr.filter(item => {
        if (arguments.length === 2 && typeof key === 'function') {
          return key(item);
        }
        if (typeof item === 'object' && item[key] !== undefined) {
          return value !== undefined ? item[key] === value : !!item[key];
        }
        return !!item;
      });
    }, category);

    this.registerFilter('map', (arr, key, ...args) => {
      if (!Array.isArray(arr)) return arr;
      return arr.map(item => {
        if (typeof key === 'function') {
          return key(item, ...args);
        }
        if (typeof item === 'object' && item[key] !== undefined) {
          if (typeof item[key] === 'function') {
            return item[key](...args);
          }
          return item[key];
        }
        return item;
      });
    }, category);

    this.registerFilter('reduce', (arr, fn, initial) => {
      if (!Array.isArray(arr)) return arr;
      return arr.reduce(fn, initial);
    }, category);

    this.registerFilter('unique', (arr) => {
      if (!Array.isArray(arr)) return arr;
      return [...new Set(arr)];
    }, category);

    this.registerFilter('flatten', (arr, depth = 1) => {
      if (!Array.isArray(arr)) return arr;
      return arr.flat(depth);
    }, category);

    this.registerFilter('chunk', (arr, size) => {
      if (!Array.isArray(arr)) return arr;
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    }, category);

    this.registerFilter('zip', (arr1, arr2) => {
      if (!Array.isArray(arr1) || !Array.isArray(arr2)) return [];
      const length = Math.min(arr1.length, arr2.length);
      return Array.from({ length }, (_, i) => [arr1[i], arr2[i]]);
    }, category);

    // Object operations
    this.registerFilter('keys', (obj) => {
      if (typeof obj !== 'object' || obj === null) return [];
      return Object.keys(obj);
    }, category);

    this.registerFilter('values', (obj) => {
      if (typeof obj !== 'object' || obj === null) return [];
      return Object.values(obj);
    }, category);

    this.registerFilter('pairs', (obj) => {
      if (typeof obj !== 'object' || obj === null) return [];
      return Object.entries(obj);
    }, category);

    this.registerFilter('merge', (...objects) => {
      return Object.assign({}, ...objects.filter(obj => typeof obj === 'object' && obj !== null));
    }, category);

    this.registerFilter('pick', (obj, ...keys) => {
      if (typeof obj !== 'object' || obj === null) return {};
      const result = {};
      keys.forEach(key => {
        if (key in obj) result[key] = obj[key];
      });
      return result;
    }, category);

    this.registerFilter('omit', (obj, ...keys) => {
      if (typeof obj !== 'object' || obj === null) return {};
      const result = { ...obj };
      keys.forEach(key => delete result[key]);
      return result;
    }, category);

    this.registerFilter('groupBy', (arr, key) => {
      if (!Array.isArray(arr)) return {};
      return arr.reduce((groups, item) => {
        const groupKey = typeof item === 'object' ? item[key] : item;
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(item);
        return groups;
      }, {});
    }, category);

    // Utility operations
    this.registerFilter('length', (value) => {
      if (value === null || value === undefined) return 0;
      return value.length || 0;
    }, category);

    this.registerFilter('first', (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return undefined;
      return arr[0];
    }, category);

    this.registerFilter('last', (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return undefined;
      return arr[arr.length - 1];
    }, category);

    this.registerFilter('slice', (arr, start, end) => {
      if (!Array.isArray(arr)) return arr;
      return arr.slice(start, end);
    }, category);

    this.registerFilter('reverse', (arr) => {
      if (!Array.isArray(arr)) return arr;
      return [...arr].reverse();
    }, category);

    this.registerFilter('shuffle', (arr) => {
      if (!Array.isArray(arr)) return arr;
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }, category);
  }

  // =================== RDF/SEMANTIC FILTERS ===================

  registerRDFFilters() {
    const category = 'rdf';
    const rdfFilters = createRDFFilters();
    
    // Register existing RDF filters
    Object.entries(rdfFilters).forEach(([name, fn]) => {
      this.registerFilter(name, fn, category, { cacheable: true });
    });

    // Add additional semantic filters
    this.registerFilter('rdfSerialize', (data, format = 'turtle') => {
      // Placeholder for RDF serialization
      return `# RDF data serialized as ${format}\n${JSON.stringify(data, null, 2)}`;
    }, category);

    this.registerFilter('rdfDescribe', (resource) => {
      // Generate description of RDF resource
      return `Description of ${resource}`;
    }, category);

    this.registerFilter('rdfConstruct', (pattern, data) => {
      // SPARQL CONSTRUCT-like operation
      return { pattern, data };
    }, category);

    this.registerFilter('rdfSelect', (variables, pattern, data) => {
      // SPARQL SELECT-like operation
      return { variables, pattern, data };
    }, category);
  }

  // =================== LATEX/ACADEMIC FILTERS ===================

  registerLaTeXFilters() {
    const category = 'latex';

    this.registerFilter('texEscape', (str) => {
      if (typeof str !== 'string') return String(str);
      const escapeMap = {
        '&': '\\&',
        '%': '\\%',
        '$': '\\$',
        '#': '\\#',
        '^': '\\textasciicircum{}',
        '_': '\\_',
        '{': '\\{',
        '}': '\\}',
        '~': '\\textasciitilde{}',
        '\\': '\\textbackslash{}'
      };
      return str.replace(/[&%$#^_{}~\\]/g, match => escapeMap[match]);
    }, category);

    this.registerFilter('mathMode', (str) => {
      if (typeof str !== 'string') return String(str);
      return `$${str}$`;
    }, category);

    this.registerFilter('citation', (paper, style = 'apa') => {
      if (typeof paper !== 'object') return String(paper);
      
      switch (style.toLowerCase()) {
        case 'apa':
          return `${paper.author} (${paper.year}). ${paper.title}. ${paper.journal}.`;
        case 'mla':
          return `${paper.author}. "${paper.title}." ${paper.journal}, ${paper.year}.`;
        case 'chicago':
          return `${paper.author}. "${paper.title}." ${paper.journal} (${paper.year}).`;
        default:
          return `${paper.author} - ${paper.title} (${paper.year})`;
      }
    }, category);

    this.registerFilter('bluebook', (caseRef) => {
      if (typeof caseRef !== 'object') return String(caseRef);
      return `${caseRef.case}, ${caseRef.citation} (${caseRef.court} ${caseRef.year})`;
    }, category);

    this.registerFilter('arXivMeta', (arxivId) => {
      // Placeholder for arXiv metadata lookup
      return {
        id: arxivId,
        title: `Paper ${arxivId}`,
        authors: ['Author Name'],
        abstract: 'Abstract placeholder',
        categories: ['cs.AI']
      };
    }, category);

    this.registerFilter('bibEntry', (paper, style = 'bibtex') => {
      if (typeof paper !== 'object') return String(paper);
      
      if (style === 'bibtex') {
        return `@article{${paper.key},
  title={${paper.title}},
  author={${paper.author}},
  journal={${paper.journal}},
  year={${paper.year}}
}`;
      }
      return JSON.stringify(paper);
    }, category);

    this.registerFilter('theorem', (content, type = 'theorem') => {
      return `\\begin{${type}}\n${content}\n\\end{${type}}`;
    }, category);

    this.registerFilter('proof', (content) => {
      return `\\begin{proof}\n${content}\n\\end{proof}`;
    }, category);
  }

  // =================== ADVANCED UTILITY FILTERS ===================

  registerAdvancedFilters() {
    const category = 'advanced';

    this.registerFilter('safe', (value, fallback = '') => {
      try {
        return value;
      } catch (error) {
        return fallback;
      }
    }, category);

    this.registerFilter('default', (value, defaultValue = '') => {
      return (value === null || value === undefined || value === '') ? defaultValue : value;
    }, category);

    this.registerFilter('try', (value, filterName, ...args) => {
      try {
        const filter = this.filters.get(filterName);
        if (filter) {
          return filter.fn(value, ...args);
        }
        return value;
      } catch (error) {
        return value;
      }
    }, category);

    this.registerFilter('fallback', (value, fallbackValue) => {
      return value || fallbackValue;
    }, category);

    this.registerFilter('json', (value, indent = 2) => {
      try {
        return JSON.stringify(value, null, indent);
      } catch (error) {
        return String(value);
      }
    }, category);

    this.registerFilter('apply', (value, filterChain) => {
      if (!Array.isArray(filterChain)) return value;
      
      return filterChain.reduce((result, filterSpec) => {
        if (typeof filterSpec === 'string') {
          const filter = this.filters.get(filterSpec);
          return filter ? filter.fn(result) : result;
        }
        if (typeof filterSpec === 'object' && filterSpec.name) {
          const filter = this.filters.get(filterSpec.name);
          return filter ? filter.fn(result, ...(filterSpec.args || [])) : result;
        }
        return result;
      }, value);
    }, category);
  }

  // =================== FILTER MANAGEMENT ===================

  /**
   * Get all filters for Nunjucks registration
   */
  getAllFilters() {
    const result = {};
    for (const [name, filter] of this.filters) {
      result[name] = filter.fn;
    }
    return result;
  }

  /**
   * Get filters by category
   */
  getFiltersByCategory(category) {
    const categoryFilters = this.categories.get(category);
    if (!categoryFilters) return {};
    
    const result = {};
    for (const name of categoryFilters) {
      const filter = this.filters.get(name);
      if (filter) {
        result[name] = filter.fn;
      }
    }
    return result;
  }

  /**
   * Get filter catalog for documentation
   */
  getFilterCatalog() {
    const catalog = {
      totalFilters: this.filters.size,
      categories: {},
      stats: this.stats
    };

    for (const [category, filterNames] of this.categories) {
      catalog.categories[category] = {
        count: filterNames.size,
        filters: Array.from(filterNames).map(name => {
          const filter = this.filters.get(name);
          return {
            name,
            category: filter.category,
            options: filter.options
          };
        })
      };
    }

    return catalog;
  }

  /**
   * Register filters with Nunjucks environment
   */
  registerWithNunjucks(nunjucksEnv) {
    const filters = this.getAllFilters();
    
    for (const [name, fn] of Object.entries(filters)) {
      nunjucksEnv.addFilter(name, fn);
    }

    return Object.keys(filters).length;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      errorRate: this.stats.errors / this.stats.filterCalls,
      cacheHitRate: this.stats.cacheHits / this.stats.filterCalls,
      avgExecutionTime: this.stats.totalExecutionTime / this.stats.filterCalls
    };
  }
}

/**
 * Create a default filter pipeline instance
 */
export function createFilterPipeline(options = {}) {
  return new FilterPipeline(options);
}

/**
 * Register all filters with a Nunjucks environment
 */
export function registerFiltersWithNunjucks(nunjucksEnv, options = {}) {
  const pipeline = createFilterPipeline(options);
  const count = pipeline.registerWithNunjucks(nunjucksEnv);
  
  return {
    pipeline,
    filtersRegistered: count,
    catalog: pipeline.getFilterCatalog()
  };
}

export default FilterPipeline;