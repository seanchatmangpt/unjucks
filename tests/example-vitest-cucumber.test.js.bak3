import { describe, it, beforeEach, afterEach } from 'vitest';
import { loadFeature, defineFeature } from 'vitest-cucumber';
import { UnjucksWorld } from './support/world.js';
import { injectionStepDefinitions } from './step-definitions/injection.steps.js';
import { templateGenerationStepDefinitions } from './step-definitions/template-generation.steps.js';
import { cliCommandsStepDefinitions } from './step-definitions/cli-commands.steps.js';
import { commonStepDefinitions } from './step-definitions/common-steps.js';
import { fileOperationsStepDefinitions } from './step-definitions/file-operations.steps.js';
import { generatorStepDefinitions } from './step-definitions/generator-steps.js';
import { templateStepDefinitions } from './step-definitions/template-steps.js';

// Load the feature file
const feature = loadFeature('./features/injection/basic-injection.feature');

// Combine all step definitions into one object
const allStepDefinitions = {
  ...injectionStepDefinitions,
  ...templateGenerationStepDefinitions,
  ...cliCommandsStepDefinitions,
  ...commonStepDefinitions,
  ...fileOperationsStepDefinitions,
  ...generatorStepDefinitions,
  ...templateStepDefinitions
};

defineFeature(feature, (test) => { let world;
  
  beforeEach(() => {
    world = new UnjucksWorld({
      baseUrl });
  
  afterEach(async () => {
    if (world.context.tempDirectory) {
      await world.cleanupTempDirectory();
    }
  });

  test('Basic file injection with skipIf conditions', ({ given, when, then }) => { given('I have a target file "src/config.ts" with content } with content:'](world, 'src/config.ts', content);
    });

    given('I have a generator "config" with template "database.ts":', async (content) => {
      await allStepDefinitions['I have a generator {string} with template {string}:'](world, 'config', 'database.ts', content);
    });

    when('I run injection for template "config"', async () => {
      await allStepDefinitions['I run injection for template {string}'](world, 'config');
    });

    then('the file should contain the database configuration', async () => {
      await allStepDefinitions['the file should contain the database configuration'](world);
    });

    then('the database configuration should not be duplicated', async () => {
      await allStepDefinitions['the database configuration should not be duplicated'](world);
    });
  });

  test('Template generation with variables', ({ given, when, then }) => {
    given('I have a project with templates directory', async () => {
      await allStepDefinitions['I have a project with templates directory'](world);
    });

    given('I have a "command" generator with "citty" template', async () => {
      await allStepDefinitions['I have a {string} generator with {string} template'](world, 'command', 'citty');
    });

    when('I run "unjucks generate command citty --commandName user --dest ./src"', async () => {
      await allStepDefinitions['I run {string}'](world, 'unjucks generate command citty --commandName user --dest ./src');
    });

    then('I should see "UserCommand.ts" file generated', async () => {
      await allStepDefinitions['I should see {string} file generated'](world, 'UserCommand.ts');
    });

    then('the file should contain "UserCommand"', async () => {
      await allStepDefinitions['the file should contain {string}'](world, 'UserCommand');
    });
  });

  test('CLI help command', ({ when, then }) => {
    when('I run unjucks help', async () => {
      await allStepDefinitions['I run unjucks help'](world);
    });

    then('the command should exit successfully', () => {
      allStepDefinitions['the command should exit successfully'](world);
    });

    then('the output should show usage information', () => {
      allStepDefinitions['the output should show usage information'](world);
    });
  });
});

// Example of how to create multiple test files for different features
describe('Template Processing Features', () => {
  // This could load a different feature file
  // const templateFeature = loadFeature('./features/templates/nunjucks-rendering.feature');
  
  // defineFeature(templateFeature, (test) => {
  //   // Define scenarios for template processing
  // });
});