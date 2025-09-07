Feature: Template Filters - Core Inflection Filters
  As a developer using Unjucks templates
  I want to use inflection filters to transform strings
  So that I can generate properly formatted code and file names

  Background:
    Given Nunjucks environment is initialized with common filters
    And the template system is ready

  Scenario: PascalCase conversion for class names
    Given I have a template with content "{{ name | pascalCase }}"
    And the variable "name" has value "user-profile"
    When I render the template
    Then the output should be "UserProfile"

  Scenario: camelCase conversion for property names
    Given I have a template with content "{{ propertyName | camelCase }}"
    And the variable "propertyName" has value "first_name"
    When I render the template
    Then the output should be "firstName"

  Scenario: kebab-case conversion for CSS classes and file names
    Given I have a template with content "{{ componentName | kebabCase }}"
    And the variable "componentName" has value "UserProfileCard"
    When I render the template
    Then the output should be "user-profile-card"

  Scenario: snake_case conversion for database fields
    Given I have a template with content "{{ fieldName | snakeCase }}"
    And the variable "fieldName" has value "createdAt"
    When I render the template
    Then the output should be "created_at"

  Scenario: CONSTANT_CASE conversion for environment variables
    Given I have a template with content "{{ envVar | constantCase }}"
    And the variable "envVar" has value "api-base-url"
    When I render the template
    Then the output should be "API_BASE_URL"

  Scenario: Multiple filters chained together
    Given I have a template with content "{{ name | singular | pascalCase }}"
    And the variable "name" has value "user_posts"
    When I render the template
    Then the output should be "UserPost"

  Scenario: Pluralization for model names
    Given I have a template with content "{{ modelName | pluralize }}"
    And the variable "modelName" has value "category"
    When I render the template
    Then the output should be "categories"

  Scenario: Singularization for class names
    Given I have a template with content "{{ tableName | singular }}"
    And the variable "tableName" has value "users"
    When I render the template
    Then the output should be "user"

  Scenario: Classify filter for ActiveRecord-style class names
    Given I have a template with content "{{ tableName | classify }}"
    And the variable "tableName" has value "user_posts"
    When I render the template
    Then the output should be "UserPost"

  Scenario: Tableize filter for database table names
    Given I have a template with content "{{ className | tableize }}"
    And the variable "className" has value "UserProfile"
    When I render the template
    Then the output should be "user_profiles"

  Scenario: Humanize filter for user-friendly labels
    Given I have a template with content "{{ fieldName | humanize }}"
    And the variable "fieldName" has value "user_name"
    When I render the template
    Then the output should be "User name"

  Scenario: Slug filter for URL-friendly strings
    Given I have a template with content "{{ title | slug }}"
    And the variable "title" has value "My Awesome Blog Post!"
    When I render the template
    Then the output should be "my-awesome-blog-post"

  Scenario: Title case for headings
    Given I have a template with content "{{ heading | titleCase }}"
    And the variable "heading" has value "user management system"
    When I render the template
    Then the output should be "User Management System"

  Scenario: Sentence case for descriptions
    Given I have a template with content "{{ description | sentenceCase }}"
    And the variable "description" has value "user_profile_component"
    When I render the template
    Then the output should be "User profile component"

  Scenario: Demodulize to extract class name from namespace
    Given I have a template with content "{{ fullClassName | demodulize }}"
    And the variable "fullClassName" has value "Admin::Users::ProfileController"
    When I render the template
    Then the output should be "ProfileController"

  Scenario: Filter with non-string input should pass through
    Given I have a template with content "{{ number | pascalCase }}"
    And the variable "number" has value 123
    When I render the template
    Then the output should be "123"

  Scenario: Filter with empty string should handle gracefully
    Given I have a template with content "{{ emptyString | camelCase }}"
    And the variable "emptyString" has value ""
    When I render the template
    Then the output should be ""

  Scenario: Complex component generation with multiple filters
    Given I have a template with content:
      """
      class {{ componentName | classify }} extends Component {
        static displayName = '{{ componentName | humanize }}';
        static cssClass = '{{ componentName | kebabCase }}';
        
        constructor(props) {
          super(props);
          this.{{ componentName | camelCase }}Ref = React.createRef();
        }
      }
      """
    And the variable "componentName" has value "user_profile_cards"
    When I render the template
    Then the output should contain "class UserProfileCard extends Component"
    And the output should contain "static displayName = 'User profile cards'"
    And the output should contain "static cssClass = 'user-profile-cards'"
    And the output should contain "this.userProfileCardsRef = React.createRef()"

  Scenario: Database model generation with inflection
    Given I have a template with content:
      """
      export class {{ modelName | classify }} extends Model {
        static tableName = '{{ modelName | tableize }}';
        static primaryKey = '{{ modelName | singular | snakeCase }}_id';
        
        get {{ modelName | pluralize | camelCase }}() {
          return this.hasMany({{ modelName | classify }});
        }
      }
      """
    And the variable "modelName" has value "blog-post"
    When I render the template
    Then the output should contain "export class BlogPost extends Model"
    And the output should contain "static tableName = 'blog_posts'"
    And the output should contain "static primaryKey = 'blog_post_id'"
    And the output should contain "get blogPosts()"
    And the output should contain "return this.hasMany(BlogPost)"