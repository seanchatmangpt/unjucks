#!/usr/bin/env node

/**
 * Standalone Unjucks CLI - No external dependencies except Node.js builtins
 * Minimal CLI that works for basic operations
 */

import fs from 'fs-extra';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// Simple argument parser
function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = {
    command: '',
    positional: [],
    flags: {},
    help: false,
    version: false,
    dry: false,
    force: false,
    verbose: false,
    quiet: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--version' || arg === '-v') {
      parsed.version = true;
    } else if (arg === '--dry') {
      parsed.dry = true;
    } else if (arg === '--force') {
      parsed.force = true;
    } else if (arg === '--verbose') {
      parsed.verbose = true;
    } else if (arg === '--quiet' || arg === '-q') {
      parsed.quiet = true;
    } else if (arg.startsWith('--')) {
      // Parse --key=value or --key value
      const [key, value] = arg.slice(2).split('=');
      if (value !== undefined) {
        parsed.flags[key] = value;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        parsed.flags[key] = args[i + 1];
        i++; // Skip next arg as it's the value
      } else {
        parsed.flags[key] = true;
      }
    } else if (!parsed.command) {
      parsed.command = arg;
    } else {
      parsed.positional.push(arg);
    }
  }

  return parsed;
}

// Enhanced template processor with filters
function processTemplate(content, variables) {
  return content.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expression) => {
    const trimmed = expression.trim();
    
    // Handle pipes/filters (e.g., componentName | pascalCase)
    if (trimmed.includes('|')) {
      const [varName, ...filters] = trimmed.split('|').map(s => s.trim());
      let value = variables[varName];
      
      if (value !== undefined) {
        // Apply filters
        for (const filter of filters) {
          value = applyFilter(value, filter.trim());
        }
        return String(value);
      }
    } else {
      // Simple variable replacement
      const value = variables[trimmed];
      if (value !== undefined) {
        return String(value);
      }
    }
    
    return match; // Return original if can't process
  });
}

// Apply template filters
function applyFilter(value, filter) {
  const str = String(value);
  
  switch (filter) {
    case 'pascalCase':
      return str.replace(/(?:^|[-_\s])([a-z])/g, (match, letter) => letter.toUpperCase())
                .replace(/[-_\s]/g, '');
    
    case 'camelCase':
      const pascal = str.replace(/(?:^|[-_\s])([a-z])/g, (match, letter) => letter.toUpperCase())
                        .replace(/[-_\s]/g, '');
      return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    
    case 'kebabCase':
    case 'kebab-case':
      return str.replace(/([A-Z])/g, '-$1')
                .replace(/[-_\s]+/g, '-')
                .toLowerCase()
                .replace(/^-/, '');
    
    case 'snakeCase':
    case 'snake_case':
      return str.replace(/([A-Z])/g, '_$1')
                .replace(/[-\s]+/g, '_')
                .toLowerCase()
                .replace(/^_/, '');
    
    case 'upperCase':
    case 'upper':
      return str.toUpperCase();
    
    case 'lowerCase':
    case 'lower':
      return str.toLowerCase();
    
    case 'capitalize':
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    
    default:
      return str;
  }
}

// Parse frontmatter
function parseFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  
  if (!frontmatterMatch) {
    return { frontmatter: {}, content };
  }

  const [, yamlContent, templateContent] = frontmatterMatch;
  const frontmatter = {};
  
  // Simple YAML parser for basic key: value pairs
  yamlContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim();
        // Remove quotes if present
        frontmatter[key.trim()] = value.replace(/^["']|["']$/g, '');
      }
    }
  });

  return { frontmatter, content: templateContent };
}

// Get version
function getVersion() {
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.version || '2025.9.8';
  } catch (error) {
    return '2025.9.8';
  }
}

// Simple logger with colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function colorize(text, color) {
  if (process.stdout.isTTY) {
    return `${colors[color]}${text}${colors.reset}`;
  }
  return text;
}

// Coordination hooks integration
async function runHook(hookName, params = {}) {
  try {
    const hookCommands = {
      'pre-task': `npx claude-flow@alpha hooks pre-task --description "${params.description || 'CLI task'}"`,
      'post-task': `npx claude-flow@alpha hooks post-task --task-id "${params.taskId || 'cli-task'}"`,
      'post-edit': `npx claude-flow@alpha hooks post-edit --file "${params.file}" --memory-key "${params.memoryKey || 'cli/edit'}"`,
      'notify': `npx claude-flow@alpha hooks notify --message "${params.message}"`
    };

    const command = hookCommands[hookName];
    if (command) {
      await execAsync(command);
    }
  } catch (error) {
    // Silently ignore hook failures - they're optional
  }
}

// List generators
async function listGenerators() {
  const templatesDir = '_templates';
  const generators = [];

  try {
    if (!await fs.pathExists(templatesDir)) {
      return generators;
    }

    const items = await fs.readdir(templatesDir, { withFileTypes: true });
    
    for (const item of items) {
      if (item.isDirectory()) {
        const generatorPath = path.join(templatesDir, item.name);
        const templates = await listTemplates(item.name);
        
        generators.push({
          name: item.name,
          description: `Generator for ${item.name}`,
          templates: templates.length
        });
      }
    }
  } catch (error) {
    // Ignore errors, return empty list
  }

  return generators;
}

// List templates for a generator
async function listTemplates(generatorName) {
  const templatesDir = '_templates';
  const generatorPath = path.join(templatesDir, generatorName);
  const templates = [];

  try {
    if (!await fs.pathExists(generatorPath)) {
      return templates;
    }

    const items = await fs.readdir(generatorPath, { withFileTypes: true });
    
    for (const item of items) {
      if (item.isFile() && (item.name.endsWith('.njk') || item.name.endsWith('.ejs'))) {
        const templateName = item.name.replace(/\.(njk|ejs)$/, '');
        templates.push({
          name: templateName,
          description: `Template: ${templateName}`
        });
      } else if (item.isDirectory()) {
        // Check if directory contains template files
        const templateDir = path.join(generatorPath, item.name);
        const hasTemplates = await hasTemplateFiles(templateDir);
        if (hasTemplates) {
          templates.push({
            name: item.name,
            description: `Template: ${item.name}`
          });
        }
      }
    }
  } catch (error) {
    // Ignore errors, return empty list
  }

  return templates;
}

// Check if directory has template files
async function hasTemplateFiles(dirPath) {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    return items.some(item => 
      item.isFile() && (item.name.endsWith('.njk') || item.name.endsWith('.ejs'))
    );
  } catch (error) {
    return false;
  }
}

// Generate from template
async function generate(generatorName, templateName, variables, options = {}) {
  const { dry = false, force = false, dest = '.' } = options;
  const templatesDir = '_templates';
  
  // Find template file or directory
  const templatePaths = [
    path.join(templatesDir, generatorName, templateName + '.njk'),
    path.join(templatesDir, generatorName, templateName + '.ejs'),
    path.join(templatesDir, generatorName, templateName, 'index.njk'),
    path.join(templatesDir, generatorName, templateName, 'index.ejs'),
    path.join(templatesDir, generatorName, templateName) // Directory
  ];

  let templatePath = null;
  let isDirectory = false;
  
  for (const tryPath of templatePaths) {
    if (await fs.pathExists(tryPath)) {
      const stat = await fs.stat(tryPath);
      if (stat.isFile()) {
        templatePath = tryPath;
        break;
      } else if (stat.isDirectory()) {
        templatePath = tryPath;
        isDirectory = true;
        break;
      }
    }
  }

  if (!templatePath) {
    throw new Error(`Template not found: ${generatorName}/${templateName}`);
  }

  // Handle directory-based templates (find first .njk or .ejs file)
  if (isDirectory) {
    const files = await fs.readdir(templatePath);
    const templateFile = files.find(f => f.endsWith('.njk') || f.endsWith('.ejs'));
    if (templateFile) {
      templatePath = path.join(templatePath, templateFile);
    } else {
      throw new Error(`No template files found in directory: ${templatePath}`);
    }
  }

  // Read and process template
  const templateContent = await fs.readFile(templatePath, 'utf8');
  const { frontmatter, content } = parseFrontmatter(templateContent);
  
  // Process template content
  const processedContent = processTemplate(content, variables);
  
  // Determine output path
  let outputPath;
  if (frontmatter.to) {
    outputPath = processTemplate(frontmatter.to, variables);
  } else {
    outputPath = `${templateName}.js`; // Default output
  }

  const fullOutputPath = path.resolve(dest, outputPath);
  const outputDir = path.dirname(fullOutputPath);

  // Check if file exists
  const exists = await fs.pathExists(fullOutputPath);
  
  if (exists && !force && !dry) {
    throw new Error(`File exists: ${fullOutputPath} (use --force to overwrite)`);
  }

  // Create output in dry run or real mode
  if (!dry) {
    await fs.ensureDir(outputDir);
    await fs.writeFile(fullOutputPath, processedContent);
  }

  return {
    success: true,
    outputPath: fullOutputPath,
    exists,
    size: processedContent.length
  };
}

// Command handlers
async function handleList(args) {
  const { positional, quiet } = args;
  const generatorName = positional[0];

  if (generatorName) {
    // List templates for specific generator
    const templates = await listTemplates(generatorName);
    
    if (templates.length === 0) {
      console.error(colorize(`❌ No templates found for generator: ${generatorName}`, 'red'));
      return { success: false };
    }

    if (!quiet) {
      console.log(colorize(`\n📋 Templates for ${generatorName}:`, 'cyan'));
    }
    
    templates.forEach(template => {
      console.log(`  ${colorize(template.name, 'green')} - ${template.description}`);
    });
  } else {
    // List all generators
    const generators = await listGenerators();
    
    if (generators.length === 0) {
      console.log(colorize('No generators found', 'yellow'));
      return { success: true };
    }

    if (!quiet) {
      console.log(colorize(`\n📚 Found ${generators.length} generators:`, 'cyan'));
    }
    
    generators.forEach(gen => {
      console.log(`  ${colorize(gen.name, 'green')} - ${gen.description} (${gen.templates} templates)`);
    });
  }

  return { success: true };
}

async function handleGenerate(args) {
  const { positional, flags, dry, force, verbose, quiet } = args;
  const [generatorName, templateName, name] = positional;
  
  // Run coordination hook before task
  await runHook('pre-task', { 
    description: `Generate ${generatorName}/${templateName}` 
  });

  if (!generatorName) {
    console.error(colorize('❌ Generator name required', 'red'));
    console.log(colorize('\n💡 Usage: unjucks generate <generator> <template> [name]', 'blue'));
    return { success: false };
  }

  if (!templateName) {
    console.error(colorize('❌ Template name required', 'red'));
    console.log(colorize('\n💡 Usage: unjucks generate <generator> <template> [name]', 'blue'));
    return { success: false };
  }

  // Prepare variables with common mappings
  const variables = {
    name: name || flags.name || 'DefaultName',
    componentName: name || flags.name || flags.componentName || 'DefaultName',
    entityName: name || flags.name || flags.entityName || 'DefaultName',
    serviceName: name || flags.name || flags.serviceName || 'DefaultName',
    ...flags
  };

  if (!quiet) {
    console.log(colorize('🎯 Unjucks Generate', 'blue'));
    console.log(colorize(`🚀 Generating ${generatorName}/${templateName}`, 'green'));
    
    if (verbose) {
      console.log(colorize('Variables:', 'gray'), variables);
    }
  }

  try {
    const result = await generate(generatorName, templateName, variables, {
      dry,
      force,
      dest: flags.dest || '.'
    });

    if (dry) {
      console.log(colorize('\n🔍 Dry Run Results:', 'yellow'));
      console.log(colorize(`Would create: ${result.outputPath}`, 'green'));
    } else {
      console.log(colorize(`\n✅ Generated: ${result.outputPath}`, 'green'));
      if (verbose) {
        console.log(colorize(`Size: ${result.size} bytes`, 'gray'));
      }
      
      // Run coordination hook after file generation
      await runHook('post-edit', { 
        file: result.outputPath,
        memoryKey: `cli/generate/${generatorName}/${templateName}`
      });
    }

    // Run coordination hook after task completion
    await runHook('post-task', { 
      taskId: `generate-${generatorName}-${templateName}` 
    });

    return { success: true };
  } catch (error) {
    console.error(colorize(`❌ Generation failed: ${error.message}`, 'red'));
    return { success: false };
  }
}

function handleHelp() {
  console.log(colorize('🌆 Unjucks CLI', 'blue'));
  console.log('A simple template generator for scaffolding projects');
  console.log();
  console.log(colorize('Usage:', 'yellow'));
  console.log('  unjucks <generator> <template> [name]     # Generate from template');
  console.log('  unjucks generate <generator> <template>   # Explicit generate');
  console.log('  unjucks list [generator]                  # List generators/templates');
  console.log();
  console.log(colorize('Commands:', 'yellow'));
  console.log('  generate   Generate files from templates');
  console.log('  list       List available generators and templates');
  console.log('  help       Show this help message');
  console.log('  version    Show version information');
  console.log();
  console.log(colorize('Options:', 'yellow'));
  console.log('  --dry      Preview without creating files');
  console.log('  --force    Overwrite existing files');
  console.log('  --verbose  Show detailed output');
  console.log('  --quiet    Suppress non-essential output');
  console.log('  --help     Show help information');
  console.log('  --version  Show version');
  console.log();
  console.log(colorize('Examples:', 'yellow'));
  console.log('  unjucks component react Button');
  console.log('  unjucks generate api endpoint --name user');
  console.log('  unjucks list');
  console.log('  unjucks list component');

  return { success: true };
}

function handleVersion() {
  console.log(getVersion());
  return { success: true };
}

// Main CLI function
async function main() {
  const args = parseArgs(process.argv);
  
  // Handle help and version flags
  if (args.help) {
    return handleHelp();
  }
  
  if (args.version) {
    return handleVersion();
  }

  // Handle commands
  switch (args.command) {
    case 'list':
      return handleList(args);
      
    case 'generate':
      return handleGenerate(args);
      
    case 'help':
      return handleHelp();
      
    case 'version':
      return handleVersion();
      
    case '':
      // No command - handle Hygen-style positional syntax
      if (args.positional.length >= 2) {
        // Transform to generate command
        const [generator, template, ...rest] = args.positional;
        const generateArgs = {
          ...args,
          command: 'generate',
          positional: [generator, template, ...rest]
        };
        return handleGenerate(generateArgs);
      } else {
        return handleHelp();
      }
      
    default:
      // Unknown command - treat as Hygen-style if 2+ args
      if (args.positional.length >= 1) {
        const generateArgs = {
          ...args,
          command: 'generate',
          positional: [args.command, ...args.positional]
        };
        return handleGenerate(generateArgs);
      } else {
        console.error(colorize(`❌ Unknown command: ${args.command}`, 'red'));
        console.log(colorize('\n💡 Available commands: generate, list, help, version', 'blue'));
        return { success: false };
      }
  }
}

// Run CLI if this is the main module
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('index-standalone.js')) {
  main().then(result => {
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error(colorize(`❌ CLI Error: ${error.message}`, 'red'));
    process.exit(1);
  });
}

// Export for use as module
export { main as runMain };