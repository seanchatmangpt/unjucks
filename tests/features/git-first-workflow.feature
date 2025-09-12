Feature: Git-First Workflow for KGEN
  As a KGEN user
  I want all artifacts stored as git objects
  So that I can leverage git's immutable storage and distribution capabilities

  Background:
    Given a clean git repository
    And KGEN is initialized with git-first mode enabled
    And I have a signing key configured

  Scenario: Store generated artifact as git blob
    Given I have a template "component.tsx.njk"
    When I generate an artifact using the template
    Then the artifact should be stored as a git blob
    And the blob hash should be deterministic
    And the blob should be referenceable by hash
    And git cat-file should display the artifact content

  Scenario: Create git tree for structured artifacts
    Given I generate multiple related artifacts
    When the generation completes
    Then a git tree object should be created
    And the tree should contain all artifact blobs
    And each blob should have the correct file mode
    And the tree hash should be deterministic

  Scenario: Commit artifacts with metadata
    Given I have generated artifacts stored as git objects
    When I create a commit for the generation session
    Then the commit should reference the artifact tree
    And the commit message should include generation metadata
    And the commit should include author and timestamp
    And the commit should be signed if configured

  Scenario: Query artifacts by git hash
    Given an artifact is stored as git blob "abc123"
    When I query for blob "abc123"
    Then I should receive the original artifact content
    And the content hash should match the blob hash
    And the retrieval should be O(1) constant time

  Scenario: Verify artifact immutability
    Given an artifact stored as git blob with hash "def456"
    When I attempt to modify the blob content
    Then the operation should fail
    And the original blob should remain unchanged
    And any modification should create a new blob with different hash

  Scenario: List artifacts in chronological order
    Given multiple artifacts generated over time
    When I query the git history
    Then I should see commits in chronological order
    And each commit should show generation metadata
    And I can traverse the history using git log

  Scenario: Branch artifacts for different contexts
    Given a base set of generated artifacts
    When I generate variants for different environments
    Then each variant should be on a separate branch
    And branches should share common blob objects
    And I can merge compatible changes

  Scenario: Tag stable artifact versions
    Given a set of thoroughly tested artifacts
    When I create a release tag
    Then the tag should point to the commit with artifacts
    And the tag should include version metadata
    And I can checkout any tagged version later

  Scenario: Clone artifacts to new repository
    Given a repository with KGEN artifacts
    When I clone the repository
    Then all artifact blobs should be available
    And the complete generation history should be preserved
    And I can continue generating from any point

  Scenario: Handle large binary artifacts
    Given a template that generates large binary files
    When I generate the artifacts
    Then git should store them efficiently
    And git LFS should be used if configured
    And the artifacts should remain accessible via hash

  Scenario: Resolve git:// URI scheme
    Given an artifact stored as git blob "789abc"
    When I reference it using "git://789abc"
    Then the URI should resolve to the blob content
    And the resolution should work across repositories
    And the scheme should support tree and commit references

  Scenario: Validate git object integrity
    Given artifacts stored as git objects
    When I run git fsck
    Then all objects should pass integrity checks
    And no corruption should be detected
    And the repository should be in a consistent state