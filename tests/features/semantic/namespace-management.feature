Feature: Namespace Management with Prefix Filtering
  As a semantic web developer
  I want to manage RDF namespaces and prefixes consistently
  So that my vocabularies are properly organized and interoperable

  Background:
    Given I have an unjucks template system with namespace management
    And I have case transformation filters available
    And I have a namespace registry configured

  Scenario: Generate namespace prefixes from organization names
    Given I have organizations: ["World Wide Web Consortium", "Dublin Core Metadata Initiative", "Friend of a Friend"]
    When I generate namespace prefixes using acronym filters
    Then the prefixes should be:
      | Organization | Acronym Filter | Suggested Prefix | Namespace URI |
      | World Wide Web Consortium | w3c | w3c | http://www.w3.org/ |
      | Dublin Core Metadata Initiative | dcmi | dcmi | http://purl.org/dc/terms/ |
      | Friend of a Friend | foaf | foaf | http://xmlns.com/foaf/0.1/ |

  Scenario: Generate consistent namespace declarations across documents
    Given I have multiple RDF documents that reference common vocabularies
    And standard prefixes: ["rdf", "rdfs", "owl", "skos", "dcat", "foaf"]
    When I generate namespace declarations using prefix standardization
    Then each document should start with:
      """
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
      @prefix dcat: <http://www.w3.org/ns/dcat#> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      """

  Scenario: Generate domain-specific namespace hierarchies
    Given I have a research domain "computational linguistics"
    And sub-domains: ["natural language processing", "machine translation", "speech recognition"]
    When I generate hierarchical namespace URIs using domain filters
    Then the namespace hierarchy should be:
      """
      @prefix cl: <http://example.org/computational-linguistics/> .
      @prefix cl-nlp: <http://example.org/computational-linguistics/nlp/> .
      @prefix cl-mt: <http://example.org/computational-linguistics/machine-translation/> .
      @prefix cl-sr: <http://example.org/computational-linguistics/speech-recognition/> .
      """

  Scenario: Generate versioned namespace URIs with date filters
    Given I have a vocabulary "Academic Metadata Schema"
    And versions: ["1.0", "1.1", "2.0"]
    And release dates: ["2023-01-15", "2023-06-10", "2024-03-22"]
    When I generate versioned namespace URIs using date and version filters
    Then the versioned namespaces should be:
      """
      @prefix ams: <http://example.org/ams/> .
      @prefix ams-v1: <http://example.org/ams/v1.0/> .
      @prefix ams-v1-1: <http://example.org/ams/v1.1/> .
      @prefix ams-v2: <http://example.org/ams/v2.0/> .
      
      # Date-based versioning
      @prefix ams-2023-01: <http://example.org/ams/2023-01-15/> .
      @prefix ams-2023-06: <http://example.org/ams/2023-06-10/> .
      @prefix ams-2024-03: <http://example.org/ams/2024-03-22/> .
      """

  Scenario: Generate namespace imports for OWL ontologies
    Given I have an OWL ontology that imports multiple vocabularies
    And import dependencies: ["schema.org", "Dublin Core", "SKOS", "FOAF"]
    When I generate OWL imports using namespace filtering
    Then the ontology header should include:
      """
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix schema: <http://schema.org/> .
      @prefix dct: <http://purl.org/dc/terms/> .
      @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix ex: <http://example.org/ontology/> .
      
      <http://example.org/ontology/> a owl:Ontology ;
          owl:imports <http://schema.org/>,
                      <http://purl.org/dc/terms/>,
                      <http://www.w3.org/2004/02/skos/core#>,
                      <http://xmlns.com/foaf/0.1/> .
      """

  Scenario: Generate prefix mappings for SPARQL queries
    Given I have SPARQL queries that use multiple vocabularies
    And common vocabulary patterns: ["schema properties", "dublin core metadata", "geographical terms"]
    When I generate SPARQL prefix declarations using vocabulary categorization
    Then the SPARQL query should begin with:
      """
      # Schema.org vocabulary for structured data
      PREFIX schema: <http://schema.org/>
      
      # Dublin Core for metadata
      PREFIX dct: <http://purl.org/dc/terms/>
      PREFIX dcterms: <http://purl.org/dc/terms/>
      
      # Geographic vocabulary
      PREFIX geo: <http://www.w3.org/2003/01/geo/wgs84_pos#>
      PREFIX geonames: <http://www.geonames.org/ontology#>
      
      # Application-specific
      PREFIX ex: <http://example.org/>
      
      SELECT ?resource ?title ?created ?location
      WHERE {
          ?resource schema:name ?title ;
                    dct:created ?created ;
                    geo:lat ?lat ;
                    geo:long ?long .
          BIND(CONCAT("Lat: ", STR(?lat), ", Long: ", STR(?long)) as ?location)
      }
      """

  Scenario: Generate JSON-LD context with filtered prefix mappings
    Given I have JSON-LD documents that need context definitions
    And vocabulary mappings: ["person info", "publication data", "organizational structure"]
    When I generate JSON-LD context using camelCase property filtering
    Then the context should be:
      """
      {
        "@context": {
          "@vocab": "http://example.org/",
          "schema": "http://schema.org/",
          "dct": "http://purl.org/dc/terms/",
          "foaf": "http://xmlns.com/foaf/0.1/",
          
          "Person": "schema:Person",
          "Organization": "schema:Organization",
          "ScholarlyArticle": "schema:ScholarlyArticle",
          
          "firstName": "schema:givenName",
          "lastName": "schema:familyName",
          "emailAddress": "schema:email",
          "phoneNumber": "schema:telephone",
          "jobTitle": "schema:jobTitle",
          "workLocation": "schema:workLocation",
          
          "publicationTitle": "schema:name",
          "publicationDate": "dct:date",
          "publishedBy": "schema:publisher",
          "authoredBy": "schema:author",
          "isPartOf": "schema:isPartOf",
          
          "organizationName": "schema:name",
          "parentOrganization": "schema:parentOrganization",
          "departmentOf": "schema:department",
          "memberOf": "schema:member"
        }
      }
      """

  Scenario: Generate namespace documentation with usage examples
    Given I have custom vocabularies with specific use cases
    And vocabulary terms: ["research project", "collaboration network", "publication metrics"]
    When I generate namespace documentation using example filtering
    Then the documentation should include:
      """
      # Research Project Vocabulary (http://example.org/research/)
      
      ## Classes
      
      ### ex:ResearchProject
      **Usage**: Describes academic or industrial research initiatives
      **Example**:
      ```turtle
      ex:nlp-sentiment-analysis a ex:ResearchProject ;
          schema:name "Sentiment Analysis in Social Media" ;
          ex:startDate "2024-01-15"^^xsd:date ;
          ex:principalInvestigator ex:person/jane-smith .
      ```
      
      ## Properties
      
      ### ex:collaborationNetwork  
      **Domain**: ex:ResearchProject
      **Range**: ex:CollaborationNetwork
      **Usage**: Links research projects to their collaboration networks
      **Example**:
      ```turtle
      ex:nlp-sentiment-analysis ex:collaborationNetwork ex:academic-industry-network .
      ```
      
      ### ex:publicationMetrics
      **Domain**: schema:ScholarlyArticle  
      **Range**: ex:MetricsData
      **Usage**: Quantitative measures of publication impact
      **Example**:
      ```turtle
      ex:paper-123 ex:publicationMetrics [
          ex:citationCount 42 ;
          ex:hIndex 15 ;
          ex:impactFactor 2.34
      ] .
      ```
      """

  Scenario: Generate cross-vocabulary alignment mappings
    Given I have vocabularies that need alignment: ["local schema", "schema.org", "Dublin Core"]
    And alignment relationships: ["equivalent", "broader", "narrower", "related"]
    When I generate vocabulary alignment using relationship filters
    Then the alignment should be expressed as:
      """
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
      @prefix schema: <http://schema.org/> .
      @prefix dct: <http://purl.org/dc/terms/> .
      @prefix ex: <http://example.org/> .
      
      # Equivalent mappings
      ex:firstName owl:equivalentProperty schema:givenName .
      ex:lastName owl:equivalentProperty schema:familyName .
      ex:createdDate owl:equivalentProperty dct:created .
      
      # Broader/Narrower relationships  
      ex:AcademicPerson rdfs:subClassOf schema:Person .
      ex:ResearchArticle rdfs:subClassOf schema:ScholarlyArticle .
      
      # Related concepts
      ex:affiliatedWith skos:related schema:memberOf .
      ex:supervisedBy skos:related schema:employee .
      
      # Cross-vocabulary property chains
      ex:indirectCollaboration owl:propertyChainAxiom (
          ex:collaboratesWith 
          ex:collaboratesWith
      ) .
      """