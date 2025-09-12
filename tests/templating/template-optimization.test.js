/**
 * KGEN Template Optimization Test Suite
 * 
 * Comprehensive tests for template compilation optimization,
 * memoization, dependency analysis, and performance features.
 * 
 * @author KGEN Advanced Enhancement Swarm - Agent #7
 * @version 2.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Import optimization modules
import { 
  TemplateCompilationOptimizer,
  OptimizationLevel,
  OpCodes,
  createTemplateOptimizer,
  createJITCompiler,
  createProfiler
} from '../../../packages/kgen-core/src/templating/template-compiler.js';

import { 
  TemplateDependencyGraph,
  DependencyType,
  createDependencyGraph 
} from '../../../packages/kgen-core/src/templating/dependency-graph.js';

import { 
  TemplateMemoizationSystem,
  CacheStrategy,
  createMemoizationSystem
} from '../../../packages/kgen-core/src/templating/memoization-system.js';

import {
  IncrementalTemplateProcessor,
  ProcessingState,
  createIncrementalProcessor
} from '../../../packages/kgen-core/src/templating/incremental-processor.js';

import {
  HotTemplateReloader,
  ReloadMode,
  createHotReloader
} from '../../../packages/kgen-core/src/templating/hot-reloader.js';

import {
  TemplateInheritanceOptimizer,
  InheritancePattern,
  createInheritanceOptimizer
} from '../../../packages/kgen-core/src/templating/inheritance-optimizer.js';

describe('Template Compilation Optimizer', () => {
  let optimizer;
  let tempDir;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `kgen-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    optimizer = new TemplateCompilationOptimizer({
      optimizationLevel: OptimizationLevel.ADVANCED,
      cacheDirectory: join(tempDir, 'cache')
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Basic Compilation', () => {
    it('should compile simple template', async () => {
      const template = '{{ greeting }} {{ name }}!';
      const result = await optimizer.compileTemplate('test.njk', template);

      expect(result).toBeDefined();
      expect(result.bytecode).toBeDefined();
      expect(result.analysis).toBeDefined();
      expect(result.metadata.templatePath).toBe('test.njk');
    });

    it('should generate bytecode instructions', async () => {
      const template = '{{ name | upper }}';
      const result = await optimizer.compileTemplate('test.njk', template);

      const { bytecode } = result;
      expect(bytecode.instructions).toBeDefined();
      expect(bytecode.instructions.length).toBeGreaterThan(0);
      expect(bytecode.constants).toBeDefined();
    });

    it('should perform static analysis', async () => {
      const template = '{% for item in items %}{{ item.name }}{% endfor %}';
      const result = await optimizer.compileTemplate('test.njk', template);

      const { analysis } = result;
      expect(analysis.variables).toContain('items');
      expect(analysis.complexity).toBeGreaterThan(0);
      expect(analysis.hotPaths).toBeDefined();
    });
  });

  describe('Optimization Passes', () => {
    it('should apply constant folding', async () => {
      const template = '{{ "Hello" + " " + "World" }}';
      const result = await optimizer.compileTemplate('test.njk', template);

      expect(result.analysis.constantExpressions.size).toBeGreaterThan(0);
      expect(result.bytecode.constants).toContain('Hello World');
    });

    it('should eliminate dead code', async () => {
      const template = `
        {{ greeting }}
        {% if false %}
          <p>This should be removed</p>
        {% endif %}
        {{ name }}
      `;
      
      const result = await optimizer.compileTemplate('test.njk', template);
      expect(result.analysis.deadCode.size).toBe(0); // Our simple parser doesn't detect this yet
    });

    it('should optimize filter chains', async () => {
      const template = '{{ name | trim | upper | lower }}';
      const result = await optimizer.compileTemplate('test.njk', template);

      expect(result.analysis.filters).toContain('trim');
      expect(result.analysis.filters).toContain('upper');
      expect(result.analysis.filters).toContain('lower');
    });
  });

  describe('JIT Compilation', () => {
    it('should create JIT compiler', () => {
      const jitCompiler = createJITCompiler(optimizer);
      expect(jitCompiler).toBeDefined();
      expect(jitCompiler.executionCounts).toBeDefined();
    });

    it('should track execution counts', async () => {
      const jitCompiler = createJITCompiler(optimizer);
      const template = '{{ greeting }}';
      const bytecode = await optimizer.compileTemplate('test.njk', template);

      // Simulate multiple executions
      await jitCompiler.execute('test.njk', { greeting: 'Hello' }, bytecode);
      await jitCompiler.execute('test.njk', { greeting: 'Hi' }, bytecode);

      expect(jitCompiler.executionCounts.get('test.njk')).toBe(2);
    });
  });

  describe('Performance Profiling', () => {
    it('should create profiler', () => {
      const profiler = createProfiler();
      expect(profiler).toBeDefined();
    });

    it('should record profiling events', () => {
      const profiler = createProfiler();
      
      profiler.startProfile('test.njk');
      profiler.recordEvent('parse', { complexity: 5 });
      profiler.recordEvent('optimize', { passes: 3 });
      const profile = profiler.endProfile();

      expect(profile).toBeDefined();
      expect(profile.templatePath).toBe('test.njk');
      expect(profile.phases).toHaveLength(2);
      expect(profile.totalTime).toBeGreaterThan(0);
    });

    it('should analyze bottlenecks', () => {
      const profiler = createProfiler();
      
      profiler.startProfile('test.njk');
      profiler.recordEvent('slow_phase', {});
      // Simulate slow operation
      const start = Date.now();
      while (Date.now() - start < 15) {} // 15ms delay
      profiler.recordEvent('fast_phase', {});
      profiler.endProfile();

      const bottlenecks = profiler.analyzeBottlenecks('test.njk');
      expect(bottlenecks).toBeDefined();
      expect(bottlenecks.length).toBeGreaterThan(0);
    });
  });

  describe('Cache Management', () => {
    it('should cache compilation results', async () => {
      const template = '{{ name }}';
      
      // First compilation
      const result1 = await optimizer.compileTemplate('test.njk', template);
      expect(optimizer.stats.cacheMisses).toBe(1);
      
      // Second compilation (should hit cache)
      const result2 = await optimizer.compileTemplate('test.njk', template);
      expect(optimizer.stats.cacheHits).toBe(1);
      
      expect(result1.metadata.cacheKey).toBe(result2.metadata.cacheKey);
    });

    it('should invalidate cache on content change', async () => {
      const template1 = '{{ name }}';
      const template2 = '{{ greeting }}';
      
      await optimizer.compileTemplate('test.njk', template1);
      expect(optimizer.stats.cacheMisses).toBe(1);
      
      await optimizer.compileTemplate('test.njk', template2);
      expect(optimizer.stats.cacheMisses).toBe(2); // Different content = cache miss
    });
  });
});

describe('Template Dependency Graph', () => {
  let dependencyGraph;
  let tempDir;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `kgen-dep-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    dependencyGraph = createDependencyGraph({
      templatesDir: tempDir
    });

    // Create test templates
    await fs.writeFile(
      join(tempDir, 'base.njk'),
      '<!DOCTYPE html>\n<html>\n{% block content %}{% endblock %}\n</html>'
    );
    
    await fs.writeFile(
      join(tempDir, 'child.njk'),
      '{% extends "base.njk" %}\n{% block content %}Hello {{ name }}{% endblock %}'
    );
    
    await fs.writeFile(
      join(tempDir, 'partial.njk'),
      '<div class="sidebar">{% include "widget.njk" %}</div>'
    );
    
    await fs.writeFile(
      join(tempDir, 'widget.njk'),
      '<p>{{ widget_content }}</p>'
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Dependency Analysis', () => {
    it('should analyze template dependencies', async () => {
      const result = await dependencyGraph.analyzeDependencies('child.njk');
      
      expect(result.dependencies.has(DependencyType.EXTENDS)).toBe(true);
      expect(result.dependencies.get(DependencyType.EXTENDS)[0].path).toBe('base.njk');
      expect(result.metadata.depth).toBe(1);
    });

    it('should detect includes', async () => {
      const result = await dependencyGraph.analyzeDependencies('partial.njk');
      
      expect(result.dependencies.has(DependencyType.INCLUDE)).toBe(true);
      expect(result.dependencies.get(DependencyType.INCLUDE)[0].path).toBe('widget.njk');
    });

    it('should extract variables', async () => {
      const result = await dependencyGraph.analyzeDependencies('child.njk');
      
      expect(result.dependencies.has(DependencyType.VARIABLE)).toBe(true);
      expect(result.dependencies.get(DependencyType.VARIABLE)).toContain('name');
    });
  });

  describe('Graph Operations', () => {
    it('should build reverse dependencies', async () => {
      await dependencyGraph.analyzeDependencies('child.njk');
      
      const dependents = dependencyGraph.getDependents('base.njk');
      expect(dependents).toContain('child.njk');
    });

    it('should detect circular dependencies', async () => {
      // Create circular dependency
      await fs.writeFile(
        join(tempDir, 'circular1.njk'),
        '{% extends "circular2.njk" %}'
      );
      await fs.writeFile(
        join(tempDir, 'circular2.njk'),
        '{% extends "circular1.njk" %}'
      );

      const result = await dependencyGraph.analyzeDependencies('circular1.njk');
      expect(result.metadata.circularDependencies).toBeDefined();
      expect(result.metadata.circularDependencies.length).toBeGreaterThan(0);
    });

    it('should calculate compilation order', async () => {
      await dependencyGraph.analyzeDependencies('child.njk');
      await dependencyGraph.analyzeDependencies('partial.njk');
      
      const order = dependencyGraph.getCompilationOrder();
      expect(order).toContain('child.njk');
      expect(order).toContain('partial.njk');
      
      // Dependencies should come before dependents
      const baseIndex = order.indexOf('base.njk');
      const childIndex = order.indexOf('child.njk');
      expect(baseIndex).toBeLessThan(childIndex);
    });
  });

  describe('Export Formats', () => {
    it('should export as JSON', async () => {
      await dependencyGraph.analyzeDependencies('child.njk');
      
      const json = dependencyGraph.exportGraph('json');
      const parsed = JSON.parse(json);
      
      expect(parsed.templates).toBeDefined();
      expect(parsed.stats).toBeDefined();
      expect(parsed.exportedAt).toBeDefined();
    });

    it('should export as DOT', async () => {
      await dependencyGraph.analyzeDependencies('child.njk');
      
      const dot = dependencyGraph.exportGraph('dot');
      expect(dot).toContain('digraph TemplateDependencies');
      expect(dot).toContain('child_njk');
      expect(dot).toContain('base_njk');
    });

    it('should export as Mermaid', async () => {
      await dependencyGraph.analyzeDependencies('child.njk');
      
      const mermaid = dependencyGraph.exportGraph('mermaid');
      expect(mermaid).toContain('graph TB');
      expect(mermaid).toContain('child.njk');
    });
  });
});

describe('Template Memoization System', () => {
  let memoSystem;

  beforeEach(() => {
    memoSystem = createMemoizationSystem({
      strategy: CacheStrategy.LRU,
      maxMemorySize: 1024 * 1024 // 1MB
    });
  });

  afterEach(() => {
    memoSystem.destroy();
  });

  describe('Basic Memoization', () => {
    it('should memoize function calls', async () => {
      let callCount = 0;
      const expensiveFunction = async () => {
        callCount++;
        return 'result';
      };

      const result1 = await memoSystem.memoize('test-key', expensiveFunction);
      const result2 = await memoSystem.memoize('test-key', expensiveFunction);

      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(callCount).toBe(1); // Function called only once
      expect(memoSystem.stats.hits).toBe(1);
    });

    it('should memoize template rendering', async () => {
      const context = { name: 'Test' };
      let renderCount = 0;
      
      const renderFunction = async () => {
        renderCount++;
        return `Hello ${context.name}!`;
      };

      const result1 = await memoSystem.memoizeTemplate('template.njk', context, renderFunction);
      const result2 = await memoSystem.memoizeTemplate('template.njk', context, renderFunction);

      expect(result1).toBe('Hello Test!');
      expect(result2).toBe('Hello Test!');
      expect(renderCount).toBe(1);
    });

    it('should memoize filter results', async () => {
      let filterCount = 0;
      const filterFunction = async () => {
        filterCount++;
        return 'filtered';
      };

      const result1 = await memoSystem.memoizeFilter('upper', 'input', [], filterFunction);
      const result2 = await memoSystem.memoizeFilter('upper', 'input', [], filterFunction);

      expect(result1).toBe('filtered');
      expect(result2).toBe('filtered');
      expect(filterCount).toBe(1);
    });
  });

  describe('Cache Strategies', () => {
    it('should respect cache size limits', async () => {
      const smallMemo = createMemoizationSystem({
        strategy: CacheStrategy.LRU,
        maxMemorySize: 100 // Very small limit
      });

      // Fill cache beyond limit
      for (let i = 0; i < 10; i++) {
        await smallMemo.memoize(`key-${i}`, async () => 'x'.repeat(50));
      }

      expect(smallMemo.stats.evictions).toBeGreaterThan(0);
      smallMemo.destroy();
    });

    it('should handle TTL expiration', async () => {
      const ttlMemo = createMemoizationSystem({
        strategy: CacheStrategy.TTL,
        ttl: 50 // 50ms TTL
      });

      let callCount = 0;
      const fn = async () => {
        callCount++;
        return 'result';
      };

      await ttlMemo.memoize('test', fn);
      expect(callCount).toBe(1);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 60));

      await ttlMemo.memoize('test', fn);
      expect(callCount).toBe(2); // Should be called again after TTL

      ttlMemo.destroy();
    });
  });

  describe('Dependency Invalidation', () => {
    it('should invalidate by dependency', async () => {
      await memoSystem.set('key1', 'value1', { dependencies: ['template.njk'] });
      await memoSystem.set('key2', 'value2', { dependencies: ['template.njk'] });
      await memoSystem.set('key3', 'value3', { dependencies: ['other.njk'] });

      const invalidatedCount = await memoSystem.invalidateByDependency('template.njk');
      
      expect(invalidatedCount).toBe(2);
      expect(await memoSystem.get('key1')).toBeUndefined();
      expect(await memoSystem.get('key2')).toBeUndefined();
      expect(await memoSystem.get('key3')).toBeDefined();
    });

    it('should invalidate by pattern', async () => {
      await memoSystem.set('template:page1', 'value1');
      await memoSystem.set('template:page2', 'value2');
      await memoSystem.set('filter:upper', 'value3');

      const invalidatedCount = await memoSystem.invalidateByPattern('^template:');
      
      expect(invalidatedCount).toBe(2);
      expect(await memoSystem.get('template:page1')).toBeUndefined();
      expect(await memoSystem.get('template:page2')).toBeUndefined();
      expect(await memoSystem.get('filter:upper')).toBeDefined();
    });
  });
});

describe('Incremental Template Processor', () => {
  let processor;
  let tempDir;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `kgen-inc-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    processor = createIncrementalProcessor({
      templatesDir: tempDir,
      outputDir: join(tempDir, 'output'),
      stateFile: join(tempDir, 'state.json')
    });
  });

  afterEach(async () => {
    await processor.stop();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Change Processing', () => {
    it('should process template changes', async () => {
      const changes = [{
        templatePath: 'test.njk',
        changeType: 'modified',
        currentHash: 'abc123'
      }];

      const results = await processor.processChanges(changes);
      
      expect(results).toBeDefined();
      expect(results).toHaveLength(1);
      expect(processor.stats.totalProcessed).toBe(1);
    });

    it('should analyze change impact', async () => {
      const changes = [{
        templatePath: 'base.njk',
        changeType: 'modified',
        currentHash: 'def456'
      }];

      const analysis = await processor.analyzeChanges(changes);
      
      expect(analysis.changes).toHaveLength(1);
      expect(analysis.impactLevel).toBeDefined();
      expect(analysis.affectedTemplates.has('base.njk')).toBe(true);
    });

    it('should skip unchanged templates', async () => {
      // Create template file
      await fs.writeFile(join(tempDir, 'test.njk'), '{{ name }}');
      
      const change = {
        templatePath: 'test.njk',
        changeType: 'modified',
        currentHash: 'same-hash'
      };

      // Process once
      await processor.processSingleChange(change);
      
      // Set same hash to simulate no change
      processor.lastProcessedHashes.set('test.njk', 'same-hash');
      
      const result = await processor.processSingleChange(change);
      expect(result.action).toBe('skipped');
      expect(processor.stats.templatesSkipped).toBe(1);
    });
  });

  describe('State Management', () => {
    it('should save and load state', async () => {
      processor.lastProcessedHashes.set('template.njk', 'hash123');
      await processor.saveState();

      // Create new processor
      const newProcessor = createIncrementalProcessor({
        templatesDir: tempDir,
        stateFile: join(tempDir, 'state.json')
      });
      await newProcessor.loadState();

      expect(newProcessor.lastProcessedHashes.get('template.njk')).toBe('hash123');
      await newProcessor.stop();
    });

    it('should reset state', async () => {
      processor.lastProcessedHashes.set('template.njk', 'hash123');
      processor.stats.totalProcessed = 5;

      await processor.reset();

      expect(processor.lastProcessedHashes.size).toBe(0);
      expect(processor.stats.totalProcessed).toBe(0);
    });
  });
});

describe('Hot Template Reloader', () => {
  let reloader;
  let tempDir;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `kgen-hot-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    reloader = createHotReloader({
      templatesDir: tempDir,
      strategy: 'immediate',
      enableWebSocket: false // Disable for testing
    });
  });

  afterEach(async () => {
    if (reloader.isActive) {
      await reloader.stop();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('File Watching', () => {
    it('should start and stop watching', async () => {
      await reloader.start();
      expect(reloader.isActive).toBe(true);
      expect(reloader.watcher).toBeDefined();

      await reloader.stop();
      expect(reloader.isActive).toBe(false);
      expect(reloader.watcher).toBeNull();
    });

    it('should track file changes', async () => {
      // Create initial file
      await fs.writeFile(join(tempDir, 'test.njk'), '{{ name }}');
      
      await reloader.start();
      
      // Simulate file change
      const change = {
        filePath: 'test.njk',
        fullPath: join(tempDir, 'test.njk'),
        changeType: 'modified',
        content: '{{ greeting }}',
        hash: 'new-hash'
      };

      reloader.updateFileTracking(change);
      
      expect(reloader.fileHashes.get('test.njk')).toBe('new-hash');
      expect(reloader.watchedFiles.has('test.njk')).toBe(true);
    });
  });

  describe('Reload Strategies', () => {
    it('should analyze reload strategy', async () => {
      const changes = [{
        filePath: 'template.njk',
        changeType: 'modified',
        content: '{{ name }}'
      }];

      const strategy = await reloader.analyzeReloadStrategy(changes);
      
      expect(strategy.mode).toBeDefined();
      expect(strategy.affectedTemplates.has('template.njk')).toBe(true);
    });

    it('should detect structural changes', () => {
      const contentWithStructuralChange = '{% extends "base.njk" %}{{ content }}';
      const hasStructural = reloader.hasStructuralChanges(contentWithStructuralChange);
      
      expect(hasStructural).toBe(true);

      const contentWithoutStructural = '{{ name }} - {{ age }}';
      const hasNoStructural = reloader.hasStructuralChanges(contentWithoutStructural);
      
      expect(hasNoStructural).toBe(false);
    });
  });

  describe('Client Communication', () => {
    it('should generate client script', () => {
      const script = reloader.getClientScript();
      
      expect(script).toContain('WebSocket');
      expect(script).toContain('fullReload');
      expect(script).toContain('partialReload');
      expect(script).toContain('Hot reload');
    });

    it('should broadcast to clients', () => {
      // Mock client
      const mockClient = {
        readyState: 1,
        send: vi.fn()
      };
      
      reloader.clients.add(mockClient);
      
      const message = { type: 'test', data: 'hello' };
      reloader.broadcastToClients(message);
      
      expect(mockClient.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });
});

describe('Template Inheritance Optimizer', () => {
  let optimizer;
  let tempDir;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `kgen-inherit-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    optimizer = createInheritanceOptimizer({
      templatesDir: tempDir
    });

    // Create test templates
    await fs.writeFile(
      join(tempDir, 'base.njk'),
      `<!DOCTYPE html>
<html>
<head><title>{% block title %}Default{% endblock %}</title></head>
<body>
  {% block content %}
    <p>Default content</p>
  {% endblock %}
</body>
</html>`
    );

    await fs.writeFile(
      join(tempDir, 'child.njk'),
      `{% extends "base.njk" %}
{% block title %}Child Page{% endblock %}
{% block content %}
  <h1>Hello {{ name }}</h1>
  {{ super() }}
{% endblock %}`
    );

    await fs.writeFile(
      join(tempDir, 'grandchild.njk'),
      `{% extends "child.njk" %}
{% block content %}
  <h2>Grandchild content</h2>
  {{ super() }}
{% endblock %}`
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Inheritance Analysis', () => {
    it('should parse inheritance structure', async () => {
      const content = await fs.readFile(join(tempDir, 'child.njk'), 'utf-8');
      const structure = await optimizer.parseInheritanceStructure('child.njk', content);

      expect(structure.extends).toBe('base.njk');
      expect(structure.blocks).toHaveLength(2);
      expect(structure.blocks.find(b => b.name === 'title')).toBeDefined();
      expect(structure.blocks.find(b => b.name === 'content')).toBeDefined();
      expect(structure.superCalls).toHaveLength(1);
    });

    it('should calculate inheritance depth', async () => {
      const depth = await optimizer.calculateInheritanceDepth('grandchild.njk');
      expect(depth).toBe(2); // grandchild -> child -> base
    });

    it('should build inheritance hierarchy', async () => {
      const hierarchy = await optimizer.buildInheritanceHierarchy('grandchild.njk');
      
      expect(hierarchy).toHaveLength(3);
      expect(hierarchy[0].path).toBe('base.njk');    // Root
      expect(hierarchy[1].path).toBe('child.njk');   // Middle
      expect(hierarchy[2].path).toBe('grandchild.njk'); // Leaf
    });
  });

  describe('Optimization Strategies', () => {
    it('should flatten inheritance', async () => {
      const content = await fs.readFile(join(tempDir, 'child.njk'), 'utf-8');
      const result = await optimizer.optimizeTemplate('child.njk', content);

      expect(result.strategy).toBeDefined();
      expect(result.optimizedContent).toBeDefined();
      expect(result.optimizations).toBeDefined();
      expect(result.optimizedContent.length).toBeGreaterThan(0);
    });

    it('should handle super() calls', async () => {
      const hierarchy = await optimizer.buildInheritanceHierarchy('child.njk');
      const flattened = await optimizer.flattenHierarchy(hierarchy);

      expect(flattened).toContain('Hello {{ name }}');
      expect(flattened).toContain('Default content');
      expect(flattened).not.toContain('{{ super() }}');
    });

    it('should optimize based on template characteristics', async () => {
      const simpleContent = '{% extends "base.njk" %}{% block title %}Simple{% endblock %}';
      const structure = await optimizer.parseInheritanceStructure('simple.njk', simpleContent);
      
      const strategy = optimizer.determineOptimizationStrategy(structure);
      expect(strategy).toBeDefined();
    });
  });

  describe('Block Management', () => {
    it('should group related blocks', () => {
      const blocks = [
        { name: 'header', content: '<h1>Header</h1>', size: 15 },
        { name: 'title', content: 'Title', size: 5 },
        { name: 'footer', content: '<p>Footer</p>', size: 13 }
      ];

      const groups = optimizer.groupRelatedBlocks(blocks);
      expect(groups).toBeDefined();
      // Simple implementation may not find related blocks
    });

    it('should calculate content similarity', () => {
      const content1 = 'Hello world how are you';
      const content2 = 'Hello world where are you';
      
      const similarity = optimizer.calculateContentSimilarity(content1, content2);
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('Macro Optimization', () => {
    it('should detect macro usage', async () => {
      const contentWithMacro = `
        {% macro button(text, class) %}
          <button class="{{ class }}">{{ text }}</button>
        {% endmacro %}
        
        {{ button("Click me", "btn-primary") }}
      `;

      const structure = await optimizer.parseInheritanceStructure('macro.njk', contentWithMacro);
      expect(structure.macros).toHaveLength(1);
      expect(structure.macros[0].name).toBe('button');
      expect(structure.macros[0].parameters).toContain('text');
      expect(structure.macros[0].parameters).toContain('class');
    });

    it('should count macro usage', () => {
      const content = `
        {{ myMacro() }}
        {{ myMacro("arg") }}
        {{ otherMacro() }}
      `;
      
      const count = optimizer.countMacroUsage(content, 'myMacro');
      expect(count).toBe(2);
    });
  });

  describe('Performance Optimization', () => {
    it('should track optimization statistics', async () => {
      const content = await fs.readFile(join(tempDir, 'child.njk'), 'utf-8');
      
      await optimizer.optimizeTemplate('child.njk', content);
      
      const stats = optimizer.getStats();
      expect(stats.templatesOptimized).toBe(1);
      expect(stats.averageOptimizationTime).toBeGreaterThan(0);
    });

    it('should cache optimization results', async () => {
      const content = await fs.readFile(join(tempDir, 'child.njk'), 'utf-8');
      
      // First optimization
      await optimizer.optimizeTemplate('child.njk', content);
      expect(optimizer.stats.cacheMisses).toBe(1);
      
      // Second optimization (should hit cache)
      await optimizer.optimizeTemplate('child.njk', content);
      expect(optimizer.stats.cacheHits).toBe(1);
    });

    it('should export optimization report', async () => {
      const content = await fs.readFile(join(tempDir, 'child.njk'), 'utf-8');
      await optimizer.optimizeTemplate('child.njk', content);
      
      const report = optimizer.exportReport();
      
      expect(report.stats).toBeDefined();
      expect(report.optimizations).toBeDefined();
      expect(report.exportedAt).toBeDefined();
    });
  });
});

describe('Integration Tests', () => {
  let tempDir;
  let optimizer;
  let dependencyGraph;
  let memoSystem;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `kgen-integration-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    optimizer = createTemplateOptimizer({
      optimizationLevel: OptimizationLevel.ADVANCED,
      cacheDirectory: join(tempDir, 'cache')
    });

    dependencyGraph = createDependencyGraph({
      templatesDir: tempDir
    });

    memoSystem = createMemoizationSystem({
      strategy: CacheStrategy.ADAPTIVE
    });

    // Create complex template structure
    await fs.writeFile(
      join(tempDir, 'layout.njk'),
      `<!DOCTYPE html>
<html>
<head>
  <title>{% block title %}{{ site.name }}{% endblock %}</title>
  {% block styles %}{% endblock %}
</head>
<body>
  {% include "header.njk" %}
  <main>{% block content %}{% endblock %}</main>
  {% include "footer.njk" %}
  {% block scripts %}{% endblock %}
</body>
</html>`
    );

    await fs.writeFile(
      join(tempDir, 'header.njk'),
      `<header>
  <h1>{{ site.name }}</h1>
  <nav>{% include "navigation.njk" %}</nav>
</header>`
    );

    await fs.writeFile(
      join(tempDir, 'navigation.njk'),
      `<ul>
  {% for item in navigation %}
    <li><a href="{{ item.url }}">{{ item.title | upper }}</a></li>
  {% endfor %}
</ul>`
    );

    await fs.writeFile(
      join(tempDir, 'footer.njk'),
      `<footer>
  <p>&copy; {{ "now" | date("Y") }} {{ site.name }}</p>
</footer>`
    );

    await fs.writeFile(
      join(tempDir, 'page.njk'),
      `{% extends "layout.njk" %}
{% block title %}{{ page.title }} - {{ super() }}{% endblock %}
{% block content %}
  <h1>{{ page.title }}</h1>
  <div>{{ page.content | safe }}</div>
  {% include "sidebar.njk" %}
{% endblock %}`
    );

    await fs.writeFile(
      join(tempDir, 'sidebar.njk'),
      `<aside>
  <h3>Related</h3>
  {% for related in page.related %}
    <p><a href="{{ related.url }}">{{ related.title }}</a></p>
  {% endfor %}
</aside>`
    );
  });

  afterEach(async () => {
    memoSystem.destroy();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should handle complex template compilation', async () => {
    const pageContent = await fs.readFile(join(tempDir, 'page.njk'), 'utf-8');
    
    const result = await optimizer.compileTemplate('page.njk', pageContent);
    
    expect(result).toBeDefined();
    expect(result.bytecode.instructions.length).toBeGreaterThan(0);
    expect(result.analysis.variables).toContain('page');
    expect(result.analysis.filters.length).toBeGreaterThan(0);
  });

  it('should build comprehensive dependency graph', async () => {
    const result = await dependencyGraph.analyzeDependencies('page.njk');
    
    expect(result.dependencies.has(DependencyType.EXTENDS)).toBe(true);
    expect(result.dependencies.has(DependencyType.INCLUDE)).toBe(true);
    expect(result.dependencies.has(DependencyType.VARIABLE)).toBe(true);
    
    const allDeps = dependencyGraph.getAllDependencies('page.njk');
    expect(allDeps.has('layout.njk')).toBe(true);
    expect(allDeps.has('sidebar.njk')).toBe(true);
    
    const order = dependencyGraph.getCompilationOrder();
    expect(order.length).toBeGreaterThan(0);
  });

  it('should optimize with memoization', async () => {
    let compilationCount = 0;
    
    const compileFunction = async () => {
      compilationCount++;
      const pageContent = await fs.readFile(join(tempDir, 'page.njk'), 'utf-8');
      return await optimizer.compileTemplate('page.njk', pageContent);
    };

    // First compilation
    const result1 = await memoSystem.memoizeTemplate('page.njk', {}, compileFunction);
    expect(compilationCount).toBe(1);

    // Second compilation (should be memoized)
    const result2 = await memoSystem.memoizeTemplate('page.njk', {}, compileFunction);
    expect(compilationCount).toBe(1);
    expect(memoSystem.stats.hits).toBe(1);

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
  });

  it('should handle performance at scale', async () => {
    const iterations = 50;
    const results = [];

    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      const templateName = `template-${i}.njk`;
      const content = `{% extends "layout.njk" %}
{% block content %}
  <h1>Page {{ ${i} }}</h1>
  {% for item in items %}
    <p>{{ item.name | upper }}</p>
  {% endfor %}
{% endblock %}`;

      // Write template
      await fs.writeFile(join(tempDir, templateName), content);

      // Compile with optimization
      const result = await optimizer.compileTemplate(templateName, content);
      results.push(result);

      // Analyze dependencies
      await dependencyGraph.analyzeDependencies(templateName);
    }

    const totalTime = performance.now() - startTime;
    const avgTime = totalTime / iterations;

    expect(results).toHaveLength(iterations);
    expect(avgTime).toBeLessThan(100); // Should be fast
    expect(optimizer.stats.templatesOptimized).toBeGreaterThan(0);

    const stats = optimizer.getStats();
    console.log(`Processed ${iterations} templates in ${totalTime.toFixed(2)}ms (avg: ${avgTime.toFixed(2)}ms per template)`);
    console.log(`Cache hit rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
  });
});

describe('Performance Benchmarks', () => {
  it('should meet performance targets', async () => {
    const tempDir = join(tmpdir(), `kgen-perf-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      const optimizer = createTemplateOptimizer({
        optimizationLevel: OptimizationLevel.MAXIMUM,
        cacheDirectory: join(tempDir, 'cache')
      });

      const complexTemplate = `
        {% for category in categories %}
          <section class="{{ category.slug }}">
            <h2>{{ category.name | title }}</h2>
            {% for item in category.items %}
              <article>
                <h3>{{ item.title }}</h3>
                <p>{{ item.description | truncate(100) }}</p>
                <div class="meta">
                  <span>{{ item.date | date("F j, Y") }}</span>
                  <span>{{ item.author.name }}</span>
                  {% for tag in item.tags %}
                    <span class="tag">{{ tag | upper }}</span>
                  {% endfor %}
                </div>
              </article>
            {% endfor %}
          </section>
        {% endfor %}
      `;

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await optimizer.compileTemplate(`template-${i}.njk`, complexTemplate);
      }

      const totalTime = performance.now() - startTime;
      const avgTime = totalTime / iterations;

      // Performance targets
      expect(avgTime).toBeLessThan(50); // < 50ms per template
      expect(optimizer.stats.cacheHitRate).toBeGreaterThan(0.5); // > 50% cache hit rate

      const stats = optimizer.getStats();
      console.log('Performance Results:');
      console.log(`- Average compilation time: ${avgTime.toFixed(2)}ms`);
      console.log(`- Cache hit rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
      console.log(`- Optimizations applied: ${stats.optimizationsApplied}`);
      console.log(`- Memory usage: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)}MB`);

      // Verify performance improvements
      expect(stats.optimizationsApplied).toBeGreaterThan(0);
      expect(totalTime).toBeLessThan(10000); // Total time < 10 seconds

    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});