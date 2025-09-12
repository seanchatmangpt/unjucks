/**
 * SPARQL Query Templates for KGEN
 * 
 * Comprehensive collection of SPARQL query templates for:
 * - Template variable resolution
 * - Context extraction
 * - Impact analysis
 * - Validation and integrity checks
 * - Provenance tracking
 * - Artifact generation support
 */

import { consola } from 'consola';

export class QueryTemplates {
  constructor(options = {}) {
    this.logger = consola.withTag('query-templates');
    this.options = {
      defaultNamespaces: {
        kgen: 'http://kgen.enterprise/',
        tmpl: 'http://kgen.enterprise/template/',
        ctx: 'http://kgen.enterprise/context/',
        dep: 'http://kgen.enterprise/dependency/',
        prov: 'http://www.w3.org/ns/prov#',
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        owl: 'http://www.w3.org/2002/07/owl#',
        xsd: 'http://www.w3.org/2001/XMLSchema#',
        dc: 'http://purl.org/dc/elements/1.1/',
        dcterms: 'http://purl.org/dc/terms/',
        foaf: 'http://xmlns.com/foaf/0.1/',
        sh: 'http://www.w3.org/ns/shacl#'
      },
      ...options
    };

    // Initialize all template collections
    this.templates = {
      ...this._getTemplateResolutionQueries(),
      ...this._getContextExtractionQueries(),
      ...this._getImpactAnalysisQueries(),
      ...this._getValidationQueries(),
      ...this._getProvenanceQueries(),
      ...this._getArtifactQueries(),
      ...this._getCodeGenerationQueries(),
      ...this._getAdvancedQueries()
    };

    this.logger.success(`Loaded ${Object.keys(this.templates).length} query templates`);
  }

  /**
   * Get a specific query template with variable substitution
   * @param {string} templateName - Name of the template
   * @param {Object} variables - Variables to substitute in template
   * @returns {string} SPARQL query with substitutions
   */
  getQuery(templateName, variables = {}) {
    const template = this.templates[templateName];
    if (!template) {
      throw new Error(`Unknown query template: ${templateName}`);
    }

    let query = this._addNamespaces(template);
    
    // Substitute variables
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      query = query.replace(new RegExp(placeholder, 'g'), value);
    }

    return query;
  }

  /**
   * Get all available template names
   * @returns {Array} Array of template names
   */
  getTemplateNames() {
    return Object.keys(this.templates);
  }

  /**
   * Get templates by category
   * @param {string} category - Template category
   * @returns {Object} Templates in the category
   */
  getTemplatesByCategory(category) {
    const categoryTemplates = {};
    
    for (const [name, template] of Object.entries(this.templates)) {
      if (name.startsWith(category)) {
        categoryTemplates[name] = template;
      }
    }
    
    return categoryTemplates;
  }

  // Template Resolution Queries
  _getTemplateResolutionQueries() {
    return {
      templateVariables: `
        SELECT ?variable ?value ?type ?default ?required WHERE {
          ?template tmpl:path "{{templatePath}}" .
          ?template tmpl:hasVariable ?var .
          ?var tmpl:name ?variable .
          OPTIONAL { ?var tmpl:value ?value }
          OPTIONAL { ?var tmpl:type ?type }
          OPTIONAL { ?var tmpl:defaultValue ?default }
          OPTIONAL { ?var tmpl:required ?required }
        }
        ORDER BY ?variable
      `,

      templateByPath: `
        SELECT ?template ?name ?description ?type ?engine WHERE {
          ?template tmpl:path "{{templatePath}}" .
          OPTIONAL { ?template tmpl:name ?name }
          OPTIONAL { ?template tmpl:description ?description }
          OPTIONAL { ?template tmpl:type ?type }
          OPTIONAL { ?template tmpl:engine ?engine }
        }
      `,

      allTemplates: `
        SELECT ?template ?path ?name ?type ?category WHERE {
          ?template a tmpl:Template .
          ?template tmpl:path ?path .
          OPTIONAL { ?template tmpl:name ?name }
          OPTIONAL { ?template tmpl:type ?type }
          OPTIONAL { ?template tmpl:category ?category }
        }
        ORDER BY ?category ?name
      `,

      templateDependencies: `
        SELECT ?dependency ?type ?required WHERE {
          ?template tmpl:path "{{templatePath}}" .
          ?template tmpl:dependsOn ?dependency .
          OPTIONAL { ?dependency a ?type }
          OPTIONAL { ?template tmpl:requiresDependency ?required }
        }
      `,

      contextualVariables: `
        SELECT ?variable ?value ?scope ?priority WHERE {
          {
            # Template-specific variables
            ?template tmpl:path "{{templatePath}}" .
            ?template tmpl:hasVariable ?var .
            ?var tmpl:name ?variable .
            ?var tmpl:value ?value .
            BIND("template" AS ?scope)
            BIND(100 AS ?priority)
          } UNION {
            # Context-specific variables
            ?context ctx:appliesTo ?template .
            ?template tmpl:path "{{templatePath}}" .
            ?context ctx:hasVariable ?var .
            ?var ctx:name ?variable .
            ?var ctx:value ?value .
            BIND("context" AS ?scope)
            BIND(80 AS ?priority)
          } UNION {
            # Global variables
            ?global a ctx:GlobalVariable .
            ?global ctx:name ?variable .
            ?global ctx:value ?value .
            BIND("global" AS ?scope)
            BIND(50 AS ?priority)
          }
        }
        ORDER BY DESC(?priority) ?variable
      `
    };
  }

  // Context Extraction Queries
  _getContextExtractionQueries() {
    return {
      entityContext: `
        SELECT ?property ?value ?type ?language ?datatype WHERE {
          <{{entityUri}}> ?property ?value .
          OPTIONAL { ?value rdf:type ?type }
          OPTIONAL { ?value rdf:langString ?language }
          OPTIONAL { BIND(datatype(?value) AS ?datatype) }
          FILTER(?property != rdf:type)
        }
        ORDER BY ?property
      `,

      entityRelations: `
        SELECT ?relation ?target ?direction ?type WHERE {
          {
            <{{entityUri}}> ?relation ?target .
            OPTIONAL { ?target rdf:type ?type }
            BIND("outgoing" AS ?direction)
            FILTER(isURI(?target))
            FILTER(?relation != rdf:type)
          } UNION {
            ?target ?relation <{{entityUri}}> .
            OPTIONAL { ?target rdf:type ?type }
            BIND("incoming" AS ?direction)
            FILTER(isURI(?target))
            FILTER(?relation != rdf:type)
          }
        }
        ORDER BY ?direction ?relation
      `,

      entityHierarchy: `
        SELECT ?parent ?child ?level WHERE {
          {
            <{{entityUri}}> rdfs:subClassOf* ?parent .
            BIND(0 AS ?level)
            BIND(<{{entityUri}}> AS ?child)
          } UNION {
            ?child rdfs:subClassOf* <{{entityUri}}> .
            BIND(1 AS ?level)
            BIND(?child AS ?parent)
          }
        }
        ORDER BY ?level ?parent
      `,

      domainModel: `
        SELECT ?entity ?type ?property ?range ?cardinality WHERE {
          ?entity a ?type .
          ?entity ?property ?value .
          OPTIONAL { ?property rdfs:range ?range }
          OPTIONAL { ?property kgen:cardinality ?cardinality }
          FILTER(?type = <{{domainType}}>)
        }
        ORDER BY ?entity ?property
      `,

      codeContext: `
        SELECT ?element ?elementType ?name ?signature ?body ?documentation WHERE {
          ?entity a kgen:CodeEntity .
          ?entity kgen:hasElement ?element .
          ?element a ?elementType .
          OPTIONAL { ?element kgen:name ?name }
          OPTIONAL { ?element kgen:signature ?signature }
          OPTIONAL { ?element kgen:body ?body }
          OPTIONAL { ?element rdfs:comment ?documentation }
          FILTER(?entity = <{{entityUri}}>)
        }
        ORDER BY ?elementType ?name
      `
    };
  }

  // Impact Analysis Queries  
  _getImpactAnalysisQueries() {
    return {
      directDependents: `
        SELECT DISTINCT ?dependent ?relation ?weight WHERE {
          ?dependent ?relation <{{entityUri}}> .
          OPTIONAL { ?relation kgen:weight ?weight }
          FILTER(?relation != rdf:type)
        }
        ORDER BY DESC(?weight)
        LIMIT {{maxResults}}
      `,

      transitiveDependents: `
        SELECT ?dependent ?path ?depth WHERE {
          <{{entityUri}}> (^?relation)+ ?dependent .
          # Calculate path depth (simplified for basic SPARQL)
          BIND("1" AS ?depth)
          BIND(STR(?relation) AS ?path)
        }
        ORDER BY ?depth
        LIMIT {{maxResults}}
      `,

      impactScope: `
        SELECT ?affected ?affectedType ?relation ?criticality WHERE {
          {
            # Direct impacts
            ?affected ?relation <{{entityUri}}> .
            OPTIONAL { ?affected rdf:type ?affectedType }
            OPTIONAL { ?relation kgen:criticality ?criticality }
            FILTER(?relation != rdf:type)
          } UNION {
            # Indirect impacts through shared dependencies
            <{{entityUri}}> dep:dependsOn ?shared .
            ?affected dep:dependsOn ?shared .
            ?affected rdf:type ?affectedType .
            BIND(dep:dependsOn AS ?relation)
            BIND("shared" AS ?criticality)
            FILTER(?affected != <{{entityUri}}>)
          }
        }
        ORDER BY ?criticality ?affectedType
      `,

      changeImpact: `
        SELECT ?impacted ?impactType ?severity ?reason WHERE {
          {
            # Breaking changes
            <{{entityUri}}> kgen:hasBreakingChange ?change .
            ?change kgen:affects ?impacted .
            ?change kgen:severity ?severity .
            ?change rdfs:comment ?reason .
            BIND("breaking" AS ?impactType)
          } UNION {
            # Version compatibility issues
            <{{entityUri}}> kgen:version ?version .
            ?impacted dep:requiresVersion ?requiredVersion .
            ?impacted dep:dependsOn <{{entityUri}}> .
            BIND("version" AS ?impactType)
            BIND("medium" AS ?severity)
            BIND("Version compatibility check required" AS ?reason)
            FILTER(?version != ?requiredVersion)
          }
        }
        ORDER BY ?severity ?impactType
      `,

      riskAssessment: `
        SELECT ?risk ?riskType ?probability ?impact ?mitigation WHERE {
          <{{entityUri}}> kgen:hasRisk ?risk .
          ?risk a ?riskType .
          OPTIONAL { ?risk kgen:probability ?probability }
          OPTIONAL { ?risk kgen:impact ?impact }
          OPTIONAL { ?risk kgen:mitigation ?mitigation }
        }
        ORDER BY DESC(?probability) DESC(?impact)
      `
    };
  }

  // Validation Queries
  _getValidationQueries() {
    return {
      schemaValidation: `
        SELECT ?entity ?violation ?constraint ?value WHERE {
          ?entity a ?type .
          ?type sh:property ?propShape .
          ?propShape sh:path ?property .
          {
            # Required property missing
            ?propShape sh:minCount ?min .
            FILTER(?min > 0)
            FILTER NOT EXISTS { ?entity ?property ?value }
            BIND("missing required property" AS ?violation)
            BIND(?propShape AS ?constraint)
            BIND("null" AS ?value)
          } UNION {
            # Type constraint violation
            ?entity ?property ?value .
            ?propShape sh:datatype ?expectedType .
            BIND(datatype(?value) AS ?actualType)
            FILTER(?actualType != ?expectedType)
            BIND("type mismatch" AS ?violation)
            BIND(?propShape AS ?constraint)
          } UNION {
            # Cardinality violation
            ?propShape sh:maxCount ?max .
            {
              SELECT ?entity ?property (COUNT(?value) AS ?count) WHERE {
                ?entity ?property ?value .
              } GROUP BY ?entity ?property
            }
            FILTER(?count > ?max)
            BIND("cardinality violation" AS ?violation)
            BIND(?propShape AS ?constraint)
            BIND(STR(?count) AS ?value)
          }
        }
        ORDER BY ?entity ?violation
      `,

      referenceIntegrity: `
        SELECT ?subject ?predicate ?target ?issue WHERE {
          ?subject ?predicate ?target .
          FILTER(isURI(?target))
          FILTER(?predicate != rdf:type)
          {
            # Dangling reference
            FILTER NOT EXISTS { ?target ?p ?v }
            BIND("dangling reference" AS ?issue)
          } UNION {
            # Circular reference
            ?target (owl:sameAs|rdfs:seeAlso)* ?subject .
            FILTER(?target != ?subject)
            BIND("circular reference" AS ?issue)
          }
        }
        ORDER BY ?issue ?subject
      `,

      consistencyCheck: `
        SELECT ?entity ?inconsistency ?detail WHERE {
          {
            # Multiple types that shouldn't coexist
            ?entity a ?type1 .
            ?entity a ?type2 .
            ?type1 owl:disjointWith ?type2 .
            BIND("disjoint types" AS ?inconsistency)
            BIND(CONCAT(STR(?type1), " and ", STR(?type2)) AS ?detail)
          } UNION {
            # Property domain/range violations
            ?entity ?property ?value .
            ?property rdfs:domain ?domain .
            ?property rdfs:range ?range .
            ?entity a ?actualDomain .
            ?value a ?actualRange .
            FILTER(?actualDomain != ?domain || ?actualRange != ?range)
            BIND("domain/range violation" AS ?inconsistency)
            BIND(STR(?property) AS ?detail)
          }
        }
        ORDER BY ?inconsistency
      `,

      dataQuality: `
        SELECT ?entity ?quality ?severity ?description WHERE {
          {
            # Empty or null values
            ?entity ?property "" .
            BIND("empty value" AS ?quality)
            BIND("medium" AS ?severity)
            BIND(STR(?property) AS ?description)
          } UNION {
            # Duplicate entities (same identifier)
            ?entity kgen:identifier ?id .
            ?duplicate kgen:identifier ?id .
            FILTER(?entity != ?duplicate)
            BIND("duplicate identifier" AS ?quality)
            BIND("high" AS ?severity)
            BIND(STR(?id) AS ?description)
          } UNION {
            # Orphaned entities
            ?entity a ?type .
            FILTER NOT EXISTS { ?entity ?outgoing ?target . FILTER(?outgoing != rdf:type) }
            FILTER NOT EXISTS { ?source ?incoming ?entity . FILTER(?incoming != rdf:type) }
            BIND("orphaned entity" AS ?quality)
            BIND("low" AS ?severity)
            BIND("no connections" AS ?description)
          }
        }
        ORDER BY ?severity ?quality
      `
    };
  }

  // Provenance Queries
  _getProvenanceQueries() {
    return {
      entityLineage: `
        SELECT ?source ?activity ?agent ?timestamp ?relation WHERE {
          <{{entityUri}}> (prov:wasDerivedFrom)* ?source .
          ?source prov:wasGeneratedBy ?activity .
          ?activity prov:wasAssociatedWith ?agent .
          OPTIONAL { ?activity prov:startedAtTime ?timestamp }
          OPTIONAL { <{{entityUri}}> ?relation ?source }
        }
        ORDER BY DESC(?timestamp)
        LIMIT {{maxDepth}}
      `,

      generationHistory: `
        SELECT ?version ?timestamp ?agent ?activity ?changes WHERE {
          ?version prov:specializationOf <{{entityUri}}> .
          ?version prov:wasGeneratedBy ?activity .
          ?activity prov:wasAssociatedWith ?agent .
          ?activity prov:startedAtTime ?timestamp .
          OPTIONAL { ?activity kgen:changeDescription ?changes }
        }
        ORDER BY DESC(?timestamp)
      `,

      dependencyChain: `
        SELECT ?dependency ?level ?type ?timestamp WHERE {
          <{{entityUri}}> (dep:dependsOn)* ?dependency .
          # Simplified level calculation
          BIND(1 AS ?level)
          OPTIONAL { ?dependency a ?type }
          OPTIONAL { ?dependency dcterms:created ?timestamp }
        }
        ORDER BY ?level ?timestamp
      `,

      usageTracking: `
        SELECT ?consumer ?usage ?timestamp ?context WHERE {
          ?consumer prov:used <{{entityUri}}> .
          ?usage prov:qualifiedUsage ?qualified .
          ?qualified prov:entity <{{entityUri}}> .
          ?qualified prov:atTime ?timestamp .
          OPTIONAL { ?qualified kgen:context ?context }
        }
        ORDER BY DESC(?timestamp)
        LIMIT {{maxResults}}
      `,

      attribution: `
        SELECT ?agent ?role ?contribution ?timestamp WHERE {
          <{{entityUri}}> prov:wasAttributedTo ?agent .
          OPTIONAL { 
            ?attribution prov:agent ?agent .
            ?attribution prov:hadRole ?role .
            ?attribution kgen:contribution ?contribution .
            ?attribution prov:atTime ?timestamp .
          }
        }
        ORDER BY ?role ?timestamp
      `
    };
  }

  // Artifact Generation Queries
  _getArtifactQueries() {
    return {
      artifactTemplate: `
        SELECT ?template ?targetPath ?generator ?dependencies WHERE {
          ?artifact a kgen:Artifact .
          ?artifact kgen:identifier "{{artifactId}}" .
          ?artifact kgen:template ?template .
          OPTIONAL { ?artifact kgen:targetPath ?targetPath }
          OPTIONAL { ?artifact kgen:generator ?generator }
          OPTIONAL { ?artifact kgen:dependencies ?dependencies }
        }
      `,

      generationContext: `
        SELECT ?context ?key ?value ?type ?source WHERE {
          ?artifact kgen:identifier "{{artifactId}}" .
          ?artifact kgen:hasContext ?context .
          ?context kgen:key ?key .
          ?context kgen:value ?value .
          OPTIONAL { ?context kgen:type ?type }
          OPTIONAL { ?context kgen:source ?source }
        }
        ORDER BY ?key
      `,

      artifactDependencies: `
        SELECT ?dependency ?type ?version ?location WHERE {
          ?artifact kgen:identifier "{{artifactId}}" .
          ?artifact dep:dependsOn ?dependency .
          OPTIONAL { ?dependency a ?type }
          OPTIONAL { ?dependency kgen:version ?version }
          OPTIONAL { ?dependency kgen:location ?location }
        }
        ORDER BY ?type ?dependency
      `,

      outputMapping: `
        SELECT ?output ?format ?path ?content WHERE {
          ?artifact kgen:identifier "{{artifactId}}" .
          ?artifact kgen:produces ?output .
          ?output kgen:format ?format .
          ?output kgen:path ?path .
          OPTIONAL { ?output kgen:content ?content }
        }
        ORDER BY ?path
      `
    };
  }

  // Code Generation Queries
  _getCodeGenerationQueries() {
    return {
      codeStructure: `
        SELECT ?element ?type ?name ?parent ?order WHERE {
          ?code kgen:identifier "{{codeId}}" .
          ?code kgen:hasElement ?element .
          ?element a ?type .
          ?element kgen:name ?name .
          OPTIONAL { ?element kgen:parent ?parent }
          OPTIONAL { ?element kgen:order ?order }
        }
        ORDER BY ?parent ?order ?name
      `,

      interfaceDefinition: `
        SELECT ?interface ?method ?parameter ?returnType ?throws WHERE {
          ?interface a kgen:Interface .
          ?interface kgen:name "{{interfaceName}}" .
          ?interface kgen:hasMethod ?method .
          ?method kgen:name ?methodName .
          OPTIONAL { ?method kgen:hasParameter ?parameter }
          OPTIONAL { ?method kgen:returnType ?returnType }
          OPTIONAL { ?method kgen:throws ?throws }
        }
        ORDER BY ?methodName ?parameter
      `,

      classHierarchy: `
        SELECT ?class ?superClass ?interface ?field ?method WHERE {
          ?class kgen:name "{{className}}" .
          OPTIONAL { ?class kgen:extends ?superClass }
          OPTIONAL { ?class kgen:implements ?interface }
          OPTIONAL { ?class kgen:hasField ?field }
          OPTIONAL { ?class kgen:hasMethod ?method }
        }
      `,

      configurationValues: `
        SELECT ?config ?key ?value ?environment ?type WHERE {
          ?config a kgen:Configuration .
          ?config kgen:key ?key .
          ?config kgen:value ?value .
          OPTIONAL { ?config kgen:environment ?environment }
          OPTIONAL { ?config kgen:type ?type }
          FILTER(REGEX(?key, "{{pattern}}", "i"))
        }
        ORDER BY ?environment ?key
      `
    };
  }

  // Advanced Queries
  _getAdvancedQueries() {
    return {
      semanticSearch: `
        SELECT ?entity ?score ?relevance WHERE {
          ?entity ?property ?value .
          FILTER(REGEX(?value, "{{searchTerm}}", "i"))
          # Simplified scoring
          BIND(1 AS ?score)
          BIND("high" AS ?relevance)
        }
        ORDER BY DESC(?score)
        LIMIT {{maxResults}}
      `,

      patternMatching: `
        SELECT ?match ?pattern ?confidence WHERE {
          ?match ?relation ?target .
          # Pattern matching logic would be more complex
          BIND("{{pattern}}" AS ?pattern)
          BIND(0.8 AS ?confidence)
        }
        ORDER BY DESC(?confidence)
      `,

      graphAnalytics: `
        SELECT ?metric ?value WHERE {
          {
            SELECT (COUNT(*) AS ?value) WHERE { ?s ?p ?o }
            BIND("total_triples" AS ?metric)
          } UNION {
            SELECT (COUNT(DISTINCT ?s) AS ?value) WHERE { ?s ?p ?o }
            BIND("unique_subjects" AS ?metric)
          } UNION {
            SELECT (COUNT(DISTINCT ?p) AS ?value) WHERE { ?s ?p ?o }
            BIND("unique_predicates" AS ?metric)
          } UNION {
            SELECT (COUNT(DISTINCT ?o) AS ?value) WHERE { ?s ?p ?o }
            BIND("unique_objects" AS ?metric)
          }
        }
      `,

      temporalAnalysis: `
        SELECT ?period ?count ?trend WHERE {
          ?entity dcterms:created ?timestamp .
          BIND(SUBSTR(STR(?timestamp), 1, 10) AS ?period)
        }
        GROUP BY ?period
        ORDER BY ?period
      `
    };
  }

  _addNamespaces(query) {
    let prefixes = '';
    for (const [prefix, namespace] of Object.entries(this.options.defaultNamespaces)) {
      prefixes += `PREFIX ${prefix}: <${namespace}>\n`;
    }
    return prefixes + '\n' + query;
  }
}

export default QueryTemplates;