/**
 * DOCX Export CLI Command
 * Command-line interface for Microsoft Word document generation
 */

import { promises as fs } from 'fs';
import path from 'path';
import { defineCommand } from 'citty';
import consola from 'consola';
import { DocxExporter } from '../../lib/export/docx-exporter.js';
import { TemplateDocxGenerator } from '../../lib/export/template-docx-generator.js';
import { PandocIntegration } from '../../lib/export/pandoc-integration.js';

export default defineCommand({
  meta: {
    name: 'export-docx',
    description: 'Export content to Microsoft Word (DOCX) format'
  },
  args: {
    input: {
      type: 'string',
      description: 'Input file or content',
      required: false
    },
    template: {
      type: 'string',
      description: 'Template name to use for generation',
      alias: 't'
    },
    output: {
      type: 'string', 
      description: 'Output file name (without extension)',
      alias: 'o',
      default: 'document'
    },
    format: {
      type: 'string',
      description: 'Input format (html, latex, markdown, nunjucks, structured)',
      alias: 'f',
      default: 'auto'
    },
    theme: {
      type: 'string',
      description: 'Document theme (professional, academic, legal, modern)',
      default: 'professional'
    },
    data: {
      type: 'string',
      description: 'JSON data file for template variables',
      alias: 'd'
    },
    'template-dir': {
      type: 'string',
      description: 'Directory containing DOCX templates',
      default: './templates/docx'
    },
    'output-dir': {
      type: 'string',
      description: 'Output directory for generated documents',
      default: './output'
    },
    'use-pandoc': {
      type: 'boolean',
      description: 'Use Pandoc for conversion (when available)',
      default: true
    },
    'dry-run': {
      type: 'boolean',
      description: 'Show what would be generated without creating files'
    },
    batch: {
      type: 'string',
      description: 'JSON file with batch export configuration'
    },
    list: {
      type: 'boolean',
      description: 'List available templates'
    },
    validate: {
      type: 'string',
      description: 'Validate a template file'
    },
    verbose: {
      type: 'boolean',
      description: 'Show detailed output',
      alias: 'v'
    }
  },
  async run({ args }) {
    try {
      // Handle list templates command
      if (args.list) {
        return await listTemplates(args);
      }

      // Handle template validation
      if (args.validate) {
        return await validateTemplate(args.validate, args);
      }

      // Handle batch export
      if (args.batch) {
        return await batchExport(args.batch, args);
      }

      // Single document export
      return await exportDocument(args);
    } catch (error) {
      consola.error('DOCX export failed:', error.message);
      if (args.verbose) {
        consola.error(error.stack);
      }
      process.exit(1);
    }
  }
});

/**
 * Export a single document
 */
async function exportDocument(args) {
  consola.start(`Exporting to DOCX: ${args.output}`);

  // Initialize appropriate exporter
  let exporter;
  let templateData = {};

  if (args.template) {
    // Template-based generation
    exporter = new TemplateDocxGenerator({
      outputDir: args['output-dir'],
      templateDir: args['template-dir'],
      enablePandoc: args['use-pandoc']
    });
    
    await exporter.initialize();

    // Load template data if provided
    if (args.data) {
      const dataContent = await fs.readFile(args.data, 'utf8');
      templateData = JSON.parse(dataContent);
    }

    // Extract additional data from CLI args
    if (args.input && !templateData.content) {
      if (await fileExists(args.input)) {
        templateData.content = await fs.readFile(args.input, 'utf8');
      } else {
        templateData.content = args.input;
      }
    }

    if (args.verbose) {
      consola.info('Using template:', args.template);
      consola.info('Template data keys:', Object.keys(templateData));
    }

    if (args['dry-run']) {
      consola.info('DRY RUN - Would generate DOCX using template:', args.template);
      consola.info('Output file:', `${args.output}.docx`);
      return;
    }

    const result = await exporter.generateFromTemplate(args.template, templateData, {
      filename: args.output,
      theme: args.theme
    });

    if (result.success) {
      consola.success(`DOCX exported successfully: ${result.outputFile}`);
      consola.info(`File size: ${formatFileSize(result.size)}`);
    } else {
      throw new Error(result.error);
    }
  } else {
    // Direct content export
    exporter = new DocxExporter({
      outputDir: args['output-dir'],
      enablePandoc: args['use-pandoc']
    });
    
    await exporter.initialize();

    // Get input content
    let content;
    if (args.input) {
      if (await fileExists(args.input)) {
        content = await fs.readFile(args.input, 'utf8');
        
        // Auto-detect format if not specified
        if (args.format === 'auto') {
          args.format = detectFormat(args.input, content);
        }
      } else {
        content = args.input;
      }
    } else {
      // Read from stdin
      content = await readStdin();
      if (args.format === 'auto') {
        args.format = detectFormat('stdin', content);
      }
    }

    if (args.verbose) {
      consola.info('Input format detected:', args.format);
      consola.info('Content length:', content.length, 'characters');
    }

    if (args['dry-run']) {
      consola.info('DRY RUN - Would generate DOCX from:', args.format, 'content');
      consola.info('Output file:', `${args.output}.docx`);
      return;
    }

    const result = await exporter.export(content, {
      filename: args.output,
      format: args.format,
      theme: args.theme
    });

    if (result.success) {
      consola.success(`DOCX exported successfully: ${result.outputPath}`);
      consola.info(`File size: ${formatFileSize(result.size)}`);
      consola.info(`Export method: ${result.method}`);
    } else {
      throw new Error(result.error);
    }
  }

  if (exporter && exporter.cleanup) {
    await exporter.cleanup();
  }
}

/**
 * List available templates
 */
async function listTemplates(args) {
  consola.info('Available DOCX templates:');
  
  const generator = new TemplateDocxGenerator({
    templateDir: args['template-dir']
  });
  
  try {
    await generator.initialize();
    const templates = await generator.listTemplates();
    
    if (templates.length === 0) {
      consola.warn('No templates found in:', args['template-dir']);
      return;
    }

    for (const templateName of templates) {
      const metadata = await generator.getTemplateMetadata(templateName);
      
      consola.info(`\n📄 ${templateName}`);
      if (metadata.description) {
        consola.info(`   ${metadata.description}`);
      }
      if (metadata.category) {
        consola.info(`   Category: ${metadata.category}`);
      }
      if (metadata.variables) {
        const varNames = Object.keys(metadata.variables);
        if (varNames.length > 0) {
          consola.info(`   Variables: ${varNames.join(', ')}`);
        }
      }
    }
  } catch (error) {
    consola.error('Failed to list templates:', error.message);
  }
}

/**
 * Validate a template
 */
async function validateTemplate(templateName, args) {
  consola.start(`Validating template: ${templateName}`);

  const generator = new TemplateDocxGenerator({
    templateDir: args['template-dir']
  });

  try {
    await generator.initialize();
    const validation = await generator.validateTemplate(templateName);

    if (validation.valid) {
      consola.success(`Template '${templateName}' is valid`);
      
      // Show metadata if available
      const metadata = await generator.getTemplateMetadata(templateName);
      if (Object.keys(metadata).length > 0) {
        consola.info('Template metadata:', metadata);
      }
    } else {
      consola.error(`Template '${templateName}' is invalid:`);
      consola.error(`Error: ${validation.error}`);
      if (validation.line) {
        consola.error(`Line: ${validation.line}, Column: ${validation.column}`);
      }
    }
  } catch (error) {
    consola.error('Validation failed:', error.message);
  }
}

/**
 * Batch export from configuration file
 */
async function batchExport(configFile, args) {
  consola.start(`Running batch export from: ${configFile}`);

  try {
    const configContent = await fs.readFile(configFile, 'utf8');
    const config = JSON.parse(configContent);

    const exporter = new DocxExporter({
      outputDir: args['output-dir'],
      enablePandoc: args['use-pandoc']
    });
    await exporter.initialize();

    const documents = config.documents || [];
    consola.info(`Processing ${documents.length} documents...`);

    const results = await exporter.exportBatch(documents, {
      concurrency: config.concurrency || 3
    });

    let successCount = 0;
    let errorCount = 0;

    results.forEach((result, index) => {
      if (result.success) {
        successCount++;
        if (args.verbose) {
          consola.success(`Document ${index + 1}: ${result.outputPath}`);
        }
      } else {
        errorCount++;
        consola.error(`Document ${index + 1} failed: ${result.error}`);
      }
    });

    consola.info(`\nBatch export completed:`);
    consola.info(`✓ Success: ${successCount}`);
    if (errorCount > 0) {
      consola.info(`✗ Errors: ${errorCount}`);
    }

    await exporter.cleanup();
  } catch (error) {
    consola.error('Batch export failed:', error.message);
    throw error;
  }
}

/**
 * Utility functions
 */

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readStdin() {
  const chunks = [];
  
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks).toString('utf8');
}

function detectFormat(filename, content) {
  // Detect by file extension first
  const ext = path.extname(filename).toLowerCase();
  
  if (ext === '.html' || ext === '.htm') return 'html';
  if (ext === '.tex' || ext === '.latex') return 'latex';  
  if (ext === '.md' || ext === '.markdown') return 'markdown';
  if (ext === '.njk' || ext === '.nunjucks') return 'nunjucks';
  if (ext === '.json') return 'structured';

  // Detect by content patterns
  if (content.includes('\\documentclass') || content.includes('\\begin{document}')) {
    return 'latex';
  }
  
  if (content.includes('<html>') || content.includes('<!DOCTYPE')) {
    return 'html';
  }
  
  if (content.match(/^#{1,6}\s/) || content.includes('**') || content.includes('*')) {
    return 'markdown';
  }
  
  try {
    JSON.parse(content);
    return 'structured';
  } catch {
    // Not JSON
  }
  
  if (content.includes('{{') && content.includes('}}')) {
    return 'nunjucks';
  }

  return 'text';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}