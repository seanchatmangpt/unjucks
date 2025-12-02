@comprehensive @e2e @validation @critical
Feature: Comprehensive KGEN E2E Validation Suite
  As a KGEN system administrator
  I want to validate complete system integration and performance
  So that I can ensure all engines work together seamlessly at production scale

  Background:
    Given I have a complete KGEN environment initialized
    And all KGEN engines are initialized and healthy
    And I have a performance test environment ready
    And I have the KGEN CLI available

  @integration @engines @critical
  Scenario: Complete engine integration validation
    When I test data flow between "RDF" and "Template" engines
    And I test data flow between "Template" and "CAS" engines
    And I test data flow between "CAS" and "Provenance" engines
    And I validate end-to-end workflow integration
    Then data flow between engines should be seamless
    And all integration tests should pass
    And engine interaction matrix should show healthy communication
    And system-wide performance metrics should be within targets
    And end-to-end workflow should complete successfully

  @performance @scalability @critical
  Scenario: Production-scale performance validation
    Given I have 50 test templates of varying complexity
    When I benchmark template rendering 500 times
    And I run concurrent rendering with 12 workers
    And I run throughput test for 60 seconds
    And I run memory stress test with 200MB data
    Then template rendering should meet p95 target of 150ms
    And concurrent rendering should scale efficiently with 0.90 efficiency
    And throughput should exceed 200 operations per second
    And cache hit rate should be above 0.90
    And memory usage should remain stable during load test
    And memory stress test should complete within 250MB increase

  @workflow @lifecycle @comprehensive
  Scenario: Multi-project lifecycle orchestration
    Given I have a project template for "enterprise" with RDF schema
    And I have a project template for "microservice" with RDF schema
    And I have a project template for "frontend" with RDF schema
    When I execute the complete project lifecycle for "enterprise" named "EnterpriseApp"
    And I execute the complete project lifecycle for "microservice" named "UserAPI"
    And I execute the complete project lifecycle for "frontend" named "WebUI"
    And I generate outputs in formats "json, yaml, turtle, xml, markdown"
    Then all workflow steps should complete successfully
    And all 5 formats should be generated successfully
    And each format should have unique content addressing
    And the complete project lifecycle should be validated
    And engine integration should be seamless
    And memory usage should remain under 300MB during workflow

  @cli @integration @comprehensive
  Scenario: Complete CLI integration with all engines
    Given I have a template directory with 20 templates
    When I execute the KGEN workflow:
      | step       | command   | args                                  | expectedExitCode |
      | discover   | list      | --verbose --format json              | 0                |
      | generate1  | generate  | template-1 --name CLITest1 --output generated | 0   |
      | generate2  | generate  | template-5 --name CLITest2 --format yaml     | 0   |
      | generate3  | generate  | template-10 --name CLITest3 --dry-run        | 0   |
      | validate1  | validate  | generated/output-CLITest1-1.txt              | 0   |
      | analyze    | analyze   | generated --metrics                           | 0   |
      | attest     | attest    | generated --sign                             | 0   |
    Then all workflow steps should complete successfully
    And the workflow should complete in under 45000ms total
    And files should be generated in the output directory
    And CAS storage should be utilized
    And provenance information should be generated
    And command execution should use less than 200MB memory
    And average command time should be under 8000ms

  @error-recovery @fault-tolerance @comprehensive
  Scenario: Advanced error recovery across multiple failure points
    Given I have a project template for "resilient" with RDF schema
    And I have a rollback point at "init" phase
    When I execute the complete project lifecycle for "resilient" named "ResilientApp"
    And I have a rollback point at "generate" phase
    And I inject a "filesystem" error during "validate"
    And I inject a "memory" error during "validate"  
    And I inject a "template" error during "generate"
    And I inject a "network" error during "attest"
    And the system attempts recovery
    Then recovery should be successful for all 4 error scenarios
    When I rollback to "generate" phase
    And I execute the complete project lifecycle for "resilient" named "ResilientAppRecovered"
    Then rollback should restore the system to "generate" phase
    And all workflow steps should complete successfully
    And the complete project lifecycle should be validated

  @formats @multi-output @comprehensive
  Scenario: Comprehensive multi-format output validation
    Given I have a project template for "polyglot" with RDF schema
    When I execute the complete project lifecycle for "polyglot" named "PolyglotApp"
    And I generate outputs in formats "json, yaml, turtle, xml, markdown, csv, toml"
    Then all 7 formats should be generated successfully
    And each format should have unique content addressing
    And all workflow steps should complete successfully
    Then file "PolyglotApp/package.json" should exist with content matching "PolyglotApp"
    And file "PolyglotApp/schema.ttl" should exist with content matching "@prefix"

  @stress @load-testing @comprehensive  
  Scenario: High-load system stress testing
    Given I have 100 test templates of varying complexity
    When I benchmark template rendering 1000 times
    And I run concurrent rendering with 16 workers
    And I run throughput test for 120 seconds
    And I run memory stress test with 500MB data
    And I test data flow between "RDF" and "Template" engines
    And I test data flow between "Template" and "CAS" engines
    And I test data flow between "CAS" and "Provenance" engines
    Then template rendering should meet p95 target of 150ms
    And concurrent rendering should scale efficiently with 0.85 efficiency
    And throughput should exceed 300 operations per second
    And cache hit rate should be above 0.85
    And memory usage should remain stable during load test
    And memory stress test should complete within 600MB increase
    And data flow between engines should be seamless
    And all integration tests should pass
    And system-wide performance metrics should be within targets

  @security @attestation @comprehensive
  Scenario: Comprehensive security and attestation validation
    Given I have a project template for "secure" with RDF schema
    When I execute the complete project lifecycle for "secure" named "SecureApp"
    And I validate end-to-end workflow integration
    Then all workflow steps should complete successfully
    And the complete project lifecycle should be validated
    And provenance information should be generated
    And end-to-end workflow should complete successfully
    And file "SecureApp/SecureApp.attest.json" should exist with content matching "signature"

  @monitoring @observability @comprehensive
  Scenario: System monitoring and observability validation
    Given I have 30 test templates of varying complexity
    When I benchmark template rendering 200 times
    And I run concurrent rendering with 8 workers
    And I run throughput test for 45 seconds
    And I test data flow between "RDF" and "Template" engines
    And I validate end-to-end workflow integration
    Then template rendering should meet p95 target of 150ms
    And concurrent rendering should scale efficiently with 0.88 efficiency
    And throughput should exceed 150 operations per second
    And cache hit rate should be above 0.85
    And data flow between engines should be seamless
    And engine interaction matrix should show healthy communication
    And system-wide performance metrics should be within targets
    And end-to-end workflow should complete successfully

  @edge-cases @boundary @comprehensive
  Scenario Outline: Edge case and boundary condition validation
    Given I have a project template for "<projectType>" with RDF schema
    When I execute the complete project lifecycle for "<projectType>" named "<projectName>"
    And I generate outputs in formats "<formats>"
    And I run memory stress test with <memoryMB>MB data
    Then all workflow steps should complete successfully
    And all <formatCount> formats should be generated successfully
    And memory stress test should complete within <maxMemoryIncrease>MB increase
    And the complete project lifecycle should be validated

    Examples:
      | projectType | projectName      | formats                  | formatCount | memoryMB | maxMemoryIncrease |
      | minimal     | MinimalApp       | json                     | 1           | 10       | 50                |
      | standard    | StandardApp      | json, yaml               | 2           | 50       | 100               |
      | complex     | ComplexApp       | json, yaml, turtle       | 3           | 100      | 150               |
      | enterprise  | EnterpriseApp    | json, yaml, turtle, xml  | 4           | 200      | 250               |
      | massive     | MassiveApp       | json, yaml, turtle, xml, markdown | 5 | 300    | 400               |

  @regression @compatibility @comprehensive
  Scenario: System regression and compatibility validation
    Given I have 40 test templates of varying complexity
    And I have the KGEN CLI available
    When I execute the KGEN workflow:
      | step         | command   | args                                    | expectedExitCode |
      | list         | list      | --all --format json                    | 0                |
      | help         | help      |                                         | 0                |
      | version      | --version |                                         | 0                |
      | generate     | generate  | template-1 --name RegressionTest       | 0                |
      | validate     | validate  | generated                               | 0                |
      | benchmark    | benchmark | --iterations 100                       | 0                |
    And I benchmark template rendering 300 times
    And I run concurrent rendering with 6 workers
    And I validate end-to-end workflow integration
    Then all workflow steps should complete successfully
    And the workflow should complete in under 60000ms total
    And template rendering should meet p95 target of 150ms
    And concurrent rendering should scale efficiently with 0.87 efficiency
    And files should be generated in the output directory
    And end-to-end workflow should complete successfully
    And system-wide performance metrics should be within targets

  @ultimate @full-system @critical
  Scenario: Ultimate full-system validation
    Given I have 75 test templates of varying complexity
    And I have a project template for "ultimate" with RDF schema
    And I have the KGEN CLI available
    When I execute the complete project lifecycle for "ultimate" named "UltimateTestApp"
    And I generate outputs in formats "json, yaml, turtle, xml, markdown, csv"
    And I benchmark template rendering 750 times
    And I run concurrent rendering with 20 workers
    And I run throughput test for 180 seconds
    And I run memory stress test with 1000MB data
    And I test data flow between "RDF" and "Template" engines
    And I test data flow between "Template" and "CAS" engines
    And I test data flow between "CAS" and "Provenance" engines
    And I validate end-to-end workflow integration
    And I execute the KGEN workflow:
      | step      | command  | args                                 | expectedExitCode |
      | final1    | generate | template-1 --name UltimateTest1     | 0                |
      | final2    | generate | template-25 --name UltimateTest2    | 0                |
      | final3    | generate | template-50 --name UltimateTest3    | 0                |
      | final4    | generate | template-75 --name UltimateTest4    | 0                |
    Then all workflow steps should complete successfully
    And all 6 formats should be generated successfully
    And each format should have unique content addressing
    And template rendering should meet p95 target of 150ms
    And concurrent rendering should scale efficiently with 0.80 efficiency
    And throughput should exceed 400 operations per second
    And cache hit rate should be above 0.80
    And memory usage should remain stable during load test
    And memory stress test should complete within 1200MB increase
    And data flow between engines should be seamless
    And all integration tests should pass
    And engine interaction matrix should show healthy communication
    And system-wide performance metrics should be within targets
    And end-to-end workflow should complete successfully
    And the complete project lifecycle should be validated
    And engine integration should be seamless
    And CAS storage should be utilized
    And provenance information should be generated
    And the workflow should complete in under 300000ms total