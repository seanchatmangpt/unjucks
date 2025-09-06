Feature: RDF Error Handling and Security
  As a system administrator
  I want robust error handling and security for RDF processing
  So that the system remains stable and secure

  Background:
    Given I have error handling configured
    And I have security policies in place

  Scenario: Handle invalid Turtle syntax
    Given I have malformed Turtle content:
      """
      @prefix foaf: <http://xmlns.com/foaf/0.1/>
      foaf:Person a owl:Class
      missing:semicolon here
      """
    When I try to parse the content
    Then I should get a TurtleParseError
    And the error should indicate line 3
    And the error message should be descriptive
    And the system should not crash

  Scenario: Handle missing RDF data gracefully
    Given I have a template expecting RDF data
    But the RDF source file does not exist
    When I render the template
    Then it should use empty data fallback
    And it should log a warning
    And the template should still render
    And no runtime errors should occur

  Scenario: Enforce resource limits
    Given I have a resource limit of 1000 triples
    When I try to load a file with 2000 triples
    Then it should reject the file
    And it should return a resource limit error
    And it should not consume excessive memory
    And it should suggest using pagination

  Scenario: Prevent XXE attacks in RDF/XML
    Given I have RDF/XML with external entity:
      """
      <!DOCTYPE rdf [
        <!ENTITY xxe SYSTEM "file:///etc/passwd">
      ]>
      <rdf:RDF>
        <rdf:Description>&xxe;</rdf:Description>
      </rdf:RDF>
      """
    When I try to parse the content
    Then it should reject the external entity
    And it should not read system files
    And it should return a security error
    And it should log the attack attempt

  Scenario: Block malicious URIs
    Given I have RDF with javascript: URI:
      """
      @prefix ex: <http://example.org/> .
      ex:link ex:href <javascript:alert('XSS')> .
      """
    When I process the RDF for templates
    Then javascript: URIs should be sanitized
    And file:// URIs should be blocked
    And data: URIs should be validated
    And only http/https should be allowed for remote

  Scenario: Handle network timeouts
    Given I have a remote RDF source
    And the network request times out after 5 seconds
    When I try to load the remote source
    Then it should timeout gracefully
    And it should try cached version if available
    And it should return a timeout error
    And it should not hang indefinitely

  Scenario: Validate file paths
    Given I have a file path "../../../etc/passwd"
    When I try to load the file
    Then it should detect path traversal
    And it should reject the file path
    And it should only allow paths within project
    And it should log security violation

  Scenario: Handle circular references
    Given I have RDF with circular references:
      """
      @prefix ex: <http://example.org/> .
      ex:a ex:knows ex:b .
      ex:b ex:knows ex:c .
      ex:c ex:knows ex:a .
      """
    When I traverse the graph
    Then it should detect cycles
    And it should prevent infinite loops
    And it should limit traversal depth
    And it should complete successfully

  Scenario: Memory protection for large files
    Given I have a 100MB Turtle file
    When I parse it with streaming
    Then memory usage should stay below 50MB
    And it should process in chunks
    And it should release memory after processing
    And it should complete without OOM errors

  Scenario: Handle encoding issues
    Given I have RDF with mixed encodings
    And it contains UTF-8, UTF-16, and Latin-1
    When I parse the content
    Then it should detect encoding
    And it should convert to UTF-8
    And it should preserve special characters
    And it should not corrupt data

  Scenario: Recover from partial failures
    Given I have multiple RDF sources
    And one source fails to load
    When I load all sources
    Then successful sources should be available
    And failed source should be logged
    And it should continue processing
    And partial data should be usable

  Scenario: Validate against schema before use
    Given I have RDF data and SHACL constraints
    When validation fails
    Then it should list all violations
    And it should not use invalid data
    And it should provide fix suggestions
    And it should allow override with warning

  Scenario: Rate limit remote requests
    Given I have multiple remote RDF sources
    When I load them concurrently
    Then it should limit parallel requests to 5
    And it should queue additional requests
    And it should respect rate limit headers
    And it should implement backoff on 429

  Scenario: Sandbox template execution
    Given I have a template with RDF data
    When the template tries to access system
    Then it should be sandboxed
    And it should not access file system directly
    And it should not execute shell commands
    And it should only access provided RDF context