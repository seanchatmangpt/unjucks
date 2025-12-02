Feature: Marketplace Installation
  As a developer
  I want to install KPacks from the marketplace
  So that I can integrate knowledge packages into my projects

  Background:
    Given the marketplace is available
    And I have valid authentication credentials
    And there are published KPacks available for installation

  @smoke @install
  Scenario: Successfully install a free KPack
    Given I have found a free KPack named "json-utilities"
    And the KPack has valid cryptographic signatures
    When I install the KPack
    Then the installation should complete within 2 seconds
    And the KPack should be downloaded to my local environment
    And cryptographic verification should pass
    And installation confirmation should be displayed

  @verification @cryptography
  Scenario: Install with cryptographic verification
    Given I have selected a KPack named "security-toolkit"
    And the KPack includes cryptographic attestations
    When I initiate installation
    Then the system should verify the cryptographic signatures
    And validate the attestation chain
    And confirm the publisher's identity
    And proceed with installation only if verification passes
    And the verification should complete within 2 seconds

  @dependency @resolution
  Scenario: Install KPack with dependencies
    Given I want to install a KPack named "advanced-ml-pipeline"
    And it depends on the following KPacks:
      | dependency        | version |
      | data-preprocessing | ^2.1.0  |
      | model-validation  | ~3.0.5  |
      | visualization-tools | *      |
    When I install the main KPack
    Then the system should resolve all dependencies
    And install missing dependencies automatically
    And handle version constraints correctly
    And complete the entire installation within 10 seconds

  @premium @payment
  Scenario: Install premium KPack with payment
    Given I want to install a premium KPack priced at "$19.99"
    And I have valid payment information
    When I proceed with the purchase and installation
    Then I should be prompted for payment confirmation
    And payment should be processed securely
    And the KPack should be installed after successful payment
    And I should receive a purchase receipt
    And installation should complete within 2 seconds after payment

  @trial @evaluation
  Scenario: Install KPack in trial mode
    Given there is a premium KPack with a 7-day trial period
    When I choose to install it in trial mode
    Then the KPack should be installed with trial limitations
    And trial expiration should be clearly indicated
    And I should receive notifications about trial status
    And have the option to upgrade to full version

  @version-selection @compatibility
  Scenario: Install specific version of KPack
    Given a KPack named "data-connectors" has multiple versions:
      | version | status     | compatibility |
      | 1.0.0   | deprecated | legacy        |
      | 1.5.0   | stable     | current       |
      | 2.0.0   | beta       | next          |
    When I choose to install version "1.5.0"
    Then that specific version should be installed
    And compatibility warnings should be shown if applicable
    And the installation should complete successfully

  @offline @caching
  Scenario: Install previously cached KPack offline
    Given I have previously downloaded a KPack named "offline-utilities"
    And the KPack is cached locally
    And I am currently offline
    When I attempt to install the cached KPack
    Then the installation should proceed using the cached version
    And cryptographic verification should still be performed
    And installation should complete normally

  @rollback @failure-recovery
  Scenario: Handle installation failure and rollback
    Given I am installing a KPack named "complex-integration"
    And the installation fails due to a dependency conflict
    When the installation process encounters the error
    Then the system should rollback any partial changes
    And provide a clear error message explaining the failure
    And suggest resolution steps
    And leave the system in a clean state

  @workspace @integration
  Scenario: Install KPack into specific workspace
    Given I have multiple development workspaces
    And I want to install "project-templates" into workspace "client-projects"
    When I specify the target workspace during installation
    Then the KPack should be installed in the correct workspace
    And be isolated from other workspaces
    And workspace-specific configurations should be applied

  @bulk-install @batch-operations
  Scenario: Bulk install multiple KPacks
    Given I have a list of KPacks to install:
      | kpack_name          | version |
      | testing-framework   | latest  |
      | code-quality-tools  | ^2.0.0  |
      | deployment-helpers  | 1.5.3   |
    When I initiate bulk installation
    Then all KPacks should be installed concurrently
    And installation progress should be tracked for each
    And any individual failures should not affect others
    And total installation time should be optimized

  @update @upgrade
  Scenario: Update installed KPack to newer version
    Given I have "analytics-dashboard" version "1.2.0" installed
    And version "1.3.0" is available with new features
    When I choose to update the KPack
    Then the system should preserve my current configuration
    And upgrade to the new version seamlessly
    And provide a changelog of what's new
    And allow rollback if needed

  @uninstall @cleanup
  Scenario: Uninstall KPack and cleanup
    Given I have "temporary-project-tools" installed
    And it's no longer needed in my workspace
    When I uninstall the KPack
    Then all associated files should be removed
    And dependencies should be checked for orphaned packages
    And configuration should be cleaned up
    And the uninstallation should be confirmed

  @performance @install-speed
  Scenario: Installation performance benchmarks
    Given I am installing various sizes of KPacks
    When I install KPacks of different complexities:
      | kpack_size | expected_time |
      | small      | under 1s      |
      | medium     | under 2s      |
      | large      | under 5s      |
    Then each installation should meet the performance criteria
    And progress indicators should provide accurate estimates
    And network efficiency should be optimized