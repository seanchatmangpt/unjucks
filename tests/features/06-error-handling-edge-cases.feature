Feature: Error Handling and Edge Cases
  As a developer using unjucks in various scenarios
  I want robust error handling and graceful degradation
  So that I can troubleshoot issues and handle unexpected situations

  Background:
    Given I have unjucks installed and configured
    And the MCP server is running
    And I have various project configurations

  Scenario: Handling corrupted template files
    Given I have a template file with syntax errors
    When I run "unjucks generate component Button"
    Then I should see a clear error message about template syntax
    And the error should indicate the specific line and column
    And suggestions for fixing the syntax should be provided
    And no partial files should be created
    And the original files should remain unchanged

  Scenario: Dealing with missing template dependencies
    Given a template references files that don't exist
    When I run "unjucks generate module UserService"
    Then I should see an error about missing dependencies
    And the missing files should be clearly listed
    And suggestions for creating or finding the dependencies should be provided
    And the generation should fail gracefully without side effects

  Scenario: Handling insufficient disk space
    Given the target directory has insufficient disk space
    When I run "unjucks generate large-project --withFullStack"
    Then I should see a clear error about disk space
    And the error should indicate how much space is needed
    And partially created files should be cleaned up
    And suggestions for freeing space should be provided

  Scenario: Managing permission denied errors
    Given the target directory has restricted write permissions
    When I run "unjucks generate api UserAPI"
    Then I should see a permission error with clear explanation
    And instructions for fixing permissions should be provided
    And alternative target directories should be suggested
    And no files should be created in unauthorized locations

  Scenario: Handling network connectivity issues with MCP
    Given the MCP server is unreachable
    When I run "unjucks generate component Button"
    Then I should see a connection error message
    And offline mode capabilities should be explained
    And cached templates should be used if available
    And instructions for reconnecting should be provided

  Scenario: Dealing with circular template dependencies
    Given templates have circular dependencies
    When I run "unjucks generate complex-module"
    Then I should see an error about circular dependencies
    And the dependency chain should be clearly shown
    And suggestions for breaking the cycle should be provided
    And the system should not hang or crash

  Scenario: Handling invalid variable types and values
    Given I provide invalid values for template variables
    When I run "unjucks generate model User --age=invalid --isActive=maybe"
    Then I should see validation errors for each invalid value
    And the expected types and formats should be clearly stated
    And examples of valid values should be provided
    And the generation should not proceed with invalid data

  Scenario: Managing memory limitations with large templates
    Given I have very large template files or datasets
    When I run "unjucks generate massive-dataset --records=1000000"
    Then the system should handle large data gracefully
    And memory usage should be monitored and reported
    And streaming or chunking should be used for large operations
    And progress indicators should be provided for long operations

  Scenario: Handling concurrent access conflicts
    Given multiple users are generating files simultaneously
    When I run "unjucks generate shared-component Button" concurrently
    Then file locking mechanisms should prevent conflicts
    And clear error messages should indicate when files are locked
    And retry mechanisms should be available
    And partial writes should not occur

  Scenario: Dealing with malformed configuration files
    Given the unjucks configuration file is malformed
    When I run any unjucks command
    Then I should see a clear error about configuration issues
    And the specific configuration problems should be identified
    And default configuration should be used where possible
    And instructions for fixing the configuration should be provided

  Scenario: Handling template versioning conflicts
    Given templates have version compatibility issues
    When I run "unjucks generate component Button --version=2.0"
    Then version compatibility should be checked
    And conflicts should be clearly reported
    And available compatible versions should be listed
    And migration paths should be suggested

  Scenario: Managing interrupted operations and recovery
    Given a generation operation is interrupted mid-process
    When I run "unjucks generate large-project"
    And the operation is forcibly terminated
    Then partial files should be cleaned up on next run
    And recovery options should be presented
    And the ability to resume should be available
    And data integrity should be maintained

  Scenario: Handling special characters and encoding issues
    Given templates or variables contain special characters
    When I run "unjucks generate component Buttön --description='🚀 Special chars: ñáéíóú'"
    Then Unicode characters should be handled correctly
    And encoding should be preserved throughout the process
    And file names should be properly encoded
    And content should maintain character integrity

  Scenario: Dealing with extremely deep directory structures
    Given the target path has very deep nested directories
    When I run "unjucks generate component Button --dest=very/deep/nested/directory/structure/that/is/extremely/long"
    Then path length limitations should be handled
    And alternative shorter paths should be suggested
    And cross-platform compatibility should be maintained
    And appropriate errors should be shown for unsupported paths

  Scenario: Handling template injection and security issues
    Given potentially malicious content in template variables
    When I run "unjucks generate component Button --description='<script>alert(\"xss\")</script>'"
    Then potentially dangerous content should be sanitized
    And security warnings should be displayed
    And safe alternatives should be suggested
    And the generation should not execute harmful code

  Scenario: Managing resource exhaustion scenarios
    Given system resources are heavily constrained
    When I run multiple concurrent unjucks operations
    Then resource usage should be monitored and limited
    And operations should queue when resources are exhausted
    And clear messages about resource constraints should be provided
    And graceful degradation should occur

  Scenario: Handling template parsing edge cases
    Given templates with complex nested structures and edge case syntax
    When I run "unjucks generate complex-template"
    Then complex nesting should be parsed correctly
    And edge cases in template syntax should be handled
    And helpful error messages should be provided for unsupported features
    And fallback behaviors should be clearly documented

  Scenario: Dealing with cross-platform path and file system differences
    Given I'm using unjucks across different operating systems
    When I run "unjucks generate component Button" on Windows, macOS, and Linux
    Then path separators should be handled correctly on all platforms
    And file permissions should be set appropriately for each OS
    And line endings should be consistent with platform conventions
    And character encoding should work across all platforms

  Scenario: Handling plugin and extension failures
    Given custom plugins or extensions are installed but failing
    When I run "unjucks generate component Button --with-plugin=custom-plugin"
    Then plugin failures should be isolated from core functionality
    And clear error messages about plugin issues should be provided
    And fallback to core functionality should be available
    And plugin debugging information should be accessible