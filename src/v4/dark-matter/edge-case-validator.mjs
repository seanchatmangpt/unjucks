/**
 * @file Edge Case Validator
 * @module unjucks-v4/dark-matter/edge-case-validator
 * @description Validates 20% of edge cases causing 80% of failures
 */

import { EventEmitter } from 'events';

/**
 * Edge Case Validator - Validates critical edge cases
 * 
 * @class EdgeCaseValidator
 * @extends EventEmitter
 */
export class EdgeCaseValidator extends EventEmitter {
  /**
   * Create a new EdgeCaseValidator instance
   * @param {Object} options - Validator options
   */
  constructor(options = {}) {
    super();
    this.config = options;
  }

  /**
   * Validate Unicode edge cases
   * @param {string} input - Input to validate
   * @returns {Object} Validation result
   */
  validateUnicode(input) {
    const issues = [];
    
    // Check for non-ASCII characters in URIs
    if (/[^\x00-\x7F]/.test(input) && input.startsWith('http')) {
      issues.push('Non-ASCII characters in URI');
    }

    // Check for emoji
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    if (emojiRegex.test(input)) {
      issues.push('Emoji characters detected');
    }

    // Check for RTL text
    const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF]/;
    if (rtlRegex.test(input)) {
      issues.push('Right-to-left text detected');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Validate malformed input
   * @param {string} input - Input to validate
   * @returns {Object} Validation result
   */
  validateMalformed(input) {
    const issues = [];
    
    // Check for incomplete triples
    if (input.match(/<[^>]*$/)) {
      issues.push('Incomplete URI');
    }

    // Check for mismatched brackets
    const openBrackets = (input.match(/\{/g) || []).length;
    const closeBrackets = (input.match(/\}/g) || []).length;
    if (openBrackets !== closeBrackets) {
      issues.push('Mismatched brackets');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Validate encoding conflicts
   * @param {string} input - Input to validate
   * @returns {Object} Validation result
   */
  validateEncoding(input) {
    const issues = [];
    
    // Check for BOM
    if (input.charCodeAt(0) === 0xFEFF) {
      issues.push('BOM detected');
    }

    // Check for percent-encoding issues
    if (input.match(/%[0-9A-F]{2}/i) && input.match(/[^\x00-\x7F]/)) {
      issues.push('Mixed encoding detected');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Validate security vectors
   * @param {string} input - Input to validate
   * @returns {Object} Validation result
   */
  validateSecurity(input) {
    const issues = [];
    
    // Check for injection patterns
    if (input.match(/<script|javascript:|onerror=/i)) {
      issues.push('Potential XSS detected');
    }

    // Check for path traversal
    if (input.match(/\.\.\/|\.\.\\/)) {
      issues.push('Potential path traversal detected');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Run all edge case validations
   * @param {string} input - Input to validate
   * @returns {Object} Combined validation result
   */
  validateAll(input) {
    const results = {
      unicode: this.validateUnicode(input),
      malformed: this.validateMalformed(input),
      encoding: this.validateEncoding(input),
      security: this.validateSecurity(input)
    };

    const allValid = Object.values(results).every(r => r.valid);
    const allIssues = Object.values(results).flatMap(r => r.issues);

    return {
      valid: allValid,
      results,
      issues: allIssues,
      issueCount: allIssues.length
    };
  }
}


