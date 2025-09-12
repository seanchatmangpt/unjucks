/**
 * KGEN Predefined SPARQL Query Templates
 * 
 * Comprehensive library of optimized SPARQL queries for template rendering,
 * context extraction, provenance tracking, and compliance validation.
 */

export class KgenQueryTemplates {
  constructor() {
    this.templates = new Map();
    this.categories = new Set();
    
    this.initializeTemplates();
  }

  /**
   * Get all available query templates
   */
  getAllTemplates() {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category) {
    return this.getAllTemplates().filter(t => t.category === category);
  }

  /**
   * Get template by name
   */
  getTemplate(name) {
    return this.templates.get(name);
  }

  /**
   * Get all categories
   */
  getCategories() {
    return Array.from(this.categories);
  }

  /**
   * Execute template with parameter substitution
   */
  executeTemplate(name, parameters = {}) {
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

    // Set defaults for optional parameters
    query = query.replace(/{{(\w+):([^}]+)}}/g, (match, param, defaultValue) => {
      return parameters[param] || defaultValue;
    });

    return query;
  }

  /**
   * Search templates by keyword
   */
  searchTemplates(keyword) {
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
  addTemplate(template) {
    this.templates.set(template.name, template);
    this.categories.add(template.category);
  }

  // Template initialization methods

  initializeTemplates() {
    this.initializeContextExtractionTemplates();
    this.initializeProvenanceTemplates();
    this.initializeValidationTemplates();
    this.initializeComplianceTemplates();
    this.initializeAnalyticsTemplates();
    this.initializeApiTemplates();
    this.initializeTemplateRenderingTemplates();
  }

  initializeContextExtractionTemplates() {
    this.categories.add('context');

    // API Resource Context
    this.templates.set('api-resource-context', {
      name: 'api-resource-context',
      description: 'Extract context for API resource templates',
      category: 'context',
      complexity: 'low',
      estimatedCost: 200,
      parameters: [
        {
          name: 'resourceType',
          type: 'literal',
          required: true,
          description: 'API resource type (User, Order, Product, etc.)',
          example: 'User'
        },
        {
          name: 'includeRelations',
          type: 'literal',
          required: false,
          description: 'Include related resources',
          example: 'true'
        }
      ],
      examples: [
        {
          description: 'Get User resource context',
          parameters: { resourceType: 'User', includeRelations: 'true' },
          expectedResults: 25
        }
      ],
      sparql: `
        PREFIX api: <http://kgen.enterprise/api/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX kgen: <http://kgen.enterprise/>
        
        SELECT ?resource ?property ?value ?type ?required ?description ?example WHERE {
          ?resource a api:{{resourceType}} .
          ?resource api:hasProperty ?property .
          ?property api:propertyType ?type .
          ?property api:required ?required .
          
          OPTIONAL { ?property rdfs:label ?value }
          OPTIONAL { ?property rdfs:comment ?description }
          OPTIONAL { ?property api:example ?example }
          
          {{#if includeRelations}}
          UNION {
            ?resource api:relatedTo ?related .
            ?related a ?relatedType .
            BIND(?relatedType AS ?type)
            BIND("relation" AS ?property)
            BIND(?related AS ?value)
          }
          {{/if}}
        }
        ORDER BY ?property ?type
        LIMIT {{limit:500}}
      `
    });

    // Template Context Builder
    this.templates.set('template-context-builder', {
      name: 'template-context-builder',
      description: 'Build comprehensive context for template rendering',
      category: 'context',
      complexity: 'medium',
      estimatedCost: 400,
      parameters: [
        {
          name: 'templateUri',
          type: 'uri',
          required: true,
          description: 'URI of the template to build context for',
          example: 'http://kgen.enterprise/templates/user-crud'
        },
        {
          name: 'depth',
          type: 'literal',
          required: false,
          description: 'Context extraction depth',
          example: '3',
          validation: /^\d+$/
        }
      ],
      examples: [
        {
          description: 'Build context for CRUD template',
          parameters: { templateUri: 'http://kgen.enterprise/templates/api-controller', depth: '2' },
          expectedResults: 50
        }
      ],
      sparql: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX prov: <http://www.w3.org/ns/prov#>
        
        SELECT ?entity ?entityType ?property ?value ?importance ?contextType WHERE {
          <{{templateUri}}> kgen:requiresContext ?context .
          ?context kgen:includesEntity ?entity .
          ?entity a ?entityType .
          ?entity ?property ?value .
          
          OPTIONAL { ?context kgen:importance ?importance }
          OPTIONAL { ?context kgen:contextType ?contextType }
          
          # Include related entities within specified depth
          {
            <{{templateUri}}> (kgen:requiresContext/kgen:includesEntity){1,{{depth:2}}} ?entity .
          }
          
          # Calculate importance based on usage frequency
          {
            SELECT ?entity (COUNT(?usage) AS ?usageCount) WHERE {
              ?usage kgen:usesEntity ?entity .
            } GROUP BY ?entity
          }
          BIND(?usageCount / 100.0 AS ?importance)
        }
        ORDER BY DESC(?importance) ?entityType
        LIMIT {{limit:1000}}
      `
    });

    // Entity Relationship Context
    this.templates.set('entity-relationship-context', {
      name: 'entity-relationship-context',
      description: 'Extract entity relationships for ERD generation',
      category: 'context',
      complexity: 'medium',
      estimatedCost: 350,
      parameters: [
        {
          name: 'domainUri',
          type: 'uri',
          required: false,
          description: 'Domain or namespace URI to focus on',
          example: 'http://kgen.enterprise/domain/ecommerce'
        },
        {
          name: 'relationshipType',
          type: 'literal',
          required: false,
          description: 'Type of relationships (hasOne, hasMany, belongsTo)',
          example: 'hasMany'
        }
      ],
      examples: [
        {
          description: 'Get e-commerce entity relationships',
          parameters: { domainUri: 'http://kgen.enterprise/domain/ecommerce' },
          expectedResults: 30
        }
      ],
      sparql: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?sourceEntity ?targetEntity ?relationship ?cardinality ?description WHERE {
          ?sourceEntity kgen:hasRelationship ?rel .
          ?rel kgen:targetEntity ?targetEntity .
          ?rel kgen:relationshipType ?relationship .
          ?rel kgen:cardinality ?cardinality .
          
          OPTIONAL { ?rel rdfs:comment ?description }
          
          {{#if domainUri}}
          ?sourceEntity kgen:inDomain <{{domainUri}}> .
          {{/if}}
          
          {{#if relationshipType}}
          FILTER(?relationship = "{{relationshipType}}")
          {{/if}}
          
          # Exclude system relationships
          FILTER(!STRSTARTS(STR(?relationship), "http://www.w3.org/"))
        }
        ORDER BY ?sourceEntity ?relationship
        LIMIT {{limit:200}}
      `
    });

    // Schema Context Extraction
    this.templates.set('schema-context', {
      name: 'schema-context',
      description: 'Extract database schema context for migrations and models',
      category: 'context',
      complexity: 'medium',
      estimatedCost: 300,
      parameters: [
        {
          name: 'schemaUri',
          type: 'uri',
          required: true,
          description: 'Database schema URI',
          example: 'http://kgen.enterprise/schema/main'
        },
        {
          name: 'includeIndexes',
          type: 'literal',
          required: false,
          description: 'Include index information',
          example: 'true'
        }
      ],
      examples: [
        {
          description: 'Extract main database schema',
          parameters: { schemaUri: 'http://kgen.enterprise/schema/main', includeIndexes: 'true' },
          expectedResults: 40
        }
      ],
      sparql: `
        PREFIX schema: <http://kgen.enterprise/schema/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?table ?column ?dataType ?nullable ?defaultValue ?primaryKey ?foreignKey ?index WHERE {
          <{{schemaUri}}> schema:hasTable ?table .
          ?table schema:hasColumn ?column .
          ?column schema:dataType ?dataType .
          ?column schema:nullable ?nullable .
          
          OPTIONAL { ?column schema:defaultValue ?defaultValue }
          OPTIONAL { ?column schema:primaryKey ?primaryKey }
          OPTIONAL { ?column schema:foreignKey ?foreignKey }
          
          {{#if includeIndexes}}
          OPTIONAL { ?column schema:hasIndex ?index }
          {{/if}}
        }
        ORDER BY ?table ?column
        LIMIT {{limit:500}}
      `
    });
  }

  initializeProvenanceTemplates() {
    this.categories.add('provenance');

    // Template Generation Provenance
    this.templates.set('template-generation-provenance', {
      name: 'template-generation-provenance',
      description: 'Track provenance of generated templates and artifacts',
      category: 'provenance',
      complexity: 'medium',
      estimatedCost: 400,
      parameters: [
        {
          name: 'artifactUri',
          type: 'uri',
          required: true,
          description: 'URI of the generated artifact',
          example: 'http://kgen.enterprise/artifacts/user-controller.js'
        },
        {
          name: 'includeAgents',
          type: 'literal',
          required: false,
          description: 'Include agent information',
          example: 'true'
        }
      ],
      examples: [
        {
          description: 'Trace generation of user controller',
          parameters: { artifactUri: 'http://kgen.enterprise/artifacts/user-controller.js', includeAgents: 'true' },
          expectedResults: 15
        }
      ],
      sparql: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/>
        
        SELECT ?activity ?template ?rule ?agent ?timestamp ?engine ?version WHERE {
          <{{artifactUri}}> prov:wasGeneratedBy ?activity .
          ?activity prov:used ?template .
          ?template a kgen:Template .
          
          OPTIONAL { ?activity prov:used ?rule . ?rule a kgen:Rule }
          OPTIONAL { ?activity prov:startedAtTime ?timestamp }
          OPTIONAL { ?activity kgen:usedEngine ?engine }
          OPTIONAL { ?activity kgen:engineVersion ?version }
          
          {{#if includeAgents}}
          OPTIONAL { ?activity prov:wasAssociatedWith ?agent }
          {{/if}}
        }
        ORDER BY DESC(?timestamp)
        LIMIT {{limit:100}}
      `
    });

    // Rule Application Trace
    this.templates.set('rule-application-trace', {
      name: 'rule-application-trace',
      description: 'Trace application of semantic rules during generation',
      category: 'provenance',
      complexity: 'high',
      estimatedCost: 600,
      parameters: [
        {
          name: 'generationUri',
          type: 'uri',
          required: true,
          description: 'URI of the generation activity',
          example: 'http://kgen.enterprise/activities/gen-001'
        },
        {
          name: 'ruleType',
          type: 'literal',
          required: false,
          description: 'Type of rules to trace',
          example: 'transformation'
        }
      ],
      examples: [
        {
          description: 'Trace transformation rules',
          parameters: { generationUri: 'http://kgen.enterprise/activities/gen-001', ruleType: 'transformation' },
          expectedResults: 20
        }
      ],
      sparql: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/>
        
        SELECT ?step ?rule ?ruleType ?inputEntity ?outputEntity ?confidence ?timestamp WHERE {
          <{{generationUri}}> kgen:hasReasoningStep ?step .
          ?step kgen:appliedRule ?rule .
          ?step kgen:ruleType ?ruleType .
          ?step kgen:inputEntity ?inputEntity .
          ?step kgen:outputEntity ?outputEntity .
          ?step kgen:confidence ?confidence .
          ?step kgen:timestamp ?timestamp .
          
          {{#if ruleType}}
          FILTER(?ruleType = "{{ruleType}}")
          {{/if}}
        }
        ORDER BY ?timestamp ?step
        LIMIT {{limit:200}}
      `
    });

    // Dependency Chain Analysis
    this.templates.set('dependency-chain', {
      name: 'dependency-chain',
      description: 'Analyze dependency chains in template generation',
      category: 'provenance',
      complexity: 'high',
      estimatedCost: 700,
      parameters: [
        {
          name: 'rootEntity',
          type: 'uri',
          required: true,
          description: 'Root entity to analyze dependencies from',
          example: 'http://kgen.enterprise/entities/User'
        },
        {
          name: 'maxDepth',
          type: 'literal',
          required: false,
          description: 'Maximum dependency depth',
          example: '5',
          validation: /^\d+$/
        }
      ],
      examples: [
        {
          description: 'Analyze User entity dependencies',
          parameters: { rootEntity: 'http://kgen.enterprise/entities/User', maxDepth: '4' },
          expectedResults: 35
        }
      ],
      sparql: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/>
        
        SELECT ?entity ?dependency ?dependencyType ?depth ?strength WHERE {
          <{{rootEntity}}> (kgen:dependsOn){1,{{maxDepth:5}}} ?dependency .
          ?entity kgen:dependsOn ?dependency .
          ?dependency kgen:dependencyType ?dependencyType .
          
          # Calculate dependency depth
          {
            SELECT ?dependency (COUNT(?intermediate) AS ?depth) WHERE {
              <{{rootEntity}}> kgen:dependsOn* ?intermediate .
              ?intermediate kgen:dependsOn* ?dependency .
            } GROUP BY ?dependency
          }
          
          # Calculate dependency strength based on usage frequency
          {
            SELECT ?dependency (COUNT(?usage) AS ?usageCount) WHERE {
              ?usage kgen:uses ?dependency .
            } GROUP BY ?dependency
          }
          BIND(?usageCount / 10.0 AS ?strength)
        }
        ORDER BY ?depth DESC(?strength)
        LIMIT {{limit:300}}
      `
    });
  }

  initializeValidationTemplates() {
    this.categories.add('validation');

    // Schema Validation
    this.templates.set('schema-validation', {
      name: 'schema-validation',
      description: 'Validate entities against schema constraints',
      category: 'validation',
      complexity: 'medium',
      estimatedCost: 350,
      parameters: [
        {
          name: 'schemaUri',
          type: 'uri',
          required: true,
          description: 'Schema URI to validate against',
          example: 'http://kgen.enterprise/schemas/api-resource'
        },
        {
          name: 'entityType',
          type: 'literal',
          required: false,
          description: 'Specific entity type to validate',
          example: 'User'
        }
      ],
      examples: [
        {
          description: 'Validate API resources against schema',
          parameters: { schemaUri: 'http://kgen.enterprise/schemas/api-resource' },
          expectedResults: 10
        }
      ],
      sparql: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?entity ?constraint ?violation ?severity ?message WHERE {
          ?entity a ?entityType .
          <{{schemaUri}}> kgen:definesConstraints ?constraint .
          ?constraint kgen:appliesTo ?entityType .
          
          {{#if entityType}}
          FILTER(?entityType = kgen:{{entityType}})
          {{/if}}
          
          # Check for violations
          {
            # Required property violations
            ?constraint kgen:requiresProperty ?requiredProp .
            FILTER NOT EXISTS { ?entity ?requiredProp ?value }
            BIND("missing_required_property" AS ?violation)
            BIND("error" AS ?severity)
            BIND(CONCAT("Missing required property: ", STR(?requiredProp)) AS ?message)
          } UNION {
            # Data type violations
            ?constraint kgen:propertyType ?propType .
            ?constraint kgen:property ?prop .
            ?entity ?prop ?value .
            FILTER(!kgen:hasType(?value, ?propType))
            BIND("invalid_data_type" AS ?violation)
            BIND("error" AS ?severity)
            BIND(CONCAT("Invalid data type for ", STR(?prop)) AS ?message)
          } UNION {
            # Cardinality violations
            ?constraint kgen:maxCardinality ?maxCard .
            ?constraint kgen:property ?prop .
            {
              SELECT ?entity ?prop (COUNT(?value) AS ?count) WHERE {
                ?entity ?prop ?value .
              } GROUP BY ?entity ?prop
            }
            FILTER(?count > ?maxCard)
            BIND("cardinality_violation" AS ?violation)
            BIND("error" AS ?severity)
            BIND(CONCAT("Too many values for ", STR(?prop)) AS ?message)
          }
        }
        ORDER BY ?severity ?entity
        LIMIT {{limit:200}}
      `
    });

    // Template Consistency Check
    this.templates.set('template-consistency-check', {
      name: 'template-consistency-check',
      description: 'Check consistency of template definitions and usage',
      category: 'validation',
      complexity: 'high',
      estimatedCost: 500,
      parameters: [
        {
          name: 'templateSet',
          type: 'uri',
          required: false,
          description: 'Specific template set to check',
          example: 'http://kgen.enterprise/templates/crud-set'
        },
        {
          name: 'checkType',
          type: 'literal',
          required: false,
          description: 'Type of consistency check (structure, dependencies, usage)',
          example: 'dependencies'
        }
      ],
      examples: [
        {
          description: 'Check CRUD template dependencies',
          parameters: { templateSet: 'http://kgen.enterprise/templates/crud-set', checkType: 'dependencies' },
          expectedResults: 8
        }
      ],
      sparql: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?template ?inconsistency ?severity ?description WHERE {
          ?template a kgen:Template .
          
          {{#if templateSet}}
          ?template kgen:memberOf <{{templateSet}}> .
          {{/if}}
          
          {
            # Structural inconsistencies
            {{#if checkType:structure}}
            ?template kgen:hasSlot ?slot .
            FILTER NOT EXISTS { ?slot kgen:slotType ?type }
            BIND("missing_slot_type" AS ?inconsistency)
            BIND("warning" AS ?severity)
            BIND("Slot missing type definition" AS ?description)
            {{/if}}
          } UNION {
            # Dependency inconsistencies
            {{#if checkType:dependencies}}
            ?template kgen:requires ?required .
            FILTER NOT EXISTS { ?required a ?type }
            BIND("undefined_dependency" AS ?inconsistency)
            BIND("error" AS ?severity)
            BIND("Required template not defined" AS ?description)
            {{/if}}
          } UNION {
            # Usage inconsistencies
            {{#if checkType:usage}}
            ?template kgen:usedBy ?usage .
            ?usage kgen:providesInput ?input .
            ?template kgen:requiresInput ?required .
            FILTER(?input != ?required)
            BIND("input_mismatch" AS ?inconsistency)
            BIND("error" AS ?severity)
            BIND("Input requirements not met" AS ?description)
            {{/if}}
          }
        }
        ORDER BY ?severity ?template
        LIMIT {{limit:100}}
      `
    });
  }

  initializeComplianceTemplates() {
    this.categories.add('compliance');

    // GDPR Compliance Check
    this.templates.set('gdpr-compliance-check', {
      name: 'gdpr-compliance-check',
      description: 'Check GDPR compliance of data processing templates',
      category: 'compliance',
      complexity: 'high',
      estimatedCost: 600,
      parameters: [
        {
          name: 'processingActivity',
          type: 'uri',
          required: false,
          description: 'Specific processing activity to check',
          example: 'http://kgen.enterprise/activities/user-registration'
        },
        {
          name: 'dataCategory',
          type: 'literal',
          required: false,
          description: 'Category of personal data',
          example: 'sensitive'
        }
      ],
      examples: [
        {
          description: 'Check user registration GDPR compliance',
          parameters: { processingActivity: 'http://kgen.enterprise/activities/user-registration' },
          expectedResults: 12
        }
      ],
      sparql: `
        PREFIX gdpr: <http://kgen.enterprise/gdpr/>
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX kgen: <http://kgen.enterprise/>
        
        SELECT ?activity ?requirement ?compliance ?status ?legalBasis ?dataSubjects WHERE {
          ?activity a gdpr:ProcessingActivity .
          ?requirement a gdpr:ComplianceRequirement .
          
          {{#if processingActivity}}
          FILTER(?activity = <{{processingActivity}}>)
          {{/if}}
          
          # Check compliance status
          OPTIONAL { ?activity gdpr:meetsRequirement ?requirement . BIND("compliant" AS ?compliance) }
          OPTIONAL { ?activity gdpr:violatesRequirement ?requirement . BIND("violation" AS ?compliance) }
          OPTIONAL { ?activity gdpr:partiallyMeets ?requirement . BIND("partial" AS ?compliance) }
          
          # Legal basis and data subject information
          OPTIONAL { ?activity gdpr:legalBasis ?legalBasis }
          OPTIONAL { ?activity gdpr:dataSubjects ?dataSubjects }
          
          # Data category filtering
          {{#if dataCategory}}
          ?activity gdpr:processesDataCategory gdpr:{{dataCategory}} .
          {{/if}}
          
          # Determine overall status
          BIND(
            IF(BOUND(?compliance),
              ?compliance,
              "not_assessed"
            ) AS ?status
          )
        }
        ORDER BY ?status ?activity
        LIMIT {{limit:150}}
      `
    });

    // API Security Compliance
    this.templates.set('api-security-compliance', {
      name: 'api-security-compliance',
      description: 'Validate API endpoints against security compliance requirements',
      category: 'compliance',
      complexity: 'medium',
      estimatedCost: 450,
      parameters: [
        {
          name: 'apiEndpoint',
          type: 'uri',
          required: false,
          description: 'Specific API endpoint to check',
          example: 'http://kgen.enterprise/api/users'
        },
        {
          name: 'securityLevel',
          type: 'literal',
          required: false,
          description: 'Required security level (basic, standard, high)',
          example: 'high'
        }
      ],
      examples: [
        {
          description: 'Check user API security compliance',
          parameters: { apiEndpoint: 'http://kgen.enterprise/api/users', securityLevel: 'high' },
          expectedResults: 8
        }
      ],
      sparql: `
        PREFIX api: <http://kgen.enterprise/api/>
        PREFIX security: <http://kgen.enterprise/security/>
        PREFIX kgen: <http://kgen.enterprise/>
        
        SELECT ?endpoint ?requirement ?implemented ?status ?riskLevel WHERE {
          ?endpoint a api:Endpoint .
          ?requirement a security:Requirement .
          ?requirement security:appliesTo api:Endpoint .
          
          {{#if apiEndpoint}}
          FILTER(?endpoint = <{{apiEndpoint}}>)
          {{/if}}
          
          {{#if securityLevel}}
          ?requirement security:minLevel security:{{securityLevel}} .
          {{/if}}
          
          # Check implementation status
          OPTIONAL { 
            ?endpoint security:implements ?requirement .
            BIND(true AS ?implemented)
          }
          
          # Determine status and risk level
          BIND(
            IF(BOUND(?implemented),
              "compliant",
              "non_compliant"
            ) AS ?status
          )
          
          BIND(
            IF(?status = "compliant",
              "low",
              IF(?requirement security:criticality "high", "high", "medium")
            ) AS ?riskLevel
          )
        }
        ORDER BY ?riskLevel ?endpoint
        LIMIT {{limit:100}}
      `
    });
  }

  initializeAnalyticsTemplates() {
    this.categories.add('analytics');

    // Template Usage Analytics
    this.templates.set('template-usage-analytics', {
      name: 'template-usage-analytics',
      description: 'Analyze template usage patterns and popularity',
      category: 'analytics',
      complexity: 'medium',
      estimatedCost: 400,
      parameters: [
        {
          name: 'timeRange',
          type: 'literal',
          required: false,
          description: 'Time range in days',
          example: '30',
          validation: /^\d+$/
        },
        {
          name: 'templateCategory',
          type: 'literal',
          required: false,
          description: 'Template category to analyze',
          example: 'api'
        }
      ],
      examples: [
        {
          description: 'Analyze API template usage in last 30 days',
          parameters: { timeRange: '30', templateCategory: 'api' },
          expectedResults: 25
        }
      ],
      sparql: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        
        SELECT ?template ?category ?usageCount ?lastUsed ?avgExecutionTime ?successRate WHERE {
          {
            SELECT ?template 
                   (COUNT(?usage) AS ?usageCount)
                   (MAX(?timestamp) AS ?lastUsed)
                   (AVG(?execTime) AS ?avgExecutionTime)
                   (SUM(?success) / COUNT(?usage) AS ?successRate) WHERE {
              ?usage prov:used ?template .
              ?template a kgen:Template .
              ?usage prov:startedAtTime ?timestamp .
              
              {{#if timeRange}}
              FILTER(?timestamp >= (NOW() - "P{{timeRange}}D"^^xsd:duration))
              {{/if}}
              
              OPTIONAL { ?usage kgen:executionTime ?execTime }
              OPTIONAL { ?usage kgen:successful ?success }
            } GROUP BY ?template
          }
          
          ?template kgen:category ?category .
          
          {{#if templateCategory}}
          FILTER(?category = "{{templateCategory}}")
          {{/if}}
        }
        ORDER BY DESC(?usageCount) ?template
        LIMIT {{limit:100}}
      `
    });

    // Generation Quality Metrics
    this.templates.set('generation-quality-metrics', {
      name: 'generation-quality-metrics',
      description: 'Analyze quality metrics of generated artifacts',
      category: 'analytics',
      complexity: 'high',
      estimatedCost: 550,
      parameters: [
        {
          name: 'artifactType',
          type: 'literal',
          required: false,
          description: 'Type of artifacts to analyze',
          example: 'controller'
        },
        {
          name: 'qualityThreshold',
          type: 'literal',
          required: false,
          description: 'Minimum quality score',
          example: '0.8',
          validation: /^\d*\.?\d+$/
        }
      ],
      examples: [
        {
          description: 'Analyze controller generation quality',
          parameters: { artifactType: 'controller', qualityThreshold: '0.7' },
          expectedResults: 30
        }
      ],
      sparql: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX prov: <http://www.w3.org/ns/prov#>
        
        SELECT ?artifact ?type ?qualityScore ?testCoverage ?complexity ?maintainability WHERE {
          ?artifact a kgen:GeneratedArtifact .
          ?artifact kgen:artifactType ?type .
          ?artifact kgen:qualityScore ?qualityScore .
          
          {{#if artifactType}}
          FILTER(?type = "{{artifactType}}")
          {{/if}}
          
          {{#if qualityThreshold}}
          FILTER(?qualityScore >= {{qualityThreshold}})
          {{/if}}
          
          OPTIONAL { ?artifact kgen:testCoverage ?testCoverage }
          OPTIONAL { ?artifact kgen:cyclomaticComplexity ?complexity }
          OPTIONAL { ?artifact kgen:maintainabilityIndex ?maintainability }
          
          # Include generation metadata
          ?artifact prov:wasGeneratedBy ?activity .
          ?activity prov:startedAtTime ?timestamp .
        }
        ORDER BY DESC(?qualityScore) ?timestamp
        LIMIT {{limit:200}}
      `
    });
  }

  initializeApiTemplates() {
    this.categories.add('api');

    // RESTful API Pattern Detection
    this.templates.set('rest-api-patterns', {
      name: 'rest-api-patterns',
      description: 'Detect and analyze RESTful API patterns in the knowledge graph',
      category: 'api',
      complexity: 'medium',
      estimatedCost: 350,
      parameters: [
        {
          name: 'resourceType',
          type: 'literal',
          required: false,
          description: 'Specific resource type to analyze',
          example: 'User'
        },
        {
          name: 'includeNested',
          type: 'literal',
          required: false,
          description: 'Include nested resource patterns',
          example: 'true'
        }
      ],
      examples: [
        {
          description: 'Analyze User resource REST patterns',
          parameters: { resourceType: 'User', includeNested: 'true' },
          expectedResults: 18
        }
      ],
      sparql: `
        PREFIX api: <http://kgen.enterprise/api/>
        PREFIX rest: <http://kgen.enterprise/rest/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?resource ?endpoint ?method ?pattern ?statusCode ?mediaType WHERE {
          ?resource a api:Resource .
          ?resource api:hasEndpoint ?endpoint .
          ?endpoint rest:method ?method .
          ?endpoint rest:pattern ?pattern .
          
          {{#if resourceType}}
          ?resource api:resourceType "{{resourceType}}" .
          {{/if}}
          
          OPTIONAL { ?endpoint rest:responseStatus ?statusCode }
          OPTIONAL { ?endpoint rest:mediaType ?mediaType }
          
          {{#if includeNested}}
          UNION {
            ?resource api:hasNestedResource ?nested .
            ?nested api:hasEndpoint ?endpoint .
            ?endpoint rest:method ?method .
            ?endpoint rest:pattern ?pattern .
            BIND(CONCAT(STR(?resource), "/", STR(?nested)) AS ?resource)
          }
          {{/if}}
        }
        ORDER BY ?resource ?method
        LIMIT {{limit:150}}
      `
    });

    // OpenAPI Schema Extraction
    this.templates.set('openapi-schema-extraction', {
      name: 'openapi-schema-extraction',
      description: 'Extract OpenAPI schema information for documentation generation',
      category: 'api',
      complexity: 'high',
      estimatedCost: 500,
      parameters: [
        {
          name: 'apiVersion',
          type: 'literal',
          required: false,
          description: 'API version to extract',
          example: 'v1'
        },
        {
          name: 'includeExamples',
          type: 'literal',
          required: false,
          description: 'Include request/response examples',
          example: 'true'
        }
      ],
      examples: [
        {
          description: 'Extract v1 API schema with examples',
          parameters: { apiVersion: 'v1', includeExamples: 'true' },
          expectedResults: 45
        }
      ],
      sparql: `
        PREFIX api: <http://kgen.enterprise/api/>
        PREFIX openapi: <http://kgen.enterprise/openapi/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?path ?operation ?schema ?property ?type ?required ?example ?description WHERE {
          ?api a openapi:API .
          ?api openapi:hasPath ?path .
          ?path openapi:hasOperation ?operation .
          ?operation openapi:hasSchema ?schema .
          
          {{#if apiVersion}}
          ?api openapi:version "{{apiVersion}}" .
          {{/if}}
          
          # Schema properties
          ?schema openapi:hasProperty ?property .
          ?property openapi:type ?type .
          ?property openapi:required ?required .
          
          OPTIONAL { ?property rdfs:comment ?description }
          
          {{#if includeExamples}}
          OPTIONAL { ?property openapi:example ?example }
          {{/if}}
        }
        ORDER BY ?path ?operation ?property
        LIMIT {{limit:300}}
      `
    });
  }

  initializeTemplateRenderingTemplates() {
    this.categories.add('rendering');

    // Template Variable Resolution
    this.templates.set('template-variable-resolution', {
      name: 'template-variable-resolution',
      description: 'Resolve template variables and their values for rendering',
      category: 'rendering',
      complexity: 'medium',
      estimatedCost: 300,
      parameters: [
        {
          name: 'templateUri',
          type: 'uri',
          required: true,
          description: 'Template URI to resolve variables for',
          example: 'http://kgen.enterprise/templates/user-model'
        },
        {
          name: 'contextUri',
          type: 'uri',
          required: false,
          description: 'Context URI for variable resolution',
          example: 'http://kgen.enterprise/contexts/ecommerce'
        }
      ],
      examples: [
        {
          description: 'Resolve user model template variables',
          parameters: { templateUri: 'http://kgen.enterprise/templates/user-model' },
          expectedResults: 20
        }
      ],
      sparql: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?variable ?value ?type ?defaultValue ?description ?source WHERE {
          <{{templateUri}}> kgen:hasVariable ?variable .
          ?variable kgen:variableType ?type .
          
          {{#if contextUri}}
          <{{contextUri}}> kgen:providesValue ?variableValue .
          ?variableValue kgen:forVariable ?variable .
          ?variableValue kgen:value ?value .
          BIND("context" AS ?source)
          {{/if}}
          
          UNION {
            # Default values
            ?variable kgen:defaultValue ?defaultValue .
            BIND(?defaultValue AS ?value)
            BIND("default" AS ?source)
          }
          
          UNION {
            # Computed values
            ?variable kgen:computedBy ?computation .
            ?computation kgen:result ?value .
            BIND("computed" AS ?source)
          }
          
          OPTIONAL { ?variable rdfs:comment ?description }
        }
        ORDER BY ?variable ?source
        LIMIT {{limit:200}}
      `
    });

    // Template Dependency Graph
    this.templates.set('template-dependency-graph', {
      name: 'template-dependency-graph',
      description: 'Build template dependency graph for rendering order',
      category: 'rendering',
      complexity: 'high',
      estimatedCost: 450,
      parameters: [
        {
          name: 'rootTemplate',
          type: 'uri',
          required: true,
          description: 'Root template to build dependency graph from',
          example: 'http://kgen.enterprise/templates/full-stack-app'
        },
        {
          name: 'includeTransitive',
          type: 'literal',
          required: false,
          description: 'Include transitive dependencies',
          example: 'true'
        }
      ],
      examples: [
        {
          description: 'Build full-stack app dependency graph',
          parameters: { rootTemplate: 'http://kgen.enterprise/templates/full-stack-app', includeTransitive: 'true' },
          expectedResults: 35
        }
      ],
      sparql: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?template ?dependency ?dependencyType ?order ?circular ?description WHERE {
          <{{rootTemplate}}> kgen:dependsOn* ?template .
          ?template kgen:dependsOn ?dependency .
          ?dependency kgen:dependencyType ?dependencyType .
          
          {{#if includeTransitive}}
          # Include transitive dependencies
          <{{rootTemplate}}> kgen:dependsOn+ ?dependency .
          {{/if}}
          
          # Calculate rendering order (topological sort approximation)
          {
            SELECT ?template (COUNT(?dep) AS ?depCount) WHERE {
              ?template kgen:dependsOn* ?dep .
            } GROUP BY ?template
          }
          BIND(?depCount AS ?order)
          
          # Detect circular dependencies
          OPTIONAL {
            ?dependency kgen:dependsOn+ ?template .
            BIND(true AS ?circular)
          }
          
          OPTIONAL { ?dependency rdfs:comment ?description }
        }
        ORDER BY ?order ?template
        LIMIT {{limit:250}}
      `
    });
  }
}

export default KgenQueryTemplates;