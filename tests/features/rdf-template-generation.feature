Feature: RDF-Driven Template Generation
  As a developer
  I want to generate code from RDF/OWL ontologies
  So that I can create type-safe models from semantic schemas

  Background:
    Given I have an ontology file with class definitions
    And I have template files configured for RDF

  Scenario: Generate TypeScript interface from OWL class
    Given I have an OWL class definition:
      """
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix app: <http://app.example.org/> .
      
      app:User a owl:Class ;
          rdfs:label "User" .
      
      app:email a owl:DatatypeProperty ;
          rdfs:domain app:User ;
          rdfs:range xsd:string ;
          rdfs:label "email" .
      """
    And I have a template for TypeScript interfaces
    When I generate code for class "User"
    Then I should get a TypeScript interface:
      """
      export interface User {
        email: string;
      }
      """

  Scenario: Generate model with multiple properties
    Given I have a complex OWL class with multiple properties
    And properties have different datatypes and cardinalities
    When I generate the model code
    Then all properties should be included
    And datatypes should map correctly to TypeScript types
    And optional properties should be marked with "?"
    And array properties should use "[]" notation

  Scenario: Generate API client from RDF service description
    Given I have an RDF description of REST endpoints:
      """
      @prefix api: <http://api.example.org/> .
      
      api:getUser a api:Endpoint ;
          api:method "GET" ;
          api:path "/users/:id" ;
          api:returns api:User .
      """
    When I generate an API client
    Then it should have a getUser method
    And the method should use axios.get
    And it should handle path parameters
    And it should return the correct type

  Scenario: Generate configuration from RDF
    Given I have configuration data in RDF:
      """
      @prefix cfg: <http://config.example.org/> .
      
      cfg:appConfig a cfg:Configuration ;
          cfg:port 3000 ;
          cfg:enableLogging true ;
          cfg:appName "MyApp" .
      """
    When I generate a config file
    Then it should export a config object
    And numeric values should be numbers
    And boolean values should be booleans
    And string values should be quoted

  Scenario: Generate validators from SHACL shapes
    Given I have SHACL shapes defining constraints:
      """
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      
      :UserShape a sh:NodeShape ;
          sh:property [
              sh:path :email ;
              sh:datatype xsd:string ;
              sh:pattern "^[^@]+@[^@]+$" ;
              sh:minCount 1
          ] .
      """
    When I generate validation code
    Then it should validate email format
    And it should check required fields
    And it should return validation errors

  Scenario: Generate GraphQL schema from RDF
    Given I have RDF class definitions with relationships
    When I generate a GraphQL schema
    Then it should create type definitions
    And it should handle relationships as fields
    And it should map datatypes correctly
    And it should include resolvers

  Scenario: Generate database schema from ontology
    Given I have an ontology with classes and properties
    When I generate SQL schema
    Then it should create CREATE TABLE statements
    And it should map RDF types to SQL types
    And it should handle foreign key relationships
    And it should add appropriate indexes

  Scenario: Generate React components from UI ontology
    Given I have an RDF description of UI components:
      """
      @prefix ui: <http://ui.example.org/> .
      
      ui:UserCard a ui:Component ;
          ui:displayProperty :name, :email ;
          ui:actionProperty :edit, :delete .
      """
    When I generate React components
    Then it should create functional components
    And it should display the specified properties
    And it should include action buttons
    And it should use proper React patterns

  Scenario: Generate documentation from RDF comments
    Given I have RDF data with rdfs:comment annotations
    When I generate documentation
    Then it should extract all comments
    And it should organize by class/property
    And it should generate markdown format
    And it should include examples if present

  Scenario: Generate test cases from RDF examples
    Given I have RDF data with example instances
    When I generate test cases
    Then it should create test files
    And it should use example data as test fixtures
    And it should test all properties
    And it should validate against constraints