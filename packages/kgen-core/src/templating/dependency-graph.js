/**
 * KGEN Template Dependency Graph Analysis
 * 
 * Tracks template dependencies, enables incremental compilation,
 * and optimizes template loading order for maximum performance.
 * 
 * @author KGEN Advanced Enhancement Swarm - Agent #7
 * @version 2.0.0
 */

import { promises as fs } from 'fs';
import { join, dirname, resolve } from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { performance } from 'perf_hooks';

/**
 * Dependency types
 */
export const DependencyType = {
  INCLUDE: 'include',      // {% include "template.html" %}
  EXTENDS: 'extends',      // {% extends "base.html" %}
  IMPORT: 'import',        // {% import "macros.html" as macros %}
  MACRO: 'macro',          // Macro dependencies
  VARIABLE: 'variable',    // Variable dependencies
  FILTER: 'filter',        // Custom filter dependencies
  RESOURCE: 'resource'     // External resource dependencies
};

/**
 * Change types for incremental updates
 */
export const ChangeType = {
  ADDED: 'added',
  MODIFIED: 'modified',
  DELETED: 'deleted',
  RENAMED: 'renamed'
};

/**
 * Template Dependency Graph Manager
 */
export class TemplateDependencyGraph {
  constructor(options = {}) {
    this.options = {
      templatesDir: options.templatesDir || '_templates',
      watchMode: options.watchMode || false,
      enableCaching: options.enableCaching !== false,
      maxDepth: options.maxDepth || 10,
      includeExternalDeps: options.includeExternalDeps || false,
      ...options
    };

    // Dependency graph structure
    this.graph = new Map(); // template -> dependencies
    this.reverseGraph = new Map(); // dependency -> dependents
    this.templateMetadata = new Map(); // template -> metadata
    this.changeQueue = new Map(); // template -> change info
    
    // File watching
    this.watchers = new Map();
    this.watchedFiles = new Set();
    
    // Caching
    this.dependencyCache = new Map();
    this.analysisCache = new Map();
    
    // Statistics
    this.stats = {
      analysisCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      circularDependencies: 0,
      totalDependencies: 0,
      deepestNesting: 0,
      incrementalUpdates: 0
    };
  }

  /**
   * Build dependency graph for template
   */
  async analyzeDependencies(templatePath) {
    const startTime = performance.now();
    this.stats.analysisCount++;

    try {
      // Check cache first
      const cacheKey = await this.createCacheKey(templatePath);
      if (this.dependencyCache.has(cacheKey)) {
        this.stats.cacheHits++;
        return this.dependencyCache.get(cacheKey);
      }

      this.stats.cacheMisses++;

      // Read template content
      const fullPath = resolve(this.options.templatesDir, templatePath);
      if (!existsSync(fullPath)) {
        throw new Error(`Template not found: ${templatePath}`);
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      const stats = await fs.stat(fullPath);

      // Extract dependencies from template content
      const dependencies = await this.extractDependencies(content, templatePath);
      
      // Build metadata
      const metadata = {
        templatePath,
        lastModified: stats.mtime,
        size: stats.size,
        contentHash: this.createContentHash(content),
        analysisTime: performance.now() - startTime,
        depth: 0
      };

      // Store in graph
      this.graph.set(templatePath, dependencies);
      this.templateMetadata.set(templatePath, metadata);

      // Update reverse graph
      this.updateReverseGraph(templatePath, dependencies);

      // Detect circular dependencies
      const circular = this.detectCircularDependencies(templatePath);
      if (circular.length > 0) {
        this.stats.circularDependencies++;
        metadata.circularDependencies = circular;
      }

      // Calculate depth
      metadata.depth = this.calculateTemplateDepth(templatePath);
      this.stats.deepestNesting = Math.max(this.stats.deepestNesting, metadata.depth);

      // Cache result
      const result = { dependencies, metadata };
      this.dependencyCache.set(cacheKey, result);

      // Set up file watching if enabled
      if (this.options.watchMode && !this.watchedFiles.has(fullPath)) {
        await this.watchTemplate(fullPath, templatePath);
      }

      this.stats.totalDependencies = this.graph.size;

      return result;

    } catch (error) {
      throw new Error(`Dependency analysis failed for ${templatePath}: ${error.message}`);
    }
  }

  /**
   * Extract dependencies from template content
   */
  async extractDependencies(content, templatePath) {
    const dependencies = new Map();

    // Extract includes
    await this.extractIncludes(content, dependencies, templatePath);
    
    // Extract extends
    await this.extractExtends(content, dependencies, templatePath);
    
    // Extract imports
    await this.extractImports(content, dependencies, templatePath);
    
    // Extract macro dependencies
    await this.extractMacroDependencies(content, dependencies, templatePath);
    
    // Extract variable dependencies
    await this.extractVariableDependencies(content, dependencies, templatePath);
    
    // Extract filter dependencies
    await this.extractFilterDependencies(content, dependencies, templatePath);

    // Extract external resource dependencies
    if (this.options.includeExternalDeps) {
      await this.extractResourceDependencies(content, dependencies, templatePath);
    }

    return dependencies;
  }

  /**
   * Extract include dependencies
   */
  async extractIncludes(content, dependencies, templatePath) {
    const patterns = [
      /\{\%\s*include\s+['"]([^'"]+)['"]\s*\%\}/g,
      /\{\%\s*include\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s*\%\}/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const includePath = match[1];
        const resolvedPath = await this.resolveDependencyPath(includePath, templatePath);
        
        if (resolvedPath) {
          if (!dependencies.has(DependencyType.INCLUDE)) {
            dependencies.set(DependencyType.INCLUDE, []);
          }
          dependencies.get(DependencyType.INCLUDE).push({
            path: resolvedPath,
            originalRef: includePath,
            line: this.getLineNumber(content, match.index),
            dynamic: includePath.includes('{{')
          });
        }
      }
    }
  }

  /**
   * Extract extends dependencies
   */
  async extractExtends(content, dependencies, templatePath) {
    const pattern = /\{\%\s*extends\s+['"]([^'"]+)['"]\s*\%\}/g;
    let match;

    while ((match = pattern.exec(content)) !== null) {
      const extendsPath = match[1];
      const resolvedPath = await this.resolveDependencyPath(extendsPath, templatePath);
      
      if (resolvedPath) {
        if (!dependencies.has(DependencyType.EXTENDS)) {
          dependencies.set(DependencyType.EXTENDS, []);
        }
        dependencies.get(DependencyType.EXTENDS).push({
          path: resolvedPath,
          originalRef: extendsPath,
          line: this.getLineNumber(content, match.index),
          dynamic: false // extends is typically not dynamic
        });
      }
    }
  }

  /**
   * Extract import dependencies
   */
  async extractImports(content, dependencies, templatePath) {
    const patterns = [
      /\{\%\s*import\s+['"]([^'"]+)['"]\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\%\}/g,
      /\{\%\s*from\s+['"]([^'"]+)['"]\s+import\s+([^%]+)\s*\%\}/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const importPath = match[1];
        const resolvedPath = await this.resolveDependencyPath(importPath, templatePath);
        
        if (resolvedPath) {
          if (!dependencies.has(DependencyType.IMPORT)) {
            dependencies.set(DependencyType.IMPORT, []);
          }
          dependencies.get(DependencyType.IMPORT).push({
            path: resolvedPath,
            originalRef: importPath,
            importedNames: match[2],
            line: this.getLineNumber(content, match.index),
            dynamic: false
          });
        }
      }
    }
  }

  /**
   * Extract macro dependencies
   */
  async extractMacroDependencies(content, dependencies, templatePath) {
    // Find macro calls
    const pattern = /\{\%\s*call\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s*.*?\%\}/g;
    let match;

    const macros = [];
    while ((match = pattern.exec(content)) !== null) {
      const macroCall = match[1];
      macros.push({
        name: macroCall,
        line: this.getLineNumber(content, match.index)
      });
    }

    if (macros.length > 0) {
      dependencies.set(DependencyType.MACRO, macros);
    }
  }

  /**
   * Extract variable dependencies
   */
  async extractVariableDependencies(content, dependencies, templatePath) {
    const pattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)(?:\s*\|.*?)?\s*\}\}/g;
    let match;

    const variables = new Set();
    while ((match = pattern.exec(content)) !== null) {
      const varName = match[1].split('.')[0]; // Get root variable
      variables.add(varName);
    }

    if (variables.size > 0) {
      dependencies.set(DependencyType.VARIABLE, Array.from(variables));
    }
  }

  /**
   * Extract filter dependencies
   */
  async extractFilterDependencies(content, dependencies, templatePath) {
    const pattern = /\|\s*([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let match;

    const filters = new Set();
    while ((match = pattern.exec(content)) !== null) {
      filters.add(match[1]);
    }

    if (filters.size > 0) {
      dependencies.set(DependencyType.FILTER, Array.from(filters));
    }
  }

  /**
   * Extract external resource dependencies (CSS, JS, images)
   */
  async extractResourceDependencies(content, dependencies, templatePath) {
    const patterns = [
      // CSS links
      /href\s*=\s*['"]([^'"]+\.css)['"]/gi,
      // JS scripts  
      /src\s*=\s*['"]([^'"]+\.js)['"]/gi,
      // Images
      /src\s*=\s*['"]([^'"]+\.(png|jpg|jpeg|gif|svg|webp))['"]/gi,
      // General assets
      /url\s*\(\s*['"]?([^'")]+)['"]\s*\)/gi
    ];

    const resources = [];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const resourcePath = match[1];
        if (!resourcePath.startsWith('http') && !resourcePath.startsWith('//')) {
          resources.push({
            path: resourcePath,
            type: this.getResourceType(resourcePath),
            line: this.getLineNumber(content, match.index)
          });
        }
      }
    }

    if (resources.length > 0) {
      dependencies.set(DependencyType.RESOURCE, resources);
    }
  }

  /**
   * Resolve dependency path relative to current template
   */
  async resolveDependencyPath(dependencyPath, currentTemplate) {
    // Handle absolute paths
    if (dependencyPath.startsWith('/')) {
      return dependencyPath.substring(1);
    }

    // Handle relative paths
    const currentDir = dirname(currentTemplate);
    const resolved = join(currentDir, dependencyPath);
    
    // Normalize path
    return resolved.replace(/\\/g, '/');
  }

  /**
   * Get resource type from file extension
   */
  getResourceType(path) {
    const ext = path.split('.').pop().toLowerCase();
    
    switch (ext) {
      case 'css': return 'stylesheet';
      case 'js': return 'script';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'webp': return 'image';
      default: return 'asset';
    }
  }

  /**
   * Get line number for dependency location
   */
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Update reverse dependency graph
   */
  updateReverseGraph(templatePath, dependencies) {
    // Remove old reverse dependencies
    if (this.reverseGraph.has(templatePath)) {
      for (const [depType, deps] of this.reverseGraph.get(templatePath)) {
        if (Array.isArray(deps)) {
          for (const dep of deps) {
            const depPath = dep.path || dep.name || dep;
            if (this.reverseGraph.has(depPath)) {
              const dependents = this.reverseGraph.get(depPath);
              const index = dependents.indexOf(templatePath);
              if (index > -1) {
                dependents.splice(index, 1);
              }
            }
          }
        }
      }
    }

    // Add new reverse dependencies
    for (const [depType, deps] of dependencies) {
      if (Array.isArray(deps)) {
        for (const dep of deps) {
          const depPath = dep.path || dep.name || dep;
          if (!this.reverseGraph.has(depPath)) {
            this.reverseGraph.set(depPath, []);
          }
          if (!this.reverseGraph.get(depPath).includes(templatePath)) {
            this.reverseGraph.get(depPath).push(templatePath);
          }
        }
      }
    }
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies(templatePath, visited = new Set(), path = []) {
    if (visited.has(templatePath)) {
      const cycleStart = path.indexOf(templatePath);
      return path.slice(cycleStart).concat([templatePath]);
    }

    visited.add(templatePath);
    path.push(templatePath);

    const dependencies = this.graph.get(templatePath);
    if (dependencies) {
      for (const [depType, deps] of dependencies) {
        if (Array.isArray(deps)) {
          for (const dep of deps) {
            const depPath = dep.path || dep.name || dep;
            const circular = this.detectCircularDependencies(depPath, visited, [...path]);
            if (circular.length > 0) {
              return circular;
            }
          }
        }
      }
    }

    visited.delete(templatePath);
    return [];
  }

  /**
   * Calculate template dependency depth
   */
  calculateTemplateDepth(templatePath, visited = new Set()) {
    if (visited.has(templatePath)) {
      return 0; // Circular dependency, return 0 to avoid infinite recursion
    }

    visited.add(templatePath);
    
    const dependencies = this.graph.get(templatePath);
    if (!dependencies || dependencies.size === 0) {
      return 0;
    }

    let maxDepth = 0;
    for (const [depType, deps] of dependencies) {
      if (Array.isArray(deps)) {
        for (const dep of deps) {
          const depPath = dep.path || dep.name || dep;
          const depth = this.calculateTemplateDepth(depPath, new Set(visited));
          maxDepth = Math.max(maxDepth, depth + 1);
        }
      }
    }

    visited.delete(templatePath);
    return maxDepth;
  }

  /**
   * Get templates that depend on the given template
   */
  getDependents(templatePath) {
    return this.reverseGraph.get(templatePath) || [];
  }

  /**
   * Get all dependencies of a template (recursive)
   */
  getAllDependencies(templatePath, visited = new Set()) {
    if (visited.has(templatePath)) {
      return new Set(); // Avoid circular dependencies
    }

    visited.add(templatePath);
    const allDeps = new Set();

    const dependencies = this.graph.get(templatePath);
    if (dependencies) {
      for (const [depType, deps] of dependencies) {
        if (Array.isArray(deps)) {
          for (const dep of deps) {
            const depPath = dep.path || dep.name || dep;
            allDeps.add(depPath);
            
            // Recursively get dependencies
            const subDeps = this.getAllDependencies(depPath, new Set(visited));
            for (const subDep of subDeps) {
              allDeps.add(subDep);
            }
          }
        }
      }
    }

    return allDeps;
  }

  /**
   * Get optimal compilation order (topological sort)
   */
  getCompilationOrder() {
    const visited = new Set();
    const visiting = new Set();
    const result = [];

    const visit = (templatePath) => {
      if (visiting.has(templatePath)) {
        throw new Error(`Circular dependency detected involving ${templatePath}`);
      }
      
      if (visited.has(templatePath)) {
        return;
      }

      visiting.add(templatePath);

      const dependencies = this.graph.get(templatePath);
      if (dependencies) {
        for (const [depType, deps] of dependencies) {
          if (Array.isArray(deps)) {
            for (const dep of deps) {
              const depPath = dep.path || dep.name || dep;
              if (this.graph.has(depPath)) {
                visit(depPath);
              }
            }
          }
        }
      }

      visiting.delete(templatePath);
      visited.add(templatePath);
      result.push(templatePath);
    };

    // Visit all templates
    for (const templatePath of this.graph.keys()) {
      if (!visited.has(templatePath)) {
        visit(templatePath);
      }
    }

    return result.reverse(); // Dependencies first, then dependents
  }

  /**
   * Watch template for changes
   */
  async watchTemplate(filePath, templatePath) {
    if (this.watchedFiles.has(filePath)) {
      return;
    }

    try {
      const { watch } = await import('chokidar');
      
      const watcher = watch(filePath, {
        persistent: true,
        ignoreInitial: true
      });

      watcher.on('change', async () => {
        await this.handleTemplateChange(templatePath, ChangeType.MODIFIED);
      });

      watcher.on('unlink', async () => {
        await this.handleTemplateChange(templatePath, ChangeType.DELETED);
      });

      this.watchers.set(filePath, watcher);
      this.watchedFiles.add(filePath);

    } catch (error) {
      console.warn(`Failed to watch template ${filePath}: ${error.message}`);
    }
  }

  /**
   * Handle template change
   */
  async handleTemplateChange(templatePath, changeType) {
    this.stats.incrementalUpdates++;

    // Add to change queue
    this.changeQueue.set(templatePath, {
      type: changeType,
      timestamp: this.getDeterministicTimestamp(),
      processed: false
    });

    // Invalidate caches
    this.invalidateCaches(templatePath);

    // Get all dependents that need updating
    const dependents = this.getDependents(templatePath);
    
    for (const dependent of dependents) {
      this.changeQueue.set(dependent, {
        type: ChangeType.MODIFIED,
        timestamp: this.getDeterministicTimestamp(),
        processed: false,
        cause: templatePath
      });
      
      this.invalidateCaches(dependent);
    }

    // Emit change event if callback is provided
    if (this.options.onChange) {
      this.options.onChange({
        templatePath,
        changeType,
        affectedTemplates: [templatePath, ...dependents]
      });
    }
  }

  /**
   * Process queued changes
   */
  async processChanges() {
    const changes = Array.from(this.changeQueue.entries())
      .filter(([_, change]) => !change.processed);

    if (changes.length === 0) {
      return [];
    }

    const results = [];

    for (const [templatePath, change] of changes) {
      try {
        if (change.type === ChangeType.DELETED) {
          // Remove from graph
          this.graph.delete(templatePath);
          this.templateMetadata.delete(templatePath);
          this.invalidateCaches(templatePath);
        } else {
          // Re-analyze dependencies
          const result = await this.analyzeDependencies(templatePath);
          results.push({ templatePath, result });
        }

        change.processed = true;

      } catch (error) {
        console.error(`Failed to process change for ${templatePath}: ${error.message}`);
      }
    }

    // Clean up processed changes
    for (const [templatePath, change] of this.changeQueue) {
      if (change.processed) {
        this.changeQueue.delete(templatePath);
      }
    }

    return results;
  }

  /**
   * Invalidate caches for template
   */
  invalidateCaches(templatePath) {
    // Remove from dependency cache
    for (const [key, value] of this.dependencyCache.entries()) {
      if (key.includes(templatePath)) {
        this.dependencyCache.delete(key);
      }
    }

    // Remove from analysis cache
    this.analysisCache.delete(templatePath);
  }

  /**
   * Create cache key for template
   */
  async createCacheKey(templatePath) {
    try {
      const fullPath = resolve(this.options.templatesDir, templatePath);
      const stats = await fs.stat(fullPath);
      
      return crypto.createHash('sha256')
        .update(templatePath)
        .update(stats.mtime.toISOString())
        .update(stats.size.toString())
        .digest('hex');
    } catch (error) {
      return crypto.createHash('sha256').update(templatePath).digest('hex');
    }
  }

  /**
   * Create content hash
   */
  createContentHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get dependency graph statistics
   */
  getStats() {
    return {
      ...this.stats,
      graphSize: this.graph.size,
      watchedFiles: this.watchedFiles.size,
      pendingChanges: this.changeQueue.size,
      cacheHitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses),
      averageDepth: Array.from(this.templateMetadata.values())
        .reduce((sum, meta) => sum + meta.depth, 0) / this.templateMetadata.size
    };
  }

  /**
   * Export dependency graph
   */
  exportGraph(format = 'json') {
    const graphData = {
      templates: Array.from(this.graph.entries()).map(([path, deps]) => ({
        path,
        dependencies: Object.fromEntries(deps),
        metadata: this.templateMetadata.get(path)
      })),
      stats: this.getStats(),
      exportedAt: this.getDeterministicDate().toISOString()
    };

    switch (format) {
      case 'json':
        return JSON.stringify(graphData, null, 2);
      case 'dot':
        return this.generateDotGraph(graphData);
      case 'mermaid':
        return this.generateMermaidGraph(graphData);
      default:
        return graphData;
    }
  }

  /**
   * Generate DOT graph format
   */
  generateDotGraph(graphData) {
    let dot = 'digraph TemplateDependencies {\n';
    dot += '  rankdir=TB;\n';
    dot += '  node [shape=box];\n\n';

    for (const template of graphData.templates) {
      const sanitizedPath = template.path.replace(/[^a-zA-Z0-9_]/g, '_');
      dot += `  "${sanitizedPath}" [label="${template.path}"];\n`;

      for (const [depType, deps] of Object.entries(template.dependencies)) {
        if (Array.isArray(deps)) {
          for (const dep of deps) {
            const depPath = dep.path || dep.name || dep;
            const sanitizedDep = depPath.replace(/[^a-zA-Z0-9_]/g, '_');
            dot += `  "${sanitizedPath}" -> "${sanitizedDep}" [label="${depType}"];\n`;
          }
        }
      }
    }

    dot += '}';
    return dot;
  }

  /**
   * Generate Mermaid graph format
   */
  generateMermaidGraph(graphData) {
    let mermaid = 'graph TB\n';

    for (const template of graphData.templates) {
      const nodeId = template.path.replace(/[^a-zA-Z0-9_]/g, '_');
      
      for (const [depType, deps] of Object.entries(template.dependencies)) {
        if (Array.isArray(deps)) {
          for (const dep of deps) {
            const depPath = dep.path || dep.name || dep;
            const depId = depPath.replace(/[^a-zA-Z0-9_]/g, '_');
            mermaid += `  ${nodeId}[${template.path}] --> ${depId}[${depPath}]\n`;
          }
        }
      }
    }

    return mermaid;
  }

  /**
   * Stop watching all files
   */
  async stopWatching() {
    for (const watcher of this.watchers.values()) {
      await watcher.close();
    }
    
    this.watchers.clear();
    this.watchedFiles.clear();
  }

  /**
   * Clear all caches and reset
   */
  reset() {
    this.graph.clear();
    this.reverseGraph.clear();
    this.templateMetadata.clear();
    this.changeQueue.clear();
    this.dependencyCache.clear();
    this.analysisCache.clear();
    
    this.stats = {
      analysisCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      circularDependencies: 0,
      totalDependencies: 0,
      deepestNesting: 0,
      incrementalUpdates: 0
    };
  }
}

/**
 * Factory function to create dependency graph
 */
export function createDependencyGraph(options = {}) {
  return new TemplateDependencyGraph(options);
}

export default TemplateDependencyGraph;