import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { createTestContext } from '../support/test-context.js';
import type { CLIResult } from '../support/TestHelper.js';

// Load the feature file
const feature = await loadFeature('./features/performance-benchmarks.feature');

describeFeature(feature, ({ Scenario }) => {

  Scenario('Cold start performance validation', ({ Given, When, Then, And }) => {
    let testResult: CLIResult;
    given('I set up a performance testing environment', async () => {
      await performanceBenchmarksSteps['I set up a performance testing environment'](world);
    });

    and('I prepare benchmark templates and test data', async () => {
      await performanceBenchmarksSteps['I prepare benchmark templates and test data'](world);
    });

    given('I have a fresh Node.js process', () => {
      performanceBenchmarksSteps['I have a fresh Node.js process'](world);
    });

    when('I measure the time to execute "unjucks generate component new BenchmarkComponent"', async () => {
      await performanceBenchmarksSteps['I measure the time to execute {string}'](world, 'unjucks generate component new BenchmarkComponent');
    });

    then('the cold start time should be under 150ms', () => {
      performanceBenchmarksSteps['the cold start time should be under {int}ms'](world, 150);
    });

    and('it should be at least 25% faster than Hygen\'s baseline of 200ms', () => {
      performanceBenchmarksSteps['it should be at least {int}% faster than Hygen\'s baseline of {int}ms'](world, 25, 200);
    });

    and('the improvement should be measurable across 10 runs', async () => {
      await performanceBenchmarksSteps['the improvement should be measurable across {int} runs'](world, 10);
    });

    cleanupWorld();
  });

  test('Template processing speed validation (40% faster than Hygen)', ({ given, when, then, and }) => {
    given('I set up a performance testing environment', async () => {
      await performanceBenchmarksSteps['I set up a performance testing environment'](world);
    });

    and('I prepare benchmark templates and test data', async () => {
      await performanceBenchmarksSteps['I prepare benchmark templates and test data'](world);
    });

    given('I have a complex template with multiple variables and conditionals:', async (templateContent: string) => {
      await performanceBenchmarksSteps['I have a complex template with multiple variables and conditionals:'](world, templateContent);
    });

    when('I benchmark template processing with variables:', async (dataTable: any) => {
      await performanceBenchmarksSteps['I benchmark template processing with variables:'](world, dataTable);
    });

    then('template processing should complete in under 30ms', () => {
      performanceBenchmarksSteps['template processing should complete in under {int}ms'](world, 30);
    });

    and('it should be at least 40% faster than Hygen\'s baseline of 50ms', () => {
      performanceBenchmarksSteps['it should be at least {int}% faster than Hygen\'s baseline of {int}ms'](world, 40, 50);
    });

    cleanupWorld();
  });

  test('File operations speed validation (25% faster than Hygen)', ({ given, when, then, and }) => {
    given('I set up a performance testing environment', async () => {
      await performanceBenchmarksSteps['I set up a performance testing environment'](world);
    });

    and('I prepare benchmark templates and test data', async () => {
      await performanceBenchmarksSteps['I prepare benchmark templates and test data'](world);
    });

    given('I need to generate 50 files simultaneously', () => {
      performanceBenchmarksSteps['I need to generate {int} files simultaneously'](world, 50);
    });

    when('I execute batch file generation:', async (command: string) => {
      await performanceBenchmarksSteps['I execute batch file generation:'](world, command);
    });

    then('average file operation time should be under 15ms per file', () => {
      performanceBenchmarksSteps['average file operation time should be under {int}ms per file'](world, 15);
    });

    and('it should be at least 25% faster than Hygen\'s baseline of 20ms per file', () => {
      performanceBenchmarksSteps['it should be at least {int}% faster than Hygen\'s baseline of {int}ms'](world, 25, 20);
    });

    and('all files should be generated successfully', async () => {
      await performanceBenchmarksSteps['all files should be generated successfully'](world);
    });

    cleanupWorld();
  });

  test('Memory usage validation (20% less than Hygen)', ({ given, when, then, and }) => {
    given('I set up a performance testing environment', async () => {
      await performanceBenchmarksSteps['I set up a performance testing environment'](world);
    });

    and('I prepare benchmark templates and test data', async () => {
      await performanceBenchmarksSteps['I prepare benchmark templates and test data'](world);
    });

    given('I monitor memory usage during template generation', () => {
      performanceBenchmarksSteps['I monitor memory usage during template generation'](world);
    });

    when('I generate a large project with 100 components:', async () => {
      await performanceBenchmarksSteps['I generate a large project with {int} components:'](world, 100);
    });

    then('peak memory usage should remain under 20MB', () => {
      performanceBenchmarksSteps['peak memory usage should remain under {int}MB'](world, 20);
    });

    and('it should use at least 20% less memory than Hygen\'s baseline of 25MB', () => {
      performanceBenchmarksSteps['it should use at least {int}% less memory than Hygen\'s baseline of {int}MB'](world, 20, 25);
    });

    and('memory should be released properly after each generation', async () => {
      await performanceBenchmarksSteps['memory should be released properly after each generation'](world);
    });

    cleanupWorld();
  });

  test('Large template handling performance', ({ given, when, then, and }) => {
    given('I set up a performance testing environment', async () => {
      await performanceBenchmarksSteps['I set up a performance testing environment'](world);
    });

    and('I prepare benchmark templates and test data', async () => {
      await performanceBenchmarksSteps['I prepare benchmark templates and test data'](world);
    });

    given('I have a template generating 10,000+ lines of code:', async (templateContent: string) => {
      await performanceBenchmarksSteps['I have a template generating {int}+ lines of code:'](world, 10000, templateContent);
    });

    when('I generate with itemCount=10000', async () => {
      await performanceBenchmarksSteps['I generate with itemCount={int}'](world, 10000);
    });

    then('generation should complete in under 5 seconds', () => {
      performanceBenchmarksSteps['generation should complete in under {int} seconds'](world, 5);
    });

    and('memory usage should remain stable', () => {
      performanceBenchmarksSteps['memory usage should remain stable'](world);
    });

    and('the generated file should be valid TypeScript', async () => {
      await performanceBenchmarksSteps['the generated file should be valid TypeScript'](world);
    });

    cleanupWorld();
  });

  test('Template caching effectiveness', ({ given, when, then, and }) => {
    given('I set up a performance testing environment', async () => {
      await performanceBenchmarksSteps['I set up a performance testing environment'](world);
    });

    and('I prepare benchmark templates and test data', async () => {
      await performanceBenchmarksSteps['I prepare benchmark templates and test data'](world);
    });

    given('I generate the same template multiple times', async () => {
      await performanceBenchmarksSteps['I generate the same template multiple times'](world);
    });

    when('I run "unjucks generate component new TestComponent" 10 times', async () => {
      await performanceBenchmarksSteps['I run {string} {int} times'](world, 'unjucks generate component new TestComponent', 10);
    });

    then('the first run should compile the template', () => {
      performanceBenchmarksSteps['the first run should compile the template'](world);
    });

    and('subsequent runs should use cached template', () => {
      performanceBenchmarksSteps['subsequent runs should use cached template'](world);
    });

    and('cached runs should be at least 50% faster than first run', () => {
      performanceBenchmarksSteps['cached runs should be at least {int}% faster than first run'](world, 50);
    });

    and('cache should persist across command invocations', async () => {
      await performanceBenchmarksSteps['cache should persist across command invocations'](world);
    });

    cleanupWorld();
  });

  test('Variable resolution and filter performance', ({ given, when, then, and }) => {
    given('I set up a performance testing environment', async () => {
      await performanceBenchmarksSteps['I set up a performance testing environment'](world);
    });

    and('I prepare benchmark templates and test data', async () => {
      await performanceBenchmarksSteps['I prepare benchmark templates and test data'](world);
    });

    given('I have a template with complex variable resolution:', async (templateContent: string) => {
      await performanceBenchmarksSteps['I have a template with complex variable resolution:'](world, templateContent);
    });

    when('I benchmark variable resolution with 20 different filters', async () => {
      await performanceBenchmarksSteps['I benchmark variable resolution with {int} different filters'](world, 20);
    });

    then('variable resolution should complete in under 5ms', () => {
      performanceBenchmarksSteps['variable resolution should complete in under {int}ms'](world, 5);
    });

    and('filter application should not cause performance degradation', () => {
      performanceBenchmarksSteps['filter application should not cause performance degradation'](world);
    });

    cleanupWorld();
  });

  test('Error recovery performance impact', ({ given, when, then, and }) => {
    given('I set up a performance testing environment', async () => {
      await performanceBenchmarksSteps['I set up a performance testing environment'](world);
    });

    and('I prepare benchmark templates and test data', async () => {
      await performanceBenchmarksSteps['I prepare benchmark templates and test data'](world);
    });

    given('I have templates with intentional errors', async () => {
      await performanceBenchmarksSteps['I have templates with intentional errors'](world);
    });

    when('I run commands that will fail:', async (dataTable: any) => {
      await performanceBenchmarksSteps['I run commands that will fail:'](world, dataTable);
    });

    then('error detection should happen within 100ms', () => {
      performanceBenchmarksSteps['error detection should happen within {int}ms'](world, 100);
    });

    and('error recovery should not impact subsequent commands', async () => {
      await performanceBenchmarksSteps['error recovery should not impact subsequent commands'](world);
    });

    and('memory should be properly cleaned up after errors', () => {
      performanceBenchmarksSteps['memory should be properly cleaned up after errors'](world);
    });

    cleanupWorld();
  });

  test('Comparative performance validation', ({ given, when, then }) => {
    given('I set up a performance testing environment', async () => {
      await performanceBenchmarksSteps['I set up a performance testing environment'](world);
    });

    and('I prepare benchmark templates and test data', async () => {
      await performanceBenchmarksSteps['I prepare benchmark templates and test data'](world);
    });

    given('I have equivalent templates for comparison', async () => {
      await performanceBenchmarksSteps['I have equivalent templates for comparison'](world);
    });

    when('I run standardized benchmark suite:', async (benchmarkDescription: string) => {
      await performanceBenchmarksSteps['I run standardized benchmark suite:'](world, benchmarkDescription);
    });

    then('Unjucks should consistently outperform claimed metrics:', (dataTable: any) => {
      performanceBenchmarksSteps['Unjucks should consistently outperform claimed metrics:'](world, dataTable);
    });

    cleanupWorld();
  });

  test('Performance regression detection', ({ given, when, then, and }) => {
    given('I set up a performance testing environment', async () => {
      await performanceBenchmarksSteps['I set up a performance testing environment'](world);
    });

    and('I prepare benchmark templates and test data', async () => {
      await performanceBenchmarksSteps['I prepare benchmark templates and test data'](world);
    });

    given('I establish performance baselines', () => {
      performanceBenchmarksSteps['I establish performance baselines'](world);
    });

    when('I run comprehensive performance test suite', async () => {
      await performanceBenchmarksSteps['I run comprehensive performance test suite'](world);
    });

    then('no metric should regress by more than 5%', () => {
      performanceBenchmarksSteps['no metric should regress by more than {int}%'](world, 5);
    });

    and('improvements should be maintained consistently', () => {
      performanceBenchmarksSteps['improvements should be maintained consistently'](world);
    });

    and('performance should be stable across different environments', () => {
      performanceBenchmarksSteps['performance should be stable across different environments'](world);
    });

    cleanupWorld();
  });
});