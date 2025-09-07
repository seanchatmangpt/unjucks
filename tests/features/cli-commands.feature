Feature: Enhanced CLI Commands
  As a developer
  I want to use advanced CLI commands
  So that I can leverage MCP and semantic capabilities

  Background:
    Given I have the unjucks CLI installed
    And MCP tools are available

  Scenario: Initialize AI swarm with mesh topology
    When I run "unjucks swarm init --topology mesh --agents 5"
    Then a swarm should be initialized with 5 agents
    And the MCP tool "swarm_init" should be called
    And the topology should be "mesh"
    And the response should contain swarm configuration

  Scenario: Initialize AI swarm with hierarchical topology
    When I run "unjucks swarm init --topology hierarchical --agents 3"
    Then a swarm should be initialized with 3 agents
    And the MCP tool "swarm_init" should be called
    And the topology should be "hierarchical"

  Scenario: Execute semantic validation on valid RDF file
    Given I have an RDF file "ontology.ttl" with valid content
    When I run "unjucks semantic validate ontology.ttl"
    Then the file should be validated against SHACL rules
    And the MCP tool "semantic_validate" should be called
    And the validation should pass
    And the response should contain validation results

  Scenario: Execute semantic validation on invalid RDF file
    Given I have an RDF file "invalid.ttl" with syntax errors
    When I run "unjucks semantic validate invalid.ttl"
    Then the validation should fail
    And error messages should be displayed
    And the MCP tool "semantic_validate" should be called

  Scenario: Generate semantic templates with RDF integration
    Given I have a semantic schema "user-schema.ttl"
    When I run "unjucks generate semantic-model --schema user-schema.ttl --output ./src/models"
    Then semantic templates should be generated
    And the MCP tool "template_generate" should be called
    And RDF data should be processed correctly

  Scenario: List available MCP-enhanced generators
    When I run "unjucks list --enhanced"
    Then I should see a list of available generators
    And MCP-enhanced capabilities should be highlighted
    And semantic generators should be included

  Scenario: Spawn multiple agents for parallel processing
    When I run "unjucks swarm spawn --type coder --count 3"
    Then 3 coder agents should be spawned
    And the MCP tool "agent_spawn" should be called 3 times
    And each agent should have unique identifiers

  Scenario: Execute task orchestration across swarm
    Given I have an active swarm with 5 agents
    When I run "unjucks swarm execute --task 'analyze codebase' --strategy parallel"
    Then the task should be distributed across agents
    And the MCP tool "task_orchestrate" should be called
    And execution strategy should be "parallel"

  Scenario: Monitor swarm status and performance
    Given I have an active swarm
    When I run "unjucks swarm status --detailed"
    Then I should see detailed swarm information
    And the MCP tool "swarm_status" should be called
    And agent metrics should be displayed

  Scenario: Validate template with semantic constraints
    Given I have a template "user-template.njk" with semantic annotations
    When I run "unjucks validate semantic --template user-template.njk"
    Then semantic constraints should be validated
    And RDF compatibility should be checked
    And the MCP tool "semantic_validate" should be called

  Scenario: Generate code with AI assistance
    When I run "unjucks generate component --name UserProfile --ai-enhanced"
    Then AI-assisted code generation should be triggered
    And the MCP tool "ai_generate" should be called
    And enhanced templates should be used

  Scenario: Batch process multiple templates
    Given I have multiple templates in "templates/batch/"
    When I run "unjucks batch generate --templates templates/batch/ --parallel"
    Then all templates should be processed in parallel
    And the MCP tool "batch_process" should be called
    And results should be aggregated

  Scenario: Export swarm configuration
    Given I have an active swarm configuration
    When I run "unjucks swarm export --format json --output swarm-config.json"
    Then the swarm configuration should be exported
    And the file should be created in JSON format
    And all agent configurations should be included

  Scenario: Import and restore swarm configuration
    Given I have a swarm configuration file "swarm-config.json"
    When I run "unjucks swarm import --config swarm-config.json"
    Then the swarm should be restored from configuration
    And all agents should be recreated
    And the MCP tool "swarm_restore" should be called