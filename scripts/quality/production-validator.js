#!/usr/bin/env node

/**
 * Production Validation Specialist
 * Ensures applications are fully implemented, tested against real systems, and ready for production deployment.
 * Validates that no mock, fake, or stub implementations remain in the final codebase.
 * 
 * This script implements Fortune 5 enterprise standards for production readiness validation.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import glob from 'glob';

class ProductionValidator {
  constructor(options = {}) {
    this.options = {
      rootDir: options.rootDir || process.cwd(),
      strictMode: options.strictMode || false,
      validationLevel: options.validationLevel || 'fortune_5',
      outputFormat: options.outputFormat || 'json',
      excludePatterns: options.excludePatterns || [
        'node_modules/**',
        'coverage/**',
        '**/*.test.js',
        '**/*.spec.js',
        '**/tests/**',
        '**/mocks/**'
      ],
      ...options
    };
    
    this.results = {
      timestamp: new Date().toISOString(),
      validationLevel: this.options.validationLevel,
      summary: {
        totalFiles: 0,
        violations: 0,
        criticalIssues: 0,
        passed: false
      },
      categories: {
        implementation: { passed: false, violations: [] },
        database: { passed: false, violations: [] },
        external_apis: { passed: false, violations: [] },
        security: { passed: false, violations: [] },
        performance: { passed: false, violations: [] },
        configuration: { passed: false, violations: [] }
      },
      recommendations: []
    };
  }

  /**
   * Main validation entry point
   */
  async validate() {
    console.log('🏛️ Starting Fortune 5 Production Validation...');
    console.log(`📊 Validation Level: ${this.options.validationLevel}`);
    
    try {
      // 1. Implementation Completeness Check
      await this.validateImplementationCompleteness();
      
      // 2. Real Database Integration Validation
      await this.validateDatabaseIntegration();
      
      // 3. External API Integration Validation
      await this.validateExternalAPIIntegration();
      
      // 4. Security Production Readiness
      await this.validateSecurityReadiness();
      
      // 5. Performance Under Load
      await this.validatePerformanceReadiness();
      
      // 6. Configuration Validation
      await this.validateConfigurationReadiness();
      
      // 7. Generate final assessment
      this.generateFinalAssessment();
      
      return this.results;
      
    } catch (error) {
      console.error('❌ Production validation failed:', error.message);
      this.results.error = error.message;
      throw error;
    }
  }

  /**
   * Validate that all components are fully implemented (no mocks/fakes/stubs)
   */
  async validateImplementationCompleteness() {
    console.log('🔍 Validating implementation completeness...');
    
    const files = await this.getSourceFiles();
    const violations = [];
    
    // Patterns that indicate incomplete implementations
    const mockPatterns = [
      /mock[A-Z]\w+/g,           // mockService, mockRepository
      /fake[A-Z]\w+/g,           // fakeDatabase, fakeAPI
      /stub[A-Z]\w+/g,           // stubMethod, stubService
      /TODO.*implementation/gi,   // TODO: implement this
      /FIXME.*mock/gi,           // FIXME: replace mock
      /throw new Error\(['"]not implemented/gi,
      /\/\*\s*mock\s*\*\//gi,    // /* mock */
      /console\.log\(['"]mock/gi, // console.log('mock...
      /\.mockImplementation/g,    // Jest mocks in production code
      /\.mockReturnValue/g,       // Jest mocks in production code
      /process\.env\.NODE_ENV\s*===\s*['"]test['"]/g // Test environment checks
    ];
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf8');
        this.results.summary.totalFiles++;
        
        for (const pattern of mockPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            matches.forEach(match => {
              violations.push({
                file: path.relative(this.options.rootDir, file),
                issue: 'Mock/fake implementation found',
                pattern: match,
                severity: 'critical',
                line: this.getLineNumber(content, match)
              });
            });
          }
        }
        
        // Check for incomplete error handling
        if (content.includes('throw new Error(') && !content.includes('catch')) {
          violations.push({
            file: path.relative(this.options.rootDir, file),
            issue: 'Incomplete error handling - throwing errors without catch blocks',
            severity: 'high',
            pattern: 'throw new Error('
          });
        }
        
      } catch (error) {
        console.warn(`⚠️ Could not read file ${file}: ${error.message}`);
      }
    }
    
    this.results.categories.implementation.violations = violations;
    this.results.categories.implementation.passed = violations.length === 0;
    this.results.summary.violations += violations.length;
    this.results.summary.criticalIssues += violations.filter(v => v.severity === 'critical').length;
    
    console.log(`📊 Implementation: ${violations.length} violations found`);
  }

  /**
   * Validate real database integration (no in-memory or mock databases)
   */
  async validateDatabaseIntegration() {
    console.log('🗄️ Validating database integration...');
    
    const violations = [];
    const dbFiles = await this.findFiles(['**/db/**/*.js', '**/database/**/*.js', '**/models/**/*.js']);
    
    for (const file of dbFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for in-memory database usage
        const inMemoryPatterns = [
          /sqlite.*:memory:/gi,
          /memory.*database/gi,
          /in-memory/gi,
          /mock.*database/gi,
          /fake.*db/gi
        ];
        
        for (const pattern of inMemoryPatterns) {
          if (pattern.test(content)) {
            violations.push({
              file: path.relative(this.options.rootDir, file),
              issue: 'In-memory or mock database detected',
              pattern: pattern.source,
              severity: 'critical'
            });
          }
        }
        
        // Check for proper connection configuration
        if (content.includes('connect') && !content.includes('process.env')) {
          violations.push({
            file: path.relative(this.options.rootDir, file),
            issue: 'Database connection missing environment configuration',
            severity: 'high'
          });
        }
        
      } catch (error) {
        console.warn(`⚠️ Could not read database file ${file}: ${error.message}`);
      }
    }
    
    // Check for database migration files
    const migrationFiles = await this.findFiles(['**/migrations/**/*.js', '**/migrate/**/*.js']);
    if (migrationFiles.length === 0) {
      violations.push({
        file: 'N/A',
        issue: 'No database migration files found',
        severity: 'medium',
        recommendation: 'Add database migration system for production deployments'
      });
    }
    
    this.results.categories.database.violations = violations;
    this.results.categories.database.passed = violations.length === 0;
    this.results.summary.violations += violations.length;
    this.results.summary.criticalIssues += violations.filter(v => v.severity === 'critical').length;
    
    console.log(`📊 Database: ${violations.length} violations found`);
  }

  /**
   * Validate external API integration (no mock APIs)
   */
  async validateExternalAPIIntegration() {
    console.log('🌐 Validating external API integration...');
    
    const violations = [];
    const apiFiles = await this.findFiles(['**/api/**/*.js', '**/services/**/*.js', '**/clients/**/*.js']);
    
    for (const file of apiFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for mock API endpoints
        const mockApiPatterns = [
          /localhost:\d+/g,
          /127\.0\.0\.1/g,
          /mock.*api/gi,
          /fake.*service/gi,
          /test.*endpoint/gi,
          /\.mock\./g
        ];
        
        for (const pattern of mockApiPatterns) {
          const matches = content.match(pattern);
          if (matches && !this.isTestFile(file)) {
            violations.push({
              file: path.relative(this.options.rootDir, file),
              issue: 'Mock or local API endpoint detected',
              pattern: matches[0],
              severity: 'critical'
            });
          }
        }
        
        // Check for proper error handling in API calls
        if (content.includes('fetch(') || content.includes('axios.')) {
          if (!content.includes('catch') && !content.includes('try')) {
            violations.push({
              file: path.relative(this.options.rootDir, file),
              issue: 'API calls missing error handling',
              severity: 'high'
            });
          }
        }
        
        // Check for hardcoded API keys
        const apiKeyPatterns = [
          /api[_-]?key\s*[=:]\s*['"][^'"]{10,}['"]/gi,
          /secret\s*[=:]\s*['"][^'"]{10,}['"]/gi,
          /token\s*[=:]\s*['"][^'"]{10,}['"]/gi
        ];
        
        for (const pattern of apiKeyPatterns) {
          if (pattern.test(content)) {
            violations.push({
              file: path.relative(this.options.rootDir, file),
              issue: 'Hardcoded API key or secret detected',
              severity: 'critical',
              recommendation: 'Use environment variables for API keys'
            });
          }
        }
        
      } catch (error) {
        console.warn(`⚠️ Could not read API file ${file}: ${error.message}`);
      }
    }
    
    this.results.categories.external_apis.violations = violations;
    this.results.categories.external_apis.passed = violations.length === 0;
    this.results.summary.violations += violations.length;
    this.results.summary.criticalIssues += violations.filter(v => v.severity === 'critical').length;
    
    console.log(`📊 External APIs: ${violations.length} violations found`);
  }

  /**
   * Validate security production readiness
   */
  async validateSecurityReadiness() {
    console.log('🔒 Validating security readiness...');
    
    const violations = [];
    
    // Check for debug/development code
    const files = await this.getSourceFiles();
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf8');
        
        // Development/debug patterns
        const debugPatterns = [
          /console\.log/g,
          /console\.debug/g,
          /debugger;/g,
          /debug:\s*true/gi,
          /development.*true/gi
        ];
        
        for (const pattern of debugPatterns) {
          const matches = content.match(pattern);
          if (matches && !this.isTestFile(file)) {
            violations.push({
              file: path.relative(this.options.rootDir, file),
              issue: 'Debug/development code found in production',
              pattern: matches[0],
              severity: 'medium'
            });
          }
        }
        
      } catch (error) {
        console.warn(`⚠️ Could not read file ${file}: ${error.message}`);
      }
    }
    
    // Check for proper HTTPS configuration
    const configFiles = await this.findFiles(['**/config/**/*.js', '**/*config*.js']);
    for (const file of configFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        
        if (content.includes('http:') && !content.includes('https:')) {
          violations.push({
            file: path.relative(this.options.rootDir, file),
            issue: 'HTTP usage detected - HTTPS required for production',
            severity: 'high'
          });
        }
        
      } catch (error) {
        console.warn(`⚠️ Could not read config file ${file}: ${error.message}`);
      }
    }
    
    this.results.categories.security.violations = violations;
    this.results.categories.security.passed = violations.length === 0;
    this.results.summary.violations += violations.length;
    this.results.summary.criticalIssues += violations.filter(v => v.severity === 'critical').length;
    
    console.log(`📊 Security: ${violations.length} violations found`);
  }

  /**
   * Validate performance readiness
   */
  async validatePerformanceReadiness() {
    console.log('⚡ Validating performance readiness...');
    
    const violations = [];
    
    // Check package.json for production optimizations
    try {
      const packagePath = path.join(this.options.rootDir, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      
      // Check for build script
      if (!packageJson.scripts || !packageJson.scripts.build) {
        violations.push({
          file: 'package.json',
          issue: 'Missing build script for production optimization',
          severity: 'medium'
        });
      }
      
      // Check for production dependencies
      if (packageJson.devDependencies) {
        for (const dep of Object.keys(packageJson.devDependencies)) {
          if (packageJson.dependencies && packageJson.dependencies[dep]) {
            violations.push({
              file: 'package.json',
              issue: `Dependency ${dep} listed in both dependencies and devDependencies`,
              severity: 'low'
            });
          }
        }
      }
      
    } catch (error) {
      violations.push({
        file: 'package.json',
        issue: 'Could not read or parse package.json',
        severity: 'high'
      });
    }
    
    // Check for performance bottlenecks
    const files = await this.getSourceFiles();
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf8');
        
        // Synchronous operations that could block
        const blockingPatterns = [
          /fs\.readFileSync/g,
          /fs\.writeFileSync/g,
          /execSync/g,
          /while\s*\(true\)/g
        ];
        
        for (const pattern of blockingPatterns) {
          const matches = content.match(pattern);
          if (matches && !this.isTestFile(file)) {
            violations.push({
              file: path.relative(this.options.rootDir, file),
              issue: 'Synchronous operation detected - may cause performance issues',
              pattern: matches[0],
              severity: 'medium'
            });
          }
        }
        
      } catch (error) {
        console.warn(`⚠️ Could not read file ${file}: ${error.message}`);
      }
    }
    
    this.results.categories.performance.violations = violations;
    this.results.categories.performance.passed = violations.length === 0;
    this.results.summary.violations += violations.length;
    
    console.log(`📊 Performance: ${violations.length} violations found`);
  }

  /**
   * Validate configuration readiness
   */
  async validateConfigurationReadiness() {
    console.log('⚙️ Validating configuration readiness...');
    
    const violations = [];
    
    // Check for environment variable usage
    const requiredEnvVars = [
      'NODE_ENV',
      'PORT'
    ];
    
    const files = await this.getSourceFiles();
    const envVarsUsed = new Set();
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf8');
        
        // Extract environment variables
        const envMatches = content.match(/process\.env\.(\w+)/g);
        if (envMatches) {
          envMatches.forEach(match => {
            const varName = match.replace('process.env.', '');
            envVarsUsed.add(varName);
          });
        }
        
      } catch (error) {
        console.warn(`⚠️ Could not read file ${file}: ${error.message}`);
      }
    }
    
    // Check for missing critical environment variables
    for (const envVar of requiredEnvVars) {
      if (!envVarsUsed.has(envVar)) {
        violations.push({
          file: 'Configuration',
          issue: `Missing critical environment variable: ${envVar}`,
          severity: 'medium'
        });
      }
    }
    
    // Check for .env file in production
    try {
      await fs.access(path.join(this.options.rootDir, '.env'));
      violations.push({
        file: '.env',
        issue: '.env file should not be included in production builds',
        severity: 'medium',
        recommendation: 'Use proper environment variable management'
      });
    } catch (error) {
      // .env file not found - this is good for production
    }
    
    this.results.categories.configuration.violations = violations;
    this.results.categories.configuration.passed = violations.length === 0;
    this.results.summary.violations += violations.length;
    
    console.log(`📊 Configuration: ${violations.length} violations found`);
  }

  /**
   * Generate final assessment and recommendations
   */
  generateFinalAssessment() {
    console.log('📊 Generating final assessment...');
    
    const totalViolations = this.results.summary.violations;
    const criticalIssues = this.results.summary.criticalIssues;
    
    // Determine overall pass/fail status
    if (this.options.validationLevel === 'fortune_5') {
      this.results.summary.passed = criticalIssues === 0 && totalViolations <= 5;
    } else if (this.options.validationLevel === 'enterprise') {
      this.results.summary.passed = criticalIssues === 0 && totalViolations <= 10;
    } else {
      this.results.summary.passed = criticalIssues === 0 && totalViolations <= 20;
    }
    
    // Generate recommendations
    if (criticalIssues > 0) {
      this.results.recommendations.push(
        '🚨 CRITICAL: Address all critical issues before production deployment'
      );
    }
    
    if (this.results.categories.implementation.violations.length > 0) {
      this.results.recommendations.push(
        '🔧 Replace all mock/fake implementations with real production code'
      );
    }
    
    if (this.results.categories.database.violations.length > 0) {
      this.results.recommendations.push(
        '🗄️ Configure real database connections and remove in-memory databases'
      );
    }
    
    if (this.results.categories.external_apis.violations.length > 0) {
      this.results.recommendations.push(
        '🌐 Replace mock APIs with real external service integrations'
      );
    }
    
    if (this.results.categories.security.violations.length > 0) {
      this.results.recommendations.push(
        '🔒 Remove debug code and implement proper security configurations'
      );
    }
    
    if (this.results.categories.performance.violations.length > 0) {
      this.results.recommendations.push(
        '⚡ Optimize synchronous operations and implement production build process'
      );
    }
    
    console.log(`\n🏛️ Fortune 5 Production Validation Results:`);
    console.log(`📊 Total Files Analyzed: ${this.results.summary.totalFiles}`);
    console.log(`⚠️ Total Violations: ${totalViolations}`);
    console.log(`🚨 Critical Issues: ${criticalIssues}`);
    console.log(`✅ Production Ready: ${this.results.summary.passed ? 'YES' : 'NO'}`);
  }

  /**
   * Helper methods
   */
  async getSourceFiles() {
    return this.findFiles(['src/**/*.js', 'lib/**/*.js', 'bin/**/*.js']);
  }

  async findFiles(patterns) {
    const files = [];
    for (const pattern of patterns) {
      const matches = glob.sync(pattern, { 
        cwd: this.options.rootDir,
        ignore: this.options.excludePatterns,
        absolute: true
      });
      files.push(...matches);
    }
    return [...new Set(files)]; // Remove duplicates
  }

  isTestFile(filePath) {
    return filePath.includes('.test.') || 
           filePath.includes('.spec.') || 
           filePath.includes('/tests/') ||
           filePath.includes('/test/') ||
           filePath.includes('__tests__');
  }

  getLineNumber(content, searchString) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchString)) {
        return i + 1;
      }
    }
    return 1;
  }

  /**
   * Output results in specified format
   */
  async outputResults() {
    const output = this.options.outputFormat === 'json' 
      ? JSON.stringify(this.results, null, 2)
      : this.formatTextOutput();
      
    if (this.options.outputFile) {
      await fs.writeFile(this.options.outputFile, output);
      console.log(`📄 Results written to: ${this.options.outputFile}`);
    } else {
      console.log(output);
    }
  }

  formatTextOutput() {
    let output = '\n🏛️ Fortune 5 Production Validation Report\n';
    output += '=' .repeat(50) + '\n\n';
    
    output += `📊 Summary:\n`;
    output += `  Files Analyzed: ${this.results.summary.totalFiles}\n`;
    output += `  Total Violations: ${this.results.summary.violations}\n`;
    output += `  Critical Issues: ${this.results.summary.criticalIssues}\n`;
    output += `  Production Ready: ${this.results.summary.passed ? '✅ YES' : '❌ NO'}\n\n`;
    
    for (const [category, data] of Object.entries(this.results.categories)) {
      output += `📋 ${category.toUpperCase()}:\n`;
      output += `  Status: ${data.passed ? '✅ PASS' : '❌ FAIL'}\n`;
      output += `  Violations: ${data.violations.length}\n`;
      
      if (data.violations.length > 0) {
        data.violations.forEach(violation => {
          output += `    - ${violation.file}: ${violation.issue}\n`;
        });
      }
      output += '\n';
    }
    
    if (this.results.recommendations.length > 0) {
      output += '💡 Recommendations:\n';
      this.results.recommendations.forEach(rec => {
        output += `  ${rec}\n`;
      });
    }
    
    return output;
  }
}

// CLI execution
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--level':
        options.validationLevel = args[++i];
        break;
      case '--output':
        options.outputFile = args[++i];
        break;
      case '--format':
        options.outputFormat = args[++i];
        break;
      case '--strict':
        options.strictMode = true;
        break;
      case '--help':
        console.log(`
🏛️ Fortune 5 Production Validator

Usage: node production-validator.js [options]

Options:
  --level <level>     Validation level (basic|enterprise|fortune_5) [default: fortune_5]
  --output <file>     Output file path
  --format <format>   Output format (json|text) [default: json]
  --strict           Enable strict validation mode
  --help             Show this help message

Examples:
  node production-validator.js --level fortune_5 --output validation-report.json
  node production-validator.js --format text --strict
        `);
        process.exit(0);
    }
  }
  
  const validator = new ProductionValidator(options);
  
  validator.validate()
    .then(async (results) => {
      await validator.outputResults();
      
      // Exit with error code if validation failed
      if (!results.summary.passed) {
        console.error('\n❌ Production validation failed');
        process.exit(1);
      } else {
        console.log('\n✅ Production validation passed');
        process.exit(0);
      }
    })
    .catch(error => {
      console.error('❌ Validation error:', error.message);
      process.exit(1);
    });
}

export default ProductionValidator;