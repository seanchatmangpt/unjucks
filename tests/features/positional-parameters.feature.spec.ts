import { loadFeature, defineFeature } from 'vitest-cucumber';
import { expect, describe } from 'vitest';
import { UnjucksWorld } from '../support/world';
import positionalParametersSteps from '../step-definitions/positional-parameters.steps';

// Load the feature file
const feature = loadFeature('./features/cli/positional-parameters.feature');

// Define the feature with vitest-cucumber
defineFeature(feature, (test) => {
  let world: UnjucksWorld;

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

  test('Basic positional parameter syntax works like Hygen', ({ given, when, then, and }) => {
    given('I set up a temporary test environment', setupWorld);

    given('I create a basic component generator with template:', async (templateContent: string) => {
      await positionalParametersSteps['I create a basic component generator with template:'](world, templateContent);
    });

    when('I run "unjucks generate component new MyComponent"', async () => {
      await positionalParametersSteps['I run {string}'](world, 'unjucks generate component new MyComponent');
    });

    then('the result should be successful', () => {
      positionalParametersSteps['the result should be successful'](world);
    });

    and('the file "src/components/MyComponent.ts" should exist', async () => {
      await positionalParametersSteps['the file {string} should exist'](world, 'src/components/MyComponent.ts');
    });

    and('the file content should contain "export interface MyComponentProps"', async () => {
      await positionalParametersSteps['the file content should contain {string}'](world, 'export interface MyComponentProps');
    });

    and('the file content should contain "export const MyComponent"', async () => {
      await positionalParametersSteps['the file content should contain {string}'](world, 'export const MyComponent');
    });

    cleanupWorld();
  });

  test('Positional parameters combined with flags', ({ given, when, then, and }) => {
    given('I set up a temporary test environment', setupWorld);

    given('I create a basic component generator with template:', async (templateContent: string) => {
      await positionalParametersSteps['I create a basic component generator with template:'](world, templateContent);
    });

    when('I run "unjucks generate component new UserProfile --withTests"', async () => {
      await positionalParametersSteps['I run {string}'](world, 'unjucks generate component new UserProfile --withTests');
    });

    then('the result should be successful', () => {
      positionalParametersSteps['the result should be successful'](world);
    });

    and('the file "src/components/UserProfile.ts" should exist', async () => {
      await positionalParametersSteps['the file {string} should exist'](world, 'src/components/UserProfile.ts');
    });

    and('the file content should contain "testId?: string"', async () => {
      await positionalParametersSteps['the file content should contain {string}'](world, 'testId?: string');
    });

    and('the file content should contain "data-testid={testId}"', async () => {
      await positionalParametersSteps['the file content should contain {string}'](world, 'data-testid={testId}');
    });

    cleanupWorld();
  });

  test('Multiple positional parameters with smart type inference', ({ given, when, then, and }) => {
    given('I set up a temporary test environment', setupWorld);

    given('I create a generator "api/endpoint" with template:', async (templateContent: string) => {
      await positionalParametersSteps['I create a generator {string} with template:'](world, 'api/endpoint', templateContent);
    });

    when('I run "unjucks generate api endpoint User https://api.example.com 2 true"', async () => {
      await positionalParametersSteps['I run {string}'](world, 'unjucks generate api endpoint User https://api.example.com 2 true');
    });

    then('the result should be successful', () => {
      positionalParametersSteps['the result should be successful'](world);
    });

    and('the file "src/api/user.ts" should exist', async () => {
      await positionalParametersSteps['the file {string} should exist'](world, 'src/api/user.ts');
    });

    and('the file content should contain "baseUrl: \'https://api.example.com\'"', async () => {
      await positionalParametersSteps['the file content should contain {string}'](world, 'baseUrl: \'https://api.example.com\'');
    });

    and('the file content should contain "version: 2"', async () => {
      await positionalParametersSteps['the file content should contain {string}'](world, 'version: 2');
    });

    and('the file content should contain "authenticated: true"', async () => {
      await positionalParametersSteps['the file content should contain {string}'](world, 'authenticated: true');
    });

    cleanupWorld();
  });

  test('Backward compatibility with flag-based syntax', ({ given, when, then, and }) => {
    given('I set up a temporary test environment', setupWorld);

    given('I create a basic component generator with template:', async (templateContent: string) => {
      await positionalParametersSteps['I create a basic component generator with template:'](world, templateContent);
    });

    when('I run "unjucks generate component new --name MyComponent --withTests true"', async () => {
      await positionalParametersSteps['I run {string}'](world, 'unjucks generate component new --name MyComponent --withTests true');
    });

    then('the result should be successful', () => {
      positionalParametersSteps['the result should be successful'](world);
    });

    and('the file "src/components/MyComponent.ts" should exist', async () => {
      await positionalParametersSteps['the file {string} should exist'](world, 'src/components/MyComponent.ts');
    });

    and('the file content should contain "testId?: string"', async () => {
      await positionalParametersSteps['the file content should contain {string}'](world, 'testId?: string');
    });

    cleanupWorld();
  });

  test('Error handling for insufficient positional arguments', ({ when, then, and }) => {
    when('I run "unjucks generate component"', async () => {
      await positionalParametersSteps['I run {string}'](world, 'unjucks generate component');
    });

    then('the result should fail', () => {
      positionalParametersSteps['the result should fail'](world);
    });

    and('the output should contain "Missing required generator name"', () => {
      positionalParametersSteps['the output should contain {string}'](world, 'Missing required generator name');
    });

    cleanupWorld();
  });

  test('Performance benchmark for positional parameter parsing', ({ given, when, then, and }) => {
    given('I set up a temporary test environment', setupWorld);

    given('I have 20 template variables defined', () => {
      positionalParametersSteps['I have {int} template variables defined'](world, 20);
    });

    when('I run "unjucks generate complex template Component arg1 arg2 arg3 arg4 arg5 arg6 arg7 arg8 arg9 arg10"', async () => {
      await positionalParametersSteps['I run {string}'](world, 'unjucks generate complex template Component arg1 arg2 arg3 arg4 arg5 arg6 arg7 arg8 arg9 arg10');
    });

    then('the command should complete in less than 500 milliseconds', () => {
      positionalParametersSteps['the command should complete in less than {int} milliseconds'](world, 500);
    });

    and('the result should be successful', () => {
      positionalParametersSteps['the result should be successful'](world);
    });

    cleanupWorld();
  });

  test('Smart type inference for positional arguments', ({ given, when, then, and }) => {
    given('I set up a temporary test environment', setupWorld);

    given('I create a generator "config/settings" with template:', async (templateContent: string) => {
      await positionalParametersSteps['I create a generator {string} with template:'](world, 'config/settings', templateContent);
    });

    when('I run "unjucks generate config settings development 3000 true abc123"', async () => {
      await positionalParametersSteps['I run {string}'](world, 'unjucks generate config settings development 3000 true abc123');
    });

    then('the result should be successful', () => {
      positionalParametersSteps['the result should be successful'](world);
    });

    and('the file "config/development.json" should exist', async () => {
      await positionalParametersSteps['the file {string} should exist'](world, 'config/development.json');
    });

    and('the file content should contain \'"port": 3000\'', async () => {
      await positionalParametersSteps['the file content should contain {string}'](world, '"port": 3000');
    });

    and('the file content should contain \'"debug": true\'', async () => {
      await positionalParametersSteps['the file content should contain {string}'](world, '"debug": true');
    });

    and('the file content should contain \'"apiKey": "abc123"\'', async () => {
      await positionalParametersSteps['the file content should contain {string}'](world, '"apiKey": "abc123"');
    });

    cleanupWorld();
  });

  test('Edge case - special characters in positional arguments', ({ when, then, and }) => {
    when('I run "unjucks generate component new My-Super_Component$123"', async () => {
      await positionalParametersSteps['I run {string}'](world, 'unjucks generate component new My-Super_Component$123');
    });

    then('the result should be successful', () => {
      positionalParametersSteps['the result should be successful'](world);
    });

    and('the file should be created with safe filename', async () => {
      await positionalParametersSteps['the file should be created with safe filename'](world);
    });

    cleanupWorld();
  });

  test('Dry run with positional parameters', ({ when, then, and }) => {
    when('I run "unjucks generate component new PreviewComponent --dry"', async () => {
      await positionalParametersSteps['I run {string}'](world, 'unjucks generate component new PreviewComponent --dry');
    });

    then('the result should be successful', () => {
      positionalParametersSteps['the result should be successful'](world);
    });

    and('the output should contain "Dry run - no files were created"', () => {
      positionalParametersSteps['the output should contain {string}'](world, 'Dry run - no files were created');
    });

    and('the output should contain "src/components/PreviewComponent.ts"', () => {
      positionalParametersSteps['the output should contain {string}'](world, 'src/components/PreviewComponent.ts');
    });

    and('the file "src/components/PreviewComponent.ts" should not exist', async () => {
      await positionalParametersSteps['the file {string} should not exist'](world, 'src/components/PreviewComponent.ts');
    });

    cleanupWorld();
  });
});