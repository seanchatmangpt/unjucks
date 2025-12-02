/**
 * Pre-defined SPARQL Query Library
 * 
 * Comprehensive library of optimized SPARQL queries for common use cases,
 * migrated and enhanced from src/kgen/provenance/queries/sparql.js
 */

import { ParsedQuery, QueryResults } from '../types/index.js';

export 

export 

export 

export class PreDefinedQueries {
  private templates> = new Map();
  private categories> = new Set();

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
  getAllTemplates(){
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category{
    return this.getAllTemplates().filter(t => t.category === category);
  }

  /**
   * Get template by name
   */
  getTemplate(name{
    return this.templates.get(name);
  }

  /**
   * Get all categories
   */
  getCategories(){
    return Array.from(this.categories);
  }

  /**
   * Execute a template with parameters
   */
  executeTemplate(name>){
    const template = this.templates.get(name);
    if (!template) {
      throw new Error(`Template not found{name}`);
    }

    let query = template.sparql;
    
    // Validate required parameters
    for (const param of template.parameters) {
      if (param.required && !parameters[param.name]) {
        throw new Error(`Required parameter missing{param.name}`);
      }
      
      if (parameters[param.name] && param.validation && !param.validation.test(parameters[param.name])) {
        throw new Error(`Invalid parameter value{param.name}`);
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
  searchTemplates(keyword{
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
  addTemplate(template{
    this.templates.set(template.name, template);
    this.categories.add(template.category);
  }

  // Private initialization methods

  private initializeProvenanceQueries(){
    this.categories.add('provenance');

    // Forward Lineage Query
    this.templates.set('forward-lineage', {
      name,
      description,
      category,
      complexity,
      estimatedCost,
      optimizations, 'limit-pushdown'],
      parameters
        {
          name,
          type,
          required,
          description,
          example
        },
        {
          name,
          type,
          required,
          description,
          example,
          validation
        }
      ],
      examples
        {
          description,
          parameters{ entityUri, maxDepth,
          expectedResults
        }
      ],
      sparql
        PREFIX prov>
        PREFIX kgen>
        
        SELECT ?entity ?derivedEntity ?activity ?agent ?timestamp ?depth WHERE {
           (prov{0,{{maxDepth
          ?derivedEntity prov
          ?derivedEntity prov
          ?activity prov
          OPTIONAL { ?activity prov
          
          # Calculate depth using property path
           (prov{0,{{maxDepth
          BIND(1 AS ?depth)
        } 
        ORDER BY ?depth ?timestamp
        LIMIT {{limit
      `
    });

    // Backward Lineage Query
    this.templates.set('backward-lineage', {
      name,
      description,
      category,
      complexity,
      estimatedCost,
      optimizations, 'join-reordering'],
      parameters
        {
          name,
          type,
          required,
          description,
          example
        },
        {
          name,
          type,
          required,
          description,
          example,
          validation
        }
      ],
      examples
        {
          description,
          parameters{ entityUri, maxDepth,
          expectedResults
        }
      ],
      sparql
        PREFIX prov>
        PREFIX kgen>
        
        SELECT ?entity ?sourceEntity ?activity ?agent ?timestamp WHERE {
           (prov{1,{{maxDepth
          ?entity prov
          ?entity prov
          ?activity prov
          OPTIONAL { ?activity prov
        } 
        ORDER BY DESC(?timestamp)
        LIMIT {{limit
      `
    });

    // Bidirectional Lineage Query
    this.templates.set('bidirectional-lineage', {
      name,
      description,
      category,
      complexity,
      estimatedCost,
      optimizations, 'index-hints'],
      parameters
        {
          name,
          type,
          required,
          description,
          example
        },
        {
          name,
          type,
          required,
          description,
          example,
          validation
        }
      ],
      examples
        {
          description,
          parameters{ entityUri, maxDepth,
          expectedResults
        }
      ],
      sparql
        PREFIX prov>
        PREFIX kgen>
        
        SELECT ?entity ?relatedEntity ?activity ?agent ?timestamp ?direction WHERE {
          {
             (prov{1,{{maxDepth
            ?entity prov
            BIND("backward" AS ?direction)
          } UNION {
             (^prov{1,{{maxDepth
            ?relatedEntity prov
            BIND("forward" AS ?direction)
          }
          ?entity prov
          ?activity prov
          OPTIONAL { ?activity prov
        } 
        ORDER BY ?direction ?timestamp
        LIMIT {{limit
      `
    });

    // Activity Chain Query
    this.templates.set('activity-chain', {
      name,
      description,
      category,
      complexity,
      estimatedCost,
      optimizations, 'activity-grouping'],
      parameters
        {
          name,
          type,
          required,
          description,
          example
        },
        {
          name,
          type,
          required,
          description,
          example
        }
      ],
      examples
        {
          description,
          parameters{ entityUri, includeConsumption,
          expectedResults
        }
      ],
      sparql
        PREFIX prov>
        PREFIX kgen>
        
        SELECT ?activity ?agent ?startTime ?endTime ?status ?role WHERE {
          {
             prov
            BIND("generator" AS ?role)
          }
          {{#if includeConsumption}}
          UNION {
            ?activity prov{{entityUri}}> .
            BIND("consumer" AS ?role)
          }
          {{/if}}
          UNION {
             (prov)+ ?derived .
            ?derived prov
            BIND("indirect" AS ?role)
          }
          
          ?activity prov
          OPTIONAL { ?activity prov
          OPTIONAL { ?activity prov
          OPTIONAL { ?activity kgen
        } 
        ORDER BY ?startTime ?role
        LIMIT {{limit
      `
    });

    // Involved Agents Query
    this.templates.set('involved-agents', {
      name,
      description,
      category,
      complexity,
      estimatedCost,
      optimizations, 'count-optimization'],
      parameters
        {
          name,
          type,
          required,
          description,
          example
        }
      ],
      examples
        {
          description,
          parameters{ entityUri,
          expectedResults
        }
      ],
      sparql
        PREFIX prov>
        PREFIX foaf>
        PREFIX kgen>
        
        SELECT ?agent ?name ?type ?activities ?firstActivity ?lastActivity WHERE {
           (prov)* ?entity .
          ?entity prov
          ?activity prov
          
          OPTIONAL { ?agent foaf
          OPTIONAL { ?agent a ?type }
          
          # Aggregate activity information
          {
            SELECT ?agent (COUNT(?activity) AS ?activities) 
                   (MIN(?startTime) AS ?firstActivity)
                   (MAX(?endTime) AS ?lastActivity) WHERE {
               (prov)* ?entity .
              ?entity prov
              ?activity prov
              OPTIONAL { ?activity prov
              OPTIONAL { ?activity prov
            } GROUP BY ?agent
          }
        } 
        ORDER BY DESC(?activities) ?name
        LIMIT {{limit
      `
    });
  }

  private initializeGraphAnalyticsQueries(){
    this.categories.add('analytics');

    // Node Centrality Analysis
    this.templates.set('node-centrality', {
      name,
      description,
      category,
      complexity,
      estimatedCost,
      optimizations, 'parallel-processing'],
      parameters
        {
          name,
          type,
          required,
          description, betweenness, closeness',
          example
        },
        {
          name,
          type,
          required,
          description,
          example,
          validation
        }
      ],
      examples
        {
          description,
          parameters{ centralityType, minDegree,
          expectedResults
        }
      ],
      sparql
        PREFIX prov>
        PREFIX kgen>
        
        SELECT ?node ?label ?inDegree ?outDegree ?totalDegree ?centrality WHERE {
          {
            SELECT ?node 
                   (COUNT(DISTINCT ?incoming) AS ?inDegree)
                   (COUNT(DISTINCT ?outgoing) AS ?outDegree)
                   ((?inDegree + ?outDegree) AS ?totalDegree) WHERE {
              {
                ?incoming ?p1 ?node .
                FILTER(?p1 != prov)
              }
              UNION
              {
                ?node ?p2 ?outgoing .
                FILTER(?p2 != prov)
              }
            } GROUP BY ?node
            HAVING(?totalDegree >= {{minDegree)
          }
          
          OPTIONAL { ?node rdfs
          
          # Calculate centrality score (simplified degree centrality)
          BIND(?totalDegree / 100.0 AS ?centrality)
        }
        ORDER BY DESC(?totalDegree)
        LIMIT {{limit
      `
    });

    // Community Detection
    this.templates.set('community-detection', {
      name,
      description,
      category,
      complexity,
      estimatedCost,
      optimizations, 'modularity-optimization'],
      parameters
        {
          name,
          type,
          required,
          description, label-propagation',
          example
        },
        {
          name,
          type,
          required,
          description,
          example,
          validation
        }
      ],
      examples
        {
          description,
          parameters{ algorithm, resolution,
          expectedResults
        }
      ],
      sparql
        PREFIX prov>
        PREFIX kgen>
        
        SELECT ?community ?node ?strength ?size WHERE {
          # This is a simplified community detection using connected components
          ?node (prov
          
          {
            SELECT ?root (COUNT(DISTINCT ?member) AS ?size) WHERE {
              ?member (prov)* ?root .
            } GROUP BY ?root
            HAVING(?size >= 3)
          }
          
          BIND(STR(?root) AS ?community)
          
          # Calculate connection strength within community
          {
            SELECT ?node ?root (COUNT(?connection) AS ?strength) WHERE {
              ?node (prov
              {
                ?node prov
              } UNION {
                ?connection prov
              }
              ?connection (prov)+ ?root .
            } GROUP BY ?node ?root
          }
        }
        ORDER BY DESC(?size) DESC(?strength)
        LIMIT {{limit
      `
    });
  }

  private initializeComplianceQueries(){
    this.categories.add('compliance');

    // GDPR Data Processing Activities
    this.templates.set('gdpr-processing-activities', {
      name,
      description,
      category,
      complexity,
      estimatedCost,
      optimizations, 'privacy-filtering'],
      parameters
        {
          name,
          type,
          required,
          description,
          example
        },
        {
          name,
          type,
          required,
          description,
          example
        },
        {
          name,
          type,
          required,
          description,
          example
        }
      ],
      examples
        {
          description,
          parameters{ dataSubject,
          expectedResults
        }
      ],
      sparql
        PREFIX prov>
        PREFIX gdpr>
        PREFIX kgen>
        
        SELECT ?activity ?purpose ?legalBasis ?dataCategories ?subjects 
               ?controller ?processor ?timestamp ?consent WHERE {
          ?activity a prov
          ?activity gdpr
          ?activity gdpr
          ?activity gdpr
          ?activity gdpr
          
          OPTIONAL { ?activity gdpr
          OPTIONAL { ?activity gdpr
          OPTIONAL { ?activity prov
          OPTIONAL { ?activity gdpr
          
          {{#if dataSubject}}
          FILTER(?subjects = )
          {{/if}}
          
          {{#if purpose}}
          FILTER(CONTAINS(LCASE(?purpose), LCASE("{{purpose}}")))
          {{/if}}
          
          {{#if legalBasis}}
          FILTER(CONTAINS(LCASE(?legalBasis), LCASE("{{legalBasis}}")))
          {{/if}}
        }
        ORDER BY DESC(?timestamp)
        LIMIT {{limit
      `
    });

    // GDPR Consent Records
    this.templates.set('gdpr-consent-records', {
      name,
      description,
      category,
      complexity,
      estimatedCost,
      optimizations, 'temporal-filtering'],
      parameters
        {
          name,
          type,
          required,
          description,
          example
        },
        {
          name,
          type,
          required,
          description,
          example
        },
        {
          name,
          type,
          required,
          description,
          example
        }
      ],
      examples
        {
          description,
          parameters{ purpose, validOnly,
          expectedResults
        }
      ],
      sparql
        PREFIX prov>
        PREFIX gdpr>
        PREFIX xsd>
        
        SELECT ?consent ?subject ?granted ?purpose ?timestamp ?expires ?valid WHERE {
          ?consent a gdpr
          ?consent gdpr
          ?consent gdpr
          ?consent gdpr
          ?consent prov
          
          OPTIONAL { ?consent gdpr
          
          # Determine if consent is currently valid
          BIND(
            IF(?granted = true && 
               (!BOUND(?expires) || ?expires > NOW()), 
               true, false) AS ?valid
          )
          
          {{#if dataSubject}}
          FILTER(?subject = )
          {{/if}}
          
          {{#if purpose}}
          FILTER(CONTAINS(LCASE(?purpose), LCASE("{{purpose}}")))
          {{/if}}
          
          {{#if validOnly}}
          FILTER(?valid = true)
          {{/if}}
        }
        ORDER BY DESC(?timestamp)
        LIMIT {{limit
      `
    });
  }

  private initializeSemanticQueries(){
    this.categories.add('semantic');

    // Ontology Class Hierarchy
    this.templates.set('class-hierarchy', {
      name,
      description,
      category,
      complexity,
      estimatedCost,
      optimizations, 'transitive-closure'],
      parameters
        {
          name,
          type,
          required,
          description,
          example
        },
        {
          name,
          type,
          required,
          description,
          example,
          validation
        }
      ],
      examples
        {
          description,
          parameters{ maxDepth,
          expectedResults
        }
      ],
      sparql
        PREFIX rdfs>
        PREFIX owl>
        
        SELECT ?class ?label ?superClass ?superLabel ?depth WHERE {
          {{#if rootClass}}
           rdfs{0,{{maxDepth
          {{else}}
          ?class a owl
          {{/if}}
          
          OPTIONAL { ?class rdfs
          OPTIONAL { ?class rdfs
          OPTIONAL { ?superClass rdfs
          
          # Calculate depth (simplified)
          {{#if rootClass}}
           rdfs{0,{{maxDepth
          BIND(1 AS ?depth)
          {{else}}
          BIND(0 AS ?depth)
          {{/if}}
        }
        ORDER BY ?depth ?label
        LIMIT {{limit
      `
    });

    // Property Usage Analysis
    this.templates.set('property-usage', {
      name,
      description,
      category,
      complexity,
      estimatedCost,
      optimizations, 'usage-indexing'],
      parameters
        {
          name,
          type,
          required,
          description,
          example
        },
        {
          name,
          type,
          required,
          description,
          example,
          validation
        }
      ],
      examples
        {
          description,
          parameters{ minUsage,
          expectedResults
        }
      ],
      sparql
        PREFIX rdfs>
        PREFIX owl>
        
        SELECT ?property ?label ?domain ?range ?usage ?distinctSubjects ?distinctObjects WHERE {
          {
            SELECT ?property 
                   (COUNT(*) AS ?usage)
                   (COUNT(DISTINCT ?s) AS ?distinctSubjects)
                   (COUNT(DISTINCT ?o) AS ?distinctObjects) WHERE {
              ?s ?property ?o .
              {{#if propertyUri}}
              FILTER(?property = )
              {{/if}}
            } GROUP BY ?property
            HAVING(?usage >= {{minUsage)
          }
          
          OPTIONAL { ?property rdfs
          OPTIONAL { ?property rdfs
          OPTIONAL { ?property rdfs
        }
        ORDER BY DESC(?usage)
        LIMIT {{limit
      `
    });
  }

  private initializePerformanceQueries(){
    this.categories.add('performance');

    // Query Performance Analysis
    this.templates.set('query-performance', {
      name,
      description,
      category,
      complexity,
      estimatedCost,
      optimizations, 'statistics-aggregation'],
      parameters
        {
          name,
          type,
          required,
          description,
          example,
          validation
        },
        {
          name,
          type,
          required,
          description,
          example
        }
      ],
      examples
        {
          description,
          parameters{ timeRange, slowQueriesOnly,
          expectedResults
        }
      ],
      sparql
        PREFIX kgen>
        PREFIX xsd>
        
        SELECT ?query ?executionTime ?resultCount ?timestamp ?complexity ?cacheHit WHERE {
          ?execution a kgen
          ?execution kgen
          ?execution kgen
          ?execution kgen
          ?execution kgen
          ?execution kgen
          ?execution kgen
          
          {{#if timeRange}}
          FILTER(?timestamp >= (NOW() - "P0DT{{timeRange}}H00M"^^xsd
          {{/if}}
          
          {{#if slowQueriesOnly}}
          FILTER(?executionTime > 1000) # More than 1 second
          {{/if}}
        }
        ORDER BY DESC(?executionTime)
        LIMIT {{limit
      `
    });

    // Index Usage Statistics
    this.templates.set('index-statistics', {
      name,
      description,
      category,
      complexity,
      estimatedCost,
      optimizations, 'statistics-caching'],
      parameters
        {
          name,
          type,
          required,
          description,
          example
        }
      ],
      examples
        {
          description,
          parameters{},
          expectedResults
        }
      ],
      sparql
        PREFIX kgen>
        
        SELECT ?index ?type ?size ?hitRate ?lastUpdated ?avgAccessTime WHERE {
          ?index a kgen
          ?index kgen
          ?index kgen
          ?index kgen
          ?index kgen
          ?index kgen
          
          {{#if indexName}}
          FILTER(CONTAINS(LCASE(STR(?index)), LCASE("{{indexName}}")))
          {{/if}}
        }
        ORDER BY DESC(?hitRate)
        LIMIT {{limit
      `
    });
  }
}

export default PreDefinedQueries;