Feature: RDF Graph Validation and Compliance
  As a KGEN user
  I want to validate RDF graphs for compliance with semantic standards
  So that knowledge graphs maintain quality and consistency

  Background:
    Given KGEN RDF graph validation is available
    And the system supports Turtle, N-Triples, and JSON-LD formats
    And graph size limits are set to "50000" triples maximum

  @graph @compliance @basic
  Scenario: Validate well-formed RDF graph structure
    Given I have an RDF graph in Turtle format:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:john a schema:Person ;
        schema:name "John Doe" ;
        schema:birthDate "1985-03-15"^^xsd:date ;
        schema:email "john@example.com" .

      ex:acme a schema:Organization ;
        schema:name "Acme Corp" ;
        schema:employee ex:john .
      """
    When I validate the RDF graph structure
    Then the graph should be well-formed
    And parsing should succeed without errors
    And the graph should contain "6" triples
    And all URIs should be valid

  @graph @compliance @syntax
  Scenario: Detect RDF syntax errors
    Given I have an RDF graph with syntax errors:
      """
      @prefix schema: <http://schema.org/> .
      
      ex:john a schema:Person
        schema:name "Missing semicolon"
        schema:email "john@example.com" .
      """
    When I validate the RDF graph syntax
    Then validation should fail
    And the error should indicate "syntax error"
    And the error should specify the approximate line number
    And parsing should be aborted safely

  @graph @compliance @uris
  Scenario: Validate URI compliance and accessibility
    Given I have an RDF graph with various URI types:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .

      ex:resource1 a schema:Thing ;
        schema:url <http://valid-url.com> ;
        schema:sameAs <https://secure-url.com> ;
        schema:identifier <urn:isbn:1234567890> ;
        schema:related <mailto:contact@example.com> .
      """
    When I validate URI compliance
    Then all URIs should be syntactically valid
    And HTTP/HTTPS URLs should be well-formed
    And URN schemes should follow proper format
    And mailto URIs should have valid email syntax
    And no broken URI references should be present

  @graph @compliance @prefixes
  Scenario: Validate namespace prefix declarations
    Given I have an RDF graph with namespace prefixes:
      """
      @prefix schema: <http://schema.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix dc: <http://purl.org/dc/terms/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:document a schema:CreativeWork ;
        schema:name "Test Document" ;
        foaf:maker "John Doe" ;
        dc:created "2024-01-15"^^xsd:date .
      """
    When I validate namespace usage
    Then all prefixes should be properly declared
    And prefix URIs should be dereferenceable where appropriate
    And no undefined prefixes should be used
    And standard prefixes should follow conventions

  @graph @compliance @datatypes
  Scenario: Validate datatype usage and format
    Given I have an RDF graph with various datatypes:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:person a schema:Person ;
        schema:name "John Doe"^^xsd:string ;
        schema:age "30"^^xsd:integer ;
        schema:height "1.75"^^xsd:decimal ;
        schema:birthDate "1985-03-15"^^xsd:date ;
        schema:isAlive true ;
        schema:description "A software developer" .
      """
    When I validate datatype usage
    Then all datatype declarations should be valid
    And literal values should match their declared datatypes
    And implicit datatypes should be correctly inferred
    And no datatype conflicts should exist

  @graph @compliance @blank-nodes
  Scenario: Validate blank node usage and consistency
    Given I have an RDF graph with blank nodes:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .

      ex:john a schema:Person ;
        schema:name "John Doe" ;
        schema:address [
          a schema:PostalAddress ;
          schema:streetAddress "123 Main St" ;
          schema:addressLocality "Anytown" ;
          schema:postalCode "12345"
        ] .
      """
    When I validate blank node usage
    Then blank nodes should be properly scoped
    And blank node identifiers should be consistent
    And blank nodes should have meaningful properties
    And no orphaned blank nodes should exist

  @graph @compliance @circular-refs
  Scenario: Detect circular references and infinite loops
    Given I have an RDF graph with circular references:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .

      ex:person1 a schema:Person ;
        schema:name "Alice" ;
        schema:knows ex:person2 .

      ex:person2 a schema:Person ;
        schema:name "Bob" ;
        schema:knows ex:person3 .

      ex:person3 a schema:Person ;
        schema:name "Charlie" ;
        schema:knows ex:person1 .
      """
    When I validate graph structure
    Then circular references should be detected and reported
    And the validation should not enter infinite loops
    And circular reference paths should be documented
    And graph traversal should remain safe

  @graph @compliance @duplicate-triples
  Scenario: Detect and handle duplicate triples
    Given I have an RDF graph with duplicate triples:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .

      ex:john a schema:Person ;
        schema:name "John Doe" ;
        schema:email "john@example.com" .

      ex:john schema:name "John Doe" .
      ex:john schema:email "john@example.com" .
      """
    When I validate graph for duplicates
    Then duplicate triples should be identified
    And deduplication should be offered as an option
    And the unique triple count should be reported
    And graph integrity should be maintained

  @graph @compliance @large-graphs
  Scenario: Validate large RDF graphs within performance limits
    Given I have a large RDF graph with "25000" triples
    And the graph contains complex interconnected entities
    When I validate the large graph
    Then validation should complete within "2000ms"
    And memory usage should remain within "500MB" limit
    And progress indicators should be provided
    And validation should not cause system instability

  @graph @compliance @streaming
  Scenario: Stream validation for very large graphs
    Given I have an extremely large RDF graph exceeding memory limits
    And streaming validation is enabled
    When I validate the graph using streaming mode
    Then the graph should be processed in chunks
    And memory usage should remain constant
    And validation results should be incrementally reported
    And partial failures should not abort the entire process

  @graph @compliance @multi-format
  Scenario: Validate graphs in different RDF formats
    Given I have the same semantic content in different formats:
      | format    | file               |
      | turtle    | person.ttl         |
      | n-triples | person.nt          |
      | json-ld   | person.jsonld      |
      | rdf-xml   | person.rdf         |
    When I validate each format
    Then all formats should parse successfully
    And the semantic content should be equivalent
    And format-specific syntax should be validated
    And conversion between formats should be lossless

  @graph @compliance @vocabulary
  Scenario: Validate vocabulary usage and consistency
    Given I have an RDF graph using standard vocabularies:
      """
      @prefix schema: <http://schema.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix dc: <http://purl.org/dc/terms/> .
      @prefix skos: <http://www.w3.org/2004/02/skos/core#> .

      ex:concept1 a skos:Concept ;
        skos:prefLabel "Primary Term" ;
        skos:altLabel "Alternative Term" ;
        skos:broader ex:parentConcept ;
        dc:created "2024-01-15"^^xsd:date .
      """
    When I validate vocabulary usage
    Then vocabulary terms should be used correctly
    And property domains and ranges should be respected
    And vocabulary-specific constraints should be enforced
    And deprecated terms should be flagged with warnings

  @graph @compliance @shacl-shapes
  Scenario: Validate RDF graph against comprehensive SHACL shapes
    Given I have SHACL shapes for knowledge graph validation:
      """
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/shapes/> .

      ex:KnowledgeGraphShape a sh:NodeShape ;
        sh:targetNode ex:kg ;
        sh:property [
          sh:path ex:hasEntity ;
          sh:minCount 1 ;
          sh:message "Knowledge graph must contain at least one entity"
        ] ;
        sh:property [
          sh:path ex:qualityScore ;
          sh:datatype xsd:decimal ;
          sh:minInclusive 0.0 ;
          sh:maxInclusive 1.0 ;
          sh:message "Quality score must be between 0 and 1"
        ] .
      """
    And I have an RDF graph representing a knowledge graph:
      """
      @prefix ex: <http://example.org/shapes/> .
      @prefix schema: <http://schema.org/> .

      ex:kg a ex:KnowledgeGraph ;
        ex:hasEntity ex:person1, ex:org1 ;
        ex:qualityScore 0.85 .

      ex:person1 a schema:Person ;
        schema:name "Alice Johnson" .

      ex:org1 a schema:Organization ;
        schema:name "Tech Corp" .
      """
    When I validate the graph against SHACL shapes
    Then validation should succeed
    And all shape constraints should be satisfied
    And the validation report should be comprehensive

  @graph @compliance @inconsistencies
  Scenario: Detect semantic inconsistencies in RDF graph
    Given I have an RDF graph with potential inconsistencies:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:person1 a schema:Person ;
        schema:name "John Doe" ;
        schema:birthDate "1990-05-15"^^xsd:date ;
        schema:deathDate "1985-03-10"^^xsd:date .

      ex:event1 a schema:Event ;
        schema:startDate "2024-12-31"^^xsd:date ;
        schema:endDate "2024-01-01"^^xsd:date .
      """
    When I validate for semantic inconsistencies
    Then temporal inconsistencies should be detected
    And logical contradictions should be identified
    And inconsistency reports should include:
      | type        | description                           |
      | temporal    | Death date before birth date         |
      | temporal    | Event end date before start date     |
    And suggestions for corrections should be provided

  @graph @compliance @provenance
  Scenario: Validate graph provenance and metadata
    Given I have an RDF graph with provenance information:
      """
      @prefix prov: <http://www.w3.org/ns/prov#> .
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:dataset a prov:Entity ;
        prov:wasGeneratedBy ex:extraction ;
        prov:generatedAtTime "2024-01-15T10:30:00"^^xsd:dateTime .

      ex:extraction a prov:Activity ;
        prov:wasAssociatedWith ex:extractor ;
        prov:startedAtTime "2024-01-15T10:00:00"^^xsd:dateTime .

      ex:extractor a prov:Agent ;
        schema:name "KGEN Data Extractor v1.0" .
      """
    When I validate provenance information
    Then all provenance relationships should be valid
    And temporal sequences should be consistent
    And required provenance elements should be present
    And provenance chain should be complete

  @graph @compliance @quality-metrics
  Scenario: Generate graph quality metrics and scores
    Given I have an RDF graph to assess for quality
    When I run quality assessment validation
    Then quality metrics should be calculated including:
      | metric              | description                           |
      | completeness        | Percentage of required properties filled |
      | consistency         | Absence of contradictory statements   |
      | conformity          | Adherence to schema/vocabulary rules  |
      | accessibility       | URI dereferenceability score         |
      | timeliness          | Freshness of temporal data            |
    And an overall quality score should be computed
    And quality improvement recommendations should be provided

  @graph @compliance @federation
  Scenario: Validate federated graph consistency
    Given I have multiple RDF graphs representing different domains:
      | graph     | domain        | entities |
      | people    | Person data   | 500      |
      | orgs      | Organizations | 100      |
      | events    | Events        | 250      |
    When I validate cross-graph references and consistency
    Then inter-graph links should be validated
    And referential integrity should be maintained
    And duplicate entities across graphs should be identified
    And federation consistency report should be generated

  @graph @performance @indexing
  Scenario: Validate graph indexing and query performance
    Given I have an RDF graph suitable for SPARQL querying
    When I validate query performance characteristics
    Then graph structure should support efficient queries
    And indexable properties should be identified
    And query optimization suggestions should be provided
    And performance bottlenecks should be flagged

  @graph @security @privacy
  Scenario: Validate graph for security and privacy compliance
    Given I have an RDF graph containing potentially sensitive data
    When I run security and privacy validation
    Then personally identifiable information should be flagged
    And data exposure risks should be assessed
    And privacy compliance issues should be reported
    And anonymization suggestions should be provided

  @graph @compliance @export
  Scenario: Validate graph export and serialization formats
    Given I have a validated RDF graph
    When I export the graph to different serialization formats
    Then exported formats should maintain semantic equivalence
    And format-specific optimizations should be applied
    And exported graphs should validate successfully
    And serialization should preserve all metadata