@smoke
Feature: BDD Infrastructure Validation
  As a QA engineer
  I want to verify that the BDD testing infrastructure works
  So that I can trust the test suite

  @smoke
  Scenario: Basic assertion works
    Given I have a working test environment
    When I run a basic assertion
    Then it should pass successfully

  @smoke  
  Scenario: Node environment is accessible
    Given I have access to Node.js environment
    When I check the Node version
    Then it should return a valid version string

  @smoke
  Scenario: File system access works
    Given I have file system access
    When I check if package.json exists
    Then it should be found in the current directory