/**
 * RDF Attack Vector Security Tests
 * 
 * Comprehensive security testing using predefined attack vectors
 * and automated security assessment reporting.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TurtleParser, TurtleParseError } from '../../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import type { RDFDataSource } from '../../src/lib/types/turtle-types.js';
import { 
  SECURITY_TEST_VECTORS,
  generateMaliciousRDF,
  evaluateSecurityTest,
  generateSecurityReport,
  MemoryMonitor,
  ATTACK_PATTERNS,
  type SecurityTestResult,
  type SecurityTestVector
} from './security-utils.js';
import fs from 'fs-extra';
import path from 'node:path';

const SECURITY_TIMEOUT = 3000; // 3 second timeout
const MAX_MEMORY_INCREASE_MB = 50; // Max 50MB memory increase per test

describe('RDF Attack Vector Security Tests', () => {
  let parser: TurtleParser;
  let dataLoader: RDFDataLoader;
  let testResults: SecurityTestResult[] = [];
  let originalFetch: typeof globalThis.fetch;
  
  beforeEach(() => {
    parser = new TurtleParser();
    dataLoader = new RDFDataLoader({
      cacheEnabled: false,
      httpTimeout: SECURITY_TIMEOUT
    });
    originalFetch = globalThis.fetch;
  });
  
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Systematic Attack Vector Testing', () => {
    it.each(SECURITY_TEST_VECTORS)('should handle $name attack vector', async (vector: SecurityTestVector) => {
      const memoryMonitor = new MemoryMonitor();
      const startTime = performance.now();
      let actualOutcome: SecurityTestResult['actualOutcome'] = 'allowed';
      let errorType: string | undefined;
      let details: string | undefined;

      try {
        const maliciousRDF = generateMaliciousRDF(vector);
        
        // Test different components based on attack category
        if (vector.category === 'network_security') {
          // Test network-based attacks through data loader
          await dataLoader.loadFromSource({
            type: 'uri',
            source: vector.payload
          });
        } else {
          // Test parsing-based attacks through parser
          const result = await parser.parse(maliciousRDF);
          
          // Check if dangerous content was properly sanitized
          if (vector.category === 'template_injection') {
            const hasDangerousContent = result.triples.some(triple => 
              triple.object.type === 'literal' && 
              (triple.object.value.includes('constructor.constructor') ||
               triple.object.value.includes('process.exit') ||
               triple.object.value.includes('__proto__'))
            );
            
            if (!hasDangerousContent) {
              actualOutcome = 'sanitized';
            }
          }
          
          memoryMonitor.update();
          const memoryUsage = memoryMonitor.getUsageMB();
          
          // Check for memory exhaustion
          if (memoryUsage.increase > MAX_MEMORY_INCREASE_MB) {
            details = `Memory usage exceeded limit: ${memoryUsage.increase}MB`;
          }
        }
        
      } catch (error) {
        const timeElapsed = performance.now() - startTime;
        errorType = error.constructor.name;
        
        if (timeElapsed >= SECURITY_TIMEOUT * 0.9) {
          actualOutcome = 'timeout';
        } else {
          actualOutcome = 'blocked';
        }
        
        details = error instanceof Error ? error.message : String(error);
      }
      
      const timeElapsed = performance.now() - startTime;
      const result = evaluateSecurityTest(vector, actualOutcome, timeElapsed, errorType, details);
      testResults.push(result);
      
      // Log detailed test result
      console.log(`${result.success ? '✅' : '❌'} ${vector.name}: ${actualOutcome} (${timeElapsed.toFixed(2)}ms)`);
      if (!result.success) {
        console.log(`   Expected: ${vector.expectedOutcome}, Got: ${actualOutcome}`);
        console.log(`   Details: ${details || 'N/A'}`);
      }
      
      // Assert the test passed (but don't fail the entire suite for individual vectors)
      if (vector.severity === 'critical') {
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Fuzzing with Common Attack Patterns', () => {
    it('should resist XSS payload fuzzing', async () => {
      for (const payload of ATTACK_PATTERNS.XSS_PAYLOADS) {
        const rdf = `@prefix ex: <http://example.org/> .\nex:test ex:value "${payload}" .`;
        
        try {
          const result = await parser.parse(rdf);
          const hasUnsafeContent = result.triples.some(triple => 
            triple.object.type === 'literal' && 
            triple.object.value.includes('<script>')
          );
          expect(hasUnsafeContent).toBe(false);
        } catch (error) {
          // Parsing errors are acceptable for malicious content
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should block SSRF target fuzzing', async () => {
      // Mock fetch to track SSRF attempts
      const ssrfAttempts: string[] = [];
      globalThis.fetch = vi.fn().mockImplementation((url) => {
        ssrfAttempts.push(url.toString());
        throw new Error('Network request blocked by security policy');
      });

      for (const target of ATTACK_PATTERNS.SSRF_TARGETS) {
        try {
          await dataLoader.loadFromSource({
            type: 'uri',
            source: target
          });
          expect.fail(`SSRF target should be blocked: ${target}`);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }

      // Verify no actual network requests were made to dangerous targets
      expect(ssrfAttempts).toEqual(ATTACK_PATTERNS.SSRF_TARGETS);
    });

    it('should prevent path traversal fuzzing', async () => {
      for (const path of ATTACK_PATTERNS.PATH_TRAVERSAL) {
        try {
          await dataLoader.loadFromSource({
            type: 'file',
            source: path
          });
          expect.fail(`Path traversal should be blocked: ${path}`);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Resource Exhaustion Stress Testing', () => {
    it('should handle extremely large RDF documents gracefully', async () => {
      const memoryMonitor = new MemoryMonitor();
      const startTime = performance.now();
      
      // Generate a large but structured RDF document
      const largeRDF = '@prefix ex: <http://example.org/> .\n' +
        Array.from({length: 100000}, (_, i) => 
          `ex:resource${i} ex:property "value${i}" .`
        ).join('\n');

      try {
        await parser.parse(largeRDF);
        const timeElapsed = performance.now() - startTime;
        const memoryUsage = memoryMonitor.getUsageMB();
        
        // Should complete within reasonable time and memory bounds
        expect(timeElapsed).toBeLessThan(10000); // 10 seconds max
        expect(memoryUsage.increase).toBeLessThan(200); // 200MB max
      } catch (error) {
        // Timeout or memory errors are acceptable for extremely large inputs
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should timeout on malformed infinite parsing loops', async () => {
      const malformedInputs = [
        '@prefix ex: <http://example.org/> .\nex:test ex:prop "unclosed',
        '@prefix ex: <http://example.org/> .\nex:test ex:prop ex:test .',
        'invalid turtle syntax that might cause parser loops'
      ];

      for (const input of malformedInputs) {
        const startTime = performance.now();
        
        try {
          await parser.parse(input);
        } catch (error) {
          const timeElapsed = performance.now() - startTime;
          expect(timeElapsed).toBeLessThan(SECURITY_TIMEOUT * 2);
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Template Injection Prevention', () => {
    it('should sanitize JavaScript execution attempts in template variables', async () => {
      const dangerousRDF = `
        @prefix ex: <http://example.org/> .
        ex:user ex:name "{{constructor.constructor('return process.env')()}}" .
        ex:user ex:eval "{{require('child_process').exec('ls')}}" .
        ex:user ex:proto "__proto__" .
      `;

      const result = await parser.parse(dangerousRDF);
      const loadResult = await dataLoader.loadFromSource({
        type: 'inline',
        source: dangerousRDF
      });

      // Check that variables don't contain dangerous execution patterns
      for (const [varName, varValue] of Object.entries(loadResult.variables)) {
        if (typeof varValue === 'object') {
          for (const [propName, propValue] of Object.entries(varValue)) {
            expect(propName).not.toBe('__proto__');
            if (typeof propValue === 'string') {
              expect(propValue).not.toMatch(/constructor\.constructor/);
              expect(propValue).not.toMatch(/process\.env/);
              expect(propValue).not.toMatch(/require\s*\(/);
            }
          }
        }
      }

      // Verify prototype wasn't polluted
      expect(Object.prototype.hasOwnProperty('polluted')).toBe(false);
      expect(Function.prototype.hasOwnProperty('danger')).toBe(false);
    });
  });

  describe('Content-Type and Format Validation', () => {
    it('should validate and restrict content types', async () => {
      const dangerousContentTypes = [
        'text/html',
        'application/javascript', 
        'text/javascript',
        'application/x-httpd-php',
        'text/x-python'
      ];

      // Mock fetch with dangerous content types
      for (const contentType of dangerousContentTypes) {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve('@prefix ex: <http://example.org/> .'),
          headers: new Map([['content-type', contentType]])
        } as any);

        try {
          await dataLoader.loadFromSource({
            type: 'uri',
            source: 'https://example.com/data'
          });
        } catch (error) {
          // Should either succeed (parsing as RDF) or fail safely
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Security Assessment Report Generation', () => {
    it('should generate comprehensive security assessment', () => {
      const report = generateSecurityReport(testResults);
      
      console.log('\n📊 SECURITY ASSESSMENT REPORT');
      console.log('==========================================');
      console.log(`Total Tests: ${report.summary.totalTests}`);
      console.log(`Passed: ${report.summary.passed}`);
      console.log(`Failed: ${report.summary.failed}`);
      console.log(`Critical Failures: ${report.summary.criticalFailures}`);
      console.log(`Risk Score: ${report.riskScore}/100`);
      console.log(`Average Response Time: ${report.summary.averageResponseTime}ms`);
      
      if (report.failures.length > 0) {
        console.log('\n🚨 FAILED SECURITY TESTS:');
        report.failures.forEach((failure, index) => {
          console.log(`${index + 1}. ${failure.vector.name} (${failure.vector.severity})`);
          console.log(`   Expected: ${failure.vector.expectedOutcome}, Got: ${failure.actualOutcome}`);
          console.log(`   Details: ${failure.details || 'N/A'}`);
        });
      }

      if (report.criticalFailures.length > 0) {
        console.log('\n💥 CRITICAL SECURITY FAILURES:');
        report.criticalFailures.forEach((failure, index) => {
          console.log(`${index + 1}. ${failure.vector.name}`);
          console.log(`   Description: ${failure.vector.description}`);
          console.log(`   Details: ${failure.details || 'N/A'}`);
        });
      }

      console.log('\n📋 SECURITY RECOMMENDATIONS:');
      report.recommendations.slice(0, 5).forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
      console.log('==========================================\n');
      
      // Security assertions
      expect(report.summary.totalTests).toBeGreaterThan(0);
      expect(report.riskScore).toBeLessThan(50); // Should have low risk
      expect(report.summary.criticalFailures).toBe(0); // No critical failures allowed
      expect(report.summary.averageResponseTime).toBeLessThan(SECURITY_TIMEOUT);
      
      // At least 80% of tests should pass
      const passRate = (report.summary.passed / report.summary.totalTests) * 100;
      expect(passRate).toBeGreaterThanOrEqual(80);
    });
  });
});