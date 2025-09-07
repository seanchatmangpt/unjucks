import { loadFeature, defineFeature } from 'vitest-cucumber';
import { expect, describe } from 'vitest';
import { UnjucksWorld } from '../support/world.js';
import advancedFrontmatterSteps from '../step-definitions/advanced-frontmatter.steps.js';

// Load the feature file
const feature = loadFeature('./features/frontmatter/advanced-yaml.feature');

// Define the feature with vitest-cucumber
defineFeature(feature, (test) => {
  let world;

  // Setup before each scenario
  const setupWorld = () => {
    world = new UnjucksWorld();
  };

  // Cleanup after each scenario
  const cleanupWorld = async () => {
    if (world) {
      await world.cleanupTempDirectory();
    }
  };

  test('Basic Hygen frontmatter compatibility', ({ given, when, then, and }) => {
    given('I set up a temporary test environment', setupWorld);

    and('I ensure advanced YAML parser is available', () => {
      advancedFrontmatterSteps['I ensure advanced YAML parser is available'](world);
    });

    given('I create a template with standard Hygen frontmatter:', async (templateContent) => { await advancedFrontmatterSteps['I create a template with standard Hygen frontmatter });

    when('I run "unjucks generate component new TestComponent"', async () => {
      await advancedFrontmatterSteps['I run {string}'](world, 'unjucks generate component new TestComponent');
    });

    then('the result should be successful', () => {
      advancedFrontmatterSteps['the result should be successful'](world);
    });

    and('injection should work at the correct location', async () => {
      await advancedFrontmatterSteps['injection should work at the correct location'](world);
    });

    and('shell command should execute', () => {
      advancedFrontmatterSteps['shell command should execute'](world);
    });

    cleanupWorld();
  });

  test('Unjucks-exclusive frontmatter features', ({ given, when, then, and }) => {
    given('I set up a temporary test environment', setupWorld);

    and('I ensure advanced YAML parser is available', () => {
      advancedFrontmatterSteps['I ensure advanced YAML parser is available'](world);
    });

    given('I create a template with enhanced frontmatter:', async (templateContent) => { await advancedFrontmatterSteps['I create a template with enhanced frontmatter });

    when('I run "unjucks generate util new HelperUtil"', async () => {
      await advancedFrontmatterSteps['I run {string}'](world, 'unjucks generate util new HelperUtil');
    });

    then('the result should be successful', () => {
      advancedFrontmatterSteps['the result should be successful'](world);
    });

    and('the file permissions should be set to 755', async () => {
      await advancedFrontmatterSteps['the file permissions should be set to {int}'](world, 755);
    });

    and('content should be appended to the file', async () => {
      await advancedFrontmatterSteps['content should be appended to the file'](world);
    });

    and('both shell commands should execute in sequence', () => {
      advancedFrontmatterSteps['both shell commands should execute in sequence'](world);
    });

    cleanupWorld();
  });

  test('All injection mode variations - after mode', ({ given, when, then, and }) => {
    given('I set up a temporary test environment', setupWorld);

    and('I ensure advanced YAML parser is available', () => {
      advancedFrontmatterSteps['I ensure advanced YAML parser is available'](world);
    });

    given('I create a base file "src/registry.ts" with content:', async (content) => {
      await advancedFrontmatterSteps['I create a base file {string} with content:'](world, 'src/registry.ts', content);
    });

    and('I create a template with injection mode "after":', async (templateContent) => {
      await advancedFrontmatterSteps['I create a template with injection mode {string}:'](world, 'after', templateContent);
    });

    when('I run "unjucks generate registry add NewService"', async () => {
      await advancedFrontmatterSteps['I run {string}'](world, 'unjucks generate registry add NewService');
    });

    then('the result should be successful', () => {
      advancedFrontmatterSteps['the result should be successful'](world);
    });

    and('content should be injected using "after" mode', async () => {
      await advancedFrontmatterSteps['content should be injected using {string} mode'](world, 'after');
    });

    and('file structure should remain valid', async () => {
      await advancedFrontmatterSteps['file structure should remain valid'](world);
    });

    cleanupWorld();
  });

  test('Advanced conditional frontmatter logic', ({ given, when, then }) => {
    given('I set up a temporary test environment', setupWorld);

    and('I ensure advanced YAML parser is available', () => {
      advancedFrontmatterSteps['I ensure advanced YAML parser is available'](world);
    });

    given('I create a template with complex skipIf conditions:', async (templateContent) => { await advancedFrontmatterSteps['I create a template with complex skipIf conditions });

    when('I test various skip conditions:', async (dataTable) => { await advancedFrontmatterSteps['I test various skip conditions });

    then('files should only be created when conditions are false', () => {
      advancedFrontmatterSteps['files should only be created when conditions are false'](world);
    });

    cleanupWorld();
  });

  test('Dynamic path generation with complex expressions', ({ given, when, then, and }) => {
    given('I set up a temporary test environment', setupWorld);

    and('I ensure advanced YAML parser is available', () => {
      advancedFrontmatterSteps['I ensure advanced YAML parser is available'](world);
    });

    given('I create a template with dynamic path calculation:', async (templateContent) => { await advancedFrontmatterSteps['I create a template with dynamic path calculation });

    when('I generate files with different types:', async (dataTable) => { await advancedFrontmatterSteps['I generate files with different types });

    then('files should be created at correct dynamic paths', async (dataTable) => {
      await advancedFrontmatterSteps['files should be created at correct dynamic paths'](world, dataTable);
    });

    cleanupWorld();
  });

  test('Advanced shell command execution', ({ given, when, then, and }) => {
    given('I set up a temporary test environment', setupWorld);

    and('I ensure advanced YAML parser is available', () => {
      advancedFrontmatterSteps['I ensure advanced YAML parser is available'](world);
    });

    given('I create a template with complex shell commands:', async (templateContent) => { await advancedFrontmatterSteps['I create a template with complex shell commands });

    when('I run "unjucks generate file new TestFile --withTests"', async () => {
      await advancedFrontmatterSteps['I run {string}'](world, 'unjucks generate file new TestFile --withTests');
    });

    then('all shell commands should execute successfully', () => {
      advancedFrontmatterSteps['all shell commands should execute successfully'](world);
    });

    and('the generation log should be updated', async () => {
      await advancedFrontmatterSteps['the generation log should be updated'](world);
    });

    and('test file should be created conditionally', async () => {
      await advancedFrontmatterSteps['test file should be created conditionally'](world);
    });

    cleanupWorld();
  });

  test('File permissions and modes', ({ given, when, then }) => {
    given('I set up a temporary test environment', setupWorld);

    and('I ensure advanced YAML parser is available', () => {
      advancedFrontmatterSteps['I ensure advanced YAML parser is available'](world);
    });

    given('I create templates with various chmod settings:', async (dataTable) => { await advancedFrontmatterSteps['I create templates with various chmod settings });

    when('I generate files with each template', async () => {
      await advancedFrontmatterSteps['I generate files with each template'](world);
    });

    then('file permissions should match chmod values', async () => {
      await advancedFrontmatterSteps['file permissions should match chmod values'](world);
    });

    cleanupWorld();
  });

  test('YAML frontmatter validation and error handling', ({ given, when, then, and }) => {
    given('I set up a temporary test environment', setupWorld);

    and('I ensure advanced YAML parser is available', () => {
      advancedFrontmatterSteps['I ensure advanced YAML parser is available'](world);
    });

    given('I create a template with invalid YAML frontmatter:', async (templateContent) => { await advancedFrontmatterSteps['I create a template with invalid YAML frontmatter });

    when('I run "unjucks generate invalid new Test"', async () => {
      await advancedFrontmatterSteps['I run {string}'](world, 'unjucks generate invalid new Test');
    });

    then('the result should fail', () => {
      advancedFrontmatterSteps['the result should fail'](world);
    });

    and('the error should contain "Invalid YAML frontmatter"', () => {
      advancedFrontmatterSteps['the error should contain {string}'](world, 'Invalid YAML frontmatter');
    });

    and('the error should provide helpful debugging information', () => {
      advancedFrontmatterSteps['the error should provide helpful debugging information'](world);
    });

    cleanupWorld();
  });

  test('Complex nested YAML structures in frontmatter', ({ given, when, then, and }) => {
    given('I set up a temporary test environment', setupWorld);

    and('I ensure advanced YAML parser is available', () => {
      advancedFrontmatterSteps['I ensure advanced YAML parser is available'](world);
    });

    given('I create a template with nested YAML configuration:', async (templateContent) => { await advancedFrontmatterSteps['I create a template with nested YAML configuration });

    when('I run "unjucks generate config new DatabaseConfig --environment production --debug true"', async () => {
      await advancedFrontmatterSteps['I run {string}'](world, 'unjucks generate config new DatabaseConfig --environment production --debug true');
    });

    then('the result should be successful', () => {
      advancedFrontmatterSteps['the result should be successful'](world);
    });

    and('nested YAML configuration should be processed correctly', async () => {
      await advancedFrontmatterSteps['nested YAML configuration should be processed correctly'](world);
    });

    and('injection should use nested configuration', async () => {
      await advancedFrontmatterSteps['injection should use nested configuration'](world);
    });

    cleanupWorld();
  });

  test('Variable interpolation in frontmatter values', ({ given, when, then, and }) => {
    given('I set up a temporary test environment', setupWorld);

    and('I ensure advanced YAML parser is available', () => {
      advancedFrontmatterSteps['I ensure advanced YAML parser is available'](world);
    });

    given('I create a template with interpolated frontmatter:', async (templateContent) => { await advancedFrontmatterSteps['I create a template with interpolated frontmatter });

    when('I run with variables:', async (dataTable) => { await advancedFrontmatterSteps['I run with variables });

    then('frontmatter variables should be interpolated correctly', async () => {
      await advancedFrontmatterSteps['frontmatter variables should be interpolated correctly'](world);
    });

    and('file should be created with correct permissions', async () => {
      await advancedFrontmatterSteps['file should be created with correct permissions'](world);
    });

    cleanupWorld();
  });

  test('Conditional frontmatter properties', ({ given, when, then, and }) => {
    given('I set up a temporary test environment', setupWorld);

    and('I ensure advanced YAML parser is available', () => {
      advancedFrontmatterSteps['I ensure advanced YAML parser is available'](world);
    });

    given('I create a template with conditional frontmatter:', async (templateContent) => { await advancedFrontmatterSteps['I create a template with conditional frontmatter });

    when('I run with different flag combinations:', async (dataTable) => { await advancedFrontmatterSteps['I run with different flag combinations });

    then('frontmatter should be processed conditionally', async () => {
      await advancedFrontmatterSteps['frontmatter should be processed conditionally'](world);
    });

    and('only relevant properties should be applied', async () => {
      await advancedFrontmatterSteps['only relevant properties should be applied'](world);
    });

    cleanupWorld();
  });

  test('Idempotent injection operations', ({ given, when, then, and }) => {
    given('I set up a temporary test environment', setupWorld);

    and('I ensure advanced YAML parser is available', () => {
      advancedFrontmatterSteps['I ensure advanced YAML parser is available'](world);
    });

    given('I have an existing file "src/exports.ts":', async (content) => {
      await advancedFrontmatterSteps['I have an existing file {string}:'](world, 'src/exports.ts', content);
    });

    and('I create a template with idempotent injection:', async (templateContent) => { await advancedFrontmatterSteps['I create a template with idempotent injection });

    when('I run "unjucks generate export new ComponentB" twice', async () => {
      await advancedFrontmatterSteps['I run {string} twice'](world, 'unjucks generate export new ComponentB');
    });

    then('the export should only be added once', async () => {
      await advancedFrontmatterSteps['the export should only be added once'](world);
    });

    and('file should remain valid after multiple runs', async () => {
      await advancedFrontmatterSteps['file should remain valid after multiple runs'](world);
    });

    cleanupWorld();
  });

  test('Frontmatter error recovery and rollback', ({ given, when, then, and }) => {
    given('I set up a temporary test environment', setupWorld);

    and('I ensure advanced YAML parser is available', () => {
      advancedFrontmatterSteps['I ensure advanced YAML parser is available'](world);
    });

    given('I create a template that might fail during processing:', async (templateContent) => { await advancedFrontmatterSteps['I create a template that might fail during processing });

    when('I run "unjucks generate test new FailureTest"', async () => {
      await advancedFrontmatterSteps['I run {string}'](world, 'unjucks generate test new FailureTest');
    });

    then('the result should fail gracefully', () => {
      advancedFrontmatterSteps['the result should fail gracefully'](world);
    });

    and('no partial files should be left behind', async () => {
      await advancedFrontmatterSteps['no partial files should be left behind'](world);
    });

    and('original files should remain unchanged', async () => {
      await advancedFrontmatterSteps['original files should remain unchanged'](world);
    });

    cleanupWorld();
  });
});