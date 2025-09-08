Feature: LaTeX Template Output Validation
  As a quality assurance engineer
  I want to validate LaTeX template outputs for correctness and compliance
  So that generated documents meet academic and legal standards

  Background:
    Given I have unjucks installed
    And I have LaTeX templates available
    And I have validation tools configured

  Scenario: Validate arXiv paper template output structure
    Given I generate an arXiv paper with standard parameters:
      | parameter     | value                           |
      | title         | Test arXiv Paper               |
      | author        | Dr. Test Researcher             |
      | abstract      | This is a test abstract for validation |
      | dest          | tests/output                    |
    When I validate the generated LaTeX structure
    Then the document should have proper LaTeX document structure:
      | element               | requirement           | status |
      | documentclass         | present               | PASS   |
      | begin{document}       | present               | PASS   |
      | end{document}         | present               | PASS   |
      | maketitle             | present               | PASS   |
      | title command         | matches input         | PASS   |
      | author command        | matches input         | PASS   |
      | abstract environment  | contains input        | PASS   |

  Scenario: Validate legal contract template compliance
    Given I generate a legal contract with required fields:
      | parameter      | value                    |
      | contractTitle  | Software License Agreement |
      | partyA.name    | TechCorp Inc.           |
      | partyA.address | 123 Tech Street, CA    |
      | partyB.name    | Developer Solutions LLC |
      | partyB.address | 456 Code Ave, NY       |
      | effectiveDate  | 2024-01-15              |
      | dest           | tests/output            |
    When I validate the legal contract structure
    Then the contract should contain required legal elements:
      | element           | requirement     | validation_rule                |
      | Contract Title    | present         | must be uppercase              |
      | Parties Section   | present         | must list both parties        |
      | Effective Date    | present         | must be valid date format     |
      | Party A Details   | complete        | name and address required      |
      | Party B Details   | complete        | name and address required      |
      | Signature Block   | present         | must have signature lines     |

  Scenario: Validate arXiv paper with mathematical content
    Given I generate an arXiv paper with math elements:
      | parameter     | value                           |
      | title         | Mathematical Analysis Paper     |
      | author        | Prof. Mathematics               |
      | theorems      | true                           |
      | algorithms    | true                           |
      | dest          | tests/output                    |
    When I validate mathematical LaTeX elements
    Then the paper should contain proper math environments:
      | environment       | package_required    | syntax_correct |
      | theorem           | amsthm              | yes           |
      | lemma             | amsthm              | yes           |
      | proof             | amsthm              | yes           |
      | algorithm         | algorithm           | yes           |
      | algorithmic       | algorithmic         | yes           |
    And theorem numbering should be consistent
    And cross-references should be properly formatted

  Scenario: Validate bibliography formatting
    Given I generate an arXiv paper with bibliography:
      | parameter     | value        |
      | title         | Research Survey |
      | author        | Bibliography Expert |
      | bibliography  | biblatex     |
      | bibstyle      | nature       |
      | dest          | tests/output |
    When I validate bibliography configuration
    Then the bibliography setup should be correct:
      | element                    | expected_value              |
      | biblatex package           | loaded with backend=biber   |
      | bibliography style         | nature                      |
      | printbibliography command  | present                     |
      | addbibresource command     | present                     |

  Scenario: Validate package dependencies
    Given I generate an arXiv paper with custom packages:
      | parameter | value                    |
      | title     | Package Test Paper       |
      | author    | Package Expert           |
      | packages  | siunitx,physics,tikz     |
      | dest      | tests/output             |
    When I validate package loading
    Then all specified packages should be properly loaded:
      | package   | load_order  | conflicts_checked |
      | siunitx   | correct     | yes              |
      | physics   | correct     | yes              |
      | tikz      | correct     | yes              |
    And package options should be syntactically correct
    And no package conflicts should exist

  Scenario: Validate document metadata
    Given I generate an arXiv paper with complete metadata:
      | parameter   | value                    |
      | title       | Comprehensive Research   |
      | author      | Dr. Research Leader      |
      | affiliation | University of Science    |
      | email       | researcher@univ.edu      |
      | keywords    | research,science,analysis |
      | msc_codes   | 68T50,68T01             |
      | pacs_codes  | 07.05.Kf                |
      | dest        | tests/output            |
    When I validate document metadata
    Then metadata should be properly formatted:
      | metadata_type | format_requirement              | validation_status |
      | keywords      | comma-separated, no trailing    | PASS             |
      | MSC codes     | valid MSC2020 format           | PASS             |
      | PACS codes    | valid physics classification   | PASS             |
      | email         | valid email format             | PASS             |
      | affiliation   | non-empty string               | PASS             |

  Scenario: Validate cross-reference consistency
    Given I generate an arXiv paper with cross-references:
      | parameter | value            |
      | title     | Cross-ref Paper  |
      | author    | Reference Expert |
      | sections  | intro,methods,results |
      | dest      | tests/output     |
    When I validate cross-reference system
    Then all references should be consistent:
      | reference_type | labels_present | refs_present | syntax_correct |
      | sections       | yes           | yes          | yes           |
      | equations      | yes           | yes          | yes           |
      | figures        | yes           | yes          | yes           |
      | tables         | yes           | yes          | yes           |
    And no undefined references should exist
    And label naming should follow conventions

  Scenario: Validate accessibility compliance
    Given I generate an arXiv paper with accessibility features:
      | parameter        | value              |
      | title            | Accessible Paper   |
      | author           | Accessibility Expert |
      | alt_text         | true              |
      | semantic_markup  | true              |
      | color_blind_safe | true              |
      | dest             | tests/output       |
    When I validate accessibility features
    Then the paper should meet accessibility standards:
      | accessibility_feature | implemented | compliant |
      | Alt text for figures  | yes         | yes      |
      | Semantic markup       | yes         | yes      |
      | Color contrast        | yes         | yes      |
      | Screen reader support | yes         | yes      |

  Scenario: Validate performance characteristics
    Given I generate a large arXiv paper:
      | parameter    | value                |
      | title        | Large Document Test  |
      | author       | Performance Tester   |
      | page_count   | 50                  |
      | figure_count | 20                  |
      | table_count  | 15                  |
      | ref_count    | 200                 |
      | dest         | tests/output         |
    When I validate document performance characteristics
    Then the document should meet performance requirements:
      | metric                | threshold    | actual | status |
      | File size             | < 500KB      | TBD    | PASS   |
      | Compilation time      | < 30 seconds | TBD    | PASS   |
      | Memory usage          | < 100MB      | TBD    | PASS   |
      | Cross-ref resolution  | < 5 seconds  | TBD    | PASS   |

  Scenario: Validate legal contract clause structure
    Given I generate a legal contract with standard clauses:
      | parameter         | value                           |
      | contractTitle     | Professional Services Agreement |
      | standardClauses   | termination,confidentiality,liability,governing_law |
      | partyA.name       | Client Company                  |
      | partyB.name       | Service Provider LLC            |
      | dest              | tests/output                    |
    When I validate legal clause structure
    Then all standard clauses should be present and properly formatted:
      | clause_type       | present | formatting_correct | legal_language |
      | termination       | yes     | yes               | yes           |
      | confidentiality   | yes     | yes               | yes           |
      | liability         | yes     | yes               | yes           |
      | governing_law     | yes     | yes               | yes           |
      | entire_agreement  | yes     | yes               | yes           |
    And clause numbering should be sequential and consistent

  Scenario: Validate template extensibility
    Given I create a custom arXiv paper extension:
      | parameter        | value                    |
      | base_template    | latex/arxiv/paper       |
      | custom_sections  | methodology,limitations  |
      | custom_packages  | custommath,specialfigs   |
      | dest             | tests/output             |
    When I validate template extension mechanism
    Then the extended template should work correctly:
      | extension_feature    | functional | backward_compatible |
      | Custom sections      | yes        | yes                |
      | Custom packages      | yes        | yes                |
      | Base functionality   | yes        | yes                |
      | Parameter inheritance| yes        | yes                |

  Scenario: Validate error recovery and reporting
    Given I generate templates with various error conditions:
      | error_type           | test_case                    |
      | missing_required     | title omitted               |
      | invalid_parameter    | documentclass="invalid"     |
      | malformed_data       | author=null                 |
      | circular_reference   | section refs itself         |
    When I validate error handling
    Then error reporting should be comprehensive:
      | error_aspect        | requirement                  | status |
      | Error detection     | all errors caught           | PASS   |
      | Error messages      | clear and actionable        | PASS   |
      | Error location      | line/column identified      | PASS   |
      | Recovery suggestions| provided when possible      | PASS   |
      | Graceful degradation| partial output when safe    | PASS   |

  Scenario: Validate internationalization support
    Given I generate templates with international content:
      | parameter    | value                        |
      | title        | 研究论文：机器学习的应用      |
      | author       | José María García-Rodríguez  |
      | language     | multilingual                 |
      | encoding     | UTF-8                       |
      | dest         | tests/output                 |
    When I validate internationalization features
    Then international content should be handled correctly:
      | i18n_feature        | supported | correctly_rendered |
      | Unicode characters  | yes       | yes               |
      | Right-to-left text  | yes       | yes               |
      | Diacritical marks   | yes       | yes               |
      | Multiple languages  | yes       | yes               |
      | Font selection      | automatic | yes               |

  Scenario: Validate template version compatibility
    Given I have templates from different versions:
      | template_version | compatibility_level |
      | v1.0            | backward_compatible |
      | v2.0            | breaking_changes    |
      | v2.1            | backward_compatible |
    When I validate version compatibility
    Then version handling should be robust:
      | compatibility_aspect | requirement           | implementation |
      | Version detection    | automatic             | yes           |
      | Migration support    | v1.x to v2.x         | yes           |
      | Deprecation warnings | clear and helpful     | yes           |
      | Fallback behavior    | graceful degradation  | yes           |

  Scenario: Validate security considerations
    Given I generate templates with security-sensitive content:
      | security_aspect     | test_case                    |
      | Input sanitization  | special characters in params |
      | Path traversal      | "../../../etc/passwd"       |
      | Code injection      | malicious template code      |
      | Data exposure       | sensitive data in output     |
    When I validate security measures
    Then security requirements should be met:
      | security_measure       | implemented | effective |
      | Input validation       | yes         | yes      |
      | Output sanitization    | yes         | yes      |
      | Path restriction       | yes         | yes      |
      | Code execution limits  | yes         | yes      |
      | Data leak prevention   | yes         | yes      |