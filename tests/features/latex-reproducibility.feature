Feature: LaTeX Reproducible Document Generation
  As a developer working with KGEN's LaTeX generation
  I want to ensure deterministic and reproducible PDF output
  So that builds are consistent across different environments and time periods

  Background:
    Given KGEN is properly configured for reproducible builds
    And LaTeX with required packages is installed
    And the SOURCE_DATE_EPOCH environment variable is available
    And templates support reproducible compilation

  Scenario: Generate identical PDFs with SOURCE_DATE_EPOCH
    Given a LaTeX template for a research paper
    And SOURCE_DATE_EPOCH is set to "1640995200" (January 1, 2022)
    When I generate the same document twice with identical inputs:
      | field    | value                     |
      | title    | Reproducible Research     |
      | author   | Dr. Consistency Test      |
      | content  | This tests reproducibility |
    And I compile both LaTeX documents to PDF
    Then both PDF files should have identical binary checksums
    And both PDF files should have the same creation timestamp
    And both PDF files should have the same modification timestamp
    And document metadata should be identical

  Scenario: Verify SOURCE_DATE_EPOCH compliance across time zones
    Given a LaTeX document template
    And SOURCE_DATE_EPOCH is set to "1640995200"
    When I generate the document in timezone "UTC"
    And I generate the same document in timezone "PST"
    And I generate the same document in timezone "JST"
    Then all three generated PDF files should be identical
    And creation dates should all reflect the SOURCE_DATE_EPOCH timestamp
    And no timezone-dependent variations should exist
    And file checksums should match exactly

  Scenario: Test reproducibility with different LaTeX engines
    Given a LaTeX document that works with multiple engines
    And SOURCE_DATE_EPOCH is set to "1640995200"
    When I compile the document with pdflatex
    And I compile the same document with xelatex
    And I compile the same document with lualatex
    Then the core content layout should be identical across engines
    And timestamps should respect SOURCE_DATE_EPOCH in all cases
    And any engine-specific differences should be documented
    And reproducibility should be maintained within each engine type

  Scenario: Ensure reproducible bibliography compilation
    Given a LaTeX template with bibliography support
    And a .bib file with multiple references
    And SOURCE_DATE_EPOCH is set to "1640995200"
    When I generate and compile the document multiple times
    And I use biblatex with biber backend
    Then bibliography ordering should be consistent
    And citation timestamps should respect SOURCE_DATE_EPOCH
    And .bbl file generation should be deterministic
    And final PDF should have identical bibliography every time

  Scenario: Test reproducibility with figures and images
    Given a LaTeX template that includes figures
    And image files with original creation dates
    And SOURCE_DATE_EPOCH is set to "1640995200"
    When I generate documents including these images
    Then embedded image metadata should respect SOURCE_DATE_EPOCH
    And figure positioning should be deterministic
    And image compression should be consistent
    And PDF should not include original image timestamps

  Scenario: Verify font embedding reproducibility
    Given a LaTeX document using custom fonts
    And SOURCE_DATE_EPOCH is set to "1640995200"
    When I compile the document multiple times
    And the system has the required fonts installed
    Then font embedding should be consistent across builds
    And font subset generation should be deterministic
    And no font timestamp variations should occur
    And text rendering should be pixel-perfect identical

  Scenario: Test reproducibility with mathematical content
    Given a LaTeX document with complex mathematical formulas
    And SOURCE_DATE_EPOCH is set to "1640995200"
    When I generate the document multiple times:
      | math_content                                    |
      | $E = mc^2$                                     |
      | \\begin{equation}\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}\\end{equation} |
      | \\begin{align}F(x) &= \\int f(t) dt \\\\ &= G(x) + C\\end{align} |
    Then mathematical formula rendering should be identical
    And equation positioning should be deterministic  
    And math font selection should be consistent
    And PDF mathematical content should have identical checksums

  Scenario: Validate reproducibility with package randomness
    Given a LaTeX document using packages that might introduce randomness
    And packages like tikz with random elements are used
    And SOURCE_DATE_EPOCH is set to "1640995200"
    When I set random seeds explicitly in the template
    And I generate the document multiple times
    Then any random elements should be seeded deterministically
    And tikz random positioning should be identical across builds
    And package-generated content should be reproducible
    And no non-deterministic variations should exist

  Scenario: Test cross-platform reproducibility
    Given identical LaTeX templates and inputs
    And SOURCE_DATE_EPOCH is set to "1640995200"  
    When I generate the document on Linux
    And I generate the same document on macOS
    And I generate the same document on Windows
    Then core document content should be identical across platforms
    And line ending handling should not affect PDF output
    And path separator differences should not impact results
    And platform-specific fonts should be handled consistently

  Scenario: Verify reproducibility with incremental builds
    Given a multi-file LaTeX project with \input and \include
    And SOURCE_DATE_EPOCH is set to "1640995200"
    When I perform a clean build
    And I perform incremental builds after touching different files
    Then final PDF output should remain identical
    And auxiliary file timestamps should respect SOURCE_DATE_EPOCH
    And build order should not affect final output
    And dependency changes should not introduce non-determinism

  Scenario: Test reproducible error handling and warnings
    Given a LaTeX template with potential warning conditions
    And SOURCE_DATE_EPOCH is set to "1640995200"
    When I generate documents that produce LaTeX warnings
    Then warning messages should be consistent across builds
    And warning order should be deterministic
    And error reporting should not include timestamps
    And log file content should be reproducible (excluding timestamps)

  Scenario: Validate metadata stripping for reproducibility
    Given a LaTeX document with author and creation metadata
    And SOURCE_DATE_EPOCH is set to "1640995200"
    When I generate the document with metadata stripping enabled
    Then PDF metadata should only contain essential information
    And creator information should be standardized
    And modification dates should reflect SOURCE_DATE_EPOCH only
    And no build-environment-specific data should be included

  Scenario: Test reproducibility with different locale settings
    Given a LaTeX document with international content
    And SOURCE_DATE_EPOCH is set to "1640995200"
    When I generate the document with LANG=en_US.UTF-8
    And I generate the same document with LANG=de_DE.UTF-8
    And I generate the same document with LANG=ja_JP.UTF-8
    Then document content should be identical regardless of locale
    And date formatting should respect SOURCE_DATE_EPOCH uniformly
    And sorting and collation should be consistent
    And character encoding should not vary

  Scenario: Benchmark reproducibility performance impact
    Given a complex LaTeX document template
    And SOURCE_DATE_EPOCH is set to "1640995200"
    When I measure compilation time with reproducibility enabled
    And I measure compilation time with default settings
    Then reproducibility overhead should be minimal (< 10%)
    And build time should be consistent across identical runs
    And memory usage should not increase significantly
    And the performance impact should be documented

  Scenario: Test reproducibility with version control integration
    Given a LaTeX project under version control
    And SOURCE_DATE_EPOCH is set to commit timestamp
    When I generate documents at different commit points
    And I regenerate historical versions
    Then PDF outputs should match their original generation
    And version-controlled assets should build identically
    And git timestamp integration should work correctly
    And historical reproducibility should be maintained