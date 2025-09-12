Feature: Office Template Processing
  As a developer using KGEN
  I want to process Office templates with dynamic content
  So that I can create customized documents with variable substitution

  Background:
    Given KGEN office template processor is available
    And I have access to Microsoft Office template files
    And the template engine supports variable substitution

  Scenario: Process template with simple variable substitution
    Given I have a Word template "simple-letter.docx" containing:
      | placeholder      | location        |
      | {{recipientName}} | document body   |
      | {{date}}         | header          |
      | {{senderName}}   | signature block |
    And I have template variables:
      | variable       | value           |
      | recipientName  | John Doe        |
      | date          | March 15, 2024  |
      | senderName    | Jane Smith      |
    When I process the template
    Then "{{recipientName}}" should be replaced with "John Doe"
    And "{{date}}" should be replaced with "March 15, 2024"
    And "{{senderName}}" should be replaced with "Jane Smith"
    And no placeholder syntax should remain in the output

  Scenario: Process template with conditional content
    Given I have a PowerPoint template with conditional slides
    And the template contains conditional blocks:
      | condition                 | content                    |
      | {{#if showFinancials}}    | Financial overview slide   |
      | {{#if showTeamInfo}}      | Team information slide     |
      | {{#unless isPublic}}      | Internal use only notice   |
    And I have conditional data:
      | variable        | value |
      | showFinancials  | true  |
      | showTeamInfo    | false |
      | isPublic        | true  |
    When I process the template with conditions
    Then the financial overview slide should be included
    And the team information slide should be excluded
    And the internal use notice should be excluded
    And the final presentation should have the correct number of slides

  Scenario: Process template with loops and iterations
    Given I have an Excel template with repeating sections
    And the template contains a loop for data rows:
      | loop pattern        | data source |
      | {{#each products}}  | products    |
      | {{name}}           | name field  |
      | {{price}}          | price field |
      | {{quantity}}       | qty field   |
      | {{/each}}          | end loop    |
    And I have array data:
      | name      | price | quantity |
      | Product A | 19.99 | 50       |
      | Product B | 29.99 | 25       |
      | Product C | 39.99 | 10       |
    When I process the template with loop data
    Then the Excel sheet should contain 3 product rows
    And each row should have the correct name, price, and quantity
    And the loop structure should be properly expanded
    And formulas referencing the data should update correctly

  Scenario: Process template with nested object data
    Given I have a Word template with nested data structures
    And the template uses nested placeholders:
      | placeholder              | data path           |
      | {{company.name}}         | company.name        |
      | {{company.address.street}} | company.address.street |
      | {{company.contact.email}}  | company.contact.email  |
    And I have nested data:
      """json
      {
        "company": {
          "name": "Tech Solutions Inc",
          "address": {
            "street": "123 Main St",
            "city": "San Francisco",
            "zip": "94105"
          },
          "contact": {
            "email": "info@techsolutions.com",
            "phone": "+1-555-0123"
          }
        }
      }
      """
    When I process the template with nested data
    Then "{{company.name}}" should resolve to "Tech Solutions Inc"
    And "{{company.address.street}}" should resolve to "123 Main St"
    And "{{company.contact.email}}" should resolve to "info@techsolutions.com"
    And all nested references should be properly substituted

  Scenario: Apply formatting functions to template variables
    Given I have an Office template with formatted placeholders
    And the template contains formatting functions:
      | placeholder              | expected format    |
      | {{amount \| currency}}   | $1,234.56         |
      | {{date \| dateFormat}}   | March 15, 2024    |
      | {{text \| uppercase}}    | UPPERCASE TEXT    |
      | {{number \| percentage}} | 85.5%             |
    And I have unformatted data:
      | variable | value      |
      | amount   | 1234.56    |
      | date     | 2024-03-15 |
      | text     | uppercase text |
      | number   | 0.855      |
    When I process the template with formatting functions
    Then the amount should display as "$1,234.56"
    And the date should display as "March 15, 2024"
    And the text should display as "UPPERCASE TEXT"
    And the number should display as "85.5%"

  Scenario: Handle template inheritance and includes
    Given I have a base template "base-document.docx"
    And I have header and footer templates:
      | template           | content           |
      | company-header.docx | Company letterhead |
      | standard-footer.docx | Contact information |
    And I have a main template that includes:
      | include directive        | template file        |
      | {{> company-header}}     | company-header.docx  |
      | {{> standard-footer}}    | standard-footer.docx |
    When I process the main template
    Then the company header should be included at the top
    And the standard footer should be included at the bottom
    And the main content should be between header and footer
    And all included content should maintain proper formatting

  Scenario: Validate template syntax before processing
    Given I have Office templates with various syntax patterns
    And some templates contain syntax errors:
      | template        | error type           | error location     |
      | invalid1.docx   | unclosed tag        | {{#if condition    |
      | invalid2.pptx   | unknown function    | {{unknown_func}}   |
      | invalid3.xlsx   | malformed loop      | {{#each items}     |
    When I validate the template syntax
    Then templates with syntax errors should be identified
    And specific error messages should be provided
    And error locations should be reported
    And valid templates should pass validation
    And processing should only proceed with valid templates

  Scenario: Process templates with custom helper functions
    Given I have registered custom helper functions:
      | helper name     | function                    |
      | calculateTotal  | sum array of numbers        |
      | formatAddress   | format address components   |
      | generateId      | create unique identifier    |
    And I have a template using custom helpers:
      | placeholder                        | expected behavior           |
      | {{calculateTotal items}}           | sum item values             |
      | {{formatAddress address}}          | format address string       |
      | {{generateId prefix}}              | create prefixed ID          |
    When I process the template with custom helpers
    Then the calculateTotal helper should sum numeric values
    And the formatAddress helper should create formatted address
    And the generateId helper should create unique identifiers
    And all custom helper results should be properly inserted

  Scenario: Handle large datasets in templates efficiently
    Given I have a template that processes large datasets
    And I have test data with:
      | data type    | count  |
      | records      | 10000  |
      | nested items | 50000  |
      | calculations | 1000   |
    When I process the template with large dataset
    Then processing should complete within 60 seconds
    And memory usage should remain under 1GB
    And the output document should contain all records
    And document performance should remain acceptable
    And no data should be truncated or lost

  Scenario: Process templates with error recovery
    Given I have a template with some problematic placeholders
    And the template contains:
      | placeholder type    | issue                        |
      | valid placeholders  | should process normally      |
      | invalid references  | reference non-existent data  |
      | malformed syntax    | syntax errors in some places |
    When I process the template with error recovery enabled
    Then valid placeholders should be processed correctly
    And invalid references should use default values or remain unchanged
    And malformed syntax should be reported but not stop processing
    And the output should be generated with available data
    And error details should be logged for troubleshooting