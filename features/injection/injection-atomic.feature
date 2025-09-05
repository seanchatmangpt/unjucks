Feature: Injection Atomic Operations
  As a developer using Unjucks
  I want atomic write operations for injections
  So that my files are never left in a corrupted or partial state

  Background:
    Given I have a project with unjucks installed
    And I have an existing file "src/config.ts" with content:
      """
      export const config = {
        port: 3000,
        host: 'localhost',
        database: {
          url: 'mongodb://localhost:27017',
          name: 'myapp'
        }
      };
      """

  Scenario: Atomic injection with temporary file creation
    Given I have a generator "config-item" with injection template
    When I run the injection command
    Then a temporary file should be created first
    And the complete operation should be performed on the temporary file
    And the temporary file should replace the original atomically
    And no intermediate corrupt states should be visible

  Scenario: Atomic rollback on injection failure
    Given I have a generator that will fail during injection
    When the injection process encounters an error
    Then the original file should remain unchanged
    And no temporary files should be left behind
    And I should see "Injection failed - no changes made"
    And the file integrity should be preserved

  Scenario: Atomic injection with file locking
    Given I have a generator with injection enabled
    When I run the injection command
    Then the target file should be locked during the operation
    And concurrent access should be prevented
    And the lock should be released after completion
    And the file should be available for other processes

  Scenario: Atomic injection with backup and restore
    Given I have backup enabled for injections
    When I run an injection that fails partway through
    Then the backup should be automatically restored
    And the file should be in its original state
    And I should see "Restored from backup due to failure"
    And no partial changes should remain

  Scenario: Atomic multi-file injection transaction
    Given I have a generator that injects into multiple files
    When I run the generation command
    Then all file operations should be prepared first
    And all files should be modified atomically together
    And if any file fails, all changes should be rolled back
    And I should see "Transaction committed: 3 files updated"

  Scenario: Atomic injection with validation checksum
    Given I have a generator with post-injection validation
    When the injection completes
    Then the file content should be validated
    And a checksum should verify the integrity
    And if validation fails, changes should be reverted
    And I should see validation results

  Scenario: Atomic injection preserving file metadata
    Given I have a target file with specific metadata (permissions, timestamps)
    When I perform an atomic injection
    Then the file permissions should be preserved
    And the original timestamps should be maintained where appropriate
    And the file owner should remain unchanged
    And only the content should be modified

  Scenario: Atomic injection with concurrent access handling
    Given multiple processes are attempting to inject into the same file
    When I run my injection command
    Then the atomic operation should handle concurrency safely
    And file corruption should be prevented
    And each process should complete successfully or fail cleanly
    And I should see appropriate concurrency messages

  Scenario: Atomic injection with disk space validation
    Given the injection would require additional disk space
    When I run the injection command
    Then available disk space should be checked first
    And the operation should fail early if insufficient space
    And no partial files should be created
    And I should see "Insufficient disk space for atomic operation"

  Scenario: Atomic injection with interrupted operation recovery
    Given an atomic injection is interrupted (power loss, kill signal)
    When the system recovers and I re-run the command
    Then any incomplete temporary files should be detected
    And the system should offer to clean up or recover
    And the original files should be intact
    And I should see recovery options

  Scenario: Atomic injection with content verification
    Given I have a generator with strict content validation
    When the injection process completes
    Then the injected content should be verified for correctness
    And syntax validation should be performed if applicable
    And semantic validation should check for conflicts
    And invalid results should trigger rollback

  Scenario: Atomic injection with dependency tracking
    Given I have injections that depend on each other
    When I run multiple related injections
    Then dependencies should be resolved in correct order
    And failure in one dependency should prevent dependent injections
    And the dependency graph should be maintained for rollback
    And I should see dependency resolution progress

  Scenario: Atomic injection with conflict detection
    Given I have simultaneous injections at the same location
    When content conflicts would occur
    Then conflicts should be detected before writing
    And I should see conflict details
    And resolution options should be offered
    And the operation should not proceed without resolution

  Scenario: Atomic injection with undo capability
    Given I have completed an atomic injection
    When I realize I need to undo the changes
    Then I should be able to run an undo command
    And the file should be restored to its pre-injection state
    And multiple levels of undo should be supported
    And I should see "Injection undone successfully"

  Scenario: Atomic injection with streaming for large files
    Given I have a very large target file for injection
    When I perform the injection
    Then the file should be processed in streams
    And memory usage should remain reasonable
    And the atomic operation should still be guaranteed
    And progress should be shown for long operations

  Scenario: Atomic injection with encoding preservation
    Given I have files with specific character encodings
    When I perform atomic injection
    Then the original encoding should be detected
    And the encoding should be preserved throughout the operation
    And the injected content should be properly encoded
    And no encoding corruption should occur

  Scenario: Atomic injection with line ending preservation
    Given I have files with specific line ending conventions (CRLF, LF)
    When I perform atomic injection
    Then the original line endings should be detected
    And the same convention should be used for injected content
    And mixed line endings should be avoided
    And the file consistency should be maintained

  Scenario: Atomic injection with ACL and permission preservation
    Given I have files with complex access control lists
    When I perform atomic injection
    Then the original ACL should be preserved
    And extended file attributes should be maintained
    And security contexts should remain intact
    And no permission escalation should occur

  Scenario: Atomic injection failure cleanup
    Given an atomic injection fails at various stages
    When the failure occurs
    Then all temporary files should be cleaned up
    And any locks should be released
    And system resources should be freed
    And no orphaned processes should remain
    And the cleanup should be thorough and reliable

  Scenario: Atomic injection with performance monitoring
    Given I have performance monitoring enabled
    When I perform atomic injections
    Then operation times should be measured
    And resource usage should be tracked
    And performance metrics should be available
    And bottlenecks should be identified
    And optimization suggestions should be provided

  Scenario: Atomic injection with audit logging
    Given I have audit logging enabled
    When I perform atomic injections
    Then all operations should be logged
    And the audit trail should be complete
    And both successes and failures should be recorded
    And the logs should include timestamps and details
    And log integrity should be maintained