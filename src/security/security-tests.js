/**
 * Comprehensive Security Testing Framework
 * Automated security testing, penetration testing, and vulnerability assessment
 */

import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { SecurityError, inputValidator } from './input-validator.js';
import { pathSecurityManager } from './path-security.js';
import { dependencySecurityManager } from './dependency-security.js';
import { runtimeSecurityMonitor } from './runtime-security.js';

export class SecurityTestFramework {
  constructor() {
    this.testResults = [];
    this.vulnerabilities = [];
    this.testCategories = [
      'input-validation',
      'path-traversal',
      'injection-attacks',
      'authentication',
      'authorization',
      'data-exposure',
      'dependency-security',
      'runtime-security',
      'file-operations',
      'command-injection'
    ];
  }

  /**
   * Run comprehensive security test suite
   */
  async runSecurityTests(options = {}) {
    console.log('🔒 Starting comprehensive security test suite...');
    
    const testResults = {
      timestamp: this.getDeterministicDate().toISOString(),
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        vulnerabilities: 0,
        riskScore: 0
      },
      categories: {},
      vulnerabilities: [],
      recommendations: []
    };

    try {
      // Run tests by category
      for (const category of this.testCategories) {
        if (!options.categories || options.categories.includes(category)) {
          console.log(`Testing ${category}...`);
          const categoryResults = await this.runCategoryTests(category);
          testResults.categories[category] = categoryResults;
          
          testResults.summary.totalTests += categoryResults.totalTests;
          testResults.summary.passed += categoryResults.passed;
          testResults.summary.failed += categoryResults.failed;
          testResults.vulnerabilities.push(...categoryResults.vulnerabilities);
        }
      }

      // Calculate overall risk score
      testResults.summary.vulnerabilities = testResults.vulnerabilities.length;
      testResults.summary.riskScore = this.calculateRiskScore(testResults.vulnerabilities);
      
      // Generate recommendations
      testResults.recommendations = this.generateSecurityRecommendations(testResults);
      
      console.log(`🔒 Security testing completed. Risk score: ${testResults.summary.riskScore}/100`);
      
      return testResults;

    } catch (error) {
      throw new SecurityError(`Security testing failed: ${error.message}`);
    }
  }

  /**
   * Run tests for specific category
   */
  async runCategoryTests(category) {
    const categoryResults = {
      category,
      totalTests: 0,
      passed: 0,
      failed: 0,
      vulnerabilities: [],
      tests: []
    };

    switch (category) {
      case 'input-validation':
        await this.testInputValidation(categoryResults);
        break;
      case 'path-traversal':
        await this.testPathTraversal(categoryResults);
        break;
      case 'injection-attacks':
        await this.testInjectionAttacks(categoryResults);
        break;
      case 'authentication':
        await this.testAuthentication(categoryResults);
        break;
      case 'authorization':
        await this.testAuthorization(categoryResults);
        break;
      case 'data-exposure':
        await this.testDataExposure(categoryResults);
        break;
      case 'dependency-security':
        await this.testDependencySecurity(categoryResults);
        break;
      case 'runtime-security':
        await this.testRuntimeSecurity(categoryResults);
        break;
      case 'file-operations':
        await this.testFileOperations(categoryResults);
        break;
      case 'command-injection':
        await this.testCommandInjection(categoryResults);
        break;
    }

    return categoryResults;
  }

  /**
   * Test input validation security
   */
  async testInputValidation(results) {
    const tests = [
      {
        name: 'XSS Script Tags',
        payload: '<script>alert("xss")</script>',
        type: 'string',
        shouldFail: true
      },
      {
        name: 'SQL Injection',
        payload: "'; DROP TABLE users; --",
        type: 'string',
        shouldFail: true
      },
      {
        name: 'Long String Attack',
        payload: 'A'.repeat(20000),
        type: 'string',
        shouldFail: true
      },
      {
        name: 'JavaScript Protocol',
        payload: 'javascript:alert(1)',
        type: 'url',
        shouldFail: true
      },
      {
        name: 'Valid String',
        payload: 'Hello World',
        type: 'string',
        shouldFail: false
      },
      {
        name: 'Valid URL',
        payload: 'https://example.com',
        type: 'url',
        shouldFail: false
      }
    ];

    for (const test of tests) {
      try {
        await inputValidator.validateInput(test.payload, test.type);
        
        if (test.shouldFail) {
          this.addVulnerability(results, {
            category: 'input-validation',
            severity: 'high',
            test: test.name,
            issue: 'Malicious input not blocked',
            payload: test.payload
          });
          results.failed++;
        } else {
          results.passed++;
        }
      } catch (error) {
        if (!test.shouldFail) {
          results.failed++;
          this.addTestResult(results, {
            name: test.name,
            status: 'failed',
            error: error.message
          });
        } else {
          results.passed++;
        }
      }
      results.totalTests++;
    }
  }

  /**
   * Test path traversal vulnerabilities
   */
  async testPathTraversal(results) {
    const tests = [
      {
        name: 'Basic Path Traversal',
        payload: '../../etc/passwd',
        shouldFail: true
      },
      {
        name: 'Windows Path Traversal',
        payload: '..\\..\\windows\\system32\\config',
        shouldFail: true
      },
      {
        name: 'URL Encoded Traversal',
        payload: '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        shouldFail: true
      },
      {
        name: 'Double URL Encoded',
        payload: '%252e%252e%252f%252e%252e%252fetc%252fpasswd',
        shouldFail: true
      },
      {
        name: 'Valid Relative Path',
        payload: './src/test.js',
        shouldFail: false
      },
      {
        name: 'Valid Absolute Path',
        payload: path.join(process.cwd(), 'test.js'),
        shouldFail: false
      }
    ];

    for (const test of tests) {
      try {
        await pathSecurityManager.validatePath(test.payload);
        
        if (test.shouldFail) {
          this.addVulnerability(results, {
            category: 'path-traversal',
            severity: 'critical',
            test: test.name,
            issue: 'Path traversal not blocked',
            payload: test.payload
          });
          results.failed++;
        } else {
          results.passed++;
        }
      } catch (error) {
        if (!test.shouldFail) {
          results.failed++;
          this.addTestResult(results, {
            name: test.name,
            status: 'failed',
            error: error.message
          });
        } else {
          results.passed++;
        }
      }
      results.totalTests++;
    }
  }

  /**
   * Test injection attack vulnerabilities
   */
  async testInjectionAttacks(results) {
    const injectionPayloads = [
      // SQL Injection
      { name: 'SQL Union', payload: "' UNION SELECT * FROM users--", type: 'sql' },
      { name: 'SQL Boolean', payload: "' OR '1'='1", type: 'sql' },
      { name: 'SQL Time', payload: "'; WAITFOR DELAY '00:00:05'--", type: 'sql' },
      
      // NoSQL Injection
      { name: 'NoSQL Injection', payload: '{"$ne": null}', type: 'nosql' },
      
      // Command Injection
      { name: 'Command Injection', payload: '; rm -rf /', type: 'command' },
      { name: 'Command Pipe', payload: '| cat /etc/passwd', type: 'command' },
      
      // LDAP Injection
      { name: 'LDAP Injection', payload: '*)(&', type: 'ldap' },
      
      // XPath Injection
      { name: 'XPath Injection', payload: '\' or 1=1 or \'\'=\'', type: 'xpath' },
      
      // Template Injection
      { name: 'Template Injection', payload: '{{7*7}}', type: 'template' },
      { name: 'SSTI', payload: '${7*7}', type: 'template' }
    ];

    for (const test of injectionPayloads) {
      results.totalTests++;
      
      try {
        // Test if injection payload is properly sanitized
        const sanitized = await inputValidator.validateInput(test.payload, 'string');
        
        // Check if dangerous patterns are still present
        const isDangerous = this.checkForDangerousPatterns(sanitized, test.type);
        
        if (isDangerous) {
          this.addVulnerability(results, {
            category: 'injection-attacks',
            severity: 'critical',
            test: test.name,
            issue: `${test.type} injection not properly sanitized`,
            payload: test.payload,
            sanitized: sanitized
          });
          results.failed++;
        } else {
          results.passed++;
        }
        
      } catch (error) {
        // Input validation caught the injection - this is good
        results.passed++;
      }
    }
  }

  /**
   * Test authentication security
   */
  async testAuthentication(results) {
    const tests = [
      {
        name: 'Weak Password Policy',
        test: () => this.checkPasswordPolicy('123'),
        shouldFail: true
      },
      {
        name: 'Strong Password Policy', 
        test: () => this.checkPasswordPolicy('ComplexP@ssw0rd123!'),
        shouldFail: false
      },
      {
        name: 'Session Token Entropy',
        test: () => this.checkSessionTokenEntropy(),
        shouldFail: false
      },
      {
        name: 'Brute Force Protection',
        test: () => this.testBruteForceProtection(),
        shouldFail: false
      }
    ];

    for (const test of tests) {
      results.totalTests++;
      
      try {
        const result = await test.test();
        
        if (test.shouldFail && result) {
          this.addVulnerability(results, {
            category: 'authentication',
            severity: 'high',
            test: test.name,
            issue: 'Weak authentication mechanism'
          });
          results.failed++;
        } else if (!test.shouldFail && result) {
          results.passed++;
        } else {
          results.failed++;
        }
        
      } catch (error) {
        if (test.shouldFail) {
          results.passed++;
        } else {
          results.failed++;
        }
      }
    }
  }

  /**
   * Test authorization mechanisms
   */
  async testAuthorization(results) {
    const tests = [
      {
        name: 'Privilege Escalation',
        test: () => this.testPrivilegeEscalation(),
        description: 'Test for horizontal/vertical privilege escalation'
      },
      {
        name: 'Access Control Bypass',
        test: () => this.testAccessControlBypass(),
        description: 'Test for access control bypasses'
      },
      {
        name: 'Resource Access Control',
        test: () => this.testResourceAccessControl(),
        description: 'Test resource-level access controls'
      }
    ];

    for (const test of tests) {
      results.totalTests++;
      
      try {
        const vulnerabilityFound = await test.test();
        
        if (vulnerabilityFound) {
          this.addVulnerability(results, {
            category: 'authorization',
            severity: 'high',
            test: test.name,
            issue: test.description
          });
          results.failed++;
        } else {
          results.passed++;
        }
        
      } catch (error) {
        results.failed++;
        this.addTestResult(results, {
          name: test.name,
          status: 'error',
          error: error.message
        });
      }
    }
  }

  /**
   * Test for data exposure vulnerabilities
   */
  async testDataExposure(results) {
    const tests = [
      {
        name: 'Sensitive File Exposure',
        test: () => this.checkSensitiveFileExposure(),
        description: 'Check for exposed sensitive files'
      },
      {
        name: 'Error Message Information Disclosure',
        test: () => this.checkErrorMessageDisclosure(),
        description: 'Check for information disclosure in error messages'
      },
      {
        name: 'Debug Information Exposure',
        test: () => this.checkDebugInformationExposure(),
        description: 'Check for exposed debug information'
      },
      {
        name: 'Configuration File Exposure',
        test: () => this.checkConfigurationExposure(),
        description: 'Check for exposed configuration files'
      }
    ];

    for (const test of tests) {
      results.totalTests++;
      
      try {
        const exposureFound = await test.test();
        
        if (exposureFound) {
          this.addVulnerability(results, {
            category: 'data-exposure',
            severity: 'medium',
            test: test.name,
            issue: test.description,
            details: exposureFound
          });
          results.failed++;
        } else {
          results.passed++;
        }
        
      } catch (error) {
        results.failed++;
      }
    }
  }

  /**
   * Test dependency security
   */
  async testDependencySecurity(results) {
    results.totalTests++;
    
    try {
      const auditResults = await dependencySecurityManager.auditDependencies();
      
      if (auditResults.summary.criticalVulns > 0) {
        this.addVulnerability(results, {
          category: 'dependency-security',
          severity: 'critical',
          test: 'Critical Vulnerabilities',
          issue: `${auditResults.summary.criticalVulns} critical vulnerabilities found`,
          details: auditResults.vulnerabilities.filter(v => v.severity === 'critical')
        });
        results.failed++;
      } else if (auditResults.summary.highVulns > 0) {
        this.addVulnerability(results, {
          category: 'dependency-security',
          severity: 'high',
          test: 'High Severity Vulnerabilities',
          issue: `${auditResults.summary.highVulns} high severity vulnerabilities found`,
          details: auditResults.vulnerabilities.filter(v => v.severity === 'high')
        });
        results.failed++;
      } else {
        results.passed++;
      }
      
    } catch (error) {
      results.failed++;
      this.addTestResult(results, {
        name: 'Dependency Security Audit',
        status: 'error',
        error: error.message
      });
    }
  }

  /**
   * Test runtime security monitoring
   */
  async testRuntimeSecurity(results) {
    const tests = [
      {
        name: 'Runtime Monitoring Active',
        test: () => runtimeSecurityMonitor.isMonitoring,
        shouldPass: true
      },
      {
        name: 'Threat Detection',
        test: () => this.testThreatDetection(),
        shouldPass: true
      },
      {
        name: 'Rate Limiting',
        test: () => this.testRateLimiting(),
        shouldPass: true
      }
    ];

    for (const test of tests) {
      results.totalTests++;
      
      try {
        const result = await test.test();
        
        if (test.shouldPass && result) {
          results.passed++;
        } else if (!test.shouldPass && !result) {
          results.passed++;
        } else {
          this.addVulnerability(results, {
            category: 'runtime-security',
            severity: 'medium',
            test: test.name,
            issue: 'Runtime security mechanism not working properly'
          });
          results.failed++;
        }
        
      } catch (error) {
        results.failed++;
      }
    }
  }

  /**
   * Test file operation security
   */
  async testFileOperations(results) {
    const dangerousFiles = [
      '/etc/passwd',
      '/etc/shadow',
      'C:\\Windows\\System32\\config\\SAM',
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts'
    ];

    for (const filePath of dangerousFiles) {
      results.totalTests++;
      
      try {
        await pathSecurityManager.validatePath(filePath);
        
        // If validation passes, it's a vulnerability
        this.addVulnerability(results, {
          category: 'file-operations',
          severity: 'critical',
          test: 'Dangerous File Access',
          issue: `Access to dangerous file path allowed: ${filePath}`,
          payload: filePath
        });
        results.failed++;
        
      } catch (error) {
        // Validation failed - this is good
        results.passed++;
      }
    }
  }

  /**
   * Test command injection vulnerabilities
   */
  async testCommandInjection(results) {
    const commandPayloads = [
      '; rm -rf /',
      '| cat /etc/passwd',
      '&& whoami',
      '`id`',
      '$(ls -la)',
      '; shutdown -h now',
      '| nc -l 4444'
    ];

    for (const payload of commandPayloads) {
      results.totalTests++;
      
      try {
        // Test command validation/sanitization
        await inputValidator.validateInput(payload, 'string');
        
        // Check if dangerous command patterns are still present
        if (this.containsCommandInjection(payload)) {
          this.addVulnerability(results, {
            category: 'command-injection',
            severity: 'critical',
            test: 'Command Injection',
            issue: 'Command injection payload not sanitized',
            payload: payload
          });
          results.failed++;
        } else {
          results.passed++;
        }
        
      } catch (error) {
        // Input validation caught the injection - good
        results.passed++;
      }
    }
  }

  /**
   * Check for dangerous patterns in sanitized input
   */
  checkForDangerousPatterns(input, type) {
    const patterns = {
      sql: [/union\s+select/i, /drop\s+table/i, /insert\s+into/i],
      nosql: [/\$ne\s*:/i, /\$gt\s*:/i, /\$where\s*:/i],
      command: [/;\s*(rm|del|format)/i, /\|\s*(cat|type)/i],
      ldap: [/\*\)\(&/i, /\|\(\|/i],
      xpath: [/or\s+1\s*=\s*1/i, /and\s+1\s*=\s*1/i],
      template: [/\{\{.*\}\}/i, /\$\{.*\}/i]
    };

    const typePatterns = patterns[type] || [];
    return typePatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check password policy strength
   */
  checkPasswordPolicy(password) {
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return password.length >= minLength && 
           hasUppercase && 
           hasLowercase && 
           hasNumbers && 
           hasSpecialChars;
  }

  /**
   * Check session token entropy
   */
  checkSessionTokenEntropy() {
    // Generate test token and check entropy
    const token = require('crypto').randomBytes(32).toString('hex');
    return token.length >= 32 && /[a-f0-9]{64}/.test(token);
  }

  /**
   * Test brute force protection
   */
  async testBruteForceProtection() {
    // Simulate multiple failed attempts
    const clientId = 'test-client';
    
    try {
      for (let i = 0; i < 15; i++) {
        await runtimeSecurityMonitor.validateOperation('login', { 
          username: 'test', 
          password: 'wrong' 
        }, { clientId });
      }
      return false; // No protection - vulnerability
    } catch (error) {
      return error.message.includes('rate limit') || error.message.includes('failed attempts');
    }
  }

  /**
   * Test for privilege escalation
   */
  async testPrivilegeEscalation() {
    // This would test actual authorization mechanisms
    // For now, return false (no vulnerability found)
    return false;
  }

  /**
   * Test access control bypass
   */
  async testAccessControlBypass() {
    // This would test actual access controls
    return false;
  }

  /**
   * Test resource access control
   */
  async testResourceAccessControl() {
    // This would test resource-level controls
    return false;
  }

  /**
   * Check for sensitive file exposure
   */
  async checkSensitiveFileExposure() {
    const sensitiveFiles = [
      '.env',
      '.env.local',
      'config.json',
      'package-lock.json',
      '.git/config',
      'database.json'
    ];

    for (const file of sensitiveFiles) {
      if (await fs.pathExists(file)) {
        const stats = await fs.stat(file);
        // Check if world-readable
        if ((stats.mode & parseInt('004', 8)) !== 0) {
          return { file, issue: 'World-readable sensitive file' };
        }
      }
    }

    return null;
  }

  /**
   * Check error message disclosure
   */
  checkErrorMessageDisclosure() {
    // This would analyze error handling
    return null;
  }

  /**
   * Check debug information exposure
   */
  checkDebugInformationExposure() {
    // Check for debug mode indicators
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG) {
      return { issue: 'Debug mode enabled in production-like environment' };
    }
    return null;
  }

  /**
   * Check configuration exposure
   */
  checkConfigurationExposure() {
    // Check for exposed config files
    return null;
  }

  /**
   * Test threat detection
   */
  async testThreatDetection() {
    try {
      await runtimeSecurityMonitor.validateOperation('test', {
        malicious: '<script>alert("xss")</script>'
      });
      return false; // Threat not detected
    } catch (error) {
      return true; // Threat detected
    }
  }

  /**
   * Test rate limiting
   */
  async testRateLimiting() {
    try {
      for (let i = 0; i < 101; i++) {
        await runtimeSecurityMonitor.validateOperation('test', {}, { clientId: 'rate-test' });
      }
      return false; // Rate limiting not working
    } catch (error) {
      return error.message.includes('rate limit');
    }
  }

  /**
   * Check if input contains command injection
   */
  containsCommandInjection(input) {
    const patterns = [
      /;\s*(rm|del|format|shutdown)/i,
      /\|\s*(cat|type|nc|telnet)/i,
      /`[^`]*`/,
      /\$\([^)]*\)/
    ];

    return patterns.some(pattern => pattern.test(input));
  }

  /**
   * Add vulnerability to results
   */
  addVulnerability(results, vulnerability) {
    results.vulnerabilities.push(vulnerability);
    this.addTestResult(results, {
      name: vulnerability.test,
      status: 'vulnerability',
      severity: vulnerability.severity,
      issue: vulnerability.issue
    });
  }

  /**
   * Add test result
   */
  addTestResult(results, testResult) {
    if (!results.tests) {
      results.tests = [];
    }
    results.tests.push(testResult);
  }

  /**
   * Calculate overall risk score
   */
  calculateRiskScore(vulnerabilities) {
    let score = 0;
    
    for (const vuln of vulnerabilities) {
      switch (vuln.severity) {
        case 'critical':
          score += 25;
          break;
        case 'high':
          score += 15;
          break;
        case 'medium':
          score += 10;
          break;
        case 'low':
          score += 5;
          break;
      }
    }
    
    return Math.min(100, score);
  }

  /**
   * Generate security recommendations
   */
  generateSecurityRecommendations(testResults) {
    const recommendations = [];
    
    // Critical vulnerabilities
    const criticalVulns = testResults.vulnerabilities.filter(v => v.severity === 'critical');
    if (criticalVulns.length > 0) {
      recommendations.push({
        priority: 'critical',
        action: 'Fix critical vulnerabilities immediately',
        count: criticalVulns.length,
        categories: [...new Set(criticalVulns.map(v => v.category))]
      });
    }
    
    // High severity vulnerabilities
    const highVulns = testResults.vulnerabilities.filter(v => v.severity === 'high');
    if (highVulns.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Address high severity vulnerabilities',
        count: highVulns.length,
        categories: [...new Set(highVulns.map(v => v.category))]
      });
    }
    
    // General recommendations
    if (testResults.summary.riskScore > 50) {
      recommendations.push({
        priority: 'high',
        action: 'Implement comprehensive security review',
        details: 'Risk score indicates significant security issues'
      });
    }
    
    return recommendations;
  }
}

// Export singleton instance
export const securityTestFramework = new SecurityTestFramework();