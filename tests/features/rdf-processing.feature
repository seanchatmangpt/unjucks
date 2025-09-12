Feature: RDF Graph Processing
  As a KGEN user
  I want to load and parse RDF graphs from multiple formats
  So that I can work with semantic data consistently

  Background:
    Given KGEN is properly initialized
    And the RDF processor is available

  Scenario: Load RDF from Turtle format
    Given a valid Turtle RDF file "test-graph.ttl" exists
    When I load the RDF graph from Turtle format
    Then the graph should be loaded successfully
    And the graph should contain expected triples
    And the loading time should be under 100ms for graphs under 10MB

  Scenario: Load RDF from JSON-LD format
    Given a valid JSON-LD file with the following content:
      """
      {
        "@context": "https://schema.org/",
        "@type": "Person",
        "name": "John Doe",
        "email": "john@example.com"
      }
      """
    When I load the RDF graph from JSON-LD format
    Then the graph should be loaded successfully
    And the graph should contain 3 triples
    And the Person entity should have name "John Doe"

  Scenario: Load RDF from N-Triples format
    Given a valid N-Triples file with content:
      """
      <http://example.org/person1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Person> .
      <http://example.org/person1> <http://schema.org/name> "Jane Smith" .
      <http://example.org/person1> <http://schema.org/email> "jane@example.com" .
      """
    When I load the RDF graph from N-Triples format
    Then the graph should be loaded successfully
    And the graph should contain exactly 3 triples
    And the Person entity should be properly typed

  Scenario: Handle malformed RDF with proper error reporting
    Given an invalid Turtle file with syntax errors:
      """
      @prefix ex: <http://example.org/> .
      ex:person1 ex:name "Missing closing quote .
      """
    When I attempt to load the malformed RDF
    Then the loading should fail with a clear error message
    And the error should indicate the line number of the syntax error
    And no partial graph should be created

  Scenario: Load large RDF dataset within performance limits
    Given a large RDF dataset with 100,000 triples
    When I load the RDF graph
    Then the graph should be loaded successfully
    And the loading time should be under 5 seconds
    And memory usage should not exceed 500MB
    And all 100,000 triples should be accessible

  Scenario: Parse RDF with custom namespaces
    Given a Turtle file with custom namespace prefixes:
      """
      @prefix kgen: <http://kgen.example.org/> .
      @prefix custom: <http://my-domain.com/ontology/> .
      
      kgen:entity1 custom:hasProperty "value1" ;
                   custom:relatesTo kgen:entity2 .
      """
    When I load the RDF graph
    Then the custom namespaces should be preserved
    And I should be able to query using the custom prefixes
    And the namespace mappings should be accessible

  Scenario: Merge multiple RDF graphs
    Given two RDF graphs:
      | format | content                                           |
      | turtle | ex:person1 ex:name "Alice" .                      |
      | turtle | ex:person1 ex:email "alice@example.com" .         |
    When I merge the graphs into a single graph
    Then the merged graph should contain 2 triples
    And both properties should be associated with ex:person1
    And no duplicate triples should exist

  Scenario: Export RDF to different formats
    Given a loaded RDF graph with 5 triples
    When I export the graph to Turtle format
    Then the output should be valid Turtle syntax
    When I export the graph to JSON-LD format
    Then the output should be valid JSON-LD
    When I export the graph to N-Triples format
    Then the output should be valid N-Triples
    And all exports should represent the same semantic content

  Scenario: Handle Unicode and special characters in RDF
    Given a Turtle file with Unicode content:
      """
      @prefix ex: <http://example.org/> .
      ex:person1 ex:name "José García" ;
                 ex:description "Special chars: α, β, γ, 中文" .
      """
    When I load the RDF graph
    Then the Unicode characters should be preserved correctly
    And queries should return the original Unicode strings
    And export to other formats should maintain Unicode integrity

  Scenario: Validate RDF schema conformance
    Given an RDF graph with SHACL constraints
    And entities that violate the constraints
    When I validate the graph against the schema
    Then validation errors should be reported
    And the errors should specify which constraints were violated
    And valid entities should pass validation

  Scenario: Stream processing of large RDF files
    Given a 1GB RDF file
    When I process the file using streaming
    Then the file should be processed without loading entirely into memory
    And peak memory usage should remain under 100MB
    And processing should complete within 30 seconds
    And all triples should be processed correctly