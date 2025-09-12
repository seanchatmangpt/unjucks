Feature: KGEN Template Linting for Deterministic Generation
  As a developer using KGEN for code generation
  I want templates to be validated for deterministic behavior
  So that generated code is consistent, predictable, and reproducible

  Background:
    Given KGEN template linter is initialized with strict mode
    And non-deterministic pattern detection is enabled
    And template validation rules are loaded

  Scenario: Detect non-deterministic date and time operations
    Given a template with non-deterministic patterns:
      """
      // Generated on {{ new Date() | dateFormat }}
      export class {{ className }}Service {
        private timestamp = Date.now();
        private createdAt = new Date().toISOString();
        
        getId(): string {
          return `${Date.now()}-${Math.random()}`;
        }
      }
      """
    When I lint the template for deterministic violations
    Then the linter should detect issues:
      | Line | Pattern                    | Category     | Severity |
      | 1    | new Date()                 | datetime     | error    |
      | 3    | Date.now()                 | datetime     | error    |
      | 4    | new Date().toISOString()   | datetime     | error    |
      | 7    | Date.now()                 | datetime     | error    |
      | 7    | Math.random()              | random       | error    |
    And suggestions should be provided for each violation

  Scenario: Detect non-deterministic random operations
    Given a template with random operations:
      """
      export class {{ className }}Utils {
        generateId(): string {
          return Math.random().toString(36).substring(2);
        }
        
        getRandomItem<T>(items: T[]): T {
          return items[Math.floor(Math.random() * items.length)];
        }
        
        uuid = Math.random().toString(36) + Math.random().toString(36);
      }
      """
    When I lint the template
    Then random operations should be flagged as non-deterministic:
      | Pattern       | Occurrences | Severity |
      | Math.random() | 4           | error    |
    And linter should suggest deterministic alternatives:
      | Violation     | Suggestion                                    |
      | Math.random() | Use deterministic ID generation from context |
      | Math.random() | Use seed-based random with fixed seed         |

  Scenario: Detect non-deterministic system operations
    Given a template with system-dependent code:
      """
      import { hostname, platform, arch } from 'os';
      import { readFileSync, statSync } from 'fs';
      
      export class {{ className }}Config {
        private host = hostname();
        private platform = platform();
        private arch = arch();
        
        loadConfig(): any {
          const stats = statSync('./config.json');
          const content = readFileSync('./config.json', 'utf8');
          return {
            ...JSON.parse(content),
            loadedAt: stats.mtime,
            host: this.host
          };
        }
      }
      """
    When I lint the template
    Then system operations should be flagged:
      | Pattern      | Category | Message                              |
      | hostname()   | system   | System hostname is environment-dependent |
      | platform()   | system   | Platform detection is non-deterministic  |
      | arch()       | system   | Architecture detection varies by system  |
      | statSync()   | io       | File system operations are non-deterministic |
      | stats.mtime  | datetime | File modification time is non-deterministic |

  Scenario: Detect network and external dependency operations
    Given a template with external dependencies:
      """
      export class {{ className }}Service {
        async fetchData(): Promise<any> {
          const response = await fetch('https://api.example.com/data');
          return response.json();
        }
        
        async getCurrentWeather(): Promise<any> {
          const apiKey = process.env.WEATHER_API_KEY;
          return await axios.get(`https://api.weather.com/current?key=${apiKey}`);
        }
      }
      """
    When I lint the template
    Then external dependencies should be flagged:
      | Pattern           | Category | Severity |
      | fetch()           | network  | error    |
      | axios.get()       | network  | error    |
      | process.env       | system   | warning  |
    And suggestions should include mocking or dependency injection

  Scenario: Validate deterministic template patterns
    Given a template with only deterministic operations:
      """
      export class {{ className }}Service {
        private readonly config = {{ config | json }};
        
        constructor(private readonly {{ dependency | camelCase }}: {{ dependencyType }}) {}
        
        {% for method in methods %}
        {{ method.name }}({{ method.params | join(', ') }}): {{ method.returnType }} {
          {% if method.implementation %}
          {{ method.implementation }}
          {% else %}
          throw new Error('Method not implemented: {{ method.name }}');
          {% endif %}
        }
        {% endfor %}
        
        private calculateHash(input: string): string {
          // Deterministic hash calculation
          let hash = 0;
          for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
          }
          return Math.abs(hash).toString(16);
        }
      }
      """
    When I lint the template
    Then the template should pass all deterministic checks
    And no violations should be detected
    And the template should be marked as deterministic-ready

  Scenario: Check template variable usage for determinism
    Given a template with variable dependencies:
      """
      export class {{ className }}Service {
        {% if enableCaching %}
        private cache = new Map<string, any>();
        {% endif %}
        
        {% if features.includes('logging') %}
        private logger = new Logger('{{ className }}');
        {% endif %}
        
        process(data: {{ dataType }}): {{ returnType }} {
          {% if sortingEnabled %}
          return data.sort((a, b) => a.{{ sortField }} - b.{{ sortField }});
          {% else %}
          return data;
          {% endif %}
        }
      }
      """
    When I lint the template context dependencies
    Then required variables should be identified:
      | Variable       | Type     | Required |
      | className      | string   | true     |
      | enableCaching  | boolean  | false    |
      | features       | array    | false    |
      | dataType       | string   | true     |
      | returnType     | string   | true     |
      | sortingEnabled | boolean  | false    |
      | sortField      | string   | optional |
    And conditional dependencies should be validated

  Scenario: Detect template context pollution
    Given a template that modifies global state:
      """
      {% set global.counter = (global.counter or 0) + 1 %}
      export class Service{{ global.counter }} {
        id = {{ global.counter }};
        
        {% if not global.initialized %}
        {% set global.initialized = true %}
        static initialize(): void {
          // One-time initialization
        }
        {% endif %}
      }
      """
    When I lint the template for context pollution
    Then global state modifications should be flagged:
      | Pattern                    | Issue                        |
      | global.counter = ... + 1   | Modifies global counter      |
      | global.initialized = true  | Sets global flag             |
    And suggestions should recommend context isolation

  Scenario: Validate template inheritance determinism
    Given a base template with deterministic patterns:
      """
      export abstract class {{ className }}Base {
        {% block properties %}
        protected abstract readonly config: {{ configType }};
        {% endblock %}
        
        {% block methods %}
        abstract process(input: any): any;
        {% endblock %}
      }
      """
    And a child template extending the base:
      """
      {% extends "base-class.njk" %}
      {% block properties %}
      protected readonly config = {{ config | json }};
      {% endblock %}
      
      {% block methods %}
      process(input: {{ inputType }}): {{ outputType }} {
        return this.processWithTimestamp(input);
      }
      
      private processWithTimestamp(input: {{ inputType }}): {{ outputType }} {
        return {
          ...input,
          processedAt: new Date().toISOString() // Non-deterministic!
        };
      }
      {% endblock %}
      """
    When I lint both templates for inheritance consistency
    Then base template should be deterministic
    But child template should have violations:
      | Pattern                     | Issue                           |
      | new Date().toISOString()    | Non-deterministic timestamp     |
    And inheritance chain validation should detect the violation

  Scenario: Custom deterministic validation rules
    Given custom linting rules are configured:
      """
      {
        "customChecks": [
          {
            "name": "no-console-logs",
            "pattern": "console\\.(log|warn|error|debug)",
            "category": "debugging",
            "severity": "warning",
            "message": "Console statements should not be in generated code"
          },
          {
            "name": "no-hardcoded-paths",
            "pattern": "[\"']/[a-zA-Z0-9/_.-]+[\"']",
            "category": "hardcoding",
            "severity": "error",
            "message": "Hardcoded file paths should be configurable"
          }
        ]
      }
      """
    And a template with custom rule violations:
      """
      export class {{ className }}Service {
        private configPath = "/etc/myapp/config.json";
        
        process(data: any): any {
          console.log('Processing data:', data);
          return data;
        }
      }
      """
    When I lint the template with custom rules
    Then custom violations should be detected:
      | Rule              | Pattern             | Severity |
      | no-console-logs   | console.log         | warning  |
      | no-hardcoded-paths| "/etc/myapp/config" | error    |

  Scenario: Template performance impact analysis
    Given a template with potentially expensive operations:
      """
      export class {{ className }}Service {
        {% for item in largeDataSet %}
        {% for subItem in item.children %}
        {% for property in subItem.properties %}
        process{{ property.name | pascalCase }}(): {{ property.type }} {
          // Nested loop generates many methods
        }
        {% endfor %}
        {% endfor %}
        {% endfor %}
      }
      """
    When I lint the template for performance impact
    Then nested loops should be flagged for review:
      | Pattern      | Depth | Impact  |
      | Triple loop  | 3     | high    |
    And complexity warnings should be generated

  Scenario: Template security vulnerability detection
    Given a template with security concerns:
      """
      export class {{ className }}Service {
        executeQuery(userInput: string): string {
          return eval(`SELECT * FROM users WHERE name = '${userInput}'`);
        }
        
        renderContent(html: string): string {
          return `<div>${html}</div>`; // Potential XSS
        }
        
        processFile(filename: string): void {
          require('child_process').exec(`cat ${filename}`); // Command injection
        }
      }
      """
    When I lint the template for security vulnerabilities
    Then security issues should be flagged:
      | Pattern             | Vulnerability      | Severity |
      | eval()              | Code injection     | critical |
      | template literal    | XSS potential      | high     |
      | child_process.exec  | Command injection  | critical |

  Scenario: Fix suggestion generation
    Given a template with multiple deterministic violations
    When I lint the template with fix suggestions enabled
    Then the linter should provide specific fix suggestions:
      | Violation           | Fix Suggestion                               |
      | new Date()          | Use {{ timestamp }} from template context   |
      | Math.random()       | Use {{ deterministicId }} from context      |
      | process.env.NODE_ENV| Use {{ environment }} from template context |
    And fix suggestions should include code examples
    And alternative approaches should be recommended

  Scenario: Batch template validation
    Given multiple template files in a directory:
      | File                    | Status        | Issues |
      | user.service.njk        | deterministic | 0      |
      | auth.controller.njk     | violations    | 3      |
      | logger.utility.njk      | violations    | 1      |
    When I run batch validation on the template directory
    Then aggregated results should be provided:
      | Metric                  | Value |
      | Total templates         | 3     |
      | Deterministic templates | 1     |
      | Templates with issues   | 2     |
      | Total violations        | 4     |
    And summary report should highlight problematic templates

  Scenario: Integration with template rendering pipeline
    Given a template with deterministic violations
    When I attempt to render the template with linting enabled
    Then rendering should be blocked if violations exceed threshold
    And detailed linting report should be provided
    And template should not generate output until issues are resolved

  Scenario: Continuous integration validation
    Given KGEN templates in a CI/CD pipeline
    When templates are validated as part of the build process
    Then build should fail if non-deterministic patterns are detected
    And CI logs should include detailed linting reports
    And only deterministic templates should proceed to deployment