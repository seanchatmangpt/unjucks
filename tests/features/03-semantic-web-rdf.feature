Feature: Semantic Web Development with RDF/OWL
  As a semantic web developer
  I want to generate RDF schemas, ontologies, and linked data applications
  So that I can build interoperable and semantically rich systems

  Background:
    Given I have unjucks configured for semantic web development
    And I have RDF/OWL processing capabilities
    And the MCP server supports semantic data operations

  Scenario: Creating an RDF ontology with OWL classes
    Given I need to model a domain ontology
    When I run "unjucks generate ontology library-management --format=turtle --withInferences --withValidation"
    Then an OWL ontology file should be created in Turtle format
    And domain classes like Book, Author, Publisher should be defined
    And object properties linking entities should be specified
    And data properties with appropriate data types should be included
    And inference rules should be defined for derived relationships
    And SHACL validation shapes should be generated

  Scenario: Generating a knowledge graph data model
    Given I want to represent complex interconnected data
    When I run "unjucks generate knowledge-graph scientific-publications --withProvenance --withVersioning"
    Then RDF triples representing publications should be created
    And provenance information should be tracked using PROV-O
    And versioning metadata should be included
    And named graphs should separate different data sources
    And SPARQL queries for common access patterns should be generated

  Scenario: Creating a linked data API with SPARQL endpoints
    Given I need to expose semantic data as linked data
    When I run "unjucks generate linked-data-api museum-collections --withContentNegotiation --withPagination"
    Then RESTful endpoints following linked data principles should be created
    And content negotiation for RDF formats should be implemented
    And SPARQL query endpoint should be exposed
    And pagination for large result sets should be configured
    And appropriate HTTP headers and status codes should be used

  Scenario: Building a semantic data integration pipeline
    Given I need to integrate data from multiple sources
    When I run "unjucks generate semantic-etl healthcare-data --withMapping --withCleaning --withValidation"
    Then data extraction scripts should be generated
    And RML mappings for data transformation should be created
    And data cleaning and normalization rules should be implemented
    And semantic validation against ontologies should be configured
    And error reporting and data quality metrics should be included

  Scenario: Generating a federated query system
    Given I need to query across multiple SPARQL endpoints
    When I run "unjucks generate federated-query research-network --withOptimization --withCaching"
    Then federated SPARQL query processor should be created
    And query optimization for distributed execution should be implemented
    And result caching mechanisms should be configured
    And endpoint availability monitoring should be included
    And query rewriting for efficiency should be supported

  Scenario: Creating semantic search capabilities
    Given I want to enable intelligent search over RDF data
    When I run "unjucks generate semantic-search product-catalog --withNLP --withRanking --withFacets"
    Then natural language query processing should be implemented
    And SPARQL query generation from keywords should be created
    And result ranking based on relevance should be configured
    And faceted search interface should be generated
    And semantic similarity calculations should be included

  Scenario: Building an RDF data validation system
    Given I need to ensure data quality and consistency
    When I run "unjucks generate rdf-validator legal-documents --withSHACL --withCustomRules --withReporting"
    Then SHACL shapes for data validation should be created
    And custom validation rules should be implemented
    And comprehensive validation reports should be generated
    And automatic data repair suggestions should be provided
    And validation performance monitoring should be included

  Scenario: Generating semantic annotations for web content
    Given I want to add structured data to web pages
    When I run "unjucks generate semantic-markup news-website --withJSONLD --withRDFa --withMicrodata"
    Then JSON-LD structured data should be generated
    And RDFa annotations should be embedded in HTML
    And Microdata markup should be included
    And Schema.org vocabulary should be properly utilized
    And validation tools for markup should be integrated

  Scenario: Creating an ontology alignment system
    Given I need to map between different ontologies
    When I run "unjucks generate ontology-alignment biomedical-terms --withSimilarity --withMapping --withValidation"
    Then similarity calculation algorithms should be implemented
    And alignment mapping generation should be created
    And alignment validation and refinement should be configured
    And confidence scoring for mappings should be included
    And alignment visualization tools should be generated

  Scenario: Building a semantic workflow orchestrator
    Given I need to coordinate semantic data processing tasks
    When I run "unjucks generate semantic-workflow data-pipeline --withProvenance --withMonitoring --withRecovery"
    Then workflow definition using semantic technologies should be created
    And provenance tracking for all operations should be implemented
    And monitoring and alerting for workflow execution should be configured
    And error recovery and retry mechanisms should be included
    And semantic metadata about workflows should be maintained

  Scenario: Generating a reasoning engine integration
    Given I need automated inference over RDF data
    When I run "unjucks generate reasoning-engine financial-compliance --withRules --withExplanation --withIncremental"
    Then integration with reasoning engines should be created
    And custom inference rules should be defined
    And explanation generation for inferred facts should be implemented
    And incremental reasoning for performance should be configured
    And reasoning result caching should be included

  Scenario: Creating a semantic data visualization system
    Given I want to visualize RDF graphs and ontologies
    When I run "unjucks generate semantic-viz network-analysis --withD3 --withFiltering --withInteraction"
    Then D3.js-based graph visualization should be created
    And filtering and querying capabilities should be implemented
    And interactive exploration features should be included
    And different layout algorithms should be supported
    And export functionality for visualizations should be provided

  Scenario: Building a semantic content management system
    Given I need to manage semantically annotated content
    When I run "unjucks generate semantic-cms digital-library --withAnnotation --withClassification --withRecommendation"
    Then semantic annotation tools should be created
    And automatic content classification should be implemented
    And recommendation system based on semantics should be configured
    And faceted browsing interface should be generated
    And semantic search across content should be enabled

  Scenario: Generating cross-domain data integration
    Given I need to integrate data across different domains
    When I run "unjucks generate cross-domain-integration smart-city --withAlignment --withTranslation --withQuality"
    Then domain ontology alignment should be created
    And data translation between schemas should be implemented
    And data quality assessment should be configured
    And conflict resolution mechanisms should be included
    And integration monitoring and reporting should be provided