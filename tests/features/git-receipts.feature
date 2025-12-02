@git @receipts @ledger @v1
Feature: Git Receipts Ledger using Git Notes
  As a KGEN user
  I want a Git-based receipts ledger using git notes
  So that I have immutable, distributed tracking of all KGEN operations

  Background:
    Given I have a clean Git repository
    And KGEN git receipts are enabled
    And git notes are properly configured

  @git-receipts @basic @critical
  Scenario: Create git receipt for generation operation
    Given I perform a template generation operation
    When the operation completes successfully
    Then a git receipt should be created using git notes
    And the receipt should be attached to the current commit
    And the receipt should contain operation metadata:
      | field           | content                             |
      | operation_type  | generate                           |
      | template_name   | template used                      |
      | timestamp       | operation completion time          |
      | user            | user who performed operation       |
      | inputs          | input files and parameters         |
      | outputs         | generated files with checksums     |
      | kgen_version    | KGEN version used                  |
    And the receipt should be cryptographically signed

  @git-receipts @ledger @critical
  Scenario: Maintain distributed receipts ledger
    Given multiple users perform KGEN operations in the repository
    When operations are performed over time:
      | user    | operation | template    | timestamp           |
      | alice   | generate  | api-base    | 2024-01-01T10:00:00Z |
      | bob     | generate  | frontend    | 2024-01-01T11:00:00Z |
      | charlie | generate  | tests       | 2024-01-01T12:00:00Z |
    Then each operation should create a git receipt
    And receipts should be distributed with git repository
    And receipts should be accessible from any clone
    And complete operation history should be reconstructible
    And receipts should survive repository operations (merge, rebase, etc.)

  @git-receipts @integrity
  Scenario: Verify receipt integrity and authenticity
    Given I have git receipts in the repository
    When I verify receipt integrity
    Then each receipt should have valid cryptographic signature
    And receipt content should be tamper-evident
    And receipt should be linked to specific git commit
    And signature should verify against author's public key
    And any tampering should be detectable

  @git-receipts @search-query
  Scenario: Search and query receipts ledger
    Given I have accumulated receipts over time
    When I query the receipts ledger:
      | query_type        | parameters                           |
      | by_user           | alice                               |
      | by_template       | api-base                            |
      | by_date_range     | 2024-01-01 to 2024-01-31           |
      | by_operation      | generate                            |
      | by_file_output    | src/controllers/UserController.js   |
    Then relevant receipts should be returned
    And search should be efficient even with many receipts
    And query results should be properly formatted
    And search should support complex query combinations

  @git-receipts @provenance
  Scenario: Track complete provenance chain through receipts
    Given I perform a series of dependent operations:
      | step | operation | template      | depends_on           |
      | 1    | generate  | base-project  | none                |
      | 2    | generate  | api-layer     | base-project output  |
      | 3    | generate  | frontend      | api-layer output     |
      | 4    | generate  | tests         | all previous outputs |
    When I trace provenance through receipts
    Then complete dependency chain should be reconstructible
    And each receipt should reference input dependencies
    And provenance graph should be complete and verifiable
    And circular dependencies should be detectable

  @git-receipts @conflicts
  Scenario: Handle git notes conflicts in distributed environment
    Given multiple users create receipts simultaneously
    When git notes conflicts occur during merge/pull
    Then conflicts should be resolvable automatically where possible
    And manual conflict resolution should be supported
    And no receipts should be lost during conflict resolution
    And conflict resolution should preserve receipt integrity

  @git-receipts @backup-recovery
  Scenario: Backup and recover receipts ledger
    Given I have a receipts ledger with significant history
    When I backup and restore the ledger
    Then all receipts should be preserved in backup
    And backup should include cryptographic signatures
    And restore should recreate complete ledger state
    And restored receipts should be verifiable
    And backup format should be portable across systems

  @git-receipts @performance
  Scenario: Receipts ledger performance with large history
    Given I have 10,000 receipts in the ledger
    When I perform receipt operations
    Then receipt creation should remain fast (< 1 second)
    And receipt queries should be efficient (< 5 seconds)
    And git repository operations should not be significantly impacted
    And memory usage should remain reasonable
    And receipt storage should scale appropriately

  @git-receipts @compliance
  Scenario: Use receipts for compliance and auditing
    Given I need to demonstrate compliance for generated code
    When auditors review the receipts ledger
    Then complete audit trail should be available
    And all operations should be traceable to specific users
    And timestamps should be verifiable and tamper-evident
    And receipts should provide non-repudiation
    And compliance reports should be generatable from receipts

  @git-receipts @migration
  Scenario: Migrate receipts between repositories
    Given I have receipts in one repository
    When I migrate to a new repository structure
    Then receipts should be exportable in portable format
    And imported receipts should maintain integrity
    And receipt signatures should remain valid after migration
    And receipt references should be updated appropriately
    And migration should be auditable through receipts

  @git-receipts @filtering
  Scenario: Filter and aggregate receipt data
    Given I have diverse receipts in the ledger
    When I apply filters and aggregations:
      | operation           | description                        |
      | filter_by_template  | show only specific template usage  |
      | aggregate_by_user   | count operations per user          |
      | group_by_date       | organize by time periods           |
      | filter_by_success   | show only successful operations    |
    Then filtered results should be accurate
    And aggregations should provide meaningful insights
    And filtering should be efficient on large datasets
    And results should be exportable for further analysis

  @git-receipts @automation
  Scenario: Automate receipt-based workflows
    Given I have receipts tracking template generations
    When automated workflows trigger based on receipts:
      | trigger_condition     | action                              |
      | new_api_generated     | trigger frontend regeneration      |
      | test_template_used    | run automated test validation       |
      | security_template     | trigger security scan               |
    Then receipt-based automation should work reliably
    And triggers should be configurable and maintainable
    And automation should not interfere with receipt integrity

  @git-receipts @analytics
  Scenario: Generate analytics from receipts data
    Given I have accumulated receipts over months of usage
    When I generate analytics reports
    Then usage patterns should be identifiable
    And template popularity should be trackable
    And user productivity metrics should be available
    And trend analysis should be possible
    And analytics should guide template improvement decisions

  @git-receipts @security
  Scenario: Secure receipts against tampering and unauthorized access
    Given I have sensitive operations recorded in receipts
    When security measures are applied
    Then receipts should be cryptographically protected
    And access controls should be enforceable
    And sensitive data should be appropriately redacted
    And security auditing should be built into receipt system
    And unauthorized modifications should be prevented

  @git-receipts @interoperability
  Scenario: Integrate receipts with external systems
    Given I need to integrate with external audit/compliance systems
    When receipts are exported for external use
    Then export format should be standardized and interoperable
    And external systems should be able to verify receipt integrity
    And API access to receipts should be available
    And integration should not compromise receipt security
    And external integrations should be documented and supported