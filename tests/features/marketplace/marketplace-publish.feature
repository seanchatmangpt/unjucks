Feature: Marketplace Publishing
  As a KPack creator
  I want to publish my KPacks to the marketplace
  So that others can discover and use my knowledge packages

  Background:
    Given the marketplace is available
    And I have valid authentication credentials
    And I have a complete KPack with metadata

  @smoke @publish
  Scenario: Successfully publish a valid KPack
    Given I have a KPack named "data-visualization-toolkit"
    And the KPack has valid metadata including:
      | field       | value                    |
      | name        | data-visualization-toolkit |
      | version     | 1.0.0                   |
      | description | Advanced data viz tools  |
      | author      | test@example.com        |
      | license     | MIT                     |
    And the KPack includes required attestations
    When I publish the KPack to the marketplace
    Then the KPack should be published successfully
    And I should receive a publication confirmation
    And the KPack should be findable in search results
    And the publish time should be less than 5 seconds

  @security @cryptography
  Scenario: Reject KPack with invalid cryptographic signatures
    Given I have a KPack named "malicious-package"
    And the KPack has tampered cryptographic signatures
    When I attempt to publish the KPack
    Then the publication should be rejected
    And I should receive an error message containing "Invalid cryptographic signature"
    And the KPack should not appear in marketplace listings

  @validation @metadata
  Scenario: Reject KPack with missing required metadata
    Given I have a KPack named "incomplete-package"
    And the KPack is missing required metadata:
      | missing_field |
      | version       |
      | description   |
      | license       |
    When I attempt to publish the KPack
    Then the publication should be rejected
    And I should receive validation errors for missing fields
    And the KPack should not be published

  @versioning
  Scenario: Publish new version of existing KPack
    Given I have previously published a KPack named "analytics-tools" version "1.0.0"
    And I have an updated version "1.1.0" with new features
    And the new version has valid cryptographic attestations
    When I publish the updated KPack
    Then both versions should be available in the marketplace
    And the latest version should be marked as current
    And users should be able to access previous versions

  @performance @load
  Scenario: Publish multiple KPacks concurrently
    Given I have 10 valid KPacks ready for publication
    When I publish all KPacks simultaneously
    Then all KPacks should be published successfully
    And each publication should complete within 5 seconds
    And the marketplace should handle concurrent publications without conflicts

  @facets @categorization
  Scenario: Publish KPack with multiple facets
    Given I have a KPack named "ml-pipeline-toolkit"
    And the KPack has the following facets:
      | facet_type   | facet_value           |
      | category     | machine-learning      |
      | category     | data-processing       |
      | technology   | python               |
      | technology   | tensorflow           |
      | difficulty   | advanced             |
      | use_case     | computer-vision      |
    When I publish the KPack
    Then the KPack should be categorized under all specified facets
    And it should be discoverable through faceted search

  @pricing @monetization
  Scenario: Publish premium KPack with pricing
    Given I have a KPack named "enterprise-analytics"
    And I set the pricing model to "subscription"
    And I set the price to "$29.99/month"
    And I configure payment policies
    When I publish the KPack
    Then the KPack should be listed with pricing information
    And payment integration should be enabled
    And trial access should be configured according to policies

  @error-handling
  Scenario: Handle publication failures gracefully
    Given the marketplace registry is temporarily unavailable
    And I have a valid KPack ready for publication
    When I attempt to publish the KPack
    Then I should receive a clear error message about service unavailability
    And the KPack should be queued for retry
    And I should be notified when the service is restored