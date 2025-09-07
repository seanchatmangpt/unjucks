Feature: MCP Comprehensive Integration Scenarios
  As a developer using Claude Code with MCP integration
  I want to validate comprehensive MCP workflows
  So that I can trust the system for enterprise-grade development

  Background:
    Given I have a clean test environment
    And I have the MCP server running
    And I have sample templates available

  @mcp-core @critical
  Scenario: Basic MCP Tool Integration
    When I execute MCP tool "unjucks_list" with parameters:
      | parameter | value | type    |
      | detailed  | true  | boolean |
    Then the MCP tool "unjucks_list" should be called
    And the result should contain "generators"
    And the response should be valid JSON-RPC format
    And the MCP server should respond within 200ms

  @mcp-generation @critical
  Scenario: File Generation via MCP Tools
    Given I have a "component" generator with variables
    When I execute MCP tool "unjucks_generate" with parameters:
      | parameter | value              | type   |
      | generator | component          | string |
      | template  | new                | string |
      | dest      | ./output           | string |
      | name      | UserProfile        | string |
      | withTests | true               | boolean |
      | force     | false              | boolean |
    Then the result should contain "filesCreated"
    And files should be generated successfully
    And the generated files should contain expected content

  @swarm-coordination @critical
  Scenario: Swarm Task to Unjucks Parameter Conversion
    When I orchestrate swarm task "generate" with:
      | parameter | value                           | type   |
      | generator | component                       | string |
      | template  | typescript                      | string |
      | dest      | ./output                        | string |
      | name      | DataTable                       | string |
      | withProps | true                           | boolean |
      | agentType | frontend-specialist             | string |
      | priority  | high                           | string |
    Then the swarm should coordinate template generation
    And the result should contain "DataTable"
    And memory synchronization should work across agents

  @memory-sync @integration
  Scenario: Template Variable Synchronization with Swarm Memory
    When I sync template variables with swarm memory
    Then memory synchronization should work across agents
    And the result should contain "variables"
    And semantic coordination should enhance the workflow

  @jtbd-workflows @enterprise
  Scenario: Jobs-to-be-Done Workflow Orchestration
    When I run "jtbd-workflow component-with-tests UserDashboard"
    Then JTBD workflows should execute successfully
    And the result should contain "UserDashboard"
    And all workflow steps should complete
    And generated artifacts should be consistent

  @semantic-coordination @advanced
  Scenario: Semantic-Enhanced MCP Workflows
    When I orchestrate swarm task "generate" with:
      | parameter     | value                    | type   |
      | generator     | api                      | string |
      | template      | fhir-patient            | string |
      | dest          | ./output                 | string |
      | resourceType  | Patient                  | string |
      | compliance    | FHIR-R4                 | string |
      | ontology      | healthcare              | string |
    Then semantic coordination should enhance the workflow
    And the result should contain "Patient"
    And ontology validation should pass

  @concurrent-execution @performance
  Scenario: Concurrent MCP Request Processing
    When I make 5 concurrent MCP requests
    Then no tool calls should fail
    And all requests should complete within 3 seconds
    And memory usage should remain under 100MB
    And performance should meet enterprise standards

  @error-handling @reliability
  Scenario: MCP Error Handling and Recovery
    When I run "unjucks generate nonexistent-generator nonexistent-template --dest ./output"
    Then error handling should be comprehensive
    And the response should indicate an error
    And the error message should be descriptive
    And the system should remain stable after errors

  @fault-tolerance @reliability
  Scenario: Fault Tolerance in Distributed Operations
    When I orchestrate swarm task "generate" with:
      | parameter | value                    | type   |
      | generator | invalid-generator        | string |
      | template  | invalid-template         | string |
      | dest      | ./output                 | string |
    Then the workflow should be fault-tolerant
    And error handling should be comprehensive
    And the system should continue operating

  @real-time-coordination @advanced
  Scenario: Real-time Swarm-Unjucks Coordination
    Given I have multiple complex generation tasks queued
    When I orchestrate swarm task "scaffold" with:
      | parameter   | value                      | type   |
      | name        | microservice-platform      | string |
      | description | Enterprise microservice     | string |
      | components  | api,database,auth,monitoring| string |
      | dest        | ./platform                 | string |
    Then the swarm should coordinate template generation
    And real-time coordination should work
    And all components should be generated consistently
    And cross-component dependencies should be resolved

  @performance-benchmarks @non-functional
  Scenario: MCP Integration Performance Benchmarks
    When I run performance benchmarks for MCP integration
    Then the MCP server should respond within 200ms
    And throughput should exceed 50 operations per minute
    And memory usage should remain under 100MB
    And performance should meet enterprise standards
    And concurrent operations should scale linearly

  @security-validation @security
  Scenario: MCP Security and Validation
    When I execute MCP tool "unjucks_generate" with parameters:
      | parameter | value                        | type   |
      | generator | component                    | string |
      | template  | ../../etc/passwd            | string |
      | dest      | /etc/                       | string |
    Then all requests should be rejected
    And no files should be accessed outside the project directory
    And security boundaries should be enforced
    And audit logs should capture security events

  @integration-comprehensive @critical
  Scenario: End-to-End MCP-Claude Flow Integration
    Given I have Claude Flow MCP tools available
    And I have initialized the swarm topology for enterprise workflows
    When I orchestrate swarm task "document" with:
      | parameter | value                        | type   |
      | docType   | api                         | string |
      | title     | Enterprise API Documentation | string |
      | content   | Auto-generated from schemas  | string |
      | dest      | ./docs                      | string |
    Then the swarm should coordinate template generation
    And semantic coordination should enhance the workflow
    And JTBD workflows should execute successfully
    And performance should meet enterprise standards
    And the workflow should be fault-tolerant
    And all generated documentation should be consistent

  @cross-session-persistence @advanced
  Scenario: Cross-Session State and Memory Persistence
    When I run "unjucks generate component UserForm --withState --dest ./components"
    And I interrupt the process
    And I resume the workflow
    Then workflow state should be persisted
    And the process should resume from last checkpoint
    And all generated artifacts should be complete

  @enterprise-validation @comprehensive
  Scenario: Enterprise-Grade MCP Validation Suite
    Given I have enterprise templates and compliance requirements
    When I execute a full enterprise workflow with:
      | parameter     | value                          | type   |
      | workflowType  | enterprise-microservice        | string |
      | compliance    | SOX,GDPR,HIPAA                | string |
      | components    | api,database,auth,monitoring   | string |
      | testing       | unit,integration,e2e           | string |
      | documentation | api,compliance,deployment      | string |
    Then all enterprise requirements should be satisfied
    And compliance documentation should be generated
    And security controls should be implemented
    And monitoring and observability should be configured
    And the entire solution should be production-ready