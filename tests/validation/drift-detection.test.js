#!/usr/bin/env node

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, mkdirSync, rmSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { createHash } from 'crypto';

describe('KGEN Drift Detection', () => {
  const testDir = resolve('./test-drift-temp');
  const lockFile = join(testDir, 'kgen.lock.json');
  const testFile1 = join(testDir, 'test1.ttl');
  const testFile2 = join(testDir, 'test2.n3');
  const cliPath = resolve('./packages/kgen-cli/bin/kgen.js');

  beforeEach(() => {
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    // Create test files
    writeFileSync(testFile1, `
      @prefix ex: <http://example.org/> .
      ex:person1 a ex:Person ;
        ex:name "John Doe" ;
        ex:age 30 .
    `);

    writeFileSync(testFile2, `
      @prefix ex: <http://example.org/> .
      
      {
        ?person a ex:Person .
        ?person ex:age ?age .
        ?age ex:greaterThan 18 .
      } => {
        ?person ex:isAdult true .
      } .
    `);

    // Create test lockfile
    const file1Content = readFileSync(testFile1);
    const file2Content = readFileSync(testFile2);
    const file1Hash = createHash('sha256').update(file1Content).digest('hex');
    const file2Hash = createHash('sha256').update(file2Content).digest('hex');

    const lockData = {
      version: '1.0.0',
      timestamp: '2025-01-01T00:00:00.000Z',
      directory: testDir,
      files: {
        'test1.ttl': {
          hash: file1Hash,
          size: file1Content.length,
          modified: '2025-01-01T00:00:00.000Z'
        },
        'test2.n3': {
          hash: file2Hash,
          size: file2Content.length,
          modified: '2025-01-01T00:00:00.000Z'
        }
      },
      integrity: {
        combined: createHash('sha256').update(`test1.ttl:${file1Hash}test2.n3:${file2Hash}`).digest('hex'),
        files: 2,
        timestamp: '2025-01-01T00:00:00.000Z'
      }
    };

    writeFileSync(lockFile, JSON.stringify(lockData, null, 2));
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Baseline Creation', () => {
    it('should create baseline lockfile with correct structure', () => {
      const tempLockFile = join(testDir, 'new-baseline.json');
      
      // Create baseline
      const result = execSync(
        `node "${cliPath}" drift baseline -o "${tempLockFile}" -p "*.ttl" "*.n3"`,
        { cwd: testDir, encoding: 'utf8' }
      );

      expect(result).toContain('Baseline created successfully');
      expect(existsSync(tempLockFile)).toBe(true);

      const baseline = JSON.parse(readFileSync(tempLockFile, 'utf8'));
      expect(baseline.version).toBe('1.0.0');
      expect(baseline.files).toBeDefined();
      expect(baseline.integrity).toBeDefined();
      expect(Object.keys(baseline.files)).toHaveLength(2);
    });

    it('should handle dry-run mode', () => {
      const result = execSync(
        `node "${cliPath}" drift baseline --dry-run -p "*.ttl"`,
        { cwd: testDir, encoding: 'utf8' }
      );

      expect(result).toContain('Dry Run');
      expect(result).toContain('Found');
    });
  });

  describe('Drift Detection', () => {
    it('should detect no drift when files are unchanged', () => {
      const result = execSync(
        `node "${cliPath}" drift detect -l "${lockFile}"`,
        { cwd: testDir, encoding: 'utf8' }
      );

      expect(result).toContain('No drift detected');
      expect(result).toContain('Unchanged: 2');
      expect(result).toContain('Modified: 0');
    });

    it('should detect modified files', () => {
      // Modify test file
      writeFileSync(testFile1, `
        @prefix ex: <http://example.org/> .
        ex:person1 a ex:Person ;
          ex:name "Jane Doe" ;
          ex:age 25 .
      `);

      const result = execSync(
        `node "${cliPath}" drift detect -l "${lockFile}" --verbose`,
        { cwd: testDir, encoding: 'utf8' }
      );

      expect(result).toContain('Drift detected');
      expect(result).toContain('Modified: 1');
      expect(result).toContain('test1.ttl');
      expect(result).toContain('Hash mismatch');
    });

    it('should detect deleted files', () => {
      // Delete test file
      unlinkSync(testFile1);

      const result = execSync(
        `node "${cliPath}" drift detect -l "${lockFile}"`,
        { cwd: testDir, encoding: 'utf8' }
      );

      expect(result).toContain('Drift detected');
      expect(result).toContain('Deleted: 1');
      expect(result).toContain('test1.ttl');
    });

    it('should detect new files with scan-new option', () => {
      // Create new file
      writeFileSync(join(testDir, 'test3.jsonld'), `
        {
          "@context": "http://schema.org/",
          "@type": "Person",
          "name": "Bob Smith"
        }
      `);

      const result = execSync(
        `node "${cliPath}" drift detect -l "${lockFile}" --scan-new -p "*.ttl" "*.n3" "*.jsonld"`,
        { cwd: testDir, encoding: 'utf8' }
      );

      expect(result).toContain('Added: 1');
      expect(result).toContain('test3.jsonld');
    });

    it('should exit with error code when drift detected with --exit-code', () => {
      // Modify test file
      writeFileSync(testFile1, 'modified content');

      expect(() => {
        execSync(
          `node "${cliPath}" drift detect -l "${lockFile}" --exit-code`,
          { cwd: testDir, encoding: 'utf8' }
        );
      }).toThrow();
    });

    it('should output JSON format when requested', () => {
      const result = execSync(
        `node "${cliPath}" drift detect -l "${lockFile}" --json`,
        { cwd: testDir, encoding: 'utf8' }
      );

      expect(() => JSON.parse(result.split('JSON Output:')[1])).not.toThrow();
    });
  });

  describe('Validation Integration', () => {
    it('should validate artifacts syntax', () => {
      const result = execSync(
        `node "${cliPath}" validate artifacts "${testFile1}" "${testFile2}"`,
        { encoding: 'utf8' }
      );

      expect(result).toContain('Valid');
      expect(result).toContain('triples');
    });

    it('should detect syntax errors in artifacts', () => {
      // Create invalid turtle file
      const invalidFile = join(testDir, 'invalid.ttl');
      writeFileSync(invalidFile, `
        @prefix ex: <http://example.org/> .
        ex:person1 a ex:Person
        # Missing semicolon and closing dot
      `);

      expect(() => {
        execSync(
          `node "${cliPath}" validate artifacts "${invalidFile}" --exit-code`,
          { encoding: 'utf8' }
        );
      }).toThrow();
    });

    it('should validate templates', () => {
      // Create template directory and file
      const templateDir = join(testDir, 'templates');
      mkdirSync(templateDir, { recursive: true });
      writeFileSync(join(templateDir, 'test.hbs'), `
        <h1>{{title}}</h1>
        <p>Hello {{name}}!</p>
        {{#each items}}
          <li>{{this}}</li>
        {{/each}}
      `);

      const result = execSync(
        `node "${cliPath}" validate templates "${templateDir}"`,
        { encoding: 'utf8' }
      );

      expect(result).toContain('Valid');
      expect(result).toContain('handlebars');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const configFile = join(testDir, 'kgen.config.json');
      writeFileSync(configFile, JSON.stringify({
        graph: {
          input: ["test1.ttl"],
          format: "turtle"
        },
        output: {
          directory: "./output"
        }
      }, null, 2));

      const result = execSync(
        `node "${cliPath}" validate config "${configFile}"`,
        { encoding: 'utf8' }
      );

      expect(result).toContain('Configuration is valid');
      expect(result).toContain('Errors: 0');
    });

    it('should detect configuration errors', () => {
      const configFile = join(testDir, 'invalid-config.json');
      writeFileSync(configFile, JSON.stringify({
        // Missing required fields
        graph: {
          format: "turtle"
          // Missing input
        }
        // Missing output
      }, null, 2));

      expect(() => {
        execSync(
          `node "${cliPath}" validate config "${configFile}" --exit-code`,
          { encoding: 'utf8' }
        );
      }).toThrow();
    });
  });

  describe('Provenance Validation', () => {
    it('should validate provenance attestation structure', () => {
      const attestationFile = join(testDir, '.attest.json');
      const attestation = {
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        predicateType: "https://in-toto.io/Statement/v1",
        subject: [{
          name: "test-artifact",
          digest: { sha256: "dummy-hash" }
        }],
        predicate: {
          builder: { id: "kgen-cli@1.0.0" },
          recipe: { type: "generate" }
        },
        materials: [{
          uri: "test1.ttl",
          digest: { sha256: createHash('sha256').update(readFileSync(testFile1)).digest('hex') },
          size: readFileSync(testFile1).length
        }],
        byproducts: []
      };

      writeFileSync(attestationFile, JSON.stringify(attestation, null, 2));

      const result = execSync(
        `node "${cliPath}" validate provenance -a "${attestationFile}" -f "${testFile1}"`,
        { encoding: 'utf8' }
      );

      expect(result).toContain('Provenance verification');
      expect(result).toContain('Attestation structure valid');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing lockfile gracefully', () => {
      expect(() => {
        execSync(
          `node "${cliPath}" drift detect -l "nonexistent.lock.json"`,
          { cwd: testDir, encoding: 'utf8' }
        );
      }).toThrow();
    });

    it('should handle invalid JSON in lockfile', () => {
      writeFileSync(lockFile, 'invalid json content');

      expect(() => {
        execSync(
          `node "${cliPath}" drift detect -l "${lockFile}"`,
          { cwd: testDir, encoding: 'utf8' }
        );
      }).toThrow();
    });

    it('should handle permission errors', () => {
      // This test might not work on all systems due to permission handling
      // Consider this a placeholder for more comprehensive error testing
    });
  });

  describe('Performance', () => {
    it('should handle large number of files efficiently', () => {
      // Create many test files
      const numFiles = 100;
      for (let i = 0; i < numFiles; i++) {
        writeFileSync(join(testDir, `test${i}.ttl`), `
          @prefix ex: <http://example.org/> .
          ex:test${i} a ex:TestResource ;
            ex:id ${i} .
        `);
      }

      const start = Date.now();
      const result = execSync(
        `node "${cliPath}" drift baseline -o "${join(testDir, 'large-baseline.json')}" -p "*.ttl"`,
        { cwd: testDir, encoding: 'utf8' }
      );
      const duration = Date.now() - start;

      expect(result).toContain('Baseline created successfully');
      expect(result).toContain(`Tracked files: ${numFiles + 1}`); // +1 for existing test file
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});