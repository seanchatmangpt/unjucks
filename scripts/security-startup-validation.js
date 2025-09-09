#!/usr/bin/env node

/**
 * Production Security Startup Validation
 * Validates security configuration before application startup
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ProductionSecurityValidator {
  constructor() {
    this.criticalFindings = [];
    this.warnings = [];
    this.passed = [];
    
    this.vulnerabilityChecks = [
      'checkExposedSecrets',
      'checkWeakCorsConfig',
      'checkProductionDebugFlags',
      'checkWeakPasswords',
      'checkMissingSecurityHeaders',
      'checkInsecureDefaults'
    ];
  }

  /**
   * Run all security validations
   */
  async runValidation() {
    console.log('🛡️  Running Production Security Validation...\n');
    
    for (const check of this.vulnerabilityChecks) {
      try {
        await this[check]();
      } catch (error) {
        this.criticalFindings.push(`Validation error in ${check}: ${error.message}`);
      }
    }
    
    this.generateReport();
    return this.criticalFindings.length === 0;
  }

  /**
   * Check for exposed secrets in environment files
   */
  async checkExposedSecrets() {
    const envFiles = ['.env', '.env.production', '.env.local'];
    
    for (const envFile of envFiles) {
      if (fs.existsSync(envFile)) {
        const content = fs.readFileSync(envFile, 'utf8');
        
        // Check for exposed NPM tokens
        const npmTokenMatch = content.match(/^NPM_TOKEN=npm_[a-zA-Z0-9]+/m);
        if (npmTokenMatch && !npmTokenMatch[0].includes('#')) {
          this.criticalFindings.push(`❌ CRITICAL: Exposed NPM token found in ${envFile}`);
        } else {
          this.passed.push(`✅ NPM token properly secured in ${envFile}`);
        }
        
        // Check for weak secrets
        const weakSecrets = content.match(/(?:SECRET|PASSWORD|KEY)=[^#\n]*(?:test|example|placeholder|your|change.*me)/gi);
        if (weakSecrets) {
          this.criticalFindings.push(`❌ CRITICAL: Weak secrets detected in ${envFile}: ${weakSecrets.length} found`);
        } else {
          this.passed.push(`✅ No weak secrets found in ${envFile}`);
        }
        
        // Check for wildcard CORS
        const corsWildcard = content.match(/CORS_ORIGIN=.*\*/);
        if (corsWildcard) {
          this.criticalFindings.push(`❌ CRITICAL: Wildcard CORS configuration in ${envFile}`);
        } else {
          this.passed.push(`✅ CORS properly configured in ${envFile}`);
        }
      }
    }
  }

  /**
   * Check for weak CORS configuration
   */
  async checkWeakCorsConfig() {
    const configFiles = [
      'src/config/index.js',
      'src/server.js',
      'config/cors.js'
    ];
    
    for (const configFile of configFiles) {
      if (fs.existsSync(configFile)) {
        const content = fs.readFileSync(configFile, 'utf8');
        
        // Check for hardcoded wildcard origins
        if (content.includes("'*'") || content.includes('"*"')) {
          this.warnings.push(`⚠️  Potential wildcard CORS in ${configFile}`);
        }
        
        // Check for proper origin validation
        if (content.includes('origin: function') || content.includes('origin(origin, callback)')) {
          this.passed.push(`✅ Dynamic CORS validation found in ${configFile}`);
        }
      }
    }
  }

  /**
   * Check for production debug flags
   */
  async checkProductionDebugFlags() {
    const envContent = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
    
    const debugFlags = [
      'GRAPHQL_PLAYGROUND=true',
      'GRAPHQL_INTROSPECTION=true',
      'GRAPHQL_DEBUG=true',
      'DEBUG=true',
      'NODE_ENV=development'
    ];
    
    for (const flag of debugFlags) {
      if (envContent.includes(flag)) {
        this.criticalFindings.push(`❌ CRITICAL: Debug flag enabled in production: ${flag.split('=')[0]}`);
      }
    }
    
    if (envContent.includes('GRAPHQL_PLAYGROUND=false')) {
      this.passed.push('✅ GraphQL playground disabled for production');
    }
  }

  /**
   * Check for weak passwords and short secrets
   */
  async checkWeakPasswords() {
    const envContent = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
    
    const secretLines = envContent.split('\n').filter(line => 
      line.includes('SECRET=') || line.includes('PASSWORD=') || line.includes('KEY=')
    );
    
    for (const line of secretLines) {
      if (line.trim() && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        if (value && value.length < 16) {
          this.criticalFindings.push(`❌ CRITICAL: Secret too short: ${key}`);
        } else if (value && !value.includes('#')) {
          this.passed.push(`✅ Secret length adequate: ${key}`);
        }
      }
    }
  }

  /**
   * Check for missing security headers
   */
  async checkMissingSecurityHeaders() {
    const serverFile = 'src/server.js';
    if (fs.existsSync(serverFile)) {
      const content = fs.readFileSync(serverFile, 'utf8');
      
      if (content.includes('helmet(')) {
        this.passed.push('✅ Helmet security headers enabled');
      } else {
        this.criticalFindings.push('❌ CRITICAL: Helmet security headers not found');
      }
      
      if (content.includes('hsts:')) {
        this.passed.push('✅ HSTS configuration found');
      } else {
        this.warnings.push('⚠️  HSTS configuration not explicitly found');
      }
    }
  }

  /**
   * Check for insecure defaults
   */
  async checkInsecureDefaults() {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Check for development dependencies in production
    if (packageJson.dependencies) {
      const devDeps = ['nodemon', 'ts-node-dev', 'concurrently'];
      for (const dep of devDeps) {
        if (packageJson.dependencies[dep]) {
          this.warnings.push(`⚠️  Development dependency in production: ${dep}`);
        }
      }
    }
    
    this.passed.push('✅ Package.json dependencies reviewed');
  }

  /**
   * Generate security validation report
   */
  generateReport() {
    console.log('\n🛡️  PRODUCTION SECURITY VALIDATION REPORT');
    console.log('=========================================\n');
    
    console.log(`📊 Summary:`);
    console.log(`   ✅ Passed: ${this.passed.length}`);
    console.log(`   ⚠️  Warnings: ${this.warnings.length}`);
    console.log(`   ❌ Critical: ${this.criticalFindings.length}\n`);
    
    if (this.criticalFindings.length > 0) {
      console.log('❌ CRITICAL SECURITY ISSUES:');
      this.criticalFindings.forEach(finding => console.log(`   ${finding}`));
      console.log('');
    }
    
    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      this.warnings.forEach(warning => console.log(`   ${warning}`));
      console.log('');
    }
    
    if (this.passed.length > 0) {
      console.log('✅ SECURITY CHECKS PASSED:');
      this.passed.forEach(pass => console.log(`   ${pass}`));
      console.log('');
    }
    
    if (this.criticalFindings.length === 0) {
      console.log('🎉 ALL CRITICAL SECURITY VALIDATIONS PASSED!');
      console.log('   System is ready for production deployment.\n');
    } else {
      console.log('🚨 DEPLOYMENT BLOCKED - CRITICAL SECURITY ISSUES FOUND');
      console.log('   Fix all critical issues before deploying to production.\n');
    }
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new ProductionSecurityValidator();
  validator.runValidation().then(isValid => {
    process.exit(isValid ? 0 : 1);
  }).catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

export default ProductionSecurityValidator;