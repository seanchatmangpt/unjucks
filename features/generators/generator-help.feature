@generator @help @documentation @cli
Feature: Generator Help and Documentation
  As a developer
  I want comprehensive help and documentation for generators
  So that I can understand how to use them effectively and troubleshoot issues

  Background:
    Given the unjucks system is initialized
    And the following generators exist in "_templates":
      | name              | description                    | variables           | examples    |
      | react-component   | React functional component     | name, withProps     | UserCard    |
      | express-route     | Express.js route handler       | path, method        | /api/users  |
      | typescript-model  | TypeScript data model          | name, fields        | User        |

  @general-help
  Scenario: Display general unjucks help
    When I run "unjucks --help"
    Then I should see general usage information:
      | Usage: unjucks [command] [options]           |
      | Commands:                                    |
      |   list     List available generators         |
      |   generate Generate code from templates      |
      |   help     Show help for commands           |
      |   init     Initialize unjucks in project    |
    And I should see global options:
      | --version  Show version number               |
      | --help     Show help                        |
      | --verbose  Enable verbose output            |

  @command-help
  Scenario: Display help for specific commands
    When I run "unjucks generate --help"
    Then I should see detailed command help:
      | Usage: unjucks generate [generator] [options]      |
      | Generate code from templates                        |
      |                                                     |
      | Arguments:                                          |
      |   generator  Name of the generator to use          |
      |                                                     |
      | Options:                                            |
      |   --dest <dir>     Destination directory           |
      |   --dry-run        Preview without creating files  |
      |   --force          Overwrite existing files        |
      |   --variables-file Load variables from JSON file   |

  @generator-specific-help
  Scenario: Display help for specific generator
    When I run "unjucks help react-component"
    Then I should see generator-specific documentation:
      | Generator: react-component                          |
      | Description: React functional component             |
      |                                                     |
      | Variables:                                          |
      |   name (required) - Component name in PascalCase   |
      |   withProps - Include props interface (default: false) |
      |                                                     |
      | Examples:                                           |
      |   unjucks generate react-component --name UserCard |
      |   unjucks generate react-component --name Button --withProps true |

  @generator-help-with-examples
  Scenario: Display generator help with detailed examples
    When I run "unjucks help react-component --examples"
    Then I should see comprehensive examples:
      | Basic Usage:                                        |
      |   unjucks generate react-component --name UserCard |
      |                                                     |
      | With Props:                                         |
      |   unjucks generate react-component \               |
      |     --name UserCard \                               |
      |     --withProps true                                |
      |                                                     |
      | Custom Destination:                                 |
      |   unjucks generate react-component \               |
      |     --name UserCard \                               |
      |     --dest ./components                             |

  @generator-templates-help
  Scenario: Display information about generator templates
    When I run "unjucks help react-component --templates"
    Then I should see template information:
      | Templates:                                          |
      |   📄 component.tsx.njk → {{name}}.tsx             |
      |   📄 index.ts.njk → index.ts                       |
      |   📄 component.test.tsx.njk → {{name}}.test.tsx (conditional) |
      |                                                     |
      | Template Variables:                                 |
      |   {{name}} - Component name                         |
      |   {{withProps}} - Boolean flag for props           |

  @variable-documentation
  Scenario: Display detailed variable documentation
    When I run "unjucks help react-component --variables"
    Then I should see detailed variable information:
      | Variables for react-component:                      |
      |                                                     |
      | name (string, required)                             |
      |   Description: Component name in PascalCase        |
      |   Validation: Must match /^[A-Z][a-zA-Z0-9]*$/     |
      |   Example: UserCard, ProfileButton                 |
      |                                                     |
      | withProps (boolean, optional)                       |
      |   Description: Include TypeScript props interface  |
      |   Default: false                                    |
      |   Example: true, false                              |

  @interactive-help
  Scenario: Interactive help browser
    When I run "unjucks help --interactive"
    Then I should see an interactive help browser:
      | unjucks Help Browser                                |
      | ════════════════════════════════════════════════   |
      | ❯ Getting Started                                   |
      |   Commands Overview                                 |
      |   Generator Help                                    |
      |   Configuration                                     |
      |   Troubleshooting                                   |
    When I select "Generator Help"
    Then I should see a list of generators to explore
    When I select "react-component"
    Then I should see the generator documentation

  @help-with-search
  Scenario: Search help content
    When I run "unjucks help --search variables"
    Then I should see help topics related to variables:
      | Found help topics matching "variables":            |
      | • Using variables in templates                      |
      | • Variable validation                               |
      | • Default variable values                           |
      | • Variables file format                             |

  @contextual-help
  Scenario: Show contextual help based on current directory
    Given I am in a React project directory
    When I run "unjucks help"
    Then I should see React-specific help suggestions:
      | Detected React project                              |
      | Recommended generators:                             |
      | • react-component - Create React components        |
      | • react-hook - Create custom hooks                 |
      |                                                     |
      | Quick start:                                        |
      | unjucks generate react-component --name MyComponent|

  @error-help
  Scenario: Show helpful error messages with suggestions
    When I run "unjucks generate non-existent-generator"
    Then I should see a helpful error with suggestions:
      | ✗ Generator 'non-existent-generator' not found     |
      |                                                     |
      | Did you mean?                                       |
      | • react-component                                   |
      | • typescript-model                                  |
      |                                                     |
      | To see all generators: unjucks list                |
      | To get help: unjucks help [generator]              |

  @troubleshooting-help
  Scenario: Display troubleshooting information
    When I run "unjucks help --troubleshoot"
    Then I should see troubleshooting information:
      | Common Issues and Solutions:                        |
      |                                                     |
      | Problem: Templates directory not found             |
      | Solution: Run 'unjucks init' to create _templates  |
      |                                                     |
      | Problem: Variables not working in templates        |
      | Solution: Check variable syntax {{variableName}}   |
      |                                                     |
      | Problem: Generator not found                        |
      | Solution: Run 'unjucks list' to see available      |

  @version-help
  Scenario: Display version and environment information
    When I run "unjucks --version --verbose"
    Then I should see detailed version information:
      | unjucks version: 1.0.0                             |
      | Node.js version: v18.17.0                          |
      | Platform: darwin x64                                |
      | Templates directory: _templates                     |
      | Config file: unjucks.config.js                     |
      | Installed generators: 15                            |

  @generator-validation-help
  Scenario: Show validation rules for generator variables
    When I run "unjucks help react-component --validation"
    Then I should see validation information:
      | Variable Validation Rules:                          |
      |                                                     |
      | name:                                               |
      |   ✓ Required                                        |
      |   ✓ Must be PascalCase                             |
      |   ✓ Length: 3-50 characters                        |
      |   ✓ No special characters except numbers           |
      |                                                     |
      | withProps:                                          |
      |   ✓ Must be boolean                                 |
      |   ✓ Accepts: true, false, yes, no, 1, 0           |

  @generator-dependencies-help
  Scenario: Show generator dependencies and relationships
    Given "react-component" depends on "typescript-interfaces"
    When I run "unjucks help react-component --dependencies"
    Then I should see dependency information:
      | Dependencies:                                       |
      |   📦 typescript-interfaces (required)              |
      |     Used for: Type definitions                      |
      |     Auto-install: yes                               |
      |                                                     |
      | Related Generators:                                 |
      |   🔗 react-hook (complementary)                    |
      |   🔗 react-test (testing support)                  |

  @offline-help
  Scenario: Access help without internet connection
    Given no internet connection is available
    When I run "unjucks help"
    Then I should still see complete offline help
    And all documentation should be available locally
    And I should not see any network-related errors

  @help-export
  Scenario: Export help documentation
    When I run "unjucks help --export markdown"
    Then help documentation should be exported as Markdown files:
      | docs/unjucks-help.md          |
      | docs/generators/react-component.md |
      | docs/generators/express-route.md   |
    And the exported files should contain complete documentation

  @custom-help-templates
  Scenario: Display custom help from generator metadata
    Given "react-component" has custom help metadata:
      """
      {
        "help": {
          "description": "Creates a modern React functional component with TypeScript",
          "tips": [
            "Use PascalCase for component names",
            "Enable withProps for components that accept props"
          ],
          "troubleshooting": {
            "common_errors": [
              {
                "error": "Invalid component name",
                "solution": "Ensure name starts with uppercase letter"
              }
            ]
          }
        }
      }
      """
    When I run "unjucks help react-component"
    Then I should see the custom help content including tips and troubleshooting

  @help-with-config
  Scenario: Show help for configuration options
    When I run "unjucks help config"
    Then I should see configuration documentation:
      | Configuration Options:                              |
      |                                                     |
      | Templates Directory:                                |
      |   Default: _templates                               |
      |   Override: --templates-dir or config file         |
      |                                                     |
      | Variable Defaults:                                  |
      |   Set in unjucks.config.js                        |
      |   Example: { defaultVariables: { author: "..." } } |
      |                                                     |
      | Output Directory:                                   |
      |   Default: current directory                        |
      |   Override: --dest option                          |

  @multilingual-help
  Scenario: Display help in different languages
    When I run "unjucks help --lang es"
    Then I should see help in Spanish:
      | Uso: unjucks [comando] [opciones]                   |
      | Comandos:                                           |
      |   list     Listar generadores disponibles          |
      |   generate Generar código desde plantillas         |
    And all help text should be properly localized