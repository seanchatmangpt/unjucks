Feature: Configuration Validation
  As a developer using Unjucks
  I want configuration to be validated against a schema
  So that I can catch configuration errors early

  Background:
    Given I am in a project directory
    And the configuration validator is initialized

  Scenario: Valid configuration passes validation
    Given a configuration object:
      """
      {
        templatesDir: './templates',
        outputDir: './src',
        extensions: ['.njk', '.hbs'],
        generators: {
          component: {
            templatesDir: './templates/component'
          }
        }
      }
      """
    When I validate the configuration
    Then the validation should pass
    And no validation errors should be reported

  Scenario: Invalid templatesDir path fails validation
    Given a configuration object:
      """
      {
        templatesDir: '',
        outputDir: './src'
      }
      """
    When I validate the configuration
    Then the validation should fail
    And I should see an error message "templatesDir cannot be empty"

  Scenario: Non-existent templatesDir fails validation
    Given a configuration object:
      """
      {
        templatesDir: './non-existent-directory',
        outputDir: './src'
      }
      """
    When I validate the configuration
    Then the validation should fail
    And I should see an error message containing "templatesDir path does not exist"

  Scenario: Invalid file extensions fail validation
    Given a configuration object:
      """
      {
        templatesDir: './templates',
        extensions: ['njk', 'hbs']
      }
      """
    When I validate the configuration
    Then the validation should fail
    And I should see an error message "extensions must start with a dot"

  Scenario: Required field validation
    Given a configuration object:
      """
      {
        outputDir: './src'
      }
      """
    When I validate the configuration
    Then the validation should fail
    And I should see an error message "templatesDir is required"

  Scenario: Type checking for configuration fields
    Given a configuration object:
      """
      {
        templatesDir: './templates',
        extensions: 'not-an-array',
        debug: 'not-a-boolean'
      }
      """
    When I validate the configuration
    Then the validation should fail
    And I should see an error message "extensions must be an array"
    And I should see an error message "debug must be a boolean"

  Scenario: Nested generator configuration validation
    Given a configuration object:
      """
      {
        templatesDir: './templates',
        generators: {
          component: {
            templatesDir: 123,
            invalidField: 'value'
          }
        }
      }
      """
    When I validate the configuration
    Then the validation should fail
    And I should see an error message "generators.component.templatesDir must be a string"
    And I should see an error message "generators.component.invalidField is not a valid configuration option"

  Scenario: Path validation for security
    Given a configuration object:
      """
      {
        templatesDir: '../../../etc/passwd',
        outputDir: './src'
      }
      """
    When I validate the configuration
    Then the validation should fail
    And I should see an error message "templatesDir cannot access files outside the project directory"

  Scenario: Absolute path validation
    Given a configuration object:
      """
      {
        templatesDir: '/absolute/path/templates',
        outputDir: './src'
      }
      """
    When I validate the configuration
    Then the validation should pass
    But I should see a warning "Using absolute paths may reduce portability"

  Scenario: Security constraint validation - no secrets in config
    Given a configuration object:
      """
      {
        templatesDir: './templates',
        apiKey: 'sk-1234567890abcdef',
        password: 'secret123'
      }
      """
    When I validate the configuration
    Then the validation should fail
    And I should see an error message "apiKey appears to contain sensitive data"
    And I should see an error message "password field is not allowed in configuration"

  Scenario: Filter function validation
    Given a configuration object:
      """
      {
        templatesDir: './templates',
        filters: {
          customFilter: './filters/custom.js'
        }
      }
      """
    And the filter file "./filters/custom.js" exists and exports a valid function
    When I validate the configuration
    Then the validation should pass

  Scenario: Invalid filter function validation
    Given a configuration object:
      """
      {
        templatesDir: './templates',
        filters: {
          invalidFilter: './filters/invalid.js'
        }
      }
      """
    And the filter file "./filters/invalid.js" does not exist
    When I validate the configuration
    Then the validation should fail
    And I should see an error message "Filter file './filters/invalid.js' does not exist"

  Scenario: Custom validation rules
    Given a configuration object:
      """
      {
        templatesDir: './templates',
        generators: {
          api: {
            outputDir: './src/api',
            database: 'mysql'
          }
        }
      }
      """
    And custom validation rules are defined for generator "api"
    When I validate the configuration
    Then the custom validation rules should be applied
    And the validation should pass if rules are satisfied

  Scenario: Environment-specific validation
    Given a configuration object:
      """
      {
        templatesDir: './templates',
        $production: {
          debug: true,
          outputDir: './temp'
        }
      }
      """
    When I validate the configuration for production environment
    Then the validation should fail
    And I should see an error message "debug should be false in production"
    And I should see an error message "production outputDir should not be temporary"

  Scenario: Template directory structure validation
    Given a configuration object:
      """
      {
        templatesDir: './templates',
        generators: {
          component: {
            templatesDir: './templates/component'
          }
        }
      }
      """
    And the templates directory structure is:
      """
      templates/
      ├── component/
      │   ├── template.njk
      │   └── index.js
      └── other/
      """
    When I validate the configuration
    Then the validation should pass
    And the generator structure should be validated

  Scenario: Missing required template files validation
    Given a configuration object:
      """
      {
        templatesDir: './templates',
        generators: {
          component: {
            templatesDir: './templates/component',
            requiredFiles: ['template.njk', 'index.js']
          }
        }
      }
      """
    And the component templates directory is missing "index.js"
    When I validate the configuration
    Then the validation should fail
    And I should see an error message "Required template file 'index.js' not found"

  Scenario: Schema version compatibility validation
    Given a configuration object with schema version:
      """
      {
        $schema: 'https://unjucks.dev/schema/v2.0.0',
        templatesDir: './templates',
        newFeature: 'value'
      }
      """
    And the current Unjucks version supports schema v1.5.0
    When I validate the configuration
    Then the validation should fail
    And I should see an error message "Configuration schema version 2.0.0 is not supported"

  Scenario: Deprecation warnings during validation
    Given a configuration object:
      """
      {
        templatesDir: './templates',
        templateDir: './old-templates',
        useOldApi: true
      }
      """
    When I validate the configuration
    Then the validation should pass with warnings
    And I should see a deprecation warning "templateDir is deprecated, use templatesDir"
    And I should see a deprecation warning "useOldApi will be removed in next major version"

  Scenario: Configuration size limits validation
    Given a very large configuration object with 10000+ properties
    When I validate the configuration
    Then the validation should fail
    And I should see an error message "Configuration is too large"

  Scenario: Circular reference validation in configuration
    Given a configuration object with circular references:
      """
      {
        templatesDir: './templates',
        reference: null
      }
      """
    And the reference property creates a circular reference
    When I validate the configuration
    Then the validation should fail
    And I should see an error message "Configuration contains circular references"