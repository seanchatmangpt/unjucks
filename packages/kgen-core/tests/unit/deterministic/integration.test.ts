/**
 * Integration test for deterministic artifact generation
 * Tests the core functionality that same inputs produce identical bytes
 */

import {
  sortObjectKeys,
  createDeterministicHash,
  stableStringify,
  createDeterministicId,
  deterministicMerge
} from '../../../src/deterministic/utils';

describe('deterministic integration', () => {
  describe('core deterministic behavior', () => {
    it('should produce identical hashes for same complex data across multiple runs', () => {
      const complexData = {
        project: {
          name: 'test-project',
          version: '1.0.0',
          dependencies: {
            'z-package': '^3.0.0',
            'a-package': '^1.0.0',
            'm-package': '^2.0.0'
          },
          scripts: {
            test: 'vitest',
            build: 'tsc',
            lint: 'eslint'
          }
        },
        metadata: {
          created: '2023-01-01T00:00:00Z',
          author: 'Test Author',
          tags: ['utility', 'library', 'typescript']
        },
        files: [
          { name: 'src/index.ts', size: 1024 },
          { name: 'README.md', size: 512 },
          { name: 'package.json', size: 256 }
        ]
      };
      
      // Generate hashes multiple times
      const hashes = Array.from({ length: 10 }, () => 
        createDeterministicHash(complexData)
      );
      
      // All hashes should be identical
      const firstHash = hashes[0];
      expect(hashes.every(hash => hash === firstHash)).toBe(true);
      expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
    });
    
    it('should produce identical results regardless of object key order', () => {
      const data1 = {
        z: 'last',
        a: 'first',
        nested: {
          y: 'nested-last',
          x: 'nested-first',
          deep: {
            c: 'deep-last',
            a: 'deep-first',
            b: 'deep-middle'
          }
        },
        m: 'middle'
      };
      
      const data2 = {
        a: 'first',
        m: 'middle',
        nested: {
          deep: {
            a: 'deep-first',
            b: 'deep-middle',
            c: 'deep-last'
          },
          x: 'nested-first',
          y: 'nested-last'
        },
        z: 'last'
      };
      
      const hash1 = createDeterministicHash(data1);
      const hash2 = createDeterministicHash(data2);
      const json1 = stableStringify(data1);
      const json2 = stableStringify(data2);
      
      expect(hash1).toBe(hash2);
      expect(json1).toBe(json2);
    });
    
    it('should handle artifact generation scenario with templates and data', () => {
      // Simulate artifact generation with sorted inputs
      const rdfData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:project foaf:name "Test Project" ;
                   ex:version "1.0.0" ;
                   ex:created "2023-01-01T00:00:00Z" .
      `;
      
      const templateContext = {
        project: {
          name: 'Test Project',
          version: '1.0.0',
          features: ['auth', 'api', 'web']
        },
        build: {
          timestamp: '2023-01-01T00:00:00Z',
          environment: 'production'
        }
      };
      
      const templateContent = `
# Generated Project: {{ project.name }}

Version: {{ project.version }}
Environment: {{ build.environment }}
RDF Hash: {{ rdfHash }}

## Features
{% for feature in project.features | sort %}
- {{ feature }}
{% endfor %}
      `.trim();
      
      // Create deterministic context
      const rdfHash = createDeterministicHash(rdfData);
      const context = deterministicMerge(templateContext, { rdfHash });
      const sortedContext = sortObjectKeys(context);
      
      // Generate artifact metadata
      const artifactId = createDeterministicId('artifact', rdfData, templateContent, context);
      const metadata = {
        id: artifactId,
        rdfHash,
        contextHash: createDeterministicHash(sortedContext),
        templateHash: createDeterministicHash(templateContent)
      };
      
      // Multiple generations should produce identical metadata
      const metadata2 = {
        id: createDeterministicId('artifact', rdfData, templateContent, context),
        rdfHash: createDeterministicHash(rdfData),
        contextHash: createDeterministicHash(sortObjectKeys(context)),
        templateHash: createDeterministicHash(templateContent)
      };
      
      expect(metadata).toEqual(metadata2);
      expect(metadata.id).toMatch(/^[a-f0-9]{8}$/);
    });
    
    it('should demonstrate cross-system determinism with file structure', () => {
      // Simulate file structure from different systems
      const fileStructure1 = {
        'package.json': JSON.stringify({
          name: 'test-app',
          dependencies: { z: '1.0.0', a: '2.0.0' },
          scripts: { test: 'vitest', build: 'tsc' }
        }),
        'src/index.ts': 'export * from "./lib";',
        'src/lib/utils.ts': 'export const util = () => {};',
        'README.md': '# Test App\n\nGenerated project.',
        'tsconfig.json': JSON.stringify({
          compilerOptions: { target: 'es2020', module: 'esnext' },
          include: ['src/**/*']
        })
      };
      
      // Same structure but with different order
      const fileStructure2 = {
        'tsconfig.json': JSON.stringify({
          include: ['src/**/*'],
          compilerOptions: { module: 'esnext', target: 'es2020' }
        }),
        'README.md': '# Test App\n\nGenerated project.',
        'src/lib/utils.ts': 'export const util = () => {};',
        'src/index.ts': 'export * from "./lib";',
        'package.json': JSON.stringify({
          scripts: { build: 'tsc', test: 'vitest' },
          dependencies: { a: '2.0.0', z: '1.0.0' },
          name: 'test-app'
        })
      };
      
      // Create deterministic hashes for both structures
      const hash1 = createDeterministicHash(fileStructure1);
      const hash2 = createDeterministicHash(fileStructure2);
      
      expect(hash1).toBe(hash2);
      
      // Verify stable serialization
      const json1 = stableStringify(fileStructure1);
      const json2 = stableStringify(fileStructure2);
      
      expect(json1).toBe(json2);
    });
    
    it('should handle complex nested data with arrays and mixed types', () => {
      const complexData = {
        config: {
          database: {
            type: 'postgresql',
            settings: {
              pool: { min: 2, max: 10 },
              timeout: 30000
            }
          },
          redis: {
            clusters: [
              { host: 'redis-1', port: 6379 },
              { host: 'redis-2', port: 6379 }
            ]
          }
        },
        services: [
          {
            name: 'auth-service',
            endpoints: ['/login', '/logout', '/refresh'],
            dependencies: ['database', 'redis']
          },
          {
            name: 'api-service',
            endpoints: ['/api/users', '/api/posts'],
            dependencies: ['database']
          }
        ],
        metadata: {
          version: '2.1.0',
          deployment: {
            strategy: 'rolling',
            replicas: 3
          }
        }
      };
      
      // Test with different arrangements
      const rearranged = {
        services: [
          {
            dependencies: ['database'],
            endpoints: ['/api/posts', '/api/users'], // Different order
            name: 'api-service'
          },
          {
            dependencies: ['redis', 'database'], // Different order
            endpoints: ['/refresh', '/login', '/logout'], // Different order
            name: 'auth-service'
          }
        ],
        metadata: {
          deployment: {
            replicas: 3,
            strategy: 'rolling'
          },
          version: '2.1.0'
        },
        config: {
          redis: {
            clusters: [
              { port: 6379, host: 'redis-2' }, // Different order
              { port: 6379, host: 'redis-1' }
            ]
          },
          database: {
            settings: {
              timeout: 30000,
              pool: { max: 10, min: 2 } // Different order
            },
            type: 'postgresql'
          }
        }
      };
      
      const hash1 = createDeterministicHash(complexData);
      const hash2 = createDeterministicHash(rearranged);
      
      // Hashes should be different due to array ordering
      expect(hash1).not.toBe(hash2);
      
      // But if we sort the object keys, they should normalize
      const sorted1 = sortObjectKeys(complexData);
      const sorted2 = sortObjectKeys(rearranged);
      
      // The main objects will be sorted, but arrays will maintain order
      expect(createDeterministicHash(sorted1)).not.toBe(createDeterministicHash(sorted2));
      
      // This demonstrates that array ordering matters for determinism
      expect(sorted1.services[0].name).toBe('auth-service');
      expect(sorted2.services[0].name).toBe('api-service');
    });
  });
  
  describe('performance and scalability', () => {
    it('should handle large data structures efficiently', () => {
      // Generate large data structure
      const largeData = {
        entities: Array.from({ length: 1000 }, (_, i) => ({
          id: `entity-${i}`,
          name: `Entity ${i}`,
          properties: {
            type: ['user', 'admin', 'guest'][i % 3],
            level: i % 10,
            active: i % 2 === 0
          },
          metadata: {
            created: '2023-01-01T00:00:00Z',
            updated: '2023-01-01T00:00:00Z'
          }
        })),
        config: {
          version: '1.0.0',
          settings: Object.fromEntries(
            Array.from({ length: 100 }, (_, i) => [
              `setting-${i}`, 
              `value-${i}`
            ])
          )
        }
      };
      
      const startTime = Date.now();
      const hash = createDeterministicHash(largeData);
      const endTime = Date.now();
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      
      // Verify consistency
      const hash2 = createDeterministicHash(largeData);
      expect(hash).toBe(hash2);
    });
  });
});