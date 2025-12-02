/**
 * Performance Test Fixtures and Benchmarking Data
 * 
 * This module provides comprehensive test data and fixtures for performance
 * validation, including realistic templates, benchmark scenarios, and 
 * measurement utilities specifically designed for KPI testing.
 */

import { createHash } from 'crypto';
import { performance } from 'perf_hooks';

// =============================================================================
// Performance Benchmark Templates
// =============================================================================

export const PerformanceBenchmarkTemplates = {
  // Simple component template for basic performance testing
  simpleComponent: `
/**
 * Simple Component Template
 * Hash: {{kgen.staticHash}}
 * Generated: {{kgen.staticTimestamp}}
 */
export interface {{componentName}}Props {
  id: string;
  title: string;
  {{#if withProps}}
  data?: any;
  {{/if}}
}

export const {{componentName}}: React.FC<{{componentName}}Props> = ({ id, title{{#if withProps}}, data{{/if}} }) => {
  return (
    <div className="{{componentName}}" data-id={id}>
      <h1>{title}</h1>
      {{#if withProps}}
      <pre>{JSON.stringify(data, null, 2)}</pre>
      {{/if}}
    </div>
  );
};

export default {{componentName}};
`,

  // Complex component with multiple features for stress testing
  complexComponent: `
/**
 * Complex Component Template
 * Hash: {{kgen.staticHash}}
 * Generated: {{kgen.staticTimestamp}}
 * Features: {{features.length}} features
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';

export interface {{componentName}}Props {
  id: string;
  title: string;
  data: Array<{
    id: string;
    name: string;
    value: number;
    metadata?: Record<string, any>;
  }>;
  {{#each features}}
  {{name}}: {{type}};
  {{/each}}
}

export const {{componentName}}: React.FC<{{componentName}}Props> = (props) => {
  const { id, title, data{{#each features}}, {{name}}{{/each}} } = props;
  
  const [state, setState] = useState({
    loading: false,
    error: null as Error | null,
    processed: false
  });
  
  const processedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      processed: true,
      hash: '{{kgen.staticHash}}',
      timestamp: new Date().toISOString()
    }));
  }, [data]);
  
  const handleAction = useCallback((actionType: string, payload?: any) => {
    setState(prev => ({ ...prev, loading: true }));
    
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        loading: false,
        processed: true
      }));
    }, 100);
  }, []);
  
  useEffect(() => {
    handleAction('initialize');
  }, [handleAction]);
  
  return (
    <div className="{{componentName}}" data-id={id}>
      <header>
        <h1>{title}</h1>
        <div className="status">
          {state.loading ? 'Loading...' : 'Ready'}
        </div>
      </header>
      
      <main>
        {{#each features}}
        <section className="feature-{{name}}">
          <h2>{{name}}</h2>
          <div>Value: {String({{name}})}</div>
        </section>
        {{/each}}
        
        <div className="data-section">
          {processedData.map(item => (
            <div key={item.id} className="data-item">
              <h3>{item.name}</h3>
              <div className="value">{item.value}</div>
              {item.metadata && (
                <pre className="metadata">
                  {JSON.stringify(item.metadata, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </main>
      
      <footer>
        <button onClick={() => handleAction('refresh')}>
          Refresh
        </button>
        <button onClick={() => handleAction('export')}>
          Export
        </button>
      </footer>
    </div>
  );
};

export default {{componentName}};
`,

  // Service class template for backend performance testing
  serviceClass: `
/**
 * Service Class Template
 * Hash: {{kgen.staticHash}}
 * Generated: {{kgen.staticTimestamp}}
 */
import { Injectable } from '@nestjs/common';
{{#each imports}}
import { {{name}} } from '{{path}}';
{{/each}}

export interface {{serviceName}}Config {
  {{#each configProps}}
  {{name}}: {{type}};
  {{/each}}
}

@Injectable()
export class {{serviceName}} {
  private config: {{serviceName}}Config;
  private cache = new Map<string, any>();
  
  constructor(config: {{serviceName}}Config) {
    this.config = config;
  }
  
  {{#each methods}}
  async {{name}}({{#each params}}{{name}}: {{type}}{{#unless @last}}, {{/unless}}{{/each}}): Promise<{{returnType}}> {
    const cacheKey = \`{{name}}_\${JSON.stringify(arguments)}\`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    try {
      {{#if async}}
      await new Promise(resolve => setTimeout(resolve, 10));
      {{/if}}
      
      const result = {
        id: \`{{@index}}_\${Date.now()}\`,
        operation: '{{name}}',
        timestamp: new Date().toISOString(),
        hash: '{{kgen.staticHash}}',
        {{#each returnFields}}
        {{name}}: {{value}},
        {{/each}}
      };
      
      this.cache.set(cacheKey, result);
      return result;
      
    } catch (error) {
      throw new Error(\`{{serviceName}}.{{name}} failed: \${error.message}\`);
    }
  }
  
  {{/each}}
  
  clearCache(): void {
    this.cache.clear();
  }
  
  getMetrics(): {
    cacheSize: number;
    operations: string[];
    uptime: number;
  } {
    return {
      cacheSize: this.cache.size,
      operations: [{{#each methods}}'{{name}}'{{#unless @last}}, {{/unless}}{{/each}}],
      uptime: Date.now()
    };
  }
}
`,

  // Database model template for ORM performance testing
  databaseModel: `
/**
 * Database Model Template
 * Hash: {{kgen.staticHash}}
 * Generated: {{kgen.staticTimestamp}}
 */
import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

{{#each indexes}}
@Index('{{name}}', [{{#each fields}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}}])
{{/each}}
@Entity('{{tableName}}')
export class {{modelName}} {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  {{#each fields}}
  @Column({
    type: '{{type}}',
    {{#if nullable}}nullable: true,{{/if}}
    {{#if unique}}unique: true,{{/if}}
    {{#if length}}length: {{length}},{{/if}}
  })
  {{name}}: {{tsType}};
  
  {{/each}}
  
  @CreateDateColumn()
  createdAt: Date;
  
  @UpdateDateColumn() 
  updatedAt: Date;
  
  // Computed properties for performance testing
  get hash(): string {
    return '{{kgen.staticHash}}';
  }
  
  get serialized(): string {
    return JSON.stringify({
      id: this.id,
      {{#each fields}}
      {{name}}: this.{{name}},
      {{/each}}
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      hash: this.hash
    });
  }
  
  // Performance test methods
  validate(): boolean {
    {{#each validations}}
    if ({{condition}}) {
      throw new Error('{{message}}');
    }
    {{/each}}
    return true;
  }
  
  transform(): Record<string, any> {
    return {
      id: this.id,
      {{#each transformations}}
      {{target}}: {{expression}},
      {{/each}}
      _metadata: {
        hash: this.hash,
        serialized: this.serialized,
        timestamp: new Date().toISOString()
      }
    };
  }
}
`
};

// =============================================================================
// Performance Test Scenarios
// =============================================================================

export interface PerformanceScenario {
  name: string;
  description: string;
  template: string;
  variables: any;
  iterations: number;
  expectedP95: number; // milliseconds
  memoryLimit: number; // MB
  features?: string[];
}

export const PerformanceScenarios: PerformanceScenario[] = [
  {
    name: 'simple_component_render',
    description: 'Basic component rendering performance',
    template: PerformanceBenchmarkTemplates.simpleComponent,
    variables: {
      componentName: 'SimpleTestComponent',
      withProps: true
    },
    iterations: 1000,
    expectedP95: 50,
    memoryLimit: 10
  },
  {
    name: 'complex_component_render',
    description: 'Complex component with multiple features',
    template: PerformanceBenchmarkTemplates.complexComponent,
    variables: {
      componentName: 'ComplexTestComponent',
      features: [
        { name: 'enableCaching', type: 'boolean' },
        { name: 'maxItems', type: 'number' },
        { name: 'theme', type: 'string' },
        { name: 'onUpdate', type: '(data: any) => void' }
      ]
    },
    iterations: 500,
    expectedP95: 150,
    memoryLimit: 25
  },
  {
    name: 'service_class_generation',
    description: 'Backend service class generation',
    template: PerformanceBenchmarkTemplates.serviceClass,
    variables: {
      serviceName: 'TestService',
      imports: [
        { name: 'Repository', path: '@nestjs/typeorm' },
        { name: 'Logger', path: '@nestjs/common' }
      ],
      configProps: [
        { name: 'apiKey', type: 'string' },
        { name: 'timeout', type: 'number' },
        { name: 'retryCount', type: 'number' }
      ],
      methods: [
        {
          name: 'findAll',
          params: [{ name: 'filter', type: 'any' }],
          returnType: 'any[]',
          returnFields: [{ name: 'data', value: '[]' }],
          async: true
        },
        {
          name: 'findById',
          params: [{ name: 'id', type: 'string' }],
          returnType: 'any | null',
          returnFields: [{ name: 'data', value: 'null' }],
          async: true
        }
      ]
    },
    iterations: 200,
    expectedP95: 200,
    memoryLimit: 50
  },
  {
    name: 'database_model_generation',
    description: 'Database model class generation with indexes',
    template: PerformanceBenchmarkTemplates.databaseModel,
    variables: {
      tableName: 'test_entities',
      modelName: 'TestEntity',
      fields: [
        { name: 'name', type: 'varchar', tsType: 'string', length: 100 },
        { name: 'email', type: 'varchar', tsType: 'string', length: 255, unique: true },
        { name: 'age', type: 'int', tsType: 'number', nullable: true },
        { name: 'active', type: 'boolean', tsType: 'boolean' }
      ],
      indexes: [
        { name: 'idx_email', fields: ['email'] },
        { name: 'idx_name_age', fields: ['name', 'age'] }
      ],
      validations: [
        { condition: '!this.name || this.name.length === 0', message: 'Name is required' },
        { condition: '!this.email || !this.email.includes("@")', message: 'Valid email is required' }
      ],
      transformations: [
        { target: 'displayName', expression: 'this.name.toUpperCase()' },
        { target: 'isAdult', expression: 'this.age && this.age >= 18' }
      ]
    },
    iterations: 100,
    expectedP95: 300,
    memoryLimit: 75
  }
];

// =============================================================================
// Cache Performance Test Data
// =============================================================================

export interface CacheTestPattern {
  name: string;
  operations: number;
  hitRatio: number;
  keyDistribution: 'uniform' | 'zipfian' | 'normal';
  expectedHitRate: number;
  expectedMissRate: number;
}

export const CacheTestPatterns: CacheTestPattern[] = [
  {
    name: 'high_hit_rate',
    operations: 10000,
    hitRatio: 0.9,
    keyDistribution: 'zipfian',
    expectedHitRate: 85,
    expectedMissRate: 15
  },
  {
    name: 'medium_hit_rate',
    operations: 5000,
    hitRatio: 0.8,
    keyDistribution: 'uniform',
    expectedHitRate: 75,
    expectedMissRate: 25
  },
  {
    name: 'low_hit_rate',
    operations: 1000,
    hitRatio: 0.6,
    keyDistribution: 'normal',
    expectedHitRate: 55,
    expectedMissRate: 45
  },
  {
    name: 'cache_pressure',
    operations: 50000,
    hitRatio: 0.95,
    keyDistribution: 'zipfian',
    expectedHitRate: 90,
    expectedMissRate: 10
  }
];

// =============================================================================
// Reproducibility Test Data
// =============================================================================

export interface ReproducibilityTestCase {
  name: string;
  template: string;
  variables: any;
  environments: number;
  iterations: number;
  expectedReproducibility: number; // percentage
  noiseFactors: string[];
}

export const ReproducibilityTestCases: ReproducibilityTestCase[] = [
  {
    name: 'deterministic_simple',
    template: PerformanceBenchmarkTemplates.simpleComponent,
    variables: { componentName: 'DeterministicComponent', withProps: false },
    environments: 5,
    iterations: 100,
    expectedReproducibility: 100,
    noiseFactors: ['process.env', 'Date.now()', 'Math.random()']
  },
  {
    name: 'deterministic_complex',
    template: PerformanceBenchmarkTemplates.complexComponent,
    variables: {
      componentName: 'ComplexDeterministicComponent',
      features: [
        { name: 'setting1', type: 'string' },
        { name: 'setting2', type: 'number' }
      ]
    },
    environments: 3,
    iterations: 50,
    expectedReproducibility: 100,
    noiseFactors: ['environment variables', 'system time', 'random seeds']
  }
];

// =============================================================================
// Drift Detection Test Data
// =============================================================================

export interface DriftTestCase {
  name: string;
  baseTemplate: string;
  noisyVariants: string[];
  variables: any;
  expectedSNR: number;
  semanticallyEquivalent: boolean;
}

export const DriftTestCases: DriftTestCase[] = [
  {
    name: 'whitespace_noise',
    baseTemplate: 'const {{name}} = "{{value}}";',
    noisyVariants: [
      'const {{name}}  =  "{{value}}"  ;',
      'const  {{name}}="{{value}}";',
      '\nconst {{name}} = "{{value}}";\n'
    ],
    variables: { name: 'testVar', value: 'testValue' },
    expectedSNR: 100,
    semanticallyEquivalent: true
  },
  {
    name: 'comment_noise',
    baseTemplate: 'function {{name}}() { return "{{value}}"; }',
    noisyVariants: [
      '// Comment\nfunction {{name}}() { return "{{value}}"; }',
      'function {{name}}() { /* inline */ return "{{value}}"; }',
      'function {{name}}() {\n  // Another comment\n  return "{{value}}";\n}'
    ],
    variables: { name: 'testFunc', value: 'testReturn' },
    expectedSNR: 100,
    semanticallyEquivalent: true
  },
  {
    name: 'semantic_change',
    baseTemplate: 'const {{name}} = {{value}};',
    noisyVariants: [
      'const {{name}} = {{value}} + 1;',
      'let {{name}} = {{value}};',
      'const {{name}} = String({{value}});'
    ],
    variables: { name: 'testNum', value: '42' },
    expectedSNR: 0,
    semanticallyEquivalent: false
  }
];

// =============================================================================
// Performance Benchmarking Utilities
// =============================================================================

export class PerformanceBenchmarkRunner {
  private results: Map<string, any> = new Map();
  
  async runScenario(scenario: PerformanceScenario, templateEngine: any): Promise<any> {
    const startTime = performance.now();
    const results: any[] = [];
    
    for (let i = 0; i < scenario.iterations; i++) {
      const iterationStart = performance.now();
      
      try {
        const result = await templateEngine.render(scenario.template, scenario.variables);
        const iterationEnd = performance.now();
        
        results.push({
          iteration: i,
          duration: iterationEnd - iterationStart,
          success: true,
          contentLength: result.content.length,
          hash: createHash('sha256').update(result.content).digest('hex')
        });
        
      } catch (error) {
        const iterationEnd = performance.now();
        
        results.push({
          iteration: i,
          duration: iterationEnd - iterationStart,
          success: false,
          error: error.message
        });
      }
    }
    
    const endTime = performance.now();
    const totalDuration = endTime - startTime;
    
    // Calculate statistics
    const successfulResults = results.filter(r => r.success);
    const durations = successfulResults.map(r => r.duration).sort((a, b) => a - b);
    
    const stats = {
      scenario: scenario.name,
      totalIterations: scenario.iterations,
      successfulIterations: successfulResults.length,
      failedIterations: results.length - successfulResults.length,
      totalDuration,
      avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: durations[0] || 0,
      maxDuration: durations[durations.length - 1] || 0,
      p50Duration: durations[Math.floor(durations.length * 0.5)] || 0,
      p95Duration: durations[Math.ceil(durations.length * 0.95) - 1] || 0,
      p99Duration: durations[Math.ceil(durations.length * 0.99) - 1] || 0,
      meetsExpectedP95: (durations[Math.ceil(durations.length * 0.95) - 1] || 0) <= scenario.expectedP95,
      uniqueHashes: new Set(successfulResults.map(r => r.hash)).size,
      isDeterministic: new Set(successfulResults.map(r => r.hash)).size <= 1
    };
    
    this.results.set(scenario.name, { scenario, results, stats });
    return stats;
  }
  
  getResults(scenarioName?: string): any {
    if (scenarioName) {
      return this.results.get(scenarioName);
    }
    return Array.from(this.results.values());
  }
  
  generateReport(): any {
    const scenarios = Array.from(this.results.values());
    
    return {
      generated_at: new Date().toISOString(),
      total_scenarios: scenarios.length,
      summary: {
        total_iterations: scenarios.reduce((sum, s) => sum + s.stats.totalIterations, 0),
        successful_iterations: scenarios.reduce((sum, s) => sum + s.stats.successfulIterations, 0),
        avg_p95_duration: scenarios.reduce((sum, s) => sum + s.stats.p95Duration, 0) / scenarios.length,
        scenarios_meeting_p95: scenarios.filter(s => s.stats.meetsExpectedP95).length,
        deterministic_scenarios: scenarios.filter(s => s.stats.isDeterministic).length
      },
      scenarios: scenarios.map(s => ({
        name: s.scenario.name,
        description: s.scenario.description,
        stats: s.stats
      }))
    };
  }
  
  clear(): void {
    this.results.clear();
  }
}

// Export all test data and utilities
export default {
  PerformanceBenchmarkTemplates,
  PerformanceScenarios,
  CacheTestPatterns,
  ReproducibilityTestCases,
  DriftTestCases,
  PerformanceBenchmarkRunner
};