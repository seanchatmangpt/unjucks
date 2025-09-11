/**
 * SPARQL Query Template Library for kgen CLI Operations
 * 
 * Provides reusable SPARQL query templates optimized for common
 * knowledge graph operations and artifact generation workflows.
 */

export class QueryTemplateLibrary {
  constructor() {
    this.templates = this._initializeTemplates();
    this.parameters = this._initializeParameters();
  }

  /**
   * Get a query template by name
   * @param {string} templateName - Name of the template
   * @returns {string} SPARQL query template with placeholders
   */
  getTemplate(templateName) {
    if (!this.templates[templateName]) {
      throw new Error(`Query template '${templateName}' not found`);
    }
    return this.templates[templateName];
  }

  /**
   * Get all available template names
   * @returns {Array<string>} Array of template names
   */
  getTemplateNames() {
    return Object.keys(this.templates);
  }

  /**
   * Execute a template with parameters
   * @param {string} templateName - Name of the template
   * @param {Object} params - Parameters to substitute
   * @returns {string} Executable SPARQL query
   */
  executeTemplate(templateName, params = {}) {
    let query = this.getTemplate(templateName);
    
    // Substitute parameters
    for (const [key, value] of Object.entries(params)) {
      const placeholder = `{{${key}}}`;
      query = query.replace(new RegExp(placeholder, 'g'), value);
    }
    
    // Check for unsubstituted placeholders
    const unsubstituted = query.match(/{{[^}]+}}/g);
    if (unsubstituted) {
      throw new Error(`Unsubstituted parameters: ${unsubstituted.join(', ')}`);
    }
    
    return query;
  }

  /**
   * Get parameter information for a template
   * @param {string} templateName - Name of the template
   * @returns {Object} Parameter definitions
   */
  getTemplateParameters(templateName) {
    return this.parameters[templateName] || {};
  }

  /**
   * Validate parameters for a template
   * @param {string} templateName - Name of the template
   * @param {Object} params - Parameters to validate
   * @returns {Object} Validation result
   */
  validateParameters(templateName, params) {
    const paramDefs = this.getTemplateParameters(templateName);
    const errors = [];
    const warnings = [];

    // Check required parameters
    for (const [paramName, paramDef] of Object.entries(paramDefs)) {
      if (paramDef.required && !params[paramName]) {
        errors.push(`Required parameter '${paramName}' is missing`);
      }
      
      // Type validation
      if (params[paramName] && paramDef.type) {
        const value = params[paramName];
        const type = paramDef.type;
        
        if (type === 'uri' && !this._isValidUri(value)) {
          warnings.push(`Parameter '${paramName}' should be a valid URI`);
        } else if (type === 'integer' && !Number.isInteger(Number(value))) {
          errors.push(`Parameter '${paramName}' must be an integer`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Private methods

  _initializeTemplates() {
    return {
      // Graph indexing queries
      'subject-artifacts': `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT DISTINCT ?subject ?artifact ?artifactType ?relation WHERE {
          ?subject ?relation ?artifact .
          OPTIONAL { ?artifact a ?artifactType }
          FILTER(
            ?relation IN (
              kgen:generates,
              kgen:produces,
              prov:wasGeneratedBy,
              kgen:artifact,
              kgen:outputPath
            )
          )
        } ORDER BY ?subject ?artifact
      `,
      
      'artifact-subjects': `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX prov: <http://www.w3.org/ns/prov#>
        
        SELECT DISTINCT ?artifact ?subject ?relation WHERE {
          <{{artifactUri}}> ?relation ?subject .
          FILTER(
            ?relation IN (
              prov:wasDerivedFrom,
              kgen:sourceSubject,
              kgen:dependsOn
            )
          )
        } ORDER BY ?subject
      `,
      
      // Template analysis queries
      'template-info': `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        PREFIX dc: <http://purl.org/dc/terms/>
        
        SELECT ?template ?name ?description ?version ?author ?created ?modified WHERE {
          <{{templateUri}}> a kgen:Template .
          OPTIONAL { <{{templateUri}}> foaf:name ?name }
          OPTIONAL { <{{templateUri}}> rdfs:comment ?description }
          OPTIONAL { <{{templateUri}}> kgen:version ?version }
          OPTIONAL { <{{templateUri}}> dc:creator ?author }
          OPTIONAL { <{{templateUri}}> dc:created ?created }
          OPTIONAL { <{{templateUri}}> dc:modified ?modified }
          BIND(<{{templateUri}}> AS ?template)
        }
      `,
      
      'template-requirements': `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        
        SELECT ?property ?label ?dataType ?required ?defaultValue ?description WHERE {
          <{{templateUri}}> kgen:requiresProperty ?property .
          OPTIONAL { ?property rdfs:label ?label }
          OPTIONAL { ?property rdfs:range ?dataType }
          OPTIONAL { ?property kgen:required ?required }
          OPTIONAL { ?property kgen:defaultValue ?defaultValue }
          OPTIONAL { ?property rdfs:comment ?description }
        } ORDER BY ?required DESC ?property
      `,
      
      'template-outputs': `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?output ?outputType ?path ?format ?condition WHERE {
          <{{templateUri}}> kgen:generates ?output .
          OPTIONAL { ?output a ?outputType }
          OPTIONAL { ?output kgen:outputPath ?path }
          OPTIONAL { ?output kgen:format ?format }
          OPTIONAL { ?output kgen:condition ?condition }
        } ORDER BY ?path
      `,
      
      // Dependency analysis queries
      'direct-dependencies': `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?source ?dependency ?relation ?type ?description WHERE {
          <{{artifactUri}}> (prov:wasDerivedFrom|kgen:dependsOn|kgen:requires) ?dependency .
          OPTIONAL { <{{artifactUri}}> kgen:dependencyType ?relation }
          OPTIONAL { ?dependency a ?type }
          OPTIONAL { ?dependency rdfs:comment ?description }
          BIND(<{{artifactUri}}> AS ?source)
        }
      `,
      
      'transitive-dependencies': `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/>
        
        SELECT ?source ?dependency ?relation ?depth WHERE {
          <{{artifactUri}}> (prov:wasDerivedFrom|kgen:dependsOn|kgen:requires)+ ?dependency .
          OPTIONAL { <{{artifactUri}}> kgen:dependencyType ?relation }
          BIND(<{{artifactUri}}> AS ?source)
          BIND(1 AS ?depth)
        } LIMIT {{maxDepth}}
      `,
      
      'reverse-dependencies': `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/>
        
        SELECT ?dependent ?artifact ?relation WHERE {
          ?dependent (prov:wasDerivedFrom|kgen:dependsOn|kgen:requires) <{{artifactUri}}> .
          OPTIONAL { ?dependent kgen:dependencyType ?relation }
          BIND(<{{artifactUri}}> AS ?artifact)
        }
      `,
      
      // Impact analysis queries
      'impact-subjects': `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/>
        
        SELECT DISTINCT ?subject ?impactType ?reason WHERE {
          VALUES (?changedSubject) { {{subjectList}} }
          
          {
            ?subject (prov:wasDerivedFrom|kgen:dependsOn)* ?changedSubject .
            BIND("direct" AS ?impactType)
            BIND("Subject or its dependencies changed" AS ?reason)
          } UNION {
            ?changedSubject (prov:wasDerivedFrom|kgen:dependsOn)* ?subject .
            BIND("reverse" AS ?impactType) 
            BIND("Subject affects this entity" AS ?reason)
          }
          
          FILTER(?subject != ?changedSubject)
        }
      `,
      
      'impact-artifacts': `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX prov: <http://www.w3.org/ns/prov#>
        
        SELECT DISTINCT ?artifact ?artifactType ?impactReason ?priority WHERE {
          VALUES (?changedSubject) { {{subjectList}} }
          
          ?changedSubject (kgen:generates|kgen:produces|prov:wasGeneratedBy) ?artifact .
          OPTIONAL { ?artifact a ?artifactType }
          OPTIONAL { ?artifact kgen:buildPriority ?priority }
          
          BIND("Direct generation relationship" AS ?impactReason)
        } ORDER BY ?priority ?artifact
      `,
      
      // Build order queries  
      'build-order': `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX prov: <http://www.w3.org/ns/prov#>
        
        SELECT ?artifact ?dependency ?buildPriority WHERE {
          ?artifact (prov:wasDerivedFrom|kgen:dependsOn) ?dependency .
          OPTIONAL { ?artifact kgen:buildPriority ?buildPriority }
          FILTER(?artifact IN ({{artifactList}}))
        } ORDER BY ?buildPriority ?artifact
      `,
      
      // Validation queries
      'orphaned-entities': `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/>
        
        SELECT ?entity ?entityType WHERE {
          ?entity a ?entityType .
          FILTER NOT EXISTS { 
            ?entity (prov:wasGeneratedBy|kgen:sourceTemplate|kgen:derivedFrom) ?source 
          }
          FILTER NOT EXISTS {
            ?dependent (prov:wasDerivedFrom|kgen:dependsOn) ?entity
          }
          FILTER(?entityType != kgen:Template)
        }
      `,
      
      'missing-requirements': `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?template ?missingProperty ?required WHERE {
          ?template a kgen:Template ;
                   kgen:requiresProperty ?property .
          ?property kgen:required true ;
                   rdfs:label ?missingProperty .
          
          FILTER NOT EXISTS {
            ?template kgen:hasValue ?property
          }
        }
      `,
      
      // Statistics queries
      'graph-statistics': `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT 
          (COUNT(DISTINCT ?subject) AS ?totalSubjects)
          (COUNT(DISTINCT ?template) AS ?totalTemplates) 
          (COUNT(DISTINCT ?artifact) AS ?totalArtifacts)
          (COUNT(DISTINCT ?dependency) AS ?totalDependencies)
        WHERE {
          {
            SELECT DISTINCT ?subject WHERE { ?subject ?p ?o }
          } UNION {
            SELECT DISTINCT ?template WHERE { ?template a kgen:Template }
          } UNION {
            SELECT DISTINCT ?artifact WHERE { 
              ?s (kgen:generates|kgen:produces|prov:wasGeneratedBy) ?artifact 
            }
          } UNION {
            SELECT DISTINCT ?dependency WHERE {
              ?s (prov:wasDerivedFrom|kgen:dependsOn) ?dependency
            }
          }
        }
      `,
      
      'type-distribution': `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?type (COUNT(*) AS ?count) WHERE {
          ?entity a ?type .
          OPTIONAL { ?type rdfs:label ?typeLabel }
        } GROUP BY ?type ORDER BY DESC(?count)
      `,
      
      // Content analysis queries
      'entity-properties': `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?subject ?predicate ?object ?objectType WHERE {
          <{{entityUri}}> ?predicate ?object .
          BIND(<{{entityUri}}> AS ?subject)
          BIND(datatype(?object) AS ?objectType)
        } ORDER BY ?predicate
      `,
      
      'related-entities': `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?entity ?relation ?direction ?entityType WHERE {
          {
            <{{entityUri}}> ?relation ?entity .
            BIND("outgoing" AS ?direction)
          } UNION {
            ?entity ?relation <{{entityUri}}> .
            BIND("incoming" AS ?direction)
          }
          OPTIONAL { ?entity a ?entityType }
          FILTER(?entity != <{{entityUri}}>)
        } ORDER BY ?direction ?relation
      `,
      
      // Performance optimization queries
      'most-connected': `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX prov: <http://www.w3.org/ns/prov#>
        
        SELECT ?entity (COUNT(?connection) AS ?connectionCount) WHERE {
          {
            ?entity (prov:wasDerivedFrom|kgen:dependsOn|kgen:generates)* ?connection
          } UNION {
            ?connection (prov:wasDerivedFrom|kgen:dependsOn|kgen:generates)* ?entity
          }
        } GROUP BY ?entity ORDER BY DESC(?connectionCount) LIMIT {{limit}}
      `,
      
      'potential-bottlenecks': `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX prov: <http://www.w3.org/ns/prov#>
        
        SELECT ?entity (COUNT(DISTINCT ?dependent) AS ?dependentCount) WHERE {
          ?dependent (prov:wasDerivedFrom|kgen:dependsOn) ?entity .
        } GROUP BY ?entity HAVING(?dependentCount > {{threshold}}) 
        ORDER BY DESC(?dependentCount)
      `
    };
  }

  _initializeParameters() {
    return {
      'subject-artifacts': {},
      
      'artifact-subjects': {
        artifactUri: { type: 'uri', required: true, description: 'URI of the artifact to analyze' }
      },
      
      'template-info': {
        templateUri: { type: 'uri', required: true, description: 'URI of the template' }
      },
      
      'template-requirements': {
        templateUri: { type: 'uri', required: true, description: 'URI of the template' }
      },
      
      'template-outputs': {
        templateUri: { type: 'uri', required: true, description: 'URI of the template' }
      },
      
      'direct-dependencies': {
        artifactUri: { type: 'uri', required: true, description: 'URI of the artifact' }
      },
      
      'transitive-dependencies': {
        artifactUri: { type: 'uri', required: true, description: 'URI of the artifact' },
        maxDepth: { type: 'integer', required: false, default: '10', description: 'Maximum traversal depth' }
      },
      
      'reverse-dependencies': {
        artifactUri: { type: 'uri', required: true, description: 'URI of the artifact' }
      },
      
      'impact-subjects': {
        subjectList: { type: 'values', required: true, description: 'SPARQL VALUES list of changed subjects' }
      },
      
      'impact-artifacts': {
        subjectList: { type: 'values', required: true, description: 'SPARQL VALUES list of changed subjects' }
      },
      
      'build-order': {
        artifactList: { type: 'values', required: true, description: 'SPARQL VALUES list of artifacts' }
      },
      
      'entity-properties': {
        entityUri: { type: 'uri', required: true, description: 'URI of the entity' }
      },
      
      'related-entities': {
        entityUri: { type: 'uri', required: true, description: 'URI of the entity' }
      },
      
      'most-connected': {
        limit: { type: 'integer', required: false, default: '10', description: 'Maximum results to return' }
      },
      
      'potential-bottlenecks': {
        threshold: { type: 'integer', required: false, default: '5', description: 'Minimum dependent count threshold' }
      }
    };
  }

  _isValidUri(value) {
    try {
      new URL(value);
      return true;
    } catch {
      // Check for URI format without protocol
      return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
    }
  }
}

export default QueryTemplateLibrary;