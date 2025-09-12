/**
 * Specialized Spec-Driven Development Benchmarker
 * Focused on measuring and optimizing specification parsing, validation, and generation performance
 */

import { performance, PerformanceObserver } from 'perf_hooks';
import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import chalk from 'chalk';
import fs from 'fs-extra';

export class SpecBenchmarker {
  constructor(options = {}) {
    this.options = {
      targetGenerationTime: 200, // 200ms target
      warmupIterations: 3,
      benchmarkIterations: 10,
      enableProfiling: true,
      outputDir: '.unjucks/benchmarks',
      ...options
    };

    this.results = new Map();
    this.baselines = new Map();
    this.setupProfiling();
  }

  /**
   * Setup performance profiling
   */
  setupProfiling() {
    if (!this.options.enableProfiling) return;

    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.startsWith('spec-')) {
          this.recordBenchmarkResult(entry.name, entry.duration, {
            startTime: entry.startTime,
            entryType: entry.entryType
          });
        }
      }
    });

    obs.observe({ entryTypes: ['measure', 'mark'] });
  }

  /**
   * Run comprehensive spec-driven performance benchmarks
   */
  async runComprehensiveBenchmark(templatesPath = '_templates') {
    console.log(chalk.blue.bold('🏃‍♂️ Running Spec-Driven Performance Benchmarks'));
    console.log(chalk.gray(`Target: Sub-${this.options.targetGenerationTime}ms generation times`));
    console.log();

    const benchmarks = {
      cli_startup: await this.benchmarkCliStartup(),
      template_discovery: await this.benchmarkTemplateDiscovery(templatesPath),
      spec_parsing: await this.benchmarkSpecParsing(templatesPath),
      template_validation: await this.benchmarkTemplateValidation(templatesPath),
      pattern_matching: await this.benchmarkPatternMatching(templatesPath),
      generation_pipeline: await this.benchmarkGenerationPipeline(templatesPath),
      memory_efficiency: await this.benchmarkMemoryEfficiency(templatesPath),
      concurrent_operations: await this.benchmarkConcurrentOperations(templatesPath)
    };

    return this.generateComprehensiveReport(benchmarks);
  }

  /**
   * Benchmark CLI startup time
   */
  async benchmarkCliStartup() {
    console.log(chalk.gray('📊 Benchmarking CLI startup performance...'));
    
    const results = {
      cold_start: [],
      warm_start: [],
      help_command: [],
      list_command: []
    };

    // Cold start benchmark
    for (let i = 0; i < this.options.benchmarkIterations; i++) {
      const start = performance.now();
      try {
        execSync('node src/cli/index.js --version', { 
          stdio: 'pipe',
          timeout: 5000 
        });
        results.cold_start.push(performance.now() - start);
      } catch (error) {
        console.warn(chalk.yellow(`Warning: CLI startup test ${i + 1} failed`));
      }
    }

    // Help command benchmark
    for (let i = 0; i < this.options.benchmarkIterations; i++) {
      const start = performance.now();
      try {
        execSync('node src/cli/index.js --help', { 
          stdio: 'pipe',
          timeout: 5000 
        });
        results.help_command.push(performance.now() - start);
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Help command test ${i + 1} failed`));
      }
    }

    // List command benchmark  
    for (let i = 0; i < this.options.benchmarkIterations; i++) {
      const start = performance.now();
      try {
        execSync('node src/cli/index.js list', { 
          stdio: 'pipe',
          timeout: 10000 
        });
        results.list_command.push(performance.now() - start);
      } catch (error) {
        console.warn(chalk.yellow(`Warning: List command test ${i + 1} failed`));
      }
    }

    const stats = this.calculateStats(results.cold_start);
    console.log(chalk.green(`✓ CLI startup: ${stats.avg.toFixed(2)}ms avg, ${stats.p95.toFixed(2)}ms P95`));

    return {
      category: 'cli_startup',
      results,
      stats: {
        cold_start: this.calculateStats(results.cold_start),
        warm_start: this.calculateStats(results.warm_start),
        help_command: this.calculateStats(results.help_command),
        list_command: this.calculateStats(results.list_command)
      },
      targetMet: stats.avg <= this.options.targetGenerationTime * 2 // Allow 2x for startup
    };
  }

  /**
   * Benchmark template discovery performance
   */
  async benchmarkTemplateDiscovery(templatesPath) {
    console.log(chalk.gray('📊 Benchmarking template discovery...'));
    
    const results = {
      full_scan: [],
      cached_scan: [],
      filtered_scan: []
    };

    // Full scan benchmark
    for (let i = 0; i < this.options.benchmarkIterations; i++) {
      performance.mark('spec-discovery-start');
      const start = performance.now();
      
      try {
        const templates = await this.discoverTemplates(templatesPath, false);
        const duration = performance.now() - start;
        results.full_scan.push(duration);
        
        performance.mark('spec-discovery-end');
        performance.measure('spec-discovery-full', 'spec-discovery-start', 'spec-discovery-end');
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Discovery test ${i + 1} failed: ${error.message}`));
      }
    }

    const stats = this.calculateStats(results.full_scan);
    console.log(chalk.green(`✓ Template discovery: ${stats.avg.toFixed(2)}ms avg, found templates`));

    return {
      category: 'template_discovery',
      results,
      stats: {
        full_scan: this.calculateStats(results.full_scan),
        cached_scan: this.calculateStats(results.cached_scan),
        filtered_scan: this.calculateStats(results.filtered_scan)
      },
      targetMet: stats.avg <= this.options.targetGenerationTime * 0.5
    };
  }

  /**
   * Benchmark spec parsing performance
   */
  async benchmarkSpecParsing(templatesPath) {
    console.log(chalk.gray('📊 Benchmarking spec parsing performance...'));
    
    const templates = await this.discoverTemplates(templatesPath);
    const sampleTemplates = templates.slice(0, Math.min(10, templates.length));
    
    const results = {
      frontmatter_parsing: [],
      template_compilation: [],
      variable_extraction: [],
      validation: []
    };

    // Test each sample template
    for (const template of sampleTemplates) {
      if (!existsSync(template.path)) continue;

      // Frontmatter parsing
      performance.mark('spec-parse-start');
      const start = performance.now();
      
      try {
        const content = readFileSync(template.path, 'utf8');
        const parsed = this.parseFrontmatter(content);
        const duration = performance.now() - start;
        results.frontmatter_parsing.push(duration);
        
        performance.mark('spec-parse-end');
        performance.measure('spec-parse-frontmatter', 'spec-parse-start', 'spec-parse-end');
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Parse test failed for ${template.path}`));
      }
    }

    const stats = this.calculateStats(results.frontmatter_parsing);
    console.log(chalk.green(`✓ Spec parsing: ${stats.avg.toFixed(2)}ms avg per template`));

    return {
      category: 'spec_parsing',
      results,
      stats: {
        frontmatter_parsing: this.calculateStats(results.frontmatter_parsing),
        template_compilation: this.calculateStats(results.template_compilation),
        variable_extraction: this.calculateStats(results.variable_extraction),
        validation: this.calculateStats(results.validation)
      },
      targetMet: stats.avg <= this.options.targetGenerationTime * 0.3
    };
  }

  /**
   * Benchmark template validation performance
   */
  async benchmarkTemplateValidation(templatesPath) {
    console.log(chalk.gray('📊 Benchmarking template validation...'));
    
    const templates = await this.discoverTemplates(templatesPath);
    const results = {
      syntax_validation: [],
      schema_validation: [],
      dependency_validation: []
    };

    // Validate each template
    for (const template of templates.slice(0, 5)) {
      const start = performance.now();
      
      try {
        await this.validateTemplate(template);
        const duration = performance.now() - start;
        results.syntax_validation.push(duration);
      } catch (error) {
        console.warn(chalk.yellow(`Validation failed for ${template.relativePath}`));
      }
    }

    const stats = this.calculateStats(results.syntax_validation);
    console.log(chalk.green(`✓ Template validation: ${stats.avg.toFixed(2)}ms avg`));

    return {
      category: 'template_validation',
      results,
      stats: {
        syntax_validation: this.calculateStats(results.syntax_validation),
        schema_validation: this.calculateStats(results.schema_validation),
        dependency_validation: this.calculateStats(results.dependency_validation)
      },
      targetMet: stats.avg <= this.options.targetGenerationTime * 0.2
    };
  }

  /**
   * Benchmark pattern matching performance
   */
  async benchmarkPatternMatching(templatesPath) {
    console.log(chalk.gray('📊 Benchmarking pattern matching...'));
    
    const templates = await this.discoverTemplates(templatesPath);
    const patterns = ['component', 'api', 'page', 'service', 'model', '*'];
    const results = {
      exact_match: [],
      wildcard_match: [],
      regex_match: [],
      fuzzy_match: []
    };

    for (const pattern of patterns) {
      for (let i = 0; i < this.options.benchmarkIterations; i++) {
        const start = performance.now();
        
        try {
          const matches = this.matchPattern(pattern, templates);
          const duration = performance.now() - start;
          results.exact_match.push(duration);
        } catch (error) {
          console.warn(chalk.yellow(`Pattern matching failed for ${pattern}`));
        }
      }
    }

    const stats = this.calculateStats(results.exact_match);
    console.log(chalk.green(`✓ Pattern matching: ${stats.avg.toFixed(2)}ms avg`));

    return {
      category: 'pattern_matching',
      results,
      stats: {
        exact_match: this.calculateStats(results.exact_match),
        wildcard_match: this.calculateStats(results.wildcard_match),
        regex_match: this.calculateStats(results.regex_match),
        fuzzy_match: this.calculateStats(results.fuzzy_match)
      },
      targetMet: stats.avg <= this.options.targetGenerationTime * 0.1
    };
  }

  /**
   * Benchmark full generation pipeline
   */
  async benchmarkGenerationPipeline(templatesPath) {
    console.log(chalk.gray('📊 Benchmarking generation pipeline...'));
    
    const templates = await this.discoverTemplates(templatesPath);
    const sampleTemplate = templates.find(t => t.generator === 'component') || templates[0];
    
    if (!sampleTemplate) {
      console.log(chalk.yellow('No suitable template found for generation benchmark'));
      return {
        category: 'generation_pipeline',
        results: { end_to_end: [] },
        stats: { end_to_end: { avg: 0, min: 0, max: 0, p95: 0 } },
        targetMet: false
      };
    }

    const results = {
      end_to_end: [],
      template_rendering: [],
      file_writing: [],
      validation: []
    };

    for (let i = 0; i < this.options.benchmarkIterations; i++) {
      performance.mark('spec-generation-start');
      const start = performance.now();
      
      try {
        await this.simulateGeneration(sampleTemplate, {
          name: `TestComponent${i}`,
          outputDir: '/tmp/unjucks-bench'
        });
        
        const duration = performance.now() - start;
        results.end_to_end.push(duration);
        
        performance.mark('spec-generation-end');
        performance.measure('spec-generation-pipeline', 'spec-generation-start', 'spec-generation-end');
      } catch (error) {
        console.warn(chalk.yellow(`Generation test ${i + 1} failed: ${error.message}`));
      }
    }

    const stats = this.calculateStats(results.end_to_end);
    console.log(chalk.green(`✓ Generation pipeline: ${stats.avg.toFixed(2)}ms avg`));

    return {
      category: 'generation_pipeline',
      results,
      stats: {
        end_to_end: this.calculateStats(results.end_to_end),
        template_rendering: this.calculateStats(results.template_rendering),
        file_writing: this.calculateStats(results.file_writing),
        validation: this.calculateStats(results.validation)
      },
      targetMet: stats.avg <= this.options.targetGenerationTime
    };
  }

  /**
   * Benchmark memory efficiency
   */
  async benchmarkMemoryEfficiency(templatesPath) {
    console.log(chalk.gray('📊 Benchmarking memory efficiency...'));
    
    const initialMemory = process.memoryUsage();
    const templates = await this.discoverTemplates(templatesPath);
    
    const results = {
      template_loading: [],
      cache_usage: [],
      garbage_collection: []
    };

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const beforeMemory = process.memoryUsage();
    
    // Load all templates into memory
    const start = performance.now();
    for (const template of templates) {
      try {
        if (existsSync(template.path)) {
          const content = readFileSync(template.path, 'utf8');
          this.parseFrontmatter(content);
        }
      } catch (error) {
        // Ignore individual template errors
      }
    }
    const loadingTime = performance.now() - start;

    const afterMemory = process.memoryUsage();
    
    // Force another GC
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();

    const memoryStats = {
      initial: initialMemory,
      beforeLoading: beforeMemory,
      afterLoading: afterMemory,
      final: finalMemory,
      loadingTime: loadingTime,
      templatesLoaded: templates.length,
      memoryPerTemplate: (afterMemory.heapUsed - beforeMemory.heapUsed) / templates.length
    };

    console.log(chalk.green(`✓ Memory efficiency: ${memoryStats.memoryPerTemplate.toFixed(0)} bytes/template`));

    return {
      category: 'memory_efficiency',
      results: { memory_stats: [memoryStats] },
      stats: { memory_efficiency: memoryStats },
      targetMet: memoryStats.memoryPerTemplate < 50000 // 50KB per template target
    };
  }

  /**
   * Benchmark concurrent operations
   */
  async benchmarkConcurrentOperations(templatesPath) {
    console.log(chalk.gray('📊 Benchmarking concurrent operations...'));
    
    const templates = await this.discoverTemplates(templatesPath);
    const sampleTemplates = templates.slice(0, Math.min(5, templates.length));
    
    const results = {
      parallel_parsing: [],
      sequential_parsing: [],
      concurrent_generation: []
    };

    // Sequential parsing benchmark
    const sequentialStart = performance.now();
    for (const template of sampleTemplates) {
      try {
        if (existsSync(template.path)) {
          const content = readFileSync(template.path, 'utf8');
          this.parseFrontmatter(content);
        }
      } catch (error) {
        // Ignore errors
      }
    }
    results.sequential_parsing.push(performance.now() - sequentialStart);

    // Parallel parsing benchmark
    const parallelStart = performance.now();
    await Promise.all(sampleTemplates.map(async (template) => {
      try {
        if (existsSync(template.path)) {
          const content = readFileSync(template.path, 'utf8');
          this.parseFrontmatter(content);
        }
      } catch (error) {
        // Ignore errors
      }
    }));
    results.parallel_parsing.push(performance.now() - parallelStart);

    const parallelStats = this.calculateStats(results.parallel_parsing);
    const sequentialStats = this.calculateStats(results.sequential_parsing);
    
    const speedup = sequentialStats.avg / parallelStats.avg;
    
    console.log(chalk.green(`✓ Concurrent operations: ${speedup.toFixed(2)}x speedup`));

    return {
      category: 'concurrent_operations',
      results,
      stats: {
        parallel_parsing: parallelStats,
        sequential_parsing: sequentialStats,
        speedup: speedup
      },
      targetMet: speedup > 1.5 // At least 1.5x speedup target
    };
  }

  /**
   * Helper: Discover templates in directory
   */
  async discoverTemplates(templatesPath, useCache = true) {
    if (!existsSync(templatesPath)) {
      return [];
    }

    const templates = [];
    const items = await fs.readdir(templatesPath, { withFileTypes: true });
    
    for (const item of items) {
      if (item.isDirectory()) {
        const generatorPath = join(templatesPath, item.name);
        const subItems = await fs.readdir(generatorPath, { withFileTypes: true });
        
        for (const subItem of subItems) {
          if (subItem.isDirectory()) {
            const templatePath = join(generatorPath, subItem.name);
            const files = await fs.readdir(templatePath);
            
            for (const file of files) {
              const fullPath = join(templatePath, file);
              templates.push({
                path: fullPath,
                relativePath: fullPath.replace(process.cwd() + '/', ''),
                generator: item.name,
                template: subItem.name,
                file: file
              });
            }
          }
        }
      }
    }

    return templates;
  }

  /**
   * Helper: Parse frontmatter
   */
  parseFrontmatter(content) {
    if (!content.startsWith('---')) {
      return { data: {}, content };
    }

    const endIndex = content.indexOf('---', 3);
    if (endIndex === -1) {
      return { data: {}, content };
    }

    const frontmatterStr = content.slice(3, endIndex).trim();
    const body = content.slice(endIndex + 3).trim();
    
    try {
      // Simple YAML-like parsing for basic cases
      const data = {};
      const lines = frontmatterStr.split('\n');
      
      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim();
          const value = line.slice(colonIndex + 1).trim().replace(/['"]/g, '');
          data[key] = value;
        }
      }
      
      return { data, content: body };
    } catch (error) {
      return { data: {}, content: body };
    }
  }

  /**
   * Helper: Validate template
   */
  async validateTemplate(template) {
    if (!existsSync(template.path)) {
      throw new Error(`Template not found: ${template.path}`);
    }

    const content = readFileSync(template.path, 'utf8');
    const parsed = this.parseFrontmatter(content);
    
    // Basic validation
    if (parsed.content.length === 0) {
      throw new Error('Empty template content');
    }

    return true;
  }

  /**
   * Helper: Match pattern against templates
   */
  matchPattern(pattern, templates) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
    return templates.filter(template => 
      regex.test(template.generator) || 
      regex.test(template.template) ||
      regex.test(template.relativePath)
    );
  }

  /**
   * Helper: Simulate generation process
   */
  async simulateGeneration(template, variables) {
    // Simulate the generation pipeline without actual file writing
    const content = readFileSync(template.path, 'utf8');
    const parsed = this.parseFrontmatter(content);
    
    // Simulate template rendering
    let rendered = parsed.content;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value);
    }
    
    // Simulate validation
    if (rendered.length === 0) {
      throw new Error('Empty rendered content');
    }
    
    return rendered;
  }

  /**
   * Helper: Calculate statistics
   */
  calculateStats(values) {
    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / values.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  /**
   * Record benchmark result
   */
  recordBenchmarkResult(name, duration, metadata = {}) {
    if (!this.results.has(name)) {
      this.results.set(name, []);
    }
    
    this.results.get(name).push({
      duration,
      timestamp: this.getDeterministicTimestamp(),
      ...metadata
    });
  }

  /**
   * Generate comprehensive performance report
   */
  generateComprehensiveReport(benchmarks) {
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      target: this.options.targetGenerationTime,
      summary: this.generateSummary(benchmarks),
      benchmarks: benchmarks,
      recommendations: this.generateRecommendations(benchmarks),
      conclusion: this.generateConclusion(benchmarks)
    };

    return report;
  }

  /**
   * Generate summary statistics
   */
  generateSummary(benchmarks) {
    const totalCategories = Object.keys(benchmarks).length;
    const targetsMet = Object.values(benchmarks).filter(b => b.targetMet).length;
    const overallScore = (targetsMet / totalCategories) * 100;

    return {
      totalCategories,
      targetsMet,
      overallScore,
      performanceGrade: this.calculatePerformanceGrade(overallScore)
    };
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(benchmarks) {
    const recommendations = [];

    for (const [category, results] of Object.entries(benchmarks)) {
      if (!results.targetMet) {
        recommendations.push({
          category,
          priority: this.calculatePriority(results),
          suggestion: this.generateCategorySuggestion(category, results),
          impact: 'high'
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate conclusion
   */
  generateConclusion(benchmarks) {
    const summary = this.generateSummary(benchmarks);
    
    if (summary.overallScore >= 90) {
      return {
        status: 'excellent',
        message: 'Performance targets exceeded. System is highly optimized.',
        nextSteps: ['Monitor for regressions', 'Consider advanced optimizations']
      };
    } else if (summary.overallScore >= 70) {
      return {
        status: 'good',
        message: 'Most performance targets met. Some optimization opportunities remain.',
        nextSteps: ['Address failing benchmarks', 'Implement caching improvements']
      };
    } else if (summary.overallScore >= 50) {
      return {
        status: 'needs_improvement',
        message: 'Performance targets partially met. Significant optimization needed.',
        nextSteps: ['Focus on high-impact optimizations', 'Implement performance monitoring']
      };
    } else {
      return {
        status: 'critical',
        message: 'Performance targets largely unmet. Immediate optimization required.',
        nextSteps: ['Comprehensive performance audit', 'Major architectural improvements']
      };
    }
  }

  /**
   * Calculate performance grade
   */
  calculatePerformanceGrade(score) {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'A-';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'B-';
    if (score >= 65) return 'C+';
    if (score >= 60) return 'C';
    if (score >= 55) return 'C-';
    if (score >= 50) return 'D+';
    if (score >= 45) return 'D';
    return 'F';
  }

  /**
   * Calculate recommendation priority
   */
  calculatePriority(results) {
    if (results.stats && results.stats.end_to_end) {
      const avg = results.stats.end_to_end.avg;
      if (avg > this.options.targetGenerationTime * 2) return 'critical';
      if (avg > this.options.targetGenerationTime * 1.5) return 'high';
      if (avg > this.options.targetGenerationTime) return 'medium';
    }
    return 'low';
  }

  /**
   * Generate category-specific suggestions
   */
  generateCategorySuggestion(category, results) {
    const suggestions = {
      cli_startup: 'Optimize CLI initialization by lazy-loading modules and reducing startup overhead',
      template_discovery: 'Implement directory indexing cache and parallel file system scanning',
      spec_parsing: 'Add frontmatter parsing cache and optimize YAML processing',
      template_validation: 'Implement incremental validation and schema caching',
      pattern_matching: 'Use optimized regex patterns and implement pattern result caching',
      generation_pipeline: 'Optimize template compilation and implement streaming file operations',
      memory_efficiency: 'Implement memory pooling and optimize template caching strategies',
      concurrent_operations: 'Increase parallelization and implement work stealing patterns'
    };

    return suggestions[category] || 'Review and optimize the implementation for better performance';
  }

  /**
   * Save benchmark results
   */
  async saveBenchmarkResults(report, outputPath = null) {
    const outputDir = outputPath || this.options.outputDir;
    await fs.ensureDir(outputDir);
    
    const timestamp = this.getDeterministicDate().toISOString().replace(/[:.]/g, '-');
    const filename = `spec-performance-${timestamp}.json`;
    const filepath = join(outputDir, filename);
    
    await fs.writeJson(filepath, report, { spaces: 2 });
    
    console.log();
    console.log(chalk.green(`✓ Benchmark results saved to ${filepath}`));
    
    return filepath;
  }
}

export default SpecBenchmarker;