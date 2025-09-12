Feature: Content-Addressed Storage
  As a KGEN system
  I want to store and retrieve content using SHA-256 hashes
  So that I can ensure content integrity and enable efficient caching

  Background:
    Given a KGEN content-addressed storage system is initialized
    And the storage backend is available

  Scenario: Store content with automatic hash generation
    Given I have content "Hello, KGEN world!"
    When I store the content in CAS
    Then the system generates a SHA-256 hash "a1b2c3d4e5f6..."
    And the content is stored at the hash-based location
    And the storage operation succeeds

  Scenario: Retrieve content by hash
    Given content "Hello, KGEN world!" is stored with hash "a1b2c3d4e5f6..."
    When I retrieve content using hash "a1b2c3d4e5f6..."
    Then I receive the original content "Hello, KGEN world!"
    And the content integrity is verified

  Scenario: Handle duplicate content storage
    Given content "Duplicate test content" is already stored with hash "def456..."
    When I attempt to store the same content again
    Then the system returns the existing hash "def456..."
    And no duplicate storage occurs
    And storage space is conserved

  Scenario: Verify content integrity with checksum validation
    Given content is stored with hash "abc123..."
    When I retrieve the content
    Then the system recalculates the SHA-256 hash
    And verifies it matches the stored hash "abc123..."
    And returns the content only if integrity check passes

  Scenario: Handle corrupted content detection
    Given content is stored with hash "corrupted123..."
    And the stored content has been corrupted
    When I retrieve content using hash "corrupted123..."
    Then the integrity check fails
    And the system raises a content corruption error
    And no corrupted content is returned

  Scenario: Store binary content efficiently
    Given I have binary content of 1MB size
    When I store the binary content in CAS
    Then the system generates a unique SHA-256 hash
    And the binary content is stored without modification
    And retrieval returns identical binary data

  Scenario: Handle large content storage
    Given I have content larger than 100MB
    When I store the large content in CAS
    Then the system processes it efficiently
    And generates the correct SHA-256 hash
    And storage completes within reasonable time limits

  Scenario: Concurrent content storage operations
    Given multiple clients want to store content simultaneously
    When 10 concurrent storage operations are initiated
    Then all operations complete successfully
    And no hash collisions occur
    And content integrity is maintained for all items

  Scenario: List stored content hashes
    Given multiple content items are stored:
      | Content           | Expected Hash Prefix |
      | "First content"   | abc123              |
      | "Second content"  | def456              |
      | "Third content"   | ghi789              |
    When I request a list of stored hashes
    Then I receive all stored content hashes
    And the hashes are properly formatted SHA-256 values

  Scenario: Remove content by hash
    Given content "Temporary content" is stored with hash "temp123..."
    When I remove content using hash "temp123..."
    Then the content is deleted from storage
    And subsequent retrieval attempts fail
    And storage space is reclaimed