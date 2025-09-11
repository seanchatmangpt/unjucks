/**
 * Pre-defined SPARQL Query Library
 * 
 * Comprehensive library of optimized SPARQL queries for common use cases,
 * migrated and enhanced from src/kgen/provenance/queries/sparql.js
 */

import { ParsedQuery, QueryResults } from '../types/index.js';

export interface QueryTemplate {
  name: string;
  description: string;
  category: string;
  sparql: string;
  parameters: QueryParameter[];
  examples: QueryExample[];
  complexity: 'low' | 'medium' | 'high';
  estimatedCost: number;
  optimizations: string[];
}

export interface QueryParameter {
  name: string;
  type: 'uri' | 'literal' | 'variable';
  required: boolean;
  description: string;
  example: string;
  validation?: RegExp;
}

export interface QueryExample {
  description: string;
  parameters: Record<string, string>;
  expectedResults: number;
}

export class PreDefinedQueries {
  private templates: Map<string, QueryTemplate> = new Map();
  private categories: Set<string> = new Set();

  constructor() {
    this.initializeProvenanceQueries();
    this.initializeGraphAnalyticsQueries();
    this.initializeComplianceQueries();
    this.initializeSemanticQueries();
    this.initializePerformanceQueries();
  }

  /**
   * Get all available query templates
   */
  getAllTemplates(): QueryTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): QueryTemplate[] {
    return this.getAllTemplates().filter(t => t.category === category);
  }

  /**
   * Get template by name
   */
  getTemplate(name: string): QueryTemplate | undefined {
    return this.templates.get(name);
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    return Array.from(this.categories);
  }

  /**
   * Execute a template with parameters
   */
  executeTemplate(name: string, parameters: Record<string, string>): string {
    const template = this.templates.get(name);
    if (!template) {
      throw new Error(`Template not found: ${name}`);
    }

    let query = template.sparql;
    
    // Validate required parameters
    for (const param of template.parameters) {
      if (param.required && !parameters[param.name]) {
        throw new Error(`Required parameter missing: ${param.name}`);
      }
      
      if (parameters[param.name] && param.validation && !param.validation.test(parameters[param.name])) {
        throw new Error(`Invalid parameter value: ${param.name}`);
      }
    }

    // Replace parameters in query
    for (const [name, value] of Object.entries(parameters)) {
      const placeholder = new RegExp(`{{${name}}}`, 'g');
      query = query.replace(placeholder, value);
    }

    return query;
  }

  /**
   * Search templates by keyword
   */
  searchTemplates(keyword: string): QueryTemplate[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.getAllTemplates().filter(template =>
      template.name.toLowerCase().includes(lowerKeyword) ||
      template.description.toLowerCase().includes(lowerKeyword) ||
      template.sparql.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * Add custom template
   */
  addTemplate(template: QueryTemplate): void {
    this.templates.set(template.name, template);
    this.categories.add(template.category);
  }

  // Private initialization methods

  private initializeProvenanceQueries(): void {
    this.categories.add('provenance');

    // Forward Lineage Query
    this.templates.set('forward-lineage', {
      name: 'forward-lineage',
      description: 'Get forward lineage of an entity showing all derived entities',
      category: 'provenance',
      complexity: 'medium',
      estimatedCost: 500,
      optimizations: ['index-hints', 'limit-pushdown'],
      parameters: [
        {
          name: 'entityUri',
          type: 'uri',
          required: true,
          description: 'URI of the source entity',
          example: 'http://example.org/entity/123'
        },
        {
          name: 'maxDepth',
          type: 'literal',
          required: false,
          description: 'Maximum traversal depth',
          example: '10',
          validation: /^\d+$/
        }
      ],
      examples: [
        {
          description: 'Get lineage for a specific dataset',
          parameters: { entityUri: 'http://example.org/dataset/sales-2024', maxDepth: '5' },
          expectedResults: 15
        }
      ],
      sparql: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/provenance/>
        
        SELECT ?entity ?derivedEntity ?activity ?agent ?timestamp ?depth WHERE {
          <{{entityUri}}> (prov:wasDerivedFrom|^prov:wasDerivedFrom){0,{{maxDepth:10}}} ?entity .
          ?derivedEntity prov:wasDerivedFrom ?entity .
          ?derivedEntity prov:wasGeneratedBy ?activity .
          ?activity prov:wasAssociatedWith ?agent .
          OPTIONAL { ?activity prov:startedAtTime ?timestamp }
          
          # Calculate depth using property path
          <{{entityUri}}> (prov:wasDerivedFrom|^prov:wasDerivedFrom){0,{{maxDepth:10}}} ?entity .
          BIND(1 AS ?depth)
        } 
        ORDER BY ?depth ?timestamp
        LIMIT {{limit:1000}}
      `
    });

    // Backward Lineage Query
    this.templates.set('backward-lineage', {
      name: 'backward-lineage',
      description: 'Get backward lineage of an entity showing all source entities',
      category: 'provenance',
      complexity: 'medium',
      estimatedCost: 450,
      optimizations: ['index-hints', 'join-reordering'],
      parameters: [
        {
          name: 'entityUri',
          type: 'uri',
          required: true,
          description: 'URI of the target entity',
          example: 'http://example.org/entity/123'
        },
        {
          name: 'maxDepth',
          type: 'literal',
          required: false,
          description: 'Maximum traversal depth',
          example: '10',
          validation: /^\d+$/
        }
      ],
      examples: [
        {
          description: 'Trace data sources for a report',
          parameters: { entityUri: 'http://example.org/report/quarterly', maxDepth: '8' },
          expectedResults: 25
        }
      ],
      sparql: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/provenance/>
        
        SELECT ?entity ?sourceEntity ?activity ?agent ?timestamp WHERE {
          <{{entityUri}}> (prov:wasDerivedFrom){1,{{maxDepth:10}}} ?entity .
          ?entity prov:wasDerivedFrom ?sourceEntity .
          ?entity prov:wasGeneratedBy ?activity .
          ?activity prov:wasAssociatedWith ?agent .
          OPTIONAL { ?activity prov:startedAtTime ?timestamp }
        } 
        ORDER BY DESC(?timestamp)
        LIMIT {{limit:1000}}
      `
    });

    // Bidirectional Lineage Query
    this.templates.set('bidirectional-lineage', {
      name: 'bidirectional-lineage',
      description: 'Get complete lineage of an entity in both directions',
      category: 'provenance',
      complexity: 'high',
      estimatedCost: 800,
      optimizations: ['union-optimization', 'index-hints'],
      parameters: [
        {
          name: 'entityUri',
          type: 'uri',
          required: true,
          description: 'URI of the central entity',
          example: 'http://example.org/entity/123'
        },
        {
          name: 'maxDepth',
          type: 'literal',
          required: false,
          description: 'Maximum traversal depth in each direction',
          example: '5',
          validation: /^\d+$/
        }
      ],
      examples: [
        {
          description: 'Get complete lineage graph',
          parameters: { entityUri: 'http://example.org/transform/etl-001', maxDepth: '3' },
          expectedResults: 40
        }
      ],
      sparql: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/provenance/>
        
        SELECT ?entity ?relatedEntity ?activity ?agent ?timestamp ?direction WHERE {
          {
            <{{entityUri}}> (prov:wasDerivedFrom){1,{{maxDepth:5}}} ?entity .
            ?entity prov:wasDerivedFrom ?relatedEntity .
            BIND("backward" AS ?direction)
          } UNION {
            <{{entityUri}}> (^prov:wasDerivedFrom){1,{{maxDepth:5}}} ?entity .
            ?relatedEntity prov:wasDerivedFrom ?entity .
            BIND("forward" AS ?direction)
          }
          ?entity prov:wasGeneratedBy ?activity .
          ?activity prov:wasAssociatedWith ?agent .
          OPTIONAL { ?activity prov:startedAtTime ?timestamp }
        } 
        ORDER BY ?direction ?timestamp
        LIMIT {{limit:2000}}
      `
    });

    // Activity Chain Query
    this.templates.set('activity-chain', {
      name: 'activity-chain',
      description: 'Get chain of activities that produced or consumed an entity',
      category: 'provenance',
      complexity: 'medium',
      estimatedCost: 400,
      optimizations: ['temporal-index', 'activity-grouping'],
      parameters: [
        {
          name: 'entityUri',
          type: 'uri',
          required: true,
          description: 'URI of the entity',
          example: 'http://example.org/entity/123'
        },
        {
          name: 'includeConsumption',
          type: 'literal',
          required: false,
          description: 'Include activities that consumed the entity',
          example: 'true'
        }
      ],
      examples: [
        {
          description: 'Get processing chain for dataset',
          parameters: { entityUri: 'http://example.org/dataset/raw-logs', includeConsumption: 'true' },
          expectedResults: 12
        }
      ],
      sparql: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/provenance/>
        
        SELECT ?activity ?agent ?startTime ?endTime ?status ?role WHERE {
          {
            <{{entityUri}}> prov:wasGeneratedBy ?activity .
            BIND("generator" AS ?role)
          }
          {{#if includeConsumption}}
          UNION {
            ?activity prov:used <{{entityUri}}> .
            BIND("consumer" AS ?role)
          }
          {{/if}}
          UNION {
            <{{entityUri}}> (prov:wasDerivedFrom)+ ?derived .
            ?derived prov:wasGeneratedBy ?activity .
            BIND("indirect" AS ?role)
          }
          
          ?activity prov:wasAssociatedWith ?agent .
          OPTIONAL { ?activity prov:startedAtTime ?startTime }
          OPTIONAL { ?activity prov:endedAtTime ?endTime }
          OPTIONAL { ?activity kgen:status ?status }
        } 
        ORDER BY ?startTime ?role
        LIMIT {{limit:500}}
      `
    });

    // Involved Agents Query
    this.templates.set('involved-agents', {
      name: 'involved-agents',
      description: 'Get all agents involved in entity lineage with activity counts',
      category: 'provenance',
      complexity: 'medium',
      estimatedCost: 350,
      optimizations: ['agent-aggregation', 'count-optimization'],
      parameters: [
        {
          name: 'entityUri',
          type: 'uri',
          required: true,
          description: 'URI of the entity',
          example: 'http://example.org/entity/123'
        }
      ],
      examples: [
        {
          description: 'Find all contributors to a dataset',
          parameters: { entityUri: 'http://example.org/dataset/customer-analysis' },
          expectedResults: 8
        }
      ],
      sparql: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        PREFIX kgen: <http://kgen.enterprise/provenance/>
        
        SELECT ?agent ?name ?type ?activities ?firstActivity ?lastActivity WHERE {
          <{{entityUri}}> (prov:wasDerivedFrom|^prov:wasDerivedFrom)* ?entity .
          ?entity prov:wasGeneratedBy ?activity .
          ?activity prov:wasAssociatedWith ?agent .
          
          OPTIONAL { ?agent foaf:name ?name }
          OPTIONAL { ?agent a ?type }
          
          # Aggregate activity information
          {
            SELECT ?agent (COUNT(?activity) AS ?activities) 
                   (MIN(?startTime) AS ?firstActivity)
                   (MAX(?endTime) AS ?lastActivity) WHERE {
              <{{entityUri}}> (prov:wasDerivedFrom|^prov:wasDerivedFrom)* ?entity .
              ?entity prov:wasGeneratedBy ?activity .
              ?activity prov:wasAssociatedWith ?agent .
              OPTIONAL { ?activity prov:startedAtTime ?startTime }
              OPTIONAL { ?activity prov:endedAtTime ?endTime }
            } GROUP BY ?agent
          }
        } 
        ORDER BY DESC(?activities) ?name
        LIMIT {{limit:100}}
      `
    });
  }

  private initializeGraphAnalyticsQueries(): void {
    this.categories.add('analytics');

    // Node Centrality Analysis
    this.templates.set('node-centrality', {
      name: 'node-centrality',
      description: 'Calculate centrality metrics for graph nodes',
      category: 'analytics',
      complexity: 'high',
      estimatedCost: 1000,
      optimizations: ['graph-algorithms', 'parallel-processing'],
      parameters: [
        {
          name: 'centralityType',
          type: 'literal',
          required: false,
          description: 'Type of centrality: degree, betweenness, closeness',
          example: 'degree'
        },
        {
          name: 'minDegree',
          type: 'literal',
          required: false,
          description: 'Minimum degree threshold',
          example: '5',
          validation: /^\d+$/
        }
      ],
      examples: [
        {
          description: 'Find most connected entities',
          parameters: { centralityType: 'degree', minDegree: '10' },
          expectedResults: 50
        }
      ],
      sparql: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/analytics/>
        
        SELECT ?node ?label ?inDegree ?outDegree ?totalDegree ?centrality WHERE {
          {
            SELECT ?node 
                   (COUNT(DISTINCT ?incoming) AS ?inDegree)
                   (COUNT(DISTINCT ?outgoing) AS ?outDegree)
                   ((?inDegree + ?outDegree) AS ?totalDegree) WHERE {
              {
                ?incoming ?p1 ?node .
                FILTER(?p1 != prov:type)
              }
              UNION
              {
                ?node ?p2 ?outgoing .
                FILTER(?p2 != prov:type)
              }
            } GROUP BY ?node
            HAVING(?totalDegree >= {{minDegree:1}})
          }
          
          OPTIONAL { ?node rdfs:label ?label }
          
          # Calculate centrality score (simplified degree centrality)
          BIND(?totalDegree / 100.0 AS ?centrality)
        }
        ORDER BY DESC(?totalDegree)
        LIMIT {{limit:100}}
      `
    });

    // Community Detection
    this.templates.set('community-detection', {
      name: 'community-detection',
      description: 'Detect communities in the knowledge graph',
      category: 'analytics',
      complexity: 'high',
      estimatedCost: 1200,
      optimizations: ['clustering-algorithms', 'modularity-optimization'],
      parameters: [
        {
          name: 'algorithm',
          type: 'literal',
          required: false,
          description: 'Clustering algorithm: louvain, label-propagation',
          example: 'louvain'
        },
        {
          name: 'resolution',
          type: 'literal',
          required: false,
          description: 'Resolution parameter for clustering',
          example: '1.0',
          validation: /^\d*\.?\d+$/
        }
      ],
      examples: [
        {
          description: 'Find data processing communities',
          parameters: { algorithm: 'louvain', resolution: '0.8' },
          expectedResults: 20
        }
      ],
      sparql: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/analytics/>
        
        SELECT ?community ?node ?strength ?size WHERE {
          # This is a simplified community detection using connected components
          ?node (prov:wasDerivedFrom|^prov:wasDerivedFrom|prov:wasGeneratedBy/^prov:wasGeneratedBy)+ ?root .
          
          {
            SELECT ?root (COUNT(DISTINCT ?member) AS ?size) WHERE {
              ?member (prov:wasDerivedFrom|^prov:wasDerivedFrom|prov:wasGeneratedBy/^prov:wasGeneratedBy)* ?root .
            } GROUP BY ?root
            HAVING(?size >= 3)
          }
          
          BIND(STR(?root) AS ?community)
          
          # Calculate connection strength within community
          {
            SELECT ?node ?root (COUNT(?connection) AS ?strength) WHERE {
              ?node (prov:wasDerivedFrom|^prov:wasDerivedFrom|prov:wasGeneratedBy/^prov:wasGeneratedBy)+ ?root .
              {
                ?node prov:wasDerivedFrom ?connection .
              } UNION {
                ?connection prov:wasDerivedFrom ?node .
              }
              ?connection (prov:wasDerivedFrom|^prov:wasDerivedFrom|prov:wasGeneratedBy/^prov:wasGeneratedBy)+ ?root .
            } GROUP BY ?node ?root
          }
        }
        ORDER BY DESC(?size) DESC(?strength)
        LIMIT {{limit:200}}
      `
    });
  }

  private initializeComplianceQueries(): void {
    this.categories.add('compliance');

    // GDPR Data Processing Activities
    this.templates.set('gdpr-processing-activities', {
      name: 'gdpr-processing-activities',
      description: 'Identify data processing activities for GDPR compliance',
      category: 'compliance',
      complexity: 'medium',
      estimatedCost: 600,
      optimizations: ['compliance-indexes', 'privacy-filtering'],
      parameters: [
        {
          name: 'dataSubject',
          type: 'uri',
          required: false,
          description: 'Specific data subject URI',
          example: 'http://example.org/person/john-doe'
        },
        {
          name: 'purpose',
          type: 'literal',
          required: false,
          description: 'Processing purpose',
          example: 'marketing'
        },
        {
          name: 'legalBasis',
          type: 'literal',
          required: false,
          description: 'Legal basis for processing',
          example: 'consent'
        }
      ],
      examples: [
        {
          description: 'Find all processing activities for a data subject',
          parameters: { dataSubject: 'http://example.org/person/jane-smith' },
          expectedResults: 15
        }
      ],
      sparql: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX gdpr: <http://kgen.enterprise/gdpr/>
        PREFIX kgen: <http://kgen.enterprise/provenance/>
        
        SELECT ?activity ?purpose ?legalBasis ?dataCategories ?subjects 
               ?controller ?processor ?timestamp ?consent WHERE {
          ?activity a prov:Activity .
          ?activity gdpr:processingPurpose ?purpose .
          ?activity gdpr:legalBasis ?legalBasis .
          ?activity gdpr:dataCategories ?dataCategories .
          ?activity gdpr:dataSubjects ?subjects .
          
          OPTIONAL { ?activity gdpr:dataController ?controller }
          OPTIONAL { ?activity gdpr:dataProcessor ?processor }
          OPTIONAL { ?activity prov:startedAtTime ?timestamp }
          OPTIONAL { ?activity gdpr:consentReference ?consent }
          
          {{#if dataSubject}}
          FILTER(?subjects = <{{dataSubject}}>)
          {{/if}}
          
          {{#if purpose}}
          FILTER(CONTAINS(LCASE(?purpose), LCASE("{{purpose}}")))
          {{/if}}
          
          {{#if legalBasis}}
          FILTER(CONTAINS(LCASE(?legalBasis), LCASE("{{legalBasis}}")))
          {{/if}}
        }
        ORDER BY DESC(?timestamp)
        LIMIT {{limit:500}}
      `
    });

    // GDPR Consent Records
    this.templates.set('gdpr-consent-records', {
      name: 'gdpr-consent-records',
      description: 'Track consent records and their validity',
      category: 'compliance',
      complexity: 'medium',
      estimatedCost: 400,
      optimizations: ['consent-indexing', 'temporal-filtering'],
      parameters: [
        {
          name: 'dataSubject',
          type: 'uri',
          required: false,
          description: 'Data subject URI',
          example: 'http://example.org/person/john-doe'
        },
        {
          name: 'purpose',
          type: 'literal',
          required: false,
          description: 'Consent purpose',
          example: 'marketing'
        },
        {
          name: 'validOnly',
          type: 'literal',
          required: false,
          description: 'Return only valid consents',
          example: 'true'
        }
      ],
      examples: [
        {
          description: 'Check valid marketing consents',
          parameters: { purpose: 'marketing', validOnly: 'true' },
          expectedResults: 200
        }
      ],
      sparql: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX gdpr: <http://kgen.enterprise/gdpr/>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        
        SELECT ?consent ?subject ?granted ?purpose ?timestamp ?expires ?valid WHERE {
          ?consent a gdpr:ConsentRecord .
          ?consent gdpr:dataSubject ?subject .
          ?consent gdpr:granted ?granted .
          ?consent gdpr:purpose ?purpose .
          ?consent prov:generatedAtTime ?timestamp .
          
          OPTIONAL { ?consent gdpr:expiresAt ?expires }
          
          # Determine if consent is currently valid
          BIND(
            IF(?granted = true && 
               (!BOUND(?expires) || ?expires > NOW()), 
               true, false) AS ?valid
          )
          
          {{#if dataSubject}}
          FILTER(?subject = <{{dataSubject}}>)
          {{/if}}
          
          {{#if purpose}}
          FILTER(CONTAINS(LCASE(?purpose), LCASE("{{purpose}}")))
          {{/if}}
          
          {{#if validOnly}}
          FILTER(?valid = true)
          {{/if}}
        }
        ORDER BY DESC(?timestamp)
        LIMIT {{limit:1000}}
      `
    });
  }

  private initializeSemanticQueries(): void {
    this.categories.add('semantic');

    // Ontology Class Hierarchy
    this.templates.set('class-hierarchy', {
      name: 'class-hierarchy',
      description: 'Navigate ontology class hierarchies',
      category: 'semantic',
      complexity: 'low',
      estimatedCost: 200,
      optimizations: ['hierarchy-indexing', 'transitive-closure'],
      parameters: [
        {
          name: 'rootClass',
          type: 'uri',
          required: false,
          description: 'Root class URI',
          example: 'http://www.w3.org/2002/07/owl#Thing'
        },
        {
          name: 'maxDepth',
          type: 'literal',
          required: false,
          description: 'Maximum hierarchy depth',
          example: '5',
          validation: /^\d+$/
        }
      ],
      examples: [
        {
          description: 'Get complete class hierarchy',
          parameters: { maxDepth: '10' },
          expectedResults: 100
        }
      ],
      sparql: `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        
        SELECT ?class ?label ?superClass ?superLabel ?depth WHERE {
          {{#if rootClass}}
          <{{rootClass}}> rdfs:subClassOf{0,{{maxDepth:10}}} ?class .
          {{else}}
          ?class a owl:Class .
          {{/if}}
          
          OPTIONAL { ?class rdfs:subClassOf ?superClass }
          OPTIONAL { ?class rdfs:label ?label }
          OPTIONAL { ?superClass rdfs:label ?superLabel }
          
          # Calculate depth (simplified)
          {{#if rootClass}}
          <{{rootClass}}> rdfs:subClassOf{0,{{maxDepth:10}}} ?class .
          BIND(1 AS ?depth)
          {{else}}
          BIND(0 AS ?depth)
          {{/if}}
        }
        ORDER BY ?depth ?label
        LIMIT {{limit:1000}}
      `
    });

    // Property Usage Analysis
    this.templates.set('property-usage', {
      name: 'property-usage',
      description: 'Analyze property usage patterns in the graph',
      category: 'semantic',
      complexity: 'medium',
      estimatedCost: 500,
      optimizations: ['property-statistics', 'usage-indexing'],
      parameters: [
        {
          name: 'propertyUri',
          type: 'uri',
          required: false,
          description: 'Specific property URI to analyze',
          example: 'http://xmlns.com/foaf/0.1/name'
        },
        {
          name: 'minUsage',
          type: 'literal',
          required: false,
          description: 'Minimum usage count',
          example: '10',
          validation: /^\d+$/
        }
      ],
      examples: [
        {
          description: 'Find most used properties',
          parameters: { minUsage: '50' },
          expectedResults: 30
        }
      ],
      sparql: `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        
        SELECT ?property ?label ?domain ?range ?usage ?distinctSubjects ?distinctObjects WHERE {
          {
            SELECT ?property 
                   (COUNT(*) AS ?usage)
                   (COUNT(DISTINCT ?s) AS ?distinctSubjects)
                   (COUNT(DISTINCT ?o) AS ?distinctObjects) WHERE {
              ?s ?property ?o .
              {{#if propertyUri}}
              FILTER(?property = <{{propertyUri}}>)
              {{/if}}
            } GROUP BY ?property
            HAVING(?usage >= {{minUsage:1}})
          }
          
          OPTIONAL { ?property rdfs:label ?label }
          OPTIONAL { ?property rdfs:domain ?domain }
          OPTIONAL { ?property rdfs:range ?range }
        }
        ORDER BY DESC(?usage)
        LIMIT {{limit:200}}
      `
    });
  }

  private initializePerformanceQueries(): void {
    this.categories.add('performance');

    // Query Performance Analysis
    this.templates.set('query-performance', {
      name: 'query-performance',
      description: 'Analyze query execution patterns and performance',
      category: 'performance',
      complexity: 'medium',
      estimatedCost: 300,
      optimizations: ['performance-indexing', 'statistics-aggregation'],
      parameters: [
        {
          name: 'timeRange',
          type: 'literal',
          required: false,
          description: 'Time range in hours',
          example: '24',
          validation: /^\d+$/
        },
        {
          name: 'slowQueriesOnly',
          type: 'literal',
          required: false,
          description: 'Show only slow queries',
          example: 'true'
        }
      ],
      examples: [
        {
          description: 'Find slow queries in last 24 hours',
          parameters: { timeRange: '24', slowQueriesOnly: 'true' },
          expectedResults: 10
        }
      ],
      sparql: `
        PREFIX kgen: <http://kgen.enterprise/performance/>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        
        SELECT ?query ?executionTime ?resultCount ?timestamp ?complexity ?cacheHit WHERE {
          ?execution a kgen:QueryExecution .
          ?execution kgen:query ?query .
          ?execution kgen:executionTime ?executionTime .
          ?execution kgen:resultCount ?resultCount .
          ?execution kgen:timestamp ?timestamp .
          ?execution kgen:complexity ?complexity .
          ?execution kgen:cacheHit ?cacheHit .
          
          {{#if timeRange}}
          FILTER(?timestamp >= (NOW() - "P0DT{{timeRange}}H00M"^^xsd:duration))
          {{/if}}
          
          {{#if slowQueriesOnly}}
          FILTER(?executionTime > 1000) # More than 1 second
          {{/if}}
        }
        ORDER BY DESC(?executionTime)
        LIMIT {{limit:100}}
      `
    });

    // Index Usage Statistics
    this.templates.set('index-statistics', {
      name: 'index-statistics',
      description: 'Get index usage and performance statistics',
      category: 'performance',
      complexity: 'low',
      estimatedCost: 150,
      optimizations: ['index-metadata', 'statistics-caching'],
      parameters: [
        {
          name: 'indexName',
          type: 'literal',
          required: false,
          description: 'Specific index name',
          example: 'spo_index'
        }
      ],
      examples: [
        {
          description: 'Get all index statistics',
          parameters: {},
          expectedResults: 6
        }
      ],
      sparql: `
        PREFIX kgen: <http://kgen.enterprise/performance/>
        
        SELECT ?index ?type ?size ?hitRate ?lastUpdated ?avgAccessTime WHERE {
          ?index a kgen:Index .
          ?index kgen:indexType ?type .
          ?index kgen:size ?size .
          ?index kgen:hitRate ?hitRate .
          ?index kgen:lastUpdated ?lastUpdated .
          ?index kgen:averageAccessTime ?avgAccessTime .
          
          {{#if indexName}}
          FILTER(CONTAINS(LCASE(STR(?index)), LCASE("{{indexName}}")))
          {{/if}}
        }
        ORDER BY DESC(?hitRate)
        LIMIT {{limit:50}}
      `
    });
  }
}

export default PreDefinedQueries;