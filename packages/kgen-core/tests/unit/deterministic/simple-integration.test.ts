/**
 * Simple integration test demonstrating deterministic artifact generation
 */

import {
  sortObjectKeys,
  createDeterministicHash,
  stableStringify,
  createDeterministicId
} from '../../../src/deterministic/utils';

describe('deterministic system integration', () => {
  it('should produce identical results for identical inputs across executions', () => {
    const projectData = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'typescript': '^5.0.0',
        'vitest': '^1.0.0'
      },
      scripts: {
        'build': 'tsc',
        'test': 'vitest'
      }
    };
    
    // Multiple executions should produce identical results
    const results = Array.from({ length: 5 }, () => ({
      hash: createDeterministicHash(projectData),
      json: stableStringify(projectData),
      id: createDeterministicId('project', projectData)
    }));
    
    const firstResult = results[0];
    expect(results.every(result => 
      result.hash === firstResult.hash &&
      result.json === firstResult.json &&
      result.id === firstResult.id
    )).toBe(true);
  });
  
  it('should handle key ordering independence correctly', () => {
    const data1 = { z: 3, a: 1, m: 2 };
    const data2 = { a: 1, m: 2, z: 3 };
    
    // Different key orders should normalize to same result
    const sorted1 = sortObjectKeys(data1);
    const sorted2 = sortObjectKeys(data2);
    
    expect(createDeterministicHash(sorted1)).toBe(createDeterministicHash(sorted2));
    expect(stableStringify(data1)).toBe(stableStringify(data2));
  });
  
  it('should demonstrate artifact generation workflow', () => {
    // Simulate RDF data
    const rdfContent = `
      @prefix ex: <http://example.org/> .
      ex:project ex:name "Test Project" ;
                 ex:version "1.0.0" .
    `;
    
    // Template context
    const context = {
      project: { name: 'Test Project', version: '1.0.0' },
      build: { timestamp: '2023-01-01T00:00:00Z' }
    };
    
    // Create artifact metadata
    const metadata = {
      rdfHash: createDeterministicHash(rdfContent.trim()),
      contextHash: createDeterministicHash(sortObjectKeys(context)),
      artifactId: createDeterministicId('artifact', rdfContent, context)
    };
    
    // Multiple generations should be identical
    const metadata2 = {
      rdfHash: createDeterministicHash(rdfContent.trim()),
      contextHash: createDeterministicHash(sortObjectKeys(context)),
      artifactId: createDeterministicId('artifact', rdfContent, context)
    };
    
    expect(metadata).toEqual(metadata2);
    expect(metadata.artifactId).toMatch(/^[a-f0-9]{8}$/);
  });
});