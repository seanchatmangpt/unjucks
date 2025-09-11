/**
 * Rules List Command
 * 
 * List available N3.js rule packs with metadata.
 * Essential for reasoning engine configuration in autonomous systems.
 */

import { defineCommand } from 'citty';
import { existsSync, statSync, readFileSync } from 'fs';
import { resolve, relative, extname, basename } from 'path';

import { success, error, output, paginated } from '../../lib/output.js';
import { loadKgenConfig, findFiles } from '../../lib/utils.js';

export default defineCommand({
  meta: {
    name: 'ls',
    description: 'List available rule packs and their metadata'
  },
  args: {
    type: {
      type: 'string',
      description: 'Filter by rule type: compliance|inference|validation|all',
      default: 'all',
      alias: 't'
    },
    pattern: {
      type: 'string',
      description: 'Pattern to filter rule pack names',
      alias: 'p'
    },
    sort: {
      type: 'string',
      description: 'Sort by: name|size|modified|rules',
      default: 'name',
      alias: 's'
    },
    details: {
      type: 'boolean',
      description: 'Include detailed rule pack information',
      alias: 'd'
    },
    limit: {
      type: 'number',
      description: 'Maximum rule packs to show',
      default: 50,
      alias: 'l'
    },
    page: {
      type: 'number',
      description: 'Page number for pagination',
      default: 1,
      alias: 'pg'
    },
    format: {
      type: 'string',
      description: 'Output format (json|yaml)',
      default: 'json',
      alias: 'f'
    }
  },
  async run({ args }) {
    try {
      const startTime = Date.now();
      
      // Load configuration
      const config = await loadKgenConfig(args.config);
      
      // Get rules directory
      const rulesDir = resolve(config.directories.rules);
      
      if (!existsSync(rulesDir)) {
        const result = success({
          rules: {
            directory: rulesDir,
            exists: false,
            rulePacks: [],
            statistics: {
              totalRulePacks: 0,
              byType: {},
              totalSize: 0
            }
          }
        });
        
        output(result, args.format);
        return;
      }
      
      // Find rule files
      const patterns = ['**/*.n3', '**/*.rules'];
      const ruleFiles = findFiles(patterns, {
        cwd: rulesDir,
        absolute: true
      });
      
      // Process rule packs
      const rulePacks = [];
      const typeStats = {};
      let totalSize = 0;
      
      for (const rulePath of ruleFiles) {
        const stats = statSync(rulePath);
        const relativePath = relative(rulesDir, rulePath);
        const ext = extname(rulePath);
        const packName = basename(relativePath, ext);
        
        // Apply pattern filter
        if (args.pattern && !packName.includes(args.pattern)) {
          continue;
        }
        
        const rulePack = {
          name: packName,
          path: relativePath,
          fullPath: rulePath,
          extension: ext,
          size: stats.size,
          sizeHuman: formatBytes(stats.size),
          modified: stats.mtime.toISOString(),
          created: stats.birthtime.toISOString()
        };
        
        // Analyze rule pack if details requested
        if (args.details) {
          try {
            const content = readFileSync(rulePath, 'utf8');
            const analysis = analyzeRulePack(content);
            
            rulePack.details = {
              lines: content.split('\n').length,
              rules: analysis.rules,
              prefixes: analysis.prefixes,
              type: analysis.type,
              complexity: analysis.complexity,
              imports: analysis.imports
            };
            
            // Apply type filter
            if (args.type !== 'all' && analysis.type !== args.type) {
              continue;
            }
            
            // Update type statistics
            typeStats[analysis.type] = (typeStats[analysis.type] || 0) + 1;
            
          } catch (e) {
            rulePack.details = {
              error: `Could not analyze rule pack: ${e.message}`
            };
            
            if (args.type !== 'all') {
              continue; // Skip if we can't determine type and type filter is active
            }
          }
        } else {
          // Basic type detection without full analysis
          const simpleType = detectRuleType(packName, relativePath);
          if (args.type !== 'all' && simpleType !== args.type) {
            continue;
          }
          typeStats[simpleType] = (typeStats[simpleType] || 0) + 1;
        }
        
        rulePacks.push(rulePack);
        totalSize += stats.size;
      }
      
      // Sort rule packs
      rulePacks.sort((a, b) => {
        switch (args.sort) {
          case 'size':
            return b.size - a.size;
          case 'modified':
            return new Date(b.modified) - new Date(a.modified);
          case 'rules':
            return (b.details?.rules || 0) - (a.details?.rules || 0);
          default: // name
            return a.name.localeCompare(b.name);
        }
      });
      
      // Paginate results
      const startIndex = (args.page - 1) * args.limit;
      const endIndex = startIndex + args.limit;
      const pageRulePacks = rulePacks.slice(startIndex, endIndex);
      
      const duration = Date.now() - startTime;
      
      const result = paginated(
        pageRulePacks,
        rulePacks.length,
        args.page,
        args.limit
      );
      
      // Add statistics
      result.data.statistics = {
        totalRulePacks: rulePacks.length,
        byType: typeStats,
        totalSize: formatBytes(totalSize),
        totalSizeBytes: totalSize,
        directory: rulesDir
      };
      
      // Add metadata
      result.metadata = {
        ...result.metadata,
        type: args.type,
        pattern: args.pattern,
        sort: args.sort,
        details: args.details,
        durationMs: duration
      };
      
      output(result, args.format);
      
    } catch (err) {
      const result = error(err.message, 'RULES_LIST_FAILED', {
        rulesDir: config?.directories?.rules,
        type: args.type,
        pattern: args.pattern,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });
      
      output(result, args.format);
      process.exit(1);
    }
  }
});

/**
 * Analyze N3 rule pack content
 * @param {string} content - Rule pack content
 * @returns {object} Analysis results
 */
function analyzeRulePack(content) {
  const analysis = {
    rules: 0,
    prefixes: [],
    imports: [],
    type: 'inference',
    complexity: 0
  };
  
  // Count rules (lines with => or <= or implications)
  const rulePatterns = [
    /=>/g,  // Forward implication
    /<=/g,  // Backward implication
    /:-/g   // Prolog-style rule
  ];
  
  analysis.rules = rulePatterns.reduce((count, pattern) => {
    return count + (content.match(pattern) || []).length;
  }, 0);
  
  // Extract prefixes
  const prefixPattern = /@prefix\s+([^:]+):\s*<([^>]+)>/g;
  let match;
  while ((match = prefixPattern.exec(content)) !== null) {
    analysis.prefixes.push({
      prefix: match[1],
      namespace: match[2]
    });
  }
  
  // Extract imports
  const importPattern = /@import\s*<([^>]+)>/g;
  while ((match = importPattern.exec(content)) !== null) {
    analysis.imports.push(match[1]);
  }
  
  // Determine rule type based on content
  if (content.includes('gdpr:') || content.includes('sox:') || content.includes('hipaa:')) {
    analysis.type = 'compliance';
  } else if (content.includes('sh:') || content.includes('shacl:')) {
    analysis.type = 'validation';  
  } else if (content.includes('log:') || content.includes('math:')) {
    analysis.type = 'inference';
  }
  
  // Calculate complexity (rough heuristic)
  const complexity = analysis.rules * 1 +
                    analysis.prefixes.length * 0.5 +
                    analysis.imports.length * 0.3 +
                    (content.split('?').length - 1) * 0.1; // Variable usage
  
  analysis.complexity = Math.round(complexity * 10) / 10;
  
  return analysis;
}

/**
 * Basic rule type detection from filename/path
 * @param {string} name - Rule pack name
 * @param {string} path - Relative path
 * @returns {string} Detected type
 */
function detectRuleType(name, path) {
  const lowercaseName = name.toLowerCase();
  const lowercasePath = path.toLowerCase();
  
  if (lowercaseName.includes('compliance') || 
      lowercaseName.includes('gdpr') || 
      lowercaseName.includes('sox') || 
      lowercaseName.includes('hipaa') ||
      lowercasePath.includes('compliance')) {
    return 'compliance';
  }
  
  if (lowercaseName.includes('validation') || 
      lowercaseName.includes('shacl') ||
      lowercasePath.includes('validation')) {
    return 'validation';
  }
  
  return 'inference';
}

/**
 * Format bytes into human-readable string
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}