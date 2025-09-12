Feature: Deterministic Template Processing
  As a template developer
  I want templates to render identically every time
  So that generated code and documents are reproducible

  Background:
    Given KGEN template engine is initialized
    And deterministic mode is enabled
    And template cache is cleared

  @templates @rendering
  Scenario: Render templates with identical variable resolution
    Given a template with complex variable expressions
    And variables containing nested objects and arrays
    When I render the template multiple times
    Then variable resolution order must be deterministic
    And computed expressions must yield identical results
    And template output must be byte-identical

  @templates @loops
  Scenario: Process template loops deterministically
    Given a template with for-loops over collections
    And collections with complex objects
    When I render with identical input data
    Then loop iteration order must be consistent
    And nested loop processing must be deterministic
    And loop variable scoping must be predictable

  @templates @conditionals
  Scenario: Evaluate template conditionals consistently
    Given templates with complex conditional logic
    And conditions involving object comparisons
    When I render with the same input values
    Then conditional evaluation must be deterministic
    And branch selection must be consistent
    And nested conditionals must evaluate identically

  @templates @filters
  Scenario: Apply template filters deterministically
    Given templates using various Nunjucks filters
    And custom filters with complex logic
    When I render templates multiple times
    Then filter application order must be consistent
    And filter results must be byte-identical
    And chained filters must process deterministically

  @templates @includes
  Scenario: Process template includes and extends consistently
    Given templates with includes and inheritance
    And nested template hierarchies
    When I render the complete template
    Then include resolution order must be deterministic
    And template inheritance must be consistent
    And circular dependency detection must be reliable

  @templates @macros
  Scenario: Execute template macros deterministically
    Given templates with reusable macros
    And macros with parameters and default values
    When I render templates using these macros
    Then macro expansion must be consistent
    And parameter binding must be deterministic
    And macro output must be byte-identical

  @office @opc
  Scenario: Generate MS Office documents with OPC normalization
    Given templates for Word, Excel, or PowerPoint documents
    When I generate Office documents
    Then OPC (Open Packaging Convention) must be normalized
    And XML part ordering must be deterministic
    And relationship IDs must be consistent
    And document properties must respect SOURCE_DATE_EPOCH

  @pdf @documents
  Scenario: Generate PDF documents deterministically
    Given templates for PDF generation
    When I create PDF documents
    Then PDF metadata must use SOURCE_DATE_EPOCH
    And object ordering within PDF must be consistent
    And embedded fonts must be handled deterministically
    And PDF ID fields must be reproducible

  @code @generation
  Scenario: Generate source code with consistent formatting
    Given code generation templates
    When I generate source files
    Then indentation must be consistent
    And import/include ordering must be deterministic
    And comment generation must be reproducible
    And code block structure must be identical

  @config @yaml-json
  Scenario: Generate configuration files deterministically
    Given templates for YAML/JSON configuration
    When I generate config files
    Then key ordering must be deterministic
    And nested structure must be consistent
    And value formatting must be identical
    And comments must be placed consistently

  @markdown @documentation
  Scenario: Generate documentation with consistent structure
    Given Markdown/documentation templates
    When I generate documentation files
    Then heading structure must be consistent
    And link ordering must be deterministic
    And table formatting must be identical
    And code block syntax must be standardized

  @binary @assets
  Scenario: Handle binary assets deterministically
    Given templates that include binary assets
    When I generate artifacts with embedded binaries
    Then binary inclusion must be consistent
    And asset ordering must be deterministic
    And binary metadata must use SOURCE_DATE_EPOCH
    And checksums of binaries must be preserved

  @error-handling @templates
  Scenario: Handle template errors consistently
    Given templates with potential error conditions
    When template processing encounters errors
    Then error messages must be deterministic
    And error recovery must be consistent
    And partial outputs must be handled identically
    And error logs must not include timestamps

  @performance @caching
  Scenario: Template caching maintains deterministic behavior
    Given templates with caching enabled
    When I render cached vs uncached templates
    Then outputs must be byte-identical
    And cache invalidation must be deterministic
    And cache keys must be reproducible
    And cached metadata must be consistent

  @variables @scope
  Scenario: Variable scoping behaves deterministically
    Given templates with complex variable scoping
    And variables shadowing in different contexts
    When I render templates with nested scopes
    Then variable resolution must be predictable
    And scope inheritance must be consistent
    And variable conflicts must be resolved identically

  @internationalization @i18n
  Scenario: Internationalization support is deterministic
    Given templates with i18n features
    And locale-specific content
    When I render with specific locale settings
    Then locale resolution must be deterministic
    And message formatting must be consistent
    And cultural formatting must be predictable
    And fallback mechanisms must be reproducible