// CLI Startup Performance Optimization Tests
// Target: 3.2s → 0.6s (5.3x improvement)

import { describe, it, expect } from 'vitest';
import { performance } from 'perf_hooks';
import { spawn } from 'child_process';
import { join } from 'path';

describe('CLI Startup Performance', () => {
  const STARTUP_TARGET_MS = 600; // 0.6 second target
  
  it('should achieve fast CLI cold start', async () => {
    const startTime = performance.now();
    
    // Measure CLI startup time
    const startupTime = await measureCLIStartup(['--help']);
    
    const endTime = performance.now();
    console.log(`CLI startup time: ${startupTime}ms (target: <${STARTUP_TARGET_MS}ms)`);
    
    // Target: Under 600ms (from 3.2s baseline)
    expect(startupTime).toBeLessThan(STARTUP_TARGET_MS);
    expect(endTime - startTime).toBeLessThan(1000); // Total test under 1s
  });

  it('should achieve fast command listing', async () => {
    const startTime = performance.now();
    
    // Measure unjucks list command
    const listTime = await measureCLIStartup(['list']);
    
    const endTime = performance.now();
    console.log(`List command time: ${listTime}ms`);
    
    // Should be even faster than help
    expect(listTime).toBeLessThan(STARTUP_TARGET_MS * 0.8); // 480ms
  });

  it('should achieve fast help command', async () => {
    const startTime = performance.now();
    
    // Measure unjucks help command
    const helpTime = await measureCLIStartup(['--help']);
    
    const endTime = performance.now();
    console.log(`Help command time: ${helpTime}ms`);
    
    expect(helpTime).toBeLessThan(STARTUP_TARGET_MS); // 600ms
  });

  it('should optimize import and module loading', async () => {
    // Test dynamic imports and lazy loading
    const importStartTime = performance.now();
    
    // Simulate module loading patterns
    const { loadCLIModules } = await import('../../src/lib/dynamic-imports');
    await loadCLIModules();
    
    const importTime = performance.now() - importStartTime;
    console.log(`Module loading time: ${importTime}ms`);
    
    // Module loading should be optimized
    expect(importTime).toBeLessThan(200); // Under 200ms
  });
});

// Utility functions
async function measureCLIStartup(args: string[]): Promise<number> {
  const CLI_PATH = join(process.cwd(), 'dist/cli.mjs');
  
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    
    const child = spawn('node', [CLI_PATH, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000 // 5 second timeout
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (code === 0 || code === null) {
        resolve(duration);
      } else {
        reject(new Error(`CLI exited with code ${code}. stderr: ${stderr}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
    
    // Timeout fallback
    setTimeout(() => {
      child.kill();
      reject(new Error('CLI startup timeout'));
    }, 5000);
  });
}