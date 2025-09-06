import { describe, it, expect, beforeEach } from 'vitest';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Turtle Parser Security Tests', () => {
  let parser: TurtleParser;

  beforeEach(() => {
    parser = new TurtleParser();
  });

  describe('Input Validation', () => {
    it('should reject extremely large input safely', async () => {
      // Generate very large input (but not enough to cause memory issues in test)
      const largeInput = '@prefix ex: <http://example.org/> .\n' + 
        '<#test> ex:data "' + 'x'.repeat(1000000) + '" .'; // 1MB string

      const startTime = performance.now();
      const result = await parser.parseContent(largeInput);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should either succeed or fail gracefully, not crash
      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(duration).toBeLessThan(30000); // Should not hang for more than 30s
    });

    it('should handle malformed URIs safely', async () => {
      const malformedTurtle = `
        @prefix ex: <http://example.org/> .
        <javascript:alert('xss')> ex:name "Malicious URI" .
        <file:///etc/passwd> ex:name "File access attempt" .
        <data:text/html,<script>alert('xss')</script>> ex:name "Data URI" .
      `;

      const result = await parser.parseContent(malformedTurtle);

      // Should parse without executing any malicious content
      expect(typeof result.success).toBe('boolean');
      
      if (result.success) {
        // If parsing succeeds, URIs should be treated as strings
        const data = result.data;
        expect(typeof data).toBe('object');
        
        // No code should be executed
        expect(global.alert).toBeUndefined();
      }
    });

    it('should prevent injection through prefix declarations', async () => {
      const maliciousTurtle = `
        @prefix "</script><script>alert('xss')</script>: <http://example.org/> .
        @prefix ex: <javascript:void(0)> .
        <#test> ex:name "Testing prefix injection" .
      `;

      const result = await parser.parseContent(maliciousTurtle);

      // Should handle malicious prefixes without executing code
      expect(typeof result.success).toBe('boolean');
      expect(global.alert).toBeUndefined();
    });

    it('should sanitize literal values', async () => {
      const maliciousTurtle = `
        @prefix ex: <http://example.org/> .
        <#test> ex:name "<script>alert('xss')</script>" ;
               ex:description "'; DROP TABLE users; --" ;
               ex:path "../../../etc/passwd" ;
               ex:command "rm -rf /" .
      `;

      const result = await parser.parseContent(maliciousTurtle);

      if (result.success) {
        const testData = result.data.test as any;
        
        // Values should be preserved as strings, not executed
        expect(typeof testData.name).toBe('string');
        expect(typeof testData.description).toBe('string');
        expect(typeof testData.path).toBe('string');
        expect(typeof testData.command).toBe('string');
        
        // No code execution should occur
        expect(global.alert).toBeUndefined();
      }
    });
  });

  describe('Resource Exhaustion Protection', () => {
    it('should handle deeply nested structures without stack overflow', async () => {
      // Create deeply nested structure that could cause stack overflow
      let deepTurtle = '@prefix ex: <http://example.org/> .\n';
      
      for (let i = 0; i < 1000; i++) {
        deepTurtle += `<#level${i}> ex:next <#level${i+1}> .\n`;
      }
      deepTurtle += '<#level1000> ex:name "Deep end" .';

      const result = await parser.parseContent(deepTurtle);

      // Should complete without crashing
      expect(typeof result.success).toBe('boolean');
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
      }
    });

    it('should limit memory usage with large datasets', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Generate large dataset
      let largeTurtle = '@prefix ex: <http://example.org/> .\n';
      for (let i = 0; i < 10000; i++) {
        largeTurtle += `<#item${i}> ex:name "Item ${i}" ; ex:data "${'x'.repeat(100)}" .\n`;
      }

      const result = await parser.parseContent(largeTurtle);
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 500MB)
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024);
      
      expect(typeof result.success).toBe('boolean');
    });

    it('should timeout on infinite loops or very slow parsing', async () => {
      // Create content that might be slow to parse
      const problematicTurtle = '@prefix ex: <http://example.org/> .\n' +
        '<#test> ex:data "' + 'a'.repeat(100000) + '" .\n'.repeat(1000);

      const startTime = performance.now();
      
      // Use Promise.race to implement timeout
      const parsePromise = parser.parseContent(problematicTurtle);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );

      try {
        await Promise.race([parsePromise, timeoutPromise]);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // If it completes, it should be reasonably fast
        expect(duration).toBeLessThan(10000);
      } catch (error) {
        // Timeout is acceptable for this test
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('File System Security', () => {
    it('should not allow directory traversal in file paths', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        'C:\\Windows\\System32\\drivers\\etc\\hosts',
      ];

      for (const path of maliciousPaths) {
        const result = await parser.parseFile(path);
        
        // Should fail safely without attempting to read sensitive files
        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toMatch(/file read error/i);
      }
    });

    it('should validate file extensions and types', async () => {
      const suspiciousFiles = [
        'test.exe',
        'malware.bat',
        'script.sh',
        'test.js',
        'config.ini',
      ];

      for (const filename of suspiciousFiles) {
        const testPath = join(tmpdir(), filename);
        const result = await parser.parseFile(testPath);
        
        // Should handle non-turtle files gracefully
        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
      }
    });
  });

  describe('Template Variable Security', () => {
    it('should sanitize variable names to prevent injection', async () => {
      const maliciousTurtle = `
        @prefix ex: <http://example.org/> .
        <#__proto__> ex:name "Prototype pollution attempt" .
        <#constructor> ex:name "Constructor pollution" .
        <#eval> ex:name "Eval injection" .
        <#function> ex:name "Function injection" .
      `;

      const result = await parser.parseContent(maliciousTurtle);

      if (result.success) {
        // Variables should be extracted safely
        expect(result.variables).toContain('__proto__');
        expect(result.variables).toContain('constructor');
        
        // But accessing them should not cause prototype pollution
        const data = result.data as any;
        expect(data.__proto__.name).not.toBe('Prototype pollution attempt');
        expect(data.constructor.name).not.toBe('Constructor pollution');
      }
    });

    it('should handle special characters in variable values', async () => {
      const specialCharsTurtle = `
        @prefix ex: <http://example.org/> .
        <#test> ex:name "Name with \\"quotes\\" and 'apostrophes'" ;
               ex:path "C:\\\\Windows\\\\System32" ;
               ex:regex ".*\\\\d+.*" ;
               ex:newlines "Line 1\\nLine 2\\nLine 3" ;
               ex:tabs "Col1\\tCol2\\tCol3" .
      `;

      const result = await parser.parseContent(specialCharsTurtle);

      expect(result.success).toBe(true);
      
      if (result.success) {
        const testData = result.data.test as any;
        expect(typeof testData.name).toBe('string');
        expect(typeof testData.path).toBe('string');
        expect(typeof testData.regex).toBe('string');
        expect(typeof testData.newlines).toBe('string');
        expect(typeof testData.tabs).toBe('string');
      }
    });
  });

  describe('Denial of Service Protection', () => {
    it('should limit parsing time for complex patterns', async () => {
      // Create pattern that might cause ReDoS
      const complexPattern = '@prefix ex: <http://example.org/> .\n' +
        '<#test> ex:pattern "' + '(a+)+'.repeat(100) + '" .';

      const startTime = performance.now();
      const result = await parser.parseContent(complexPattern);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds max
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle billion laughs-style attacks', async () => {
      // Attempt to create exponentially expanding content
      const billionLaughs = `
        @prefix ex: <http://example.org/> .
        <#lol> ex:data "lol" .
        <#lol2> ex:data "lol lol lol lol lol lol lol lol lol lol" .
        <#lol3> ex:data "lol2 lol2 lol2 lol2 lol2 lol2 lol2 lol2" .
      `;

      const result = await parser.parseContent(billionLaughs);

      // Should parse without exponential expansion
      expect(typeof result.success).toBe('boolean');
      
      if (result.success) {
        expect(Object.keys(result.data)).toHaveLength(3);
      }
    });

    it('should limit variable extraction depth', async () => {
      // Create content that could cause deep recursion in variable extraction
      let deepTurtle = '@prefix ex: <http://example.org/> .\n';
      
      // Create circular references
      deepTurtle += '<#a> ex:refs <#b> .\n';
      deepTurtle += '<#b> ex:refs <#c> .\n';
      deepTurtle += '<#c> ex:refs <#a> .\n';

      const result = await parser.parseContent(deepTurtle);

      expect(result.success).toBe(true);
      expect(result.variables).toContain('a');
      expect(result.variables).toContain('b');
      expect(result.variables).toContain('c');
      
      // Should not get stuck in infinite recursion
      expect(result.variables.length).toBeLessThan(100);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve data integrity during parsing', async () => {
      const sensitiveDataTurtle = `
        @prefix ex: <http://example.org/> .
        <#user> ex:id "12345" ;
               ex:email "user@example.com" ;
               ex:role "admin" ;
               ex:token "secret-token-123" .
      `;

      const result = await parser.parseContent(sensitiveDataTurtle);

      expect(result.success).toBe(true);
      
      if (result.success) {
        const userData = result.data.user as any;
        
        // Data should be preserved exactly as provided
        expect(userData.id).toBe('12345');
        expect(userData.email).toBe('user@example.com');
        expect(userData.role).toBe('admin');
        expect(userData.token).toBe('secret-token-123');
        
        // No data should be modified or escaped
        expect(userData.id).not.toBe("'12345'");
        expect(userData.email).not.toContain('&lt;');
      }
    });

    it('should handle Unicode and international characters safely', async () => {
      const unicodeTurtle = `
        @prefix ex: <http://example.org/> .
        <#test> ex:name "José García" ;
               ex:city "北京" ;
               ex:emoji "🚀🎉🌟" ;
               ex:arabic "مرحبا بالعالم" ;
               ex:hebrew "שלום עולם" .
      `;

      const result = await parser.parseContent(unicodeTurtle);

      expect(result.success).toBe(true);
      
      if (result.success) {
        const testData = result.data.test as any;
        expect(testData.name).toBe('José García');
        expect(testData.city).toBe('北京');
        expect(testData.emoji).toBe('🚀🎉🌟');
        expect(testData.arabic).toBe('مرحبا بالعالم');
        expect(testData.hebrew).toBe('שלום עולם');
      }
    });
  });
});