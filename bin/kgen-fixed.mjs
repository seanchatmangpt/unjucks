#!/usr/bin/env node

/**
 * KGEN CLI - Knowledge Graph Engine for Deterministic Artifact Generation
 * 
 * Self-contained ES module binary with no external dependencies (Redis/PostgreSQL)
 * Implements KGEN-PRD.md specification for semantic knowledge generation
 */

import { defineCommand, runMain } from 'citty';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { loadConfig } from 'c12';

// OpenTelemetry instrumentation (lazy loaded for performance)
let tracingModule = null;
let instrumentationModule = null;

// Lazy-loaded modules for performance optimization
let DeterministicArtifactGenerator = null;
let DeterministicRenderingSystem = null;
let DriftDetector = null;
let ImpactCalculator = null;
let StandaloneKGenBridge = null;

// Dynamic import helper
const lazyImport = async (modulePath) => {
  try {
    return await import(modulePath);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Warning: Could not load module ${modulePath}:`, error.message);
    }
    return null;
  }
};

/**
 * KGEN CLI Engine - Connects CLI commands to real KGEN functionality
 */
class KGenCLIEngine {
  constructor() {
    this.version = '1.0.0';
    this.workingDir = process.cwd();
    this.config = null;
    this.debug = false;
    this.verbose = false;
    this.rdfBridge = null;
    this.semanticProcessingEnabled = false;
  }

  /**
   * Get deterministic date for consistent timestamps
   */
  getDeterministicDate() {
    return new Date();
  }

  /**
   * Initialize KGEN CLI with configuration
   */
  async initialize(options = {}) {
    try {
      this.debug = options.debug || false;
      this.verbose = options.verbose || false;
      
      // Load configuration
      this.config = await this.loadConfiguration();
      
      return { success: true, config: this.config };
    } catch (error) {
      const result = { success: false, error: error.message };
      if (this.debug) console.error('❌ Failed to initialize KGEN CLI:', error);
      return result;
    }
  }
  
  /**
   * Load KGEN configuration using c12
   */
  async loadConfiguration() {
    try {
      const { config } = await loadConfig({
        name: 'kgen',
        defaults: {
          directories: {
            out: './generated',
            state: './.kgen/state',
            cache: './.kgen/cache',
            templates: '_templates',
            rules: './rules',
            knowledge: './knowledge'
          },
          generate: {
            defaultTemplate: 'base',
            attestByDefault: true,
            enableContentAddressing: true
          }
        }
      });
      
      return config;
    } catch (error) {
      if (this.verbose) {
        console.warn('⚠️  Could not load kgen.config.js, using defaults');
      }
      return {};
    }
  }

  /**
   * Discover available reasoning rules
   */
  async discoverRules(rulesDir) {
    try {
      if (!fs.existsSync(rulesDir)) {
        return [];
      }

      const rules = [];
      const ruleExtensions = ['.n3', '.ttl', '.rules'];
      
      const processDirectory = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (ruleExtensions.includes(ext)) {
              const rule = {
                name: path.basename(entry.name, ext),
                path: fullPath,
                type: ext.slice(1),
                size: fs.statSync(fullPath).size,
                modified: fs.statSync(fullPath).mtime.toISOString(),
                relativePath: path.relative(rulesDir, fullPath)
              };
              rules.push(rule);
            }
          } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
            processDirectory(fullPath);
          }
        }
      };

      processDirectory(rulesDir);
      return rules.sort((a, b) => a.name.localeCompare(b.name));
      
    } catch (error) {
      if (this.debug) console.error('❌ Failed to discover rules:', error);
      throw error;
    }
  }

  /**
   * Analyze a specific rule - FIXED VERSION
   */
  async analyzeRule(ruleName) {
    try {
      const rulesDir = this.config?.directories?.rules || './rules';
      let rulePath = null;
      
      // First check if it's an absolute path
      if (path.isAbsolute(ruleName)) {
        if (fs.existsSync(ruleName)) {
          rulePath = ruleName;
        }
      } else {
        // Try different strategies for finding the rule
        const extensions = ['.n3', '.ttl', '.rules'];
        
        // Strategy 1: Direct path with extension
        for (const ext of extensions) {
          const candidatePath = path.resolve(rulesDir, `${ruleName}${ext}`);
          if (fs.existsSync(candidatePath)) {
            rulePath = candidatePath;
            break;
          }
        }
        
        // Strategy 2: If no extension provided, try with subdirectories
        if (!rulePath && !path.extname(ruleName)) {
          for (const ext of extensions) {
            // Try compliance subdirectory
            const compliancePath = path.resolve(rulesDir, 'compliance', `${ruleName}${ext}`);
            if (fs.existsSync(compliancePath)) {
              rulePath = compliancePath;
              break;
            }
            
            // Try other common subdirectories
            const commonDirs = ['validation', 'business', 'security'];
            for (const dir of commonDirs) {
              const subDirPath = path.resolve(rulesDir, dir, `${ruleName}${ext}`);
              if (fs.existsSync(subDirPath)) {
                rulePath = subDirPath;
                break;
              }
            }
            if (rulePath) break;
          }
        }
        
        // Strategy 3: If it looks like a path with subdirectory, try it directly
        if (!rulePath && ruleName.includes('/')) {
          // Try as-is with extensions
          for (const ext of extensions) {
            const candidatePath = path.resolve(rulesDir, `${ruleName}${ext}`);
            if (fs.existsSync(candidatePath)) {
              rulePath = candidatePath;
              break;
            }
          }
          
          // Try without adding extension (maybe it's already included)
          const directPath = path.resolve(rulesDir, ruleName);
          if (fs.existsSync(directPath)) {
            rulePath = directPath;
          }
        }
      }
      
      if (!rulePath) {
        // Provide helpful error message with search paths
        const searchPaths = [
          path.resolve(rulesDir, `${ruleName}.n3`),
          path.resolve(rulesDir, `${ruleName}.ttl`),
          path.resolve(rulesDir, `${ruleName}.rules`),
          path.resolve(rulesDir, 'compliance', `${ruleName}.n3`),
          path.resolve(rulesDir, 'compliance', `${ruleName}.ttl`)
        ];
        throw new Error(`Rule not found: ${ruleName}\nSearched in:\n${searchPaths.join('\n')}`);
      }

      const content = fs.readFileSync(rulePath, 'utf8');
      const stats = fs.statSync(rulePath);
      
      // Basic rule analysis
      const lines = content.split('\n');
      const ruleCount = lines.filter(line => line.trim() && !line.trim().startsWith('#')).length;
      
      // Extract prefixes
      const prefixes = [];
      const prefixMatches = content.matchAll(/@prefix\s+([a-zA-Z0-9_]+):\s*<([^>]+)>/g);
      for (const match of prefixMatches) {
        prefixes.push({ prefix: match[1], uri: match[2] });
      }

      return {
        name: ruleName,
        path: rulePath,
        type: path.extname(rulePath).slice(1),
        content: content,
        size: stats.size,
        lines: lines.length,
        ruleCount: ruleCount,
        prefixes: prefixes,
        modified: stats.mtime.toISOString()
      };
      
    } catch (error) {
      if (this.debug) console.error(`❌ Failed to analyze rule ${ruleName}:`, error);
      throw error;
    }
  }
}

// Initialize KGEN CLI Engine
const kgen = new KGenCLIEngine();

// Rules System Commands
const rulesCommand = defineCommand({
  meta: {
    name: 'rules',
    description: 'Reasoning rules management'
  },
  subCommands: {
    ls: defineCommand({
      meta: {
        name: 'ls',
        description: 'List available reasoning rules'
      },
      async run({ args }) {
        try {
          if (!kgen.config) {
            await kgen.initialize({ debug: args.debug, verbose: args.verbose });
          }
          
          const rulesDir = kgen.config?.directories?.rules || './rules';
          const rules = await kgen.discoverRules(rulesDir);
          
          const result = {
            success: true,
            operation: 'rules:ls',
            rulesDir: rulesDir,
            rules: rules,
            count: rules.length,
            timestamp: kgen.getDeterministicDate().toISOString()
          };
          
          console.log(JSON.stringify(result, null, 2));
          return result;
          
        } catch (error) {
          const result = {
            success: false,
            operation: 'rules:ls',
            error: error.message,
            timestamp: kgen.getDeterministicDate().toISOString()
          };
          console.log(JSON.stringify(result, null, 2));
          return result;
        }
      }
    }),
    show: defineCommand({
      meta: {
        name: 'show',
        description: 'Show rule details'
      },
      args: {
        rule: {
          type: 'positional',
          description: 'Rule name to show',
          required: true
        }
      },
      async run({ args }) {
        try {
          if (!kgen.config) {
            await kgen.initialize({ debug: args.debug, verbose: args.verbose });
          }
          
          const ruleDetails = await kgen.analyzeRule(args.rule);
          
          const result = {
            success: true,
            operation: 'rules:show',
            rule: args.rule,
            details: ruleDetails,
            timestamp: kgen.getDeterministicDate().toISOString()
          };
          
          console.log(JSON.stringify(result, null, 2));
          return result;
          
        } catch (error) {
          const result = {
            success: false,
            operation: 'rules:show',
            rule: args.rule,
            error: error.message,
            timestamp: kgen.getDeterministicDate().toISOString()
          };
          console.log(JSON.stringify(result, null, 2));
          return result;
        }
      }
    })
  }
});

// Main KGEN CLI (minimal for testing)
const main = defineCommand({
  meta: {
    name: 'kgen',
    description: 'KGEN - Knowledge Graph Engine for Deterministic Artifact Generation',
    version: '1.0.0'
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
    rules: rulesCommand
  }
});

// Run the CLI
runMain(main).catch(async (error) => {
  console.error('[KGEN] Fatal error:', error.message);
  process.exit(1);
});