Feature: Advanced Frontmatter Processing
  As a developer using Unjucks
  I want comprehensive frontmatter support with YAML parsing
  So that I can control file generation with advanced options

  Background:
    Given I have a project with templates directory
    And I am in the project root directory

  @critical @frontmatter
  Scenario: Basic frontmatter processing with 'to' directive
    Given I have a template with frontmatter:
      """
      ---
      to: "src/components/{{ name | pascalCase }}.ts"
      ---
      export class {{ name | pascalCase }} {
        constructor() {}
      }
      """
    When I run "unjucks generate test basic --name=userProfile"
    Then I should see "src/components/UserProfile.ts" file generated
    And the file should contain "export class UserProfile"

  @critical @frontmatter @injection
  Scenario: Frontmatter injection with 'inject' and 'after'
    Given I have an existing file "src/index.ts" with content:
      """
      // Components
      export * from './Component1';
      """
    And I have a template with frontmatter:
      """
      ---
      to: "src/index.ts"
      inject: true
      after: "// Components"
      ---
      export * from './{{ name | pascalCase }}';
      """
    When I run "unjucks generate test inject --name=userProfile"
    Then the file "src/index.ts" should contain:
      """
      // Components
      export * from './UserProfile';
      export * from './Component1';
      """

  @critical @frontmatter @injection
  Scenario: Frontmatter injection with 'inject' and 'before'
    Given I have an existing file "src/index.ts" with content:
      """
      export * from './Component1';
      // End of components
      """
    And I have a template with frontmatter:
      """
      ---
      to: "src/index.ts"
      inject: true
      before: "// End of components"
      ---
      export * from './{{ name | pascalCase }}';
      """
    When I run "unjucks generate test inject --name=userProfile"
    Then the file "src/index.ts" should contain:
      """
      export * from './Component1';
      export * from './UserProfile';
      // End of components
      """

  @critical @frontmatter @unique
  Scenario: Frontmatter 'append' mode (Unjucks unique feature)
    Given I have an existing file "src/exports.ts" with content:
      """
      export * from './Component1';
      """
    And I have a template with frontmatter:
      """
      ---
      to: "src/exports.ts"
      inject: true
      append: true
      ---
      export * from './{{ name | pascalCase }}';
      """
    When I run "unjucks generate test append --name=userProfile"
    Then the file "src/exports.ts" should contain:
      """
      export * from './Component1';
      export * from './UserProfile';
      """

  @critical @frontmatter @unique
  Scenario: Frontmatter 'prepend' mode (Unjucks unique feature)
    Given I have an existing file "src/exports.ts" with content:
      """
      export * from './Component1';
      """
    And I have a template with frontmatter:
      """
      ---
      to: "src/exports.ts"
      inject: true
      prepend: true
      ---
      export * from './{{ name | pascalCase }}';
      """
    When I run "unjucks generate test prepend --name=userProfile"
    Then the file "src/exports.ts" should contain:
      """
      export * from './UserProfile';
      export * from './Component1';
      """

  @critical @frontmatter @unique
  Scenario: Frontmatter 'lineAt' mode (Unjucks unique feature)
    Given I have an existing file "src/config.ts" with content:
      """
      // Line 1
      // Line 2
      // Line 3
      // Line 4
      """
    And I have a template with frontmatter:
      """
      ---
      to: "src/config.ts"
      inject: true
      lineAt: 3
      ---
      // Inserted {{ name }} at line 3
      """
    When I run "unjucks generate test lineAt --name=userProfile"
    Then the file "src/config.ts" should contain:
      """
      // Line 1
      // Line 2
      // Inserted userProfile at line 3
      // Line 3
      // Line 4
      """

  @critical @frontmatter @unique
  Scenario: Frontmatter 'chmod' mode (Unjucks unique feature)
    Given I have a template with frontmatter:
      """
      ---
      to: "scripts/{{ name }}.sh"
      chmod: "755"
      ---
      #!/bin/bash
      echo "Running {{ name }} script"
      """
    When I run "unjucks generate test chmod --name=deploy"
    Then I should see "scripts/deploy.sh" file generated
    And the file "scripts/deploy.sh" should have permissions "755"
    And the file should contain "Running deploy script"

  @critical @frontmatter @conditional
  Scenario: Frontmatter 'skipIf' condition (enhanced syntax)
    Given I have a template with frontmatter:
      """
      ---
      to: "src/{{ name }}.ts"
      skipIf: "name == 'test'"
      ---
      export class {{ name | pascalCase }} {}
      """
    When I run "unjucks generate test skipIf --name=test"
    Then I should not see "src/test.ts" file generated
    When I run "unjucks generate test skipIf --name=user"
    Then I should see "src/user.ts" file generated

  @critical @frontmatter @shell
  Scenario: Frontmatter shell commands with array support (enhanced)
    Given I have a template with frontmatter:
      """
      ---
      to: "src/{{ name }}.ts"
      sh: ["echo 'Generated {{ name }}'", "touch .{{ name }}.generated"]
      ---
      export class {{ name | pascalCase }} {}
      """
    When I run "unjucks generate test shell --name=user"
    Then I should see "src/user.ts" file generated
    And I should see ".user.generated" file created
    And the command output should contain "Generated user"

  @regression @frontmatter @validation
  Scenario: Invalid frontmatter should show helpful error
    Given I have a template with invalid frontmatter:
      """
      ---
      to: "src/{{ name }}.ts"
      invalidOption: true
      malformedYAML: [unclosed
      ---
      export class {{ name }} {}
      """
    When I run "unjucks generate test invalid --name=user"
    Then I should see an error message
    And the error should contain "Invalid frontmatter"
    And the error should contain "YAML parsing error"

  @regression @frontmatter @idempotent
  Scenario: Idempotent injection prevents duplicates
    Given I have an existing file "src/index.ts" with content:
      """
      // Components
      export * from './UserProfile';
      """
    And I have a template with frontmatter:
      """
      ---
      to: "src/index.ts"
      inject: true
      after: "// Components"
      ---
      export * from './{{ name | pascalCase }}';
      """
    When I run "unjucks generate test idempotent --name=userProfile"
    Then the file "src/index.ts" should contain exactly one occurrence of "export * from './UserProfile';"
    And the file should not contain duplicate exports

  @performance @frontmatter
  Scenario: Complex frontmatter processing performance
    Given I have a template with complex frontmatter:
      """
      ---
      to: "src/complex/{{ category }}/{{ name | pascalCase }}.ts"
      inject: false
      skipIf: "name == 'ignore' || category == 'deprecated'"
      chmod: "644"
      sh: ["mkdir -p src/complex/{{ category }}", "echo 'Created {{ name }}'"]
      ---
      export class {{ name | pascalCase }} {
        category = '{{ category }}';
      }
      """
    When I run "unjucks generate test complex --name=advancedUser --category=users"
    Then the processing should complete in under 200ms
    And I should see "src/complex/users/AdvancedUser.ts" file generated
    And the file should contain "category = 'users';"