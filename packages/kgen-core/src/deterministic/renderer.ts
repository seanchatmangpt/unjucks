/**
 * Deterministic template renderer using Nunjucks
 * Ensures identical output for identical inputs across all systems
 */

import * as nunjucks from 'nunjucks';
import { sortObjectKeys } from './utils';

export interface DeterministicRenderOptions {
  /**
   * Whether to strip whitespace for more compact output
   */
  trimBlocks?: boolean;
  
  /**
   * Whether to strip leading whitespace
   */
  lstripBlocks?: boolean;
  
  /**
   * Custom filters to add to the environment
   */
  filters?: Record<string, (...args: any[]) => any>;
  
  /**
   * Global variables to add to context
   */
  globals?: Record<string, any>;
}

export class DeterministicRenderer {
  private env: nunjucks.Environment;
  
  constructor(options: DeterministicRenderOptions = {}) {
    // Create environment with deterministic settings
    this.env = new nunjucks.Environment(null, {
      // Disable auto-escaping for raw output
      autoescape: false,
      
      // Strip whitespace consistently
      trimBlocks: options.trimBlocks ?? true,
      lstripBlocks: options.lstripBlocks ?? true,
      
      // Disable web features that could introduce non-determinism
      web: {
        useCache: false,
        async: false
      }
    });
    
    // Remove non-deterministic globals
    this.removeNonDeterministicGlobals();
    
    // Add deterministic filters
    this.addDeterministicFilters();
    
    // Add custom filters if provided
    if (options.filters) {
      Object.entries(options.filters).forEach(([name, filter]) => {
        this.env.addFilter(name, filter);
      });
    }
    
    // Add custom globals if provided (after sorting)
    if (options.globals) {
      Object.entries(sortObjectKeys(options.globals)).forEach(([name, value]) => {
        this.env.addGlobal(name, value);
      });
    }
  }
  
  /**
   * Remove globals that introduce non-determinism
   */
  private removeNonDeterministicGlobals(): void {
    const nonDeterministicGlobals = [
      'Date',
      'Math',
      'random',
      'now',
      'performance',
      'process'
    ];
    
    nonDeterministicGlobals.forEach(global => {
      delete (this.env.globals as any)[global];
    });
  }
  
  /**
   * Add deterministic filters that ensure stable output
   */
  private addDeterministicFilters(): void {
    // Sort filter for arrays and objects
    this.env.addFilter('sort', (value: any, key?: string) => {
      if (Array.isArray(value)) {
        if (key) {
          return [...value].sort((a, b) => {
            const aVal = a[key];
            const bVal = b[key];
            if (aVal < bVal) return -1;
            if (aVal > bVal) return 1;
            return 0;
          });
        }
        return [...value].sort();
      }
      return value;
    });
    
    // Sort object keys filter
    this.env.addFilter('sortKeys', (value: any) => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return sortObjectKeys(value);
      }
      return value;
    });
    
    // Deterministic JSON serialization
    this.env.addFilter('json', (value: any, indent?: number) => {
      return JSON.stringify(sortObjectKeys(value), null, indent);
    });
    
    // Stable hash for objects (for generating IDs)
    this.env.addFilter('hash', (value: any) => {
      const crypto = require('crypto');
      const normalized = JSON.stringify(sortObjectKeys(value));
      return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 8);
    });
    
    // Safe property access that doesn't throw
    this.env.addFilter('prop', (obj: any, key: string, defaultValue: any = '') => {
      return obj && typeof obj === 'object' ? (obj[key] ?? defaultValue) : defaultValue;
    });
  }
  
  /**
   * Render template with deterministic context
   */
  render(template: string, context: Record<string, any> = {}): string {
    // Sort context keys for deterministic variable resolution
    const sortedContext = sortObjectKeys(context);
    
    try {
      // Use renderString to treat the input as a template string, not a file path
      return this.env.renderString(template, sortedContext);
    } catch (error) {
      throw new Error(`Template rendering failed: ${error.message}`);
    }
  }
  
  /**
   * Render template from file with deterministic context
   */
  renderFile(templatePath: string, context: Record<string, any> = {}): string {
    const sortedContext = sortObjectKeys(context);
    
    try {
      return this.env.render(templatePath, sortedContext);
    } catch (error) {
      throw new Error(`Template file rendering failed: ${error.message}`);
    }
  }
  
  /**
   * Add a global variable (will be sorted into globals)
   */
  addGlobal(name: string, value: any): void {
    this.env.addGlobal(name, value);
  }
  
  /**
   * Add a filter function
   */
  addFilter(name: string, filter: (...args: any[]) => any): void {
    this.env.addFilter(name, filter);
  }
  
  /**
   * Set the template loader (for file-based templates)
   */
  setLoader(loader: nunjucks.ILoader): void {
    this.env.loader = loader;
  }
}

/**
 * Create a deterministic renderer with default settings
 */
export function createDeterministicRenderer(options?: DeterministicRenderOptions): DeterministicRenderer {
  return new DeterministicRenderer(options);
}

/**
 * Render a template string deterministically
 */
export function renderDeterministic(
  template: string, 
  context: Record<string, any> = {},
  options?: DeterministicRenderOptions
): string {
  const renderer = createDeterministicRenderer(options);
  return renderer.render(template, context);
}