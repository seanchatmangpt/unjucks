Feature: Nunjucks Template Filters
  As a developer using Unjucks templates
  I want to use built-in and custom filters to transform variables
  So that I can format output according to different conventions

  Background:
    Given the Nunjucks template system is initialized with filters
    And template variables are available

  Scenario: Apply camelCase filter
    Given a template with content "{{ variableName | camelCase }}"
    And variables:
      | Input                | Expected Output    |
      | user-profile        | userProfile        |
      | USER_PROFILE        | userProfile        |
      | user profile        | userProfile        |
      | UserProfile         | userProfile        |
      | user_profile_data   | userProfileData    |
    When I render the template with each input
    Then the output should match the expected camelCase format

  Scenario: Apply upperFirst filter
    Given a template with content "{{ text | upperFirst }}"
    And variables:
      | Input           | Expected Output |
      | hello world     | Hello world     |
      | HELLO WORLD     | HELLO WORLD     |
      | hello           | Hello           |
      | h               | H               |
      | ""              | ""              |
    When I render the template with each input
    Then the first character should be uppercase
    And remaining characters should be unchanged

  Scenario: Apply kebabCase filter
    Given a template with content "{{ componentName | kebabCase }}"
    And variables:
      | Input              | Expected Output      |
      | UserProfile        | user-profile         |
      | userProfile        | user-profile         |
      | USER_PROFILE       | user-profile         |
      | user profile       | user-profile         |
      | UserProfileCard    | user-profile-card    |
    When I render the template with each input
    Then the output should be in kebab-case format

  Scenario: Apply snakeCase filter
    Given a template with content "{{ functionName | snakeCase }}"
    And variables:
      | Input              | Expected Output      |
      | getUserProfile     | get_user_profile     |
      | UserProfile        | user_profile         |
      | user-profile       | user_profile         |
      | user profile       | user_profile         |
      | getXMLHttpRequest  | get_xml_http_request |
    When I render the template with each input
    Then the output should be in snake_case format

  Scenario: Apply pascalCase filter
    Given a template with content "{{ className | pascalCase }}"
    And variables:
      | Input              | Expected Output    |
      | user-profile       | UserProfile        |
      | user_profile       | UserProfile        |
      | user profile       | UserProfile        |
      | userProfile        | UserProfile        |
      | USER_PROFILE       | UserProfile        |
    When I render the template with each input
    Then the output should be in PascalCase format

  Scenario: Apply constantCase filter
    Given a template with content "{{ configName | constantCase }}"
    And variables:
      | Input              | Expected Output      |
      | apiUrl             | API_URL              |
      | maxRetryCount      | MAX_RETRY_COUNT      |
      | user-profile       | USER_PROFILE         |
      | DatabaseConfig     | DATABASE_CONFIG      |
    When I render the template with each input
    Then the output should be in CONSTANT_CASE format

  Scenario: Chain multiple filters
    Given a template with content "{{ input | camelCase | upperFirst }}"
    And variables:
      | Input              | Expected Output    |
      | user-profile       | UserProfile        |
      | api-client         | ApiClient          |
      | database_config    | DatabaseConfig     |
    When I render the template with each input
    Then filters should be applied in sequence
    And final output should reflect all transformations

  Scenario: Apply pluralize filter
    Given a template with content "{{ count }} {{ itemName | pluralize(count) }}"
    And variables:
      | Count | ItemName | Expected Output |
      | 1     | item     | 1 item         |
      | 2     | item     | 2 items        |
      | 0     | item     | 0 items        |
      | 1     | child    | 1 child        |
      | 2     | child    | 2 children     |
    When I render the template with each input
    Then singular form should be used for count of 1
    And plural form should be used for other counts

  Scenario: Apply default filter with fallback values
    Given a template with content "{{ value | default('DefaultValue') }}"
    And variables:
      | Value     | Expected Output |
      | null      | DefaultValue    |
      | undefined | DefaultValue    |
      | ""        | DefaultValue    |
      | "actual"  | actual          |
      | 0         | 0               |
      | false     | false           |
    When I render the template with each input
    Then empty/null values should use default
    And falsy but meaningful values should pass through

  Scenario: Apply json filter for object serialization
    Given a template with content "{{ config | json }}"
    And variables:
      """
      {
        "config": {
          "name": "MyApp",
          "version": "1.0.0",
          "features": ["auth", "api"]
        }
      }
      """
    When I render the template
    Then the output should be valid JSON string
    And object structure should be preserved

  Scenario: Apply escape filter for HTML safety
    Given a template with content "{{ userInput | escape }}"
    And variables:
      | Input                      | Expected Output                  |
      | <script>alert('xss')</script> | &lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt; |
      | "Hello & Goodbye"          | &quot;Hello &amp; Goodbye&quot;      |
      | 'Single quotes'            | &#39;Single quotes&#39;         |
    When I render the template with each input
    Then HTML special characters should be escaped
    And output should be safe for HTML rendering

  Scenario: Apply trim filter for whitespace
    Given a template with content "'{{ text | trim }}'"
    And variables:
      | Input            | Expected Output |
      | "  hello  "      | 'hello'         |
      | "\n\tworld\t\n"  | 'world'         |
      | "no-spaces"      | 'no-spaces'     |
      | "   "            | ''              |
    When I render the template with each input
    Then leading and trailing whitespace should be removed
    And internal whitespace should be preserved

  Scenario: Apply custom path filters
    Given a template with content "{{ filePath | dirname }}/{{ fileName | basename }}"
    And variables:
      | FilePath              | FileName         | Expected Output        |
      | /src/components/      | Button.tsx       | /src/components/Button |
      | ./utils/             | helper.ts        | ./utils/helper         |
      | /absolute/path/      | index.js         | /absolute/path/index   |
    When I render the template with each input
    Then path should be correctly split and processed

  Scenario: Apply array manipulation filters
    Given a template with content:
      """
      {% for item in items | sort %}{{ item }}{% endfor %}
      First: {{ items | first }}
      Last: {{ items | last }}
      Length: {{ items | length }}
      """
    And variables:
      """
      {
        "items": ["zebra", "apple", "banana"]
      }
      """
    When I render the template
    Then items should be sorted alphabetically
    And first/last items should be correctly identified
    And length should be accurate

  Scenario: Handle filter errors gracefully
    Given a template with content "{{ value | nonExistentFilter }}"
    And variables {"value": "test"}
    When I render the template
    Then an appropriate error should be thrown
    And error message should identify the unknown filter

  Scenario: Apply conditional filters based on variable type
    Given a template with content:
      """
      {% if value is string %}
      String: {{ value | upperFirst }}
      {% elif value is number %}
      Number: {{ value | round }}
      {% elif value is object %}
      Object: {{ value | json }}
      {% endif %}
      """
    And variables with different types
    When I render the template
    Then appropriate filter should be applied based on type
    And type detection should work correctly

  Scenario: Custom date formatting filters
    Given a template with content "{{ timestamp | dateFormat('YYYY-MM-DD') }}"
    And variables {"timestamp": "2023-12-25T10:30:00Z"}
    When I render the template
    Then date should be formatted according to pattern
    And timezone handling should be consistent

  Scenario: Apply regex filters for pattern matching
    Given a template with content:
      """
      Match: {{ text | regex('[A-Z]+') }}
      Replace: {{ text | regexReplace('[0-9]+', 'X') }}
      """
    And variables {"text": "ABC123def456"}
    When I render the template
    Then regex patterns should be applied correctly
    And replacements should work as expected

  Scenario: Combine filters with conditional logic
    Given a template with content:
      """
      {% set processedName = name | camelCase if useCamelCase else name | kebabCase %}
      Result: {{ processedName | upperFirst }}
      """
    And variables:
      | Name          | UseCamelCase | Expected Output |
      | user-profile  | true         | UserProfile     |
      | user-profile  | false        | User-profile    |
    When I render the template with each input
    Then conditional filter application should work
    And chained filters should process correctly