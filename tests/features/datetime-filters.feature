Feature: DateTime Filters - Day.js Integration
  As a developer using Unjucks templates
  I want to use date and time filters with Day.js integration
  So that I can generate timestamps, format dates, and handle time zones

  Background:
    Given Nunjucks environment is initialized with datetime filters
    And Day.js library is available for advanced date operations
    And the template system is ready

  Scenario: Current timestamp generation
    Given I have a template with content "{{ timestamp() }}"
    When I render the template
    Then the output should match the pattern "^\d{14}$"
    And the output should represent the current timestamp in YYYYMMDDHHMMSS format

  Scenario: ISO datetime for database timestamps
    Given I have a template with content "{{ now() }}"
    When I render the template
    Then the output should match the pattern "^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$"
    And the output should be a valid ISO datetime without milliseconds

  Scenario: Custom date formatting with formatDate
    Given I have a template with content "{{ formatDate(customDate, 'YYYY-MM-DD') }}"
    And the variable "customDate" has value "2023-12-25T10:30:00Z"
    When I render the template
    Then the output should be "2023-12-25"

  Scenario: Default date formatting
    Given I have a template with content "{{ formatDate() }}"
    When I render the template
    Then the output should match the pattern "^\d{4}-\d{2}-\d{2}$"
    And the output should be today's date in YYYY-MM-DD format

  Scenario: Migration timestamp generation
    Given I have a template with content:
      """
      exports.up = function(knex) {
        return knex.schema.createTable('{{ tableName | snakeCase }}', function(table) {
          table.increments('id');
          table.timestamp('created_at').defaultTo(knex.fn.now());
          table.timestamp('updated_at').defaultTo(knex.fn.now());
        });
      };
      
      // Migration created at: {{ timestamp() }}
      """
    And the variable "tableName" has value "user-profiles"
    When I render the template
    Then the output should contain "createTable('user_profiles'"
    And the output should contain "// Migration created at:"
    And the output should contain a 14-digit timestamp

  Scenario: Component with creation timestamp
    Given I have a template with content:
      """
      /**
       * {{ componentName | humanize }}
       * Generated on {{ formatDate() }} at {{ timestamp() }}
       */
      export class {{ componentName | pascalCase }} {
        constructor() {
          this.createdAt = '{{ now() }}';
          this.version = '{{ formatDate() | replace('-', '.') }}';
        }
      }
      """
    And the variable "componentName" has value "user_service"
    When I render the template
    Then the output should contain "* User service"
    And the output should contain "* Generated on" 
    And the output should contain "export class UserService"
    And the output should contain "this.createdAt = '"
    And the createdAt value should be a valid datetime string

  Scenario: API endpoint with versioning using dates
    Given I have a template with content:
      """
      export const {{ serviceName | constantCase }}_ENDPOINTS = {
        base: '/api/v{{ formatDate() | replace('-', '') | slice(0, 8) }}',
        {{ resourceName | camelCase }}: '/{{ resourceName | kebabCase }}',
        created: '{{ now() }}'
      };
      """
    And the variable "serviceName" has value "user-api"
    And the variable "resourceName" has value "user_profiles"
    When I render the template
    Then the output should contain "USER_API_ENDPOINTS"
    And the output should contain "base: '/api/v20"
    And the output should contain "userProfiles: '/user-profiles'"
    And the output should contain "created: '"

  Scenario: Log file naming with timestamp
    Given I have a template with content:
      """
      import winston from 'winston';
      
      const logger = winston.createLogger({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        transports: [
          new winston.transports.File({ 
            filename: '{{ logName | kebabCase }}-{{ timestamp() }}.log' 
          })
        ]
      });
      
      export default logger;
      """
    And the variable "logName" has value "ErrorHandler"
    When I render the template
    Then the output should contain "filename: 'error-handler-"
    And the output should contain a 14-digit timestamp before ".log'"

  Scenario: Scheduled task configuration
    Given I have a template with content:
      """
      export const {{ taskName | constantCase }}_SCHEDULE = {
        name: '{{ taskName | humanize }}',
        pattern: '0 0 * * *', // Daily at midnight
        timezone: 'UTC',
        created: '{{ formatDate() }}',
        lastRun: null,
        nextRun: null
      };
      """
    And the variable "taskName" has value "data_backup"
    When I render the template
    Then the output should contain "DATA_BACKUP_SCHEDULE"
    And the output should contain "name: 'Data backup'"
    And the output should contain "created: '"
    And the created value should be in YYYY-MM-DD format

  Scenario: Database seed file with timestamps
    Given I have a template with content:
      """
      exports.seed = function(knex) {
        return knex('{{ tableName | tableize }}').del()
          .then(function () {
            return knex('{{ tableName | tableize }}').insert([
              { name: 'Admin User', created_at: '{{ now() }}', updated_at: '{{ now() }}' },
              { name: 'Test User', created_at: '{{ now() }}', updated_at: '{{ now() }}' }
            ]);
          });
      };
      """
    And the variable "tableName" has value "User"
    When I render the template
    Then the output should contain "knex('users')"
    And the output should contain "created_at: '"
    And the output should contain "updated_at: '"
    And all timestamps should be valid datetime strings

  Scenario: Cache key generation with date
    Given I have a template with content:
      """
      export class {{ serviceName | pascalCase }}Cache {
        constructor() {
          this.keyPrefix = '{{ serviceName | kebabCase }}:{{ formatDate() | replace('-', '') }}';
          this.defaultTTL = 3600; // 1 hour
        }
        
        generateKey(id) {
          return `${this.keyPrefix}:${id}:{{ timestamp() }}`;
        }
      }
      """
    And the variable "serviceName" has value "user_data"
    When I render the template
    Then the output should contain "export class UserDataCache"
    And the output should contain "this.keyPrefix = 'user-data:20"
    And the output should contain ":{{ timestamp() }}"

  Scenario: Configuration file with environment timestamps
    Given I have a template with content:
      """
      export default {
        app: {
          name: '{{ appName | humanize }}',
          version: '1.0.0',
          buildTime: '{{ now() }}',
          buildId: '{{ timestamp() }}'
        },
        database: {
          migrationDate: '{{ formatDate() }}',
          seedTime: '{{ now() }}'
        }
      };
      """
    And the variable "appName" has value "my-awesome-app"
    When I render the template
    Then the output should contain "name: 'My awesome app'"
    And the output should contain "buildTime: '"
    And the output should contain "buildId: '"
    And the output should contain "migrationDate: '"
    And all date values should be properly formatted

  Scenario: API response template with timestamps
    Given I have a template with content:
      """
      export const {{ responseType | constantCase }}_RESPONSE = {
        success: true,
        data: null,
        meta: {
          timestamp: '{{ now() }}',
          version: 'v{{ formatDate() | replace('-', '.') }}',
          requestId: '{{ timestamp() }}'
        }
      };
      """
    And the variable "responseType" has value "user-profile"
    When I render the template
    Then the output should contain "USER_PROFILE_RESPONSE"
    And the output should contain "timestamp: '"
    And the output should contain "version: 'v20"
    And the output should contain "requestId: '"

  Scenario: Invalid date handling
    Given I have a template with content "{{ formatDate(invalidDate) }}"
    And the variable "invalidDate" has value "not-a-date"
    When I render the template
    Then the output should be a valid date string
    And the result should handle the invalid input gracefully