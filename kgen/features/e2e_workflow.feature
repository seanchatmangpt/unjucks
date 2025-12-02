@e2e @workflow @integration
Feature: KGEN End-to-End Workflow Testing
  As a KGEN user
  I want to execute complete project lifecycles
  So that I can generate deterministic artifacts with full provenance

  Background:
    Given I have a complete KGEN environment initialized
    And I have a performance test environment ready

  @lifecycle @critical
  Scenario: Complete project lifecycle for web application
    Given I have a project template for "webapp" with RDF schema
    When I execute the complete project lifecycle for "webapp" named "MyWebApp"
    Then all workflow steps should complete successfully
    And the complete project lifecycle should be validated
    And engine integration should be seamless
    And files should be generated in the output directory
    And provenance information should be generated

  @lifecycle @backend
  Scenario: Complete project lifecycle for API service
    Given I have a project template for "api" with RDF schema
    When I execute the complete project lifecycle for "api" named "UserService"
    Then all workflow steps should complete successfully
    And the complete project lifecycle should be validated
    And file "UserService/package.json" should exist with content matching "UserService"
    And file "UserService/schema.ttl" should exist with content matching "@prefix"

  @multi-format @integration
  Scenario: Multi-format output generation in single workflow
    Given I have a project template for "library" with RDF schema
    When I execute the complete project lifecycle for "library" named "UtilsLib"
    And I generate outputs in formats "json, yaml, turtle, xml"
    Then all 4 formats should be generated successfully
    And each format should have unique content addressing
    And CAS storage should be utilized

  @performance @benchmark
  Scenario: Performance benchmarking against KPI targets
    Given I have 20 test templates of varying complexity
    When I benchmark template rendering 100 times
    And I run concurrent rendering with 4 workers
    And I run throughput test for 10 seconds
    Then template rendering should meet p95 target of 150ms
    And concurrent rendering should scale efficiently with 0.85 efficiency
    And throughput should exceed 50 operations per second
    And cache hit rate should be above 0.80

  @error-recovery @resilience
  Scenario: Error recovery and rollback scenarios
    Given I have a project template for "service" with RDF schema
    And I have a rollback point at "init" phase
    When I execute the complete project lifecycle for "service" named "TestService"
    And I have a rollback point at "generate" phase
    And I inject a "filesystem" error during "validate"
    And the system attempts recovery
    Then recovery should be successful for all 1 error scenarios
    When I inject a "template" error during "generate"
    And I rollback to "generate" phase
    Then rollback should restore the system to "generate" phase

  @memory @load-testing
  Scenario: Memory stability during intensive workflows
    Given I have 10 test templates of varying complexity
    When I run memory stress test with 50MB data
    And I run throughput test for 15 seconds
    Then memory usage should remain stable during load test
    And memory stress test should complete within 100MB increase
    And average command time should be under 200ms

  @integration @engines
  Scenario: Engine integration validation across all components
    Given I have a project template for "fullstack" with RDF schema
    When I execute the complete project lifecycle for "fullstack" named "CompleteApp"
    And I generate outputs in formats "json, yaml, turtle"
    Then all workflow steps should complete successfully
    And all 3 formats should be generated successfully
    And engine integration should be seamless
    And CAS storage should be utilized
    And provenance information should be generated
    And performance metrics should show cache hit rate above 0.75

  @workflow @orchestration
  Scenario Outline: Project lifecycle for different project types
    Given I have a project template for "<projectType>" with RDF schema
    When I execute the complete project lifecycle for "<projectType>" named "<projectName>"
    Then all workflow steps should complete successfully
    And the complete project lifecycle should be validated
    And file "<projectName>/package.json" should exist with content matching "<projectName>"
    And memory usage should remain under 200MB during workflow

    Examples:
      | projectType | projectName    |
      | webapp      | WebApp1       |
      | api         | APIService1   |
      | library     | CoreLib1      |
      | cli         | CliTool1      |

  @performance @stress
  Scenario: High-load concurrent workflow execution
    Given I have 15 test templates of varying complexity
    When I benchmark template rendering 200 times
    And I run concurrent rendering with 8 workers
    And I run throughput test for 20 seconds
    Then template rendering should meet p95 target of 150ms
    And concurrent rendering should scale efficiently with 0.80 efficiency
    And throughput should exceed 100 operations per second
    And cache hit rate should be above 0.85
    And memory usage should remain stable during load test

  @recovery @fault-tolerance
  Scenario: Complex error recovery with multiple failure points
    Given I have a project template for "complex" with RDF schema
    And I have a rollback point at "init" phase
    When I execute the complete project lifecycle for "complex" named "ComplexApp"
    And I have a rollback point at "generate" phase
    And I inject a "memory" error during "validate"
    And I inject a "network" error during "attest"
    And the system attempts recovery
    Then recovery should be successful for all 2 error scenarios
    And all workflow steps should complete successfully

  @validation @comprehensive
  Scenario: Comprehensive validation of all KGEN features
    Given I have a project template for "enterprise" with RDF schema
    And I have 25 test templates of varying complexity
    When I execute the complete project lifecycle for "enterprise" named "EnterpriseApp"
    And I benchmark template rendering 150 times
    And I generate outputs in formats "json, yaml, turtle, xml"
    And I run throughput test for 30 seconds
    Then all workflow steps should complete successfully
    And all 4 formats should be generated successfully
    And template rendering should meet p95 target of 150ms
    And throughput should exceed 75 operations per second
    And cache hit rate should be above 0.90
    And engine integration should be seamless
    And memory usage should remain stable during load test