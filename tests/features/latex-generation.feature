Feature: LaTeX Template Generation
  As a researcher and academic writer
  I want to generate LaTeX documents from templates  
  So that I can quickly create well-formatted papers, articles, and legal documents

  Background:
    Given I have unjucks installed
    And I have LaTeX templates available

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