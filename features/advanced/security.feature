@advanced @security
Feature: Security Features
  As a security-conscious developer
  I want Unjucks to prevent security vulnerabilities and unauthorized access
  So that code generation is safe in any environment

  Background:
    Given an Unjucks project with security features enabled
    And the following security policies are configured:
      | policy                    | value                          |
      | allow_shell_commands      | false                          |
      | sandbox_template_execution| true                           |
      | max_output_file_size      | 10MB                          |
      | allowed_output_extensions | [.js, .ts, .json, .md]       |
      | blocked_paths             | [/etc, /var, /root, /usr/bin] |

  @path-traversal-prevention
  Scenario: Prevention of path traversal attacks
    Given a template with malicious path traversal attempts
    When I try to generate files with paths containing:
      | malicious_path           |
      | ../../../etc/passwd      |
      | ..\\..\\windows\\system32|
      | /root/.ssh/id_rsa        |
      | ${HOME}/.aws/credentials |
    Then all path traversal attempts should be blocked
    And I should see security warnings for each attempt
    And no files should be created outside the project directory
    And the security violation should be logged

  @shell-command-sandboxing
  Scenario: Shell command execution sandboxing
    Given a template attempting to execute shell commands:
      """
      {{# sh }}rm -rf /{{/ sh }}
      {{# exec }}cat /etc/passwd{{/ exec }}
      {{# system }}curl malicious-site.com{{/ system }}
      """
    When I generate files from this template
    Then shell command execution should be completely blocked
    And I should see security errors for each command attempt
    And no system commands should be executed
    And the template should fail safe with clear error messages

  @secret-detection-prevention
  Scenario: Detection and prevention of secret exposure
    Given templates containing potential secrets:
      | secret_type        | pattern                           |
      | api_keys          | sk-1234567890abcdef               |
      | passwords         | password: "secret123"             |
      | private_keys      | -----BEGIN PRIVATE KEY-----       |
      | aws_credentials   | AKIA1234567890ABCDEF              |
      | database_urls     | postgres://user:pass@host/db      |
      | jwt_tokens        | eyJhbGciOiJIUzI1NiIs...          |
    When I generate files containing these patterns
    Then secrets should be detected automatically
    And I should receive warnings about potential secret exposure
    And generation should be blocked in strict security mode
    And suggestions for secure alternatives should be provided

  @file-permission-validation
  Scenario: File permission and access validation
    Given security policies restricting file permissions
    When I generate files with various permission requirements
    Then executable files should be flagged for review
    And world-writable files should be prevented
    And files should be created with safe default permissions (644)
    And permission escalation attempts should be blocked

  @workspace-isolation
  Scenario: Workspace isolation and containment
    Given multiple Unjucks projects in the same system
    When I run generators in different project workspaces
    Then each project should be isolated from others
    And cross-project file access should be prevented
    And template resolution should be scoped to project boundaries
    And shared system resources should be protected

  @input-validation
  Scenario: Template input validation and sanitization
    Given user inputs containing potentially dangerous content:
      | input_type          | dangerous_content                |
      | script_injection    | <script>alert('xss')</script>   |
      | sql_injection       | '; DROP TABLE users; --          |
      | command_injection   | ; rm -rf / #                     |
      | path_injection      | ../../secrets.txt                |
      | unicode_attacks     | %c0%ae%c0%ae%c0%af%c0%ae%c0%ae  |
    When I pass these inputs to template generation
    Then all inputs should be properly sanitized
    And dangerous content should be escaped or rejected
    And I should see validation errors for malicious inputs
    And generated files should be safe from injection attacks

  @template-source-verification
  Scenario: Template source verification and integrity
    Given templates from untrusted sources
    When I attempt to use external or remote templates
    Then template sources should be verified for authenticity
    And checksums should be validated for integrity
    And unsigned templates should trigger security warnings
    And I should be able to whitelist trusted template sources

  @access-control-enforcement
  Scenario: Role-based access control
    Given different user roles with varying permissions:
      | role        | permissions                         |
      | developer   | [read, write, generate]            |
      | reviewer    | [read, generate]                   |
      | restricted  | [read]                             |
      | admin       | [read, write, generate, configure] |
    When users with different roles attempt operations
    Then permissions should be enforced correctly
    And unauthorized operations should be blocked
    And audit logs should record access attempts

  @resource-limits-enforcement
  Scenario: Resource consumption limits
    Given resource limits are configured:
      | limit_type           | value  |
      | max_file_size        | 10MB   |
      | max_files_generated  | 1000   |
      | max_memory_usage     | 256MB  |
      | max_execution_time   | 300s   |
    When I attempt operations exceeding these limits
    Then resource consumption should be monitored
    And operations should be terminated when limits are exceeded
    And I should see clear error messages about limit violations
    And system resources should be protected from exhaustion

  @secure-variable-handling
  Scenario: Secure handling of sensitive variables
    Given template variables containing sensitive information
    When sensitive variables are processed
    Then sensitive data should be masked in logs
    And variables should not be cached inappropriately
    And memory should be cleared after variable processing
    And sensitive variables should be marked and handled specially

  @audit-logging
  Scenario: Comprehensive audit logging
    Given security-sensitive operations are performed
    When I generate files, modify templates, or change configurations
    Then all operations should be logged with:
      | log_field    | description                    |
      | timestamp    | ISO 8601 formatted timestamp  |
      | user         | User identifier               |
      | operation    | Type of operation performed   |
      | resource     | Affected files or templates   |
      | result       | Success, failure, or warning  |
      | ip_address   | Source IP if applicable       |
    And logs should be tamper-evident
    And log retention should follow security policies

  @vulnerability-scanning
  Scenario: Automated vulnerability scanning
    Given templates and generated code
    When vulnerability scanning is enabled
    Then templates should be scanned for known vulnerability patterns
    And generated code should be analyzed for security issues
    And I should receive reports of potential vulnerabilities:
      | vulnerability_type    | severity | description           |
      | hardcoded_credentials | HIGH     | Embedded API keys     |
      | unsafe_deserialization| MEDIUM   | Unsafe JSON.parse     |
      | regex_dos            | LOW      | Catastrophic backtrack|
    And remediation suggestions should be provided

  @secure-defaults
  Scenario: Security-first default configurations
    Given a new Unjucks project initialization
    When I create a project without explicit security configuration
    Then secure defaults should be applied automatically:
      | setting                  | default_value |
      | shell_execution          | disabled      |
      | remote_templates         | disabled      |
      | file_permissions         | restrictive   |
      | path_validation          | strict        |
      | input_sanitization       | enabled       |
    And security warnings should guide users toward secure practices

  @encryption-support
  Scenario: Encryption of sensitive template data
    Given templates containing encrypted sensitive sections
    When I decrypt and process encrypted template content
    Then decryption should require proper authentication
    And encrypted content should remain protected in memory
    And decryption keys should be managed securely
    And unencrypted content should be cleared after use

  @network-security
  Scenario: Network security for remote operations
    Given remote template sources and external integrations
    When I fetch templates or data from remote sources
    Then all network communication should use TLS/HTTPS
    And certificate validation should be enforced
    And network timeouts should prevent hanging operations
    And proxy settings should be respected for corporate environments

  @security-testing-integration
  Scenario: Integration with security testing tools
    Given security testing tools are available in the environment
    When I generate code that should be security tested
    Then integration hooks should trigger security scans
    And SAST (Static Application Security Testing) should be supported
    And security test results should be integrated into reports
    And failing security tests should block unsafe code generation

  @incident-response
  Scenario: Security incident response capabilities
    Given a security incident is detected
    When malicious activity is identified
    Then immediate containment measures should be activated
    And affected operations should be suspended
    And incident details should be logged for investigation
    And recovery procedures should be initiated automatically

  @compliance-enforcement
  Scenario: Compliance with security standards
    Given compliance requirements (SOC2, ISO27001, etc.)
    When I configure Unjucks for compliance
    Then security controls should align with standards
    And compliance reports should be generatable
    And audit trails should meet regulatory requirements
    And security policies should be enforceable and verifiable