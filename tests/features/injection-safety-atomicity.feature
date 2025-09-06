Feature: Injection Safety and Atomicity
  As a developer using Unjucks
  I want file injections to be safe and atomic
  So that my existing files are never corrupted or duplicated

  Background:
    Given I am in a test environment
    And the CLI is built and ready

  Scenario: Idempotent injection with skipIf conditions
    Given I have an existing file "src/router.ts" with content:
      """
      import { Router } from 'express';
      
      const router = Router();
      
      // Routes will be injected here
      
      export default router;
      """
    And I have an injection template:
      """
      ---
      to: src/router.ts
      inject: true
      after: "// Routes will be injected here"
      skipIf: "<%= name %> route"
      ---
      router.use('/<%= name.toLowerCase() %>', <%= name %>Routes);
      """
    When I generate with name "user"
    Then the file should contain "router.use('/user', userRoutes);"
    When I generate again with name "user"
    Then the route should not be duplicated
    And the file should remain valid TypeScript

  Scenario: Multiple injection points in single file
    Given I have a target file "src/app.ts" with content:
      """
      import express from 'express';
      
      // Imports will be injected here
      
      const app = express();
      
      // Middleware will be injected here
      
      // Routes will be injected here
      
      export default app;
      """
    And I have templates for different injection points
    When I inject imports, middleware, and routes
    Then all injections should succeed
    And the file structure should remain intact
    And no injection should interfere with others

  Scenario: Atomic file operations prevent corruption
    Given I have a target file that is being read by another process
    When I perform an injection operation
    Then the operation should either succeed completely or fail completely
    And the original file should never be left in a corrupted state
    And temporary files should be cleaned up automatically

  Scenario: Concurrent injection safety
    Given I have multiple templates targeting the same file
    When I run multiple injection operations simultaneously
    Then the operations should be serialized properly
    And no race conditions should occur
    And the final file should contain all expected changes
    And the file should remain syntactically valid

  Scenario: Rollback on injection failure
    Given I have a target file "src/config.ts"
    And I have an injection template with invalid syntax
    When the injection operation fails
    Then the original file should be restored
    And no partial changes should remain
    And a clear error message should be provided

  Scenario: Large file injection performance
    Given I have a large target file (>1MB)
    And I have an injection template
    When I perform the injection
    Then the operation should complete in under 2 seconds
    And memory usage should remain reasonable
    And the file should be processed correctly

  Scenario: Binary file safety
    Given I have a binary file in the target directory
    And I have a template that might target it
    When I attempt injection
    Then the system should detect the binary file
    And refuse to perform injection
    And provide a clear warning message

  Scenario: Permission handling
    Given I have a read-only target file
    When I attempt injection
    Then the system should handle the permission error gracefully
    And provide a clear error message
    And suggest how to fix the permission issue

  Scenario: Backup and restore functionality
    Given I have injection with backup enabled
    When I perform the injection
    Then a backup file should be created
    And the backup should contain the original content
    When I need to restore
    Then the original content should be recoverable
    And the backup should be properly cleaned up

  Scenario: Injection with complex skipIf conditions
    Given I have a template with complex skipIf logic:
      """
      ---
      skipIf: "<%= name === 'admin' && existing.includes('adminRoutes') %>"
      ---
      """
    When I inject with various conditions
    Then the skipIf logic should be evaluated correctly
    And injections should only occur when conditions are met
    And the evaluation should have access to file context