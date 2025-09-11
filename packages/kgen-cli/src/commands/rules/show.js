/**
 * Rules Show Command
 * 
 * Show detailed information about specific N3.js rule pack.
 * Essential for understanding rule pack capabilities and requirements.
 */

import { defineCommand } from 'citty';
import { existsSync, statSync, readFileSync } from 'fs';
import { resolve, extname } from 'path';

import { success, error, output } from '../../lib/output.js';
import { loadKgenConfig, findFiles } from '../../lib/utils.js';

export default defineCommand({
  meta: {
    name: 'show',
    description: 'Show detailed information about specific rule pack'
  },
  args: {
    name: {
      type: 'string',
      description: 'Rule pack name to show',
      required: true,
      alias: 'n'
    },
    content: {
      type: 'boolean',
      description: 'Include rule pack content in output',
      default: false,
      alias: 'c'
    },
    rules: {
      type: 'boolean',
      description: 'Extract and show individual rules',
      default: true,
      alias: 'r'
    },
    validate: {
      type: 'boolean',
      description: 'Validate N3 syntax',
      default: true,
      alias: 'v'
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
        throw new Error(`Rules directory not found: ${rulesDir}`);
      }
      
      // Find matching rule files
      const patterns = ['**/*.n3', '**/*.rules'];
      const ruleFiles = findFiles(patterns, {
        cwd: rulesDir,
        absolute: true
      });
      
      // Find rule pack by name
      const matchingFiles = ruleFiles.filter(file => {
        const name = require('path').basename(file, extname(file));
        return name === args.name || file.includes(args.name);
      });
      
      if (matchingFiles.length === 0) {
        throw new Error(`Rule pack not found: ${args.name}`);
      }
      
      if (matchingFiles.length > 1) {
        throw new Error(`Multiple rule packs match '${args.name}': ${matchingFiles.map(f => require('path').basename(f)).join(', ')}`);
      }
      
      const rulePackPath = matchingFiles[0];
      const stats = statSync(rulePackPath);
      const content = readFileSync(rulePackPath, 'utf8');
      
      // Basic rule pack information
      const relativePath = require('path').relative(rulesDir, rulePackPath);
      const extension = extname(rulePackPath);
      
      // Detailed analysis
      const analysis = analyzeRulePackDetailed(content);
      
      // Validate syntax if requested
      let validation = null;
      if (args.validate) {
        validation = validateN3Syntax(content);
      }
      
      // Extract individual rules if requested
      let individualRules = null;
      if (args.rules) {
        individualRules = extractRules(content);
      }
      
      const duration = Date.now() - startTime;
      
      const result = success({
        rulePack: {
          name: args.name,
          path: relativePath,
          fullPath: rulePackPath,
          extension,
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
          type: analysis.type,
          rules: analysis.rules,
          prefixes: analysis.prefixes,
          imports: analysis.imports,
          variables: analysis.variables,
          predicates: analysis.predicates,
          complexity: analysis.complexity,
          reasoning: analysis.reasoning
        },
        rules: individualRules,
        validation,
        content: args.content ? {
          raw: content,
          preview: content.length > 2000 ? content.substring(0, 2000) + '...' : content
        } : null,
        metrics: {
          durationMs: duration
        }
      });
      
      output(result, args.format);
      
    } catch (err) {
      const result = error(err.message, 'RULE_PACK_SHOW_FAILED', {
        name: args.name,
        rulesDir: config?.directories?.rules,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });
      
      output(result, args.format);
      process.exit(1);
    }
  }
});

/**
 * Detailed N3 rule pack analysis
 * @param {string} content - Rule pack content
 * @returns {object} Detailed analysis
 */
function analyzeRulePackDetailed(content) {
  const analysis = {
    type: 'inference',
    rules: 0,
    prefixes: [],
    imports: [],
    variables: new Set(),
    predicates: new Set(),
    complexity: 0,
    reasoning: {
      forwardChaining: 0,
      backwardChaining: 0,
      builtin: 0
    }
  };
  
  // Extract prefixes with full details
  const prefixPattern = /@prefix\s+([^:]+):\s*<([^>]+)>\s*\./g;
  let match;
  while ((match = prefixPattern.exec(content)) !== null) {
    analysis.prefixes.push({
      prefix: match[1].trim(),
      namespace: match[2],
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  // Extract imports
  const importPattern = /@import\s*<([^>]+)>/g;
  while ((match = importPattern.exec(content)) !== null) {
    analysis.imports.push({
      uri: match[1],
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  // Count different types of rules
  const forwardRules = content.match(/=>/g) || [];
  const backwardRules = content.match(/<=/g) || [];
  const prologRules = content.match(/:-/g) || [];
  
  analysis.rules = forwardRules.length + backwardRules.length + prologRules.length;
  analysis.reasoning.forwardChaining = forwardRules.length;
  analysis.reasoning.backwardChaining = backwardRules.length + prologRules.length;
  
  // Find builtin functions
  const builtinPattern = /(log:|math:|string:|list:|time:)/g;
  const builtins = content.match(builtinPattern) || [];
  analysis.reasoning.builtin = builtins.length;
  
  // Extract variables (starting with ?)
  const variablePattern = /\?(\w+)/g;
  while ((match = variablePattern.exec(content)) !== null) {
    analysis.variables.add(match[1]);
  }
  
  // Extract predicates (rough heuristic)
  const predicatePattern = /([a-zA-Z][a-zA-Z0-9]*:[a-zA-Z][a-zA-Z0-9]*)/g;
  while ((match = predicatePattern.exec(content)) !== null) {
    if (!match[1].includes('http') && !match[1].includes('://')) {
      analysis.predicates.add(match[1]);
    }
  }
  
  // Determine rule pack type
  if (content.includes('gdpr:') || content.includes('sox:') || content.includes('hipaa:') ||
      content.includes('compliance') || content.includes('audit')) {
    analysis.type = 'compliance';
  } else if (content.includes('sh:') || content.includes('shacl:') || content.includes('validation')) {
    analysis.type = 'validation';
  } else if (content.includes('log:') || content.includes('math:') || content.includes('inference')) {
    analysis.type = 'inference';
  }
  
  // Calculate complexity score
  analysis.complexity = Math.round((
    analysis.rules * 2 +
    analysis.prefixes.length * 0.5 +
    analysis.variables.size * 0.3 +
    analysis.predicates.size * 0.2 +
    analysis.reasoning.builtin * 1.5
  ) * 10) / 10;
  
  // Convert sets to arrays for JSON serialization
  analysis.variables = Array.from(analysis.variables);
  analysis.predicates = Array.from(analysis.predicates);
  
  return analysis;
}

/**
 * Extract individual rules from N3 content
 * @param {string} content - N3 content
 * @returns {Array} Individual rules
 */
function extractRules(content) {
  const rules = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines, comments, and prefixes
    if (!line || line.startsWith('#') || line.startsWith('@')) {
      continue;
    }
    
    // Look for rule patterns
    if (line.includes('=>') || line.includes('<=') || line.includes(':-')) {
      let ruleText = line;
      let lineEnd = i;
      
      // Handle multi-line rules
      while (!ruleText.endsWith('.') && lineEnd < lines.length - 1) {
        lineEnd++;
        ruleText += ' ' + lines[lineEnd].trim();
      }
      
      rules.push({
        id: rules.length + 1,
        text: ruleText,
        startLine: i + 1,
        endLine: lineEnd + 1,
        type: line.includes('=>') ? 'forward' : 
              line.includes('<=') ? 'backward' : 
              'prolog'
      });
    }
  }
  
  return rules;
}

/**
 * Validate N3 syntax
 * @param {string} content - N3 content
 * @returns {object} Validation results
 */
function validateN3Syntax(content) {
  const validation = {
    valid: true,
    errors: [],
    warnings: []
  };
  
  // Check for required prefixes
  if (!content.includes('@prefix') && !content.includes('PREFIX')) {
    validation.warnings.push({
      type: 'missing_prefixes',
      message: 'No prefix declarations found'
    });
  }
  
  // Check for unmatched brackets/braces
  const openBraces = (content.match(/\{/g) || []).length;
  const closeBraces = (content.match(/\}/g) || []).length;
  
  if (openBraces !== closeBraces) {
    validation.valid = false;
    validation.errors.push({
      type: 'syntax_error',
      message: `Unmatched braces: ${openBraces} open, ${closeBraces} close`
    });
  }
  
  // Check for proper statement termination
  const lines = content.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('@');
  });
  
  const unterminated = lines.filter(line => 
    !line.trim().endsWith('.') && 
    !line.trim().endsWith('{') && 
    !line.trim().endsWith('}')
  );
  
  if (unterminated.length > 0 && unterminated.length < lines.length * 0.5) {
    validation.warnings.push({
      type: 'unterminated_statements',
      message: `${unterminated.length} statements may be missing termination`
    });
  }
  
  // Check for undefined prefixes
  const usedPrefixes = new Set();
  const definedPrefixes = new Set();
  
  // Find defined prefixes
  const prefixPattern = /@prefix\s+([^:]+):/g;
  let match;
  while ((match = prefixPattern.exec(content)) !== null) {
    definedPrefixes.add(match[1]);
  }
  
  // Find used prefixes
  const usagePattern = /([a-zA-Z][a-zA-Z0-9]*):(?![:/])/g;
  while ((match = usagePattern.exec(content)) !== null) {
    usedPrefixes.add(match[1]);
  }
  
  // Check for undefined prefixes
  for (const prefix of usedPrefixes) {
    if (!definedPrefixes.has(prefix) && prefix !== 'http' && prefix !== 'https') {
      validation.warnings.push({
        type: 'undefined_prefix',
        message: `Prefix '${prefix}' is used but not defined`
      });
    }
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