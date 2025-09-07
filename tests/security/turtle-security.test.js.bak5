import { describe, it, expect, beforeEach } from 'vitest';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Turtle Parser Security Tests', () => {
  let parser;

  beforeEach(() => {
    parser = new TurtleParser();
  });

  describe('Input Validation', () => { it('should reject extremely large input safely', async () => {
      // Generate very large input (but not enough to cause memory issues in test)
      const largeInput = '@prefix ex });

    it('should handle malformed URIs safely', async () => { const malformedTurtle = `
        @prefix ex }
    });

    it('should prevent injection through prefix declarations', async () => { const maliciousTurtle = `
        @prefix "</script>alert('xss')</script> });

    it('should sanitize literal values', async () => { const maliciousTurtle = `
        @prefix ex }
    });
  });

  describe('Resource Exhaustion Protection', () => { it('should handle deeply nested structures without stack overflow', async () => {
      // Create deeply nested structure that could cause stack overflow
      let deepTurtle = '@prefix ex }> ex:next <#level${i+1}> .\n`;
      }
      deepTurtle += '<#level1000> ex:name "Deep end" .';

      const result = await parser.parseContent(deepTurtle);

      // Should complete without crashing
      expect(typeof result.success).toBe('boolean');
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
      }
    });

    it('should limit memory usage with large datasets', async () => { const initialMemory = process.memoryUsage().heapUsed;

      // Generate large dataset
      let largeTurtle = '@prefix ex }> ex:name "Item ${i}" ; ex:data "${'x'.repeat(100)}" .\n`;
      }

      const result = await parser.parseContent(largeTurtle);
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 500MB)
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024);
      
      expect(typeof result.success).toBe('boolean');
    });

    it('should timeout on infinite loops or very slow parsing', async () => { // Create content that might be slow to parse
      const problematicTurtle = '@prefix ex } catch (error) {
        // Timeout is acceptable for this test
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('File System Security', () => { it('should not allow directory traversal in file paths', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        'C }
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

  describe('Template Variable Security', () => { it('should sanitize variable names to prevent injection', async () => {
      const maliciousTurtle = `
        @prefix ex }
    });

    it('should handle special characters in variable values', async () => { const specialCharsTurtle = `
        @prefix ex }
    });
  });

  describe('Denial of Service Protection', () => { it('should limit parsing time for complex patterns', async () => {
      // Create pattern that might cause ReDoS
      const complexPattern = '@prefix ex });

    it('should handle billion laughs-style attacks', async () => { // Attempt to create exponentially expanding content
      const billionLaughs = `
        @prefix ex }
    });

    it('should limit variable extraction depth', async () => { // Create content that could cause deep recursion in variable extraction
      let deepTurtle = '@prefix ex });
  });

  describe('Data Integrity', () => { it('should preserve data integrity during parsing', async () => {
      const sensitiveDataTurtle = `
        @prefix ex }
    });

    it('should handle Unicode and international characters safely', async () => { const unicodeTurtle = `
        @prefix ex }
    });
  });
});