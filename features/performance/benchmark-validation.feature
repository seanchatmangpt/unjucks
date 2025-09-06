@performance @benchmarks @hygen-delta-validation
Feature: Performance Benchmark Validation
  As a developer evaluating Unjucks
  I want to validate all performance claims from HYGEN-DELTA.md
  So that I can trust the documented performance improvements

  Background:
    Given I set up a performance testing environment
    And I prepare benchmark templates and test data

  @cold-start-performance
  Scenario: Cold start performance validation (25% faster than Hygen)
    Given I have a fresh Node.js process
    When I measure the time to execute "unjucks generate component new BenchmarkComponent"
    Then the cold start time should be under 150ms
    And it should be at least 25% faster than Hygen's baseline of 200ms
    And the improvement should be measurable across 10 runs

  @template-processing-performance  
  Scenario: Template processing speed validation (40% faster than Hygen)
    Given I have a complex template with multiple variables and conditionals:
      """
      ---
      to: "src/components/{{ name | pascalCase }}.tsx"
      ---
      import React from 'react';
      {% if withProps %}import { {{ name | pascalCase }}Props } from './types';{% endif %}
      {% if withStyles %}import styles from './{{ name | kebabCase }}.module.css';{% endif %}
      
      {% for method in methods %}
      const {{ method.name }} = {{ method.implementation }};
      {% endfor %}
      
      export const {{ name | pascalCase }}: React.FC{% if withProps %}<{{ name | pascalCase }}Props>{% endif %} = ({% if withProps %}props{% endif %}) => {
        return (
          <div {% if withStyles %}className={styles.container}{% endif %}>
            <h1>{{ name | title }}</h1>
            {% if withContent %}
            <div>{{ content | safe }}</div>
            {% endif %}
          </div>
        );
      };
      """
    When I benchmark template processing with variables:
      | name      | ComplexComponent |
      | withProps | true             |
      | withStyles| true             |
      | withContent| true            |
      | methods   | [{"name": "handleClick", "implementation": "() => {}"}] |
      | content   | "<p>Test content</p>" |
    Then template processing should complete in under 30ms
    And it should be at least 40% faster than Hygen's baseline of 50ms

  @file-operations-performance
  Scenario: File operations speed validation (25% faster than Hygen)
    Given I need to generate 50 files simultaneously
    When I execute batch file generation:
      """
      unjucks generate component new Component1 Component2 Component3 ... Component50
      """
    Then average file operation time should be under 15ms per file
    And it should be at least 25% faster than Hygen's baseline of 20ms per file
    And all files should be generated successfully

  @memory-usage-validation
  Scenario: Memory usage validation (20% less than Hygen)
    Given I monitor memory usage during template generation
    When I generate a large project with 100 components:
      ```
      for i in 1 to 100:
        unjucks generate component new Component$i --withTests --withStories
      ```
    Then peak memory usage should remain under 20MB
    And it should use at least 20% less memory than Hygen's baseline of 25MB
    And memory should be released properly after each generation

  @concurrent-performance
  Scenario: Concurrent generation performance
    Given I have multiple terminal sessions
    When I run 5 concurrent unjucks commands:
      | session | command |
      | 1       | unjucks generate component new Async1 |
      | 2       | unjucks generate api new Service1     |
      | 3       | unjucks generate model new Entity1    |
      | 4       | unjucks generate util new Helper1     |
      | 5       | unjucks generate hook new Custom1     |
    Then all commands should complete successfully
    And no command should take longer than 2x normal time
    And no resource conflicts should occur

  @large-template-performance
  Scenario: Large template handling performance
    Given I have a template generating 10,000+ lines of code:
      """
      ---
      to: "src/generated/{{ name | kebabCase }}.ts"
      ---
      // Auto-generated file with {{ itemCount }} items
      {% for i in range(itemCount) %}
      export interface Item{{ i }}Interface {
        id: string;
        name: string;
        value: number;
        metadata: {
          created: Date;
          modified: Date;
        };
      }
      
      export const item{{ i }}Factory = (): Item{{ i }}Interface => ({
        id: '{{ uuid() }}',
        name: 'Item {{ i }}',
        value: {{ i }},
        metadata: {
          created: new Date(),
          modified: new Date(),
        }
      });
      {% endfor %}
      """
    When I generate with itemCount=10000
    Then generation should complete in under 5 seconds
    And memory usage should remain stable
    And the generated file should be valid TypeScript

  @template-caching-performance
  Scenario: Template caching effectiveness
    Given I generate the same template multiple times
    When I run "unjucks generate component new TestComponent" 10 times
    Then the first run should compile the template
    And subsequent runs should use cached template
    And cached runs should be at least 50% faster than first run
    And cache should persist across command invocations

  @variable-resolution-performance
  Scenario: Variable resolution and filter performance
    Given I have a template with complex variable resolution:
      """
      ---
      to: "src/{{ name | kebabCase }}/{{ name | pascalCase }}.ts"
      ---
      {% set componentName = name | pascalCase %}
      {% set fileName = name | kebabCase %}
      {% set constantName = name | constantCase %}
      {% set camelName = name | camelCase %}
      
      import { {{ componentName }}Props } from './types';
      import { {{ constantName }}_CONFIG } from './config';
      
      export const {{ componentName }} = (props: {{ componentName }}Props) => {
        const {{ camelName }}Config = {{ constantName }}_CONFIG;
        return <div data-component="{{ fileName }}">{{ componentName }}</div>;
      };
      """
    When I benchmark variable resolution with 20 different filters
    Then variable resolution should complete in under 5ms
    And filter application should not cause performance degradation

  @error-recovery-performance
  Scenario: Error recovery performance impact
    Given I have templates with intentional errors
    When I run commands that will fail:
      | command | expected_error |
      | unjucks generate nonexistent new Test | Generator not found |
      | unjucks generate component invalid Test | Template error |
    Then error detection should happen within 100ms
    And error recovery should not impact subsequent commands
    And memory should be properly cleaned up after errors

  @startup-optimization-validation
  Scenario: Startup optimization effectiveness
    Given I measure startup overhead components
    When I profile "unjucks generate component new QuickTest"
    Then module loading should be under 50ms
    And CLI parsing should be under 20ms
    And template discovery should be under 30ms
    And total startup overhead should not exceed 100ms

  @comparison-benchmarks
  Scenario: Comparative performance validation
    Given I have equivalent templates for comparison
    When I run standardized benchmark suite:
      """
      Benchmark: Simple component generation (10 runs)
      Benchmark: Complex component with injection (10 runs)
      Benchmark: Multiple file generation (50 files)
      Benchmark: Large template processing (1000+ lines)
      """
    Then Unjucks should consistently outperform claimed metrics:
      | metric | unjucks_target | baseline | improvement |
      | Cold start | <150ms | 200ms | >25% |
      | Template processing | <30ms | 50ms | >40% |
      | File operations | <15ms | 20ms | >25% |
      | Memory usage | <20MB | 25MB | >20% |

  @regression-performance-testing
  Scenario: Performance regression detection
    Given I establish performance baselines
    When I run comprehensive performance test suite
    Then no metric should regress by more than 5%
    And improvements should be maintained consistently
    And performance should be stable across different environments