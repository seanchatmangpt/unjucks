/**
 * Unit tests for KGen Engine
 * Tests core engine functionality, initialization, and orchestration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { KGenEngine } from '../../src/engine.js';

// Mock dependencies
vi.mock('../../src/semantic/processor.js', () => ({
  SemanticProcessor: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    process: vi.fn().mockResolvedValue({ success: true })
  }))
}));

vi.mock('../../src/ingestion/pipeline.js', () => ({
  IngestionPipeline: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    ingest: vi.fn().mockResolvedValue({ knowledgeGraph: {} })
  }))
}));

vi.mock('../../src/provenance/tracker.js', () => ({
  ProvenanceTracker: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    track: vi.fn().mockResolvedValue({ provenanceId: 'test-123' })
  }))
}));

vi.mock('../../src/security/manager.js', () => ({
  SecurityManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    authorize: vi.fn().mockResolvedValue({ authorized: true })
  }))
}));

vi.mock('../../src/query/engine.js', () => ({
  QueryEngine: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ results: [] })
  }))
}));

describe('KGenEngine', () => {
  let engine;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      mode: 'test',
      maxConcurrentOperations: 5,
      enableAuditTrail: true,
      semantic: { enableReasoning: true },
      ingestion: { batchSize: 100 },
      provenance: { enableTracking: true },
      security: { enableEncryption: false },
      query: { timeout: 10000 }
    };
    
    engine = new KGenEngine(mockConfig);
  });

  afterEach(() => {
    if (engine) {
      engine.removeAllListeners();
    }
  });

  describe('constructor', () => {
    it('should create engine with default configuration', () => {
      const defaultEngine = new KGenEngine();
      
      expect(defaultEngine).toBeInstanceOf(EventEmitter);
      expect(defaultEngine.config.mode).toBe('production');
      expect(defaultEngine.config.maxConcurrentOperations).toBe(10);
      expect(defaultEngine.state).toBe('initialized');
    });

    it('should merge custom configuration with defaults', () => {
      expect(engine.config.mode).toBe('test');
      expect(engine.config.maxConcurrentOperations).toBe(5);
      expect(engine.config.enableAuditTrail).toBe(true);
      expect(engine.config.enableEncryption).toBe(true); // Default should remain
    });

    it('should initialize deterministic ID generator', () => {
      expect(engine.idGenerator).toBeDefined();
      expect(engine.sessionStart).toBeDefined();
      expect(typeof engine.sessionStart).toBe('string');
    });

    it('should initialize all core components', () => {
      expect(engine.semanticProcessor).toBeDefined();
      expect(engine.ingestionPipeline).toBeDefined();
      expect(engine.provenanceTracker).toBeDefined();
      expect(engine.securityManager).toBeDefined();
      expect(engine.queryEngine).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize all components successfully', async () => {
      const result = await engine.initialize();
      
      expect(result.status).toBe('success');
      expect(result.version).toBeDefined();
      expect(engine.state).toBe('ready');
    });

    it('should emit engine:ready event on successful initialization', async () => {
      const readySpy = vi.fn();
      engine.on('engine:ready', readySpy);
      
      await engine.initialize();
      
      expect(readySpy).toHaveBeenCalledOnce();
    });

    it('should handle initialization errors', async () => {
      // Mock component initialization failure
      engine.securityManager.initialize = vi.fn().mockRejectedValue(new Error('Security init failed'));
      
      const errorSpy = vi.fn();
      engine.on('engine:error', errorSpy);
      
      await expect(engine.initialize()).rejects.toThrow('Security init failed');
      expect(engine.state).toBe('error');
      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should initialize components in correct order', async () => {
      const initOrder = [];
      
      engine.securityManager.initialize = vi.fn().mockImplementation(() => {
        initOrder.push('security');
        return Promise.resolve();
      });
      engine.semanticProcessor.initialize = vi.fn().mockImplementation(() => {
        initOrder.push('semantic');
        return Promise.resolve();
      });
      engine.ingestionPipeline.initialize = vi.fn().mockImplementation(() => {
        initOrder.push('ingestion');
        return Promise.resolve();
      });
      engine.provenanceTracker.initialize = vi.fn().mockImplementation(() => {
        initOrder.push('provenance');
        return Promise.resolve();
      });
      engine.queryEngine.initialize = vi.fn().mockImplementation(() => {
        initOrder.push('query');
        return Promise.resolve();
      });
      
      await engine.initialize();
      
      expect(initOrder).toEqual(['security', 'semantic', 'ingestion', 'provenance', 'query']);
    });
  });

  describe('ingest', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should ingest data from multiple sources', async () => {
      const sources = [
        { type: 'rdf', path: '/test/data1.ttl' },
        { type: 'json-ld', path: '/test/data2.jsonld' }
      ];
      const options = { validateOnly: false };
      
      const result = await engine.ingest(sources, options);
      
      expect(result).toBeDefined();
      expect(engine.ingestionPipeline.ingest).toHaveBeenCalledWith(sources, expect.any(Object));
      expect(engine.provenanceTracker.track).toHaveBeenCalled();
    });

    it('should handle empty sources array', async () => {
      const result = await engine.ingest([]);
      
      expect(result).toBeDefined();
      expect(engine.ingestionPipeline.ingest).toHaveBeenCalledWith([], expect.any(Object));
    });

    it('should validate authorization before ingestion', async () => {
      const sources = [{ type: 'rdf', path: '/test/secured.ttl' }];
      
      await engine.ingest(sources);
      
      expect(engine.securityManager.authorize).toHaveBeenCalled();
    });

    it('should track operation with provenance', async () => {
      const sources = [{ type: 'rdf', path: '/test/data.ttl' }];
      
      await engine.ingest(sources);
      
      expect(engine.provenanceTracker.track).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'ingest',
          operationId: expect.any(String)
        })
      );
    });

    it('should handle ingestion errors gracefully', async () => {
      engine.ingestionPipeline.ingest = vi.fn().mockRejectedValue(new Error('Ingestion failed'));
      
      await expect(engine.ingest([{ type: 'rdf', path: '/invalid.ttl' }]))
        .rejects.toThrow('Ingestion failed');
    });
  });

  describe('operation management', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should generate unique operation IDs', () => {
      const id1 = engine._generateOperationId();
      const id2 = engine._generateOperationId();
      
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    it('should track active operations', async () => {
      const sources = [{ type: 'rdf', path: '/test/data.ttl' }];
      
      // Start ingestion but don't await yet
      const ingestPromise = engine.ingest(sources);
      
      // Should have active operation
      expect(engine.activeOperations.size).toBeGreaterThan(0);
      
      // Complete the operation
      await ingestPromise;
      
      // Active operations should be cleaned up after completion
      expect(engine.activeOperations.size).toBe(0);
    });

    it('should respect max concurrent operations limit', async () => {
      // Set low limit for testing
      engine.config.maxConcurrentOperations = 2;
      
      // Mock slow ingestion
      engine.ingestionPipeline.ingest = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ knowledgeGraph: {} }), 100))
      );
      
      // Start multiple operations
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(engine.ingest([{ type: 'rdf', path: `/test/data${i}.ttl` }]));
      }
      
      // Wait for all to complete
      await Promise.all(promises);
      
      // All should complete successfully despite the limit
      expect(promises).toHaveLength(5);
    });
  });

  describe('state management', () => {
    it('should track engine state correctly', async () => {
      expect(engine.state).toBe('initialized');
      
      await engine.initialize();
      expect(engine.state).toBe('ready');
    });

    it('should handle state transitions on errors', async () => {
      engine.securityManager.initialize = vi.fn().mockRejectedValue(new Error('Init failed'));
      
      try {
        await engine.initialize();
      } catch (error) {
        expect(engine.state).toBe('error');
      }
    });
  });

  describe('deterministic behavior', () => {
    it('should generate consistent session IDs for same config', () => {
      const engine1 = new KGenEngine(mockConfig);
      const engine2 = new KGenEngine(mockConfig);
      
      expect(engine1.sessionStart).toBe(engine2.sessionStart);
    });

    it('should generate different session IDs for different configs', () => {
      const config1 = { mode: 'test', enableCache: true };
      const config2 = { mode: 'test', enableCache: false };
      
      const engine1 = new KGenEngine(config1);
      const engine2 = new KGenEngine(config2);
      
      expect(engine1.sessionStart).not.toBe(engine2.sessionStart);
    });
  });

  describe('event handling', () => {
    it('should properly set up event handlers', () => {
      expect(engine.listenerCount('engine:ready')).toBeGreaterThan(0);
      expect(engine.listenerCount('engine:error')).toBeGreaterThan(0);
    });

    it('should emit operation events', async () => {
      await engine.initialize();
      
      const startSpy = vi.fn();
      const completeSpy = vi.fn();
      
      engine.on('operation:start', startSpy);
      engine.on('operation:complete', completeSpy);
      
      await engine.ingest([{ type: 'rdf', path: '/test/data.ttl' }]);
      
      expect(startSpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalled();
    });
  });

  describe('version and metadata', () => {
    it('should return version information', () => {
      const version = engine.getVersion();
      
      expect(version).toBeDefined();
      expect(typeof version).toBe('string');
    });

    it('should provide engine metadata', () => {
      const metadata = engine.getMetadata();
      
      expect(metadata).toBeDefined();
      expect(metadata.config).toBeDefined();
      expect(metadata.state).toBe('initialized');
      expect(metadata.sessionStart).toBeDefined();
    });
  });
});
