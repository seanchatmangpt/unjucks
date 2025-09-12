Feature: Semantic Hashing with C14N Canonicalization
  As a KGEN user
  I want to generate consistent semantic hashes for RDF graphs
  So that I can detect graph equivalence and changes reliably

  Background:
    Given KGEN is properly initialized
    And the semantic hashing module is available
    And C14N canonicalization is enabled

  Scenario: Generate semantic hash for simple RDF graph
    Given an RDF graph with the following triples:
      """
      <http://example.org/person1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Person> .
      <http://example.org/person1> <http://schema.org/name> "John Doe" .
      <http://example.org/person1> <http://schema.org/email> "john@example.com" .
      """
    When I generate a semantic hash for the graph
    Then the hash should be a 64-character hexadecimal string
    And the hash generation should complete within 50ms
    And the hash should be deterministic across multiple runs

  Scenario: Hash consistency across different RDF serializations
    Given the same semantic content in different formats:
      | format    | content                                                    |
      | turtle    | ex:person1 a schema:Person ; schema:name "Alice" .        |
      | jsonld    | {"@type": "Person", "name": "Alice", "@id": "ex:person1"} |
      | ntriples  | <ex:person1> <rdf:type> <schema:Person> . <ex:person1> <schema:name> "Alice" . |
    When I generate semantic hashes for all formats
    Then all hashes should be identical
    And each hash generation should complete within 50ms
    And the canonicalization should normalize format differences

  Scenario: Hash stability with triple ordering changes
    Given two RDF graphs with identical content but different triple ordering:
      | graph | triples                                           |
      | A     | ex:p1 schema:name "Bob" . ex:p1 a schema:Person .     |
      | B     | ex:p1 a schema:Person . ex:p1 schema:name "Bob" .     |
    When I generate semantic hashes for both graphs
    Then both hashes should be identical
    And the canonicalization should normalize triple ordering

  Scenario: Hash changes detection for graph modifications
    Given an initial RDF graph:
      """
      ex:person1 a schema:Person ;
                 schema:name "Original Name" ;
                 schema:email "original@example.com" .
      """
    And I generate the initial semantic hash
    When I modify the graph by changing the name to "Modified Name"
    And I generate a new semantic hash
    Then the new hash should be different from the initial hash
    And both hash operations should complete within 50ms

  Scenario: Hash equivalence for semantically identical graphs
    Given two graphs with different blank node identifiers but same structure:
      | graph | content                                               |
      | A     | _:b1 a schema:Person ; schema:name "Jane" .           |
      | B     | _:b2 a schema:Person ; schema:name "Jane" .           |
    When I generate semantic hashes using C14N canonicalization
    Then both hashes should be identical
    And blank node differences should be normalized

  Scenario: Performance with large graphs
    Given an RDF graph with 50,000 triples
    When I generate a semantic hash for the large graph
    Then the hash generation should complete within 2 seconds
    And memory usage should not exceed 1GB during hashing
    And the resulting hash should be valid and deterministic

  Scenario: Hash collision detection in test scenarios
    Given 1000 different small RDF graphs (10-20 triples each)
    When I generate semantic hashes for all graphs
    Then no hash collisions should occur among different graphs
    And identical graphs should produce identical hashes
    And hash distribution should appear uniform

  Scenario: Incremental hashing for graph updates
    Given a base RDF graph with 100 triples
    And the initial semantic hash
    When I add 5 new triples to the graph
    And I generate an incremental hash update
    Then the incremental hash should match a full rehash
    And incremental hashing should be faster than full rehashing
    And the process should complete within 100ms

  Scenario: Hash verification and integrity checking
    Given an RDF graph and its computed semantic hash
    When I verify the hash against the current graph state
    Then the verification should confirm hash validity
    And verification should complete within 25ms
    When I corrupt a single triple in the graph
    And I verify the hash again
    Then the verification should detect the corruption

  Scenario: C14N canonicalization with complex blank node patterns
    Given an RDF graph with complex blank node structures:
      """
      _:list1 rdf:first "item1" ;
              rdf:rest _:list2 .
      _:list2 rdf:first "item2" ;
              rdf:rest rdf:nil .
      ex:container ex:hasList _:list1 .
      """
    When I apply C14N canonicalization
    Then blank nodes should receive consistent canonical identifiers
    And the canonicalization should complete within 100ms
    And semantically equivalent graphs should canonicalize identically

  Scenario: Hash-based graph comparison and diff detection
    Given two versions of an RDF graph:
      | version | changes                              |
      | v1      | Original graph with 100 triples      |
      | v2      | Added 10 triples, modified 5         |
    When I generate hashes for both versions
    And I perform hash-based comparison
    Then the hashes should be different
    And I should be able to identify that changes occurred
    And comparison should complete within 100ms

  Scenario: Custom hashing algorithms and parameters
    Given configuration options for semantic hashing:
      | parameter     | value    |
      | algorithm     | SHA-256  |
      | normalization | C14N     |
      | encoding      | hex      |
    When I generate a semantic hash with custom parameters
    Then the hash should use the specified algorithm
    And the output format should match the encoding specification
    And different parameters should produce different hashes

  Scenario: Hash-based caching for query optimization
    Given a complex SPARQL query that takes 500ms to execute
    And I enable hash-based result caching
    When I execute the query against a graph with hash H1
    Then the result should be cached using the graph hash
    When I execute the same query against an identical graph
    Then the cached result should be returned in under 10ms
    When the graph is modified (hash changes to H2)
    Then the cache should be invalidated automatically

  Scenario: Batch hashing for multiple graphs
    Given 100 RDF graphs of varying sizes (10-1000 triples each)
    When I generate semantic hashes for all graphs in batch mode
    Then all hashes should be generated within 5 seconds
    And memory usage should be optimized for batch processing
    And each individual hash should be deterministic and valid

  Scenario: Error handling in hashing process
    Given a malformed RDF graph with invalid triples
    When I attempt to generate a semantic hash
    Then the hashing should fail with a clear error message
    And no partial hash should be generated
    And the error should indicate the specific parsing problem
    And system resources should be cleaned up properly