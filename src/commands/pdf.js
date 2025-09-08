/**
 * PDF Export Command for Unjucks CLI
 * Provides command-line interface for PDF generation
 */

import { defineCommand } from 'citty';
import consola from 'consola';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { glob } from 'glob';
// PDF exporter is optional - import dynamically when needed

export default defineCommand({
  meta: {
    name: 'pdf',
    description: 'Generate PDF documents from templates and content'
  },
  args: {
    input: {
      type: 'positional',
      description: 'Input file or directory',
      required: false
    },
    output: {
      type: 'string',
      description: 'Output file or directory',
      alias: 'o'
    },
    method: {
      type: 'string',
      description: 'PDF generation method (auto, latex, html, markdown, template, direct)',
      default: 'auto',
      alias: 'm'
    },
    format: {
      type: 'string',
      description: 'Page format (A4, Letter, A3, etc.)',
      default: 'A4',
      alias: 'f'
    },
    quality: {
      type: 'string',
      description: 'Output quality (low, medium, high)',
      default: 'high',
      alias: 'q'
    },
    engine: {
      type: 'string',
      description: 'LaTeX engine (pdflatex, xelatex, lualatex)',
      default: 'pdflatex'
    },
    compress: {
      type: 'boolean',
      description: 'Enable PDF compression',
      default: true
    },
    batch: {
      type: 'boolean',
      description: 'Process multiple files in batch mode',
      default: false,
      alias: 'b'
    },
    parallel: {
      type: 'number',
      description: 'Number of parallel jobs for batch processing',
      default: 4,
      alias: 'p'
    },
    watch: {
      type: 'boolean',
      description: 'Watch for file changes and regenerate',
      default: false,
      alias: 'w'
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose output',
      default: false,
      alias: 'v'
    },
    'dry-run': {
      type: 'boolean',
      description: 'Show what would be done without actually doing it',
      default: false
    },
    template: {
      type: 'string',
      description: 'Template file for Nunjucks rendering',
      alias: 't'
    },
    data: {
      type: 'string',
      description: 'JSON data file for template rendering',
      alias: 'd'
    },
    vars: {
      type: 'string',
      description: 'JSON string with template variables'
    },
    margins: {
      type: 'string',
      description: 'Page margins (e.g., "1in" or "20mm 15mm 20mm 15mm")',
      default: '1in'
    },
    'header-template': {
      type: 'string',
      description: 'HTML template for page header'
    },
    'footer-template': {
      type: 'string',
      description: 'HTML template for page footer'
    },
    landscape: {
      type: 'boolean',
      description: 'Use landscape orientation',
      default: false
    },
    'print-background': {
      type: 'boolean',
      description: 'Print background graphics (HTML/CSS)',
      default: true
    },
    'wait-for': {
      type: 'string',
      description: 'Wait for selector before generating PDF (HTML)'
    },
    timeout: {
      type: 'number',
      description: 'Timeout in milliseconds',
      default: 30000
    },
    'output-images': {
      type: 'boolean',
      description: 'Also generate preview images',
      default: false
    },
    'image-format': {
      type: 'string',
      description: 'Preview image format (png, jpg)',
      default: 'png'
    },
    'image-density': {
      type: 'number',
      description: 'Preview image DPI',
      default: 150
    }
  },
  async run({ args }) {
    const logger = consola.create({ tag: 'pdf-export' });

    try {
      // Validate arguments
      if (!args.input && !args.template) {
        logger.error('Either input file/directory or template must be specified');
        process.exit(1);
      }

      // Create PDF exporter - import dynamically
      let PDFExporter;
      try {
        const pdfModule = await import('../lib/export/pdf-exporter-working.js');
        PDFExporter = pdfModule.PDFExporter;
      } catch (importError) {
        logger.error(chalk.red('PDF export functionality is not available.'));
        logger.error(chalk.yellow('This feature requires optional dependencies. Install them with:'));
        logger.error(chalk.cyan('npm install markdown-pdf puppeteer pdfkit pdf2pic'));
        logger.error(`Import error: ${importError.message}`);
        process.exit(1);
      }

      const exporter = new PDFExporter({
        outputDir: args.output ? path.dirname(path.resolve(args.output)) : './dist/pdf',
        quality: args.quality,
        format: args.format,
        compression: args.compress,
        parallel: args.parallel > 1,
        maxConcurrency: args.parallel,
        timeout: args.timeout,
        verbose: args.verbose
      });

      await exporter.initialize();

      // Process based on mode
      if (args.batch || (args.input && (await fs.stat(args.input)).isDirectory())) {
        await processBatch(exporter, args, logger);
      } else if (args.template) {
        await processTemplate(exporter, args, logger);
      } else {
        await processSingle(exporter, args, logger);
      }

      // Show metrics
      if (args.verbose) {
        const metrics = exporter.getMetrics();
        logger.info('\n' + chalk.blue('Performance Metrics:'));
        logger.info(`Generated: ${metrics.generated}, Failed: ${metrics.failed}`);
        logger.info(`Success Rate: ${metrics.successRate.toFixed(1)}%`);
        logger.info(`Average Time: ${metrics.averageTime.toFixed(0)}ms`);
        
        if (Object.keys(metrics.byMethod).length > 0) {
          logger.info('\nBy Method:');
          Object.entries(metrics.byMethod).forEach(([method, data]) => {
            logger.info(`  ${method}: ${data.count} docs, ${data.averageTime.toFixed(0)}ms avg, ${data.successRate.toFixed(1)}% success`);
          });
        }
      }

      await exporter.cleanup();
      logger.success('PDF export completed successfully');

    } catch (error) {
      logger.error('PDF export failed:', error.message);
      if (args.verbose) {
        logger.error(error.stack);
      }
      process.exit(1);
    }
  }
});

/**
 * Process single file
 */
async function processSingle(exporter, args, logger) {
  const inputPath = path.resolve(args.input);
  const outputPath = args.output 
    ? path.resolve(args.output)
    : path.join('./dist/pdf', path.basename(inputPath, path.extname(inputPath)) + '.pdf');

  if (args['dry-run']) {
    logger.info(`Would convert: ${inputPath} → ${outputPath}`);
    return;
  }

  logger.info(`Converting: ${chalk.blue(inputPath)} → ${chalk.green(outputPath)}`);

  // Read input content
  const content = await fs.readFile(inputPath, 'utf8');
  
  // Prepare options
  const options = buildPdfOptions(args);
  
  // Force method if specified
  if (args.method !== 'auto') {
    options.method = args.method;
  }

  // Generate PDF
  const result = await exporter.generatePdf(content, outputPath, options);
  
  if (result.success) {
    logger.success(`Generated: ${outputPath} (${result.metadata.size} bytes, ${result.duration}ms)`);
    
    // Generate preview images if requested
    if (args['output-images']) {
      await generatePreviewImages(exporter, outputPath, args, logger);
    }
  } else {
    throw new Error(`PDF generation failed: ${result.error}`);
  }
}

/**
 * Process template with data
 */
async function processTemplate(exporter, args, logger) {
  const templatePath = path.resolve(args.template);
  const outputPath = args.output 
    ? path.resolve(args.output)
    : path.join('./dist/pdf', path.basename(templatePath, path.extname(templatePath)) + '.pdf');

  if (args['dry-run']) {
    logger.info(`Would render template: ${templatePath} → ${outputPath}`);
    return;
  }

  logger.info(`Rendering template: ${chalk.blue(templatePath)} → ${chalk.green(outputPath)}`);

  // Load template data
  let data = {};
  
  if (args.data) {
    const dataContent = await fs.readFile(path.resolve(args.data), 'utf8');
    data = JSON.parse(dataContent);
  }
  
  if (args.vars) {
    const varsData = JSON.parse(args.vars);
    data = { ...data, ...varsData };
  }

  // Prepare options
  const options = buildPdfOptions(args);

  // Generate PDF from template
  const result = await exporter.templateToPdf(templatePath, data, outputPath, options);
  
  if (result.success) {
    logger.success(`Generated: ${outputPath} (${result.metadata.size} bytes, ${result.duration}ms)`);
    
    if (args['output-images']) {
      await generatePreviewImages(exporter, outputPath, args, logger);
    }
  } else {
    throw new Error(`Template PDF generation failed: ${result.error}`);
  }
}

/**
 * Process batch of files
 */
async function processBatch(exporter, args, logger) {
  const inputPath = path.resolve(args.input);
  const outputDir = args.output ? path.resolve(args.output) : './dist/pdf';
  
  // Find input files
  const patterns = [
    '**/*.tex',
    '**/*.html',
    '**/*.md',
    '**/*.markdown',
    '**/*.njk',
    '**/*.nunjucks'
  ];
  
  const files = await glob(patterns, {
    cwd: inputPath,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/temp/**']
  });

  if (files.length === 0) {
    logger.warn('No input files found');
    return;
  }

  logger.info(`Found ${files.length} files to process`);

  if (args['dry-run']) {
    files.forEach(file => {
      const outputPath = path.join(outputDir, path.relative(inputPath, file).replace(/\.[^.]+$/, '.pdf'));
      logger.info(`Would convert: ${file} → ${outputPath}`);
    });
    return;
  }

  // Prepare batch jobs
  const jobs = await Promise.all(files.map(async (file) => {
    const content = await fs.readFile(file, 'utf8');
    const outputPath = path.join(outputDir, path.relative(inputPath, file).replace(/\.[^.]+$/, '.pdf'));
    
    // Determine job type
    let type = args.method !== 'auto' ? args.method : null;
    if (!type) {
      type = exporter.detectBestMethod(content);
    }

    return {
      type,
      input: content,
      output: outputPath,
      options: buildPdfOptions(args)
    };
  }));

  // Execute batch
  logger.info(`Processing ${jobs.length} files in batches of ${args.parallel}...`);
  
  const batchResult = await exporter.batchGenerate(jobs, {
    maxConcurrency: args.parallel
  });

  // Report results
  logger.info(`Batch completed: ${batchResult.summary.successful} successful, ${batchResult.summary.failed} failed`);
  
  if (batchResult.summary.failed > 0) {
    logger.warn('Failed files:');
    batchResult.results
      .filter(r => !r.success)
      .forEach(r => logger.warn(`  ${r.job?.output}: ${r.error}`));
  }

  // Generate preview images for successful PDFs
  if (args['output-images']) {
    const successfulPdfs = batchResult.results
      .filter(r => r.success)
      .map(r => r.outputPath);
    
    for (const pdfPath of successfulPdfs) {
      try {
        await generatePreviewImages(exporter, pdfPath, args, logger);
      } catch (error) {
        logger.warn(`Preview generation failed for ${pdfPath}: ${error.message}`);
      }
    }
  }
}

/**
 * Build PDF generation options from CLI args
 */
function buildPdfOptions(args) {
  const options = {
    format: args.format,
    quality: args.quality,
    compress: args.compress,
    engine: args.engine,
    timeout: args.timeout
  };

  // Parse margins
  if (args.margins) {
    const margins = args.margins.split(/\s+/);
    if (margins.length === 1) {
      options.margin = margins[0];
    } else if (margins.length === 4) {
      options.marginTop = margins[0];
      options.marginRight = margins[1];
      options.marginBottom = margins[2];
      options.marginLeft = margins[3];
    }
  }

  // HTML-specific options
  if (args['header-template']) {
    options.headerTemplate = args['header-template'];
    options.displayHeaderFooter = true;
  }

  if (args['footer-template']) {
    options.footerTemplate = args['footer-template'];
    options.displayHeaderFooter = true;
  }

  if (args.landscape) {
    options.landscape = true;
  }

  if (args['print-background'] !== undefined) {
    options.printBackground = args['print-background'];
  }

  if (args['wait-for']) {
    options.waitForSelector = args['wait-for'];
  }

  return options;
}

/**
 * Generate preview images from PDF
 */
async function generatePreviewImages(exporter, pdfPath, args, logger) {
  try {
    const imageDir = path.join(path.dirname(pdfPath), 'images');
    const imagePaths = await exporter.pdfToImages(pdfPath, imageDir, {
      format: args['image-format'],
      density: args['image-density'],
      filename: path.basename(pdfPath, '.pdf') + '-page'
    });

    logger.success(`Generated ${imagePaths.length} preview images in ${imageDir}`);
  } catch (error) {
    logger.warn(`Preview generation failed: ${error.message}`);
  }
}