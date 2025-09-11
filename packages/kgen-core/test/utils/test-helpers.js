/**
 * Test Helpers for KGEN Core Testing
 * Provides utilities for creating deterministic test data and scenarios
 */

import crypto from 'crypto';
import fs from 'fs-extra';
import { resolve } from 'path';

export class TestHelpers {
  constructor() {
    this.tempDirs = [];
    this.createdFiles = [];
  }

  // RDF Test Data Generation

  createSampleRDF(entityType, name, additionalProps = {}) {
    const baseProps = {
      person: {
        type: 'Person',
        properties: {
          name,
          age: 30,
          email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
          ...additionalProps
        }
      },
      organization: {
        type: 'Organization',
        properties: {
          name,
          industry: 'Technology',
          foundedYear: 2020,
          ...additionalProps
        }
      },
      project: {
        type: 'Project',
        properties: {
          name,
          status: 'active',
          startDate: '2024-01-01',
          ...additionalProps
        }
      }
    };

    const entity = baseProps[entityType] || baseProps.person;
    const id = `entity:${entityType}:${this.normalizeId(name)}`;

    return `
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      
      ex:${this.normalizeId(name)} a ex:${entity.type} ;
        ${Object.entries(entity.properties)
          .map(([key, value]) => {
            const datatype = this.getXSDDatatype(value);
            const formattedValue = typeof value === 'string' 
              ? `"${value}"${datatype ? `^^${datatype}` : ''}`
              : `"${value}"${datatype ? `^^${datatype}` : ''}`;
            return `ex:has${this.capitalize(key)} ${formattedValue}`;
          })
          .join(' ;\n        ')} .
    `;
  }

  createComplexRDFGraph() {
    return `
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      
      # Person entities
      ex:john a ex:Person ;
        ex:hasName "John Doe" ;
        ex:hasAge "30"^^xsd:integer ;
        ex:hasEmail "john.doe@example.com" ;
        ex:worksFor ex:acme .
        
      ex:jane a ex:Person ;
        ex:hasName "Jane Smith" ;
        ex:hasAge "28"^^xsd:integer ;
        ex:hasEmail "jane.smith@example.com" ;
        ex:worksFor ex:acme .
        
      # Organization entities
      ex:acme a ex:Organization ;
        ex:hasName "ACME Corporation" ;
        ex:hasIndustry "Technology" ;
        ex:hasFoundedYear "2010"^^xsd:integer ;
        ex:hasEmployee ex:john, ex:jane .
        
      # Project entities
      ex:project1 a ex:Project ;
        ex:hasName "Knowledge Graph System" ;
        ex:hasStatus "active" ;
        ex:hasStartDate "2024-01-01"^^xsd:date ;
        ex:hasLeader ex:john ;
        ex:hasContributor ex:jane .
        
      # Relationships
      ex:john ex:manages ex:project1 .
      ex:jane ex:contributesTo ex:project1 .
      ex:project1 ex:belongsTo ex:acme .
    `;
  }

  // SHACL Validation Shapes

  createPersonValidationShape() {
    return `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      
      ex:PersonShape a sh:NodeShape ;
        sh:targetClass ex:Person ;
        sh:property [
          sh:path ex:hasName ;
          sh:datatype xsd:string ;
          sh:minCount 1 ;
          sh:maxCount 1 ;
          sh:minLength 2 ;
          sh:maxLength 100 ;
        ] ;
        sh:property [
          sh:path ex:hasAge ;
          sh:datatype xsd:integer ;
          sh:minCount 0 ;
          sh:maxCount 1 ;
          sh:minInclusive 0 ;
          sh:maxInclusive 150 ;
        ] ;
        sh:property [
          sh:path ex:hasEmail ;
          sh:datatype xsd:string ;
          sh:minCount 0 ;
          sh:maxCount 1 ;
          sh:pattern "^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$" ;
        ] .
    `;
  }

  createOrganizationValidationShape() {
    return `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      
      ex:OrganizationShape a sh:NodeShape ;
        sh:targetClass ex:Organization ;
        sh:property [
          sh:path ex:hasName ;
          sh:datatype xsd:string ;
          sh:minCount 1 ;
          sh:maxCount 1 ;
          sh:minLength 1 ;
          sh:maxLength 200 ;
        ] ;
        sh:property [
          sh:path ex:hasIndustry ;
          sh:datatype xsd:string ;
          sh:minCount 0 ;
          sh:maxCount 1 ;
          sh:in ( "Technology" "Healthcare" "Finance" "Education" "Manufacturing" ) ;
        ] ;
        sh:property [
          sh:path ex:hasFoundedYear ;
          sh:datatype xsd:integer ;
          sh:minCount 0 ;
          sh:maxCount 1 ;
          sh:minInclusive 1800 ;
          sh:maxInclusive 2024 ;
        ] .
    `;
  }

  // Template Helpers

  getPersonClassTemplate() {
    return `
      /**
       * {{ entity.type }} class generated from knowledge graph
       * Generated at: {{ metadata.generatedAt }}
       */
      class {{ entity.name | capitalize | replace(' ', '') }} {
        constructor(data = {}) {
          {% for property, value in entity.properties %}
          this.{{ property }} = data.{{ property }} || {{ value | jsonEncode }};
          {% endfor %}
        }
        
        // Getters
        {% for property in entity.properties %}
        get{{ property | capitalize }}() {
          return this.{{ property }};
        }
        
        {% endfor %}
        
        // Setters
        {% for property in entity.properties %}
        set{{ property | capitalize }}(value) {
          this.{{ property }} = value;
          return this;
        }
        
        {% endfor %}
        
        // Serialization
        toJSON() {
          return {
            {% for property in entity.properties %}
            {{ property }}: this.{{ property }},
            {% endfor %}
          };
        }
        
        toString() {
          return \`{{ entity.type }}: \${this.name || this.id}\`;
        }
      }
      
      module.exports = {{ entity.name | capitalize | replace(' ', '') }};
    `;
  }

  getAPIEndpointTemplate() {
    return `
      /**
       * {{ entity.type }} API endpoints
       * Generated from knowledge graph schema
       */
      const express = require('express');
      const router = express.Router();
      const {{ entity.name | capitalize | replace(' ', '') }} = require('../models/{{ entity.name | lower | replace(' ', '-') }}');
      
      // GET /api/{{ entity.name | lower | pluralize }}
      router.get('/', async (req, res) => {
        try {
          const items = await {{ entity.name | capitalize | replace(' ', '') }}.findAll(req.query);
          res.json(items);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
      
      // GET /api/{{ entity.name | lower | pluralize }}/:id
      router.get('/:id', async (req, res) => {
        try {
          const item = await {{ entity.name | capitalize | replace(' ', '') }}.findById(req.params.id);
          if (!item) {
            return res.status(404).json({ error: 'Not found' });
          }
          res.json(item);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
      
      // POST /api/{{ entity.name | lower | pluralize }}
      router.post('/', async (req, res) => {
        try {
          const item = await {{ entity.name | capitalize | replace(' ', '') }}.create(req.body);
          res.status(201).json(item);
        } catch (error) {
          res.status(400).json({ error: error.message });
        }
      });
      
      // PUT /api/{{ entity.name | lower | pluralize }}/:id
      router.put('/:id', async (req, res) => {
        try {
          const item = await {{ entity.name | capitalize | replace(' ', '') }}.update(req.params.id, req.body);
          if (!item) {
            return res.status(404).json({ error: 'Not found' });
          }
          res.json(item);
        } catch (error) {
          res.status(400).json({ error: error.message });
        }
      });
      
      // DELETE /api/{{ entity.name | lower | pluralize }}/:id
      router.delete('/:id', async (req, res) => {
        try {
          const deleted = await {{ entity.name | capitalize | replace(' ', '') }}.delete(req.params.id);
          if (!deleted) {
            return res.status(404).json({ error: 'Not found' });
          }
          res.status(204).send();
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
      
      module.exports = router;
    `;
  }

  // Test Data Factories

  createKnowledgeGraph(entities = [], relationships = []) {
    const triples = [];
    
    // Generate triples from entities
    entities.forEach(entity => {
      triples.push({
        subject: entity.id,
        predicate: 'rdf:type',
        object: `ex:${entity.type}`,
        graph_context: 'default'
      });
      
      Object.entries(entity.properties || {}).forEach(([key, value]) => {
        triples.push({
          subject: entity.id,
          predicate: `ex:has${this.capitalize(key)}`,
          object: typeof value === 'string' ? `"${value}"` : `"${value}"`,
          graph_context: 'default'
        });
      });
    });
    
    // Generate triples from relationships
    relationships.forEach(rel => {
      triples.push({
        subject: rel.subject,
        predicate: rel.predicate,
        object: rel.object,
        graph_context: rel.context || 'default'
      });
    });
    
    return {
      entities,
      relationships,
      triples,
      metadata: {
        generatedAt: new Date().toISOString(),
        entityCount: entities.length,
        relationshipCount: relationships.length,
        tripleCount: triples.length
      }
    };
  }

  createTestOperation(type, status = 'success') {
    const operationId = `test_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: operationId,
      type,
      status,
      input_hash: this.calculateHash({ type, timestamp: Date.now() }),
      output_hash: status === 'success' ? this.calculateHash({ result: 'success' }) : null,
      metadata: {
        user: 'test-user',
        startTime: Date.now(),
        endTime: status === 'success' ? Date.now() + 1000 : null
      }
    };
  }

  // File System Helpers

  async createTempFile(content, extension = '.txt') {
    const tempDir = global.testUtils?.outputDir || '/tmp';
    const filename = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${extension}`;
    const filepath = resolve(tempDir, filename);
    
    await fs.writeFile(filepath, content);
    this.createdFiles.push(filepath);
    
    return filepath;
  }

  async createTempDir() {
    const tempDir = global.testUtils?.createTempDir 
      ? await global.testUtils.createTempDir()
      : fs.mkdtemp('/tmp/kgen-test-');
    
    this.tempDirs.push(tempDir);
    return tempDir;
  }

  // Utility Methods

  normalizeId(name) {
    return name.toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  getXSDDatatype(value) {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'xsd:integer' : 'xsd:decimal';
    }
    if (typeof value === 'boolean') {
      return 'xsd:boolean';
    }
    if (value instanceof Date) {
      return 'xsd:dateTime';
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return 'xsd:date';
    }
    return null; // String values don't need explicit datatype
  }

  calculateHash(data) {
    const serialized = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  // Determinism Helpers

  createDeterministicSeed(input) {
    return crypto.createHash('md5').update(input).digest('hex');
  }

  generateDeterministicId(type, name) {
    const seed = this.createDeterministicSeed(`${type}:${name}`);
    return `${type}:${seed.substr(0, 8)}`;
  }

  // Performance Helpers

  async measurePerformance(operation, iterations = 1) {
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();
      
      try {
        const result = await operation();
        
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        
        results.push({
          iteration: i + 1,
          success: true,
          duration: Number(endTime - startTime) / 1000000, // Convert to milliseconds
          memory: {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            external: endMemory.external - startMemory.external
          },
          result
        });
      } catch (error) {
        results.push({
          iteration: i + 1,
          success: false,
          error: error.message,
          duration: Number(process.hrtime.bigint() - startTime) / 1000000
        });
      }
    }
    
    return this.calculatePerformanceStats(results);
  }

  calculatePerformanceStats(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    if (successful.length === 0) {
      return {
        totalIterations: results.length,
        successfulIterations: 0,
        failedIterations: failed.length,
        averageDuration: 0,
        errors: failed.map(f => f.error)
      };
    }
    
    const durations = successful.map(r => r.duration);
    const memoryUsages = successful.map(r => r.memory.heapUsed);
    
    return {
      totalIterations: results.length,
      successfulIterations: successful.length,
      failedIterations: failed.length,
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      standardDeviation: this.calculateStandardDeviation(durations),
      averageMemoryUsage: memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length,
      errors: failed.map(f => f.error)
    };
  }

  calculateStandardDeviation(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / squaredDiffs.length;
    return Math.sqrt(avgSquaredDiff);
  }

  // Cleanup

  async cleanup() {
    // Cleanup created files
    for (const filepath of this.createdFiles) {
      try {
        if (await fs.pathExists(filepath)) {
          await fs.remove(filepath);
        }
      } catch (error) {
        console.warn(`Failed to cleanup file ${filepath}:`, error.message);
      }
    }
    
    // Cleanup temp directories
    for (const dir of this.tempDirs) {
      try {
        if (await fs.pathExists(dir)) {
          await fs.remove(dir);
        }
      } catch (error) {
        console.warn(`Failed to cleanup directory ${dir}:`, error.message);
      }
    }
    
    this.createdFiles = [];
    this.tempDirs = [];
  }
}