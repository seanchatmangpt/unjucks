Feature: LaTeX Compilation Testing
  As a LaTeX document author
  I want to ensure generated LaTeX files compile correctly
  So that I can produce valid PDF documents

  Background:
    Given I have unjucks installed
    And I have LaTeX installed (pdflatex, bibtex, biber)
    And I have a clean output directory

  Scenario: Basic LaTeX compilation test
    Given I generate a basic arXiv paper:
      | parameter | value              |
      | title     | Compilation Test   |
      | author    | Test Author        |
      | abstract  | Testing compilation |
      | dest      | tests/output       |
    When I compile the LaTeX file with pdflatex
    Then the compilation should succeed
    And a PDF file should be generated
    And the PDF should contain "Compilation Test"

  Scenario: Compilation with bibliography
    Given I generate an arXiv paper with bibliography:
      | parameter     | value        |
      | title         | Paper with Refs |
      | author        | Author Name     |
      | bibliography  | bibtex       |
      | dest          | tests/output |
    And I create a sample bibliography file "references.bib"
    When I compile with the full LaTeX workflow:
      """
      pdflatex paper.tex
      bibtex paper
      pdflatex paper.tex
      pdflatex paper.tex
      """
    Then the compilation should succeed
    And the PDF should include bibliography entries

  Scenario: Compilation with biblatex
    Given I generate an arXiv paper with:
      | parameter     | value        |
      | title         | Modern Paper |
      | author        | Author Name  |
      | bibliography  | biblatex     |
      | bibstyle      | alphabetic   |
      | dest          | tests/output |
    And I create a sample bibliography file "references.bib"
    When I compile with biblatex workflow:
      """
      pdflatex paper.tex
      biber paper
      pdflatex paper.tex
      pdflatex paper.tex
      """
    Then the compilation should succeed
    And the bibliography should be formatted correctly

  Scenario: Compilation with theorem environments
    Given I generate an arXiv paper with:
      | parameter | value         |
      | title     | Math Paper    |
      | author    | Mathematician |
      | theorems  | true          |
      | dest      | tests/output  |
    When I add theorem content to the paper:
      """
      \begin{theorem}
      This is a test theorem.
      \end{theorem}
      
      \begin{proof}
      This is a test proof.
      \end{proof}
      """
    And I compile the LaTeX file
    Then the compilation should succeed
    And the PDF should render theorems correctly

  Scenario: Compilation with algorithms
    Given I generate an arXiv paper with:
      | parameter  | value       |
      | title      | CS Paper    |
      | author     | CS Author   |
      | algorithms | true        |
      | dest       | tests/output |
    When I add algorithm content to the paper:
      """
      \begin{algorithm}
      \caption{Test Algorithm}
      \begin{algorithmic}
      \STATE $x \leftarrow 0$
      \FOR{$i = 1$ to $n$}
          \STATE $x \leftarrow x + i$
      \ENDFOR
      \RETURN $x$
      \end{algorithmic}
      \end{algorithm}
      """
    And I compile the LaTeX file
    Then the compilation should succeed
    And the PDF should render algorithms correctly

  Scenario: Compilation error detection
    Given I generate a basic arXiv paper
    When I introduce a LaTeX syntax error:
      """
      \begin{theorem}
      Missing end tag
      """
    And I attempt to compile the LaTeX file
    Then the compilation should fail
    And I should receive informative error messages
    And the error location should be identified

  Scenario: Package dependency checking
    Given I generate an arXiv paper with custom packages:
      | parameter | value                |
      | title     | Package Test Paper   |
      | author    | Test Author          |
      | packages  | nonexistentpackage   |
      | dest      | tests/output         |
    When I attempt to compile the LaTeX file
    Then the compilation should fail with package error
    And I should see package-not-found error message

  Scenario: RevTeX compilation
    Given I generate an arXiv paper with:
      | parameter      | value     |
      | title          | Physics Paper |
      | author         | Physicist     |
      | documentclass  | revtex    |
      | dest           | tests/output  |
    When I compile the LaTeX file
    Then the compilation should succeed
    And the PDF should use RevTeX formatting

  Scenario: AMS article compilation
    Given I generate an arXiv paper with:
      | parameter      | value     |
      | title          | Math Article |
      | author         | Mathematician |
      | documentclass  | amsart    |
      | dest           | tests/output  |
    When I compile the LaTeX file
    Then the compilation should succeed
    And the PDF should use AMS article formatting

  Scenario: Compilation with graphics
    Given I generate an arXiv paper with graphics:
      | parameter | value        |
      | title     | Paper with Figures |
      | author    | Author Name  |
      | dest      | tests/output |
    When I add figure content:
      """
      \begin{figure}[h]
      \centering
      \includegraphics[width=0.5\textwidth]{example-image}
      \caption{Test figure}
      \label{fig:test}
      \end{figure}
      """
    And I compile the LaTeX file
    Then the compilation should succeed
    And the PDF should include the figure placeholder

  Scenario: Large document compilation performance
    Given I generate an arXiv paper with:
      | parameter | value           |
      | title     | Large Document  |
      | author    | Test Author     |
      | dest      | tests/output    |
    When I add substantial content (50+ pages equivalent)
    And I compile the LaTeX file
    Then the compilation should complete within reasonable time
    And memory usage should remain acceptable
    And the resulting PDF should be properly paginated

  Scenario: Cross-reference compilation
    Given I generate an arXiv paper
    When I add cross-references:
      """
      \section{Introduction}
      \label{sec:intro}
      
      See Section \ref{sec:methods} for details.
      
      \section{Methods}
      \label{sec:methods}
      
      As mentioned in Section \ref{sec:intro}...
      """
    And I compile the LaTeX file multiple times
    Then all cross-references should resolve correctly
    And no "??" markers should appear in the PDF

  Scenario: Compilation with different engines
    Given I generate a basic arXiv paper
    When I compile with different LaTeX engines:
      | engine    |
      | pdflatex  |
      | xelatex   |
      | lualatex  |
    Then each compilation should succeed (if engine is available)
    And the resulting PDFs should be equivalent

  Scenario: Validation of generated LaTeX syntax
    Given I generate various LaTeX templates
    When I validate the LaTeX syntax without compilation:
      | template_type |
      | article       |
      | revtex        |
      | amsart        |
    Then the LaTeX syntax should be valid
    And no undefined commands should be present
    And bracket matching should be correct

  Scenario: Compilation warnings handling
    Given I generate an arXiv paper
    When LaTeX compilation produces warnings (not errors)
    Then the compilation should complete successfully
    And warnings should be captured and reported
    And the PDF should still be generated