#!/usr/bin/env node

/**
 * KGEN CLI Enhanced - Knowledge Graph Engine for Deterministic Artifact Generation
 * 
 * Enhanced template discovery system supporting both UNJUCKS and KGEN formats
 * Migrates UNJUCKS generator patterns to KGEN's simplified template system
 */

import { defineCommand, runMain } from 'citty';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { KgenTemplateScanner } from '../src/lib/kgen-template-scanner.js';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Enhanced KGEN CLI Engine with Template Discovery
 */
class EnhancedKGenCLIEngine {
  constructor() {
    this.version = '1.0.0-enhanced';
    this.workingDir = process.cwd();
    this.config = null;
    this.templateScanner = null;
    this.debug = false;
    this.verbose = false;
  }

  /**
   * Initialize KGEN CLI with configuration
   */
  async initialize(options = {}) {
    try {
      this.debug = options.debug || false;
      this.verbose = options.verbose || false;
      
      if (this.debug) console.log('🔧 Initializing Enhanced KGEN CLI Engine...');
      
      // Load configuration
      this.config = await this.loadConfiguration();
      
      // Initialize template scanner with enhanced discovery
      this.templateScanner = new KgenTemplateScanner({
        baseDir: this.workingDir,
        templateSources: [
          // UNJUCKS compatibility
          { type: 'unjucks', path: this.config.directories?.templates || '_templates' },
          // KGEN packages
          { type: 'kgen', path: 'packages/kgen-templates/templates' },
          // Project templates
          { type: 'kgen', path: 'templates' },
          // Additional sources from config
          ...(this.config.templateSources || [])
        ],
        debug: this.debug
      });
      
      if (this.debug) console.log('✅ Enhanced KGEN CLI Engine initialized successfully');
      
      return { success: true, config: this.config };
    } catch (error) {
      const result = { success: false, error: error.message };
      if (this.debug) console.error('❌ Failed to initialize Enhanced KGEN CLI:', error);
      return result;
    }
  }
  
  /**
   * Load KGEN configuration with fallback defaults
   */
  async loadConfiguration() {
    try {
      // Try to load c12 config if available
      let config = {
        directories: {
          out: './generated',
          state: './.kgen/state',
          cache: './.kgen/cache',
          templates: '_templates',
          rules: './rules',
          knowledge: './knowledge'
        },
        templateSources: [],
        generate: {
          defaultTemplate: 'base',
          attestByDefault: true,
          enableContentAddressing: true
        },
        drift: {
          onDrift: 'fail',
          exitCode: 3,
          tolerance: 0.95
        },
        impact: {
          maxBlastRadius: 5,
          includeInverseRelationships: true
        }
      };
      
      // Try to load from kgen.config.js if it exists
      const configPath = path.join(this.workingDir, 'kgen.config.js');
      if (fs.existsSync(configPath)) {
        try {
          const { default: userConfig } = await import(configPath);
          config = { ...config, ...userConfig };
          if (this.debug) console.log('📋 Configuration loaded from kgen.config.js');
        } catch (error) {
          if (this.verbose) {
            console.warn('⚠️  Could not load kgen.config.js, using defaults:', error.message);
          }
        }
      } else {
        if (this.verbose) {
          console.warn('⚠️  Could not find kgen.config.js, using defaults');
        }
      }
      
      if (this.debug) {
        console.log('📋 Final configuration:', JSON.stringify(config, null, 2));
      }
      
      return config;
    } catch (error) {
      if (this.verbose) {
        console.warn('⚠️  Error loading configuration, using defaults:', error.message);
      }
      return {};
    }
  }

  /**
   * List all available templates with enhanced discovery
   */
  async listTemplates(options = {}) {
    try {
      if (!this.templateScanner) {
        await this.initialize({ debug: options.debug, verbose: options.verbose });
      }
      
      if (this.debug) console.log('🔍 Discovering templates from all sources...');
      
      const templates = await this.templateScanner.discoverAllTemplates();
      const stats = await this.templateScanner.getTemplateStats();
      
      const result = {
        success: true,
        operation: 'templates:ls:enhanced',
        templates: templates,
        count: templates.length,
        stats: stats,
        timestamp: this.getDeterministicDate().toISOString()
      };
      
      if (options.verbose) {
        // Add detailed template information
        result.templateDetails = templates.map(template => ({
          id: template.id,
          name: template.name,
          displayName: template.displayName,
          format: template.format,
          category: template.category,
          source: template.source,
          variables: template.variables.map(v => v.name),
          files: template.files,
          size: template.size,
          tags: template.tags
        }));
      }
      
      return result;
      
    } catch (error) {
      const result = {
        success: false,
        operation: 'templates:ls:enhanced',
        error: error.message,
        timestamp: this.getDeterministicDate().toISOString()
      };
      if (this.debug) console.error('❌ Failed to list templates:', error);
      return result;
    }
  }

  /**
   * Show detailed information about a specific template
   */
  async showTemplate(templateId, options = {}) {
    try {
      if (!this.templateScanner) {
        await this.initialize({ debug: options.debug, verbose: options.verbose });
      }
      
      if (this.debug) console.log(`🔍 Looking for template: ${templateId}`);
      
      const template = await this.templateScanner.getTemplateById(templateId);
      
      if (!template) {
        return {
          success: false,
          operation: 'templates:show:enhanced',
          templateId: templateId,
          error: `Template not found: ${templateId}`,
          timestamp: this.getDeterministicDate().toISOString()
        };
      }
      
      // Read template content for detailed analysis
      let templateContent = '';
      let templateStructure = {};
      
      try {
        if (template.files && template.files.length > 0) {
          const mainTemplateFile = path.join(template.path, template.files[0]);
          if (fs.existsSync(mainTemplateFile)) {
            templateContent = fs.readFileSync(mainTemplateFile, 'utf8');
            templateStructure = this.analyzeTemplateStructure(templateContent);
          } else if (fs.existsSync(template.path)) {
            // For KGEN templates, the path IS the template file
            templateContent = fs.readFileSync(template.path, 'utf8');
            templateStructure = this.analyzeTemplateStructure(templateContent);
          }
        }
      } catch (error) {
        if (this.debug) console.error('Error reading template content:', error);
      }
      
      const result = {
        success: true,
        operation: 'templates:show:enhanced',
        templateId: templateId,
        template: {
          ...template,
          structure: templateStructure,
          contentPreview: templateContent.slice(0, 500) + (templateContent.length > 500 ? '...' : '')
        },
        timestamp: this.getDeterministicDate().toISOString()
      };
      
      return result;
      
    } catch (error) {
      const result = {
        success: false,
        operation: 'templates:show:enhanced',
        templateId: templateId,
        error: error.message,
        timestamp: this.getDeterministicDate().toISOString()
      };
      if (this.debug) console.error(`❌ Failed to show template ${templateId}:`, error);
      return result;
    }
  }

  /**
   * Search templates by query
   */
  async searchTemplates(query, options = {}) {
    try {
      if (!this.templateScanner) {
        await this.initialize({ debug: options.debug, verbose: options.verbose });
      }
      
      if (this.debug) console.log(`🔍 Searching templates for: ${query}`);
      
      const matchingTemplates = await this.templateScanner.searchTemplates(query);
      
      const result = {
        success: true,
        operation: 'templates:search:enhanced',
        query: query,
        templates: matchingTemplates,
        count: matchingTemplates.length,
        timestamp: this.getDeterministicDate().toISOString()
      };
      
      return result;
      
    } catch (error) {
      const result = {
        success: false,
        operation: 'templates:search:enhanced',
        query: query,
        error: error.message,
        timestamp: this.getDeterministicDate().toISOString()
      };
      if (this.debug) console.error(`❌ Failed to search templates:`, error);
      return result;
    }
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(category, options = {}) {
    try {
      if (!this.templateScanner) {
        await this.initialize({ debug: options.debug, verbose: options.verbose });
      }
      
      const templates = await this.templateScanner.getTemplatesByCategory(category);
      
      const result = {
        success: true,
        operation: 'templates:category:enhanced',
        category: category,
        templates: templates,
        count: templates.length,
        timestamp: this.getDeterministicDate().toISOString()
      };
      
      return result;
      
    } catch (error) {
      const result = {
        success: false,
        operation: 'templates:category:enhanced',
        category: category,
        error: error.message,
        timestamp: this.getDeterministicDate().toISOString()
      };
      if (this.debug) console.error(`❌ Failed to get templates by category:`, error);
      return result;
    }
  }

  /**
   * Analyze template structure (from original KGEN implementation)
   */
  analyzeTemplateStructure(content) {
    const blocks = [];
    const includes = [];
    const macros = [];
    
    // Find blocks
    const blockMatches = content.matchAll(/\{\%\s*block\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\%\}/g);
    for (const match of blockMatches) {
      blocks.push(match[1]);
    }
    
    // Find includes
    const includeMatches = content.matchAll(/\{\%\s*include\s+['"']([^'"]+)['"']\s*\%\}/g);
    for (const match of includeMatches) {
      includes.push(match[1]);
    }
    
    // Find macros
    const macroMatches = content.matchAll(/\{\%\s*macro\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
    for (const match of macroMatches) {
      macros.push(match[1]);
    }
    
    return {
      blocks: blocks,
      includes: includes,
      macros: macros,
      complexity: blocks.length + includes.length + macros.length,
      lines: content.split('\n').length,
      hasConditionals: /\{\%\s*if\s+/.test(content),
      hasLoops: /\{\%\s*for\s+/.test(content),
      hasFrontmatter: content.startsWith('---')
    };
  }

  // Keep other methods from original KGEN CLI for compatibility
  async graphHash(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `File not found: ${filePath}` };
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      
      const result = {
        success: true,
        file: filePath,
        hash: hash,
        size: content.length,
        timestamp: this.getDeterministicDate().toISOString()
      };

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Initialize Enhanced KGEN CLI Engine
const enhancedKgen = new EnhancedKGenCLIEngine();

// Enhanced Templates System Commands
const enhancedTemplatesCommand = defineCommand({
  meta: {
    name: 'templates',
    description: 'Enhanced template discovery and management (supports UNJUCKS + KGEN)'
  },
  subCommands: {
    ls: defineCommand({
      meta: {
        name: 'ls',
        description: 'List all available templates from all sources'
      },
      args: {
        verbose: {
          type: 'boolean',
          description: 'Show detailed template information',
          alias: 'v'
        },
        category: {
          type: 'string',
          description: 'Filter by category',
          alias: 'c'
        },
        format: {
          type: 'string',
          description: 'Filter by format (unjucks, kgen)',
          alias: 'f'
        }
      },
      async run({ args }) {
        try {
          let result;
          
          if (args.category) {
            result = await enhancedKgen.getTemplatesByCategory(args.category, args);
          } else {
            result = await enhancedKgen.listTemplates(args);
          }
          
          // Filter by format if specified
          if (args.format && result.success) {
            result.templates = result.templates.filter(t => t.format === args.format);
            result.count = result.templates.length;
          }
          
          console.log(JSON.stringify(result, null, 2));
          return result;
          
        } catch (error) {
          const result = {
            success: false,
            operation: 'templates:ls:enhanced',
            error: error.message,
            timestamp: this.getDeterministicDate().toISOString()
          };
          console.log(JSON.stringify(result, null, 2));
          return result;
        }
      }
    }),
    show: defineCommand({
      meta: {
        name: 'show',
        description: 'Show detailed template information'
      },
      args: {
        template: {
          type: 'positional',
          description: 'Template ID or name to show',
          required: true
        }
      },
      async run({ args }) {
        try {
          const result = await enhancedKgen.showTemplate(args.template, args);
          console.log(JSON.stringify(result, null, 2));
          return result;
          
        } catch (error) {
          const result = {
            success: false,
            operation: 'templates:show:enhanced',
            template: args.template,
            error: error.message,
            timestamp: this.getDeterministicDate().toISOString()
          };
          console.log(JSON.stringify(result, null, 2));
          return result;
        }
      }
    }),
    search: defineCommand({
      meta: {
        name: 'search',
        description: 'Search templates by name, description, or tags'
      },
      args: {
        query: {
          type: 'positional',
          description: 'Search query',
          required: true
        }
      },
      async run({ args }) {
        try {
          const result = await enhancedKgen.searchTemplates(args.query, args);
          console.log(JSON.stringify(result, null, 2));
          return result;
          
        } catch (error) {
          const result = {
            success: false,
            operation: 'templates:search:enhanced',
            query: args.query,
            error: error.message,
            timestamp: this.getDeterministicDate().toISOString()
          };
          console.log(JSON.stringify(result, null, 2));
          return result;
        }
      }
    }),
    stats: defineCommand({
      meta: {
        name: 'stats',
        description: 'Show template statistics and source information'
      },
      async run({ args }) {
        try {
          const result = await enhancedKgen.listTemplates(args);
          if (result.success) {
            console.log(JSON.stringify({
              success: true,
              operation: 'templates:stats:enhanced',
              stats: result.stats,
              timestamp: this.getDeterministicDate().toISOString()
            }, null, 2));
          }
          return result;
          
        } catch (error) {
          const result = {
            success: false,
            operation: 'templates:stats:enhanced',
            error: error.message,
            timestamp: this.getDeterministicDate().toISOString()
          };
          console.log(JSON.stringify(result, null, 2));
          return result;
        }
      }
    })
  }
});

// Graph System Commands (simplified version)
const graphCommand = defineCommand({
  meta: {
    name: 'graph',
    description: 'Graph operations for knowledge graph processing'
  },
  subCommands: {
    hash: defineCommand({
      meta: {
        name: 'hash',
        description: 'Generate canonical SHA256 hash of RDF graph'
      },
      args: {
        file: {
          type: 'positional',
          description: 'Path to RDF/Turtle file',
          required: true
        }
      },
      async run({ args }) {
        const result = await enhancedKgen.graphHash(args.file);
        console.log(JSON.stringify(result, null, 2));
        return result;
      }
    })
  }
});

// Main Enhanced KGEN CLI
const main = defineCommand({
  meta: {
    name: 'kgen-enhanced',
    description: 'Enhanced KGEN - Knowledge Graph Engine with Advanced Template Discovery',
    version: '1.0.0-enhanced'
  },
  args: {
    debug: {
      type: 'boolean',
      description: 'Enable debug mode',
      alias: 'd'
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose output',
      alias: 'v'
    }
  },
  subCommands: {
    templates: enhancedTemplatesCommand,
    graph: graphCommand
  }
});

// Run the Enhanced CLI
runMain(main);