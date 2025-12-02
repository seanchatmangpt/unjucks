/**
 * @file Filter Registry
 * @module unjucks-v4/template/filter-registry
 * @description Manages custom Nunjucks filters
 */

import { EventEmitter } from 'events';

/**
 * Filter Registry - Manages custom Nunjucks filters
 * 
 * @class FilterRegistry
 * @extends EventEmitter
 */
export class FilterRegistry extends EventEmitter {
  /**
   * Create a new FilterRegistry instance
   * @param {Object} options - Registry options
   */
  constructor(options = {}) {
    super();
    
    this.filters = new Map();
    this._registerDefaultFilters();
  }

  /**
   * Register a filter
   * @param {string} name - Filter name
   * @param {Function} filter - Filter function
   */
  register(name, filter) {
    if (typeof filter !== 'function') {
      throw new Error(`Filter ${name} must be a function`);
    }
    
    this.filters.set(name, filter);
    this.emit('filter:registered', { name });
  }

  /**
   * Register all filters with Nunjucks environment
   * @param {nunjucks.Environment} env - Nunjucks environment
   */
  registerAll(env) {
    for (const [name, filter] of this.filters.entries()) {
      env.addFilter(name, filter);
    }
    this.emit('filters:registered', { count: this.filters.size });
  }

  /**
   * Register default filters
   * @private
   */
  _registerDefaultFilters() {
    // Case conversion filters
    this.register('camelCase', (str) => {
      if (!str) return '';
      return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
                .replace(/^[A-Z]/, (g) => g.toLowerCase());
    });

    this.register('pascalCase', (str) => {
      if (!str) return '';
      const camel = this.filters.get('camelCase')(str);
      return camel.charAt(0).toUpperCase() + camel.slice(1);
    });

    this.register('kebabCase', (str) => {
      if (!str) return '';
      return str.replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/\s+/g, '-')
                .toLowerCase();
    });

    this.register('snakeCase', (str) => {
      if (!str) return '';
      return str.replace(/([a-z])([A-Z])/g, '$1_$2')
                .replace(/\s+/g, '_')
                .toLowerCase();
    });

    this.register('titleCase', (str) => {
      if (!str) return '';
      return str.replace(/\w\S*/g, (txt) => 
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      );
    });
  }
}


