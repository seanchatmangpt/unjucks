@cas @storage @v1 @blake3
Feature: Content Addressed Storage with BLAKE3
  As a KGEN user
  I want content addressed storage using BLAKE3 hashing
  So that I can achieve deduplication, integrity verification, and efficient storage

  Background:
    Given I have a clean workspace
    And KGEN CAS is properly initialized
    And BLAKE3 hashing is enabled

  @cas @basic @critical
  Scenario: Store content with BLAKE3 hash addressing
    Given I have content "Hello, KGEN CAS World!"
    When I store the content in CAS
    Then the content should be stored with BLAKE3 hash as address
    And the hash should be "blake3:2cf24dba4f21d4288094c56de0e5c2ee0b0e8c9e88c6bfc6e19c48a9f8b0f9ac"
    And I should be able to retrieve content by hash
    And retrieved content should match original content exactly

  @cas @deduplication @critical
  Scenario: Automatic content deduplication
    Given I have identical content in multiple sources:
      | source    | content                |
      | file1.txt | "Duplicate content"   |
      | file2.txt | "Duplicate content"   |
      | file3.txt | "Duplicate content"   |
    When I store all sources in CAS
    Then only one copy should be stored physically
    And all sources should reference the same BLAKE3 hash
    And storage space should be optimized through deduplication
    And retrieval should work for all source references

  @cas @integrity @critical
  Scenario: Content integrity verification with BLAKE3
    Given I have stored content with hash "blake3:abc123..."
    When I retrieve the content by hash
    Then the retrieved content hash should match the stored hash
    And BLAKE3 verification should pass
    And any corruption should be detected and reported
    And retrieval should fail gracefully for corrupted content

  @cas @metadata
  Scenario: Store and retrieve content metadata
    Given I have content with metadata:
      | content    | Hello World          |
      | mime_type  | text/plain          |
      | encoding   | utf-8               |
      | size       | 11                  |
      | timestamp  | 2024-01-01T00:00:00Z |
    When I store the content with metadata in CAS
    Then metadata should be stored alongside content
    And metadata should be retrievable by content hash
    And metadata should include BLAKE3 hash verification
    And metadata should be immutable

  @cas @large-files
  Scenario: Handle large file storage efficiently
    Given I have a large file (10MB) with known content
    When I store the large file in CAS
    Then the file should be chunked appropriately
    And each chunk should have its own BLAKE3 hash
    And the file should have a root BLAKE3 hash
    And retrieval should reconstruct the file correctly
    And memory usage should be bounded during operation

  @cas @concurrent
  Scenario: Concurrent storage operations
    Given I have multiple threads storing content simultaneously
    When 10 threads store different content concurrently
    Then all storage operations should complete successfully
    And no race conditions should occur
    And each content should have correct BLAKE3 hash
    And retrieval should work correctly for all stored content
    And storage integrity should be maintained

  @cas @garbage-collection
  Scenario: CAS garbage collection and cleanup
    Given I have stored content that is no longer referenced
    When I trigger CAS garbage collection
    Then unreferenced content should be identified
    And cleanup should preserve referenced content
    And storage space should be reclaimed
    And BLAKE3 hash index should be updated correctly

  @cas @compression
  Scenario: Content compression in CAS
    Given I have compressible content
    When I store the content with compression enabled
    Then the content should be compressed before hashing
    And BLAKE3 hash should be computed on compressed content
    And retrieval should automatically decompress
    And original content should be restored exactly

  @cas @versioning
  Scenario: Content versioning with CAS
    Given I have content that evolves over time:
      | version | content           |
      | v1      | "Initial content" |
      | v2      | "Updated content" |
      | v3      | "Final content"   |
    When I store each version in CAS
    Then each version should have unique BLAKE3 hash
    And all versions should be independently retrievable
    And version history should be maintained
    And no version should overwrite another

  @cas @cross-reference
  Scenario: Cross-reference resolution in CAS
    Given I have content that references other CAS content
    When I store content with CAS references:
      | content_type | content                           |
      | main         | "See blake3:def456... for details" |
      | referenced   | "This is the referenced content"   |
    Then references should be resolved correctly
    And circular references should be detected and handled
    And reference integrity should be maintained
    And reference chains should be followable

  @cas @import-export
  Scenario: CAS import and export functionality
    Given I have a populated CAS store
    When I export the CAS store
    Then all content should be exported with hashes
    And metadata should be included in export
    And BLAKE3 hashes should be preserved
    And import should restore exact CAS state
    And imported content should be bit-identical

  @cas @performance
  Scenario: CAS performance benchmarks
    Given I have 1000 files of varying sizes
    When I store all files in CAS within time limit
    Then storage should complete within 30 seconds
    And BLAKE3 hashing should be performant
    And concurrent operations should not degrade performance significantly
    And memory usage should remain bounded
    And storage efficiency should meet target ratios

  @cas @recovery
  Scenario: CAS recovery from corruption
    Given I have a CAS store with some corrupted content
    When I run CAS integrity check
    Then corrupted content should be identified
    And BLAKE3 verification should detect corruption
    And recovery options should be provided
    And healthy content should remain accessible
    And corruption should be isolated and contained

  @cas @network
  Scenario: Network-based CAS operations
    Given I have a remote CAS store
    When I store content to remote CAS
    Then content should be transferred securely
    And BLAKE3 hash should be verified after transfer
    And network failures should be handled gracefully
    And partial transfers should be resumable
    And local caching should optimize repeated access

  @cas @encryption
  Scenario: Encrypted content in CAS
    Given I have sensitive content requiring encryption
    When I store encrypted content in CAS
    Then content should be encrypted before hashing
    And BLAKE3 hash should be computed on encrypted content
    And decryption should be handled transparently on retrieval
    And encryption keys should be managed securely
    And encrypted content should be indistinguishable in CAS

  @cas @audit
  Scenario: CAS audit trail and logging
    Given I have CAS operations occurring over time
    When I generate an audit report
    Then all storage operations should be logged
    And BLAKE3 hashes should be audit-verifiable
    And access patterns should be trackable
    And integrity violations should be recorded
    And audit log should be tamper-evident