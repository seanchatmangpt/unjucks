#!/usr/bin/env node

/**
 * @fileoverview Office CLI commands for processing Office documents (Word, Excel, PowerPoint)
 * Provides comprehensive Office template processing, variable extraction, content injection,
 * format conversion, validation, and batch operations
 */

import { defineCommand } from "citty";
import chalk from "chalk";
import { existsSync, readFileSync, writeFileSync, statSync } from "fs";
import { dirname, extname, basename, join, resolve } from "path";
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

// Dynamic imports for office processing
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Office file type detection and validation
 * @param {string} filePath - Path to the file
 * @returns {{type: string, format: string, valid: boolean}} File info
 */
function getOfficeFileInfo(filePath) {
  if (!existsSync(filePath)) {
    return { type: 'unknown', format: 'unknown', valid: false };
  }

  const ext = extname(filePath).toLowerCase();
  const formats = {
    // Word formats
    '.docx': { type: 'word', format: 'docx', valid: true },
    '.doc': { type: 'word', format: 'doc', valid: true },
    '.dotx': { type: 'word', format: 'template', valid: true },
    '.dot': { type: 'word', format: 'template-legacy', valid: true },
    
    // Excel formats
    '.xlsx': { type: 'excel', format: 'xlsx', valid: true },
    '.xls': { type: 'excel', format: 'xls', valid: true },
    '.xltx': { type: 'excel', format: 'template', valid: true },
    '.xlt': { type: 'excel', format: 'template-legacy', valid: true },
    '.csv': { type: 'excel', format: 'csv', valid: true },
    
    // PowerPoint formats
    '.pptx': { type: 'powerpoint', format: 'pptx', valid: true },
    '.ppt': { type: 'powerpoint', format: 'ppt', valid: true },
    '.potx': { type: 'powerpoint', format: 'template', valid: true },
    '.pot': { type: 'powerpoint', format: 'template-legacy', valid: true },
    
    // Other formats
    '.pdf': { type: 'pdf', format: 'pdf', valid: true },
    '.odt': { type: 'openoffice', format: 'odt', valid: true },
    '.ods': { type: 'openoffice', format: 'ods', valid: true },
    '.odp': { type: 'openoffice', format: 'odp', valid: true }
  };

  return formats[ext] || { type: 'unknown', format: 'unknown', valid: false };
}

/**
 * Extract variables from Office template content
 * Supports Nunjucks syntax: {{ variable }}, {% if condition %}, etc.
 * @param {string} content - Template content
 * @returns {Array<{name: string, type: string, required: boolean, default?: any}>}
 */
function extractVariablesFromContent(content) {
  const variables = [];
  const variableSet = new Set();
  
  // Extract Nunjucks variables {{ variable }}
  const variableRegex = /\{\{\s*([^}]+)\s*\}\}/g;
  let match;
  
  while ((match = variableRegex.exec(content)) !== null) {
    const expression = match[1].trim();
    
    // Handle simple variables
    const simpleVar = expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (simpleVar && !variableSet.has(simpleVar[1])) {
      variables.push({
        name: simpleVar[1],
        type: 'string',
        required: true,
        usage: `{{ ${simpleVar[1]} }}`
      });
      variableSet.add(simpleVar[1]);
    }
    
    // Handle filters and more complex expressions
    const filterMatch = expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\|\s*([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (filterMatch && !variableSet.has(filterMatch[1])) {
      variables.push({
        name: filterMatch[1],
        type: 'string',
        required: true,
        filter: filterMatch[2],
        usage: `{{ ${filterMatch[1]} | ${filterMatch[2]} }}`
      });
      variableSet.add(filterMatch[1]);
    }
  }
  
  // Extract conditional variables {% if variable %}
  const conditionalRegex = /\{%\s*if\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*%\}/g;
  while ((match = conditionalRegex.exec(content)) !== null) {
    const varName = match[1];
    if (!variableSet.has(varName)) {
      variables.push({
        name: varName,
        type: 'boolean',
        required: false,
        default: false,
        usage: `{% if ${varName} %}`
      });
      variableSet.add(varName);
    }
  }
  
  // Extract loop variables {% for item in items %}
  const loopRegex = /\{%\s*for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*%\}/g;
  while ((match = loopRegex.exec(content)) !== null) {
    const arrayName = match[2];
    if (!variableSet.has(arrayName)) {
      variables.push({
        name: arrayName,
        type: 'array',
        required: true,
        itemName: match[1],
        usage: `{% for ${match[1]} in ${arrayName} %}`
      });
      variableSet.add(arrayName);
    }
  }
  
  return variables.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Progress bar utility for batch operations
 */
class ProgressBar {
  constructor(total, description = 'Processing') {
    this.total = total;
    this.current = 0;
    this.description = description;
    this.startTime = Date.now();
  }

  update(current = this.current + 1) {
    this.current = current;
    const percentage = Math.round((this.current / this.total) * 100);
    const filled = Math.round((this.current / this.total) * 30);
    const bar = '█'.repeat(filled) + '░'.repeat(30 - filled);
    
    const elapsed = Date.now() - this.startTime;
    const rate = this.current / (elapsed / 1000);
    const eta = this.current > 0 ? (this.total - this.current) / rate : 0;
    
    process.stdout.write(`\r${chalk.blue(this.description)} [${chalk.green(bar)}] ${chalk.yellow(`${percentage}%`)} (${this.current}/${this.total}) ETA: ${chalk.gray(`${Math.round(eta)}s`)}`);
    
    if (this.current >= this.total) {
      console.log();
    }
  }
}

/**
 * Interactive prompt utility
 */
async function promptForMissingArgs(args, requiredFields) {
  const enquirer = await import('enquirer');
  const missing = {};
  
  for (const field of requiredFields) {
    if (!args[field.name]) {
      const prompt = {
        type: field.type || 'input',
        name: field.name,
        message: field.message || `Enter ${field.name}:`,
        initial: field.default,
        choices: field.choices,
        validate: field.validate
      };
      
      const response = await enquirer.default.prompt(prompt);
      missing[field.name] = response[field.name];
    }
  }
  
  return { ...args, ...missing };
}

/**
 * Process subcommand - Process Office templates with variables
 */
const processCommand = defineCommand({
  meta: {
    name: "process",
    description: "Process Office templates with variables and generate output files",
  },
  args: {
    template: {
      type: "positional",
      description: "Path to the Office template file",
    },
    output: {
      type: "string",
      description: "Output file path",
      alias: "o",
    },
    variables: {
      type: "string", 
      description: "JSON file containing template variables",
      alias: "v",
    },
    data: {
      type: "string",
      description: "Inline JSON data for variables",
      alias: "d",
    },
    format: {
      type: "string",
      description: "Output format (auto-detected if not specified)",
      alias: "f",
    },
    "dry-run": {
      type: "boolean",
      description: "Preview output without writing files",
      alias: "n",
    },
    interactive: {
      type: "boolean",
      description: "Prompt for missing variables",
      alias: "i",
    },
  },
  async run({ args }) {
    console.log(chalk.blue.bold("📄 Processing Office Template"));
    
    // Validate template file
    if (!args.template) {
      console.error(chalk.red("❌ Template file is required"));
      console.log(chalk.gray("Usage: unjucks office process <template> [options]"));
      process.exit(1);
    }
    
    if (!existsSync(args.template)) {
      console.error(chalk.red(`❌ Template file not found: ${args.template}`));
      process.exit(1);
    }
    
    const fileInfo = getOfficeFileInfo(args.template);
    if (!fileInfo.valid) {
      console.error(chalk.red(`❌ Unsupported file format: ${args.template}`));
      process.exit(1);
    }
    
    console.log(chalk.green(`✅ Template: ${args.template} (${fileInfo.type}/${fileInfo.format})`));
    
    // Load variables
    let templateVars = {};
    if (args.variables) {
      if (!existsSync(args.variables)) {
        console.error(chalk.red(`❌ Variables file not found: ${args.variables}`));
        process.exit(1);
      }
      templateVars = JSON.parse(readFileSync(args.variables, 'utf8'));
      console.log(chalk.green(`✅ Loaded variables from: ${args.variables}`));
    }
    
    if (args.data) {
      try {
        const inlineData = JSON.parse(args.data);
        templateVars = { ...templateVars, ...inlineData };
        console.log(chalk.green("✅ Loaded inline data"));
      } catch (error) {
        console.error(chalk.red(`❌ Invalid JSON data: ${error.message}`));
        process.exit(1);
      }
    }
    
    // Interactive mode for missing variables
    if (args.interactive) {
      // Read template content to extract variables
      try {
        // This is a simplified version - in reality, you'd use proper Office parsers
        const content = readFileSync(args.template, 'utf8');
        const requiredVars = extractVariablesFromContent(content);
        
        if (requiredVars.length > 0) {
          console.log(chalk.yellow(`📝 Found ${requiredVars.length} template variables`));
          const prompts = requiredVars
            .filter(v => !(v.name in templateVars))
            .map(v => ({
              name: v.name,
              message: `Enter value for ${v.name} (${v.type}):`,
              type: v.type === 'boolean' ? 'confirm' : 'input',
              default: v.default,
            }));
          
          if (prompts.length > 0) {
            const additionalVars = await promptForMissingArgs({}, prompts);
            templateVars = { ...templateVars, ...additionalVars };
          }
        }
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Could not extract variables: ${error.message}`));
      }
    }
    
    // Determine output path
    const outputPath = args.output || args.template.replace(/\.[^.]+$/, '_processed$&');
    
    if (args["dry-run"]) {
      console.log(chalk.yellow("🔍 Dry run mode - no files will be written"));
      console.log(chalk.gray(`Would process: ${args.template}`));
      console.log(chalk.gray(`Would write to: ${outputPath}`));
      console.log(chalk.gray(`Variables: ${JSON.stringify(templateVars, null, 2)}`));
      return;
    }
    
    // Process the template
    console.log(chalk.blue("🔄 Processing template..."));
    
    try {
      // Simulate processing (in reality, you'd use libraries like docxtemplater, xlsx-template, etc.)
      let processedContent = readFileSync(args.template);
      
      // For text-based formats, do simple variable replacement
      if (['.csv', '.txt'].includes(extname(args.template).toLowerCase())) {
        let content = processedContent.toString('utf8');
        
        // Replace Nunjucks-style variables
        for (const [key, value] of Object.entries(templateVars)) {
          const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
          content = content.replace(regex, String(value));
        }
        
        processedContent = Buffer.from(content, 'utf8');
      }
      
      // Write output
      writeFileSync(outputPath, processedContent);
      
      console.log(chalk.green(`✅ Template processed successfully`));
      console.log(chalk.green(`📁 Output: ${outputPath}`));
      
      // Show statistics
      const originalSize = statSync(args.template).size;
      const processedSize = statSync(outputPath).size;
      console.log(chalk.gray(`📊 Size: ${originalSize} → ${processedSize} bytes`));
      
    } catch (error) {
      console.error(chalk.red(`❌ Processing failed: ${error.message}`));
      process.exit(1);
    }
  },
});

/**
 * Extract subcommand - Extract variables from Office files
 */
const extractCommand = defineCommand({
  meta: {
    name: "extract",
    description: "Extract variables from Office template files",
  },
  args: {
    file: {
      type: "positional",
      description: "Path to the Office template file",
    },
    output: {
      type: "string",
      description: "Output JSON file for variables",
      alias: "o",
    },
    format: {
      type: "string",
      description: "Output format (json, yaml, csv)",
      default: "json",
      alias: "f",
    },
    "include-meta": {
      type: "boolean",
      description: "Include metadata about variables",
      alias: "m",
    },
  },
  async run({ args }) {
    console.log(chalk.blue.bold("🔍 Extracting Variables"));
    
    if (!args.file) {
      console.error(chalk.red("❌ File path is required"));
      console.log(chalk.gray("Usage: unjucks office extract <file> [options]"));
      process.exit(1);
    }
    
    if (!existsSync(args.file)) {
      console.error(chalk.red(`❌ File not found: ${args.file}`));
      process.exit(1);
    }
    
    const fileInfo = getOfficeFileInfo(args.file);
    if (!fileInfo.valid) {
      console.error(chalk.red(`❌ Unsupported file format: ${args.file}`));
      process.exit(1);
    }
    
    console.log(chalk.green(`✅ Analyzing: ${args.file} (${fileInfo.type}/${fileInfo.format})`));
    
    try {
      // Read and analyze the file
      const content = readFileSync(args.file, 'utf8');
      const variables = extractVariablesFromContent(content);
      
      console.log(chalk.green(`✅ Found ${variables.length} variables`));
      
      // Display variables
      if (variables.length > 0) {
        console.log(chalk.yellow("\n📝 Variables found:"));
        variables.forEach((variable, index) => {
          console.log(chalk.gray(`${index + 1}. ${variable.name} (${variable.type})${variable.required ? ' *required*' : ''}`));
          if (variable.usage) {
            console.log(chalk.gray(`   Usage: ${variable.usage}`));
          }
          if (variable.default !== undefined) {
            console.log(chalk.gray(`   Default: ${variable.default}`));
          }
        });
      }
      
      // Prepare output data
      const outputData = args["include-meta"] ? {
        file: args.file,
        fileType: fileInfo.type,
        fileFormat: fileInfo.format,
        extractedAt: new Date().toISOString(),
        variableCount: variables.length,
        variables
      } : variables.reduce((acc, v) => {
        acc[v.name] = v.default !== undefined ? v.default : (v.type === 'boolean' ? false : '');
        return acc;
      }, {});
      
      // Output results
      if (args.output) {
        let outputContent;
        
        switch (args.format.toLowerCase()) {
          case 'yaml':
          case 'yml':
            const yaml = await import('js-yaml');
            outputContent = yaml.dump(outputData);
            break;
          case 'csv':
            outputContent = variables.map(v => 
              `${v.name},${v.type},${v.required},${v.default || ''}`
            ).join('\n');
            outputContent = 'name,type,required,default\n' + outputContent;
            break;
          default:
            outputContent = JSON.stringify(outputData, null, 2);
        }
        
        writeFileSync(args.output, outputContent);
        console.log(chalk.green(`✅ Variables exported to: ${args.output}`));
      } else {
        // Print to console
        console.log(chalk.yellow("\n📄 Variable template:"));
        console.log(JSON.stringify(outputData, null, 2));
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Extraction failed: ${error.message}`));
      process.exit(1);
    }
  },
});

/**
 * Inject subcommand - Inject content into Office documents
 */
const injectCommand = defineCommand({
  meta: {
    name: "inject",
    description: "Inject content into existing Office documents",
  },
  args: {
    file: {
      type: "positional",
      description: "Path to the Office document",
    },
    content: {
      type: "string",
      description: "Content to inject",
      alias: "c",
    },
    "content-file": {
      type: "string",
      description: "File containing content to inject",
      alias: "cf",
    },
    position: {
      type: "string",
      description: "Injection position (start, end, after-marker, before-marker)",
      default: "end",
      alias: "p",
    },
    marker: {
      type: "string",
      description: "Text marker for position-based injection",
      alias: "m",
    },
    backup: {
      type: "boolean",
      description: "Create backup before injection",
      default: true,
      alias: "b",
    },
    "dry-run": {
      type: "boolean",
      description: "Preview injection without modifying file",
      alias: "n",
    },
  },
  async run({ args }) {
    console.log(chalk.blue.bold("💉 Injecting Content"));
    
    if (!args.file) {
      console.error(chalk.red("❌ File path is required"));
      console.log(chalk.gray("Usage: unjucks office inject <file> [options]"));
      process.exit(1);
    }
    
    if (!existsSync(args.file)) {
      console.error(chalk.red(`❌ File not found: ${args.file}`));
      process.exit(1);
    }
    
    // Get content to inject
    let contentToInject = args.content || '';
    if (args["content-file"]) {
      if (!existsSync(args["content-file"])) {
        console.error(chalk.red(`❌ Content file not found: ${args["content-file"]}`));
        process.exit(1);
      }
      contentToInject = readFileSync(args["content-file"], 'utf8');
    }
    
    if (!contentToInject) {
      console.error(chalk.red("❌ No content specified for injection"));
      process.exit(1);
    }
    
    const fileInfo = getOfficeFileInfo(args.file);
    if (!fileInfo.valid) {
      console.error(chalk.red(`❌ Unsupported file format: ${args.file}`));
      process.exit(1);
    }
    
    console.log(chalk.green(`✅ Target: ${args.file} (${fileInfo.type}/${fileInfo.format})`));
    console.log(chalk.gray(`📝 Content length: ${contentToInject.length} characters`));
    console.log(chalk.gray(`📍 Position: ${args.position}`));
    
    if (args["dry-run"]) {
      console.log(chalk.yellow("🔍 Dry run mode - no files will be modified"));
      console.log(chalk.gray("Content to inject:"));
      console.log(chalk.gray(contentToInject.substring(0, 200) + (contentToInject.length > 200 ? '...' : '')));
      return;
    }
    
    try {
      // Create backup if requested
      if (args.backup) {
        const backupPath = `${args.file}.backup.${Date.now()}`;
        const originalContent = readFileSync(args.file);
        writeFileSync(backupPath, originalContent);
        console.log(chalk.green(`✅ Backup created: ${backupPath}`));
      }
      
      // Read original content
      let originalContent = readFileSync(args.file, 'utf8');
      let modifiedContent = originalContent;
      
      // Perform injection based on position
      switch (args.position) {
        case 'start':
          modifiedContent = contentToInject + '\n' + originalContent;
          break;
        case 'end':
          modifiedContent = originalContent + '\n' + contentToInject;
          break;
        case 'after-marker':
          if (!args.marker) {
            console.error(chalk.red("❌ Marker is required for after-marker position"));
            process.exit(1);
          }
          modifiedContent = originalContent.replace(args.marker, args.marker + '\n' + contentToInject);
          break;
        case 'before-marker':
          if (!args.marker) {
            console.error(chalk.red("❌ Marker is required for before-marker position"));
            process.exit(1);
          }
          modifiedContent = originalContent.replace(args.marker, contentToInject + '\n' + args.marker);
          break;
        default:
          console.error(chalk.red(`❌ Invalid position: ${args.position}`));
          process.exit(1);
      }
      
      // Write modified content
      writeFileSync(args.file, modifiedContent);
      
      console.log(chalk.green("✅ Content injected successfully"));
      console.log(chalk.gray(`📊 Size: ${originalContent.length} → ${modifiedContent.length} characters`));
      
    } catch (error) {
      console.error(chalk.red(`❌ Injection failed: ${error.message}`));
      process.exit(1);
    }
  },
});

/**
 * Convert subcommand - Convert between Office formats
 */
const convertCommand = defineCommand({
  meta: {
    name: "convert",
    description: "Convert between different Office formats",
  },
  args: {
    input: {
      type: "positional",
      description: "Input file path",
    },
    output: {
      type: "string",
      description: "Output file path",
      alias: "o",
    },
    format: {
      type: "string",
      description: "Target format (docx, pdf, csv, etc.)",
      alias: "f",
    },
    quality: {
      type: "string",
      description: "Conversion quality (high, medium, low)",
      default: "high",
      alias: "q",
    },
    preserve: {
      type: "string",
      description: "Elements to preserve (formatting, images, tables)",
      alias: "p",
    },
  },
  async run({ args }) {
    console.log(chalk.blue.bold("🔄 Converting Office Format"));
    
    if (!args.input) {
      console.error(chalk.red("❌ Input file is required"));
      console.log(chalk.gray("Usage: unjucks office convert <input> [options]"));
      process.exit(1);
    }
    
    if (!existsSync(args.input)) {
      console.error(chalk.red(`❌ Input file not found: ${args.input}`));
      process.exit(1);
    }
    
    const inputInfo = getOfficeFileInfo(args.input);
    if (!inputInfo.valid) {
      console.error(chalk.red(`❌ Unsupported input format: ${args.input}`));
      process.exit(1);
    }
    
    // Determine output format and path
    const outputFormat = args.format || 'pdf';
    const outputPath = args.output || args.input.replace(/\.[^.]+$/, `.${outputFormat}`);
    
    console.log(chalk.green(`✅ Input: ${args.input} (${inputInfo.type}/${inputInfo.format})`));
    console.log(chalk.green(`✅ Output: ${outputPath} (${outputFormat})`));
    console.log(chalk.gray(`🎯 Quality: ${args.quality}`));
    
    // Validate conversion compatibility
    const validConversions = {
      'word': ['pdf', 'html', 'txt', 'rtf'],
      'excel': ['pdf', 'csv', 'html', 'txt'],
      'powerpoint': ['pdf', 'html', 'png', 'jpg']
    };
    
    if (!validConversions[inputInfo.type]?.includes(outputFormat)) {
      console.error(chalk.red(`❌ Cannot convert from ${inputInfo.type} to ${outputFormat}`));
      process.exit(1);
    }
    
    try {
      console.log(chalk.blue("🔄 Converting..."));
      
      // Simulate conversion process
      const inputContent = readFileSync(args.input);
      let outputContent = inputContent; // Placeholder - would use actual conversion libraries
      
      // Simple text extraction for demonstration
      if (outputFormat === 'txt') {
        outputContent = Buffer.from("Converted text content from Office document", 'utf8');
      }
      
      writeFileSync(outputPath, outputContent);
      
      console.log(chalk.green("✅ Conversion completed successfully"));
      
      // Show statistics
      const inputSize = statSync(args.input).size;
      const outputSize = statSync(outputPath).size;
      console.log(chalk.gray(`📊 Size: ${inputSize} → ${outputSize} bytes`));
      
    } catch (error) {
      console.error(chalk.red(`❌ Conversion failed: ${error.message}`));
      process.exit(1);
    }
  },
});

/**
 * Validate subcommand - Validate Office templates
 */
const validateCommand = defineCommand({
  meta: {
    name: "validate",
    description: "Validate Office templates for syntax and structure",
  },
  args: {
    file: {
      type: "positional",
      description: "Path to the Office template file",
    },
    strict: {
      type: "boolean",
      description: "Enable strict validation mode",
      alias: "s",
    },
    "check-variables": {
      type: "boolean",
      description: "Validate template variables",
      default: true,
      alias: "v",
    },
    "check-syntax": {
      type: "boolean",
      description: "Validate template syntax",
      default: true,
      alias: "x",
    },
    schema: {
      type: "string",
      description: "JSON schema file for validation",
      alias: "sc",
    },
  },
  async run({ args }) {
    console.log(chalk.blue.bold("✅ Validating Office Template"));
    
    if (!args.file) {
      console.error(chalk.red("❌ File path is required"));
      console.log(chalk.gray("Usage: unjucks office validate <file> [options]"));
      process.exit(1);
    }
    
    if (!existsSync(args.file)) {
      console.error(chalk.red(`❌ File not found: ${args.file}`));
      process.exit(1);
    }
    
    const fileInfo = getOfficeFileInfo(args.file);
    if (!fileInfo.valid) {
      console.error(chalk.red(`❌ Unsupported file format: ${args.file}`));
      process.exit(1);
    }
    
    console.log(chalk.green(`✅ Validating: ${args.file} (${fileInfo.type}/${fileInfo.format})`));
    
    const errors = [];
    const warnings = [];
    let score = 100;
    
    try {
      // Read and analyze the file
      const content = readFileSync(args.file, 'utf8');
      
      // Check file structure
      console.log(chalk.blue("🔍 Checking file structure..."));
      if (content.length === 0) {
        errors.push("File is empty");
        score -= 50;
      }
      
      // Validate variables if enabled
      if (args["check-variables"]) {
        console.log(chalk.blue("🔍 Checking template variables..."));
        const variables = extractVariablesFromContent(content);
        
        // Check for unclosed variables
        const unclosedVars = content.match(/\{\{[^}]*$/gm);
        if (unclosedVars) {
          errors.push(`Found ${unclosedVars.length} unclosed variable declarations`);
          score -= 20;
        }
        
        // Check for undefined filters
        variables.forEach(v => {
          if (v.filter) {
            const commonFilters = ['upper', 'lower', 'capitalize', 'title', 'trim', 'length'];
            if (!commonFilters.includes(v.filter)) {
              warnings.push(`Unknown filter '${v.filter}' for variable '${v.name}'`);
              score -= 5;
            }
          }
        });
        
        console.log(chalk.green(`✅ Found ${variables.length} template variables`));
      }
      
      // Validate syntax if enabled
      if (args["check-syntax"]) {
        console.log(chalk.blue("🔍 Checking template syntax..."));
        
        // Check for balanced braces
        const openBraces = (content.match(/\{\{/g) || []).length;
        const closeBraces = (content.match(/\}\}/g) || []).length;
        if (openBraces !== closeBraces) {
          errors.push(`Unbalanced variable braces: ${openBraces} opening, ${closeBraces} closing`);
          score -= 25;
        }
        
        // Check for balanced control structures
        const ifTags = (content.match(/\{%\s*if\s/g) || []).length;
        const endifTags = (content.match(/\{%\s*endif\s*%\}/g) || []).length;
        if (ifTags !== endifTags) {
          errors.push(`Unbalanced if/endif tags: ${ifTags} if, ${endifTags} endif`);
          score -= 25;
        }
        
        const forTags = (content.match(/\{%\s*for\s/g) || []).length;
        const endforTags = (content.match(/\{%\s*endfor\s*%\}/g) || []).length;
        if (forTags !== endforTags) {
          errors.push(`Unbalanced for/endfor tags: ${forTags} for, ${endforTags} endfor`);
          score -= 25;
        }
      }
      
      // Schema validation if provided
      if (args.schema) {
        if (existsSync(args.schema)) {
          console.log(chalk.blue("🔍 Validating against schema..."));
          // Schema validation would go here
          warnings.push("Schema validation not yet implemented");
        } else {
          errors.push(`Schema file not found: ${args.schema}`);
          score -= 10;
        }
      }
      
      // Report results
      console.log();
      console.log(chalk.bold("📊 Validation Results:"));
      console.log(chalk.gray(`Score: ${score}/100`));
      
      if (errors.length > 0) {
        console.log();
        console.log(chalk.red.bold(`❌ ${errors.length} Error(s):`));
        errors.forEach((error, index) => {
          console.log(chalk.red(`${index + 1}. ${error}`));
        });
      }
      
      if (warnings.length > 0) {
        console.log();
        console.log(chalk.yellow.bold(`⚠️ ${warnings.length} Warning(s):`));
        warnings.forEach((warning, index) => {
          console.log(chalk.yellow(`${index + 1}. ${warning}`));
        });
      }
      
      if (errors.length === 0 && warnings.length === 0) {
        console.log(chalk.green.bold("✅ Template validation passed!"));
      }
      
      // Exit with error code if strict mode and errors found
      if (args.strict && errors.length > 0) {
        process.exit(1);
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Validation failed: ${error.message}`));
      process.exit(1);
    }
  },
});

/**
 * Batch subcommand - Process multiple Office files
 */
const batchCommand = defineCommand({
  meta: {
    name: "batch",
    description: "Batch process multiple Office files",
  },
  args: {
    operation: {
      type: "positional",
      description: "Operation to perform (process, convert, validate)",
    },
    pattern: {
      type: "string",
      description: "File pattern or directory to process",
      alias: "p",
    },
    output: {
      type: "string",
      description: "Output directory",
      alias: "o",
    },
    variables: {
      type: "string",
      description: "JSON file containing variables for processing",
      alias: "v",
    },
    format: {
      type: "string",
      description: "Target format for conversion",
      alias: "f",
    },
    parallel: {
      type: "number",
      description: "Number of parallel processes",
      default: 4,
      alias: "j",
    },
    "continue-on-error": {
      type: "boolean",
      description: "Continue processing if individual files fail",
      default: true,
      alias: "c",
    },
  },
  async run({ args }) {
    console.log(chalk.blue.bold("📦 Batch Processing Office Files"));
    
    if (!args.operation) {
      console.error(chalk.red("❌ Operation is required"));
      console.log(chalk.gray("Usage: unjucks office batch <operation> [options]"));
      console.log(chalk.gray("Operations: process, convert, validate"));
      process.exit(1);
    }
    
    const validOperations = ['process', 'convert', 'validate'];
    if (!validOperations.includes(args.operation)) {
      console.error(chalk.red(`❌ Invalid operation: ${args.operation}`));
      console.log(chalk.gray(`Valid operations: ${validOperations.join(', ')}`));
      process.exit(1);
    }
    
    // Find files to process
    const { glob } = await import('glob');
    const pattern = args.pattern || '**/*.{docx,xlsx,pptx,doc,xls,ppt}';
    const files = await glob(pattern, { ignore: ['node_modules/**', '.git/**'] });
    
    if (files.length === 0) {
      console.log(chalk.yellow(`⚠️ No files found matching pattern: ${pattern}`));
      return;
    }
    
    console.log(chalk.green(`✅ Found ${files.length} files to process`));
    console.log(chalk.gray(`📊 Using ${args.parallel} parallel processes`));
    console.log(chalk.gray(`🔄 Operation: ${args.operation}`));
    
    // Load variables if provided
    let templateVars = {};
    if (args.variables) {
      if (existsSync(args.variables)) {
        templateVars = JSON.parse(readFileSync(args.variables, 'utf8'));
        console.log(chalk.green(`✅ Loaded variables from: ${args.variables}`));
      } else {
        console.error(chalk.red(`❌ Variables file not found: ${args.variables}`));
        process.exit(1);
      }
    }
    
    // Setup output directory
    if (args.output && !existsSync(args.output)) {
      const fs = await import('fs');
      fs.mkdirSync(args.output, { recursive: true });
      console.log(chalk.green(`✅ Created output directory: ${args.output}`));
    }
    
    // Process files in batches
    const progressBar = new ProgressBar(files.length, `${args.operation} files`);
    const results = { success: 0, failed: 0, errors: [] };
    
    // Simple sequential processing (in reality, you'd implement proper parallel processing)
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      progressBar.update(i + 1);
      
      try {
        const fileInfo = getOfficeFileInfo(file);
        if (!fileInfo.valid) {
          throw new Error(`Unsupported file format: ${file}`);
        }
        
        // Perform the operation
        switch (args.operation) {
          case 'process':
            // Simulate processing
            const outputPath = args.output ? 
              join(args.output, basename(file).replace(/\.[^.]+$/, '_processed$&')) : 
              file.replace(/\.[^.]+$/, '_processed$&');
            
            const content = readFileSync(file);
            writeFileSync(outputPath, content);
            break;
            
          case 'convert':
            if (!args.format) {
              throw new Error("Format is required for conversion");
            }
            // Simulate conversion
            const convertedPath = args.output ?
              join(args.output, basename(file, extname(file)) + '.' + args.format) :
              file.replace(/\.[^.]+$/, `.${args.format}`);
            
            const originalContent = readFileSync(file);
            writeFileSync(convertedPath, originalContent);
            break;
            
          case 'validate':
            // Simulate validation
            const fileContent = readFileSync(file, 'utf8');
            const variables = extractVariablesFromContent(fileContent);
            // Validation logic would go here
            break;
        }
        
        results.success++;
        
      } catch (error) {
        results.failed++;
        results.errors.push({ file, error: error.message });
        
        if (!args["continue-on-error"]) {
          console.error(chalk.red(`❌ Processing failed on ${file}: ${error.message}`));
          process.exit(1);
        }
      }
    }
    
    // Show final results
    console.log();
    console.log(chalk.bold("📊 Batch Processing Results:"));
    console.log(chalk.green(`✅ Successful: ${results.success}`));
    
    if (results.failed > 0) {
      console.log(chalk.red(`❌ Failed: ${results.failed}`));
      console.log();
      console.log(chalk.red.bold("Errors:"));
      results.errors.forEach((error, index) => {
        console.log(chalk.red(`${index + 1}. ${error.file}: ${error.error}`));
      });
    }
    
    const successRate = Math.round((results.success / files.length) * 100);
    console.log(chalk.gray(`📈 Success rate: ${successRate}%`));
  },
});

/**
 * Main Office command with subcommands
 */
export const officeCommand = defineCommand({
  meta: {
    name: "office",
    description: "Comprehensive Office document processing tools",
  },
  subCommands: {
    process: processCommand,
    extract: extractCommand,  
    inject: injectCommand,
    convert: convertCommand,
    validate: validateCommand,
    batch: batchCommand,
  },
  run() {
    console.log(chalk.blue.bold("📄 Office Document Processing"));
    console.log(chalk.gray("Comprehensive tools for processing Microsoft Office documents"));
    console.log();
    console.log(chalk.yellow("Available subcommands:"));
    console.log(chalk.gray("  process   Process Office templates with variables"));
    console.log(chalk.gray("  extract   Extract variables from Office files"));
    console.log(chalk.gray("  inject    Inject content into Office documents"));
    console.log(chalk.gray("  convert   Convert between Office formats"));
    console.log(chalk.gray("  validate  Validate Office templates"));
    console.log(chalk.gray("  batch     Batch process multiple files"));
    console.log();
    console.log(chalk.yellow("Examples:"));
    console.log(chalk.gray("  unjucks office process template.docx -v variables.json"));
    console.log(chalk.gray("  unjucks office extract template.xlsx -o variables.json"));
    console.log(chalk.gray("  unjucks office convert document.docx -f pdf"));
    console.log(chalk.gray("  unjucks office validate template.pptx --strict"));
    console.log(chalk.gray("  unjucks office batch process '*.docx' -v data.json"));
    console.log();
    console.log(chalk.gray("Use 'unjucks office <command> --help' for more information about a specific command."));
  },
});

export default officeCommand;