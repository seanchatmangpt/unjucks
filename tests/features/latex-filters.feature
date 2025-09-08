Feature: LaTeX Filter Functionality
  As a LaTeX document author
  I want specialized filters for LaTeX formatting and escaping
  So that I can safely generate LaTeX content from dynamic data

  Background:
    Given I have unjucks installed
    And I have LaTeX filter templates available

  Scenario: LaTeX escaping filter
    When I use the latexEscape filter with:
      | input              | expected_output    |
      | Hello & World      | Hello \\& World    |
      | 50% complete       | 50\\% complete     |
      | Cost: $100         | Cost: \\$100       |
      | File: report.tex   | File: report.tex   |
      | Math: x^2 + y^2    | Math: x\\^{}2 + y\\^{}2 |
      | Note: See #1       | Note: See \\#1     |
      | Under_score text   | Under\\_score text |
      | Curly {braces}     | Curly \\{braces\\} |
      | Tilde~space        | Tilde\\~{}space    |
    Then the LaTeX special characters should be properly escaped

  Scenario: Mathematical notation filter  
    When I use the mathMode filter with:
      | input           | expected_output      |
      | alpha           | $\\alpha$           |
      | x^2 + y^2       | $x^2 + y^2$         |
      | sum_{i=1}^n     | $\\sum_{i=1}^n$     |
      | integral        | $\\int$             |
    Then mathematical expressions should be wrapped in math delimiters

  Scenario: Legal numbering filter
    When I use the legalNumber filter with:
      | input | format | expected_output |
      | 1     | roman  | (i)            |
      | 2     | roman  | (ii)           |
      | 1     | alpha  | (a)            |
      | 2     | alpha  | (b)            |
      | 1     | number | 1.             |
      | 2     | number | 2.             |
    Then legal-style numbering should be generated correctly

  Scenario: Citation formatting filter
    When I use the cite filter with:
      | input              | style     | expected_output    |
      | smith2023          | numeric   | \\cite{smith2023}  |
      | jones2024,doe2023  | numeric   | \\cite{jones2024,doe2023} |
      | author2023         | natbib    | \\citep{author2023} |
      | key1,key2          | biblatex  | \\autocite{key1,key2} |
    Then citations should be formatted according to the specified style

  Scenario: LaTeX table generation filter
    Given I have tabular data:
      | Name    | Age | Department |
      | Alice   | 30  | Engineering|
      | Bob     | 25  | Marketing  |
      | Charlie | 35  | Sales      |
    When I use the latexTable filter with options:
      | option    | value      |
      | alignment | l c r      |
      | hlines    | true       |
      | caption   | Employee Data |
    Then a proper LaTeX table should be generated with:
      """
      \begin{table}[h]
      \centering
      \begin{tabular}{l c r}
      \hline
      Name & Age & Department \\
      \hline
      Alice & 30 & Engineering \\
      Bob & 25 & Marketing \\
      Charlie & 35 & Sales \\
      \hline
      \end{tabular}
      \caption{Employee Data}
      \end{table}
      """

  Scenario: Bibliography formatting filter
    Given I have reference data:
      | title                    | authors           | journal        | year | pages  |
      | Machine Learning Basics  | Smith, J.; Doe, A.| AI Journal     | 2023 | 10-25  |
      | Deep Learning Advanced   | Jones, B.         | ML Quarterly   | 2024 | 145-160|
    When I use the bibEntry filter with "bibtex" style
    Then BibTeX entries should be generated:
      """
      @article{smith2023machine,
        title={Machine Learning Basics},
        author={Smith, J. and Doe, A.},
        journal={AI Journal},
        year={2023},
        pages={10--25}
      }
      """

  Scenario: LaTeX command generation filter
    When I use the latexCommand filter with:
      | command    | args                | options        | expected_output                    |
      | section    | Introduction        |                | \\section{Introduction}            |
      | usepackage | graphicx            |                | \\usepackage{graphicx}             |
      | textbf     | Bold Text           |                | \\textbf{Bold Text}                |
      | includegraphics | figure.png     | width=0.5\\textwidth | \\includegraphics[width=0.5\\textwidth]{figure.png} |
    Then LaTeX commands should be properly formatted

  Scenario: Safe filename filter for LaTeX
    When I use the latexFilename filter with:
      | input                | expected_output      |
      | My Report.tex        | My_Report.tex        |
      | data-file (1).csv    | data-file_1.csv      |
      | résumé & cv.pdf      | resume_cv.pdf        |
      | file#2$version.tex   | file2version.tex     |
    Then filenames should be LaTeX-safe

  Scenario: LaTeX environment generation filter
    When I use the latexEnvironment filter with:
      | environment | content           | options           | expected_output                                    |
      | theorem     | This is a theorem | label=thm:main    | \\begin{theorem}\\label{thm:main}\nThis is a theorem\n\\end{theorem} |
      | equation    | E = mc^2          |                   | \\begin{equation}\nE = mc^2\n\\end{equation}       |
      | itemize     | Item 1,Item 2     |                   | \\begin{itemize}\n\\item Item 1\n\\item Item 2\n\\end{itemize} |
    Then LaTeX environments should be properly structured

  Scenario: Units and measurements filter
    When I use the siunitx filter with:
      | value | unit  | expected_output        |
      | 9.81  | m/s^2 | \\SI{9.81}{\\meter\\per\\second\\squared} |
      | 100   | km    | \\SI{100}{\\kilo\\meter} |
      | 3.14  | rad   | \\SI{3.14}{\\radian}   |
      | 25    | C     | \\SI{25}{\\celsius}    |
    Then SI units should be properly formatted

  Scenario: Cross-reference filter
    When I use the ref filter with:
      | ref_type | ref_key    | expected_output     |
      | section  | sec:intro  | \\ref{sec:intro}    |
      | figure   | fig:plot   | \\ref{fig:plot}     |
      | table    | tab:data   | \\ref{tab:data}     |
      | equation | eq:main    | \\eqref{eq:main}    |
    Then cross-references should be generated correctly

  Scenario: LaTeX package options filter
    When I use the packageOptions filter with:
      | package   | options           | expected_output                    |
      | geometry  | margin=1in        | \\usepackage[margin=1in]{geometry} |
      | hyperref  | colorlinks=true   | \\usepackage[colorlinks=true]{hyperref} |
      | babel     | english           | \\usepackage[english]{babel}       |
    Then package loading with options should be correct

  Scenario: Complex LaTeX filter chaining
    Given I have a template with chained filters:
      """
      {{ title | latexEscape | latexCommand("section") }}
      {{ author | latexEscape | latexCommand("author") }}
      {{ equation | mathMode | latexEnvironment("equation", "", "label=" + eq_label) }}
      """
    When I render with data:
      | title     | Introduction & Overview |
      | author    | Dr. Smith & Associates  |
      | equation  | E = mc^2                |
      | eq_label  | eq:energy               |
    Then the output should properly combine all filter effects:
      """
      \section{Introduction \& Overview}
      \author{Dr. Smith \& Associates}
      \begin{equation}\label{eq:energy}
      $E = mc^2$
      \end{equation}
      """

  Scenario: Filter error handling
    When I use LaTeX filters with invalid input:
      | filter        | invalid_input | expected_behavior           |
      | latexEscape   | null          | return empty string         |
      | cite          | ""            | return empty citation       |
      | latexTable    | invalid_array | throw descriptive error     |
      | siunitx       | "not_number"  | pass through or error       |
    Then filters should handle errors gracefully

  Scenario: Performance with large content
    Given I have a large document with 1000+ mathematical expressions
    When I apply the mathMode filter to all expressions
    Then the filtering should complete within reasonable time
    And memory usage should remain acceptable

  Scenario: Custom LaTeX filter registration
    Given I register a custom filter "customLatex"
    When I use the custom filter in a template
    Then it should be available and functional
    And it should integrate with existing LaTeX filters