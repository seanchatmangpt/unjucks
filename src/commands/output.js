/**
 * Output Command - Multi-format output generation
 * 
 * Handles PDF, HTML, JSON-LD, LaTeX, and Markdown output
 */

import { OutputEngine, OUTPUT_FORMATS } from '../core/output-engine.js';
import { Logger } from '../utils/logger.js';
import { CONSTANTS } from '../utils/constants.js';
import { join } from 'path';
import { promises as fs } from 'fs';

class OutputCommand {
  constructor() {
    this.logger = new Logger('OutputCommand');
    this.engine = new OutputEngine();
  }

  /**
   * Define command structure
   */
  static define() {
    return {
      meta: {
        name: 'output',
        description: 'Generate multi-format output (PDF, HTML, JSON-LD, etc.)'
      },
      args: {
        input: {
          type: 'positional',
          description: 'Input file or content to process'
        },
        format: {
          type: 'string',
          description: 'Output formats (comma-separated): pdf,html,json,latex,markdown',
          alias: 'f',
          default: 'html'
        },
        output: {
          type: 'string',
          description: 'Output directory',
          alias: 'o',
          default: './output'
        },
        filename: {
          type: 'string',
          description: 'Output filename (without extension)',
          alias: 'n',
          default: 'document'
        },
        template: {
          type: 'string',
          description: 'Template type: article, resume',
          alias: 't',
          default: 'article'
        },
        style: {
          type: 'string',
          description: 'CSS style for HTML: screen, print, resume',
          alias: 's',
          default: 'screen'
        },
        batch: {
          type: 'boolean',
          description: 'Process multiple files in batch mode',
          alias: 'b',
          default: false
        },
        metadata: {
          type: 'string',
          description: 'JSON metadata file or string',
          alias: 'm'
        },
        dry: {
          type: 'boolean',
          description: 'Dry run - show what would be generated',
          default: false
        },
        capabilities: {
          type: 'boolean',
          description: 'Show available output capabilities',
          alias: 'c',
          default: false
        }
      }
    };
  }

  /**
   * Execute the output command
   */
  async run(args) {
    try {
      // Show capabilities if requested
      if (args.capabilities) {
        return await this.showCapabilities();
      }

      // Validate and parse arguments
      const config = await this.parseArgs(args);
      
      if (config.batch) {
        return await this.processBatch(config);
      } else {
        return await this.processSingle(config);
      }

    } catch (error) {
      this.logger.error('Output command failed:', error);
      throw error;
    }
  }

  /**
   * Parse and validate command arguments
   */
  async parseArgs(args) {
    const config = {
      input: args.input,
      formats: this.parseFormats(args.format),
      outputDir: args.output,
      filename: args.filename,
      template: args.template,
      cssStyle: args.style,
      batch: args.batch,
      dry: args.dry,
      metadata: await this.parseMetadata(args.metadata)
    };

    // Validate input
    if (!config.input) {
      throw new Error('Input file or content is required');
    }

    // Validate formats
    const supportedFormats = Object.values(OUTPUT_FORMATS);
    const invalidFormats = config.formats.filter(f => !supportedFormats.includes(f));
    if (invalidFormats.length > 0) {
      throw new Error(`Unsupported formats: ${invalidFormats.join(', ')}. Supported: ${supportedFormats.join(', ')}`);
    }

    return config;
  }

  /**
   * Parse format string into array
   */
  parseFormats(formatString) {
    return formatString
      .split(',')
      .map(f => f.trim().toLowerCase())
      .filter(f => f.length > 0);
  }

  /**
   * Parse metadata from file or JSON string
   */
  async parseMetadata(metadataArg) {
    if (!metadataArg) return {};

    try {
      // Try parsing as JSON string first
      return JSON.parse(metadataArg);
    } catch {
      // Try reading as file
      try {
        const content = await fs.readFile(metadataArg, 'utf8');
        return JSON.parse(content);
      } catch {
        this.logger.warn(`Could not parse metadata: ${metadataArg}`);
        return {};
      }
    }
  }

  /**
   * Process single file/content
   */
  async processSingle(config) {
    const timer = performance.now();
    
    // Read input content
    const content = await this.readInput(config.input);
    
    if (config.dry) {
      return this.showDryRun(config, content);
    }

    // Configure output engine
    this.engine.outputDir = config.outputDir;
    
    // Generate output
    const result = await this.engine.generateMultiFormat(content, {
      formats: config.formats,
      filename: config.filename,
      template: config.template,
      cssStyle: config.cssStyle,
      metadata: config.metadata
    });

    const duration = performance.now() - timer;
    
    // Display results
    this.displayResults(result, duration);
    
    return result;
  }

  /**
   * Process multiple files in batch
   */
  async processBatch(config) {
    const timer = performance.now();
    
    // Find batch files
    const files = await this.findBatchFiles(config.input);
    
    if (config.dry) {
      return this.showBatchDryRun(config, files);
    }

    // Configure output engine
    this.engine.outputDir = config.outputDir;
    
    // Process batch
    const batchData = files.map((file, index) => ({
      content: file.content,
      filename: file.name || `${config.filename}_${index + 1}`,
      formats: config.formats,
      metadata: { ...config.metadata, ...file.metadata }
    }));

    const result = await this.engine.processBatch(batchData, {
      template: config.template,
      cssStyle: config.cssStyle
    });

    const duration = performance.now() - timer;
    
    // Display results
    this.displayBatchResults(result, duration);
    
    return result;
  }

  /**
   * Read input content from file or use as direct content
   */
  async readInput(input) {
    try {
      // Try reading as file first
      return await fs.readFile(input, 'utf8');
    } catch {
      // Use as direct content
      return input;
    }
  }

  /**
   * Find files for batch processing
   */
  async findBatchFiles(pattern) {
    // Implementation depends on glob patterns or directory scanning
    // For now, simple implementation
    const files = [];
    
    try {
      const stats = await fs.stat(pattern);
      if (stats.isDirectory()) {
        // Read all files in directory
        const entries = await fs.readdir(pattern, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.txt'))) {
            const filepath = join(pattern, entry.name);
            const content = await fs.readFile(filepath, 'utf8');
            files.push({
              name: entry.name.replace(/\.[^.]+$/, ''),
              content,
              metadata: {}
            });
          }
        }
      } else {
        // Single file
        const content = await fs.readFile(pattern, 'utf8');
        files.push({
          name: pattern.replace(/\.[^.]+$/, ''),
          content,
          metadata: {}
        });
      }
    } catch (error) {
      throw new Error(`Could not read batch input: ${error.message}`);
    }

    return files;
  }

  /**
   * Show dry run results
   */
  showDryRun(config, content) {
    console.log('🔍 Dry Run - Output Generation Plan');
    console.log('=====================================');
    console.log(`Input: ${config.input}`);
    console.log(`Content length: ${content.length} characters`);
    console.log(`Output directory: ${config.outputDir}`);
    console.log(`Filename: ${config.filename}`);
    console.log(`Template: ${config.template}`);
    console.log(`CSS Style: ${config.cssStyle}`);
    console.log(`Formats: ${config.formats.join(', ')}`);
    
    if (Object.keys(config.metadata).length > 0) {
      console.log(`Metadata: ${JSON.stringify(config.metadata, null, 2)}`);
    }

    console.log('\nFiles that would be generated:');
    for (const format of config.formats) {
      const ext = this.getFileExtension(format);
      console.log(`  📄 ${config.filename}.${ext}`);
    }

    return { success: true, dryRun: true };
  }

  /**
   * Show batch dry run results
   */
  showBatchDryRun(config, files) {
    console.log('🔍 Batch Dry Run - Output Generation Plan');
    console.log('===========================================');
    console.log(`Input pattern: ${config.input}`);
    console.log(`Files found: ${files.length}`);
    console.log(`Output directory: ${config.outputDir}`);
    console.log(`Template: ${config.template}`);
    console.log(`Formats: ${config.formats.join(', ')}`);

    console.log('\nFiles that would be processed:');
    for (const file of files) {
      console.log(`  📂 ${file.name}`);
      for (const format of config.formats) {
        const ext = this.getFileExtension(format);
        console.log(`    📄 ${file.name}.${ext}`);
      }
    }

    return { success: true, dryRun: true };
  }

  /**
   * Display generation results
   */
  displayResults(result, duration) {
    console.log('✅ Output Generation Complete');
    console.log('=============================');
    console.log(`Duration: ${duration.toFixed(2)}ms`);
    console.log(`Success: ${result.success}`);
    
    if (result.success) {
      console.log('\nGenerated files:');
      for (const [format, info] of Object.entries(result.results)) {
        if (info.file) {
          const sizeKB = (info.size / 1024).toFixed(2);
          console.log(`  📄 ${format.toUpperCase()}: ${info.file} (${sizeKB} KB)`);
          if (info.method) {
            console.log(`      Method: ${info.method}`);
          }
        } else if (info.message) {
          console.log(`  ❌ ${format.toUpperCase()}: ${info.message}`);
        }
      }
    } else {
      console.log(`❌ Error: ${result.error}`);
    }
  }

  /**
   * Display batch results
   */
  displayBatchResults(result, duration) {
    console.log('✅ Batch Output Generation Complete');
    console.log('===================================');
    console.log(`Duration: ${duration.toFixed(2)}ms`);
    console.log(`Files processed: ${result.processed}`);
    console.log(`Success: ${result.success}`);
    
    if (result.success) {
      console.log('\nBatch results:');
      for (const fileResult of result.results) {
        console.log(`\n📂 ${fileResult.file}:`);
        if (fileResult.success) {
          for (const [format, info] of Object.entries(fileResult.results)) {
            if (info.file) {
              const sizeKB = (info.size / 1024).toFixed(2);
              console.log(`  📄 ${format.toUpperCase()}: ${info.file} (${sizeKB} KB)`);
            }
          }
        } else {
          console.log(`  ❌ Error: ${fileResult.error}`);
        }
      }
    }
  }

  /**
   * Show available capabilities
   */
  async showCapabilities() {
    console.log('🛠️  Output Engine Capabilities');
    console.log('==============================');
    
    const capabilities = await this.engine.getCapabilities();
    
    console.log('\nSupported Formats:');
    for (const format of capabilities.formats) {
      console.log(`  📄 ${format.toUpperCase()}`);
    }
    
    console.log('\nAvailable Tools:');
    for (const [tool, available] of Object.entries(capabilities.tools)) {
      const status = available ? '✅' : '❌';
      console.log(`  ${status} ${tool}`);
    }
    
    console.log('\nFeatures:');
    for (const [feature, enabled] of Object.entries(capabilities.features)) {
      const status = enabled ? '✅' : '❌';
      console.log(`  ${status} ${feature}`);
    }

    return capabilities;
  }

  /**
   * Get file extension for format
   */
  getFileExtension(format) {
    const extensions = {
      [OUTPUT_FORMATS.PDF]: 'pdf',
      [OUTPUT_FORMATS.HTML]: 'html',
      [OUTPUT_FORMATS.JSON]: 'json',
      [OUTPUT_FORMATS.JSONLD]: 'json',
      [OUTPUT_FORMATS.LATEX]: 'tex',
      [OUTPUT_FORMATS.MARKDOWN]: 'md'
    };
    return extensions[format] || format;
  }
}

export { OutputCommand };

// Citty command definition for CLI integration
import { defineCommand } from 'citty';

export const outputCommand = defineCommand({
  meta: OutputCommand.define().meta,
  args: OutputCommand.define().args,
  async run({ args }) {
    const command = new OutputCommand();
    return await command.run(args);
  }
});
