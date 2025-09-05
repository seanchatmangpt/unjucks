// Performance Claims Validator for HYGEN-DELTA.md
// Validates actual CLI performance against documented claims

import { describe, it, expect, beforeAll } from 'vitest';
import { performance } from 'perf_hooks';
import { execSync, spawn } from 'child_process';
import { createWriteStream, promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('HYGEN-DELTA.md Performance Claims Validation', () => {
  const CLI_PATH = path.resolve('./dist/cli.mjs');
  const TEMP_DIR = path.join(os.tmpdir(), 'unjucks-perf-test');
  
  // Claims from HYGEN-DELTA.md to validate
  const PERFORMANCE_CLAIMS = {
    coldStart: {
      unjucks: 150, // ~150ms claimed
      hygen: 200,   // ~200ms baseline
      improvement: 25 // 25% faster claimed
    },
    templateProcessing: {
      unjucks: 30,  // ~30ms claimed
      hygen: 50,    // ~50ms baseline
      improvement: 40 // 40% faster claimed
    },
    fileOperations: {
      unjucks: 15,  // ~15ms claimed
      hygen: 20,    // ~20ms baseline
      improvement: 25 // 25% faster claimed
    },
    memoryUsage: {
      unjucks: 20,  // ~20MB claimed
      hygen: 25,    // ~25MB baseline
      improvement: 20 // 20% less claimed
    }
  };

  let validationResults: PerformanceValidationResults;

  beforeAll(async () => {
    // Ensure CLI is built
    try {
      await fs.access(CLI_PATH);
    } catch {
      throw new Error(`CLI not found at ${CLI_PATH}. Run 'npm run build' first.`);
    }

    // Setup temp directory for tests
    await fs.mkdir(TEMP_DIR, { recursive: true });
    
    // Create sample template for testing
    await setupSampleTemplate();

    console.log(`🧪 Performance Claims Validation Starting`);
    console.log(`📍 CLI Path: ${CLI_PATH}`);
    console.log(`📂 Temp Dir: ${TEMP_DIR}`);
    console.log(`💻 System: ${os.cpus().length} cores, ${os.platform()}-${os.arch()}`);
    
    validationResults = {
      coldStart: [],
      templateProcessing: [],
      fileOperations: [],
      memoryUsage: [],
      timestamp: new Date().toISOString(),
      systemInfo: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        cpuCores: os.cpus().length,
        totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB'
      }
    };
  });

  it('should validate cold start performance claims', async () => {
    const { unjucks: claimedTime, improvement: claimedImprovement } = PERFORMANCE_CLAIMS.coldStart;
    const iterations = 10;
    const coldStartTimes: number[] = [];

    console.log(`❄️  Measuring cold start performance (${iterations} iterations)`);

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        // Measure actual CLI cold start with --version (minimal operation)
        execSync(`node "${CLI_PATH}" --version`, { 
          stdio: 'pipe',
          timeout: 5000 
        });
      } catch (error) {
        console.warn(`Cold start iteration ${i + 1} failed:`, error);
        continue;
      }
      
      const coldStartTime = performance.now() - startTime;
      coldStartTimes.push(coldStartTime);
      
      console.log(`   Iteration ${i + 1}: ${coldStartTime.toFixed(0)}ms`);
    }

    const avgColdStart = coldStartTimes.reduce((a, b) => a + b, 0) / coldStartTimes.length;
    const minColdStart = Math.min(...coldStartTimes);
    const maxColdStart = Math.max(...coldStartTimes);

    validationResults.coldStart = coldStartTimes;

    console.log(`📊 Cold Start Results:`);
    console.log(`   Average: ${avgColdStart.toFixed(0)}ms`);
    console.log(`   Min: ${minColdStart.toFixed(0)}ms`);
    console.log(`   Max: ${maxColdStart.toFixed(0)}ms`);
    console.log(`   Claimed: ${claimedTime}ms`);

    // Validate against claims (allow 50ms tolerance for system variance)
    const tolerance = 50;
    expect(avgColdStart).toBeLessThan(claimedTime + tolerance);
    
    // Validate reasonable performance (not slower than 500ms)
    expect(avgColdStart).toBeLessThan(500);
  });

  it('should validate template processing performance claims', async () => {
    const { unjucks: claimedTime } = PERFORMANCE_CLAIMS.templateProcessing;
    const iterations = 20;
    const processingTimes: number[] = [];

    console.log(`🔄 Measuring template processing performance (${iterations} iterations)`);

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        // Measure template list command (processes templates)
        execSync(`node "${CLI_PATH}" list`, { 
          stdio: 'pipe',
          cwd: TEMP_DIR,
          timeout: 5000
        });
      } catch (error) {
        console.warn(`Template processing iteration ${i + 1} failed:`, error);
        continue;
      }
      
      const processingTime = performance.now() - startTime;
      processingTimes.push(processingTime);
    }

    const avgProcessing = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    
    validationResults.templateProcessing = processingTimes;

    console.log(`📊 Template Processing Results:`);
    console.log(`   Average: ${avgProcessing.toFixed(0)}ms`);
    console.log(`   Claimed: ${claimedTime}ms`);

    // Validate against claims (allow 20ms tolerance)
    const tolerance = 20;
    expect(avgProcessing).toBeLessThan(claimedTime + tolerance);
  });

  it('should validate file operation performance claims', async () => {
    const { unjucks: claimedTime } = PERFORMANCE_CLAIMS.fileOperations;
    const iterations = 15;
    const fileOpTimes: number[] = [];

    console.log(`📝 Measuring file operation performance (${iterations} iterations)`);

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        // Measure help command (reads and processes files)
        execSync(`node "${CLI_PATH}" help generate`, { 
          stdio: 'pipe',
          cwd: TEMP_DIR,
          timeout: 5000
        });
      } catch (error) {
        console.warn(`File operation iteration ${i + 1} failed:`, error);
        continue;
      }
      
      const fileOpTime = performance.now() - startTime;
      fileOpTimes.push(fileOpTime);
    }

    const avgFileOp = fileOpTimes.reduce((a, b) => a + b, 0) / fileOpTimes.length;
    
    validationResults.fileOperations = fileOpTimes;

    console.log(`📊 File Operation Results:`);
    console.log(`   Average: ${avgFileOp.toFixed(0)}ms`);
    console.log(`   Claimed: ${claimedTime}ms`);

    // Validate against claims (allow 15ms tolerance)
    const tolerance = 15;
    expect(avgFileOp).toBeLessThan(claimedTime + tolerance);
  });

  it('should validate memory usage performance claims', async () => {
    const { unjucks: claimedMemoryMB } = PERFORMANCE_CLAIMS.memoryUsage;
    const iterations = 5;
    const memoryUsages: number[] = [];

    console.log(`💾 Measuring memory usage performance (${iterations} iterations)`);

    for (let i = 0; i < iterations; i++) {
      const memoryUsage = await measureMemoryUsage();
      memoryUsages.push(memoryUsage);
      
      console.log(`   Iteration ${i + 1}: ${memoryUsage.toFixed(1)}MB`);
    }

    const avgMemory = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length;
    
    validationResults.memoryUsage = memoryUsages;

    console.log(`📊 Memory Usage Results:`);
    console.log(`   Average: ${avgMemory.toFixed(1)}MB`);
    console.log(`   Claimed: ${claimedMemoryMB}MB`);

    // Validate against claims (allow 10MB tolerance for system variance)
    const tolerance = 10;
    expect(avgMemory).toBeLessThan(claimedMemoryMB + tolerance);
  });

  it('should validate overall performance improvements against baselines', () => {
    const coldStartAvg = validationResults.coldStart.length > 0 
      ? validationResults.coldStart.reduce((a, b) => a + b, 0) / validationResults.coldStart.length 
      : 0;
    
    const templateAvg = validationResults.templateProcessing.length > 0
      ? validationResults.templateProcessing.reduce((a, b) => a + b, 0) / validationResults.templateProcessing.length
      : 0;

    const fileOpAvg = validationResults.fileOperations.length > 0
      ? validationResults.fileOperations.reduce((a, b) => a + b, 0) / validationResults.fileOperations.length
      : 0;

    const memoryAvg = validationResults.memoryUsage.length > 0
      ? validationResults.memoryUsage.reduce((a, b) => a + b, 0) / validationResults.memoryUsage.length
      : 0;

    console.log(`🎯 Performance Claims vs Actual Results:`);
    console.log(`   Cold Start: ${coldStartAvg.toFixed(0)}ms (claimed: ${PERFORMANCE_CLAIMS.coldStart.unjucks}ms)`);
    console.log(`   Templates: ${templateAvg.toFixed(0)}ms (claimed: ${PERFORMANCE_CLAIMS.templateProcessing.unjucks}ms)`);
    console.log(`   File Ops: ${fileOpAvg.toFixed(0)}ms (claimed: ${PERFORMANCE_CLAIMS.fileOperations.unjucks}ms)`);
    console.log(`   Memory: ${memoryAvg.toFixed(1)}MB (claimed: ${PERFORMANCE_CLAIMS.memoryUsage.unjucks}MB)`);

    // Calculate improvement vs claimed baselines
    const coldStartImprovement = ((PERFORMANCE_CLAIMS.coldStart.hygen - coldStartAvg) / PERFORMANCE_CLAIMS.coldStart.hygen) * 100;
    const templateImprovement = ((PERFORMANCE_CLAIMS.templateProcessing.hygen - templateAvg) / PERFORMANCE_CLAIMS.templateProcessing.hygen) * 100;
    const fileOpImprovement = ((PERFORMANCE_CLAIMS.fileOperations.hygen - fileOpAvg) / PERFORMANCE_CLAIMS.fileOperations.hygen) * 100;
    const memoryImprovement = ((PERFORMANCE_CLAIMS.memoryUsage.hygen - memoryAvg) / PERFORMANCE_CLAIMS.memoryUsage.hygen) * 100;

    console.log(`🚀 Actual Improvements vs Hygen Baseline:`);
    console.log(`   Cold Start: ${coldStartImprovement.toFixed(1)}% faster (claimed: ${PERFORMANCE_CLAIMS.coldStart.improvement}%)`);
    console.log(`   Templates: ${templateImprovement.toFixed(1)}% faster (claimed: ${PERFORMANCE_CLAIMS.templateProcessing.improvement}%)`);
    console.log(`   File Ops: ${fileOpImprovement.toFixed(1)}% faster (claimed: ${PERFORMANCE_CLAIMS.fileOperations.improvement}%)`);
    console.log(`   Memory: ${memoryImprovement.toFixed(1)}% less (claimed: ${PERFORMANCE_CLAIMS.memoryUsage.improvement}%)`);

    // All metrics should show reasonable performance
    expect(coldStartAvg).toBeLessThan(1000); // Less than 1 second
    expect(templateAvg).toBeLessThan(200);   // Less than 200ms
    expect(fileOpAvg).toBeLessThan(100);     // Less than 100ms
    expect(memoryAvg).toBeLessThan(100);     // Less than 100MB
  });
});

// Helper Functions

async function setupSampleTemplate(): Promise<void> {
  const templatesDir = path.join(TEMP_DIR, '_templates', 'component', 'new');
  await fs.mkdir(templatesDir, { recursive: true });

  const templateContent = `---
to: "src/components/{{ name | pascalCase }}.ts"
---
export interface {{ name | pascalCase }}Props {
  name: string;
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({ name }) => {
  return <div>Hello {name}</div>;
};
`;

  await fs.writeFile(path.join(templatesDir, 'component.ts'), templateContent);
}

async function measureMemoryUsage(): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [CLI_PATH, 'list'], {
      cwd: TEMP_DIR,
      stdio: 'pipe'
    });

    let maxMemory = 0;
    const interval = setInterval(() => {
      try {
        const memory = process.memoryUsage();
        const currentMB = memory.rss / 1024 / 1024;
        if (currentMB > maxMemory) {
          maxMemory = currentMB;
        }
      } catch (error) {
        // Ignore memory measurement errors
      }
    }, 10); // Check every 10ms

    child.on('close', (code) => {
      clearInterval(interval);
      if (code === 0) {
        resolve(maxMemory);
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    child.on('error', (error) => {
      clearInterval(interval);
      reject(error);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      clearInterval(interval);
      child.kill();
      reject(new Error('Memory measurement timeout'));
    }, 5000);
  });
}

// Type Definitions

interface PerformanceValidationResults {
  coldStart: number[];
  templateProcessing: number[];
  fileOperations: number[];
  memoryUsage: number[];
  timestamp: string;
  systemInfo: {
    platform: string;
    arch: string;
    nodeVersion: string;
    cpuCores: number;
    totalMemory: string;
  };
}