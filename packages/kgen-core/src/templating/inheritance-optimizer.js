/**
 * KGEN Template Inheritance Optimizer
 * 
 * Optimizes template inheritance patterns including extends, blocks,
 * and macro systems for maximum performance and minimal overhead.
 * 
 * @author KGEN Advanced Enhancement Swarm - Agent #7
 * @version 2.0.0
 */

import { performance } from 'perf_hooks';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';

/**
 * Inheritance patterns
 */
export const InheritancePattern = {
  EXTENDS: 'extends',     // {% extends "base.html" %}
  INCLUDE: 'include',     // {% include "partial.html" %}
  IMPORT: 'import',       // {% import "macros.html" as m %}
  MACRO: 'macro',         // {% macro name() %}
  BLOCK: 'block',         // {% block content %}
  SUPER: 'super'          // {{ super() }}
};

/**
 * Optimization strategies
 */
export const OptimizationStrategy = {
  INLINE: 'inline',           // Inline templates directly
  FLATTEN: 'flatten',         // Flatten inheritance hierarchy
  MERGE: 'merge',             // Merge related templates
  SPECIALIZE: 'specialize',   // Create specialized versions
  CACHE: 'cache'              // Cache inheritance results
};

/**
 * Block merge strategies
 */
export const BlockMergeStrategy = {
  REPLACE: 'replace',         // Replace parent block
  APPEND: 'append',           // Append to parent block
  PREPEND: 'prepend',         // Prepend to parent block
  MERGE: 'merge'              // Smart merge of content
};

/**
 * Template Inheritance Optimizer
 */
export class TemplateInheritanceOptimizer {
  constructor(options = {}) {
    this.options = {
      templatesDir: options.templatesDir || '_templates',
      strategy: options.strategy || OptimizationStrategy.FLATTEN,
      maxInheritanceDepth: options.maxInheritanceDepth || 5,
      enableInlining: options.enableInlining !== false,
      enableFlattening: options.enableFlattening !== false,
      enableSpecialization: options.enableSpecialization !== false,
      inlineThreshold: options.inlineThreshold || 1024, // 1KB
      cacheEnabled: options.cacheEnabled !== false,
      preserveSourceMaps: options.preserveSourceMaps !== false,
      ...options
    };

    // Inheritance tracking
    this.inheritanceGraph = new Map(); // child -> parent mapping
    this.blockHierarchy = new Map();   // template -> blocks
    this.macroRegistry = new Map();    // macro name -> definition
    this.importRegistry = new Map();   // template -> imports
    
    // Optimization cache
    this.optimizationCache = new Map();
    this.flattenedTemplates = new Map();
    this.specializedTemplates = new Map();
    
    // Performance tracking
    this.stats = {
      templatesOptimized: 0,
      inheritanceFlattened: 0,
      blocksInlined: 0,
      macrosInlined: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageOptimizationTime: 0,
      totalOptimizationTime: 0,
      memoryReduction: 0
    };
  }

  /**
   * Optimize template inheritance structure
   */
  async optimizeTemplate(templatePath, templateContent) {
    const startTime = performance.now();
    this.stats.templatesOptimized++;

    try {
      // Check cache first
      const cacheKey = this.createCacheKey(templatePath, templateContent);
      if (this.optimizationCache.has(cacheKey)) {
        this.stats.cacheHits++;
        return this.optimizationCache.get(cacheKey);
      }

      this.stats.cacheMisses++;

      // Parse inheritance structure
      const inheritanceInfo = await this.parseInheritanceStructure(templatePath, templateContent);
      
      // Determine optimization strategy
      const strategy = this.determineOptimizationStrategy(inheritanceInfo);
      
      // Apply optimizations
      let optimizedTemplate = templateContent;
      const optimizations = [];

      switch (strategy) {
        case OptimizationStrategy.INLINE:
          const inlineResult = await this.applyInlineOptimization(templatePath, inheritanceInfo, optimizedTemplate);
          optimizedTemplate = inlineResult.content;
          optimizations.push(...inlineResult.optimizations);
          break;
          
        case OptimizationStrategy.FLATTEN:
          const flattenResult = await this.applyFlattenOptimization(templatePath, inheritanceInfo, optimizedTemplate);
          optimizedTemplate = flattenResult.content;
          optimizations.push(...flattenResult.optimizations);
          break;
          
        case OptimizationStrategy.MERGE:
          const mergeResult = await this.applyMergeOptimization(templatePath, inheritanceInfo, optimizedTemplate);
          optimizedTemplate = mergeResult.content;
          optimizations.push(...mergeResult.optimizations);
          break;
          
        case OptimizationStrategy.SPECIALIZE:
          const specializeResult = await this.applySpecializationOptimization(templatePath, inheritanceInfo, optimizedTemplate);
          optimizedTemplate = specializeResult.content;
          optimizations.push(...specializeResult.optimizations);
          break;
      }

      const optimizationTime = performance.now() - startTime;
      this.updateStats(optimizationTime);

      const result = {
        originalContent: templateContent,
        optimizedContent: optimizedTemplate,
        strategy,
        optimizations,
        inheritanceInfo,
        optimizationTime,
        metadata: {
          originalSize: templateContent.length,
          optimizedSize: optimizedTemplate.length,
          compressionRatio: 1 - (optimizedTemplate.length / templateContent.length),
          cacheKey
        }
      };

      // Cache result
      if (this.options.cacheEnabled) {
        this.optimizationCache.set(cacheKey, result);
      }

      return result;

    } catch (error) {
      throw new Error(`Template inheritance optimization failed for ${templatePath}: ${error.message}`);
    }
  }

  /**
   * Parse template inheritance structure
   */
  async parseInheritanceStructure(templatePath, content) {
    const structure = {
      templatePath,
      extends: null,
      includes: [],
      imports: [],
      macros: [],
      blocks: [],
      superCalls: [],
      depth: 0,
      dependencies: new Set()
    };

    // Parse extends
    const extendsMatch = content.match(/\{\%\s*extends\s+['"]([^'"]+)['"]\s*\%\}/);
    if (extendsMatch) {
      structure.extends = extendsMatch[1];
      structure.dependencies.add(structure.extends);
      
      // Calculate inheritance depth
      structure.depth = await this.calculateInheritanceDepth(structure.extends);
    }

    // Parse includes
    const includePattern = /\{\%\s*include\s+['"]([^'"]+)['"]\s*(?:with\s+[^%]+)?\s*\%\}/g;
    let match;
    while ((match = includePattern.exec(content)) !== null) {
      const includePath = match[1];
      structure.includes.push({
        path: includePath,
        line: this.getLineNumber(content, match.index),
        withContext: match[0].includes('with')
      });
      structure.dependencies.add(includePath);
    }

    // Parse imports
    const importPattern = /\{\%\s*(?:import|from)\s+['"]([^'"]+)['"]\s*(?:as\s+([a-zA-Z_][a-zA-Z0-9_]*)|import\s+([^%]+))?\s*\%\}/g;
    while ((match = importPattern.exec(content)) !== null) {
      const importPath = match[1];
      const alias = match[2];
      const imports = match[3];
      
      structure.imports.push({
        path: importPath,
        alias,
        imports: imports ? imports.split(',').map(s => s.trim()) : null,
        line: this.getLineNumber(content, match.index)
      });
      structure.dependencies.add(importPath);
    }

    // Parse macros
    const macroPattern = /\{\%\s*macro\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\%\}(.*?)\{\%\s*endmacro\s*\%\}/gs;
    while ((match = macroPattern.exec(content)) !== null) {
      const macroName = match[1];
      const parameters = match[2];
      const body = match[3];
      
      structure.macros.push({
        name: macroName,
        parameters: parameters.split(',').map(p => p.trim()).filter(p => p),
        body,
        line: this.getLineNumber(content, match.index),
        size: body.length
      });
    }

    // Parse blocks
    const blockPattern = /\{\%\s*block\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\%\}(.*?)\{\%\s*endblock\s*(?:\1)?\s*\%\}/gs;
    while ((match = blockPattern.exec(content)) !== null) {
      const blockName = match[1];
      const blockContent = match[2];
      
      structure.blocks.push({
        name: blockName,
        content: blockContent,
        line: this.getLineNumber(content, match.index),
        size: blockContent.length,
        hasSuperCall: blockContent.includes('super()')
      });
    }

    // Parse super calls
    const superPattern = /\{\{\s*super\(\s*\)\s*\}\}/g;
    while ((match = superPattern.exec(content)) !== null) {
      structure.superCalls.push({
        line: this.getLineNumber(content, match.index),
        context: this.extractContext(content, match.index, 50)
      });
    }

    return structure;
  }

  /**
   * Calculate inheritance depth
   */
  async calculateInheritanceDepth(templatePath, visited = new Set()) {
    if (visited.has(templatePath)) {
      return 0; // Circular dependency
    }

    visited.add(templatePath);

    try {
      const fullPath = join(this.options.templatesDir, templatePath);
      if (!existsSync(fullPath)) {
        return 0;
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      const extendsMatch = content.match(/\{\%\s*extends\s+['"]([^'"]+)['"]\s*\%\}/);
      
      if (extendsMatch) {
        const parentPath = extendsMatch[1];
        return 1 + await this.calculateInheritanceDepth(parentPath, new Set(visited));
      }
      
      return 0;

    } catch (error) {
      return 0;
    }
  }

  /**
   * Determine optimal optimization strategy
   */
  determineOptimizationStrategy(inheritanceInfo) {
    const { depth, includes, imports, blocks, macros } = inheritanceInfo;

    // Deep inheritance hierarchy - flatten
    if (depth > 2) {
      return OptimizationStrategy.FLATTEN;
    }

    // Many small includes - inline
    if (includes.length > 0 && includes.every(inc => this.shouldInline(inc.path))) {
      return OptimizationStrategy.INLINE;
    }

    // Simple block overrides - merge
    if (blocks.length > 0 && blocks.every(block => block.size < 500)) {
      return OptimizationStrategy.MERGE;
    }

    // Complex template - specialize
    if (macros.length > 3 || imports.length > 2) {
      return OptimizationStrategy.SPECIALIZE;
    }

    // Default to flattening
    return OptimizationStrategy.FLATTEN;
  }

  /**
   * Apply inline optimization
   */
  async applyInlineOptimization(templatePath, inheritanceInfo, content) {
    const optimizations = [];
    let optimizedContent = content;

    // Inline small includes
    for (const include of inheritanceInfo.includes) {
      if (await this.shouldInline(include.path)) {
        const inlineResult = await this.inlineTemplate(include.path, optimizedContent);
        if (inlineResult.success) {
          optimizedContent = inlineResult.content;
          optimizations.push({
            type: 'inline_include',
            path: include.path,
            reduction: inlineResult.originalSize - inlineResult.newSize
          });
          this.stats.blocksInlined++;
        }
      }
    }

    // Inline macros if they're used only once
    for (const macro of inheritanceInfo.macros) {
      const usage = this.countMacroUsage(optimizedContent, macro.name);
      if (usage === 1 && macro.size < this.options.inlineThreshold) {
        optimizedContent = this.inlineMacro(optimizedContent, macro);
        optimizations.push({
          type: 'inline_macro',
          name: macro.name,
          reduction: macro.size
        });
        this.stats.macrosInlined++;
      }
    }

    return {
      content: optimizedContent,
      optimizations
    };
  }

  /**
   * Apply flatten optimization
   */
  async applyFlattenOptimization(templatePath, inheritanceInfo, content) {
    const optimizations = [];
    let optimizedContent = content;

    if (inheritanceInfo.extends) {
      // Check if already flattened
      const flattenKey = `${templatePath}:${inheritanceInfo.extends}`;
      if (this.flattenedTemplates.has(flattenKey)) {
        this.stats.cacheHits++;
        return {
          content: this.flattenedTemplates.get(flattenKey),
          optimizations: [{ type: 'flatten_cached', key: flattenKey }]
        };
      }

      // Flatten inheritance hierarchy
      const flattenResult = await this.flattenInheritance(templatePath, inheritanceInfo);
      if (flattenResult.success) {
        optimizedContent = flattenResult.content;
        this.flattenedTemplates.set(flattenKey, optimizedContent);
        
        optimizations.push({
          type: 'flatten_inheritance',
          depth: inheritanceInfo.depth,
          reduction: content.length - optimizedContent.length
        });
        this.stats.inheritanceFlattened++;
      }
    }

    return {
      content: optimizedContent,
      optimizations
    };
  }

  /**
   * Apply merge optimization
   */
  async applyMergeOptimization(templatePath, inheritanceInfo, content) {
    const optimizations = [];
    let optimizedContent = content;

    // Merge related blocks
    const blockGroups = this.groupRelatedBlocks(inheritanceInfo.blocks);
    
    for (const group of blockGroups) {
      if (group.length > 1) {
        const mergeResult = this.mergeBlocks(group, optimizedContent);
        if (mergeResult.success) {
          optimizedContent = mergeResult.content;
          optimizations.push({
            type: 'merge_blocks',
            blocks: group.map(b => b.name),
            reduction: mergeResult.reduction
          });
        }
      }
    }

    return {
      content: optimizedContent,
      optimizations
    };
  }

  /**
   * Apply specialization optimization
   */
  async applySpecializationOptimization(templatePath, inheritanceInfo, content) {
    const optimizations = [];
    let optimizedContent = content;

    // Create specialized versions for common usage patterns
    const specializationKey = this.createSpecializationKey(inheritanceInfo);
    
    if (this.specializedTemplates.has(specializationKey)) {
      this.stats.cacheHits++;
      return {
        content: this.specializedTemplates.get(specializationKey),
        optimizations: [{ type: 'specialization_cached', key: specializationKey }]
      };
    }

    // Generate specialized template
    const specializeResult = await this.createSpecializedTemplate(templatePath, inheritanceInfo, content);
    if (specializeResult.success) {
      optimizedContent = specializeResult.content;
      this.specializedTemplates.set(specializationKey, optimizedContent);
      
      optimizations.push({
        type: 'template_specialization',
        patterns: specializeResult.patterns,
        reduction: content.length - optimizedContent.length
      });
    }

    return {
      content: optimizedContent,
      optimizations
    };
  }

  /**
   * Flatten inheritance hierarchy
   */
  async flattenInheritance(templatePath, inheritanceInfo) {
    try {
      const hierarchy = await this.buildInheritanceHierarchy(templatePath);
      const flattened = await this.flattenHierarchy(hierarchy);
      
      return {
        success: true,
        content: flattened,
        hierarchy: hierarchy.map(h => h.path)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build complete inheritance hierarchy
   */
  async buildInheritanceHierarchy(templatePath, visited = new Set()) {
    if (visited.has(templatePath)) {
      throw new Error(`Circular inheritance detected: ${templatePath}`);
    }

    visited.add(templatePath);
    const hierarchy = [];

    try {
      const fullPath = join(this.options.templatesDir, templatePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const structure = await this.parseInheritanceStructure(templatePath, content);
      
      hierarchy.push({
        path: templatePath,
        content,
        structure
      });

      // Recursively build parent hierarchy
      if (structure.extends) {
        const parentHierarchy = await this.buildInheritanceHierarchy(
          structure.extends, 
          new Set(visited)
        );
        hierarchy.unshift(...parentHierarchy);
      }

      return hierarchy;

    } catch (error) {
      throw new Error(`Failed to build hierarchy for ${templatePath}: ${error.message}`);
    }
  }

  /**
   * Flatten hierarchy into single template
   */
  async flattenHierarchy(hierarchy) {
    if (hierarchy.length === 0) {
      return '';
    }

    // Start with root template (first in hierarchy)
    let flattened = hierarchy[0].content;
    const blockMap = new Map();

    // Collect all blocks from hierarchy
    for (const level of hierarchy) {
      for (const block of level.structure.blocks) {
        if (!blockMap.has(block.name)) {
          blockMap.set(block.name, []);
        }
        blockMap.get(block.name).push({
          ...block,
          templatePath: level.path
        });
      }
    }

    // Apply block overrides (child blocks override parent blocks)
    for (const [blockName, blocks] of blockMap) {
      if (blocks.length > 1) {
        // Use the last (child-most) block
        const finalBlock = blocks[blocks.length - 1];
        
        // Handle super() calls
        if (finalBlock.hasSuperCall && blocks.length > 1) {
          const parentBlock = blocks[blocks.length - 2];
          finalBlock.content = finalBlock.content.replace(
            /\{\{\s*super\(\s*\)\s*\}\}/g,
            parentBlock.content
          );
        }

        // Replace block in flattened template
        const blockPattern = new RegExp(
          `\\{\\%\\s*block\\s+${blockName}\\s*\\%\\}.*?\\{\\%\\s*endblock\\s*(?:${blockName})?\\s*\\%\\}`,
          'gs'
        );
        
        flattened = flattened.replace(blockPattern, 
          `{% block ${blockName} %}${finalBlock.content}{% endblock ${blockName} %}`
        );
      }
    }

    // Remove extends statement
    flattened = flattened.replace(/\{\%\s*extends\s+['"][^'"]+['"]\s*\%\}\s*/, '');

    return flattened;
  }

  /**
   * Check if template should be inlined
   */
  async shouldInline(templatePath) {
    try {
      const fullPath = join(this.options.templatesDir, templatePath);
      const stats = await fs.stat(fullPath);
      return stats.size < this.options.inlineThreshold;
    } catch (error) {
      return false;
    }
  }

  /**
   * Inline template content
   */
  async inlineTemplate(templatePath, content) {
    try {
      const fullPath = join(this.options.templatesDir, templatePath);
      const templateContent = await fs.readFile(fullPath, 'utf-8');
      
      // Replace include statement with template content
      const includePattern = new RegExp(
        `\\{\\%\\s*include\\s+['"]${templatePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*(?:with\\s+[^%]+)?\\s*\\%\\}`,
        'g'
      );
      
      const newContent = content.replace(includePattern, templateContent);
      
      return {
        success: true,
        content: newContent,
        originalSize: content.length,
        newSize: newContent.length
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Count macro usage in content
   */
  countMacroUsage(content, macroName) {
    const usagePattern = new RegExp(
      `\\{\\{\\s*${macroName}\\s*\\([^}]*\\)\\s*\\}\\}|\\{\\%\\s*call\\s+${macroName}\\s*\\([^}]*\\)\\s*\\%\\}`,
      'g'
    );
    
    const matches = content.match(usagePattern);
    return matches ? matches.length : 0;
  }

  /**
   * Inline macro definition
   */
  inlineMacro(content, macro) {
    // Find macro usage
    const usagePattern = new RegExp(
      `\\{\\{\\s*${macro.name}\\s*\\(([^}]*)\\)\\s*\\}\\}`,
      'g'
    );

    // Replace usage with macro body
    const inlined = content.replace(usagePattern, (match, args) => {
      let macroBody = macro.body;
      
      // Simple parameter substitution
      const paramList = macro.parameters;
      const argList = args.split(',').map(arg => arg.trim());
      
      for (let i = 0; i < paramList.length && i < argList.length; i++) {
        const paramPattern = new RegExp(`\\{\\{\\s*${paramList[i]}\\s*\\}\\}`, 'g');
        macroBody = macroBody.replace(paramPattern, argList[i]);
      }
      
      return macroBody;
    });

    // Remove macro definition
    const macroDefPattern = new RegExp(
      `\\{\\%\\s*macro\\s+${macro.name}\\s*\\([^)]*\\)\\s*\\%\\}.*?\\{\\%\\s*endmacro\\s*\\%\\}`,
      'gs'
    );
    
    return inlined.replace(macroDefPattern, '');
  }

  /**
   * Group related blocks for merging
   */
  groupRelatedBlocks(blocks) {
    const groups = [];
    const processed = new Set();

    for (const block of blocks) {
      if (processed.has(block.name)) continue;

      const group = [block];
      processed.add(block.name);

      // Find related blocks (simple heuristic: similar names or content)
      for (const other of blocks) {
        if (other.name !== block.name && !processed.has(other.name)) {
          if (this.areBlocksRelated(block, other)) {
            group.push(other);
            processed.add(other.name);
          }
        }
      }

      groups.push(group);
    }

    return groups.filter(group => group.length > 1);
  }

  /**
   * Check if blocks are related
   */
  areBlocksRelated(block1, block2) {
    // Simple relatedness check - can be enhanced
    const similarity = this.calculateContentSimilarity(block1.content, block2.content);
    return similarity > 0.7;
  }

  /**
   * Calculate content similarity
   */
  calculateContentSimilarity(content1, content2) {
    const words1 = content1.split(/\s+/);
    const words2 = content2.split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Merge related blocks
   */
  mergeBlocks(blockGroup, content) {
    // Simple merge strategy - combine block contents
    const mergedContent = blockGroup
      .map(block => block.content)
      .join('\n');

    const firstBlock = blockGroup[0];
    const blockPattern = new RegExp(
      `\\{\\%\\s*block\\s+${firstBlock.name}\\s*\\%\\}.*?\\{\\%\\s*endblock\\s*(?:${firstBlock.name})?\\s*\\%\\}`,
      'gs'
    );

    const newContent = content.replace(blockPattern,
      `{% block ${firstBlock.name} %}${mergedContent}{% endblock ${firstBlock.name} %}`
    );

    return {
      success: true,
      content: newContent,
      reduction: content.length - newContent.length
    };
  }

  /**
   * Create specialization key
   */
  createSpecializationKey(inheritanceInfo) {
    const components = [
      inheritanceInfo.templatePath,
      inheritanceInfo.extends || 'none',
      inheritanceInfo.includes.length.toString(),
      inheritanceInfo.blocks.length.toString()
    ];
    
    return crypto.createHash('sha256')
      .update(components.join(':'))
      .digest('hex');
  }

  /**
   * Create specialized template
   */
  async createSpecializedTemplate(templatePath, inheritanceInfo, content) {
    // This would create specialized versions based on usage patterns
    // Implementation would depend on specific optimization goals
    
    return {
      success: true,
      content: content, // Placeholder - would contain specialized content
      patterns: ['pattern1', 'pattern2']
    };
  }

  /**
   * Get line number for position
   */
  getLineNumber(content, position) {
    return content.substring(0, position).split('\n').length;
  }

  /**
   * Extract context around position
   */
  extractContext(content, position, radius) {
    const start = Math.max(0, position - radius);
    const end = Math.min(content.length, position + radius);
    return content.substring(start, end);
  }

  /**
   * Create cache key
   */
  createCacheKey(templatePath, content) {
    return crypto.createHash('sha256')
      .update(`${templatePath}:${content}`)
      .digest('hex');
  }

  /**
   * Update statistics
   */
  updateStats(optimizationTime) {
    this.stats.totalOptimizationTime += optimizationTime;
    this.stats.averageOptimizationTime = 
      this.stats.totalOptimizationTime / this.stats.templatesOptimized;
  }

  /**
   * Get optimization statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheHitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses),
      cacheSize: this.optimizationCache.size,
      flattenedTemplatesCount: this.flattenedTemplates.size,
      specializedTemplatesCount: this.specializedTemplates.size
    };
  }

  /**
   * Clear caches
   */
  clearCaches() {
    this.optimizationCache.clear();
    this.flattenedTemplates.clear();
    this.specializedTemplates.clear();
    
    this.stats.cacheHits = 0;
    this.stats.cacheMisses = 0;
  }

  /**
   * Export optimization report
   */
  exportReport() {
    return {
      stats: this.getStats(),
      inheritanceGraph: Object.fromEntries(this.inheritanceGraph),
      blockHierarchy: Object.fromEntries(this.blockHierarchy),
      macroRegistry: Object.fromEntries(this.macroRegistry),
      optimizations: {
        flattened: this.flattenedTemplates.size,
        specialized: this.specializedTemplates.size,
        cached: this.optimizationCache.size
      },
      exportedAt: new Date().toISOString()
    };
  }
}

/**
 * Factory function to create inheritance optimizer
 */
export function createInheritanceOptimizer(options = {}) {
  return new TemplateInheritanceOptimizer(options);
}

export default TemplateInheritanceOptimizer;