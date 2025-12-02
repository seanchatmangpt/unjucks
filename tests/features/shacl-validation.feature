@shacl @validation @rdf @v1
Feature: SHACL Validation for RDF Graph Validation
  As a KGEN user working with RDF data
  I want SHACL validation to ensure RDF graph compliance
  So that my semantic data meets defined constraints and quality standards

  Background:
    Given I have a clean workspace
    And SHACL validation engine is initialized
    And RDF graph processing is enabled

  @shacl @basic @critical
  Scenario: Validate RDF graph against SHACL shapes
    Given I have an RDF graph with person data:
      ```turtle
      @prefix ex: <http://example.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      
      ex:john a foaf:Person ;
        foaf:name "John Doe" ;
        foaf:age 30 ;
        foaf:email "john@example.com" .
      ```
    And I have SHACL shapes defining person constraints:
      ```turtle
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      
      ex:PersonShape a sh:NodeShape ;
        sh:targetClass foaf:Person ;
        sh:property [
          sh:path foaf:name ;
          sh:datatype xsd:string ;
          sh:minCount 1 ;
          sh:maxCount 1 ;
        ] ;
        sh:property [
          sh:path foaf:age ;
          sh:datatype xsd:integer ;
          sh:minInclusive 0 ;
          sh:maxInclusive 120 ;
        ] .
      ```
    When I validate the RDF graph against SHACL shapes
    Then validation should pass successfully
    And conformance report should be generated
    And no validation violations should be reported

  @shacl @violations @critical
  Scenario: Detect and report SHACL violations
    Given I have an RDF graph with invalid data:
      ```turtle
      ex:invalid a foaf:Person ;
        foaf:age "thirty" ;  # Invalid: should be integer
        foaf:email "not-an-email" .  # Missing required name
      ```
    When I validate against person SHACL shapes
    Then validation should fail
    And violation report should contain:
      | violation_type    | property  | message                           |
      | DatatypeConstraint| foaf:age  | Value must be integer            |
      | MinCountConstraint| foaf:name | Required property is missing     |
    And each violation should include focus node information
    And severity levels should be properly assigned

  @shacl @template-integration
  Scenario: Use SHACL validation in template generation
    Given I have a template that generates RDF data
    And the template includes SHACL shape definitions
    When I generate content using the template
    Then generated RDF should be validated against included shapes
    And generation should fail if SHACL validation fails
    And validation results should be included in generation report
    And valid RDF should proceed to normal template processing

  @shacl @custom-constraints
  Scenario: Define and use custom SHACL constraints
    Given I define custom SHACL constraints for domain-specific validation:
      ```turtle
      ex:EmailShape a sh:PropertyShape ;
        sh:path foaf:email ;
        sh:pattern "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$" ;
        sh:message "Must be a valid email address format" .
      ```
    When I validate data against custom constraints
    Then custom validation rules should be applied
    And custom error messages should be used
    And validation should be as strict as built-in constraints

  @shacl @performance
  Scenario: SHACL validation performance with large graphs
    Given I have a large RDF graph with 10,000 triples
    And comprehensive SHACL shapes covering all data
    When I perform validation
    Then validation should complete within 30 seconds
    And memory usage should remain bounded
    And validation should scale linearly with graph size
    And performance metrics should be collected

  @shacl @nested-validation
  Scenario: Validate nested and complex RDF structures
    Given I have RDF data with nested structures:
      ```turtle
      ex:company a ex:Organization ;
        ex:hasEmployee ex:john, ex:jane ;
        ex:hasAddress [
          a ex:Address ;
          ex:street "123 Main St" ;
          ex:city "Anytown" ;
          ex:postalCode "12345"
        ] .
      ```
    And SHACL shapes for nested validation
    When validation processes nested structures
    Then all levels of nesting should be validated
    And nested violations should be properly reported
    And validation context should be maintained through nesting

  @shacl @sparql-constraints
  Scenario: Use SPARQL-based SHACL constraints
    Given I have SHACL shapes with SPARQL constraints:
      ```turtle
      ex:UniqueEmailShape a sh:PropertyShape ;
        sh:path foaf:email ;
        sh:sparql [
          sh:message "Email address must be unique" ;
          sh:select """
            SELECT $this WHERE {
              $this foaf:email ?email .
              ?other foaf:email ?email .
              FILTER (?this != ?other)
            }
          """ ;
        ] .
      ```
    When SPARQL-based validation is performed
    Then SPARQL queries should execute correctly
    And complex validation logic should be supported
    And SPARQL results should be interpreted as violations

  @shacl @multi-graph
  Scenario: Validate across multiple RDF graphs
    Given I have data spread across multiple named graphs
    When I validate with shapes targeting multiple graphs
    Then validation should work across graph boundaries
    And graph context should be preserved in validation
    And cross-graph constraints should be enforced

  @shacl @incremental-validation
  Scenario: Incremental validation for changing data
    Given I have a validated RDF graph
    When I make incremental changes to the data
    Then only affected parts should be re-validated
    And unchanged valid data should not be re-processed
    And incremental validation should be more efficient than full validation
    And validation cache should be maintained appropriately

  @shacl @validation-reports
  Scenario: Generate comprehensive validation reports
    Given I perform SHACL validation on complex data
    When validation completes
    Then detailed validation report should be generated containing:
      | section           | content                                    |
      | summary           | total violations, passed/failed shapes    |
      | violations        | detailed violation descriptions            |
      | statistics        | validation performance metrics            |
      | recommendations   | suggestions for fixing violations         |
    And report should be available in multiple formats (JSON, RDF, HTML)

  @shacl @shape-evolution
  Scenario: Handle evolving SHACL shapes
    Given I have existing data validated against SHACL shapes v1
    When I update shapes to v2 with new constraints
    Then shape versioning should be supported
    And backward compatibility should be considered
    And migration guidance should be provided for data updates
    And validation should clearly indicate shape version used

  @shacl @conditional-validation
  Scenario: Apply conditional SHACL validation
    Given I have SHACL shapes with conditional constraints
    When validation encounters conditional logic
    Then conditions should be evaluated correctly
    And constraints should apply only when conditions are met
    And conditional validation should be clearly reported

  @shacl @integration-testing
  Scenario: End-to-end SHACL validation in KGEN workflow
    Given I have a complete KGEN workflow using RDF and SHACL
    When I execute the full workflow
    Then SHACL validation should be integrated at appropriate points
    And validation failures should halt workflow appropriately
    And validation success should allow workflow to continue
    And SHACL validation should be included in attestation records

  @shacl @error-recovery
  Scenario: Handle SHACL validation errors gracefully
    Given I have malformed SHACL shapes or invalid RDF
    When validation encounters errors
    Then errors should be reported clearly
    And system should recover gracefully from validation errors
    And partial validation should be possible when appropriate
    And error information should be detailed and actionable

  @shacl @caching
  Scenario: Cache SHACL validation results
    Given I perform validation on stable data repeatedly
    When validation caching is enabled
    Then validation results should be cached efficiently
    And cache should be invalidated when data or shapes change
    And cached results should improve performance significantly
    And cache integrity should be maintained