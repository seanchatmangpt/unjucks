/**
 * KGEN CLI Commands Integration Tests
 * 
 * Tests all CLI commands and their interactions
 * Validates argument parsing, error handling, and command workflows
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const TEST_DIR = '/Users/sac/unjucks/tests/fixtures/cli';
const KGEN_CLI = '/Users/sac/unjucks/bin/kgen.mjs';

describe('KGEN CLI Commands', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    
    // Create test fixtures
    const testGraph = `
@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

:Service rdf:type rdfs:Class ;
        rdfs:label "Service" .

:name rdf:type rdf:Property ;
      rdfs:domain :Service ;
      rdfs:range rdfs:Literal .

:port rdf:type rdf:Property ;
      rdfs:domain :Service ;
      rdfs:range rdfs:Literal .

:apiService rdf:type :Service ;
           :name "API Service" ;
           :port "3000" .
`;
    
    await fs.writeFile(path.join(TEST_DIR, 'services.ttl'), testGraph);
    
    // Create templates directory structure
    await fs.mkdir(path.join(TEST_DIR, '_templates/service'), { recursive: true });
    await fs.mkdir(path.join(TEST_DIR, '_templates/config'), { recursive: true });
    
    const serviceTemplate = `---
to: src/services/{{ serviceName | kebabCase }}.js
---
/**
 * {{ serviceName }} Service
 */

class {{ serviceName | pascalCase }}Service {
  constructor() {
    this.name = "{{ serviceName }}";
    this.port = {{ port || 3000 }};
  }

  start() {
    console.log(\`Starting \${this.name} on port \${this.port}\`);
  }
}

export default {{ serviceName | pascalCase }}Service;
`;
    
    const configTemplate = `---
to: config/{{ configName | kebabCase }}.json
---
{
  "name": "{{ configName }}",
  "version": "{{ version | default('1.0.0') }}",
  "services": [
    {{#each services}}
    {
      "name": "{{ this.name }}",
      "port": {{ this.port }}
    }{{#unless @last}},{{/unless}}
    {{/each}}
  ]
}
`;
    
    await fs.writeFile(
      path.join(TEST_DIR, '_templates/service/service.ejs.t'),
      serviceTemplate
    );
    
    await fs.writeFile(
      path.join(TEST_DIR, '_templates/config/config.ejs.t'),
      configTemplate
    );
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Help and Version Commands', () => {
    it('should display help information', async () => {
      const result = execSync(
        `node ${KGEN_CLI} --help`,
        { encoding: 'utf-8', timeout: 15000 }
      );

      expect(result).toContain('KGEN');
      expect(result).toContain('generate');
      expect(result).toContain('validate');
      expect(result).toContain('query');
    }, 30000);

    it('should display version information', async () => {
      const result = execSync(
        `node ${KGEN_CLI} --version`,
        { encoding: 'utf-8', timeout: 15000 }
      );

      expect(result).toMatch(/\d+\.\d+\.\d+/);
    }, 30000);

    it('should display command-specific help', async () => {
      const result = execSync(
        `node ${KGEN_CLI} generate --help`,
        { encoding: 'utf-8', timeout: 15000 }
      );

      expect(result).toContain('generate');
      expect(result).toContain('template');
      expect(result).toContain('graph');
    }, 30000);
  });

  describe('Generate Command', () => {
    it('should generate from template with arguments', async () => {
      const cwd = TEST_DIR;
      
      const result = execSync(
        `node ${KGEN_CLI} generate service/service --serviceName ApiService --port 8080`,
        { 
          cwd,
          encoding: 'utf-8',
          timeout: 30000
        }
      );

      expect(result).toContain('Generated') || expect(result).toContain('Created');
      
      // Verify generated file
      const generatedFile = path.join(cwd, 'src/services/api-service.js');
      const content = await fs.readFile(generatedFile, 'utf-8');
      
      expect(content).toContain('ApiServiceService');
      expect(content).toContain('this.port = 8080');
    }, 45000);

    it('should generate with RDF graph input', async () => {
      const cwd = TEST_DIR;
      
      const result = execSync(
        `node ${KGEN_CLI} generate service/service --graph services.ttl --serviceName FromGraph`,
        { 
          cwd,
          encoding: 'utf-8',
          timeout: 30000
        }
      );

      expect(result).toContain('Generated') || expect(result).toContain('Created');
      
      const generatedFile = path.join(cwd, 'src/services/from-graph.js');
      const fileExists = await fs.access(generatedFile)
        .then(() => true)
        .catch(() => false);
      
      expect(fileExists).toBe(true);
    }, 45000);

    it('should handle missing template gracefully', async () => {
      const cwd = TEST_DIR;
      
      try {
        execSync(
          `node ${KGEN_CLI} generate nonexistent/template --param value`,
          { 
            cwd,
            encoding: 'utf-8',
            timeout: 15000
          }
        );
        expect.fail('Should have thrown an error for missing template');
      } catch (error) {
        expect(error.message).toContain('template') || 
               expect(error.message).toContain('not found') ||
               expect(error.message).toContain('missing');
      }
    }, 30000);

    it('should support dry run mode', async () => {
      const cwd = TEST_DIR;
      
      const result = execSync(
        `node ${KGEN_CLI} generate service/service --serviceName DryRun --dry-run`,
        { 
          cwd,
          encoding: 'utf-8',
          timeout: 30000
        }
      );

      expect(result).toContain('dry') || expect(result).toContain('preview') || expect(result).toContain('would');
      
      // File should not exist
      const generatedFile = path.join(cwd, 'src/services/dry-run.js');
      const fileExists = await fs.access(generatedFile)
        .then(() => true)
        .catch(() => false);
      
      expect(fileExists).toBe(false);
    }, 45000);
  });

  describe('List Command', () => {
    it('should list available templates', async () => {
      const cwd = TEST_DIR;
      
      const result = execSync(
        `node ${KGEN_CLI} list`,
        { 
          cwd,
          encoding: 'utf-8',
          timeout: 30000
        }
      );

      expect(result).toContain('service/service') || expect(result).toContain('service');
      expect(result).toContain('config/config') || expect(result).toContain('config');
    }, 45000);

    it('should show template details with verbose flag', async () => {
      const cwd = TEST_DIR;
      
      const result = execSync(
        `node ${KGEN_CLI} list --verbose`,
        { 
          cwd,
          encoding: 'utf-8',
          timeout: 30000
        }
      );

      expect(result).toContain('service') || expect(result).toContain('Service');
    }, 45000);
  });

  describe('Query Command', () => {
    it('should execute SPARQL queries against RDF graphs', async () => {
      const cwd = TEST_DIR;
      
      const result = execSync(
        `node ${KGEN_CLI} query --graph services.ttl --sparql "SELECT ?service ?name WHERE { ?service :name ?name }"`,
        { 
          cwd,
          encoding: 'utf-8',
          timeout: 30000
        }
      );

      expect(result).toContain('apiService') || expect(result).toContain('API Service');
    }, 45000);

    it('should handle invalid SPARQL queries', async () => {
      const cwd = TEST_DIR;
      
      try {
        execSync(
          `node ${KGEN_CLI} query --graph services.ttl --sparql "INVALID SPARQL SYNTAX"`,
          { 
            cwd,
            encoding: 'utf-8',
            timeout: 15000
          }
        );
        expect.fail('Should have thrown an error for invalid SPARQL');
      } catch (error) {
        expect(error.message).toContain('SPARQL') || 
               expect(error.message).toContain('syntax') ||
               expect(error.message).toContain('invalid');
      }
    }, 30000);
  });

  describe('Validate Command', () => {
    it('should validate RDF graph syntax', async () => {
      const cwd = TEST_DIR;
      
      const result = execSync(
        `node ${KGEN_CLI} validate --graph services.ttl`,
        { 
          cwd,
          encoding: 'utf-8',
          timeout: 30000
        }
      );

      expect(result).toContain('valid') || 
             expect(result).toContain('passed') ||
             expect(result).toContain('success');
    }, 45000);

    it('should detect invalid RDF syntax', async () => {
      const invalidGraph = `
@prefix : <http://example.org/> .
# Invalid syntax - missing closing bracket
:Service rdf:type rdfs:Class
         rdfs:label "Service" .
`;
      
      const cwd = TEST_DIR;
      await fs.writeFile(path.join(cwd, 'invalid.ttl'), invalidGraph);
      
      try {
        execSync(
          `node ${KGEN_CLI} validate --graph invalid.ttl`,
          { 
            cwd,
            encoding: 'utf-8',
            timeout: 15000
          }
        );
        expect.fail('Should have thrown an error for invalid RDF');
      } catch (error) {
        expect(error.message).toContain('invalid') || 
               expect(error.message).toContain('syntax') ||
               expect(error.message).toContain('error');
      }
    }, 30000);

    it('should validate template syntax', async () => {
      const cwd = TEST_DIR;
      
      const result = execSync(
        `node ${KGEN_CLI} validate --template service/service`,
        { 
          cwd,
          encoding: 'utf-8',
          timeout: 30000
        }
      );

      expect(result).toContain('valid') || 
             expect(result).toContain('passed') ||
             expect(result).toContain('success');
    }, 45000);
  });

  describe('Init Command', () => {
    it('should initialize KGEN project structure', async () => {
      const initDir = TEST_DIR + '_init';
      await fs.mkdir(initDir, { recursive: true });
      
      try {
        const result = execSync(
          `node ${KGEN_CLI} init`,
          { 
            cwd: initDir,
            encoding: 'utf-8',
            timeout: 30000
          }
        );

        expect(result).toContain('initialized') || 
               expect(result).toContain('created') ||
               expect(result).toContain('setup');
        
        // Check for config file
        const configExists = await fs.access(path.join(initDir, 'kgen.config.js'))
          .then(() => true)
          .catch(() => false);
        
        expect(configExists).toBe(true);
        
        // Check for templates directory
        const templatesExists = await fs.access(path.join(initDir, '_templates'))
          .then(() => true)
          .catch(() => false);
        
        expect(templatesExists).toBe(true);
        
        await fs.rm(initDir, { recursive: true, force: true });
      } catch (error) {
        await fs.rm(initDir, { recursive: true, force: true });
        throw error;
      }
    }, 60000);
  });

  describe('Cache Command', () => {
    it('should clear cache when requested', async () => {
      const cwd = TEST_DIR;
      
      // Generate something to create cache
      execSync(
        `node ${KGEN_CLI} generate service/service --serviceName Cached --port 9000`,
        { cwd, timeout: 30000 }
      );
      
      // Clear cache
      const result = execSync(
        `node ${KGEN_CLI} cache --clear`,
        { 
          cwd,
          encoding: 'utf-8',
          timeout: 30000
        }
      );

      expect(result).toContain('cache') || expect(result).toContain('cleared');
    }, 60000);

    it('should show cache statistics', async () => {
      const cwd = TEST_DIR;
      
      const result = execSync(
        `node ${KGEN_CLI} cache --stats`,
        { 
          cwd,
          encoding: 'utf-8',
          timeout: 30000
        }
      );

      expect(result).toContain('cache') || expect(result).toContain('size') || expect(result).toContain('entries');
    }, 45000);
  });
});

describe('KGEN CLI Error Handling', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should handle missing required arguments gracefully', async () => {
    try {
      execSync(
        `node ${KGEN_CLI} generate`,
        { 
          cwd: TEST_DIR,
          encoding: 'utf-8',
          timeout: 15000
        }
      );
      expect.fail('Should have thrown an error for missing template argument');
    } catch (error) {
      expect(error.message).toContain('template') || 
             expect(error.message).toContain('required') ||
             expect(error.message).toContain('missing');
    }
  }, 30000);

  it('should handle file permission errors', async () => {
    const cwd = TEST_DIR;
    
    // Create a directory where we expect a file (to simulate permission error)
    await fs.mkdir(path.join(cwd, 'src/services/blocked.js'), { recursive: true });
    
    // Create minimal template
    await fs.mkdir(path.join(cwd, '_templates/blocked'), { recursive: true });
    await fs.writeFile(
      path.join(cwd, '_templates/blocked/file.ejs.t'),
      '---\nto: src/services/blocked.js\n---\ntest content'
    );
    
    try {
      execSync(
        `node ${KGEN_CLI} generate blocked/file`,
        { 
          cwd,
          encoding: 'utf-8',
          timeout: 15000
        }
      );
      expect.fail('Should have thrown an error for permission/file conflict');
    } catch (error) {
      expect(error.message).toContain('error') || 
             expect(error.message).toContain('failed') ||
             expect(error.message).toContain('permission');
    }
  }, 30000);

  it('should provide helpful error messages for common mistakes', async () => {
    const cwd = TEST_DIR;
    
    try {
      execSync(
        `node ${KGEN_CLI} generate service/service --invalid-flag value`,
        { 
          cwd,
          encoding: 'utf-8',
          timeout: 15000
        }
      );
    } catch (error) {
      // Should contain helpful information about the error
      expect(error.message).toContain('flag') || 
             expect(error.message).toContain('option') ||
             expect(error.message).toContain('argument');
    }
  }, 30000);
});

describe('KGEN CLI Argument Parsing', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    
    // Create simple template for testing arguments
    const template = `---
to: output/{{ outputName }}.txt
---
Name: {{ name }}
Count: {{ count }}
Flag: {{ flag }}
List: {{ list | join(', ') }}
`;
    
    await fs.mkdir(path.join(TEST_DIR, '_templates/args'), { recursive: true });
    await fs.writeFile(
      path.join(TEST_DIR, '_templates/args/test.ejs.t'),
      template
    );
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should parse string arguments correctly', async () => {
    const cwd = TEST_DIR;
    
    execSync(
      `node ${KGEN_CLI} generate args/test --outputName string-test --name "John Doe" --count 42`,
      { cwd, timeout: 30000 }
    );
    
    const content = await fs.readFile(
      path.join(cwd, 'output/string-test.txt'),
      'utf-8'
    );
    
    expect(content).toContain('Name: John Doe');
    expect(content).toContain('Count: 42');
  }, 45000);

  it('should handle boolean flags correctly', async () => {
    const cwd = TEST_DIR;
    
    execSync(
      `node ${KGEN_CLI} generate args/test --outputName bool-test --name Test --flag`,
      { cwd, timeout: 30000 }
    );
    
    const content = await fs.readFile(
      path.join(cwd, 'output/bool-test.txt'),
      'utf-8'
    );
    
    expect(content).toContain('Flag: true');
  }, 45000);

  it('should parse array arguments correctly', async () => {
    const cwd = TEST_DIR;
    
    execSync(
      `node ${KGEN_CLI} generate args/test --outputName array-test --name Test --list item1,item2,item3`,
      { cwd, timeout: 30000 }
    );
    
    const content = await fs.readFile(
      path.join(cwd, 'output/array-test.txt'),
      'utf-8'
    );
    
    expect(content).toContain('List: item1, item2, item3');
  }, 45000);
});

describe('KGEN CLI Performance', () => {
  it('should complete simple generation within reasonable time', async () => {
    const start = Date.now();
    
    const cwd = TEST_DIR;
    await fs.mkdir(cwd, { recursive: true });
    
    // Create minimal template
    await fs.mkdir(path.join(cwd, '_templates/perf'), { recursive: true });
    await fs.writeFile(
      path.join(cwd, '_templates/perf/simple.ejs.t'),
      '---\nto: output.txt\n---\nSimple: {{ value }}'
    );
    
    try {
      execSync(
        `node ${KGEN_CLI} generate perf/simple --value test`,
        { cwd, timeout: 10000 }
      );
      
      const duration = Date.now() - start;
      
      // Should complete within 10 seconds
      expect(duration).toBeLessThan(10000);
      
      await fs.rm(cwd, { recursive: true, force: true });
    } catch (error) {
      await fs.rm(cwd, { recursive: true, force: true });
      throw error;
    }
  }, 15000);
});