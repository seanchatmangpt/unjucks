/**
 * BDD Feature: Frontmatter Processing and File Injection
 * Tests frontmatter parsing and various file injection modes
 */

import { describe, test } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';

const feature = loadFeature('tests/features/frontmatter/injection-modes.test.js', (f) => {
  f.scenario('Parsing frontmatter from template', (s) => {
    s.given(`I have a template with frontmatter:
      ---
      to: "output.js"
      inject: true
      after: "// INSERT HERE"
      ---
      function test() { return "hello"; }`);
    s.when('I parse the frontmatter');
    s.then('the frontmatter should be parsed correctly');
    s.and('the frontmatter should contain "to" with value "output.js"');
    s.and('the frontmatter should contain "inject" with value "true"');
    s.and('the template body should be separated from frontmatter');
  });

  f.scenario('Creating new file without injection', (s) => {
    s.given('I have a target file path "new-file.js"');
    s.and(`I have frontmatter configuration:
      {"inject": false}`);
    s.and('I have a template string "console.log(\\"Hello World\\");"');
    s.when('I render the template string "console.log(\\"Hello World\\");"');
    s.and('I process the file with injection');
    s.then('the file processing should succeed');
    s.and('the file should be created');
    s.and('the processing result should indicate "create"');
  });

  f.scenario('Appending content to existing file', (s) => {
    s.given(`I have an existing file "target.md" with content:
      # Documentation
      
      ## Overview
      This is the main content.`);
    s.and('I have frontmatter configuration: {"append": true}');
    s.when('I render the template string "\\n## New Section\\nThis is appended content."');
    s.and('I append content to the file');
    s.then('the file processing should succeed');
    s.and('the file should contain the injected content');
    s.and('the original file content should be preserved');
  });

  f.scenario('Prepending content to existing file', (s) => {
    s.given(`I have an existing file "target.sql" with content:
      CREATE TABLE users (
        id INT PRIMARY KEY
      );`);
    s.and('I have frontmatter configuration: {"prepend": true}');
    s.when('I render the template string "-- Generated migration\\n-- Created: {{ now() }}\\n\\n"');
    s.and('I prepend content to the file');
    s.then('the file processing should succeed');
    s.and('the file should contain the injected content');
    s.and('the original file content should be preserved');
  });

  f.scenario('Injecting content after specific text', (s) => {
    s.given(`I have an existing file "service.js" with content:
      class UserService {
        constructor() {
          this.users = [];
        }
        
        // INSERT_POINT
        
        getAllUsers() {
          return this.users;
        }
      }`);
    s.when('I render the template string "  getUserById(id) {\\n    return this.users.find(u => u.id === id);\\n  }"');
    s.and('I inject content after "// INSERT_POINT"');
    s.then('the file processing should succeed');
    s.and('the file should contain the injected content');
    s.and('the content should be injected at the correct position');
  });

  f.scenario('Injecting content before specific text', (s) => {
    s.given(`I have an existing file "config.js" with content:
      module.exports = {
        // CONFIG_END
      };`);
    s.when('I render the template string "  apiUrl: \\"https://api.example.com\\","');
    s.and('I inject content before "// CONFIG_END"');
    s.then('the file processing should succeed');
    s.and('the file should contain the injected content');
    s.and('the content should be injected at the correct position');
  });

  f.scenario('Injecting content at specific line number', (s) => {
    s.given(`I have an existing file "data.txt" with content:
      Line 1
      Line 2
      Line 3
      Line 4`);
    s.when('I render the template string "Inserted at line 3"');
    s.and('I inject content at line 3');
    s.then('the file processing should succeed');
    s.and('the file should contain the injected content');
  });

  f.scenario('Dry run mode prevents file modification', (s) => {
    s.given('I have a target file path "dry-run-test.js"');
    s.and('I have frontmatter configuration: {"inject": false}');
    s.when('I render the template string "console.log(\\"This is a dry run\\");"');
    s.and('I process the file in dry run mode');
    s.then('the file processing should succeed');
    s.and('the file should not be modified in dry run');
  });

  f.scenario('Creating backup when modifying existing file', (s) => {
    s.given(`I have an existing file "backup-test.js" with content:
      console.log("original content");`);
    s.and('I have frontmatter configuration: {"append": true}');
    s.when('I render the template string "\\nconsole.log(\\"appended content\\");"');
    s.and('I process the file with injection');
    s.then('the file processing should succeed');
    s.and('a backup file should be created');
  });

  f.scenario('Complex frontmatter with multiple injection options', (s) => {
    s.given(`I have the following frontmatter template:
      ---
      to: "generated/complex.js"
      inject: true
      after: "// METHODS"
      skipIf: "getUserData"
      ---
      function getUserData() {
        return { id: 1, name: "test" };
      }`);
    s.when('I parse the frontmatter');
    s.then('the frontmatter should be parsed correctly');
    s.and('the frontmatter should contain "to" with value "generated/complex.js"');
    s.and('the frontmatter should contain "skipIf" with value "getUserData"');
    s.and('the frontmatter configuration should be applied correctly');
  });
});

describeFeature(feature, ({ given, when, then, and }) => {
  // Step definitions are imported from the steps files
});