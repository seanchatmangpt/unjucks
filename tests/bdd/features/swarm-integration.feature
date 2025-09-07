Feature: Swarm and MCP Integration
  As a developer using advanced AI orchestration
  I want to leverage swarm intelligence and MCP tools
  So that I can automate complex development workflows

  Background:
    Given I have a working Unjucks installation with MCP integration
    And I have Claude Flow swarm capabilities enabled
    And I have appropriate MCP servers configured

  Scenario: Initialize swarm for template generation
    When I run "unjucks swarm init --topology mesh --agents 5"
    Then I should see "Swarm initialized successfully" message
    And I should see agent spawn confirmations
    And the swarm should be in "active" status
    And the exit code should be 0

  Scenario: Generate templates using swarm coordination
    Given I have an active swarm
    When I run "unjucks swarm generate fullstack-app --name MyApp --agents coder,tester,reviewer"
    Then I should see coordinated agent activity
    And multiple files should be generated in parallel
    And I should see agent collaboration messages
    And the exit code should be 0

  Scenario: Swarm-powered code review
    Given I have generated code files
    And I have an active swarm with review agents
    When I run "unjucks swarm review --path src/ --agents reviewer,security,performance"
    Then I should see multi-agent analysis results
    And I should get comprehensive review reports
    And suggestions should be prioritized by consensus
    And the exit code should be 0

  Scenario: Workflow orchestration with MCP
    When I run "unjucks workflow create dev-pipeline --steps "analyze,design,implement,test,review" --triggers push,pr"
    Then I should see "Workflow created successfully" message
    And the workflow should be registered with MCP
    And triggers should be configured
    And the exit code should be 0

  Scenario: Execute workflow with agent assignment
    Given I have a created workflow "dev-pipeline"
    When I run "unjucks workflow execute dev-pipeline --input '{"project": "user-api"}' --async"
    Then I should see "Workflow queued for execution" message
    And agents should be automatically assigned to steps
    And execution should proceed asynchronously
    And the exit code should be 0

  Scenario: Monitor swarm performance
    Given I have an active swarm with running tasks
    When I run "unjucks swarm status --detailed"
    Then I should see individual agent statuses
    And I should see performance metrics
    And I should see task distribution information
    And the exit code should be 0

  Scenario: Neural pattern training from successful workflows
    Given I have completed several successful workflows
    When I run "unjucks swarm train --from-history --patterns coordination,optimization"
    Then neural patterns should be extracted from workflow history
    And training should improve future agent coordination
    And I should see training progress updates
    And the exit code should be 0

  Scenario: GitHub integration with swarm intelligence
    Given I have GitHub integration configured
    When I run "unjucks github analyze-repo --repo user/project --swarm-analysis"
    Then swarm agents should analyze the repository
    And I should get multi-perspective insights
    And recommendations should be consensus-driven
    And the exit code should be 0

  Scenario: Performance benchmarking with swarm
    When I run "unjucks swarm benchmark --test-suites generation,injection,semantic --iterations 10"
    Then multiple agents should run performance tests
    And results should be aggregated intelligently
    And I should see comparative performance analysis
    And the exit code should be 0

  Scenario: Swarm memory and knowledge sharing
    Given I have swarm agents with accumulated experience
    When I run "unjucks swarm memory export --namespace project-patterns --format json"
    Then shared knowledge should be exported
    And patterns should be preserved for future use
    And memory should be properly structured
    And the exit code should be 0

  Scenario: Adaptive agent scaling based on workload
    Given I have a swarm with variable workload
    When I run "unjucks swarm auto-scale --min-agents 3 --max-agents 10 --cpu-threshold 70"
    Then the swarm should automatically adjust agent count
    And scaling decisions should be based on metrics
    And I should see scaling activity notifications
    And the exit code should be 0

  Scenario: Error recovery and fault tolerance
    Given I have a swarm with a failing agent
    When I run "unjucks swarm heal --auto-recovery"
    Then failed agents should be detected
    And replacement agents should be spawned
    And work should be redistributed
    And the exit code should be 0

  Scenario: Swarm coordination with semantic reasoning
    Given I have RDF data and semantic templates
    And I have an active swarm with reasoning capabilities
    When I run "unjucks swarm semantic-generate ontology-api --schema schema/domain.ttl --reasoning-level advanced"
    Then agents should collaborate on semantic analysis
    And generated code should reflect semantic understanding
    And reasoning results should be shared between agents
    And the exit code should be 0