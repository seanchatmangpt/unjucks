Feature: NPM Global Installation and Distribution
  As a developer
  I want to install Unjucks globally via npm
  So that I can use it as a CLI tool from anywhere

  Background:
    Given I have a clean Node.js environment
    And Node.js version is 18 or higher
    And npm is available

  Scenario: Fresh npm global installation
    When I run "npm install -g unjucks"
    Then the installation should succeed
    And the unjucks binary should be available in PATH
    And running "unjucks --version" should show the version number
    And running "unjucks --help" should show help information

  Scenario: CLI commands work after global installation
    Given unjucks is installed globally
    When I run "unjucks list"
    Then it should show available generators
    And the output should contain "component"
    And the output should contain "api" 
    And the output should contain "service"

  Scenario: Initialize project templates
    Given unjucks is installed globally
    And I am in an empty directory
    When I run "unjucks init"
    Then it should create the _templates directory
    And it should show initialization success message
    And it should provide next steps

  Scenario: Generate component with dry run
    Given unjucks is installed globally
    When I run "unjucks generate component react --dry"
    Then it should show what would be generated
    And it should not create actual files
    And the output should contain "Would generate"

  Scenario: Package size optimization
    Given the unjucks package is built
    When I check the package size
    Then the total package size should be less than 2MB
    And it should only contain necessary files
    And it should exclude test files and examples

  Scenario: Cross-platform binary execution
    Given unjucks is installed globally
    When I run the binary on <platform>
    Then it should execute without errors
    And all commands should work correctly
    
    Examples:
      | platform |
      | linux    |
      | darwin   |
      | win32    |

  Scenario: Node.js version compatibility
    Given I have Node.js version <version>
    When I try to install unjucks globally
    Then the installation should <result>
    
    Examples:
      | version | result  |
      | 16.x    | fail    |
      | 18.x    | succeed |
      | 20.x    | succeed |
      | 22.x    | succeed |

  Scenario: Uninstall and reinstall
    Given unjucks is installed globally
    When I run "npm uninstall -g unjucks"
    Then the unjucks binary should not be available
    When I run "npm install -g unjucks" again
    Then the installation should succeed
    And all functionality should work correctly

  Scenario: Package integrity verification
    Given the unjucks package is published
    When I install it from npm registry
    Then all required files should be present
    And the binary should have correct permissions
    And the package.json should have correct metadata
    And the CLI should start within 1 second