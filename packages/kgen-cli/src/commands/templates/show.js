/**
 * Templates Show Command
 * 
 * Show detailed information about specific template.
 * Essential for understanding template capabilities and requirements.
 */

import { defineCommand } from 'citty';
import { existsSync, statSync, readFileSync } from 'fs';
import { resolve, join, extname, basename, relative } from 'path';

import { success, error, output } from '../../lib/output.js';
import { loadKgenConfig, findFiles } from '../../lib/utils.js';
import { parse as yamlParse } from 'yaml';

export default defineCommand({
  meta: {
    name: 'show',
    description: 'Show detailed information about specific template'
  },
  args: {
    name: {
      type: 'string',
      description: 'Template name to show',
      required: true,
      alias: 'n'
    },
    content: {
      type: 'boolean',
      description: 'Include template content in output',
      default: false,
      alias: 'c'
    },
    variables: {
      type: 'boolean',
      description: 'Extract and show all template variables',
      default: true,
      alias: 'v'
    },
    dependencies: {
      type: 'boolean',
      description: 'Analyze template dependencies (includes/extends)',
      default: true,
      alias: 'd'
    },
    format: {
      type: 'string',
      description: 'Output format (json|yaml)',
      default: 'json',
      alias: 'f'
    }
  },
  async run({ args }) {
    let config;
    try {
      const startTime = this.getDeterministicTimestamp();
      
      // Load configuration
      config = await loadKgenConfig(args.config);
      
      // Get templates directory
      const templatesDir = resolve(config.directories.templates);
      
      if (!existsSync(templatesDir)) {
        throw new Error(`Templates directory not found: ${templatesDir}`);
      }
      
      // Find matching template files
      const patterns = ['**/*.njk', '**/*.j2'];
      const templateFiles = findFiles(patterns, {
        cwd: templatesDir,
        absolute: true
      });
      
      // Find template by name
      const matchingFiles = templateFiles.filter(file => {
        const name = basename(file, extname(file));
        return name === args.name || file.includes(args.name);
      });
      
      if (matchingFiles.length === 0) {
        throw new Error(`Template not found: ${args.name}`);
      }
      
      if (matchingFiles.length > 1) {
        throw new Error(`Multiple templates match '${args.name}': ${matchingFiles.map(f => basename(f)).join(', ')}`);
      }
      
      const templatePath = matchingFiles[0];
      const stats = statSync(templatePath);
      const content = readFileSync(templatePath, 'utf8');
      
      // Basic template information
      const relativePath = relative(templatesDir, templatePath);
      const templateType = extname(templatePath).substring(1);
      
      // Analyze template
      const analysis = analyzeTemplateDetailed(content, templateType);
      
      // Build dependency graph if requested
      let dependencyGraph = null;
      if (args.dependencies) {
        dependencyGraph = buildDependencyGraph(analysis, templatesDir);
      }
      
      // Validate template syntax
      const validation = validateTemplate(content, templateType);
      
      const duration = this.getDeterministicTimestamp() - startTime;
      
      const result = success({
        template: {
          name: args.name,
          path: relativePath,
          fullPath: templatePath,
          type: templateType,
          found: true
        },
        file: {
          size: stats.size,
          sizeHuman: formatBytes(stats.size),
          lines: content.split('\n').length,
          modified: stats.mtime.toISOString(),
          created: stats.birthtime.toISOString()
        },
        analysis: {
          frontmatter: analysis.frontmatter,
          variables: args.variables ? analysis.variables : analysis.variables.length,
          blocks: analysis.blocks,
          includes: analysis.includes,
          extends: analysis.extends,
          macros: analysis.macros,
          filters: analysis.filters
        },
        dependencies: dependencyGraph,
        validation,
        content: args.content ? {
          raw: content,
          preview: content.length > 1000 ? content.substring(0, 1000) + '...' : content
        } : null,
        metrics: {
          durationMs: duration
        }
      });
      
      output(result, args.format);
      
    } catch (err) {
      const result = error(err.message, 'TEMPLATE_SHOW_FAILED', {
        name: args.name,
        templatesDir: config?.directories?.templates,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });
      
      output(result, args.format);
      process.exit(1);
    }
  }
});

/**
 * Detailed template analysis
 * @param {string} content - Template content
 * @param {string} type - Template type
 * @returns {object} Detailed analysis
 */
function analyzeTemplateDetailed(content, type) {
  const analysis = {
    variables: [],
    blocks: [],
    includes: [],
    extends: null,
    macros: [],
    filters: [],
    frontmatter: null,
    comments: [],
    complexity: 0
  };
  
  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (frontmatterMatch) {
    try {
      analysis.frontmatter = yamlParse(frontmatterMatch[1]);
    } catch (e) {
      analysis.frontmatter = { error: 'Invalid YAML frontmatter' };
    }
  }
  
  // Regular expressions for different constructs
  const patterns = {
    variable: /\{\{\s*([^}]+)\s*\}\}/g,
    block: /\{\%\s*block\s+([^%]+)\s*\%\}/g,
    include: /\{\%\s*include\s+['"](([^'"]+))['"]/g,
    extends: /\{\%\s*extends\s+['"](([^'"]+))['"]/g,
    macro: /\{\%\s*macro\s+([^%]+)\s*\%\}/g,
    filter: /\|\s*(\w+)/g,
    comment: /\{#\s*(.*?)\s*#\}/g,
    conditional: /\{\%\s*if\s+/g,
    loop: /\{\%\s*for\s+/g
  };
  
  let match;
  
  // Extract variables with context
  while ((match = patterns.variable.exec(content)) !== null) {
    const variable = match[1].trim();
    const parts = variable.split('|')[0].trim(); // Remove filters for variable name
    const varName = parts.split('.')[0].split('[')[0].trim(); // Get base variable name
    
    if (!analysis.variables.find(v => v.name === varName)) {
      analysis.variables.push({
        name: varName,
        expression: variable,
        line: content.substring(0, match.index).split('\n').length
      });
    }
  }
  
  // Extract blocks
  while ((match = patterns.block.exec(content)) !== null) {
    const block = match[1].trim();
    analysis.blocks.push({
      name: block,
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  // Extract includes
  while ((match = patterns.include.exec(content)) !== null) {
    analysis.includes.push({
      template: match[1],
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  // Extract extends
  const extendsMatch = patterns.extends.exec(content);
  if (extendsMatch) {
    analysis.extends = {
      template: extendsMatch[1],
      line: content.substring(0, extendsMatch.index).split('\n').length
    };
  }
  
  // Extract macros
  while ((match = patterns.macro.exec(content)) !== null) {
    const macro = match[1].trim();
    analysis.macros.push({
      signature: macro,
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  // Extract filters
  while ((match = patterns.filter.exec(content)) !== null) {
    const filter = match[1];
    if (!analysis.filters.includes(filter)) {
      analysis.filters.push(filter);
    }
  }
  
  // Extract comments
  while ((match = patterns.comment.exec(content)) !== null) {
    analysis.comments.push({
      text: match[1].trim(),
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  // Calculate complexity score
  const conditionals = (content.match(patterns.conditional) || []).length;
  const loops = (content.match(patterns.loop) || []).length;
  analysis.complexity = analysis.variables.length + 
                       (conditionals * 2) + 
                       (loops * 3) + 
                       analysis.includes.length +
                       analysis.macros.length;
  
  return analysis;
}

/**
 * Build template dependency graph
 * @param {object} analysis - Template analysis
 * @param {string} templatesDir - Templates directory
 * @returns {object} Dependency graph
 */
function buildDependencyGraph(analysis, templatesDir) {
  const dependencies = {
    direct: [],
    all: new Set(),
    circular: false,
    depth: 0
  };
  
  // Add extends dependency
  if (analysis.extends) {
    dependencies.direct.push({
      type: 'extends',
      template: analysis.extends.template,
      exists: existsSync(join(templatesDir, analysis.extends.template))
    });
    dependencies.all.add(analysis.extends.template);
  }
  
  // Add include dependencies
  analysis.includes.forEach(include => {
    dependencies.direct.push({
      type: 'include',
      template: include.template,
      exists: existsSync(join(templatesDir, include.template))
    });
    dependencies.all.add(include.template);
  });
  
  // TODO: In a full implementation, would recursively analyze dependencies
  // to detect circular references and calculate full dependency tree
  
  dependencies.depth = dependencies.direct.length > 0 ? 1 : 0;
  
  return dependencies;
}

/**
 * Validate template syntax
 * @param {string} content - Template content
 * @param {string} type - Template type
 * @returns {object} Validation results
 */
function validateTemplate(content, type) {
  const validation = {
    valid: true,
    errors: [],
    warnings: []
  };
  
  // Basic syntax validation
  const openTags = (content.match(/\{\%/g) || []).length;
  const closeTags = (content.match(/\%\}/g) || []).length;
  
  if (openTags !== closeTags) {
    validation.valid = false;
    validation.errors.push({
      type: 'syntax_error',
      message: `Mismatched template tags: ${openTags} opening tags, ${closeTags} closing tags`
    });
  }
  
  // Check for unclosed blocks
  const blockOpenPattern = /\{\%\s*(if|for|block|macro)\s+/g;
  const blockClosePattern = /\{\%\s*end(if|for|block|macro)\s*\%\}/g;
  
  const opens = content.match(blockOpenPattern) || [];
  const closes = content.match(blockClosePattern) || [];
  
  if (opens.length !== closes.length) {
    validation.valid = false;
    validation.errors.push({
      type: 'unclosed_block',
      message: `Unclosed blocks detected: ${opens.length} opens, ${closes.length} closes`
    });
  }
  
  // Check for undefined variables in frontmatter
  if (content.includes('undefined') || content.includes('null')) {
    validation.warnings.push({
      type: 'potential_undefined',
      message: 'Template contains "undefined" or "null" - check variable definitions'
    });
  }
  
  return validation;
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