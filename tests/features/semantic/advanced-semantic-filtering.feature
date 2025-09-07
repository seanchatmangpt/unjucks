Feature: Advanced Semantic Filtering for Complex RDF Scenarios
  As a semantic web expert
  I want to use sophisticated template filters for complex RDF generation scenarios
  So that I can handle advanced semantic web use cases efficiently

  Background:
    Given I have an unjucks template system with advanced semantic filters
    And I have access to multi-language and datatype filtering capabilities
    And I have faker integration for realistic test data generation

  Scenario: Generate multi-language RDF literals with locale filtering
    Given I have content in multiple languages:
      | Language | Locale | Text |
      | English | en | "Artificial Intelligence Research" |
      | French | fr | "Recherche en Intelligence Artificielle" |
      | German | de | "Forschung für Künstliche Intelligenz" |
      | Spanish | es | "Investigación en Inteligencia Artificial" |
      | Japanese | ja | "人工知能研究" |
    When I generate multilingual RDF using locale-specific filters
    Then the output should include properly formatted language literals:
      """
      @prefix ex: <http://example.org/> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      
      ex:ai-research rdfs:label "Artificial Intelligence Research"@en,
                                "Recherche en Intelligence Artificielle"@fr,
                                "Forschung für Künstliche Intelligenz"@de,
                                "Investigación en Inteligencia Artificial"@es,
                                "人工知能研究"@ja .
      """

  Scenario: Generate typed literals with XSD datatype filtering
    Given I have mixed data types:
      | Property | Value | Expected Datatype |
      | publication_year | 2024 | xsd:gYear |
      | impact_factor | 3.247 | xsd:decimal |
      | is_open_access | true | xsd:boolean |
      | submission_date | 2024-01-15T10:30:00Z | xsd:dateTime |
      | page_count | 42 | xsd:positiveInteger |
      | isbn | "978-3-16-148410-0" | xsd:string |
    When I generate RDF with automatic XSD datatype detection
    Then the typed literals should be properly formatted:
      """
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      @prefix ex: <http://example.org/> .
      
      ex:publication-123 ex:publicationYear "2024"^^xsd:gYear ;
                        ex:impactFactor "3.247"^^xsd:decimal ;
                        ex:isOpenAccess "true"^^xsd:boolean ;
                        ex:submissionDate "2024-01-15T10:30:00Z"^^xsd:dateTime ;
                        ex:pageCount "42"^^xsd:positiveInteger ;
                        ex:isbn "978-3-16-148410-0"^^xsd:string .
      """

  Scenario: Generate realistic fake data using faker with semantic constraints
    Given I need to generate test data for academic profiles
    And I have semantic constraints for academic domains
    When I generate fake academic data using faker with semantic filters
    Then the generated data should be realistic and semantically consistent:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/researcher/> .
      
      ex:{{ faker.name.fullName() | slug }} a schema:Person, ex:Researcher ;
          schema:name "{{ faker.name.fullName() }}" ;
          schema:email "{{ faker.internet.email() }}" ;
          schema:telephone "{{ faker.phone.number() }}" ;
          schema:affiliation ex:org/{{ faker.company.name() | kebabCase }} ;
          ex:orcidId "{{ faker.datatype.uuid() | replace('-', '') | slice(0, 16) }}" ;
          ex:researchArea "{{ faker.helpers.arrayElement(['Machine Learning', 'Natural Language Processing', 'Computer Vision', 'Robotics', 'Data Mining']) }}" ;
          ex:yearsExperience {{ faker.datatype.number({min: 1, max: 30}) }} ;
          ex:publicationCount {{ faker.datatype.number({min: 5, max: 200}) }} ;
          ex:hIndex {{ faker.datatype.number({min: 1, max: 50}) }} .
      """

  Scenario: Generate JSON-LD with context-aware filtering
    Given I have JSON-LD context requirements for schema.org mapping
    And I need camelCase properties with proper @type mappings
    When I generate JSON-LD using context-aware filtering
    Then the JSON-LD should have proper context and structure:
      """
      {
        "@context": {
          "@vocab": "http://schema.org/",
          "ex": "http://example.org/",
          "Person": "schema:Person",
          "ScholarlyArticle": "schema:ScholarlyArticle",
          "firstName": "givenName",
          "lastName": "familyName",
          "publicationDate": {"@id": "datePublished", "@type": "Date"},
          "citationCount": {"@id": "ex:citationCount", "@type": "Integer"}
        },
        "@graph": [
          {
            "@type": "Person",
            "@id": "ex:researcher/{{ researcherName | slug }}",
            "firstName": "{{ researcherName | split(' ') | first }}",
            "lastName": "{{ researcherName | split(' ') | last }}",
            "author": [
              {
                "@type": "ScholarlyArticle",
                "@id": "ex:publication/{{ publicationTitle | slug }}",
                "name": "{{ publicationTitle }}",
                "publicationDate": "{{ publicationDate | formatDate('YYYY-MM-DD') }}",
                "citationCount": {{ citationCount | int }}
              }
            ]
          }
        ]
      }
      """

  Scenario: Generate SHACL shapes with validation constraint filtering
    Given I have data validation requirements for academic entities
    And I need SHACL shapes with complex constraints
    When I generate SHACL shapes using validation filtering
    Then the shapes should enforce proper data quality:
      """
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix schema: <http://schema.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      
      ex:ResearcherShape a sh:NodeShape ;
          sh:targetClass ex:Researcher ;
          sh:property [
              sh:path schema:name ;
              sh:minCount 1 ;
              sh:maxCount 1 ;
              sh:datatype xsd:string ;
              sh:minLength 2 ;
              sh:maxLength 100 ;
              sh:message "Researcher must have exactly one name between 2-100 characters"
          ] ;
          sh:property [
              sh:path schema:email ;
              sh:minCount 1 ;
              sh:datatype xsd:string ;
              sh:pattern "^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$" ;
              sh:message "Valid email address is required"
          ] ;
          sh:property [
              sh:path ex:publicationCount ;
              sh:datatype xsd:nonNegativeInteger ;
              sh:minInclusive 0 ;
              sh:maxInclusive 1000 ;
              sh:message "Publication count must be between 0 and 1000"
          ] ;
          sh:property [
              sh:path ex:hIndex ;
              sh:datatype xsd:nonNegativeInteger ;
              sh:minInclusive 0 ;
              sh:maxInclusive 200 ;
              sh:message "H-index must be between 0 and 200"
          ] .
      """

  Scenario: Generate OWL ontology with complex restriction filtering
    Given I have domain requirements for academic ontology modeling
    And I need OWL restrictions for research collaboration patterns
    When I generate OWL restrictions using complex filtering logic
    Then the ontology should include sophisticated logical constraints:
      """
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix ex: <http://example.org/> .
      @prefix schema: <http://schema.org/> .
      
      # Complex class with multiple restrictions
      ex:SeniorResearcher a owl:Class ;
          rdfs:subClassOf ex:Researcher ;
          owl:equivalentClass [
              a owl:Class ;
              owl:intersectionOf (
                  ex:Researcher
                  [a owl:Restriction ;
                   owl:onProperty ex:yearsExperience ;
                   owl:minQualifiedCardinality 10 ;
                   owl:onDataRange xsd:positiveInteger]
                  [a owl:Restriction ;
                   owl:onProperty ex:hIndex ;
                   owl:minQualifiedCardinality 15 ;
                   owl:onDataRange xsd:positiveInteger]
                  [a owl:Restriction ;
                   owl:onProperty ex:publicationCount ;
                   owl:minQualifiedCardinality 20 ;
                   owl:onDataRange xsd:positiveInteger]
              )
          ] .
      
      # Disjoint classes with covering constraints
      ex:Researcher owl:disjointUnionOf (
          ex:JuniorResearcher
          ex:MidCareerResearcher  
          ex:SeniorResearcher
      ) .
      
      # Complex property restriction
      ex:CollaborationNetwork a owl:Class ;
          rdfs:subClassOf [
              a owl:Restriction ;
              owl:onProperty ex:hasCollaborator ;
              owl:minQualifiedCardinality 2 ;
              owl:onClass ex:Researcher
          ] ;
          rdfs:subClassOf [
              a owl:Restriction ;
              owl:onProperty ex:collaborationStrength ;
              owl:allValuesFrom [
                  a rdfs:Datatype ;
                  owl:onDatatype xsd:decimal ;
                  owl:withRestrictions (
                      [xsd:minInclusive 0.0]
                      [xsd:maxInclusive 1.0]
                  )
              ]
          ] .
      """

  Scenario: Generate RDF-star (RDF*) statements with meta-properties
    Given I have requirements for statement-level metadata (RDF-star)
    And I need to track provenance and confidence at the triple level
    When I generate RDF-star using meta-property filtering
    Then the output should use RDF-star syntax for statement annotation:
      """
      @prefix ex: <http://example.org/> .
      @prefix prov: <http://www.w3.org/ns/prov#> .
      @prefix schema: <http://schema.org/> .
      
      # Main statements with embedded triples
      << ex:researcher/alice-johnson ex:collaboratesWith ex:researcher/bob-smith >>
          ex:confidenceScore 0.95 ;
          prov:wasDerivedFrom ex:analysis/coauthor-detection ;
          ex:evidenceType "direct-coauthorship" ;
          ex:detectedOn "2024-01-15T10:30:00Z"^^xsd:dateTime .
      
      << ex:researcher/alice-johnson schema:affiliation ex:org/mit >>
          ex:validFrom "2020-09-01"^^xsd:date ;
          ex:validTo "2024-12-31"^^xsd:date ;
          prov:wasDerivedFrom ex:source/hr-database ;
          ex:verificationStatus "confirmed" .
      
      # Nested statements about statements
      << << ex:researcher/alice-johnson ex:expertise "machine-learning" >>
         ex:confidenceScore 0.87 >>
          prov:generatedBy ex:analysis/skill-extraction ;
          ex:extractionMethod "nlp-based" .
      """

  Scenario: Generate semantic annotations for multimedia content
    Given I have multimedia content requiring semantic annotation
    And I need Web Annotation Data Model (WADM) compliance
    When I generate multimedia annotations using content-aware filtering
    Then the annotations should follow WADM structure:
      """
      @prefix oa: <http://www.w3.org/ns/oa#> .
      @prefix dct: <http://purl.org/dc/terms/> .
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .
      
      # Image annotation with semantic content
      ex:annotation/figure-1-analysis a oa:Annotation ;
          oa:hasTarget [
              a oa:SpecificResource ;
              oa:hasSource ex:publication/paper-123/figure-1 ;
              oa:hasSelector [
                  a oa:FragmentSelector ;
                  oa:conformsTo <http://www.w3.org/TR/media-frags/> ;
                  rdf:value "xywh=pixel:100,100,300,200"
              ]
          ] ;
          oa:hasBody [
              a ex:SemanticDescription ;
              schema:name "Neural Network Architecture Diagram" ;
              ex:depicts ex:concept/convolutional-neural-network ;
              ex:containsElements "input-layer", "hidden-layers", "output-layer" ;
              ex:diagramType "flowchart" ;
              ex:complexity "intermediate"
          ] ;
          oa:motivatedBy oa:describing ;
          dct:created "{{ now() | formatDate('YYYY-MM-DDTHH:mm:ss') }}"^^xsd:dateTime ;
          dct:creator ex:agent/vision-analysis-system .
      
      # Video annotation with temporal segments
      ex:annotation/lecture-segment a oa:Annotation ;
          oa:hasTarget [
              a oa:SpecificResource ;
              oa:hasSource ex:video/ml-lecture-01 ;
              oa:hasSelector [
                  a oa:FragmentSelector ;
                  oa:conformsTo <http://www.w3.org/TR/media-frags/> ;
                  rdf:value "t=300,480"  # 5:00 to 8:00 minutes
              ]
          ] ;
          oa:hasBody [
              a ex:TopicSegment ;
              schema:name "Introduction to Backpropagation" ;
              ex:coversTopic ex:concept/backpropagation ;
              ex:difficultyLevel "beginner" ;
              ex:hasTranscript ex:transcript/lecture-01-segment-02
          ] ;
          oa:motivatedBy oa:classifying .
      """