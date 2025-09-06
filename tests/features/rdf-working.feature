Feature: RDF Template Integration (80/20 Working Features)
  As a developer
  I want to use RDF/Turtle data in my templates
  So that I can generate code from semantic data

  Background:
    Given I have the N3 library installed
    And I have Nunjucks template engine configured

  Scenario: Load and parse Turtle data
    Given I have Turtle data with prefixes and triples
    When I parse the Turtle data
    Then I should get a valid RDF store
    And I should extract template variables from the RDF

  Scenario: Generate code from RDF data
    Given I have parsed RDF data with organizations and people
    And I have a template that uses RDF variables
    When I render the template with RDF context
    Then I should get valid generated code
    And the code should contain data from the RDF

  Scenario: Use RDF filters in templates
    Given I have RDF data loaded in a store
    And I have registered RDF filters with Nunjucks
    When I use rdfLabel filter in a template
    And I use rdfType filter in a template
    And I use rdfQuery filter in a template
    Then each filter should transform the data correctly

  Scenario: 80/20 Feature Coverage
    Given I focus on the core 20% of features
    When I implement RDF functionality
    Then I should support loading Turtle files
    And I should support extracting variables
    And I should support basic RDF filters
    And I should support template rendering
    But I don't need complex SPARQL queries
    And I don't need OWL reasoning
    And I don't need SHACL validation