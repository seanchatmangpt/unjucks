@smoke @example
Feature: Example Cucumber Feature with Best Practices
  As a developer
  I want to demonstrate cucumber best practices
  So that the team can follow consistent patterns

  Background:
    Given I have an empty workspace
    And I have a templates directory at "_templates"

  @smoke @critical
  Scenario: Simple generator creation
    Given I have a generator "component" with action "new"
    And I have a template file "_templates/component/new/index.tsx.ejs" with content:
      """
      ---
      to: src/components/<%= name %>/index.tsx
      ---
      import React from 'react';

      export interface <%= h.changeCase.pascalCase(name) %>Props {
        title?: string;
      }

      export const <%= h.changeCase.pascalCase(name) %> = ({ title }: <%= h.changeCase.pascalCase(name) %>Props) => {
        return <div>{title || '<%= name %>'}</div>;
      };
      """
    When I run "unjucks generate component --name Button"
    Then the command should succeed
    And the file "src/components/Button/index.tsx" should exist
    And the file "src/components/Button/index.tsx" should contain "export const Button"

  @regression
  Scenario Outline: Generate multiple file types
    Given I have a generator "<generator>" with template files:
      | template     | content                           |
      | new.js.ejs   | // JavaScript <%= name %>         |
      | new.ts.ejs   | // TypeScript <%= name %>         |
      | new.jsx.ejs  | // React JSX <%= name %>          |
    When I run "unjucks generate <generator> --name <name>"
    Then the command should succeed
    And the file "<output>" should exist

    Examples:
      | generator | name       | output                |
      | util      | DateUtils  | src/utils/DateUtils.js |
      | service   | APIService | src/services/APIService.js |
      | hook      | useAuth    | src/hooks/useAuth.js |

  @integration @performance
  Scenario: Generate with injection mode
    Given I have a target file "src/routes/index.ts" with content:
      """
      const routes = [
        // INJECT ROUTES HERE
      ];
      export default routes;
      """
    And I have an injection template "route" that:
      | config                        | body                                    |
      | inject: true\nafter: // INJECT ROUTES HERE | { path: '/<%= name %>', component: <%= h.changeCase.pascalCase(name) %> }, |
    When I run injection for template "route" with variables:
      | name | profile |
    Then the content should be injected after line containing "// INJECT ROUTES HERE"
    And the file "src/routes/index.ts" should contain "{ path: '/profile', component: Profile }"

  @wip
  Scenario: Complex data table usage
    Given I have the following files:
      | file            | content                |
      | src/index.js    | console.log('main');   |
      | src/utils.js    | export const utils = {};|
      | test/test.js    | describe('test', () => {}); |
    And I have generators in different directories:
      | path                | template    |
      | _templates/api      | new.js.ejs  |
      | _templates/model    | new.ts.ejs  |
      | _templates/view     | new.jsx.ejs |
    When I list all available generators
    Then I should see the following generators listed:
      | generator | path              |
      | api       | _templates/api    |
      | model     | _templates/model  |
      | view      | _templates/view   |

  @security
  Scenario: Validate input sanitization
    When I run "unjucks generate ../../../etc/passwd --name test"
    Then the command should fail
    And the error output should contain "Invalid generator path"

  @performance
  Scenario: Performance constraint validation
    Given I have a generator "large" with 100 template files
    When I run "unjucks generate large --name Test"
    Then the command should complete within 5 seconds
    And all template files should be processed