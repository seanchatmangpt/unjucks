/**
 * Drift Detection Integration Test
 * 
 * Tests the complete drift detection system including:
 * - Exit code 3 for semantic drift
 * - ≥90% true-positive rate
 * - JSON diff reports
 * - CI/CD integration
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { execSync } from 'child_process';

// Import drift detection modules  
import { DriftDetector } from '../../src/kgen/drift/drift-detector.js';
import { driftURIResolver } from '../../src/kgen/drift/drift-uri-resolver.js';
import { SemanticDriftAnalyzer } from '../../packages/kgen-core/src/validation/semantic-drift-analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDir = join(__dirname, 'temp', 'drift-integration');

describe('Drift Detection Integration', () => {
  let detector;
  let analyzer;

  beforeEach(async () => {
    // Clean and setup test directory
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.mkdir(testDir, { recursive: true });

    // Initialize drift detection components
    detector = new DriftDetector({
      baselinePath: join(testDir, 'baselines'),
      extensions: ['.js', '.ttl', '.json', '.md']
    });
    
    analyzer = new SemanticDriftAnalyzer({
      semanticThreshold: 0.1,
      truePositiveThreshold: 0.9,
      enableSemanticAnalysis: true,
      enableGitIntegration: false // Avoid git dependency in tests
    });
    
    await analyzer.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Exit Code 3 for Semantic Drift', () => {
    test('should exit with code 3 for high-significance semantic changes', async () => {
      const artifactPath = join(testDir, 'semantic-artifact.ttl');
      
      // Create baseline RDF
      const baseline = `
        @prefix ex: <http://example.org/> .
        ex:Alice a ex:Person ;
                 ex:name "Alice Smith" ;
                 ex:role "Developer" .
      `;
      
      // Create semantically drifted version (type change is highly significant)
      const drifted = `
        @prefix ex: <http://example.org/> .
        ex:Alice a ex:Organization ;
                 ex:name "Alice Smith Corp" ;
                 ex:role "Company" .
      `;

      await fs.writeFile(artifactPath, baseline);
      
      // Create baseline
      await detector.createBaseline(artifactPath);
      
      // Modify to semantic drift
      await fs.writeFile(artifactPath, drifted);
      
      // Analyze drift
      const analysis = await analyzer.analyzeSemanticDrift(artifactPath, { baseline });
      
      // Verify semantic drift detection
      expect(analysis.drift.detected).toBe(true);
      expect(analysis.drift.type).toBe('semantic');
      expect(analysis.drift.significance).toBeGreaterThan(0.1);
      expect(analysis.exitCode).toBe(3); // Exit code 3 for semantic drift
    });

    test('should exit with code 1 for cosmetic changes', async () => {
      const artifactPath = join(testDir, 'cosmetic-artifact.js');
      
      const baseline = 'const name = "Alice";\nconst age = 30;';
      const cosmetic = 'const name = "Alice";\nconst age = 30; // Added comment';

      await fs.writeFile(artifactPath, baseline);
      await detector.createBaseline(artifactPath);
      await fs.writeFile(artifactPath, cosmetic);
      
      const analysis = await analyzer.analyzeSemanticDrift(artifactPath, { baseline });
      
      expect(analysis.drift.detected).toBe(true);
      expect(analysis.drift.type).toBe('cosmetic');
      expect(analysis.exitCode).toBe(1); // Exit code 1 for non-semantic changes
    });

    test('should exit with code 0 for no changes', async () => {
      const artifactPath = join(testDir, 'unchanged-artifact.json');
      const content = JSON.stringify({ name: 'Test', version: '1.0.0' }, null, 2);
      
      await fs.writeFile(artifactPath, content);
      await detector.createBaseline(artifactPath);
      
      const analysis = await analyzer.analyzeSemanticDrift(artifactPath, { baseline: content });
      
      expect(analysis.drift.detected).toBe(false);
      expect(analysis.exitCode).toBe(0);
    });
  });

  describe('True Positive Rate ≥90%', () => {
    test('should achieve ≥90% true positive rate for semantic changes', async () => {
      const testCases = [
        // True positives: Real semantic changes
        {
          baseline: '{ "type": "User", "role": "admin" }',
          current: '{ "type": "User", "role": "guest" }', // Role change is semantic
          expectedDetection: true,
          category: 'semantic'
        },
        {
          baseline: '@prefix ex: <http://example.org/> . ex:item a ex:Product .',
          current: '@prefix ex: <http://example.org/> . ex:item a ex:Service .',
          expectedDetection: true,
          category: 'semantic'
        },
        {
          baseline: 'class UserManager { getUsers() {} }',
          current: 'class UserManager { deleteUsers() {} }', // Method name change
          expectedDetection: true,
          category: 'semantic'
        },
        // True negatives: Cosmetic changes
        {
          baseline: '{"name":"Alice","age":30}',
          current: '{\n  "name": "Alice",\n  "age": 30\n}', // Formatting only
          expectedDetection: false,
          category: 'cosmetic'
        },
        {
          baseline: 'const x = 1; const y = 2;',
          current: 'const x = 1;\nconst y = 2; // Comment added',
          expectedDetection: false,
          category: 'cosmetic'
        }
      ];

      let truePositives = 0;
      let trueNegatives = 0;
      let total = 0;

      for (const testCase of testCases) {
        const artifactPath = join(testDir, `test-${total}.txt`);
        
        await fs.writeFile(artifactPath, testCase.current);
        
        const analysis = await analyzer.analyzeSemanticDrift(artifactPath, { 
          baseline: testCase.baseline 
        });

        const detectedAsSemantic = analysis.drift.detected && 
                                 analysis.drift.type === 'semantic';

        if (testCase.expectedDetection && detectedAsSemantic) {
          truePositives++;
        } else if (!testCase.expectedDetection && !detectedAsSemantic) {
          trueNegatives++;
        }
        
        total++;
      }

      const accuracy = (truePositives + trueNegatives) / total;
      expect(accuracy).toBeGreaterThanOrEqual(0.9); // ≥90% accuracy
    });
  });

  describe('JSON Diff Reports', () => {
    test('should generate comprehensive JSON diff reports', async () => {
      const artifactPath = join(testDir, 'report-test.json');
      
      const baseline = { 
        name: 'Project Alpha', 
        version: '1.0.0',
        dependencies: ['lib1', 'lib2']
      };
      
      const current = { 
        name: 'Project Alpha', 
        version: '2.0.0', // Version bump
        dependencies: ['lib1', 'lib2', 'lib3'], // New dependency
        author: 'Dev Team' // New field
      };

      await fs.writeFile(artifactPath, JSON.stringify(current, null, 2));
      
      const analysis = await analyzer.analyzeSemanticDrift(artifactPath, { 
        baseline: JSON.stringify(baseline, null, 2) 
      });

      // Verify JSON diff structure
      expect(analysis).toMatchObject({
        artifact: {
          path: artifactPath,
          name: expect.any(String)
        },
        drift: {
          detected: expect.any(Boolean),
          type: expect.any(String),
          significance: expect.any(Number),
          reasons: expect.any(Array),
          changes: expect.any(Array)
        },
        semantic: {
          enabled: true,
          graphDiff: expect.any(Object)
        },
        performance: {
          analysisTime: expect.any(Number)
        },
        timestamp: expect.any(String),
        exitCode: expect.any(Number)
      });

      // Verify the report contains diff details
      if (analysis.drift.detected) {
        expect(analysis.drift.reasons.length).toBeGreaterThan(0);
        expect(analysis.drift.changes.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Drift URI Integration', () => {
    test('should generate and apply drift URIs for patches', async () => {
      const baseline = {
        id: 'entity-123',
        name: 'Original Name',
        properties: { active: true }
      };
      
      const current = {
        id: 'entity-123', 
        name: 'Updated Name',
        properties: { active: false, lastModified: '2023-12-01' }
      };

      // Store semantic patch
      const patchResult = await driftURIResolver.storePatch(baseline, current, {
        source: 'integration-test',
        format: 'json'
      });

      expect(patchResult.uri).toMatch(/^drift:\/\//);
      expect(patchResult.metadata.semantic).toBeDefined();

      // Apply patch
      const applyResult = await driftURIResolver.applyPatch(baseline, patchResult.uri);
      expect(applyResult.result).toEqual(current);

      // Verify performance metrics
      const metrics = driftURIResolver.getMetrics();
      expect(metrics.patchesStored).toBe(1);
      expect(metrics.patchesRetrieved).toBe(1);
    });
  });

  describe('File System Drift Checking', () => {
    test('should detect unauthorized file modifications', async () => {
      // Create a directory with multiple files
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });
      
      const files = {
        'index.js': 'console.log("Hello, World!");',
        'config.json': '{"env": "development"}',
        'data.ttl': '@prefix ex: <http://example.org/> . ex:test ex:prop "value" .'
      };

      // Create files and baselines
      for (const [filename, content] of Object.entries(files)) {
        const filepath = join(srcDir, filename);
        await fs.writeFile(filepath, content);
        await detector.createBaseline(filepath);
      }

      // Simulate unauthorized changes
      await fs.writeFile(join(srcDir, 'index.js'), 'console.log("Unauthorized change!");');
      await fs.writeFile(join(srcDir, 'data.ttl'), '@prefix ex: <http://example.org/> . ex:test ex:prop "modified" .');

      // Scan for drift
      const driftResults = await detector.scanForDrift(srcDir);
      
      expect(driftResults.drifted.length).toBeGreaterThan(0);
      expect(driftResults.clean.length).toBeGreaterThan(0);
      
      // Verify specific files are detected as drifted
      const driftedPaths = driftResults.drifted.map(r => r.filePath);
      expect(driftedPaths).toContain(join(srcDir, 'index.js'));
      expect(driftedPaths).toContain(join(srcDir, 'data.ttl'));
    });
  });

  describe('Performance Optimization', () => {
    test('should demonstrate CAS cache efficiency', async () => {
      const testFiles = [];
      
      // Create multiple test files
      for (let i = 0; i < 20; i++) {
        const filepath = join(testDir, `perf-test-${i}.js`);
        const content = `const value${i} = ${i * 10};`;
        await fs.writeFile(filepath, content);
        testFiles.push(filepath);
      }

      // First pass - populate cache
      const startTime = this.getDeterministicTimestamp();
      for (const filepath of testFiles) {
        await detector.createBaseline(filepath);
      }
      const firstPassTime = this.getDeterministicTimestamp() - startTime;

      // Second pass - should hit cache
      const secondStartTime = this.getDeterministicTimestamp();
      for (const filepath of testFiles) {
        await detector.scanForDrift(filepath);
      }
      const secondPassTime = this.getDeterministicTimestamp() - secondStartTime;

      // Verify performance improvement
      expect(secondPassTime).toBeLessThan(firstPassTime * 0.8); // 20% improvement

      // Check cache metrics
      const metrics = detector.getMetrics();
      expect(metrics.cacheEfficiency).toBeGreaterThan(0.5); // At least 50% cache efficiency
    });
  });
});