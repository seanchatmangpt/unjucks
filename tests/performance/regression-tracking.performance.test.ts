import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

const execAsync = promisify(exec);

interface PerformanceBaseline {
  testName: string;
  averageDuration: number;
  maxDuration: number;
  minDuration: number;
  measurements: number[];
  timestamp: string;
  environment: {
    nodeVersion: string;
    platform: string;
    cpuCount: number;
  };
}

interface RegressionResult {
  testName: string;
  currentAverage: number;
  baselineAverage: number;
  changePercent: number;
  isRegression: boolean;
  threshold: number;
}

describe('Performance Regression Tracking', () => {
  const testDir = join(process.cwd(), 'tests/temp/regression-tracking');
  const cliPath = join(process.cwd(), 'dist/cli.mjs');
  const baselinesPath = join(process.cwd(), 'tests/performance/baselines.json');
  
  let currentBaselines: Record<string, PerformanceBaseline> = {};
  const regressionThreshold = 10; // 10% performance degradation threshold
  
  beforeAll(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    
    // Load existing baselines if they exist
    if (existsSync(baselinesPath)) {
      try {
        const baselineData = readFileSync(baselinesPath, 'utf-8');
        currentBaselines = JSON.parse(baselineData);
      } catch (error) {
        console.warn('Could not load existing baselines, starting fresh');
        currentBaselines = {};
      }
    }
    
    setupRegressionTestTemplates();
  });

  afterAll(() => {
    // Save updated baselines
    writeFileSync(baselinesPath, JSON.stringify(currentBaselines, null, 2));
    
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  function setupRegressionTestTemplates() {
    const templatesDir = join(testDir, '_templates');
    
    // Standard component template
    const componentDir = join(templatesDir, 'component/standard');
    mkdirSync(componentDir, { recursive: true });
    
    writeFileSync(join(componentDir, 'component.tsx.njk'), `---
to: src/components/<%= h.changeCase.pascal(name) %>.tsx
---
import React from 'react';

interface <%= h.changeCase.pascal(name) %>Props {
  title: string;
  description?: string;
}

export const <%= h.changeCase.pascal(name) %>: React.FC<<%= h.changeCase.pascal(name) %>Props> = ({ 
  title, 
  description 
}) => {
  return (
    <div className="<%= h.changeCase.kebab(name) %>">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
};

export default <%= h.changeCase.pascal(name) %>;
`);

    // Service template for more complex testing
    const serviceDir = join(templatesDir, 'service/api');
    mkdirSync(serviceDir, { recursive: true });
    
    writeFileSync(join(serviceDir, 'service.ts.njk'), `---
to: src/services/<%= h.changeCase.pascal(name) %>Service.ts
---
export class <%= h.changeCase.pascal(name) %>Service {
  private apiUrl = '/api/<%= h.changeCase.kebab(name) %>';

  async getAll(): Promise<any[]> {
    const response = await fetch(this.apiUrl);
    return response.json();
  }

  async getById(id: string): Promise<any> {
    const response = await fetch(\`\${this.apiUrl}/\${id}\`);
    return response.json();
  }

  async create(data: any): Promise<any> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  async update(id: string, data: any): Promise<any> {
    const response = await fetch(\`\${this.apiUrl}/\${id}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  async delete(id: string): Promise<void> {
    await fetch(\`\${this.apiUrl}/\${id}\`, {
      method: 'DELETE'
    });
  }
}
`);
  }

  async function measurePerformanceWithBaseline(
    testName: string,
    operation: () => Promise<any>,
    iterations: number = 5
  ): Promise<RegressionResult> {
    const measurements: number[] = [];
    
    // Run multiple iterations for statistical significance
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await operation();
      const endTime = performance.now();
      measurements.push(endTime - startTime);
    }
    
    const currentAverage = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
    const currentMax = Math.max(...measurements);
    const currentMin = Math.min(...measurements);
    
    // Create new baseline entry
    const newBaseline: PerformanceBaseline = {
      testName,
      averageDuration: currentAverage,
      maxDuration: currentMax,
      minDuration: currentMin,
      measurements,
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cpuCount: require('os').cpus().length
      }
    };
    
    // Compare with existing baseline
    let regressionResult: RegressionResult;
    
    if (currentBaselines[testName]) {
      const baseline = currentBaselines[testName];
      const changePercent = ((currentAverage - baseline.averageDuration) / baseline.averageDuration) * 100;
      const isRegression = changePercent > regressionThreshold;
      
      regressionResult = {
        testName,
        currentAverage,
        baselineAverage: baseline.averageDuration,
        changePercent,
        isRegression,
        threshold: regressionThreshold
      };
      
      console.log(`📊 ${testName}:`);
      console.log(`   Current: ${currentAverage.toFixed(2)}ms`);
      console.log(`   Baseline: ${baseline.averageDuration.toFixed(2)}ms`);
      console.log(`   Change: ${changePercent.toFixed(2)}%`);
      
      if (isRegression) {
        console.warn(`⚠️  Performance regression detected!`);
      } else if (changePercent < -5) {
        console.log(`🚀 Performance improvement detected!`);
      }
    } else {
      // First time running this test - establish baseline
      regressionResult = {
        testName,
        currentAverage,
        baselineAverage: currentAverage,
        changePercent: 0,
        isRegression: false,
        threshold: regressionThreshold
      };
      
      console.log(`📋 Establishing baseline for ${testName}: ${currentAverage.toFixed(2)}ms`);
    }
    
    // Update baseline with current measurements
    currentBaselines[testName] = newBaseline;
    
    return regressionResult;
  }

  it('tracks CLI startup performance regression', async () => {
    const result = await measurePerformanceWithBaseline(
      'CLI Startup',
      async () => {
        await execAsync(`node ${cliPath} --version`, {
          cwd: testDir,
          timeout: 5000
        });
      }
    );
    
    expect(result.isRegression).toBe(false);
    expect(result.currentAverage).toBeLessThan(500); // Absolute limit
  });

  it('tracks help command performance regression', async () => {
    const result = await measurePerformanceWithBaseline(
      'Help Command',
      async () => {
        await execAsync(`node ${cliPath} --help`, {
          cwd: testDir,
          timeout: 5000
        });
      }
    );
    
    expect(result.isRegression).toBe(false);
    expect(result.currentAverage).toBeLessThan(300); // Absolute limit
  });

  it('tracks list command performance regression', async () => {
    const result = await measurePerformanceWithBaseline(
      'List Templates',
      async () => {
        await execAsync(`node ${cliPath} list`, {
          cwd: testDir,
          timeout: 5000
        });
      }
    );
    
    expect(result.isRegression).toBe(false);
    expect(result.currentAverage).toBeLessThan(200); // Absolute limit
  });

  it('tracks simple generation performance regression', async () => {
    let counter = 0;
    
    const result = await measurePerformanceWithBaseline(
      'Simple Generation',
      async () => {
        const outputDir = join(testDir, `output-simple-${counter++}`);
        mkdirSync(outputDir, { recursive: true });
        
        await execAsync(`node ${cliPath} generate component standard --name TestComponent${counter} --dest ${outputDir}`, {
          cwd: testDir,
          timeout: 10000
        });
        
        // Verify file was created
        const expectedFile = join(outputDir, `src/components/TestComponent${counter}.tsx`);
        expect(existsSync(expectedFile)).toBe(true);
      }
    );
    
    expect(result.isRegression).toBe(false);
    expect(result.currentAverage).toBeLessThan(100); // Absolute limit
  });

  it('tracks complex generation performance regression', async () => {
    let counter = 0;
    
    const result = await measurePerformanceWithBaseline(
      'Service Generation',
      async () => {
        const outputDir = join(testDir, `output-service-${counter++}`);
        mkdirSync(outputDir, { recursive: true });
        
        await execAsync(`node ${cliPath} generate service api --name TestService${counter} --dest ${outputDir}`, {
          cwd: testDir,
          timeout: 15000
        });
        
        // Verify file was created
        const expectedFile = join(outputDir, `src/services/TestService${counter}Service.ts`);
        expect(existsSync(expectedFile)).toBe(true);
      }
    );
    
    expect(result.isRegression).toBe(false);
    expect(result.currentAverage).toBeLessThan(150); // Absolute limit
  });

  it('tracks concurrent operations performance regression', async () => {
    const result = await measurePerformanceWithBaseline(
      'Concurrent Generation (5 parallel)',
      async () => {
        const baseOutputDir = join(testDir, `output-concurrent-${Date.now()}`);
        mkdirSync(baseOutputDir, { recursive: true });
        
        const promises = [];
        for (let i = 0; i < 5; i++) {
          const outputDir = join(baseOutputDir, `concurrent-${i}`);
          mkdirSync(outputDir, { recursive: true });
          
          promises.push(
            execAsync(`node ${cliPath} generate component standard --name Concurrent${i} --dest ${outputDir}`, {
              cwd: testDir,
              timeout: 20000
            })
          );
        }
        
        await Promise.all(promises);
        
        // Verify all files were created
        for (let i = 0; i < 5; i++) {
          const expectedFile = join(baseOutputDir, `concurrent-${i}/src/components/Concurrent${i}.tsx`);
          expect(existsSync(expectedFile)).toBe(true);
        }
      },
      3 // Fewer iterations for concurrent tests
    );
    
    expect(result.isRegression).toBe(false);
    expect(result.currentAverage).toBeLessThan(2000); // Absolute limit
  });

  it('tracks template parsing performance regression', async () => {
    // Create a template with complex conditionals and loops
    const complexDir = join(testDir, '_templates/complex/test');
    mkdirSync(complexDir, { recursive: true });
    
    writeFileSync(join(complexDir, 'complex.ts.njk'), `---
to: src/complex/<%= h.changeCase.kebab(name) %>.ts
---
// Complex template with conditionals and loops
export class <%= h.changeCase.pascal(name) %> {
  {% for i in range(0, 50) %}
  {% if i % 5 == 0 %}
  method{{ i }}(): string {
    return 'Method {{ i }} result';
  }
  {% endif %}
  {% endfor %}

  processData(data: any[]): any[] {
    return data.map((item, index) => ({
      ...item,
      {% for prop in ['id', 'name', 'status', 'created', 'updated'] %}
      {{ prop }}: item.{{ prop }} || 'default-{{ prop }}',
      {% endfor %}
      processed: true
    }));
  }
}
`);
    
    let counter = 0;
    const result = await measurePerformanceWithBaseline(
      'Complex Template Parsing',
      async () => {
        const outputDir = join(testDir, `output-complex-${counter++}`);
        mkdirSync(outputDir, { recursive: true });
        
        await execAsync(`node ${cliPath} generate complex test --name ComplexTest${counter} --dest ${outputDir}`, {
          cwd: testDir,
          timeout: 15000
        });
        
        // Verify file was created and contains expected content
        const expectedFile = join(outputDir, `src/complex/complex-test-${counter}.ts`);
        expect(existsSync(expectedFile)).toBe(true);
        
        const content = readFileSync(expectedFile, 'utf-8');
        expect(content).toContain('method0()');
        expect(content).toContain('method45()');
        expect(content).toContain('processData');
      }
    );
    
    expect(result.isRegression).toBe(false);
    expect(result.currentAverage).toBeLessThan(300); // Absolute limit
  });

  it('creates performance regression report', async () => {
    // Generate a comprehensive regression report
    const reportData = {
      timestamp: new Date().toISOString(),
      baselines: currentBaselines,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cpuCount: require('os').cpus().length,
        totalMemory: Math.round(require('os').totalmem() / (1024 * 1024 * 1024)) + 'GB'
      },
      summary: {
        totalTests: Object.keys(currentBaselines).length,
        regressions: 0,
        improvements: 0
      }
    };

    // Calculate regressions and improvements
    const currentRun = Date.now();
    for (const [testName, baseline] of Object.entries(currentBaselines)) {
      // This is a simplified calculation - in a real scenario, you'd compare with previous baselines
      const isRecent = new Date(baseline.timestamp).getTime() > (currentRun - 60000); // Last minute
      if (isRecent && baseline.measurements.length > 1) {
        const recent = baseline.measurements[baseline.measurements.length - 1];
        const previous = baseline.measurements[baseline.measurements.length - 2];
        const change = ((recent - previous) / previous) * 100;
        
        if (change > regressionThreshold) {
          reportData.summary.regressions++;
        } else if (change < -5) {
          reportData.summary.improvements++;
        }
      }
    }

    // Write the report
    const reportPath = join(process.cwd(), 'reports/performance-regression.json');
    mkdirSync(join(process.cwd(), 'reports'), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

    console.log('📊 Performance regression report generated:', reportPath);
    expect(existsSync(reportPath)).toBe(true);
    expect(reportData.summary.totalTests).toBeGreaterThan(0);
  });
});