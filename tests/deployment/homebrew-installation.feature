Feature: Homebrew Installation and Distribution
  As a macOS developer
  I want to install Unjucks via Homebrew
  So that I can manage it with my system package manager

  Background:
    Given I have macOS with Homebrew installed
    And Node.js is available (installed by Homebrew if needed)
    And I have a clean system without unjucks

  Scenario: Install via Homebrew tap
    When I run "brew tap unjucks/tap"
    Then the tap should be added successfully
    When I run "brew install unjucks"
    Then the installation should succeed
    And unjucks should be available in PATH
    And running "unjucks --version" should show the version

  Scenario: Homebrew formula validation
    Given the Homebrew formula exists
    When I validate the formula syntax
    Then it should pass formula audit
    And it should have correct dependencies
    And it should specify Node.js dependency
    And it should have proper test block

  Scenario: Formula builds from source
    When I run "brew install --build-from-source unjucks"
    Then it should compile successfully
    And all dependencies should be resolved
    And the binary should work correctly

  Scenario: Formula tests pass
    Given unjucks is installed via Homebrew
    When I run "brew test unjucks"
    Then all formula tests should pass
    And "unjucks --version" should work
    And "unjucks list" should work

  Scenario: Homebrew vs npm installation comparison
    Given I can install via both npm and Homebrew
    When I install via npm globally
    And I install via Homebrew (in different environment)
    Then both installations should work identically
    And both should have the same version
    And both should provide the same CLI commands

  Scenario: Homebrew update workflow
    Given unjucks v1.0.0 is installed via Homebrew
    When a new version v1.1.0 is published
    And the Homebrew formula is updated
    When I run "brew upgrade unjucks"
    Then it should upgrade to the new version
    And the old version should be replaced

  Scenario: Homebrew uninstall
    Given unjucks is installed via Homebrew
    When I run "brew uninstall unjucks"
    Then unjucks should be removed from the system
    And the binary should not be in PATH
    And all associated files should be cleaned up

  Scenario: Multiple Node.js versions compatibility
    Given I have multiple Node.js versions via nvm
    When I switch to Node.js <version>
    And unjucks is installed via Homebrew
    Then unjucks should work with <version>

    Examples:
      | version |
      | 18.x    |
      | 20.x    |
      | 22.x    |

  Scenario: Performance after Homebrew installation
    Given unjucks is installed via Homebrew
    When I run CLI commands
    Then startup time should be under 1 second
    And memory usage should be under 50MB
    And all operations should complete quickly