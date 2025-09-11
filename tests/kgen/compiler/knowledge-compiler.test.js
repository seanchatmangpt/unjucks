/**
 * Test suite for Knowledge Compiler
 * Tests RDF graph + N3 rules → compiled template context transformation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KnowledgeCompiler } from '../../../packages/kgen-core/src/compiler/knowledge-compiler.js';

describe('KnowledgeCompiler', () => {
  let compiler;
  
  beforeEach(async () => {
    compiler = new KnowledgeCompiler({
      enableCaching: true,
      maxRuleIterations: 10,
      reasoningTimeout: 5000
    });
  });
  
  afterEach(() => {
    compiler?.clearCaches();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const result = await compiler.initialize();
      
      expect(result).toEqual({
        status: 'success',
        component: 'knowledge-compiler'
      });
      expect(compiler.initialized).toBe(true);
    });

    it('should set up core components', async () => {
      await compiler.initialize();
      
      expect(compiler.ruleEngine).toBeDefined();
      expect(compiler.variableExtractor).toBeDefined();
      expect(compiler.contextOptimizer).toBeDefined();
      expect(compiler.contextCache).toBeDefined();
    });
  });

  describe('RDF Graph Processing', () => {
    const sampleRDFGraph = {
      triples: [
        {
          subject: 'http://unjucks.dev/api/User',
          predicate: 'http://unjucks.dev/template/hasVariable',
          object: { type: 'literal', value: 'userName' }
        },
        {
          subject: 'http://unjucks.dev/api/User',
          predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
          object: { type: 'uri', value: 'http://www.w3.org/2001/XMLSchema#string' }
        },
        {
          subject: 'http://unjucks.dev/api/User',
          predicate: 'http://www.w3.org/2000/01/rdf-schema#comment',
          object: { type: 'literal', value: 'User name for authentication' }
        }
      ]
    };

    it('should extract template variables from RDF graph', async () => {
      const context = await compiler.compileContext(sampleRDFGraph, []);
      
      expect(context.variables).toBeDefined();
      expect(context.variables.userName).toEqual({
        name: 'userName',
        entity: 'http://unjucks.dev/api/User',
        type: 'string',
        required: false,
        default: null,
        description: 'User name for authentication',
        constraints: []
      });
    });

    it('should handle different RDF data types correctly', async () => {
      const graphWithTypes = {
        triples: [
          {
            subject: 'http://unjucks.dev/data/count',
            predicate: 'http://unjucks.dev/template/hasVariable',
            object: { type: 'literal', value: 'itemCount' }
          },
          {
            subject: 'http://unjucks.dev/data/count',
            predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
            object: { type: 'uri', value: 'http://www.w3.org/2001/XMLSchema#integer' }
          }
        ]
      };

      const context = await compiler.compileContext(graphWithTypes, []);
      
      expect(context.variables.itemCount.type).toBe('number');
    });

    it('should extract API variables from knowledge graph', async () => {
      const apiGraph = {
        triples: [
          {
            subject: 'http://unjucks.dev/service/auth',
            predicate: 'http://unjucks.dev/api/hasEndpoint',
            object: { type: 'uri', value: 'http://api.example.com/auth/login' }
          }
        ]
      };

      const context = await compiler.compileContext(apiGraph, []);
      
      expect(context.variables['api.login']).toEqual({
        name: 'login',
        type: 'object',
        source: 'api',
        endpoint: 'http://api.example.com/auth/login'
      });
    });

    it('should extract data variables from knowledge graph', async () => {
      const dataGraph = {
        triples: [
          {
            subject: 'http://unjucks.dev/model/User',
            predicate: 'http://unjucks.dev/data/hasField',
            object: { type: 'literal', value: 'email' }
          }
        ]
      };

      const context = await compiler.compileContext(dataGraph, []);
      
      expect(context.variables['data.email']).toEqual({
        name: 'email',
        type: 'string',
        source: 'data',
        entity: 'http://unjucks.dev/model/User'
      });
    });
  });

  describe('N3 Rule Processing', () => {
    const sampleGraph = {
      triples: [
        {
          subject: 'http://unjucks.dev/template/UserAPI',
          predicate: 'http://unjucks.dev/api/generatesEndpoint',
          object: { type: 'literal', value: 'true', datatype: 'http://www.w3.org/2001/XMLSchema#boolean' }
        },
        {
          subject: 'http://unjucks.dev/template/UserAPI',
          predicate: 'http://unjucks.dev/api/isPublic',
          object: { type: 'literal', value: 'true', datatype: 'http://www.w3.org/2001/XMLSchema#boolean' }
        }
      ]
    };

    const sampleRules = [
      {
        body: `{
          ?template <http://unjucks.dev/api/generatesEndpoint> true .
          ?template <http://unjucks.dev/api/isPublic> true
        } => {
          ?template <http://unjucks.dev/api/requiresAuthentication> true .
          ?template <http://unjucks.dev/security/threatLevel> "high"
        }`
      }
    ];

    it('should process N3 rules to infer new facts', async () => {
      const context = await compiler.compileContext(sampleGraph, sampleRules);
      
      expect(context.facts).toBeDefined();
      expect(context.facts['http://unjucks.dev/template/UserAPI']).toEqual({
        'http://unjucks.dev/api/requiresAuthentication': true,
        'http://unjucks.dev/security/threatLevel': 'high'
      });
    });

    it('should handle multiple rule iterations', async () => {
      const iterativeRules = [
        {
          body: `{
            ?template <http://unjucks.dev/api/requiresAuthentication> true
          } => {
            ?template <http://unjucks.dev/api/requiresAuthorization> true
          }`
        },
        {
          body: `{
            ?template <http://unjucks.dev/api/requiresAuthorization> true
          } => {
            ?template <http://unjucks.dev/api/requiresRateLimiting> true
          }`
        }
      ];

      const context = await compiler.compileContext(sampleGraph, [...sampleRules, ...iterativeRules]);
      
      const templateFacts = context.facts['http://unjucks.dev/template/UserAPI'];
      expect(templateFacts['http://unjucks.dev/api/requiresAuthentication']).toBe(true);
      expect(templateFacts['http://unjucks.dev/api/requiresAuthorization']).toBe(true);
      expect(templateFacts['http://unjucks.dev/api/requiresRateLimiting']).toBe(true);
    });

    it('should respect maximum rule iterations', async () => {
      // Create a potentially infinite rule loop
      const loopingRules = Array.from({ length: 20 }, (_, i) => ({
        body: `{
          ?template <http://unjucks.dev/test/step${i}> true
        } => {
          ?template <http://unjucks.dev/test/step${i + 1}> true
        }`
      }));

      const loopGraph = {
        triples: [{
          subject: 'http://unjucks.dev/template/Test',
          predicate: 'http://unjucks.dev/test/step0',
          object: { type: 'literal', value: 'true', datatype: 'http://www.w3.org/2001/XMLSchema#boolean' }
        }]
      };

      // Should not hang due to max iterations limit
      const context = await compiler.compileContext(loopGraph, loopingRules);
      expect(context).toBeDefined();
    });
  });

  describe('Context Optimization', () => {
    const complexGraph = {
      triples: [
        {
          subject: 'http://unjucks.dev/api/User',
          predicate: 'http://unjucks.dev/template/hasVariable',
          object: { type: 'literal', value: 'user' }
        },
        {
          subject: 'http://unjucks.dev/api/User',
          predicate: 'http://unjucks.dev/data/hasField',
          object: { type: 'literal', value: 'profile' }
        }
      ]
    };

    it('should flatten context for easier template access', async () => {
      const context = await compiler.compileContext(complexGraph, [], { 
        flattenStructures: true 
      });
      
      expect(context.flat).toBeDefined();
      expect(context.flat['variables.user']).toBeDefined();
      expect(context.flat['metadata.compiledAt']).toBeDefined();
    });

    it('should precompute common template expressions', async () => {
      const context = await compiler.compileContext(complexGraph, [], { 
        precomputeExpressions: true 
      });
      
      expect(context.computed).toBeDefined();
      expect(typeof context.computed.isEmpty).toBe('function');
      expect(typeof context.computed.count).toBe('function');
      expect(Array.isArray(context.computed.keys({}))).toBe(true);
    });

    it('should add computed properties', async () => {
      const context = await compiler.compileContext(complexGraph, []);
      
      expect(context.computed).toBeDefined();
      expect(context.computed.variableNames).toEqual(['user', 'data.profile']);
      expect(typeof context.computed.factCount).toBe('number');
      expect(typeof context.computed.hasAPI).toBe('boolean');
      expect(typeof context.computed.hasData).toBe('boolean');
    });

    it('should remove metadata in compact mode', async () => {
      const compactCompiler = new KnowledgeCompiler({
        compactOutput: true,
        includeMetadata: false
      });
      await compactCompiler.initialize();

      const context = await compactCompiler.compileContext(complexGraph, []);
      
      expect(context.metadata).toBeUndefined();
    });
  });

  describe('Performance and Caching', () => {
    const testGraph = {
      triples: [
        {
          subject: 'http://unjucks.dev/test/entity',
          predicate: 'http://unjucks.dev/template/hasVariable',
          object: { type: 'literal', value: 'testVar' }
        }
      ]
    };

    it('should cache compiled contexts', async () => {
      await compiler.compileContext(testGraph, []);
      const metrics1 = compiler.getMetrics();
      
      await compiler.compileContext(testGraph, []); // Same input, should hit cache
      const metrics2 = compiler.getMetrics();
      
      expect(metrics2.cacheHits).toBeGreaterThan(metrics1.cacheHits);
    });

    it('should track compilation metrics', async () => {
      const context = await compiler.compileContext(testGraph, []);
      const metrics = compiler.getMetrics();
      
      expect(metrics.compilationTime).toBeGreaterThan(0);
      expect(metrics.variablesExtracted).toBe(1);
      expect(metrics.rulesProcessed).toBe(0);
      expect(metrics.factsInferred).toBe(0);
    });

    it('should emit compilation events', async () => {
      let compiledEvent = null;
      
      compiler.on('context:compiled', (event) => {
        compiledEvent = event;
      });
      
      await compiler.compileContext(testGraph, []);
      
      expect(compiledEvent).toBeDefined();
      expect(compiledEvent.context).toBeDefined();
      expect(compiledEvent.metrics).toBeDefined();
      expect(compiledEvent.compilationId).toBeDefined();
    });

    it('should handle compilation errors gracefully', async () => {
      const invalidGraph = {
        triples: [
          {
            subject: null, // Invalid subject
            predicate: 'http://unjucks.dev/template/hasVariable',
            object: { type: 'literal', value: 'testVar' }
          }
        ]
      };

      let errorEvent = null;
      
      compiler.on('context:error', (event) => {
        errorEvent = event;
      });

      await expect(compiler.compileContext(invalidGraph, [])).rejects.toThrow();
      expect(errorEvent).toBeDefined();
    });

    it('should clear caches when requested', async () => {
      await compiler.compileContext(testGraph, []);
      
      expect(compiler.contextCache.size).toBeGreaterThan(0);
      
      compiler.clearCaches();
      
      expect(compiler.contextCache.size).toBe(0);
    });
  });

  describe('Rule Pattern Matching', () => {
    it('should parse N3 rule conditions and conclusions', async () => {
      const rule = {
        body: `{
          ?template <http://unjucks.dev/api/generatesEndpoint> true .
          ?template <http://unjucks.dev/api/isPublic> true
        } => {
          ?template <http://unjucks.dev/api/requiresAuthentication> true
        }`
      };

      const { conditions, conclusions } = compiler._parseN3Rule(rule);
      
      expect(conditions).toHaveLength(2);
      expect(conclusions).toHaveLength(1);
      
      expect(conditions[0].subject).toBe('?template');
      expect(conditions[0].predicate).toBe('<http://unjucks.dev/api/generatesEndpoint>');
      expect(conditions[0].object).toBe('true');
    });

    it('should handle variable bindings correctly', async () => {
      const pattern = {
        subject: '?template',
        predicate: '<http://unjucks.dev/api/type>',
        object: '?type'
      };
      
      const binding = {
        '?template': 'http://unjucks.dev/template/UserAPI'
      };
      
      const boundPattern = compiler._applyBinding(pattern, binding);
      
      expect(boundPattern.subject).toBe('http://unjucks.dev/template/UserAPI');
      expect(boundPattern.predicate).toBe('<http://unjucks.dev/api/type>');
      expect(boundPattern.object).toBe('?type');
    });
  });

  describe('Data Type Mapping', () => {
    it('should map RDF types to JavaScript types correctly', () => {
      expect(compiler._mapRDFTypeToJavaScript('http://www.w3.org/2001/XMLSchema#string')).toBe('string');
      expect(compiler._mapRDFTypeToJavaScript('http://www.w3.org/2001/XMLSchema#integer')).toBe('number');
      expect(compiler._mapRDFTypeToJavaScript('http://www.w3.org/2001/XMLSchema#boolean')).toBe('boolean');
      expect(compiler._mapRDFTypeToJavaScript('http://www.w3.org/2001/XMLSchema#date')).toBe('Date');
      expect(compiler._mapRDFTypeToJavaScript('http://example.com/custom')).toBe('string'); // fallback
    });

    it('should parse RDF literal values correctly', () => {
      const stringLiteral = { termType: 'Literal', value: 'hello', datatype: { value: 'http://www.w3.org/2001/XMLSchema#string' }};
      const integerLiteral = { termType: 'Literal', value: '42', datatype: { value: 'http://www.w3.org/2001/XMLSchema#integer' }};
      const booleanLiteral = { termType: 'Literal', value: 'true', datatype: { value: 'http://www.w3.org/2001/XMLSchema#boolean' }};
      const uriNode = { termType: 'NamedNode', value: 'http://example.com/resource' };

      expect(compiler._parseRDFValue(stringLiteral)).toBe('hello');
      expect(compiler._parseRDFValue(integerLiteral)).toBe(42);
      expect(compiler._parseRDFValue(booleanLiteral)).toBe(true);
      expect(compiler._parseRDFValue(uriNode)).toBe('http://example.com/resource');
    });
  });

  describe('Context Utilities', () => {
    it('should flatten nested context structures', () => {
      const nested = {
        variables: {
          user: { name: 'John', age: 30 },
          settings: { theme: 'dark' }
        },
        facts: {
          count: 42
        }
      };

      const flat = compiler._flattenContext(nested);
      
      expect(flat['variables.user.name']).toBe('John');
      expect(flat['variables.user.age']).toBe(30);
      expect(flat['variables.settings.theme']).toBe('dark');
      expect(flat['facts.count']).toBe(42);
    });

    it('should generate cache keys deterministically', () => {
      const graph1 = { triples: [{ subject: 'a', predicate: 'b', object: 'c' }] };
      const graph2 = { triples: [{ subject: 'a', predicate: 'b', object: 'c' }] };
      const rules = [{ body: 'test rule' }];
      const options = { test: true };

      const key1 = compiler._generateCacheKey(graph1, rules, options);
      const key2 = compiler._generateCacheKey(graph2, rules, options);
      
      expect(key1).toBe(key2);
      expect(typeof key1).toBe('string');
      expect(key1.length).toBe(64); // SHA-256 hex length
    });
  });
});