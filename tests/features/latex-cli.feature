Feature: LaTeX CLI Commands and Error Handling
  As a LaTeX document author
  I want comprehensive CLI support for LaTeX template generation
  So that I can efficiently create and manage LaTeX documents from the command line

  Background:
    Given I have unjucks installed
    And I have a clean working directory

  Scenario: List available LaTeX templates
    When I run "unjucks list"
    Then I should see LaTeX templates listed:
      | template_path          | description                    |
      | latex/arxiv/paper      | arXiv academic paper template  |
      | academic/arxiv-paper   | Academic paper (non-LaTeX)    |
      | legal/contract         | Legal contract template       |

  Scenario: Get help for LaTeX template
    When I run "unjucks help latex/arxiv/paper"
    Then I should see detailed parameter documentation:
      | parameter     | type    | required | description                    |
      | title         | string  | yes      | Paper title                    |
      | author        | string  | yes      | Author name(s)                 |
      | abstract      | string  | no       | Paper abstract                 |
      | documentclass | string  | no       | LaTeX document class           |
      | theorems      | boolean | no       | Include theorem environments   |
      | algorithms    | boolean | no       | Include algorithm packages     |
      | bibliography  | string  | no       | Bibliography style (bibtex/biblatex) |
      | dest          | string  | no       | Output destination             |

  Scenario: Generate LaTeX paper with required parameters only
    When I run:
      """
      unjucks generate latex/arxiv/paper 
        --title="Minimal LaTeX Paper" 
        --author="Test Author"
        --dest=tests/output
      """
    Then the command should succeed
    And a LaTeX file should be created at "tests/output/paper.tex"
    And the file should be valid LaTeX

  Scenario: Generate LaTeX paper with all parameters
    When I run:
      """
      unjucks generate latex/arxiv/paper 
        --title="Complete LaTeX Paper"
        --author="Dr. Research Scientist"
        --abstract="This is a comprehensive test of LaTeX generation with all parameters."
        --documentclass="article"
        --theorems=true
        --algorithms=true
        --bibliography="biblatex"
        --bibstyle="nature"
        --packages="siunitx,physics"
        --msc_codes="68T50,68T01"
        --pacs_codes="07.05.Kf,89.20.Ff"
        --keywords="machine learning,latex,templates"
        --dest=tests/output
        --filename="complete_paper"
      """
    Then the command should succeed
    And a LaTeX file should be created at "tests/output/complete_paper.tex"
    And the file should contain all specified elements

  Scenario: Dry run mode for LaTeX generation
    When I run:
      """
      unjucks generate latex/arxiv/paper 
        --title="Dry Run Test" 
        --author="Test Author"
        --dest=tests/output
        --dry
      """
    Then the command should succeed
    And no files should be created
    And I should see the generated content in the output
    And the output should show what would be written

  Scenario: Force overwrite existing files
    Given I have an existing LaTeX file at "tests/output/paper.tex"
    When I run:
      """
      unjucks generate latex/arxiv/paper 
        --title="Overwrite Test" 
        --author="Test Author"
        --dest=tests/output
        --force
      """
    Then the command should succeed
    And the existing file should be overwritten
    And the file should contain "Overwrite Test"

  Scenario: Interactive parameter prompts
    When I run "unjucks generate latex/arxiv/paper" interactively
    And I provide the following inputs:
      | prompt                    | input                  |
      | Enter paper title         | Interactive Test Paper |
      | Enter author name(s)      | Interactive Author     |
      | Include theorems? (y/n)   | y                     |
      | Include algorithms? (y/n) | n                     |
      | Output destination        | tests/output          |
    Then the command should succeed
    And a LaTeX file should be created with the provided values

  Scenario: Parameter validation - missing required parameters
    When I run "unjucks generate latex/arxiv/paper --dest=tests/output"
    Then the command should fail with exit code 1
    And I should see error message "Missing required parameter: title"
    And I should see error message "Missing required parameter: author"

  Scenario: Parameter validation - invalid parameter values
    When I run:
      """
      unjucks generate latex/arxiv/paper 
        --title="Test Paper" 
        --author="Test Author"
        --documentclass="invalid_class"
        --dest=tests/output
      """
    Then the command should succeed with warnings
    And I should see warning "Unknown document class: invalid_class, using default"

  Scenario: Parameter validation - invalid boolean values
    When I run:
      """
      unjucks generate latex/arxiv/paper 
        --title="Test Paper" 
        --author="Test Author"
        --theorems="maybe"
        --dest=tests/output
      """
    Then the command should fail with exit code 1
    And I should see error message "Invalid boolean value for 'theorems': maybe"

  Scenario: Output directory creation
    When I run:
      """
      unjucks generate latex/arxiv/paper 
        --title="Directory Test" 
        --author="Test Author"
        --dest=tests/output/nested/deep/directory
      """
    Then the command should succeed
    And the directory "tests/output/nested/deep/directory" should be created
    And a LaTeX file should be created at "tests/output/nested/deep/directory/paper.tex"

  Scenario: Template not found error
    When I run "unjucks generate nonexistent/template --title=Test --author=Author"
    Then the command should fail with exit code 2
    And I should see error message "Template not found: nonexistent/template"
    And I should see suggested alternatives if any exist

  Scenario: File permission errors
    Given I have a read-only directory at "tests/readonly"
    When I run:
      """
      unjucks generate latex/arxiv/paper 
        --title="Permission Test" 
        --author="Test Author"
        --dest=tests/readonly
      """
    Then the command should fail with exit code 3
    And I should see error message "Permission denied: Cannot write to tests/readonly"

  Scenario: Large parameter values handling
    When I run a command with very large parameter values:
      | parameter | size    |
      | title     | 1000 chars |
      | abstract  | 10000 chars |
      | author    | 500 chars |
    Then the command should handle large inputs gracefully
    And the generated file should contain the full content
    And memory usage should remain reasonable

  Scenario: Special characters in parameters
    When I run:
      """
      unjucks generate latex/arxiv/paper 
        --title="Special Characters: âñđ §¥mßø£§"
        --author="Müller & Øström"
        --dest=tests/output
      """
    Then the command should succeed
    And the LaTeX file should properly escape special characters
    And the file should compile without errors

  Scenario: Command completion and suggestions
    When I run "unjucks generate latex/" with tab completion
    Then I should see available template completions:
      | completion        |
      | latex/arxiv/paper |

  Scenario: Verbose mode output
    When I run:
      """
      unjucks generate latex/arxiv/paper 
        --title="Verbose Test" 
        --author="Test Author"
        --dest=tests/output
        --verbose
      """
    Then the command should succeed
    And I should see detailed processing information:
      | information_type      |
      | Template loading      |
      | Parameter validation  |
      | File generation       |
      | Output file writing   |

  Scenario: Quiet mode output
    When I run:
      """
      unjucks generate latex/arxiv/paper 
        --title="Quiet Test" 
        --author="Test Author"
        --dest=tests/output
        --quiet
      """
    Then the command should succeed
    And there should be minimal output
    And only errors should be displayed if any occur

  Scenario: JSON configuration file input
    Given I have a configuration file "latex-config.json":
      ```json
      {
        "title": "Paper from Config",
        "author": "Config Author",
        "abstract": "This paper was generated from a JSON config file",
        "theorems": true,
        "bibliography": "biblatex",
        "dest": "tests/output"
      }
      ```
    When I run "unjucks generate latex/arxiv/paper --config=latex-config.json"
    Then the command should succeed
    And the generated paper should use values from the config file

  Scenario: YAML configuration file input
    Given I have a configuration file "latex-config.yaml":
      ```yaml
      title: "Paper from YAML"
      author: "YAML Author"
      abstract: "This paper was generated from a YAML config file"
      algorithms: true
      packages:
        - siunitx
        - physics
      dest: tests/output
      ```
    When I run "unjucks generate latex/arxiv/paper --config=latex-config.yaml"
    Then the command should succeed
    And the generated paper should use values from the YAML config

  Scenario: Command line parameters override config file
    Given I have a configuration file with title "Config Title"
    When I run:
      """
      unjucks generate latex/arxiv/paper 
        --config=latex-config.json
        --title="Override Title"
      """
    Then the command should succeed
    And the generated paper should use "Override Title" not "Config Title"

  Scenario: Multiple template generation in batch
    When I run:
      """
      unjucks batch generate 
        --templates="latex/arxiv/paper,legal/contract"
        --config-dir=tests/batch-configs
        --output-dir=tests/batch-output
      """
    Then the command should succeed
    And multiple files should be generated in the output directory
    And each file should be valid for its template type

  Scenario: Template validation before generation
    When I run:
      """
      unjucks validate latex/arxiv/paper
        --title="Validation Test"
        --author="Test Author"
      """
    Then the command should succeed
    And I should see validation results:
      | check_type           | result |
      | Parameter validation | PASS   |
      | Template syntax      | PASS   |
      | LaTeX validity       | PASS   |

  Scenario: Template syntax error handling
    Given I have a template with syntax errors
    When I run "unjucks generate broken/template --title=Test --author=Author"
    Then the command should fail with exit code 4
    And I should see template syntax error details
    And the error location should be identified

  Scenario: Network timeout handling (for remote templates)
    Given network connectivity is slow
    When I run "unjucks generate remote/template --timeout=5"
    Then the command should handle timeouts gracefully
    And provide appropriate error messages

  Scenario: Plugin and extension support
    Given I have LaTeX filter plugins installed
    When I run:
      """
      unjucks generate latex/arxiv/paper 
        --title="Plugin Test" 
        --author="Test Author"
        --use-plugins="latex-filters,custom-math"
        --dest=tests/output
      """
    Then the command should load and use the specified plugins
    And custom filters should be available in templates

  Scenario: Performance monitoring
    When I run:
      """
      unjucks generate latex/arxiv/paper 
        --title="Performance Test" 
        --author="Test Author"
        --dest=tests/output
        --performance
      """
    Then the command should succeed
    And I should see performance metrics:
      | metric            |
      | Template load time |
      | Rendering time    |
      | File write time   |
      | Total time        |
      | Memory usage      |

  Scenario: Auto-compilation option
    Given I have LaTeX installed
    When I run:
      """
      unjucks generate latex/arxiv/paper 
        --title="Auto Compile Test" 
        --author="Test Author"
        --dest=tests/output
        --compile
      """
    Then the command should succeed
    And a LaTeX file should be generated
    And the file should be automatically compiled to PDF
    And both .tex and .pdf files should exist