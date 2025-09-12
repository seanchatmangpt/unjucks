/**
 * Agent 2: CLI Structure Auditor  
 * Audits the current CLI implementation and maps available commands
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { glob } from 'glob';

export class CLIStructureAuditor {
  constructor() {
    this.discovered = {
      commands: [],
      bridges: [],
      adapters: [],
      implementations: []
    };
    this.report = {
      agent: 'CLI Structure Auditor',
      timestamp: this.getDeterministicDate().toISOString(),
      structure: {},
      commands: {},
      analysis: {}
    };
  }

  async execute() {
    console.log('🔍 Agent 2: Auditing CLI structure...');
    
    try {
      // Scan CLI directory structure
      await this.scanCLIStructure();
      
      // Analyze command implementations  
      await this.analyzeCommandImplementations();
      
      // Check bridge implementations
      await this.analyzeBridgeImplementations();
      
      // Validate CLI entry points
      await this.validateEntryPoints();
      
      // Generate structure analysis
      this.generateStructureAnalysis();
      
      console.log(`✅ Discovered ${this.discovered.commands.length} CLI commands`);
      
      return this.report;
    } catch (error) {
      console.error('❌ CLI audit failed:', error);
      throw error;
    }
  }

  async scanCLIStructure() {
    const basePath = '/Users/sac/unjucks/src/kgen';
    
    // Find all CLI-related files
    const cliFiles = await glob(`${basePath}/**/cli/**/*.js`, { absolute: true });
    const commandFiles = await glob(`${basePath}/**/commands/**/*.js`, { absolute: true });
    
    this.report.structure = {
      cliFiles: cliFiles.length,
      commandFiles: commandFiles.length,
      directories: this.getDirectoryStructure(basePath)
    };
    
    // Process each CLI file
    for (const file of [...cliFiles, ...commandFiles]) {
      await this.analyzeFile(file);
    }
  }

  getDirectoryStructure(basePath) {
    const structure = {};
    
    try {
      const items = readdirSync(basePath);
      for (const item of items) {
        const fullPath = join(basePath, item);
        if (statSync(fullPath).isDirectory()) {
          if (item === 'cli') {
            structure[item] = this.scanDirectory(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`Could not scan ${basePath}:`, error.message);
    }
    
    return structure;
  }

  scanDirectory(dirPath) {
    const structure = { files: [], subdirs: {} };
    
    try {
      const items = readdirSync(dirPath);
      for (const item of items) {
        const fullPath = join(dirPath, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          structure.subdirs[item] = this.scanDirectory(fullPath);
        } else if (item.endsWith('.js')) {
          structure.files.push({
            name: item,
            size: stat.size,
            modified: stat.mtime.toISOString()
          });
        }
      }
    } catch (error) {
      console.warn(`Could not scan directory ${dirPath}:`, error.message);
    }
    
    return structure;
  }

  async analyzeFile(filePath) {
    try {
      const content = readFileSync(filePath, 'utf8');
      const fileName = filePath.split('/').pop();
      
      // Detect file type and purpose
      const analysis = {
        path: filePath,
        fileName,
        type: this.detectFileType(content, fileName),
        commands: this.extractCommands(content),
        methods: this.extractMethods(content),
        exports: this.extractExports(content),
        size: content.length,
        complexity: this.calculateComplexity(content)
      };
      
      if (analysis.type === 'command') {
        this.discovered.commands.push(analysis);
      } else if (analysis.type === 'bridge') {
        this.discovered.bridges.push(analysis);
      } else if (analysis.type === 'adapter') {
        this.discovered.adapters.push(analysis);
      }
      
      this.discovered.implementations.push(analysis);
      
    } catch (error) {
      console.warn(`Could not analyze ${filePath}:`, error.message);
    }
  }

  detectFileType(content, fileName) {
    if (fileName.includes('cli-bridge')) return 'bridge';
    if (fileName.includes('adapter')) return 'adapter';
    if (fileName.includes('command') || content.includes('Command')) return 'command';
    if (content.includes('citty') || content.includes('defineCommand')) return 'cli-definition';
    return 'implementation';
  }

  extractCommands(content) {
    const commands = [];
    
    // Look for kgen command patterns
    const kgenMatches = content.match(/kgen\s+\w+\s+\w+/g);
    if (kgenMatches) {
      commands.push(...kgenMatches.map(cmd => cmd.trim()));
    }
    
    // Look for command definitions
    const commandDefs = content.match(/\w+Command\s*=|async\s+(\w+)Command/g);
    if (commandDefs) {
      commands.push(...commandDefs.map(def => def.replace(/Command.*/, '').trim()));
    }
    
    // Look for CLI method names
    const methodMatches = content.match(/(graph|artifact|project|templates|rules|cache|metrics)\w*/gi);
    if (methodMatches) {
      commands.push(...methodMatches);
    }
    
    return [...new Set(commands)]; // Remove duplicates
  }

  extractMethods(content) {
    const methods = [];
    
    // Extract async methods
    const asyncMethods = content.match(/async\s+(\w+)\s*\(/g);
    if (asyncMethods) {
      methods.push(...asyncMethods.map(m => m.replace(/async\s+/, '').replace(/\s*\(/, '')));
    }
    
    // Extract regular methods
    const regularMethods = content.match(/^\s*(\w+)\s*\(/gm);
    if (regularMethods) {
      methods.push(...regularMethods.map(m => m.trim().replace(/\s*\(/, '')));
    }
    
    return [...new Set(methods)].filter(m => m.length > 2); // Filter noise
  }

  extractExports(content) {
    const exports = [];
    
    // Named exports
    const namedExports = content.match(/export\s+(?:const|class|function)\s+(\w+)/g);
    if (namedExports) {
      exports.push(...namedExports.map(exp => exp.replace(/export\s+(?:const|class|function)\s+/, '')));
    }
    
    // Default exports
    if (content.includes('export default')) {
      exports.push('default');
    }
    
    return exports;
  }

  calculateComplexity(content) {
    // Simple complexity metrics
    const lines = content.split('\n').length;
    const functions = (content.match(/function|async|=>/g) || []).length;
    const conditionals = (content.match(/if|switch|case|\?/g) || []).length;
    const loops = (content.match(/for|while|forEach|map|filter/g) || []).length;
    
    return {
      lines,
      functions,
      conditionals,
      loops,
      score: Math.round((functions + conditionals * 2 + loops * 1.5) / lines * 100)
    };
  }

  async analyzeCommandImplementations() {
    const implementations = new Map();
    
    for (const cmd of this.discovered.commands) {
      // Check if command has actual implementation
      const hasImplementation = cmd.methods.some(method => 
        method.includes('run') || method.includes('execute') || method.includes('handler')
      );
      
      implementations.set(cmd.fileName, {
        hasImplementation,
        methods: cmd.methods,
        commands: cmd.commands,
        complexity: cmd.complexity
      });
    }
    
    this.report.commands = {
      total: this.discovered.commands.length,
      implemented: Array.from(implementations.values()).filter(impl => impl.hasImplementation).length,
      implementations: Object.fromEntries(implementations)
    };
  }

  async analyzeBridgeImplementations() {
    this.report.bridges = this.discovered.bridges.map(bridge => ({
      fileName: bridge.fileName,
      methods: bridge.methods.length,
      commands: bridge.commands,
      size: bridge.size,
      complexity: bridge.complexity.score
    }));
  }

  async validateEntryPoints() {
    // Check for package.json bin entries
    const packagePaths = [
      '/Users/sac/unjucks/package.json',
      '/Users/sac/unjucks/packages/kgen-cli/package.json'
    ];
    
    const entryPoints = [];
    
    for (const pkgPath of packagePaths) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (pkg.bin) {
          entryPoints.push({
            package: pkgPath,
            bin: pkg.bin,
            name: pkg.name
          });
        }
      } catch (error) {
        console.warn(`Could not read ${pkgPath}:`, error.message);
      }
    }
    
    this.report.entryPoints = entryPoints;
  }

  generateStructureAnalysis() {
    this.report.analysis = {
      totalFiles: this.discovered.implementations.length,
      commandFiles: this.discovered.commands.length,
      bridgeFiles: this.discovered.bridges.length,
      adapterFiles: this.discovered.adapters.length,
      
      coverage: {
        hasCommands: this.discovered.commands.length > 0,
        hasBridges: this.discovered.bridges.length > 0,
        hasAdapters: this.discovered.adapters.length > 0,
        hasEntryPoints: this.report.entryPoints.length > 0
      },
      
      codeMetrics: {
        totalLines: this.discovered.implementations.reduce((sum, impl) => sum + impl.complexity.lines, 0),
        averageComplexity: Math.round(
          this.discovered.implementations.reduce((sum, impl) => sum + impl.complexity.score, 0) / 
          this.discovered.implementations.length
        ),
        largestFile: Math.max(...this.discovered.implementations.map(impl => impl.size))
      }
    };
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const auditor = new CLIStructureAuditor();
  auditor.execute()
    .then(report => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export default CLIStructureAuditor;