/**
 * Tests for Drift Detection System
 * 
 * Validates:
 * - Baseline comparison using lock files
 * - Semantic-aware drift detection
 * - Impact analysis and recommendations
 * - Severity calculation and categorization
 * - RDF/Turtle-specific analysis
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DriftDetector, detectDrift, SEVERITY, DRIFT_TYPES } from '../../src/config/drift-detector.js';
import { LockManager } from '../../src/config/lock-manager.js';
import { ConfigLoader } from '../../src/config/config-loader.js';

// Mock dependencies
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, options, callback) => {
    if (cmd.includes('git rev-parse HEAD')) {
      callback(null, { stdout: 'abc123def456\n', stderr: '' });
    } else if (cmd.includes('git rev-parse --abbrev-ref HEAD')) {
      callback(null, { stdout: 'main\n', stderr: '' });
    } else if (cmd.includes('git status --porcelain')) {
      callback(null, { stdout: '', stderr: '' });
    } else {
      callback(new Error('Git command not found'));
    }
  })
}));

describe('DriftDetector', () => {
  let testDir;
  let detector;
  let lockManager;
  let configLoader;
  
  beforeEach(() => {
    testDir = join(tmpdir(), `kgen-drift-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    
    lockManager = new LockManager({ projectRoot: testDir });
    configLoader = new ConfigLoader({ cwd: testDir });
    detector = new DriftDetector({
      projectRoot: testDir,
      lockManager,
      configLoader
    });
    
    process.env.SOURCE_DATE_EPOCH = '1640995200';
  });
  
  afterEach(() => {
    delete process.env.SOURCE_DATE_EPOCH;
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Basic Drift Detection', () => {
    it('should return no-baseline when lock file missing', async () => {
      // Create config but no lock file
      writeFileSync(join(testDir, 'kgen.config.json'), JSON.stringify({
        directories: { out: './dist' }
      }));
      
      const result = await detector.detect();
      
      expect(result.status).toBe('no-baseline');
      expect(result.severity).toBe(SEVERITY.WARNING);
      expect(result.message).toContain('No lock file found');
      expect(result.recommendations).toContain('Generate initial lock file with: kgen lock generate');
    });

    it('should return clean when no drift detected', async () => {
      // Setup config and initial state
      writeFileSync(join(testDir, 'kgen.config.json'), JSON.stringify({
        directories: { out: './dist' }
      }));
      writeFileSync(join(testDir, 'data.ttl'), '@prefix ex: <http://example.org/> .');
      
      // Generate and save lock file
      const lockFile = await lockManager.generate();
      await lockManager.update(lockFile);
      
      const result = await detector.detect();
      
      expect(result.status).toBe('clean');
      expect(result.severity).toBe(SEVERITY.INFO);
      expect(result.message).toContain('No drift detected');
      expect(result.drift).toHaveLength(0);
    });

    it('should detect drift when files change', async () => {
      // Setup initial state
      writeFileSync(join(testDir, 'kgen.config.json'), JSON.stringify({
        directories: { out: './dist' }
      }));
      writeFileSync(join(testDir, 'data.ttl'), 'original content');
      
      const lockFile = await lockManager.generate();
      await lockManager.update(lockFile);
      
      // Modify file
      writeFileSync(join(testDir, 'data.ttl'), 'modified content');
      
      const result = await detector.detect();
      
      expect(result.status).toBe('drift');
      expect(result.severity).toBe(SEVERITY.WARNING);
      expect(result.message).toContain('Drift detected');
      expect(result.drift.length).toBeGreaterThan(0);
    });
  });

  describe('Change Analysis', () => {
    it('should analyze added file impact', async () => {
      const analysis = await detector.analyzeAddedFileImpact(
        'templates/new-template.njk',
        { directories: { out: './dist' } }
      );
      
      expect(analysis).toContain('New template available for generation');
    });

    it('should analyze removed file impact', async () => {
      const lockFile = {
        dependencies: {
          templates: {
            'main.njk': ['removed.njk'],
            'other.njk': []
          }
        }
      };
      
      const analysis = await detector.analyzeRemovedFileImpact(
        'removed.njk',
        lockFile
      );
      
      expect(analysis).toContain('1 dependent files may be affected');
      expect(analysis).toContain('Dependent files: main.njk');
    });

    it('should analyze template modifications', async () => {
      const change = {
        type: 'modified',
        file: 'templates/page.njk',
        oldHash: 'hash1',
        newHash: 'hash2'
      };
      
      const analysis = await detector.analyzeChange(change, {}, {});
      
      expect(analysis.type).toBe(DRIFT_TYPES.TEMPLATE_MODIFIED);
      expect(analysis.description).toContain('File modified: templates/page.njk');
      expect(analysis.impact).toContain('Template modification may change generated artifacts');
      expect(analysis.details.oldHash).toBe('hash1');
      expect(analysis.details.newHash).toBe('hash2');
    });

    it('should analyze rule modifications', async () => {
      const change = {
        type: 'modified',
        file: 'rules/validation.n3',
        oldHash: 'hash1',
        newHash: 'hash2'
      };
      
      const analysis = await detector.analyzeChange(change, {}, {});
      
      expect(analysis.type).toBe(DRIFT_TYPES.RULE_MODIFIED);
      expect(analysis.impact).toContain('Rule modification may affect reasoning and validation');
    });
  });

  describe('Drift Type Determination', () => {
    it('should identify template drift types', () => {
      expect(detector.determineChangeType({
        type: 'added',
        file: 'templates/new.njk'
      })).toBe(DRIFT_TYPES.TEMPLATE_ADDED);
      
      expect(detector.determineChangeType({
        type: 'removed',
        file: 'templates/old.njk'
      })).toBe(DRIFT_TYPES.TEMPLATE_REMOVED);
      
      expect(detector.determineChangeType({
        type: 'modified',
        file: 'templates/changed.njk'
      })).toBe(DRIFT_TYPES.TEMPLATE_MODIFIED);
    });

    it('should identify rule drift types', () => {
      expect(detector.determineChangeType({
        type: 'added',
        file: 'rules/new.n3'
      })).toBe(DRIFT_TYPES.RULE_ADDED);
      
      expect(detector.determineChangeType({
        type: 'removed',
        file: 'rules/old.n3'
      })).toBe(DRIFT_TYPES.RULE_REMOVED);
      
      expect(detector.determineChangeType({
        type: 'modified',
        file: 'validation.n3'
      })).toBe(DRIFT_TYPES.RULE_MODIFIED);
    });

    it('should identify config changes', () => {
      expect(detector.determineChangeType({
        type: 'integrity',
        category: 'config'
      })).toBe(DRIFT_TYPES.CONFIG_CHANGED);
    });
  });

  describe('Severity Calculation', () => {
    it('should calculate critical severity', () => {
      const drift = [
        { severity: SEVERITY.INFO },
        { severity: SEVERITY.CRITICAL },
        { severity: SEVERITY.WARNING }
      ];
      
      expect(detector.calculateSeverity(drift)).toBe(SEVERITY.CRITICAL);
    });

    it('should calculate error severity', () => {
      const drift = [
        { severity: SEVERITY.INFO },
        { severity: SEVERITY.ERROR },
        { severity: SEVERITY.WARNING }
      ];
      
      expect(detector.calculateSeverity(drift)).toBe(SEVERITY.ERROR);
    });

    it('should calculate warning severity', () => {
      const drift = [
        { severity: SEVERITY.INFO },
        { severity: SEVERITY.WARNING }
      ];
      
      expect(detector.calculateSeverity(drift)).toBe(SEVERITY.WARNING);
    });

    it('should default to info severity', () => {
      const drift = [{ severity: SEVERITY.INFO }];
      expect(detector.calculateSeverity(drift)).toBe(SEVERITY.INFO);
    });
  });

  describe('Semantic Analysis', () => {
    beforeEach(() => {
      detector = new DriftDetector({
        projectRoot: testDir,
        lockManager,
        configLoader,
        semanticAnalysis: true
      });
    });

    it('should analyze RDF file changes', async () => {
      writeFileSync(join(testDir, 'ontology.ttl'), `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix ex: <http://example.org/> .
        
        ex:Person a owl:Class .
        ex:hasName a owl:DatatypeProperty .
      `);
      
      const impact = await detector.analyzeSemanticChanges('ontology.ttl');
      
      expect(impact).toContain('Ontology structure changes detected');
    });

    it('should detect SHACL shape modifications', async () => {
      writeFileSync(join(testDir, 'shapes.ttl'), `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        
        ex:PersonShape a sh:NodeShape ;
          sh:targetClass ex:Person ;
          sh:property [
            sh:path ex:hasName ;
            sh:datatype xsd:string ;
            sh:minCount 1
          ] .
      `);
      
      const impact = await detector.analyzeSemanticChanges('shapes.ttl');
      
      expect(impact).toContain('SHACL validation rules modified');
    });

    it('should detect large RDF modifications', async () => {
      // Create file with many triples
      const largeContent = Array(150).fill(0).map((_, i) => 
        `ex:entity${i} ex:hasProperty "value${i}" .`
      ).join('\n');
      
      writeFileSync(join(testDir, 'large.ttl'), `
        @prefix ex: <http://example.org/> .
        ${largeContent}
      `);
      
      const impact = await detector.analyzeSemanticChanges('large.ttl');
      
      expect(impact).toContain('Large RDF modification may have significant semantic impact');
    });

    it('should perform ontology consistency checks', async () => {
      const rdfChanges = [
        { type: DRIFT_TYPES.RULE_REMOVED, file: 'rules/important.n3' },
        { type: DRIFT_TYPES.TEMPLATE_MODIFIED, file: 'ontology.ttl' }
      ];
      
      const analysis = await detector.performSemanticAnalysis(rdfChanges, {});
      
      expect(analysis.inconsistencies.length).toBeGreaterThan(0);
      expect(analysis.inconsistencies[0].type).toBe(DRIFT_TYPES.SEMANTIC_INCONSISTENCY);
    });
  });

  describe('Orphaned Artifacts Detection', () => {
    it('should detect orphaned artifacts', async () => {
      // Create output directory with artifacts
      const outputDir = join(testDir, 'dist');
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(join(outputDir, 'generated.js'), 'artifact content');
      writeFileSync(join(outputDir, 'styles.css'), 'css content');
      
      const lockFile = {
        templates: {} // No templates
      };
      
      const config = {
        directories: { out: './dist' }
      };
      
      const analysis = await detector.checkOrphanedArtifacts(lockFile, config);
      
      expect(analysis.orphaned.length).toBeGreaterThan(0);
      expect(analysis.orphaned[0].type).toBe(DRIFT_TYPES.ARTIFACT_ORPHANED);
      expect(analysis.orphaned[0].description).toContain('artifacts may be orphaned');
    });

    it('should ignore missing output directory', async () => {
      const lockFile = { templates: {} };
      const config = { directories: { out: './nonexistent' } };
      
      const analysis = await detector.checkOrphanedArtifacts(lockFile, config);
      
      expect(analysis.orphaned).toHaveLength(0);
    });
  });

  describe('Dependency Analysis', () => {
    it('should find dependent files', () => {
      const dependencies = {
        templates: {
          'main.njk': ['shared.njk', 'utils.njk'],
          'page.njk': ['shared.njk']
        },
        rules: {
          'validation.n3': ['base.n3']
        }
      };
      
      const dependents = detector.findDependents('shared.njk', dependencies);
      
      expect(dependents).toContain('main.njk');
      expect(dependents).toContain('page.njk');
      expect(dependents).not.toContain('validation.n3');
    });

    it('should return empty array when no dependents', () => {
      const dependencies = {
        templates: {
          'main.njk': ['other.njk']
        }
      };
      
      const dependents = detector.findDependents('isolated.njk', dependencies);
      
      expect(dependents).toHaveLength(0);
    });
  });

  describe('Report Generation', () => {
    it('should generate comprehensive drift report', () => {
      const driftResult = {
        status: 'drift',
        severity: SEVERITY.WARNING,
        message: 'Drift detected: 3 changes found',
        drift: [
          {
            type: DRIFT_TYPES.TEMPLATE_MODIFIED,
            severity: SEVERITY.WARNING,
            file: 'template.njk',
            description: 'Template modified'
          }
        ],
        recommendations: ['Update lock file'],
        baseline: '2022-01-01T00:00:00.000Z',
        lastCheck: '2022-01-02T00:00:00.000Z',
        summary: {
          total: 1,
          byType: { 'template-modified': 1 },
          bySeverity: { warning: 1 }
        }
      };
      
      const report = detector.generateReport(driftResult);
      
      expect(report.title).toBe('KGEN Drift Detection Report');
      expect(report.status).toBe('drift');
      expect(report.severity).toBe(SEVERITY.WARNING);
      expect(report.summary.totalChanges).toBe(1);
      expect(report.findings).toHaveLength(1);
      expect(report.recommendations).toContain('Update lock file');
      expect(report.breakdown).toBeDefined();
    });

    it('should include details in verbose report', () => {
      const driftResult = {
        status: 'drift',
        severity: SEVERITY.WARNING,
        message: 'Drift detected',
        drift: [],
        details: {
          'template-main': { analysis: 'detailed' }
        }
      };
      
      const report = detector.generateReport(driftResult, { verbose: true });
      
      expect(report.details).toBeDefined();
      expect(report.details['template-main'].analysis).toBe('detailed');
    });
  });

  describe('Integration with Lock Manager', () => {
    it('should use lock manager for baseline comparison', async () => {
      // Setup initial state
      writeFileSync(join(testDir, 'kgen.config.json'), JSON.stringify({
        directories: { out: './dist' }
      }));
      
      mkdirSync(join(testDir, 'templates'), { recursive: true });
      writeFileSync(join(testDir, 'templates', 'page.njk'), 'template content');
      
      // Generate baseline
      const lockFile = await lockManager.generate();
      await lockManager.update(lockFile);
      
      // Modify template
      writeFileSync(join(testDir, 'templates', 'page.njk'), 'modified template content');
      
      const result = await detector.detect();
      
      expect(result.status).toBe('drift');
      expect(result.drift).toContainEqual(
        expect.objectContaining({
          type: DRIFT_TYPES.TEMPLATE_MODIFIED,
          file: 'templates/page.njk'
        })
      );
    });
  });
});

describe('detectDrift convenience function', () => {
  let testDir;
  
  beforeEach(() => {
    testDir = join(tmpdir(), `kgen-drift-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    process.env.SOURCE_DATE_EPOCH = '1640995200';
  });
  
  afterEach(() => {
    delete process.env.SOURCE_DATE_EPOCH;
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should detect drift with custom options', async () => {
    writeFileSync(join(testDir, 'kgen.config.json'), JSON.stringify({
      directories: { out: './dist' }
    }));
    
    const result = await detectDrift({
      projectRoot: testDir,
      semanticAnalysis: false
    });
    
    expect(result.status).toBe('no-baseline');
    expect(result.severity).toBe(SEVERITY.WARNING);
  });
});

describe('Constants Export', () => {
  it('should export severity constants', () => {
    expect(SEVERITY.INFO).toBe('info');
    expect(SEVERITY.WARNING).toBe('warning');
    expect(SEVERITY.ERROR).toBe('error');
    expect(SEVERITY.CRITICAL).toBe('critical');
  });

  it('should export drift type constants', () => {
    expect(DRIFT_TYPES.TEMPLATE_ADDED).toBe('template-added');
    expect(DRIFT_TYPES.TEMPLATE_MODIFIED).toBe('template-modified');
    expect(DRIFT_TYPES.RULE_REMOVED).toBe('rule-removed');
    expect(DRIFT_TYPES.CONFIG_CHANGED).toBe('config-changed');
    expect(DRIFT_TYPES.SEMANTIC_INCONSISTENCY).toBe('semantic-inconsistency');
  });
});
