import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import { Store, DataFactory, Parser } from 'n3';
import { SemanticMetricsCollector } from '../../src/lib/performance/semantic-metrics';
import { MemoryMonitor } from '../../src/lib/performance/memory-monitor';
import { QueryOptimizer, createQueryPattern } from '../../src/lib/performance/query-optimizer';

const { namedNode, literal, quad } = DataFactory;

interface EnterpriseDataset {
  domain: 'healthcare' | 'financial' | 'supply-chain';
  size: number;
  complexity: 'simple' | 'moderate' | 'complex';
  expectedTriples: number;
  performanceThresholds: {
    maxParsingTime: number; // milliseconds
    maxMemoryUsage: number; // MB
    maxQueryTime: number; // milliseconds
  };
}

class EnterpriseDataProcessor {
  private store: Store;
  private metricsCollector: SemanticMetricsCollector;
  private memoryMonitor: MemoryMonitor;
  private queryOptimizer: QueryOptimizer;

  constructor() {
    this.store = new Store();
    this.metricsCollector = new SemanticMetricsCollector();
    this.memoryMonitor = new MemoryMonitor();
    this.queryOptimizer = new QueryOptimizer(this.store);
  }

  async generateHealthcareData(size: number): Promise<string> {
    const triples: string[] = [];
    const prefixes = `
      @prefix fhir: <http://hl7.org/fhir/> .
      @prefix sct: <http://snomed.info/sct/> .
      @prefix loinc: <http://loinc.org/> .
    `;

    // Generate FHIR-like healthcare data
    for (let i = 0; i < size; i++) {
      const patientId = `fhir:Patient/${i}`;
      const observationId = `fhir:Observation/${i}`;
      const conditionId = `fhir:Condition/${i}`;
      
      // Patient demographics
      triples.push(`${patientId} fhir:name "Patient-${i}" .`);
      triples.push(`${patientId} fhir:gender "${i % 2 === 0 ? 'male' : 'female'}" .`);
      triples.push(`${patientId} fhir:birthDate "${1950 + (i % 50)}-${(i % 12) + 1}-${(i % 28) + 1}" .`);
      
      // Clinical observations
      triples.push(`${observationId} fhir:subject ${patientId} .`);
      triples.push(`${observationId} fhir:code loinc:${29463 + (i % 1000)} .`);
      triples.push(`${observationId} fhir:valueQuantity "${80 + (i % 40)}" .`);
      triples.push(`${observationId} fhir:effectiveDateTime "2024-${(i % 12) + 1}-${(i % 28) + 1}" .`);
      
      // Medical conditions
      triples.push(`${conditionId} fhir:subject ${patientId} .`);
      triples.push(`${conditionId} fhir:code sct:${38341003 + (i % 10000)} .`);
      triples.push(`${conditionId} fhir:clinicalStatus "active" .`);
      
      // Care relationships
      if (i > 0) {
        const careTeamId = `fhir:CareTeam/${i}`;
        triples.push(`${careTeamId} fhir:subject ${patientId} .`);
        triples.push(`${careTeamId} fhir:participant fhir:Practitioner/${i % 100} .`);
      }
    }

    return prefixes + triples.join('\n');
  }

  async generateFinancialData(size: number): Promise<string> {
    const triples: string[] = [];
    const prefixes = `
      @prefix fibo: <https://spec.edmcouncil.org/fibo/ontology/> .
      @prefix fin: <http://example.org/finance/> .
      @prefix iso: <http://www.omg.org/techprocess/ab/SpecificationMetadata/> .
    `;

    // Generate FIBO-like financial data
    for (let i = 0; i < size; i++) {
      const instrumentId = `fin:Instrument/${i}`;
      const portfolioId = `fin:Portfolio/${i % 1000}`;
      const riskId = `fin:Risk/${i}`;
      const transactionId = `fin:Transaction/${i}`;
      
      // Financial instruments
      triples.push(`${instrumentId} fibo:hasIdentifier "ISIN-${String(i).padStart(12, '0')}" .`);
      triples.push(`${instrumentId} fibo:hasAssetClass "${['equity', 'bond', 'derivative', 'commodity'][i % 4]}" .`);
      triples.push(`${instrumentId} fibo:hasMarketValue "${(1000 + (i % 9000)) * 1.5}" .`);
      triples.push(`${instrumentId} fibo:hasCurrency "USD" .`);
      
      // Portfolio holdings
      triples.push(`${portfolioId} fibo:hasHolding ${instrumentId} .`);
      triples.push(`${portfolioId} fibo:hasQuantity "${1000 + (i % 5000)}" .`);
      triples.push(`${portfolioId} fibo:hasValuationDate "2024-09-06" .`);
      
      // Risk assessments
      triples.push(`${riskId} fibo:hasSubject ${instrumentId} .`);
      triples.push(`${riskId} fibo:hasRiskMeasure "${0.01 + (i % 100) / 1000}" .`);
      triples.push(`${riskId} fibo:hasRiskType "${['market', 'credit', 'operational', 'liquidity'][i % 4]}" .`);
      
      // Transactions
      triples.push(`${transactionId} fibo:hasInstrument ${instrumentId} .`);
      triples.push(`${transactionId} fibo:hasAmount "${(10000 + (i % 90000)) * 1.2}" .`);
      triples.push(`${transactionId} fibo:hasTimestamp "2024-09-06T${(i % 24).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}:00Z" .`);
      triples.push(`${transactionId} fibo:hasCounterparty fin:Entity/${i % 500} .`);
    }

    return prefixes + triples.join('\n');
  }

  async generateSupplyChainData(size: number): Promise<string> {
    const triples: string[] = [];
    const prefixes = `
      @prefix gs1: <https://gs1.org/> .
      @prefix supply: <http://example.org/supply/> .
      @prefix geo: <http://www.w3.org/2003/01/geo/wgs84_pos#> .
    `;

    // Generate GS1-like supply chain data
    for (let i = 0; i < size; i++) {
      const productId = `supply:Product/${i}`;
      const locationId = `supply:Location/${i % 1000}`;
      const eventId = `supply:Event/${i}`;
      const traceId = `supply:TraceabilityRecord/${i}`;
      
      // Product information
      triples.push(`${productId} gs1:gtin "01234567${String(i % 100000000).padStart(8, '0')}" .`);
      triples.push(`${productId} gs1:productName "Product-${i}" .`);
      triples.push(`${productId} gs1:hasCategory "${['electronics', 'food', 'textiles', 'automotive', 'pharma'][i % 5]}" .`);
      triples.push(`${productId} gs1:hasBrand "Brand-${i % 100}" .`);
      
      // Location data
      triples.push(`${locationId} gs1:gln "123456${String(i % 10000000).padStart(7, '0')}" .`);
      triples.push(`${locationId} gs1:locationName "Facility-${i % 1000}" .`);
      triples.push(`${locationId} geo:lat "${40.7128 + (i % 180) - 90}" .`);
      triples.push(`${locationId} geo:long "${-74.0060 + (i % 360) - 180}" .`);
      
      // Supply chain events
      triples.push(`${eventId} gs1:hasProduct ${productId} .`);
      triples.push(`${eventId} gs1:hasLocation ${locationId} .`);
      triples.push(`${eventId} gs1:eventType "${['production', 'shipping', 'receiving', 'transformation'][i % 4]}" .`);
      triples.push(`${eventId} gs1:eventTime "2024-${((i % 365) / 30 + 1).toFixed(0).padStart(2, '0')}-${((i % 30) + 1).toString().padStart(2, '0')}T${(i % 24).toString().padStart(2, '0')}:00:00Z" .`);
      
      // Traceability records
      triples.push(`${traceId} gs1:hasEvent ${eventId} .`);
      triples.push(`${traceId} gs1:hasQuantity "${100 + (i % 900)}" .`);
      triples.push(`${traceId} gs1:hasUnitOfMeasure "EA" .`);
      
      // Supply chain relationships
      if (i > 0) {
        const previousEvent = `supply:Event/${i - 1}`;
        triples.push(`${eventId} supply:previousEvent ${previousEvent} .`);
      }
    }

    return prefixes + triples.join('\n');
  }

  async processEnterpriseDataset(dataset: EnterpriseDataset): Promise<{
    parsingTime: number;
    memoryUsage: number;
    queryPerformance: {
      simpleQueries: number;
      complexQueries: number;
      aggregateQueries: number;
    };
    dataQuality: {
      tripleCount: number;
      entityCount: number;
      propertyCount: number;
    };
    scalabilityMetrics: {
      throughput: number; // triples/second
      efficiency: number; // MB per 1K triples
    };
  }> {
    // Start monitoring
    this.metricsCollector.startCollection(1000);
    this.memoryMonitor.startMonitoring(1000);

    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    // Generate appropriate dataset
    let rdfData: string;
    switch (dataset.domain) {
      case 'healthcare':
        rdfData = await this.generateHealthcareData(dataset.size);
        break;
      case 'financial':
        rdfData = await this.generateFinancialData(dataset.size);
        break;
      case 'supply-chain':
        rdfData = await this.generateSupplyChainData(dataset.size);
        break;
      default:
        throw new Error(`Unknown domain: ${dataset.domain}`);
    }

    // Parse RDF data
    const parser = new Parser();
    let tripleCount = 0;
    
    await new Promise((resolve, reject) => {
      parser.parse(rdfData, (error, quad, prefixes) => {
        if (error) {
          reject(error);
          return;
        }
        
        if (quad) {
          this.store.addQuad(quad);
          tripleCount++;
        } else {
          resolve(null);
        }
      });
    });

    const parsingTime = performance.now() - startTime;
    const memoryAfterParsing = process.memoryUsage();
    const memoryUsage = (memoryAfterParsing.heapUsed - startMemory.heapUsed) / (1024 * 1024);

    // Performance queries
    const queryStartTime = performance.now();
    
    // Simple queries
    const simpleQueryResults = await Promise.all([
      this.queryOptimizer.executeQuery(createQueryPattern(null, 'http://example.org/hasName', null)),
      this.queryOptimizer.executeQuery(createQueryPattern(null, 'http://example.org/hasType', null)),
      this.queryOptimizer.executeQuery(createQueryPattern(null, null, '"active"'))
    ]);
    
    const simpleQueriesTime = performance.now() - queryStartTime;
    
    // Complex queries
    const complexQueryStartTime = performance.now();
    const complexQueryResults = await Promise.all([
      this.performDomainSpecificQuery(dataset.domain, 'aggregation'),
      this.performDomainSpecificQuery(dataset.domain, 'join'),
      this.performDomainSpecificQuery(dataset.domain, 'filter')
    ]);
    
    const complexQueriesTime = performance.now() - complexQueryStartTime;

    // Aggregate queries (simulate complex analytical queries)
    const aggregateQueryStartTime = performance.now();
    const aggregateResults = await this.performAggregateQueries(dataset.domain);
    const aggregateQueriesTime = performance.now() - aggregateQueryStartTime;

    // Data quality analysis
    const entities = new Set<string>();
    const properties = new Set<string>();
    
    for (const quad of this.store) {
      entities.add(quad.subject.value);
      properties.add(quad.predicate.value);
      if (quad.object.termType === 'NamedNode') {
        entities.add(quad.object.value);
      }
    }

    // Calculate scalability metrics
    const totalTime = performance.now() - startTime;
    const throughput = (tripleCount / totalTime) * 1000; // triples per second
    const efficiency = memoryUsage / (tripleCount / 1000); // MB per 1K triples

    // Stop monitoring
    this.metricsCollector.stopCollection();
    this.memoryMonitor.stopMonitoring();

    return {
      parsingTime,
      memoryUsage,
      queryPerformance: {
        simpleQueries: simpleQueriesTime,
        complexQueries: complexQueriesTime,
        aggregateQueries: aggregateQueriesTime
      },
      dataQuality: {
        tripleCount,
        entityCount: entities.size,
        propertyCount: properties.size
      },
      scalabilityMetrics: {
        throughput,
        efficiency
      }
    };
  }

  private async performDomainSpecificQuery(domain: string, queryType: string): Promise<any[]> {
    switch (domain) {
      case 'healthcare':
        return this.performHealthcareQuery(queryType);
      case 'financial':
        return this.performFinancialQuery(queryType);
      case 'supply-chain':
        return this.performSupplyChainQuery(queryType);
      default:
        return [];
    }
  }

  private async performHealthcareQuery(queryType: string): Promise<any[]> {
    switch (queryType) {
      case 'aggregation':
        // Find patients by gender distribution
        const malePatients = await this.queryOptimizer.executeQuery(
          createQueryPattern(null, 'http://hl7.org/fhir/gender', '"male"')
        );
        return malePatients.results;
        
      case 'join':
        // Join patients with their observations
        const patientObservations: any[] = [];
        const patients = this.store.getQuads(null, namedNode('http://hl7.org/fhir/name'), null);
        for (const patientQuad of Array.from(patients).slice(0, 100)) { // Limit for performance
          const observations = this.store.getQuads(null, namedNode('http://hl7.org/fhir/subject'), patientQuad.subject);
          patientObservations.push(...observations);
        }
        return patientObservations;
        
      case 'filter':
        // Filter recent observations
        const recentObs = this.store.getQuads(null, namedNode('http://hl7.org/fhir/effectiveDateTime'), null);
        return Array.from(recentObs).filter(quad => 
          quad.object.value.includes('2024') && parseInt(quad.object.value.split('-')[1]) >= 6
        );
        
      default:
        return [];
    }
  }

  private async performFinancialQuery(queryType: string): Promise<any[]> {
    switch (queryType) {
      case 'aggregation':
        // Aggregate portfolio values
        const portfolios = this.store.getQuads(null, namedNode('https://spec.edmcouncil.org/fibo/ontology/hasMarketValue'), null);
        return Array.from(portfolios);
        
      case 'join':
        // Join instruments with their risks
        const instrumentRisks: any[] = [];
        const instruments = this.store.getQuads(null, namedNode('https://spec.edmcouncil.org/fibo/ontology/hasIdentifier'), null);
        for (const instrQuad of Array.from(instruments).slice(0, 100)) {
          const risks = this.store.getQuads(null, namedNode('https://spec.edmcouncil.org/fibo/ontology/hasSubject'), instrQuad.subject);
          instrumentRisks.push(...risks);
        }
        return instrumentRisks;
        
      case 'filter':
        // Filter high-value transactions
        const transactions = this.store.getQuads(null, namedNode('https://spec.edmcouncil.org/fibo/ontology/hasAmount'), null);
        return Array.from(transactions).filter(quad => {
          const amount = parseFloat(quad.object.value);
          return amount > 50000;
        });
        
      default:
        return [];
    }
  }

  private async performSupplyChainQuery(queryType: string): Promise<any[]> {
    switch (queryType) {
      case 'aggregation':
        // Aggregate products by category
        const categories = this.store.getQuads(null, namedNode('https://gs1.org/hasCategory'), null);
        return Array.from(categories);
        
      case 'join':
        // Join products with their locations
        const productLocations: any[] = [];
        const products = this.store.getQuads(null, namedNode('https://gs1.org/gtin'), null);
        for (const prodQuad of Array.from(products).slice(0, 100)) {
          const events = this.store.getQuads(null, namedNode('https://gs1.org/hasProduct'), prodQuad.subject);
          productLocations.push(...events);
        }
        return productLocations;
        
      case 'filter':
        // Filter recent events
        const events = this.store.getQuads(null, namedNode('https://gs1.org/eventTime'), null);
        return Array.from(events).filter(quad => 
          quad.object.value.includes('2024-09')
        );
        
      default:
        return [];
    }
  }

  private async performAggregateQueries(domain: string): Promise<number> {
    // Simulate complex analytical queries that would be common in each domain
    const startTime = performance.now();
    
    // Count entities by type
    const typeCount = new Map<string, number>();
    for (const quad of this.store) {
      const type = quad.predicate.value;
      typeCount.set(type, (typeCount.get(type) || 0) + 1);
    }
    
    // Calculate some aggregate statistics
    let totalCalculations = 0;
    for (const [type, count] of typeCount.entries()) {
      totalCalculations += count * Math.log(count); // Simulate complex calculation
    }
    
    return performance.now() - startTime;
  }

  cleanup(): void {
    this.store = new Store();
    this.metricsCollector.cleanup();
    this.memoryMonitor.cleanup();
    this.queryOptimizer.cleanup();
  }
}

describe('Enterprise Data Processing Validation', () => {
  let processor: EnterpriseDataProcessor;

  beforeAll(() => {
    processor = new EnterpriseDataProcessor();
  });

  afterAll(() => {
    processor.cleanup();
  });

  describe('Healthcare Data Processing (FHIR)', () => {
    const healthcareDatasets: EnterpriseDataset[] = [
      {
        domain: 'healthcare',
        size: 10000, // 10K patients
        complexity: 'moderate',
        expectedTriples: 50000,
        performanceThresholds: {
          maxParsingTime: 15000, // 15 seconds
          maxMemoryUsage: 500, // 500MB
          maxQueryTime: 200 // 200ms
        }
      },
      {
        domain: 'healthcare',
        size: 100000, // 100K patients
        complexity: 'complex',
        expectedTriples: 500000,
        performanceThresholds: {
          maxParsingTime: 60000, // 60 seconds
          maxMemoryUsage: 2048, // 2GB
          maxQueryTime: 500 // 500ms
        }
      }
    ];

    it('should process 10K FHIR patient records efficiently', async () => {
      const dataset = healthcareDatasets[0];
      const results = await processor.processEnterpriseDataset(dataset);
      
      expect(results.dataQuality.tripleCount).toBeGreaterThan(40000);
      expect(results.parsingTime).toBeLessThan(dataset.performanceThresholds.maxParsingTime);
      expect(results.memoryUsage).toBeLessThan(dataset.performanceThresholds.maxMemoryUsage);
      expect(results.queryPerformance.simpleQueries).toBeLessThan(dataset.performanceThresholds.maxQueryTime);
      expect(results.scalabilityMetrics.throughput).toBeGreaterThan(100); // At least 100 triples/sec
      
      console.log(`Healthcare 10K - Parsing: ${results.parsingTime.toFixed(2)}ms, Memory: ${results.memoryUsage.toFixed(2)}MB`);
      console.log(`Healthcare 10K - Throughput: ${results.scalabilityMetrics.throughput.toFixed(2)} triples/sec`);
    }, 30000);

    it('should scale to 100K FHIR patient records', async () => {
      const dataset = healthcareDatasets[1];
      const results = await processor.processEnterpriseDataset(dataset);
      
      expect(results.dataQuality.tripleCount).toBeGreaterThan(400000);
      expect(results.parsingTime).toBeLessThan(dataset.performanceThresholds.maxParsingTime);
      expect(results.memoryUsage).toBeLessThan(dataset.performanceThresholds.maxMemoryUsage);
      expect(results.queryPerformance.complexQueries).toBeLessThan(1000); // 1 second for complex queries
      expect(results.scalabilityMetrics.efficiency).toBeLessThan(10); // Less than 10MB per 1K triples
      
      console.log(`Healthcare 100K - Parsing: ${results.parsingTime.toFixed(2)}ms, Memory: ${results.memoryUsage.toFixed(2)}MB`);
      console.log(`Healthcare 100K - Complex queries: ${results.queryPerformance.complexQueries.toFixed(2)}ms`);
    }, 120000);
  });

  describe('Financial Data Processing (FIBO)', () => {
    const financialDatasets: EnterpriseDataset[] = [
      {
        domain: 'financial',
        size: 50000, // 50K financial instruments
        complexity: 'complex',
        expectedTriples: 200000,
        performanceThresholds: {
          maxParsingTime: 30000, // 30 seconds
          maxMemoryUsage: 1024, // 1GB
          maxQueryTime: 300 // 300ms
        }
      },
      {
        domain: 'financial',
        size: 200000, // 200K instruments for risk calculation
        complexity: 'complex',
        expectedTriples: 800000,
        performanceThresholds: {
          maxParsingTime: 90000, // 90 seconds
          maxMemoryUsage: 4096, // 4GB
          maxQueryTime: 800 // 800ms
        }
      }
    ];

    it('should process 50K financial instruments with risk data', async () => {
      const dataset = financialDatasets[0];
      const results = await processor.processEnterpriseDataset(dataset);
      
      expect(results.dataQuality.tripleCount).toBeGreaterThan(180000);
      expect(results.parsingTime).toBeLessThan(dataset.performanceThresholds.maxParsingTime);
      expect(results.memoryUsage).toBeLessThan(dataset.performanceThresholds.maxMemoryUsage);
      expect(results.queryPerformance.aggregateQueries).toBeLessThan(dataset.performanceThresholds.maxQueryTime);
      
      console.log(`Financial 50K - Entities: ${results.dataQuality.entityCount}, Properties: ${results.dataQuality.propertyCount}`);
      console.log(`Financial 50K - Aggregate queries: ${results.queryPerformance.aggregateQueries.toFixed(2)}ms`);
    }, 60000);

    it('should handle 200K financial instruments for portfolio risk calculation', async () => {
      const dataset = financialDatasets[1];
      const results = await processor.processEnterpriseDataset(dataset);
      
      expect(results.dataQuality.tripleCount).toBeGreaterThan(700000);
      expect(results.parsingTime).toBeLessThan(dataset.performanceThresholds.maxParsingTime);
      expect(results.memoryUsage).toBeLessThan(dataset.performanceThresholds.maxMemoryUsage);
      expect(results.scalabilityMetrics.throughput).toBeGreaterThan(50); // At least 50 triples/sec for complex data
      
      console.log(`Financial 200K - Memory efficiency: ${results.scalabilityMetrics.efficiency.toFixed(2)}MB per 1K triples`);
      console.log(`Financial 200K - Processing throughput: ${results.scalabilityMetrics.throughput.toFixed(2)} triples/sec`);
    }, 180000);
  });

  describe('Supply Chain Data Processing (GS1)', () => {
    const supplyChainDatasets: EnterpriseDataset[] = [
      {
        domain: 'supply-chain',
        size: 200000, // 200K products
        complexity: 'complex',
        expectedTriples: 1000000,
        performanceThresholds: {
          maxParsingTime: 120000, // 2 minutes
          maxMemoryUsage: 3072, // 3GB
          maxQueryTime: 600 // 600ms
        }
      },
      {
        domain: 'supply-chain',
        size: 1000000, // 1M products for full traceability
        complexity: 'complex',
        expectedTriples: 5000000,
        performanceThresholds: {
          maxParsingTime: 300000, // 5 minutes
          maxMemoryUsage: 8192, // 8GB
          maxQueryTime: 1500 // 1.5 seconds
        }
      }
    ];

    it('should process 200K supply chain products with traceability', async () => {
      const dataset = supplyChainDatasets[0];
      const results = await processor.processEnterpriseDataset(dataset);
      
      expect(results.dataQuality.tripleCount).toBeGreaterThan(800000);
      expect(results.parsingTime).toBeLessThan(dataset.performanceThresholds.maxParsingTime);
      expect(results.memoryUsage).toBeLessThan(dataset.performanceThresholds.maxMemoryUsage);
      expect(results.queryPerformance.complexQueries).toBeLessThan(dataset.performanceThresholds.maxQueryTime);
      
      console.log(`Supply Chain 200K - Triples: ${results.dataQuality.tripleCount}`);
      console.log(`Supply Chain 200K - Complex query performance: ${results.queryPerformance.complexQueries.toFixed(2)}ms`);
    }, 240000);

    it('should scale to 1M products for full enterprise traceability', async () => {
      const dataset = supplyChainDatasets[1];
      const results = await processor.processEnterpriseDataset(dataset);
      
      expect(results.dataQuality.tripleCount).toBeGreaterThan(4000000);
      expect(results.parsingTime).toBeLessThan(dataset.performanceThresholds.maxParsingTime);
      expect(results.memoryUsage).toBeLessThan(dataset.performanceThresholds.maxMemoryUsage);
      expect(results.scalabilityMetrics.throughput).toBeGreaterThan(300); // High throughput for large datasets
      
      // This is the ultimate test - processing 1M supply chain entities
      console.log(`Supply Chain 1M - Total triples: ${results.dataQuality.tripleCount}`);
      console.log(`Supply Chain 1M - Final memory usage: ${results.memoryUsage.toFixed(2)}MB`);
      console.log(`Supply Chain 1M - Final throughput: ${results.scalabilityMetrics.throughput.toFixed(2)} triples/sec`);
    }, 600000); // 10 minute timeout for ultimate scale test
  });

  describe('Cross-Domain Performance Validation', () => {
    it('should maintain consistent performance across all domains', async () => {
      const testSize = 5000;
      const domains: Array<EnterpriseDataset['domain']> = ['healthcare', 'financial', 'supply-chain'];
      const results: Array<{
        domain: string;
        throughput: number;
        efficiency: number;
        queryTime: number;
      }> = [];

      for (const domain of domains) {
        const dataset: EnterpriseDataset = {
          domain,
          size: testSize,
          complexity: 'moderate',
          expectedTriples: testSize * 4,
          performanceThresholds: {
            maxParsingTime: 10000,
            maxMemoryUsage: 500,
            maxQueryTime: 200
          }
        };

        const result = await processor.processEnterpriseDataset(dataset);
        results.push({
          domain,
          throughput: result.scalabilityMetrics.throughput,
          efficiency: result.scalabilityMetrics.efficiency,
          queryTime: result.queryPerformance.simpleQueries
        });

        // Reset for next test
        processor.cleanup();
        processor = new EnterpriseDataProcessor();
      }

      // Validate performance consistency (within 2x variance)
      const throughputs = results.map(r => r.throughput);
      const efficiencies = results.map(r => r.efficiency);
      const queryTimes = results.map(r => r.queryTime);

      const maxThroughput = Math.max(...throughputs);
      const minThroughput = Math.min(...throughputs);
      const maxEfficiency = Math.max(...efficiencies);
      const minEfficiency = Math.min(...efficiencies);
      const maxQueryTime = Math.max(...queryTimes);
      const minQueryTime = Math.min(...queryTimes);

      expect(maxThroughput / minThroughput).toBeLessThan(2); // Within 2x variance
      expect(maxEfficiency / minEfficiency).toBeLessThan(2);
      expect(maxQueryTime / minQueryTime).toBeLessThan(2);

      console.log('Cross-domain performance comparison:');
      results.forEach(r => {
        console.log(`${r.domain}: ${r.throughput.toFixed(2)} triples/sec, ${r.efficiency.toFixed(2)} MB/1K triples, ${r.queryTime.toFixed(2)}ms queries`);
      });
    }, 60000);
  });
});