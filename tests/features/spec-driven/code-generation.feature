Feature: Code Generation from Specifications
  As a developer
  I want to generate code from specifications
  So that I can implement features consistently and efficiently

  Background:
    Given I have validated specifications
    And code generation templates are available
    And the target project structure is initialized

  Scenario: Basic code scaffolding from specification
    Given I have a specification "UserService"
    When I generate code scaffolding
    Then the following files should be created:
      | file_type          | path                           | content_includes        |
      | service_class      | src/services/UserService.js   | class UserService       |
      | interface         | src/types/UserService.js      | UserService interfaces  |
      | test_file         | tests/services/UserService.js | UserService test suite  |
      | api_routes        | src/routes/users.js           | user route handlers     |
    And generated code should follow project conventions
    And all files should have proper imports and exports
    And documentation comments should be included

  Scenario: Specification-driven API generation
    Given I have an API specification with endpoints:
      | method | path           | description          |
      | GET    | /users         | Get all users        |
      | GET    | /users/:id     | Get user by ID       |
      | POST   | /users         | Create new user      |
      | PUT    | /users/:id     | Update user          |
      | DELETE | /users/:id     | Delete user          |
    When I generate API code
    Then route handlers should be created for each endpoint
    And request/response schemas should be defined
    And validation middleware should be generated
    And error handling should be implemented
    And OpenAPI documentation should be generated

  Scenario: Database schema generation
    Given I have a specification with data models:
      | entity | fields                                    |
      | User   | id:uuid, email:string, name:string       |
      | Post   | id:uuid, title:string, content:text      |
      | Tag    | id:uuid, name:string, color:string       |
    When I generate database schema
    Then migration files should be created
    And model classes should be generated
    And relationships should be properly defined
    And indexes should be created for performance
    And constraints should be enforced

  Scenario: Frontend component generation
    Given I have a UI specification "UserProfile"
    When I generate frontend components
    Then the following should be created:
      | component_type    | path                              |
      | main_component    | src/components/UserProfile.js    |
      | style_file        | src/components/UserProfile.css   |
      | test_file         | tests/components/UserProfile.js  |
      | story_file        | stories/UserProfile.stories.js   |
    And components should be responsive
    And accessibility attributes should be included
    And proper state management should be implemented
    And component should handle loading and error states

  Scenario: Test generation from specifications
    Given I have specifications with acceptance criteria
    When I generate test code
    Then test suites should cover:
      | test_type        | coverage                        |
      | unit_tests       | Individual functions/methods    |
      | integration_tests | Component interactions         |
      | e2e_tests        | User workflow scenarios        |
      | api_tests        | Endpoint behavior              |
    And test cases should match acceptance criteria
    And edge cases should be automatically identified
    And test data should be generated appropriately
    And assertions should be meaningful and specific

  Scenario: Configuration and environment setup
    Given I have deployment specifications
    When I generate configuration files
    Then the following should be created:
      | config_type      | files                           |
      | environment      | .env.example, .env.local        |
      | docker          | Dockerfile, docker-compose.yml  |
      | ci_cd           | .github/workflows/main.yml      |
      | package_config  | package.json dependencies       |
    And configurations should match specification requirements
    And environment variables should be documented
    And deployment scripts should be generated
    And health checks should be included

  Scenario: Code generation with custom templates
    Given I have custom code templates
    When I generate code using custom templates
    Then the custom templates should be applied correctly
    And template variables should be populated from specifications
    And conditional logic in templates should work
    And custom helpers and filters should be available
    And generated code should pass all quality checks

  Scenario: Incremental code generation
    Given I have existing generated code
    When I update the specification
    Then only affected files should be regenerated
    And existing customizations should be preserved
    And merge conflicts should be detected and reported
    And backup copies should be created for safety
    And change summary should be provided

  Scenario: Multi-language code generation
    Given I have a specification that targets multiple languages
    When I generate code for different languages:
      | language   | framework     | output_dir    |
      | JavaScript | Node.js       | ./js-service  |
      | Python     | FastAPI       | ./py-service  |
      | TypeScript | NestJS        | ./ts-service  |
    Then code should be generated for each target
    And language-specific conventions should be followed
    And equivalent functionality should be maintained
    And inter-service communication should be configured

  Scenario: Quality assurance in generated code
    Given I generate code from specifications
    When I run quality checks on generated code
    Then the code should pass:
      | check_type       | criteria                      |
      | syntax_check     | No syntax errors              |
      | lint_rules       | Coding standards compliance   |
      | security_scan    | No security vulnerabilities   |
      | performance      | Acceptable performance metrics|
      | test_coverage    | Minimum coverage threshold    |
    And quality issues should be reported with fixes
    And code should be automatically formatted
    And documentation should be complete and accurate

  Scenario: Code generation with business logic
    Given I have specifications with complex business rules
    When I generate code with business logic
    Then business rules should be implemented correctly
    And validation logic should be comprehensive
    And error handling should cover business scenarios
    And audit trails should be implemented where required
    And compliance requirements should be enforced

  Scenario: Performance-optimized code generation
    Given I have specifications with performance requirements
    When I generate optimized code
    Then database queries should be efficient
    And caching strategies should be implemented
    And resource usage should be minimized
    And bottlenecks should be avoided in design
    And performance monitoring should be included
    And scalability patterns should be applied