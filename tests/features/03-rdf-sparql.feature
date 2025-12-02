Feature: RDF Processing and SPARQL Querying
  As a semantic web developer
  I want to process RDF data and execute SPARQL queries
  So that I can build applications with semantic capabilities

  Background:
    Given I have N3.js installed and configured
    And I have RDF test fixtures available

  @rdf-parsing
  Scenario: Parse valid Turtle RDF data
    Given I have a Turtle file "sample.ttl" with content:
      """
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix ex: <http://example.org/people/> .
      
      ex:alice a foaf:Person ;
          foaf:name "Alice Johnson" ;
          foaf:knows ex:bob .
      
      ex:bob a foaf:Person ;
          foaf:name "Bob Smith" .
      """
    When I parse the Turtle file
    Then I should get 4 triples
    And the prefixes should include "foaf" and "ex"
    And triple 1 should have subject "http://example.org/people/alice"

  @rdf-parsing
  Scenario: Load multiple RDF data sources
    Given I have a file source "data/people.ttl"
    And I have an inline source with Turtle data
    And I have a URI source "http://example.org/data.ttl"
    When I load all RDF sources
    Then all sources should be loaded successfully
    And the data should be merged correctly
    And prefixes from all sources should be available

  @sparql-select
  Scenario: Execute SPARQL SELECT queries with JSON results
    Given I have loaded RDF data with people and organizations
    When I execute SPARQL SELECT for all classes
    Then the query should return JSON results
    And the results should contain class information

  @sparql-select
  Scenario: Query RDF data with specific patterns
    Given I have loaded RDF data with people and organizations
    When I query for subjects with type "foaf:Person"
    Then I should get all person entities
    When I query for objects of predicate "foaf:knows"
    Then I should get all relationships
    When I query with subject "ex:alice" and predicate "foaf:name"
    Then I should get "Alice Johnson" as the object

  @sparql-select
  Scenario: Complex SPARQL SELECT with filters and ordering
    Given I have loaded RDF data with people and organizations
    When I execute a SPARQL SELECT query:
      """
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      PREFIX ex: <http://example.org/>
      
      SELECT ?person ?name ?age WHERE {
        ?person a foaf:Person ;
                foaf:name ?name .
        OPTIONAL { ?person foaf:age ?age }
      }
      ORDER BY ?name
      LIMIT 10
      """
    Then the query should return JSON results
    And the results should contain class information

  @sparql-construct
  Scenario: Execute SPARQL CONSTRUCT queries to generate new graphs
    Given I have loaded RDF data with people and organizations
    When I execute SPARQL CONSTRUCT to create new graph
    Then the constructed graph should have new triples

  @sparql-construct
  Scenario: Custom SPARQL CONSTRUCT query
    Given I have loaded RDF data with people and organizations
    When I execute a SPARQL CONSTRUCT query:
      """
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      PREFIX ex: <http://example.org/>
      PREFIX schema: <http://schema.org/>
      
      CONSTRUCT {
        ?person schema:name ?name ;
                schema:email ?email ;
                ex:socialConnections ?connections .
      }
      WHERE {
        ?person a foaf:Person ;
                foaf:name ?name .
        OPTIONAL { ?person foaf:mbox ?email }
        OPTIONAL {
          SELECT ?person (COUNT(?friend) as ?connections) WHERE {
            ?person foaf:knows ?friend .
          } GROUP BY ?person
        }
      }
      """
    Then the constructed graph should have new triples

  @rdf-validation
  Scenario: RDF syntax validation using N3.js
    Given I have a Turtle file "valid.ttl" with content:
      """
      @prefix ex: <http://example.org/> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      
      ex:validResource a ex:SomeClass ;
          ex:hasProperty "valid value" .
      """
    When I validate RDF syntax using N3.js
    Then valid syntax should pass validation

  @rdf-validation
  Scenario: Detect RDF syntax errors
    Given I have a Turtle file "invalid.ttl" with content:
      """
      @prefix ex: <http://example.org/> .
      
      ex:resource1 ex:predicate1 "unterminated string ;
      ex:resource2 ex:object2 .
      <invalid-iri> ex:predicate3 "value" .
      """
    When I validate RDF syntax using N3.js
    Then syntax validation should report errors

  @ontology-loading
  Scenario: Load ontologies from directory
    Given I have ontology files in the ontologies directory
    When I load ontologies from the ontologies directory
    Then ontologies should be loaded successfully
    And ontology classes and properties should be available

  @ontology-loading
  Scenario: Load specific ontology file
    Given I have ontology files in the ontologies directory
    When I load ontology from "core.ttl"
    Then ontologies should be loaded successfully
    And ontology classes and properties should be available

  @namespace-resolution
  Scenario: Namespace prefix resolution and compacting
    Given I have RDF data with multiple prefixes
    When I resolve namespace prefixes
    Then namespace prefixes should be resolved correctly
    When I compact a full URI "http://xmlns.com/foaf/0.1/name"
    Then I should get "foaf:name"
    When I expand a prefixed URI "foaf:Person"
    Then I should get "http://xmlns.com/foaf/0.1/Person"
    And all standard prefixes should be available

  @performance
  Scenario: Performance benchmarking of RDF operations
    Given I have Turtle data with prefixes and triples
    When I parse the Turtle data
    Then parsing should complete within 5 seconds
    When I execute SPARQL SELECT for all classes
    Then query execution should be under 100ms

  @integration
  Scenario: End-to-end RDF processing workflow
    Given I have parsed RDF data with organizations and people
    And I have loaded RDF data with people and organizations
    When I execute a SPARQL SELECT query:
      """
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      PREFIX ex: <http://example.org/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      
      SELECT ?person ?name ?organization ?orgName WHERE {
        ?person a foaf:Person ;
                foaf:name ?name ;
                ex:worksFor ?organization .
        ?organization rdfs:label ?orgName .
      }
      ORDER BY ?name
      """
    Then the query should return JSON results
    And the results should contain class information
    When I execute a SPARQL CONSTRUCT query:
      """
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      PREFIX ex: <http://example.org/>
      PREFIX schema: <http://schema.org/>
      
      CONSTRUCT {
        ?person schema:worksFor ?org .
        ?org schema:employee ?person .
      }
      WHERE {
        ?person ex:worksFor ?org .
      }
      """
    Then the constructed graph should have new triples