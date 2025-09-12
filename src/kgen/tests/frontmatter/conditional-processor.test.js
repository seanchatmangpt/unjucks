/**
 * KGEN Conditional Processor Tests
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { ConditionalProcessor } from '../../core/frontmatter/conditional-processor.js';

describe('ConditionalProcessor', () => {
  let processor;
  
  beforeEach(() => {
    processor = new ConditionalProcessor({
      enableProvenance: false, // Simplified for testing
      enableComplexExpressions: true,
      safeMode: true
    });
  });

  describe('Basic Condition Evaluation', () => {
    test('should handle simple boolean conditions', async () => {
      const frontmatter = { skipIf: 'shouldSkip' };
      const context = { shouldSkip: true };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(true);
      expect(result.condition).toBe('shouldSkip');
      expect(result.evaluationResult.success).toBe(true);
    });

    test('should handle negation conditions', async () => {
      const frontmatter = { skipIf: '!shouldProcess' };
      const context = { shouldProcess: false };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(true);
      expect(result.condition).toBe('!shouldProcess');
    });

    test('should handle missing condition', async () => {
      const frontmatter = {};
      const context = {};
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(false);
      expect(result.reason).toContain('No skip condition');
    });

    test('should handle undefined variables as false', async () => {
      const frontmatter = { skipIf: 'undefinedVariable' };
      const context = {};
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(false);
    });
  });

  describe('Equality Comparisons', () => {
    test('should handle equality comparisons', async () => {
      const frontmatter = { skipIf: 'environment == production' };
      const context = { environment: 'production' };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(true);
    });

    test('should handle inequality comparisons', async () => {
      const frontmatter = { skipIf: 'environment != development' };
      const context = { environment: 'production' };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(true);
    });

    test('should handle quoted string comparisons', async () => {
      const frontmatter = { skipIf: 'type == "component"' };
      const context = { type: 'component' };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(true);
    });

    test('should handle strict equality', async () => {
      const frontmatter = { skipIf: 'count === "5"' };
      const context = { count: 5 }; // Number vs string
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(false); // Should not match due to strict comparison
    });
  });

  describe('Utility Functions', () => {
    test('should handle exists() function', async () => {
      const frontmatter = { skipIf: 'exists(optionalFeature)' };
      const context = { optionalFeature: 'enabled' };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(true);
    });

    test('should handle empty() function', async () => {
      const frontmatter = { skipIf: 'empty(list)' };
      const context = { list: [] };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(true);
    });

    test('should handle length() function', async () => {
      const frontmatter = { skipIf: 'length(items) == 0' };
      const context = { items: [] };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(true);
    });

    test('should handle includes() function', async () => {
      const frontmatter = { skipIf: 'includes(tags, "skip")' };
      const context = { tags: ['test', 'skip', 'demo'] };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(true);
    });

    test('should handle startsWith() function', async () => {
      const frontmatter = { skipIf: 'startsWith(filename, "temp_")' };
      const context = { filename: 'temp_file.txt' };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(true);
    });

    test('should handle endsWith() function', async () => {
      const frontmatter = { skipIf: 'endsWith(filename, ".test.js")' };
      const context = { filename: 'component.test.js' };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(true);
    });
  });

  describe('Complex Expressions', () => {
    test('should handle AND operations', async () => {
      const frontmatter = { skipIf: 'isProduction && skipInProd' };
      const context = { isProduction: true, skipInProd: true };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(true);
    });

    test('should handle OR operations', async () => {
      const frontmatter = { skipIf: 'isTest || isDevelopment' };
      const context = { isTest: false, isDevelopment: true };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(true);
    });

    test('should short-circuit AND operations', async () => {
      const frontmatter = { skipIf: 'falseCondition && undefinedVariable' };
      const context = { falseCondition: false };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(false);
    });

    test('should short-circuit OR operations', async () => {
      const frontmatter = { skipIf: 'trueCondition || undefinedVariable' };
      const context = { trueCondition: true };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(true);
    });
  });

  describe('Security and Safety', () => {
    test('should block dangerous patterns in safe mode', async () => {
      const frontmatter = { skipIf: 'eval("dangerous code")' };
      const context = {};
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(false); // Should not execute dangerous code
      expect(result.reason).toContain('evaluation failed');
    });

    test('should block process access', async () => {
      const frontmatter = { skipIf: 'process.exit()' };
      const context = {};
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(false);
      expect(result.reason).toContain('evaluation failed');
    });

    test('should block constructor access', async () => {
      const frontmatter = { skipIf: 'constructor.constructor("code")()' };
      const context = {};
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(false);
      expect(result.reason).toContain('evaluation failed');
    });
  });

  describe('Variable Tracking', () => {
    test('should track used variables', async () => {
      const frontmatter = { skipIf: 'environment == production && feature.enabled' };
      const context = { environment: 'production', feature: { enabled: true } };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.evaluationResult.usedVariables).toContain('environment');
      expect(result.evaluationResult.usedVariables).toContain('feature');
    });

    test('should not track unused variables', async () => {
      const frontmatter = { skipIf: 'environment == production' };
      const context = { environment: 'production', unused: 'value' };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.evaluationResult.usedVariables).toContain('environment');
      expect(result.evaluationResult.usedVariables).not.toContain('unused');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid expressions gracefully', async () => {
      const frontmatter = { skipIf: 'invalid..syntax..here' };
      const context = {};
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(false); // Safe default
      expect(result.reason).toContain('evaluation failed');
    });

    test('should handle null context gracefully', async () => {
      const frontmatter = { skipIf: 'someVariable' };
      const context = null;
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(false);
    });

    test('should handle undefined frontmatter gracefully', async () => {
      const result = await processor.evaluate(null, {});
      
      expect(result.skip).toBe(false);
      expect(result.reason).toContain('No skip condition');
    });
  });

  describe('Validation', () => {
    test('should validate condition syntax', () => {
      const validCondition = 'variable == value';
      const validation = processor._validateCondition(validCondition);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect dangerous patterns', () => {
      const dangerousCondition = 'eval("code")';
      const validation = processor._validateCondition(dangerousCondition);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should warn about unknown operators', () => {
      const condition = 'a <=> b'; // Non-standard operator
      const validation = processor._validateCondition(condition);
      
      expect(validation.warnings.length).toBeGreaterThan(0);
    });

    test('should warn about unknown functions', () => {
      const condition = 'unknownFunction(value)';
      const validation = processor._validateCondition(condition);
      
      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Caching', () => {
    test('should cache evaluation results', async () => {
      const frontmatter = { skipIf: 'cacheTest' };
      const context = { cacheTest: true };
      
      // First evaluation
      const result1 = await processor.evaluate(frontmatter, context, { useCache: true });
      expect(result1.evaluationMetadata.cacheHit).toBe(false);
      
      // Second evaluation should hit cache
      const result2 = await processor.evaluate(frontmatter, context, { useCache: true });
      expect(result2.evaluationMetadata.cacheHit).toBe(true);
      
      expect(result1.skip).toBe(result2.skip);
    });
  });

  describe('Statistics and History', () => {
    test('should provide processor statistics', () => {
      const stats = processor.getStatistics();
      
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('evaluationHistory');
      expect(stats).toHaveProperty('options');
    });

    test('should track evaluation history when provenance enabled', async () => {
      const processorWithProvenance = new ConditionalProcessor({
        enableProvenance: true
      });
      
      const frontmatter = { skipIf: 'test' };
      const context = { test: true };
      
      await processorWithProvenance.evaluate(frontmatter, context);
      
      const history = processorWithProvenance.getEvaluationHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('condition');
      expect(history[0]).toHaveProperty('result');
      expect(history[0]).toHaveProperty('timestamp');
    });

    test('should filter evaluation history', async () => {
      const processorWithProvenance = new ConditionalProcessor({
        enableProvenance: true
      });
      
      const frontmatter1 = { skipIf: 'test1' };
      const frontmatter2 = { skipIf: 'test2' };
      const context = { test1: true, test2: false };
      
      const result1 = await processorWithProvenance.evaluate(frontmatter1, context);
      await processorWithProvenance.evaluate(frontmatter2, context);
      
      // Filter by result
      const trueResults = processorWithProvenance.getEvaluationHistory({ result: true });
      expect(trueResults).toHaveLength(1);
      expect(trueResults[0].condition).toBe('test1');
      
      // Filter by operation ID
      const opResults = processorWithProvenance.getEvaluationHistory({ 
        operationId: result1.operationId 
      });
      expect(opResults).toHaveLength(1);
    });
  });

  describe('Complex Real-World Scenarios', () => {
    test('should handle component generation conditions', async () => {
      const frontmatter = { 
        skipIf: 'type == "component" && !withTests && environment == "production"' 
      };
      const context = { 
        type: 'component', 
        withTests: false, 
        environment: 'production' 
      };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(true);
    });

    test('should handle feature flag conditions', async () => {
      const frontmatter = { 
        skipIf: '!features.newAPI || version < "2.0"' 
      };
      const context = { 
        features: { newAPI: true }, 
        version: '1.5' 
      };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(true);
    });

    test('should handle array-based conditions', async () => {
      const frontmatter = { 
        skipIf: 'empty(requiredModules) || includes(excludedTypes, fileType)' 
      };
      const context = { 
        requiredModules: ['auth', 'db'], 
        excludedTypes: ['test', 'spec'],
        fileType: 'test'
      };
      
      const result = await processor.evaluate(frontmatter, context);
      
      expect(result.skip).toBe(true);
    });
  });
});