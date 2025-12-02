/**
 * Integration tests for deterministic artifact generation system
 */

import { DeterministicArtifactGenerator } from '../index';
import type { TarEntry } from '../tar';

describe('DeterministicArtifactGenerator', () => {
  let generator: DeterministicArtifactGenerator;
  
  beforeEach(() => {
    generator = new DeterministicArtifactGenerator();
  });
  
  describe('complete artifact generation', () => {
    it('should generate deterministic artifacts from RDF and templates', async () => {
      const rdfData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:john foaf:name "John Doe" ;
                foaf:age 30 ;
                ex:role "developer" .
                
        ex:jane foaf:name "Jane Smith" ;
                foaf:age 25 ;
                ex:role "designer" .
      `;
      
      const templates = [
        {
          path: 'src/users.js',
          template: `
// Generated user module
const users = {
  rdfHash: '{{ rdf.hash }}',
  totalTriples: {{ rdf.triples }},
  generatedId: '{{ generated.id }}'
};

module.exports = users;
          `.trim(),
          context: {
            moduleType: 'users'
          }
        },
        {
          path: 'package.json',
          template: `{{ {
  "name": "generated-app",
  "version": generated.version,
  "description": "Generated from RDF data",
  "rdfHash": rdf.hash
} | json(2) }}`,
          context: {}
        }
      ];
      
      const additionalFiles = {
        'README.md': '# Generated Project\n\nThis project was generated deterministically.',
        'config.json': JSON.stringify({ env: 'production' })
      };
      
      const artifact1 = await generator.generateArtifact({
        rdfData,
        rdfFormat: 'turtle',
        templates,
        additionalFiles
      });
      
      const artifact2 = await generator.generateArtifact({
        rdfData,
        rdfFormat: 'turtle',
        templates,
        additionalFiles
      });
      
      // Artifacts should be identical
      expect(Buffer.compare(artifact1, artifact2)).toBe(0);
      expect(Buffer.isBuffer(artifact1)).toBe(true);
      expect(artifact1.length).toBeGreaterThan(0);
    });
    
    it('should handle compression option', async () => {
      const rdfData = `
        @prefix ex: <http://example.org/> .
        ex:test ex:prop "value" .
      `;
      
      const templates = [
        {
          path: 'large-file.txt',
          template: 'Repeated content '.repeat(100) + '{{ rdf.hash }}',
          context: {}
        }
      ];
      
      const generatorWithCompression = new DeterministicArtifactGenerator({
        tarOptions: { compress: true }
      });
      
      const compressedArtifact = await generatorWithCompression.generateArtifact({
        rdfData,
        templates,
        compress: true
      });
      
      const uncompressedArtifact = await generator.generateArtifact({
        rdfData,
        templates,
        compress: false
      });
      
      expect(compressedArtifact.length).toBeLessThan(uncompressedArtifact.length);
    });
    
    it('should create deterministic context from RDF', async () => {
      const rdfData = `
        @prefix ex: <http://example.org/> .
        ex:entity ex:prop "test value" .
      `;
      
      const template = {
        path: 'context-test.json',
        template: '{{ context | json(2) }}',
        context: {
          context: {
            rdf: '{{ rdf }}',
            generated: '{{ generated }}'
          }
        }
      };
      
      const artifact = await generator.generateArtifact({
        rdfData,
        templates: [template]
      });
      
      expect(Buffer.isBuffer(artifact)).toBe(true);
    });
  });
  
  describe('artifact validation', () => {
    it('should validate deterministic artifacts', async () => {
      const config = {
        rdfData: `
          @prefix ex: <http://example.org/> .
          ex:test ex:prop "value" .
        `,
        templates: [
          {
            path: 'test.txt',
            template: 'RDF hash: {{ rdf.hash }}',
            context: {}
          }
        ]
      };
      
      const artifact = await generator.generateArtifact(config);
      const validation = await generator.validateDeterministic(config, artifact);
      
      expect(validation.isDeterministic).toBe(true);
      expect(validation.reason).toBeUndefined();
    });
    
    it('should detect non-deterministic artifacts', async () => {
      const config = {
        rdfData: `@prefix ex: <http://example.org/> . ex:test ex:prop "value" .`,
        templates: [
          {
            path: 'test.txt',
            template: 'Content',
            context: {}
          }
        ]
      };
      
      const artifact = await generator.generateArtifact(config);
      
      // Modify the artifact to make it different
      const modifiedArtifact = Buffer.from(artifact);
      modifiedArtifact[modifiedArtifact.length - 10] = 0xFF;
      
      const validation = await generator.validateDeterministic(config, modifiedArtifact);
      
      expect(validation.isDeterministic).toBe(false);
      expect(validation.reason).toContain('differs from original');
    });
    
    it('should handle validation errors', async () => {
      const config = {
        rdfData: 'invalid RDF',
        templates: []
      };
      
      const fakeArtifact = Buffer.from('fake');
      const validation = await generator.validateDeterministic(config, fakeArtifact);
      
      expect(validation.isDeterministic).toBe(false);
      expect(validation.reason).toContain('failed');
    });
  });
  
  describe('complex scenarios', () => {
    it('should handle multiple templates with shared context', async () => {
      const rdfData = `
        @prefix ex: <http://example.org/> .
        @prefix schema: <http://schema.org/> .
        
        ex:app schema:name "My Application" ;
               schema:version "2.1.0" ;
               ex:author "John Developer" .
      `;
      
      const sharedContext = {
        buildTime: 'deterministic',
        environment: 'production'
      };
      
      const templates = [
        {
          path: 'src/config.js',
          template: `
export const config = {
  name: "{{ shared.appName }}",
  version: "{{ shared.version }}",
  rdfHash: "{{ rdf.hash }}",
  environment: "{{ environment }}"
};
          `.trim(),
          context: {
            shared: {
              appName: 'My App',
              version: '2.1.0'
            },
            ...sharedContext
          }
        },
        {
          path: 'src/meta.json',
          template: `{{ {
  "buildTime": buildTime,
  "rdfTriples": rdf.triples,
  "generatedId": generated.id,
  "environment": environment
} | json(2) }}`,
          context: sharedContext
        },
        {
          path: 'docs/api.md',
          template: `# API Documentation

Generated for {{ shared.appName || "Unknown App" }}
Build: {{ buildTime }}
RDF Hash: {{ rdf.hash }}
`,
          context: {
            shared: { appName: 'My App' },
            ...sharedContext
          }
        }
      ];
      
      const result1 = await generator.generateArtifact({
        rdfData,
        templates
      });
      
      const result2 = await generator.generateArtifact({
        rdfData,
        templates
      });
      
      expect(Buffer.compare(result1, result2)).toBe(0);
    });
    
    it('should handle large RDF datasets', async () => {
      // Generate large RDF dataset
      const rdfTriples = Array.from({ length: 100 }, (_, i) => 
        `ex:entity${i} ex:prop${i % 10} "value${i}" .`
      ).join('\n        ');
      
      const rdfData = `
        @prefix ex: <http://example.org/> .
        ${rdfTriples}
      `;
      
      const template = {
        path: 'data-summary.txt',
        template: `
Data Summary:
- Total RDF triples: {{ rdf.triples }}
- RDF hash: {{ rdf.hash }}
- Generated ID: {{ generated.id }}
        `.trim(),
        context: {}
      };
      
      const artifact = await generator.generateArtifact({
        rdfData,
        templates: [template]
      });
      
      expect(Buffer.isBuffer(artifact)).toBe(true);
      expect(artifact.length).toBeGreaterThan(0);
    });
    
    it('should handle binary files in additional files', async () => {
      const rdfData = `@prefix ex: <http://example.org/> . ex:test ex:prop "value" .`;
      
      const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header
      
      const additionalFiles = {
        'assets/image.png': binaryContent,
        'data/config.bin': Buffer.from('binary config data', 'utf8')
      };
      
      const templates = [
        {
          path: 'manifest.txt',
          template: 'Generated with hash: {{ rdf.hash }}',
          context: {}
        }
      ];
      
      const artifact = await generator.generateArtifact({
        rdfData,
        templates,
        additionalFiles
      });
      
      expect(Buffer.isBuffer(artifact)).toBe(true);
    });
  });
  
  describe('custom options', () => {
    it('should respect custom render options', async () => {
      const customGenerator = new DeterministicArtifactGenerator({
        renderOptions: {
          trimBlocks: false,
          filters: {
            custom: (value: string) => `CUSTOM:${value}`
          }
        }
      });
      
      const rdfData = `@prefix ex: <http://example.org/> . ex:test ex:prop "value" .`;
      
      const template = {
        path: 'custom.txt',
        template: '{{ "test" | custom }} - {{ rdf.hash }}',
        context: {}
      };
      
      const artifact = await customGenerator.generateArtifact({
        rdfData,
        templates: [template]
      });
      
      expect(Buffer.isBuffer(artifact)).toBe(true);
    });
    
    it('should respect custom normalization options', async () => {
      const customGenerator = new DeterministicArtifactGenerator({
        normalizationOptions: {
          sortTriples: true,
          normalizeBlankNodes: true,
          baseIRI: 'http://custom.example.org/'
        }
      });
      
      const rdfData = `<test> <prop> "value" .`;
      
      const template = {
        path: 'normalized.txt',
        template: 'Hash: {{ rdf.hash }}',
        context: {}
      };
      
      const artifact = await customGenerator.generateArtifact({
        rdfData,
        templates: [template]
      });
      
      expect(Buffer.isBuffer(artifact)).toBe(true);
    });
    
    it('should respect custom tar options', async () => {
      const customGenerator = new DeterministicArtifactGenerator({
        tarOptions: {
          compress: true,
          compressionLevel: 9,
          fileMode: 0o755
        }
      });
      
      const rdfData = `@prefix ex: <http://example.org/> . ex:test ex:prop "value" .`;
      
      const template = {
        path: 'executable.sh',
        template: '#!/bin/bash\necho "RDF: {{ rdf.hash }}"',
        context: {}
      };
      
      const artifact = await customGenerator.generateArtifact({
        rdfData,
        templates: [template]
      });
      
      expect(Buffer.isBuffer(artifact)).toBe(true);
    });
  });
  
  describe('cross-system determinism', () => {
    it('should produce identical artifacts across multiple generator instances', async () => {
      const config = {
        rdfData: `
          @prefix ex: <http://example.org/> .
          @prefix foaf: <http://xmlns.com/foaf/0.1/> .
          
          ex:project foaf:name "Test Project" ;
                     ex:version "1.0.0" ;
                     ex:modules ( ex:core ex:utils ex:api ) .
        `,
        templates: [
          {
            path: 'src/index.js',
            template: `
// Generated main module
const project = {
  name: "Test Project",
  version: "1.0.0",
  rdfHash: "{{ rdf.hash }}",
  buildId: "{{ generated.id }}"
};

export default project;
            `.trim(),
            context: {}
          },
          {
            path: 'package.json',
            template: `{{ {
  "name": "test-project",
  "version": "1.0.0",
  "type": "module",
  "rdfHash": rdf.hash,
  "buildId": generated.id
} | json(2) }}`,
            context: {}
          }
        ],
        additionalFiles: {
          '.gitignore': 'node_modules/\n*.log\n',
          'LICENSE': 'MIT License\n\nGenerated project.'
        }
      };
      
      // Create multiple generators
      const generators = Array.from({ length: 3 }, () => 
        new DeterministicArtifactGenerator()
      );
      
      const artifacts = await Promise.all(
        generators.map(gen => gen.generateArtifact(config))
      );
      
      // All artifacts should be identical
      const firstArtifact = artifacts[0];
      expect(artifacts.every(artifact => 
        Buffer.compare(artifact, firstArtifact) === 0
      )).toBe(true);
    });
  });
});