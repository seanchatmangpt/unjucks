Feature: LaTeX Document Generation
  As a researcher and academic writer
  I want to generate LaTeX documents from templates with comprehensive functionality
  So that I can create professional documents with proper error handling, reproducibility, and advanced features

  Background:
    Given KGEN is properly configured
    And LaTeX with required packages is installed
    And the SOURCE_DATE_EPOCH environment variable is set for reproducible builds
    And LaTeX templates are available in the template directory

  Scenario: Generate basic arXiv paper template
    Given I run "unjucks help latex/arxiv/paper"
    Then I should see the available template parameters
    When I generate an arXiv paper with:
      | parameter     | value                           |
      | title         | Machine Learning for Science    |
      | author        | Dr. Jane Smith                  |
      | abstract      | This paper explores ML in science |
      | dest          | tests/output                    |
    Then a LaTeX file should be created at "tests/output/paper.tex"
    And the file should contain "\documentclass"
    And the file should contain "Machine Learning for Science"
    And the file should contain "Dr. Jane Smith"
    And the file should contain "This paper explores ML in science"

  Scenario: Generate paper with custom document class
    When I generate an arXiv paper with:
      | parameter      | value    |
      | title          | Test Paper |
      | author         | Author Name |
      | documentclass  | revtex   |
      | dest           | tests/output |
    Then the LaTeX file should contain "\documentclass[aps,prd,10pt]{revtex4-2}"

  Scenario: Generate paper with theorem environments
    When I generate an arXiv paper with:
      | parameter | value      |
      | title     | Math Paper |
      | author    | Mathematician |
      | theorems  | true       |
      | dest      | tests/output |
    Then the LaTeX file should contain "\usepackage{amsthm}"
    And the LaTeX file should contain "\newtheorem{theorem}{Theorem}"
    And the LaTeX file should contain "\newtheorem{lemma}[theorem]{Lemma}"

  Scenario: Generate paper with algorithms
    When I generate an arXiv paper with:
      | parameter  | value       |
      | title      | CS Paper    |
      | author     | CS Researcher |
      | algorithms | true        |
      | dest       | tests/output |
    Then the LaTeX file should contain "\usepackage{algorithm}"
    And the LaTeX file should contain "\usepackage{algorithmic}"

  Scenario: Generate paper with biblatex
    When I generate an arXiv paper with:
      | parameter     | value        |
      | title         | Research Paper |
      | author        | Researcher     |
      | bibliography  | biblatex     |
      | bibstyle      | nature       |
      | dest          | tests/output |
    Then the LaTeX file should contain "\usepackage[backend=biber,style=nature"
    And the LaTeX file should contain "\printbibliography"

  Scenario: Generate paper with custom packages
    When I generate an arXiv paper with:
      | parameter | value              |
      | title     | Physics Paper      |
      | author    | Physicist          |
      | packages  | siunitx,physics    |
      | dest      | tests/output       |
    Then the LaTeX file should contain "\usepackage{siunitx}"
    And the LaTeX file should contain "\usepackage{physics}"

  Scenario: Generate paper with sections
    When I generate an arXiv paper with structured sections:
      | title    | Machine Learning Survey |
      | author   | ML Researcher           |
      | sections | Introduction,Methods,Results,Discussion |
      | dest     | tests/output            |
    Then the LaTeX file should contain "\section{Introduction}"
    And the LaTeX file should contain "\section{Methods}"
    And the LaTeX file should contain "\section{Results}"
    And the LaTeX file should contain "\section{Discussion}"

  Scenario: Generate legal contract template
    When I generate a legal contract with:
      | parameter      | value                    |
      | contractTitle  | Software Development Agreement |
      | partyA.name    | Tech Corp Inc.          |
      | partyB.name    | Developer LLC           |
      | effectiveDate  | 2024-01-01              |
      | dest           | tests/output            |
    Then a legal document should be created at "tests/output/contract.txt"
    And the file should contain "SOFTWARE DEVELOPMENT AGREEMENT"
    And the file should contain "Tech Corp Inc."
    And the file should contain "Developer LLC"
    And the file should contain "2024-01-01"

  Scenario: Generate academic paper (non-LaTeX)
    When I generate an academic paper with:
      | parameter | value                    |
      | title     | AI Ethics Research      |
      | authors   | Dr. Smith,Prof. Jones   |
      | abstract  | This paper explores AI ethics |
      | dest      | tests/output            |
    Then an academic paper should be created at "tests/output/paper.md"
    And the file should contain "AI Ethics Research"
    And the file should contain "Dr. Smith"
    And the file should contain "Prof. Jones"

  Scenario Outline: Generate papers with different document classes
    When I generate an arXiv paper with document class "<documentclass>"
    Then the LaTeX file should contain the appropriate document class declaration for "<documentclass>"

    Examples:
      | documentclass |
      | article       |
      | revtex        |
      | amsart        |

  Scenario: Handle invalid template parameters
    When I try to generate a LaTeX paper with invalid parameters:
      | parameter     | value    |
      | invalidParam  | badValue |
    Then the generation should not fail silently
    And I should see helpful parameter suggestions

  Scenario: Generate paper with metadata
    When I generate an arXiv paper with:
      | parameter   | value                    |
      | title       | Quantum Computing Paper  |
      | author      | Quantum Researcher       |
      | msc_codes   | 81P68, 68Q05            |
      | pacs_codes  | 03.67.Lx, 89.70.+c     |
      | keywords    | quantum,computing,algorithms |
      | dest        | tests/output             |
    Then the LaTeX file should contain "MSC2020: 81P68, 68Q05"
    And the LaTeX file should contain "PACS: 03.67.Lx, 89.70.+c"
    And the LaTeX file should contain "Keywords: quantum,computing,algorithms"

  Scenario: Generate with custom commands
    When I generate an arXiv paper with:
      | parameter       | value                      |
      | title           | Math Paper                 |
      | author          | Mathematician              |
      | custom_commands | \newcommand{\R}{\mathbb{R}} |
      | dest            | tests/output               |
    Then the LaTeX file should contain "\newcommand{\R}{\mathbb{R}}"

  Scenario: Generate with appendices
    When I generate an arXiv paper with appendices:
      | title      | Research Paper      |
      | author     | Researcher          |
      | appendices | Proof Details,Data Tables |
      | dest       | tests/output        |
    Then the LaTeX file should contain "\appendix"
    And the LaTeX file should contain "\section{Proof Details}"
    And the LaTeX file should contain "\section{Data Tables}"

  # Error Handling and Validation Scenarios
  
  Scenario: Handle missing LaTeX packages gracefully
    Given a LaTeX template requiring "\usepackage{nonexistent}"
    When I attempt to generate and compile the document
    Then KGEN should detect the missing package during validation
    And provide a clear error message about the missing package
    And suggest installation commands for the package
    And not produce a malformed LaTeX file
    And exit with appropriate error code

  Scenario: Validate LaTeX syntax before generation
    Given a LaTeX template with syntax errors:
      | error_type          | content                    |
      | unclosed_brace      | \title{Missing brace       |
      | invalid_command     | \invalidcommand{test}      |
      | unmatched_environment | \begin{document} no \end  |
    When I run KGEN template validation
    Then each syntax error should be detected and reported
    And error messages should include line numbers
    And suggestions for fixes should be provided
    And generation should be prevented until errors are fixed

  Scenario: Handle LaTeX compilation errors
    Given a valid LaTeX template that generates compilable code
    But LaTeX compilation fails due to system issues
    When I attempt to compile the generated LaTeX
    Then KGEN should capture LaTeX compilation errors
    And provide meaningful error messages to the user
    And suggest potential solutions for common problems
    And preserve intermediate files for debugging

  Scenario: Test LaTeX special character escaping
    Given a template that processes user-provided content
    When I input text containing special LaTeX characters:
      | input_text                    | expected_output              |
      | 50% increase & 30% decrease   | 50\% increase \& 30\% decrease |
      | Cost is $100 & file_name.txt | Cost is \$100 \& file\_name.txt |
      | Use # symbol for comments     | Use \# symbol for comments    |
      | Math: x^2 + y_i = z_{max}     | Math: x\textasciicircum{}2 + y\_i = z\_\{max\} |
    Then special characters should be properly escaped
    And the document should compile without LaTeX errors
    And output should display the characters correctly

  # Bibliography and Citation Management

  Scenario: Generate document with BibTeX bibliography
    Given a LaTeX template with BibTeX support
    And a bibliography file "references.bib" exists with sample entries
    When I generate a document with bibliography:
      | field           | value                    |
      | title           | Literature Survey        |
      | author          | Research Scholar         |
      | bibliography    | references.bib           |
      | bib_style       | plain                   |
      | citations       | einstein1905,darwin1859  |
    Then the LaTeX should include "\bibliography{references}"
    And it should contain "\bibliographystyle{plain}"
    And citations should be formatted as "\cite{einstein1905}"
    And the document should compile with proper references

  Scenario: Generate document with biblatex and advanced citations
    Given a LaTeX template supporting biblatex
    And a comprehensive bibliography database
    When I create a document with advanced citations:
      | field              | value                      |
      | title              | Advanced Research          |
      | author             | Dr. Citation Expert        |
      | bib_backend        | biber                     |
      | bib_style          | alphabetic                |
      | citation_styles    | autocite,parencite,textcite |
    Then the document should use biblatex package
    And it should support multiple citation commands
    And bibliography should be generated with biber
    And citation style should be alphabetic
    And the document should compile with proper bibliography

  Scenario: Handle invalid bibliography references
    Given a LaTeX document with citation keys
    But some citation keys don't exist in the bibliography
    When I compile the document:
      | existing_keys    | einstein1905,newton1687    |
      | requested_keys   | einstein1905,nonexistent   |
    Then KGEN should detect missing bibliography entries
    And warn about undefined citation keys
    And the document should still compile with warnings
    And missing references should be highlighted in output

  # Figures and Tables Processing

  Scenario: Generate document with figures and proper positioning
    Given a LaTeX template supporting figures
    And image files are available in the assets directory
    When I create a document with figures:
      | field           | value                               |
      | title           | Research with Visual Data           |
      | figures         | graph1.png,diagram.pdf,photo.jpg    |
      | figure_captions | Experimental Results,System Architecture,Sample Image |
      | positioning     | htbp                               |
    Then LaTeX should include "\usepackage{graphicx}"
    And figures should be wrapped in figure environments
    And captions should be properly formatted
    And positioning parameters should be set to "htbp"
    And image paths should be correctly referenced

  Scenario: Generate document with complex tables
    Given a LaTeX template with table support
    When I create a document with data tables:
      | field              | value                        |
      | title              | Data Analysis Report         |
      | table_data         | csv_data.csv                |
      | table_caption      | Experimental Results Summary |
      | table_style        | booktabs                    |
      | column_alignment   | lccr                        |
    Then the LaTeX should include table packages
    And tables should use professional formatting
    And CSV data should be properly converted to LaTeX format
    And column alignment should be respected
    And captions should be positioned correctly

  Scenario: Handle missing figure files gracefully
    Given a LaTeX template referencing figure files
    But some figure files don't exist
    When I generate the document:
      | existing_files  | graph1.png,diagram.pdf      |
      | referenced_files| graph1.png,missing_fig.jpg  |
    Then KGEN should detect missing figure files
    And provide clear error messages with file paths
    And suggest checking file locations and names
    And prevent generation of broken LaTeX references

  Scenario: Test figure format compatibility
    Given various image formats available
    When I test LaTeX compatibility with different formats:
      | format | file_example    | expected_result |
      | PNG    | image.png       | supported       |
      | PDF    | vector.pdf      | supported       |
      | JPG    | photo.jpg       | supported       |
      | EPS    | diagram.eps     | supported       |
      | SVG    | graphic.svg     | needs_conversion|
      | TIFF   | scan.tiff       | needs_conversion|
    Then supported formats should be included directly
    And unsupported formats should trigger conversion warnings
    And conversion suggestions should be provided
    And document should compile with supported formats only

  # Advanced LaTeX Features

  Scenario: Generate document with custom LaTeX commands
    Given a template supporting custom command definitions
    When I define custom commands in the document:
      | command_name | command_definition                    |
      | real         | \newcommand{\real}{\mathbb{R}}       |
      | complex      | \newcommand{\complex}{\mathbb{C}}    |
      | vector       | \newcommand{\vect}[1]{\mathbf{#1}}   |
    Then custom commands should be included in document preamble
    And commands should be available throughout the document
    And mathematical notation should render correctly
    And the document should compile without command conflicts

  Scenario: Test cross-referencing functionality
    Given a LaTeX document with multiple sections and elements
    When I enable cross-referencing:
      | ref_type    | label           | reference_text        |
      | section     | sec:introduction| Section~\ref{sec:introduction} |
      | figure      | fig:results     | Figure~\ref{fig:results}       |
      | table       | tab:data        | Table~\ref{tab:data}          |
      | equation    | eq:main         | Equation~\ref{eq:main}        |
    Then labels should be properly placed
    And references should link to correct elements
    And cross-reference numbering should be automatic
    And the document should compile with correct references

  Scenario: Generate document with multiple LaTeX passes
    Given a complex document requiring multiple compilation passes
    When the document includes:
      | feature          | requires_passes |
      | bibliography     | 2              |
      | cross_references | 2              |
      | index            | 3              |
      | glossary         | 2              |
    Then KGEN should detect multi-pass requirements
    And automatically run the required number of LaTeX passes
    And ensure all references are resolved
    And produce a complete, properly formatted document

  # SOURCE_DATE_EPOCH Compliance

  Scenario: Ensure SOURCE_DATE_EPOCH compliance in LaTeX generation
    Given SOURCE_DATE_EPOCH is set to "1640995200" 
    When I generate a LaTeX document multiple times with identical content
    Then generated LaTeX files should be identical
    And any timestamp references should use SOURCE_DATE_EPOCH
    And document compilation should be reproducible
    And PDF output should have consistent creation dates