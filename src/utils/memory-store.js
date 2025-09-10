/**
 * Memory Store for Output Capabilities
 * 
 * Centralized storage for system capabilities and configurations
 */

import { OutputEngine } from '../core/output-engine.js';
import { LaTeXValidator } from './latex-validator.js';
import { Logger } from './logger.js';

class MemoryStore {
  constructor() {
    this.store = new Map();
    this.logger = new Logger('MemoryStore');
  }

  /**
   * Store output capabilities in memory
   */
  async storeOutputCapabilities() {
    try {
      const engine = new OutputEngine();
      const capabilities = await engine.getCapabilities();
      
      // Add LaTeX validation results
      const latexValidator = new LaTeXValidator();
      const latexValidation = await latexValidator.validateInstallation();
      
      const outputCapabilities = {
        formats: capabilities.formats,
        tools: {
          ...capabilities.tools,
          latexValidation: {
            installed: latexValidation.installed,
            version: latexValidation.version,
            compilation: latexValidation.compilation,
            packages: latexValidation.packages,
            errors: latexValidation.errors
          }
        },
        features: capabilities.features,
        templates: {
          latex: ['article', 'resume'],
          css: ['screen', 'print', 'resume'],
          jsonld: ['person', 'resume', 'article']
        },
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };
      
      this.store.set('hive/output/formats', outputCapabilities);
      this.logger.info('Output capabilities stored in memory');
      
      return outputCapabilities;
    } catch (error) {
      this.logger.error('Failed to store output capabilities:', error);
      throw error;
    }
  }

  /**
   * Get output capabilities from memory
   */
  getOutputCapabilities() {
    return this.store.get('hive/output/formats');
  }

  /**
   * Store value in memory
   */
  set(key, value) {
    this.store.set(key, value);
  }

  /**
   * Get value from memory
   */
  get(key) {
    return this.store.get(key);
  }

  /**
   * Check if key exists
   */
  has(key) {
    return this.store.has(key);
  }

  /**
   * Delete key from memory
   */
  delete(key) {
    return this.store.delete(key);
  }

  /**
   * Clear all stored values
   */
  clear() {
    this.store.clear();
  }

  /**
   * Get all keys
   */
  keys() {
    return Array.from(this.store.keys());
  }

  /**
   * Get store contents as object
   */
  toObject() {
    const obj = {};
    for (const [key, value] of this.store.entries()) {
      obj[key] = value;
    }
    return obj;
  }

  /**
   * Store system metrics
   */
  storeMetrics(metrics) {
    const timestamp = new Date().toISOString();
    this.store.set(`hive/metrics/${timestamp}`, metrics);
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(limit = 10) {
    const metricKeys = this.keys()
      .filter(key => key.startsWith('hive/metrics/'))
      .sort()
      .slice(-limit);
    
    return metricKeys.map(key => ({
      timestamp: key.replace('hive/metrics/', ''),
      data: this.get(key)
    }));
  }
}

// Singleton instance
const memoryStore = new MemoryStore();

export { MemoryStore, memoryStore };
