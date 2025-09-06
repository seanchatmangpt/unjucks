/**
 * Fortune 5 Deployment Scenarios
 * Demonstrates generating deployment configurations from semantic enterprise models
 * Uses RDF organization ontology to generate Kubernetes/Docker configs
 */

import { UnjucksGenerator } from '../../src/lib/generator';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader';
import { N3 } from 'n3';

// Sample enterprise organization ontology in Turtle format
const enterpriseOntology = `
@prefix org: <http://www.w3.org/ns/org#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix dc: <http://purl.org/dc/terms/> .
@prefix deploy: <http://enterprise.com/deployment#> .

# Enterprise Organization Structure
<http://enterprise.com/org/global> a org:Organization ;
    foaf:name "Global Enterprise Corp" ;
    org:hasSubOrganization <http://enterprise.com/org/americas>,
                          <http://enterprise.com/org/emea>,
                          <http://enterprise.com/org/apac> .

<http://enterprise.com/org/americas> a org:Organization ;
    foaf:name "Americas Division" ;
    deploy:region "us-east-1" ;
    deploy:scalingPolicy "high-availability" ;
    deploy:complianceLevel "SOX" ;
    deploy:trafficPattern "peak-business-hours" .

<http://enterprise.com/org/emea> a org:Organization ;
    foaf:name "EMEA Division" ;
    deploy:region "eu-west-1" ;
    deploy:scalingPolicy "cost-optimized" ;
    deploy:complianceLevel "GDPR" ;
    deploy:trafficPattern "24x7" .

<http://enterprise.com/org/apac> a org:Organization ;
    foaf:name "APAC Division" ;
    deploy:region "ap-southeast-1" ;
    deploy:scalingPolicy "burst-capacity" ;
    deploy:complianceLevel "local" ;
    deploy:trafficPattern "asia-business-hours" .

# Service Definitions
<http://enterprise.com/service/customer-api> a deploy:Service ;
    dc:title "Customer Management API" ;
    deploy:port 8080 ;
    deploy:healthCheck "/health" ;
    deploy:resources [ deploy:cpu "500m" ; deploy:memory "1Gi" ] ;
    deploy:autoscale [ deploy:minReplicas 2 ; deploy:maxReplicas 20 ] .

<http://enterprise.com/service/analytics> a deploy:Service ;
    dc:title "Analytics Engine" ;
    deploy:port 9000 ;
    deploy:healthCheck "/metrics" ;
    deploy:resources [ deploy:cpu "2" ; deploy:memory "4Gi" ] ;
    deploy:autoscale [ deploy:minReplicas 1 ; deploy:maxReplicas 10 ] .
`;

/**
 * Generate deployment configurations for each division
 */
export async function generateFortuneDeployments(): Promise<void> {
  const generator = new UnjucksGenerator();
  const rdfLoader = new RDFDataLoader();
  
  try {
    // Parse the enterprise ontology
    const store = rdfLoader.parseInline(enterpriseOntology, 'text/turtle');
    
    // Extract divisions and their deployment requirements
    const divisions = await extractDivisions(store);
    const services = await extractServices(store);
    
    // Generate deployment configs for each division
    for (const division of divisions) {
      // Generate Kubernetes deployment
      await generator.generate('k8s-deployment', {
        organizationName: division.name,
        region: division.region,
        scalingPolicy: division.scalingPolicy,
        complianceLevel: division.complianceLevel,
        trafficPattern: division.trafficPattern,
        services: services.map(service => ({
          name: service.name.toLowerCase().replace(/\s+/g, '-'),
          title: service.title,
          port: service.port,
          healthCheck: service.healthCheck,
          resources: service.resources,
          autoscale: service.autoscale
        })),
        to: `deployments/${division.name.toLowerCase().replace(/\s+/g, '-')}/k8s-deployment.yaml`
      });
      
      // Generate Docker Compose for local development
      await generator.generate('docker-compose', {
        organizationName: division.name,
        services: services,
        to: `deployments/${division.name.toLowerCase().replace(/\s+/g, '-')}/docker-compose.yml`
      });
      
      // Generate Terraform infrastructure
      await generator.generate('terraform-infrastructure', {
        organizationName: division.name,
        region: division.region,
        complianceLevel: division.complianceLevel,
        to: `deployments/${division.name.toLowerCase().replace(/\s+/g, '-')}/infrastructure.tf`
      });
      
      // Generate monitoring configuration
      await generator.generate('monitoring-config', {
        organizationName: division.name,
        services: services,
        trafficPattern: division.trafficPattern,
        to: `deployments/${division.name.toLowerCase().replace(/\s+/g, '-')}/monitoring.yml`
      });
    }
    
    console.log('✅ Fortune 5 deployment configurations generated successfully');
    
  } catch (error) {
    console.error('❌ Failed to generate deployments:', error);
    throw error;
  }
}

/**
 * Extract division information from RDF store
 */
async function extractDivisions(store: N3.Store): Promise<Array<{
  name: string;
  region: string;
  scalingPolicy: string;
  complianceLevel: string;
  trafficPattern: string;
}>> {
  const divisions: any[] = [];
  
  // Query for all divisions
  const divisionQuads = store.getQuads(
    null,
    N3.DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
    N3.DataFactory.namedNode('http://www.w3.org/ns/org#Organization'),
    null
  );
  
  for (const quad of divisionQuads) {
    const divisionUri = quad.subject.value;
    
    // Skip the global organization
    if (divisionUri.includes('/global')) continue;
    
    const name = store.getQuads(quad.subject, N3.DataFactory.namedNode('http://xmlns.com/foaf/0.1/name'), null, null)[0]?.object.value || '';
    const region = store.getQuads(quad.subject, N3.DataFactory.namedNode('http://enterprise.com/deployment#region'), null, null)[0]?.object.value || '';
    const scalingPolicy = store.getQuads(quad.subject, N3.DataFactory.namedNode('http://enterprise.com/deployment#scalingPolicy'), null, null)[0]?.object.value || '';
    const complianceLevel = store.getQuads(quad.subject, N3.DataFactory.namedNode('http://enterprise.com/deployment#complianceLevel'), null, null)[0]?.object.value || '';
    const trafficPattern = store.getQuads(quad.subject, N3.DataFactory.namedNode('http://enterprise.com/deployment#trafficPattern'), null, null)[0]?.object.value || '';
    
    divisions.push({
      name,
      region,
      scalingPolicy,
      complianceLevel,
      trafficPattern
    });
  }
  
  return divisions;
}

/**
 * Extract service information from RDF store
 */
async function extractServices(store: N3.Store): Promise<Array<{
  name: string;
  title: string;
  port: number;
  healthCheck: string;
  resources: { cpu: string; memory: string };
  autoscale: { minReplicas: number; maxReplicas: number };
}>> {
  const services: any[] = [];
  
  // Query for all services
  const serviceQuads = store.getQuads(
    null,
    N3.DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
    N3.DataFactory.namedNode('http://enterprise.com/deployment#Service'),
    null
  );
  
  for (const quad of serviceQuads) {
    const serviceUri = quad.subject.value;
    const name = serviceUri.split('/').pop() || '';
    
    const title = store.getQuads(quad.subject, N3.DataFactory.namedNode('http://purl.org/dc/terms/title'), null, null)[0]?.object.value || '';
    const port = parseInt(store.getQuads(quad.subject, N3.DataFactory.namedNode('http://enterprise.com/deployment#port'), null, null)[0]?.object.value || '8080');
    const healthCheck = store.getQuads(quad.subject, N3.DataFactory.namedNode('http://enterprise.com/deployment#healthCheck'), null, null)[0]?.object.value || '/health';
    
    // Extract nested resource information
    const resourcesNode = store.getQuads(quad.subject, N3.DataFactory.namedNode('http://enterprise.com/deployment#resources'), null, null)[0]?.object;
    const cpu = resourcesNode ? store.getQuads(resourcesNode, N3.DataFactory.namedNode('http://enterprise.com/deployment#cpu'), null, null)[0]?.object.value || '500m' : '500m';
    const memory = resourcesNode ? store.getQuads(resourcesNode, N3.DataFactory.namedNode('http://enterprise.com/deployment#memory'), null, null)[0]?.object.value || '1Gi' : '1Gi';
    
    // Extract autoscale information
    const autoscaleNode = store.getQuads(quad.subject, N3.DataFactory.namedNode('http://enterprise.com/deployment#autoscale'), null, null)[0]?.object;
    const minReplicas = autoscaleNode ? parseInt(store.getQuads(autoscaleNode, N3.DataFactory.namedNode('http://enterprise.com/deployment#minReplicas'), null, null)[0]?.object.value || '2') : 2;
    const maxReplicas = autoscaleNode ? parseInt(store.getQuads(autoscaleNode, N3.DataFactory.namedNode('http://enterprise.com/deployment#maxReplicas'), null, null)[0]?.object.value || '10') : 10;
    
    services.push({
      name,
      title,
      port,
      healthCheck,
      resources: { cpu, memory },
      autoscale: { minReplicas, maxReplicas }
    });
  }
  
  return services;
}

// Example usage with different enterprise scenarios
if (require.main === module) {
  generateFortuneDeployments().catch(console.error);
}

/**
 * Example generated output structure:
 * 
 * deployments/
 * ├── americas-division/
 * │   ├── k8s-deployment.yaml     # High-availability Kubernetes config
 * │   ├── docker-compose.yml      # Local development setup
 * │   ├── infrastructure.tf       # SOX-compliant Terraform
 * │   └── monitoring.yml          # Peak hours monitoring
 * ├── emea-division/
 * │   ├── k8s-deployment.yaml     # Cost-optimized Kubernetes config
 * │   ├── docker-compose.yml      # GDPR-compliant development setup
 * │   ├── infrastructure.tf       # GDPR infrastructure
 * │   └── monitoring.yml          # 24x7 monitoring
 * └── apac-division/
 *     ├── k8s-deployment.yaml     # Burst-capacity Kubernetes config
 *     ├── docker-compose.yml      # Asia-localized development
 *     ├── infrastructure.tf       # Regional infrastructure
 *     └── monitoring.yml          # Asia business hours monitoring
 */
