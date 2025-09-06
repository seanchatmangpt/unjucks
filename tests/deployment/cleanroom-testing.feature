Feature: Cleanroom Testing and Cross-Platform Validation
  As a package maintainer
  I want to test installation in clean environments
  So that I can ensure reliable distribution across all platforms

  Background:
    Given I have access to clean test environments
    And the unjucks package is built and ready

  Scenario: Docker Alpine Linux cleanroom test
    Given a fresh Alpine Linux container
    And Node.js 18+ is installed
    When I install unjucks globally via npm
    Then installation should complete successfully
    And all CLI commands should work
    And file permissions should be correct
    And the process should exit cleanly

  Scenario: Docker Ubuntu cleanroom test  
    Given a fresh Ubuntu container
    And Node.js 18+ is installed via apt
    When I install unjucks globally via npm
    Then installation should complete successfully
    And all CLI commands should work
    And binary should have executable permissions

  Scenario: GitHub Actions CI environment test
    Given a GitHub Actions Ubuntu runner
    When I install Node.js via setup-node action
    And I install unjucks from npm registry
    Then all functionality should work in CI
    And tests should pass
    And build artifacts should be correct

  Scenario: Windows cleanroom test
    Given a fresh Windows environment
    And Node.js 18+ is installed via installer
    When I install unjucks globally via npm
    Then installation should complete successfully
    And unjucks.cmd should be created in PATH
    And all CLI commands should work in PowerShell
    And all CLI commands should work in Command Prompt

  Scenario: macOS cleanroom test
    Given a fresh macOS environment
    And Node.js 18+ is installed via installer
    When I install unjucks globally via npm
    Then installation should complete successfully
    And the unjucks binary should have correct permissions
    And all CLI commands should work in Terminal

  Scenario: Resource usage validation
    Given unjucks is installed in a clean environment
    When I monitor resource usage during CLI operations
    Then memory usage should stay below 50MB
    And CPU usage should be minimal
    And startup time should be under 1 second
    And no memory leaks should occur

  Scenario: File system isolation test
    Given multiple isolated environments
    When I install unjucks in each environment
    Then each installation should be independent
    And files should not conflict between environments
    And uninstalling from one should not affect others

  Scenario: Network connectivity test
    Given limited network connectivity
    When unjucks is already installed
    Then all offline functionality should work
    And local template generation should work
    And help commands should work
    And version information should be available

  Scenario: Permission restrictions test
    Given an environment with restricted permissions
    When I try to install unjucks globally
    Then it should handle permission errors gracefully
    And provide clear error messages
    And suggest alternative installation methods

  Scenario: Concurrent installation test
    Given multiple clean environments
    When I install unjucks simultaneously in all environments
    Then all installations should succeed
    And no race conditions should occur
    And all instances should work correctly

  Scenario: Installation integrity verification
    Given unjucks is installed in a clean environment
    When I verify the installation integrity
    Then all package files should match expected checksums
    And the binary should be properly linked
    And all dependencies should be correctly installed
    And the package should be listed in global packages

  Scenario: Upgrade and downgrade testing
    Given unjucks v1.0.0 is installed
    When I upgrade to v1.1.0
    Then the upgrade should succeed
    And the new version should work correctly
    When I downgrade back to v1.0.0
    Then the downgrade should succeed
    And the old version should work correctly

  Scenario: Stress test installation
    Given a clean environment
    When I install, uninstall, and reinstall unjucks 10 times
    Then each cycle should complete successfully
    And no artifacts should remain after uninstall
    And the final installation should work perfectly