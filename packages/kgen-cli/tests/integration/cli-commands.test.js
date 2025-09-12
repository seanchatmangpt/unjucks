/**
 * CLI Integration Tests
 * Tests CLI commands, workflows, and user interactions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '../../bin/kgen.js');

// Helper to run CLI commands
function runCLI(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on('error', (error) => {
      reject(error);
    });

    // Handle stdin if provided
    if (options.stdin) {
      child.stdin.write(options.stdin);
      child.stdin.end();
    }
  });
}

describe('CLI Integration Tests', () => {
  let testDir;
  let fixturesDir;

  beforeEach(() => {
    testDir = testUtils.createTempDir();
    fixturesDir = resolve(__dirname, '../fixtures');
    
    // Ensure fixtures directory exists
    if (!existsSync(fixturesDir)) {
      mkdirSync(fixturesDir, { recursive: true });
    }
  });

  afterEach(() => {
    testUtils.cleanupTempDir(testDir);
  });

  describe('kgen --help', () => {
    it('should display help information', async () => {
      const { code, stdout } = await runCLI(['--help']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Usage:');
      expect(stdout).toContain('kgen');
      expect(stdout).toContain('Commands:');
      expect(stdout).toContain('generate');
      expect(stdout).toContain('validate');
      expect(stdout).toContain('init');
    });
  });

  describe('kgen --version', () => {
    it('should display version information', async () => {
      const { code, stdout } = await runCLI(['--version']);
      
      expect(code).toBe(0);
      expect(stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('kgen init', () => {
    it('should initialize a new kgen project', async () => {
      const { code, stdout, stderr } = await runCLI(['init', 'test-project'], {
        cwd: testDir
      });
      
      expect(code).toBe(0);
      expect(stdout).toContain('Initializing kgen project');
      
      // Check created files
      const projectDir = resolve(testDir, 'test-project');
      expect(existsSync(resolve(projectDir, 'kgen.config.js'))).toBe(true);
      expect(existsSync(resolve(projectDir, 'templates'))).toBe(true);
      expect(existsSync(resolve(projectDir, 'graphs'))).toBe(true);
    });

    it('should handle existing directory', async () => {
      // Create directory first
      const projectDir = resolve(testDir, 'existing-project');
      mkdirSync(projectDir, { recursive: true });
      
      const { code, stderr } = await runCLI(['init', 'existing-project'], {
        cwd: testDir
      });
      
      expect(code).toBe(1);
      expect(stderr).toContain('Directory already exists');
    });

    it('should support --force flag', async () => {
      const projectDir = resolve(testDir, 'force-project');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(resolve(projectDir, 'existing.txt'), 'existing content');
      
      const { code, stdout } = await runCLI(['init', 'force-project', '--force'], {
        cwd: testDir
      });
      
      expect(code).toBe(0);
      expect(stdout).toContain('Initializing kgen project');
      expect(existsSync(resolve(projectDir, 'kgen.config.js'))).toBe(true);
    });
  });

  describe('kgen validate', () => {
    let graphFile;
    let templateFile;
    
    beforeEach(() => {
      graphFile = resolve(testDir, 'test-graph.ttl');
      templateFile = resolve(testDir, 'test-template.json');
      
      // Create test files
      writeFileSync(graphFile, `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:person1 a foaf:Person ;
          foaf:name "Test Person" ;
          foaf:email "test@example.com" .
      `);
      
      writeFileSync(templateFile, JSON.stringify({
        name: 'test-template',
        sparqlQuery: 'SELECT ?person ?name WHERE { ?person foaf:name ?name }',
        outputTemplate: {
          template: 'export const people = {{json results}};'
        }
      }, null, 2));
    });

    it('should validate RDF graph syntax', async () => {
      const { code, stdout } = await runCLI(['validate', 'graph', graphFile]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('✓ Graph validation passed');
      expect(stdout).toContain('Found 3 triples');
    });

    it('should validate template structure', async () => {
      const { code, stdout } = await runCLI(['validate', 'template', templateFile]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('✓ Template validation passed');
      expect(stdout).toContain('SPARQL query: valid');
      expect(stdout).toContain('Output template: valid');
    });

    it('should detect invalid RDF syntax', async () => {
      const invalidGraphFile = resolve(testDir, 'invalid-graph.ttl');
      writeFileSync(invalidGraphFile, '@prefix ex: <http://example.org/> . ex:subject ex:predicate');
      
      const { code, stderr } = await runCLI(['validate', 'graph', invalidGraphFile]);
      
      expect(code).toBe(1);
      expect(stderr).toContain('✗ Graph validation failed');
      expect(stderr).toContain('Syntax error');
    });

    it('should detect invalid SPARQL queries', async () => {
      const invalidTemplateFile = resolve(testDir, 'invalid-template.json');
      writeFileSync(invalidTemplateFile, JSON.stringify({
        name: 'invalid-template',
        sparqlQuery: 'INVALID SPARQL QUERY',
        outputTemplate: { template: 'test' }
      }));
      
      const { code, stderr } = await runCLI(['validate', 'template', invalidTemplateFile]);
      
      expect(code).toBe(1);
      expect(stderr).toContain('✗ Template validation failed');
      expect(stderr).toContain('Invalid SPARQL query');
    });
  });

  describe('kgen generate', () => {
    let configFile;
    let graphFile;
    let templateFile;
    
    beforeEach(() => {
      configFile = resolve(testDir, 'kgen.config.js');
      graphFile = resolve(testDir, 'person.ttl');
      templateFile = resolve(testDir, 'person-template.json');
      
      // Create config file
      writeFileSync(configFile, `
        export default {
          graphs: ['${graphFile}'],
          templates: ['${templateFile}'],
          outputDir: '${resolve(testDir, 'output')}'
        };
      `);
      
      // Create test graph
      writeFileSync(graphFile, `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix schema: <http://schema.org/> .
        
        ex:person1 a foaf:Person ;
          foaf:name "John Doe" ;
          foaf:email "john@example.com" ;
          schema:jobTitle "Engineer" .
          
        ex:person2 a foaf:Person ;
          foaf:name "Jane Smith" ;
          foaf:email "jane@example.com" ;
          schema:jobTitle "Designer" .
      `);
      
      // Create test template
      writeFileSync(templateFile, JSON.stringify({
        name: 'person-generator',
        sparqlQuery: `
          PREFIX foaf: <http://xmlns.com/foaf/0.1/>
          PREFIX schema: <http://schema.org/>
          SELECT ?person ?name ?email ?jobTitle WHERE {
            ?person a foaf:Person ;
                    foaf:name ?name ;
                    foaf:email ?email .
            OPTIONAL { ?person schema:jobTitle ?jobTitle }
          }
        `,
        outputTemplate: {
          template: `export interface Person {
  id: string;
  name: string;
  email: string;
  jobTitle?: string;
}

export const people: Person[] = [
{{#each results}}
  {
    id: '{{person}}',
    name: '{{name}}',
    email: '{{email}}'{{#if jobTitle}},
    jobTitle: '{{jobTitle}}'{{/if}}
  }{{#unless @last}},{{/unless}}
{{/each}}
];
`
        },
        outputPath: 'generated/people.ts'
      }, null, 2));
    });

    it('should generate code from graph and template', async () => {
      const { code, stdout } = await runCLI(['generate'], {
        cwd: testDir
      });
      
      expect(code).toBe(0);
      expect(stdout).toContain('✓ Generation completed successfully');
      
      // Check generated file
      const outputFile = resolve(testDir, 'output', 'generated', 'people.ts');
      expect(existsSync(outputFile)).toBe(true);
      
      const generatedContent = readFileSync(outputFile, 'utf-8');
      expect(generatedContent).toContain('export interface Person');
      expect(generatedContent).toContain('John Doe');
      expect(generatedContent).toContain('Jane Smith');
      expect(generatedContent).toContain('Engineer');
      expect(generatedContent).toContain('Designer');
    });

    it('should support --dry-run flag', async () => {
      const { code, stdout } = await runCLI(['generate', '--dry-run'], {
        cwd: testDir
      });
      
      expect(code).toBe(0);
      expect(stdout).toContain('🔍 Dry run mode');
      expect(stdout).toContain('Would generate: generated/people.ts');
      
      // No files should be created
      const outputFile = resolve(testDir, 'output', 'generated', 'people.ts');
      expect(existsSync(outputFile)).toBe(false);
    });

    it('should support --watch flag', async () => {
      // Start watch mode (this test needs to be time-limited)
      const watchPromise = runCLI(['generate', '--watch'], {
        cwd: testDir,
        env: { KGEN_WATCH_TIMEOUT: '2000' } // 2-second timeout for testing
      });
      
      // Wait a moment then modify the graph
      setTimeout(() => {
        const modifiedGraph = graphFile.replace('John Doe', 'John Modified');
        writeFileSync(graphFile, modifiedGraph);
      }, 500);
      
      const { code, stdout } = await watchPromise;
      
      // Watch mode should detect changes and regenerate
      expect(stdout).toContain('👁️  Watching for changes');
      expect(stdout).toContain('📝 File changed: person.ttl');
    }, 5000);

    it('should handle generation errors gracefully', async () => {
      // Create invalid template
      writeFileSync(templateFile, JSON.stringify({
        name: 'invalid-template',
        sparqlQuery: 'INVALID QUERY',
        outputTemplate: { template: 'test' }
      }));
      
      const { code, stderr } = await runCLI(['generate'], {
        cwd: testDir
      });
      
      expect(code).toBe(1);
      expect(stderr).toContain('✗ Generation failed');
      expect(stderr).toContain('SPARQL query error');
    });

    it('should generate attestation files when requested', async () => {
      const { code, stdout } = await runCLI(['generate', '--attest'], {
        cwd: testDir
      });
      
      expect(code).toBe(0);
      expect(stdout).toContain('✓ Generation completed successfully');
      expect(stdout).toContain('📋 Attestation generated');
      
      // Check attestation file
      const attestationPattern = /kgen-attestation-.*\.json/;
      expect(stdout).toMatch(attestationPattern);
    });
  });

  describe('kgen diff', () => {
    let graph1, graph2;
    
    beforeEach(() => {
      graph1 = resolve(testDir, 'graph1.ttl');
      graph2 = resolve(testDir, 'graph2.ttl');
      
      writeFileSync(graph1, `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:person1 foaf:name "John Doe" ;
                   foaf:email "john@example.com" .
      `);
      
      writeFileSync(graph2, `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:person1 foaf:name "Jane Doe" ;
                   foaf:email "jane@example.com" ;
                   foaf:phone "123-456-7890" .
      `);
    });

    it('should show differences between graphs', async () => {
      const { code, stdout } = await runCLI(['diff', graph1, graph2]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('📊 Graph diff analysis');
      expect(stdout).toContain('Added: 1 triple');
      expect(stdout).toContain('Removed: 2 triples');
      expect(stdout).toContain('Modified: 0 triples');
      expect(stdout).toContain('foaf:phone');
    });

    it('should handle identical graphs', async () => {
      const { code, stdout } = await runCLI(['diff', graph1, graph1]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('✅ Graphs are identical');
    });

    it('should support different output formats', async () => {
      const { code, stdout } = await runCLI(['diff', graph1, graph2, '--format', 'json']);
      
      expect(code).toBe(0);
      
      const diffResult = JSON.parse(stdout);
      expect(diffResult.statistics).toBeDefined();
      expect(diffResult.added).toBeDefined();
      expect(diffResult.removed).toBeDefined();
      expect(diffResult.statistics.addedCount).toBe(1);
    });
  });

  describe('kgen cache', () => {
    it('should show cache status', async () => {
      const { code, stdout } = await runCLI(['cache', 'status']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('💾 Cache status');
      expect(stdout).toContain('Cache directory:');
      expect(stdout).toContain('Total size:');
      expect(stdout).toContain('Entries:');
    });

    it('should clear cache', async () => {
      const { code, stdout } = await runCLI(['cache', 'clear']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('🗑️  Cache cleared successfully');
    });

    it('should support cache warming', async () => {
      // Create a project first
      const configFile = resolve(testDir, 'kgen.config.js');
      writeFileSync(configFile, `export default { graphs: ['*.ttl'] };`);
      
      const { code, stdout } = await runCLI(['cache', 'warm'], {
        cwd: testDir
      });
      
      expect(code).toBe(0);
      expect(stdout).toContain('🔥 Cache warming completed');
    });
  });

  describe('kgen config', () => {
    it('should show current configuration', async () => {
      const configFile = resolve(testDir, 'kgen.config.js');
      writeFileSync(configFile, `
        export default {
          outputDir: './output',
          enableCache: true,
          templates: ['./templates/*.json']
        };
      `);
      
      const { code, stdout } = await runCLI(['config', 'show'], {
        cwd: testDir
      });
      
      expect(code).toBe(0);
      expect(stdout).toContain('📋 Current configuration');
      expect(stdout).toContain('outputDir: ./output');
      expect(stdout).toContain('enableCache: true');
    });

    it('should validate configuration', async () => {
      const configFile = resolve(testDir, 'kgen.config.js');
      writeFileSync(configFile, `
        export default {
          outputDir: '/nonexistent/path',
          invalidOption: 'test'
        };
      `);
      
      const { code, stderr } = await runCLI(['config', 'validate'], {
        cwd: testDir
      });
      
      expect(code).toBe(1);
      expect(stderr).toContain('❌ Configuration validation failed');
      expect(stderr).toContain('Unknown option: invalidOption');
    });
  });

  describe('error handling', () => {
    it('should handle missing config file', async () => {
      const { code, stderr } = await runCLI(['generate'], {
        cwd: testDir
      });
      
      expect(code).toBe(1);
      expect(stderr).toContain('Configuration file not found');
      expect(stderr).toContain('kgen init');
    });

    it('should handle invalid commands', async () => {
      const { code, stderr } = await runCLI(['invalid-command']);
      
      expect(code).toBe(1);
      expect(stderr).toContain('Unknown command');
      expect(stderr).toContain('invalid-command');
    });

    it('should provide helpful error messages', async () => {
      const { code, stderr } = await runCLI(['validate']);
      
      expect(code).toBe(1);
      expect(stderr).toContain('Missing required argument');
      expect(stderr).toContain('Usage:');
    });
  });

  describe('output formatting', () => {
    it('should support quiet mode', async () => {
      const { code, stdout } = await runCLI(['--version', '--quiet']);
      
      expect(code).toBe(0);
      // Should only contain version number, no decorative text
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should support verbose mode', async () => {
      const { code, stdout } = await runCLI(['--help', '--verbose']);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Debug:');
      expect(stdout).toContain('CLI path:');
      expect(stdout).toContain('Node version:');
    });

    it('should support JSON output format', async () => {
      const { code, stdout } = await runCLI(['--version', '--format', 'json']);
      
      expect(code).toBe(0);
      
      const versionInfo = JSON.parse(stdout);
      expect(versionInfo.version).toMatch(/\d+\.\d+\.\d+/);
      expect(versionInfo.node).toBeDefined();
      expect(versionInfo.platform).toBeDefined();
    });
  });

  describe('signal handling', () => {
    it('should handle SIGINT gracefully', async () => {
      // This test simulates Ctrl+C during a long-running operation
      const child = spawn('node', [CLI_PATH, 'generate', '--watch'], {
        cwd: testDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Send SIGINT after a short delay
      setTimeout(() => {
        child.kill('SIGINT');
      }, 1000);

      return new Promise((resolve) => {
        child.on('close', (code, signal) => {
          expect(signal).toBe('SIGINT');
          expect(stdout).toContain('🛑 Operation cancelled');
          resolve();
        });
      });
    }, 3000);
  });
});
