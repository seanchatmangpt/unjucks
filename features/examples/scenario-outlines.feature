Feature: Scenario Outlines and Parameterized Testing
  As a developer using unjucks
  I want to see comprehensive scenario outline examples
  So that I can efficiently test multiple similar cases

  Background:
    Given I have a clean test workspace
    And I have templates in "_templates" directory

  @scenario-outline @framework-generation
  Scenario Outline: Generate components for different frameworks
    Given I have a "<framework>" generator with standard templates
    When I run unjucks generate <framework> with variables:
      | componentName | <componentName> |
      | withTests     | <withTests>     |
      | withStyles    | <withStyles>    |
      | framework     | <framework>     |
    Then the file "<expectedPath>" should exist
    And the file should contain "<frameworkSpecific>"
    And the command should complete within <maxTime> seconds

    Examples: Frontend Frameworks
      | framework | componentName | withTests | withStyles | expectedPath                    | frameworkSpecific        | maxTime |
      | react     | Button        | true      | true       | src/components/Button.tsx       | React.FC                | 5       |
      | vue       | Button        | true      | true       | src/components/Button.vue       | <template>              | 5       |
      | angular   | Button        | true      | true       | src/components/button.component.ts | @Component           | 5       |
      | svelte    | Button        | false     | true       | src/components/Button.svelte    | <script>                | 5       |

    Examples: Backend Frameworks
      | framework | componentName | withTests | withStyles | expectedPath                    | frameworkSpecific        | maxTime |
      | express   | UserService   | true      | false      | src/services/UserService.ts     | import express          | 3       |
      | fastify   | UserService   | true      | false      | src/services/UserService.ts     | import fastify          | 3       |
      | koa       | UserService   | false     | false      | src/services/UserService.ts     | import koa              | 3       |

  @scenario-outline @database-models
  Scenario Outline: Generate database models with different ORMs
    Given I have a "<orm>" generator configured
    When I generate a model with:
      | modelName | <modelName> |
      | fields    | <fields>    |
      | orm       | <orm>       |
    Then the file "<expectedFile>" should exist
    And the model should have "<expectedAnnotations>"
    And the model should include "<expectedMethods>"

    Examples:
      | orm        | modelName | fields                    | expectedFile           | expectedAnnotations | expectedMethods    |
      | typeorm    | User      | name:string,email:string  | src/entities/User.ts   | @Entity             | save,find         |
      | prisma     | User      | name:string,email:string  | src/models/User.ts     | model User          | create,findMany   |
      | sequelize  | User      | name:string,email:string  | src/models/User.js     | sequelize.define    | create,findAll    |
      | mongoose   | User      | name:string,email:string  | src/models/User.js     | mongoose.Schema     | save,find         |

  @scenario-outline @testing-patterns
  Scenario Outline: Generate tests for different testing frameworks
    Given I have a "<testFramework>" generator
    When I generate tests for component "<componentName>" with:
      | testType      | <testType>      |
      | framework     | <testFramework> |
      | coverage      | <coverage>      |
    Then the test file "<testFile>" should exist
    And the test should use "<testingLibrary>"
    And coverage should be at least <coverage>%

    Examples:
      | testFramework | componentName | testType    | coverage | testFile                           | testingLibrary      |
      | jest          | Button        | unit        | 90       | src/components/__tests__/Button.test.ts | @testing-library  |
      | vitest        | Button        | unit        | 85       | src/components/Button.test.ts      | @testing-library    |
      | mocha         | Button        | unit        | 80       | test/components/Button.spec.ts     | chai                |
      | jasmine       | Button        | unit        | 85       | spec/components/ButtonSpec.js      | jasmine             |
      | playwright    | LoginForm     | e2e         | 70       | tests/e2e/LoginForm.spec.ts        | playwright          |
      | cypress       | LoginForm     | e2e         | 75       | cypress/e2e/LoginForm.cy.ts        | cypress             |

  @scenario-outline @configuration-files
  Scenario Outline: Generate configuration files for different environments
    Given I have a "config" generator
    When I generate configuration for "<environment>" with:
      | configType    | <configType>    |
      | environment   | <environment>   |
      | format        | <format>        |
    Then the config file "<configFile>" should exist
    And the config should contain "<environmentSpecific>"
    And the file should be valid <format>

    Examples: Development Configurations
      | environment | configType | format | configFile              | environmentSpecific |
      | development | database   | json   | config/database.json    | localhost          |
      | development | api        | yaml   | config/api.yaml         | debug: true        |
      | development | cache      | env    | .env.development        | CACHE_TTL=60       |

    Examples: Production Configurations
      | environment | configType | format | configFile              | environmentSpecific |
      | production  | database   | json   | config/database.json    | pool_size          |
      | production  | api        | yaml   | config/api.yaml         | debug: false       |
      | production  | cache      | env    | .env.production         | CACHE_TTL=3600     |

  @scenario-outline @internationalization
  Scenario Outline: Generate i18n files for multiple locales
    Given I have an "i18n" generator
    When I generate translations for "<locale>" with:
      | namespace | <namespace> |
      | format    | <format>    |
    Then the translation file "<translationFile>" should exist
    And the file should contain "<localeSpecificKey>"
    And the file should be valid <format>

    Examples:
      | locale | namespace | format | translationFile           | localeSpecificKey |
      | en-US  | common    | json   | locales/en-US/common.json | "language": "English" |
      | es-ES  | common    | json   | locales/es-ES/common.json | "language": "Español" |
      | fr-FR  | common    | yaml   | locales/fr-FR/common.yaml | language: Français    |
      | de-DE  | common    | yaml   | locales/de-DE/common.yaml | language: Deutsch     |
      | ja-JP  | common    | json   | locales/ja-JP/common.json | "language": "日本語"  |

  @scenario-outline @dry-run-validation
  Scenario Outline: Validate dry run behavior across generators
    Given I have a "<generator>" generator configured
    When I run generation in dry mode with:
      | target     | <target>     |
      | options    | <options>    |
    Then the dry run should show <fileCount> files would be generated
    And no actual files should be created
    And the output should contain "<dryRunIndicator>"

    Examples:
      | generator  | target        | options              | fileCount | dryRunIndicator |
      | component  | UserProfile   | withTests=true       | 3         | [DRY RUN]      |
      | api        | UserAPI       | withAuth=true        | 5         | would create   |
      | service    | EmailService  | withQueue=true       | 4         | would generate |
      | model      | UserModel     | withValidation=true  | 2         | [DRY RUN]      |

  @scenario-outline @error-handling
  Scenario Outline: Error handling for invalid inputs
    Given I have a "<generator>" generator
    When I attempt to generate with invalid input:
      | field  | value   |
      | <field>| <value> |
    Then the command should fail
    And the error should contain "<expectedError>"
    And the exit code should be <exitCode>

    Examples: Validation Errors
      | generator | field | value | expectedError           | exitCode |
      | component | name  | ""    | Name cannot be empty    | 1        |
      | component | name  | "123" | Invalid component name  | 1        |
      | api       | method| "XXX" | Invalid HTTP method     | 1        |
      | model     | type  | "???" | Invalid field type      | 1        |

  @scenario-outline @injection-scenarios
  Scenario Outline: File injection with different patterns
    Given I have a file "<targetFile>" with placeholder content
    And I have an injection template for "<injectionType>"
    When I inject "<content>" using pattern "<pattern>"
    Then the content should be injected at the correct position
    And the original content should be preserved
    And the injection should be idempotent

    Examples:
      | targetFile        | injectionType | pattern    | content                     |
      | src/routes.ts     | route         | after      | app.get('/users', handler)  |
      | src/middleware.ts | middleware    | before     | app.use(cors())            |
      | package.json      | dependency    | merge      | "lodash": "^4.17.21"       |
      | src/types.ts      | interface     | append     | export interface User {}    |

  @scenario-outline @performance-testing
  Scenario Outline: Performance validation across different scales
    Given I have a "<generator>" generator
    When I generate <itemCount> items of type "<itemType>"
    Then the generation should complete within <maxTime> seconds
    And memory usage should stay below <maxMemory> MB
    And all <itemCount> files should be created successfully

    Examples:
      | generator | itemType   | itemCount | maxTime | maxMemory |
      | component | Component  | 10        | 5       | 50        |
      | component | Component  | 50        | 15      | 100       |
      | service   | Service    | 25        | 8       | 75        |
      | model     | Model      | 100       | 30      | 150       |