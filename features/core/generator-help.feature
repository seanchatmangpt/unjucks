@core @help @documentation @smoke  
Feature: Generator Help and Documentation System
  As a developer using Unjucks
  I want comprehensive help for generators and commands
  So that I can use them effectively without external documentation

  Background:
    Given I have a clean test workspace
    And I have a generator "react-component" with variables:
      | name      | required | type    | description                |
      | name      | true     | string  | Component name in PascalCase |
      | withProps | false    | boolean | Include props interface      |
      | withTests | false    | boolean | Include test file            |

  @general-help
  Scenario: Display general Unjucks help
    When I run "unjucks --help"
    Then I should see general usage information:
      | Usage: unjucks <command> [options]        |
      | Commands:                                 |
      |   list      List available generators     |
      |   generate  Generate code from templates  |
      |   help      Show help for specific items  |
      |   init      Initialize unjucks project    |
    And I should see global options:
      | --version     Show version number    |
      | --help        Show this help        |
      | --verbose     Enable verbose output |
      | --dry-run     Preview without files |

  @command-help
  Scenario: Display help for specific commands
    When I run "unjucks generate --help"
    Then I should see command-specific help:
      | Usage: unjucks generate <generator> [options] |
      | Generate code from templates                   |
      |                                               |
      | Arguments:                                    |
      |   generator    Name of generator to use       |
      |                                               |
      | Options:                                      |
      |   --dest <dir>        Output directory        |
      |   --dry-run          Preview without writing |
      |   --force            Overwrite existing files|
      |   --variables-file   Load vars from JSON     |

  @generator-specific-help
  Scenario: Display help for specific generator
    When I run "unjucks help react-component"
    Then I should see generator documentation:
      | Generator: react-component                     |
      | Description: React functional component        |
      |                                               |
      | Variables:                                    |
      |   name (required)    - Component name         |
      |   withProps (optional) - Include props        |
      |   withTests (optional) - Include test file    |
      |                                               |
      | Examples:                                     |
      |   unjucks generate react-component --name UserCard |
      |   unjucks generate react-component --name Button --withProps --withTests |

  @variable-documentation
  Scenario: Show detailed variable information
    When I run "unjucks help react-component --variables"
    Then I should see detailed variable docs:
      | Variables for react-component:                 |
      |                                               |
      | name (string, required)                       |
      |   Description: Component name in PascalCase   |
      |   Validation: Must match /^[A-Z][a-zA-Z0-9]*$/ |
      |   Examples: UserCard, ProfileButton           |
      |                                               |
      | withProps (boolean, optional)                 |
      |   Description: Include TypeScript props       |
      |   Default: false                              |
      |   Accepted: true, false, yes, no, 1, 0       |

  @examples-help
  Scenario: Show generator usage examples
    When I run "unjucks help react-component --examples"
    Then I should see comprehensive examples:
      | Basic Usage:                                  |
      |   unjucks generate react-component \         |
      |     --name UserProfile                       |
      |                                              |
      | With Props Interface:                        |
      |   unjucks generate react-component \         |
      |     --name UserProfile \                     |
      |     --withProps true                         |
      |                                              |
      | Full Featured Component:                     |
      |   unjucks generate react-component \         |
      |     --name UserProfile \                     |
      |     --withProps \                            |
      |     --withTests \                            |
      |     --dest ./src/components                  |

  @template-structure-help  
  Scenario: Show generator template structure
    Given the "react-component" generator has templates:
      | component.tsx.njk        | Main component file      |
      | index.ts.njk            | Export index file        |
      | component.test.tsx.njk  | Test file (conditional)  |
    When I run "unjucks help react-component --templates"
    Then I should see template information:
      | Templates:                                    |
      |   📄 component.tsx.njk → {{name}}.tsx       |
      |   📄 index.ts.njk → index.ts                 |
      |   📄 component.test.tsx.njk → {{name}}.test.tsx (if withTests) |

  @error-suggestions
  Scenario: Show helpful suggestions for command errors
    When I run "unjucks generate non-existent-generator"
    Then I should see helpful error with suggestions:
      | ✗ Generator 'non-existent-generator' not found |
      |                                                |
      | Did you mean?                                  |
      |   • react-component                            |
      |   • typescript-model                           |
      |                                                |
      | Available commands:                            |
      |   unjucks list          - Show all generators |
      |   unjucks help <name>   - Get generator help  |

  @troubleshooting-help
  Scenario: Display troubleshooting information
    When I run "unjucks help --troubleshoot"
    Then I should see troubleshooting guide:
      | Common Issues and Solutions:                   |
      |                                               |
      | Problem: Generator not found                   |
      | Solution: Check spelling and run 'unjucks list' |
      |                                               |
      | Problem: Variables not rendering               |
      | Solution: Check syntax {{variableName}}        |
      |                                               |
      | Problem: Permission denied                     |
      | Solution: Check write permissions in target    |

  @contextual-help
  Scenario: Show contextual help based on project type
    Given I am in a React project with package.json containing "react"
    When I run "unjucks help"
    Then I should see React-specific recommendations:
      | 🎯 Detected React project                      |
      |                                               |
      | Recommended generators:                        |
      |   • react-component  - Create React components |
      |   • react-hook      - Create custom hooks     |
      |                                               |
      | Quick start:                                   |
      |   unjucks generate react-component --name MyComponent |

  @validation-help
  Scenario: Show variable validation rules
    When I run "unjucks help react-component --validation"
    Then I should see validation information:
      | Variable Validation Rules:                     |
      |                                               |
      | name:                                         |
      |   ✓ Required field                            |
      |   ✓ Must be PascalCase                        |
      |   ✓ Length: 3-50 characters                   |
      |   ✓ Pattern: /^[A-Z][a-zA-Z0-9]*$/           |
      |                                               |
      | withProps:                                    |
      |   ✓ Optional boolean                          |
      |   ✓ Accepts: true/false, yes/no, 1/0          |

  @interactive-help
  Scenario: Interactive help browser
    When I run "unjucks help --interactive"
    Then I should see an interactive help menu
    And I should be able to navigate through help topics
    And I should be able to search for specific information
    And I should be able to exit gracefully