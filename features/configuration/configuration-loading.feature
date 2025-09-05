Feature: Configuration Loading
  As a developer using Unjucks
  I want to load configuration from various sources
  So that I can customize the generator behavior

  Background:
    Given I am in a project directory
    And the directory contains templates

  Scenario: Load configuration from TypeScript config file
    Given a file "unjucks.config.ts" exists with:
      """
      export default {
        templatesDir: './custom-templates',
        outputDir: './generated',
        defaultAuthor: 'John Doe'
      }
      """
    When I run the configuration loader
    Then the configuration should be loaded successfully
    And the templatesDir should be "./custom-templates"
    And the outputDir should be "./generated"
    And the defaultAuthor should be "John Doe"

  Scenario: Load configuration from JavaScript config file
    Given a file "unjucks.config.js" exists with:
      """
      module.exports = {
        templatesDir: './templates',
        generators: {
          component: {
            templatesDir: './templates/component'
          }
        }
      }
      """
    When I run the configuration loader
    Then the configuration should be loaded successfully
    And the generators.component.templatesDir should be "./templates/component"

  Scenario: Load configuration from JSON config file
    Given a file "unjucks.config.json" exists with:
      """
      {
        "templatesDir": "./my-templates",
        "extensions": [".njk", ".hbs"],
        "filters": {
          "custom": "./filters/custom.js"
        }
      }
      """
    When I run the configuration loader
    Then the configuration should be loaded successfully
    And the extensions should contain ".njk" and ".hbs"
    And the filters.custom should be "./filters/custom.js"

  Scenario: Environment-specific configuration overrides
    Given a file "unjucks.config.ts" exists with:
      """
      export default {
        templatesDir: './templates',
        outputDir: './dist',
        $development: {
          outputDir: './dev-output',
          debug: true
        },
        $production: {
          outputDir: './prod-output',
          minify: true
        }
      }
      """
    And NODE_ENV is set to "development"
    When I run the configuration loader
    Then the configuration should be loaded successfully
    And the outputDir should be "./dev-output"
    And the debug should be true
    And the minify should be undefined

  Scenario: Production environment configuration
    Given a file "unjucks.config.ts" exists with:
      """
      export default {
        templatesDir: './templates',
        outputDir: './dist',
        $development: {
          outputDir: './dev-output',
          debug: true
        },
        $production: {
          outputDir: './prod-output',
          minify: true
        }
      }
      """
    And NODE_ENV is set to "production"
    When I run the configuration loader
    Then the configuration should be loaded successfully
    And the outputDir should be "./prod-output"
    And the minify should be true
    And the debug should be undefined

  Scenario: Configuration file extends from local file
    Given a file "base.config.ts" exists with:
      """
      export default {
        templatesDir: './templates',
        outputDir: './dist',
        defaultAuthor: 'Base Author'
      }
      """
    And a file "unjucks.config.ts" exists with:
      """
      export default {
        extends: './base.config.ts',
        outputDir: './custom-dist',
        customSetting: 'value'
      }
      """
    When I run the configuration loader
    Then the configuration should be loaded successfully
    And the templatesDir should be "./templates"
    And the outputDir should be "./custom-dist"
    And the defaultAuthor should be "Base Author"
    And the customSetting should be "value"

  Scenario: Configuration file extends from npm package
    Given an npm package "@company/unjucks-config" is available with config:
      """
      {
        templatesDir: './shared-templates',
        generators: {
          component: { type: 'react' }
        }
      }
      """
    And a file "unjucks.config.ts" exists with:
      """
      export default {
        extends: '@company/unjucks-config',
        templatesDir: './local-templates'
      }
      """
    When I run the configuration loader
    Then the configuration should be loaded successfully
    And the templatesDir should be "./local-templates"
    And the generators.component.type should be "react"

  Scenario: Default values and deep merging
    Given no configuration file exists
    When I run the configuration loader
    Then the configuration should be loaded successfully
    And the templatesDir should be "./templates"
    And the outputDir should be "./src"
    And the extensions should contain ".njk"

  Scenario: Deep merge of nested configurations
    Given a file "unjucks.config.ts" exists with:
      """
      export default {
        generators: {
          component: {
            templatesDir: './templates/component',
            options: {
              typescript: true,
              styling: 'css'
            }
          }
        }
      }
      """
    And default configuration has generators.component.options.tests set to true
    When I run the configuration loader
    Then the configuration should be loaded successfully
    And the generators.component.options.typescript should be true
    And the generators.component.options.styling should be "css"
    And the generators.component.options.tests should be true

  Scenario: Environment variable overrides
    Given a file "unjucks.config.ts" exists with:
      """
      export default {
        templatesDir: './templates',
        outputDir: './dist'
      }
      """
    And environment variable "UNJUCKS_TEMPLATES_DIR" is set to "/custom/templates"
    And environment variable "UNJUCKS_OUTPUT_DIR" is set to "/custom/output"
    When I run the configuration loader
    Then the configuration should be loaded successfully
    And the templatesDir should be "/custom/templates"
    And the outputDir should be "/custom/output"

  Scenario: Invalid configuration file syntax
    Given a file "unjucks.config.ts" exists with invalid TypeScript syntax:
      """
      export default {
        templatesDir: './templates'
        outputDir: // missing comma and invalid comment
      """
    When I run the configuration loader
    Then the configuration loading should fail
    And I should see an error message containing "syntax error"

  Scenario: Missing extended configuration file
    Given a file "unjucks.config.ts" exists with:
      """
      export default {
        extends: './non-existent.config.ts',
        templatesDir: './templates'
      }
      """
    When I run the configuration loader
    Then the configuration loading should fail
    And I should see an error message containing "Cannot resolve extended configuration"

  Scenario: Circular configuration extends
    Given a file "config-a.ts" exists with:
      """
      export default {
        extends: './config-b.ts',
        settingA: 'value-a'
      }
      """
    And a file "config-b.ts" exists with:
      """
      export default {
        extends: './config-a.ts',
        settingB: 'value-b'
      }
      """
    And a file "unjucks.config.ts" exists with:
      """
      export default {
        extends: './config-a.ts'
      }
      """
    When I run the configuration loader
    Then the configuration loading should fail
    And I should see an error message containing "circular dependency"

  Scenario: Configuration with custom loader
    Given a file "unjucks.config.ts" exists with:
      """
      export default {
        templatesDir: './templates',
        loaders: {
          yaml: './loaders/yaml-loader.js'
        }
      }
      """
    And a custom YAML loader exists at "./loaders/yaml-loader.js"
    When I run the configuration loader
    Then the configuration should be loaded successfully
    And the loaders.yaml should be "./loaders/yaml-loader.js"

  Scenario: Configuration with remote extends and caching
    Given remote configuration at "https://config-server.com/unjucks.json" returns:
      """
      {
        "templatesDir": "./remote-templates",
        "version": "1.2.0"
      }
      """
    And a file "unjucks.config.ts" exists with:
      """
      export default {
        extends: 'https://config-server.com/unjucks.json',
        templatesDir: './local-templates'
      }
      """
    When I run the configuration loader
    Then the configuration should be loaded successfully
    And the remote configuration should be cached locally
    And the templatesDir should be "./local-templates"
    And the version should be "1.2.0"

  Scenario: Use cached remote configuration when offline
    Given remote configuration was previously cached
    And the remote server is unavailable
    And a file "unjucks.config.ts" exists with:
      """
      export default {
        extends: 'https://config-server.com/unjucks.json',
        templatesDir: './local-templates'
      }
      """
    When I run the configuration loader
    Then the configuration should be loaded successfully using cached data
    And I should see a warning about using cached remote configuration