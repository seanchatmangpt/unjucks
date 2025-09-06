@injection @validation @comprehensive
Feature: HYGEN-DELTA File Injection Validation  
  As a developer using Unjucks
  I want to validate all file injection claims in HYGEN-DELTA.md
  So that I can verify superior file operation capabilities

  Background:
    Given I have a clean test workspace
    And the Unjucks CLI is available

  @atomic-operations @validation
  Scenario: Atomic file operations with backup creation
    Given I have an existing file "src/index.ts" with content:
      """
      // Main index file
      export const version = '1.0.0';
      """
    When I inject content using Unjucks
    Then a backup file should be created before modification
    And the operation should be atomic (all-or-nothing)
    And if the operation fails, the original file should be restored

  @idempotent-operations @validation  
  Scenario: Idempotent operations prevent duplicate content
    Given I have an existing file "src/components/index.ts" with:
      """
      export * from './Button';
      """
    And I have a template that injects:
      """
      export * from './Card';
      """
    When I run the injection multiple times
    Then the content should only be added once
    And subsequent runs should detect existing content
    And no duplicate entries should be created

  @six-injection-modes @validation
  Scenario: All 6 injection modes work correctly
    Given I have an existing file "test.txt" with content:
      """
      Line 1
      Line 2  
      Line 3
      Line 4
      Line 5
      """
    When I test each injection mode:
      | Mode      | Target/Config | Expected Result              |
      | write     | overwrite     | Replace entire file          |
      | inject    | after Line 2  | Insert after Line 2          |
      | append    | true          | Add at end of file           |
      | prepend   | true          | Add at start of file         |
      | lineAt    | 3             | Insert at line 3             |
      | conditional| skipIf expr  | Conditional injection        |
    Then each mode should work as specified
    And the operations should be safe and reversible

  @enhanced-injection @validation
  Scenario: Enhanced injection with complex targeting
    Given I have a file with various injection targets:
      """
      import React from 'react';
      
      // Components
      export const Button = () => <button />;
      
      // Hooks
      export const useCounter = () => {};
      
      // Types
      export type User = { name: string };
      """
    When I inject content with sophisticated targeting:
      | Target Type    | Pattern           | Content                  |
      | before         | // Types          | // Interfaces            |
      | after          | // Components     | export const Card = ...; |
      | regex          | /export const/    | // Added component        |
      | line number    | 5                 | // Injected at line 5    |
    Then the content should be injected precisely
    And existing code structure should be preserved

  @file-permissions @validation
  Scenario: File permissions and chmod support
    Given I have a template with chmod frontmatter:
      """
      ---
      to: "scripts/{{ name }}.sh"
      chmod: "755"
      ---
      #!/bin/bash
      echo "{{ message }}"
      """
    When I generate the file
    Then the file should be created with correct permissions (755)
    And the chmod operation should work cross-platform
    And permission changes should be logged

  @dry-run-preview @validation
  Scenario: Dry-run mode provides accurate previews
    Given I have existing files that would be modified
    When I run operations with --dry flag
    Then I should see a detailed preview of changes:
      | File           | Operation | Content Preview        |
      | src/index.ts   | inject    | + export * from './';  |
      | package.json   | append    | + "newScript": "..."   |
      | README.md      | prepend   | + # New section        |
    And no actual file modifications should occur
    And the preview should be 100% accurate

  @error-handling @validation
  Scenario: Comprehensive error handling and recovery
    When I attempt operations with various error conditions:
      | Error Condition       | Expected Handling              |
      | File not found        | Create directory structure     |
      | Permission denied     | Clear error with suggestions   |
      | Disk space full       | Graceful failure with cleanup  |
      | Invalid regex pattern | Helpful error with examples    |
      | Circular injection    | Detect and prevent infinite loop|
    Then each error should be handled gracefully
    And helpful error messages should be provided
    And the system should remain in a consistent state

  @performance-benchmarks @validation
  Scenario: File operations meet performance standards
    Given I have 100 files to be modified simultaneously
    When I run batch injection operations
    Then file operations should complete within performance targets:
      | Operation    | Target Time | Memory Usage |
      | Single inject| < 15ms      | < 5MB        |
      | Batch inject | < 100ms     | < 20MB       |
      | Large file   | < 50ms      | < 10MB       |
    And memory usage should remain efficient
    And operations should scale linearly

  @safety-validation @validation
  Scenario: Advanced safety features prevent data loss
    Given I have important files that shouldn't be corrupted
    When I run generation operations
    Then safety features should activate:
      | Safety Feature        | Expected Behavior              |
      | Backup creation       | Original files backed up       |
      | Atomic operations     | All-or-nothing modifications   |
      | Validation checks     | Content validated before write |
      | Recovery procedures   | Failed operations rolled back  |
      | Conflict detection    | Merge conflicts identified     |
    And data integrity should be maintained throughout

  @hygen-comparison @validation
  Scenario: Unjucks file operations exceed Hygen capabilities
    Given I have equivalent operations in both systems
    When I compare the capabilities:
      | Feature               | Hygen | Unjucks | Advantage     |
      | Injection modes       | 3     | 6       | 2x more modes |
      | Atomic operations     | No    | Yes     | Data safety   |
      | Idempotent operations | No    | Yes     | Reliability   |
      | Error handling        | Basic | Advanced| Better UX     |
      | Dry run preview       | No    | Yes     | Preview       |
    Then Unjucks should demonstrate superior capabilities
    And all Hygen functionality should be preserved or enhanced