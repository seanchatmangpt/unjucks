/**
 * Enhanced Templates Show Command with Frontmatter Support
 * 
 * Show detailed information about templates including comprehensive
 * frontmatter analysis, metadata extraction, and validation.
 */

import { defineCommand } from 'citty';
import { existsSync, statSync, readFileSync } from 'fs';
import { resolve, join, extname, basename, relative } from 'path';

import { success, error, output } from '../../lib/output.js';
import { loadKgenConfig, findFiles } from '../../lib/utils.js';
import { FrontmatterWorkflowEngine, MetadataExtractor } from '../../../src/kgen/core/frontmatter/index.js';

export default defineCommand({
  meta: {
    name: 'show-enhanced',
    description: 'Show detailed template information with enhanced frontmatter analysis'
  },
  args: {
    name: {
      type: 'string',
      description: 'Template name to analyze',
      required: true,
      alias: 'n'
    },
    content: {
      type: 'boolean',
      description: 'Include template content in output',
      default: false,
      alias: 'c'
    },
    metadata: {
      type: 'boolean',
      description: 'Extract comprehensive metadata',
      default: true,
      alias: 'm'
    },
    validate: {
      type: 'boolean',
      description: 'Validate frontmatter against schema',
      default: true,
      alias: 'v'
    },
    schema: {
      type: 'string',
      description: 'Schema name for validation',
      default: 'kgen',
      alias: 's'
    },
    variables: {
      type: 'boolean',
      description: 'Extract and analyze variables',
      default: true,
      alias: 'var'
    },
    security: {
      type: 'boolean',
      description: 'Perform security analysis',
      default: true,
      alias: 'sec'
    },
    dependencies: {
      type: 'boolean',
      description: 'Analyze template dependencies',
      default: true,
      alias: 'd'
    },
    complexity: {
      type: 'boolean',
      description: 'Calculate complexity metrics',
      default: true,
      alias: 'x'
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
    let workflowEngine;
    
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
      const patterns = ['**/*.njk', '**/*.j2', '**/*.ejs'];
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
      
      // Initialize frontmatter workflow engine
      workflowEngine = new FrontmatterWorkflowEngine({
        enableValidation: args.validate,
        enableSchemaValidation: args.validate,
        enableProvenance: false,
        deterministic: true
      });
      
      await workflowEngine.initialize();
      
      // Extract variables if requested
      let variableAnalysis = null;
      if (args.variables) {
        try {
          variableAnalysis = await workflowEngine.extractVariables(content);
        } catch (variableError) {
          variableAnalysis = {
            error: `Variable extraction failed: ${variableError.message}`
          };
        }
      }
      
      // Validate frontmatter if requested
      let frontmatterValidation = null;
      if (args.validate && content.includes('---')) {
        try {
          frontmatterValidation = await workflowEngine.validateTemplate(content, args.schema);
        } catch (validationError) {
          frontmatterValidation = {
            valid: false,
            errors: [`Validation failed: ${validationError.message}`],
            warnings: []
          };
        }
      }
      
      // Extract comprehensive metadata if requested
      let metadataAnalysis = null;
      if (args.metadata) {
        try {
          const metadataExtractor = new MetadataExtractor({
            enableProvenance: false,
            enableDependencyAnalysis: args.dependencies,
            enableVariableTracking: args.variables,
            enableComplexityAnalysis: args.complexity,
            enableSecurityAnalysis: args.security
          });
          
          // Parse frontmatter first
          const parseResult = await workflowEngine.parser.parse(content, args.validate);
          
          if (parseResult.hasValidFrontmatter) {
            metadataAnalysis = await metadataExtractor.extract(parseResult.frontmatter, {
              templateContent: parseResult.content,
              context: {},
              operationId: `show-${args.name}`
            });
          }
        } catch (metadataError) {
          metadataAnalysis = {
            error: `Metadata extraction failed: ${metadataError.message}`
          };
        }
      }
      
      // Perform basic template analysis
      const basicAnalysis = await analyzeBasicTemplate(content, templateType);
      
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
          basic: basicAnalysis,
          variables: variableAnalysis,
          metadata: metadataAnalysis
        },
        frontmatter: {
          validation: frontmatterValidation,
          hasValidFrontmatter: content.includes('---'),
          operationMode: metadataAnalysis?.core?.operationMode,
          templateType: metadataAnalysis?.core?.templateType,
          complexity: metadataAnalysis?.complexity,
          security: metadataAnalysis?.security
        },
        content: args.content ? {
          raw: content,
          preview: content.length > 1000 ? content.substring(0, 1000) + '...' : content
        } : null,
        metrics: {
          durationMs: duration,
          analysisFeatures: {
            metadata: args.metadata,
            validation: args.validate,
            variables: args.variables,
            security: args.security,
            dependencies: args.dependencies,
            complexity: args.complexity
          }
        }
      });
      
      output(result, args.format);
      
    } catch (err) {
      const result = error(err.message, 'ENHANCED_TEMPLATE_SHOW_FAILED', {
        name: args.name,
        templatesDir: config?.directories?.templates,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });
      
      output(result, args.format);
      process.exit(1);
    } finally {
      if (workflowEngine) {
        try {
          await workflowEngine.shutdown();
        } catch (shutdownError) {
          // Ignore shutdown errors
        }
      }
    }
  }
});

/**
 * Basic template analysis (lightweight version)
 * @param {string} content - Template content
 * @param {string} type - Template type
 * @returns {object} Basic analysis
 */
async function analyzeBasicTemplate(content, type) {
  const analysis = {
    variables: [],
    blocks: [],
    includes: [],
    extends: null,
    macros: [],
    filters: [],
    frontmatter: null,
    complexity: 0
  };
  
  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (frontmatterMatch) {
    try {
      const yaml = await import('yaml');
      analysis.frontmatter = yaml.parse(frontmatterMatch[1]);
      
      // Add basic metadata
      if (analysis.frontmatter && typeof analysis.frontmatter === 'object') {
        analysis.frontmatter._metadata = {
          size: frontmatterMatch[1].length,
          lines: frontmatterMatch[1].split('\n').length,
          hasOperations: !!(analysis.frontmatter.inject || analysis.frontmatter.append || 
                           analysis.frontmatter.prepend || analysis.frontmatter.lineAt),
          hasConditions: !!(analysis.frontmatter.skipIf || analysis.frontmatter.when),
          hasShellCommands: !!(analysis.frontmatter.sh),
          outputPath: analysis.frontmatter.to || analysis.frontmatter.outputPath
        };
      }
    } catch (e) {
      analysis.frontmatter = { 
        error: 'Invalid YAML frontmatter',
        details: e.message 
      };
    }
  }
  
  // Basic pattern matching for template constructs
  const patterns = {
    variable: /\{\{\s*([^}]+)\s*\}\}/g,
    block: /\{\%\s*block\s+([^%]+)\s*\%\}/g,
    include: /\{\%\s*include\s+['"](([^'"]+))['"]/g,
    extends: /\{\%\s*extends\s+['"](([^'"]+))['"]/g,
    macro: /\{\%\s*macro\s+([^%]+)\s*\%\}/g,
    filter: /\|\s*(\w+)/g,
    conditional: /\{\%\s*if\s+/g,
    loop: /\{\%\s*for\s+/g
  };
  
  let match;
  
  // Extract variables
  while ((match = patterns.variable.exec(content)) !== null) {
    const variable = match[1].trim();
    const parts = variable.split('|')[0].trim();
    const varName = parts.split('.')[0].split('[')[0].trim();
    
    if (!analysis.variables.find(v => v.name === varName)) {
      analysis.variables.push({
        name: varName,
        expression: variable,
        line: content.substring(0, match.index).split('\n').length
      });
    }
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
  
  // Extract filters
  while ((match = patterns.filter.exec(content)) !== null) {
    const filter = match[1];
    if (!analysis.filters.includes(filter)) {
      analysis.filters.push(filter);
    }
  }
  
  // Calculate basic complexity
  const conditionals = (content.match(patterns.conditional) || []).length;
  const loops = (content.match(patterns.loop) || []).length;
  analysis.complexity = analysis.variables.length + 
                       (conditionals * 2) + 
                       (loops * 3) + 
                       analysis.includes.length;
  
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