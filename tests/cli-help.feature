Feature: KGEN CLI Help System and Documentation
  As a developer using KGEN
  I want comprehensive help documentation for all CLI commands
  So that I can understand how to use each command correctly

  Background:
    Given KGEN CLI is available at "bin/kgen.mjs"

  # Main Help System
  Scenario: Display main help information
    When I run "node bin/kgen.mjs --help"
    Then the command should exit with code 0
    And the output should contain "KGEN - Knowledge Graph Engine for Deterministic Artifact Generation"
    And the output should contain "USAGE kgen"
    And the output should contain "OPTIONS"
    And the output should contain "COMMANDS"
    And the output should list all main command groups
    And the output should contain version information "v1.0.0"

  Scenario: Display version information
    When I run "node bin/kgen.mjs --version"
    Then the command should exit with code 0
    And the output should contain version number
    And the version should match semantic versioning pattern

  Scenario: Display help with short flag
    When I run "node bin/kgen.mjs -h"
    Then the command should exit with code 0
    And the output should be equivalent to "--help" output

  # Global Options Documentation
  Scenario: Validate global options in help
    When I run "node bin/kgen.mjs --help"
    Then the help output should document these options:
      | option    | short | description                |
      | --debug   | -d    | Enable debug mode          |
      | --verbose | -v    | Enable verbose output      |
      | --config  | -c    | Path to configuration file |
    And each option should have clear usage description

  # Command Group Help
  Scenario Outline: Display help for command groups
    When I run "node bin/kgen.mjs <command> --help"
    Then the command should exit with code 0
    And the output should contain command description
    And the output should list available subcommands
    And the output should show usage patterns

    Examples:
      | command       |
      | graph         |
      | artifact      |
      | project       |
      | templates     |
      | rules         |
      | deterministic |
      | perf          |
      | drift         |
      | validate      |
      | query         |
      | generate      |

  # Graph Commands Help
  Scenario: Display graph command help
    When I run "node bin/kgen.mjs graph --help"
    Then the output should contain "Graph operations for knowledge graph processing"
    And the output should list subcommands:
      | subcommand | description                                    |
      | hash       | Generate canonical SHA256 hash of RDF graph   |
      | diff       | Compare two RDF graphs and show differences   |
      | index      | Build searchable index of RDF graph           |

  Scenario: Display graph hash command help
    When I run "node bin/kgen.mjs graph hash --help"
    Then the output should contain usage pattern with file argument
    And the output should describe the file parameter as required
    And the output should explain that it generates canonical SHA256 hash

  Scenario: Display graph diff command help
    When I run "node bin/kgen.mjs graph diff --help"
    Then the output should contain usage pattern with two file arguments
    And the output should describe graph1 and graph2 parameters as required
    And the output should explain comparison functionality

  # Artifact Commands Help
  Scenario: Display artifact command help
    When I run "node bin/kgen.mjs artifact --help"
    Then the output should contain "Artifact generation and management"
    And the output should list subcommands:
      | subcommand | description                                          |
      | generate   | Generate deterministic artifacts from knowledge graphs |
      | drift      | Detect drift between expected and actual artifacts  |
      | explain    | Explain artifact generation with provenance data    |

  Scenario: Display artifact generate command help
    When I run "node bin/kgen.mjs artifact generate --help"
    Then the output should document these options:
      | option     | short | description                    |
      | --graph    | -g    | Path to RDF/Turtle graph file |
      | --template | -t    | Template to use for generation |
      | --output   | -o    | Output directory              |
    And the output should show proper usage examples

  # Templates Commands Help
  Scenario: Display templates command help
    When I run "node bin/kgen.mjs templates --help"
    Then the output should contain "Template discovery and management"
    And the output should list subcommands:
      | subcommand | description                          |
      | ls         | List available templates             |
      | show       | Show template details and variables  |

  Scenario: Display templates show command help
    When I run "node bin/kgen.mjs templates show --help"
    Then the output should require template name as positional argument
    And the output should explain template analysis functionality

  # Deterministic Commands Help
  Scenario: Display deterministic command help
    When I run "node bin/kgen.mjs deterministic --help"
    Then the output should contain "Deterministic template rendering operations"
    And the output should list subcommands:
      | subcommand | description                                   |
      | render     | Render template with deterministic output    |
      | generate   | Generate deterministic artifact with attestation |
      | validate   | Validate template for deterministic rendering |
      | verify     | Verify artifact reproducibility              |
      | status     | Get deterministic rendering system status    |

  Scenario: Display deterministic render command help
    When I run "node bin/kgen.mjs deterministic render --help"
    Then the output should document these options:
      | option     | short | description                      |
      | --context  | -c    | JSON context for template        |
      | --output   | -o    | Output file path                 |
      | --rdf      | -r    | RDF content for semantic enrichment |
    And the output should show template parameter as required

  # Performance Commands Help
  Scenario: Display perf command help
    When I run "node bin/kgen.mjs perf --help"
    Then the output should contain "Performance testing and optimization"
    And the output should list subcommands:
      | subcommand | description                         |
      | test       | Run performance compliance tests    |
      | status     | Show current performance metrics    |
      | benchmark  | Run performance benchmarks         |

  Scenario: Display perf benchmark command help
    When I run "node bin/kgen.mjs perf benchmark --help"
    Then the output should document the type option
    And the output should list valid benchmark types
    And the output should explain benchmark functionality

  # Validation Commands Help
  Scenario: Display validate command help
    When I run "node bin/kgen.mjs validate --help"
    Then the output should contain "Comprehensive validation system"
    And the output should list subcommands:
      | subcommand | description                                     |
      | artifacts  | Validate generated artifacts with schema validation |
      | graph      | Validate RDF graphs                             |
      | provenance | Validate provenance chains and attestations    |

  Scenario: Display validate artifacts command help
    When I run "node bin/kgen.mjs validate artifacts --help"
    Then the output should document these options:
      | option        | short | description                           |
      | --recursive   | -r    | Recursively validate directories      |
      | --shapes-file | -s    | Path to SHACL shapes file for validation |
      | --verbose     | -v    | Enable verbose validation output      |

  # Error Cases in Help System
  Scenario: Display help for non-existent command
    When I run "node bin/kgen.mjs nonexistent --help"
    Then the command should exit with non-zero code
    And the output should indicate unknown command
    And the output should suggest available commands

  Scenario: Display help for non-existent subcommand
    When I run "node bin/kgen.mjs graph nonexistent --help"
    Then the command should exit with non-zero code
    And the output should indicate unknown subcommand
    And the output should list available subcommands for graph

  # Help Content Quality
  Scenario: Validate help content completeness
    When I run help commands for all KGEN commands
    Then each command should have clear description
    And each argument should be documented with type and purpose
    And each option should have both long and short forms where applicable
    And usage examples should be provided for complex commands

  Scenario: Validate help formatting consistency
    When I run various help commands
    Then all help output should follow consistent formatting
    And option descriptions should align properly
    And command descriptions should be concise but informative
    And usage patterns should follow standard conventions

  # Interactive Help Features
  Scenario: Validate help accessibility
    When users run help commands
    Then help output should be readable in standard terminal widths
    And important information should be highlighted appropriately
    And help should be available at multiple levels (command, subcommand)

  # Documentation Coverage
  Scenario: Validate all commands have help
    Given KGEN has these main command groups:
      | command       |
      | graph         |
      | artifact      |
      | project       |
      | templates     |
      | rules         |
      | deterministic |
      | perf          |
      | drift         |
      | validate      |
      | query         |
      | generate      |
    When I request help for each command group
    Then each should provide comprehensive help documentation
    And each should list all available subcommands
    And each subcommand should have its own help

  Scenario: Validate help includes examples
    When I run help for complex commands like "artifact generate"
    Then the help should include usage examples
    And examples should show realistic command invocations
    And examples should demonstrate common use cases

  # Help System Performance
  Scenario: Validate help system performance
    When I run help commands
    Then help should display quickly (under 1 second)
    And help commands should not require expensive initialization
    And help should be available even when other components fail

  # Context-Sensitive Help
  Scenario: Validate context-sensitive help
    When I run commands with invalid arguments
    Then error messages should suggest relevant help commands
    And error messages should be actionable
    And users should be guided toward correct usage