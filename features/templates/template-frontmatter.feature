Feature: Template Frontmatter Parsing and Directives
  As a developer using Unjucks templates
  I want frontmatter directives to control file generation behavior
  So that I can customize how templates are processed and output

  Background:
    Given the Unjucks template system is initialized

  Scenario: Parse basic frontmatter with 'to' directive
    Given a template with frontmatter:
      """
      ---
      to: src/components/{{ componentName }}.ts
      ---
      export class {{ componentName }} {}
      """
    When I parse the template frontmatter
    Then the 'to' directive should be "src/components/{{ componentName }}.ts"
    And the template body should be "export class {{ componentName }} {}"

  Scenario: Handle inject directive for existing files
    Given a template with frontmatter:
      """
      ---
      to: src/index.ts
      inject: true
      before: "// END IMPORTS"
      ---
      import { {{ moduleName }} } from './{{ moduleName }}';
      """
    When I process the template with inject mode
    Then the content should be injected before the marker
    And existing file content should be preserved

  Scenario: Use append directive to add content
    Given a template with frontmatter:
      """
      ---
      to: src/routes.ts
      append: true
      ---
      router.use('/{{ routePath }}', {{ routeHandler }});
      """
    And an existing file "src/routes.ts"
    When I process the template
    Then the content should be appended to the file
    And existing content should remain unchanged

  Scenario: Use prepend directive to add content at start
    Given a template with frontmatter:
      """
      ---
      to: src/config.ts
      prepend: true
      ---
      import { {{ configType }} } from './types';
      """
    And an existing file "src/config.ts"
    When I process the template
    Then the content should be prepended to the file
    And existing content should follow

  Scenario: Insert at specific line with lineAt directive
    Given a template with frontmatter:
      """
      ---
      to: src/app.ts
      inject: true
      lineAt: 10
      ---
      app.use('/{{ endpoint }}', {{ handler }});
      """
    And an existing file with 20 lines
    When I process the template
    Then the content should be inserted at line 10
    And line numbers should be adjusted accordingly

  Scenario: Use after directive with marker
    Given a template with frontmatter:
      """
      ---
      to: src/database.ts
      inject: true
      after: "// Add migrations here"
      ---
      migrations.push({{ migrationName }});
      """
    When I process the template
    Then the content should be inserted after the marker
    And the marker should remain in place

  Scenario: Skip file generation with skipIf directive
    Given a template with frontmatter:
      """
      ---
      to: src/{{ featureName }}.ts
      skipIf: "{{ !withFeature }}"
      ---
      export const {{ featureName }} = {};
      """
    When I process the template with variables {"withFeature": false}
    Then the file should not be generated
    And no output file should be created

  Scenario: Set file permissions with chmod directive
    Given a template with frontmatter:
      """
      ---
      to: scripts/{{ scriptName }}.sh
      chmod: 755
      ---
      #!/bin/bash
      echo "{{ message }}"
      """
    When I process the template
    Then the output file should have permissions 755
    And the file should be executable

  Scenario: Execute shell commands with sh directive
    Given a template with frontmatter:
      """
      ---
      to: package.json
      sh: "npm install {{ packageName }} --save"
      ---
      {"dependencies": {"{{ packageName }}": "^1.0.0"}}
      """
    When I process the template
    Then the file should be generated
    And the shell command should be executed

  Scenario: Handle dynamic 'to' paths with variables
    Given a template with frontmatter:
      """
      ---
      to: "{{ baseDir }}/{{ moduleType }}/{{ fileName }}.{{ fileExtension }}"
      ---
      // Generated {{ fileName }}
      """
    When I process with variables:
      | baseDir       | moduleType | fileName | fileExtension |
      | src/features  | components | UserCard | tsx          |
    Then the output path should be "src/features/components/UserCard.tsx"

  Scenario: Multiple injection points in same file
    Given templates with frontmatter:
      """
      Template 1:
      ---
      to: src/app.ts
      inject: true
      before: "// ROUTES"
      ---
      import { {{ routeName }}Router } from './routes/{{ routeName }}';
      
      Template 2:
      ---
      to: src/app.ts
      inject: true
      after: "// ROUTES"
      ---
      app.use('/{{ routePath }}', {{ routeName }}Router);
      """
    When I process both templates
    Then both injections should occur in the same file
    And content should be properly positioned

  Scenario: Conditional frontmatter directives
    Given a template with frontmatter:
      """
      ---
      to: src/{{ componentName }}.test.ts
      skipIf: "{{ !withTests }}"
      ---
      describe('{{ componentName }}', () => {});
      """
    When I process with variables {"withTests": true, "componentName": "Button"}
    Then the test file should be generated
    When I process with variables {"withTests": false, "componentName": "Button"}
    Then the test file should be skipped

  Scenario: Invalid frontmatter handling
    Given a template with malformed frontmatter:
      """
      ---
      to src/invalid.ts
      inject: not-a-boolean
      ---
      content
      """
    When I parse the template frontmatter
    Then parsing should fail with clear error messages
    And invalid directives should be reported

  Scenario: Frontmatter inheritance from generator config
    Given a generator configuration:
      """
      {
        "defaultFrontmatter": {
          "to": "src/{{ moduleName }}/",
          "chmod": 644
        }
      }
      """
    And a template with frontmatter:
      """
      ---
      to: "{{ to }}{{ fileName }}.ts"
      ---
      content
      """
    When I process the template
    Then frontmatter should inherit from generator defaults
    And template-specific values should override defaults

  Scenario: Complex injection with skipIf and markers
    Given a template with frontmatter:
      """
      ---
      to: src/config.ts
      inject: true
      before: "// END CONFIG"
      skipIf: "{{ existingConfig.includes(configName) }}"
      ---
      {{ configName }}: {{ configValue }},
      """
    When I process with existing config containing the same name
    Then the injection should be skipped
    When I process with a new config name
    Then the injection should occur

  Scenario: File backup before injection
    Given a template with frontmatter:
      """
      ---
      to: src/important.ts
      inject: true
      backup: true
      before: "// INJECT HERE"
      ---
      // New content
      """
    When I process the template
    Then a backup file should be created
    And original content should be preserved in backup
    And injection should proceed in original file

  Scenario: Validate frontmatter against schema
    Given a template with frontmatter containing unknown directives:
      """
      ---
      to: src/file.ts
      unknownDirective: value
      invalidInject: notBoolean
      ---
      content
      """
    When I validate the frontmatter
    Then unknown directives should trigger warnings
    And invalid values should trigger errors
    And valid directives should be accepted