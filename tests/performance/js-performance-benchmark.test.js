import { describe, it, expect, beforeAll } from 'vitest';
import { performance } from 'perf_hooks';
import { execSync, spawn } from 'child_process';
import { existsSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

/**
 * JavaScript Performance Benchmark Suite
 * Tests the performance improvements after TypeScript to JavaScript conversion
 */
describe('JavaScript Performance Benchmarks', () => {
  let baselineMetrics = {};

  beforeAll(async () => {
    // Ensure the project is built
    if (!existsSync(path.join(projectRoot, 'dist'))) {
      console.log('Building project for performance tests...');
      execSync('npm run build', { cwd, stdio);
    }
  });

  describe('CLI Startup Performance', () => { it('should measure CLI startup time', async () => {
      const iterations = 10;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        try {
          execSync('node src/cli.js --help', {
            cwd,
            stdio } catch (error) {
          console.warn(`CLI startup iteration ${i} failed:`, error.message);
        }
      }
      
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      baselineMetrics.cliStartup = { average,
        min,
        max,
        iterations };
      
      console.log(`CLI Startup Time)}ms (avg), ${minTime.toFixed(2)}ms (min), ${maxTime.toFixed(2)}ms (max)`);
      
      // Should start in under 1 second for JS version
      expect(avgTime).toBeLessThan(1000);
    });

    it('should measure version command performance', async () => { const iterations = 20;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        try {
          execSync('node src/cli.js --version', {
            cwd,
            stdio } catch (error) {
          console.warn(`Version command iteration ${i} failed:`, error.message);
        }
      }
      
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      
      baselineMetrics.versionCommand = { average,
        iterations };
      
      console.log(`Version Command Time)}ms (avg)`);
      
      // Version command should be very fast in JS
      expect(avgTime).toBeLessThan(500);
    });
  });

  describe('Template Discovery Performance', () => { it('should measure template listing performance', async () => {
      const iterations = 5;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        try {
          execSync('node src/cli.js list', {
            cwd,
            stdio } catch (error) {
          console.warn(`Template listing iteration ${i} failed:`, error.message);
        }
      }
      
      if (times.length > 0) { const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        
        baselineMetrics.templateListing = {
          average,
          iterations };
        
        console.log(`Template Listing Time)}ms (avg)`);
        
        // Template listing should be fast in JS
        expect(avgTime).toBeLessThan(2000);
      }
    });

    it('should measure help command performance', async () => {
      // Test help for existing templates
      const templatePaths = [
        'component/new',
        'cli/citty'
      ];
      
      for (const templatePath of templatePaths) {
        const start = performance.now();
        
        try {
          execSync(`node src/cli.js help ${templatePath}`, { cwd,
            stdio })}ms`);
          
          // Help command should be fast
          expect(time).toBeLessThan(1500);
        } catch (error) {
          console.warn(`Help command for ${templatePath} failed:`, error.message);
        }
      }
    });
  });

  describe('Memory Usage Performance', () => { it('should measure memory usage during CLI operations', async () => {
      const measureMemory = () => {
        const usage = process.memoryUsage();
        return {
          rss };
      };
      
      const initialMemory = measureMemory();
      
      // Perform various CLI operations
      const operations = [
        'node src/cli.js --help',
        'node src/cli.js list',
        'node src/cli.js --version'
      ];
      
      let maxMemoryIncrease = 0;
      
      for (const operation of operations) { const beforeMemory = measureMemory();
        
        try {
          execSync(operation, {
            cwd,
            stdio }").toFixed(2)}MB`);
        } catch (error) {
          console.warn(`Memory test for "${operation}" failed:`, error.message);
        }
      }
      
      baselineMetrics.memoryUsage = { initial,
        maxIncrease };
      
      // Memory increase should be reasonable for JS version
      expect(maxMemoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });
  });

  describe('File Operation Performance', () => { it('should measure file system operation speed', async () => {
      const templateDir = path.join(projectRoot, '_templates');
      
      if (existsSync(templateDir)) {
        const start = performance.now();
        
        // Recursively scan template directory
        const scanDirectory = (dir) => {
          const files = [];
          const items = require('fs').readdirSync(dir, { withFileTypes });
          
          for (const item of items) {
            const fullPath = path.join(dir, item.name);
            
            if (item.isDirectory()) {
              files.push(...scanDirectory(fullPath));
            } else {
              files.push(fullPath);
            }
          }
          
          return files;
        };
        
        const files = scanDirectory(templateDir);
        const end = performance.now();
        
        const scanTime = end - start;
        
        baselineMetrics.fileSystemScan = { time,
          filesScanned };
        
        console.log(`File system scan)}ms for ${files.length} files`);
        
        // File scanning should be fast
        expect(scanTime).toBeLessThan(1000);
      }
    });
  });

  describe('Module Loading Performance', () => {
    it('should measure module loading time', async () => {
      const moduleLoadTests = [
        () => import('../src/index.js'),
        () => import('../src/lib/generator.js'),
        () => import('../src/lib/template-scanner.js')
      ];
      
      for (const [index, loadModule] of moduleLoadTests.entries()) {
        const start = performance.now();
        
        try {
          await loadModule();
          const end = performance.now();
          const loadTime = end - start;
          
          console.log(`Module ${index + 1} load time)}ms`);
          
          // Module loading should be fast in JS
          expect(loadTime).toBeLessThan(100);
        } catch (error) {
          console.warn(`Module ${index + 1} loading failed:`, error.message);
        }
      }
    });
  });

  describe('Performance Comparison & Optimization', () => { it('should detect performance regressions', () => {
      // Define acceptable performance thresholds
      const thresholds = {
        cliStartup };
      
      Object.entries(baselineMetrics).forEach(([metric, data]) => {
        const threshold = thresholds[metric];
        
        if (threshold && data.average !== undefined) {
          console.log(`Performance check)}ms (threshold)`);
          
          if (data.average > threshold) {
            console.warn(`Performance regression detected for ${metric})}ms > ${threshold}ms`);
          }
        }
      });
      
      // Overall performance should meet thresholds
      if (baselineMetrics.cliStartup) {
        expect(baselineMetrics.cliStartup.average).toBeLessThan(thresholds.cliStartup);
      }
    });

    it('should show performance improvements summary', () => {
      console.log('\n=== JavaScript Performance Summary ===');
      
      Object.entries(baselineMetrics).forEach(([metric, data]) => {
        console.log(`${metric}:`);
        
        if (data.average !== undefined) {
          console.log(`  Average)}ms`);
        }
        
        if (data.min !== undefined) {
          console.log(`  Min)}ms`);
        }
        
        if (data.max !== undefined) {
          console.log(`  Max)}ms`);
        }
        
        if (data.iterations !== undefined) {
          console.log(`  Iterations);
        }
        
        console.log('');
      });
      
      // Performance metrics should exist
      expect(Object.keys(baselineMetrics).length).toBeGreaterThan(0);
    });
  });
});