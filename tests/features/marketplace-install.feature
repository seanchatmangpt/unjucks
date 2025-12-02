@marketplace @install @verification @cas @v1
Feature: Marketplace Template Installation with Verification and CAS
  As a KGEN user
  I want to install templates from marketplace with verification and CAS storage
  So that I can use trusted, verified templates stored efficiently

  Background:
    Given I have a clean workspace
    And marketplace client is configured
    And CAS storage is enabled
    And cryptographic verification is enabled

  @install @verification @critical
  Scenario: Install template with signature verification
    Given a template "react-components" is published in marketplace
    And the template package is cryptographically signed
    When I install the template using "kgen install react-components"
    Then the package signature should be verified before installation
    And signature verification should use author's public key
    And installation should fail if signature is invalid
    And verified content should proceed to CAS storage
    And installation success should be confirmed

  @install @cas-integration @critical
  Scenario: Store installed templates in CAS
    Given I install a template from marketplace
    When the installation completes successfully
    Then template files should be stored in CAS with BLAKE3 hashes
    And duplicate content should be deduplicated automatically
    And template metadata should be stored in CAS
    And CAS integrity should be maintained
    And template should be retrievable by content hash

  @install @version-management
  Scenario: Install specific template versions
    Given a template "api-scaffold" has multiple versions:
      | version | status    | published_date |
      | 1.0.0   | stable    | 2024-01-01    |
      | 1.1.0   | stable    | 2024-02-01    |
      | 2.0.0   | beta      | 2024-03-01    |
      | 2.0.1   | stable    | 2024-03-15    |
    When I install using version specifiers:
      | command                              | expected_version |
      | kgen install api-scaffold           | 2.0.1           |
      | kgen install api-scaffold@1.1.0     | 1.1.0           |
      | kgen install api-scaffold@^1.0.0    | 1.1.0           |
      | kgen install api-scaffold@~2.0.0    | 2.0.1           |
    Then the correct version should be installed
    And version resolution should follow semantic versioning
    And installed version should be recorded in workspace

  @install @dependency-resolution
  Scenario: Resolve and install template dependencies
    Given I install a template "full-stack-app" with dependencies:
      | dependency        | version_spec | required |
      | base-layout      | ^2.0.0      | true     |
      | auth-middleware  | ~1.5.0      | true     |
      | ui-components    | *           | false    |
    When installation processes dependencies
    Then required dependencies should be resolved and installed
    And dependency versions should satisfy constraints
    And optional dependencies should be installed if available
    And dependency conflicts should be resolved automatically
    And full dependency tree should be recorded

  @install @integrity-verification
  Scenario: Verify package integrity during installation
    Given a template package in marketplace has known checksums
    When I download and install the template
    Then package checksum should be verified against published hash
    And individual file checksums should be verified
    And BLAKE3 hashes should be computed and verified
    And any integrity failures should halt installation
    And corrupted packages should be rejected with clear errors

  @install @caching
  Scenario: Cache downloaded packages efficiently
    Given I install multiple templates from marketplace
    When packages are downloaded
    Then packages should be cached locally after first download
    And cached packages should be verified before use
    And cache should be invalidated when packages are updated
    And cache storage should use CAS for deduplication
    And cache size should be manageable and configurable

  @install @offline-mode
  Scenario: Install templates in offline mode
    Given I have previously cached templates
    When network is unavailable
    And I attempt to install cached templates
    Then installation should succeed using cached packages
    And cache integrity should be verified
    And offline installation should be clearly indicated
    And missing templates should provide helpful error messages

  @install @workspace-integration
  Scenario: Integrate installed templates with workspace
    Given I install templates into a KGEN workspace
    When installation completes
    Then templates should be available for generation
    And template discovery should find installed templates
    And workspace configuration should be updated
    And template metadata should be accessible
    And installed templates should be listed in workspace manifest

  @install @security-scanning
  Scenario: Security scan during template installation
    Given I install a template from marketplace
    When security scanning is performed
    Then template content should be scanned for malicious patterns
    And external dependencies should be validated
    And script content should be analyzed for security risks
    And security warnings should be presented to user
    And installation should be blockable based on security policy

  @install @update-management
  Scenario: Update installed templates
    Given I have installed templates that have newer versions
    When I check for updates using "kgen update"
    Then available updates should be identified
    And update compatibility should be assessed
    And breaking changes should be highlighted
    And updates should be installable selectively
    And update history should be maintained

  @install @rollback
  Scenario: Rollback template installations
    Given I have installed a template that causes issues
    When I rollback using "kgen rollback react-components@1.2.0"
    Then the previous version should be restored
    And workspace state should be reverted
    And CAS should maintain both versions
    And rollback should be atomic and safe
    And rollback history should be tracked

  @install @performance
  Scenario: Installation performance optimization
    Given I install multiple large templates
    When installation processes run
    Then downloads should be parallelized when possible
    And CAS storage should be efficient
    And installation progress should be tracked and reported
    And large templates should not cause memory issues
    And installation should complete within reasonable time

  @install @conflict-resolution
  Scenario: Handle template naming conflicts
    Given I attempt to install templates with conflicting names
    When conflicts are detected
    Then naming conflicts should be identified clearly
    And resolution options should be provided
    And templates should be installable with alternate names
    And conflict resolution should be persistent
    And user choices should be respected

  @install @licensing-compliance
  Scenario: Verify license compliance during installation
    Given templates have various license requirements
    When I install templates
    Then license compatibility should be checked
    And license terms should be presented to user
    And incompatible licenses should be flagged
    And license acceptance should be recorded
    And compliance should be trackable for audits

  @install @batch-installation
  Scenario: Install multiple templates in batch
    Given I have a list of templates to install
    When I use batch installation: "kgen install -f template-list.txt"
    Then all templates should be processed efficiently
    And dependencies should be resolved globally
    And installation order should be optimized
    And batch progress should be reported
    And partial failures should not affect successful installations

  @install @workspace-isolation
  Scenario: Install templates with workspace isolation
    Given I have multiple KGEN workspaces
    When I install templates in different workspaces
    Then templates should be isolated by workspace
    And global templates should be available across workspaces
    And workspace-specific templates should not conflict
    And template resolution should respect workspace boundaries
    And isolation should be maintained in CAS storage