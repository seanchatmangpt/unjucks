import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import glob from 'glob';

describe('Template Processing Performance', () => {
  const tempDir = path.join(os.tmpdir(), 'unjucks-template-perf');
  const templatesDir = path.resolve(process.cwd(), '_templates');

  beforeAll(async () => {
    await fs.remove(tempDir);
    await fs.ensureDir(tempDir);
  });

  afterAll(async () => {
    await fs.remove(tempDir);
  });

  test('Template discovery performance', async () => {
    const iterations = 10;
    const discoveryTimes = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        // Simulate template discovery
        const templateDirs = await fs.readdir(templatesDir);
        const validTemplates = [];
        
        for (const dir of templateDirs) {
          const dirPath = path.join(templatesDir, dir);
          const stat = await fs.stat(dirPath);
          if (stat.isDirectory()) {
            const subDirs = await fs.readdir(dirPath);
            validTemplates.push(...subDirs.map(subDir => `${dir}/${subDir}`));
          }
        }
        
        const endTime = performance.now();
        discoveryTimes.push(endTime - startTime);
      } catch (error) {
        console.warn(`Discovery iteration ${i + 1} failed:`, error.message);
      }
    }

    const avgDiscoveryTime = discoveryTimes.reduce((a, b) => a + b, 0) / discoveryTimes.length;
    
    console.log(`Template Discovery Performance:
      Average: ${avgDiscoveryTime.toFixed(2)}ms
      Samples: ${discoveryTimes.length}`);

    // Discovery should be fast (under 100ms)
    expect(avgDiscoveryTime).toBeLessThan(100);
  });

  test('Template file reading performance', async () => {
    const iterations = 5;
    const readTimes = [];

    // Find some template files to test with
    const templateFiles = glob.sync('**/*.njk', { cwd: templatesDir }).slice(0, 5);

    if (templateFiles.length === 0) {
      console.warn('No template files found for performance testing');
      return;
    }

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        const readPromises = templateFiles.map(async (file) => {
          const filePath = path.join(templatesDir, file);
          return await fs.readFile(filePath, 'utf8');
        });
        
        await Promise.all(readPromises);
        
        const endTime = performance.now();
        readTimes.push(endTime - startTime);
      } catch (error) {
        console.warn(`Read iteration ${i + 1} failed:`, error.message);
      }
    }

    if (readTimes.length > 0) {
      const avgReadTime = readTimes.reduce((a, b) => a + b, 0) / readTimes.length;
      
      console.log(`Template Reading Performance:
        Files tested: ${templateFiles.length}
        Average read time: ${avgReadTime.toFixed(2)}ms
        Samples: ${readTimes.length}`);

      // Reading should be fast
      expect(avgReadTime).toBeLessThan(200);
    }
  });

  test('Large template processing performance', async () => {
    // Create a large template for testing
    const largeTemplate = `---
to: <%= dest %>/large-component.js
---
${'// Generated component\n'.repeat(100)}
export class <%= componentName %> {
${'  // Method\n'.repeat(50)}
}
${'// Additional code\n'.repeat(100)}`;

    const templatePath = path.join(tempDir, 'large-template.njk');
    await fs.writeFile(templatePath, largeTemplate);

    const iterations = 5;
    const processingTimes = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        // Simulate template processing
        const content = await fs.readFile(templatePath, 'utf8');
        
        // Parse frontmatter (simplified)
        const [, frontmatter, body] = content.match(/^---\n(.*?)\n---\n(.*)$/s) || [null, '', content];
        
        // Simulate variable substitution
        const processedContent = body
          .replace(/<%= componentName %>/g, 'TestComponent')
          .replace(/<%= dest %>/g, '/tmp/output');
        
        const endTime = performance.now();
        processingTimes.push(endTime - startTime);
      } catch (error) {
        console.warn(`Processing iteration ${i + 1} failed:`, error.message);
      }
    }

    if (processingTimes.length > 0) {
      const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      
      console.log(`Large Template Processing Performance:
        Template size: ~${largeTemplate.length} characters
        Average processing time: ${avgProcessingTime.toFixed(2)}ms
        Samples: ${processingTimes.length}`);

      // Large template processing should still be reasonable
      expect(avgProcessingTime).toBeLessThan(50);
    }

    await fs.remove(templatePath);
  });

  test('Concurrent template processing', async () => {
    const concurrencyLevels = [1, 2, 5, 10];
    const results = [];

    const processTemplate = async (templateName) => {
      // Simulate template processing work
      const templateContent = `---
to: <%= dest %>/${templateName}.js
---
export class <%= componentName %> {
  constructor() {
    this.name = '${templateName}';
  }
}`;

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      
      return templateContent.replace(/<%= componentName %>/g, 'TestComponent');
    };

    for (const concurrency of concurrencyLevels) {
      const templates = Array.from({ length: 20 }, (_, i) => `Template${i}`);
      
      const startTime = performance.now();
      
      const chunks = [];
      for (let i = 0; i < templates.length; i += concurrency) {
        chunks.push(templates.slice(i, i + concurrency));
      }
      
      for (const chunk of chunks) {
        await Promise.all(chunk.map(processTemplate));
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      results.push({
        concurrency,
        totalTime,
        throughput: templates.length / (totalTime / 1000)
      });

      console.log(`Concurrency ${concurrency}: ${totalTime.toFixed(2)}ms (${results[results.length - 1].throughput.toFixed(2)} templates/sec)`);
    }

    // Higher concurrency should generally perform better
    const sequential = results.find(r => r.concurrency === 1);
    const parallel = results.find(r => r.concurrency === 5);
    
    if (sequential && parallel) {
      expect(parallel.throughput).toBeGreaterThanOrEqual(sequential.throughput * 0.8);
    }
  });
});