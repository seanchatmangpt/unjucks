/**
 * KGEN CLI End-to-End Tests
 * Comprehensive testing of command-line interface functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import fs from 'fs-extra';
import { createSampleRDFFile, createSampleTemplate } from '../setup/cli-setup.js';

describe('KGEN CLI Commands E2E', () => {
  let testProjectDir;

  beforeEach(async () => {
    testProjectDir = await global.cliTestUtils.createTestProject('test-cli-project');
    process.chdir(testProjectDir);
  });

  afterEach(async () => {
    process.chdir(global.cliTestUtils.originalCwd);
    await global.cliTestUtils.cleanupTestProject('test-cli-project');
  });

  describe('Version and Help Commands', () => {
    it('should display version information', async () => {
      const result = await global.cliTestUtils.execKGen(['--version']);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/); // Version format
      expect(result.exitCode).toBe(0);
    });

    it('should display help information', async () => {
      const result = await global.cliTestUtils.execKGen(['--help']);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('Commands:');
      expect(result.stdout).toContain('Options:');
      expect(result.exitCode).toBe(0);
    });

    it('should show command-specific help', async () => {
      const result = await global.cliTestUtils.execKGen(['ingest', '--help']);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('ingest');
      expect(result.stdout).toContain('description');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Project Initialization', () => {
    it('should initialize a new KGEN project', async () => {
      const newProjectDir = resolve(global.cliTestUtils.workspaceDir, 'new-project');
      await fs.ensureDir(newProjectDir);
      process.chdir(newProjectDir);

      const result = await global.cliTestUtils.execKGen(['init', '--name', 'test-project']);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('initialized');
      
      // Verify created files
      expect(await fs.pathExists('.kgen.config.js')).toBe(true);
      expect(await fs.pathExists('package.json')).toBe(true);
      expect(await fs.pathExists('src')).toBe(true);
      expect(await fs.pathExists('data')).toBe(true);
      expect(await fs.pathExists('templates')).toBe(true);
      expect(await fs.pathExists('output')).toBe(true);
      
      // Verify config content
      const config = await fs.readJson('.kgen.config.js');
      expect(config.mode).toBeDefined();
      expect(config.input).toBeDefined();
      expect(config.output).toBeDefined();
    });

    it('should handle existing project gracefully', async () => {
      // First initialization
      await global.cliTestUtils.execKGen(['init', '--name', 'existing-project']);
      
      // Second initialization should warn but not fail
      const result = await global.cliTestUtils.execKGen(['init', '--name', 'existing-project']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('already exists');
    });

    it('should support custom templates during init', async () => {
      const result = await global.cliTestUtils.execKGen([
        'init', 
        '--name', 'custom-project',
        '--template', 'typescript'
      ]);
      
      expect(result.success).toBe(true);
      
      // Should create TypeScript-specific files
      expect(await fs.pathExists('tsconfig.json')).toBe(true);
      expect(await fs.pathExists('src/index.ts')).toBe(true);
    });
  });

  describe('Data Ingestion', () => {
    beforeEach(async () => {
      await createSampleRDFFile('persons.ttl', 'Person', 'John Doe');
      await createSampleRDFFile('organizations.ttl', 'Organization', 'ACME Corp');
    });

    it('should ingest RDF data from files', async () => {
      const result = await global.cliTestUtils.execKGen([
        'ingest',
        '--input', 'data/*.ttl',
        '--format', 'turtle',
        '--output', 'output/knowledge-graph.json'
      ]);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('ingested');
      
      // Verify output file exists
      const outputExists = await global.cliTestUtils.waitForFile('output/knowledge-graph.json');
      expect(outputExists).toBe(true);
      
      // Verify output content
      const outputContent = await fs.readJson('output/knowledge-graph.json');
      expect(outputContent.entities).toBeDefined();
      expect(outputContent.entities.length).toBeGreaterThan(0);
      expect(outputContent.triples).toBeDefined();
    });

    it('should handle multiple input formats', async () => {
      // Create additional RDF file in different format
      const rdfXmlContent = `
        <?xml version="1.0"?>
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
                 xmlns:ex="http://example.org/">
          <ex:Person rdf:about="http://example.org/jane">
            <ex:hasName>Jane Smith</ex:hasName>
            <ex:hasAge rdf:datatype="http://www.w3.org/2001/XMLSchema#integer">28</ex:hasAge>
          </ex:Person>
        </rdf:RDF>
      `;
      
      await fs.writeFile('data/persons.rdf', rdfXmlContent);

      const result = await global.cliTestUtils.execKGen([
        'ingest',
        '--input', 'data/*.ttl,data/*.rdf',
        '--output', 'output/mixed-format.json'
      ]);
      
      expect(result.success).toBe(true);
      
      const outputContent = await fs.readJson('output/mixed-format.json');
      expect(outputContent.entities.length).toBeGreaterThanOrEqual(3); // At least 3 entities
    });

    it('should validate ingested data', async () => {
      // Create SHACL shapes for validation
      const shapesContent = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        
        ex:PersonShape a sh:NodeShape ;
          sh:targetClass ex:Person ;
          sh:property [
            sh:path ex:hasName ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
          ] .
      `;
      
      await fs.writeFile('data/shapes.ttl', shapesContent);

      const result = await global.cliTestUtils.execKGen([
        'ingest',
        '--input', 'data/persons.ttl',
        '--validate', 'data/shapes.ttl',
        '--output', 'output/validated.json'
      ]);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('validation');
      
      const outputContent = await fs.readJson('output/validated.json');
      expect(outputContent.validation).toBeDefined();
      expect(outputContent.validation.isValid).toBe(true);
    });

    it('should handle ingestion errors gracefully', async () => {
      // Create malformed RDF file
      await fs.writeFile('data/malformed.ttl', 'This is not valid Turtle syntax !!!');

      const result = await global.cliTestUtils.execKGen([
        'ingest',
        '--input', 'data/malformed.ttl',
        '--output', 'output/error-test.json'
      ]);
      
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('error');
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('Code Generation', () => {
    let knowledgeGraphFile;

    beforeEach(async () => {
      // Create knowledge graph data
      await createSampleRDFFile('entities.ttl', 'Person', 'Developer');
      
      // Ingest data first
      await global.cliTestUtils.execKGen([
        'ingest',
        '--input', 'data/entities.ttl',
        '--output', 'knowledge-graph.json'
      ]);
      
      knowledgeGraphFile = 'knowledge-graph.json';
    });

    it('should generate code from templates', async () => {
      // Create a simple template
      const templateContent = `
        // Generated {{ entity.type }} class
        class {{ entity.name | capitalize | replace(' ', '') }} {
          constructor() {
            {% for property, value in entity.properties %}
            this.{{ property }} = {{ value | jsonEncode }};
            {% endfor %}
          }
          
          getName() {
            return this.name;
          }
        }
        
        module.exports = {{ entity.name | capitalize | replace(' ', '') }};
      `;
      
      await createSampleTemplate('person.js.njk', templateContent);

      const result = await global.cliTestUtils.execKGen([
        'generate',
        '--input', knowledgeGraphFile,
        '--template', 'templates/person.js.njk',
        '--output', 'output/generated'
      ]);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('generated');
      
      // Verify generated files
      const outputDir = 'output/generated';
      expect(await fs.pathExists(outputDir)).toBe(true);
      
      const generatedFiles = await fs.readdir(outputDir);
      expect(generatedFiles.length).toBeGreaterThan(0);
      
      // Verify generated content
      const firstFile = generatedFiles[0];
      const generatedContent = await fs.readFile(resolve(outputDir, firstFile), 'utf8');
      expect(generatedContent).toContain('class');
      expect(generatedContent).toContain('getName()');
    });

    it('should support multiple output formats', async () => {
      // Create templates for different formats
      const jsTemplate = 'class {{ entity.name | capitalize }} {}';
      const pyTemplate = 'class {{ entity.name | capitalize }}:\n    pass';
      const tsTemplate = 'interface I{{ entity.name | capitalize }} {}';
      
      await createSampleTemplate('entity.js.njk', jsTemplate);
      await createSampleTemplate('entity.py.njk', pyTemplate);
      await createSampleTemplate('entity.ts.njk', tsTemplate);

      const result = await global.cliTestUtils.execKGen([
        'generate',
        '--input', knowledgeGraphFile,
        '--template', 'templates/*.njk',
        '--output', 'output/multi-format'
      ]);
      
      expect(result.success).toBe(true);
      
      // Verify all formats were generated
      const outputDir = 'output/multi-format';
      const generatedFiles = await fs.readdir(outputDir);
      
      const hasJs = generatedFiles.some(f => f.endsWith('.js'));
      const hasPy = generatedFiles.some(f => f.endsWith('.py'));
      const hasTs = generatedFiles.some(f => f.endsWith('.ts'));
      
      expect(hasJs).toBe(true);
      expect(hasPy).toBe(true);
      expect(hasTs).toBe(true);
    });

    it('should handle template errors gracefully', async () => {
      // Create template with syntax error
      const badTemplate = 'class {{ entity.invalidProperty.nonexistent }}';
      await createSampleTemplate('bad.js.njk', badTemplate);

      const result = await global.cliTestUtils.execKGen([
        'generate',
        '--input', knowledgeGraphFile,
        '--template', 'templates/bad.js.njk',
        '--output', 'output/error-test'
      ]);
      
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('error');
    });
  });

  describe('Query Execution', () => {
    beforeEach(async () => {
      // Setup test data
      await createSampleRDFFile('query-data.ttl', 'Person', 'Query Test User');
      
      await global.cliTestUtils.execKGen([
        'ingest',
        '--input', 'data/query-data.ttl',
        '--output', 'knowledge-graph.json'
      ]);
    });

    it('should execute SPARQL queries', async () => {
      const query = `
        PREFIX ex: <http://example.org/>
        SELECT ?person ?name WHERE {
          ?person a ex:Person .
          ?person ex:hasName ?name .
        }
      `;
      
      await fs.writeFile('query.sparql', query);

      const result = await global.cliTestUtils.execKGen([
        'query',
        '--input', 'knowledge-graph.json',
        '--query', 'query.sparql',
        '--output', 'output/query-results.json'
      ]);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('query');
      
      const resultsExist = await global.cliTestUtils.waitForFile('output/query-results.json');
      expect(resultsExist).toBe(true);
      
      const queryResults = await fs.readJson('output/query-results.json');
      expect(queryResults.bindings).toBeDefined();
      expect(queryResults.bindings.length).toBeGreaterThan(0);
    });

    it('should support inline queries', async () => {
      const result = await global.cliTestUtils.execKGen([
        'query',
        '--input', 'knowledge-graph.json',
        '--sparql', 'SELECT * WHERE { ?s ?p ?o } LIMIT 5',
        '--format', 'table'
      ]);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('|'); // Table format
    });

    it('should handle query errors gracefully', async () => {
      const invalidQuery = 'INVALID SPARQL SYNTAX !!!';
      await fs.writeFile('invalid.sparql', invalidQuery);

      const result = await global.cliTestUtils.execKGen([
        'query',
        '--input', 'knowledge-graph.json',
        '--query', 'invalid.sparql'
      ]);
      
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('error');
    });
  });

  describe('Reasoning Operations', () => {
    beforeEach(async () => {
      // Create data with relationships
      const rdfContent = `
        @prefix ex: <http://example.org/> .
        
        ex:john a ex:Person ;
          ex:hasName "John Doe" ;
          ex:worksFor ex:acme .
          
        ex:jane a ex:Person ;
          ex:hasName "Jane Smith" ;
          ex:worksFor ex:acme .
          
        ex:acme a ex:Organization ;
          ex:hasName "ACME Corp" .
      `;
      
      await fs.writeFile('data/reasoning-data.ttl', rdfContent);
      
      await global.cliTestUtils.execKGen([
        'ingest',
        '--input', 'data/reasoning-data.ttl',
        '--output', 'knowledge-graph.json'
      ]);
    });

    it('should apply reasoning rules', async () => {
      // Create reasoning rules
      const rules = `
        @prefix ex: <http://example.org/> .
        
        # Rule: If person works for organization, person is an employee
        { ?person ex:worksFor ?org } => { ?person a ex:Employee } .
        
        # Rule: All employees are workers
        { ?person a ex:Employee } => { ?person a ex:Worker } .
      `;
      
      await fs.writeFile('rules.n3', rules);

      const result = await global.cliTestUtils.execKGen([
        'reason',
        '--input', 'knowledge-graph.json',
        '--rules', 'rules.n3',
        '--output', 'output/reasoned-graph.json'
      ]);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('reasoning');
      
      const reasonedGraph = await fs.readJson('output/reasoned-graph.json');
      expect(reasonedGraph.inferredTriples).toBeDefined();
      expect(reasonedGraph.inferredTriples.length).toBeGreaterThan(0);
    });

    it('should validate reasoning results', async () => {
      const rules = `{ ?person ex:worksFor ?org } => { ?person a ex:Employee } .`;
      await fs.writeFile('simple-rules.n3', rules);

      const result = await global.cliTestUtils.execKGen([
        'reason',
        '--input', 'knowledge-graph.json',
        '--rules', 'simple-rules.n3',
        '--validate',
        '--output', 'output/validated-reasoning.json'
      ]);
      
      expect(result.success).toBe(true);
      
      const reasonedGraph = await fs.readJson('output/validated-reasoning.json');
      expect(reasonedGraph.validation).toBeDefined();
      expect(reasonedGraph.validation.consistencyCheck).toBeDefined();
    });
  });

  describe('Configuration Management', () => {
    it('should show current configuration', async () => {
      const result = await global.cliTestUtils.execKGen(['config', '--show']);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Configuration');
    });

    it('should validate configuration', async () => {
      const result = await global.cliTestUtils.execKGen(['config', '--validate']);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('valid');
    });

    it('should handle missing configuration gracefully', async () => {
      // Remove config file
      await fs.remove('.kgen.config.js');

      const result = await global.cliTestUtils.execKGen(['config', '--show']);
      
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('configuration');
    });
  });

  describe('Batch Operations', () => {
    it('should execute multiple operations in sequence', async () => {
      // Create batch configuration
      const batchConfig = {
        operations: [
          {
            command: 'ingest',
            args: ['--input', 'data/*.ttl', '--output', 'temp-graph.json']
          },
          {
            command: 'generate',
            args: ['--input', 'temp-graph.json', '--template', 'templates/*.njk', '--output', 'output/batch-generated']
          }
        ]
      };
      
      await fs.writeJson('batch.json', batchConfig, { spaces: 2 });
      await createSampleRDFFile('batch-data.ttl', 'Person', 'Batch User');
      await createSampleTemplate('batch.js.njk', 'class {{ entity.name | capitalize }} {}');

      const result = await global.cliTestUtils.execKGen(['batch', '--config', 'batch.json']);
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('batch');
      
      // Verify all operations completed
      expect(await fs.pathExists('temp-graph.json')).toBe(true);
      expect(await fs.pathExists('output/batch-generated')).toBe(true);
    });

    it('should handle batch operation failures', async () => {
      const batchConfig = {
        operations: [
          {
            command: 'ingest',
            args: ['--input', 'nonexistent.ttl', '--output', 'temp.json']
          }
        ]
      };
      
      await fs.writeJson('failing-batch.json', batchConfig, { spaces: 2 });

      const result = await global.cliTestUtils.execKGen(['batch', '--config', 'failing-batch.json']);
      
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('error');
    });
  });

  describe('Watch Mode', () => {
    it('should watch for file changes and regenerate', async () => {
      await createSampleRDFFile('watch-data.ttl', 'Person', 'Watch User');
      await createSampleTemplate('watch.js.njk', 'class {{ entity.name | capitalize }} {}');

      // Start watch mode (this will run in background)
      const watchProcess = global.cliTestUtils.spawnKGen([
        'watch',
        '--input', 'data/*.ttl',
        '--template', 'templates/*.njk',
        '--output', 'output/watch-generated'
      ]);

      // Wait for initial generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify initial generation
      expect(await fs.pathExists('output/watch-generated')).toBe(true);
      
      // Modify input file
      await createSampleRDFFile('watch-data.ttl', 'Person', 'Modified Watch User');
      
      // Wait for regeneration
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify regeneration occurred
      const generatedFiles = await fs.readdir('output/watch-generated');
      expect(generatedFiles.length).toBeGreaterThan(0);
      
      // Cleanup
      watchProcess.kill('SIGTERM');
      
      // Wait for process to terminate
      await new Promise(resolve => {
        watchProcess.on('close', resolve);
        setTimeout(resolve, 1000); // Fallback timeout
      });
    }, 10000); // Longer timeout for watch operations
  });

  describe('Error Handling and Recovery', () => {
    it('should provide helpful error messages', async () => {
      const result = await global.cliTestUtils.execKGen(['nonexistent-command']);
      
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('unknown command');
      expect(result.stderr).toContain('help');
    });

    it('should handle insufficient permissions gracefully', async () => {
      // Try to write to read-only location (simulate permission error)
      const result = await global.cliTestUtils.execKGen([
        'ingest',
        '--input', 'data/*.ttl',
        '--output', '/root/forbidden.json'
      ]);
      
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('permission');
    });

    it('should recover from partial failures', async () => {
      // Create mix of valid and invalid input files
      await createSampleRDFFile('valid.ttl', 'Person', 'Valid User');
      await fs.writeFile('data/invalid.ttl', 'INVALID RDF CONTENT');

      const result = await global.cliTestUtils.execKGen([
        'ingest',
        '--input', 'data/*.ttl',
        '--continue-on-error',
        '--output', 'output/partial-success.json'
      ]);
      
      expect(result.exitCode).not.toBe(0); // Should indicate partial failure
      expect(result.stderr).toContain('error');
      expect(result.stdout).toContain('partial');
      
      // Should still produce output for valid files
      expect(await fs.pathExists('output/partial-success.json')).toBe(true);
    });
  });
});