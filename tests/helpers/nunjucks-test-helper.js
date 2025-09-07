/**
 * Nunjucks testing helper utilities for BDD tests
 * Provides template rendering and filter testing capabilities
 */

import nunjucks from 'nunjucks';
import { addCommonFilters } from '../../src/lib/nunjucks-filters.js';
import { faker } from '@faker-js/faker';
import dayjs from 'dayjs';
import path from 'path';
import fs from 'fs-extra';

export class NunjucksTestHelper {
  constructor() {
    this.env = null;
    this.templates = new Map();
    this.context = {};
    this.lastRenderResult = null;
    this.lastError = null;
  }

  /**
   * Initialize Nunjucks environment with filters
   */
  setupEnvironment(templatePaths = []) {
    // Configure Nunjucks environment
    const paths = [
      ...templatePaths,
      globalThis.testConfig?.fixturesDir || './tests/fixtures'
    ];

    this.env = nunjucks.configure(paths, {
      autoescape: false,
      throwOnUndefined: true,
      trimBlocks: true,
      lstripBlocks: true
    });

    // Add common filters
    addCommonFilters(this.env);

    // Add test-specific filters and globals
    this.addTestFilters();
    this.addTestGlobals();

    return this.env;
  }

  /**
   * Add test-specific filters
   */
  addTestFilters() {
    if (!this.env) return;

    // Dayjs datetime filters
    this.env.addFilter('dateFormat', (date, format = 'YYYY-MM-DD') => {
      return dayjs(date).format(format);
    });

    this.env.addFilter('dateAdd', (date, amount, unit = 'day') => {
      return dayjs(date).add(amount, unit).toISOString();
    });

    this.env.addFilter('dateSubtract', (date, amount, unit = 'day') => {
      return dayjs(date).subtract(amount, unit).toISOString();
    });

    this.env.addFilter('fromNow', (date) => {
      return dayjs(date).fromNow();
    });

    // Faker filters
    this.env.addFilter('fakerName', () => faker.person.fullName());
    this.env.addFilter('fakerEmail', () => faker.internet.email());
    this.env.addFilter('fakerPhone', () => faker.phone.number());
    this.env.addFilter('fakerAddress', () => faker.location.streetAddress());
    this.env.addFilter('fakerCompany', () => faker.company.name());
    this.env.addFilter('fakerUuid', () => faker.string.uuid());
    this.env.addFilter('fakerLorem', (input, words = 5) => {
      const numWords = parseInt(words) || 5;
      return faker.lorem.words(numWords);
    });

    // Test assertion filters
    this.env.addFilter('expectEqual', (actual, expected) => {
      if (actual !== expected) {
        throw new Error(`Expected '${actual}' to equal '${expected}'`);
      }
      return actual;
    });

    this.env.addFilter('expectContains', (str, substring) => {
      if (!str.includes(substring)) {
        throw new Error(`Expected '${str}' to contain '${substring}'`);
      }
      return str;
    });
  }

  /**
   * Add test globals
   */
  addTestGlobals() {
    if (!this.env) return;

    this.env.addGlobal('testData', {
      users: [
        { name: 'John Doe', email: 'john@example.com' },
        { name: 'Jane Smith', email: 'jane@example.com' }
      ],
      config: {
        appName: 'TestApp',
        version: '1.0.0'
      }
    });

    this.env.addGlobal('faker', faker);
    this.env.addGlobal('dayjs', dayjs);
  }

  /**
   * Register a template string for testing
   */
  registerTemplate(name, templateString) {
    this.templates.set(name, templateString);
  }

  /**
   * Set template context variables
   */
  setContext(context) {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear template context
   */
  clearContext() {
    this.context = {};
  }

  /**
   * Render a template with context
   */
  async renderTemplate(templateName, context = {}) {
    try {
      if (!this.env) {
        this.setupEnvironment();
      }

      const mergedContext = { ...this.context, ...context };
      
      if (this.templates.has(templateName)) {
        // Render from registered template string
        this.lastRenderResult = this.env.renderString(
          this.templates.get(templateName),
          mergedContext
        );
      } else {
        // Render from file
        this.lastRenderResult = this.env.render(templateName, mergedContext);
      }

      this.lastError = null;
      return this.lastRenderResult;
    } catch (error) {
      this.lastError = error;
      this.lastRenderResult = null;
      throw error;
    }
  }

  /**
   * Render a template string directly
   */
  async renderString(templateString, context = {}) {
    try {
      if (!this.env) {
        this.setupEnvironment();
      }

      const mergedContext = { ...this.context, ...context };
      this.lastRenderResult = this.env.renderString(templateString, mergedContext);
      this.lastError = null;
      return this.lastRenderResult;
    } catch (error) {
      this.lastError = error;
      this.lastRenderResult = null;
      throw error;
    }
  }

  /**
   * Get last render result
   */
  getLastResult() {
    return this.lastRenderResult;
  }

  /**
   * Get last error
   */
  getLastError() {
    return this.lastError;
  }

  /**
   * Assert template renders without error
   */
  assertRendersSuccessfully() {
    if (this.lastError) {
      throw new Error(`Template rendering failed: ${this.lastError.message}`);
    }
    return this.lastRenderResult !== null;
  }

  /**
   * Assert template output contains text
   */
  assertContains(substring) {
    if (!this.lastRenderResult) {
      throw new Error('No render result to check');
    }
    if (!this.lastRenderResult.includes(substring)) {
      throw new Error(`Expected output to contain '${substring}', got: ${this.lastRenderResult}`);
    }
    return true;
  }

  /**
   * Assert template output equals expected
   */
  assertEquals(expected) {
    if (!this.lastRenderResult) {
      throw new Error('No render result to check');
    }
    if (this.lastRenderResult !== expected) {
      throw new Error(`Expected '${expected}', got '${this.lastRenderResult}'`);
    }
    return true;
  }

  /**
   * Assert template output matches regex
   */
  assertMatches(regex) {
    if (!this.lastRenderResult) {
      throw new Error('No render result to check');
    }
    if (!regex.test(this.lastRenderResult)) {
      throw new Error(`Expected output to match ${regex}, got: ${this.lastRenderResult}`);
    }
    return true;
  }

  /**
   * Save rendered output to file for debugging
   */
  async saveOutput(filename) {
    if (!this.lastRenderResult) {
      throw new Error('No render result to save');
    }

    const outputPath = path.join(
      globalThis.testConfig?.outputDir || './tests/output',
      filename
    );

    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, this.lastRenderResult, 'utf8');
    return outputPath;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.templates.clear();
    this.context = {};
    this.lastRenderResult = null;
    this.lastError = null;
  }
}

// Export singleton instance for global use
export const nunjucksHelper = new NunjucksTestHelper();

// Export factory function for creating new instances
export const createNunjucksHelper = () => new NunjucksTestHelper();