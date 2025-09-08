#!/usr/bin/env node

/**
 * Create Export Modules with Optional Dependencies
 * Creates separate export modules that gracefully handle missing dependencies
 */

import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const srcDir = join(__dirname, '..', 'src');
const exportDir = join(srcDir, 'lib', 'export');

// Ensure export directory exists
await mkdir(exportDir, { recursive: true });

// PDF Export Module
const pdfExportModule = `
/**
 * PDF Export Module
 * Gracefully handles optional dependencies for PDF generation
 */

let puppeteerCore, katex, pdfkit;

try {
  puppeteerCore = await import('puppeteer-core');
} catch (e) {
  console.warn('puppeteer-core not available. PDF browser-based export disabled.');
}

try {
  katex = await import('katex');
} catch (e) {
  console.warn('katex not available. LaTeX math rendering disabled.');
}

try {
  pdfkit = await import('pdfkit');
} catch (e) {
  console.warn('pdfkit not available. Direct PDF generation disabled.');
}

export class PDFExporter {
  constructor(options = {}) {
    this.options = options;
    this.capabilities = {
      browserPdf: !!puppeteerCore,
      directPdf: !!pdfkit,
      mathRendering: !!katex
    };
  }

  async exportToPdf(content, options = {}) {
    if (this.capabilities.browserPdf) {
      return this.exportViaBrowser(content, options);
    } else if (this.capabilities.directPdf) {
      return this.exportDirect(content, options);
    } else {
      throw new Error('No PDF export capabilities available. Install puppeteer-core or pdfkit.');
    }
  }

  async exportViaBrowser(content, options) {
    if (!puppeteerCore) {
      throw new Error('puppeteer-core is required for browser-based PDF export');
    }

    // Implementation using puppeteer-core
    const browser = await puppeteerCore.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setContent(content, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      ...options
    });
    
    await browser.close();
    return pdf;
  }

  async exportDirect(content, options) {
    if (!pdfkit) {
      throw new Error('pdfkit is required for direct PDF export');
    }

    // Implementation using pdfkit
    const PDFDocument = pdfkit.default || pdfkit;
    const doc = new PDFDocument();
    
    // Simple text-based PDF generation
    doc.fontSize(12).text(content, 100, 100);
    
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {});
    doc.end();
    
    return Buffer.concat(chunks);
  }

  renderMath(latex) {
    if (!katex) {
      return latex; // Fallback to raw LaTeX
    }

    try {
      return katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false
      });
    } catch (error) {
      console.warn('Math rendering failed:', error.message);
      return latex;
    }
  }

  getCapabilities() {
    return this.capabilities;
  }
}

export const createPdfExporter = (options) => new PDFExporter(options);
`;

// DOCX Export Module  
const docxExportModule = `
/**
 * DOCX Export Module
 * Gracefully handles optional dependencies for Word document generation
 */

let docx, officegen;

try {
  docx = await import('docx');
} catch (e) {
  console.warn('docx not available. Modern DOCX export disabled.');
}

try {
  officegen = await import('officegen');
} catch (e) {
  console.warn('officegen not available. Legacy Office export disabled.');
}

export class DocxExporter {
  constructor(options = {}) {
    this.options = options;
    this.capabilities = {
      modernDocx: !!docx,
      legacyOffice: !!officegen
    };
  }

  async exportToDocx(content, options = {}) {
    if (this.capabilities.modernDocx) {
      return this.exportModern(content, options);
    } else if (this.capabilities.legacyOffice) {
      return this.exportLegacy(content, options);
    } else {
      throw new Error('No DOCX export capabilities available. Install docx or officegen.');
    }
  }

  async exportModern(content, options) {
    if (!docx) {
      throw new Error('docx is required for modern DOCX export');
    }

    const { Document, Packer, Paragraph, TextRun } = docx;
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: content,
                size: 24
              })
            ]
          })
        ]
      }]
    });

    return Packer.toBuffer(doc);
  }

  async exportLegacy(content, options) {
    if (!officegen) {
      throw new Error('officegen is required for legacy Office export');
    }

    return new Promise((resolve, reject) => {
      const docxGen = officegen('docx');
      
      const paragraph = docxGen.createP();
      paragraph.addText(content);
      
      const chunks = [];
      docxGen.on('finalize', () => resolve(Buffer.concat(chunks)));
      docxGen.on('error', reject);
      
      docxGen.generate(chunks);
    });
  }

  getCapabilities() {
    return this.capabilities;
  }
}

export const createDocxExporter = (options) => new DocxExporter(options);
`;

// LaTeX Export Module
const latexExportModule = `
/**
 * LaTeX Export Module
 * Handles LaTeX document generation and compilation
 */

let katex;

try {
  katex = await import('katex');
} catch (e) {
  console.warn('katex not available. LaTeX math rendering disabled.');
}

export class LaTeXExporter {
  constructor(options = {}) {
    this.options = options;
    this.capabilities = {
      mathRendering: !!katex
    };
  }

  async exportToLaTeX(content, options = {}) {
    const template = options.template || 'article';
    const documentClass = options.documentClass || 'article';
    
    let preamble = \`\\\\documentclass{\${documentClass}}
\\\\usepackage{amsmath}
\\\\usepackage{amsfonts}
\\\\usepackage{amssymb}
\\\\usepackage[utf8]{inputenc}
\\\\usepackage{geometry}
\\\\geometry{margin=1in}

\\\\title{\${options.title || 'Generated Document'}}
\\\\author{\${options.author || 'Unjucks'}}
\\\\date{\\\\today}

\\\\begin{document}
\\\\maketitle

\`;

    const footer = \`
\\\\end{document}\`;

    return preamble + this.processContent(content) + footer;
  }

  processContent(content) {
    // Process mathematical expressions
    if (this.capabilities.mathRendering) {
      return this.renderMathExpressions(content);
    }
    return content;
  }

  renderMathExpressions(content) {
    if (!katex) return content;

    // Convert inline math $...$ to LaTeX
    content = content.replace(/\$([^$]+)\$/g, (match, math) => {
      try {
        return \`\\\\\( \${math} \\\\\)\`;
      } catch (error) {
        console.warn('Math expression failed:', math);
        return match;
      }
    });

    // Convert display math $$...$$ to LaTeX
    content = content.replace(/\$\$([^$]+)\$\$/g, (match, math) => {
      try {
        return \`\\\\\[ \${math} \\\\\]\`;
      } catch (error) {
        console.warn('Display math failed:', math);
        return match;
      }
    });

    return content;
  }

  getCapabilities() {
    return this.capabilities;
  }
}

export const createLaTeXExporter = (options) => new LaTeXExporter(options);
`;

// Write all modules
await writeFile(join(exportDir, 'pdf.js'), pdfExportModule);
await writeFile(join(exportDir, 'docx.js'), docxExportModule);  
await writeFile(join(exportDir, 'latex.js'), latexExportModule);

console.log('✅ Export modules created successfully');
console.log('📦 Modules support graceful fallback when optional dependencies are missing');
console.log('🎯 Export capabilities can be checked at runtime');