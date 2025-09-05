Feature: Configuration Precedence
  As a developer using Unjucks
  I want configuration values to follow a clear precedence order
  So that I can predictably override settings from different sources

  Background:
    Given I am in a project directory
    And the configuration system is initialized

  Scenario: CLI arguments override all other sources
    Given a configuration file "unjucks.config.ts" with:
      """
      export default {
        templatesDir: './config-templates',
        outputDir: './config-output'
      }
      """
    And environment variable "UNJUCKS_TEMPLATES_DIR" is set to "./env-templates"
    And I run the command with CLI arguments:
      """
      unjucks generate component --templatesDir ./cli-templates --outputDir ./cli-output
      """
    When the configuration is resolved
    Then the templatesDir should be "./cli-templates"
    And the outputDir should be "./cli-output"

  Scenario: Interactive prompts override config and defaults
    Given a configuration file "unjucks.config.ts" with:
      """
      export default {
        templatesDir: './config-templates',
        defaultAuthor: 'Config Author'
      }
      """
    And default configuration has defaultAuthor set to "Default Author"
    And the user is prompted for author and enters "Prompted Author"
    When the configuration is resolved
    Then the templatesDir should be "./config-templates"
    And the defaultAuthor should be "Prompted Author"

  Scenario: Configuration file overrides ontology and defaults
    Given default configuration has:
      """
      {
        templatesDir: './default-templates',
        outputDir: './default-output',
        extensions: ['.njk']
      }
      """
    And ontology configuration has:
      """
      {
        templatesDir: './ontology-templates',
        extensions: ['.njk', '.hbs']
      }
      """
    And a configuration file "unjucks.config.ts" with:
      """
      export default {
        templatesDir: './config-templates',
        customSetting: 'config-value'
      }
      """
    When the configuration is resolved
    Then the templatesDir should be "./config-templates"
    And the outputDir should be "./default-output"
    And the extensions should contain ".njk" and ".hbs"
    And the customSetting should be "config-value"

  Scenario: Ontology overrides defaults
    Given default configuration has:
      """
      {
        templatesDir: './default-templates',
        generators: {
          component: {
            type: 'basic'
          }
        }
      }
      """
    And ontology configuration has:
      """
      {
        generators: {
          component: {
            type: 'advanced',
            features: ['typescript', 'tests']
          },
          service: {
            type: 'api'
          }
        }
      }
      """
    And no configuration file exists
    When the configuration is resolved
    Then the templatesDir should be "./default-templates"
    And the generators.component.type should be "advanced"
    And the generators.component.features should contain "typescript" and "tests"
    And the generators.service.type should be "api"

  Scenario: Environment variables override config file
    Given a configuration file "unjucks.config.ts" with:
      """
      export default {
        templatesDir: './config-templates',
        outputDir: './config-output',
        debug: false
      }
      """
    And environment variable "UNJUCKS_TEMPLATES_DIR" is set to "./env-templates"
    And environment variable "UNJUCKS_DEBUG" is set to "true"
    When the configuration is resolved
    Then the templatesDir should be "./env-templates"
    And the outputDir should be "./config-output"
    And the debug should be true

  Scenario: Deep merge strategy for nested objects
    Given default configuration has:
      """
      {
        generators: {
          component: {
            options: {
              typescript: true,
              tests: true,
              styling: 'css'
            }
          }
        }
      }
      """
    And a configuration file "unjucks.config.ts" with:
      """
      export default {
        generators: {
          component: {
            options: {
              typescript: false,
              documentation: true
            }
          }
        }
      }
      """
    When the configuration is resolved with deep merge strategy
    Then the generators.component.options.typescript should be false
    And the generators.component.options.tests should be true
    And the generators.component.options.styling should be "css"
    And the generators.component.options.documentation should be true

  Scenario: Array merge strategy - replace vs append
    Given default configuration has:
      """
      {
        extensions: ['.njk', '.hbs'],
        generators: {
          component: {
            requiredFiles: ['template.njk', 'index.js']
          }
        }
      }
      """
    And a configuration file "unjucks.config.ts" with merge strategy "replace":
      """
      export default {
        $mergeStrategy: 'replace',
        extensions: ['.liquid'],
        generators: {
          component: {
            requiredFiles: ['component.njk']
          }
        }
      }
      """
    When the configuration is resolved
    Then the extensions should only contain ".liquid"
    And the generators.component.requiredFiles should only contain "component.njk"

  Scenario: Array merge strategy - append mode
    Given default configuration has:
      """
      {
        extensions: ['.njk', '.hbs'],
        plugins: ['base-plugin']
      }
      """
    And a configuration file "unjucks.config.ts" with merge strategy "append":
      """
      export default {
        $mergeStrategy: 'append',
        extensions: ['.liquid', '.mustache'],
        plugins: ['custom-plugin']
      }
      """
    When the configuration is resolved
    Then the extensions should contain ".njk", ".hbs", ".liquid", and ".mustache"
    And the plugins should contain "base-plugin" and "custom-plugin"

  Scenario: Context-specific configuration inheritance
    Given a global configuration file "unjucks.config.ts" with:
      """
      export default {
        templatesDir: './templates',
        generators: {
          component: {
            outputDir: './src/components'
          }
        }
      }
      """
    And a generator-specific configuration file "templates/api/generator.config.ts" with:
      """
      export default {
        outputDir: './src/api',
        options: {
          database: 'postgresql'
        }
      }
      """
    When generating with the "api" generator
    Then the templatesDir should be "./templates"
    And the outputDir should be "./src/api"
    And the options.database should be "postgresql"

  Scenario: CLI flag priority over environment variables
    Given environment variable "UNJUCKS_OUTPUT_DIR" is set to "./env-output"
    And environment variable "UNJUCKS_DEBUG" is set to "false"
    And I run the command with CLI arguments:
      """
      unjucks generate --outputDir ./cli-output
      """
    When the configuration is resolved
    Then the outputDir should be "./cli-output"
    And the debug should be false

  Scenario: Override behavior with explicit null values
    Given default configuration has:
      """
      {
        defaultAuthor: 'Default Author',
        generators: {
          component: {
            features: ['typescript', 'tests']
          }
        }
      }
      """
    And a configuration file "unjucks.config.ts" with:
      """
      export default {
        defaultAuthor: null,
        generators: {
          component: {
            features: null
          }
        }
      }
      """
    When the configuration is resolved
    Then the defaultAuthor should be null
    And the generators.component.features should be null

  Scenario: Conditional configuration based on environment
    Given a configuration file "unjucks.config.ts" with:
      """
      export default {
        templatesDir: './templates',
        outputDir: process.env.NODE_ENV === 'production' ? './dist' : './dev',
        debug: process.env.NODE_ENV !== 'production'
      }
      """
    And NODE_ENV is set to "production"
    When the configuration is resolved
    Then the outputDir should be "./dist"
    And the debug should be false

  Scenario: Generator-level CLI overrides
    Given a configuration file "unjucks.config.ts" with:
      """
      export default {
        generators: {
          component: {
            outputDir: './src/components',
            options: {
              typescript: true
            }
          }
        }
      }
      """
    And I run the command with generator-specific arguments:
      """
      unjucks generate component MyComponent --component.outputDir ./custom/components --component.options.typescript false
      """
    When the configuration is resolved
    Then the generators.component.outputDir should be "./custom/components"
    And the generators.component.options.typescript should be false

  Scenario: Merge conflict resolution
    Given multiple configuration sources with conflicting values:
      | Source      | templatesDir      | Priority |
      | defaults    | ./default-templates | 1       |
      | ontology    | ./ontology-templates| 2       |
      | config file | ./config-templates  | 3       |
      | env vars    | ./env-templates     | 4       |
      | CLI args    | ./cli-templates     | 5       |
    When the configuration is resolved
    Then the templatesDir should be "./cli-templates"
    And the resolution should log the override chain

  Scenario: Partial configuration override preservation
    Given base configuration has:
      """
      {
        generators: {
          component: {
            templatesDir: './templates/component',
            outputDir: './src/components',
            options: {
              typescript: true,
              tests: true,
              styling: 'scss'
            }
          }
        }
      }
      """
    And override configuration only specifies:
      """
      {
        generators: {
          component: {
            options: {
              typescript: false
            }
          }
        }
      }
      """
    When the configuration is resolved
    Then the generators.component.templatesDir should be "./templates/component"
    And the generators.component.outputDir should be "./src/components"
    And the generators.component.options.typescript should be false
    And the generators.component.options.tests should be true
    And the generators.component.options.styling should be "scss"