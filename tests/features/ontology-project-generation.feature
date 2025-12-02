Feature: Generate Full Project from RDF Ontology
  As a developer
  I want to generate complete project scaffolding from RDF ontology
  So that I can quickly bootstrap semantic applications

  Background:
    Given an RDF ontology file "tests/fixtures/ontologies/simple.ttl"
    And the ontology contains 5 classes
    And the ontology contains 15 properties
    And the ontology contains 8 relationships

  Scenario: Generate TypeScript interfaces from ontology classes
    When I run "ontology generate-project tests/fixtures/ontologies/simple.ttl --output ./generated/test-project"
    Then directory "./generated/test-project/src/models" should exist
    And file "./generated/test-project/src/models/Person.ts" should exist
    And file "./generated/test-project/src/models/Organization.ts" should exist
    And file "Person.ts" should contain "interface Person"
    And file "Person.ts" should contain "name: string"
    And file "Person.ts" should contain "email: string"

  Scenario: Generate API routes from ontology relationships
    When I run "ontology generate-project tests/fixtures/ontologies/simple.ttl --output ./generated/test-project"
    Then file "./generated/test-project/src/api/routes/person.ts" should exist
    And file "person.ts" should contain "GET /api/person/:id"
    And file "person.ts" should contain "GET /api/person/:id/organization"
    And file "person.ts" should contain "POST /api/person"
    And file "person.ts" should contain "PUT /api/person/:id"
    And file "person.ts" should contain "DELETE /api/person/:id"

  Scenario: Generate database schemas with relationships
    When I run "ontology generate-project tests/fixtures/ontologies/simple.ttl --output ./generated/test-project"
    Then file "./generated/test-project/src/db/schemas/person.sql" should exist
    And file "person.sql" should contain "CREATE TABLE person"
    And file "person.sql" should contain "organization_id INTEGER REFERENCES organization(id)"
    And file "person.sql" should contain "PRIMARY KEY (id)"
    And file "person.sql" should contain "NOT NULL"

  Scenario: Generate validation rules from constraints
    When I run "ontology generate-project tests/fixtures/ontologies/simple.ttl --output ./generated/test-project"
    Then file "./generated/test-project/src/validators/person.validator.ts" should exist
    And file "person.validator.ts" should contain "validatePerson"
    And file "person.validator.ts" should contain "email: z.string().email()"
    And file "person.validator.ts" should contain "name: z.string().min(1).max(255)"
    And file "person.validator.ts" should contain "age: z.number().min(0).max(150)"

  Scenario: Generate BDD tests for generated code
    When I run "ontology generate-project tests/fixtures/ontologies/simple.ttl --output ./generated/test-project --with-tests"
    Then file "./generated/test-project/tests/features/person.feature" should exist
    And file "person.feature" should contain "Feature: Person Management"
    And file "person.feature" should contain "Scenario: Create new person"
    And file "person.feature" should contain "Scenario: Retrieve person by ID"
    And file "./generated/test-project/tests/features/step_definitions/person_steps.js" should exist
    And file "person_steps.js" should contain "Given('a valid person data'"

  Scenario: Handle large ontology (1000+ classes)
    Given an RDF ontology file "tests/fixtures/ontologies/complex.ttl"
    And the ontology contains 1000 classes
    When I run "ontology generate-project tests/fixtures/ontologies/complex.ttl --output ./generated/large-project"
    Then directory "./generated/large-project/src/models" should exist
    And directory "./generated/large-project/src/models" should contain 1000 files
    And the generation should complete in less than 30 seconds
    And memory usage should be less than 500MB

  Scenario: Handle ontology with imports
    Given an RDF ontology file "tests/fixtures/ontologies/with-imports.ttl"
    And the ontology imports "http://xmlns.com/foaf/0.1/"
    And the ontology imports "http://www.w3.org/2006/time#"
    When I run "ontology generate-project tests/fixtures/ontologies/with-imports.ttl --output ./generated/import-project --resolve-imports"
    Then file "./generated/import-project/src/models/Person.ts" should exist
    And file "Person.ts" should contain "extends foaf:Person"
    And file "./generated/import-project/package.json" should exist
    And file "package.json" should contain "@types/rdf-js"

  Scenario: Dry-run mode doesn't create files
    When I run "ontology generate-project tests/fixtures/ontologies/simple.ttl --output ./generated/dry-project --dry-run"
    Then directory "./generated/dry-project" should not exist
    And stdout should contain "Would create: src/models/Person.ts"
    And stdout should contain "Would create: src/models/Organization.ts"
    And stdout should contain "Would create: src/api/routes/person.ts"
    And stdout should contain "Total files: 15"

  Scenario: Generate with custom templates
    Given a custom template directory "tests/fixtures/custom-templates/ontology"
    When I run "ontology generate-project tests/fixtures/ontologies/simple.ttl --output ./generated/custom-project --template tests/fixtures/custom-templates/ontology"
    Then file "./generated/custom-project/src/entities/Person.entity.ts" should exist
    And file "Person.entity.ts" should contain "@Entity()"
    And file "Person.entity.ts" should contain "@Column()"
    And file "Person.entity.ts" should contain "class PersonEntity"

  Scenario: Handle invalid TTL syntax
    Given an invalid RDF file "tests/fixtures/ontologies/invalid.ttl"
    When I run "ontology generate-project tests/fixtures/ontologies/invalid.ttl --output ./generated/invalid-project"
    Then the command should fail with exit code 1
    And stderr should contain "Invalid RDF syntax"
    And stderr should contain "Line 15: Unexpected token"
    And directory "./generated/invalid-project" should not exist

  Scenario: Handle missing required classes
    Given an RDF ontology file "tests/fixtures/ontologies/incomplete.ttl"
    And the ontology is missing rdfs:Class definitions
    When I run "ontology generate-project tests/fixtures/ontologies/incomplete.ttl --output ./generated/incomplete-project"
    Then the command should fail with exit code 1
    And stderr should contain "No classes found in ontology"
    And stderr should contain "Ensure ontology defines rdfs:Class or owl:Class"

  Scenario: Handle circular dependencies
    Given an RDF ontology file "tests/fixtures/ontologies/circular.ttl"
    And class "Person" references class "Organization"
    And class "Organization" references class "Person"
    When I run "ontology generate-project tests/fixtures/ontologies/circular.ttl --output ./generated/circular-project"
    Then file "./generated/circular-project/src/models/Person.ts" should exist
    And file "./generated/circular-project/src/models/Organization.ts" should exist
    And file "Person.ts" should contain "import type { Organization } from './Organization'"
    And file "Organization.ts" should contain "import type { Person } from './Person'"
    And the generation should complete successfully

  Scenario: Generate with multiple output formats
    When I run "ontology generate-project tests/fixtures/ontologies/simple.ttl --output ./generated/multi-format --formats typescript,json-schema,graphql"
    Then file "./generated/multi-format/src/models/Person.ts" should exist
    And file "./generated/multi-format/schemas/person.schema.json" should exist
    And file "./generated/multi-format/graphql/types/person.graphql" should exist
    And file "person.schema.json" should contain "$schema"
    And file "person.graphql" should contain "type Person"

  Scenario: Generate with internationalization support
    Given an RDF ontology file "tests/fixtures/ontologies/i18n.ttl"
    And the ontology has labels in English, Spanish, and French
    When I run "ontology generate-project tests/fixtures/ontologies/i18n.ttl --output ./generated/i18n-project --i18n"
    Then file "./generated/i18n-project/src/i18n/en.json" should exist
    And file "./generated/i18n-project/src/i18n/es.json" should exist
    And file "./generated/i18n-project/src/i18n/fr.json" should exist
    And file "en.json" should contain "person.name.label"
    And file "es.json" should contain "person.name.label"

  Scenario: Generate with SHACL validation integration
    Given an RDF ontology file "tests/fixtures/ontologies/simple.ttl"
    And a SHACL shapes file "tests/fixtures/ontologies/shapes.ttl"
    When I run "ontology generate-project tests/fixtures/ontologies/simple.ttl --output ./generated/shacl-project --shacl tests/fixtures/ontologies/shapes.ttl"
    Then file "./generated/shacl-project/src/validators/shacl-validator.ts" should exist
    And file "shacl-validator.ts" should contain "validateWithSHACL"
    And file "shacl-validator.ts" should contain "import { SHACLValidator }"

  Scenario: Generate with performance benchmarks
    When I run "ontology generate-project tests/fixtures/ontologies/simple.ttl --output ./generated/bench-project --with-benchmarks"
    Then file "./generated/bench-project/benchmarks/person.bench.ts" should exist
    And file "person.bench.ts" should contain "benchmark('Create person'"
    And file "person.bench.ts" should contain "benchmark('Query person'"
    And file "person.bench.ts" should contain "benchmark('Update person'"

  Scenario: Incremental generation preserves custom code
    Given a previously generated project at "./generated/incremental-project"
    And file "./generated/incremental-project/src/models/Person.ts" has custom methods
    When I run "ontology generate-project tests/fixtures/ontologies/simple.ttl --output ./generated/incremental-project --incremental"
    Then file "./generated/incremental-project/src/models/Person.ts" should exist
    And file "Person.ts" should preserve custom methods
    And file "Person.ts" should contain "// CUSTOM CODE START"
    And file "Person.ts" should contain "// CUSTOM CODE END"
    And stdout should contain "Preserved 3 custom code blocks"

  Scenario: Generate with OpenAPI specification
    When I run "ontology generate-project tests/fixtures/ontologies/simple.ttl --output ./generated/openapi-project --with-openapi"
    Then file "./generated/openapi-project/openapi.yaml" should exist
    And file "openapi.yaml" should contain "openapi: 3.0.0"
    And file "openapi.yaml" should contain "paths:"
    And file "openapi.yaml" should contain "/api/person"
    And file "openapi.yaml" should contain "components:"
    And file "openapi.yaml" should contain "schemas:"
    And file "openapi.yaml" should contain "Person:"

  Scenario: Generate with Docker deployment
    When I run "ontology generate-project tests/fixtures/ontologies/simple.ttl --output ./generated/docker-project --with-docker"
    Then file "./generated/docker-project/Dockerfile" should exist
    And file "./generated/docker-project/docker-compose.yml" should exist
    And file "Dockerfile" should contain "FROM node:"
    And file "docker-compose.yml" should contain "services:"
    And file "docker-compose.yml" should contain "postgres:"
    And file "docker-compose.yml" should contain "api:"

  Scenario: Generate with CI/CD pipelines
    When I run "ontology generate-project tests/fixtures/ontologies/simple.ttl --output ./generated/cicd-project --with-ci"
    Then file "./generated/cicd-project/.github/workflows/test.yml" should exist
    And file "./generated/cicd-project/.github/workflows/deploy.yml" should exist
    And file "test.yml" should contain "npm test"
    And file "test.yml" should contain "npm run lint"
    And file "deploy.yml" should contain "npm run build"
