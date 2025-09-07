import { describe, it, expect, beforeEach } from 'vitest';
import { RDFSchemaAnalyzer, TypeScriptGenerator, ZodSchemaGenerator, RDFTypeConverter } from '../../src/lib/rdf-type-converter.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('RDF Type Converter', () => {
  let converter;
  let analyzer;
  let tsGenerator;
  let zodGenerator;

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
        foaf:Person a rdfs:Class .
      `;
      
      const result = await analyzer.parseTurtle(turtleContent);
      expect(result).toBeDefined();
    });

    it('should handle inheritance with subClassOf', async () => { 
      const turtleContent = `
        @prefix schema: <http://schema.org/> .
        schema:Person rdfs:subClassOf schema:Thing .
      `;
      
      const result = await analyzer.parseTurtle(turtleContent);
      expect(result).toBeDefined();
    });
  });

  describe('TypeScriptGenerator', () => { 
    it('should generate valid TypeScript interfaces', () => {
      const typeDefinitions = [
        {
          name: 'Person',
          properties: [{ name: 'name', type: 'string' }]
        }
      ];
            { name }
          ],
          extends: []
        }
      ];

      const result = tsGenerator.generateDefinitions(typeDefinitions);
      
      expect(result).toContain('export interface Person');
      expect(result).toContain('name);
      expect(result).toContain('age?);
      expect(result).toContain('A person');
      expect(result).toContain('@ontology FOAF');
    });

    it('should handle interface inheritance', () => { const typeDefinitions = [
        {
          name }
          ],
          extends: ['Person']
        }
      ];

      const result = tsGenerator.generateDefinitions(typeDefinitions);
      
      expect(result).toContain('export interface Employee extends Person');
      expect(result).toContain('jobTitle);
    });
  });

  describe('ZodSchemaGenerator', () => { it('should generate Zod schemas with validation', () => {
      const typeDefinitions = [
        {
          name }
            },
            { name }
            }
          ],
          extends: []
        }
      ];

      const result = zodGenerator.generateSchemas(typeDefinitions);
      
      expect(result).toContain('export const PersonSchema = z.object({');
      expect(result).toContain('email).email()');
      expect(result).toContain('age).min(0).max(150).optional()');
      expect(result).toContain('export ');
    });

    it('should handle string constraints', () => { const typeDefinitions = [
        {
          name }
            }
          ],
          extends: []
        }
      ];

      const result = zodGenerator.generateSchemas(typeDefinitions);
      
      expect(result).toContain('name).min(2).max(100)');
    });
  });

  describe('Full Cycle Integration', () => { it('should handle complete TTL to TypeScript conversion', async () => {
      const simpleTurtle = `
        @prefix foaf });
        
      } catch (error) {
        // Clean up on error
        await fs.unlink(tempFile).catch(() => {});
        await fs.rm('./temp-generated', { recursive: true, force }).catch(() => {});
        throw error;
      }
    });

    it('should generate validation helpers', () => { const typeDefinitions = [
        {
          name }
          ],
          extends: []
        }
      ];

      const helpers = converter.generateValidationHelpers(typeDefinitions);
      
      expect(helpers).toContain('export function validatePerson(data): Person');
      expect(helpers).toContain('export function isPerson(data): data is Person');
      expect(helpers).toContain('PersonSchema.parse(data)');
      expect(helpers).toContain('PersonSchema.safeParse(data).success');
    });
  });

  describe('Edge Cases', () => { it('should handle empty ontology', async () => {
      const emptyTurtle = `
        @prefix foaf });

    it('should handle complex property types', async () => { const complexTurtle = `
        @prefix schema });
  });
});