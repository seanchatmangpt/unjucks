Feature: Comprehensive Validation of HYGEN-DELTA Claims
  As a stakeholder evaluating Unjucks
  I want to validate all claims made in HYGEN-DELTA.md
  So that I can confirm Unjucks delivers on its promised superiority

  Background:
    Given I have a project with templates directory
    And I am in the project root directory

  @critical @validation @claims
  Scenario Outline: Validate core superiority claims
    Given I have templates that demonstrate <feature>
    When I test the <feature> against equivalent Hygen functionality
    Then Unjucks should show <improvement> improvement
    And the feature should be <status>

    Examples:
      | feature | improvement | status |
      | frontmatter processing | significant | superior |
      | file operations | atomic safety | superior |
      | template engine | performance boost | superior |
      | CLI generation | dynamic flags | superior |
      | safety features | comprehensive | superior |

  @critical @validation @frontmatter @all-10-options
  Scenario: Validate all 10 frontmatter options work correctly
    Given I have templates testing all frontmatter options:
      """
      Hygen Standard (6 options):
      1. to: "path/{{ name }}.ext"
      2. inject: true/false
      3. after: "marker text"
      4. before: "marker text"
      5. skip_if: "condition"
      6. sh: "command"
      
      Unjucks Unique (4 options):
      7. append: true/false
      8. prepend: true/false
      9. lineAt: number
      10. chmod: "permissions"
      """
    When I test each frontmatter option individually
    Then all 6 Hygen-compatible options should work identically
    And all 4 Unjucks-unique options should work as documented
    And complex combinations should work together
    And error handling should be comprehensive

  @critical @validation @performance
  Scenario: Validate performance claims against benchmarks
    Given I have identical operations in both Hygen and Unjucks
    When I run performance benchmarks:
      """
      Operations to test:
      - Cold start time
      - Template processing  
      - File operations
      - Memory usage
      - Error recovery
      """
    Then Unjucks should meet or exceed all performance claims:
      | Metric | Claimed Improvement | Actual Result |
      | Cold start | 25% faster | >= 25% |
      | Template processing | 40% faster | >= 40% |
      | File operations | 25% faster | >= 25% |
      | Memory usage | 20% less | <= 80% |
      | Error recovery | Advanced | Significantly better |

  @critical @validation @safety
  Scenario: Validate comprehensive safety features
    Given I test all safety features:
      """
      1. Dry-run mode with detailed preview
      2. Force mode with confirmations
      3. Atomic writes with backup creation
      4. Idempotent operations
      5. Path validation and sandboxing
      6. Input sanitization
      7. Rollback on failure
      8. Git-aware operations
      """
    When I run safety validation tests
    Then each safety feature should work as documented
    And safety overhead should be minimal (< 10%)
    And error messages should be clear and actionable
    And no data loss should occur under any failure scenario

  @critical @validation @template-engine
  Scenario: Validate Nunjucks superiority over EJS
    Given I have equivalent templates in both formats:
      """
      Advanced features to test:
      1. Template inheritance (extends/blocks)
      2. Reusable macros  
      3. Rich filter library (8+ filters)
      4. Async template processing
      5. Superior error handling
      6. Dynamic filename support
      """
    When I compare Nunjucks vs EJS functionality
    Then Nunjucks should provide all claimed advantages:
      | Feature | Nunjucks | EJS | Advantage |
      | Inheritance | ✅ Full | ❌ None | Template reuse |
      | Macros | ✅ Full | ❌ Limited | Code reuse |
      | Filters | ✅ 8+ built-in | ❌ Basic | Rich transformations |
      | Async | ✅ Native | ❌ Limited | Real-time data |
      | Errors | ✅ Detailed | ❌ Basic | Better debugging |
      | Dynamic paths | ✅ Full | ❌ Limited | Flexible output |

  @critical @validation @cli
  Scenario: Validate dynamic CLI generation claims
    Given I have templates with various variable patterns
    When I test CLI generation features:
      """
      1. Automatic flag generation from template variables
      2. Type inference from usage patterns
      3. Interactive prompts for missing variables
      4. Smart validation based on constraints
      5. Enhanced help with examples
      6. Configuration file integration
      """
    Then all CLI features should work as documented
    And help generation should be fast (< 100ms)
    And type inference should be accurate (> 90%)
    And interactive mode should handle edge cases gracefully

  @critical @validation @hygen-parity
  Scenario: Validate complete Hygen compatibility
    Given I migrate a complete Hygen project to Unjucks
    When I test all compatibility features:
      """
      Critical compatibility requirements:
      1. Positional parameter syntax (unjucks component new Name)
      2. All 6 frontmatter options work identically
      3. Template syntax migration (EJS → Nunjucks)
      4. Helper function equivalency  
      5. Configuration file compatibility
      6. Workflow compatibility (95% of templates)
      """
    Then 100% of critical features should work
    And migration should be straightforward
    And enhanced features should be immediately available
    And performance should be superior in all categories

  @regression @validation @edge-cases
  Scenario: Validate edge case handling
    Given I test various edge cases and failure scenarios:
      """
      Edge cases to validate:
      1. Empty or malformed templates
      2. Binary file handling
      3. Large template files (> 1MB)
      4. Concurrent operations
      5. Network failures (if applicable)
      6. Disk space exhaustion
      7. Permission issues
      8. Unicode/encoding issues
      """
    When I run comprehensive edge case tests
    Then all edge cases should be handled gracefully
    And error messages should be helpful
    And system should remain stable
    And no data corruption should occur

  @performance @validation @scalability
  Scenario: Validate scalability claims
    Given I test Unjucks with increasing load:
      """
      Scalability tests:
      1. 1 template → 1000 templates
      2. 1 file → 10,000 files
      3. Simple variables → complex objects
      4. Sequential → concurrent operations
      5. Small projects → enterprise-scale
      """
    When I measure performance at each scale
    Then performance should scale linearly or better
    And memory usage should remain reasonable
    And error handling should remain consistent
    And features should work at any scale

  @integration @validation @ecosystem
  Scenario: Validate ecosystem and tooling claims
    Given I test integration with development ecosystem:
      """
      Integration points:
      1. TypeScript projects
      2. Modern build tools (Vite, Webpack)
      3. CI/CD pipelines
      4. Git workflows
      5. IDE support potential
      6. Package manager compatibility
      """
    When I validate each integration point
    Then Unjucks should integrate seamlessly
    And provide equal or better tooling support than Hygen
    And enable modern development workflows
    And support enterprise-grade usage

  @critical @validation @documentation
  Scenario: Validate all documented features work as described
    Given I follow all examples from HYGEN-DELTA.md
    When I reproduce each documented example exactly
    Then every example should work as shown
    And performance should match documented claims
    And all features should be accessible
    And migration paths should be clear and accurate

  @smoke @validation @quick-verification
  Scenario: Quick verification of key claims
    Given I want to quickly validate Unjucks superiority
    When I run the most critical tests:
      """
      Quick validation checklist:
      ✅ Positional parameters work (critical gap addressed)
      ✅ All 10 frontmatter options work
      ✅ Dynamic CLI generates flags from templates
      ✅ Safety features prevent data loss
      ✅ Performance exceeds Hygen significantly
      ✅ Template engine provides advanced features
      ✅ Migration from Hygen is straightforward
      ✅ Error handling is superior
      """
    Then all critical claims should be validated
    And Unjucks should demonstrate clear superiority
    And the "98% Hygen functionality achieved" claim should be verified
    And the "only positional parameters missing" gap should be closed