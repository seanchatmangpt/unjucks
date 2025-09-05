@advanced @ontology
Feature: Ontology Integration (Untology)
  As a developer using advanced code generation
  I want to leverage semantic ontologies for intelligent context
  So that I can generate more accurate and contextually relevant code

  Background:
    Given an Unjucks project with ontology support enabled
    And the following ontology is defined:
      """
      @context:
        user: "http://schema.org/Person"
        organization: "http://schema.org/Organization"
        api: "http://swagger.io/specification"
        database: "http://schema.org/Database"
      
      entities:
        User:
          type: user
          properties:
            - id: string
            - email: string
            - profile: UserProfile
          relationships:
            - belongsTo: Organization
            - hasMany: Posts
        
        Organization:
          type: organization
          properties:
            - name: string
            - domain: string
          relationships:
            - hasMany: Users
      """

  @semantic-context
  Scenario: Loading semantic context from ontology
    Given a template "api-endpoint" with ontology references
    When I generate with semantic context for entity "User"
    Then the generator should load entity definitions from ontology
    And the template should receive semantic context variables:
      | variable        | value                    |
      | entityType      | user                     |
      | schemaUrl       | http://schema.org/Person |
      | properties      | [id, email, profile]     |
      | relationships   | [belongsTo, hasMany]     |

  @relationship-mapping
  Scenario: Entity relationship mapping
    Given a template "database-migration" with relationship context
    When I generate with entity "User" and include relationships
    Then the template should receive relationship mappings:
      | relationship | targetEntity | cardinality | foreignKey      |
      | belongsTo    | Organization | one-to-many | organization_id |
      | hasMany      | Posts        | one-to-many | user_id         |
    And relationship validation should be available in template

  @intelligent-defaults
  Scenario: Intelligent variable defaults from ontology
    Given a template with undefined variables
    When I generate for entity "User" 
    Then the system should provide intelligent defaults:
      | variable       | default                  | source          |
      | tableName      | users                    | entity name     |
      | primaryKey     | id                       | ontology schema |
      | timestampCols  | [created_at, updated_at] | common pattern  |
      | validationRules| [required email]         | property types  |

  @context-aware-suggestions
  Scenario: Context-aware variable suggestions
    Given I'm generating a template for "User" entity
    When I run unjucks in interactive mode
    Then I should see context-aware suggestions:
      | prompt                    | suggestions                           |
      | "Enter model name"        | User, UserProfile, UserSettings       |
      | "Select validation rules" | email, required, unique, format       |
      | "Choose relationships"    | belongsTo Organization, hasMany Posts |

  @ontology-validation
  Scenario: Ontology schema validation
    Given an invalid ontology definition with circular references
    When I attempt to load the ontology
    Then I should see validation errors:
      | error                    | description                        |
      | circular_reference       | User -> Organization -> User cycle |
      | invalid_property_type    | Property 'age' has invalid type    |
      | missing_required_context | @context missing for entity type  |

  @multi-ontology-support
  Scenario: Multiple ontology sources
    Given multiple ontology files:
      | file              | entities        |
      | base.ontology.yml | User, Role      |
      | app.ontology.yml  | Post, Comment   |
      | api.ontology.yml  | Endpoint, Route |
    When I generate with merged ontology context
    Then all entities should be available for reference
    And namespace conflicts should be resolved with file prefixes

  @semantic-querying
  Scenario: Semantic querying in templates
    Given a template with semantic queries:
      """
      {{# ontology.findEntitiesWithRelationship('hasMany') }}
        // Entity: {{ name }} has many {{ relationship.target }}
      {{/ ontology.findEntitiesWithRelationship }}
      
      {{# ontology.getPropertiesByType('string') }}
        validation.{{ name }}.required();
      {{/ ontology.getPropertiesByType }}
      """
    When I generate with ontology context
    Then the template should query and iterate over semantic results
    And complex ontology relationships should be navigable

  @lazy-loading
  Scenario: Lazy loading of large ontologies
    Given a large ontology file with 1000+ entities
    When I generate for a specific entity "User"
    Then only relevant ontology sections should be loaded
    And memory usage should remain under 50MB
    And generation time should be under 2 seconds

  @ontology-updates
  Scenario: Hot reloading ontology changes
    Given Unjucks is running in watch mode
    And an ontology file is being monitored
    When I update entity relationships in the ontology
    Then templates should automatically reflect ontology changes
    And no restart should be required
    And cached ontology data should be invalidated

  @error-handling
  Scenario Outline: Ontology error handling
    Given an ontology with "<error_type>" error
    When I attempt to generate with the faulty ontology
    Then I should see a clear error message about "<error_description>"
    And generation should fail gracefully
    And I should get suggestions for fixing the ontology

    Examples:
      | error_type          | error_description              |
      | syntax_error        | Invalid YAML syntax            |
      | missing_context     | @context declaration missing   |
      | invalid_reference   | Entity reference not found     |
      | type_mismatch       | Property type doesn't match    |
      | circular_dependency | Circular entity relationships  |

  @performance-caching
  Scenario: Ontology parsing and caching
    Given a complex ontology with nested relationships
    When I generate multiple templates using the same ontology
    Then the ontology should be parsed once and cached
    And subsequent generations should use cached ontology data
    And cache invalidation should work when ontology files change

  @integration-external-schemas
  Scenario: Integration with external schema sources
    Given external schema sources are configured:
      | source      | url                           |
      | json-schema | https://schema.org/Person     |
      | openapi     | ./api/swagger.yml             |
      | graphql     | ./schema.graphql              |
    When I generate with external schema integration
    Then entities should be enriched with external schema data
    And schema validation should incorporate external constraints
    And generation should work offline with cached schemas