import { faker } from '@faker-js/faker';
import type { 
  GenerateOptions, 
  GenerateResult, 
  InitOptions 
} from '../../src/lib/generator.js';

export class GeneratorFactory {
  /**
   * Create generate options
   */
  static createGenerateOptions(overrides: Partial<GenerateOptions> = {}): GenerateOptions {
    return {
      generator: overrides.generator || faker.hacker.noun(),
      template: overrides.template || faker.hacker.noun(),
      dest: overrides.dest || './src',
      force: overrides.force ?? false,
      dry: overrides.dry ?? false,
      variables: overrides.variables || this.createVariables(),
      ...overrides
    };
  }

  /**
   * Create generate result
   */
  static createGenerateResult(fileCount: number = 3): GenerateResult {
    return {
      files: Array.from({ length: fileCount }, (_, i) => ({
        path: `src/component-${i}.ts`,
        content: `export const Component${i} = () => {};`
      }))
    };
  }

  /**
   * Create init options
   */
  static createInitOptions(overrides: Partial<InitOptions> = {}): InitOptions {
    return {
      type: overrides.type || faker.helpers.arrayElement(['app', 'lib', 'component']),
      dest: overrides.dest || './my-project',
      ...overrides
    };
  }

  /**
   * Create template variables
   */
  static createVariables(count: number = 5): Record<string, any> {
    const variables: Record<string, any> = {};
    
    for (let i = 0; i < count; i++) {
      const key = faker.hacker.noun();
      const type = faker.helpers.arrayElement(['string', 'boolean', 'number', 'array']);
      
      switch (type) {
        case 'string':
          variables[key] = faker.lorem.words();
          break;
        case 'boolean':
          variables[key] = faker.datatype.boolean();
          break;
        case 'number':
          variables[key] = faker.datatype.number();
          break;
        case 'array':
          variables[key] = faker.helpers.arrayElements(['a', 'b', 'c']);
          break;
      }
    }

    // Always include common variables
    variables.name = faker.person.firstName();
    variables.description = faker.lorem.sentence();

    return variables;
  }

  /**
   * Create CLI arguments array
   */
  static createCLIArgs(overrides: Partial<{
    generator: string;
    template: string;
    name: string;
    dest: string;
    force: boolean;
    dry: boolean;
    additional: Record<string, any>;
  }> = {}): string[] {
    const args = ['generate'];
    
    if (overrides.generator) args.push(overrides.generator);
    if (overrides.template) args.push(overrides.template);
    if (overrides.name) args.push(overrides.name);
    if (overrides.dest) args.push('--dest', overrides.dest);
    if (overrides.force) args.push('--force');
    if (overrides.dry) args.push('--dry');
    
    if (overrides.additional) {
      Object.entries(overrides.additional).forEach(([key, value]) => {
        args.push(`--${key}`);
        if (typeof value !== 'boolean') {
          args.push(String(value));
        }
      });
    }

    return args;
  }

  /**
   * Create complex generation scenarios
   */
  static createScenarios() {
    return {
      simple: {
        options: this.createGenerateOptions({
          generator: 'component',
          template: 'basic',
          variables: { name: 'Button' }
        }),
        expectedFiles: ['src/Button.tsx', 'src/Button.test.tsx']
      },
      
      complex: {
        options: this.createGenerateOptions({
          generator: 'feature',
          template: 'full-stack',
          variables: {
            name: 'UserManager',
            hasApi: true,
            hasTests: true,
            hasDocumentation: true
          }
        }),
        expectedFiles: [
          'src/features/user-manager/UserManager.tsx',
          'src/features/user-manager/UserManagerService.ts',
          'src/features/user-manager/UserManager.test.tsx',
          'docs/user-manager.md'
        ]
      },

      withInjection: {
        options: this.createGenerateOptions({
          generator: 'service',
          template: 'crud',
          variables: { name: 'Product' }
        }),
        injectionTargets: [
          'src/index.ts',
          'src/routes.ts',
          'src/types.ts'
        ]
      },

      nested: {
        options: this.createGenerateOptions({
          generator: 'workspace',
          template: 'monorepo',
          dest: './packages/my-package',
          variables: {
            packageName: 'my-package',
            hasWorkspace: true,
            packages: ['core', 'ui', 'utils']
          }
        }),
        expectedStructure: {
          'packages/my-package/core': ['index.ts', 'package.json'],
          'packages/my-package/ui': ['index.ts', 'package.json'],
          'packages/my-package/utils': ['index.ts', 'package.json']
        }
      }
    };
  }

  /**
   * Create error scenarios for testing
   */
  static createErrorScenarios() {
    return {
      missingGenerator: this.createGenerateOptions({ generator: 'nonexistent' }),
      missingTemplate: this.createGenerateOptions({ 
        generator: 'component',
        template: 'nonexistent'
      }),
      invalidDestination: this.createGenerateOptions({ dest: '/invalid/path' }),
      malformedVariables: this.createGenerateOptions({
        variables: { 'invalid-key': undefined }
      }),
      circularReference: this.createGenerateOptions({
        variables: (() => {
          const obj: any = { name: 'test' };
          obj.self = obj;
          return obj;
        })()
      })
    };
  }

  /**
   * Create performance test scenarios
   */
  static createPerformanceScenarios() {
    return {
      largeVariableSet: this.createGenerateOptions({
        variables: this.createVariables(100)
      }),
      
      manyFiles: this.createGenerateOptions({
        generator: 'bulk',
        template: 'many-files',
        variables: {
          fileCount: 50,
          name: 'BulkGenerated'
        }
      }),

      deepNesting: this.createGenerateOptions({
        generator: 'nested',
        template: 'deep-structure',
        variables: {
          depth: 10,
          name: 'DeepNested'
        }
      }),

      largeContent: this.createGenerateOptions({
        generator: 'content',
        template: 'large-file',
        variables: {
          contentSize: 10000,
          name: 'LargeContent'
        }
      })
    };
  }
}

// Convenience exports
export const {
  createGenerateOptions,
  createGenerateResult,
  createInitOptions,
  createVariables,
  createCLIArgs,
  createScenarios,
  createErrorScenarios,
  createPerformanceScenarios
} = GeneratorFactory;