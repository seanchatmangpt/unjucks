Feature: Data Tables and Parameterized Tests
  As a developer using unjucks
  I want comprehensive examples of data tables and scenario outlines
  So that I can understand various testing patterns

  Background:
    Given I have a clean test workspace
    And I have templates in "_templates" directory

  @data-tables @examples
  Scenario: Multiple generators with data table validation
    Given I have the following generators:
      | generator | description           | variables       |
      | component | React component gen   | name,style      |
      | service   | Service class gen     | name,methods    |
      | model     | Data model gen        | name,fields     |
      | api       | API endpoint gen      | name,methods    |
    When I run "unjucks list"
    Then the output should contain the following generators:
      | name      | description           |
      | component | React component gen   |
      | service   | Service class gen     |
      | model     | Data model gen        |
      | api       | API endpoint gen      |

  @scenario-outline @examples
  Scenario Outline: Generate different components with variables
    Given I have a "component" generator with template file "Component.tsx.ejs" with content:
      """
      ---
      to: src/components/<%= name %>.tsx
      ---
      import React from 'react';
      
      interface <%= name %>Props {
        className?: string;
      }
      
      export const <%= name %>: React.FC<<%= name %>Props> = ({ className }) => {
        return (
          <div className={`<%= name.toLowerCase() %> ${className || ''}`}>
            <h1><%= title %></h1>
            <% if (withActions) { %>
            <div className="actions">
              <button>Save</button>
              <button>Cancel</button>
            </div>
            <% } %>
          </div>
        );
      };
      """
    When I run unjucks generate component with variables:
      | name       | <name>       |
      | title      | <title>      |
      | withActions| <withActions>|
    Then the file "src/components/<expectedFile>" should exist
    And the file should contain "<expectedContent>"

    Examples:
      | name        | title         | withActions | expectedFile    | expectedContent     |
      | UserProfile | User Profile  | true        | UserProfile.tsx | <h1>User Profile</h1> |
      | LoginForm   | Login Form    | true        | LoginForm.tsx   | <h1>Login Form</h1>   |
      | Dashboard   | Dashboard     | false       | Dashboard.tsx   | <h1>Dashboard</h1>    |
      | Settings    | Settings Page | true        | Settings.tsx    | <h1>Settings Page</h1>|

  @data-validation @examples
  Scenario: File generation with validation data table
    Given I have a "api" generator
    When I generate multiple endpoints with the following configuration:
      | endpoint  | method | auth_required | rate_limit | expected_status |
      | users     | GET    | true          | 100        | 200             |
      | posts     | POST   | true          | 50         | 201             |
      | comments  | PUT    | false         | 200        | 200             |
      | analytics | DELETE | true          | 10         | 204             |
    Then the following files should be generated:
      | file                    | contains                    |
      | src/api/users.ts        | method: 'GET'              |
      | src/api/posts.ts        | method: 'POST'             |
      | src/api/comments.ts     | method: 'PUT'              |
      | src/api/analytics.ts    | method: 'DELETE'           |

  @error-scenarios @examples
  Scenario: Error handling with data table
    Given I have a "validator" generator
    When I attempt to generate with invalid data:
      | variable | value  | expected_error                    |
      | name     | ""     | Name cannot be empty              |
      | name     | "123"  | Name must start with a letter     |
      | type     | "xyz"  | Invalid type, must be one of      |
    Then each generation should fail with the corresponding error

  @permissions @examples  
  Scenario: File permissions with data table
    Given I have a "script" generator that creates executable files
    When I generate the following scripts:
      | script_name | permissions | executable |
      | deploy.sh   | 755         | true       |
      | backup.sh   | 644         | false      |
      | test.sh     | 755         | true       |
    Then the files should have the correct permissions:
      | file              | permissions | executable |
      | scripts/deploy.sh | 755         | true       |
      | scripts/backup.sh | 644         | false      |
      | scripts/test.sh   | 755         | true       |

  @injection-patterns @examples
  Scenario: Multiple injection patterns with data table
    Given I have a file "src/main.ts" with content:
      """
      // Main application file
      import { App } from './App';
      
      const app = new App();
      // IMPORTS_HERE
      
      export default app;
      """
    And I have injection templates for various patterns
    When I perform the following injections:
      | pattern     | content                    | target          | position |
      | import      | import { Logger } from './utils'; | IMPORTS_HERE    | before   |
      | import      | import { Config } from './config'; | IMPORTS_HERE   | before   |
      | middleware  | app.use(logger);          | const app       | after    |
      | middleware  | app.use(config);          | app.use(logger) | after    |
    Then the file "src/main.ts" should have all injections applied correctly

  @complex-structure @examples
  Scenario: Complex project structure generation
    Given I want to generate a full-stack application structure
    When I run generation with the following configuration:
      | component   | technology | generate | location        |
      | frontend    | React      | true     | apps/web        |
      | backend     | Node.js    | true     | apps/api        |
      | database    | PostgreSQL | true     | apps/db         |
      | shared      | TypeScript | true     | packages/shared |
      | docs        | Markdown   | true     | docs            |
    Then the following directory structure should be created:
      | directory           | type      |
      | apps                | directory |
      | apps/web            | directory |
      | apps/api            | directory |
      | apps/db             | directory |
      | packages            | directory |
      | packages/shared     | directory |
      | docs                | directory |
    And the following key files should exist:
      | file                        | contains                |
      | apps/web/package.json       | "name": "web"          |
      | apps/api/package.json       | "name": "api"          |
      | packages/shared/package.json| "name": "shared"       |
      | docs/README.md              | # Project Documentation|