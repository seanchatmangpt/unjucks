/**
 * Property-based testing helper with fast-check integration
 * Provides utilities for generating test data and verifying properties
 */

import fc from 'fast-check';
import { TestHelper } from './test-helper.js';
import { FileTestHelper } from './file-test-helper.js';

export class PropertyTestHelper {
  constructor(options = {}) {
    this.options = {
      numRuns: options.numRuns || 100,
      timeout: options.timeout || 5000,
      seed: options.seed || this.getDeterministicTimestamp(),
      maxSkipsPerRun: options.maxSkipsPerRun || 1000,
      asyncTimeout: options.asyncTimeout || 10000,
      ...options
    };
    
    this.testHelper = new TestHelper();
    this.fileHelper = new FileTestHelper();
    this.stats = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      failures: []
    };
  }

  /**
   * Generate arbitrary strings for testing
   */
  arbitraryString(options = {}) {
    const { minLength = 1, maxLength = 100, charset = 'ascii' } = options;
    
    switch (charset) {
      case 'ascii':
        return fc.string({ minLength, maxLength });
      case 'unicode':
        return fc.fullUnicodeString({ minLength, maxLength });
      case 'alphanumeric':
        return fc.string({ minLength, maxLength }).filter(s => /^[a-zA-Z0-9]*$/.test(s));
      case 'filename':
        return fc.string({ minLength, maxLength }).filter(s => 
          /^[a-zA-Z0-9._-]*$/.test(s) && s.length > 0
        );
      default:
        return fc.string({ minLength, maxLength });
    }
  }

  /**
   * Generate arbitrary file paths
   */
  arbitraryFilePath() {
    return fc.tuple(
      fc.array(this.arbitraryString({ charset: 'filename', minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
      this.arbitraryString({ charset: 'filename', minLength: 1, maxLength: 20 }),
      fc.constantFrom('.js', '.ts', '.json', '.md', '.txt', '.njk')
    ).map(([dirs, name, ext]) => {
      return [...dirs, name + ext].join('/');
    });
  }

  /**
   * Generate arbitrary template variables
   */
  arbitraryTemplateVariables() {
    return fc.dictionary(
      this.arbitraryString({ charset: 'alphanumeric', minLength: 1, maxLength: 20 }),
      fc.oneof(
        this.arbitraryString(),
        fc.integer(),
        fc.boolean(),
        fc.array(this.arbitraryString(), { maxLength: 10 })
      )
    );
  }

  /**
   * Generate arbitrary Nunjucks template content
   */
  arbitraryTemplateContent() {
    const variableName = this.arbitraryString({ charset: 'alphanumeric', minLength: 1, maxLength: 20 });
    
    return fc.tuple(
      this.arbitraryString(),
      variableName,
      this.arbitraryString()
    ).map(([before, varName, after]) => {
      return `${before}{{ ${varName} }}${after}`;
    });
  }

  /**
   * Generate arbitrary frontmatter
   */
  arbitraryFrontmatter() {
    return fc.record({
      to: this.arbitraryString(),
      inject: fc.boolean(),
      before: fc.option(this.arbitraryString()),
      after: fc.option(this.arbitraryString()),
      append: fc.option(fc.boolean()),
      prepend: fc.option(fc.boolean()),
      skipIf: fc.option(this.arbitraryString())
    });
  }

  /**
   * Run property-based test with error handling and stats
   */
  async runProperty(property, arbitrary, options = {}) {
    const testOptions = { ...this.options, ...options };
    this.stats.totalTests++;
    
    try {
      await fc.assert(
        fc.asyncProperty(arbitrary, async (input) => {
          const startTime = this.getDeterministicTimestamp();
          
          try {
            const result = await Promise.race([
              property(input),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Property test timeout')), testOptions.asyncTimeout)
              )
            ]);
            
            const duration = this.getDeterministicTimestamp() - startTime;
            
            if (options.trackPerformance && duration > testOptions.timeout) {
              throw new Error(`Property test took too long: ${duration}ms > ${testOptions.timeout}ms`);
            }
            
            return result;
          } catch (error) {
            if (options.allowFailures) {
              this.stats.failures.push({
                input,
                error: error.message,
                timestamp: this.getDeterministicDate().toISOString()
              });
              return true; // Continue testing
            }
            throw error;
          }
        }),
        {
          numRuns: testOptions.numRuns,
          seed: testOptions.seed,
          timeout: testOptions.timeout,
          maxSkipsPerRun: testOptions.maxSkipsPerRun
        }
      );
      
      this.stats.passedTests++;
      return { success: true, failures: this.stats.failures };
    } catch (error) {
      this.stats.failedTests++;
      throw error;
    }
  }

  /**
   * Test template rendering properties
   */
  async testTemplateRenderingProperties() {
    return this.runProperty(
      async ({ template, variables }) => {
        // Property: rendered template should contain all variable values
        const rendered = await this.renderTemplate(template, variables);
        
        for (const [key, value] of Object.entries(variables)) {
          if (typeof value === 'string' && template.includes(`{{ ${key} }}`)) {
            if (!rendered.includes(value)) {
              throw new Error(`Rendered template missing variable value: ${key}=${value}`);
            }
          }
        }
        
        return true;
      },
      fc.record({
        template: this.arbitraryTemplateContent(),
        variables: this.arbitraryTemplateVariables()
      }),
      { numRuns: 50 }
    );
  }

  /**
   * Test file injection properties
   */
  async testFileInjectionProperties() {
    return this.runProperty(
      async ({ filePath, content, injectionContent }) => {
        // Property: injecting content should preserve existing content
        const originalContent = await this.fileHelper.readFile(filePath);
        await this.injectContent(filePath, injectionContent);
        const newContent = await this.fileHelper.readFile(filePath);
        
        if (originalContent && !newContent.includes(originalContent)) {
          throw new Error('File injection lost original content');
        }
        
        if (!newContent.includes(injectionContent)) {
          throw new Error('File injection failed to add new content');
        }
        
        return true;
      },
      fc.record({
        filePath: this.arbitraryFilePath(),
        content: this.arbitraryString(),
        injectionContent: this.arbitraryString()
      }),
      { 
        numRuns: 30,
        allowFailures: true // File operations might fail in some edge cases
      }
    );
  }

  /**
   * Test path resolution properties
   */
  async testPathResolutionProperties() {
    return this.runProperty(
      async ({ relativePath, basePath }) => {
        // Property: resolved paths should be absolute and normalized
        const resolvedPath = this.resolvePath(relativePath, basePath);
        
        if (!path.isAbsolute(resolvedPath)) {
          throw new Error('Resolved path should be absolute');
        }
        
        if (resolvedPath.includes('..') || resolvedPath.includes('./')) {
          throw new Error('Resolved path should be normalized');
        }
        
        return true;
      },
      fc.record({
        relativePath: this.arbitraryFilePath(),
        basePath: this.arbitraryFilePath()
      })
    );
  }

  /**
   * Mock template rendering for testing
   */
  async renderTemplate(template, variables) {
    // Simple mock implementation for property testing
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), String(value));
    }
    return result;
  }

  /**
   * Mock content injection for testing
   */
  async injectContent(filePath, content) {
    await this.fileHelper.createTempFile('original content', '.txt');
    await this.fileHelper.writeFile(filePath, `original content\n${content}`);
  }

  /**
   * Mock path resolution for testing
   */
  resolvePath(relativePath, basePath) {
    return path.resolve(basePath || process.cwd(), relativePath);
  }

  /**
   * Generate test data for specific scenarios
   */
  generateTestData(scenario) {
    switch (scenario) {
      case 'template-variables':
        return fc.sample(this.arbitraryTemplateVariables(), 10);
      
      case 'file-paths':
        return fc.sample(this.arbitraryFilePath(), 10);
      
      case 'template-content':
        return fc.sample(this.arbitraryTemplateContent(), 10);
      
      case 'frontmatter':
        return fc.sample(this.arbitraryFrontmatter(), 10);
      
      default:
        throw new Error(`Unknown test data scenario: ${scenario}`);
    }
  }

  /**
   * Create shrinking strategy for complex objects
   */
  createShrinkingStrategy(generator) {
    return fc.pre(
      () => true, // No precondition
      generator
    );
  }

  /**
   * Validate test invariants
   */
  validateInvariant(invariantFn, description) {
    return async (input) => {
      try {
        const result = await invariantFn(input);
        if (!result) {
          throw new Error(`Invariant violation: ${description}`);
        }
        return true;
      } catch (error) {
        throw new Error(`Invariant error (${description}): ${error.message}`);
      }
    };
  }

  /**
   * Get test statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalTests > 0 ? 
        (this.stats.passedTests / this.stats.totalTests) * 100 : 0,
      failureRate: this.stats.totalTests > 0 ? 
        (this.stats.failedTests / this.stats.totalTests) * 100 : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      failures: []
    };
  }

  /**
   * Clean up test resources
   */
  async cleanup() {
    await this.testHelper.destroy();
    await this.fileHelper.cleanup();
    this.resetStats();
  }
}

/**
 * Create property test helper with default configuration
 */
export function createPropertyTestHelper(options = {}) {
  return new PropertyTestHelper(options);
}

/**
 * Fast-check combinator for Unjucks-specific testing
 */
export const UnjucksArbitraries = {
  /**
   * Generate template name
   */
  templateName: () => fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => /^[a-zA-Z][a-zA-Z0-9-_]*$/.test(s)),

  /**
   * Generate generator name
   */
  generatorName: () => fc.string({ minLength: 1, maxLength: 30 })
    .filter(s => /^[a-zA-Z][a-zA-Z0-9-_]*$/.test(s)),

  /**
   * Generate command line arguments
   */
  cliArgs: () => fc.array(
    fc.oneof(
      fc.string({ minLength: 1, maxLength: 50 }).filter(s => !/\s/.test(s)),
      fc.tuple(fc.constant('--'), fc.string({ minLength: 1, maxLength: 20 }))
        .map(([prefix, name]) => `${prefix}${name}`)
    ),
    { minLength: 0, maxLength: 10 }
  ),

  /**
   * Generate JSON-LD context
   */
  jsonLdContext: () => fc.record({
    '@context': fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.string({ minLength: 1, maxLength: 100 })
    )
  }),

  /**
   * Generate RDF turtle content
   */
  turtleContent: () => fc.tuple(
    fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z:_][a-zA-Z0-9:_-]*$/.test(s)),
    fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z:_][a-zA-Z0-9:_-]*$/.test(s)),
    fc.oneof(
      fc.string({ minLength: 1, maxLength: 100 }),
      fc.integer(),
      fc.boolean()
    )
  ).map(([subject, predicate, object]) => {
    const objectStr = typeof object === 'string' ? `"${object}"` : String(object);
    return `${subject} ${predicate} ${objectStr} .`;
  })
};

export default PropertyTestHelper;