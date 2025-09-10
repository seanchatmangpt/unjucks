# Functional Requirements Specification

## 3. Functional Requirements

### 3.1 Core Features

#### FR-001: Template Discovery System
**Description**: The system SHALL automatically discover and index template generators and their associated templates.

**Acceptance Criteria**:
- System SHALL scan `_templates` directory in project root
- System SHALL fallback to `templates` directory if `_templates` not found  
- System SHALL walk up directory tree to find templates relative to package.json
- System SHALL load generator configurations from `config.yml` files
- System SHALL automatically discover templates when no config exists
- Templates discovery SHALL be testable via `listGenerators()` API

**Priority**: High
**Testability**: Verify directory scanning, config parsing, and fallback behavior

#### FR-002: Nunjucks Templating Engine Integration
**Description**: The system SHALL integrate Nunjucks templating engine with custom filters and environment configuration.

**Acceptance Criteria**:
- System SHALL create Nunjucks environment with autoescape disabled
- System SHALL include custom string case filters: kebabCase, camelCase, pascalCase, snakeCase
- System SHALL include pluralization filters: pluralize, singularize
- System SHALL include titleCase and capitalize filters
- System SHALL support template inheritance via extends/block syntax
- System SHALL support conditionals, loops, and variable interpolation
- Templating SHALL render both file content and filenames

**Priority**: High  
**Testability**: Test each filter function, template rendering, and complex template scenarios

#### FR-003: Interactive Prompt System
**Description**: The system SHALL provide interactive prompts for collecting template variables when not provided via CLI.

**Acceptance Criteria**:
- System SHALL prompt for generator selection when none specified
- System SHALL prompt for template selection when none specified
- System SHALL collect variables based on config.yml prompts configuration
- System SHALL support input, confirm, and choice prompt types
- System SHALL skip prompts for variables already provided via CLI
- System SHALL only prompt for variables actually used in templates
- Prompt system SHALL integrate with inquirer.js library

**Priority**: High
**Testability**: Mock inquirer interactions and verify prompt logic

#### FR-004: File Generation Engine
**Description**: The system SHALL generate files from templates with variable substitution and destination control.

**Acceptance Criteria**:
- System SHALL process template directories recursively
- System SHALL render file content using Nunjucks with provided variables
- System SHALL render filenames using Nunjucks with provided variables
- System SHALL support custom destination paths via frontmatter `to:` property
- System SHALL support conditional file generation via `skipIf` frontmatter
- System SHALL support file permission setting via `chmod` frontmatter
- System SHALL support shell command execution via `sh` frontmatter
- Generation SHALL support dry-run mode without creating files

**Priority**: High
**Testability**: Verify file creation, content rendering, and frontmatter processing

#### FR-005: Variable Processing System
**Description**: The system SHALL automatically detect, collect, and validate template variables.

**Acceptance Criteria**:
- System SHALL scan template content for Nunjucks variable syntax `{{ var }}`
- System SHALL scan filenames for variable syntax
- System SHALL detect variables in conditional blocks `{% if var %}`
- System SHALL detect variables in loop blocks `{% for item in items %}`
- System SHALL infer variable types based on naming patterns (boolean, number, string)
- System SHALL generate CLI argument definitions from detected variables
- System SHALL convert CLI arguments to template variables with type casting
- Variable scanning SHALL ignore Nunjucks built-in variables

**Priority**: High
**Testability**: Test variable extraction, type inference, and CLI conversion

### 3.2 CLI Commands

#### FR-006: init Command Functionality
**Description**: The init command SHALL create project structure with example generators and templates.

**Acceptance Criteria**:
- Command SHALL accept optional project type parameter
- Command SHALL prompt for project type when not provided
- Command SHALL create `_templates` directory structure
- Command SHALL create example generator with config.yml
- Command SHALL create `unjucks.yml` configuration file
- Command SHALL provide next-steps guidance after initialization

**Priority**: Medium
**Testability**: Verify directory creation and file generation

#### FR-007: generate Command Functionality  
**Description**: The generate command SHALL create files from templates with variable substitution.

**Acceptance Criteria**:
- Command SHALL accept generator and template as positional arguments
- Command SHALL support `--dest` for destination directory (default: ".")
- Command SHALL support `--force` flag to overwrite existing files
- Command SHALL support `--dry` flag for preview mode
- Command SHALL enter interactive mode when generator/template not specified
- Command SHALL collect variables via CLI args and/or prompts
- Command SHALL display generation results with file paths
- Command SHALL handle errors gracefully with meaningful messages

**Priority**: High
**Testability**: Test all argument combinations and error scenarios

#### FR-008: list Command Functionality
**Description**: The list command SHALL display available generators and their templates.

**Acceptance Criteria**:
- Command SHALL list all generators when no arguments provided
- Command SHALL show generator descriptions when available
- Command SHALL list templates for specific generator when provided
- Command SHALL display template descriptions when available  
- Command SHALL show template file lists for each template
- Command SHALL handle empty generators directory gracefully
- Display SHALL use colored output for better readability

**Priority**: Medium
**Testability**: Verify listing behavior with various directory states

#### FR-009: help Command Functionality
**Description**: The help command SHALL provide usage information and template variable help.

**Acceptance Criteria**:
- Command SHALL show general help when no arguments provided
- Command SHALL show template-specific variable help when generator/template specified
- Help SHALL display available variables and their types
- Help SHALL show CLI argument options for templates
- Help SHALL include usage examples
- Help SHALL integrate with --help flag on main CLI

**Priority**: Low
**Testability**: Verify help content accuracy and completeness

### 3.3 Template Management

#### FR-010: Template Validation System
**Description**: The system SHALL validate template structure and configuration files.

**Acceptance Criteria**:
- System SHALL validate YAML syntax in config.yml files
- System SHALL validate frontmatter syntax in template files
- System SHALL warn about invalid configurations without failing
- System SHALL validate frontmatter properties (to, inject, skipIf, chmod, sh)
- System SHALL check for template file existence
- Validation SHALL provide specific error messages for debugging

**Priority**: Medium  
**Testability**: Test with various invalid configurations

#### FR-011: Variable Extraction Engine
**Description**: The system SHALL extract and analyze variables from template files and filenames.

**Acceptance Criteria**:
- Engine SHALL extract variables from `{{ variable }}` syntax
- Engine SHALL extract variables from `{{ variable | filter }}` syntax  
- Engine SHALL extract variables from `{% if variable %}` conditionals
- Engine SHALL extract variables from `{% for item in collection %}` loops
- Engine SHALL extract variables from template filenames
- Engine SHALL exclude Nunjucks built-in variables from extraction
- Extraction SHALL work recursively through template directories

**Priority**: High
**Testability**: Test extraction with complex template scenarios

#### FR-012: Conditional Logic Support
**Description**: The system SHALL support conditional template processing based on variables.

**Acceptance Criteria**:
- System SHALL support `skipIf` frontmatter for conditional file creation
- System SHALL evaluate skipIf expressions using template variables
- System SHALL support Nunjucks conditional blocks in content
- System SHALL skip files when skipIf condition is true
- Conditional logic SHALL work with boolean, string, and numeric comparisons
- System SHALL log skipped files with clear messages

**Priority**: Medium
**Testability**: Test various skipIf conditions and variable combinations

#### FR-013: File Injection Capabilities  
**Description**: The system SHALL support file injection and modification modes beyond simple file creation.

**Acceptance Criteria**:
- System SHALL support `inject: true` frontmatter for file modification
- System SHALL support `before`, `after`, `append`, `prepend` injection modes
- System SHALL support `lineAt` for line-specific injection
- System SHALL make idempotent modifications (no duplicates)
- System SHALL create backups before modification when enabled
- System SHALL support atomic file operations
- Injection SHALL respect existing file structure and formatting

**Priority**: Medium
**Testability**: Test injection modes with various file types and scenarios

### 3.4 Error Handling

#### FR-014: User-Friendly Error Messages
**Description**: The system SHALL provide clear, actionable error messages for common failure scenarios.

**Acceptance Criteria**:
- System SHALL show helpful messages when generators directory not found
- System SHALL show specific errors when template files missing
- System SHALL show validation errors with file and line information
- System SHALL show permission errors with suggested solutions
- System SHALL show variable errors with expected types
- Error messages SHALL include suggested next steps
- Errors SHALL be displayed with appropriate color coding

**Priority**: High  
**Testability**: Test error scenarios and verify message clarity

#### FR-015: Recovery Mechanisms
**Description**: The system SHALL provide mechanisms to recover from partial failures.

**Acceptance Criteria**:
- System SHALL create file backups before modification when enabled
- System SHALL rollback changes on critical failures when possible
- System SHALL continue processing remaining files after individual failures
- System SHALL provide detailed failure reports
- System SHALL support force mode to override safety checks
- Recovery SHALL preserve data integrity

**Priority**: Medium
**Testability**: Test recovery scenarios and backup restoration

#### FR-016: Validation Feedback System
**Description**: The system SHALL provide immediate feedback on configuration and template validity.

**Acceptance Criteria**:
- System SHALL validate YAML configuration on load
- System SHALL validate frontmatter syntax before processing
- System SHALL validate variable types before template rendering  
- System SHALL show warnings for unused configuration
- System SHALL show warnings for missing template variables
- Feedback SHALL be provided in real-time during command execution

**Priority**: Medium
**Testability**: Test validation with various invalid inputs and edge cases

## 3.5 Performance Requirements

#### FR-017: Template Processing Performance
**Description**: Template scanning and processing SHALL complete within acceptable timeframes.

**Acceptance Criteria**:
- Template discovery SHALL complete within 2 seconds for directories with <100 templates
- Variable extraction SHALL complete within 1 second for individual templates
- File generation SHALL process <50 files within 5 seconds
- Memory usage SHALL remain under 100MB for typical operations
- Performance SHALL degrade gracefully with large template sets

**Priority**: Low
**Testability**: Benchmark operations with performance thresholds

## 3.6 Security Requirements

#### FR-018: Safe Template Processing
**Description**: The system SHALL prevent security vulnerabilities in template processing.

**Acceptance Criteria**:
- System SHALL validate file paths to prevent directory traversal
- System SHALL sanitize shell commands before execution
- System SHALL restrict template access to project directory
- System SHALL validate file permissions before setting chmod
- System SHALL prevent code injection through template variables

**Priority**: High
**Testability**: Test with malicious inputs and security scenarios

## 3.7 Integration Requirements

#### FR-019: API Interface
**Description**: The system SHALL provide a programmatic API for integration with other tools.

**Acceptance Criteria**:
- API SHALL export Generator class for programmatic usage
- API SHALL provide async methods for all core operations
- API SHALL return structured results for processing outcomes
- API SHALL support custom template directories
- API SHALL support custom Nunjucks environments
- Integration SHALL be possible via ES modules

**Priority**: Medium  
**Testability**: Test API usage in isolated integration scenarios

---

**Note**: All functional requirements are designed to be independently testable and measurable. Each requirement includes specific acceptance criteria that can be verified through automated testing, manual testing, or performance benchmarking.