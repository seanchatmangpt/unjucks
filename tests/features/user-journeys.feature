Feature: User Journeys with Enhanced CLI
  As a user of Unjucks
  I want to perform complex workflows through simple CLI commands
  So that I can accomplish real-world tasks efficiently

  Background:
    Given I have a working Unjucks installation
    And the MCP integration is properly configured
    And I have the necessary permissions

  @semantic @knowledge-graph
  Scenario: Data scientist processes RDF knowledge graph
    Given I have a knowledge graph file "enterprise.ttl" with company data
    And the file contains valid RDF triples
    When I run "unjucks semantic validate enterprise.ttl"
    Then the validation should pass without errors
    And I should see "✓ Knowledge graph is valid"
    When I run "unjucks semantic reason enterprise.ttl --rules inference.n3"
    Then new inferred triples should be generated
    And I should see "✓ Reasoning completed with X new triples"
    When I run "unjucks semantic query enterprise.ttl --sparql 'SELECT ?s WHERE {?s a :Company}'"
    Then I should get a list of all company entities
    And the results should be formatted as JSON or table
    And the query execution time should be displayed

  @semantic @validation
  Scenario: Developer validates template semantics
    Given I have a template with semantic annotations
    When I run "unjucks semantic validate templates/api --recursive"
    Then all templates should be validated for semantic correctness
    And any semantic inconsistencies should be reported
    And I should get a validation summary report

  @workflow @cicd
  Scenario: DevOps engineer sets up CI/CD workflow
    Given I have a workflow definition file "ci-cd.yaml"
    And the workflow contains valid pipeline stages
    When I run "unjucks workflow create ci-cd.yaml"
    Then the workflow should be registered in the system
    And I should see "✓ Workflow 'ci-cd' created successfully"
    When I run "unjucks workflow schedule ci-cd --cron '0 2 * * *'"
    Then the workflow should be scheduled for nightly execution
    And I should see "✓ Workflow scheduled for daily execution at 2 AM"
    When I run "unjucks workflow monitor ci-cd"
    Then I should see the current workflow status
    And execution history should be displayed
    And any failed runs should be highlighted

  @workflow @templates
  Scenario: Template author creates automated workflow
    Given I have a template generation workflow
    When I run "unjucks workflow create template-pipeline.yaml --auto-trigger"
    And a new template is added to the repository
    Then the workflow should automatically trigger
    And generate updated documentation
    And notify team members of the changes

  @swarm @refactoring
  Scenario: Team lead orchestrates development swarm for large refactoring
    Given I have a large codebase that needs refactoring
    And the codebase has multiple modules and dependencies
    When I run "unjucks swarm init --topology hierarchical --agents 10"
    Then a hierarchical swarm should be initialized
    And I should see "✓ Swarm initialized with 10 agents"
    When I run "unjucks swarm spawn researcher --task 'analyze codebase dependencies'"
    Then a researcher agent should be spawned
    And it should begin analyzing the codebase
    When I run "unjucks swarm spawn coder --task 'implement module refactoring'"
    Then a coder agent should be spawned
    And it should wait for researcher results
    When I run "unjucks swarm orchestrate refactor.yaml"
    Then the swarm should execute the coordinated refactoring
    And I should see progress updates from each agent
    And the refactoring should complete with status report

  @swarm @testing
  Scenario: QA engineer orchestrates comprehensive testing swarm
    Given I have a complex application with multiple test suites
    When I run "unjucks swarm init --topology mesh --agents 6"
    And I run "unjucks swarm spawn tester --task 'unit tests' --parallel 3"
    And I run "unjucks swarm spawn tester --task 'integration tests' --parallel 2"
    And I run "unjucks swarm spawn reviewer --task 'test coverage analysis'"
    Then all test suites should run in parallel
    And test coverage should be analyzed
    And a comprehensive test report should be generated

  @generate @advanced
  Scenario: Developer generates complex project structure with dependencies
    Given I need to create a microservices project
    When I run "unjucks generate microservice --name auth-service --with-db --with-tests"
    And I run "unjucks generate microservice --name user-service --with-db --with-tests --depends-on auth-service"
    Then both microservices should be generated
    And proper dependencies should be configured
    And inter-service communication should be set up
    And all necessary tests should be included

  @inject @configuration
  Scenario: System administrator injects environment-specific configurations
    Given I have multiple deployment environments
    And each environment has specific configuration requirements
    When I run "unjucks inject config --env production --target src/config"
    Then production-specific configurations should be injected
    And existing configurations should be preserved where appropriate
    When I run "unjucks inject config --env staging --target src/config --merge"
    Then staging configurations should be merged with existing ones
    And conflicts should be handled according to merge strategy

  @list @discovery
  Scenario: New team member discovers available templates and generators
    Given I'm new to the project
    When I run "unjucks list"
    Then I should see all available templates and generators
    And they should be categorized by type
    When I run "unjucks list --category api"
    Then I should see only API-related templates
    When I run "unjucks help component"
    Then I should get detailed help for the component generator
    And see examples of usage

  @integration @mcp
  Scenario: Power user leverages MCP integration for advanced workflows
    Given MCP servers are properly configured
    When I run "unjucks mcp swarm init --topology adaptive"
    Then an adaptive swarm should be initialized using MCP
    When I run "unjucks mcp neural train --pattern optimization"
    Then neural patterns should be trained for optimization
    When I run "unjucks generate api --with-neural-optimization"
    Then the generated API should use neural optimization patterns
    And performance should be better than standard generation

  @error-handling @resilience
  Scenario: User encounters and recovers from errors gracefully
    Given I'm running a complex generation task
    When a network error occurs during template download
    Then the system should retry automatically
    And show progress of retry attempts
    When disk space becomes low during generation
    Then the system should warn me and offer cleanup options
    And allow me to continue or abort safely
    When I interrupt the process with Ctrl+C
    Then the system should cleanup partial files
    And restore the previous state

  @performance @scalability
  Scenario: User processes large-scale generation tasks efficiently
    Given I need to generate 1000+ files from templates
    When I run "unjucks generate massive-project --scale 1000 --parallel 10"
    Then files should be generated in parallel batches
    And progress should be displayed with ETA
    And memory usage should remain reasonable
    And generation should complete within acceptable time limits
    And all generated files should be valid and complete

  @collaboration @team
  Scenario: Team collaborates on template development and sharing
    Given multiple team members are working on templates
    When I run "unjucks template publish my-component --registry team"
    Then the template should be published to team registry
    When another team member runs "unjucks template install my-component"
    Then they should get the published template
    And it should work seamlessly in their environment
    When I run "unjucks template update my-component --version 2.0"
    Then the template should be updated
    And dependent projects should be notified of the update