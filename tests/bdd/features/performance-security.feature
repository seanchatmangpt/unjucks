Feature: Performance and Security Validation
  As a developer concerned about application quality
  I want to ensure Unjucks operations are secure and performant
  So that I can use it safely in production environments

  Background:
    Given I have a working Unjucks installation
    And I have performance monitoring enabled
    And I have security validation enabled

  @performance
  Scenario: Template generation performance under load
    Given I have 100 template files in "templates/component"
    When I run "unjucks generate component bulk --name TestComponent --count 100 --parallel"
    Then all templates should be generated within 30 seconds
    And memory usage should stay below 500MB
    And CPU usage should not exceed 90%
    And the exit code should be 0

  @performance
  Scenario: Large file handling performance
    Given I have a template that generates a 10MB file
    When I run "unjucks generate large-file test --name BigFile"
    Then the file should be generated within 10 seconds
    And memory usage should not exceed 100MB during generation
    And temporary files should be cleaned up
    And the exit code should be 0

  @performance
  Scenario: Concurrent operation performance
    Given I have multiple Unjucks processes running
    When I run 10 concurrent "unjucks generate component test --name Test{n}"
    Then all processes should complete within 60 seconds
    And no process should fail due to resource contention
    And file system locks should be handled properly
    And the exit code should be 0 for all processes

  @performance
  Scenario: Memory efficiency with complex templates
    Given I have templates with nested loops and complex logic
    When I run "unjucks generate complex-template test --name ComplexTest"
    Then memory usage should grow linearly with template complexity
    And garbage collection should occur regularly
    And no memory leaks should be detected
    And the exit code should be 0

  @performance
  Scenario: Semantic processing performance
    Given I have a large RDF schema with 1000+ triples
    When I run "unjucks semantic validate --schema large-schema.ttl"
    Then validation should complete within 15 seconds
    And SPARQL queries should execute in under 2 seconds
    And inference should not cause performance degradation
    And the exit code should be 0

  @performance
  Scenario: Swarm coordination efficiency
    Given I have a swarm with 10 active agents
    When I run "unjucks swarm generate distributed-app --name AppTest"
    Then agent coordination overhead should be minimal
    And task distribution should be balanced
    And communication latency should be under 100ms
    And the exit code should be 0

  @security
  Scenario: Template injection attack prevention
    Given I have a template with user-provided variables
    When I run "unjucks generate user-input test --name "<script>alert('xss')</script>""
    Then malicious input should be sanitized
    And no script execution should occur
    And generated files should contain escaped content
    And the exit code should be 0

  @security
  Scenario: Path traversal attack prevention
    When I run "unjucks generate component ../../../etc/passwd --name Test"
    Then the operation should be blocked
    And I should see "Path traversal detected" error
    And no files should be written outside the project directory
    And the exit code should be 1

  @security
  Scenario: File permission validation
    Given I have templates that specify file permissions
    When I run "unjucks generate executable script --name TestScript"
    Then generated files should have safe default permissions
    And executable permissions should require explicit flag
    And sensitive files should not be world-readable
    And the exit code should be 0

  @security
  Scenario: Environment variable exposure prevention
    Given I have environment variables with sensitive data
    When I run "unjucks generate config test --name TestConfig"
    Then environment variables should not be leaked to generated files
    And template processing should not expose process.env
    And generated files should not contain sensitive data
    And the exit code should be 0

  @security
  Scenario: Code injection in templates
    Given I have a template with dynamic code execution
    When I run "unjucks generate dynamic test --name "require('fs').unlinkSync('/etc/passwd')""
    Then code execution should be prevented
    And I should see "Unsafe template operation" error
    And no system files should be affected
    And the exit code should be 1

  @security
  Scenario: Network request validation in MCP
    Given I have MCP integration enabled
    When I run "unjucks swarm init --topology mesh --external-endpoint http://malicious.com"
    Then external network requests should be validated
    And only allowed endpoints should be accessible
    And I should see security warnings for suspicious URLs
    And the exit code should be 1

  @security
  Scenario: File system access control
    Given I have restricted file system permissions
    When I run "unjucks generate component test --name Test --dest /root/sensitive"
    Then access to restricted directories should be denied
    And I should see "Access denied" error
    And no privilege escalation should occur
    And the exit code should be 1

  @security
  Scenario: RDF injection attack prevention
    Given I have RDF data processing enabled
    When I run "unjucks semantic query --sparql 'DROP GRAPH <http://example.org>; SELECT * WHERE {?s ?p ?o}'"
    Then malicious SPARQL operations should be blocked
    And I should see "Unsafe SPARQL operation" error
    And the RDF store should remain intact
    And the exit code should be 1

  @security
  Scenario: Template source validation
    Given I have templates from external sources
    When I run "unjucks generate external-template test --name Test --source https://untrusted.com/template.njk"
    Then external template sources should be validated
    And I should see "Untrusted source" warning
    And template content should be sandboxed
    And the exit code should be 1 without explicit trust flag

  @security
  Scenario: Dependency confusion attack prevention
    Given I have custom template helpers
    When I run "unjucks generate with-helpers test --name Test --helpers malicious-helper-package"
    Then only trusted helper packages should be loaded
    And I should see "Untrusted dependency" warning
    And malicious code execution should be prevented
    And the exit code should be 1

  @performance @security
  Scenario: Resource exhaustion attack prevention
    Given an attacker attempts resource exhaustion
    When I run "unjucks generate recursive-template test --name Test --depth 10000"
    Then processing should be limited to prevent DoS
    And I should see "Resource limit exceeded" error
    And system resources should remain available
    And the exit code should be 1

  @performance @security
  Scenario: Secure temporary file handling
    Given I have templates that create temporary files
    When I run "unjucks generate temp-files test --name Test"
    Then temporary files should have secure permissions
    And temporary files should be cleaned up promptly
    And no sensitive data should remain in temp files
    And the exit code should be 0

  @performance
  Scenario: Cache performance and invalidation
    Given I have template caching enabled
    When I run "unjucks generate component test --name Test" multiple times
    Then subsequent runs should be significantly faster
    And cache should be invalidated when templates change
    And cache size should be bounded
    And the exit code should be 0

  @performance
  Scenario: Streaming large outputs
    Given I have templates that generate very large files
    When I run "unjucks generate streaming-template test --name Test --size 1GB"
    Then output should be streamed to disk
    And memory usage should remain constant
    And progress should be reported to user
    And the exit code should be 0

  @security
  Scenario: Audit logging for sensitive operations
    Given I have audit logging enabled
    When I run sensitive operations like "unjucks inject config add-secret --file .env"
    Then all operations should be logged with timestamps
    And user identification should be recorded
    And sensitive data should not appear in logs
    And logs should be tamper-evident

  @security
  Scenario: Template signature verification
    Given I have signed templates
    When I run "unjucks generate signed-template test --name Test --verify"
    Then template signatures should be validated
    And unsigned templates should trigger warnings
    And tampered templates should be rejected
    And the exit code should reflect verification status

  @performance @security
  Scenario: Secure swarm communication
    Given I have swarm agents running on multiple machines
    When I run "unjucks swarm generate distributed --name Test"
    Then inter-agent communication should be encrypted
    And agent authentication should be verified
    And network traffic should be minimal and efficient
    And the exit code should be 0