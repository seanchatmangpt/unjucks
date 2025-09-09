import { defineCommand } from "citty";
import chalk from "chalk";
import fs from 'fs-extra';
import path from 'node:path';
import yaml from 'yaml';

/**
 * Specification validation command
 * Validates specifications for completeness, consistency, and quality
 */
export const validateCommand = defineCommand({
  meta: {
    name: "validate",
    description: "Validate specifications for completeness, consistency, and quality",
  },
  args: {
    specDir: {
      type: "string",
      description: "Directory containing specifications to validate",
      default: "specs",
      alias: "s",
    },
    type: {
      type: "string",
      description: "Type of specs to validate (all, requirements, architecture, apis, components)",
      default: "all",
      alias: "t",
    },
    output: {
      type: "string",
      description: "Output file for validation report",
      alias: "o",
    },
    format: {
      type: "string",
      description: "Report format (console, json, yaml, markdown, junit)",
      default: "console",
      alias: "f",
    },
    strict: {
      type: "boolean",
      description: "Enable strict validation with additional checks",
      default: false,
    },
    fix: {
      type: "boolean",
      description: "Automatically fix issues where possible",
      default: false,
    },
    rules: {
      type: "string",
      description: "Validation rules file (JSON/YAML with custom rules)",
      alias: "r",
    },
    severity: {
      type: "string",
      description: "Minimum severity level to report (error, warning, info)",
      default: "warning",
    },
    quiet: {
      type: "boolean",
      description: "Only show errors and warnings, suppress info messages",
      default: false,
      alias: "q",
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose logging with detailed validation info",
      default: false,
      alias: "v",
    },
  },
  async run(context) {
    const { args } = context;
    const startTime = Date.now();

    try {
      if (!args.quiet) {
        console.log(chalk.blue("🔍 Validating Project Specifications"));
        
        if (args.verbose) {
          console.log(chalk.gray("Configuration:"), {
            specDir: args.specDir,
            type: args.type,
            format: args.format,
            strict: args.strict,
            severity: args.severity
          });
        }
      }

      // Check if specs directory exists
      if (!(await fs.pathExists(args.specDir))) {
        console.error(chalk.red(`\n❌ Specifications directory not found: ${args.specDir}`));
        console.log(chalk.blue("💡 Initialize project with: unjucks specify init <project>"));
        return {
          success: false,
          message: "Specs directory not found"
        };
      }

      // Load custom validation rules if provided
      let customRules = {};
      if (args.rules && await fs.pathExists(args.rules)) {
        try {
          const rulesContent = await fs.readFile(args.rules, 'utf8');
          customRules = args.rules.endsWith('.json') ? 
            JSON.parse(rulesContent) : 
            yaml.parse(rulesContent);
          
          if (args.verbose) {
            console.log(chalk.green(`✓ Loaded custom rules: ${args.rules}`));
          }
        } catch (error) {
          console.warn(chalk.yellow(`Warning: Failed to load custom rules: ${error.message}`));
        }
      }

      // Initialize validator
      const validator = new SpecificationValidator(args.specDir, {
        type: args.type,
        strict: args.strict,
        severity: args.severity,
        customRules,
        verbose: args.verbose
      });

      // Run validation
      const validationResult = await validator.validate();

      if (!args.quiet) {
        // Display validation summary
        console.log(chalk.cyan("\n📊 Validation Summary:"));
        console.log(chalk.gray(`  Files validated: ${validationResult.filesValidated}`));
        console.log(chalk.gray(`  Total issues: ${validationResult.totalIssues}`));
        
        const errorCount = validationResult.issues.filter(i => i.severity === 'error').length;
        const warningCount = validationResult.issues.filter(i => i.severity === 'warning').length;
        const infoCount = validationResult.issues.filter(i => i.severity === 'info').length;
        
        if (errorCount > 0) {
          console.log(chalk.red(`  Errors: ${errorCount}`));
        }
        if (warningCount > 0) {
          console.log(chalk.yellow(`  Warnings: ${warningCount}`));
        }
        if (infoCount > 0) {
          console.log(chalk.blue(`  Info: ${infoCount}`));
        }
      }

      // Apply auto-fixes if requested
      let fixedIssues = 0;
      if (args.fix) {
        const fixer = new SpecificationFixer(args.specDir, { verbose: args.verbose });
        fixedIssues = await fixer.fixIssues(validationResult.issues);
        
        if (fixedIssues > 0 && !args.quiet) {
          console.log(chalk.green(`\n🔧 Auto-fixed ${fixedIssues} issues`));
        }
      }

      // Generate report
      let report;
      switch (args.format) {
        case 'json':
          report = JSON.stringify(validationResult, null, 2);
          break;
        case 'yaml':
          report = yaml.stringify(validationResult, { indent: 2, lineWidth: 120 });
          break;
        case 'markdown':
          report = this.formatValidationAsMarkdown(validationResult);
          break;
        case 'junit':
          report = this.formatValidationAsJUnit(validationResult);
          break;
        case 'console':
        default:
          this.displayValidationResults(validationResult, args);
          break;
      }

      // Save report to file if output specified
      if (args.output && report) {
        await fs.ensureDir(path.dirname(args.output));
        await fs.writeFile(args.output, report, 'utf8');
        
        if (!args.quiet) {
          console.log(chalk.cyan(`📄 Validation report saved to: ${args.output}`));
        }
      }

      const duration = Date.now() - startTime;
      const isValid = validationResult.issues.filter(i => i.severity === 'error').length === 0;
      
      if (!args.quiet) {
        if (isValid) {
          console.log(chalk.green(`\n✅ Validation completed successfully in ${duration}ms`));
          if (fixedIssues > 0) {
            console.log(chalk.blue(`🔧 ${fixedIssues} issues were auto-fixed`));
          }
        } else {
          console.log(chalk.red(`\n❌ Validation failed with ${errorCount} errors in ${duration}ms`));
        }

        // Show next steps
        if (!isValid) {
          console.log(chalk.blue("\n📝 Next steps:"));
          console.log(chalk.gray("  1. Fix the validation errors shown above"));
          console.log(chalk.gray("  2. Re-run validation to ensure compliance"));
          console.log(chalk.gray("  3. Use --fix flag to auto-fix simple issues"));
        }
      }

      return {
        success: isValid,
        message: isValid ? "Validation passed" : "Validation failed",
        duration,
        issues: validationResult.issues,
        filesValidated: validationResult.filesValidated,
        fixedIssues
      };

    } catch (error) {
      console.error(chalk.red("\n❌ Validation failed:"));
      console.error(chalk.red(`  ${error.message}`));
      
      if (args.verbose && error.stack) {
        console.error(chalk.gray("\n📍 Stack trace:"));
        console.error(chalk.gray(error.stack));
      }
      
      return {
        success: false,
        message: "Validation failed",
        error: error.message
      };
    }
  },

  // Display validation results to console
  displayValidationResults(validationResult, args) {
    const { issues } = validationResult;
    const severityLevels = ['error', 'warning', 'info'];
    const minSeverityIndex = severityLevels.indexOf(args.severity);

    issues.forEach(issue => {
      const severityIndex = severityLevels.indexOf(issue.severity);
      if (severityIndex > minSeverityIndex) return; // Skip lower severity issues

      const severityIcon = {
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
      };

      const severityColor = {
        error: 'red',
        warning: 'yellow',
        info: 'blue'
      };

      console.log();
      console.log(chalk[severityColor[issue.severity]](`${severityIcon[issue.severity]} ${issue.severity.toUpperCase()}: ${issue.message}`));
      console.log(chalk.gray(`   File: ${issue.file}`));
      if (issue.line !== undefined) {
        console.log(chalk.gray(`   Line: ${issue.line}`));
      }
      if (issue.rule) {
        console.log(chalk.gray(`   Rule: ${issue.rule}`));
      }
      if (issue.suggestion) {
        console.log(chalk.gray(`   Suggestion: ${issue.suggestion}`));
      }
    });

    if (issues.length === 0) {
      console.log(chalk.green("\n✅ No validation issues found!"));
    }
  },

  // Format validation results as Markdown
  formatValidationAsMarkdown(validationResult) {
    let markdown = `# Specification Validation Report\n\n`;
    markdown += `**Generated:** ${new Date().toISOString()}\n`;
    markdown += `**Files Validated:** ${validationResult.filesValidated}\n`;
    markdown += `**Total Issues:** ${validationResult.totalIssues}\n\n`;

    if (validationResult.issues.length === 0) {
      markdown += `## ✅ All specifications are valid!\n\n`;
      markdown += `No issues found during validation.\n`;
      return markdown;
    }

    const issuesBySeverity = validationResult.issues.reduce((acc, issue) => {
      if (!acc[issue.severity]) acc[issue.severity] = [];
      acc[issue.severity].push(issue);
      return acc;
    }, {});

    ['error', 'warning', 'info'].forEach(severity => {
      const issues = issuesBySeverity[severity];
      if (!issues || issues.length === 0) return;

      const severityIcon = {
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
      };

      markdown += `## ${severityIcon[severity]} ${severity.charAt(0).toUpperCase() + severity.slice(1)}s (${issues.length})\n\n`;

      issues.forEach((issue, index) => {
        markdown += `### ${index + 1}. ${issue.message}\n\n`;
        markdown += `- **File:** \`${issue.file}\`\n`;
        if (issue.line !== undefined) {
          markdown += `- **Line:** ${issue.line}\n`;
        }
        if (issue.rule) {
          markdown += `- **Rule:** \`${issue.rule}\`\n`;
        }
        if (issue.suggestion) {
          markdown += `- **Suggestion:** ${issue.suggestion}\n`;
        }
        markdown += `\n`;
      });
    });

    return markdown;
  },

  // Format validation results as JUnit XML
  formatValidationAsJUnit(validationResult) {
    const errorCount = validationResult.issues.filter(i => i.severity === 'error').length;
    const testCount = validationResult.filesValidated;
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuites name="specification-validation" tests="${testCount}" failures="${errorCount}" time="0">\n`;
    xml += `  <testsuite name="specification-validation" tests="${testCount}" failures="${errorCount}" time="0">\n`;

    // Group issues by file
    const issuesByFile = validationResult.issues.reduce((acc, issue) => {
      if (!acc[issue.file]) acc[issue.file] = [];
      acc[issue.file].push(issue);
      return acc;
    }, {});

    Object.entries(issuesByFile).forEach(([file, issues]) => {
      const hasErrors = issues.some(i => i.severity === 'error');
      xml += `    <testcase name="${file}" classname="specification-validation">\n`;
      
      if (hasErrors) {
        const errorIssues = issues.filter(i => i.severity === 'error');
        errorIssues.forEach(issue => {
          xml += `      <failure message="${this.escapeXml(issue.message)}" type="${issue.rule || 'validation-error'}">\n`;
          xml += `        ${this.escapeXml(`${issue.message} (Line: ${issue.line || 'N/A'})`)}\n`;
          xml += `      </failure>\n`;
        });
      }
      
      xml += `    </testcase>\n`;
    });

    xml += `  </testsuite>\n`;
    xml += `</testsuites>\n`;

    return xml;
  },

  // Helper method to escape XML characters
  escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
});

/**
 * Specification validator that checks specs for various quality issues
 */
class SpecificationValidator {
  constructor(specDir, options = {}) {
    this.specDir = path.resolve(specDir);
    this.type = options.type || 'all';
    this.strict = options.strict || false;
    this.severity = options.severity || 'warning';
    this.customRules = options.customRules || {};
    this.verbose = options.verbose || false;
    
    // Built-in validation rules
    this.rules = this.initializeRules();
  }

  async validate() {
    const result = {
      success: true,
      filesValidated: 0,
      totalIssues: 0,
      issues: [],
      metadata: {
        validated: new Date().toISOString(),
        validator: 'unjucks-specify',
        version: '1.0.0'
      }
    };

    try {
      // Find specification files to validate
      const specFiles = await this.findSpecificationFiles();
      
      if (this.verbose) {
        console.log(chalk.gray(`Found ${specFiles.length} specification files`));
      }

      // Validate each file
      for (const filePath of specFiles) {
        const fileIssues = await this.validateFile(filePath);
        result.issues.push(...fileIssues);
        result.filesValidated++;
        
        if (this.verbose && fileIssues.length > 0) {
          console.log(chalk.yellow(`  ${path.relative(this.specDir, filePath)}: ${fileIssues.length} issues`));
        }
      }

      // Validate cross-file consistency
      const consistencyIssues = await this.validateConsistency(specFiles);
      result.issues.push(...consistencyIssues);

      result.totalIssues = result.issues.length;
      result.success = !result.issues.some(issue => issue.severity === 'error');

      return result;

    } catch (error) {
      throw new Error(`Validation failed: ${error.message}`);
    }
  }

  async validateFile(filePath) {
    const issues = [];
    
    try {
      // Check file exists and is readable
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        issues.push({
          severity: 'error',
          message: 'Path is not a file',
          file: filePath,
          rule: 'file-existence'
        });
        return issues;
      }

      // Load and parse file content
      const content = await fs.readFile(filePath, 'utf8');
      let spec;
      
      try {
        spec = yaml.parse(content);
      } catch (parseError) {
        issues.push({
          severity: 'error',
          message: `YAML parsing failed: ${parseError.message}`,
          file: filePath,
          line: parseError.mark?.line,
          rule: 'yaml-syntax'
        });
        return issues;
      }

      // Apply validation rules based on file type
      const fileType = this.determineFileType(filePath, spec);
      const applicableRules = this.getApplicableRules(fileType);

      for (const rule of applicableRules) {
        const ruleIssues = await this.applyRule(rule, spec, filePath, content);
        issues.push(...ruleIssues);
      }

    } catch (error) {
      issues.push({
        severity: 'error',
        message: `File validation failed: ${error.message}`,
        file: filePath,
        rule: 'file-access'
      });
    }

    return issues;
  }

  initializeRules() {
    const rules = {
      // Syntax and structure rules
      'yaml-syntax': {
        name: 'YAML Syntax',
        description: 'Validates YAML syntax and structure',
        severity: 'error',
        applies: ['all']
      },
      'required-fields': {
        name: 'Required Fields',
        description: 'Validates presence of required fields',
        severity: 'error',
        applies: ['requirements', 'architecture', 'components']
      },
      'field-types': {
        name: 'Field Types',
        description: 'Validates field data types',
        severity: 'error',
        applies: ['all']
      },
      
      // Content quality rules
      'description-quality': {
        name: 'Description Quality',
        description: 'Validates description completeness and clarity',
        severity: 'warning',
        applies: ['requirements', 'architecture', 'components']
      },
      'id-format': {
        name: 'ID Format',
        description: 'Validates ID format and uniqueness',
        severity: 'error',
        applies: ['requirements', 'components']
      },
      'priority-values': {
        name: 'Priority Values',
        description: 'Validates priority field values',
        severity: 'warning',
        applies: ['requirements']
      },
      
      // Consistency rules
      'dependency-validation': {
        name: 'Dependency Validation',
        description: 'Validates dependency references',
        severity: 'error',
        applies: ['requirements', 'architecture']
      },
      'naming-convention': {
        name: 'Naming Convention',
        description: 'Validates naming conventions',
        severity: 'warning',
        applies: ['all']
      },
      
      // Completeness rules
      'acceptance-criteria': {
        name: 'Acceptance Criteria',
        description: 'Validates acceptance criteria completeness',
        severity: 'warning',
        applies: ['requirements']
      },
      'architecture-documentation': {
        name: 'Architecture Documentation',
        description: 'Validates architecture documentation completeness',
        severity: 'info',
        applies: ['architecture']
      }
    };

    // Merge with custom rules
    return { ...rules, ...this.customRules };
  }

  async findSpecificationFiles() {
    const files = [];
    const searchPaths = [];
    
    // Determine which directories to search based on type
    if (this.type === 'all') {
      searchPaths.push(
        path.join(this.specDir, 'requirements'),
        path.join(this.specDir, 'architecture'),
        path.join(this.specDir, 'apis'),
        path.join(this.specDir, 'components'),
        path.join(this.specDir, 'workflows')
      );
    } else {
      searchPaths.push(path.join(this.specDir, this.type));
    }

    // Also include root spec files
    searchPaths.push(this.specDir);

    for (const searchPath of searchPaths) {
      if (await fs.pathExists(searchPath)) {
        const pathFiles = await this.findYamlFiles(searchPath);
        files.push(...pathFiles);
      }
    }

    return files;
  }

  async findYamlFiles(dir) {
    const files = [];
    
    async function traverse(currentDir) {
      const items = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item.name);
        
        if (item.isDirectory()) {
          await traverse(fullPath);
        } else if (item.isFile() && (item.name.endsWith('.yaml') || item.name.endsWith('.yml'))) {
          files.push(fullPath);
        }
      }
    }

    try {
      await traverse(dir);
    } catch (error) {
      // Directory doesn't exist or permission error
    }
    
    return files;
  }

  determineFileType(filePath, spec) {
    const relativePath = path.relative(this.specDir, filePath);
    
    if (relativePath.includes('requirements')) return 'requirements';
    if (relativePath.includes('architecture')) return 'architecture';
    if (relativePath.includes('apis')) return 'apis';
    if (relativePath.includes('components')) return 'components';
    if (relativePath.includes('workflows')) return 'workflows';
    
    // Try to determine from content
    if (spec) {
      if (spec.id && spec.acceptance_criteria) return 'requirements';
      if (spec.component) return 'architecture';
      if (spec.openapi || spec.swagger) return 'apis';
    }
    
    return 'generic';
  }

  getApplicableRules(fileType) {
    return Object.values(this.rules).filter(rule => 
      rule.applies.includes('all') || rule.applies.includes(fileType)
    );
  }

  async applyRule(rule, spec, filePath, content) {
    const issues = [];
    
    try {
      switch (rule.name) {
        case 'Required Fields':
          issues.push(...this.validateRequiredFields(spec, filePath, rule));
          break;
        case 'Field Types':
          issues.push(...this.validateFieldTypes(spec, filePath, rule));
          break;
        case 'Description Quality':
          issues.push(...this.validateDescriptionQuality(spec, filePath, rule));
          break;
        case 'ID Format':
          issues.push(...this.validateIdFormat(spec, filePath, rule));
          break;
        case 'Priority Values':
          issues.push(...this.validatePriorityValues(spec, filePath, rule));
          break;
        case 'Dependency Validation':
          issues.push(...this.validateDependencies(spec, filePath, rule));
          break;
        case 'Naming Convention':
          issues.push(...this.validateNamingConvention(spec, filePath, rule));
          break;
        case 'Acceptance Criteria':
          issues.push(...this.validateAcceptanceCriteria(spec, filePath, rule));
          break;
        // Add more rule implementations as needed
      }
    } catch (error) {
      issues.push({
        severity: 'error',
        message: `Rule execution failed: ${error.message}`,
        file: filePath,
        rule: rule.name.toLowerCase().replace(/\s+/g, '-')
      });
    }

    return issues;
  }

  validateRequiredFields(spec, filePath, rule) {
    const issues = [];
    const fileType = this.determineFileType(filePath, spec);
    
    let requiredFields = [];
    switch (fileType) {
      case 'requirements':
        requiredFields = ['id', 'title', 'description'];
        break;
      case 'architecture':
        requiredFields = ['component', 'description'];
        break;
      case 'components':
        requiredFields = ['name', 'type', 'description'];
        break;
    }

    for (const field of requiredFields) {
      const fieldPath = field.split('.');
      let current = spec;
      let missing = false;
      
      for (const part of fieldPath) {
        if (!current || typeof current !== 'object' || !(part in current)) {
          missing = true;
          break;
        }
        current = current[part];
      }
      
      if (missing || current === null || current === undefined || current === '') {
        issues.push({
          severity: rule.severity,
          message: `Required field '${field}' is missing or empty`,
          file: filePath,
          rule: 'required-fields',
          suggestion: `Add the '${field}' field with appropriate content`
        });
      }
    }

    return issues;
  }

  validateFieldTypes(spec, filePath, rule) {
    const issues = [];
    
    // Define expected field types
    const fieldTypes = {
      'id': 'string',
      'title': 'string', 
      'priority': 'string',
      'status': 'string',
      'acceptance_criteria': 'array',
      'dependencies': 'array',
      'tags': 'array'
    };

    for (const [field, expectedType] of Object.entries(fieldTypes)) {
      if (field in spec) {
        const actualType = Array.isArray(spec[field]) ? 'array' : typeof spec[field];
        
        if (actualType !== expectedType) {
          issues.push({
            severity: rule.severity,
            message: `Field '${field}' should be ${expectedType} but is ${actualType}`,
            file: filePath,
            rule: 'field-types',
            suggestion: `Convert '${field}' to ${expectedType} format`
          });
        }
      }
    }

    return issues;
  }

  validateDescriptionQuality(spec, filePath, rule) {
    const issues = [];
    
    if (spec.description) {
      const description = spec.description.toString().trim();
      
      if (description.length < 10) {
        issues.push({
          severity: rule.severity,
          message: 'Description is too short (minimum 10 characters)',
          file: filePath,
          rule: 'description-quality',
          suggestion: 'Provide a more detailed description'
        });
      }
      
      if (description.length > 500) {
        issues.push({
          severity: 'info',
          message: 'Description is very long (over 500 characters)',
          file: filePath,
          rule: 'description-quality',
          suggestion: 'Consider breaking down into smaller sections'
        });
      }
      
      // Check for placeholder text
      const placeholders = ['todo', 'tbd', 'fixme', 'placeholder', 'lorem ipsum'];
      const lowerDesc = description.toLowerCase();
      
      for (const placeholder of placeholders) {
        if (lowerDesc.includes(placeholder)) {
          issues.push({
            severity: rule.severity,
            message: `Description contains placeholder text: "${placeholder}"`,
            file: filePath,
            rule: 'description-quality',
            suggestion: 'Replace placeholder text with actual content'
          });
        }
      }
    }

    return issues;
  }

  validateIdFormat(spec, filePath, rule) {
    const issues = [];
    
    if (spec.id) {
      const id = spec.id.toString();
      
      // Check ID format (should be uppercase with hyphens/underscores)
      if (!/^[A-Z][A-Z0-9_-]*$/.test(id)) {
        issues.push({
          severity: rule.severity,
          message: 'ID should be uppercase with hyphens or underscores (e.g., REQ-001, COMP_AUTH)',
          file: filePath,
          rule: 'id-format',
          suggestion: 'Use uppercase format like REQ-001 or COMP_AUTH'
        });
      }
      
      // Check minimum length
      if (id.length < 3) {
        issues.push({
          severity: rule.severity,
          message: 'ID is too short (minimum 3 characters)',
          file: filePath,
          rule: 'id-format',
          suggestion: 'Use a more descriptive ID'
        });
      }
    }

    return issues;
  }

  validatePriorityValues(spec, filePath, rule) {
    const issues = [];
    
    if (spec.priority) {
      const validPriorities = ['critical', 'high', 'medium', 'low'];
      const priority = spec.priority.toString().toLowerCase();
      
      if (!validPriorities.includes(priority)) {
        issues.push({
          severity: rule.severity,
          message: `Invalid priority value: "${spec.priority}". Must be one of: ${validPriorities.join(', ')}`,
          file: filePath,
          rule: 'priority-values',
          suggestion: `Use one of: ${validPriorities.join(', ')}`
        });
      }
    }

    return issues;
  }

  validateDependencies(spec, filePath, rule) {
    const issues = [];
    
    if (spec.dependencies && Array.isArray(spec.dependencies)) {
      for (let i = 0; i < spec.dependencies.length; i++) {
        const dep = spec.dependencies[i];
        
        if (!dep || typeof dep !== 'string') {
          issues.push({
            severity: rule.severity,
            message: `Dependency at index ${i} should be a string`,
            file: filePath,
            rule: 'dependency-validation',
            suggestion: 'Ensure all dependencies are valid string identifiers'
          });
        }
      }
      
      // Check for self-references
      if (spec.id && spec.dependencies.includes(spec.id)) {
        issues.push({
          severity: rule.severity,
          message: 'Specification cannot depend on itself',
          file: filePath,
          rule: 'dependency-validation',
          suggestion: 'Remove self-reference from dependencies'
        });
      }
    }

    return issues;
  }

  validateNamingConvention(spec, filePath, rule) {
    const issues = [];
    
    // Check filename conventions
    const filename = path.basename(filePath, path.extname(filePath));
    
    if (!/^[a-z0-9-]+$/.test(filename)) {
      issues.push({
        severity: rule.severity,
        message: 'Filename should use lowercase letters, numbers, and hyphens only',
        file: filePath,
        rule: 'naming-convention',
        suggestion: 'Rename file to use lowercase-with-hyphens format'
      });
    }

    return issues;
  }

  validateAcceptanceCriteria(spec, filePath, rule) {
    const issues = [];
    
    if (spec.acceptance_criteria) {
      if (!Array.isArray(spec.acceptance_criteria)) {
        issues.push({
          severity: rule.severity,
          message: 'Acceptance criteria should be an array',
          file: filePath,
          rule: 'acceptance-criteria',
          suggestion: 'Convert acceptance criteria to an array of strings'
        });
      } else if (spec.acceptance_criteria.length === 0) {
        issues.push({
          severity: rule.severity,
          message: 'Acceptance criteria is empty',
          file: filePath,
          rule: 'acceptance-criteria',
          suggestion: 'Add at least one acceptance criterion'
        });
      } else {
        // Check each criterion
        spec.acceptance_criteria.forEach((criterion, index) => {
          if (!criterion || typeof criterion !== 'string' || criterion.trim().length === 0) {
            issues.push({
              severity: rule.severity,
              message: `Acceptance criterion at index ${index} is empty or invalid`,
              file: filePath,
              rule: 'acceptance-criteria',
              suggestion: 'Provide meaningful acceptance criteria'
            });
          }
        });
      }
    } else if (this.determineFileType(filePath, spec) === 'requirements') {
      issues.push({
        severity: 'info',
        message: 'Requirements should include acceptance criteria',
        file: filePath,
        rule: 'acceptance-criteria',
        suggestion: 'Add acceptance_criteria field with testable conditions'
      });
    }

    return issues;
  }

  async validateConsistency(specFiles) {
    const issues = [];
    
    try {
      // Load all specifications
      const specs = [];
      const idMap = new Map();
      
      for (const filePath of specFiles) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const spec = yaml.parse(content);
          
          if (spec) {
            specs.push({ spec, filePath });
            
            // Check for duplicate IDs
            if (spec.id) {
              if (idMap.has(spec.id)) {
                issues.push({
                  severity: 'error',
                  message: `Duplicate ID "${spec.id}" found`,
                  file: filePath,
                  rule: 'id-uniqueness',
                  suggestion: `Change ID to be unique (also found in ${idMap.get(spec.id)})`
                });
              } else {
                idMap.set(spec.id, path.relative(this.specDir, filePath));
              }
            }
          }
        } catch (error) {
          // Skip files that couldn't be parsed (already reported in file validation)
        }
      }
      
      // Validate dependency references
      for (const { spec, filePath } of specs) {
        if (spec.dependencies && Array.isArray(spec.dependencies)) {
          for (const dep of spec.dependencies) {
            if (!idMap.has(dep)) {
              issues.push({
                severity: 'error',
                message: `Dependency "${dep}" not found`,
                file: filePath,
                rule: 'dependency-validation',
                suggestion: `Ensure dependency "${dep}" exists or remove the reference`
              });
            }
          }
        }
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        message: `Consistency validation failed: ${error.message}`,
        rule: 'consistency-validation'
      });
    }

    return issues;
  }
}

/**
 * Specification auto-fixer for common issues
 */
class SpecificationFixer {
  constructor(specDir, options = {}) {
    this.specDir = path.resolve(specDir);
    this.verbose = options.verbose || false;
  }

  async fixIssues(issues) {
    let fixedCount = 0;
    
    // Group issues by file for batch fixing
    const issuesByFile = issues.reduce((acc, issue) => {
      if (!acc[issue.file]) acc[issue.file] = [];
      acc[issue.file].push(issue);
      return acc;
    }, {});

    for (const [filePath, fileIssues] of Object.entries(issuesByFile)) {
      const fixed = await this.fixFileIssues(filePath, fileIssues);
      fixedCount += fixed;
    }

    return fixedCount;
  }

  async fixFileIssues(filePath, issues) {
    let fixedCount = 0;
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const spec = yaml.parse(content);
      let modified = false;

      for (const issue of issues) {
        if (this.canAutoFix(issue)) {
          const fixed = this.applyFix(spec, issue);
          if (fixed) {
            fixedCount++;
            modified = true;
            
            if (this.verbose) {
              console.log(chalk.green(`  ✓ Fixed: ${issue.message}`));
            }
          }
        }
      }

      // Save modified file
      if (modified) {
        const fixedContent = yaml.stringify(spec, { 
          indent: 2, 
          lineWidth: 120,
          noRefs: true 
        });
        await fs.writeFile(filePath, fixedContent, 'utf8');
      }

    } catch (error) {
      if (this.verbose) {
        console.warn(chalk.yellow(`Warning: Could not fix issues in ${filePath}: ${error.message}`));
      }
    }

    return fixedCount;
  }

  canAutoFix(issue) {
    const autoFixableRules = [
      'priority-values',
      'field-types',
      'naming-convention'
    ];
    
    return autoFixableRules.includes(issue.rule);
  }

  applyFix(spec, issue) {
    switch (issue.rule) {
      case 'priority-values':
        return this.fixPriorityValue(spec, issue);
      case 'field-types':
        return this.fixFieldType(spec, issue);
      default:
        return false;
    }
  }

  fixPriorityValue(spec, issue) {
    if (spec.priority) {
      const priorityMap = {
        'urgent': 'critical',
        'important': 'high',
        'normal': 'medium',
        'minor': 'low',
        'trivial': 'low'
      };
      
      const currentPriority = spec.priority.toString().toLowerCase();
      if (priorityMap[currentPriority]) {
        spec.priority = priorityMap[currentPriority];
        return true;
      }
    }
    return false;
  }

  fixFieldType(spec, issue) {
    // This is a simplified implementation
    // In practice, you'd need more sophisticated type conversion logic
    return false;
  }
}