Feature: Ontology Generation with Template Filters
  As a semantic web developer
  I want to generate ontologies with proper class and property naming
  So that my RDF vocabularies follow semantic web conventions

  Background:
    Given I have an unjucks template system configured
    And I have semantic web filter functions available

  Scenario: Generate basic ontology class with Pascal case
    Given I have a template for OWL class generation
    And the class name is "person profile"
    When I apply the pascalCase filter
    Then the generated class should be "PersonProfile"
    And it should be valid in Turtle syntax as "ex:PersonProfile"

  Scenario: Generate schema.org mapped class
    Given I have a class definition "user account"
    When I generate an ontology class with schema.org mapping
    Then the output should contain:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .
      
      ex:UserAccount a rdfs:Class ;
          rdfs:subClassOf schema:Thing ;
          rdfs:label "User Account"@en .
      """

  Scenario: Generate property definitions with camelCase
    Given I have property names: ["first name", "last updated", "email address"]
    When I apply camelCase filter to each property
    Then the generated properties should be:
      | Input        | Filter Output | Schema.org Equivalent |
      | first name   | firstName     | schema:givenName      |
      | last updated | lastUpdated   | dct:modified          |
      | email address| emailAddress  | schema:email          |

  Scenario: Generate complex ontology with multiple filters
    Given I have an entity "research publication"
    And properties: ["publication date", "author list", "doi identifier"]
    When I generate a complete ontology definition
    Then the output should include proper RDF structure:
      """
      @prefix schema: <http://schema.org/> .
      @prefix dct: <http://purl.org/dc/terms/> .
      @prefix ex: <http://example.org/research/> .
      
      ex:ResearchPublication a rdfs:Class ;
          rdfs:subClassOf schema:ScholarlyArticle ;
          rdfs:label "Research Publication"@en .
          
      ex:publicationDate a rdf:Property ;
          rdfs:domain ex:ResearchPublication ;
          rdfs:range xsd:date ;
          rdfs:label "publication date"@en .
          
      ex:authorList a rdf:Property ;
          rdfs:domain ex:ResearchPublication ;
          rdfs:range rdf:List ;
          rdfs:label "author list"@en .
          
      ex:doiIdentifier a rdf:Property ;
          rdfs:domain ex:ResearchPublication ;
          rdfs:range xsd:string ;
          rdfs:label "DOI identifier"@en .
      """

  Scenario: Generate OWL restrictions with filtered class names
    Given I have a class "academic person"
    And restriction properties: ["has affiliation", "min publications"]
    When I generate OWL restrictions using filters
    Then the output should contain:
      """
      ex:AcademicPerson a owl:Class ;
          rdfs:subClassOf [
              a owl:Restriction ;
              owl:onProperty ex:hasAffiliation ;
              owl:minCardinality 1
          ] ;
          rdfs:subClassOf [
              a owl:Restriction ;
              owl:onProperty ex:minPublications ;
              owl:minQualifiedCardinality 0 ;
              owl:onClass ex:ResearchPublication
          ] .
      """

  Scenario: Generate multilingual ontology labels
    Given I have a class name "scientific article"
    And supported languages: ["en", "fr", "de", "es"]
    When I generate multilingual labels using locale filters
    Then the output should contain labels in all languages:
      """
      ex:ScientificArticle rdfs:label "Scientific Article"@en,
                                     "Article Scientifique"@fr,
                                     "Wissenschaftlicher Artikel"@de,
                                     "Artículo Científico"@es .
      """

  Scenario: Generate ontology with datatype restrictions
    Given I have numeric properties: ["age", "score", "count"]
    And string properties: ["name", "description"]
    When I generate property definitions with datatype filters
    Then numeric properties should have appropriate XSD datatypes:
      """
      ex:age rdfs:range xsd:nonNegativeInteger .
      ex:score rdfs:range xsd:decimal .
      ex:count rdfs:range xsd:positiveInteger .
      ex:name rdfs:range xsd:string .
      ex:description rdfs:range xsd:string .
      """

  Scenario: Generate ontology versioning with date filters
    Given I have an ontology version "2.1.0"
    And current timestamp
    When I generate versioning metadata using date filters
    Then the output should include:
      """
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix dct: <http://purl.org/dc/terms/> .
      
      <http://example.org/ontology/v2.1.0> a owl:Ontology ;
          owl:versionIRI <http://example.org/ontology/v2.1.0> ;
          owl:versionInfo "2.1.0" ;
          dct:created "2025-01-15T10:30:00Z"^^xsd:dateTime ;
          dct:modified "2025-01-15T10:30:00Z"^^xsd:dateTime .
      """

  Scenario: Generate SHACL shapes with filtered constraints
    Given I have a class "Person" with validation rules
    And constraints: ["required email", "age range 0-120", "name min length 2"]
    When I generate SHACL shapes using validation filters
    Then the output should contain:
      """
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      
      ex:PersonShape a sh:NodeShape ;
          sh:targetClass ex:Person ;
          sh:property [
              sh:path ex:email ;
              sh:minCount 1 ;
              sh:datatype xsd:string ;
              sh:pattern "^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$"
          ] ;
          sh:property [
              sh:path ex:age ;
              sh:datatype xsd:nonNegativeInteger ;
              sh:minInclusive 0 ;
              sh:maxInclusive 120
          ] ;
          sh:property [
              sh:path ex:name ;
              sh:minCount 1 ;
              sh:minLength 2 ;
              sh:datatype xsd:string
          ] .
      """