import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

const execAsync = promisify(exec);

describe('Load Testing Performance', () => {
  const testDir = join(process.cwd(), 'tests/temp/load-testing');
  const cliPath = join(process.cwd(), 'dist/cli.mjs');
  
  beforeAll(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    setupLoadTestTemplates();
  });

  afterAll(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  function setupLoadTestTemplates() {
    // Stress test template with many variables and conditionals
    const stressDir = join(testDir, '_templates/stress/test');
    mkdirSync(stressDir, { recursive: true });
    
    writeFileSync(join(stressDir, 'stress.ts.njk'), `---
to: src/stress/<%= h.changeCase.kebab(name) %>.ts
---
// Generated stress test file for <%= name %>
import { Logger } from './logger';

{% set features = ['auth', 'validation', 'caching', 'logging', 'metrics', 'security'] %}
{% set methods = ['get', 'post', 'put', 'patch', 'delete'] %}

export class <%= h.changeCase.pascal(name) %>Service {
  private logger = new Logger('<%= h.changeCase.pascal(name) %>Service');

  {% for feature in features %}
  {% if feature === 'auth' %}
  private async authenticate(token: string): Promise<boolean> {
    this.logger.info('Authenticating user');
    // Complex authentication logic
    return token.length > 10;
  }
  {% elif feature === 'validation' %}
  private validate(data: any): boolean {
    this.logger.info('Validating data');
    return data && typeof data === 'object';
  }
  {% elif feature === 'caching' %}
  private cache = new Map<string, any>();
  
  private getCached(key: string): any {
    return this.cache.get(key);
  }
  
  private setCache(key: string, value: any): void {
    this.cache.set(key, value);
  }
  {% elif feature === 'logging' %}
  private log(level: string, message: string): void {
    this.logger[level](message);
  }
  {% elif feature === 'metrics' %}
  private metrics = {
    requests: 0,
    errors: 0,
    responseTime: 0
  };
  
  private updateMetrics(responseTime: number, isError = false): void {
    this.metrics.requests++;
    this.metrics.responseTime = responseTime;
    if (isError) this.metrics.errors++;
  }
  {% elif feature === 'security' %}
  private sanitize(input: string): string {
    return input.replace(/[<>\"']/g, '');
  }
  {% endif %}
  {% endfor %}

  {% for method in methods %}
  public async <%= method %>Data(
    {% if method === 'get' %}id: string{% else %}data: any{% endif %}
  ): Promise<any> {
    const startTime = performance.now();
    
    try {
      // Feature usage
      {% for feature in features %}
      {% if feature === 'auth' %}
      const isAuth = await this.authenticate('sample-token');
      if (!isAuth) throw new Error('Unauthorized');
      {% elif feature === 'validation' %}
      {% if method !== 'get' %}
      if (!this.validate(data)) throw new Error('Invalid data');
      {% endif %}
      {% elif feature === 'caching' %}
      const cacheKey = '<%= method %>_' + ({% if method === 'get' %}id{% else %}JSON.stringify(data){% endif %});
      const cached = this.getCached(cacheKey);
      if (cached) return cached;
      {% elif feature === 'logging' %}
      this.log('info', 'Processing <%= method %> request');
      {% elif feature === 'security' %}
      {% if method !== 'get' %}
      data = Object.keys(data).reduce((acc, key) => {
        acc[key] = typeof data[key] === 'string' ? this.sanitize(data[key]) : data[key];
        return acc;
      }, {} as any);
      {% endif %}
      {% endif %}
      {% endfor %}
      
      // Simulate processing
      const result = {
        method: '<%= method %>',
        {% if method === 'get' %}id{% else %}data{% endif %},
        timestamp: new Date().toISOString(),
        processed: true
      };
      
      {% if 'caching' in features %}
      this.setCache(cacheKey, result);
      {% endif %}
      
      const endTime = performance.now();
      this.updateMetrics(endTime - startTime);
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      this.updateMetrics(endTime - startTime, true);
      throw error;
    }
  }
  {% endfor %}

  public getMetrics() {
    return { ...this.metrics };
  }
}
`);

    // High iteration template
    const iterationDir = join(testDir, '_templates/iteration/test');
    mkdirSync(iterationDir, { recursive: true });
    
    writeFileSync(join(iterationDir, 'iteration.ts.njk'), `---
to: src/iteration/<%= h.changeCase.kebab(name) %>.ts
---
// Large iteration test for <%= name %>
{% set itemCount = itemCount or 1000 %}

export const <%= h.changeCase.camel(name) %>Data = {
  {% for i in range(0, itemCount) %}
  item{{ i }}: {
    id: '{{ i }}',
    name: 'Item {{ i }}',
    value: {{ i * 10 }},
    active: {{ 'true' if i % 2 == 0 else 'false' }},
    metadata: {
      created: '{{ "now" | date }}',
      index: {{ i }},
      group: '{{ "group" + (i // 100) | string }}'
    }
  }{% if not loop.last %},{% endif %}
  {% endfor %}
};

export const process<%= h.changeCase.pascal(name) %> = () => {
  const items = Object.values(<%= h.changeCase.camel(name) %>Data);
  
  return {
    total: items.length,
    active: items.filter(item => item.active).length,
    inactive: items.filter(item => !item.active).length,
    groups: items.reduce((acc, item) => {
      const group = item.metadata.group;
      acc[group] = (acc[group] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    totalValue: items.reduce((sum, item) => sum + item.value, 0)
  };
};
`);
  }

  it('should handle high concurrency without performance degradation', async () => {
    const concurrency = 10;
    const measurements: number[] = [];
    
    // Test concurrent template generations
    const promises = [];
    
    for (let i = 0; i < concurrency; i++) {
      const outputDir = join(testDir, `output-concurrent-${i}`);
      mkdirSync(outputDir, { recursive: true });
      
      const promise = (async () => {
        const startTime = performance.now();
        
        await execAsync(`node ${cliPath} generate stress test --name Service${i} --dest ${outputDir}`, {
          cwd: testDir,
          timeout: 30000
        });
        
        const endTime = performance.now();
        return endTime - startTime;
      })();
      
      promises.push(promise);
    }
    
    const results = await Promise.all(promises);
    measurements.push(...results);
    
    const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
    const maxTime = Math.max(...measurements);
    const minTime = Math.min(...measurements);
    
    console.log(`Concurrency Test (${concurrency} parallel):
      Average: ${averageTime.toFixed(2)}ms
      Min: ${minTime.toFixed(2)}ms
      Max: ${maxTime.toFixed(2)}ms
      Range: ${(maxTime - minTime).toFixed(2)}ms`);
    
    // Verify all files were created
    for (let i = 0; i < concurrency; i++) {
      const outputDir = join(testDir, `output-concurrent-${i}`);
      const generatedFile = join(outputDir, `src/stress/service-${i}.ts`);
      expect(existsSync(generatedFile)).toBe(true);
      
      const content = readFileSync(generatedFile, 'utf-8');
      expect(content).toContain(`Service${i}Service`);
    }
    
    // Performance requirements
    expect(averageTime).toBeLessThan(2000); // 2 second average for complex templates
    expect(maxTime).toBeLessThan(4000); // 4 second max
  });

  it('should efficiently handle large iteration templates', async () => {
    const testCases = [
      { itemCount: 100, maxTime: 500 },
      { itemCount: 1000, maxTime: 2000 },
      { itemCount: 5000, maxTime: 8000 }
    ];
    
    for (const { itemCount, maxTime } of testCases) {
      const outputDir = join(testDir, `output-iteration-${itemCount}`);
      mkdirSync(outputDir, { recursive: true });
      
      const startTime = performance.now();
      
      await execAsync(`node ${cliPath} generate iteration test --name DataSet${itemCount} --itemCount ${itemCount} --dest ${outputDir}`, {
        cwd: testDir,
        timeout: 30000
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`Iteration Test (${itemCount} items): ${duration.toFixed(2)}ms`);
      
      // Verify file was created and has correct content
      const generatedFile = join(outputDir, `src/iteration/data-set-${itemCount}.ts`);
      expect(existsSync(generatedFile)).toBe(true);
      
      const content = readFileSync(generatedFile, 'utf-8');
      expect(content).toContain(`item${itemCount - 1}:`); // Should contain last item
      expect(content).toContain(`processDataSet${itemCount}`);
      
      // Check file size is reasonable
      const fileSize = content.length;
      const expectedSize = itemCount * 200; // Roughly 200 chars per item
      expect(fileSize).toBeGreaterThan(expectedSize * 0.8); // At least 80% of expected
      expect(fileSize).toBeLessThan(expectedSize * 2); // Not more than 2x expected
      
      expect(duration).toBeLessThan(maxTime);
    }
  });

  it('should maintain performance under sustained load', async () => {
    const loadDuration = 30000; // 30 seconds
    const interval = 1000; // 1 second between requests
    const measurements: number[] = [];
    
    console.log('Starting sustained load test for 30 seconds...');
    
    const startTime = performance.now();
    let requestCount = 0;
    
    while (performance.now() - startTime < loadDuration) {
      const outputDir = join(testDir, `output-sustained-${requestCount}`);
      mkdirSync(outputDir, { recursive: true });
      
      const reqStartTime = performance.now();
      
      try {
        await execAsync(`node ${cliPath} generate stress test --name Sustained${requestCount} --dest ${outputDir}`, {
          cwd: testDir,
          timeout: 10000
        });
        
        const reqEndTime = performance.now();
        const reqDuration = reqEndTime - reqStartTime;
        measurements.push(reqDuration);
        
        requestCount++;
        
        // Wait before next request
        if (performance.now() - startTime < loadDuration) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      } catch (error) {
        console.error(`Request ${requestCount} failed:`, error);
        break;
      }
    }
    
    const totalTime = performance.now() - startTime;
    const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
    const throughput = (requestCount / totalTime) * 1000; // requests per second
    
    console.log(`Sustained Load Test Results:
      Duration: ${(totalTime / 1000).toFixed(2)}s
      Requests: ${requestCount}
      Average Response: ${averageTime.toFixed(2)}ms
      Throughput: ${throughput.toFixed(2)} req/s
      Min: ${Math.min(...measurements).toFixed(2)}ms
      Max: ${Math.max(...measurements).toFixed(2)}ms`);
    
    expect(requestCount).toBeGreaterThan(20); // Should complete at least 20 requests
    expect(averageTime).toBeLessThan(5000); // Average should stay reasonable
    expect(throughput).toBeGreaterThan(0.5); // At least 0.5 requests per second
    
    // Verify no performance degradation over time
    const firstHalf = measurements.slice(0, Math.floor(measurements.length / 2));
    const secondHalf = measurements.slice(Math.floor(measurements.length / 2));
    
    if (firstHalf.length > 0 && secondHalf.length > 0) {
      const firstAvg = firstHalf.reduce((sum, time) => sum + time, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, time) => sum + time, 0) / secondHalf.length;
      
      const degradation = ((secondAvg - firstAvg) / firstAvg) * 100;
      console.log(`Performance change: ${degradation.toFixed(2)}%`);
      
      // Performance shouldn't degrade by more than 50%
      expect(degradation).toBeLessThan(50);
    }
  });

  it('should handle error recovery efficiently', async () => {
    const measurements: { success: number, error: number }[] = [];
    
    // Create a template that will cause errors
    const errorDir = join(testDir, '_templates/error/test');
    mkdirSync(errorDir, { recursive: true });
    
    writeFileSync(join(errorDir, 'error.ts.njk'), `---
to: <%= invalidVariable %>/error.ts
---
This will fail due to undefined variable
`);
    
    // Mix successful and failing requests
    const testSequence = [
      { template: 'stress test', name: 'Success1', shouldSucceed: true },
      { template: 'error test', name: 'Error1', shouldSucceed: false },
      { template: 'stress test', name: 'Success2', shouldSucceed: true },
      { template: 'error test', name: 'Error2', shouldSucceed: false },
      { template: 'stress test', name: 'Success3', shouldSucceed: true }
    ];
    
    for (const { template, name, shouldSucceed } of testSequence) {
      const outputDir = join(testDir, `output-recovery-${name.toLowerCase()}`);
      if (shouldSucceed) {
        mkdirSync(outputDir, { recursive: true });
      }
      
      const startTime = performance.now();
      
      try {
        await execAsync(`node ${cliPath} generate ${template} --name ${name} --dest ${outputDir || testDir}`, {
          cwd: testDir,
          timeout: 10000
        });
        
        const endTime = performance.now();
        
        if (shouldSucceed) {
          measurements.push({ success: endTime - startTime, error: 0 });
        } else {
          // If this succeeds when it shouldn't, it's unexpected
          console.warn(`Expected error for ${name} but command succeeded`);
        }
      } catch (error) {
        const endTime = performance.now();
        
        if (!shouldSucceed) {
          measurements.push({ success: 0, error: endTime - startTime });
        } else {
          console.error(`Unexpected error for ${name}:`, error);
          throw error;
        }
      }
    }
    
    const successTimes = measurements.filter(m => m.success > 0).map(m => m.success);
    const errorTimes = measurements.filter(m => m.error > 0).map(m => m.error);
    
    console.log('Error Recovery Performance:');
    if (successTimes.length > 0) {
      const avgSuccess = successTimes.reduce((sum, time) => sum + time, 0) / successTimes.length;
      console.log(`  Success average: ${avgSuccess.toFixed(2)}ms`);
      expect(avgSuccess).toBeLessThan(2000); // Success should be fast
    }
    
    if (errorTimes.length > 0) {
      const avgError = errorTimes.reduce((sum, time) => sum + time, 0) / errorTimes.length;
      console.log(`  Error detection average: ${avgError.toFixed(2)}ms`);
      expect(avgError).toBeLessThan(1000); // Error detection should be fast
    }
    
    // Verify that successful requests still work after errors
    expect(successTimes.length).toBeGreaterThan(0);
    expect(errorTimes.length).toBeGreaterThan(0);
  });
});