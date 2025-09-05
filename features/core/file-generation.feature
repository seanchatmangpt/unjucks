@core @generation @file-operations @smoke
Feature: File Generation from Templates
  As a developer using Unjucks
  I want to generate files from templates with variable substitution
  So that I can quickly scaffold consistent code structures

  Background:
    Given I have a clean test workspace
    And I have a generator "react-component" with template:
      """
      ---
      to: src/components/{{name}}.tsx
      ---
      import React from 'react';

      {% if withProps %}
      interface {{name}}Props {
        // Add your props here
      }

      export const {{name}}: React.FC<{{name}}Props> = (props) => {
      {% else %}
      export const {{name}}: React.FC = () => {
      {% endif %}
        return (
          <div className="{{name | lower}}">
            <h1>{{name}} Component</h1>
            {% if withProps %}
            {/* Props: {JSON.stringify(props)} */}
            {% endif %}
          </div>
        );
      };

      export default {{name}};
      """

  @basic-generation
  Scenario: Generate basic React component
    When I run "unjucks generate react-component --name UserProfile"
    Then the file "src/components/UserProfile.tsx" should be created
    And the file should contain "export const UserProfile: React.FC"
    And the file should contain 'className="userprofile"'
    And the exit code should be 0

  @variables-substitution
  Scenario: Generate component with props interface
    When I run "unjucks generate react-component --name UserCard --withProps true"
    Then the file "src/components/UserCard.tsx" should contain:
      """
      interface UserCardProps {
        // Add your props here
      }

      export const UserCard: React.FC<UserCardProps> = (props) => {
      """
    And the file should contain "Props: {JSON.stringify(props)}"

  @conditional-rendering
  Scenario: Generate component without props interface
    When I run "unjucks generate react-component --name SimpleButton --withProps false"
    Then the file "src/components/SimpleButton.tsx" should contain:
      """
      export const SimpleButton: React.FC = () => {
      """
    And the file should not contain "interface"
    And the file should not contain "Props:"

  @custom-destination
  Scenario: Generate files to custom destination
    When I run "unjucks generate react-component --name Header --dest ./custom/path"
    Then the file "custom/path/components/Header.tsx" should be created
    And the file should contain "export const Header"

  @dry-run-mode
  Scenario: Preview generation without creating files
    When I run "unjucks generate react-component --name TestComponent --dry-run"
    Then I should see "Preview: Would create src/components/TestComponent.tsx"
    And I should see the generated file content in the output
    And the file "src/components/TestComponent.tsx" should not exist
    And the exit code should be 0

  @force-overwrite
  Scenario: Overwrite existing files with force flag
    Given the file "src/components/ExistingComponent.tsx" exists with content:
      """
      // Old component content
      export const ExistingComponent = () => <div>Old</div>;
      """
    When I run "unjucks generate react-component --name ExistingComponent --force"
    Then the file "src/components/ExistingComponent.tsx" should be overwritten
    And the file should contain "export const ExistingComponent: React.FC"
    And the file should not contain "Old component content"

  @no-force-protection  
  Scenario: Protect existing files without force flag
    Given the file "src/components/ExistingComponent.tsx" exists
    When I run "unjucks generate react-component --name ExistingComponent"
    Then I should see "File already exists: src/components/ExistingComponent.tsx"
    And I should see "Use --force to overwrite"
    And the original file should remain unchanged
    And the exit code should be 1

  @multiple-templates
  Scenario: Generate multiple files from single generator
    Given I have a generator "full-component" with multiple templates:
      | component.tsx.njk | Component implementation |
      | index.ts.njk     | Export index file        |
      | types.ts.njk     | TypeScript types         |
    When I run "unjucks generate full-component --name UserService"
    Then the following files should be created:
      | src/components/UserService.tsx |
      | src/components/index.ts        |  
      | src/components/types.ts        |

  @variable-validation
  Scenario: Validate required variables
    When I run "unjucks generate react-component"
    Then I should see "Missing required variable: name"
    And I should see usage examples
    And the exit code should be 1

  @variables-file
  Scenario: Load variables from JSON file
    Given I have a variables file "component-vars.json":
      """
      {
        "name": "UserDashboard",
        "withProps": true,
        "author": "Development Team"
      }
      """
    When I run "unjucks generate react-component --variables-file component-vars.json"
    Then the file "src/components/UserDashboard.tsx" should be created
    And the file should contain "interface UserDashboardProps"

  @environment-variables
  Scenario: Use environment variables in templates
    Given I set environment variable "AUTHOR_NAME" to "Jane Developer"
    And I have a template with "// Author: {{env.AUTHOR_NAME}}"
    When I run "unjucks generate react-component --name EnvComponent"
    Then the generated file should contain "// Author: Jane Developer"

  @nested-directories
  Scenario: Generate files in nested directory structure
    Given I have a generator with path "src/features/{{feature}}/components/{{name}}.tsx"
    When I run "unjucks generate react-component --name UserCard --feature authentication"
    Then the file "src/features/authentication/components/UserCard.tsx" should be created
    And all intermediate directories should exist

  @binary-file-handling
  Scenario: Handle binary template files appropriately
    Given I have a generator with binary template files (images, fonts)
    When I run "unjucks generate assets-bundle --name brand-assets"
    Then binary files should be copied without template processing
    And file integrity should be maintained
    And proper file permissions should be set

  @large-template-performance
  Scenario: Handle large templates efficiently
    Given I have a template with 1000+ lines
    When I run "unjucks generate large-template --name BigComponent"
    Then the generation should complete within 5 seconds
    And memory usage should remain under 100MB
    And the generated file should be complete and valid

  @concurrent-generation
  Scenario: Handle concurrent generation requests safely
    When I run multiple "unjucks generate" commands simultaneously:
      | react-component --name Component1 |
      | react-component --name Component2 |  
      | react-component --name Component3 |
    Then all commands should complete successfully
    And no file corruption should occur
    And all generated files should be valid