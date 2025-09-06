@frontmatter @validation @comprehensive
Feature: HYGEN-DELTA Frontmatter Validation
  As a developer using Unjucks
  I want to validate all claims about frontmatter support in HYGEN-DELTA.md
  So that I can verify complete Hygen parity plus enhancements

  Background:
    Given I have a clean test workspace
    And the Unjucks CLI is available

  @critical @smoke
  Scenario: All 10 frontmatter options are supported
    Given I create a template with frontmatter containing all options:
      """
      ---
      to: "src/components/{{ name | pascalCase }}.ts"
      inject: true
      before: "// Before marker"
      after: "// After marker"
      skipIf: "name==test"
      sh: ["echo 'Generated {{ name }}'", "npm run format"]
      append: true
      prepend: false
      lineAt: 5
      chmod: "755"
      ---
      export const {{ name | pascalCase }} = () => {
        return <div>{{ name }}</div>;
      };
      """
    When I run the generator with variables
    Then the frontmatter should be parsed correctly
    And all 10 frontmatter options should be recognized

  @enhanced-syntax @validation
  Scenario: Enhanced skipIf expressions work correctly
    Given I have templates with different skipIf expressions:
      | Expression    | Description           |
      | name==test    | Equality check        |
      | name!=prod    | Inequality check      |
      | !withTests    | Boolean negation      |
      | env==dev      | Environment check     |
    When I generate with matching conditions
    Then generation should be skipped appropriately
    And when conditions don't match, generation should proceed

  @hygen-parity @validation
  Scenario: All Hygen standard frontmatter options work
    Given I have a template with Hygen-compatible frontmatter:
      """
      ---
      to: src/components/<%= name %>.js
      inject: true
      after: "// Components"
      skip_if: "<%= name %> === 'test'"
      sh: "echo 'done'"
      ---
      """
    When I convert it to Unjucks syntax
    Then all Hygen frontmatter features should be preserved
    And enhanced Unjucks features should be available

  @unique-features @validation  
  Scenario: Unjucks-unique frontmatter options work
    Given I have a template using unique Unjucks frontmatter:
      | Option    | Value | Expected Behavior           |
      | append    | true  | Append content to file end  |
      | prepend   | true  | Prepend content to file start |
      | lineAt    | 10    | Inject at line 10           |
      | chmod     | "755" | Set file permissions        |
    When I generate files using these options
    Then the unique Unjucks behaviors should work correctly
    And the file operations should be atomic and safe

  @yaml-parsing @validation
  Scenario: Advanced YAML parser handles complex expressions
    Given I have a template with complex YAML frontmatter:
      """
      ---
      to: "{{ projectPath }}/{{ name | kebabCase }}/{{ name | pascalCase }}.tsx"
      inject: true
      skipIf: "name==test && env!=development"
      sh:
        - "echo 'Generating {{ name }}'"
        - "mkdir -p {{ outputDir }}"
        - "npm run format {{ outputFile }}"
      metadata:
        author: "{{ author | default('Unknown') }}"
        created: "{{ now() | dateFormat('YYYY-MM-DD') }}"
      ---
      """
    When I parse the frontmatter
    Then complex YAML structures should be handled correctly
    And template expressions within YAML should be processed
    And array values should be supported

  @validation-errors @validation
  Scenario: Frontmatter validation provides helpful errors
    Given I have templates with invalid frontmatter:
      | Invalid Frontmatter   | Expected Error              |
      | Missing closing ---   | "Unclosed frontmatter"      |
      | Invalid YAML syntax   | "YAML parsing error"        |
      | Unknown option        | "Unknown frontmatter option" |
      | Invalid skipIf expr   | "Invalid skipIf expression" |
    When I try to process these templates
    Then I should receive detailed error messages
    And the errors should include line numbers and suggestions

  @dynamic-paths @validation
  Scenario: Dynamic file paths with filters work correctly
    Given I have a template with dynamic path:
      """
      ---
      to: "{{ basePath }}/{{ moduleName | kebabCase }}/{{ componentName | pascalCase }}.{{ extension }}"
      ---
      """
    When I generate with variables:
      | Variable      | Value        |
      | basePath      | src/features |
      | moduleName    | user-profile |
      | componentName | UserCard     |
      | extension     | tsx          |
    Then the file should be created at "src/features/user-profile/UserCard.tsx"
    And the path resolution should handle all filter combinations

  @shell-integration @validation
  Scenario: Enhanced shell command integration works
    Given I have a template with shell commands:
      """
      ---
      to: "src/{{ name | kebabCase }}.ts"
      sh:
        - "echo 'Creating {{ name }}'"
        - "mkdir -p src/{{ name | kebabCase }}"
        - "npm run lint:fix {{ outputFile }}"
      ---
      """
    When I generate the template
    Then all shell commands should execute in sequence
    And template variables should be interpolated in commands
    And errors should be handled gracefully

  @injection-modes @validation
  Scenario: All injection modes work correctly
    Given I have an existing file with content:
      """
      // Start of file
      // Middle content
      // End of file
      """
    When I inject content using different modes:
      | Mode     | Target         | Expected Result                    |
      | before   | // Middle      | Content inserted before middle    |
      | after    | // Middle      | Content inserted after middle     |
      | append   | true           | Content added at end               |
      | prepend  | true           | Content added at start             |
      | lineAt   | 2              | Content inserted at line 2         |
    Then the content should be injected correctly for each mode
    And the operations should be idempotent

  @performance @validation
  Scenario: Frontmatter parsing performance meets standards
    Given I have 100 templates with complex frontmatter
    When I parse all frontmatter configurations
    Then parsing should complete within 500ms
    And memory usage should remain under 50MB
    And all frontmatter should be cached for reuse