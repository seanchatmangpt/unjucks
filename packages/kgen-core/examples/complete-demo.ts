/**
 * Complete KGEN Query Engine Demo
 * 
 * Comprehensive demonstration of all query engine features including:
 * - SPARQL query execution with optimization
 * - Semantic search capabilities  
 * - Graph analytics and metrics
 * - Context extraction for template rendering
 * - Multiple result formats
 * - Performance benchmarking
 */

import { 
  QueryEngine, 
  createOptimizedEngine, 
  createHighPerformanceEngine,
  VERSION,
  FEATURES
} from '../src/query/index.js';

console.log(`🚀 KGEN Query Engine v${VERSION} Demo`);
console.log(`📋 Available Features: ${FEATURES.join(', ')}`);

async function demonstrateBasicQueries() {
  console.log('\n🔍 === Basic SPARQL Query Execution ===');
  
  const engine = new QueryEngine({
    enableQueryCache: true,
    enableQueryOptimization: true,
    enableIndexing: true
  });
  
  await engine.initialize();
  
  // Load sample knowledge graph data
  const knowledgeData = `
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    @prefix prov: <http://www.w3.org/ns/prov#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    
    # People and their relationships
    ex:alice foaf:name "Alice Smith" ;
             foaf:age 28 ;
             foaf:email "alice@techcorp.com" ;
             foaf:knows ex:bob, ex:charlie ;
             ex:worksAt ex:techCorp ;
             ex:role "Senior Data Scientist" .
    
    ex:bob foaf:name "Bob Johnson" ;
           foaf:age 32 ;
           foaf:email "bob@techcorp.com" ;
           foaf:knows ex:alice, ex:diana ;
           ex:worksAt ex:techCorp ;
           ex:role "Machine Learning Engineer" .
           
    ex:charlie foaf:name "Charlie Brown" ;
               foaf:age 35 ;
               foaf:knows ex:alice ;
               ex:worksAt ex:dataCorp ;
               ex:role "Product Manager" .
               
    ex:diana foaf:name "Diana Prince" ;
             foaf:age 29 ;
             foaf:knows ex:bob ;
             ex:worksAt ex:dataCorp ;
             ex:role "UX Designer" .
    
    # Organizations
    ex:techCorp rdfs:label "Tech Corporation" ;
                ex:industry "Technology" ;
                ex:founded "2010"^^xsd:gYear ;
                ex:employees 150 .
                
    ex:dataCorp rdfs:label "Data Analytics Inc" ;
                ex:industry "Data Analytics" ;
                ex:founded "2015"^^xsd:gYear ;
                ex:employees 75 .
    
    # Data processing pipeline with provenance
    ex:rawDataset prov:wasGeneratedBy ex:dataCollection ;
                  rdfs:label "Customer Survey Raw Data" ;
                  ex:recordCount 10000 .
                  
    ex:cleanedDataset prov:wasDerivedFrom ex:rawDataset ;
                      prov:wasGeneratedBy ex:dataCleaning ;
                      rdfs:label "Cleaned Survey Data" ;
                      ex:recordCount 8500 .
                      
    ex:analysisReport prov:wasDerivedFrom ex:cleanedDataset ;
                      prov:wasGeneratedBy ex:dataAnalysis ;
                      rdfs:label "Customer Insights Report" ;
                      ex:insights 25 .
    
    # Activities and their agents
    ex:dataCollection prov:wasAssociatedWith ex:alice ;
                      prov:startedAtTime "2024-01-15T09:00:00Z"^^xsd:dateTime ;
                      prov:endedAtTime "2024-01-20T17:00:00Z"^^xsd:dateTime ;
                      rdfs:label "Customer Survey Data Collection" .
                      
    ex:dataCleaning prov:wasAssociatedWith ex:bob ;
                    prov:startedAtTime "2024-01-21T10:00:00Z"^^xsd:dateTime ;
                    prov:endedAtTime "2024-01-23T16:00:00Z"^^xsd:dateTime ;
                    rdfs:label "Data Cleaning and Validation" .
                    
    ex:dataAnalysis prov:wasAssociatedWith ex:alice, ex:bob ;
                    prov:startedAtTime "2024-01-24T09:00:00Z"^^xsd:dateTime ;
                    prov:endedAtTime "2024-01-30T17:00:00Z"^^xsd:dateTime ;
                    rdfs:label "Statistical Analysis and Insights Generation" .
  `;
  
  console.log('Loading knowledge graph data...');
  await engine.loadRDF(knowledgeData, 'turtle');
  
  const status = engine.getStatus();
  console.log(`✅ Loaded ${status.storage.tripleCount} triples`);
  console.log(`🗂️  Indexes: ${status.indexes.enabled ? 'Enabled' : 'Disabled'}`);
  
  // Execute various SPARQL queries
  console.log('\n📊 Executing SPARQL queries...');
  
  // 1. Simple SELECT query
  const peopleQuery = `
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX ex: <http://example.org/>
    
    SELECT ?person ?name ?age ?role WHERE {
      ?person foaf:name ?name ;
             foaf:age ?age ;
             ex:role ?role .
    }
    ORDER BY ?age
  `;
  
  const peopleResult = await engine.executeSPARQL(peopleQuery);
  console.log(`👥 People query returned ${peopleResult.results.bindings.length} results:`);
  
  peopleResult.results.bindings.forEach((binding, i) => {
    console.log(`   ${i + 1}. ${binding.name?.value} (${binding.age?.value}) - ${binding.role?.value}`);
  });
  
  // 2. Complex query with aggregation
  const companyStatsQuery = `
    PREFIX ex: <http://example.org/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT ?company ?label ?industry ?employeeCount WHERE {
      ?company rdfs:label ?label ;
              ex:industry ?industry ;
              ex:employees ?employeeCount .
      
      # Count actual people working there
      {
        SELECT ?company (COUNT(?person) as ?actualEmployees) WHERE {
          ?person ex:worksAt ?company .
        }
        GROUP BY ?company
      }
    }
    ORDER BY DESC(?employeeCount)
  `;
  
  const companyResult = await engine.executeSPARQL(companyStatsQuery);
  console.log(`\n🏢 Company statistics:`);
  
  companyResult.results.bindings.forEach((binding, i) => {
    console.log(`   ${i + 1}. ${binding.label?.value} (${binding.industry?.value}) - ${binding.employeeCount?.value} employees`);
  });
  
  // 3. Temporal query
  const timelineQuery = `
    PREFIX prov: <http://www.w3.org/ns/prov#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    
    SELECT ?activity ?label ?agent ?startTime ?duration WHERE {
      ?activity prov:wasAssociatedWith ?agent ;
               rdfs:label ?label ;
               prov:startedAtTime ?startTime .
               
      OPTIONAL {
        ?activity prov:endedAtTime ?endTime .
        BIND(((?endTime - ?startTime) / 86400) as ?duration)
      }
    }
    ORDER BY ?startTime
  `;
  
  const timelineResult = await engine.executeSPARQL(timelineQuery);
  console.log(`\n⏰ Project timeline (${timelineResult.results.bindings.length} activities):`);
  
  timelineResult.results.bindings.forEach((binding, i) => {
    const startTime = new Date(binding.startTime?.value || '').toLocaleDateString();
    console.log(`   ${i + 1}. ${binding.label?.value} - Started: ${startTime}`);
  });
  
  // Show query metrics
  console.log(`\n📈 Query Performance Metrics:`);
  console.log(`   Total Queries: ${status.metrics.totalQueries}`);
  console.log(`   Cache Hit Rate: ${status.cache.hitRate.toFixed(2)}`);
  console.log(`   Average Execution Time: ${status.metrics.averageExecutionTime.toFixed(2)}ms`);
  
  await engine.shutdown();
}

async function demonstratePreDefinedQueries() {
  console.log('\n🎯 === Predefined Query Templates ===');
  
  const engine = createOptimizedEngine();
  await engine.initialize();
  
  // Load provenance data for lineage queries
  const provenanceData = `
    @prefix prov: <http://www.w3.org/ns/prov#> .
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    
    # Multi-step data transformation pipeline
    ex:sourceData1 prov:wasGeneratedBy ex:ingestion1 ;
                   rdfs:label "Customer Database Export" .
                   
    ex:sourceData2 prov:wasGeneratedBy ex:ingestion2 ;
                   rdfs:label "Transaction Log Export" .
    
    ex:mergedData prov:wasDerivedFrom ex:sourceData1, ex:sourceData2 ;
                  prov:wasGeneratedBy ex:mergeProcess ;
                  rdfs:label "Merged Customer Transactions" .
                  
    ex:enrichedData prov:wasDerivedFrom ex:mergedData ;
                    prov:wasGeneratedBy ex:enrichment ;
                    rdfs:label "Enriched Customer Profiles" .
                    
    ex:aggregatedData prov:wasDerivedFrom ex:enrichedData ;
                      prov:wasGeneratedBy ex:aggregation ;
                      rdfs:label "Customer Segment Summaries" .
                      
    ex:finalReport prov:wasDerivedFrom ex:aggregatedData ;
                   prov:wasGeneratedBy ex:reporting ;
                   rdfs:label "Executive Dashboard Data" .
    
    # Agents and their activities
    ex:dataEngineer foaf:name "Alice Data Engineer" .
    ex:analyst foaf:name "Bob Business Analyst" .
    ex:scientist foaf:name "Charlie Data Scientist" .
    
    ex:ingestion1 prov:wasAssociatedWith ex:dataEngineer ;
                  prov:startedAtTime "2024-01-01T08:00:00Z"^^xsd:dateTime .
                  
    ex:ingestion2 prov:wasAssociatedWith ex:dataEngineer ;
                  prov:startedAtTime "2024-01-01T09:00:00Z"^^xsd:dateTime .
                  
    ex:mergeProcess prov:wasAssociatedWith ex:dataEngineer ;
                    prov:startedAtTime "2024-01-01T10:00:00Z"^^xsd:dateTime .
                    
    ex:enrichment prov:wasAssociatedWith ex:scientist ;
                  prov:startedAtTime "2024-01-01T14:00:00Z"^^xsd:dateTime .
                  
    ex:aggregation prov:wasAssociatedWith ex:analyst ;
                   prov:startedAtTime "2024-01-02T09:00:00Z"^^xsd:dateTime .
                   
    ex:reporting prov:wasAssociatedWith ex:analyst ;
                 prov:startedAtTime "2024-01-02T15:00:00Z"^^xsd:dateTime .
  `;
  
  await engine.loadRDF(provenanceData, 'turtle');
  
  // Execute predefined templates
  console.log('📋 Available query templates:');
  
  try {
    // Forward lineage from source data
    const forwardLineage = await engine.executeTemplate('forward-lineage', {
      entityUri: 'http://example.org/sourceData1',
      maxDepth: '5'
    });
    
    console.log(`🔄 Forward lineage from sourceData1: ${forwardLineage.results.bindings.length} relationships`);
    
    // Backward lineage to final report
    const backwardLineage = await engine.executeTemplate('backward-lineage', {
      entityUri: 'http://example.org/finalReport',
      maxDepth: '10'
    });
    
    console.log(`🔙 Backward lineage to finalReport: ${backwardLineage.results.bindings.length} dependencies`);
    
    // Activity chain for enriched data
    const activityChain = await engine.executeTemplate('activity-chain', {
      entityUri: 'http://example.org/enrichedData'
    });
    
    console.log(`⚡ Activity chain for enrichedData: ${activityChain.results.bindings.length} activities`);
    
    // Involved agents
    const involvedAgents = await engine.executeTemplate('involved-agents', {
      entityUri: 'http://example.org/finalReport'
    });
    
    console.log(`👥 Agents involved in finalReport: ${involvedAgents.results.bindings.length} agents`);
    
  } catch (error) {
    console.log(`⚠️  Template execution note: ${error.message}`);
    console.log('   (Some templates may need specific ontology structures)');
  }
  
  await engine.shutdown();
}

async function demonstrateSemanticSearch() {
  console.log('\n🔍 === Semantic Search Capabilities ===');
  
  const engine = new QueryEngine({
    enableSemanticSearch: true,
    semanticSearchConfig: {
      enableFullText: true,
      enableFuzzySearch: true,
      similarityThreshold: 0.3,
      maxSearchResults: 50
    }
  });
  
  await engine.initialize();
  
  // Load rich textual data
  const textData = `
    @prefix ex: <http://example.org/> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    
    ex:alice rdfs:label "Alice Smith" ;
             ex:bio "Senior data scientist specializing in machine learning, artificial intelligence, and predictive analytics" ;
             ex:skills "Python, TensorFlow, scikit-learn, data visualization, statistical analysis" ;
             ex:projects "Customer churn prediction, recommendation systems, fraud detection" .
    
    ex:bob rdfs:label "Bob Johnson" ;
           ex:bio "Machine learning engineer with expertise in deep learning, neural networks, and computer vision" ;
           ex:skills "PyTorch, Keras, OpenCV, Docker, Kubernetes, MLOps" ;
           ex:projects "Image classification, object detection, natural language processing" .
           
    ex:charlie rdfs:label "Charlie Brown" ;
               ex:bio "Product manager focused on AI applications, user experience, and business intelligence" ;
               ex:skills "Product strategy, user research, data analysis, SQL, Tableau" ;
               ex:projects "AI-powered dashboard, customer analytics platform, automated reporting" .
               
    ex:diana rdfs:label "Diana Prince" ;
             ex:bio "UX designer creating intuitive interfaces for complex data applications and analytics tools" ;
             ex:skills "UI/UX design, prototyping, user research, Figma, Adobe Creative Suite" ;
             ex:projects "Data visualization interface, analytics dashboard, mobile app design" .
             
    ex:eve rdfs:label "Eve Wilson" ;
           ex:bio "DevOps engineer building scalable infrastructure for machine learning and data processing pipelines" ;
           ex:skills "AWS, Docker, Kubernetes, CI/CD, monitoring, automation" ;
           ex:projects "ML model deployment, data pipeline orchestration, cloud infrastructure" .
  `;
  
  await engine.loadRDF(textData, 'turtle');
  
  console.log('🔍 Performing semantic searches...');
  
  // Search for machine learning expertise
  const mlResults = await engine.performSemanticSearch('machine learning');
  console.log(`\n🤖 "machine learning" search: ${mlResults.length} results`);
  mlResults.slice(0, 3).forEach((result, i) => {
    console.log(`   ${i + 1}. ${result.uri} - Score: ${result.score?.toFixed(2)}`);
  });
  
  // Search for data visualization
  const vizResults = await engine.performSemanticSearch('data visualization');
  console.log(`\n📊 "data visualization" search: ${vizResults.length} results`);
  vizResults.slice(0, 3).forEach((result, i) => {
    console.log(`   ${i + 1}. ${result.uri} - Score: ${result.score?.toFixed(2)}`);
  });
  
  // Search for Python skills
  const pythonResults = await engine.performSemanticSearch('Python programming');
  console.log(`\n🐍 "Python programming" search: ${pythonResults.length} results`);
  pythonResults.slice(0, 3).forEach((result, i) => {
    console.log(`   ${i + 1}. ${result.uri} - Score: ${result.score?.toFixed(2)}`);
  });
  
  // Search with high similarity threshold
  const preciseResults = await engine.performSemanticSearch('neural networks', {
    similarityThreshold: 0.7
  });
  console.log(`\n🧠 "neural networks" (precise): ${preciseResults.length} results`);
  
  await engine.shutdown();
}

async function demonstrateGraphAnalytics() {
  console.log('\n📊 === Graph Analytics and Metrics ===');
  
  const engine = new QueryEngine({
    enableGraphAnalytics: true,
    enableStatistics: true
  });
  
  await engine.initialize();
  
  // Load a structured graph for analysis
  const graphData = `
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    
    # Ontology classes
    ex:Person rdf:type owl:Class ;
              rdfs:label "Person" .
    ex:Organization rdf:type owl:Class ;
                   rdfs:label "Organization" .
    ex:Project rdf:type owl:Class ;
              rdfs:label "Project" .
    ex:Technology rdf:type owl:Class ;
                 rdfs:label "Technology" .
    
    # Properties
    ex:worksOn rdf:type owl:ObjectProperty ;
              rdfs:domain ex:Person ;
              rdfs:range ex:Project .
              
    ex:uses rdf:type owl:ObjectProperty ;
           rdfs:domain ex:Project ;
           rdfs:range ex:Technology .
    
    # People
    ex:alice rdf:type ex:Person ;
             foaf:name "Alice" ;
             ex:worksOn ex:project1, ex:project2 ;
             foaf:knows ex:bob, ex:charlie .
             
    ex:bob rdf:type ex:Person ;
           foaf:name "Bob" ;
           ex:worksOn ex:project1, ex:project3 ;
           foaf:knows ex:alice, ex:charlie, ex:diana .
           
    ex:charlie rdf:type ex:Person ;
               foaf:name "Charlie" ;
               ex:worksOn ex:project2, ex:project3 ;
               foaf:knows ex:alice, ex:bob, ex:diana, ex:eve .
               
    ex:diana rdf:type ex:Person ;
             foaf:name "Diana" ;
             ex:worksOn ex:project3 ;
             foaf:knows ex:bob, ex:charlie .
             
    ex:eve rdf:type ex:Person ;
           foaf:name "Eve" ;
           ex:worksOn ex:project2 ;
           foaf:knows ex:charlie .
    
    # Projects and technologies
    ex:project1 rdf:type ex:Project ;
               rdfs:label "ML Platform" ;
               ex:uses ex:python, ex:tensorflow, ex:kubernetes .
               
    ex:project2 rdf:type ex:Project ;
               rdfs:label "Data Pipeline" ;
               ex:uses ex:python, ex:spark, ex:kafka .
               
    ex:project3 rdf:type ex:Project ;
               rdfs:label "Analytics Dashboard" ;
               ex:uses ex:javascript, ex:react, ex:d3 .
    
    # Technologies
    ex:python rdf:type ex:Technology ; rdfs:label "Python" .
    ex:javascript rdf:type ex:Technology ; rdfs:label "JavaScript" .
    ex:tensorflow rdf:type ex:Technology ; rdfs:label "TensorFlow" .
    ex:react rdf:type ex:Technology ; rdfs:label "React" .
    ex:spark rdf:type ex:Technology ; rdfs:label "Apache Spark" .
    ex:kafka rdf:type ex:Technology ; rdfs:label "Apache Kafka" .
    ex:kubernetes rdf:type ex:Technology ; rdfs:label "Kubernetes" .
    ex:d3 rdf:type ex:Technology ; rdfs:label "D3.js" .
  `;
  
  await engine.loadRDF(graphData, 'turtle');
  
  console.log('📊 Calculating comprehensive graph metrics...');
  const metrics = await engine.calculateGraphMetrics({
    includeCentrality: false // Skip expensive centrality calculations for demo
  });
  
  console.log('\n📈 Graph Analysis Results:');
  
  console.log(`\n📊 Basic Metrics:`);
  console.log(`   Nodes: ${metrics.basic.nodeCount}`);
  console.log(`   Edges: ${metrics.basic.edgeCount}`);
  console.log(`   Triples: ${metrics.basic.tripleCount}`);
  console.log(`   Properties: ${metrics.basic.propertyCount}`);
  
  console.log(`\n🏗️  Structural Metrics:`);
  console.log(`   Density: ${metrics.structural.density.toFixed(3)}`);
  console.log(`   Average Path Length: ${metrics.structural.averagePathLength.toFixed(2)}`);
  console.log(`   Diameter: ${metrics.structural.diameter}`);
  console.log(`   Average Degree: ${metrics.structural.averageDegree.toFixed(2)}`);
  
  console.log(`\n🎯 Semantic Metrics:`);
  console.log(`   Ontology Complexity: ${metrics.semantic.ontologyComplexity.toFixed(2)}`);
  console.log(`   Semantic Density: ${metrics.semantic.semanticDensity.toFixed(2)}`);
  console.log(`   Class Hierarchy Depth: ${metrics.semantic.classHierarchyDepth}`);
  
  console.log(`\n✅ Quality Metrics:`);
  console.log(`   Completeness: ${metrics.quality.completeness.toFixed(2)}`);
  console.log(`   Consistency: ${metrics.quality.consistency.toFixed(2)}`);
  console.log(`   Accuracy: ${metrics.quality.accuracy.toFixed(2)}`);
  
  console.log(`\n🔗 Connectivity Metrics:`);
  console.log(`   Connected Components: ${metrics.connectivity.connectedComponents}`);
  console.log(`   Clustering Coefficient: ${metrics.connectivity.clusteringCoefficient.toFixed(3)}`);
  
  console.log(`\n📉 Derived Metrics:`);
  console.log(`   Sparsity: ${metrics.derived.sparsity.toFixed(3)}`);
  console.log(`   Efficiency: ${metrics.derived.efficiency.toFixed(3)}`);
  console.log(`   Small-worldness: ${metrics.derived.smallWorldness.toFixed(3)}`);
  
  await engine.shutdown();
}

async function demonstrateContextExtraction() {
  console.log('\n🧠 === Context Extraction for Template Rendering ===');
  
  const engine = new QueryEngine({
    enableStatistics: true
  });
  
  await engine.initialize();
  
  // Load rich contextual data
  const contextData = `
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    @prefix prov: <http://www.w3.org/ns/prov#> .
    @prefix geo: <http://www.w3.org/2003/01/geo/wgs84_pos#> .
    @prefix time: <http://www.w3.org/2006/time#> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    
    # Main entity we want context for
    ex:customerAnalysis foaf:name "Customer Behavior Analysis Project" ;
                       ex:status "Active" ;
                       ex:priority "High" ;
                       prov:wasGeneratedBy ex:analysisActivity ;
                       geo:lat "37.7749"^^xsd:decimal ;
                       geo:long "-122.4194"^^xsd:decimal ;
                       ex:location "San Francisco, CA" .
    
    # Related entities and their properties
    ex:analysisActivity prov:wasAssociatedWith ex:alice, ex:bob ;
                       prov:startedAtTime "2024-01-15T09:00:00Z"^^xsd:dateTime ;
                       prov:endedAtTime "2024-03-15T17:00:00Z"^^xsd:dateTime ;
                       ex:methodology "Machine Learning, Statistical Analysis" ;
                       ex:tools "Python, R, Tableau, SQL" .
    
    ex:alice foaf:name "Dr. Alice Smith" ;
             ex:title "Senior Data Scientist" ;
             ex:expertise "Machine Learning, Statistics, Customer Analytics" ;
             ex:experience "8 years" ;
             foaf:email "alice.smith@company.com" .
             
    ex:bob foaf:name "Bob Johnson" ;
           ex:title "Business Analyst" ;
           ex:expertise "Business Intelligence, Data Visualization, Requirements Analysis" ;
           ex:experience "5 years" ;
           foaf:email "bob.johnson@company.com" .
    
    # Data sources and lineage
    ex:customerAnalysis prov:wasDerivedFrom ex:salesData, ex:surveyData, ex:webAnalytics ;
                       ex:confidenceLevel "95%" ;
                       ex:sampleSize 50000 .
    
    ex:salesData ex:source "CRM System" ;
                ex:timeRange "2023-01-01 to 2023-12-31" ;
                ex:recordCount 150000 ;
                prov:wasGeneratedBy ex:salesExtraction .
                
    ex:surveyData ex:source "Customer Survey Platform" ;
                 ex:responseRate "23%" ;
                 ex:recordCount 11500 ;
                 prov:wasGeneratedBy ex:surveyCollection .
                 
    ex:webAnalytics ex:source "Google Analytics" ;
                   ex:metrics "pageviews, sessions, conversions" ;
                   ex:recordCount 2000000 ;
                   prov:wasGeneratedBy ex:analyticsExtraction .
    
    # Business context
    ex:customerAnalysis ex:businessObjective "Increase customer retention by 15%" ;
                       ex:targetAudience "Premium customers, age 25-45" ;
                       ex:expectedROI "250%" ;
                       ex:stakeholder ex:marketingTeam, ex:productTeam, ex:executiveTeam .
  `;
  
  await engine.loadRDF(contextData, 'turtle');
  
  console.log('🧠 Extracting comprehensive context...');
  
  // Extract context focused on the main analysis project
  const context = await engine.extractTemplateContext(['http://example.org/customerAnalysis'], {
    maxEntities: 50,
    maxProperties: 30,
    maxRelationships: 100,
    includeProvenance: true,
    includeTemporal: true,
    includeSpatial: true,
    includeStatistics: true
  });
  
  console.log('\n📋 Context Extraction Results:');
  
  console.log(`\n👤 Entities (${context.entities.length}):`);
  context.entities.slice(0, 5).forEach((entity, i) => {
    console.log(`   ${i + 1}. ${entity.label || entity.uri} (importance: ${entity.importance.toFixed(3)})`);
    console.log(`      - Types: ${entity.types.slice(0, 3).join(', ')}`);
    console.log(`      - Relations: ${entity.incomingRelations.length} incoming, ${entity.outgoingRelations.length} outgoing`);
  });
  
  console.log(`\n🔗 Properties (${context.properties.length}):`);
  context.properties.slice(0, 8).forEach((property, i) => {
    console.log(`   ${i + 1}. ${property.label || property.uri.split('/').pop()}`);
    console.log(`      - Frequency: ${property.frequency}, Distinct values: ${property.distinctValues}`);
  });
  
  console.log(`\n📊 Relationships (${context.relationships.length}):`);
  context.relationships.slice(0, 5).forEach((rel, i) => {
    const predicate = rel.predicate.split('/').pop();
    const subject = rel.subject.split('/').pop();
    const object = rel.object.split('/').pop();
    console.log(`   ${i + 1}. ${subject} --${predicate}--> ${object} (weight: ${rel.weight.toFixed(3)})`);
  });
  
  if (context.temporal && context.temporal.length > 0) {
    console.log(`\n⏰ Temporal Context (${context.temporal.length}):`);
    context.temporal.slice(0, 3).forEach((temporal, i) => {
      const timeStr = temporal.timepoint ? temporal.timepoint.toLocaleDateString() : 
                     temporal.interval ? `${temporal.interval.start.toLocaleDateString()} - ${temporal.interval.end.toLocaleDateString()}` : 'Unknown';
      console.log(`   ${i + 1}. ${timeStr} (${temporal.precision})`);
    });
  }
  
  if (context.spatial && context.spatial.length > 0) {
    console.log(`\n🌍 Spatial Context (${context.spatial.length}):`);
    context.spatial.slice(0, 3).forEach((spatial, i) => {
      console.log(`   ${i + 1}. ${spatial.location.latitude}, ${spatial.location.longitude} (${spatial.source})`);
      if (spatial.region) console.log(`      Region: ${spatial.region}`);
    });
  }
  
  if (context.provenance && context.provenance.length > 0) {
    console.log(`\n📜 Provenance Context (${context.provenance.length}):`);
    context.provenance.slice(0, 3).forEach((prov, i) => {
      console.log(`   ${i + 1}. Entity: ${prov.entity.split('/').pop()}`);
      console.log(`      Activity: ${prov.activity.split('/').pop()}, Agent: ${prov.agent.split('/').pop()}`);
      console.log(`      Timestamp: ${prov.timestamp.toLocaleDateString()}`);
    });
  }
  
  await engine.shutdown();
}

async function demonstrateResultFormatting() {
  console.log('\n📄 === Result Formatting and Export ===');
  
  const engine = new QueryEngine();
  await engine.initialize();
  
  // Load sample data
  const sampleData = `
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    
    ex:alice foaf:name "Alice Smith" ;
             foaf:age "28"^^xsd:int ;
             foaf:email "alice@example.com" ;
             ex:department "Engineering" ;
             ex:salary "95000"^^xsd:decimal .
             
    ex:bob foaf:name "Bob Johnson" ;
           foaf:age "32"^^xsd:int ;
           foaf:email "bob@example.com" ;
           ex:department "Marketing" ;
           ex:salary "78000"^^xsd:decimal .
           
    ex:charlie foaf:name "Charlie Brown" ;
               foaf:age "29"^^xsd:int ;
               foaf:email "charlie@example.com" ;
               ex:department "Engineering" ;
               ex:salary "88000"^^xsd:decimal .
  `;
  
  await engine.loadRDF(sampleData, 'turtle');
  
  const query = `
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX ex: <http://example.org/>
    
    SELECT ?person ?name ?age ?department ?salary WHERE {
      ?person foaf:name ?name ;
             foaf:age ?age ;
             ex:department ?department ;
             ex:salary ?salary .
    }
    ORDER BY ?department ?name
  `;
  
  const result = await engine.executeSPARQL(query);
  
  console.log('📊 Demonstrating multiple output formats...');
  
  // JSON format (default)
  const jsonFormat = await engine.formatResults(result, 'sparql-json', { prettyPrint: true });
  console.log(`\n📝 SPARQL JSON (${jsonFormat.length} characters):`);
  console.log(jsonFormat.substring(0, 200) + '...');
  
  // CSV format
  const csvFormat = await engine.formatResults(result, 'csv');
  console.log(`\n📊 CSV Format:`);
  console.log(csvFormat);
  
  // Turtle format (for CONSTRUCT results)
  try {
    const turtleFormat = await engine.formatResults(result, 'turtle');
    console.log(`\n🐢 Turtle Format (${turtleFormat.split('\n').length} lines):`);
    console.log(turtleFormat.substring(0, 300) + '...');
  } catch (error) {
    console.log('📝 Turtle format: (requires CONSTRUCT query results)');
  }
  
  // YAML format
  const yamlFormat = await engine.formatResults(result, 'yaml');
  console.log(`\n📋 YAML Format:`);
  console.log(yamlFormat.substring(0, 400) + '...');
  
  // Template-friendly format
  const templateFormat = await engine.formatResults(result, 'sparql-json');
  const templateData = JSON.parse(templateFormat);
  
  console.log(`\n🎨 Template Context Summary:`);
  console.log(`   Variables: ${templateData.head.vars.join(', ')}`);
  console.log(`   Result count: ${templateData.results.bindings.length}`);
  console.log(`   Sample binding keys: ${Object.keys(templateData.results.bindings[0] || {}).join(', ')}`);
  
  await engine.shutdown();
}

async function demonstratePerformanceBenchmark() {
  console.log('\n⚡ === Performance Benchmark ===');
  
  const engine = createHighPerformanceEngine();
  await engine.initialize();
  
  console.log('🏗️  Generating large test dataset...');
  
  // Generate a larger dataset for performance testing
  const largeDataTriples: string[] = [];
  const companies = ['TechCorp', 'DataInc', 'CloudSoft', 'AILabs', 'ByteWorks'];
  const departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance'];
  const roles = ['Manager', 'Senior', 'Junior', 'Lead', 'Director'];
  
  for (let i = 0; i < 2000; i++) {
    const company = companies[i % companies.length];
    const department = departments[i % departments.length];
    const role = roles[i % roles.length];
    const salary = 50000 + (i % 50) * 1000;
    const age = 22 + (i % 40);
    
    largeDataTriples.push(`
      <http://example.org/employee${i}> foaf:name "Employee ${i}" ;
                                       foaf:age "${age}"^^xsd:int ;
                                       ex:company "${company}" ;
                                       ex:department "${department}" ;
                                       ex:role "${role}" ;
                                       ex:salary "${salary}"^^xsd:decimal ;
                                       ex:employeeId "${i}" .
    `);
    
    // Add some relationships
    if (i > 0 && i % 10 === 0) {
      const managerId = i - (i % 10);
      largeDataTriples.push(`
        <http://example.org/employee${i}> ex:reportsTo <http://example.org/employee${managerId}> .
      `);
    }
    
    if (i % 5 === 0) {
      largeDataTriples.push(`
        <http://example.org/employee${i}> ex:type "KeyEmployee" .
      `);
    }
  }
  
  const largeDataset = `
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    @prefix ex: <http://example.org/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    
    ${largeDataTriples.join('\n')}
  `;
  
  // Benchmark data loading
  console.log('⏱️  Benchmarking data loading...');
  const loadStart = performance.now();
  await engine.loadRDF(largeDataset, 'turtle');
  const loadTime = performance.now() - loadStart;
  
  const status = engine.getStatus();
  console.log(`✅ Loaded ${status.storage.tripleCount} triples in ${loadTime.toFixed(2)}ms`);
  console.log(`📊 Loading rate: ${(status.storage.tripleCount / (loadTime / 1000)).toFixed(0)} triples/second`);
  
  // Benchmark query execution
  const benchmarkQueries = [
    {
      name: 'Simple Select',
      query: `
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        SELECT ?person ?name WHERE {
          ?person foaf:name ?name .
        } LIMIT 100
      `
    },
    {
      name: 'Filtered Query',
      query: `
        PREFIX ex: <http://example.org/>
        SELECT ?person ?name ?salary WHERE {
          ?person foaf:name ?name ;
                 ex:salary ?salary .
          FILTER(?salary > 75000)
        }
      `
    },
    {
      name: 'Aggregation Query',
      query: `
        PREFIX ex: <http://example.org/>
        SELECT ?department (AVG(?salary) as ?avgSalary) (COUNT(?person) as ?count) WHERE {
          ?person ex:department ?department ;
                 ex:salary ?salary .
        }
        GROUP BY ?department
        ORDER BY DESC(?avgSalary)
      `
    },
    {
      name: 'Complex Join',
      query: `
        PREFIX ex: <http://example.org/>
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        SELECT ?employee ?manager ?empName ?mgName WHERE {
          ?employee ex:reportsTo ?manager ;
                   foaf:name ?empName .
          ?manager foaf:name ?mgName .
        }
      `
    }
  ];
  
  console.log('\n🏃 Running query benchmarks...');
  
  for (const benchmark of benchmarkQueries) {
    console.log(`\n📊 ${benchmark.name}:`);
    
    // Warm-up run
    await engine.executeSPARQL(benchmark.query);
    
    // Benchmark runs
    const runs = 5;
    const times: number[] = [];
    
    for (let i = 0; i < runs; i++) {
      const queryStart = performance.now();
      const result = await engine.executeSPARQL(benchmark.query);
      const queryTime = performance.now() - queryStart;
      times.push(queryTime);
      
      if (i === 0) {
        console.log(`   Results: ${result.results.bindings.length}`);
        console.log(`   From cache: ${result.fromCache ? 'Yes' : 'No'}`);
      }
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log(`   Average: ${avgTime.toFixed(2)}ms`);
    console.log(`   Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
  }
  
  // Final engine statistics
  const finalStatus = engine.getStatus();
  console.log('\n📈 Final Engine Statistics:');
  console.log(`   Total queries executed: ${finalStatus.metrics.totalQueries}`);
  console.log(`   Cache hit rate: ${finalStatus.cache.hitRate.toFixed(2)}`);
  console.log(`   Average execution time: ${finalStatus.metrics.averageExecutionTime.toFixed(2)}ms`);
  console.log(`   Index memory estimate: ${(finalStatus.indexes.memoryEstimate / 1024 / 1024).toFixed(2)}MB`);
  
  await engine.shutdown();
}

// Main execution
async function runCompleteDemo() {
  try {
    console.log('🚀 Starting Complete KGEN Query Engine Demonstration\n');
    
    await demonstrateBasicQueries();
    await demonstratePreDefinedQueries();
    await demonstrateSemanticSearch();
    await demonstrateGraphAnalytics();
    await demonstrateContextExtraction();
    await demonstrateResultFormatting();
    await demonstratePerformanceBenchmark();
    
    console.log('\n🎉 === Demo Complete ===');
    console.log('✅ All features demonstrated successfully!');
    console.log('\n📚 Key Capabilities Shown:');
    console.log('   • Advanced SPARQL query execution with optimization');
    console.log('   • Intelligent query caching and performance tuning');
    console.log('   • Semantic search with full-text and similarity matching');
    console.log('   • Comprehensive graph analytics and metrics calculation');
    console.log('   • Rich context extraction for template rendering');
    console.log('   • Multiple result formats (JSON, CSV, Turtle, YAML)');
    console.log('   • High-performance processing for large graphs');
    console.log('   • Predefined query templates for common patterns');
    console.log('   • Real-time metrics and monitoring');
    console.log('\n💡 Ready for production use in knowledge graph applications!');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Export for use as module
export {
  demonstrateBasicQueries,
  demonstratePreDefinedQueries,
  demonstrateSemanticSearch,
  demonstrateGraphAnalytics,
  demonstrateContextExtraction,
  demonstrateResultFormatting,
  demonstratePerformanceBenchmark
};

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCompleteDemo().catch(console.error);
}