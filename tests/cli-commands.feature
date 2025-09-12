Feature: KGEN CLI Command Execution
  As a knowledge graph engineer
  I want to execute KGEN CLI commands with proper JSON output
  So that I can validate all 19+ commands work correctly with machine-readable responses

  Background:
    Given KGEN CLI is available at "bin/kgen.mjs"
    And I have a test RDF file "test-graph.ttl"
    And I have a templates directory "_templates"

  # Graph Operations (3 commands)
  Scenario: Execute graph hash command
    When I run "node bin/kgen.mjs graph hash test-graph.ttl"
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "graph:hash"
    And the JSON should have success field as true
    And the JSON should contain file path and hash fields
    And the JSON should contain algorithm "sha256"

  Scenario: Execute graph diff command
    Given I have two RDF files "graph1.ttl" and "graph2.ttl"
    When I run "node bin/kgen.mjs graph diff graph1.ttl graph2.ttl"
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "graph:diff"
    And the JSON should have success field as true
    And the JSON should contain differences count
    And the JSON should contain identical boolean field

  Scenario: Execute graph index command
    When I run "node bin/kgen.mjs graph index test-graph.ttl"
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "graph:index"
    And the JSON should have success field as true
    And the JSON should contain triples count
    And the JSON should contain subjects, predicates, and objects counts

  # Artifact Operations (3 commands)
  Scenario: Execute artifact generate command
    Given I have a template "base.njk" in templates directory
    When I run "node bin/kgen.mjs artifact generate --graph test-graph.ttl --template base"
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "artifact:generate"
    And the JSON should have success field as true
    And the JSON should contain outputPath and contentHash fields
    And the JSON should contain attestationPath field

  Scenario: Execute artifact drift command
    Given I have a project directory with generated artifacts
    When I run "node bin/kgen.mjs artifact drift ."
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "artifact:drift"
    And the JSON should have success field as true
    And the JSON should contain driftDetected boolean field
    And the JSON should contain exitCode field

  Scenario: Execute artifact explain command
    Given I have a generated artifact "output.txt"
    When I run "node bin/kgen.mjs artifact explain output.txt"
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "artifact:explain"
    And the JSON should have success field as true
    And the JSON should contain hasAttestation boolean field
    And the JSON should contain artifact path field

  # Project Operations (2 commands)
  Scenario: Execute project lock command
    When I run "node bin/kgen.mjs project lock ."
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "project:lock"
    And the JSON should have success field as true
    And the JSON should contain lockfile path
    And the JSON should contain filesHashed count
    And the JSON should contain rdfFiles count

  Scenario: Execute project attest command
    Given I have a project with generated artifacts
    When I run "node bin/kgen.mjs project attest ."
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "project:attest"
    And the JSON should have success field as true
    And the JSON should contain attestationPath
    And the JSON should contain summary with verification counts

  # Templates Operations (2 commands)
  Scenario: Execute templates ls command
    When I run "node bin/kgen.mjs templates ls"
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "templates:ls"
    And the JSON should have success field as true
    And the JSON should contain templatesDir path
    And the JSON should contain templates array
    And the JSON should contain count field

  Scenario: Execute templates show command with verbose
    Given I have a template "base.njk"
    When I run "node bin/kgen.mjs templates show base"
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "templates:show"
    And the JSON should have success field as true
    And the JSON should contain template name "base"
    And the JSON should contain details object

  # Rules Operations (2 commands)
  Scenario: Execute rules ls command
    When I run "node bin/kgen.mjs rules ls"
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "rules:ls"
    And the JSON should have success field as true
    And the JSON should contain rulesDir path
    And the JSON should contain rules array
    And the JSON should contain count field

  Scenario: Execute rules show command
    Given I have a rule file "test.n3" in rules directory
    When I run "node bin/kgen.mjs rules show test"
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "rules:show"
    And the JSON should have success field as true
    And the JSON should contain rule name "test"
    And the JSON should contain details object with prefixes

  # Deterministic Operations (5 commands)
  Scenario: Execute deterministic render command
    Given I have a template "simple.njk"
    When I run 'node bin/kgen.mjs deterministic render simple.njk --context "{\"name\":\"test\"}"'
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "deterministic:render"
    And the JSON should have success field as true
    And the JSON should contain contentHash
    And the JSON should contain deterministic boolean field

  Scenario: Execute deterministic generate command
    Given I have a template "gen.njk"
    When I run 'node bin/kgen.mjs deterministic generate gen.njk --output output.txt'
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "deterministic:generate"
    And the JSON should have success field as true
    And the JSON should contain outputPath
    And the JSON should contain attestationPath
    And the JSON should contain contentHash

  Scenario: Execute deterministic validate command
    Given I have a template "validate.njk"
    When I run "node bin/kgen.mjs deterministic validate validate.njk"
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "deterministic:validate"
    And the JSON should have success field as true
    And the JSON should contain deterministicScore
    And the JSON should contain issues array
    And the JSON should contain recommendations array
    And the JSON should contain variables array

  Scenario: Execute deterministic verify command
    Given I have an artifact "verify-test.txt" with attestation
    When I run "node bin/kgen.mjs deterministic verify verify-test.txt --iterations 2"
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "deterministic:verify"
    And the JSON should have success field as true
    And the JSON should contain verified boolean field
    And the JSON should contain iterations count
    And the JSON should contain originalHash

  Scenario: Execute deterministic status command
    When I run "node bin/kgen.mjs deterministic status"
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "deterministic:status"
    And the JSON should have success field as true
    And the JSON should contain health status
    And the JSON should contain statistics object
    And the JSON should contain healthDetails object

  # Performance Operations (3 commands)
  Scenario: Execute perf status command
    When I run "node bin/kgen.mjs perf status"
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain coldStart object
    And the JSON should contain charter object
    And the JSON should contain coldStart.target of 2000
    And the JSON should contain coldStart.status

  Scenario: Execute perf benchmark command
    When I run "node bin/kgen.mjs perf benchmark --type full"
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain benchmarks object
    And the JSON should have success field as true
    And the JSON should contain timestamp

  Scenario: Execute perf test command
    When I run "node bin/kgen.mjs perf test"
    Then the command should exit with code 0 or 1
    And the output should be valid JSON
    And the JSON should contain compliance object
    And the JSON should contain timestamp

  # Drift Operations (1 command - alternative access)
  Scenario: Execute drift detect command
    When I run "node bin/kgen.mjs drift detect ."
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "drift:detect"
    And the JSON should have success field as true
    And the JSON should contain driftDetected boolean field
    And the JSON should contain directory path

  # Validation Operations (3 commands)
  Scenario: Execute validate artifacts command
    When I run "node bin/kgen.mjs validate artifacts . --recursive"
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "validate:artifacts"
    And the JSON should have success field as true
    And the JSON should contain path field

  Scenario: Execute validate graph command
    When I run "node bin/kgen.mjs validate graph test-graph.ttl"
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "validate:graph"
    And the JSON should have success field as true
    And the JSON should contain file path

  Scenario: Execute validate provenance command
    Given I have an artifact "prov-test.txt"
    When I run "node bin/kgen.mjs validate provenance prov-test.txt"
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "validate:provenance"
    And the JSON should have success field as true
    And the JSON should contain artifact path

  # Query Operations (1 command)
  Scenario: Execute query sparql command
    Given I have a SPARQL query "SELECT * WHERE { ?s ?p ?o } LIMIT 5"
    When I run 'node bin/kgen.mjs query sparql --graph test-graph.ttl --query "SELECT * WHERE { ?s ?p ?o } LIMIT 5"'
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "query:sparql"
    And the JSON should have success field as true
    And the JSON should contain graph path
    And the JSON should contain format field

  # Generate Operations (1 command)
  Scenario: Execute generate docs command
    When I run "node bin/kgen.mjs generate docs --graph test-graph.ttl --template docs"
    Then the command should exit with code 0
    And the output should be valid JSON
    And the JSON should contain operation "generate:docs"
    And the JSON should have success field as true
    And the JSON should contain graph path
    And the JSON should contain template name

  # Version and Help Commands
  Scenario: Execute version command
    When I run "node bin/kgen.mjs --version"
    Then the command should exit with code 0
    And the output should contain version information

  Scenario: Execute help command
    When I run "node bin/kgen.mjs --help"
    Then the command should exit with code 0
    And the output should contain "KGEN - Knowledge Graph Engine"
    And the output should contain "USAGE kgen"
    And the output should contain "COMMANDS"