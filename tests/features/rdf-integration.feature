Feature: RDF/Turtle Integration in Unjucks
  As a template developer
  I want to use RDF/Turtle data in my templates
  So that I can generate code from semantic data

  Background:
    Given I have N3.js installed and configured
    And I have RDF test fixtures available

  Scenario: Parse valid Turtle file
    Given I have a Turtle file "sample.ttl" with content:
      """
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix ex: <http://example.org/> .
      
      ex:alice a foaf:Person ;
          foaf:name "Alice" ;
          foaf:knows ex:bob .
      """
    When I parse the Turtle file
    Then I should get 3 triples
    And the prefixes should include "foaf" and "ex"
    And triple 1 should have subject "http://example.org/alice"

  Scenario: Load RDF data from multiple sources
    Given I have a file source "data/people.ttl"
    And I have an inline source with Turtle data
    And I have a URI source "http://example.org/data.ttl"
    When I load all RDF sources
    Then all sources should be loaded successfully
    And the data should be merged correctly
    And prefixes from all sources should be available

  Scenario: Query RDF data with patterns
    Given I have loaded RDF data with people and organizations
    When I query for subjects with type "foaf:Person"
    Then I should get all person entities
    When I query for objects of predicate "foaf:knows"
    Then I should get all relationships
    When I query with subject "ex:alice" and predicate "foaf:name"
    Then I should get "Alice" as the object

  Scenario: Use RDF filters in templates
    Given I have a template with RDF data context
    And the template uses rdfLabel filter
    When I render the template with person data
    Then the rdfLabel should return human-readable names
    When I use rdfObject filter with a predicate
    Then it should return the correct object values
    When I use rdfType filter
    Then it should return all type URIs for the resource

  Scenario: Handle named graphs
    Given I have RDF data with multiple named graphs
    When I query within a specific graph "http://example.org/graph1"
    Then I should only get triples from that graph
    When I query across all graphs
    Then I should get triples from all graphs
    And each triple should indicate its graph

  Scenario: Process blank nodes
    Given I have RDF data with blank nodes:
      """
      @prefix ex: <http://example.org/> .
      
      ex:alice ex:address [
          ex:street "123 Main St" ;
          ex:city "Boston"
      ] .
      """
    When I parse the data
    Then blank nodes should be properly handled
    And blank node properties should be accessible
    And blank node IDs should be consistent

  Scenario: Extract and use namespace prefixes
    Given I have RDF data with multiple prefixes
    When I compact a full URI "http://xmlns.com/foaf/0.1/name"
    Then I should get "foaf:name"
    When I expand a prefixed URI "foaf:Person"
    Then I should get "http://xmlns.com/foaf/0.1/Person"
    And all standard prefixes should be available

  Scenario: Cache parsed RDF data
    Given I have caching enabled
    When I load the same file twice
    Then the second load should use cached data
    And the load time should be faster
    When I invalidate the cache
    Then the next load should parse again

  Scenario: Handle large RDF datasets
    Given I have a large Turtle file with 10000 triples
    When I parse the file
    Then it should complete within 5 seconds
    And memory usage should stay below 100MB
    When I query the large dataset
    Then queries should return within 100ms

  Scenario: Validate RDF data against schemas
    Given I have an OWL ontology schema
    And I have RDF instance data
    When I validate the data against the schema
    Then validation should report any violations
    And it should check domain/range constraints
    And it should verify cardinality requirements