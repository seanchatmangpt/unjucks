Feature: LaTeX Academic and Report Templates
  As a researcher, academic, or professional writer
  I want to generate LaTeX documents from specialized templates
  So that I can create professional academic papers, reports, and presentations with proper formatting

  Background:
    Given KGEN is properly configured with LaTeX support
    And LaTeX and required packages are installed
    And the SOURCE_DATE_EPOCH environment variable is set to "1640995200" for reproducible builds
    And template directories are available

  Scenario: Generate academic paper with IEEE template
    Given an IEEE conference paper template exists
    When I run kgen with template "ieee-conference"
    And I provide the following data:
      | field           | value                                |
      | title           | Deep Learning for Medical Imaging    |
      | authors         | Jane Smith, John Doe, Alice Johnson  |
      | affiliation     | MIT Computer Science Department      |
      | abstract        | This paper presents a novel approach |
      | keywords        | deep learning, medical imaging, CNN  |
      | conference      | ICML 2024                           |
    Then a LaTeX document should be generated with IEEE conference format
    And the document should include proper IEEE bibliography style
    And the document should contain the conference name "ICML 2024"
    And figures should use IEEE caption formatting
    And the document should compile without errors

  Scenario: Generate ACM paper template with specific formatting
    Given an ACM article template with modern formatting
    When I generate an ACM paper with:
      | field              | value                        |
      | title              | Scalable Graph Algorithms    |
      | authors            | Dr. Sarah Chen, Prof. Wang   |
      | acm_classification | Theory of computation        |
      | ccs_concepts       | Algorithms, Data structures  |
      | doi                | 10.1145/1234567.1234568     |
      | article_number     | 42                          |
    Then the LaTeX should use ACM document class
    And it should include proper CCS concept formatting
    And the DOI should be correctly formatted
    And ACM copyright notice should be included
    And the document should validate against ACM requirements

  Scenario: Generate scientific journal paper with Nature format
    Given a Nature journal template
    When I create a paper with Nature formatting requirements:
      | field            | value                           |
      | title            | CRISPR Gene Editing Advances   |
      | authors          | Dr. Liu, Dr. Patel, Prof. Kim  |
      | corresponding    | Dr. Liu (liu@university.edu)   |
      | abstract         | We report significant advances  |
      | significance     | This work enables new therapies |
      | word_limit       | 5000                           |
      | figure_count     | 4                              |
      | table_count      | 2                              |
    Then the document should follow Nature formatting guidelines
    And abstract should be within word limits
    And figures should use Nature caption style
    And references should use Nature bibliography format
    And the document should include significance statement

  Scenario: Generate PhD thesis template
    Given a comprehensive PhD thesis template
    When I generate a thesis document with:
      | field              | value                          |
      | title              | Machine Learning for Robotics |
      | author             | Alex Thompson                  |
      | degree             | Doctor of Philosophy           |
      | university         | Stanford University            |
      | department         | Computer Science               |
      | year               | 2024                          |
      | advisor            | Prof. Jennifer Lee             |
      | committee_members  | Prof. Smith, Dr. Johnson       |
      | chapters           | 6                              |
    Then a multi-chapter thesis should be generated
    And it should include title page with university formatting
    And abstract, acknowledgments, and table of contents should be included
    And chapter structure should be properly organized
    And bibliography and appendices should be formatted correctly
    And the document should compile to a complete thesis

  Scenario: Generate technical report with corporate branding
    Given a corporate technical report template
    When I create a technical report with:
      | field           | value                        |
      | title           | System Architecture Analysis |
      | company         | TechCorp Solutions          |
      | authors         | Engineering Team             |
      | project_code    | TC-2024-001                 |
      | classification  | Internal Use Only           |
      | logo_path       | assets/company_logo.png     |
      | date            | 2024-03-15                  |
    Then the report should include corporate header and footer
    And company logo should be properly positioned
    And classification should be prominently displayed
    And project code should appear on each page
    And document should follow corporate style guidelines

  Scenario: Generate conference presentation slides
    Given a LaTeX beamer presentation template
    When I create presentation slides with:
      | field              | value                     |
      | title              | AI Ethics in Healthcare   |
      | presenter          | Dr. Maria Rodriguez       |
      | conference         | MedAI Symposium 2024     |
      | institution        | Medical AI Institute      |
      | theme              | Warsaw                    |
      | slide_count        | 25                       |
      | include_notes      | true                     |
    Then a beamer presentation should be generated
    And it should use the specified theme "Warsaw"
    And slides should include presenter notes
    And navigation should be properly configured
    And the presentation should compile to PDF slides

  Scenario: Generate research proposal template
    Given a research proposal template for grant applications
    When I generate a research proposal with:
      | field               | value                        |
      | title               | Quantum Machine Learning     |
      | principal_investigator | Dr. Alex Kim              |
      | institution         | Quantum Research Lab         |
      | funding_agency      | NSF                         |
      | requested_amount    | $500,000                    |
      | duration            | 3 years                     |
      | budget_categories   | Personnel, Equipment, Travel |
    Then the proposal should include all required sections
    And budget table should be properly formatted
    And NSF formatting requirements should be followed
    And timeline should be presented clearly
    And the document should meet grant application standards

  Scenario: Generate lab report template for students
    Given an academic lab report template
    When I create a lab report with:
      | field          | value                         |
      | title          | Protein Folding Experiment   |
      | student        | Sarah Johnson                 |
      | course         | BIOL 301                      |
      | instructor     | Prof. Williams                |
      | date           | 2024-02-20                    |
      | experiment_id  | PF-001                        |
      | lab_partner    | Mike Chen                     |
    Then the report should follow academic lab report format
    And it should include sections for objectives, methods, results, and conclusions
    And proper scientific citation format should be used
    And figures and tables should be numbered correctly
    And the document should be suitable for academic submission

  Scenario: Generate mathematical paper with theorem environments
    Given a mathematics research paper template
    When I create a mathematics paper with:
      | field              | value                    |
      | title              | Algebraic Topology Results |
      | author             | Dr. Emma Zhang             |
      | msc_classification | 55N15, 55P10              |
      | theorem_style      | plain                     |
      | numbering_style    | section                   |
      | include_proofs     | true                      |
    Then the document should include proper theorem environments
    And theorems, lemmas, and corollaries should be numbered correctly
    And mathematical notation should be properly formatted
    And MSC classification should be included
    And proof environments should be available

  Scenario: Generate multi-author collaborative paper
    Given a template supporting multiple authors and affiliations
    When I create a paper with multiple authors:
      | field                | value                                    |
      | title                | Climate Change Modeling                  |
      | author1_name         | Dr. Lisa Chen                           |
      | author1_affiliation  | Climate Research Institute              |
      | author2_name         | Prof. James Wilson                      |
      | author2_affiliation  | Environmental Sciences Dept            |
      | author3_name         | Dr. Amara Okafor                       |
      | author3_affiliation  | Atmospheric Physics Lab                 |
      | corresponding_author | Dr. Lisa Chen                           |
      | email                | l.chen@climate-research.org            |
    Then all authors should be properly listed with affiliations
    And corresponding author should be clearly marked
    And author order should be maintained
    And affiliation numbering should be correct
    And contact information should be properly formatted

  Scenario: Generate paper with extensive bibliography
    Given a research paper template with advanced bibliography support
    When I create a paper requiring comprehensive citations:
      | field              | value                        |
      | title              | Systematic Literature Review |
      | author             | Dr. Research Scholar         |
      | bib_style          | apa                         |
      | citation_style     | author-year                 |
      | references_file    | extensive_bibliography.bib  |
      | citation_count     | 150+                        |
    Then the document should support the specified citation style
    And bibliography should be properly formatted
    And in-text citations should follow APA guidelines
    And reference list should be alphabetically ordered
    And DOIs and URLs should be properly handled

  Scenario: Generate template with custom document structure
    Given flexibility to create custom document layouts
    When I generate a document with custom structure:
      | field              | value                      |
      | document_type      | research_report            |
      | sections           | Executive Summary,Analysis,Recommendations |
      | numbering          | hierarchical               |
      | toc_depth          | 3                         |
      | include_glossary   | true                      |
      | include_index      | true                      |
    Then the document should follow the custom section structure
    And table of contents should reflect the specified depth
    And glossary and index should be properly configured
    And section numbering should be hierarchical
    And document should maintain professional formatting throughout