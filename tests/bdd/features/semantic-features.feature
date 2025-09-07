Feature: Semantic RDF/Turtle Features
  As a developer working with semantic web technologies
  I want to use RDF/Turtle data to enhance template generation
  So that I can create semantically-aware code scaffolding

  Background:
    Given I have a working Unjucks installation with semantic features
    And I have RDF/Turtle schemas defining my domain model
    And I have semantic-aware templates

  Scenario: Load and validate RDF schema
    Given I have a valid Turtle file "schema/user.ttl"
    When I run "unjucks semantic validate --schema schema/user.ttl"
    Then I should see "Schema validation successful" message
    And I should see a summary of entities and properties
    And the exit code should be 0

  Scenario: Generate code from RDF schema
    Given I have a Turtle file defining a User entity
    And I have a semantic template "templates/semantic/entity.ts.njk"
    When I run "unjucks semantic generate entity --schema schema/user.ttl --template entity"
    Then I should see generated TypeScript interfaces
    And the interfaces should match the RDF properties
    And the exit code should be 0

  Scenario: Query RDF data with SPARQL
    Given I have RDF data loaded in the semantic engine
    When I run "unjucks semantic query --sparql 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10'"
    Then I should see query results in tabular format
    And the results should be valid RDF triples
    And the exit code should be 0

  Scenario: Export semantic model to different formats
    Given I have loaded RDF schema data
    When I run "unjucks semantic export --format jsonld --output model.jsonld"
    Then the file "model.jsonld" should be created
    And it should contain valid JSON-LD representation
    And the exit code should be 0

  Scenario: Semantic template with RDF context
    Given I have a template that uses RDF context variables
    And I have schema data defining entity relationships
    When I run "unjucks generate semantic-api user --schema schema/user.ttl --name UserAPI"
    Then the generated code should include relationship mappings
    And the code should have semantic annotations
    And the exit code should be 0

  Scenario: Validate generated code against schema
    Given I have generated code from RDF schema
    When I run "unjucks semantic validate-code --schema schema/user.ttl --code src/User.ts"
    Then I should see "Code validation successful" message
    And any schema violations should be reported
    And the exit code should be 0

  Scenario: Semantic inference and reasoning
    Given I have RDF data with inference rules
    When I run "unjucks semantic infer --schema schema/ontology.ttl --rules rules/business.ttl"
    Then I should see inferred facts
    And the inference results should be stored
    And the exit code should be 0

  Scenario: Integration with MCP semantic tools
    Given I have MCP semantic integration enabled
    When I run "unjucks semantic swarm-analyze --schema schema/domain.ttl"
    Then MCP tools should analyze the semantic model
    And I should see analysis results with recommendations
    And the exit code should be 0

  Scenario: Invalid RDF schema handling
    Given I have an invalid Turtle file "invalid.ttl"
    When I run "unjucks semantic validate --schema invalid.ttl"
    Then I should see "Schema parsing failed" error
    And I should see specific syntax error details
    And the exit code should be 1

  Scenario: Semantic template compilation
    Given I have templates with RDF variable bindings
    When I run "unjucks semantic compile-templates --schema schema/domain.ttl"
    Then templates should be preprocessed with semantic context
    And compiled templates should be cached
    And the exit code should be 0

  Scenario: Cross-reference semantic entities
    Given I have multiple related RDF schemas
    When I run "unjucks semantic cross-ref --schemas schema/ --output refs.json"
    Then I should see entity relationship mappings
    And cross-references should be exported
    And the exit code should be 0

  Scenario: Semantic code generation with constraints
    Given I have RDF schema with validation constraints (SHACL)
    When I run "unjucks generate constrained-entity user --schema schema/user.ttl --constraints schema/constraints.ttl"
    Then the generated code should include validation logic
    And constraints should be enforced in the generated types
    And the exit code should be 0