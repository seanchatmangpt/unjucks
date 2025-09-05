@core @injection @file-modification @smoke
Feature: Code Injection into Existing Files
  As a developer using Unjucks
  I want to inject generated code into existing files at specific locations
  So that I can incrementally modify files without complete rewrites

  Background:
    Given I have a clean test workspace
    And I have an existing file "src/routes.ts" with content:
      """
      import { Router } from 'express';
      
      const router = Router();
      
      // Existing routes
      router.get('/health', healthCheck);
      
      export default router;
      """

  @inject-before
  Scenario: Inject code before a specific pattern
    Given I have an injection generator "route" with template:
      """
      ---
      to: src/routes.ts
      inject: true
      before: "export default router;"
      ---
      router.{{method}}('{{path}}', {{handler}});
      """
    When I run "unjucks generate route --method post --path /users --handler createUser"
    Then the file "src/routes.ts" should contain:
      """
      import { Router } from 'express';
      
      const router = Router();
      
      // Existing routes
      router.get('/health', healthCheck);
      router.post('/users', createUser);
      
      export default router;
      """

  @inject-after
  Scenario: Inject code after a specific pattern  
    Given I have an injection generator "route" with template:
      """
      ---
      to: src/routes.ts
      inject: true
      after: "// Existing routes"
      ---
      router.{{method}}('{{path}}', {{handler}});
      """
    When I run "unjucks generate route --method get --path /users --handler getUsers"
    Then the file "src/routes.ts" should contain:
      """
      import { Router } from 'express';
      
      const router = Router();
      
      // Existing routes
      router.get('/users', getUsers);
      router.get('/health', healthCheck);
      
      export default router;
      """

  @inject-append
  Scenario: Append code to end of file
    Given I have an injection generator "export" with template:
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

  @inject-prepend
  Scenario: Prepend code to beginning of file
    Given I have an injection generator "import" with template:
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

  @inject-line-number
  Scenario: Inject code at specific line number
    Given I have an injection generator "middleware" with template:
      """
      ---
      to: src/app.ts
      inject: true
      lineAt: 4
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

  @inject-indentation-preservation
  Scenario: Preserve indentation when injecting code
    Given I have an injection generator "method" with template:
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
    Then the injected content should maintain proper indentation:
      """
      class UserService {
        constructor() {}
        
        async getAll(): Promise<User[]> {
          return [];
        }
        
        async create(): Promise<User> {
          // TODO: Implement create
        }
      }
      """

  @inject-multiple-matches
  Scenario: Handle multiple pattern matches with first-match injection
    Given I have a file with multiple "export default" statements
    And I have an injection generator targeting "export default"
    When I run the injection command
    Then the code should be injected before the first match only
    And I should see "Injected before first match of pattern"

  @inject-regex-patterns
  Scenario: Use regex patterns for injection targets
    Given I have an injection generator with template:
      """
      ---
      to: src/routes.ts
      inject: true
      before: "/\\/\\/ Routes section/"
      ---
      router.{{method}}('{{path}}', {{handler}});
      """
    And the target file contains "// Routes section"
    When I run "unjucks generate route --method get --path /test --handler testHandler"
    Then the content should be injected before the regex match
    And the injection should succeed

  @inject-skipif-conditions
  Scenario: Skip injection when content already exists
    Given I have an injection generator with template:
      """
      ---
      to: src/routes.ts
      inject: true
      after: "// Existing routes"
      skipIf: "router.get('/users'"
      ---
      router.get('/users', getUsers);
      """
    And the target file already contains "router.get('/users'"
    When I run "unjucks generate route"
    Then the injection should be skipped
    And I should see "Skipping injection: content already exists"
    And the file should remain unchanged

  @inject-atomic-operations
  Scenario: Ensure atomic injection operations
    Given I have a large file with multiple injection points
    When I run an injection that encounters an error mid-process
    Then the original file should be restored
    And no partial changes should remain
    And I should see "Injection failed: file restored to original state"

  @inject-backup-creation
  Scenario: Create backup files before injection
    Given I have configured backup creation for injections
    When I run "unjucks generate route --method post --path /test --handler testHandler"
    Then a backup file should be created with timestamp
    And the backup should contain the original content
    And the injection should proceed normally

  @inject-multiple-templates
  Scenario: Perform multiple injections from single generator
    Given I have a generator with multiple injection templates:
      | route.ts.njk        | Inject route definition  |
      | controller.ts.njk   | Inject controller import |
      | index.ts.njk        | Inject export statement  |
    When I run "unjucks generate api-endpoint --name users"
    Then all injections should be performed atomically
    And all target files should be updated correctly

  @inject-error-handling
  Scenario: Handle injection errors gracefully
    Given I have an injection generator targeting a non-existent pattern
    When I run the injection command
    Then I should see "Injection target not found: NONEXISTENT_PATTERN"
    And the target file should remain unchanged
    And the exit code should be 1

  @inject-dry-run
  Scenario: Preview injections without modifying files
    Given I have an injection generator for routes
    When I run "unjucks generate route --method get --path /preview --handler previewHandler --dry-run"
    Then I should see a preview of the injection:
      | Target: src/routes.ts                    |
      | Injection point: after "// Existing routes" |
      | Content to inject: router.get('/preview', previewHandler); |
    And the target file should not be modified
    And the exit code should be 0

  @inject-force-mode
  Scenario: Force injection even when skipIf conditions are met
    Given I have an injection with skipIf conditions
    And the skip condition is currently met
    When I run "unjucks generate route --force"
    Then the skipIf condition should be ignored
    And the injection should proceed
    And the content should be injected successfully