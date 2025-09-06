Feature: Comprehensive RDF/Turtle Data Support
  As a developer using Unjucks with RDF data sources
  I want to parse, load, filter, and use Turtle/RDF data in templates
  So that I can generate code from semantic data with full RDF query capabilities

  Background:
    Given I have a clean test environment
    And I have RDF parsing and loading capabilities available

  # Core Turtle Parsing (80/20 - Basic functionality)
  Scenario: Parse basic Turtle data file with TurtleParser
    Given I have a Turtle file with person data using FOAF vocabulary
    When I parse the Turtle file using TurtleParser
    Then the parsing should succeed with no errors
    And I should get triples with subject, predicate, object structure
    And I should get namespace prefixes including foaf and dcterms
    And I should get parsing statistics with triple count
    And I should be able to access parsed terms with type and value

  # RDF Data Loading with Multiple Sources (80/20)
  Scenario: Load RDF data from multiple sources with RDFDataLoader
    Given I have RDF data available from file, inline, and URI sources
    When I load the RDF data using RDFDataLoader with caching enabled
    Then all data sources should load successfully
    And the data should be cached for performance
    And I should get structured data ready for template use
    And TTL cache should work correctly for repeated loads

  # Template Integration with RDF Filters (80/20)
  Scenario: Use RDF filters in Nunjucks templates
    Given I have loaded RDF data with person and project information
    And I have Nunjucks templates that use RDF filters
    When I apply rdfSubject, rdfObject, and rdfQuery filters
    Then I should get filtered RDF data based on subject queries
    And I should get object values for specific predicates
    And complex SPARQL-like queries should return matching triples
    And namespace prefixes should be resolved correctly

  # Performance Validation (80/20)
  Scenario: Validate performance with large RDF datasets
    Given I have a large Turtle file with 10000+ triples
    When I parse the file with performance monitoring enabled
    Then parsing should complete within 2 seconds
    And memory usage should stay under 100MB
    And the parser should handle the dataset without timeouts
    And performance metrics should be recorded

  # Error Handling and Recovery (80/20)
  Scenario: Handle Turtle syntax errors gracefully
    Given I have a Turtle file with various syntax errors
    When I attempt to parse the invalid Turtle content
    Then parsing should fail with descriptive error messages
    And error should include line and column information
    And the system should not crash or hang
    And I should get a TurtleParseError with original error details

  # Synchronous vs Asynchronous Parsing
  Scenario: Compare synchronous and asynchronous parsing
    Given I have valid Turtle content ready for parsing
    When I parse using both parseSync and async parse methods
    Then both methods should produce identical results
    And sync parsing should work for smaller datasets
    And async parsing should handle larger datasets better
    And both should return the same TurtleParseResult structure

  # Advanced RDF Querying and Filtering
  Scenario: Query RDF data with advanced filters and utilities
    Given I have complex RDF data with multiple relationships
    When I use TurtleUtils for filtering and querying
    Then I should filter triples by subject URI effectively
    And I should filter triples by predicate URI
    And I should filter triples by object value and graph
    And I should group triples by subject correctly
    And I should expand prefixed URIs to full URIs
    And I should convert full URIs to prefixed forms

  # Multi-format Support
  Scenario: Parse different RDF formats beyond Turtle
    Given I have RDF data in Turtle, N-Triples, and N-Quads formats
    When I parse each format with appropriate options
    Then all formats should parse successfully
    And the parser should auto-detect format when possible
    And N-Quads should preserve named graph information
    And all should produce consistent ParsedTriple structures

  # Real-world Data Integration
  Scenario: Integrate with real RDF data sources and vocabularies
    Given I have RDF data using FOAF, Dublin Core, and DOAP vocabularies
    When I load and parse the vocabulary-rich data
    Then all vocabulary terms should be preserved
    And namespace prefixes should be correctly extracted
    And I should be able to query across different vocabularies
    And datatype conversion should work for literals

  # CLI Integration and Dry-run
  Scenario: Use RDF data in CLI generation workflow
    Given I have project metadata in RDF format
    And I have templates that consume RDF template variables
    When I run unjucks generation with RDF data source
    Then the CLI should parse RDF data successfully
    And template variables should be populated from RDF data
    And generated files should contain RDF-derived content
    And dry-run mode should show RDF variables without file creation

  # Edge Cases and Boundary Conditions
  Scenario: Handle RDF parsing edge cases and boundary conditions
    Given I have RDF data with edge cases like empty files, malformed IRIs
    When I attempt to parse various edge case scenarios
    Then empty files should be handled gracefully
    And malformed IRIs should produce appropriate errors
    And very long literal values should be processed correctly
    And Unicode characters in literals should be preserved

  # Store Creation and Advanced Querying
  Scenario: Create N3 Store for advanced RDF operations
    Given I have parsed Turtle data ready for store operations
    When I create an N3 Store from the parsed content
    Then the store should contain all parsed triples
    And I should be able to perform SPARQL-like queries on the store
    And the store should support complex pattern matching
    And store operations should be performant for typical datasets

  # Memory Management and Resource Cleanup
  Scenario: Validate proper memory management and resource cleanup
    Given I am parsing multiple large RDF files in sequence
    When I monitor memory usage throughout the parsing process
    Then memory should be released properly after each parse
    And there should be no memory leaks with repeated parsing
    And garbage collection should work effectively
    And parser instances should be reusable without issues

  # Data Type Conversion and Literal Handling
  Scenario: Convert RDF literals to JavaScript native types
    Given I have RDF data with various XSD datatypes
    When I parse and convert literal values using TurtleUtils
    Then XSD integers should convert to JavaScript numbers
    And XSD booleans should convert to JavaScript booleans
    And XSD dates should convert to JavaScript Date objects
    And unknown datatypes should remain as strings
    And language-tagged literals should preserve language tags