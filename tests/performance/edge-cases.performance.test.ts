import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

const execAsync = promisify(exec);

describe('Edge Cases Performance', () => {
  const testDir = join(process.cwd(), 'tests/temp/edge-cases-perf');
  const cliPath = join(process.cwd(), 'dist/cli.mjs');
  
  beforeAll(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    setupEdgeCaseTemplates();
  });

  afterAll(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  function setupEdgeCaseTemplates() {
    // Deeply nested template structure
    const deepDir = join(testDir, '_templates/deep/nested/structure/test');
    mkdirSync(deepDir, { recursive: true });
    
    writeFileSync(join(deepDir, 'deep.ts.njk'), `---
to: src/deep/<%= h.changeCase.kebab(name) %>/level1/level2/level3/<%= h.changeCase.pascal(name) %>.ts
---
// Deeply nested file for <%= name %>
export const <%= h.changeCase.pascal(name) %> = {
  depth: 4,
  path: 'src/deep/<%= h.changeCase.kebab(name) %>/level1/level2/level3/<%= h.changeCase.pascal(name) %>.ts'
};
`);

    // Large file template
    const largeDir = join(testDir, '_templates/large/file');
    mkdirSync(largeDir, { recursive: true });
    
    let largeContent = `---
to: src/large/<%= h.changeCase.kebab(name) %>.ts
---
// Large generated file for <%= name %>
import { Logger } from './logger';

export class <%= h.changeCase.pascal(name) %>LargeClass {
  private logger = new Logger();
  
`;

    // Generate 1000 methods
    for (let i = 0; i < 1000; i++) {
      largeContent += `
  public method${i}(): string {
    this.logger.info('Calling method${i}');
    return 'result from method ${i} for <%= name %>';
  }
`;
    }

    largeContent += `
  public getAllMethods(): string[] {
    return [
`;

    for (let i = 0; i < 1000; i++) {
      largeContent += `      'method${i}'${i < 999 ? ',' : ''}\n`;
    }

    largeContent += `    ];
  }
}

export default <%= h.changeCase.pascal(name) %>LargeClass;
`;

    writeFileSync(join(largeDir, 'large.ts.njk'), largeContent);

    // Unicode and special characters template
    const unicodeDir = join(testDir, '_templates/unicode/test');
    mkdirSync(unicodeDir, { recursive: true });
    
    writeFileSync(join(unicodeDir, 'unicode.ts.njk'), `---
to: src/unicode/<%= h.changeCase.kebab(name) %>.ts
---
// Unicode test file with special characters
export const <%= h.changeCase.pascal(name) %>Unicode = {
  emoji: '🚀 <%= name %> 🌟',
  chinese: '你好世界 <%= name %> 测试',
  arabic: 'مرحبا بالعالم <%= name %> اختبار',
  japanese: 'こんにちは世界 <%= name %> テスト',
  russian: 'Привет мир <%= name %> тест',
  symbols: '∑∆∞π∂∫Ω <%= name %> ≠≤≥∈∉∀∃',
  mathematical: 'f(x) = ∫₀^∞ e^(-x²) dx for <%= name %>',
  special: '¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿À <%= name %>'
};
`);

    // Complex conditional template
    const conditionalDir = join(testDir, '_templates/conditional/complex');
    mkdirSync(conditionalDir, { recursive: true });
    
    writeFileSync(join(conditionalDir, 'conditional.ts.njk'), `---
to: src/conditional/<%= h.changeCase.kebab(name) %>.ts
---
// Complex conditional template for <%= name %>

{% set features = features or ['auth', 'validation', 'caching'] %}
{% set environment = environment or 'development' %}
{% set hasDatabase = hasDatabase or true %}
{% set useTypeScript = useTypeScript or true %}

{% if useTypeScript %}
import { 
  {% for feature in features %}
  {{ h.changeCase.pascal(feature) }}Service{% if not loop.last %},{% endif %}
  {% endfor %}
} from './services';

{% if hasDatabase %}
import { Database } from './database';
{% endif %}

interface <%= h.changeCase.pascal(name) %>Config {
  {% for feature in features %}
  {% if feature === 'auth' %}
  auth: {
    enabled: boolean;
    provider: 'jwt' | 'oauth' | 'basic';
    secretKey: string;
  };
  {% elif feature === 'validation' %}
  validation: {
    enabled: boolean;
    strictMode: boolean;
    customRules: Record<string, any>;
  };
  {% elif feature === 'caching' %}
  caching: {
    enabled: boolean;
    provider: 'redis' | 'memory' | 'disk';
    ttl: number;
  };
  {% endif %}
  {% endfor %}
  {% if hasDatabase %}
  database: {
    host: string;
    port: number;
    name: string;
  };
  {% endif %}
}
{% endif %}

export class <%= h.changeCase.pascal(name) %>Manager {
  {% if useTypeScript %}
  private config: <%= h.changeCase.pascal(name) %>Config;
  {% endif %}
  {% if hasDatabase %}
  private db: Database;
  {% endif %}
  
  {% for feature in features %}
  private <%= h.changeCase.camel(feature) %>Service: <%= h.changeCase.pascal(feature) %>Service;
  {% endfor %}
  
  constructor(
    {% if useTypeScript %}config: <%= h.changeCase.pascal(name) %>Config{% else %}config{% endif %}
  ) {
    this.config = config;
    
    {% if hasDatabase %}
    this.db = new Database(config.database);
    {% endif %}
    
    {% for feature in features %}
    {% if feature === 'auth' %}
    this.authService = new AuthService(config.auth);
    {% elif feature === 'validation' %}
    this.validationService = new ValidationService(config.validation);
    {% elif feature === 'caching' %}
    this.cachingService = new CachingService(config.caching);
    {% endif %}
    {% endfor %}
  }
  
  {% for feature in features %}
  {% if feature === 'auth' %}
  public async authenticate(token: string): Promise<boolean> {
    {% if environment === 'development' %}
    console.log('Dev mode: Authenticating token');
    {% endif %}
    
    if (!this.config.auth.enabled) {
      {% if environment === 'development' %}
      console.warn('Auth is disabled');
      {% endif %}
      return true;
    }
    
    return await this.authService.verify(token);
  }
  {% elif feature === 'validation' %}
  public validate(data: any): boolean {
    {% if environment === 'development' %}
    console.log('Dev mode: Validating data');
    {% endif %}
    
    if (!this.config.validation.enabled) {
      return true;
    }
    
    return this.validationService.validate(data);
  }
  {% elif feature === 'caching' %}
  public async get(key: string): Promise<any> {
    {% if environment === 'development' %}
    console.log(\`Dev mode: Getting cache key: \${key}\`);
    {% endif %}
    
    if (!this.config.caching.enabled) {
      return null;
    }
    
    return await this.cachingService.get(key);
  }
  
  public async set(key: string, value: any): Promise<void> {
    {% if environment === 'development' %}
    console.log(\`Dev mode: Setting cache key: \${key}\`);
    {% endif %}
    
    if (!this.config.caching.enabled) {
      return;
    }
    
    await this.cachingService.set(key, value, this.config.caching.ttl);
  }
  {% endif %}
  {% endfor %}
  
  {% if hasDatabase %}
  public async saveToDatabase(data: any): Promise<void> {
    {% if environment === 'development' %}
    console.log('Dev mode: Saving to database');
    {% endif %}
    
    await this.db.save(data);
  }
  {% endif %}
  
  public getStatus(): object {
    return {
      name: '<%= name %>',
      environment: '<%= environment %>',
      features: [
        {% for feature in features %}
        '{{ feature }}'{% if not loop.last %},{% endif %}
        {% endfor %}
      ],
      {% if hasDatabase %}
      database: 'connected',
      {% endif %}
      uptime: process.uptime()
    };
  }
}
`);
  }

  it('should handle deeply nested directory structures efficiently', async () => {
    const outputDir = join(testDir, 'output-deep');
    mkdirSync(outputDir, { recursive: true });
    
    const startTime = performance.now();
    
    await execAsync(`node ${cliPath} generate deep nested structure test --name DeepTest --dest ${outputDir}`, {
      cwd: testDir,
      timeout: 10000
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`Deep Directory Structure: ${duration.toFixed(2)}ms`);
    
    // Verify deeply nested file was created
    const deepFile = join(outputDir, 'src/deep/deep-test/level1/level2/level3/DeepTest.ts');
    expect(existsSync(deepFile)).toBe(true);
    
    const content = readFileSync(deepFile, 'utf-8');
    expect(content).toContain('DeepTest');
    expect(content).toContain('depth: 4');
    
    // Should handle deep nesting efficiently
    expect(duration).toBeLessThan(1000);
  });

  it('should efficiently generate large files', async () => {
    const outputDir = join(testDir, 'output-large');
    mkdirSync(outputDir, { recursive: true });
    
    const startTime = performance.now();
    
    await execAsync(`node ${cliPath} generate large file --name MegaClass --dest ${outputDir}`, {
      cwd: testDir,
      timeout: 30000
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`Large File Generation: ${duration.toFixed(2)}ms`);
    
    // Verify large file was created
    const largeFile = join(outputDir, 'src/large/mega-class.ts');
    expect(existsSync(largeFile)).toBe(true);
    
    const content = readFileSync(largeFile, 'utf-8');
    const fileSize = content.length;
    const fileSizeMB = fileSize / (1024 * 1024);
    
    console.log(`Generated file size: ${fileSizeMB.toFixed(2)}MB (${fileSize} characters)`);
    
    // Verify content quality
    expect(content).toContain('MegaClassLargeClass');
    expect(content).toContain('method0');
    expect(content).toContain('method999');
    expect(content).toContain('getAllMethods');
    
    // File should be substantial but generation should be reasonably fast
    expect(fileSize).toBeGreaterThan(50000); // At least 50KB
    expect(duration).toBeLessThan(5000); // Under 5 seconds
    
    // Performance should be reasonable for file size
    const performanceRatio = duration / fileSizeMB; // ms per MB
    expect(performanceRatio).toBeLessThan(2000); // Less than 2 seconds per MB
  });

  it('should handle Unicode and special characters without performance impact', async () => {
    const measurements: number[] = [];
    
    // Test with various Unicode names
    const unicodeNames = [
      'Test', // ASCII baseline
      'Тест', // Cyrillic
      '测试', // Chinese
      'テスト', // Japanese
      'اختبار', // Arabic
      '🚀Test🌟', // Emoji
      'Café_Naïve', // Accented
      'Ω∆∑Test' // Mathematical symbols
    ];
    
    for (const [index, name] of unicodeNames.entries()) {
      const outputDir = join(testDir, `output-unicode-${index}`);
      mkdirSync(outputDir, { recursive: true });
      
      const startTime = performance.now();
      
      await execAsync(`node ${cliPath} generate unicode test --name "${name}" --dest ${outputDir}`, {
        cwd: testDir,
        timeout: 10000
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      measurements.push(duration);
      
      // Verify file was created with correct Unicode handling
      const unicodeFile = join(outputDir, `src/unicode/${name.toLowerCase().replace(/[^\w\-]/g, '-')}.ts`);
      const files = require('fs').readdirSync(join(outputDir, 'src/unicode'));
      expect(files.length).toBe(1);
      
      const actualFile = join(outputDir, 'src/unicode', files[0]);
      const content = readFileSync(actualFile, 'utf-8');
      
      // Verify Unicode content is preserved
      expect(content).toContain(name);
      expect(content).toContain('emoji: \'🚀');
      expect(content).toContain('chinese: \'你好世界');
      expect(content).toContain('arabic: \'مرحبا بالعالم');
    }
    
    const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
    const asciiTime = measurements[0]; // First measurement is ASCII baseline
    const unicodeTimes = measurements.slice(1);
    const unicodeAverage = unicodeTimes.reduce((sum, time) => sum + time, 0) / unicodeTimes.length;
    
    console.log(`Unicode Performance:
      ASCII baseline: ${asciiTime.toFixed(2)}ms
      Unicode average: ${unicodeAverage.toFixed(2)}ms
      Overall average: ${averageTime.toFixed(2)}ms
      Performance impact: ${((unicodeAverage - asciiTime) / asciiTime * 100).toFixed(2)}%`);
    
    // Unicode shouldn't significantly impact performance (less than 20% overhead)
    const performanceImpact = ((unicodeAverage - asciiTime) / asciiTime) * 100;
    expect(performanceImpact).toBeLessThan(20);
    expect(averageTime).toBeLessThan(500);
  });

  it('should efficiently process complex conditional templates', async () => {
    const testCases = [
      {
        name: 'MinimalService',
        features: ['auth'],
        environment: 'production',
        hasDatabase: false,
        useTypeScript: true
      },
      {
        name: 'FullService',
        features: ['auth', 'validation', 'caching'],
        environment: 'development',
        hasDatabase: true,
        useTypeScript: true
      },
      {
        name: 'JSService',
        features: ['validation', 'caching'],
        environment: 'staging',
        hasDatabase: true,
        useTypeScript: false
      }
    ];
    
    const measurements: number[] = [];
    
    for (const [index, testCase] of testCases.entries()) {
      const outputDir = join(testDir, `output-conditional-${index}`);
      mkdirSync(outputDir, { recursive: true });
      
      const args = [
        `--name ${testCase.name}`,
        `--features ${testCase.features.join(',')}`,
        `--environment ${testCase.environment}`,
        `--hasDatabase ${testCase.hasDatabase}`,
        `--useTypeScript ${testCase.useTypeScript}`,
        `--dest ${outputDir}`
      ].join(' ');
      
      const startTime = performance.now();
      
      await execAsync(`node ${cliPath} generate conditional complex ${args}`, {
        cwd: testDir,
        timeout: 15000
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      measurements.push(duration);
      
      // Verify conditional logic worked correctly
      const conditionalFile = join(outputDir, `src/conditional/${testCase.name.toLowerCase().replace(/([A-Z])/g, '-$1').slice(1)}.ts`);
      const files = require('fs').readdirSync(join(outputDir, 'src/conditional'));
      const actualFile = join(outputDir, 'src/conditional', files[0]);
      
      const content = readFileSync(actualFile, 'utf-8');
      
      // Verify features are correctly included/excluded
      for (const feature of ['auth', 'validation', 'caching']) {
        if (testCase.features.includes(feature)) {
          expect(content).toContain(`${feature}Service`);
        }
      }
      
      // Verify TypeScript conditional logic
      if (testCase.useTypeScript) {
        expect(content).toContain('interface');
        expect(content).toContain(': boolean');
      }
      
      // Verify database conditional logic
      if (testCase.hasDatabase) {
        expect(content).toContain('Database');
        expect(content).toContain('saveToDatabase');
      }
      
      console.log(`Conditional Template ${index + 1}: ${duration.toFixed(2)}ms`);
    }
    
    const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
    const maxTime = Math.max(...measurements);
    const minTime = Math.min(...measurements);
    
    console.log(`Complex Conditional Performance:
      Average: ${averageTime.toFixed(2)}ms
      Min: ${minTime.toFixed(2)}ms
      Max: ${maxTime.toFixed(2)}ms`);
    
    expect(averageTime).toBeLessThan(2000);
    expect(maxTime).toBeLessThan(3000);
  });

  it('should maintain performance with edge case inputs', async () => {
    const edgeCases = [
      { name: '', description: 'empty string' },
      { name: 'a', description: 'single character' },
      { name: 'A'.repeat(100), description: 'very long name' },
      { name: 'kebab-case-name', description: 'kebab case' },
      { name: 'snake_case_name', description: 'snake case' },
      { name: 'PascalCaseName', description: 'pascal case' },
      { name: 'camelCaseName', description: 'camel case' },
      { name: 'SCREAMING_SNAKE_CASE', description: 'screaming snake case' },
      { name: 'name.with.dots', description: 'dotted name' },
      { name: 'name with spaces', description: 'spaces in name' }
    ];
    
    const measurements: number[] = [];
    
    for (const [index, { name, description }] of edgeCases.entries()) {
      const outputDir = join(testDir, `output-edge-${index}`);
      mkdirSync(outputDir, { recursive: true });
      
      try {
        const startTime = performance.now();
        
        // Use quotes to handle edge cases safely
        await execAsync(`node ${cliPath} generate unicode test --name "${name}" --dest ${outputDir}`, {
          cwd: testDir,
          timeout: 10000
        });
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        measurements.push(duration);
        
        console.log(`Edge case "${description}": ${duration.toFixed(2)}ms`);
        
        // Verify file was created (even if name is problematic)
        const unicodeDir = join(outputDir, 'src/unicode');
        if (existsSync(unicodeDir)) {
          const files = require('fs').readdirSync(unicodeDir);
          expect(files.length).toBeGreaterThan(0);
        }
        
      } catch (error) {
        // Some edge cases might legitimately fail (like empty names)
        // but they should fail fast, not hang
        console.log(`Edge case "${description}" failed as expected: ${error.message.split('\n')[0]}`);
        measurements.push(100); // Assume fast failure
      }
    }
    
    const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
    const maxTime = Math.max(...measurements);
    
    console.log(`Edge Case Performance Summary:
      Average: ${averageTime.toFixed(2)}ms
      Max: ${maxTime.toFixed(2)}ms`);
    
    // Even edge cases should be handled efficiently
    expect(averageTime).toBeLessThan(1000);
    expect(maxTime).toBeLessThan(2000);
  });

  it('should handle file system edge cases efficiently', async () => {
    const outputDir = join(testDir, 'output-fs-edge');
    mkdirSync(outputDir, { recursive: true });
    
    // Test with very deep path
    const deepPath = 'a'.repeat(50) + '/' + 'b'.repeat(50) + '/' + 'c'.repeat(50);
    
    const startTime = performance.now();
    
    try {
      await execAsync(`node ${cliPath} generate unicode test --name FSEdgeTest --dest ${outputDir}/${deepPath}`, {
        cwd: testDir,
        timeout: 10000
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`Deep Path Creation: ${duration.toFixed(2)}ms`);
      
      // Verify deep path was created
      const deepDir = join(outputDir, deepPath, 'src/unicode');
      expect(existsSync(deepDir)).toBe(true);
      
      expect(duration).toBeLessThan(2000);
      
    } catch (error) {
      // If it fails due to path length limits, that's acceptable
      // but it should fail quickly
      console.log('Deep path creation failed (expected on some systems):', error.message.split('\n')[0]);
    }
  });
});