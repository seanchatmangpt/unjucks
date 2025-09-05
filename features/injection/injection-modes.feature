Feature: Injection Modes
  As a developer using Unjucks
  I want to inject code into existing files using different modes
  So that I can modify files without completely overwriting them

  Background:
    Given I have a project with unjucks installed
    And I have an existing file "src/routes.ts" with content:
      """
      import { Router } from 'express';
      
      const router = Router();
      
      // Existing routes
      router.get('/health', healthCheck);
      
      export default router;
      """

  Scenario: Inject before a specific line
    Given I have a generator "route" with template "route.ts.njk":
      """
      ---
      to: src/routes.ts
      inject: true
      before: "export default router;"
      ---
      router.{{method}}('{{path}}', {{handler}});
      """
    When I run "unjucks generate route --method get --path /users --handler getUsers"
    Then the file "src/routes.ts" should contain:
      """
      import { Router } from 'express';
      
      const router = Router();
      
      // Existing routes
      router.get('/health', healthCheck);
      router.get('/users', getUsers);
      
      export default router;
      """

  Scenario: Inject after a specific line
    Given I have a generator "route" with template "route.ts.njk":
      """
      ---
      to: src/routes.ts
      inject: true
      after: "// Existing routes"
      ---
      router.{{method}}('{{path}}', {{handler}});
      """
    When I run "unjucks generate route --method post --path /users --handler createUser"
    Then the file "src/routes.ts" should contain:
      """
      import { Router } from 'express';
      
      const router = Router();
      
      // Existing routes
      router.post('/users', createUser);
      router.get('/health', healthCheck);
      
      export default router;
      """

  Scenario: Append to end of file
    Given I have a generator "export" with template "export.ts.njk":
      """
      ---
      to: src/index.ts
      inject: true
      append: true
      ---
      export { {{name}} } from './{{path}}';
      """
    And I have an existing file "src/index.ts" with content:
      """
      export { Router } from './router';
      """
    When I run "unjucks generate export --name UserService --path services/user"
    Then the file "src/index.ts" should contain:
      """
      export { Router } from './router';
      export { UserService } from './services/user';
      """

  Scenario: Prepend to beginning of file
    Given I have a generator "import" with template "import.ts.njk":
      """
      ---
      to: src/app.ts
      inject: true
      prepend: true
      ---
      import { {{name}} } from '{{path}}';
      """
    And I have an existing file "src/app.ts" with content:
      """
      import express from 'express';
      
      const app = express();
      """
    When I run "unjucks generate import --name cors --path cors"
    Then the file "src/app.ts" should contain:
      """
      import { cors } from 'cors';
      import express from 'express';
      
      const app = express();
      """

  Scenario: Inject at specific line number
    Given I have a generator "middleware" with template "middleware.ts.njk":
      """
      ---
      to: src/app.ts
      inject: true
      lineAt: 3
      ---
      app.use({{middleware}}());
      """
    And I have an existing file "src/app.ts" with content:
      """
      import express from 'express';
      
      const app = express();
      
      app.listen(3000);
      """
    When I run "unjucks generate middleware --middleware cors"
    Then the file "src/app.ts" should contain:
      """
      import express from 'express';
      
      const app = express();
      app.use(cors());
      
      app.listen(3000);
      """

  Scenario: Inject with multiple patterns matching
    Given I have a generator "route" with template "route.ts.njk":
      """
      ---
      to: src/routes.ts
      inject: true
      before: "export default"
      ---
      router.{{method}}('{{path}}', {{handler}});
      """
    And the file "src/routes.ts" contains multiple "export default" occurrences
    When I run "unjucks generate route --method get --path /users --handler getUsers"
    Then the content should be injected before the first matching occurrence
    And I should see "Injected before first occurrence of pattern"

  Scenario: Inject with regex pattern matching
    Given I have a generator "route" with template "route.ts.njk":
      """
      ---
      to: src/routes.ts
      inject: true
      before: "/\\/\\/ Routes section/"
      ---
      router.{{method}}('{{path}}', {{handler}});
      """
    And the file contains "// Routes section"
    When I run "unjucks generate route --method get --path /users --handler getUsers"
    Then the content should be injected before the regex match
    And the injection should be successful

  Scenario: Inject with indentation preservation
    Given I have a generator "method" with template "method.ts.njk":
      """
      ---
      to: src/UserService.ts
      inject: true
      before: "  }"
      ---
        async {{method}}(): Promise<{{returnType}}> {
          // TODO: Implement {{method}}
        }
      """
    And I have an existing file "src/UserService.ts" with content:
      """
      class UserService {
        constructor() {}
        
        async getAll(): Promise<User[]> {
          return [];
        }
      }
      """
    When I run "unjucks generate method --method create --returnType User"
    Then the injected content should maintain proper indentation
    And the file should contain the new method with correct spacing

  Scenario: Inject with custom delimiter preservation
    Given I have a generator with template preserving existing code structure
    And the target file uses specific code delimiters or markers
    When I inject content using before/after modes
    Then the existing code structure should be preserved
    And the injection should respect the file's formatting conventions

  Scenario: Multiple injections in same file
    Given I have generators for different injection points
    When I run multiple injection commands on the same file
    Then all injections should be applied correctly
    And the file should maintain its structure
    And injections should not interfere with each other

  Scenario: Inject with template inheritance
    Given I have a base template that other templates extend
    And the injection template uses template inheritance
    When I generate with injection mode
    Then the inherited template content should be properly rendered
    And the injection should work with the final rendered content

  Scenario: Handle injection target not found
    Given I have a generator with injection before "NONEXISTENT_PATTERN"
    When I run the generation command
    Then I should see "Injection target not found: NONEXISTENT_PATTERN"
    And the file should remain unchanged
    And the exit code should be 1

  Scenario: Inject with whitespace handling
    Given I have a generator that injects content with specific whitespace
    When I inject using any mode
    Then leading and trailing whitespace should be handled appropriately
    And the final file should have clean formatting
    And empty lines should be managed correctly

  Scenario: Inject binary content handling
    Given I have a template that might generate binary-like content
    When I attempt to inject into a text file
    Then the system should handle encoding properly
    And warn about potential binary content issues
    And maintain file integrity