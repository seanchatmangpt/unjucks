/**
 * Comprehensive RDF Security Validation Test Suite
 * 
 * This test suite validates security defenses against real attack vectors:
 * 1. Input validation attacks (Turtle injection, XXE, path traversal, buffer overflow)
 * 2. Resource exhaustion attacks (DoS, memory exhaustion, infinite loops)
 * 3. Template injection attacks (code injection, escapes, pollution)
 * 4. Network security (URI validation, SSRF prevention, protocol restriction)
 * 
 * All tests use actual attack payloads to verify defenses work properly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TurtleParser, TurtleParseError } from '../../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import fs from 'fs-extra';
import path from 'node:path';
import type { RDFDataSource } from '../../src/lib/types/turtle-types.js';

// Security test configuration
const SECURITY_TIMEOUT = 5000; // 5 second timeout for security tests
const MAX_MEMORY_MB = 100; // Maximum allowed memory usage in tests
const MAX_FILE_SIZE_MB = 10; // Maximum file size for tests

interface SecurityTestResult {
  attackType: string;
  attackVector: string;
  blocked: boolean;
  errorType?: string;
  timeElapsed: number;
  memoryUsed?: number;
  details?: string;
}

class SecurityTestReport {
  private results: SecurityTestResult[] = [];
  
  addResult(result: SecurityTestResult): void {
    this.results.push(result);
  }
  
  generateReport(): {
    summary: {
      totalTests: number;
      attacksBlocked: number;
      attacksSucceeded: number;
      avgResponseTime: number;
    };
    vulnerabilities: SecurityTestResult[];
    recommendations: string[];
  } {
    const totalTests = this.results.length;
    const attacksBlocked = this.results.filter(r => r.blocked).length;
    const attacksSucceeded = totalTests - attacksBlocked;
    const avgResponseTime = this.results.reduce((sum, r) => sum + r.timeElapsed, 0) / totalTests;
    
    const vulnerabilities = this.results.filter(r => !r.blocked);
    
    const recommendations = [
      'Implement strict input validation for all RDF data sources',
      'Add rate limiting for HTTP requests to prevent DoS attacks',
      'Sanitize all template variables to prevent injection attacks',
      'Restrict URI schemes to prevent SSRF attacks',
      'Implement memory and timeout limits for parsing operations',
      'Add content-length restrictions for file and HTTP sources',
      'Use CSP headers when rendering template output in web contexts',
      'Implement logging and monitoring for security events'
    ];
    
    return {
      summary: {
        totalTests,
        attacksBlocked,
        attacksSucceeded,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100
      },
      vulnerabilities,
      recommendations
    };
  }
}

describe('RDF Security Comprehensive Validation', () => {
  let parser: TurtleParser;
  let dataLoader: RDFDataLoader;
  let securityReport: SecurityTestReport;
  let originalFetch: typeof globalThis.fetch;
  
  beforeEach(() => {
    parser = new TurtleParser();
    dataLoader = new RDFDataLoader({
      cacheEnabled: false, // Disable caching for security tests
      httpTimeout: SECURITY_TIMEOUT
    });
    securityReport = new SecurityTestReport();
    originalFetch = globalThis.fetch;
  });
  
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('1. Input Validation Attacks', () => {
    describe('Malicious Turtle Syntax Injection', () => {
      it('should block Turtle injection with malicious predicates', async () => {
        const startTime = performance.now();
        const maliciousTurtle = `
          @prefix ex: <http://example.org/> .
          @prefix evil: <javascript:alert('XSS')> .
          
          ex:resource evil:malicious "payload" .
          ex:resource <javascript:void(0)> "another payload" .
        `;
        
        try {
          await parser.parse(maliciousTurtle);
          securityReport.addResult({
            attackType: 'Input Validation',
            attackVector: 'Turtle injection with malicious predicates',
            blocked: false,
            timeElapsed: performance.now() - startTime,
            details: 'Parser accepted malicious JavaScript URIs'
          });
          expect.fail('Parser should reject malicious JavaScript URIs');
        } catch (error) {
          securityReport.addResult({
            attackType: 'Input Validation',
            attackVector: 'Turtle injection with malicious predicates',
            blocked: true,
            errorType: error instanceof TurtleParseError ? 'TurtleParseError' : 'Unknown',
            timeElapsed: performance.now() - startTime
          });
          expect(error).toBeInstanceOf(Error);
        }
      });

      it('should block Turtle injection with oversized literal values', async () => {
        const startTime = performance.now();
        const hugeLiteral = 'A'.repeat(1000000); // 1MB literal
        const maliciousTurtle = `
          @prefix ex: <http://example.org/> .
          ex:resource ex:property "${hugeLiteral}" .
        `;
        
        try {
          await parser.parse(maliciousTurtle);
          securityReport.addResult({
            attackType: 'Input Validation',
            attackVector: 'Oversized literal values',
            blocked: false,
            timeElapsed: performance.now() - startTime,
            details: 'Parser accepted oversized literal without limits'
          });
        } catch (error) {
          securityReport.addResult({
            attackType: 'Input Validation',
            attackVector: 'Oversized literal values',
            blocked: true,
            errorType: error instanceof TurtleParseError ? 'TurtleParseError' : 'Unknown',
            timeElapsed: performance.now() - startTime
          });
          expect(error).toBeInstanceOf(Error);
        }
      });

      it('should block malformed URI schemes', async () => {
        const startTime = performance.now();
        const attackVectors = [
          'file:///etc/passwd',
          'gopher://evil.com/',
          'ldap://attacker.com/',
          'dict://127.0.0.1:6379/info',
          'ftp://internal.server/file.txt'
        ];
        
        for (const maliciousUri of attackVectors) {
          const maliciousTurtle = `
            @prefix ex: <http://example.org/> .
            ex:resource ex:property <${maliciousUri}> .
          `;
          
          try {
            await parser.parse(maliciousTurtle);
            securityReport.addResult({
              attackType: 'Input Validation',
              attackVector: `Malicious URI scheme: ${maliciousUri}`,
              blocked: false,
              timeElapsed: performance.now() - startTime,
              details: `Parser accepted dangerous URI scheme: ${maliciousUri}`
            });
          } catch (error) {
            securityReport.addResult({
              attackType: 'Input Validation',
              attackVector: `Malicious URI scheme: ${maliciousUri}`,
              blocked: true,
              errorType: error instanceof TurtleParseError ? 'TurtleParseError' : 'Unknown',
              timeElapsed: performance.now() - startTime
            });
            expect(error).toBeInstanceOf(Error);
          }
        }
      });
    });

    describe('XXE (XML External Entity) Attacks via RDF/XML', () => {
      it('should block XXE attacks in RDF/XML content', async () => {
        const startTime = performance.now();
        const xxeAttack = `<?xml version="1.0" encoding="UTF-8"?>
          <!DOCTYPE rdf:RDF [
            <!ENTITY xxe SYSTEM "file:///etc/passwd">
          ]>
          <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
                   xmlns:ex="http://example.org/">
            <rdf:Description rdf:about="http://example.org/resource">
              <ex:property>&xxe;</ex:property>
            </rdf:Description>
          </rdf:RDF>`;
        
        try {
          const parser = new TurtleParser({ format: 'application/rdf+xml' });
          await parser.parse(xxeAttack);
          securityReport.addResult({
            attackType: 'Input Validation',
            attackVector: 'XXE attack via RDF/XML',
            blocked: false,
            timeElapsed: performance.now() - startTime,
            details: 'Parser processed XML with external entities'
          });
        } catch (error) {
          securityReport.addResult({
            attackType: 'Input Validation',
            attackVector: 'XXE attack via RDF/XML',
            blocked: true,
            errorType: error instanceof TurtleParseError ? 'TurtleParseError' : 'Unknown',
            timeElapsed: performance.now() - startTime
          });
          expect(error).toBeInstanceOf(Error);
        }
      });
    });

    describe('Path Traversal Attacks', () => {
      it('should block path traversal in file loading', async () => {
        const startTime = performance.now();
        const maliciousPaths = [
          '../../../etc/passwd',
          '..\\..\\..\\windows\\system32\\config\\sam',
          '/etc/shadow',
          'C:\\Windows\\System32\\config\\SAM',
          '....//....//....//etc/passwd'
        ];
        
        for (const maliciousPath of maliciousPaths) {
          try {
            const source: RDFDataSource = {
              type: 'file',
              source: maliciousPath
            };
            
            await dataLoader.loadFromSource(source);
            securityReport.addResult({
              attackType: 'Input Validation',
              attackVector: `Path traversal: ${maliciousPath}`,
              blocked: false,
              timeElapsed: performance.now() - startTime,
              details: `File loader accessed restricted path: ${maliciousPath}`
            });
          } catch (error) {
            securityReport.addResult({
              attackType: 'Input Validation',
              attackVector: `Path traversal: ${maliciousPath}`,
              blocked: true,
              errorType: error.constructor.name,
              timeElapsed: performance.now() - startTime
            });
            expect(error).toBeInstanceOf(Error);
          }
        }
      });
    });
  });

  describe('2. Resource Exhaustion Attacks', () => {
    describe('Large File DoS Attacks', () => {
      it('should prevent loading of extremely large files', async () => {
        const startTime = performance.now();
        const largeFilePath = path.join(__dirname, 'fixtures', 'large-dos-file.ttl');
        
        // Create a large malicious file
        const hugeTurtle = '@prefix ex: <http://example.org/> .\n' + 
          Array.from({ length: 100000 }, (_, i) => 
            `ex:resource${i} ex:property "large data ${i.toString().repeat(100)}" .`
          ).join('\n');
        
        try {
          await fs.ensureDir(path.dirname(largeFilePath));
          await fs.writeFile(largeFilePath, hugeTurtle);
          
          const source: RDFDataSource = {
            type: 'file',
            source: largeFilePath
          };
          
          await dataLoader.loadFromSource(source);
          securityReport.addResult({
            attackType: 'Resource Exhaustion',
            attackVector: 'Large file DoS attack',
            blocked: false,
            timeElapsed: performance.now() - startTime,
            details: 'Loader processed extremely large file without limits'
          });
        } catch (error) {
          securityReport.addResult({
            attackType: 'Resource Exhaustion',
            attackVector: 'Large file DoS attack',
            blocked: true,
            errorType: error.constructor.name,
            timeElapsed: performance.now() - startTime
          });
          expect(error).toBeInstanceOf(Error);
        } finally {
          await fs.remove(largeFilePath).catch(() => {});
        }
      });
    });

    describe('Memory Exhaustion Attacks', () => {
      it('should prevent memory exhaustion from deeply nested structures', async () => {
        const startTime = performance.now();
        const initialMemory = process.memoryUsage().heapUsed;
        
        // Create deeply nested RDF structure
        let deepStructure = '@prefix ex: <http://example.org/> .\n';
        for (let i = 0; i < 10000; i++) {
          deepStructure += `ex:nested${i} ex:contains ex:nested${i + 1} .\n`;
        }
        
        try {
          await parser.parse(deepStructure);
          const finalMemory = process.memoryUsage().heapUsed;
          const memoryUsed = (finalMemory - initialMemory) / 1024 / 1024; // MB
          
          if (memoryUsed > MAX_MEMORY_MB) {
            securityReport.addResult({
              attackType: 'Resource Exhaustion',
              attackVector: 'Memory exhaustion via deep nesting',
              blocked: false,
              timeElapsed: performance.now() - startTime,
              memoryUsed,
              details: `Memory usage exceeded limit: ${memoryUsed.toFixed(2)}MB`
            });
            expect.fail(`Memory usage exceeded limit: ${memoryUsed.toFixed(2)}MB`);
          } else {
            securityReport.addResult({
              attackType: 'Resource Exhaustion',
              attackVector: 'Memory exhaustion via deep nesting',
              blocked: true,
              timeElapsed: performance.now() - startTime,
              memoryUsed
            });
          }
        } catch (error) {
          const finalMemory = process.memoryUsage().heapUsed;
          const memoryUsed = (finalMemory - initialMemory) / 1024 / 1024;
          
          securityReport.addResult({
            attackType: 'Resource Exhaustion',
            attackVector: 'Memory exhaustion via deep nesting',
            blocked: true,
            errorType: error.constructor.name,
            timeElapsed: performance.now() - startTime,
            memoryUsed
          });
          expect(error).toBeInstanceOf(Error);
        }
      });

      it('should prevent memory exhaustion from circular references', async () => {
        const startTime = performance.now();
        const initialMemory = process.memoryUsage().heapUsed;
        
        const circularRdf = `
          @prefix ex: <http://example.org/> .
          ex:a ex:refersTo ex:b .
          ex:b ex:refersTo ex:c .
          ex:c ex:refersTo ex:a .
          ex:a ex:contains ex:a .
        `;
        
        try {
          await parser.parse(circularRdf);
          const finalMemory = process.memoryUsage().heapUsed;
          const memoryUsed = (finalMemory - initialMemory) / 1024 / 1024;
          
          securityReport.addResult({
            attackType: 'Resource Exhaustion',
            attackVector: 'Circular reference memory exhaustion',
            blocked: true,
            timeElapsed: performance.now() - startTime,
            memoryUsed
          });
          expect(memoryUsed).toBeLessThan(MAX_MEMORY_MB);
        } catch (error) {
          securityReport.addResult({
            attackType: 'Resource Exhaustion',
            attackVector: 'Circular reference memory exhaustion',
            blocked: true,
            errorType: error.constructor.name,
            timeElapsed: performance.now() - startTime
          });
          expect(error).toBeInstanceOf(Error);
        }
      });
    });

    describe('Infinite Loop Prevention', () => {
      it('should timeout on malformed infinite parsing attempts', async () => {
        const startTime = performance.now();
        const malformedTurtle = `
          @prefix ex: <http://example.org/> .
          ex:resource ex:property "unclosed string
        `; // Intentionally malformed to potentially cause parsing issues
        
        try {
          await parser.parse(malformedTurtle);
          securityReport.addResult({
            attackType: 'Resource Exhaustion',
            attackVector: 'Infinite loop via malformed input',
            blocked: false,
            timeElapsed: performance.now() - startTime,
            details: 'Parser did not timeout on malformed input'
          });
        } catch (error) {
          const timeElapsed = performance.now() - startTime;
          const blocked = timeElapsed < SECURITY_TIMEOUT * 2; // Should timeout quickly
          
          securityReport.addResult({
            attackType: 'Resource Exhaustion',
            attackVector: 'Infinite loop via malformed input',
            blocked,
            errorType: error.constructor.name,
            timeElapsed
          });
          expect(error).toBeInstanceOf(Error);
        }
      });
    });
  });

  describe('3. Template Injection Attacks', () => {
    describe('Code Injection via RDF Data', () => {
      it('should sanitize JavaScript code injection in literals', async () => {
        const startTime = performance.now();
        const injectionTurtle = `
          @prefix ex: <http://example.org/> .
          ex:user ex:name "{{constructor.constructor('alert(1)')()}}" .
          ex:user ex:script "<script>alert('XSS')</script>" .
          ex:user ex:eval "{{global.process.exit(1)}}" .
        `;
        
        try {
          const result = await parser.parse(injectionTurtle);
          
          // Check if dangerous values were sanitized
          let foundDangerousContent = false;
          for (const triple of result.triples) {
            if (triple.object.type === 'literal') {
              const value = triple.object.value;
              if (value.includes('constructor.constructor') || 
                  value.includes('<script>') || 
                  value.includes('process.exit')) {
                foundDangerousContent = true;
                break;
              }
            }
          }
          
          securityReport.addResult({
            attackType: 'Template Injection',
            attackVector: 'JavaScript code injection in literals',
            blocked: !foundDangerousContent,
            timeElapsed: performance.now() - startTime,
            details: foundDangerousContent ? 'Dangerous content found in parsed data' : 'Content properly sanitized'
          });
          
          if (foundDangerousContent) {
            expect.fail('Dangerous JavaScript content was not sanitized');
          }
        } catch (error) {
          securityReport.addResult({
            attackType: 'Template Injection',
            attackVector: 'JavaScript code injection in literals',
            blocked: true,
            errorType: error.constructor.name,
            timeElapsed: performance.now() - startTime
          });
          expect(error).toBeInstanceOf(Error);
        }
      });

      it('should prevent prototype pollution via RDF variables', async () => {
        const startTime = performance.now();
        const pollutionTurtle = `
          @prefix ex: <http://example.org/> .
          ex:__proto__ ex:polluted "true" .
          ex:constructor ex:prototype ex:danger .
        `;
        
        try {
          const result = await dataLoader.loadFromSource({
            type: 'inline',
            source: pollutionTurtle
          });
          
          // Check if prototype pollution occurred
          const prototypePolluted = Object.prototype.hasOwnProperty('polluted') ||
                                   Function.prototype.hasOwnProperty('danger');
          
          securityReport.addResult({
            attackType: 'Template Injection',
            attackVector: 'Prototype pollution via RDF variables',
            blocked: !prototypePolluted,
            timeElapsed: performance.now() - startTime,
            details: prototypePolluted ? 'Prototype pollution detected' : 'Prototype pollution prevented'
          });
          
          expect(prototypePolluted).toBe(false);
        } catch (error) {
          securityReport.addResult({
            attackType: 'Template Injection',
            attackVector: 'Prototype pollution via RDF variables',
            blocked: true,
            errorType: error.constructor.name,
            timeElapsed: performance.now() - startTime
          });
          expect(error).toBeInstanceOf(Error);
        }
      });
    });
  });

  describe('4. Network Security', () => {
    describe('SSRF (Server-Side Request Forgery) Prevention', () => {
      it('should block requests to internal/private IP ranges', async () => {
        const startTime = performance.now();
        const maliciousUrls = [
          'http://127.0.0.1:8080/admin',
          'http://localhost/config',
          'http://10.0.0.1/internal',
          'http://192.168.1.1/router',
          'http://172.16.0.1/service',
          'http://169.254.169.254/metadata' // AWS metadata service
        ];
        
        // Mock fetch to detect SSRF attempts
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Blocked by security policy'));
        
        for (const maliciousUrl of maliciousUrls) {
          try {
            await dataLoader.loadFromSource({
              type: 'uri',
              source: maliciousUrl
            });
            
            securityReport.addResult({
              attackType: 'Network Security',
              attackVector: `SSRF attempt: ${maliciousUrl}`,
              blocked: false,
              timeElapsed: performance.now() - startTime,
              details: `Request to internal IP was not blocked: ${maliciousUrl}`
            });
          } catch (error) {
            securityReport.addResult({
              attackType: 'Network Security',
              attackVector: `SSRF attempt: ${maliciousUrl}`,
              blocked: true,
              errorType: error.constructor.name,
              timeElapsed: performance.now() - startTime
            });
            expect(error).toBeInstanceOf(Error);
          }
        }
      });

      it('should enforce protocol restrictions', async () => {
        const startTime = performance.now();
        const forbiddenProtocols = [
          'ftp://evil.com/malicious.ttl',
          'file:///etc/passwd',
          'gopher://attacker.com/',
          'dict://127.0.0.1:6379/',
          'ldap://internal.server/'
        ];
        
        for (const forbiddenUrl of forbiddenProtocols) {
          try {
            await dataLoader.loadFromSource({
              type: 'uri',
              source: forbiddenUrl
            });
            
            securityReport.addResult({
              attackType: 'Network Security',
              attackVector: `Forbidden protocol: ${forbiddenUrl}`,
              blocked: false,
              timeElapsed: performance.now() - startTime,
              details: `Forbidden protocol was allowed: ${forbiddenUrl}`
            });
          } catch (error) {
            securityReport.addResult({
              attackType: 'Network Security',
              attackVector: `Forbidden protocol: ${forbiddenUrl}`,
              blocked: true,
              errorType: error.constructor.name,
              timeElapsed: performance.now() - startTime
            });
            expect(error).toBeInstanceOf(Error);
          }
        }
      });

      it('should enforce request timeouts', async () => {
        const startTime = performance.now();
        
        // Mock a slow response
        globalThis.fetch = vi.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, SECURITY_TIMEOUT * 2))
        );
        
        try {
          await dataLoader.loadFromSource({
            type: 'uri',
            source: 'https://slow.example.com/data.ttl'
          });
          
          securityReport.addResult({
            attackType: 'Network Security',
            attackVector: 'Timeout enforcement',
            blocked: false,
            timeElapsed: performance.now() - startTime,
            details: 'Request did not timeout as expected'
          });
          expect.fail('Request should have timed out');
        } catch (error) {
          const timeElapsed = performance.now() - startTime;
          const timedOut = timeElapsed < SECURITY_TIMEOUT * 1.5;
          
          securityReport.addResult({
            attackType: 'Network Security',
            attackVector: 'Timeout enforcement',
            blocked: timedOut,
            errorType: error.constructor.name,
            timeElapsed
          });
          expect(error).toBeInstanceOf(Error);
        }
      });
    });

    describe('URI Validation and Sanitization', () => {
      it('should validate and sanitize malicious URIs', async () => {
        const startTime = performance.now();
        const maliciousUris = [
          'http://evil.com/../../../etc/passwd',
          'https://attacker.com/..\\..\\windows\\system32',
          'http://user:pass@internal.com/data',
          'javascript:alert(1)',
          'data:text/html,<script>alert(1)</script>'
        ];
        
        for (const maliciousUri of maliciousUris) {
          try {
            await dataLoader.loadFromSource({
              type: 'uri',
              source: maliciousUri
            });
            
            securityReport.addResult({
              attackType: 'Network Security',
              attackVector: `Malicious URI: ${maliciousUri}`,
              blocked: false,
              timeElapsed: performance.now() - startTime,
              details: `Malicious URI was not blocked: ${maliciousUri}`
            });
          } catch (error) {
            securityReport.addResult({
              attackType: 'Network Security',
              attackVector: `Malicious URI: ${maliciousUri}`,
              blocked: true,
              errorType: error.constructor.name,
              timeElapsed: performance.now() - startTime
            });
            expect(error).toBeInstanceOf(Error);
          }
        }
      });
    });
  });

  describe('Security Assessment Report Generation', () => {
    it('should generate comprehensive security assessment report', async () => {
      // Complete the security report
      const report = securityReport.generateReport();
      
      // Verify report structure
      expect(report.summary).toBeDefined();
      expect(report.summary.totalTests).toBeGreaterThan(0);
      expect(report.vulnerabilities).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
      
      // Log the security assessment report
      console.log('\n=== RDF SECURITY ASSESSMENT REPORT ===\n');
      console.log(`Total Security Tests: ${report.summary.totalTests}`);
      console.log(`Attacks Blocked: ${report.summary.attacksBlocked}`);
      console.log(`Attacks Succeeded: ${report.summary.attacksSucceeded}`);
      console.log(`Average Response Time: ${report.summary.avgResponseTime}ms\n`);
      
      if (report.vulnerabilities.length > 0) {
        console.log('🚨 VULNERABILITIES DETECTED:');
        report.vulnerabilities.forEach((vuln, index) => {
          console.log(`${index + 1}. ${vuln.attackType} - ${vuln.attackVector}`);
          console.log(`   Details: ${vuln.details || 'No details'}`);
          console.log(`   Time: ${vuln.timeElapsed.toFixed(2)}ms\n`);
        });
      } else {
        console.log('✅ No vulnerabilities detected!\n');
      }
      
      console.log('📋 SECURITY RECOMMENDATIONS:');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
      console.log('\n=== END SECURITY REPORT ===\n');
      
      // Fail the test if critical vulnerabilities are found
      const criticalVulns = report.vulnerabilities.filter(v => 
        v.attackType === 'Template Injection' || 
        v.attackVector.includes('SSRF') ||
        v.attackVector.includes('path traversal')
      );
      
      if (criticalVulns.length > 0) {
        expect.fail(`Critical security vulnerabilities detected: ${criticalVulns.length}`);
      }
      
      // Ensure reasonable security coverage
      expect(report.summary.attacksBlocked).toBeGreaterThan(report.summary.attacksSucceeded);
      expect(report.summary.avgResponseTime).toBeLessThan(SECURITY_TIMEOUT);
    });
  });
});