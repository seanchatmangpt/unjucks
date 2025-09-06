import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

const execAsync = promisify(exec);

describe('Template Generation Performance', () => {
  const testDir = join(process.cwd(), 'tests/temp/generation-perf');
  const cliPath = join(process.cwd(), 'dist/cli.mjs');
  
  beforeAll(() => {
    // Setup test environment
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    
    // Create various template types for performance testing
    setupTemplates();
  });

  afterAll(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  function setupTemplates() {
    // Simple component template
    const simpleDir = join(testDir, '_templates/component/simple');
    mkdirSync(simpleDir, { recursive: true });
    writeFileSync(join(simpleDir, 'component.tsx.njk'), `---
to: src/components/<%= name %>.tsx
---
export const <%= name %> = () => <div><%= name %></div>;
`);

    // Complex component template with multiple files
    const complexDir = join(testDir, '_templates/component/complex');
    mkdirSync(complexDir, { recursive: true });
    
    writeFileSync(join(complexDir, 'component.tsx.njk'), `---
to: src/components/<%= h.changeCase.pascal(name) %>/<%= h.changeCase.pascal(name) %>.tsx
---
import React from 'react';
import { styled } from 'styled-components';
import { <%= h.changeCase.pascal(name) %>Props } from './types';

const Styled<%= h.changeCase.pascal(name) %> = styled.div\`
  display: flex;
  flex-direction: column;
  padding: 1rem;
  background: #f0f0f0;
\`;

export const <%= h.changeCase.pascal(name) %>: React.FC<<%= h.changeCase.pascal(name) %>Props> = ({ 
  title = "<%= h.changeCase.title(name) %>",
  description,
  isActive = false,
  children,
  ...props 
}) => {
  return (
    <Styled<%= h.changeCase.pascal(name) %> {...props}>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {isActive && <div>Active</div>}
      {children}
    </Styled<%= h.changeCase.pascal(name) %>>
  );
};
`);

    writeFileSync(join(complexDir, 'types.ts.njk'), `---
to: src/components/<%= h.changeCase.pascal(name) %>/types.ts
---
import { ReactNode } from 'react';

export interface <%= h.changeCase.pascal(name) %>Props {
  title?: string;
  description?: string;
  isActive?: boolean;
  children?: ReactNode;
  className?: string;
}
`);

    writeFileSync(join(complexDir, 'index.ts.njk'), `---
to: src/components/<%= h.changeCase.pascal(name) %>/index.ts
---
export { <%= h.changeCase.pascal(name) %> } from './<%= h.changeCase.pascal(name) %>';
export type { <%= h.changeCase.pascal(name) %>Props } from './types';
`);

    // Large template with iterations
    const largeDir = join(testDir, '_templates/api/full');
    mkdirSync(largeDir, { recursive: true });
    
    writeFileSync(join(largeDir, 'api.ts.njk'), `---
to: src/api/<%= h.changeCase.kebab(name) %>.api.ts
---
import { ApiResponse, ApiError } from './types';

{% for method in ['get', 'post', 'put', 'delete'] %}
export const <%= method %><%= h.changeCase.pascal(name) %> = async (
  {% if method !== 'get' %}data?: any{% endif %}
): Promise<ApiResponse<<%= h.changeCase.pascal(name) %>>> => {
  try {
    const response = await fetch('/api/<%= h.changeCase.kebab(name) %>', {
      method: '{{ method | upper }}',
      {% if method !== 'get' %}
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      {% endif %}
    });
    
    if (!response.ok) {
      throw new ApiError(response.statusText);
    }
    
    return await response.json();
  } catch (error) {
    throw new ApiError('Network error');
  }
};

{% endfor %}
`);
  }

  it('should generate simple template in under 50ms', async () => {
    const measurements: number[] = [];
    
    for (let i = 0; i < 5; i++) {
      const outputDir = join(testDir, `output-simple-${i}`);
      mkdirSync(outputDir, { recursive: true });
      
      const startTime = performance.now();
      
      await execAsync(`node ${cliPath} generate component simple --name TestComponent --dest ${outputDir}`, {
        cwd: testDir,
        timeout: 5000
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      measurements.push(duration);
      
      // Verify file was created
      const generatedFile = join(outputDir, 'src/components/TestComponent.tsx');
      expect(existsSync(generatedFile)).toBe(true);
      
      const content = readFileSync(generatedFile, 'utf-8');
      expect(content).toContain('export const TestComponent');
    }
    
    const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
    console.log(`Simple Template Generation: ${averageTime.toFixed(2)}ms (avg)`);
    
    expect(averageTime).toBeLessThan(50);
  });

  it('should generate complex multi-file template in under 100ms', async () => {
    const measurements: number[] = [];
    
    for (let i = 0; i < 3; i++) {
      const outputDir = join(testDir, `output-complex-${i}`);
      mkdirSync(outputDir, { recursive: true });
      
      const startTime = performance.now();
      
      await execAsync(`node ${cliPath} generate component complex --name UserProfile --dest ${outputDir}`, {
        cwd: testDir,
        timeout: 10000
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      measurements.push(duration);
      
      // Verify all files were created
      const componentDir = join(outputDir, 'src/components/UserProfile');
      expect(existsSync(join(componentDir, 'UserProfile.tsx'))).toBe(true);
      expect(existsSync(join(componentDir, 'types.ts'))).toBe(true);
      expect(existsSync(join(componentDir, 'index.ts'))).toBe(true);
    }
    
    const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
    console.log(`Complex Template Generation: ${averageTime.toFixed(2)}ms (avg)`);
    
    expect(averageTime).toBeLessThan(100);
  });

  it('should handle large templates with iterations efficiently', async () => {
    const outputDir = join(testDir, 'output-large');
    mkdirSync(outputDir, { recursive: true });
    
    const startTime = performance.now();
    
    await execAsync(`node ${cliPath} generate api full --name ProductService --dest ${outputDir}`, {
      cwd: testDir,
      timeout: 15000
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`Large Template with Iterations: ${duration.toFixed(2)}ms`);
    
    // Verify generated content
    const apiFile = join(outputDir, 'src/api/product-service.api.ts');
    expect(existsSync(apiFile)).toBe(true);
    
    const content = readFileSync(apiFile, 'utf-8');
    expect(content).toContain('getProductService');
    expect(content).toContain('postProductService');
    expect(content).toContain('putProductService');
    expect(content).toContain('deleteProductService');
    
    // Should complete within reasonable time
    expect(duration).toBeLessThan(200);
  });

  it('should scale linearly with number of files', async () => {
    const measurements: { fileCount: number, duration: number }[] = [];
    
    // Test with 1, 5, 10 files
    for (const count of [1, 5, 10]) {
      const outputDir = join(testDir, `output-scale-${count}`);
      mkdirSync(outputDir, { recursive: true });
      
      const startTime = performance.now();
      
      // Generate multiple simple components
      const promises = [];
      for (let i = 0; i < count; i++) {
        promises.push(
          execAsync(`node ${cliPath} generate component simple --name Component${i} --dest ${outputDir}`, {
            cwd: testDir,
            timeout: 10000
          })
        );
      }
      
      await Promise.all(promises);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      measurements.push({ fileCount: count, duration });
      
      // Verify all files were created
      const componentsDir = join(outputDir, 'src/components');
      const files = readdirSync(componentsDir);
      expect(files).toHaveLength(count);
    }
    
    console.log('Scaling Performance:');
    measurements.forEach(({ fileCount, duration }) => {
      const perFileTime = duration / fileCount;
      console.log(`  ${fileCount} files: ${duration.toFixed(2)}ms total, ${perFileTime.toFixed(2)}ms per file`);
    });
    
    // Performance should scale reasonably (not exponentially)
    const perFileTime1 = measurements[0].duration / measurements[0].fileCount;
    const perFileTime10 = measurements[2].duration / measurements[2].fileCount;
    
    // Per-file time shouldn't increase dramatically
    expect(perFileTime10).toBeLessThan(perFileTime1 * 2);
  });

  it('should maintain consistent performance under load', async () => {
    const measurements: number[] = [];
    
    // Run 20 consecutive generations
    for (let i = 0; i < 20; i++) {
      const outputDir = join(testDir, `output-load-${i}`);
      mkdirSync(outputDir, { recursive: true });
      
      const startTime = performance.now();
      
      await execAsync(`node ${cliPath} generate component simple --name LoadTest${i} --dest ${outputDir}`, {
        cwd: testDir,
        timeout: 5000
      });
      
      const endTime = performance.now();
      measurements.push(endTime - startTime);
    }
    
    const average = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
    const variance = measurements.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / measurements.length;
    const stdDev = Math.sqrt(variance);
    
    console.log(`Load Test Performance:
      Average: ${average.toFixed(2)}ms
      Std Dev: ${stdDev.toFixed(2)}ms
      Min: ${Math.min(...measurements).toFixed(2)}ms
      Max: ${Math.max(...measurements).toFixed(2)}ms`);
    
    // Performance should remain consistent
    const coefficientOfVariation = (stdDev / average) * 100;
    expect(coefficientOfVariation).toBeLessThan(30); // Less than 30% variation
    expect(average).toBeLessThan(100); // Average should still be fast
  });

  it('should optimize memory usage during generation', async () => {
    const outputDir = join(testDir, 'output-memory');
    mkdirSync(outputDir, { recursive: true });
    
    // Monitor memory before
    const memBefore = process.memoryUsage();
    
    // Generate multiple files to test memory usage
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(
        execAsync(`node ${cliPath} generate component simple --name MemTest${i} --dest ${outputDir}`, {
          cwd: testDir,
          timeout: 15000
        })
      );
    }
    
    await Promise.all(promises);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const memAfter = process.memoryUsage();
    
    const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;
    const memoryMB = memoryIncrease / (1024 * 1024);
    
    console.log(`Memory Usage:
      Before: ${(memBefore.heapUsed / 1024 / 1024).toFixed(2)}MB
      After: ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)}MB
      Increase: ${memoryMB.toFixed(2)}MB`);
    
    // Memory increase should be reasonable (< 100MB for 50 files)
    expect(memoryMB).toBeLessThan(100);
    
    // Verify all files were created
    const componentsDir = join(outputDir, 'src/components');
    const files = readdirSync(componentsDir);
    expect(files).toHaveLength(50);
  });
});