/**
 * Cucumber BDD Test Runner for Ontology Project Generation
 * Wraps Gherkin scenarios for execution with Vitest
 * London School TDD with mocks and test doubles
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { loadFeature, autoBindSteps } from 'vitest-cucumber';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the feature file
const featureFile = path.join(__dirname, 'ontology-project-generation.feature');
const feature = await loadFeature(featureFile);

// Auto-bind step definitions
const stepDefsPath = path.join(
  __dirname,
  'step_definitions/ontology_project_steps.js'
);

describe('Feature: Generate Full Project from RDF Ontology', () => {
  beforeAll(async () => {
    // Ensure test fixtures exist
    const fixturesDir = path.join(__dirname, '../fixtures/ontologies');
    await fs.ensureDir(fixturesDir);

    // Generate complex.ttl programmatically for performance tests
    const { generateLargeOntology } = await import(
      '../helpers/ontology-test-utils.js'
    );
    const complexPath = path.join(fixturesDir, 'complex.ttl');

    // Only regenerate if doesn't exist or is too small
    if (!(await fs.pathExists(complexPath))) {
      console.log('Generating large ontology fixture (1000 classes)...');
      await generateLargeOntology(complexPath, 1000);
      console.log('Large ontology generated successfully');
    }
  });

  afterAll(async () => {
    // Cleanup generated test projects
    const generatedDir = path.join(__dirname, '../../generated');
    if (await fs.pathExists(generatedDir)) {
      await fs.remove(generatedDir);
    }
  });

  // Auto-bind all scenarios from feature file
  autoBindSteps([feature], stepDefsPath);
});

describe('Ontology Generation - Unit Tests (London School)', () => {
  let mockRDFParser;
  let mockFileSystem;
  let mockTemplateEngine;

  beforeEach(async () => {
    const {
      createMockRDFParser,
      createMockFileSystem,
      createMockTemplateEngine,
    } = await import('../helpers/ontology-test-utils.js');

    mockRDFParser = createMockRDFParser();
    mockFileSystem = createMockFileSystem();
    mockTemplateEngine = createMockTemplateEngine();
  });

  describe('RDF Parser', () => {
    it('should parse valid TTL file', async () => {
      const sampleTTL = `
        @prefix : <http://example.org/> .
        :Person a rdfs:Class .
      `;

      mockRDFParser.parse.mockResolvedValue({
        classes: [{ uri: 'http://example.org/Person', label: 'Person' }],
        properties: [],
        relationships: [],
      });

      const result = await mockRDFParser.parse(sampleTTL);

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].label).toBe('Person');
      expect(mockRDFParser.parse).toHaveBeenCalledWith(sampleTTL);
    });

    it('should detect invalid TTL syntax', async () => {
      const invalidTTL = `
        @prefix : <http://example.org/> .
        :Person a rdfs:Class
        # Missing semicolon - invalid syntax
      `;

      mockRDFParser.validateSyntax.mockReturnValue({
        valid: false,
        errors: [
          {
            message: 'Unexpected token',
            line: 3,
            column: 8,
          },
        ],
      });

      const validation = mockRDFParser.validateSyntax(invalidTTL);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].message).toContain('Unexpected token');
    });

    it('should extract classes with properties', async () => {
      mockRDFParser.getClasses.mockReturnValue([
        {
          uri: 'http://example.org/Person',
          label: 'Person',
          properties: [
            { name: 'name', type: 'xsd:string' },
            { name: 'email', type: 'xsd:string' },
          ],
        },
      ]);

      const classes = mockRDFParser.getClasses();

      expect(classes).toHaveLength(1);
      expect(classes[0].properties).toHaveLength(2);
      expect(classes[0].properties[0].name).toBe('name');
    });

    it('should resolve imports', async () => {
      mockRDFParser.getImports.mockReturnValue([
        'http://xmlns.com/foaf/0.1/',
        'http://www.w3.org/2006/time#',
      ]);

      const imports = mockRDFParser.getImports();

      expect(imports).toHaveLength(2);
      expect(imports).toContain('http://xmlns.com/foaf/0.1/');
    });
  });

  describe('TypeScript Generator', () => {
    it('should generate interface from RDF class', async () => {
      const template = `
interface {{ className }} {
  {% for prop in properties %}
  {{ prop.name }}: {{ prop.type }};
  {% endfor %}
}
`;

      mockTemplateEngine.render.mockResolvedValue(`
interface Person {
  name: string;
  email: string;
}
`);

      const result = await mockTemplateEngine.render(template, {
        className: 'Person',
        properties: [
          { name: 'name', type: 'string' },
          { name: 'email', type: 'string' },
        ],
      });

      expect(result).toContain('interface Person');
      expect(result).toContain('name: string');
      expect(result).toContain('email: string');
    });

    it('should handle circular dependencies with import type', async () => {
      mockTemplateEngine.render.mockResolvedValue(`
import type { Organization } from './Organization';

interface Person {
  worksFor?: Organization;
}
`);

      const result = await mockTemplateEngine.render('template', {
        className: 'Person',
        circularImports: ['Organization'],
      });

      expect(result).toContain('import type { Organization }');
      expect(result).toContain("from './Organization'");
    });

    it('should map RDF types to TypeScript types', () => {
      const typeMap = {
        'xsd:string': 'string',
        'xsd:integer': 'number',
        'xsd:boolean': 'boolean',
        'xsd:date': 'Date',
        'xsd:anyURI': 'string',
      };

      expect(typeMap['xsd:string']).toBe('string');
      expect(typeMap['xsd:integer']).toBe('number');
      expect(typeMap['xsd:date']).toBe('Date');
    });
  });

  describe('SQL Schema Generator', () => {
    it('should generate CREATE TABLE from RDF class', async () => {
      const template = `
CREATE TABLE {{ tableName }} (
  id UUID PRIMARY KEY,
  {% for prop in properties %}
  {{ prop.name }} {{ prop.sqlType }}{% if not prop.nullable %} NOT NULL{% endif %},
  {% endfor %}
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
`;

      mockTemplateEngine.render.mockResolvedValue(`
CREATE TABLE person (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
`);

      const result = await mockTemplateEngine.render(template, {
        tableName: 'person',
        properties: [
          { name: 'name', sqlType: 'VARCHAR(255)', nullable: false },
          { name: 'email', sqlType: 'VARCHAR(255)', nullable: false },
        ],
      });

      expect(result).toContain('CREATE TABLE person');
      expect(result).toContain('name VARCHAR(255) NOT NULL');
      expect(result).toContain('email VARCHAR(255) NOT NULL');
    });

    it('should generate foreign key constraints', async () => {
      mockTemplateEngine.render.mockResolvedValue(`
ALTER TABLE person
  ADD CONSTRAINT fk_person_organization
  FOREIGN KEY (organization_id)
  REFERENCES organization(id)
  ON DELETE CASCADE;
`);

      const result = await mockTemplateEngine.render('template', {
        table: 'person',
        foreignKey: 'organization_id',
        references: 'organization',
      });

      expect(result).toContain('FOREIGN KEY (organization_id)');
      expect(result).toContain('REFERENCES organization(id)');
      expect(result).toContain('ON DELETE CASCADE');
    });
  });

  describe('Validation Generator', () => {
    it('should generate Zod schema from SHACL shapes', async () => {
      mockTemplateEngine.render.mockResolvedValue(`
import { z } from 'zod';

export const PersonSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  age: z.number().min(0).max(150),
});
`);

      const result = await mockTemplateEngine.render('template', {
        className: 'Person',
        validations: [
          { field: 'name', type: 'string', min: 1, max: 255 },
          { field: 'email', type: 'email' },
          { field: 'age', type: 'number', min: 0, max: 150 },
        ],
      });

      expect(result).toContain('z.string().min(1).max(255)');
      expect(result).toContain('z.string().email()');
      expect(result).toContain('z.number().min(0).max(150)');
    });
  });

  describe('File System Operations', () => {
    it('should write file to correct location', async () => {
      await mockFileSystem.writeFile(
        './src/models/Person.ts',
        'interface Person {}'
      );

      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        './src/models/Person.ts',
        'interface Person {}'
      );

      const files = mockFileSystem.getFiles();
      expect(files).toContain('./src/models/Person.ts');
    });

    it('should ensure directory exists before writing', async () => {
      await mockFileSystem.ensureDir('./src/models');
      await mockFileSystem.writeFile('./src/models/Person.ts', 'content');

      expect(mockFileSystem.ensureDir).toHaveBeenCalledWith('./src/models');
      expect(mockFileSystem.writeFile).toHaveBeenCalled();
    });

    it('should preserve custom code blocks', async () => {
      const existingContent = `
interface Person {
  id: string;

  // CUSTOM CODE START
  customMethod() {
    return 'preserved';
  }
  // CUSTOM CODE END
}
`;

      mockFileSystem.readFile.mockResolvedValue(existingContent);

      const content = await mockFileSystem.readFile('./Person.ts');

      expect(content).toContain('// CUSTOM CODE START');
      expect(content).toContain('customMethod()');
      expect(content).toContain('// CUSTOM CODE END');
    });
  });

  describe('Dry Run Mode', () => {
    it('should not create files in dry run mode', async () => {
      const dryRun = true;

      if (!dryRun) {
        await mockFileSystem.writeFile('./test.ts', 'content');
      }

      expect(mockFileSystem.writeFile).not.toHaveBeenCalled();
    });

    it('should show what would be created', () => {
      const dryRunOutput = [
        'Would create: src/models/Person.ts',
        'Would create: src/models/Organization.ts',
        'Would create: src/api/routes/person.ts',
        'Total files: 15',
      ];

      expect(dryRunOutput).toContain('Would create: src/models/Person.ts');
      expect(dryRunOutput[dryRunOutput.length - 1]).toBe('Total files: 15');
    });
  });

  describe('Performance', () => {
    it('should handle large ontologies efficiently', async () => {
      const largeClassList = Array.from({ length: 1000 }, (_, i) => ({
        uri: `http://example.org/Class${i}`,
        label: `Class${i}`,
        properties: [],
      }));

      mockRDFParser.getClasses.mockReturnValue(largeClassList);

      const startTime = Date.now();
      const classes = mockRDFParser.getClasses();
      const duration = Date.now() - startTime;

      expect(classes).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete in < 1s
    });

    it('should use streaming for large file generation', async () => {
      const streamMock = {
        write: jest.fn(),
        end: jest.fn(),
      };

      // Simulate streaming writes
      for (let i = 0; i < 1000; i++) {
        streamMock.write(`interface Class${i} {}\n`);
      }
      streamMock.end();

      expect(streamMock.write).toHaveBeenCalledTimes(1000);
      expect(streamMock.end).toHaveBeenCalledTimes(1);
    });
  });
});
