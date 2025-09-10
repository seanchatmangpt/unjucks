/**
 * Multi-Format Output Engine
 * 
 * Handles PDF, HTML, and structured data output generation
 * with LaTeX compilation, headless browser rendering, and JSON-LD output
 */

import { promises as fs } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../utils/logger.js';
import { PerformanceMonitor } from '../utils/performance-monitor.js';

const execFileAsync = promisify(execFile);

/**
 * Output format types
 */
const OUTPUT_FORMATS = {
  PDF: 'pdf',
  HTML: 'html',
  JSON: 'json',
  JSONLD: 'json-ld',
  LATEX: 'latex',
  MARKDOWN: 'markdown'
};

/**
 * CSS templates for different output formats
 */
const CSS_TEMPLATES = {
  print: `
    @media print {
      body { font-family: 'Times New Roman', serif; margin: 0.5in; }
      .page-break { page-break-after: always; }
      .no-print { display: none; }
      h1, h2, h3 { page-break-after: avoid; }
      .section { page-break-inside: avoid; }
    }
  `,
  screen: `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
    .section { margin-bottom: 2rem; }
  `,
  resume: `
    body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.4; color: #333; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 1rem; }
    .section { margin: 1.5rem 0; }
    .section-title { font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #ccc; }
    .experience-item { margin: 1rem 0; }
    .date { float: right; font-style: italic; }
  `
};

/**
 * LaTeX document templates
 */
const LATEX_TEMPLATES = {
  article: `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=1in]{geometry}
\\usepackage{hyperref}
\\begin{document}
{{content}}
\\end{document}`,
  resume: `\\documentclass{moderncv}
\\moderncvstyle{classic}
\\moderncvcolor{blue}
\\usepackage[scale=0.75]{geometry}
\\begin{document}
{{content}}
\\end{document}`
};

/**
 * JSON-LD schemas for structured data
 */
const JSONLD_SCHEMAS = {
  person: {
    '@context': 'https://schema.org',
    '@type': 'Person'
  },
  resume: {
    '@context': 'https://schema.org',
    '@type': 'Person',
    'worksFor': {
      '@type': 'Organization'
    },
    'alumniOf': {
      '@type': 'EducationalOrganization'
    }
  },
  article: {
    '@context': 'https://schema.org',
    '@type': 'Article'
  }
};

class OutputEngine {
  constructor(options = {}) {
    this.logger = new Logger('OutputEngine');
    this.performance = new PerformanceMonitor();
    this.outputDir = options.outputDir || './output';
    this.tempDir = options.tempDir || './temp';
    this.enableCache = options.enableCache !== false;
    this.cache = new Map();
    
    // Tool configurations
    this.tools = {
      latex: options.latexCommand || 'pdflatex',
      puppeteer: options.puppeteerPath || null,
      wkhtmltopdf: options.wkhtmltopdfPath || 'wkhtmltopdf'
    };
  }

  /**
   * Generate output in multiple formats
   */
  async generateMultiFormat(content, options = {}) {
    const timer = this.performance.startTimer('multi-format-generation');
    const results = new Map();

    try {
      const {
        formats = [OUTPUT_FORMATS.HTML],
        filename = 'output',
        template = 'article',
        metadata = {},
        cssStyle = 'screen'
      } = options;

      // Ensure output directory exists
      await this.ensureDir(this.outputDir);
      await this.ensureDir(this.tempDir);

      // Process each format concurrently
      const formatPromises = formats.map(async (format) => {
        try {
          let result;
          switch (format) {
            case OUTPUT_FORMATS.PDF:
              result = await this.generatePDF(content, { filename, template, metadata });
              break;
            case OUTPUT_FORMATS.HTML:
              result = await this.generateHTML(content, { filename, cssStyle, metadata });
              break;
            case OUTPUT_FORMATS.JSON:
            case OUTPUT_FORMATS.JSONLD:
              result = await this.generateJSONLD(content, { filename, template, metadata });
              break;
            case OUTPUT_FORMATS.LATEX:
              result = await this.generateLaTeX(content, { filename, template, metadata });
              break;
            case OUTPUT_FORMATS.MARKDOWN:
              result = await this.generateMarkdown(content, { filename, metadata });
              break;
            default:
              throw new Error(`Unsupported format: ${format}`);
          }
          return { format, result };
        } catch (error) {
          this.logger.error(`Failed to generate ${format}:`, error);
          return { format, error };
        }
      });

      const formatResults = await Promise.allSettled(formatPromises);
      
      for (const promiseResult of formatResults) {
        if (promiseResult.status === 'fulfilled') {
          const { format, result, error } = promiseResult.value;
          results.set(format, error || result);
        }
      }

      timer.end();
      this.logger.info(`Multi-format generation completed in ${timer.duration}ms`);
      
      return {
        success: true,
        results: Object.fromEntries(results),
        performance: timer.getMetrics()
      };

    } catch (error) {
      timer.end();
      this.logger.error('Multi-format generation failed:', error);
      return {
        success: false,
        error: error.message,
        results: Object.fromEntries(results),
        performance: timer.getMetrics()
      };
    }
  }

  /**
   * Generate PDF using LaTeX or HTML→PDF conversion
   */
  async generatePDF(content, options = {}) {
    const { filename = 'output', template = 'article', metadata = {} } = options;
    const timer = this.performance.startTimer('pdf-generation');

    try {
      // Try LaTeX first, fallback to HTML→PDF
      try {
        const result = await this.generatePDFFromLaTeX(content, { filename, template, metadata });
        timer.end();
        return result;
      } catch (latexError) {
        this.logger.warn('LaTeX PDF generation failed, trying HTML→PDF:', latexError.message);
        const result = await this.generatePDFFromHTML(content, { filename, metadata });
        timer.end();
        return result;
      }
    } catch (error) {
      timer.end();
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  }

  /**
   * Generate PDF from LaTeX
   */
  async generatePDFFromLaTeX(content, options = {}) {
    const { filename, template, metadata } = options;
    const texFile = join(this.tempDir, `${filename}.tex`);
    const pdfFile = join(this.outputDir, `${filename}.pdf`);

    // Apply LaTeX template
    const templateContent = LATEX_TEMPLATES[template] || LATEX_TEMPLATES.article;
    const latexContent = templateContent.replace('{{content}}', this.escapeLatex(content));

    // Write LaTeX file
    await fs.writeFile(texFile, latexContent, 'utf8');

    // Compile with pdflatex
    try {
      await execFileAsync(this.tools.latex, [
        '-interaction=nonstopmode',
        '-output-directory', this.tempDir,
        texFile
      ]);

      // Move PDF to output directory
      const tempPdfFile = join(this.tempDir, `${filename}.pdf`);
      await fs.copyFile(tempPdfFile, pdfFile);
      
      // Cleanup temp files
      await this.cleanupTempFiles(filename);

      return {
        format: OUTPUT_FORMATS.PDF,
        file: pdfFile,
        method: 'latex',
        size: (await fs.stat(pdfFile)).size
      };
    } catch (error) {
      throw new Error(`LaTeX compilation failed: ${error.message}`);
    }
  }

  /**
   * Generate PDF from HTML using headless browser or wkhtmltopdf
   */
  async generatePDFFromHTML(content, options = {}) {
    const { filename, metadata } = options;
    const htmlFile = join(this.tempDir, `${filename}.html`);
    const pdfFile = join(this.outputDir, `${filename}.pdf`);

    // Generate HTML with print CSS
    const htmlContent = this.generateHTMLContent(content, {
      cssStyle: 'print',
      metadata,
      title: metadata.title || filename
    });

    await fs.writeFile(htmlFile, htmlContent, 'utf8');

    try {
      // Try Puppeteer first if available
      if (this.tools.puppeteer || await this.checkPuppeteerAvailable()) {
        return await this.generatePDFWithPuppeteer(htmlFile, pdfFile);
      }
      
      // Fallback to wkhtmltopdf
      return await this.generatePDFWithWkhtmltopdf(htmlFile, pdfFile);
    } catch (error) {
      throw new Error(`HTML→PDF conversion failed: ${error.message}`);
    }
  }

  /**
   * Generate PDF using Puppeteer
   */
  async generatePDFWithPuppeteer(htmlFile, pdfFile) {
    const puppeteer = await import('puppeteer').catch(() => null);
    if (!puppeteer) {
      throw new Error('Puppeteer not available');
    }

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
      await page.goto(`file://${htmlFile}`, { waitUntil: 'networkidle0' });
      await page.pdf({
        path: pdfFile,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1in',
          right: '0.5in',
          bottom: '1in',
          left: '0.5in'
        }
      });

      return {
        format: OUTPUT_FORMATS.PDF,
        file: pdfFile,
        method: 'puppeteer',
        size: (await fs.stat(pdfFile)).size
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Generate PDF using wkhtmltopdf
   */
  async generatePDFWithWkhtmltopdf(htmlFile, pdfFile) {
    await execFileAsync(this.tools.wkhtmltopdf, [
      '--page-size', 'A4',
      '--margin-top', '1in',
      '--margin-right', '0.5in',
      '--margin-bottom', '1in',
      '--margin-left', '0.5in',
      '--print-media-type',
      htmlFile,
      pdfFile
    ]);

    return {
      format: OUTPUT_FORMATS.PDF,
      file: pdfFile,
      method: 'wkhtmltopdf',
      size: (await fs.stat(pdfFile)).size
    };
  }

  /**
   * Generate HTML output
   */
  async generateHTML(content, options = {}) {
    const { filename = 'output', cssStyle = 'screen', metadata = {} } = options;
    const htmlFile = join(this.outputDir, `${filename}.html`);

    const htmlContent = this.generateHTMLContent(content, {
      cssStyle,
      metadata,
      title: metadata.title || filename
    });

    await fs.writeFile(htmlFile, htmlContent, 'utf8');

    return {
      format: OUTPUT_FORMATS.HTML,
      file: htmlFile,
      size: (await fs.stat(htmlFile)).size
    };
  }

  /**
   * Generate HTML content with CSS
   */
  generateHTMLContent(content, options = {}) {
    const { cssStyle = 'screen', metadata = {}, title = 'Document' } = options;
    const css = CSS_TEMPLATES[cssStyle] || CSS_TEMPLATES.screen;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>${css}</style>
    ${metadata.structuredData ? `<script type="application/ld+json">${JSON.stringify(metadata.structuredData, null, 2)}</script>` : ''}
</head>
<body>
    <div class="container">
        ${content}
    </div>
</body>
</html>`;
  }

  /**
   * Generate JSON-LD structured data
   */
  async generateJSONLD(content, options = {}) {
    const { filename = 'output', template = 'article', metadata = {} } = options;
    const jsonFile = join(this.outputDir, `${filename}.json`);

    // Get base schema
    const schema = { ...JSONLD_SCHEMAS[template] } || { ...JSONLD_SCHEMAS.article };

    // Extract structured data from content and metadata
    const structuredData = this.extractStructuredData(content, metadata, schema);

    await fs.writeFile(jsonFile, JSON.stringify(structuredData, null, 2), 'utf8');

    return {
      format: OUTPUT_FORMATS.JSONLD,
      file: jsonFile,
      data: structuredData,
      size: (await fs.stat(jsonFile)).size
    };
  }

  /**
   * Generate LaTeX output
   */
  async generateLaTeX(content, options = {}) {
    const { filename = 'output', template = 'article', metadata = {} } = options;
    const texFile = join(this.outputDir, `${filename}.tex`);

    const templateContent = LATEX_TEMPLATES[template] || LATEX_TEMPLATES.article;
    const latexContent = templateContent.replace('{{content}}', this.escapeLatex(content));

    await fs.writeFile(texFile, latexContent, 'utf8');

    return {
      format: OUTPUT_FORMATS.LATEX,
      file: texFile,
      size: (await fs.stat(texFile)).size
    };
  }

  /**
   * Generate Markdown output
   */
  async generateMarkdown(content, options = {}) {
    const { filename = 'output', metadata = {} } = options;
    const mdFile = join(this.outputDir, `${filename}.md`);

    // Add frontmatter if metadata exists
    let markdownContent = content;
    if (Object.keys(metadata).length > 0) {
      markdownContent = `---\n${Object.entries(metadata)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n')}\n---\n\n${content}`;
    }

    await fs.writeFile(mdFile, markdownContent, 'utf8');

    return {
      format: OUTPUT_FORMATS.MARKDOWN,
      file: mdFile,
      size: (await fs.stat(mdFile)).size
    };
  }

  /**
   * Process batch of files
   */
  async processBatch(files, options = {}) {
    const timer = this.performance.startTimer('batch-processing');
    const results = [];

    try {
      const batchPromises = files.map(async (fileInfo) => {
        const { content, filename, formats, metadata } = fileInfo;
        return await this.generateMultiFormat(content, {
          formats,
          filename,
          metadata,
          ...options
        });
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        if (result.status === 'fulfilled') {
          results.push({ file: files[i].filename, ...result.value });
        } else {
          results.push({ file: files[i].filename, success: false, error: result.reason.message });
        }
      }

      timer.end();
      return {
        success: true,
        processed: results.length,
        results,
        performance: timer.getMetrics()
      };
    } catch (error) {
      timer.end();
      throw new Error(`Batch processing failed: ${error.message}`);
    }
  }

  /**
   * Extract structured data from content
   */
  extractStructuredData(content, metadata, schema) {
    const result = { ...schema };

    // Extract from metadata
    Object.assign(result, metadata);

    // Extract common patterns from content
    if (content.includes('name:') || content.includes('Name:')) {
      const nameMatch = content.match(/(?:name|Name):\s*([^\n]+)/i);
      if (nameMatch) result.name = nameMatch[1].trim();
    }

    if (content.includes('email:') || content.includes('Email:')) {
      const emailMatch = content.match(/(?:email|Email):\s*([^\n]+)/i);
      if (emailMatch) result.email = emailMatch[1].trim();
    }

    return result;
  }

  /**
   * Escape LaTeX special characters
   */
  escapeLatex(text) {
    return text
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/[{}]/g, '\\$&')
      .replace(/[$&%#^_~]/g, '\\$&')
      .replace(/\n\s*\n/g, '\n\n\\par\n');
  }

  /**
   * Check if Puppeteer is available
   */
  async checkPuppeteerAvailable() {
    try {
      await import('puppeteer');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cleanup temporary files
   */
  async cleanupTempFiles(filename) {
    const extensions = ['.aux', '.log', '.out', '.fdb_latexmk', '.fls'];
    for (const ext of extensions) {
      try {
        await fs.unlink(join(this.tempDir, `${filename}${ext}`));
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Ensure directory exists
   */
  async ensureDir(dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  /**
   * Get supported formats
   */
  getSupportedFormats() {
    return Object.values(OUTPUT_FORMATS);
  }

  /**
   * Get format capabilities
   */
  async getCapabilities() {
    const capabilities = {
      formats: this.getSupportedFormats(),
      tools: {
        latex: await this.checkToolAvailable(this.tools.latex),
        puppeteer: await this.checkPuppeteerAvailable(),
        wkhtmltopdf: await this.checkToolAvailable(this.tools.wkhtmltopdf)
      },
      features: {
        batchProcessing: true,
        structuredData: true,
        templateSupport: true,
        cssCustomization: true
      }
    };

    return capabilities;
  }

  /**
   * Check if command-line tool is available
   */
  async checkToolAvailable(tool) {
    try {
      await execFileAsync(tool, ['--version']);
      return true;
    } catch {
      return false;
    }
  }
}

export { OutputEngine, OUTPUT_FORMATS, CSS_TEMPLATES, LATEX_TEMPLATES, JSONLD_SCHEMAS };
