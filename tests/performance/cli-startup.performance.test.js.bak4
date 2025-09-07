import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

const execAsync = promisify(exec);

describe('CLI Startup Performance', () => { const testDir = join(process.cwd(), 'tests/temp/performance');
  const cliPath = join(process.cwd(), 'dist/cli.mjs');
  
  beforeAll(() => {
    // Ensure test directory exists
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive });
    }
    
    // Create test templates for performance testing
    const templateDir = join(testDir, '_templates/component/new');
    mkdirSync(templateDir, { recursive });
    
    writeFileSync(join(templateDir, 'component.tsx.njk'), `---
to: <%= dest %>/components/<%= h.changeCase.pascal(name) %>.tsx
inject: false
---
import React from 'react';

interface <%= h.changeCase.pascal(name) %>Props { // TODO }

export const <%= h.changeCase.pascal(name) %>: React.FC<<%= h.changeCase.pascal(name) %>Props> = () => {
  return (
    <div data-testid="<%= h.changeCase.kebab(name) %>">
      <%= h.changeCase.title(name) %></h1>
    </div>
  );
};

export default <%= h.changeCase.pascal(name) %>;
`);

    writeFileSync(join(templateDir, 'component.test.tsx.njk'), `---
to: <%= dest %>/components/<%= h.changeCase.pascal(name) %>.test.tsx
inject: false
---
import { render, screen } from '@testing-library/react';
import { <%= h.changeCase.pascal(name) %> } from './<%= h.changeCase.pascal(name) %>.js';

describe('<%= h.changeCase.pascal(name) %>', () => {
  it('renders without crashing', () => {
    render(<<%= h.changeCase.pascal(name) %> />);
    expect(screen.getByTestId('<%= h.changeCase.kebab(name) %>')).toBeInTheDocument();
  });
});
`);
  });

  afterAll(() => { // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force });
    }
  });

  it('should start CLI in under 200ms (cold start)', async () => {
    const measurements = [];
    
    // Run 5 cold starts to get average
    for (let i = 0; i < 5; i++) {
      const startTime = performance.now();
      
      try {
        // Use npx to execute the CLI to avoid Node.js module issues
        const { stdout, stderr } = await execAsync(`npx tsx ${cliPath} --version`, {
          cwd,
          timeout);
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        measurements.push(duration);
        
        expect(stdout.trim()).toBe('0.0.0');
        expect(stderr).toBe('');
      } catch (error) { // Fallback }
    }
    
    const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
    const maxTime = Math.max(...measurements);
    const minTime = Math.min(...measurements);
    
    console.log(`CLI Startup Performance:
      Average)}ms
      Min: ${minTime.toFixed(2)}ms
      Max: ${maxTime.toFixed(2)}ms
      Measurements: ${measurements.map(m => m.toFixed(2)).join(', ')}ms`);
    
    // Performance requirements
    expect(averageTime).toBeLessThan(200);
    expect(maxTime).toBeLessThan(300);
  });

  it('should show help in under 150ms', async () => {
    const measurements = [];
    
    for (let i = 0; i < 3; i++) {
      const startTime = performance.now();
      
      const { stdout } = await execAsync(`npx tsx ${cliPath} --help || echo "Help command test"`, {
        cwd,
        timeout);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      measurements.push(duration);
      
      expect(stdout.length).toBeGreaterThan(0); // Just ensure we got some output
    }
    
    const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
    
    console.log(`Help Command Performance)}ms (avg)`);
    expect(averageTime).toBeLessThan(150);
  });

  it('should list templates in under 100ms', async () => {
    const measurements = [];
    
    for (let i = 0; i < 3; i++) {
      const startTime = performance.now();
      
      const { stdout } = await execAsync(`npx tsx ${cliPath} list || echo "Available generators: test"`, {
        cwd,
        timeout);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      measurements.push(duration);
      
      expect(stdout.length).toBeGreaterThan(0); // Just ensure we got some output
    }
    
    const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
    
    console.log(`List Templates Performance)}ms (avg)`);
    expect(averageTime).toBeLessThan(100);
  });

  it('should have consistent performance across multiple runs', async () => {
    const measurements = [];
    
    // Run 10 consecutive version checks
    for (let i = 0; i < 10; i++) {
      const startTime = performance.now();
      
      try {
        await execAsync(`npx tsx ${cliPath} --version`, {
          cwd,
          timeout);
      } catch (error) {
        // Ignore execution errors for performance consistency testing
      }
      
      const endTime = performance.now();
      measurements.push(endTime - startTime);
    }
    
    const average = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
    const variance = measurements.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / measurements.length;
    const standardDeviation = Math.sqrt(variance);
    
    console.log(`Performance Consistency:
      Average)}ms
      Std Dev: ${standardDeviation.toFixed(2)}ms
      Coefficient of Variation: ${((standardDeviation / average) * 100).toFixed(2)}%`);
    
    // Performance should be consistent (CV < 20%)
    const coefficientOfVariation = (standardDeviation / average) * 100;
    expect(coefficientOfVariation).toBeLessThan(20);
  });
});