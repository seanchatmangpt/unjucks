@core @cas @generation @deterministic @performance
Feature: Content-Addressed Storage Core Generation
  As a developer using the kgen system
  I want deterministic template generation with content-addressed storage
  So that I can ensure reproducible builds and efficient caching

  Background:
    Given I have initialized the CAS engine
    And I have a clean test workspace

  # ==========================================================================
  # Deterministic Rendering Scenarios
  # ==========================================================================

  @deterministic @rendering @byte-identical
  Scenario: Deterministic rendering produces byte-identical outputs
    Given I have a deterministic template "simple-component":
      """
      ---
      to: src/components/{{name}}.tsx
      deterministic: true
      ---
      import React from 'react';

      export const {{name}}: React.FC = () => {
        return (
          <div className="{{name | kebabCase}}">
            <h1>{{name}} Component</h1>
            <p>Generated at: {{kgen.staticTimestamp}}</p>
            <p>Build hash: {{kgen.staticHash}}</p>
          </div>
        );
      };

      export default {{name}};
      """
    When I render the same template 10 times with identical variables
    Then all rendered outputs should have identical SHA-256 hashes
    And the output should be byte-identical across renders
    And rendering should complete in under 100ms

  @deterministic @variables @conditional
  Scenario: Complex template with conditional logic renders deterministically
    Given I have a deterministic template "conditional-service":
      """
      ---
      to: src/services/{{name}}.service.ts
      deterministic: true
      ---
      {% if withInterface %}
      export interface {{name}}Config {
        id: string;
        {% if withTimestamp %}
        createdAt: string;
        updatedAt: string;
        {% endif %}
        {% for field in fields %}
        {{field.name}}: {{field.type}};
        {% endfor %}
      }
      {% endif %}

      export class {{name}}Service {
        {% if withInterface %}
        constructor(private config: {{name}}Config) {}
        {% else %}
        constructor(private id: string) {}
        {% endif %}

        getId(): string {
          {% if withInterface %}
          return this.config.id;
          {% else %}
          return this.id;
          {% endif %}
        }

        // Generated with deterministic hash: {{kgen.buildHash}}
      }
      """
    When I render the template "conditional-service" with variables:
      | key           | value                                                    |
      | name          | User                                                     |
      | withInterface | true                                                     |
      | withTimestamp | true                                                     |
      | fields        | [{"name": "email", "type": "string"}, {"name": "age", "type": "number"}] |
    And I render the same template 5 times with identical variables  
    Then all rendered outputs should have identical SHA-256 hashes
    And the output should be byte-identical across renders

  # ==========================================================================
  # Content-Addressed Storage Scenarios
  # ==========================================================================

  @cas @storage @hashing
  Scenario: Store and retrieve content by SHA-256 hash
    When I store content "Hello, CAS World!" in CAS
    Then the content should be retrievable by its hash
    And content integrity should be verified
    And hash calculation should be performant

  @cas @multiple-content @unique-hashing
  Scenario: Different content produces different hashes
    Given I have content "First piece of content" with expected hash "ANY"
    And I have content "Second piece of content" with expected hash "ANY" 
    And I have content "First piece of content" with expected hash "ANY"
    When I store content "First piece of content" in CAS
    And I store content "Second piece of content" in CAS
    And I store content "First piece of content" in CAS
    Then the content should be retrievable by its hash
    And I should have 2 items in CAS storage
    And content integrity should be verified

  @cas @sha256 @specific-hashes
  Scenario: Verify specific SHA-256 hash values
    When I store content "test" in CAS
    Then the SHA-256 hash should be "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
    When I store content "" in CAS
    Then the SHA-256 hash should be "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

  # ==========================================================================
  # RDF Graph Template Variable Extraction
  # ==========================================================================

  @rdf @variable-extraction @ontology
  Scenario: Extract template variables from RDF ontology
    Given I have an RDF graph "person-ontology":
      """
      @prefix ex: <http://example.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .

      ex:Person a ex:EntityClass ;
          ex:className "Person" ;
          ex:tableName "persons" ;
          ex:description "Person entity with contact information" .

      ex:Person ex:hasProperty ex:fullName ;
          ex:hasProperty ex:email ;
          ex:hasProperty ex:age .

      ex:fullName a ex:Property ;
          ex:propertyName "fullName" ;
          ex:propertyType "string" ;
          ex:required "true" .

      ex:email a ex:Property ;
          ex:propertyName "email" ;
          ex:propertyType "string" ;  
          ex:required "true" .

      ex:age a ex:Property ;
          ex:propertyName "age" ;
          ex:propertyType "number" ;
          ex:required "false" .
      """
    When I extract template variables from RDF graph "person-ontology"
    Then I should extract variables:
      | variable    | value                                    |
      | className   | Person                                   |
      | tableName   | persons                                  |
      | description | Person entity with contact information  |
      | propertyName| fullName                                 |

  @rdf @template-integration @deterministic
  Scenario: Generate deterministic output from RDF-extracted variables
    Given I have an RDF graph "project-ontology":
      """
      @prefix proj: <http://project.example.org/> .

      proj:Project a proj:EntityClass ;
          proj:className "Project" ;
          proj:tableName "projects" ;
          proj:generateService "true" .

      proj:projectName a proj:Property ;
          proj:propertyName "projectName" ;
          proj:propertyType "string" ;
          proj:required "true" .
      """
    And I have a deterministic template "rdf-entity":
      """
      ---
      to: src/entities/{{className}}.entity.ts
      deterministic: true
      ---
      import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

      @Entity('{{tableName}}')
      export class {{className}}Entity {
        @PrimaryGeneratedColumn()
        id: number;

        @Column('varchar', { nullable: false })
        {{propertyName}}: {{propertyType}};

        // Generated: {{kgen.staticTimestamp}}
        // Hash: {{kgen.staticHash}}
      }
      """
    When I extract template variables from RDF graph "project-ontology"  
    And I render the template "rdf-entity" with variables:
      | key          | value   |
      | className    | Project |
      | tableName    | projects|
      | propertyName | projectName |
      | propertyType | string  |
    And I render the same template 3 times with identical variables
    Then all rendered outputs should have identical SHA-256 hashes
    And the output should be byte-identical across renders

  # ==========================================================================
  # Cache Performance Scenarios
  # ==========================================================================

  @cache @performance @hit-rate @kpi
  Scenario: Cache achieves 80% hit rate performance target
    When I perform 1000 cache operations with 0.85 expected hit rate
    Then the cache hit rate should be at least 80.0%
    And the cache performance should meet KPI targets

  @cache @performance @moderate-load
  Scenario: Cache performance under moderate load
    When I perform 500 cache operations with 0.70 expected hit rate  
    Then the cache hit rate should be at least 65.0%
    And hash calculation should be performant

  @cache @eviction @lru
  Scenario: Cache handles eviction gracefully with LRU policy
    Given I clear all CAS storage
    When I perform 2000 cache operations with 0.60 expected hit rate
    Then the cache hit rate should be at least 50.0%
    And the cache performance should meet KPI targets

  # ==========================================================================
  # Integration Scenarios  
  # ==========================================================================

  @integration @file-generation @cas-backed
  Scenario: Generate file using CAS-backed template engine
    Given I have a deterministic template "file-output":
      """
      ---
      to: src/components/{{name}}.tsx
      deterministic: true
      ---
      import React from 'react';

      export const {{name}}: React.FC = () => {
        return (
          <div className="{{name | kebabCase}}-component">
            <h1>{{name}}</h1>
            <p>CAS Hash: {{kgen.staticHash}}</p>
            <p>Timestamp: {{kgen.staticTimestamp}}</p>
          </div>
        );
      };

      export default {{name}};
      """
    When I generate a file using CAS-backed template "file-output"
    Then the generated file should exist and have correct content hash
    And content integrity should be verified

  @integration @drift-detection @content-comparison
  Scenario: Detect content drift using CAS hashing
    Given I have content "Original template content v1.0" with expected hash "ANY"
    And I have content "Modified template content v1.1" with expected hash "ANY"  
    When I store content "Original template content v1.0" in CAS
    And I store content "Modified template content v1.1" in CAS
    Then the content should be retrievable by its hash
    And content integrity should be verified
    And I should have 2 items in CAS storage

  # ==========================================================================
  # Performance and Stress Testing
  # ==========================================================================

  @performance @stress @large-templates
  Scenario: Handle large templates efficiently
    Given I have a deterministic template "large-component":
      """
      ---
      to: src/components/LargeComponent.tsx
      deterministic: true
      ---
      /**
       * Large Component Template
       * Generated: {{kgen.staticTimestamp}}
       */
      import React from 'react';

      {% for i in range(0, 100) %}
      interface Component{{i}}Props {
        id: string;
        {% for j in range(0, 10) %}
        field{{j}}: string;
        {% endfor %}
      }

      export const Component{{i}}: React.FC<Component{{i}}Props> = (props) => {
        return (
          <div className="component-{{i}}">
            {% for j in range(0, 10) %}
            <p>{props.field{{j}}}</p>
            {% endfor %}
          </div>
        );
      };
      {% endfor %}

      // Build hash: {{kgen.buildHash}}
      """
    When I render the template "large-component" with variables:
      | key  | value         |
      | name | LargeComponent|
    Then rendering should complete in under 2000ms
    And the content should be retrievable by its hash
    And content integrity should be verified

  @performance @concurrent @parallel-rendering
  Scenario: Handle concurrent template rendering safely
    Given I have a deterministic template "concurrent-test":
      """
      ---
      to: src/{{name}}/{{name}}.component.ts
      deterministic: true  
      ---
      export class {{name}}Component {
        constructor() {
          console.log('{{name}} created at {{kgen.staticTimestamp}}');
        }
        
        getHash(): string {
          return '{{kgen.staticHash}}';
        }
      }
      """
    When I render the template "concurrent-test" with variables:
      | key  | value      |
      | name | Component1 |
    And I render the template "concurrent-test" with variables:  
      | key  | value      |
      | name | Component2 |
    And I render the template "concurrent-test" with variables:
      | key  | value      |  
      | name | Component3 |
    Then all rendered outputs should have identical SHA-256 hashes
    And content integrity should be verified
    And hash calculation should be performant

  # ==========================================================================
  # Error Handling and Edge Cases
  # ==========================================================================

  @edge-cases @empty-content @null-handling
  Scenario: Handle empty and null content gracefully
    When I store content "" in CAS
    Then the content should be retrievable by its hash
    And the SHA-256 hash should be "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    And content integrity should be verified

  @edge-cases @unicode @special-characters
  Scenario: Handle Unicode and special characters correctly
    When I store content "Hello 🌍 Unicode! 中文 العربية" in CAS
    Then the content should be retrievable by its hash
    And content integrity should be verified
    And hash calculation should be performant

  @edge-cases @large-content @memory-efficiency  
  Scenario: Handle large content efficiently
    When I store content "{{ 'x' | repeat(10000) }}" in CAS
    Then the content should be retrievable by its hash
    And content integrity should be verified
    And rendering should complete in under 500ms