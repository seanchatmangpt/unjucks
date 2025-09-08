/**
 * LaTeX Performance Optimization Tests
 * Validates caching, parallel processing, and performance improvements
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { OptimizedLaTeXCompiler } from '../src/lib/latex/compiler-optimized.js';
import LaTeXPerformanceMonitor from '../src/lib/latex/performance-monitor.js';
import { 
  escapeLatex, 
  extractCommands, 
  latexToPlainText, 
  getCacheStats,
  clearUtilsCache 
} from '../src/lib/latex/utils-optimized.js';

describe('LaTeX Performance Optimizations', () => {
  let tempDir;
  let compiler;
  let monitor;

  beforeEach(async () => {
    // Create temporary test directory
    tempDir = path.join(process.cwd(), 'temp', `test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Initialize optimized compiler
    compiler = new OptimizedLaTeXCompiler({
      outputDir: path.join(tempDir, 'dist'),
      tempDir: path.join(tempDir, 'temp'),
      enableCaching: true,
      maxConcurrency: 4,
      incrementalCompilation: true
    });
    
    // Initialize performance monitor
    monitor = new LaTeXPerformanceMonitor({
      outputDir: path.join(tempDir, 'reports')
    });
    
    await compiler.initialize();
    clearUtilsCache();
  });

  afterEach(async () => {
    await compiler.cleanup();
    await monitor.cleanup();
    
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Compilation Caching', () => {
    it('should cache compilation results and improve subsequent builds', async () => {
      // Create test LaTeX file
      const testFile = path.join(tempDir, 'test.tex');
      const latexContent = `
\\documentclass{article}
\\begin{document}
\\title{Performance Test}
\\author{Test Author}
\\date{\\today}
\\maketitle

This is a test document for performance optimization.
\\section{Introduction}
Testing compilation caching and performance improvements.

\\subsection{Features}
\\begin{itemize}
\\item Compilation result caching
\\item Parallel processing
\\item Memory leak fixes
\\item Performance monitoring
\\end{itemize}

\\end{document}
`;
      await fs.writeFile(testFile, latexContent);

      // First compilation (cache miss)
      const startTime1 = performance.now();
      const result1 = await compiler.compile(testFile);
      const duration1 = performance.now() - startTime1;

      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();
      expect(result1.outputPath).toContain('.pdf');

      // Second compilation (cache hit)
      const startTime2 = performance.now();
      const result2 = await compiler.compile(testFile);
      const duration2 = performance.now() - startTime2;

      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(duration2).toBeLessThan(duration1 * 0.5); // Should be significantly faster

      // Verify metrics
      const metrics = compiler.getMetrics();
      expect(metrics.cacheHits).toBe(1);
      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.cacheHitRate).toBe(50);
    });

    it('should invalidate cache when source file changes', async () => {
      const testFile = path.join(tempDir, 'cache-test.tex');
      const content1 = `
\\documentclass{article}
\\begin{document}
\\title{Version 1}
\\maketitle
Content version 1
\\end{document}
`;
      
      await fs.writeFile(testFile, content1);
      
      // First compilation
      const result1 = await compiler.compile(testFile);
      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();

      // Modify file
      const content2 = content1.replace('Version 1', 'Version 2').replace('version 1', 'version 2');
      await fs.writeFile(testFile, content2);

      // Second compilation should not use cache
      const result2 = await compiler.compile(testFile);
      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBeFalsy();
    });
  });

  describe('Parallel Processing', () => {
    it('should compile multiple documents in parallel', async () => {
      // Create multiple test files
      const numFiles = 4;
      const testFiles = [];
      
      for (let i = 0; i < numFiles; i++) {
        const testFile = path.join(tempDir, `parallel-test-${i}.tex`);
        const content = `
\\documentclass{article}
\\begin{document}
\\title{Parallel Test ${i}}
\\maketitle
This is parallel test document number ${i}.
\\end{document}
`;
        await fs.writeFile(testFile, content);
        testFiles.push(testFile);
      }

      // Sequential compilation for baseline
      const startSequential = performance.now();
      for (const file of testFiles) {
        await compiler.compile(file);
      }
      const sequentialDuration = performance.now() - startSequential;

      // Reset compiler for parallel test
      await compiler.cleanup();
      compiler = new OptimizedLaTeXCompiler({
        outputDir: path.join(tempDir, 'dist2'),
        tempDir: path.join(tempDir, 'temp2'),
        enableCaching: false, // Disable caching to test pure parallel performance
        maxConcurrency: 4
      });
      await compiler.initialize();

      // Parallel compilation
      const startParallel = performance.now();
      const results = await compiler.compileMultiple(testFiles);
      const parallelDuration = performance.now() - startParallel;

      // Verify all compilations succeeded
      const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success);
      expect(successful.length).toBe(numFiles);

      // Parallel should be faster (allowing some overhead)
      expect(parallelDuration).toBeLessThan(sequentialDuration * 0.8);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics and identify bottlenecks', async () => {
      const testFile = path.join(tempDir, 'monitor-test.tex');
      const content = `
\\documentclass{article}
\\usepackage{graphicx}
\\begin{document}
\\title{Performance Monitor Test}
\\maketitle

\\section{Test Section}
This document tests performance monitoring capabilities.

\\subsection{Complex Operations}
% Simulate some work
\\begin{enumerate}
\\item First item
\\item Second item
\\item Third item
\\end{enumerate}

\\end{document}
`;
      await fs.writeFile(testFile, content);

      // Start profiling
      const sessionId = 'test-session-' + Date.now();
      const profile = monitor.startProfile(sessionId, { 
        testFile, 
        optimization: 'enabled' 
      });

      // Simulate compilation events
      monitor.logEvent(sessionId, 'file_read', { file: testFile, duration: 10 });
      monitor.logEvent(sessionId, 'cache_miss', {});
      monitor.logEvent(sessionId, 'latex_pass', { pass: 1, duration: 1000 });
      
      // Perform compilation
      const result = await compiler.compile(testFile);
      expect(result.success).toBe(true);

      // End profiling
      const completedProfile = await monitor.endProfile(sessionId, result.success);
      
      expect(completedProfile).toBeTruthy();
      expect(completedProfile.analysis).toBeTruthy();
      expect(completedProfile.analysis.performance).toBeTruthy();
      expect(completedProfile.analysis.score).toBeGreaterThan(0);
      expect(completedProfile.analysis.recommendations).toBeInstanceOf(Array);
    });

    it('should provide aggregate statistics', async () => {
      // Perform multiple compilations
      const testFile = path.join(tempDir, 'stats-test.tex');
      const content = `
\\documentclass{article}
\\begin{document}
Simple test document.
\\end{document}
`;
      await fs.writeFile(testFile, content);

      for (let i = 0; i < 3; i++) {
        const sessionId = `stats-session-${i}`;
        monitor.startProfile(sessionId);
        await compiler.compile(testFile);
        await monitor.endProfile(sessionId, true);
      }

      const stats = monitor.getAggregateStats();
      expect(stats.total).toBe(3);
      expect(stats.successful).toBe(3);
      expect(stats.successRate).toBe(100);
      expect(stats.avgDuration).toBeGreaterThan(0);
    });
  });

  describe('Utils Optimization', () => {
    it('should cache frequently used operations', () => {
      const testText = 'This is a test with {special} characters & symbols $x = y$.';
      
      // Clear cache and measure initial performance
      clearUtilsCache();
      
      const start1 = performance.now();
      const result1 = escapeLatex(testText);
      const duration1 = performance.now() - start1;
      
      // Second call should use cache
      const start2 = performance.now();
      const result2 = escapeLatex(testText);
      const duration2 = performance.now() - start2;
      
      expect(result1).toBe(result2);
      expect(duration2).toBeLessThanOrEqual(duration1); // Cache should be same or faster
      
      const cacheStats = getCacheStats();
      expect(cacheStats.size).toBeGreaterThan(0);
    });

    it('should efficiently extract LaTeX commands', () => {
      const largeDocument = `
\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{graphicx}
\\begin{document}
\\title{Large Document}
\\author{Test Author}
\\date{\\today}
\\maketitle

`.repeat(100); // Create a large document

      const start = performance.now();
      const commands = extractCommands(largeDocument);
      const duration = performance.now() - start;
      
      expect(commands.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should complete in < 100ms
      
      // Test caching
      const start2 = performance.now();
      const commands2 = extractCommands(largeDocument);
      const duration2 = performance.now() - start2;
      
      expect(commands2).toEqual(commands);
    });

    it('should efficiently convert LaTeX to plain text', () => {
      const latexText = `
\\section{Introduction}
This is \\textbf{bold} and \\textit{italic} text.
We have \\cite{reference1} citations and $x = y$ math.
\\begin{itemize}
\\item First item
\\item Second item
\\end{itemize}
`.repeat(50);

      const start = performance.now();
      const plainText = latexToPlainText(latexText);
      const duration = performance.now() - start;
      
      expect(plainText).not.toContain('\\');
      expect(plainText).toContain('Introduction');
      expect(plainText).toContain('bold');
      expect(duration).toBeLessThan(50); // Should be fast
    });
  });

  describe('Memory Management', () => {
    it('should properly clean up watch mode to prevent memory leaks', async () => {
      const testFile = path.join(tempDir, 'watch-test.tex');
      await fs.writeFile(testFile, `
\\documentclass{article}
\\begin{document}
Watch mode test document.
\\end{document}
`);

      const initialMemory = process.memoryUsage().heapUsed;
      
      // Start and stop watch mode multiple times
      for (let i = 0; i < 5; i++) {
        await compiler.startWatchMode(testFile);
        await new Promise(resolve => setTimeout(resolve, 100));
        await compiler.stopWatchMode();
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory should not increase significantly (allowing for some variance)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
    });

    it('should handle cache cleanup properly', () => {
      // Fill cache with test data
      for (let i = 0; i < 50; i++) {
        escapeLatex(`Test string ${i} with special chars {}`);
      }
      
      const statsBefore = getCacheStats();
      expect(statsBefore.size).toBeGreaterThan(0);
      
      clearUtilsCache();
      
      const statsAfter = getCacheStats();
      expect(statsAfter.size).toBe(0);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle compilation errors gracefully', async () => {
      const invalidFile = path.join(tempDir, 'invalid.tex');
      await fs.writeFile(invalidFile, `
\\documentclass{article}
\\begin{document}
\\invalid_command_that_does_not_exist
\\end{document}
`);

      const sessionId = 'error-test';
      monitor.startProfile(sessionId);
      
      const result = await compiler.compile(invalidFile);
      
      await monitor.endProfile(sessionId, result.success);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      
      const metrics = compiler.getMetrics();
      expect(metrics.errors).toBe(1);
    });

    it('should recover from cache corruption', async () => {
      const testFile = path.join(tempDir, 'cache-recovery.tex');
      await fs.writeFile(testFile, `
\\documentclass{article}
\\begin{document}
Cache recovery test.
\\end{document}
`);

      // First compilation to populate cache
      const result1 = await compiler.compile(testFile);
      expect(result1.success).toBe(true);
      
      // Simulate cache corruption by clearing cache directory
      const cacheDir = path.join(compiler.config.tempDir, '.cache');
      try {
        await fs.rm(cacheDir, { recursive: true, force: true });
      } catch {
        // Ignore if directory doesn't exist
      }
      
      // Second compilation should handle missing cache gracefully
      const result2 = await compiler.compile(testFile);
      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBeFalsy();
    });
  });
});

// Performance benchmark utility
export async function runPerformanceBenchmark() {
  console.log('🚀 Running LaTeX Performance Benchmark...\n');
  
  const tempDir = path.join(process.cwd(), 'temp', 'benchmark');
  await fs.mkdir(tempDir, { recursive: true });
  
  try {
    // Test configurations
    const configs = [
      { name: 'Original', caching: false, parallel: false },
      { name: 'Cached', caching: true, parallel: false },
      { name: 'Parallel + Cached', caching: true, parallel: true }
    ];
    
    const testFiles = [];
    
    // Create test documents
    for (let i = 0; i < 10; i++) {
      const file = path.join(tempDir, `benchmark-${i}.tex`);
      await fs.writeFile(file, `
\\documentclass{article}
\\usepackage{amsmath}
\\begin{document}
\\title{Benchmark Document ${i}}
\\author{Performance Test}
\\date{\\today}
\\maketitle

\\section{Introduction}
This is benchmark document number ${i}.

\\section{Mathematical Content}
\\begin{equation}
E = mc^2 + ${i}x
\\end{equation}

\\section{Lists}
\\begin{itemize}
${Array(10).fill().map((_, j) => `\\item Item ${j + 1}`).join('\n')}
\\end{itemize}

\\end{document}
`);
      testFiles.push(file);
    }
    
    const results = {};
    
    for (const config of configs) {
      console.log(`Testing ${config.name}...`);
      
      const compiler = new OptimizedLaTeXCompiler({
        outputDir: path.join(tempDir, `dist-${config.name.toLowerCase()}`),
        tempDir: path.join(tempDir, `temp-${config.name.toLowerCase()}`),
        enableCaching: config.caching,
        maxConcurrency: config.parallel ? 4 : 1
      });
      
      await compiler.initialize();
      
      const start = performance.now();
      
      if (config.parallel) {
        await compiler.compileMultiple(testFiles);
      } else {
        for (const file of testFiles) {
          await compiler.compile(file);
        }
      }
      
      const duration = performance.now() - start;
      const metrics = compiler.getMetrics();
      
      results[config.name] = {
        duration: Math.round(duration),
        avgPerFile: Math.round(duration / testFiles.length),
        cacheHitRate: metrics.cacheHitRate || 0,
        peakMemoryMB: Math.round(metrics.peakMemoryMB || 0)
      };
      
      await compiler.cleanup();
      
      console.log(`  ✅ Duration: ${results[config.name].duration}ms`);
      console.log(`  ✅ Avg per file: ${results[config.name].avgPerFile}ms`);
      console.log(`  ✅ Cache hit rate: ${results[config.name].cacheHitRate}%`);
      console.log(`  ✅ Peak memory: ${results[config.name].peakMemoryMB}MB\n`);
    }
    
    // Calculate improvements
    const baseline = results['Original'];
    const optimized = results['Parallel + Cached'];
    
    const speedImprovement = ((baseline.duration - optimized.duration) / baseline.duration * 100).toFixed(1);
    const memoryImprovement = baseline.peakMemoryMB > 0 ? 
      ((baseline.peakMemoryMB - optimized.peakMemoryMB) / baseline.peakMemoryMB * 100).toFixed(1) : 'N/A';
    
    console.log('📊 Performance Summary:');
    console.log(`  🚀 Speed improvement: ${speedImprovement}%`);
    console.log(`  💾 Memory optimization: ${memoryImprovement}%`);
    console.log(`  📈 Cache efficiency: ${optimized.cacheHitRate}%`);
    
    return results;
    
  } finally {
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Run benchmark if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceBenchmark().catch(console.error);
}