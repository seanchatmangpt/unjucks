import { describe, it, expect, beforeEach } from 'vitest';
import { RDFSchemaAnalyzer, TypeScriptGenerator, ZodSchemaGenerator, RDFTypeConverter } from '../../src/lib/rdf-type-converter.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('RDF Type Converter', () => {
  let converter: RDFTypeConverter;
  let analyzer: RDFSchemaAnalyzer;
  let tsGenerator: TypeScriptGenerator;
  let zodGenerator: ZodSchemaGenerator;

  beforeEach(() => {
    converter = new RDFTypeConverter();
    analyzer = new RDFSchemaAnalyzer();
    tsGenerator = new TypeScriptGenerator();
    zodGenerator = new ZodSchemaGenerator();
  });

  describe('RDFSchemaAnalyzer', () => {
    it('should parse simple FOAF ontology', async () => {
      const turtleContent = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        foaf:Person a owl:Class ;
            rdfs:comment "A person" .

        foaf:name a owl:DatatypeProperty ;
            rdfs:domain foaf:Person ;
            rdfs:range xsd:string .
      `;

      const types = await analyzer.analyzeTurtleContent(turtleContent);
      
      expect(types).toHaveLength(1);
      expect(types[0].name).toBe('Person');
      expect(types[0].ontology).toBe('FOAF');
      expect(types[0].properties).toHaveLength(1);
      expect(types[0].properties[0].name).toBe('name');
      expect(types[0].properties[0].type).toBe('string');
    });

    it('should handle inheritance with subClassOf', async () => {
      const turtleContent = `
        @prefix schema: <https://schema.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .

        foaf:Person a owl:Class .
        schema:Employee a owl:Class ;
            rdfs:subClassOf foaf:Person .
      `;

      const types = await analyzer.analyzeTurtleContent(turtleContent);
      
      const employeeType = types.find(t => t.name === 'Employee');
      expect(employeeType).toBeDefined();
      expect(employeeType?.extends).toEqual(['Person']);
    });
  });

  describe('TypeScriptGenerator', () => {
    it('should generate valid TypeScript interfaces', () => {
      const typeDefinitions = [
        {
          name: 'Person',
          uri: 'http://xmlns.com/foaf/0.1/Person',
          description: 'A person',
          ontology: 'FOAF',
          properties: [
            {
              name: 'name',
              uri: 'http://xmlns.com/foaf/0.1/name',
              type: 'string' as const,
              required: true,
              description: 'Full name'
            },
            {
              name: 'age',
              uri: 'http://xmlns.com/foaf/0.1/age',
              type: 'number' as const,
              required: false
            }
          ],
          extends: []
        }
      ];

      const result = tsGenerator.generateDefinitions(typeDefinitions);
      
      expect(result).toContain('export interface Person');
      expect(result).toContain('name: string;');
      expect(result).toContain('age?: number;');
      expect(result).toContain('A person');
      expect(result).toContain('@ontology FOAF');
    });

    it('should handle interface inheritance', () => {
      const typeDefinitions = [
        {
          name: 'Employee',
          uri: 'https://schema.org/Employee',
          description: 'An employee',
          ontology: 'Schema.org',
          properties: [
            {
              name: 'jobTitle',
              uri: 'https://schema.org/jobTitle',
              type: 'string' as const,
              required: true
            }
          ],
          extends: ['Person']
        }
      ];

      const result = tsGenerator.generateDefinitions(typeDefinitions);
      
      expect(result).toContain('export interface Employee extends Person');
      expect(result).toContain('jobTitle: string;');
    });
  });

  describe('ZodSchemaGenerator', () => {
    it('should generate Zod schemas with validation', () => {
      const typeDefinitions = [
        {
          name: 'Person',
          uri: 'http://xmlns.com/foaf/0.1/Person',
          description: 'A person',
          ontology: 'FOAF',
          properties: [
            {
              name: 'email',
              uri: 'http://xmlns.com/foaf/0.1/email',
              type: 'string' as const,
              required: true,
              constraints: {
                format: 'email' as const
              }
            },
            {
              name: 'age',
              uri: 'http://xmlns.com/foaf/0.1/age',
              type: 'number' as const,
              required: false,
              constraints: {
                minimum: 0,
                maximum: 150
              }
            }
          ],
          extends: []
        }
      ];

      const result = zodGenerator.generateSchemas(typeDefinitions);
      
      expect(result).toContain('export const PersonSchema = z.object({');
      expect(result).toContain('email: z.string().email()');
      expect(result).toContain('age: z.number().min(0).max(150).optional()');
      expect(result).toContain('export type Person = z.infer<typeof PersonSchema>;');
    });

    it('should handle string constraints', () => {
      const typeDefinitions = [
        {
          name: 'Product',
          uri: 'https://schema.org/Product',
          description: 'A product',
          ontology: 'Schema.org',
          properties: [
            {
              name: 'name',
              uri: 'https://schema.org/name',
              type: 'string' as const,
              required: true,
              constraints: {
                minLength: 2,
                maxLength: 100
              }
            }
          ],
          extends: []
        }
      ];

      const result = zodGenerator.generateSchemas(typeDefinitions);
      
      expect(result).toContain('name: z.string().min(2).max(100)');
    });
  });

  describe('Full Cycle Integration', () => {
    it('should handle complete TTL to TypeScript conversion', async () => {
      const simpleTurtle = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        foaf:Person a owl:Class ;
            rdfs:comment "A person" .

        foaf:name a owl:DatatypeProperty ;
            rdfs:domain foaf:Person ;
            rdfs:range xsd:string ;
            rdfs:comment "Person's name" .

        foaf:age a owl:DatatypeProperty ;
            rdfs:domain foaf:Person ;
            rdfs:range xsd:integer ;
            rdfs:comment "Person's age" .
      `;

      // Write temporary turtle file
      const tempFile = path.join(process.cwd(), 'temp-test.ttl');
      await fs.writeFile(tempFile, simpleTurtle);

      try {
        const result = await converter.convertTurtleToTypeScript(tempFile, './temp-generated');
        
        expect(result.definitions).toHaveLength(1);
        expect(result.definitions[0].name).toBe('Person');
        expect(result.definitions[0].properties).toHaveLength(2);
        
        expect(result.types).toContain('export interface Person');
        expect(result.schemas).toContain('export const PersonSchema = z.object({');
        
        // Clean up
        await fs.unlink(tempFile);
        await fs.rm('./temp-generated', { recursive: true, force: true });
        
      } catch (error) {
        // Clean up on error
        await fs.unlink(tempFile).catch(() => {});
        await fs.rm('./temp-generated', { recursive: true, force: true }).catch(() => {});
        throw error;
      }
    });

    it('should generate validation helpers', () => {
      const typeDefinitions = [
        {
          name: 'Person',
          uri: 'http://xmlns.com/foaf/0.1/Person',
          description: 'A person',
          ontology: 'FOAF',
          properties: [
            {
              name: 'name',
              uri: 'http://xmlns.com/foaf/0.1/name',
              type: 'string' as const,
              required: true
            }
          ],
          extends: []
        }
      ];

      const helpers = converter.generateValidationHelpers(typeDefinitions);
      
      expect(helpers).toContain('export function validatePerson(data: unknown): Person');
      expect(helpers).toContain('export function isPerson(data: unknown): data is Person');
      expect(helpers).toContain('PersonSchema.parse(data)');
      expect(helpers).toContain('PersonSchema.safeParse(data).success');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty ontology', async () => {
      const emptyTurtle = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      `;

      const types = await analyzer.analyzeTurtleContent(emptyTurtle);
      expect(types).toHaveLength(0);
    });

    it('should handle complex property types', async () => {
      const complexTurtle = `
        @prefix schema: <https://schema.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .

        schema:Person a owl:Class .
        schema:Organization a owl:Class .

        schema:worksFor a owl:ObjectProperty ;
            rdfs:domain schema:Person ;
            rdfs:range schema:Organization .
      `;

      const types = await analyzer.analyzeTurtleContent(complexTurtle);
      
      const personType = types.find(t => t.name === 'Person');
      const worksForProp = personType?.properties.find(p => p.name === 'worksFor');
      
      expect(worksForProp).toBeDefined();
      expect(worksForProp?.type).toEqual({ interface: 'Organization' });
    });
  });
});