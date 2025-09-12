Feature: SHACL Constraint Validation Engine
  As a KGEN developer
  I want to validate RDF graphs against SHACL shapes
  So that data quality and consistency are enforced

  Background:
    Given KGEN SHACL validation engine is available
    And the validation engine uses "shacl-engine" library
    And performance targets are set to "≤20ms for standard graphs"
    And large graph performance targets are set to "≤100ms for 10k+ triples"

  @core @validation
  Scenario: Initialize SHACL validation engine with shapes
    Given I have SHACL shapes in Turtle format:
      """
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix schema: <http://schema.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      PersonShape a sh:NodeShape ;
        sh:targetClass schema:Person ;
        sh:property [
          sh:path schema:name ;
          sh:minCount 1 ;
          sh:datatype xsd:string ;
          sh:message "Person must have a name"
        ] .
      """
    When I initialize the SHACL validation engine with these shapes
    Then the engine should be initialized successfully
    And the engine should report "1" shapes loaded
    And initialization time should be less than "50ms"

  @core @validation @positive
  Scenario: Validate compliant RDF data
    Given the SHACL validation engine is initialized with person shapes
    And I have RDF data in Turtle format:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .

      ex:john a schema:Person ;
        schema:name "John Doe" ;
        schema:email "john.doe@example.com" .
      """
    When I validate the RDF data against the shapes
    Then validation should succeed
    And the validation report should show "conforms: true"
    And there should be "0" violations
    And validation time should be less than "20ms"

  @core @validation @negative
  Scenario: Detect SHACL constraint violations
    Given the SHACL validation engine is initialized with person shapes
    And I have RDF data with violations:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .

      ex:john a schema:Person .
      """
    When I validate the RDF data against the shapes
    Then validation should fail
    And the validation report should show "conforms: false"
    And there should be "1" violations
    And the violation should contain:
      | field             | value                              |
      | focusNode         | http://example.org/john            |
      | sourceShape       | PersonShape                        |
      | severity          | Violation                          |
      | message           | Person must have a name            |

  @validation @constraints
  Scenario: Validate multiple constraint types
    Given I have SHACL shapes with multiple constraints:
      """
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix schema: <http://schema.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      PersonShape a sh:NodeShape ;
        sh:targetClass schema:Person ;
        sh:property [
          sh:path schema:name ;
          sh:minCount 1 ;
          sh:maxCount 1 ;
          sh:datatype xsd:string ;
          sh:minLength 2 ;
          sh:message "Name must be a non-empty string (2+ chars)"
        ] ;
        sh:property [
          sh:path schema:age ;
          sh:datatype xsd:integer ;
          sh:minInclusive 0 ;
          sh:maxInclusive 150 ;
          sh:message "Age must be between 0 and 150"
        ] ;
        sh:property [
          sh:path schema:email ;
          sh:pattern "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$" ;
          sh:message "Invalid email format"
        ] .
      """
    When I validate data with constraint violations:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .

      ex:person1 a schema:Person ;
        schema:name "" ;
        schema:age 200 ;
        schema:email "invalid-email" .
      """
    Then validation should detect "3" violations:
      | constraint        | message                                    |
      | minLength         | Name must be a non-empty string (2+ chars) |
      | maxInclusive      | Age must be between 0 and 150             |
      | pattern           | Invalid email format                       |

  @validation @datatypes
  Scenario: Validate datatype constraints
    Given I have SHACL shapes with datatype constraints:
      """
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix schema: <http://schema.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      EventShape a sh:NodeShape ;
        sh:targetClass schema:Event ;
        sh:property [
          sh:path schema:startDate ;
          sh:datatype xsd:dateTime ;
          sh:message "Start date must be a valid dateTime"
        ] ;
        sh:property [
          sh:path schema:attendeeCount ;
          sh:datatype xsd:integer ;
          sh:minInclusive 1 ;
          sh:message "Attendee count must be a positive integer"
        ] .
      """
    When I validate data with datatype violations:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .

      ex:event1 a schema:Event ;
        schema:startDate "not-a-date" ;
        schema:attendeeCount "not-a-number" .
      """
    Then validation should detect datatype violations
    And violations should include datatype constraint failures

  @validation @cardinality
  Scenario: Validate cardinality constraints
    Given I have SHACL shapes with cardinality constraints:
      """
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix schema: <http://schema.org/> .

      OrganizationShape a sh:NodeShape ;
        sh:targetClass schema:Organization ;
        sh:property [
          sh:path schema:name ;
          sh:minCount 1 ;
          sh:maxCount 1 ;
          sh:message "Organization must have exactly one name"
        ] ;
        sh:property [
          sh:path schema:employee ;
          sh:minCount 1 ;
          sh:message "Organization must have at least one employee"
        ] .
      """
    When I validate data with cardinality violations:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .

      ex:org1 a schema:Organization .
      """
    Then validation should detect "2" cardinality violations:
      | constraint | property        | message                                  |
      | minCount   | schema:name     | Organization must have exactly one name  |
      | minCount   | schema:employee | Organization must have at least one employee |

  @validation @node-kinds
  Scenario: Validate node kind constraints
    Given I have SHACL shapes with node kind constraints:
      """
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix schema: <http://schema.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .

      PersonShape a sh:NodeShape ;
        sh:targetClass schema:Person ;
        sh:property [
          sh:path foaf:homepage ;
          sh:nodeKind sh:IRI ;
          sh:message "Homepage must be an IRI"
        ] ;
        sh:property [
          sh:path schema:description ;
          sh:nodeKind sh:Literal ;
          sh:message "Description must be a literal"
        ] .
      """
    When I validate data with node kind violations:
      """
      @prefix schema: <http://schema.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix ex: <http://example.org/> .

      ex:person1 a schema:Person ;
        foaf:homepage "not-an-iri" ;
        schema:description ex:notALiteral .
      """
    Then validation should detect node kind violations
    And violations should specify expected node kinds

  @validation @class-constraints
  Scenario: Validate class membership constraints
    Given I have SHACL shapes with class constraints:
      """
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix schema: <http://schema.org/> .

      PersonShape a sh:NodeShape ;
        sh:targetClass schema:Person ;
        sh:property [
          sh:path schema:worksFor ;
          sh:class schema:Organization ;
          sh:message "Person can only work for organizations"
        ] .
      """
    When I validate data with class violations:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .

      ex:person1 a schema:Person ;
        schema:worksFor ex:notAnOrganization .

      ex:notAnOrganization a schema:Thing .
      """
    Then validation should detect class constraint violations
    And violations should specify expected classes

  @validation @custom-sparql
  Scenario: Execute custom SPARQL constraints
    Given I have SHACL shapes with SPARQL constraints:
      """
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix schema: <http://schema.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      EventShape a sh:NodeShape ;
        sh:targetClass schema:Event ;
        sh:sparql [
          sh:message "End date must be after start date" ;
          sh:prefixes [
            sh:declare [
              sh:prefix "schema" ;
              sh:namespace "http://schema.org/"^^xsd:anyURI
            ]
          ] ;
          sh:select """
            SELECT $this ?startDate ?endDate WHERE {
              $this schema:startDate ?startDate ;
                    schema:endDate ?endDate .
              FILTER(?endDate <= ?startDate)
            }
          """
        ] .
      """
    When I validate data with temporal constraint violations:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:event1 a schema:Event ;
        schema:startDate "2024-12-31T23:59:59"^^xsd:dateTime ;
        schema:endDate "2024-01-01T00:00:00"^^xsd:dateTime .
      """
    Then validation should detect SPARQL constraint violations
    And violations should include custom SPARQL messages

  @validation @batch
  Scenario: Validate multiple graphs in batch
    Given I have multiple RDF graphs to validate
    And each graph should be validated against the same SHACL shapes
    When I run batch validation with "exitOnFirstViolation" set to false
    Then all graphs should be processed
    And the results should include validation reports for all graphs
    And batch processing time should be tracked

  @validation @performance
  Scenario: Meet performance targets for standard graphs
    Given I have a standard RDF graph with "1000" triples
    And SHACL shapes with "10" constraints
    When I validate the graph against the shapes
    Then validation should complete within "20ms"
    And performance metrics should be recorded
    And the validation report should include timing information

  @validation @performance @large-graphs
  Scenario: Meet performance targets for large graphs
    Given I have a large RDF graph with "15000" triples
    And complex SHACL shapes with "25" constraints
    When I validate the graph against the shapes
    Then validation should complete within "100ms"
    And memory usage should remain within limits
    And validation should not timeout

  @validation @error-handling
  Scenario: Handle malformed SHACL shapes gracefully
    Given I have malformed SHACL shapes:
      """
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      
      MalformedShape a sh:NodeShape ;
        sh:property [
          sh:path "not-a-valid-path" ;
          sh:minCount "not-a-number"
        ] .
      """
    When I try to initialize the SHACL validation engine
    Then initialization should fail with a descriptive error
    And the error message should indicate the specific problem
    And the engine should remain in a clean state

  @validation @error-handling
  Scenario: Handle malformed RDF data gracefully
    Given the SHACL validation engine is initialized
    And I have malformed RDF data:
      """
      @prefix schema: <http://schema.org/> .
      
      <incomplete-triple> schema:name
      """
    When I try to validate the malformed RDF data
    Then validation should fail with a parsing error
    And the error should be clearly reported
    And subsequent validations should work normally

  @validation @timeouts
  Scenario: Handle validation timeouts
    Given the SHACL validation engine is configured with a "1000ms" timeout
    And I have a complex validation scenario that exceeds the timeout
    When I attempt validation
    Then the validation should timeout gracefully
    And a timeout error should be reported
    And the validation engine should remain responsive

  @validation @memory-limits
  Scenario: Enforce memory limits for large graphs
    Given the SHACL validation engine has memory limits configured
    And I attempt to validate a graph exceeding "50000" triples
    When validation is attempted
    Then the validation should be rejected
    And a clear error message about size limits should be provided
    And system memory should be protected

  @validation @caching
  Scenario: Cache validation results for performance
    Given the SHACL validation engine has caching enabled
    And I validate the same RDF data twice
    When I check the validation performance metrics
    Then the second validation should be significantly faster
    And cache hit metrics should be recorded
    And cache should be invalidated when shapes change

  @validation @reporting
  Scenario: Generate comprehensive validation reports
    Given I have validation results with violations
    When I request a detailed validation report
    Then the report should include:
      | field                     | description                           |
      | conforms                  | Overall validation result             |
      | timestamp                 | ISO 8601 validation timestamp        |
      | violations                | Array of detailed violation objects   |
      | summary.totalViolations   | Count of total violations             |
      | summary.violationsBySeverity | Violations grouped by severity     |
      | summary.performance       | Validation timing metrics            |
    And violation objects should include focus nodes, paths, and messages
    And the report should be valid JSON