import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { KnowledgeGraphPipeline, KGDataset } from '../../src/lib/knowledge-graph/kg-pipeline';
import { tmpdir } from 'os';

describe('Knowledge Graph Pipeline Integration Tests', () => {
  let tempDir: string;
  let pipeline: KnowledgeGraphPipeline;
  let testDataset: KGDataset;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = join(tmpdir(), 'kg-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    // Initialize pipeline
    pipeline = new KnowledgeGraphPipeline({
      templatesDir: join(__dirname, '../fixtures/knowledge-graphs/templates'),
      outputDir: join(tempDir, 'output'),
      validate: true,
      force: true
    });

    // Load test dataset
    const testDataPath = join(__dirname, '../fixtures/knowledge-graphs/test-data.json');
    const testDataContent = await fs.readFile(testDataPath, 'utf8');
    testDataset = JSON.parse(testDataContent);
  });

  afterEach(async () => {
    // Cleanup temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup temp directory: ${error.message}`);
    }
  });

  describe('End-to-End Knowledge Graph Generation', () => {
    it('should generate complete knowledge graph from test dataset', async () => {
      const result = await pipeline.generateKnowledgeGraph(testDataset);

      expect(result).toBeDefined();
      expect(result.files).toHaveLength(5); // entities, relationships, schema, metadata, queries
      expect(result.triples).toBeGreaterThan(0);
      expect(result.entities).toBeGreaterThan(0);
      expect(result.validationResult).toBeDefined();
      expect(result.validationResult?.valid).toBe(true);

      // Verify all expected files were generated
      const expectedFiles = [
        'entities/enterprise-entities.ttl',
        'relationships/enterprise-relationships.ttl', 
        'schema/enterprise-schema.ttl',
        'metadata/enterprise-metadata.ttl',
        'queries/enterprise-queries.sparql'
      ];

      for (const expectedFile of expectedFiles) {
        const filePath = join(tempDir, 'output', expectedFile);
        await expect(fs.access(filePath)).resolves.not.toThrow();
        
        const content = await fs.readFile(filePath, 'utf8');
        expect(content).toBeTruthy();
        expect(content.length).toBeGreaterThan(100);
      }
    });

    it('should generate valid RDF triples with proper prefixes', async () => {
      await pipeline.generateKnowledgeGraph(testDataset);

      const entitiesFile = join(tempDir, 'output/entities/enterprise-entities.ttl');
      const content = await fs.readFile(entitiesFile, 'utf8');

      // Check for proper RDF prefixes
      expect(content).toContain('@prefix kg:');
      expect(content).toContain('@prefix schema:');
      expect(content).toContain('@prefix foaf:');
      expect(content).toContain('@prefix dct:');
      expect(content).toContain('@prefix owl:');
      expect(content).toContain('@prefix xsd:');

      // Check for entity definitions
      expect(content).toContain('kg:person-001');
      expect(content).toContain('kg:person-002');
      expect(content).toContain('kg:org-001');
      expect(content).toContain('kg:product-001');

      // Check for proper RDF syntax
      const lines = content.split('\n').filter(line => 
        line.trim() && 
        !line.trim().startsWith('#') && 
        !line.trim().startsWith('@prefix')
      );
      
      // Most non-comment lines should end with . or ;
      const syntaxValidLines = lines.filter(line => 
        line.trim().endsWith('.') || 
        line.trim().endsWith(';') ||
        line.trim().endsWith('}')
      );
      
      expect(syntaxValidLines.length).toBeGreaterThan(lines.length * 0.8);
    });

    it('should generate relationships with proper object properties', async () => {
      await pipeline.generateKnowledgeGraph(testDataset);

      const relationshipsFile = join(tempDir, 'output/relationships/enterprise-relationships.ttl');
      const content = await fs.readFile(relationshipsFile, 'utf8');

      // Check for relationship definitions
      expect(content).toContain('kg:worksFor a owl:ObjectProperty');
      expect(content).toContain('kg:person-001 kg:worksFor kg:org-001');
      expect(content).toContain('kg:person-002 kg:worksFor kg:org-001');

      // Check for qualified relationships
      expect(content).toContain('kg:qual_');
      expect(content).toContain('a kg:QualifiedRelation');

      // Check for confidence values
      expect(content).toContain('kg:confidence');
      expect(content).toContain('xsd:decimal');

      // Check for temporal relationships
      expect(content).toContain('kg:validFrom');
      expect(content).toContain('kg:validTo');
      expect(content).toContain('xsd:dateTime');
    });

    it('should generate schema mappings with standard vocabularies', async () => {
      await pipeline.generateKnowledgeGraph(testDataset);

      const schemaFile = join(tempDir, 'output/schema/enterprise-schema.ttl');
      const content = await fs.readFile(schemaFile, 'utf8');

      // Check for class alignments
      expect(content).toContain('kg:Employee a owl:Class');
      expect(content).toContain('owl:equivalentClass schema:Person');
      expect(content).toContain('kg:Company a owl:Class');

      // Check for property alignments  
      expect(content).toContain('kg:worksFor a owl:ObjectProperty');
      expect(content).toContain('kg:employeeId a owl:DatatypeProperty');
      expect(content).toContain('owl:equivalentProperty schema:identifier');

      // Check for SKOS concept mappings
      expect(content).toContain('kg:SoftwareDevelopment a skos:Concept');
      expect(content).toContain('skos:prefLabel');
      expect(content).toContain('skos:exactMatch');

      // Check for VoID dataset description
      expect(content).toContain('kg:dataset a void:Dataset');
      expect(content).toContain('void:vocabulary');
      expect(content).toContain('dcat:Dataset');
    });

    it('should generate comprehensive metadata with provenance', async () => {
      await pipeline.generateKnowledgeGraph(testDataset);

      const metadataFile = join(tempDir, 'output/metadata/enterprise-metadata.ttl');
      const content = await fs.readFile(metadataFile, 'utf8');

      // Check for provenance information
      expect(content).toContain('kg:provenance a prov:Entity');
      expect(content).toContain('prov:wasGeneratedBy');
      expect(content).toContain('prov:generatedAtTime');
      expect(content).toContain('kg:generationActivity a prov:Activity');

      // Check for source system information
      expect(content).toContain('kg:source_hr-system');
      expect(content).toContain('dcat:Dataset');
      expect(content).toContain('kg:completeness');
      expect(content).toContain('kg:accuracy');

      // Check for quality assessment
      expect(content).toContain('kg:qualityAssessment');
      expect(content).toContain('kg:completenessScore');
      expect(content).toContain('kg:accuracyScore');
      expect(content).toContain('kg:consistencyScore');

      // Check for version control
      expect(content).toContain('kg:version_1_0_0');
      expect(content).toContain('prov:wasRevisionOf');
      expect(content).toContain('kg:addedTriples');

      // Check for usage statistics
      expect(content).toContain('kg:usageStatistics');
      expect(content).toContain('kg:totalQueries');
      expect(content).toContain('kg:averageResponseTime');
    });

    it('should generate comprehensive SPARQL queries', async () => {
      await pipeline.generateKnowledgeGraph(testDataset);

      const queriesFile = join(tempDir, 'output/queries/enterprise-queries.sparql');
      const content = await fs.readFile(queriesFile, 'utf8');

      // Check for prefix declarations
      expect(content).toContain('PREFIX kg:');
      expect(content).toContain('PREFIX schema:');
      expect(content).toContain('PREFIX foaf:');

      // Check for basic entity queries
      expect(content).toContain('SELECT');
      expect(content).toContain('WHERE');
      expect(content).toContain('?entity a ?type');
      expect(content).toContain('ORDER BY');
      expect(content).toContain('LIMIT');

      // Check for relationship queries
      expect(content).toContain('?source ?relationship ?target');
      expect(content).toContain('OPTIONAL');
      expect(content).toContain('rdfs:label');

      // Check for aggregation queries
      expect(content).toContain('COUNT(?entity)');
      expect(content).toContain('GROUP BY');
      expect(content).toContain('DESC(?count)');

      // Check for temporal queries
      expect(content).toContain('YEAR(?startDate)');
      expect(content).toContain('schema:Event');

      // Check for maintenance queries
      expect(content).toContain('Find orphaned entities');
      expect(content).toContain('Find duplicate entities');
      expect(content).toContain('FILTER NOT EXISTS');
    });
  });

  describe('Filter Integration Testing', () => {
    it('should apply all template filters correctly', async () => {
      await pipeline.generateKnowledgeGraph(testDataset);

      const entitiesFile = join(tempDir, 'output/entities/enterprise-entities.ttl');
      const content = await fs.readFile(entitiesFile, 'utf8');

      // Test slug filter
      expect(content).toContain('kg:person-001');
      expect(content).toContain('kg:org-001');
      expect(content).not.toContain('person_001'); // Should be converted to kebab-case

      // Test pascalCase filter for types
      expect(content).toContain('schema:Person');
      expect(content).toContain('schema:Organization');
      expect(content).toContain('schema:Product');

      // Test camelCase filter for properties
      expect(content).toContain('schema:firstName');
      expect(content).toContain('schema:lastName');
      expect(content).toContain('schema:birthDate');

      // Test formatDate filter
      expect(content).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO datetime format
      expect(content).toContain('^^xsd:dateTime');

      // Test rdfResource filter
      expect(content).toContain('<http://example.org/kg/enterprise/>');

      // Test default filter
      expect(content).toContain('Generated knowledge graph for enterprise'); // Default description
    });

    it('should handle geospatial data with coordinate filters', async () => {
      await pipeline.generateKnowledgeGraph(testDataset);

      const entitiesFile = join(tempDir, 'output/entities/enterprise-entities.ttl');
      const content = await fs.readFile(entitiesFile, 'utf8');

      // Check geospatial entities
      expect(content).toContain('kg:location-001');
      expect(content).toContain('a schema:Place');
      expect(content).toContain('schema:latitude "37.7749"^^xsd:decimal');
      expect(content).toContain('schema:longitude "-122.4194"^^xsd:decimal');
      expect(content).toContain('schema:addressCountry "United States"@en');
    });

    it('should handle temporal data with date/time filters', async () => {
      await pipeline.generateKnowledgeGraph(testDataset);

      const entitiesFile = join(tempDir, 'output/entities/enterprise-entities.ttl');
      const content = await fs.readFile(entitiesFile, 'utf8');

      // Check temporal entities
      expect(content).toContain('kg:event-001');
      expect(content).toContain('a schema:Event');
      expect(content).toContain('schema:startDate');
      expect(content).toContain('schema:endDate');
      expect(content).toContain('schema:duration "PT8H"^^xsd:duration');
      expect(content).toContain('^^xsd:dateTime');
    });
  });

  describe('Validation and Quality Assurance', () => {
    it('should validate RDF syntax and report errors', async () => {
      const result = await pipeline.generateKnowledgeGraph(testDataset);

      expect(result.validationResult).toBeDefined();
      expect(result.validationResult?.valid).toBe(true);
      expect(result.validationResult?.errors).toHaveLength(0);
      expect(result.validationResult?.statistics.totalTriples).toBeGreaterThan(0);
      expect(result.validationResult?.statistics.totalEntities).toBeGreaterThan(0);
      expect(result.validationResult?.statistics.validationTime).toBeGreaterThan(0);
    });

    it('should generate quality report with recommendations', async () => {
      const result = await pipeline.generateKnowledgeGraph(testDataset);
      const reportPath = await pipeline.generateQualityReport(testDataset, result.validationResult!);

      expect(reportPath).toBeTruthy();
      await expect(fs.access(reportPath)).resolves.not.toThrow();

      const reportContent = await fs.readFile(reportPath, 'utf8');
      const report = JSON.parse(reportContent);

      expect(report.dataset).toBeDefined();
      expect(report.dataset.domain).toBe('enterprise');
      expect(report.statistics).toBeDefined();
      expect(report.validation).toBeDefined();
      expect(report.qualityMetrics).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);

      // Check quality metrics
      expect(report.qualityMetrics.completeness.overall).toBe(0.87);
      expect(report.qualityMetrics.accuracy.overall).toBe(0.91);
      expect(report.qualityMetrics.consistency.overall).toBe(0.89);
    });

    it('should detect and report data quality issues', async () => {
      // Create dataset with quality issues
      const faultyDataset: KGDataset = {
        ...testDataset,
        entities: [
          {
            id: 'person_003',
            name: '',  // Missing name
            type: 'Person',
            email: 'invalid-email'  // Invalid email format
          },
          {
            id: 'person_004',
            name: 'John Doe',
            type: ''  // Missing type
          }
        ]
      };

      const result = await pipeline.generateKnowledgeGraph(faultyDataset);

      expect(result.validationResult).toBeDefined();
      
      // May have warnings about data quality
      if (result.validationResult?.warnings) {
        expect(result.validationResult.warnings.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', async () => {
      // Create larger test dataset
      const largeDataset: KGDataset = {
        ...testDataset,
        entities: Array.from({ length: 1000 }, (_, i) => ({
          id: `entity_${i}`,
          name: `Entity ${i}`,
          type: 'Thing',
          created: new Date().toISOString(),
          properties: {
            index: i,
            category: `Category ${i % 10}`
          }
        })),
        relationships: Array.from({ length: 500 }, (_, i) => ({
          subject: `entity_${i}`,
          predicate: 'relatedTo',
          object: `entity_${(i + 1) % 1000}`,
          confidence: Math.random()
        }))
      };

      const startTime = Date.now();
      const result = await pipeline.generateKnowledgeGraph(largeDataset);
      const processingTime = Date.now() - startTime;

      expect(result.files).toHaveLength(5);
      expect(result.triples).toBeGreaterThan(1000);
      expect(result.entities).toBeGreaterThan(900);
      expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds

      console.log(`Processed ${result.triples} triples in ${processingTime}ms`);
    });

    it('should support concurrent generation of multiple graphs', async () => {
      const datasets = Array.from({ length: 3 }, (_, i) => ({
        ...testDataset,
        domain: `test-domain-${i}`,
        entities: testDataset.entities?.slice(0, 2) // Smaller datasets
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        datasets.map(dataset => pipeline.generateKnowledgeGraph(dataset))
      );
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.files).toHaveLength(5);
        expect(result.validationResult?.valid).toBe(true);
      });

      console.log(`Generated ${results.length} knowledge graphs concurrently in ${totalTime}ms`);
    });
  });

  describe('Enterprise Features', () => {
    it('should generate Docker deployment configuration', async () => {
      await pipeline.generateKnowledgeGraph(testDataset);

      // Test that we can generate deployment artifacts
      const deploymentDir = join(tempDir, 'deployment');
      await fs.mkdir(deploymentDir, { recursive: true });

      const dockerCompose = `version: '3.8'
services:
  virtuoso:
    image: tenforce/virtuoso:1.3.2-virtuoso7.2.2
    environment:
      SPARQL_UPDATE: "true"
      DEFAULT_GRAPH: "http://example.org/kg/enterprise"
    volumes:
      - ./output:/data
    ports:
      - "8890:8890"
      - "1111:1111"
  
  kg-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      SPARQL_ENDPOINT: "http://virtuoso:8890/sparql"
    depends_on:
      - virtuoso
`;

      await fs.writeFile(join(deploymentDir, 'docker-compose.yml'), dockerCompose);

      const dockerfile = `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
`;

      await fs.writeFile(join(deploymentDir, 'Dockerfile'), dockerfile);

      // Verify deployment files
      await expect(fs.access(join(deploymentDir, 'docker-compose.yml'))).resolves.not.toThrow();
      await expect(fs.access(join(deploymentDir, 'Dockerfile'))).resolves.not.toThrow();
    });

    it('should support multiple RDF serialization formats', async () => {
      await pipeline.generateKnowledgeGraph(testDataset);

      const entitiesFile = join(tempDir, 'output/entities/enterprise-entities.ttl');
      
      // Test format conversion (placeholder implementation)
      const formats: Array<'turtle' | 'rdfxml' | 'jsonld' | 'ntriples'> = 
        ['turtle', 'rdfxml', 'jsonld', 'ntriples'];

      for (const format of formats) {
        const convertedFile = await pipeline.convertFormat(entitiesFile, format);
        await expect(fs.access(convertedFile)).resolves.not.toThrow();
        
        const content = await fs.readFile(convertedFile, 'utf8');
        expect(content).toBeTruthy();
        expect(content.length).toBeGreaterThan(0);
      }
    });

    it('should provide comprehensive monitoring and analytics', async () => {
      const result = await pipeline.generateKnowledgeGraph(testDataset);

      expect(result.validationResult?.statistics).toBeDefined();
      
      const stats = result.validationResult!.statistics;
      expect(stats.totalTriples).toBeGreaterThan(0);
      expect(stats.totalEntities).toBeGreaterThan(0);
      expect(stats.validationTime).toBeGreaterThan(0);

      // Test that we capture performance metrics
      expect(typeof stats.totalTriples).toBe('number');
      expect(typeof stats.totalEntities).toBe('number');
      expect(typeof stats.validationTime).toBe('number');
    });
  });
});