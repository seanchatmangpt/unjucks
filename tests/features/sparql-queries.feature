Feature: SPARQL Query Execution
  As a KGEN user
  I want to execute SPARQL queries against RDF graphs efficiently
  So that I can retrieve and manipulate semantic data with performance targets

  Background:
    Given KGEN is properly initialized
    And the SPARQL engine is available
    And a test RDF graph is loaded with 1000 triples

  Scenario: Execute basic SELECT query under performance target
    Given a SPARQL SELECT query:
      """
      PREFIX schema: <http://schema.org/>
      SELECT ?name ?email WHERE {
        ?person a schema:Person ;
                schema:name ?name ;
                schema:email ?email .
      }
      """
    When I execute the query
    Then the query should complete within 150ms (p95 target)
    And the result should contain valid bindings for name and email
    And the result format should be valid SPARQL JSON results

  Scenario: Execute ASK query for existence checking
    Given a SPARQL ASK query:
      """
      PREFIX schema: <http://schema.org/>
      ASK WHERE {
        ?person a schema:Person ;
                schema:name "John Doe" .
      }
      """
    When I execute the query
    Then the query should complete within 50ms
    And the result should be either true or false
    And the response should be in valid ASK result format

  Scenario: Execute CONSTRUCT query for graph transformation
    Given a SPARQL CONSTRUCT query:
      """
      PREFIX schema: <http://schema.org/>
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      CONSTRUCT {
        ?person foaf:name ?name ;
                foaf:mbox ?email .
      } WHERE {
        ?person a schema:Person ;
                schema:name ?name ;
                schema:email ?email .
      }
      """
    When I execute the query
    Then the query should complete within 200ms
    And the result should be a valid RDF graph
    And the constructed graph should use FOAF vocabulary
    And the semantic content should be preserved

  Scenario: Execute DESCRIBE query for resource description
    Given a specific resource URI "http://example.org/person1"
    And a SPARQL DESCRIBE query:
      """
      DESCRIBE <http://example.org/person1>
      """
    When I execute the query
    Then the query should complete within 100ms
    And the result should contain all triples where the resource appears as subject
    And the result should be a valid RDF graph

  Scenario: Query performance with large dataset
    Given an RDF graph with 100,000 triples
    And a complex SELECT query with joins:
      """
      PREFIX schema: <http://schema.org/>
      SELECT ?personName ?orgName ?role WHERE {
        ?person a schema:Person ;
                schema:name ?personName ;
                schema:worksFor ?org .
        ?org a schema:Organization ;
             schema:name ?orgName .
        ?person schema:jobTitle ?role .
        FILTER(STRLEN(?personName) > 3)
      }
      ORDER BY ?personName
      LIMIT 100
      """
    When I execute the query
    Then the query should complete within 150ms (p95 performance target)
    And the result should contain maximum 100 results
    And results should be ordered by person name
    And memory usage should not exceed 200MB during execution

  Scenario: Query with OPTIONAL patterns
    Given a SPARQL query with OPTIONAL patterns:
      """
      PREFIX schema: <http://schema.org/>
      SELECT ?name ?email ?phone WHERE {
        ?person a schema:Person ;
                schema:name ?name .
        OPTIONAL { ?person schema:email ?email }
        OPTIONAL { ?person schema:telephone ?phone }
      }
      """
    When I execute the query
    Then the query should complete within 150ms
    And results should include persons without email or phone
    And OPTIONAL bindings should be null when not present
    And all persons with names should be included

  Scenario: Query with FILTER expressions
    Given a SPARQL query with complex filters:
      """
      PREFIX schema: <http://schema.org/>
      SELECT ?name ?age WHERE {
        ?person a schema:Person ;
                schema:name ?name ;
                schema:age ?age .
        FILTER(?age >= 21 && ?age < 65)
        FILTER(REGEX(?name, "^[A-Z]", "i"))
      }
      """
    When I execute the query
    Then the query should complete within 150ms
    And results should only include persons aged 21-64
    And all names should start with a letter
    And filter evaluation should be efficient

  Scenario: Federated query across multiple graphs
    Given multiple named graphs:
      | graph                    | content                               |
      | http://graph1.example    | Person data with names and emails     |
      | http://graph2.example    | Organization data                     |
    And a federated SPARQL query:
      """
      SELECT ?personName ?orgName WHERE {
        GRAPH <http://graph1.example> {
          ?person schema:name ?personName ;
                  schema:worksFor ?org .
        }
        GRAPH <http://graph2.example> {
          ?org schema:name ?orgName .
        }
      }
      """
    When I execute the federated query
    Then the query should complete within 300ms
    And results should combine data from both graphs
    And graph isolation should be maintained

  Scenario: Query with aggregation functions
    Given a SPARQL query with aggregation:
      """
      PREFIX schema: <http://schema.org/>
      SELECT ?org (COUNT(?person) AS ?employeeCount) (AVG(?age) AS ?avgAge) WHERE {
        ?person a schema:Person ;
                schema:worksFor ?org ;
                schema:age ?age .
        ?org a schema:Organization .
      }
      GROUP BY ?org
      HAVING (COUNT(?person) > 5)
      ORDER BY DESC(?employeeCount)
      """
    When I execute the query
    Then the query should complete within 250ms
    And results should be grouped by organization
    And only organizations with more than 5 employees should be included
    And results should be ordered by employee count (descending)

  Scenario: Query with malformed SPARQL syntax
    Given an invalid SPARQL query with syntax errors:
      """
      SELECT ?name WHERE {
        ?person schema:name ?name
        MISSING_DOT_AND_BRACKET
      """
    When I attempt to execute the query
    Then the query should fail immediately
    And a clear syntax error message should be returned
    And the error should indicate the approximate location of the problem
    And no partial results should be returned

  Scenario: Query timeout handling
    Given a deliberately slow SPARQL query that would take over 5 seconds
    And a query timeout setting of 1 second
    When I execute the query
    Then the query should be terminated after 1 second
    And a timeout error should be returned
    And system resources should be cleaned up properly

  Scenario: Concurrent query execution
    Given 10 identical SELECT queries
    When I execute all queries concurrently
    Then each query should complete within 150ms
    And all queries should return identical results
    And no query should block others from executing
    And total memory usage should scale reasonably

  Scenario: Query result pagination
    Given a SELECT query that would return 1000 results
    And pagination settings of 50 results per page
    When I execute the query with LIMIT and OFFSET:
      """
      SELECT ?name WHERE {
        ?person schema:name ?name .
      }
      ORDER BY ?name
      LIMIT 50 OFFSET 100
      """
    Then the query should complete within 150ms
    And exactly 50 results should be returned
    And results should start from the 101st alphabetical name
    And pagination should be consistent across multiple requests

  Scenario: Query with custom SPARQL functions
    Given a SPARQL query using custom functions:
      """
      PREFIX kgen: <http://kgen.example.org/functions/>
      SELECT ?name (kgen:hash(?name) AS ?nameHash) WHERE {
        ?person schema:name ?name .
      }
      """
    When I execute the query
    Then the query should complete within 150ms
    And custom functions should be evaluated correctly
    And hash values should be consistent across multiple executions
    And function errors should be handled gracefully