Feature: File Injection and Modification
  As a developer
  I want to inject code into existing files
  So that I can modify existing files without overwriting them completely

  Background:
    Given I have a working Unjucks installation
    And I have templates with injection capabilities
    And I have existing target files

  Scenario: Inject at specific line
    Given I have a target file "src/routes.ts" with existing content
    And I have an injection template "templates/route/add-route.ts.njk"
    When I run "unjucks inject route add-route --file src/routes.ts --line 10 --name userRoutes"
    Then the content should be injected at line 10
    And the original content should remain intact
    And the exit code should be 0

  Scenario: Inject before marker
    Given I have a target file with marker "// INSERT_ROUTES_HERE"
    And I have an injection template with "before" frontmatter
    When I run "unjucks inject route add-route --file src/app.ts --name apiRoutes"
    Then the content should be injected before the marker
    And the marker should remain in place
    And the exit code should be 0

  Scenario: Inject after marker
    Given I have a target file with marker "// IMPORT_SECTION"
    And I have an injection template with "after" frontmatter
    When I run "unjucks inject imports add-import --file src/index.ts --name UserService"
    Then the content should be injected after the marker
    And the marker should remain in place
    And the exit code should be 0

  Scenario: Append to file
    Given I have a target file "src/types.ts"
    And I have an injection template with "append" frontmatter
    When I run "unjucks inject type add-interface --file src/types.ts --name UserInterface"
    Then the content should be appended to the end of the file
    And all original content should be preserved
    And the exit code should be 0

  Scenario: Prepend to file
    Given I have a target file "src/utils.ts"
    And I have an injection template with "prepend" frontmatter
    When I run "unjucks inject header add-header --file src/utils.ts --copyright "2024""
    Then the content should be added at the beginning of the file
    And all original content should follow
    And the exit code should be 0

  Scenario: Skip injection if content exists
    Given I have a target file that already contains the injection content
    And I have an injection template with "skipIf" condition
    When I run "unjucks inject route add-route --file src/routes.ts --name userRoutes"
    Then I should see "Content already exists, skipping" message
    And the file should remain unchanged
    And the exit code should be 0

  Scenario: Dry run injection
    Given I have a target file "src/app.ts"
    And I have an injection template
    When I run "unjucks inject route add-route --file src/app.ts --name testRoute --dry"
    Then I should see "Would inject:" message
    And I should see the content that would be injected
    And the target file should remain unchanged
    And the exit code should be 0

  Scenario: Force injection over existing content
    Given I have a target file with existing similar content
    And I have an injection template
    When I run "unjucks inject route add-route --file src/routes.ts --name userRoutes --force"
    Then the injection should proceed despite existing content
    And I should see "Forcing injection" message
    And the exit code should be 0

  Scenario: Inject with custom marker
    Given I have a target file with custom marker "<!-- USER_ROUTES -->"
    And I have an injection template configured for custom markers
    When I run "unjucks inject route add-route --file src/app.html --marker="<!-- USER_ROUTES -->" --name userRoutes"
    Then the content should be injected at the custom marker location
    And the exit code should be 0

  Scenario: Inject with file permissions
    Given I have a target file "scripts/deploy.sh"
    And I have an injection template with chmod frontmatter
    When I run "unjucks inject script add-step --file scripts/deploy.sh --name buildStep"
    Then the content should be injected
    And the file permissions should be updated to executable
    And the exit code should be 0

  Scenario: Inject with shell command execution
    Given I have an injection template with "sh" frontmatter
    When I run "unjucks inject config add-env --file .env --name DATABASE_URL"
    Then the content should be injected
    And the shell command should be executed
    And I should see the command output
    And the exit code should be 0

  Scenario: Inject fails on non-existent file
    When I run "unjucks inject route add-route --file nonexistent.ts --name testRoute"
    Then I should see "Target file not found" error
    And the exit code should be 1

  Scenario: Inject fails on invalid template
    Given I have a target file "src/app.ts"
    When I run "unjucks inject nonexistent template --file src/app.ts"
    Then I should see "Injection template not found" error
    And the exit code should be 1