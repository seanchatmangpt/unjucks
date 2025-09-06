@swarm @e2e @critical
Feature: MCP Swarm Orchestration
  As an enterprise developer
  I want to orchestrate distributed agent swarms via MCP protocol
  So that I can execute complex template generation workflows at scale

  Background:
    Given the MCP server is running
    And the swarm orchestrator is initialized
    And I have valid authentication credentials

  @topology @mesh
  Scenario: Initialize mesh topology swarm
    Given I want to create a swarm with "mesh" topology
    And I specify 5 agents
    When I initialize the swarm
    Then the swarm should be created successfully
    And all 5 agents should be spawned
    And each agent should be connected to all other agents
    And the swarm status should be "active"

  @topology @hierarchical  
  Scenario: Initialize hierarchical topology swarm
    Given I want to create a swarm with "hierarchical" topology
    And I specify 7 agents
    When I initialize the swarm
    Then the swarm should be created successfully
    And all 7 agents should be spawned in tree structure
    And a leader agent should be selected
    And the connection topology should form a hierarchy
    And agent communication should follow parent-child relationships

  @topology @ring
  Scenario: Initialize ring topology swarm
    Given I want to create a swarm with "ring" topology  
    And I specify 6 agents
    When I initialize the swarm
    Then the swarm should be created successfully
    And all 6 agents should be spawned
    And each agent should connect to exactly one next agent
    And the topology should form a complete ring
    And messages should propagate around the ring

  @topology @star
  Scenario: Initialize star topology swarm
    Given I want to create a swarm with "star" topology
    And I specify 8 agents  
    When I initialize the swarm
    Then the swarm should be created successfully
    And all 8 agents should be spawned
    And one agent should act as the central hub
    And all other agents should connect only to the hub
    And the hub should coordinate all communication

  @pipeline @template-generation
  Scenario: Execute end-to-end template generation pipeline
    Given I have an active mesh swarm with 5 agents
    And the agents have different specializations
    When I execute a "template-generation" pipeline
    And I provide template parameters:
      | name     | UserService          |
      | type     | microservice         |
      | features | auth,crud,validation |
    Then the pipeline should execute all stages:
      | stage          | agent_type  | expected_duration |
      | Research       | researcher  | <5s               |
      | Architecture   | architect   | <10s              |
      | Implementation | coder       | <15s              |
      | Testing        | tester      | <8s               |
      | Review         | reviewer    | <5s               |
    And each stage should complete successfully
    And the final output should contain generated template files
    And the pipeline metrics should be recorded

  @pipeline @marketplace-integration
  Scenario: Execute marketplace integration pipeline
    Given I have an active hierarchical swarm with 6 agents
    When I execute a "marketplace-integration" pipeline
    And I specify the template "enterprise-auth-suite"
    Then the pipeline should execute stages:
      | stage       | agent_type | status    |
      | Discovery   | researcher | completed |
      | Validation  | tester     | completed |
      | Integration | coder      | completed |
      | Deployment  | deployer   | completed |
    And marketplace template should be installed
    And integration tests should pass
    And deployment should be verified

  @scaling @dynamic
  Scenario: Dynamic swarm scaling
    Given I have an active swarm with 3 agents
    And the swarm is processing tasks
    When I scale the swarm up to 8 agents
    Then 5 new agents should be spawned
    And the topology should be reconfigured
    And existing tasks should not be interrupted
    And new agents should join the work queue
    When I scale the swarm down to 5 agents
    Then 3 idle agents should be removed
    And active agents should continue working
    And the topology should be adjusted accordingly

  @fault-tolerance @agent-failure
  Scenario: Handle agent failure gracefully
    Given I have an active mesh swarm with 6 agents
    And agents are processing a long-running pipeline
    When agent "agent-coder-001" fails unexpectedly
    Then the swarm should detect the failure within 5 seconds
    And the failed agent's tasks should be reassigned
    And a replacement agent should be spawned
    And the pipeline should continue without data loss
    And the swarm should remain operational

  @performance @load-testing
  Scenario: High-load swarm performance
    Given I have an active mesh swarm with 10 agents
    When I submit 50 concurrent template generation tasks
    And each task has different complexity levels
    Then all tasks should be distributed across agents
    And no agent should be idle while tasks are pending
    And 90% of tasks should complete within SLA:
      | complexity | max_duration |
      | simple     | 30s          |
      | medium     | 2m           |
      | complex    | 5m           |
    And system resources should remain stable
    And no memory leaks should be detected

  @real-time @websocket
  Scenario: Real-time swarm communication
    Given I have an active swarm with WebSocket enabled
    And I'm connected to the swarm via WebSocket
    When agents start communicating
    Then I should receive real-time updates:
      | event_type          | max_latency |
      | agent.status_update | 100ms       |
      | task.progress       | 200ms       |
      | swarm.broadcast     | 150ms       |
      | pipeline.completed  | 500ms       |
    And all events should follow MCP message format
    And message ordering should be preserved
    And no events should be lost

  @security @authentication
  Scenario: Secure swarm authentication
    Given the swarm requires authentication
    When I attempt to join without credentials
    Then I should be rejected with "Authentication required"
    When I provide invalid credentials
    Then I should be rejected with "Invalid credentials"  
    When I provide valid enterprise credentials
    Then I should be authenticated successfully
    And I should receive a session token
    And I should have access to swarm operations
    And my actions should be logged for audit

  @multi-tenant @isolation
  Scenario: Multi-tenant swarm isolation
    Given I have two separate tenant swarms:
      | tenant_id | swarm_id | agent_count |
      | walmart   | swarm-001| 5           |
      | apple     | swarm-002| 7           |
    When both swarms are processing tasks simultaneously
    Then swarm-001 agents should only see walmart tasks
    And swarm-002 agents should only see apple tasks
    And no cross-tenant data leakage should occur
    And each swarm should have isolated metrics
    And audit logs should be tenant-specific

  @enterprise @compliance
  Scenario: Enterprise compliance validation
    Given I have an enterprise swarm configuration
    When I execute compliance validation
    Then all agents should pass security scanning
    And communication should be encrypted end-to-end
    And audit logs should capture all operations
    And data retention policies should be enforced
    And SOC2 compliance requirements should be met:
      | requirement           | status   |
      | Access controls       | verified |
      | Data encryption       | verified |
      | Audit logging         | verified |
      | Incident response     | verified |
      | Change management     | verified |

  @error-handling @graceful-degradation
  Scenario: Graceful error handling
    Given I have an active swarm processing tasks
    When various error conditions occur:
      | error_type              | expected_behavior                |
      | Network timeout         | Retry with exponential backoff   |
      | Agent resource shortage | Queue tasks until resources free |
      | Invalid task payload    | Return detailed error message    |
      | MCP protocol violation  | Disconnect and log error         |
      | Database unavailable    | Use cached data where possible   |
    Then the swarm should handle each error appropriately
    And system stability should be maintained
    And detailed error logs should be generated
    And monitoring alerts should be triggered

  @integration @unjucks-cli
  Scenario: Integration with Unjucks CLI
    Given I have an active swarm
    And the Unjucks CLI is connected to the swarm
    When I run "unjucks generate component react --swarm=true"
    Then the CLI should submit the task to the swarm
    And the swarm should process the template generation
    And generated files should be returned to CLI
    And CLI should write files to the local filesystem
    And the operation should be transparent to the user

  @metrics @monitoring
  Scenario: Comprehensive swarm metrics
    Given I have an active swarm processing various tasks
    When I query swarm metrics
    Then I should receive detailed metrics:
      | metric_type      | data_points                           |
      | Agent metrics    | cpu, memory, tasks_completed, uptime  |
      | Swarm health     | active_agents, error_rate, throughput |
      | Task metrics     | queue_depth, avg_duration, success_rate|
      | Network metrics  | message_count, latency, packet_loss    |
      | Resource usage   | cpu_total, memory_total, disk_io       |
    And metrics should be updated in real-time
    And historical data should be retained
    And alerts should trigger on anomalies