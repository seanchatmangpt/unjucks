import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { createTestContext } from '../support/test-context.js';
// Load the feature file
const feature = await loadFeature('./features/hygen-migration.feature');

describeFeature(feature, ({ Scenario }) => {

  Scenario('Hygen command syntax compatibility matrix', ({ Given, When, Then, And }) => { let testResult;
    given('I set up a temporary test environment', setupWorld);

    and('I create a complete Hygen-style generator structure });

    given('I have these Hygen commands that should work in Unjucks:', async (dataTable) => { await hygenMigrationSteps['I have these Hygen commands that should work in Unjucks });

    when('I test each command conversion', async () => {
      await hygenMigrationSteps['I test each command conversion'](world);
    });

    then('all conversions should succeed', () => {
      hygenMigrationSteps['all conversions should succeed'](world);
    });

    and('generated files should match expected structure', async () => {
      await hygenMigrationSteps['generated files should match expected structure'](world);
    });

    cleanupWorld();
  });

  test('EJS to Nunjucks template conversion', ({ given, when, then, and }) => { given('I set up a temporary test environment', setupWorld);

    and('I create a complete Hygen-style generator structure });

    given('I have a Hygen EJS template:', (ejsTemplate) => { hygenMigrationSteps['I have a Hygen EJS template });

    when('I convert it to Unjucks syntax:', async (nunjucksTemplate) => { await hygenMigrationSteps['I convert it to Unjucks syntax });

    and('I run "unjucks generate component new TestComponent"', async () => {
      await hygenMigrationSteps['I run {string}'](world, 'unjucks generate component new TestComponent');
    });

    then('the result should be successful', () => {
      hygenMigrationSteps['the result should be successful'](world);
    });

    and('the generated file should match Hygen output', async () => {
      await hygenMigrationSteps['the generated file should match Hygen output'](world);
    });

    cleanupWorld();
  });

  test('Complete frontmatter compatibility with Hygen', ({ given, when, then, and }) => { given('I set up a temporary test environment', setupWorld);

    and('I create a complete Hygen-style generator structure });

    given('I create a template with all Hygen frontmatter features:', async (templateContent) => { await hygenMigrationSteps['I create a template with all Hygen frontmatter features });

    when('I run "unjucks generate component new UserProfile"', async () => {
      await hygenMigrationSteps['I run {string}'](world, 'unjucks generate component new UserProfile');
    });

    then('the result should be successful', () => {
      hygenMigrationSteps['the result should be successful'](world);
    });

    and('the shell command should execute', async () => {
      await hygenMigrationSteps['the shell command should execute'](world);
    });

    and('injection should work correctly', async () => {
      await hygenMigrationSteps['injection should work correctly'](world);
    });

    cleanupWorld();
  });

  test('Performance comparison with Hygen benchmarks', ({ given, when, then, and }) => {
    given('I set up a performance testing environment', setupWorld);

    and('I have identical templates in both Hygen and Unjucks format', async () => {
      await hygenMigrationSteps['I have identical templates in both Hygen and Unjucks format'](world);
    });

    when('I benchmark "unjucks generate component new PerfTest"', async () => {
      await hygenMigrationSteps['I benchmark {string}'](world, 'unjucks generate component new PerfTest');
    });

    then('the cold start should be under 150ms (25% faster than Hygen\'s 200ms)', () => {
      hygenMigrationSteps['the cold start should be under {int}ms (25% faster than Hygen\'s {int}ms)'](world, 150, 200);
    });

    and('template processing should be under 30ms (40% faster than Hygen\'s 50ms)', () => {
      hygenMigrationSteps['template processing should be under {int}ms (40% faster than Hygen\'s {int}ms)'](world, 30, 50);
    });

    and('file operations should be under 15ms (25% faster than Hygen\'s 20ms)', () => {
      hygenMigrationSteps['file operations should be under {int}ms (25% faster than Hygen\'s {int}ms)'](world, 15, 20);
    });

    and('memory usage should be under 20MB (20% less than Hygen\'s 25MB)', () => {
      hygenMigrationSteps['memory usage should be under {int}MB (20% less than Hygen\'s {int}MB)'](world, 20, 25);
    });

    cleanupWorld();
  });

  test('Hygen workflow patterns work in Unjucks', ({ given, when, then, and }) => { given('I set up a temporary test environment', setupWorld);

    and('I create a complete Hygen-style generator structure });

    given('I have a complex Hygen workflow:', (workflowDescription) => { hygenMigrationSteps['I have a complex Hygen workflow });

    when('I convert to Unjucks workflow:', (unjucksWorkflow) => { hygenMigrationSteps['I convert to Unjucks workflow });

    then('all commands should execute successfully', async () => {
      await hygenMigrationSteps['all commands should execute successfully'](world);
    });

    and('generated files should maintain relationships', async () => {
      await hygenMigrationSteps['generated files should maintain relationships'](world);
    });

    and('file structure should match Hygen output', async () => {
      await hygenMigrationSteps['file structure should match Hygen output'](world);
    });

    cleanupWorld();
  });

  test('Variable handling compatibility', ({ given, when, then, and }) => { given('I set up a temporary test environment', setupWorld);

    and('I create a complete Hygen-style generator structure });

    given('I create a template with complex variable usage:', async (templateContent) => { await hygenMigrationSteps['I create a template with complex variable usage });

    when('I run "unjucks generate class new UserService --withOptions --withMethods"', async () => {
      await hygenMigrationSteps['I run {string}'](world, 'unjucks generate class new UserService --withOptions --withMethods');
    });

    then('variable interpolation should work correctly', async () => {
      await hygenMigrationSteps['variable interpolation should work correctly'](world);
    });

    and('conditional blocks should render properly', async () => {
      await hygenMigrationSteps['conditional blocks should render properly'](world);
    });

    and('filters should apply correctly', async () => {
      await hygenMigrationSteps['filters should apply correctly'](world);
    });

    cleanupWorld();
  });

  test('Migration regression testing', ({ given, when, then, and }) => {
    given('I set up a temporary test environment', setupWorld);

    and('I have a comprehensive Hygen project', async () => {
      await hygenMigrationSteps['I have a comprehensive Hygen project'](world);
    });

    when('I migrate to Unjucks', async () => {
      await hygenMigrationSteps['I migrate to Unjucks'](world);
    });

    then('I run the full migration test suite', async () => {
      await hygenMigrationSteps['I run the full migration test suite'](world);
    });

    and('all existing functionality should work', async () => {
      await hygenMigrationSteps['all existing functionality should work'](world);
    });

    and('no regressions should be introduced', () => {
      hygenMigrationSteps['no regressions should be introduced'](world);
    });

    and('performance should improve', () => {
      hygenMigrationSteps['performance should improve'](world);
    });

    cleanupWorld();
  });
});