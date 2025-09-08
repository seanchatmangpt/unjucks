#!/usr/bin/env node

const { performance } = require('perf_hooks');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

// Import benchmark classes
const MemoryBenchmark = require('./memory-benchmark');
const ConcurrencyStressTest = require('./concurrency-stress-test');
const TemplateRenderingBenchmark = require('./template-rendering-benchmark');
const CLIResponseBenchmark = require('./cli-response-benchmark');

class EnvironmentComparison {
  constructor() {
    this.cleanRoomResults = {};
    this.developmentResults = {};
    this.comparisonResults = {};
  }

  async getSystemInfo() {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cpuCount: os.cpus().length,
      cpuModel: os.cpus()[0].model,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024), // GB
      freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024), // GB
      loadAverage: os.loadavg(),
      uptime: os.uptime()
    };
  }

  async runCleanRoomBenchmarks() {
    console.log('🧪 Running Clean Room Benchmarks...');
    console.log('===================================\n');
    
    const systemInfo = await this.getSystemInfo();
    console.log('System Info:', JSON.stringify(systemInfo, null, 2));
    
    const startTime = performance.now();
    
    try {
      // Memory benchmarks
      const memoryBench = new MemoryBenchmark();
      const memoryResults = await memoryBench.runAllBenchmarks();
      
      // Concurrency tests
      const concurrencyBench = new ConcurrencyStressTest();
      const concurrencyResults = await concurrencyBench.runAllTests();
      
      // Template rendering
      const templateBench = new TemplateRenderingBenchmark();
      const templateResults = await templateBench.runAllBenchmarks();
      
      // CLI response times
      const cliBench = new CLIResponseBenchmark();
      const cliResults = await cliBench.runAllBenchmarks();
      
      const endTime = performance.now();
      
      this.cleanRoomResults = {
        systemInfo,
        totalDuration: endTime - startTime,
        memory: memoryResults,
        concurrency: concurrencyResults,
        templates: templateResults,
        cli: cliResults,
        timestamp: new Date().toISOString()
      };
      
      console.log(`\n✅ Clean room benchmarks completed in ${Math.round(endTime - startTime)}ms`);
      
    } catch (error) {
      console.error('❌ Clean room benchmarks failed:', error);
      this.cleanRoomResults = { error: error.message };
    }
  }

  async runDevelopmentBenchmarks() {
    console.log('\n🏗️  Running Development Environment Benchmarks...');
    console.log('==================================================\n');
    
    const systemInfo = await this.getSystemInfo();
    const startTime = performance.now();
    
    try {
      // Check for development environment indicators
      const devIndicators = await this.checkDevelopmentEnvironment();
      
      // Run same benchmarks but in development context
      const results = await this.runBenchmarksWithDevContext();
      
      const endTime = performance.now();
      
      this.developmentResults = {
        systemInfo,
        devIndicators,
        totalDuration: endTime - startTime,
        ...results,
        timestamp: new Date().toISOString()
      };
      
      console.log(`\n✅ Development benchmarks completed in ${Math.round(endTime - startTime)}ms`);
      
    } catch (error) {
      console.error('❌ Development benchmarks failed:', error);
      this.developmentResults = { error: error.message };
    }
  }

  async checkDevelopmentEnvironment() {
    const indicators = {
      nodeModules: false,
      gitRepo: false,
      packageJson: false,
      srcDirectory: false,
      testDirectory: false,
      configFiles: false
    };
    
    try {
      // Check for node_modules
      await fs.access('node_modules');
      indicators.nodeModules = true;
    } catch {}
    
    try {
      // Check for .git
      await fs.access('.git');
      indicators.gitRepo = true;
    } catch {}
    
    try {
      // Check for package.json
      await fs.access('package.json');
      indicators.packageJson = true;
    } catch {}
    
    try {
      // Check for src directory
      await fs.access('src');
      indicators.srcDirectory = true;
    } catch {}
    
    try {
      // Check for test directory
      await fs.access('tests');
      indicators.testDirectory = true;
    } catch {}
    
    // Check for common config files
    const configFiles = ['tsconfig.json', 'jest.config.js', 'vitest.config.js', '.eslintrc'];
    for (const file of configFiles) {
      try {
        await fs.access(file);
        indicators.configFiles = true;
        break;
      } catch {}
    }
    
    return indicators;
  }

  async runBenchmarksWithDevContext() {
    const results = {};
    
    // Memory benchmark with development files
    results.memoryWithDevFiles = await this.measureMemoryWithDevFiles();
    
    // File operations with real project files
    results.realFileOperations = await this.measureRealFileOperations();
    
    // Template rendering with actual templates
    results.actualTemplateRendering = await this.measureActualTemplateRendering();
    
    // CLI with real commands
    results.realCLICommands = await this.measureRealCLICommands();
    
    return results;
  }

  async measureMemoryWithDevFiles() {
    console.log('📊 Measuring memory usage with development files...');
    
    const startMemory = process.memoryUsage();
    const startTime = performance.now();
    
    try {
      // Load actual project files
      const srcFiles = await this.loadProjectFiles('src');
      const testFiles = await this.loadProjectFiles('tests');
      const configFiles = await this.loadConfigFiles();
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      return {
        duration: endTime - startTime,
        memoryDelta: endMemory.rss - startMemory.rss,
        filesLoaded: srcFiles.length + testFiles.length + configFiles.length,
        totalSize: srcFiles.reduce((sum, f) => sum + f.length, 0) +
                   testFiles.reduce((sum, f) => sum + f.length, 0) +
                   configFiles.reduce((sum, f) => sum + f.length, 0)
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async loadProjectFiles(directory) {
    try {
      const files = [];
      const entries = await fs.readdir(directory, { recursive: true });
      
      for (const entry of entries.slice(0, 50)) { // Limit to prevent overwhelming
        try {
          const filePath = path.join(directory, entry);
          const stat = await fs.stat(filePath);
          
          if (stat.isFile() && stat.size < 1024 * 1024) { // Skip large files
            const content = await fs.readFile(filePath, 'utf8');
            files.push(content);
          }
        } catch {}
      }
      
      return files;
    } catch {
      return [];
    }
  }

  async loadConfigFiles() {
    const configFiles = ['package.json', 'tsconfig.json', '.gitignore'];
    const files = [];
    
    for (const file of configFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        files.push(content);
      } catch {}
    }
    
    return files;
  }

  async measureRealFileOperations() {
    console.log('📁 Measuring real file operations...');
    
    const startTime = performance.now();
    
    try {
      // Test actual file operations on project
      const operations = [];
      
      // Read operations
      operations.push(this.readProjectFiles());
      
      // Write operations (safe temporary files)
      operations.push(this.writeTemporaryFiles());
      
      const results = await Promise.all(operations);
      const endTime = performance.now();
      
      return {
        duration: endTime - startTime,
        operations: results.length,
        success: results.every(r => !r.error)
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async readProjectFiles() {
    try {
      const files = await fs.readdir('.');
      const readPromises = files.slice(0, 10).map(async (file) => {
        try {
          const stat = await fs.stat(file);
          if (stat.isFile() && stat.size < 100 * 1024) {
            return fs.readFile(file, 'utf8');
          }
        } catch {}
        return null;
      });
      
      const contents = await Promise.all(readPromises);
      return { filesRead: contents.filter(c => c !== null).length };
    } catch (error) {
      return { error: error.message };
    }
  }

  async writeTemporaryFiles() {
    try {
      const tempDir = path.join(__dirname, 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      const writePromises = [];
      for (let i = 0; i < 10; i++) {
        const content = `Temporary file ${i} content\n`.repeat(100);
        writePromises.push(fs.writeFile(path.join(tempDir, `temp${i}.txt`), content));
      }
      
      await Promise.all(writePromises);
      
      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });
      
      return { filesWritten: 10 };
    } catch (error) {
      return { error: error.message };
    }
  }

  async measureActualTemplateRendering() {
    console.log('🎨 Measuring actual template rendering...');
    
    try {
      // Check for actual templates in the project
      const templatesExist = await this.checkForTemplates();
      
      if (templatesExist) {
        return await this.renderActualTemplates();
      } else {
        return await this.renderSampleTemplates();
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  async checkForTemplates() {
    try {
      await fs.access('_templates');
      return true;
    } catch {
      try {
        await fs.access('templates');
        return true;
      } catch {
        return false;
      }
    }
  }

  async renderActualTemplates() {
    const startTime = performance.now();
    
    try {
      const templateDirs = ['_templates', 'templates'];
      let templatesRendered = 0;
      
      for (const dir of templateDirs) {
        try {
          const entries = await fs.readdir(dir, { recursive: true });
          const templateFiles = entries.filter(f => f.endsWith('.njk') || f.endsWith('.hbs'));
          
          for (const templateFile of templateFiles.slice(0, 5)) {
            try {
              const templatePath = path.join(dir, templateFile);
              const content = await fs.readFile(templatePath, 'utf8');
              
              // Simple rendering test (no actual nunjucks processing to avoid complexity)
              if (content.includes('{{') || content.includes('{%')) {
                templatesRendered++;
              }
            } catch {}
          }
        } catch {}
      }
      
      const endTime = performance.now();
      
      return {
        duration: endTime - startTime,
        templatesFound: templatesRendered,
        type: 'actual'
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async renderSampleTemplates() {
    const startTime = performance.now();
    
    // Render some sample templates
    const templates = [
      'Hello {{ name }}!',
      'List: {% for item in items %}{{ item }}{% endfor %}',
      'Conditional: {% if condition %}yes{% else %}no{% endif %}'
    ];
    
    let rendered = 0;
    for (const template of templates) {
      // Simple template processing
      if (template.includes('{{') || template.includes('{%')) {
        rendered++;
      }
    }
    
    const endTime = performance.now();
    
    return {
      duration: endTime - startTime,
      templatesRendered: rendered,
      type: 'sample'
    };
  }

  async measureRealCLICommands() {
    console.log('⚡ Measuring real CLI commands...');
    
    const startTime = performance.now();
    
    try {
      const commands = [
        ['node', ['--version']],
        ['npm', ['--version']],
        ['ls', ['-la', '.']],
        ['pwd']
      ];
      
      const results = [];
      for (const [cmd, args = []] of commands) {
        try {
          const result = await this.runCommand(cmd, args);
          results.push({
            command: `${cmd} ${args.join(' ')}`,
            success: result.exitCode === 0,
            duration: result.duration
          });
        } catch (error) {
          results.push({
            command: `${cmd} ${args.join(' ')}`,
            success: false,
            error: error.message
          });
        }
      }
      
      const endTime = performance.now();
      
      return {
        duration: endTime - startTime,
        commandsRun: results.length,
        successRate: results.filter(r => r.success).length / results.length * 100,
        results
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async runCommand(command, args) {
    const { spawn } = require('child_process');
    const startTime = performance.now();
    
    return new Promise((resolve) => {
      const child = spawn(command, args, { stdio: 'pipe' });
      
      child.on('close', (code) => {
        resolve({
          exitCode: code,
          duration: performance.now() - startTime
        });
      });
      
      child.on('error', () => {
        resolve({
          exitCode: -1,
          duration: performance.now() - startTime
        });
      });
    });
  }

  compareResults() {
    console.log('\n🔍 Comparing Clean Room vs Development Environment...');
    console.log('=====================================================\n');
    
    if (this.cleanRoomResults.error || this.developmentResults.error) {
      console.log('❌ Cannot compare - one or both benchmark runs failed');
      return;
    }
    
    const comparison = {
      totalDuration: {
        cleanRoom: this.cleanRoomResults.totalDuration,
        development: this.developmentResults.totalDuration,
        difference: this.developmentResults.totalDuration - this.cleanRoomResults.totalDuration,
        percentageSlower: ((this.developmentResults.totalDuration / this.cleanRoomResults.totalDuration) - 1) * 100
      }
    };
    
    // Memory comparison
    if (this.cleanRoomResults.memory && this.developmentResults.memoryWithDevFiles) {
      comparison.memoryUsage = this.compareMemoryUsage();
    }
    
    // File operations comparison
    if (this.cleanRoomResults.memory?.fileOperations && this.developmentResults.realFileOperations) {
      comparison.fileOperations = this.compareFileOperations();
    }
    
    this.comparisonResults = comparison;
    
    this.printComparison();
  }

  compareMemoryUsage() {
    const cleanMemory = this.cleanRoomResults.memory?.baseline?.memoryDelta?.rss || 0;
    const devMemory = this.developmentResults.memoryWithDevFiles?.memoryDelta || 0;
    
    return {
      cleanRoom: Math.round(cleanMemory / 1024 / 1024), // MB
      development: Math.round(devMemory / 1024 / 1024), // MB
      difference: Math.round((devMemory - cleanMemory) / 1024 / 1024), // MB
      percentageHigher: cleanMemory > 0 ? ((devMemory / cleanMemory) - 1) * 100 : 0
    };
  }

  compareFileOperations() {
    const cleanFileOps = this.cleanRoomResults.memory?.fileOperations;
    const devFileOps = this.developmentResults.realFileOperations;
    
    if (!cleanFileOps || !devFileOps) return null;
    
    return {
      cleanRoom: Math.round(cleanFileOps.duration),
      development: Math.round(devFileOps.duration),
      difference: Math.round(devFileOps.duration - cleanFileOps.duration),
      percentageSlower: ((devFileOps.duration / cleanFileOps.duration) - 1) * 100
    };
  }

  printComparison() {
    console.log('📊 Performance Comparison Results:');
    console.log('===================================');
    
    const { totalDuration, memoryUsage, fileOperations } = this.comparisonResults;
    
    // Duration comparison
    console.log(`\n⏱️  Total Benchmark Duration:`);
    console.log(`   Clean Room: ${Math.round(totalDuration.cleanRoom)}ms`);
    console.log(`   Development: ${Math.round(totalDuration.development)}ms`);
    console.log(`   Difference: +${Math.round(totalDuration.difference)}ms (${Math.round(totalDuration.percentageSlower)}% slower)`);
    
    // Memory comparison
    if (memoryUsage) {
      console.log(`\n💾 Memory Usage:`);
      console.log(`   Clean Room: ${memoryUsage.cleanRoom}MB`);
      console.log(`   Development: ${memoryUsage.development}MB`);
      console.log(`   Difference: +${memoryUsage.difference}MB (${Math.round(memoryUsage.percentageHigher)}% higher)`);
    }
    
    // File operations comparison
    if (fileOperations) {
      console.log(`\n📁 File Operations:`);
      console.log(`   Clean Room: ${fileOperations.cleanRoom}ms`);
      console.log(`   Development: ${fileOperations.development}ms`);
      console.log(`   Difference: +${fileOperations.difference}ms (${Math.round(fileOperations.percentageSlower)}% slower)`);
    }
    
    // Environment impact analysis
    this.analyzeEnvironmentImpact();
  }

  analyzeEnvironmentImpact() {
    console.log(`\n🔬 Environment Impact Analysis:`);
    console.log('===============================');
    
    if (this.developmentResults.devIndicators) {
      const indicators = this.developmentResults.devIndicators;
      
      console.log('Development Environment Factors:');
      Object.entries(indicators).forEach(([factor, present]) => {
        console.log(`   ${present ? '✅' : '❌'} ${factor}`);
      });
    }
    
    // Performance impact assessment
    const impact = this.comparisonResults.totalDuration.percentageSlower;
    
    if (impact < 10) {
      console.log(`\n🟢 Low Impact: Development environment has minimal performance impact (${Math.round(impact)}%)`);
    } else if (impact < 25) {
      console.log(`\n🟡 Moderate Impact: Development environment has noticeable performance impact (${Math.round(impact)}%)`);
    } else {
      console.log(`\n🔴 High Impact: Development environment significantly affects performance (${Math.round(impact)}%)`);
    }
    
    // Recommendations
    this.generateRecommendations();
  }

  generateRecommendations() {
    console.log(`\n💡 Recommendations:`);
    console.log('==================');
    
    const impact = this.comparisonResults.totalDuration.percentageSlower;
    
    if (impact > 20) {
      console.log('• Consider cleaning up development environment for better performance');
      console.log('• Remove unused node_modules or temporary files');
      console.log('• Consider using .gitignore to exclude performance-impacting files');
    }
    
    if (this.developmentResults.memoryWithDevFiles?.memoryDelta > 100 * 1024 * 1024) {
      console.log('• High memory usage detected - consider optimizing file loading');
      console.log('• Use streaming for large file operations');
    }
    
    console.log('• Run benchmarks in clean room environment for accurate performance measurement');
    console.log('• Consider CI/CD pipeline with clean environment for consistent benchmarking');
  }

  async saveComparison() {
    const resultsPath = path.join(__dirname, 'results', 'environment-comparison.json');
    await fs.mkdir(path.dirname(resultsPath), { recursive: true });
    
    const fullResults = {
      timestamp: new Date().toISOString(),
      cleanRoom: this.cleanRoomResults,
      development: this.developmentResults,
      comparison: this.comparisonResults
    };
    
    await fs.writeFile(resultsPath, JSON.stringify(fullResults, null, 2));
    console.log(`\n💾 Comparison results saved to: ${resultsPath}`);
    
    return fullResults;
  }

  async runFullComparison() {
    console.log('🚀 Starting Full Environment Performance Comparison\n');
    
    await this.runCleanRoomBenchmarks();
    await this.runDevelopmentBenchmarks();
    this.compareResults();
    
    const results = await this.saveComparison();
    
    console.log('\n✅ Full performance comparison completed!');
    
    return results;
  }
}

// Run if called directly
if (require.main === module) {
  const comparison = new EnvironmentComparison();
  comparison.runFullComparison().catch(console.error);
}

module.exports = EnvironmentComparison;