/**
 * Secure Secret Management System
 * Validates and manages sensitive configuration values
 */

import crypto from 'crypto';
import logger from '../utils/secure-logger.js';

class SecretManager {
  constructor() {
    this.requiredSecrets = new Set([
      'JWT_SECRET',
      'SESSION_SECRET',
      'CSRF_SECRET',
      'ENCRYPTION_KEY'
    ]);
    
    this.optionalSecrets = new Set([
      'NPM_TOKEN',
      'GITHUB_TOKEN',
      'AWS_SECRET_ACCESS_KEY',
      'OAUTH_GOOGLE_CLIENT_SECRET',
      'OAUTH_GITHUB_CLIENT_SECRET',
      'OAUTH_MICROSOFT_CLIENT_SECRET',
      'LDAP_BIND_CREDENTIALS',
      'SIEM_API_KEY'
    ]);

    this.weakPatterns = [
      /^(test|example|demo|placeholder|change.*me|your.*)/i,
      /^.{1,15}$/,  // Too short
      /^(password|secret|key|token)$/i,  // Generic names
      /123456|qwerty|admin|root/i  // Common weak values
    ];
  }

  /**
   * Validate all secrets for production readiness
   */
  validateSecrets() {
    const errors = [];
    const warnings = [];
    
    // Check required secrets
    for (const secret of this.requiredSecrets) {
      const value = process.env[secret];
      
      if (!value) {
        errors.push(`Missing required secret: ${secret}`);
        continue;
      }
      
      const validation = this.validateSecretStrength(secret, value);
      if (!validation.isValid) {
        errors.push(`Weak ${secret}: ${validation.reason}`);
      }
    }
    
    // Check optional secrets if they exist
    for (const secret of this.optionalSecrets) {
      const value = process.env[secret];
      
      if (value) {
        const validation = this.validateSecretStrength(secret, value);
        if (!validation.isValid) {
          warnings.push(`Weak ${secret}: ${validation.reason}`);
        }
      }
    }
    
    // Check for exposed tokens
    if (process.env.NPM_TOKEN && !process.env.NPM_TOKEN.startsWith('#')) {
      const tokenValidation = this.validateNpmToken(process.env.NPM_TOKEN);
      if (!tokenValidation.isValid) {
        errors.push(`NPM_TOKEN validation failed: ${tokenValidation.reason}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      totalChecked: this.requiredSecrets.size + this.optionalSecrets.size
    };
  }

  /**
   * Validate individual secret strength
   */
  validateSecretStrength(name, value) {
    // Check for weak patterns
    for (const pattern of this.weakPatterns) {
      if (pattern.test(value)) {
        return {
          isValid: false,
          reason: 'Contains weak or placeholder value'
        };
      }
    }
    
    // Minimum length requirements based on secret type
    const minLengths = {
      JWT_SECRET: 32,
      SESSION_SECRET: 32,
      CSRF_SECRET: 24,
      ENCRYPTION_KEY: 32,
      default: 16
    };
    
    const minLength = minLengths[name] || minLengths.default;
    if (value.length < minLength) {
      return {
        isValid: false,
        reason: `Too short (minimum ${minLength} characters)`
      };
    }
    
    // Check for sufficient entropy
    const entropy = this.calculateEntropy(value);
    if (entropy < 4.0) {
      return {
        isValid: false,
        reason: 'Insufficient entropy (low randomness)'
      };
    }
    
    return { isValid: true };
  }

  /**
   * Validate NPM token format and security
   */
  validateNpmToken(token) {
    if (!token || typeof token !== 'string') {
      return { isValid: false, reason: 'Invalid token format' };
    }
    
    // Check for proper NPM token format
    if (!token.startsWith('npm_')) {
      return { isValid: false, reason: 'Invalid NPM token format' };
    }
    
    // Check if it's a real token (not placeholder)
    if (token.includes('your') || token.includes('example') || token.includes('test')) {
      return { isValid: false, reason: 'Placeholder token detected' };
    }
    
    // Token should be properly formatted
    if (token.length < 40) {
      return { isValid: false, reason: 'Token too short' };
    }
    
    return { isValid: true };
  }

  /**
   * Calculate Shannon entropy of a string
   */
  calculateEntropy(str) {
    const freq = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    const len = str.length;
    
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
  }

  /**
   * Generate a cryptographically secure secret
   */
  generateSecureSecret(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Mask sensitive values for logging
   */
  maskSecret(value, visibleChars = 4) {
    if (!value || typeof value !== 'string') {
      return '***INVALID***';
    }
    
    if (value.length <= visibleChars) {
      return '*'.repeat(value.length);
    }
    
    return value.substring(0, visibleChars) + '*'.repeat(value.length - visibleChars);
  }

  /**
   * Runtime security validation for production
   */
  validateForProduction() {
    if (process.env.NODE_ENV !== 'production') {
      logger.debug('Skipping production secret validation (not in production mode)');
      return { isValid: true, warnings: ['Not in production mode'] };
    }
    
    const validation = this.validateSecrets();
    
    if (!validation.isValid) {
      logger.error('CRITICAL SECURITY ISSUE: Production secrets validation failed', {
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length
      });
      
      // Log each error (without exposing the actual values)
      validation.errors.forEach(error => {
        logger.error('Secret validation error:', error);
      });
      
      validation.warnings.forEach(warning => {
        logger.warn('Secret validation warning:', warning);
      });
      
      throw new Error('Cannot start in production with invalid secrets. Check logs for details.');
    }
    
    if (validation.warnings.length > 0) {
      logger.warn(`Found ${validation.warnings.length} secret warnings`);
      validation.warnings.forEach(warning => {
        logger.warn('Secret warning:', warning);
      });
    }
    
    logger.info('All production secrets validated successfully');
    return validation;
  }

  /**
   * Initialize secret validation middleware
   */
  createValidationMiddleware() {
    return (req, res, next) => {
      // Add security headers for secret protection
      res.set({
        'X-Secret-Validation': 'enabled',
        'X-Security-Headers': 'active'
      });
      
      next();
    };
  }
}

// Export singleton instance
const secretManager = new SecretManager();
export default secretManager;

// Export for CommonJS compatibility
module.exports = secretManager;