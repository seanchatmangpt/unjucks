import { beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

// Global performance test setup
beforeAll(() => {
  console.log('🚀 Setting up performance test environment...');
  
  // Ensure clean test environment
  const tempDir = join(process.cwd(), 'tests/temp');
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
  mkdirSync(tempDir, { recursive: true });
  
  // Create reports directory
  const reportsDir = join(process.cwd(), 'reports');
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
  
  // Set up environment variables for consistent testing
  process.env.NODE_ENV = 'test';
  process.env.DEBUG_UNJUCKS = 'false'; // Disable debug output for clean measurements
  
  // Performance monitoring setup
  if (typeof global !== 'undefined') {
    global.performanceMetrics = {
      startTime: performance.now(),
      measurements: []
    };
  }
  
  // Build the CLI if it doesn't exist
  const cliPath = join(process.cwd(), 'dist/cli.mjs');
  if (!existsSync(cliPath)) {
    console.warn('⚠️  CLI build not found. Run "npm run build" first for accurate performance tests');
  }
  
  console.log('✅ Performance test environment ready');
});

afterAll(() => {
  console.log('🧹 Cleaning up performance test environment...');
  
  // Clean up temp directories
  const tempDir = join(process.cwd(), 'tests/temp');
  if (existsSync(tempDir)) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Warning: Could not clean up temp directory:', error.message);
    }
  }
  
  // Log final performance summary
  if (typeof global !== 'undefined' && global.performanceMetrics) {
    const totalTime = performance.now() - global.performanceMetrics.startTime;
    console.log(`📊 Total performance test runtime: ${(totalTime / 1000).toFixed(2)}s`);
  }
  
  console.log('✅ Performance test cleanup complete');
});

// Export helper functions for performance testing
export function measurePerformance<T>(fn: () => Promise<T>, label: string): Promise<{ result: T, duration: number }> {
  return new Promise(async (resolve) => {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Record measurement globally
      if (typeof global !== 'undefined' && global.performanceMetrics) {
        global.performanceMetrics.measurements.push({
          label,
          duration,
          timestamp: new Date().toISOString()
        });
      }
      
      resolve({ result, duration });
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Record failed measurement
      if (typeof global !== 'undefined' && global.performanceMetrics) {
        global.performanceMetrics.measurements.push({
          label: `${label} (FAILED)`,
          duration,
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
      
      throw error;
    }
  });
}

export function getPerformanceBaseline(testName: string): number {
  // Return baseline performance expectations
  const baselines: Record<string, number> = {
    'cli-startup': 200,
    'help-command': 150,
    'list-command': 100,
    'simple-generation': 50,
    'complex-generation': 100,
    'large-file': 5000,
    'memory-usage': 100,
    'concurrent-ops': 2000,
    'error-recovery': 1000
  };
  
  return baselines[testName] || 1000; // Default 1s if not specified
}

export function assertPerformance(duration: number, threshold: number, testName: string): void {
  if (duration > threshold) {
    const overrun = ((duration - threshold) / threshold * 100).toFixed(2);
    throw new Error(`Performance threshold exceeded for ${testName}: ${duration.toFixed(2)}ms > ${threshold}ms (${overrun}% over)`);
  }
}

// Memory usage monitoring
export function getMemoryUsage(): { heapUsed: number, heapTotal: number, external: number } {
  const usage = process.memoryUsage();
  return {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100, // MB
    external: Math.round(usage.external / 1024 / 1024 * 100) / 100 // MB
  };
}

// Utility for warming up Node.js before performance tests
export async function warmUpNode(): Promise<void> {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    // Run a simple Node.js operation to warm up the runtime
    await execAsync('node -e "console.log(\'warmup\')"');
  } catch (error) {
    // Ignore warmup errors
  }
}

// Global type definitions for TypeScript
declare global {
  var performanceMetrics: {
    startTime: number;
    measurements: Array<{
      label: string;
      duration: number;
      timestamp: string;
      error?: string;
    }>;
  };
}