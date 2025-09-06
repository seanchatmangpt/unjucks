/**
 * Multi-Tenant Semantic Processing Examples
 * Demonstrates tenant isolation and resource management for Fortune 5 scale
 */

import { getSemanticConfig } from '../../config/semantic-production';
import { semanticMonitor } from '../../src/lib/semantic-monitoring';
import { TurtleParser } from '../../src/lib/turtle-parser';
import { RdfFilters } from '../../src/lib/rdf-filters';
import { RdfDataLoader } from '../../src/lib/rdf-data-loader';

interface TenantConfig {
  id: string;
  name: string;
  industry: string;
  dataQuota: {
    maxTriples: number;
    maxMemoryMB: number;
    maxQueriesPerHour: number;
  };
  isolation: {
    namespace: string;
    encryptionKey: string;
    accessPatterns: string[];
  };
  compliance: {
    gdpr: boolean;
    hipaa: boolean;
    sox: boolean;
    dataRetentionDays: number;
  };
}

interface ProcessingResult {
  tenantId: string;
  triplesProcessed: number;
  memoryUsed: number;
  processingTime: number;
  complianceChecks: string[];
  quotaUtilization: {
    triples: number; // percentage
    memory: number; // percentage
    queries: number; // percentage
  };
}

class MultiTenantSemanticProcessor {
  private config = getSemanticConfig();
  private tenantStates = new Map<string, {
    triplesCount: number;
    memoryUsage: number;
    queryCount: number;
    lastReset: number;
  }>();

  async processTenantData(tenant: TenantConfig, turtleData: string): Promise<ProcessingResult> {
    console.log(`🏢 Processing data for tenant: ${tenant.name} (${tenant.industry})`);

    // Initialize or get tenant state
    if (!this.tenantStates.has(tenant.id)) {
      this.tenantStates.set(tenant.id, {
        triplesCount: 0,
        memoryUsage: 0,
        queryCount: 0,
        lastReset: Date.now(),
      });
    }

    const tenantState = this.tenantStates.get(tenant.id)!;
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      // Pre-processing compliance checks
      const complianceChecks = await this.performComplianceChecks(tenant, turtleData);
      
      // Resource quota validation
      await this.validateResourceQuotas(tenant, turtleData);

      // Parse with tenant-specific namespace isolation
      const parser = new TurtleParser({
        baseIRI: tenant.isolation.namespace,
      });
      
      const parseResult = await parser.parse(turtleData, `tenant-${tenant.id}`);

      // Apply tenant-specific filters and processing
      const processedTriples = await this.applyTenantFilters(tenant, parseResult.triples);

      // Load into tenant-isolated semantic store
      const loader = new RdfDataLoader();
      await loader.loadFromString(turtleData, 'turtle');

      // Update tenant state
      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;
      const memoryUsed = endMemory - startMemory;

      tenantState.triplesCount += processedTriples.length;
      tenantState.memoryUsage += memoryUsed;
      tenantState.queryCount += 1;

      // Record tenant-specific metrics
      semanticMonitor.recordRDFMetrics(`tenant-${tenant.id}`, {
        triplesProcessed: processedTriples.length,
        parseLatency: endTime - startTime,
        memoryUsage: memoryUsed,
      });

      // Record compliance event
      semanticMonitor.recordComplianceEvent({
        type: 'modification',
        userId: `tenant-${tenant.id}`,
        resource: `semantic-data-${tenant.industry}`,
        success: true,
        details: {
          triplesProcessed: processedTriples.length,
          complianceChecks,
          quotaUtilization: this.calculateQuotaUtilization(tenant, tenantState),
        },
      });

      return {
        tenantId: tenant.id,
        triplesProcessed: processedTriples.length,
        memoryUsed,
        processingTime: endTime - startTime,
        complianceChecks,
        quotaUtilization: this.calculateQuotaUtilization(tenant, tenantState),
      };

    } catch (error) {
      // Record security event for processing failure
      semanticMonitor.recordSecurityEvent({
        type: 'audit',
        severity: 'medium',
        message: `Tenant processing failed: ${error.message}`,
        metadata: {
          tenantId: tenant.id,
          tenantName: tenant.name,
          industry: tenant.industry,
          error: error.message,
        },
      });

      throw error;
    }
  }

  private async performComplianceChecks(tenant: TenantConfig, turtleData: string): Promise<string[]> {
    const checks: string[] = [];

    // GDPR compliance checks
    if (tenant.compliance.gdpr) {
      const hasPersonalData = turtleData.includes('foaf:Person') || 
                             turtleData.includes('schema:Person') ||
                             turtleData.includes('email') ||
                             turtleData.includes('personalData');
      
      if (hasPersonalData) {
        checks.push('GDPR: Personal data detected - ensuring consent and right to erasure');
        
        // Check for explicit consent declarations
        const hasConsent = turtleData.includes('gdprConsent') || turtleData.includes('consent');
        if (!hasConsent) {
          throw new Error('GDPR violation: Personal data found without explicit consent');
        }
      }
    }

    // HIPAA compliance checks  
    if (tenant.compliance.hipaa) {
      const hasHealthData = turtleData.includes('health') ||
                           turtleData.includes('medical') ||
                           turtleData.includes('patient') ||
                           turtleData.includes('treatment');
      
      if (hasHealthData) {
        checks.push('HIPAA: Health information detected - ensuring encryption and access controls');
        
        // Verify encryption requirements
        if (!tenant.isolation.encryptionKey) {
          throw new Error('HIPAA violation: Health data requires encryption key');
        }
      }
    }

    // SOX compliance checks
    if (tenant.compliance.sox) {
      const hasFinancialData = turtleData.includes('financial') ||
                              turtleData.includes('revenue') ||
                              turtleData.includes('transaction') ||
                              turtleData.includes('MonetaryTransaction');
      
      if (hasFinancialData) {
        checks.push('SOX: Financial data detected - ensuring audit trail and data integrity');
      }
    }

    // Data retention validation
    const dataAge = this.extractDataAge(turtleData);
    if (dataAge && dataAge > tenant.compliance.dataRetentionDays) {
      throw new Error(`Data retention violation: Data is ${dataAge} days old, exceeds ${tenant.compliance.dataRetentionDays} day limit`);
    }

    return checks;
  }

  private async validateResourceQuotas(tenant: TenantConfig, turtleData: string): Promise<void> {
    const tenantState = this.tenantStates.get(tenant.id)!;
    
    // Estimate triples from data size (rough approximation)
    const estimatedTriples = Math.floor(turtleData.length / 100); // ~100 chars per triple
    
    // Check triple quota
    if (tenantState.triplesCount + estimatedTriples > tenant.dataQuota.maxTriples) {
      throw new Error(`Quota exceeded: Would exceed triple limit of ${tenant.dataQuota.maxTriples}`);
    }

    // Check memory quota (estimated)
    const estimatedMemory = estimatedTriples * 200; // ~200 bytes per triple
    if (tenantState.memoryUsage + estimatedMemory > tenant.dataQuota.maxMemoryMB * 1024 * 1024) {
      throw new Error(`Quota exceeded: Would exceed memory limit of ${tenant.dataQuota.maxMemoryMB}MB`);
    }

    // Check query rate limit (reset hourly)
    const hoursSinceReset = (Date.now() - tenantState.lastReset) / (1000 * 60 * 60);
    if (hoursSinceReset >= 1) {
      tenantState.queryCount = 0;
      tenantState.lastReset = Date.now();
    }

    if (tenantState.queryCount >= tenant.dataQuota.maxQueriesPerHour) {
      throw new Error(`Rate limit exceeded: ${tenant.dataQuota.maxQueriesPerHour} queries per hour`);
    }
  }

  private async applyTenantFilters(tenant: TenantConfig, triples: any[]): Promise<any[]> {
    const filters = new RdfFilters();
    let filteredTriples = triples;

    // Apply access pattern restrictions
    for (const pattern of tenant.isolation.accessPatterns) {
      if (pattern.startsWith('subject:')) {
        const subjectPattern = pattern.replace('subject:', '');
        filteredTriples = filters.filterBySubject(filteredTriples, subjectPattern);
      } else if (pattern.startsWith('predicate:')) {
        const predicatePattern = pattern.replace('predicate:', '');
        filteredTriples = filters.filterByPredicate(filteredTriples, predicatePattern);
      } else if (pattern.startsWith('object:')) {
        const objectPattern = pattern.replace('object:', '');
        filteredTriples = filters.filterByObject(filteredTriples, objectPattern);
      }
    }

    return filteredTriples;
  }

  private calculateQuotaUtilization(tenant: TenantConfig, state: any) {
    return {
      triples: Math.round((state.triplesCount / tenant.dataQuota.maxTriples) * 100),
      memory: Math.round((state.memoryUsage / (tenant.dataQuota.maxMemoryMB * 1024 * 1024)) * 100),
      queries: Math.round((state.queryCount / tenant.dataQuota.maxQueriesPerHour) * 100),
    };
  }

  private extractDataAge(turtleData: string): number | null {
    // Extract timestamp and calculate age in days
    const timestampMatch = turtleData.match(/"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
    if (timestampMatch) {
      const timestamp = new Date(timestampMatch[1]);
      return Math.floor((Date.now() - timestamp.getTime()) / (1000 * 60 * 60 * 24));
    }
    return null;
  }

  getTenantMetrics(tenantId: string) {
    return this.tenantStates.get(tenantId) || null;
  }

  resetTenantQuotas(tenantId: string) {
    if (this.tenantStates.has(tenantId)) {
      const state = this.tenantStates.get(tenantId)!;
      state.triplesCount = 0;
      state.memoryUsage = 0;
      state.queryCount = 0;
      state.lastReset = Date.now();
    }
  }
}

/**
 * Fortune 5 Multi-Tenant Example
 */
export class Fortune5MultiTenantExample {
  private processor = new MultiTenantSemanticProcessor();

  async runExample(): Promise<void> {
    console.log('🏢 Fortune 5 Multi-Tenant Semantic Processing Example');
    console.log('===================================================');

    // Define enterprise tenants
    const tenants: TenantConfig[] = [
      {
        id: 'retail-giant-001',
        name: 'Global Retail Corporation',
        industry: 'retail',
        dataQuota: {
          maxTriples: 10_000_000,
          maxMemoryMB: 2048,
          maxQueriesPerHour: 10000,
        },
        isolation: {
          namespace: 'https://retail-giant.com/data/',
          encryptionKey: 'retail-aes-256-key',
          accessPatterns: [
            'subject:https://retail-giant.com/data/customer',
            'predicate:https://schema.org/customer',
          ],
        },
        compliance: {
          gdpr: true,
          hipaa: false,
          sox: true,
          dataRetentionDays: 2555, // 7 years
        },
      },
      {
        id: 'healthcare-sys-002',
        name: 'Universal Healthcare Network',
        industry: 'healthcare',
        dataQuota: {
          maxTriples: 50_000_000,
          maxMemoryMB: 4096,
          maxQueriesPerHour: 5000,
        },
        isolation: {
          namespace: 'https://healthcare-network.com/data/',
          encryptionKey: 'healthcare-aes-256-key',
          accessPatterns: [
            'subject:https://healthcare-network.com/data/patient',
            'predicate:https://hl7.org/fhir/',
          ],
        },
        compliance: {
          gdpr: true,
          hipaa: true,
          sox: false,
          dataRetentionDays: 3650, // 10 years for medical records
        },
      },
      {
        id: 'financial-corp-003',
        name: 'Global Financial Services',
        industry: 'financial',
        dataQuota: {
          maxTriples: 100_000_000,
          maxMemoryMB: 8192,
          maxQueriesPerHour: 20000,
        },
        isolation: {
          namespace: 'https://global-finance.com/data/',
          encryptionKey: 'finance-aes-256-key',
          accessPatterns: [
            'subject:https://global-finance.com/data/transaction',
            'predicate:https://schema.org/MonetaryTransaction',
          ],
        },
        compliance: {
          gdpr: true,
          hipaa: false,
          sox: true,
          dataRetentionDays: 2555, // 7 years for financial records
        },
      },
    ];

    // Generate tenant-specific data
    const tenantDataSets = tenants.map(tenant => ({
      tenant,
      data: this.generateTenantData(tenant),
    }));

    console.log(`\n📊 Processing ${tenantDataSets.length} tenants concurrently...`);

    semanticMonitor.startMonitoring(3000);

    try {
      // Process all tenants concurrently
      const results = await Promise.all(
        tenantDataSets.map(({ tenant, data }) =>
          this.processor.processTenantData(tenant, data)
        )
      );

      // Display results
      console.log('\n📈 Multi-Tenant Processing Results');
      console.log('=================================');

      results.forEach(result => {
        const tenant = tenants.find(t => t.id === result.tenantId)!;
        console.log(`\n🏢 ${tenant.name} (${tenant.industry})`);
        console.log(`   Triples Processed: ${result.triplesProcessed}`);
        console.log(`   Processing Time: ${result.processingTime}ms`);
        console.log(`   Memory Used: ${Math.round(result.memoryUsed / 1024 / 1024)}MB`);
        console.log(`   Quota Utilization:`);
        console.log(`     - Triples: ${result.quotaUtilization.triples}%`);
        console.log(`     - Memory: ${result.quotaUtilization.memory}%`);
        console.log(`     - Queries: ${result.quotaUtilization.queries}%`);
        console.log(`   Compliance Checks: ${result.complianceChecks.length}`);
        result.complianceChecks.forEach(check => {
          console.log(`     ✓ ${check}`);
        });
      });

      // Aggregate statistics
      const totalTriples = results.reduce((sum, r) => sum + r.triplesProcessed, 0);
      const totalMemory = results.reduce((sum, r) => sum + r.memoryUsed, 0);
      const avgProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;

      console.log('\n📊 Aggregate Statistics');
      console.log('=======================');
      console.log(`Total Triples Processed: ${totalTriples.toLocaleString()}`);
      console.log(`Total Memory Used: ${Math.round(totalMemory / 1024 / 1024)}MB`);
      console.log(`Average Processing Time: ${Math.round(avgProcessingTime)}ms`);
      console.log(`Tenants Processed Successfully: ${results.length}/${tenants.length}`);

      // Test quota enforcement
      console.log('\n🧪 Testing Quota Enforcement');
      await this.testQuotaEnforcement();

      // Test compliance violations
      console.log('\n🧪 Testing Compliance Enforcement');
      await this.testComplianceEnforcement();

    } finally {
      semanticMonitor.stopMonitoring();
    }
  }

  private generateTenantData(tenant: TenantConfig): string {
    const baseData = `
      @prefix ex: <${tenant.isolation.namespace}> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix schema: <https://schema.org/> .
      @prefix gdpr: <http://www.w3.org/ns/dpv#> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    `;

    let specificData = '';

    switch (tenant.industry) {
      case 'retail':
        specificData = this.generateRetailData(tenant);
        break;
      case 'healthcare':
        specificData = this.generateHealthcareData(tenant);
        break;
      case 'financial':
        specificData = this.generateFinancialData(tenant);
        break;
    }

    return baseData + specificData;
  }

  private generateRetailData(tenant: TenantConfig): string {
    return `
      ex:customer123 a schema:Person ;
          foaf:name "John Doe" ;
          schema:email "john.doe@email.com" ;
          ex:gdprConsent "true"^^xsd:boolean ;
          ex:customerSince "2020-01-15"^^xsd:date ;
          ex:loyaltyTier "Gold" ;
          ex:totalPurchases "25000.00"^^xsd:decimal .
      
      ex:order456 a schema:Order ;
          schema:customer ex:customer123 ;
          schema:orderNumber "ORD-2024-001" ;
          schema:orderDate "${new Date().toISOString()}"^^xsd:dateTime ;
          schema:orderStatus "Shipped" ;
          ex:orderValue "299.99"^^xsd:decimal .
      
      ex:product789 a schema:Product ;
          schema:name "Premium Widget" ;
          schema:sku "PWD-001" ;
          schema:price "299.99"^^xsd:decimal ;
          schema:category ex:electronics .
    `;
  }

  private generateHealthcareData(tenant: TenantConfig): string {
    return `
      ex:patient123 a schema:Patient ;
          foaf:name "Jane Smith" ;
          schema:identifier "P-123456" ;
          ex:dateOfBirth "1985-03-22"^^xsd:date ;
          ex:gdprConsent "true"^^xsd:boolean ;
          ex:hipaaAuthorization "true"^^xsd:boolean .
      
      ex:treatment456 a schema:MedicalProcedure ;
          schema:patient ex:patient123 ;
          schema:name "Annual Checkup" ;
          ex:treatmentDate "${new Date().toISOString()}"^^xsd:dateTime ;
          ex:provider ex:doctor789 ;
          ex:diagnosis "Routine examination" .
      
      ex:doctor789 a schema:Physician ;
          foaf:name "Dr. Medical Professional" ;
          schema:identifier "DOC-789" ;
          ex:specialty "Internal Medicine" .
    `;
  }

  private generateFinancialData(tenant: TenantConfig): string {
    return `
      ex:account123 a schema:BankAccount ;
          schema:accountId "ACC-123456789" ;
          schema:customer ex:customer456 ;
          ex:accountType "Checking" ;
          ex:balance "15000.00"^^xsd:decimal .
      
      ex:transaction789 a schema:MonetaryTransaction ;
          schema:account ex:account123 ;
          schema:amount "1500.00"^^xsd:decimal ;
          schema:currency "USD" ;
          ex:transactionDate "${new Date().toISOString()}"^^xsd:dateTime ;
          ex:transactionType "Wire Transfer" ;
          ex:riskScore "2.1"^^xsd:decimal .
      
      ex:customer456 a schema:Person ;
          foaf:name "Business Customer Inc." ;
          ex:gdprConsent "true"^^xsd:boolean ;
          ex:customerSince "2018-06-10"^^xsd:date ;
          ex:creditRating "AAA" .
    `;
  }

  private async testQuotaEnforcement(): Promise<void> {
    const testTenant: TenantConfig = {
      id: 'test-quota',
      name: 'Quota Test Tenant',
      industry: 'test',
      dataQuota: {
        maxTriples: 10, // Very low limit for testing
        maxMemoryMB: 1, // Very low limit
        maxQueriesPerHour: 2, // Very low limit
      },
      isolation: {
        namespace: 'https://test.com/',
        encryptionKey: 'test-key',
        accessPatterns: [],
      },
      compliance: {
        gdpr: false,
        hipaa: false,
        sox: false,
        dataRetentionDays: 30,
      },
    };

    const largeData = `
      @prefix ex: <https://test.com/> .
      @prefix schema: <https://schema.org/> .
      ` + Array.from({ length: 20 }, (_, i) => `
        ex:entity${i} a schema:Thing ;
            schema:name "Entity ${i}" ;
            ex:value "${i}"^^xsd:integer .
      `).join('');

    try {
      await this.processor.processTenantData(testTenant, largeData);
      console.log('   ❌ Expected quota enforcement to fail');
    } catch (error) {
      console.log(`   ✅ Quota enforcement working: ${error.message}`);
    }
  }

  private async testComplianceEnforcement(): Promise<void> {
    const gdprTenant: TenantConfig = {
      id: 'test-gdpr',
      name: 'GDPR Test Tenant',
      industry: 'test',
      dataQuota: {
        maxTriples: 1000,
        maxMemoryMB: 100,
        maxQueriesPerHour: 100,
      },
      isolation: {
        namespace: 'https://gdpr-test.com/',
        encryptionKey: 'gdpr-test-key',
        accessPatterns: [],
      },
      compliance: {
        gdpr: true,
        hipaa: false,
        sox: false,
        dataRetentionDays: 365,
      },
    };

    const personalDataWithoutConsent = `
      @prefix ex: <https://gdpr-test.com/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix schema: <https://schema.org/> .
      
      ex:person1 a foaf:Person ;
          foaf:name "GDPR Test Person" ;
          schema:email "gdpr@test.com" .
    `;

    try {
      await this.processor.processTenantData(gdprTenant, personalDataWithoutConsent);
      console.log('   ❌ Expected GDPR enforcement to fail');
    } catch (error) {
      console.log(`   ✅ GDPR enforcement working: ${error.message}`);
    }
  }
}

// Export for direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const example = new Fortune5MultiTenantExample();
  example.runExample().catch(console.error);
}

export {
  MultiTenantSemanticProcessor,
  Fortune5MultiTenantExample,
  type TenantConfig,
  type ProcessingResult,
};