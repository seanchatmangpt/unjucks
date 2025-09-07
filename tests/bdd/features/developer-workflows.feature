Feature: End-to-End Developer Workflows
  As a developer using Unjucks in real projects
  I want to follow complete development workflows
  So that I can efficiently build and maintain applications

  Background:
    Given I have a working Unjucks installation
    And I have a clean project workspace
    And I have access to template libraries

  Scenario: Full-stack application scaffolding
    Given I want to create a new full-stack application
    When I run "unjucks init fullstack-app MyProject --template react-node-api"
    Then I should see project structure created
    And I should have frontend, backend, and database folders
    And package.json files should be configured
    And initial configuration files should be present
    And the exit code should be 0

  Scenario: Add new feature to existing project
    Given I have an existing project with Unjucks templates
    When I run "unjucks generate feature user-management --components auth,profile,settings"
    Then I should see new feature files generated
    And existing files should be updated with new routes
    And database migrations should be created
    And tests should be generated for new components
    And the exit code should be 0

  Scenario: API development workflow
    Given I have a project with API templates
    When I run the following commands:
      | unjucks generate model User --fields name:string,email:string,role:enum |
      | unjucks generate controller User --crud --auth |
      | unjucks generate routes user --controller User --middleware auth |
      | unjucks inject app register-routes --routes user |
    Then I should have a complete API implementation
    And all files should be properly connected
    And validation should be included
    And the exit code should be 0

  Scenario: Frontend component development
    Given I have React templates configured
    When I run the following sequence:
      | unjucks generate component UserCard --props user:User,onEdit:function |
      | unjucks generate hook useUser --crud --api /api/users |
      | unjucks generate page UserManagement --components UserCard --hooks useUser |
      | unjucks inject router add-route --path /users --component UserManagement |
    Then I should have a complete frontend feature
    And components should be properly typed
    And state management should be connected
    And the exit code should be 0

  Scenario: Database schema evolution
    Given I have an existing database schema
    When I run "unjucks generate migration add-user-preferences --changes 'add table user_preferences, add foreign key to users'"
    Then I should see migration files created
    And migration should include up and down scripts
    And schema documentation should be updated
    And the exit code should be 0

  Scenario: Testing infrastructure setup
    Given I have a project with testing requirements
    When I run "unjucks generate test-suite comprehensive --types unit,integration,e2e --frameworks jest,playwright"
    Then test configuration files should be created
    And test utilities and fixtures should be generated
    And CI/CD pipeline should include test steps
    And the exit code should be 0

  Scenario: Microservice architecture scaffolding
    Given I want to create a microservices project
    When I run "unjucks generate microservice user-service --type api --dependencies database,cache,queue"
    Then I should see service-specific structure
    And Docker configuration should be included
    And inter-service communication should be set up
    And monitoring and logging should be configured
    And the exit code should be 0

  Scenario: Legacy code modernization
    Given I have legacy code that needs updating
    When I run "unjucks migrate legacy-to-modern --source src/legacy --target src/modern --patterns mvc-to-clean"
    Then code should be transformed to modern patterns
    And interfaces should be preserved
    And migration report should be generated
    And the exit code should be 0

  Scenario: Performance optimization workflow
    Given I have a project with performance issues
    When I run "unjucks perf analyze --profile --optimize --report"
    Then performance bottlenecks should be identified
    And optimization suggestions should be provided
    And benchmarks should be generated
    And the exit code should be 0

  Scenario: Security hardening workflow
    Given I have a project that needs security review
    When I run "unjucks security audit --generate-fixes --update-deps"
    Then security vulnerabilities should be identified
    And fixes should be automatically applied where possible
    And security best practices should be enforced
    And the exit code should be 0

  Scenario: Documentation generation workflow
    Given I have code that needs documentation
    When I run "unjucks docs generate --api --components --architecture --deploy"
    Then API documentation should be generated
    And component documentation should be created
    And architecture diagrams should be produced
    And deployment guides should be written
    And the exit code should be 0

  Scenario: Multi-environment deployment setup
    Given I need to deploy to multiple environments
    When I run "unjucks deploy setup --environments dev,staging,prod --platform kubernetes"
    Then environment-specific configurations should be created
    And deployment scripts should be generated
    And infrastructure as code should be set up
    And CI/CD pipelines should be configured
    And the exit code should be 0

  Scenario: Team collaboration workflow
    Given I'm working in a team environment
    When I run "unjucks team setup --members 5 --roles dev,qa,ops --standards airbnb"
    Then team configuration should be established
    And code standards should be enforced
    And collaboration tools should be configured
    And onboarding documentation should be created
    And the exit code should be 0