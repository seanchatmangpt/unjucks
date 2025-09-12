/**
 * Tests for FrontmatterParser - YAML parsing with SPARQL support
 * Tests frontmatter parsing, validation, and operation modes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FrontmatterParser } from '../../src/lib/frontmatter-parser.js';

describe('FrontmatterParser', () => {
  let parser;

  beforeEach(() => {
    parser = new FrontmatterParser();
  });

  describe('Basic Frontmatter Parsing', () => {
    it('should parse simple YAML frontmatter', async () => {
      const content = `---
to: "output.txt"
inject: true
---
Template content here`;

      const result = await parser.parse(content);

      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter.to).toBe('output.txt');
      expect(result.frontmatter.inject).toBe(true);
      expect(result.content).toBe('Template content here');
    });

    it('should handle content without frontmatter', async () => {
      const content = 'Just template content';

      const result = await parser.parse(content);

      expect(result.hasValidFrontmatter).toBe(false);
      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe('Just template content');
    });

    it('should handle empty or whitespace content', async () => {
      const emptyResult = await parser.parse('');
      expect(emptyResult.hasValidFrontmatter).toBe(false);
      expect(emptyResult.content).toBe('');

      const whitespaceResult = await parser.parse('   \n  \n  ');
      expect(whitespaceResult.hasValidFrontmatter).toBe(false);
      expect(whitespaceResult.content).toBe('   \n  \n  ');
    });

    it('should handle malformed frontmatter gracefully', async () => {
      const content = `---
invalid: yaml: syntax: error
---
Template content`;

      const result = await parser.parse(content);

      expect(result.hasValidFrontmatter).toBe(false);
      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe(content);
    });

    it('should parse complex frontmatter configuration', async () => {
      const content = `---
to: "src/{{ name | kebabCase }}.ts"
inject: true
before: "import React from 'react';"
after: "// Component imports"
skipIf: "{{ name | pascalCase }}"
chmod: 755
sh: "npm run format {{ to }}"
---
Component content`;

      const result = await parser.parse(content);

      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter.to).toBe('src/{{ name | kebabCase }}.ts');
      expect(result.frontmatter.inject).toBe(true);
      expect(result.frontmatter.before).toBe('import React from \'react\';');
      expect(result.frontmatter.after).toBe('// Component imports');
      expect(result.frontmatter.skipIf).toBe('{{ name | pascalCase }}');
      expect(result.frontmatter.chmod).toBe(755);
      expect(result.frontmatter.sh).toBe('npm run format {{ to }}');
      expect(result.content.trim()).toBe('Component content');
    });
  });

  describe('SPARQL Content Preprocessing', () => {
    it('should handle SPARQL queries in frontmatter', async () => {
      const content = `---
to: "output.rdf"
sparql: |
  PREFIX foaf: <http://xmlns.com/foaf/0.1/>
  SELECT ?name WHERE {
    ?person foaf:name ?name .
  }
---
Template content`;

      const result = await parser.parse(content);

      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter.sparql).toContain('PREFIX foaf:');
      expect(result.frontmatter.sparql).toContain('SELECT ?name WHERE');
    });

    it('should auto-detect and format SPARQL queries', async () => {
      const content = `---
to: "output.rdf"
query: 
  SELECT ?name WHERE {
    ?person foaf:name ?name .
  }
---
Template content`;

      const result = await parser.parse(content);

      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter.query).toContain('SELECT ?name WHERE');
    });

    it('should handle RDF turtle data', async () => {
      const content = `---
to: "output.ttl"
turtle: |
  @prefix foaf: <http://xmlns.com/foaf/0.1/> .
  <http://example.org/person1> foaf:name "John Doe" .
---
Template content`;

      const result = await parser.parse(content);

      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter.turtle).toContain('@prefix foaf:');
      expect(result.frontmatter.turtle).toContain('foaf:name "John Doe"');
    });

    it('should handle RDF configuration objects', async () => {
      const content = `---
to: "output.rdf"
rdf:
  source: "data.ttl"
  type: "file"
  prefixes:
    - "PREFIX foaf: <http://xmlns.com/foaf/0.1/>"
    - "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>"
---
Template content`;

      const result = await parser.parse(content);

      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter.rdf.source).toBe('data.ttl');
      expect(result.frontmatter.rdf.type).toBe('file');
      expect(result.frontmatter.rdf.prefixes).toHaveLength(2);
      expect(result.frontmatter.rdf.prefixes[0]).toContain('PREFIX foaf:');
    });
  });

  describe('SPARQL Content Detection', () => {
    it('should detect SPARQL-like content', () => {
      const sparqlQueries = [
        'SELECT ?name WHERE { ?person foaf:name ?name }',
        'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
        'ASK { ?person foaf:name "John" }',
        'DESCRIBE <http://example.org/person>',
        'INSERT DATA { <http://example.org/person> foaf:name "John" }',
        'DELETE WHERE { ?person foaf:name "Old Name" }'
      ];

      sparqlQueries.forEach(query => {
        expect(parser.isSparqlLikeContent(query)).toBe(true);
      });
    });

    it('should not detect non-SPARQL content as SPARQL', () => {
      const nonSparqlContent = [
        'Just regular text',
        'function select() { return data; }',
        'const where = "location";',
        'This contains the word SELECT but is not SPARQL'
      ];

      nonSparqlContent.forEach(content => {
        expect(parser.isSparqlLikeContent(content)).toBe(false);
      });
    });
  });

  describe('Frontmatter Validation', () => {
    it('should validate correct injection configuration', () => {
      const validConfigs = [
        { inject: true, after: 'marker' },
        { inject: true, before: 'marker' },
        { append: true },
        { prepend: true },
        { lineAt: 5 }
      ];

      validConfigs.forEach(config => {
        const result = parser.validate(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should detect mutually exclusive injection modes', () => {
      const invalidConfig = {
        inject: true,
        append: true,
        prepend: true
      };

      const result = parser.validate(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Only one injection mode allowed: inject, append, prepend, or lineAt');
    });

    it('should validate before/after requires inject: true', () => {
      const invalidConfig = {
        before: 'marker'
      };

      const result = parser.validate(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('before/after requires inject: true');
    });

    it('should validate lineAt is a positive number', () => {
      const invalidConfigs = [
        { lineAt: 0 },
        { lineAt: -1 },
        { lineAt: 'invalid' }
      ];

      invalidConfigs.forEach(config => {
        const result = parser.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(err => err.includes('lineAt must be a positive number'))).toBe(true);
      });
    });

    it('should validate chmod format', () => {
      const validConfigs = [
        { chmod: '755' },
        { chmod: '0644' },
        { chmod: 0o755 }
      ];

      validConfigs.forEach(config => {
        const result = parser.validate(config);
        expect(result.valid).toBe(true);
      });

      const invalidConfigs = [
        { chmod: 'invalid' },
        { chmod: '999' },
        { chmod: -1 }
      ];

      invalidConfigs.forEach(config => {
        const result = parser.validate(config);
        expect(result.valid).toBe(false);
      });
    });

    it('should validate RDF configuration', () => {
      const validRDFConfig = {
        rdf: {
          source: 'data.ttl',
          type: 'file'
        }
      };

      const result = parser.validate(validRDFConfig);
      expect(result.valid).toBe(true);

      const invalidRDFConfig = {
        rdf: {
          type: 'invalid_type'
        }
      };

      const invalidResult = parser.validate(invalidRDFConfig);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate SPARQL query syntax', () => {
      const validSparqlConfig = {
        sparql: 'SELECT ?name WHERE { ?person foaf:name ?name }'
      };

      const result = parser.validate(validSparqlConfig);
      expect(result.valid).toBe(true);

      const invalidSparqlConfig = {
        sparql: 'INVALID QUERY SYNTAX'
      };

      const invalidResult = parser.validate(invalidSparqlConfig);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Invalid SPARQL query syntax in frontmatter');
    });
  });

  describe('SPARQL Syntax Validation', () => {
    it('should validate SELECT queries', () => {
      const validQueries = [
        'SELECT ?name WHERE { ?person foaf:name ?name }',
        'SELECT * WHERE { ?s ?p ?o }',
        'SELECT DISTINCT ?type WHERE { ?resource rdf:type ?type }'
      ];

      validQueries.forEach(query => {
        expect(parser.isValidSparqlSyntax(query)).toBe(true);
      });
    });

    it('should validate CONSTRUCT queries', () => {
      const validQueries = [
        'CONSTRUCT { ?s foaf:name ?name } WHERE { ?s foaf:givenName ?name }',
        'CONSTRUCT { ?s rdf:type foaf:Person } WHERE { ?s foaf:name ?name }'
      ];

      validQueries.forEach(query => {
        expect(parser.isValidSparqlSyntax(query)).toBe(true);
      });
    });

    it('should validate ASK and DESCRIBE queries', () => {
      const validQueries = [
        'ASK { ?person foaf:name "John" }',
        'DESCRIBE <http://example.org/person>'
      ];

      validQueries.forEach(query => {
        expect(parser.isValidSparqlSyntax(query)).toBe(true);
      });
    });

    it('should validate UPDATE queries without WHERE', () => {
      const validQueries = [
        'INSERT DATA { <http://example.org/person> foaf:name "John" }',
        'DELETE DATA { <http://example.org/person> foaf:name "Old Name" }'
      ];

      validQueries.forEach(query => {
        expect(parser.isValidSparqlSyntax(query)).toBe(true);
      });
    });

    it('should reject invalid SPARQL syntax', () => {
      const invalidQueries = [
        'INVALID SYNTAX',
        'SELECT WHERE { }', // Missing variables
        'RANDOM QUERY TEXT'
      ];

      invalidQueries.forEach(query => {
        expect(parser.isValidSparqlSyntax(query)).toBe(false);
      });
    });
  });

  describe('RDF Configuration Detection', () => {
    it('should detect RDF configuration presence', () => {
      const configsWithRDF = [
        { rdf: { source: 'data.ttl' } },
        { turtle: 'some turtle data' },
        { sparql: 'SELECT * WHERE { ?s ?p ?o }' },
        { query: 'ASK { ?person foaf:name "John" }' }
      ];

      configsWithRDF.forEach(config => {
        expect(parser.hasRDFConfig(config)).toBe(true);
      });
    });

    it('should not detect RDF in non-RDF configurations', () => {
      const configsWithoutRDF = [
        { to: 'output.txt' },
        { inject: true },
        { variables: { name: 'test' } }
      ];

      configsWithoutRDF.forEach(config => {
        expect(parser.hasRDFConfig(config)).toBe(false);
      });
    });
  });

  describe('RDF Configuration Extraction', () => {
    it('should extract RDF file configuration', () => {
      const frontmatter = { rdf: 'data.ttl' };
      const config = parser.getRDFConfig(frontmatter);

      expect(config.type).toBe('file');
      expect(config.source).toBe('data.ttl');
    });

    it('should extract turtle configuration', () => {
      const frontmatter = { turtle: { source: 'data.ttl', type: 'file' } };
      const config = parser.getRDFConfig(frontmatter);

      expect(config.format).toBe('text/turtle');
      expect(config.source).toBe('data.ttl');
      expect(config.type).toBe('file');
    });

    it('should extract inline turtle data', () => {
      const turtleData = '@prefix foaf: <http://xmlns.com/foaf/0.1/> .';
      const frontmatter = { turtleData };
      const config = parser.getRDFConfig(frontmatter);

      expect(config.type).toBe('inline');
      expect(config.source).toBe(turtleData);
      expect(config.format).toBe('text/turtle');
    });

    it('should return null for non-RDF frontmatter', () => {
      const frontmatter = { to: 'output.txt', inject: true };
      const config = parser.getRDFConfig(frontmatter);

      expect(config).toBeNull();
    });
  });

  describe('Operation Mode Detection', () => {
    it('should detect lineAt mode', () => {
      const frontmatter = { lineAt: 5 };
      const mode = parser.getOperationMode(frontmatter);

      expect(mode.mode).toBe('lineAt');
      expect(mode.lineNumber).toBe(5);
    });

    it('should detect append mode', () => {
      const frontmatter = { append: true };
      const mode = parser.getOperationMode(frontmatter);

      expect(mode.mode).toBe('append');
    });

    it('should detect prepend mode', () => {
      const frontmatter = { prepend: true };
      const mode = parser.getOperationMode(frontmatter);

      expect(mode.mode).toBe('prepend');
    });

    it('should detect inject mode with target', () => {
      const beforeMode = parser.getOperationMode({ inject: true, before: 'marker' });
      expect(beforeMode.mode).toBe('inject');
      expect(beforeMode.target).toBe('marker');

      const afterMode = parser.getOperationMode({ inject: true, after: 'marker' });
      expect(afterMode.mode).toBe('inject');
      expect(afterMode.target).toBe('marker');
    });

    it('should default to write mode', () => {
      const frontmatter = { to: 'output.txt' };
      const mode = parser.getOperationMode(frontmatter);

      expect(mode.mode).toBe('write');
    });
  });

  describe('Skip Condition Evaluation', () => {
    it('should handle simple variable existence check', () => {
      const frontmatter = { skipIf: 'shouldSkip' };
      
      expect(parser.shouldSkip(frontmatter, { shouldSkip: true })).toBe(true);
      expect(parser.shouldSkip(frontmatter, { shouldSkip: false })).toBe(false);
      expect(parser.shouldSkip(frontmatter, {})).toBe(false);
    });

    it('should handle negation conditions', () => {
      const frontmatter = { skipIf: '!shouldGenerate' };
      
      expect(parser.shouldSkip(frontmatter, { shouldGenerate: true })).toBe(false);
      expect(parser.shouldSkip(frontmatter, { shouldGenerate: false })).toBe(true);
      expect(parser.shouldSkip(frontmatter, {})).toBe(true);
    });

    it('should handle equality conditions', () => {
      const frontmatter = { skipIf: 'environment==production' };
      
      expect(parser.shouldSkip(frontmatter, { environment: 'production' })).toBe(true);
      expect(parser.shouldSkip(frontmatter, { environment: 'development' })).toBe(false);
    });

    it('should handle inequality conditions', () => {
      const frontmatter = { skipIf: 'type!=component' };
      
      expect(parser.shouldSkip(frontmatter, { type: 'service' })).toBe(true);
      expect(parser.shouldSkip(frontmatter, { type: 'component' })).toBe(false);
    });

    it('should handle quoted values in conditions', () => {
      const frontmatter = { skipIf: 'name=="test value"' };
      
      expect(parser.shouldSkip(frontmatter, { name: 'test value' })).toBe(true);
      expect(parser.shouldSkip(frontmatter, { name: 'other value' })).toBe(false);
    });

    it('should handle empty or invalid skipIf conditions', () => {
      const configs = [
        { skipIf: '' },
        { skipIf: '   ' },
        {},
        { skipIf: null }
      ];

      configs.forEach(config => {
        expect(parser.shouldSkip(config, { someVar: true })).toBe(false);
      });
    });

    it('should handle malformed skipIf conditions gracefully', () => {
      const frontmatter = { skipIf: 'invalid===syntax' };
      
      // Should not throw and return false for safety
      expect(parser.shouldSkip(frontmatter, {})).toBe(false);
    });
  });

  describe('Chmod Normalization', () => {
    it('should normalize string chmod values', () => {
      expect(parser.normalizeChmod('755')).toBe(0o755);
      expect(parser.normalizeChmod('0644')).toBe(0o644);
      expect(parser.normalizeChmod('644')).toBe(0o644);
    });

    it('should pass through numeric chmod values', () => {
      expect(parser.normalizeChmod(0o755)).toBe(0o755);
      expect(parser.normalizeChmod(420)).toBe(420); // 0o644 in decimal
    });
  });

  describe('URI Validation', () => {
    it('should validate absolute URLs', () => {
      const validUrls = [
        'http://example.org',
        'https://example.org/path',
        'ftp://ftp.example.org',
        'file:///path/to/file'
      ];

      validUrls.forEach(url => {
        expect(parser.isValidUri(url)).toBe(true);
      });
    });

    it('should validate relative URIs and namespace patterns', () => {
      const validUris = [
        '/relative/path',
        'foaf:name',
        'rdf:type',
        'prefix:localName'
      ];

      validUris.forEach(uri => {
        expect(parser.isValidUri(uri)).toBe(true);
      });
    });

    it('should reject invalid URIs', () => {
      const invalidUris = [
        'just text',
        'no-colon-or-slash',
        ''
      ];

      invalidUris.forEach(uri => {
        expect(parser.isValidUri(uri)).toBe(false);
      });
    });
  });

  describe('Template Variable Support', () => {
    it('should preserve template variables in frontmatter', async () => {
      const content = `---
to: "src/{{ componentType }}/{{ name | kebabCase }}.{{ extension }}"
inject: "{{ shouldInject }}"
skipIf: "{{ skipCondition }}"
---
Content with {{ variables }}`;

      const result = await parser.parse(content);

      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter.to).toBe('src/{{ componentType }}/{{ name | kebabCase }}.{{ extension }}');
      expect(result.frontmatter.inject).toBe('{{ shouldInject }}');
      expect(result.frontmatter.skipIf).toBe('{{ skipCondition }}');
      expect(result.content.trim()).toBe('Content with {{ variables }}');
    });

    it('should handle complex template expressions', async () => {
      const content = `---
to: >
  {% if isComponent %}
    src/components/{{ name | kebabCase }}.tsx
  {% else %}
    src/utils/{{ name | kebabCase }}.ts
  {% endif %}
inject: "{{ hasExistingFile }}"
---
Content`;

      const result = await parser.parse(content);

      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter.to).toContain('{% if isComponent %}');
      expect(result.frontmatter.to).toContain('src/components/{{ name | kebabCase }}.tsx');
      expect(result.frontmatter.inject).toBe('{{ hasExistingFile }}');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle frontmatter with only delimiters', async () => {
      const content = '---\n---\nContent';

      const result = await parser.parse(content);

      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter).toEqual({});
      expect(result.content.trim()).toBe('Content');
    });

    it('should handle content with --- inside', async () => {
      const content = `---
to: "output.txt"
---
Content with --- separator inside`;
      
      const result = await parser.parse(content);
      
      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter.to).toBe('output.txt');
      expect(result.content).toContain('--- separator');
    });

    it('should handle Unicode characters', async () => {
      const content = `---
to: "src/{{ name | kebabCase }}.ts"
description: "Component with émojis 🚀 and unicode ñ"
---
Content with émojis 🎉 and unicode characters ñáéíóú`;

      const result = await parser.parse(content);

      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter.description).toBe('Component with émojis 🚀 and unicode ñ');
      expect(result.content).toContain('Content with émojis 🎉 and unicode characters ñáéíóú');
    });

    it('should handle very large frontmatter', async () => {
      const largeFrontmatter = Array.from({ length: 100 }, (_, i) => 
        `field${i}: "value ${i}"`
      ).join('\n');
      
      const content = `---
${largeFrontmatter}
---
Content`;

      const result = await parser.parse(content);

      expect(result.hasValidFrontmatter).toBe(true);
      expect(Object.keys(result.frontmatter)).toHaveLength(100);
      expect(result.frontmatter.field0).toBe('value 0');
      expect(result.frontmatter.field99).toBe('value 99');
    });

    it('should handle malformed frontmatter delimiters', async () => {
      const templates = [
        `--
to: "file.txt"
---
content`,
        `---
to: "file.txt"
--
content`
      ];
      
      for (const template of templates) {
        const result = await parser.parse(template);
        expect(result).toBeDefined();
        // Should treat as content without frontmatter
        expect(result.hasValidFrontmatter).toBe(false);
      }
    });
  });

  describe('Complex Frontmatter Scenarios', () => {
    it('should handle complex real-world frontmatter', async () => {
      const content = `---
to: "src/components/{{ name | kebabCase }}/{{ name | pascalCase }}.tsx"
inject: true
after: "// COMPONENTS"
skipIf: "type!=component"
chmod: "644"
variables:
  typescript: true
  styled: false
rdf:
  source: "schema.ttl"
  type: "file"
  prefixes:
    - "PREFIX foaf: <http://xmlns.com/foaf/0.1/>"
sparql: |
  SELECT ?component WHERE {
    ?component rdf:type :Component .
    ?component :hasName "{{ name }}" .
  }
---
import React from 'react';

export const {{ name | pascalCase }} = () => {
  return <div>{{ name | pascalCase }} Component</div>;
};`;

      const result = await parser.parse(content);

      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter.to).toContain('{{ name | kebabCase }}');
      expect(result.frontmatter.inject).toBe(true);
      expect(result.frontmatter.after).toBe('// COMPONENTS');
      expect(result.frontmatter.skipIf).toBe('type!=component');
      expect(result.frontmatter.chmod).toBe('644');
      expect(result.frontmatter.variables.typescript).toBe(true);
      expect(result.frontmatter.rdf.source).toBe('schema.ttl');
      expect(result.frontmatter.sparql).toContain('SELECT ?component WHERE');
      expect(result.content).toContain('import React from \'react\';');
    });
  });

  describe('Performance', () => {
    it('should parse large templates efficiently', async () => {
      const largeContent = 'Line content\n'.repeat(10000);
      const content = `---
to: "large.ts"
---
${largeContent}`;

      const startTime = this.getDeterministicTimestamp();
      const result = await parser.parse(content);
      const endTime = this.getDeterministicTimestamp();

      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter.to).toBe('large.ts');
      expect(result.content.split('\n')).toHaveLength(10001); // +1 for final newline
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });

    it('should handle concurrent parsing efficiently', async () => {
      const templates = Array.from({ length: 50 }, (_, i) => `---
to: "file${i}.ts"
---
Content ${i}`);

      const startTime = this.getDeterministicTimestamp();
      const results = await Promise.all(templates.map(template => parser.parse(template)));
      const endTime = this.getDeterministicTimestamp();

      expect(results).toHaveLength(50);
      results.forEach((result, i) => {
        expect(result.hasValidFrontmatter).toBe(true);
        expect(result.frontmatter.to).toBe(`file${i}.ts`);
        expect(result.content.trim()).toBe(`Content ${i}`);
      });
      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
    });
  });
});

describe('FrontmatterParser with Semantic Validation', () => {
  let parser;

  beforeEach(() => {
    parser = new FrontmatterParser(true); // Enable validation
  });

  describe('Semantic Validation Integration', () => {
    it('should initialize with semantic validator when enabled', () => {
      expect(parser.semanticValidator).toBeDefined();
    });

    it('should skip semantic validation for non-RDF content', async () => {
      const content = `---
to: "output.txt"
inject: true
---
Template content`;

      const result = await parser.parse(content, true);

      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.validationResult).toBeUndefined();
    });

    it('should handle validation errors gracefully', async () => {
      const content = `---
to: "output.rdf"
rdf:
  type: "invalid_type"
---
Template content`;

      const result = await parser.parse(content, true);

      expect(result.hasValidFrontmatter).toBe(true);
      // Should not throw, validation errors handled internally
    });
  });
});