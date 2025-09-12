Feature: KGEN CLI JSON Output Format Validation
  As a systems integrator
  I want all KGEN CLI commands to output valid JSON with consistent structure
  So that I can reliably parse and process command outputs in automated systems

  Background:
    Given KGEN CLI is available at "bin/kgen.mjs"
    And I have test data files available

  # JSON Output Schema Validation
  Scenario Outline: Validate standard JSON output schema for successful operations
    When I run a successful KGEN command "<command>"
    Then the output should be valid JSON
    And the JSON should have required fields: success, operation, timestamp
    And the success field should be boolean true
    And the operation field should match pattern "<operation_pattern>"
    And the timestamp field should be valid ISO 8601 datetime
    And the JSON should contain metadata object when appropriate

    Examples:
      | command                           | operation_pattern    |
      | graph hash test-graph.ttl         | graph:hash          |
      | graph index test-graph.ttl        | graph:index         |
      | templates ls                      | templates:ls        |
      | rules ls                         | rules:ls            |
      | project lock .                   | project:lock        |
      | deterministic status             | deterministic:status |
      | perf status                      | perf:*              |
      | validate artifacts .             | validate:*          |

  Scenario Outline: Validate standard JSON output schema for failed operations
    When I run a failing KGEN command "<command>"
    Then the output should be valid JSON
    And the JSON should have required fields: success, operation, error, timestamp
    And the success field should be boolean false
    And the operation field should match pattern "<operation_pattern>"
    And the timestamp field should be valid ISO 8601 datetime
    And the error field should be a non-empty string
    And the JSON may contain errorCode and details fields

    Examples:
      | command                              | operation_pattern |
      | graph hash nonexistent-file.ttl     | graph:hash       |
      | artifact explain missing-file.txt   | artifact:explain |
      | templates show nonexistent-template | templates:show   |
      | rules show nonexistent-rule         | rules:show       |

  # Specific Command Output Validation
  Scenario: Validate graph hash command JSON output structure
    Given I have a test RDF file "test-graph.ttl"
    When I run "node bin/kgen.mjs graph hash test-graph.ttl"
    Then the JSON output should contain:
      | field       | type   | required |
      | success     | boolean| yes      |
      | operation   | string | yes      |
      | result.file | string | yes      |
      | result.hash | string | yes      |
      | result.size | number | yes      |
      | result.algorithm | string | yes      |
      | metadata.timestamp | string | yes      |
    And the hash field should be 64-character hexadecimal string
    And the algorithm field should be "sha256"

  Scenario: Validate graph index command JSON output structure
    Given I have a test RDF file "test-graph.ttl"
    When I run "node bin/kgen.mjs graph index test-graph.ttl"
    Then the JSON output should contain:
      | field              | type   | required |
      | success            | boolean| yes      |
      | file               | string | yes      |
      | triples            | number | yes      |
      | subjects           | number | yes      |
      | predicates         | number | yes      |
      | objects            | number | yes      |
      | index.subjects     | array  | yes      |
      | index.predicates   | array  | yes      |
      | index.objects      | array  | yes      |
      | timestamp          | string | yes      |

  Scenario: Validate artifact generate command JSON output structure
    Given I have a template "base.njk" and graph "test-graph.ttl"
    When I run "node bin/kgen.mjs artifact generate --graph test-graph.ttl --template base"
    Then the JSON output should contain:
      | field            | type    | required |
      | success          | boolean | yes      |
      | operation        | string  | yes      |
      | graph            | string  | yes      |
      | template         | string  | yes      |
      | templatePath     | string  | yes      |
      | outputPath       | string  | yes      |
      | contentHash      | string  | yes      |
      | attestationPath  | string  | yes      |
      | context          | array   | yes      |
      | timestamp        | string  | yes      |

  Scenario: Validate templates ls command JSON output structure
    When I run "node bin/kgen.mjs templates ls"
    Then the JSON output should contain:
      | field        | type    | required |
      | success      | boolean | yes      |
      | operation    | string  | yes      |
      | templatesDir | string  | yes      |
      | templates    | array   | yes      |
      | count        | number  | yes      |
      | timestamp    | string  | yes      |
    And each template in templates array should have fields: name, path, size, modified

  Scenario: Validate project lock command JSON output structure
    When I run "node bin/kgen.mjs project lock ."
    Then the JSON output should contain:
      | field        | type    | required |
      | success      | boolean | yes      |
      | lockfile     | string  | yes      |
      | filesHashed  | number  | yes      |
      | rdfFiles     | number  | yes      |
      | timestamp    | string  | yes      |

  Scenario: Validate deterministic status command JSON output structure
    When I run "node bin/kgen.mjs deterministic status"
    Then the JSON output should contain:
      | field           | type    | required |
      | success         | boolean | yes      |
      | operation       | string  | yes      |
      | health          | string  | yes      |
      | statistics      | object  | yes      |
      | healthDetails   | object  | yes      |
      | timestamp       | string  | yes      |

  Scenario: Validate performance status command JSON output structure
    When I run "node bin/kgen.mjs perf status"
    Then the JSON output should contain:
      | field                  | type    | required |
      | success                | boolean | yes      |
      | coldStart.elapsed      | number  | yes      |
      | coldStart.target       | number  | yes      |
      | coldStart.status       | string  | yes      |
      | charter.coldStartTarget| string  | yes      |
      | charter.renderTarget   | string  | yes      |
      | charter.cacheTarget    | string  | yes      |
      | timestamp              | string  | yes      |
    And coldStart.target should equal 2000
    And coldStart.status should be either "PASS" or "FAIL"

  # Error Output Validation
  Scenario: Validate error output format for missing file
    When I run "node bin/kgen.mjs graph hash missing-file.ttl"
    Then the command should exit with non-zero code
    And the JSON output should contain:
      | field     | type    | required |
      | success   | boolean | yes      |
      | operation | string  | yes      |
      | error     | string  | yes      |
      | timestamp | string  | yes      |
    And the success field should be false
    And the error field should contain "not found" or "FILE_NOT_FOUND"

  Scenario: Validate error output format for invalid arguments
    When I run "node bin/kgen.mjs graph diff only-one-file.ttl"
    Then the command should exit with non-zero code
    And the output should be valid JSON
    And the JSON should have success field as false
    And the error field should describe missing required argument

  # Output Consistency Validation
  Scenario: Validate timestamp format consistency across commands
    When I run multiple KGEN commands in sequence
    Then all JSON outputs should have timestamp fields
    And all timestamp fields should follow ISO 8601 format
    And all timestamp fields should be valid dates
    And timestamps should be reasonably close to execution time

  Scenario: Validate operation field consistency
    When I run various KGEN commands
    Then the operation field should always match pattern "namespace:action"
    And namespace should be one of: graph, artifact, project, templates, rules, deterministic, perf, drift, validate, query, generate
    And action should describe the specific operation performed

  # JSON Parsing and Structure Validation
  Scenario: Validate JSON structure is machine-parseable
    When I run any KGEN command that produces JSON output
    Then the output should be parseable by standard JSON parsers
    And the JSON should not contain undefined or null values in required fields
    And the JSON should have consistent indentation (2 spaces)
    And the JSON should end with a newline character

  Scenario: Validate JSON field types are consistent
    When I run commands that output similar data structures
    Then boolean fields should always be true/false (not 1/0 or "true"/"false")
    And number fields should be numeric, not string representations
    And array fields should be arrays, even if empty
    And object fields should be objects, even if empty

  # Content Validation
  Scenario: Validate hash values in JSON output
    When I run commands that generate hashes
    Then hash fields should be valid hexadecimal strings
    And SHA256 hashes should be exactly 64 characters long
    And hash values should be consistent for same input

  Scenario: Validate file paths in JSON output
    When I run commands that reference file paths
    Then file paths should be absolute when specified as such
    And file paths should exist when referencing input files
    And output paths should be valid filesystem paths
    And paths should use correct path separators for the platform

  # Performance and Size Validation
  Scenario: Validate JSON output size is reasonable
    When I run KGEN commands with various data sizes
    Then JSON output should not exceed reasonable size limits
    And large data structures should be truncated with indicators
    And performance metrics should be included when appropriate