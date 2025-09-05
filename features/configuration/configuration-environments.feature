Feature: Configuration Environments
  As a developer using Unjucks
  I want environment-specific configuration handling
  So that I can customize behavior for different deployment environments

  Background:
    Given I am in a project directory
    And the environment configuration system is initialized

  Scenario: Automatic NODE_ENV detection
    Given NODE_ENV is not explicitly set
    And I am running in a development context
    When the environment is detected
    Then the detected environment should be "development"
    And development-specific settings should be applied

  Scenario: Explicit NODE_ENV environment handling
    Given NODE_ENV is set to "production"
    When the environment is detected
    Then the detected environment should be "production"
    And production-specific settings should be applied

  Scenario: Custom environment detection
    Given UNJUCKS_ENV is set to "staging"
    When the environment is detected
    Then the detected environment should be "staging"
    And staging-specific settings should be applied

  Scenario: Development environment configuration
    Given a configuration file "unjucks.config.ts" with:
      """
      export default {
        templatesDir: './templates',
        outputDir: './src',
        debug: false,
        $development: {
          debug: true,
          outputDir: './dev-src',
          hotReload: true,
          sourceMapDev: true
        }
      }
      """
    And NODE_ENV is set to "development"
    When the configuration is resolved
    Then the debug should be true
    And the outputDir should be "./dev-src"
    And the hotReload should be true
    And the sourceMapDev should be true
    And the templatesDir should be "./templates"

  Scenario: Production environment configuration
    Given a configuration file "unjucks.config.ts" with:
      """
      export default {
        templatesDir: './templates',
        outputDir: './src',
        debug: true,
        $production: {
          debug: false,
          outputDir: './dist',
          minify: true,
          removeComments: true,
          optimizeImages: true
        }
      }
      """
    And NODE_ENV is set to "production"
    When the configuration is resolved
    Then the debug should be false
    And the outputDir should be "./dist"
    And the minify should be true
    And the removeComments should be true
    And the optimizeImages should be true
    And the templatesDir should be "./templates"

  Scenario: Test environment configuration
    Given a configuration file "unjucks.config.ts" with:
      """
      export default {
        templatesDir: './templates',
        outputDir: './src',
        $test: {
          outputDir: './test-output',
          debug: false,
          mockData: true,
          coverage: true
        }
      }
      """
    And NODE_ENV is set to "test"
    When the configuration is resolved
    Then the outputDir should be "./test-output"
    And the debug should be false
    And the mockData should be true
    And the coverage should be true

  Scenario: Staging environment configuration
    Given a configuration file "unjucks.config.ts" with:
      """
      export default {
        templatesDir: './templates',
        outputDir: './src',
        $staging: {
          outputDir: './staging-dist',
          debug: true,
          analytics: false,
          testData: true
        }
      }
      """
    And UNJUCKS_ENV is set to "staging"
    When the configuration is resolved
    Then the outputDir should be "./staging-dist"
    And the debug should be true
    And the analytics should be false
    And the testData should be true

  Scenario: Multiple environment sections with precedence
    Given a configuration file "unjucks.config.ts" with:
      """
      export default {
        templatesDir: './templates',
        debug: false,
        $development: {
          debug: true,
          devTools: true
        },
        $local: {
          debug: false,
          localOverride: true
        }
      }
      """
    And NODE_ENV is set to "development"
    And UNJUCKS_ENV is set to "local"
    When the configuration is resolved
    Then the debug should be false
    And the devTools should be true
    And the localOverride should be true

  Scenario: Environment-specific generator configurations
    Given a configuration file "unjucks.config.ts" with:
      """
      export default {
        generators: {
          component: {
            templatesDir: './templates/component',
            outputDir: './src/components'
          }
        },
        $development: {
          generators: {
            component: {
              outputDir: './dev/components',
              options: {
                includeDebugInfo: true
              }
            }
          }
        },
        $production: {
          generators: {
            component: {
              outputDir: './prod/components',
              options: {
                minify: true,
                removeComments: true
              }
            }
          }
        }
      }
      """
    And NODE_ENV is set to "production"
    When the configuration is resolved
    Then the generators.component.outputDir should be "./prod/components"
    And the generators.component.options.minify should be true
    And the generators.component.options.removeComments should be true
    And the generators.component.templatesDir should be "./templates/component"

  Scenario: Dynamic environment switching during runtime
    Given a configuration file "unjucks.config.ts" with environment sections
    And the initial environment is "development"
    When I switch the environment to "production" during runtime
    Then the configuration should be reloaded
    And production-specific settings should be applied
    And development-specific settings should be removed

  Scenario: CI/CD environment detection and configuration
    Given environment variables indicate CI environment:
      | Variable | Value |
      | CI       | true  |
      | GITHUB_ACTIONS | true |
    And a configuration file "unjucks.config.ts" with:
      """
      export default {
        templatesDir: './templates',
        $ci: {
          outputDir: './ci-build',
          verbose: true,
          exitOnError: true,
          parallel: false
        }
      }
      """
    When the environment is detected
    Then the detected environment should be "ci"
    And the outputDir should be "./ci-build"
    And the verbose should be true
    And the exitOnError should be true
    And the parallel should be false

  Scenario: Docker environment configuration
    Given environment variable "DOCKER" is set to "true"
    And a configuration file "unjucks.config.ts" with:
      """
      export default {
        templatesDir: './templates',
        $docker: {
          templatesDir: '/app/templates',
          outputDir: '/app/dist',
          useContainerPaths: true
        }
      }
      """
    When the environment is detected
    Then the detected environment should include "docker"
    And the templatesDir should be "/app/templates"
    And the outputDir should be "/app/dist"
    And the useContainerPaths should be true

  Scenario: Environment fallback chain
    Given a configuration file "unjucks.config.ts" with:
      """
      export default {
        templatesDir: './templates',
        $development: {
          debug: true
        },
        $local: {
          localSetting: 'value'
        }
      }
      """
    And NODE_ENV is set to "unknown-environment"
    When the configuration is resolved with environment fallback
    Then the environment should fallback to "development"
    And the debug should be true
    And base configuration should be preserved

  Scenario: Environment-specific validation rules
    Given a configuration file "unjucks.config.ts" with:
      """
      export default {
        apiEndpoint: 'http://localhost:3000',
        $production: {
          apiEndpoint: 'http://localhost:3000',
          secureOnly: true
        }
      }
      """
    And NODE_ENV is set to "production"
    When the configuration is validated
    Then validation should fail
    And I should see an error "production apiEndpoint should use HTTPS"
    And I should see an error "localhost is not allowed in production"

  Scenario: Environment inheritance
    Given a configuration file "unjucks.config.ts" with:
      """
      export default {
        templatesDir: './templates',
        $development: {
          debug: true,
          devServer: {
            port: 3000,
            hot: true
          }
        },
        $local: {
          extends: '$development',
          devServer: {
            port: 3001
          },
          customLocal: true
        }
      }
      """
    And UNJUCKS_ENV is set to "local"
    When the configuration is resolved
    Then the debug should be true
    And the devServer.port should be 3001
    And the devServer.hot should be true
    And the customLocal should be true

  Scenario: Cross-environment configuration sharing
    Given a configuration file "unjucks.config.ts" with:
      """
      const sharedGenerators = {
        component: {
          templatesDir: './templates/component'
        }
      };

      export default {
        templatesDir: './templates',
        $development: {
          generators: sharedGenerators,
          debug: true
        },
        $production: {
          generators: sharedGenerators,
          minify: true
        }
      }
      """
    And NODE_ENV is set to "development"
    When the configuration is resolved
    Then the generators.component.templatesDir should be "./templates/component"
    And the debug should be true
    And the minify should be undefined

  Scenario: Environment-specific plugin loading
    Given a configuration file "unjucks.config.ts" with:
      """
      export default {
        templatesDir: './templates',
        plugins: ['base-plugin'],
        $development: {
          plugins: ['dev-plugin', 'hot-reload-plugin']
        },
        $production: {
          plugins: ['minify-plugin', 'optimize-plugin']
        }
      }
      """
    And NODE_ENV is set to "development"
    When the configuration is resolved
    Then the plugins should contain "base-plugin", "dev-plugin", and "hot-reload-plugin"
    And the plugins should not contain "minify-plugin" or "optimize-plugin"

  Scenario: Environment configuration with external files
    Given an environment-specific configuration file "config/development.ts" with:
      """
      export default {
        debug: true,
        apiUrl: 'http://localhost:3000/api'
      }
      """
    And a main configuration file "unjucks.config.ts" with:
      """
      export default {
        templatesDir: './templates',
        extends: `./config/${process.env.NODE_ENV}.ts`
      }
      """
    And NODE_ENV is set to "development"
    When the configuration is resolved
    Then the debug should be true
    And the apiUrl should be "http://localhost:3000/api"
    And the templatesDir should be "./templates"