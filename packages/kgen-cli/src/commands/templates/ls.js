/**
 * Templates List Command
 * 
 * List available Nunjucks templates with metadata.
 * Essential for template discovery in autonomous generation systems.
 */

import { defineCommand } from 'citty';
import { existsSync, statSync, readFileSync } from 'fs';
import { resolve, join, relative, extname, basename } from 'path';

import { success, error, output, paginated } from '../../lib/output.js';
import { loadKgenConfig, findFiles } from '../../lib/utils.js';

export default defineCommand({
  meta: {
    name: 'ls',
    description: 'List available templates and their metadata'
  },
  args: {
    pattern: {
      type: 'string',
      description: 'Pattern to filter template names',
      alias: 'p'
    },
    type: {
      type: 'string',
      description: 'Filter by template type: njk|j2|all',
      default: 'all',
      alias: 't'
    },
    sort: {
      type: 'string',
      description: 'Sort by: name|size|modified|type',
      default: 'name',
      alias: 's'
    },
    details: {
      type: 'boolean',
      description: 'Include detailed template information',
      alias: 'd'
    },
    limit: {
      type: 'number',
      description: 'Maximum templates to show',
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
      const startTime = this.getDeterministicTimestamp();
      
      // Load configuration
      const config = await loadKgenConfig(args.config);
      
      // Get templates directory
      const templatesDir = resolve(config.directories.templates);
      
      if (!existsSync(templatesDir)) {
        const result = success({
          templates: {
            directory: templatesDir,
            exists: false,
            templates: [],
            statistics: {
              totalTemplates: 0,
              byType: {},
              totalSize: 0
            }
          }
        });
        
        output(result, args.format);
        return;
      }
      
      // Find template files based on type filter
      let patterns = [];
      switch (args.type) {
        case 'njk':
          patterns = ['**/*.njk'];
          break;
        case 'j2':
          patterns = ['**/*.j2'];
          break;
        default:
          patterns = ['**/*.njk', '**/*.j2'];
      }
      
      const templateFiles = findFiles(patterns, {
        cwd: templatesDir,
        absolute: true
      });
      
      // Process templates
      const templates = [];
      const typeStats = {};
      let totalSize = 0;
      
      for (const templatePath of templateFiles) {
        const stats = statSync(templatePath);
        const relativePath = relative(templatesDir, templatePath);
        const ext = extname(templatePath);
        const templateName = basename(relativePath, ext);
        const templateType = ext.substring(1); // Remove the dot
        
        // Apply pattern filter
        if (args.pattern && !relativePath.includes(args.pattern)) {
          continue;
        }
        
        const template = {
          name: templateName,
          path: relativePath,
          fullPath: templatePath,
          type: templateType,
          size: stats.size,
          sizeHuman: formatBytes(stats.size),
          modified: stats.mtime.toISOString(),
          created: stats.birthtime.toISOString()
        };
        
        // Add detailed information if requested
        if (args.details) {
          try {
            const content = readFileSync(templatePath, 'utf8');
            const analysis = analyzeTemplate(content, templateType);
            
            template.details = {
              lines: content.split('\n').length,
              variables: analysis.variables,
              blocks: analysis.blocks,
              includes: analysis.includes,
              extends: analysis.extends,
              frontmatter: analysis.frontmatter
            };
          } catch (e) {
            template.details = {
              error: `Could not analyze template: ${e.message}`
            };
          }
        }
        
        templates.push(template);
        
        // Update statistics
        typeStats[templateType] = (typeStats[templateType] || 0) + 1;
        totalSize += stats.size;
      }
      
      // Sort templates
      templates.sort((a, b) => {
        switch (args.sort) {
          case 'size':
            return b.size - a.size;
          case 'modified':
            return new Date(b.modified) - new Date(a.modified);
          case 'type':
            return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
          default: // name
            return a.name.localeCompare(b.name);
        }
      });
      
      // Paginate results
      const startIndex = (args.page - 1) * args.limit;
      const endIndex = startIndex + args.limit;
      const pageTemplates = templates.slice(startIndex, endIndex);
      
      const duration = this.getDeterministicTimestamp() - startTime;
      
      const result = paginated(
        pageTemplates,
        templates.length,
        args.page,
        args.limit
      );
      
      // Add templates statistics
      result.data.statistics = {
        totalTemplates: templates.length,
        byType: typeStats,
        totalSize: formatBytes(totalSize),
        totalSizeBytes: totalSize,
        directory: templatesDir
      };
      
      // Add metadata
      result.metadata = {
        ...result.metadata,
        pattern: args.pattern,
        type: args.type,
        sort: args.sort,
        details: args.details,
        durationMs: duration
      };
      
      output(result, args.format);
      
    } catch (err) {
      const result = error(err.message, 'TEMPLATES_LIST_FAILED', {
        templatesDir: config?.directories?.templates,
        pattern: args.pattern,
        type: args.type,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });
      
      output(result, args.format);
      process.exit(1);
    }
  }
});

/**
 * Analyze template content to extract metadata
 * @param {string} content - Template content
 * @param {string} type - Template type (njk|j2)
 * @returns {object} Analysis results
 */
function analyzeTemplate(content, type) {
  const analysis = {
    variables: [],
    blocks: [],
    includes: [],
    extends: null,
    frontmatter: null
  };
  
  // Extract frontmatter if present
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (frontmatterMatch) {
    try {
      analysis.frontmatter = require('yaml').parse(frontmatterMatch[1]);
    } catch (e) {
      analysis.frontmatter = { error: 'Invalid YAML frontmatter' };
    }
  }
  
  // Extract Nunjucks/Jinja2 constructs
  const variablePattern = /\{\{\s*([^}]+)\s*\}\}/g;
  const blockPattern = /\{\%\s*block\s+([^%]+)\s*\%\}/g;
  const includePattern = /\{\%\s*include\s+['"](([^'"]+))['"]/g;
  const extendsPattern = /\{\%\s*extends\s+['"](([^'"]+))['"]/g;
  
  let match;
  
  // Find variables
  while ((match = variablePattern.exec(content)) !== null) {
    const variable = match[1].trim();
    if (!analysis.variables.includes(variable)) {
      analysis.variables.push(variable);
    }
  }
  
  // Find blocks
  while ((match = blockPattern.exec(content)) !== null) {
    const block = match[1].trim();
    if (!analysis.blocks.includes(block)) {
      analysis.blocks.push(block);
    }
  }
  
  // Find includes
  while ((match = includePattern.exec(content)) !== null) {
    const include = match[1];
    if (!analysis.includes.includes(include)) {
      analysis.includes.push(include);
    }
  }
  
  // Find extends
  const extendsMatch = extendsPattern.exec(content);
  if (extendsMatch) {
    analysis.extends = extendsMatch[1];
  }
  
  return analysis;
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