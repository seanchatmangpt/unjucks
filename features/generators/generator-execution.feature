@generator @execution @variables @core
Feature: Generator Execution
  As a developer
  I want to execute generators with variables and see the results
  So that I can scaffold code efficiently and customize the output

  Background:
    Given the unjucks system is initialized
    And the following generators exist in "_templates":
      | name              | templates                           | variables                    |
      | react-component   | component.tsx.njk, index.ts.njk   | name, withProps, withTests   |
      | express-route     | route.js.njk, test.spec.js.njk    | path, method, withAuth       |
      | typescript-model  | model.ts.njk                       | name, withValidation, fields |

  @basic-execution
  Scenario: Execute generator with required variables
    When I run "unjucks generate react-component --name UserCard --withProps true"
    Then the generator should execute successfully
    And the following files should be created:
      | src/components/UserCard.tsx |
      | src/components/index.ts     |
    And the files should contain the rendered content with "UserCard" as the component name
    And the exit code should be 0

  @interactive-variable-prompts
  Scenario: Interactive variable prompts for missing variables
    When I run "unjucks generate react-component"
    Then I should be prompted for variables:
      | Variable   | Type    | Default | Required |
      | name       | string  |         | yes      |
      | withProps  | boolean | false   | no       |
      | withTests  | boolean | false   | no       |
    When I provide the following inputs:
      | Variable   | Value     |
      | name       | UserCard  |
      | withProps  | true      |
      | withTests  | false     |
    Then the generator should execute successfully
    And files should be created with the provided variable values

  @variable-validation
  Scenario: Validate variable inputs
    Given "react-component" has variable validation:
      | Variable  | Validation Rule           |
      | name      | PascalCase, max 50 chars  |
      | withProps | boolean                   |
    When I run "unjucks generate react-component --name invalid-name --withProps maybe"
    Then I should see validation errors:
      | Variable  | Error                                    |
      | name      | Must be PascalCase (e.g., UserCard)     |
      | withProps | Must be a boolean (true/false)          |
    And the generator should not execute
    And the exit code should be 1

  @default-values
  Scenario: Use default values for optional variables
    Given "react-component" has default values:
      | Variable   | Default |
      | withProps  | false   |
      | withTests  | false   |
    When I run "unjucks generate react-component --name UserCard"
    Then the generator should execute with default values
    And the generated files should reflect the default values
    And I should not be prompted for optional variables

  @variable-transformation
  Scenario: Transform variables during execution
    Given "react-component" has variable transformations:
      | Variable | Transformation                    |
      | name     | PascalCase -> kebab-case for files |
      | name     | PascalCase -> camelCase for exports|
    When I run "unjucks generate react-component --name UserProfileCard"
    Then the files should be created with transformed names:
      | src/components/user-profile-card.tsx |
      | src/components/index.ts               |
    And the content should use "userProfileCard" for exports
    And the component name should remain "UserProfileCard"

  @conditional-templates
  Scenario: Conditionally include templates based on variables
    Given "react-component" has conditional templates:
      | Template              | Condition        |
      | component.tsx.njk     | always           |
      | component.test.tsx.njk| withTests: true  |
      | component.stories.tsx.njk| withStories: true|
    When I run "unjucks generate react-component --name UserCard --withTests true --withStories false"
    Then the following files should be created:
      | src/components/UserCard.tsx      |
      | src/components/UserCard.test.tsx |
    And the following files should NOT be created:
      | src/components/UserCard.stories.tsx |

  @custom-destination
  Scenario: Specify custom destination directory
    When I run "unjucks generate react-component --name UserCard --dest ./custom-components"
    Then the files should be created in the specified directory:
      | custom-components/UserCard.tsx |
      | custom-components/index.ts     |
    And the directory structure should be preserved

  @dry-run-execution
  Scenario: Dry run execution to preview changes
    When I run "unjucks generate react-component --name UserCard --dry-run"
    Then I should see a preview of what would be generated:
      | ✓ Would create: src/components/UserCard.tsx   |
      | ✓ Would create: src/components/index.ts       |
    And no actual files should be created
    And I should see the rendered content preview
    And the exit code should be 0

  @force-overwrite
  Scenario: Force overwrite existing files
    Given the file "src/components/UserCard.tsx" already exists
    When I run "unjucks generate react-component --name UserCard --force"
    Then the existing file should be overwritten
    And I should see a warning about overwriting existing files:
      | ⚠ Overwriting existing file: src/components/UserCard.tsx |

  @safe-overwrite-protection
  Scenario: Protect against accidental overwrites
    Given the file "src/components/UserCard.tsx" already exists
    When I run "unjucks generate react-component --name UserCard"
    Then I should see an error about existing files:
      | ✗ File already exists: src/components/UserCard.tsx |
      | Use --force to overwrite or --merge to merge       |
    And no files should be modified
    And the exit code should be 1

  @merge-with-existing
  Scenario: Merge generated content with existing files
    Given the file "src/components/index.ts" exists with content:
      """
      export { Button } from './Button';
      """
    When I run "unjucks generate react-component --name UserCard --merge"
    Then the existing file should be updated to include:
      """
      export { Button } from './Button';
      export { UserCard } from './UserCard';
      """
    And new files should be created normally

  @execution-with-config-file
  Scenario: Execute generator with configuration file
    Given a configuration file "unjucks.config.json" exists:
      """
      {
        "generators": {
          "react-component": {
            "defaultVariables": {
              "withProps": true,
              "withTests": true
            },
            "destination": "./src/components"
          }
        }
      }
      """
    When I run "unjucks generate react-component --name UserCard"
    Then the generator should use the configuration defaults
    And files should be created in "./src/components"
    And variables should default to the configured values

  @parallel-execution
  Scenario: Execute multiple generators in parallel
    When I run "unjucks generate react-component express-route --name User --path /users --parallel"
    Then both generators should execute concurrently
    And the following files should be created:
      | src/components/User.tsx |
      | src/routes/users.js     |
    And the execution time should be optimized

  @execution-hooks
  Scenario: Execute pre and post generation hooks
    Given hooks are configured:
      | Hook           | Command                    |
      | pre-generate   | npm run lint:fix          |
      | post-generate  | npm run format            |
    When I run "unjucks generate react-component --name UserCard"
    Then the pre-generate hook should execute before generation
    And the post-generate hook should execute after generation
    And the generated files should be properly formatted

  @variable-substitution-in-filenames
  Scenario: Use variables in template filenames
    Given "express-route" has templates with variable filenames:
      | Template                    | Generated Filename      |
      | {{path}}.route.js.njk      | users.route.js          |
      | {{path}}.{{method}}.js.njk | users.get.js            |
    When I run "unjucks generate express-route --path users --method get"
    Then files should be created with substituted names:
      | src/routes/users.route.js |
      | src/routes/users.get.js   |

  @nested-variable-objects
  Scenario: Handle nested variable objects
    Given "typescript-model" accepts nested variables:
      """
      {
        "name": "User",
        "fields": [
          {"name": "id", "type": "string", "required": true},
          {"name": "email", "type": "string", "required": true},
          {"name": "age", "type": "number", "required": false}
        ],
        "options": {
          "withValidation": true,
          "withSerialization": false
        }
      }
      """
    When I run "unjucks generate typescript-model --variables-file user-model.json"
    Then the generator should process nested variables correctly
    And the generated model should include all specified fields
    And validation should be included based on options

  @execution-progress
  Scenario: Show execution progress for complex generators
    Given "full-stack-feature" is a complex generator with multiple templates
    When I run "unjucks generate full-stack-feature --name UserManagement"
    Then I should see progress information:
      | Generating files... [████████████████████] 100% |
      | ✓ Created: frontend/UserList.tsx                |
      | ✓ Created: backend/user.service.ts              |
      | ✓ Created: database/user.model.ts               |
      | ✓ Created: tests/user.test.ts                   |
      | Generated 12 files in 2.3s                     |

  @execution-rollback
  Scenario: Rollback on generation failure
    Given generation fails partway through due to disk space
    When I run "unjucks generate react-component --name UserCard"
    And the generation fails after creating 1 of 3 files
    Then the partially created files should be cleaned up
    And I should see a rollback message:
      | ✗ Generation failed, rolling back changes       |
      | ✓ Cleaned up partially created files            |
    And the workspace should be left in the original state

  @execution-with-git-integration
  Scenario: Git integration during generation
    Given the project is a git repository
    When I run "unjucks generate react-component --name UserCard --git-add"
    Then the generated files should be automatically added to git staging
    And I should see git status information:
      | ✓ Added to git: src/components/UserCard.tsx |
      | ✓ Added to git: src/components/index.ts     |

  @execution-metrics
  Scenario: Collect and display execution metrics
    When I run "unjucks generate react-component --name UserCard --verbose"
    Then I should see execution metrics:
      | Files generated: 2                    |
      | Total size: 1.2 KB                   |
      | Execution time: 0.3s                 |
      | Templates processed: 2                |
      | Variables resolved: 3                 |
      | Memory usage: 12 MB                   |