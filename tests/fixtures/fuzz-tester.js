/**
 * Fuzz Testing Framework for KGEN v1
 * Tests path order, whitespace variants, and edge cases
 */

import { randomBytes, randomInt } from 'crypto';
import { join } from 'path';

export class FuzzTester {
  constructor(options = {}) {
    this.options = {
      maxIterations: options.maxIterations || 1000,
      maxStringLength: options.maxStringLength || 1000,
      seed: options.seed || Date.now(),
      ...options
    };
    this.rng = this.createSeededRNG(this.options.seed);
    this.testResults = [];
  }

  /**
   * Create seeded random number generator for reproducible fuzz tests
   */
  createSeededRNG(seed) {
    let state = seed;
    return {
      next() {
        state = (state * 1664525 + 1013904223) % Math.pow(2, 32);
        return state / Math.pow(2, 32);
      },
      nextInt(max) {
        return Math.floor(this.next() * max);
      }
    };
  }

  /**
   * Generate fuzz test cases for path ordering
   */
  generatePathOrderVariants(basePaths) {
    const variants = [];
    const paths = [...basePaths];

    // Generate multiple random orderings
    for (let i = 0; i < Math.min(this.options.maxIterations, 50); i++) {
      const shuffled = this.shuffleArray([...paths]);
      variants.push({
        name: `path_order_${i}`,
        type: 'path_order',
        paths: shuffled,
        expected_deterministic: true
      });
    }

    // Add specific problematic orderings
    variants.push(
      {
        name: 'reverse_order',
        type: 'path_order',
        paths: [...paths].reverse(),
        expected_deterministic: true
      },
      {
        name: 'alternating_order',
        type: 'path_order',
        paths: this.alternatingSort(paths),
        expected_deterministic: true
      }
    );

    return variants;
  }

  /**
   * Generate whitespace fuzz variants
   */
  generateWhitespaceVariants(content) {
    const variants = [];
    const whitespaceTypes = [
      { name: 'spaces', char: ' ' },
      { name: 'tabs', char: '\t' },
      { name: 'mixed', char: [' ', '\t'] },
      { name: 'unicode_spaces', char: [' ', '\u00A0', '\u2000', '\u2001', '\u2002'] }
    ];

    whitespaceTypes.forEach(wsType => {
      for (let i = 0; i < 10; i++) {
        const fuzzed = this.fuzzWhitespace(content, wsType);
        variants.push({
          name: `whitespace_${wsType.name}_${i}`,
          type: 'whitespace',
          content: fuzzed,
          original: content,
          whitespace_type: wsType.name,
          expected_normalized: true
        });
      }
    });

    return variants;
  }

  /**
   * Generate filename fuzz variants
   */
  generateFilenameVariants() {
    const variants = [];
    const problematicChars = [
      '\\', '/', ':', '*', '?', '"', '<', '>', '|',
      '\0', '\n', '\r', '\t'
    ];
    
    const unicodeChars = [
      'café', '测试', 'файл', 'ファイル', 'αρχείο',
      'файл.txt', 'tëst.js', 'naïve.md'
    ];

    // Test problematic characters (should be rejected)
    problematicChars.forEach((char, i) => {
      variants.push({
        name: `problematic_char_${i}`,
        type: 'filename',
        filename: `test${char}file.txt`,
        expected_valid: false,
        should_reject: true
      });
    });

    // Test Unicode filenames (should be normalized)
    unicodeChars.forEach((filename, i) => {
      variants.push({
        name: `unicode_${i}`,
        type: 'filename',
        filename,
        expected_valid: true,
        should_normalize: true
      });
    });

    // Test extremely long filenames
    for (let len of [255, 256, 1000, 4096]) {
      variants.push({
        name: `long_filename_${len}`,
        type: 'filename',
        filename: 'a'.repeat(len) + '.txt',
        expected_valid: len <= 255,
        should_reject: len > 255
      });
    }

    return variants;
  }

  /**
   * Generate variable name fuzz variants
   */
  generateVariableVariants() {
    const variants = [];
    const problematicNames = [
      '', '123abc', 'var-name', 'var name', 'var.name',
      'constructor', 'prototype', '__proto__', 'toString',
      'é_variable', 'переменная', '変数名'
    ];

    problematicNames.forEach((name, i) => {
      variants.push({
        name: `variable_${i}`,
        type: 'variable',
        variable_name: name,
        variable_value: `value_${i}`,
        expected_valid: this.isValidVariableName(name)
      });
    });

    // Generate random variable names
    for (let i = 0; i < 20; i++) {
      const varName = this.generateRandomVariableName();
      variants.push({
        name: `random_variable_${i}`,
        type: 'variable',
        variable_name: varName,
        variable_value: `random_value_${i}`,
        expected_valid: this.isValidVariableName(varName)
      });
    }

    return variants;
  }

  /**
   * Generate content size fuzz variants
   */
  generateSizeVariants() {
    const variants = [];
    const sizes = [0, 1, 1024, 65536, 1048576, 10485760]; // 0B to 10MB

    sizes.forEach(size => {
      const content = this.generateRandomContent(size);
      variants.push({
        name: `size_${size}`,
        type: 'content_size',
        content,
        size,
        expected_handled: true
      });
    });

    return variants;
  }

  /**
   * Fuzz whitespace in content
   */
  fuzzWhitespace(content, wsType) {
    let result = content;
    const chars = Array.isArray(wsType.char) ? wsType.char : [wsType.char];

    // Replace existing whitespace randomly
    result = result.replace(/\s+/g, () => {
      const char = chars[this.rng.nextInt(chars.length)];
      const count = this.rng.nextInt(5) + 1;
      return char.repeat(count);
    });

    // Add random whitespace at beginning/end
    const leadingWs = chars[this.rng.nextInt(chars.length)].repeat(this.rng.nextInt(3));
    const trailingWs = chars[this.rng.nextInt(chars.length)].repeat(this.rng.nextInt(3));
    
    return leadingWs + result + trailingWs;
  }

  /**
   * Shuffle array using Fisher-Yates with seeded RNG
   */
  shuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.rng.nextInt(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Create alternating sort order
   */
  alternatingSort(array) {
    const sorted = [...array].sort();
    const result = [];
    let start = 0, end = sorted.length - 1;
    let takeFromStart = true;

    while (start <= end) {
      if (takeFromStart) {
        result.push(sorted[start++]);
      } else {
        result.push(sorted[end--]);
      }
      takeFromStart = !takeFromStart;
    }

    return result;
  }

  /**
   * Generate random variable name
   */
  generateRandomVariableName() {
    const validStarts = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$';
    const validChars = validStarts + '0123456789';
    
    let name = validStarts[this.rng.nextInt(validStarts.length)];
    const length = this.rng.nextInt(20) + 1;
    
    for (let i = 1; i < length; i++) {
      name += validChars[this.rng.nextInt(validChars.length)];
    }
    
    return name;
  }

  /**
   * Check if variable name is valid JavaScript identifier
   */
  isValidVariableName(name) {
    if (!name) return false;
    try {
      return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) && 
             !['constructor', 'prototype', '__proto__'].includes(name);
    } catch {
      return false;
    }
  }

  /**
   * Generate random content of specified size
   */
  generateRandomContent(size) {
    if (size === 0) return '';
    
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789\n\t ';
    let result = '';
    
    for (let i = 0; i < size; i++) {
      result += chars[this.rng.nextInt(chars.length)];
    }
    
    return result;
  }

  /**
   * Run comprehensive fuzz test suite
   */
  async runFuzzTests(testFunction, baseData) {
    const allVariants = [
      ...this.generatePathOrderVariants(baseData.paths || []),
      ...this.generateWhitespaceVariants(baseData.content || ''),
      ...this.generateFilenameVariants(),
      ...this.generateVariableVariants(),
      ...this.generateSizeVariants()
    ];

    console.log(`Running ${allVariants.length} fuzz test variants...`);

    for (const variant of allVariants) {
      try {
        const startTime = Date.now();
        const result = await testFunction(variant);
        const duration = Date.now() - startTime;

        this.testResults.push({
          variant: variant.name,
          type: variant.type,
          passed: this.evaluateResult(result, variant),
          result,
          duration,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        this.testResults.push({
          variant: variant.name,
          type: variant.type,
          passed: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return this.generateFuzzReport();
  }

  /**
   * Evaluate fuzz test result
   */
  evaluateResult(result, variant) {
    switch (variant.type) {
      case 'path_order':
        return variant.expected_deterministic ? result.deterministic : true;
      
      case 'whitespace':
        return variant.expected_normalized ? result.normalized : true;
      
      case 'filename':
        if (variant.should_reject) {
          return result.rejected || result.error;
        }
        return variant.expected_valid ? result.valid : !result.valid;
      
      case 'variable':
        return variant.expected_valid ? result.valid : !result.valid;
      
      case 'content_size':
        return variant.expected_handled ? result.handled : true;
      
      default:
        return true;
    }
  }

  /**
   * Generate fuzz test report
   */
  generateFuzzReport() {
    const byType = {};
    let totalPassed = 0;

    this.testResults.forEach(result => {
      if (!byType[result.type]) {
        byType[result.type] = { total: 0, passed: 0, failed: 0 };
      }
      
      byType[result.type].total++;
      if (result.passed) {
        byType[result.type].passed++;
        totalPassed++;
      } else {
        byType[result.type].failed++;
      }
    });

    return {
      summary: {
        total: this.testResults.length,
        passed: totalPassed,
        failed: this.testResults.length - totalPassed,
        passRate: ((totalPassed / this.testResults.length) * 100).toFixed(2)
      },
      byType,
      results: this.testResults,
      seed: this.options.seed,
      generatedAt: new Date().toISOString()
    };
  }
}

export default FuzzTester;