Feature: MCP Performance and Scalability
  As a performance-conscious developer
  I want the MCP server to handle requests efficiently
  So that it can be used in high-throughput environments

  Background:
    Given I have a clean test environment
    And the MCP server is running
    And I have performance monitoring enabled

  Scenario: Basic response time requirements
    Given I have a simple template generator
    When I call "unjucks_list" MCP tool
    Then the response should be returned within 100ms
    And memory usage should remain under 50MB

  Scenario: Template parsing performance
    Given I have a complex template with 50 variables
    When I call "unjucks_help" for this template
    Then variable scanning should complete within 200ms
    And the parsed template should be cached for subsequent calls

  Scenario: File generation performance
    Given I have a multi-file template with 10 files
    When I generate files using the MCP tool
    Then all files should be generated within 500ms
    And file operations should be atomic
    And temporary files should be cleaned up properly

  Scenario: Concurrent request handling
    Given I have 5 different templates available
    When I make 20 concurrent MCP requests:
      | request_type    | count |
      | unjucks_list    | 5     |
      | unjucks_help    | 5     |
      | unjucks_generate| 5     |
      | unjucks_dry_run | 5     |
    Then all requests should complete within 2 seconds
    And no request should fail due to resource contention
    And response times should remain consistent

  Scenario: Memory usage under load
    When I perform 100 consecutive operations:
      | operation       | iterations |
      | list generators | 25         |
      | parse templates | 25         |
      | generate files  | 25         |
      | dry run preview | 25         |
    Then peak memory usage should not exceed 100MB
    And memory should be released between operations
    And no memory leaks should be detected

  Scenario: Large template handling
    Given I have a template that generates 100 files
    When I use the MCP tool to generate all files
    Then generation should complete within 3 seconds
    And disk I/O should be optimized
    And progress should be reportable

  Scenario: Template caching effectiveness
    Given I have templates with complex variable scanning
    When I call "unjucks_help" multiple times for the same template
    Then the first call should complete within 300ms
    And subsequent calls should complete within 50ms
    And cache hit rate should be > 90%

  Scenario: Resource cleanup efficiency
    Given I perform file generation operations
    When operations complete or fail
    Then temporary files should be cleaned up within 1 second
    And no orphaned processes should remain
    And file handles should be properly released

  Scenario: Startup performance
    When the MCP server is initialized
    Then server startup should complete within 2 seconds
    And template indexing should complete within 1 second
    And the server should be ready to accept requests

  Scenario: Error handling performance impact
    When invalid requests are made to the MCP server:
      | error_type           | expected_response_time |
      | malformed_json       | < 50ms                 |
      | invalid_parameters   | < 100ms                |
      | nonexistent_template | < 200ms                |
    Then error responses should be fast
    And error handling should not impact other requests
    And the server should remain responsive

  Scenario: Graceful degradation under extreme load
    When the server receives 200 requests per second
    Then it should implement appropriate rate limiting
    And maintain service for priority requests
    And provide meaningful error messages for rejected requests
    And not consume excessive system resources

  Scenario: Background task performance
    Given the server performs background operations:
      | task_type              | frequency    |
      | template cache refresh | every 5 min  |
      | temporary file cleanup | every 1 min  |
      | performance metrics    | every 30 sec |
    Then background tasks should not impact request handling
    And should complete within allocated time windows
    And should be interruptible for server shutdown

  Scenario: File system performance optimization
    Given I have templates in nested directory structures
    When performing template discovery and parsing
    Then file system operations should be minimized
    And directory traversal should be efficient
    And file metadata should be cached appropriately

  Scenario: Network performance for MCP communication
    When MCP requests are made over the network
    Then request serialization should be efficient
    And response payloads should be minimal but complete
    And compression should be used where appropriate
    And connection pooling should be optimized