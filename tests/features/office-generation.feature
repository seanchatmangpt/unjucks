Feature: Office Document Generation
  As a developer using KGEN
  I want to generate Microsoft Office documents from templates
  So that I can create professional documents programmatically

  Background:
    Given KGEN is properly configured
    And the office document generation module is available
    And I have valid Office document templates

  Scenario: Generate Word document from template
    Given I have a Word template "proposal.docx" with placeholders
    And I have template data:
      | field        | value                    |
      | clientName   | Acme Corporation        |
      | projectName  | Digital Transformation  |
      | startDate    | 2024-01-15             |
      | totalCost    | $50,000                |
    When I generate a Word document using the template
    Then a valid DOCX file should be created
    And the document should contain "Acme Corporation"
    And the document should contain "Digital Transformation"
    And the document should contain "$50,000"
    And the document structure should be valid
    And the file should be openable in Microsoft Word

  Scenario: Generate PowerPoint presentation from template
    Given I have a PowerPoint template "company-presentation.pptx"
    And I have slide data:
      | slideNumber | title              | content                           |
      | 1          | Company Overview   | Leading provider of tech solutions |
      | 2          | Our Services       | Web development, Cloud services    |
      | 3          | Contact Info       | contact@company.com               |
    When I generate a PowerPoint presentation using the template
    Then a valid PPTX file should be created
    And slide 1 should contain "Company Overview"
    And slide 2 should contain "Web development, Cloud services"
    And slide 3 should contain "contact@company.com"
    And the presentation should have 3 slides
    And the file should be openable in Microsoft PowerPoint

  Scenario: Generate Excel workbook from template
    Given I have an Excel template "financial-report.xlsx"
    And I have spreadsheet data:
      | sheet    | cell | value    |
      | Summary  | A1   | Q4 2023  |
      | Summary  | B1   | Revenue  |
      | Summary  | C1   | 125000   |
      | Details  | A1   | Item     |
      | Details  | B1   | Quantity |
      | Details  | C1   | Price    |
    When I generate an Excel workbook using the template
    Then a valid XLSX file should be created
    And the "Summary" sheet should contain "Q4 2023" in cell A1
    And the "Summary" sheet should contain "125000" in cell C1
    And the "Details" sheet should contain "Item" in cell A1
    And all formulas should be preserved
    And the file should be openable in Microsoft Excel

  Scenario: Generate Office document with complex formatting
    Given I have a Word template with complex formatting
    And the template contains:
      | element        | style            |
      | headers       | Heading 1 style  |
      | paragraphs    | Normal style     |
      | tables        | Grid Table style |
      | images        | inline placement |
    And I have data with formatting requirements
    When I generate the document
    Then all text formatting should be preserved
    And table styles should be maintained
    And images should be properly embedded
    And header numbering should be correct
    And the document layout should match the template

  Scenario: Handle missing template variables gracefully
    Given I have a Word template with placeholders "{{clientName}}", "{{projectName}}", "{{budget}}"
    And I provide incomplete data:
      | field       | value            |
      | clientName  | Test Client      |
      | projectName | Test Project     |
    When I generate the document with missing "budget" variable
    Then the document should be generated successfully
    And "{{budget}}" placeholder should remain or show a default value
    And the generation process should log a warning about missing variables
    And the rest of the document should be properly populated

  Scenario: Generate multiple Office documents in batch
    Given I have multiple templates:
      | template           | type |
      | invoice.docx       | DOCX |
      | presentation.pptx  | PPTX |
      | budget.xlsx        | XLSX |
    And I have corresponding data for each template
    When I generate all documents in a single batch operation
    Then all 3 documents should be created successfully
    And each document should contain the correct data
    And the generation should complete within reasonable time
    And all documents should be valid Office format files

  Scenario: Validate generated document metadata
    Given I have an Office template with metadata
    And I provide metadata values:
      | property    | value                |
      | author      | KGEN Generator       |
      | title       | Generated Document   |
      | subject     | Automated Report     |
      | keywords    | report, automated    |
    When I generate the document
    Then the document metadata should contain "KGEN Generator" as author
    And the document title should be "Generated Document"
    And the document subject should be "Automated Report"
    And the document keywords should include "report" and "automated"

  Scenario: Handle large documents efficiently
    Given I have a template that generates a large document
    And I have data that will create:
      | element     | count |
      | pages       | 50    |
      | tables      | 10    |
      | images      | 20    |
      | paragraphs  | 500   |
    When I generate the large document
    Then the document should be created within 30 seconds
    And memory usage should remain under 500MB
    And the generated file should be under 50MB
    And all content should be properly rendered
    And the document should be openable without performance issues

  Scenario: Error handling for invalid templates
    Given I have an invalid or corrupted Office template
    When I attempt to generate a document from the invalid template
    Then the generation should fail with a clear error message
    And the error should indicate the template is invalid
    And no partial or corrupted output file should be created
    And the system should remain stable after the error