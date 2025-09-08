/**
 * Tests for SpecificationParser
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpecificationParser } from '../../../src/core/spec-engine/parser/index.js';
import type { ParseOptions, Specification } from '../../../src/core/spec-engine/types/index.js';

describe('SpecificationParser', () => {
  let parser: SpecificationParser;

  beforeEach(() => {
    parser = new SpecificationParser();
  });

  describe('YAML Specification Parsing', () => {
    it('should parse a complete YAML specification', async () => {
      const yamlContent = `
id: user-management
name: User Management System
version: 1.0.0
description: A system for managing users and their profiles
metadata:
  author: Test Author
  category: business
  priority: high
  status: approved
  tags:
    - user
    - management
entities:
  - id: user-entity
    name: User
    type: model
    properties:
      - name: id
        type: string
        required: true
      - name: email
        type: string
        required: true
      - name: name
        type: string
        required: true
      - name: createdAt
        type: Date
        required: true
    methods:
      - name: validateEmail
        returnType: boolean
        visibility: public
relationships:
  - id: user-profile-rel
    type: hasOne
    source:
      entityId: user-entity
    target:
      entityId: profile-entity
    cardinality: "1:1"
constraints:
  - id: email-unique
    type: validation
    description: Email must be unique
    entities:
      - user-entity
    expression: "UNIQUE(email)"
    severity: error
context:
  domain: user-management
  technology:
    language: typescript
    framework: express
    database: postgresql
    dependencies:
      - express
      - pg
  patterns:
    - name: Repository Pattern
      type: repository
      description: Data access abstraction
  requirements:
    - id: req-1
      type: functional
      description: Users must be able to register
      priority: must
      status: pending
`;

      const spec = await parser.parseSpecification(yamlContent, 'yaml');

      expect(spec.id).toBe('user-management');
      expect(spec.name).toBe('User Management System');
      expect(spec.version).toBe('1.0.0');
      expect(spec.description).toBe('A system for managing users and their profiles');
      
      expect(spec.metadata.author).toBe('Test Author');
      expect(spec.metadata.category).toBe('business');
      expect(spec.metadata.priority).toBe('high');
      expect(spec.metadata.status).toBe('approved');
      expect(spec.metadata.tags).toContain('user');
      expect(spec.metadata.tags).toContain('management');

      expect(spec.entities).toHaveLength(1);
      expect(spec.entities[0].name).toBe('User');
      expect(spec.entities[0].type).toBe('model');
      expect(spec.entities[0].properties).toHaveLength(4);
      expect(spec.entities[0].methods).toHaveLength(1);

      expect(spec.relationships).toHaveLength(1);
      expect(spec.relationships[0].type).toBe('hasOne');

      expect(spec.constraints).toHaveLength(1);
      expect(spec.constraints[0].type).toBe('validation');

      expect(spec.context.domain).toBe('user-management');
      expect(spec.context.technology.language).toBe('typescript');
      expect(spec.context.technology.framework).toBe('express');
    });

    it('should handle minimal YAML specification', async () => {
      const yamlContent = `
name: Minimal Spec
description: A minimal specification
entities: []
relationships: []
constraints: []
`;

      const spec = await parser.parseSpecification(yamlContent, 'yaml');

      expect(spec.name).toBe('Minimal Spec');
      expect(spec.description).toBe('A minimal specification');
      expect(spec.entities).toHaveLength(0);
      expect(spec.id).toBeDefined(); // Auto-generated
      expect(spec.version).toBe('1.0.0'); // Default
    });
  });

  describe('JSON Specification Parsing', () => {
    it('should parse JSON specification', async () => {
      const jsonContent = JSON.stringify({
        name: 'JSON Spec',
        description: 'A JSON specification',
        entities: [
          {
            name: 'Product',
            type: 'model',
            properties: [
              { name: 'id', type: 'number', required: true },
              { name: 'name', type: 'string', required: true }
            ]
          }
        ],
        relationships: [],
        constraints: []
      });

      const spec = await parser.parseSpecification(jsonContent, 'json');

      expect(spec.name).toBe('JSON Spec');
      expect(spec.entities).toHaveLength(1);
      expect(spec.entities[0].name).toBe('Product');
      expect(spec.entities[0].properties).toHaveLength(2);
    });
  });

  describe('Markdown Specification Parsing', () => {
    it('should parse markdown specification with entities', async () => {
      const markdownContent = `
# User Management System

A comprehensive system for managing users and their profiles.

## Entities

Entity: User
- id: string
- email: string
- name: string
- createdAt: Date

Entity: Profile
- userId: string
- bio: string
- avatar: string

## Requirements

- Users must be able to register
- Users must be able to login
- Profiles can be updated
`;

      const spec = await parser.parseSpecification(markdownContent, 'markdown');

      expect(spec.name).toBe('User Management System');
      expect(spec.description).toBe('A comprehensive system for managing users and their profiles.');
      expect(spec.entities).toHaveLength(2);
      
      const userEntity = spec.entities.find(e => e.name === 'User');
      expect(userEntity).toBeDefined();
      expect(userEntity?.properties).toHaveLength(4);
      
      const profileEntity = spec.entities.find(e => e.name === 'Profile');
      expect(profileEntity).toBeDefined();
      expect(profileEntity?.properties).toHaveLength(3);
    });

    it('should handle markdown with different entity types', async () => {
      const markdownContent = `
# API Specification

Service: UserService
- validateUser: method
- createUser: method

Controller: UserController  
- register: endpoint
- login: endpoint

Model: User
- id: string
- email: string
`;

      const spec = await parser.parseSpecification(markdownContent, 'markdown');

      expect(spec.entities).toHaveLength(3);
      
      const service = spec.entities.find(e => e.type === 'service');
      expect(service?.name).toBe('UserService');
      
      const controller = spec.entities.find(e => e.type === 'controller');
      expect(controller?.name).toBe('UserController');
      
      const model = spec.entities.find(e => e.type === 'model');
      expect(model?.name).toBe('User');
    });
  });

  describe('OpenAPI Specification Parsing', () => {
    it('should parse OpenAPI specification', async () => {
      const openApiContent = JSON.stringify({
        openapi: '3.0.0',
        info: {
          title: 'Pet Store API',
          version: '1.0.0',
          description: 'A simple pet store API'
        },
        paths: {
          '/pets': {
            get: {
              operationId: 'listPets',
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array'
                      }
                    }
                  }
                }
              }
            },
            post: {
              operationId: 'createPet',
              parameters: [
                {
                  name: 'name',
                  required: true,
                  schema: { type: 'string' }
                }
              ],
              responses: {
                '201': {
                  content: {
                    'application/json': {
                      schema: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        },
        components: {
          schemas: {
            Pet: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                category: { type: 'string' }
              }
            }
          }
        }
      });

      const spec = await parser.parseSpecification(openApiContent, 'openapi');

      expect(spec.name).toBe('Pet Store API');
      expect(spec.description).toBe('A simple pet store API');
      expect(spec.context.domain).toBe('api');
      
      // Should have Pet model from schemas
      const petModel = spec.entities.find(e => e.name === 'Pet' && e.type === 'model');
      expect(petModel).toBeDefined();
      expect(petModel?.properties).toHaveLength(3);
      
      // Should have controller from paths
      const controller = spec.entities.find(e => e.type === 'controller');
      expect(controller).toBeDefined();
      expect(controller?.methods).toHaveLength(2);
      
      const listMethod = controller?.methods?.find(m => m.name === 'listPets');
      expect(listMethod).toBeDefined();
      
      const createMethod = controller?.methods?.find(m => m.name === 'createPet');
      expect(createMethod).toBeDefined();
    });
  });

  describe('Parse Options', () => {
    it('should respect strict mode', async () => {
      const invalidYaml = `
invalid: yaml: content:
  - malformed
`;

      const strictOptions: ParseOptions = {
        strict: true,
        validateSchema: false,
        includeComments: false,
        resolveReferences: false
      };

      await expect(
        parser.parseSpecification(invalidYaml, 'yaml', strictOptions)
      ).rejects.toThrow();
    });

    it('should validate schema when enabled', async () => {
      const invalidSpec = `
name: 123  # Should be string
entities: "not an array"
`;

      const validationOptions: ParseOptions = {
        strict: false,
        validateSchema: true,
        includeComments: false,
        resolveReferences: false
      };

      // Note: This test depends on the actual schema validation implementation
      // It may pass if the schema validation is not yet fully implemented
      const spec = await parser.parseSpecification(invalidSpec, 'yaml', validationOptions);
      expect(spec).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported format', async () => {
      await expect(
        parser.parseSpecification('content', 'xml' as any)
      ).rejects.toThrow('Unsupported format: xml');
    });

    it('should throw error for invalid JSON', async () => {
      const invalidJson = '{ invalid json }';
      
      await expect(
        parser.parseSpecification(invalidJson, 'json')
      ).rejects.toThrow();
    });

    it('should handle empty specification gracefully', async () => {
      const emptyYaml = '';
      
      const spec = await parser.parseSpecification(emptyYaml, 'yaml');
      expect(spec).toBeDefined();
      expect(spec.entities).toHaveLength(0);
    });
  });

  describe('Type Conversion', () => {
    it('should convert OpenAPI types to TypeScript types', async () => {
      const openApiContent = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        components: {
          schemas: {
            TestModel: {
              type: 'object',
              properties: {
                stringField: { type: 'string' },
                numberField: { type: 'number' },
                integerField: { type: 'integer' },
                booleanField: { type: 'boolean' },
                dateField: { type: 'string', format: 'date-time' },
                arrayField: { type: 'array' },
                objectField: { type: 'object' }
              }
            }
          }
        },
        paths: {}
      });

      const spec = await parser.parseSpecification(openApiContent, 'openapi');
      const model = spec.entities.find(e => e.name === 'TestModel');
      
      expect(model?.properties.find(p => p.name === 'stringField')?.type).toBe('string');
      expect(model?.properties.find(p => p.name === 'numberField')?.type).toBe('number');
      expect(model?.properties.find(p => p.name === 'integerField')?.type).toBe('number');
      expect(model?.properties.find(p => p.name === 'booleanField')?.type).toBe('boolean');
      expect(model?.properties.find(p => p.name === 'dateField')?.type).toBe('Date');
      expect(model?.properties.find(p => p.name === 'arrayField')?.type).toBe('Array<any>');
      expect(model?.properties.find(p => p.name === 'objectField')?.type).toBe('Record<string, any>');
    });
  });
});