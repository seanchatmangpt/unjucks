Feature: HYGEN-DELTA.md Comprehensive Validation
  As a developer evaluating Unjucks capabilities
  I want to validate every claim made in HYGEN-DELTA.md
  So that I can trust the documentation accuracy

  Background:
    Given I have a clean test environment
    And the CLI is built and ready

  # Positional Parameters - The Critical Gap
  Scenario: Positional parameters work like Hygen
    Given I have a generator "component" with template "new"
    When I run "unjucks component new MyComponent"
    Then the command should succeed
    And the file "src/components/MyComponent.ts" should be created
    And the file should contain "MyComponent"

  # Frontmatter Support - All 10 Features
  Scenario Outline: All frontmatter options are supported
    Given I have a template with frontmatter option "<option>" set to "<value>"
    When I generate the template with variables
    Then the frontmatter option should work correctly
    
    Examples:
      | option  | value                    |
      | to      | src/test/{{ name }}.ts   |
      | inject  | true                     |
      | before  | // INSERT BEFORE         |
      | after   | // INSERT AFTER          |
      | skipIf  | name==skip               |
      | sh      | echo "Generated"         |
      | append  | true                     |
      | prepend | true                     |
      | lineAt  | 5                        |
      | chmod   | 755                      |

  # CLI Commands - All documented commands work
  Scenario Outline: All CLI commands work as documented
    When I run "unjucks <command>"
    Then the command should succeed
    And I should see appropriate output

    Examples:
      | command   |
      | --version |
      | list      |
      | help      |
      | init      |

  # Template Engine - 8+ Nunjucks filters
  Scenario: All Nunjucks filters are available
    Given I have a template using all filters
    When I generate with name "test_example"
    Then the output should contain:
      | filter        | result      |
      | pascalCase    | TestExample |
      | camelCase     | testExample |
      | kebabCase     | test-example|
      | snakeCase     | test_example|
      | constantCase  | TEST_EXAMPLE|
      | titleCase     | Test Example|
      | pluralize     | tests       |
      | singularize   | test        |

  # File Operations - 6 injection modes
  Scenario Outline: All file injection modes work
    Given I have an existing file with content
    And I have a template with injection mode "<mode>"
    When I generate the template
    Then the file should be modified using "<mode>" correctly

    Examples:
      | mode    |
      | write   |
      | inject  |
      | append  |
      | prepend |
      | lineAt  |

  # Safety Features - Comprehensive safety
  Scenario: Dry run mode works correctly
    Given I have a template that would create files
    When I run "unjucks generate component new --name Test --dry"
    Then no files should be created
    And I should see "DRY RUN" in the output
    And I should see what would be created

  Scenario: Force overwrite works safely
    Given I have an existing file "src/Test.ts"
    When I run "unjucks generate component new --name Test --force"
    Then the file should be overwritten
    And a backup should be created

  Scenario: Atomic operations with rollback
    Given I have a template that might fail
    When the generation fails
    Then no partial files should remain
    And any backups should be restored

  # Dynamic CLI Generation
  Scenario: Template variables become CLI flags automatically
    Given I have a template with variables "name", "withOptions", "description"
    When I run "unjucks help component new"
    Then I should see CLI flags:
      | flag          |
      | --name        |
      | --withOptions |
      | --description |

  # Error Handling
  Scenario: Helpful error messages for missing generators
    When I run "unjucks generate nonexistent template"
    Then the command should fail with helpful message
    And I should see available generators listed

  Scenario: Validation errors for invalid frontmatter
    Given I have a template with conflicting frontmatter
    When I try to generate it
    Then I should see specific validation errors
    And the generation should be prevented

  # Template Discovery
  Scenario: Template discovery works in _templates directory
    Given I have templates in "_templates/component/new/"
    When I run "unjucks list"
    Then I should see "component" generator listed
    And I should see available templates

  # Configuration Support
  Scenario: unjucks.config.ts configuration works
    Given I have an "unjucks.config.ts" file
    When I run any unjucks command
    Then the configuration should be loaded
    And custom settings should be applied

  # Performance Claims Validation
  Scenario: Cold start performance is reasonable
    When I measure "unjucks --version" execution time
    Then it should complete within 1 second
    And memory usage should be reasonable

  # Migration Claims
  Scenario: Hygen-style templates can be converted
    Given I have a Hygen-style template with EJS syntax
    When I convert it to Unjucks format
    Then the conversion should be mostly automatic
    And the functionality should be preserved

  # TypeScript Integration
  Scenario: Generated TypeScript code is valid
    Given I generate TypeScript files
    When I run TypeScript compilation on them
    Then there should be no type errors
    And the generated code should be properly formatted