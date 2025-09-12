Feature: Office Document Deterministic Output
  As a developer using KGEN
  I want Office documents to be generated deterministically
  So that I can ensure reproducible builds and consistent version control

  Background:
    Given KGEN is configured for deterministic output
    And OPC normalization is enabled
    And document generation settings are standardized

  Scenario: Generate identical documents from same inputs
    Given I have a Word template "report.docx"
    And I have identical input data:
      | field     | value         |
      | title     | Monthly Report |
      | date      | 2024-03-15    |
      | author    | System        |
    When I generate the document twice with identical inputs
    Then both generated documents should have identical binary content
    And the file checksums should match exactly
    And the creation timestamps should be normalized
    And the document structure should be identical

  Scenario: Apply OPC normalization to Office documents
    Given I have Office templates with varying internal structures
    And the templates contain:
      | element type        | variation source           |
      | XML declarations    | different encoding orders  |
      | namespace prefixes  | arbitrary prefix names     |
      | element ordering    | non-deterministic order    |
      | whitespace         | inconsistent formatting    |
    When I generate documents with OPC normalization
    Then XML elements should be in canonical order
    And namespace prefixes should be standardized
    And whitespace should be normalized
    And the internal ZIP structure should be consistent
    And documents should have reproducible binary output

  Scenario: Normalize document metadata for consistency
    Given I have Office templates with metadata
    And the system has varying environment conditions:
      | condition      | variation                    |
      | timestamps     | different generation times   |
      | system info    | different machine details    |
      | user context   | different user accounts      |
      | app versions   | different Office versions    |
    When I generate documents with metadata normalization
    Then creation timestamps should use a fixed reference time
    And last modified timestamps should be normalized
    And system-specific metadata should be standardized
    And application version info should be consistent
    And revision numbers should start from a fixed value

  Scenario: Ensure consistent ZIP compression in Office files
    Given I have Office documents that are internally ZIP files
    And the ZIP compression can vary based on:
      | factor           | variation source        |
      | compression algo | different ZIP libraries |
      | file order      | non-deterministic order |
      | timestamps      | file modification times |
      | attributes      | system-specific attrs   |
    When I generate documents with ZIP normalization
    Then files within the ZIP should be in sorted order
    And compression settings should be standardized
    And file timestamps should be normalized
    And file attributes should be consistent
    And the ZIP directory structure should be identical

  Scenario: Handle embedded content deterministically
    Given I have Office templates with embedded content:
      | content type    | embedded element      |
      | images         | PNG, JPEG files       |
      | charts         | Excel chart objects   |
      | tables         | formatted data tables |
      | equations      | mathematical formulas |
    And the embedded content has metadata and timestamps
    When I generate documents with embedded content normalization
    Then embedded images should have normalized metadata
    And chart objects should have consistent internal IDs
    And table formatting should be deterministic
    And equation rendering should be reproducible
    And all embedded timestamps should be normalized

  Scenario: Generate documents across different platforms consistently
    Given I have the same template and data
    And I generate documents on different platforms:
      | platform    | environment details     |
      | Windows     | Windows 11, .NET 6     |
      | macOS       | macOS 14, Mono runtime |
      | Linux       | Ubuntu 22, .NET 6      |
    When I generate documents on each platform
    Then all generated documents should be binary identical
    And platform-specific paths should be normalized
    And line endings should be consistent
    And file permissions should be standardized
    And character encoding should be uniform

  Scenario: Validate reproducible build integrity
    Given I have a complete document generation pipeline
    And I run the generation process multiple times
    When I generate documents in different sessions:
      | session | conditions                    |
      | 1       | Clean environment, first run  |
      | 2       | Same environment, second run  |
      | 3       | Different time, same inputs   |
      | 4       | Restarted application         |
    Then all document outputs should be identical
    And checksums should match across all sessions
    And file sizes should be exactly the same
    And internal document IDs should be consistent
    And the generation should be fully reproducible

  Scenario: Test determinism with complex document structures
    Given I have templates with complex internal structures:
      | structure type     | complexity factor           |
      | relationships      | cross-references, hyperlinks |
      | styles            | cascading style definitions  |
      | sections          | multiple document parts      |
      | numbering         | automatic numbering systems  |
    And I generate documents with these complex structures
    When I apply deterministic processing
    Then relationship IDs should be consistent
    And style definitions should have stable ordering
    And section numbering should be reproducible
    And cross-references should resolve identically
    And all internal linkages should be deterministic

  Scenario: Measure and validate performance of deterministic generation
    Given I have performance benchmarks for document generation
    And I measure generation with and without determinism:
      | mode                | measurement focus     |
      | standard generation | baseline performance  |
      | deterministic mode  | performance overhead  |
    When I run performance comparisons
    Then deterministic generation should complete within 120% of baseline time
    And memory usage should not exceed 150% of baseline
    And the deterministic output should maintain quality
    And performance degradation should be acceptable
    And the reproducibility benefits should justify the cost

  Scenario: Handle edge cases in deterministic processing
    Given I have edge case scenarios:
      | edge case                | description                     |
      | empty documents         | templates with no content       |
      | maximum content         | documents at size limits        |
      | special characters      | Unicode, symbols, emojis        |
      | corrupted templates     | templates with minor corruption  |
    When I apply deterministic processing to edge cases
    Then empty documents should generate consistently
    And large documents should maintain determinism
    And special characters should be handled reproducibly
    And error handling should be deterministic
    And edge cases should not break the deterministic pipeline

  Scenario: Verify deterministic output with version control
    Given I have Office documents in a version control system
    And I regenerate documents from the same source
    When I check the version control diff
    Then there should be no changes detected
    And the git status should show no modifications
    And binary comparison should show identical files
    And commit hashes should remain stable for unchanged inputs
    And version control integration should work seamlessly with deterministic output