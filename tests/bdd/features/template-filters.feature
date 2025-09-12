Feature: KGEN Custom Template Filters
  As a developer using KGEN templates
  I want to use built-in and custom filters for string transformations
  So that I can format code according to different naming conventions and patterns

  Background:
    Given KGEN template engine is initialized with deterministic filters
    And all standard filters are registered and available
    And filter usage tracking is enabled

  Scenario Outline: String case transformation filters
    Given a template with content "{{ input | <filter> }}"
    And template variable "input" with value "<input_value>"
    When I render the template
    Then the output should be "<expected_output>"
    And the filter should be deterministic across multiple renders

    Examples:
      | filter        | input_value          | expected_output      |
      | camelCase     | user-profile         | userProfile          |
      | camelCase     | USER_PROFILE         | userProfile          |
      | camelCase     | user profile         | userProfile          |
      | camelCase     | UserProfile          | userProfile          |
      | camelCase     | user_profile_data    | userProfileData      |
      | pascalCase    | user-profile         | UserProfile          |
      | pascalCase    | user_profile         | UserProfile          |
      | pascalCase    | user profile         | UserProfile          |
      | pascalCase    | userProfile          | UserProfile          |
      | pascalCase    | USER_PROFILE         | UserProfile          |
      | kebabCase     | UserProfile          | user-profile         |
      | kebabCase     | userProfile          | user-profile         |
      | kebabCase     | USER_PROFILE         | user-profile         |
      | kebabCase     | user profile         | user-profile         |
      | kebabCase     | UserProfileCard      | user-profile-card    |
      | snakeCase     | getUserProfile       | get_user_profile     |
      | snakeCase     | UserProfile          | user_profile         |
      | snakeCase     | user-profile         | user_profile         |
      | snakeCase     | user profile         | user_profile         |
      | snakeCase     | getXMLHttpRequest    | get_xml_http_request |
      | constantCase  | apiUrl               | API_URL              |
      | constantCase  | maxRetryCount        | MAX_RETRY_COUNT      |
      | constantCase  | user-profile         | USER_PROFILE         |
      | constantCase  | DatabaseConfig       | DATABASE_CONFIG      |

  Scenario: String manipulation filters
    Given a template with content:
      """
      Original: "{{ text }}"
      Upper First: "{{ text | upperFirst }}"
      Lower First: "{{ text | lowerFirst }}"
      Upper: "{{ text | upper }}"
      Lower: "{{ text | lower }}"
      Title: "{{ text | title }}"
      Trim: "{{ textWithSpaces | trim }}"
      """
    And template variables:
      """
      {
        "text": "hello world example",
        "textWithSpaces": "  hello world  "
      }
      """
    When I render the template
    Then the output should contain:
      """
      Original: "hello world example"
      Upper First: "Hello world example"
      Lower First: "hello world example"
      Upper: "HELLO WORLD EXAMPLE"
      Lower: "hello world example"
      Title: "Hello World Example"
      Trim: "hello world"
      """

  Scenario: Pluralization filter with custom rules
    Given a template with content "{{ count }} {{ itemName | pluralize(count) }}"
    And template variables with different counts and nouns:
      | count | itemName  | expected_output |
      | 0     | item      | 0 items         |
      | 1     | item      | 1 item          |
      | 2     | item      | 2 items         |
      | 1     | child     | 1 child         |
      | 2     | child     | 2 children      |
      | 1     | person    | 1 person        |
      | 2     | person    | 2 people        |
      | 1     | goose     | 1 goose         |
      | 2     | goose     | 2 geese         |
      | 1     | mouse     | 1 mouse         |
      | 2     | mouse     | 2 mice          |
    When I render the template with each input combination
    Then the output should match the expected pluralization
    And irregular plurals should be handled correctly

  Scenario: Filter chaining for complex transformations
    Given a template with content:
      """
      Class: {{ entityName | camelCase | upperFirst }}Service
      Constant: {{ entityName | snakeCase | upper }}
      File: {{ entityName | kebabCase }}.entity.ts
      Interface: I{{ entityName | pascalCase }}Repository
      """
    And template variables:
      """
      {
        "entityName": "user-profile-manager"
      }
      """
    When I render the template
    Then the output should be:
      """
      Class: UserProfileManagerService
      Constant: USER_PROFILE_MANAGER
      File: user-profile-manager.entity.ts
      Interface: IUserProfileManagerRepository
      """
    And filter chains should be applied in correct order

  Scenario: Array and object manipulation filters
    Given a template with content:
      """
      Sorted: {{ items | sort | join(', ') }}
      First: {{ items | first }}
      Last: {{ items | last }}
      Length: {{ items | length }}
      Reversed: {{ items | reverse | join(' -> ') }}
      Unique: {{ duplicates | unique | join(', ') }}
      """
    And template variables:
      """
      {
        "items": ["zebra", "apple", "banana", "cherry"],
        "duplicates": ["a", "b", "a", "c", "b", "d"]
      }
      """
    When I render the template
    Then the output should contain:
      """
      Sorted: apple, banana, cherry, zebra
      First: zebra
      Last: cherry
      Length: 4
      Reversed: cherry -> banana -> apple -> zebra
      Unique: a, b, c, d
      """

  Scenario: JSON and serialization filters
    Given a template with content:
      """
      Pretty JSON:
      {{ config | json(2) }}
      
      Compact JSON: {{ config | json }}
      YAML: {{ config | yaml }}
      """
    And template variables:
      """
      {
        "config": {
          "name": "MyApp",
          "version": "1.0.0",
          "features": ["auth", "api", "db"],
          "database": {
            "host": "localhost",
            "port": 5432
          }
        }
      }
      """
    When I render the template
    Then the JSON output should be valid and properly formatted
    And pretty JSON should have 2-space indentation
    And compact JSON should be minified
    And YAML output should be valid YAML format

  Scenario: Path and filename filters
    Given a template with content:
      """
      Directory: {{ fullPath | dirname }}
      Filename: {{ fullPath | basename }}
      Extension: {{ fullPath | extname }}
      Name without ext: {{ fullPath | basename | replace(fullPath | extname, '') }}
      Relative: {{ fullPath | relative('/src') }}
      """
    And template variables:
      """
      {
        "fullPath": "/src/components/user/UserProfile.component.tsx"
      }
      """
    When I render the template
    Then the output should contain:
      """
      Directory: /src/components/user
      Filename: UserProfile.component.tsx
      Extension: .tsx
      Name without ext: UserProfile.component
      Relative: components/user/UserProfile.component.tsx
      """

  Scenario: Date and time formatting filters
    Given a template with content:
      """
      ISO Date: {{ timestamp | isoDate }}
      Formatted: {{ timestamp | dateFormat('YYYY-MM-DD HH:mm:ss') }}
      Relative: {{ timestamp | fromNow }}
      Year: {{ timestamp | year }}
      """
    And template variables:
      """
      {
        "timestamp": "2023-12-25T14:30:00.000Z"
      }
      """
    When I render the template
    Then date formatting should be applied correctly
    And different date formats should be supported
    And output should be deterministic for same input

  Scenario: Mathematical and numeric filters
    Given a template with content:
      """
      Round: {{ price | round }}
      Ceil: {{ price | ceil }}
      Floor: {{ price | floor }}
      Fixed: {{ price | fixed(2) }}
      Percent: {{ ratio | percent }}
      Currency: {{ amount | currency('USD') }}
      """
    And template variables:
      """
      {
        "price": 29.789,
        "ratio": 0.75,
        "amount": 1234.56
      }
      """
    When I render the template
    Then numeric formatting should be applied correctly
    And precision should be maintained as specified
    And currency formatting should include proper symbols

  Scenario: Regular expression filters
    Given a template with content:
      """
      Match: {{ text | regex('[A-Z]+') }}
      Replace: {{ text | regexReplace('[0-9]+', 'NUM') }}
      Split: {{ text | split('-') | join(' | ') }}
      Test: {{ email | test('^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$') }}
      """
    And template variables:
      """
      {
        "text": "ABC-123-def-456",
        "email": "user@example.com"
      }
      """
    When I render the template
    Then regex operations should work correctly
    And pattern matching should be accurate
    And replacements should be applied properly

  Scenario: Conditional and default filters
    Given a template with content:
      """
      Name: {{ user.name | default('Anonymous') }}
      Email: {{ user.email | default('No email provided') }}
      Age: {{ user.age | default(0) }}
      Active: {{ user.isActive | default(false) }}
      """
    And template variables:
      """
      {
        "user": {
          "name": null,
          "email": "",
          "age": undefined
        }
      }
      """
    When I render the template
    Then default values should be used for null/empty values
    And type-appropriate defaults should be applied
    And undefined properties should use defaults

  Scenario: Custom business logic filters
    Given custom filters are registered:
      | Name           | Function                                    |
      | truncate       | Truncate string to specified length        |
      | initials       | Extract initials from full name             |
      | slugify        | Convert to URL-friendly slug                |
      | highlight      | Wrap search terms in HTML highlights       |
    And a template with content:
      """
      Truncated: {{ description | truncate(50) }}
      Initials: {{ fullName | initials }}
      Slug: {{ title | slugify }}
      Highlighted: {{ content | highlight(searchTerm) }}
      """
    And template variables:
      """
      {
        "description": "This is a very long description that should be truncated",
        "fullName": "John Michael Smith",
        "title": "Advanced TypeScript Patterns & Best Practices",
        "content": "TypeScript provides excellent type safety",
        "searchTerm": "TypeScript"
      }
      """
    When I render the template
    Then custom filters should be applied correctly
    And business logic should be encapsulated in filters
    And complex transformations should work as expected

  Scenario: Filter error handling and validation
    Given a template with content "{{ value | nonExistentFilter }}"
    And template variables {"value": "test"}
    When I render the template
    Then an appropriate error should be thrown
    And error message should identify the missing filter
    And error should include helpful debugging information

  Scenario: Performance optimization with filter caching
    Given a computationally expensive filter "slowTransform"
    And a template that applies the filter multiple times
    When I render the template with caching enabled
    Then filter results should be cached for identical inputs
    And performance should improve for repeated filter usage
    And cache statistics should be tracked

  Scenario: Filter compatibility with RDF data
    Given RDF triples containing entity metadata
    And filters that process RDF query results
    And a template with content:
      """
      {% for entity in rdf.getEntitiesByType('Class') %}
      export class {{ entity.name | pascalCase }} {
        {% for prop in entity.properties | sortBy('name') %}
        {{ prop.name | camelCase }}: {{ prop.type | mapRDFType }};
        {% endfor %}
      }
      {% endfor %}
      """
    When I render the template with RDF filters enabled
    Then RDF data should be filtered and transformed correctly
    And custom RDF mapping filters should work
    And generated code should reflect RDF schema

  Scenario: Deterministic filter behavior validation
    Given a template using various filters
    And the same input data
    When I render the template multiple times
    Then all filter outputs should be identical across renders
    And no randomness should be introduced by filters
    And deterministic hashing should work consistently

  Scenario: Filter composition and advanced usage
    Given a template with complex filter composition:
      """
      {% set processedItems = items | 
          filterBy('active', true) | 
          sortBy('priority') | 
          map('name') | 
          unique | 
          join(', ') %}
      Active items: {{ processedItems }}
      """
    And template variables with complex data structures
    When I render the template
    Then filter pipeline should process data correctly
    And each filter should receive proper input from previous filter
    And final result should be accurately computed