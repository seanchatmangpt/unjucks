@frontmatter @yaml @advanced-features
Feature: Advanced Frontmatter YAML Features
  As a template developer
  I want comprehensive YAML frontmatter support with all Unjucks enhancements
  So that I can leverage powerful file generation capabilities beyond Hygen

  Background:
    Given I set up a temporary test environment
    And I ensure advanced YAML parser is available

  @frontmatter-basic-hygen-compatibility
  Scenario: Basic Hygen frontmatter compatibility
    Given I create a template with standard Hygen frontmatter:
      """
      ---
      to: src/components/{{ name }}.tsx
      inject: true
      after: "// Components"
      skip_if: "name === 'Base'"
      sh: "echo 'Generated {{ name }}'"
      ---
      export const {{ name }} = () => <div>{{ name }}</div>;
      """
    When I run "unjucks generate component new TestComponent"
    Then the result should be successful
    And injection should work at the correct location
    And shell command should execute

  @frontmatter-enhanced-unjucks-features
  Scenario: Unjucks-exclusive frontmatter features
    Given I create a template with enhanced frontmatter:
      """
      ---
      to: "src/utils/{{ name | kebabCase }}.ts"
      inject: false
      append: true
      prepend: false
      lineAt: 15
      chmod: "755"
      skipIf: "name == 'test'"
      sh:
        - "npm run format {{ name | kebabCase }}.ts"
        - "echo 'Formatted {{ name }}'"
      ---
      export const {{ name | camelCase }}Util = {
        name: '{{ name }}',
        version: '1.0.0',
        created: new Date().toISOString()
      };
      """
    When I run "unjucks generate util new HelperUtil"
    Then the result should be successful
    And the file permissions should be set to 755
    And content should be appended to the file
    And both shell commands should execute in sequence

  @frontmatter-injection-modes
  Scenario Outline: All injection mode variations
    Given I create a base file "src/registry.ts" with content:
      """
      // Auto-generated registry
      export const registry = {
        // Components
        // Utils
        // Services
      };
      """
    And I create a template with injection mode "<mode>":
      """
      ---
      to: "src/registry.ts"
      inject: true
      <injection_config>
      ---
      {{ name | camelCase }}: () => import('./{{ name | kebabCase }}'),
      """
    When I run "unjucks generate registry add NewService"
    Then the result should be successful
    And content should be injected using "<mode>" mode
    And file structure should remain valid

    Examples:
      | mode    | injection_config       |
      | after   | after: "// Components" |
      | before  | before: "// Services"  |
      | append  | append: true           |
      | prepend | prepend: true          |
      | lineAt  | lineAt: 5              |

  @frontmatter-conditional-logic
  Scenario: Advanced conditional frontmatter logic
    Given I create a template with complex skipIf conditions:
      """
      ---
      to: "src/{{ type }}/{{ name | kebabCase }}.ts"
      skipIf: |
        name == 'base' || 
        type == 'test' || 
        (environment == 'production' && name.includes('debug'))
      ---
      export const {{ name | pascalCase }} = {
        type: '{{ type }}',
        name: '{{ name }}',
        environment: '{{ environment }}'
      };
      """
    When I test various skip conditions:
      | name  | type      | environment | should_skip |
      | base  | component | development | true        |
      | debug | util      | production  | true        |
      | real  | component | production  | false       |
    Then files should only be created when conditions are false

  @frontmatter-dynamic-paths
  Scenario: Dynamic path generation with complex expressions
    Given I create a template with dynamic path calculation:
      """
      ---
      to: |
        {% if type == 'component' %}
          src/components/{{ name | kebabCase }}/{{ name | pascalCase }}.tsx
        {% elif type == 'service' %}
          src/services/{{ name | kebabCase }}.service.ts
        {% else %}
          src/{{ type }}/{{ name | kebabCase }}.ts
        {% endif %}
      ---
      // Generated {{ type }}: {{ name }}
      export const {{ name | pascalCase }} = {};
      """
    When I generate files with different types:
      | name        | type      | expected_path                                      |
      | UserProfile | component | src/components/user-profile/UserProfile.tsx       |
      | ApiClient   | service   | src/services/api-client.service.ts                |
      | Helper      | util      | src/util/helper.ts                                |
    Then files should be created at correct dynamic paths

  @frontmatter-shell-command-arrays
  Scenario: Advanced shell command execution
    Given I create a template with complex shell commands:
      """
      ---
      to: "src/generated/{{ name | kebabCase }}.ts"
      sh:
        - "mkdir -p src/generated"
        - "echo 'Generating {{ name }}' >> generation.log"
        - "npm run lint:fix src/generated/{{ name | kebabCase }}.ts"
        - |
          if [ "{{ withTests }}" = "true" ]; then
            echo "Creating test for {{ name }}"
            touch "src/generated/{{ name | kebabCase }}.test.ts"
          fi
      ---
      export const {{ name | pascalCase }} = {
        name: '{{ name }}',
        generated: true
      };
      """
    When I run "unjucks generate file new TestFile --withTests"
    Then all shell commands should execute successfully
    And the generation log should be updated
    And test file should be created conditionally

  @frontmatter-file-permissions
  Scenario: File permissions and modes
    Given I create templates with various chmod settings:
      | template_type | chmod | expected_permissions |
      | script        | "755" | rwxr-xr-x           |
      | config        | "644" | rw-r--r--           |
      | executable    | "777" | rwxrwxrwx           |
    When I generate files with each template
    Then file permissions should match chmod values

  @frontmatter-validation-errors  
  Scenario: YAML frontmatter validation and error handling
    Given I create a template with invalid YAML frontmatter:
      """
      ---
      to: invalid yaml: [
      inject: true but no after specified
      ---
      Invalid template
      """
    When I run "unjucks generate invalid new Test"
    Then the result should fail
    And the error should contain "Invalid YAML frontmatter"
    And the error should provide helpful debugging information

  @frontmatter-nested-yaml-structures
  Scenario: Complex nested YAML structures in frontmatter
    Given I create a template with nested YAML configuration:
      """
      ---
      to: "src/config/{{ name | kebabCase }}.ts"
      inject:
        enabled: true
        target: "src/config/index.ts"
        location:
          after: "// Auto-generated imports"
          indent: 2
      validation:
        required:
          - name
          - environment
        optional:
          - version
          - debug
      metadata:
        author: "Unjucks Generator"
        version: "1.0.0"
        tags: ["config", "generated"]
      ---
      export const {{ name | camelCase }}Config = {
        name: '{{ name }}',
        environment: '{{ environment | default("development") }}',
        version: '{{ version | default("1.0.0") }}',
        debug: {{ debug | default("false") }}
      };
      """
    When I run "unjucks generate config new DatabaseConfig --environment production --debug true"
    Then the result should be successful
    And nested YAML configuration should be processed correctly
    And injection should use nested configuration

  @frontmatter-variable-interpolation
  Scenario: Variable interpolation in frontmatter values
    Given I create a template with interpolated frontmatter:
      """
      ---
      to: "{{ outputDir }}/{{ name | kebabCase }}/index.ts"
      chmod: "{{ fileMode | default('644') }}"
      sh: "echo 'Generated in {{ outputDir }}' >> {{ logFile | default('generation.log') }}"
      skipIf: "outputDir == '{{ forbiddenDir }}'"
      ---
      export { {{ name | pascalCase }} } from './{{ name | kebabCase }}';
      """
    When I run with variables:
      | name         | outputDir | fileMode | logFile      | forbiddenDir |
      | TestModule   | src/lib   | 755      | build.log    | temp         |
    Then frontmatter variables should be interpolated correctly
    And file should be created with correct permissions

  @frontmatter-conditional-frontmatter
  Scenario: Conditional frontmatter properties
    Given I create a template with conditional frontmatter:
      """
      ---
      to: "src/{{ name | kebabCase }}.ts"
      {% if withTests %}
      testFile:
        to: "tests/{{ name | kebabCase }}.test.ts"
        template: "test-template"
      {% endif %}
      {% if isExecutable %}
      chmod: "755"
      {% endif %}
      {% if shouldInject %}
      inject: true
      after: "// Generated files"
      {% endif %}
      ---
      export const {{ name | pascalCase }} = {};
      """
    When I run with different flag combinations:
      | withTests | isExecutable | shouldInject |
      | true      | false        | true         |
      | false     | true         | false        |
    Then frontmatter should be processed conditionally
    And only relevant properties should be applied

  @frontmatter-idempotent-operations
  Scenario: Idempotent injection operations
    Given I have an existing file "src/exports.ts":
      """
      // Auto-generated exports
      export { ComponentA } from './ComponentA';
      // End exports
      """
    And I create a template with idempotent injection:
      """
      ---
      to: "src/exports.ts"
      inject: true
      before: "// End exports"
      skipIf: "content.includes('{{ name }}')"
      ---
      export { {{ name | pascalCase }} } from './{{ name | pascalCase }}';
      """
    When I run "unjucks generate export new ComponentB" twice
    Then the export should only be added once
    And file should remain valid after multiple runs

  @frontmatter-error-recovery
  Scenario: Frontmatter error recovery and rollback
    Given I create a template that might fail during processing:
      """
      ---
      to: "src/{{ name }}.ts"
      chmod: "invalid-permissions"
      sh: "nonexistent-command {{ name }}"
      ---
      export const {{ name }} = {};
      """
    When I run "unjucks generate test new FailureTest"
    Then the result should fail gracefully
    And no partial files should be left behind
    And original files should remain unchanged