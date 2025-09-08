/**
 * PDF Generation Pipeline for Unjucks
 * Integrates PDFKit for high-quality PDF creation with LaTeX-style elements
 */

import PDFDocument from 'pdfkit';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import consola from 'consola';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * PDF Generator class with LaTeX-style element mapping
 */
export class PDFGenerator {
  constructor(options = {}) {
    this.options = {
      // Page layout
      size: 'A4',
      margin: 72, // 1 inch
      layout: 'portrait',
      
      // Typography
      defaultFont: 'Helvetica',
      fontSize: 12,
      lineHeight: 1.5,
      
      // Quality settings
      compress: true,
      
      // Custom options
      ...options
    };
    
    this.doc = null;
    this.fonts = new Map();
    this.imageCache = new Map();
    this.styles = this.initializeStyles();
  }

  /**
   * Initialize predefined styles similar to LaTeX
   */
  initializeStyles() {
    return {
      // Document structure
      title: {
        font: 'Helvetica-Bold',
        size: 24,
        color: '#000000',
        align: 'center',
        spaceAfter: 20
      },
      
      section: {
        font: 'Helvetica-Bold',
        size: 18,
        color: '#000000',
        align: 'left',
        spaceBefore: 16,
        spaceAfter: 12
      },
      
      subsection: {
        font: 'Helvetica-Bold',
        size: 14,
        color: '#000000',
        align: 'left',
        spaceBefore: 12,
        spaceAfter: 8
      },
      
      // Text styles
      body: {
        font: 'Helvetica',
        size: 12,
        color: '#000000',
        align: 'left',
        lineHeight: 1.5,
        spaceAfter: 8
      },
      
      emphasis: {
        font: 'Helvetica-Oblique',
        size: 12,
        color: '#000000'
      },
      
      strong: {
        font: 'Helvetica-Bold',
        size: 12,
        color: '#000000'
      },
      
      // Code and technical
      code: {
        font: 'Courier',
        size: 10,
        color: '#333333',
        backgroundColor: '#f5f5f5',
        border: true,
        borderColor: '#cccccc'
      },
      
      codeblock: {
        font: 'Courier',
        size: 10,
        color: '#333333',
        backgroundColor: '#f8f8f8',
        border: true,
        borderColor: '#cccccc',
        padding: 8,
        spaceAfter: 12
      },
      
      // Lists
      listItem: {
        font: 'Helvetica',
        size: 12,
        color: '#000000',
        indent: 20,
        bulletChar: '•'
      },
      
      // Tables
      tableHeader: {
        font: 'Helvetica-Bold',
        size: 11,
        color: '#000000',
        backgroundColor: '#f0f0f0',
        align: 'center',
        padding: 6
      },
      
      tableCell: {
        font: 'Helvetica',
        size: 10,
        color: '#000000',
        align: 'left',
        padding: 4
      },
      
      // Special elements
      quote: {
        font: 'Helvetica-Oblique',
        size: 11,
        color: '#555555',
        indent: 30,
        borderLeft: true,
        borderLeftColor: '#cccccc',
        borderLeftWidth: 3
      },
      
      caption: {
        font: 'Helvetica',
        size: 10,
        color: '#666666',
        align: 'center',
        spaceAfter: 8
      }
    };
  }

  /**
   * Initialize PDF document
   */
  initializeDocument() {
    this.doc = new PDFDocument({
      size: this.options.size,
      layout: this.options.layout,
      margin: this.options.margin,
      compress: this.options.compress,
      info: {
        Title: this.options.title || 'Generated Document',
        Author: this.options.author || 'Unjucks PDF Generator',
        Subject: this.options.subject || 'Generated PDF Document',
        Creator: 'Unjucks PDF Pipeline',
        Producer: 'PDFKit'
      }
    });

    // Set default font
    this.doc.font(this.options.defaultFont);
    
    return this.doc;
  }

  /**
   * Register custom fonts
   */
  async registerFont(name, fontPath) {
    try {
      if (await fs.pathExists(fontPath)) {
        this.doc.registerFont(name, fontPath);
        this.fonts.set(name, fontPath);
        consola.success(`Registered font: ${name}`);
      } else {
        consola.warn(`Font file not found: ${fontPath}`);
      }
    } catch (error) {
      consola.error(`Failed to register font ${name}:`, error.message);
    }
  }

  /**
   * Apply text style
   */
  applyStyle(styleName, customOptions = {}) {
    const style = { ...this.styles[styleName], ...customOptions };
    
    if (style.font) {
      this.doc.font(style.font);
    }
    
    if (style.size) {
      this.doc.fontSize(style.size);
    }
    
    if (style.color) {
      this.doc.fillColor(style.color);
    }
    
    return style;
  }

  /**
   * Add title element
   */
  addTitle(text, options = {}) {
    const style = this.applyStyle('title', options);
    
    if (style.spaceBefore) {
      this.doc.moveDown(style.spaceBefore / 12);
    }
    
    this.doc.text(text, {
      align: style.align,
      lineGap: style.lineHeight || 0
    });
    
    if (style.spaceAfter) {
      this.doc.moveDown(style.spaceAfter / 12);
    }
    
    return this;
  }

  /**
   * Add section heading
   */
  addSection(text, level = 1, options = {}) {
    const styleMap = {
      1: 'section',
      2: 'subsection',
      3: 'subsection'
    };
    
    const styleName = styleMap[level] || 'section';
    const style = this.applyStyle(styleName, options);
    
    if (style.spaceBefore) {
      this.doc.moveDown(style.spaceBefore / 12);
    }
    
    this.doc.text(text, {
      align: style.align,
      lineGap: style.lineHeight || 0
    });
    
    if (style.spaceAfter) {
      this.doc.moveDown(style.spaceAfter / 12);
    }
    
    return this;
  }

  /**
   * Add paragraph
   */
  addParagraph(text, options = {}) {
    const style = this.applyStyle('body', options);
    
    // Handle inline formatting
    text = this.processInlineFormatting(text);
    
    this.doc.text(text, {
      align: style.align,
      lineGap: (style.lineHeight - 1) * style.size || 2,
      indent: style.indent || 0
    });
    
    if (style.spaceAfter) {
      this.doc.moveDown(style.spaceAfter / 12);
    }
    
    return this;
  }

  /**
   * Process inline formatting (bold, italic, code)
   */
  processInlineFormatting(text) {
    // This is a simplified version - in production, you'd want more robust parsing
    return text
      .replace(/\*\*(.*?)\*\*/g, (match, content) => content) // Bold - handled via style changes
      .replace(/\*(.*?)\*/g, (match, content) => content) // Italic - handled via style changes
      .replace(/`(.*?)`/g, (match, content) => content); // Code - handled via style changes
  }

  /**
   * Add code block
   */
  addCodeBlock(code, language = '', options = {}) {
    const style = this.applyStyle('codeblock', options);
    
    // Add background rectangle
    const currentY = this.doc.y;
    const textHeight = this.doc.heightOfString(code, {
      width: this.doc.page.width - this.doc.page.margins.left - this.doc.page.margins.right - (style.padding * 2)
    });
    
    if (style.backgroundColor) {
      this.doc.rect(
        this.doc.page.margins.left,
        currentY - style.padding / 2,
        this.doc.page.width - this.doc.page.margins.left - this.doc.page.margins.right,
        textHeight + style.padding
      )
      .fillColor(style.backgroundColor)
      .fill()
      .fillColor(style.color);
    }
    
    // Add border if specified
    if (style.border) {
      this.doc.rect(
        this.doc.page.margins.left,
        currentY - style.padding / 2,
        this.doc.page.width - this.doc.page.margins.left - this.doc.page.margins.right,
        textHeight + style.padding
      )
      .strokeColor(style.borderColor || '#000000')
      .stroke();
    }
    
    // Add code text
    this.doc.text(code, this.doc.page.margins.left + style.padding, currentY, {
      width: this.doc.page.width - this.doc.page.margins.left - this.doc.page.margins.right - (style.padding * 2),
      lineGap: 2
    });
    
    if (style.spaceAfter) {
      this.doc.moveDown(style.spaceAfter / 12);
    }
    
    return this;
  }

  /**
   * Add unordered list
   */
  addList(items, options = {}) {
    const style = this.applyStyle('listItem', options);
    
    items.forEach((item, index) => {
      const bulletX = this.doc.page.margins.left;
      const textX = bulletX + style.indent;
      const currentY = this.doc.y;
      
      // Add bullet
      this.doc.text(style.bulletChar, bulletX, currentY, {
        width: style.indent,
        align: 'center'
      });
      
      // Add item text
      this.doc.text(item, textX, currentY, {
        width: this.doc.page.width - textX - this.doc.page.margins.right,
        lineGap: 2
      });
      
      this.doc.moveDown(0.3);
    });
    
    this.doc.moveDown(0.5);
    return this;
  }

  /**
   * Add table
   */
  addTable(data, options = {}) {
    const { headers = [], rows = [] } = data;
    const tableOptions = {
      cellPadding: 6,
      borderWidth: 1,
      borderColor: '#cccccc',
      headerStyle: this.styles.tableHeader,
      cellStyle: this.styles.tableCell,
      ...options
    };
    
    if (headers.length === 0 || rows.length === 0) {
      return this;
    }
    
    const tableWidth = this.doc.page.width - this.doc.page.margins.left - this.doc.page.margins.right;
    const colWidth = tableWidth / headers.length;
    const startX = this.doc.page.margins.left;
    let currentY = this.doc.y;
    
    // Calculate row height
    const rowHeight = Math.max(tableOptions.headerStyle.size + tableOptions.cellPadding * 2, 20);
    
    // Draw headers
    if (headers.length > 0) {
      this.drawTableRow(headers, startX, currentY, colWidth, rowHeight, tableOptions.headerStyle, tableOptions);
      currentY += rowHeight;
    }
    
    // Draw rows
    rows.forEach(row => {
      this.drawTableRow(row, startX, currentY, colWidth, rowHeight, tableOptions.cellStyle, tableOptions);
      currentY += rowHeight;
    });
    
    // Update document Y position
    this.doc.y = currentY + 10;
    
    return this;
  }

  /**
   * Draw table row
   */
  drawTableRow(cells, startX, startY, colWidth, rowHeight, style, tableOptions) {
    const appliedStyle = this.applyStyle(null, style);
    
    cells.forEach((cell, index) => {
      const cellX = startX + (index * colWidth);
      
      // Draw cell background
      if (style.backgroundColor) {
        this.doc.rect(cellX, startY, colWidth, rowHeight)
          .fillColor(style.backgroundColor)
          .fill();
      }
      
      // Draw cell border
      this.doc.rect(cellX, startY, colWidth, rowHeight)
        .strokeColor(tableOptions.borderColor)
        .lineWidth(tableOptions.borderWidth)
        .stroke();
      
      // Draw cell text
      this.doc.fillColor(style.color)
        .text(String(cell), cellX + style.padding, startY + style.padding, {
          width: colWidth - (style.padding * 2),
          height: rowHeight - (style.padding * 2),
          align: style.align,
          valign: 'center'
        });
    });
  }

  /**
   * Add image with caption
   */
  async addImage(imagePath, options = {}) {
    try {
      if (!await fs.pathExists(imagePath)) {
        consola.warn(`Image not found: ${imagePath}`);
        return this;
      }
      
      const imageOptions = {
        fit: [400, 300],
        align: 'center',
        valign: 'center',
        ...options
      };
      
      // Add image
      this.doc.image(imagePath, imageOptions);
      
      // Add caption if provided
      if (options.caption) {
        this.doc.moveDown(0.5);
        const style = this.applyStyle('caption');
        this.doc.text(options.caption, {
          align: style.align
        });
        
        if (style.spaceAfter) {
          this.doc.moveDown(style.spaceAfter / 12);
        }
      }
      
      this.doc.moveDown(0.5);
      return this;
    } catch (error) {
      consola.error(`Failed to add image ${imagePath}:`, error.message);
      return this;
    }
  }

  /**
   * Add quote block
   */
  addQuote(text, options = {}) {
    const style = this.applyStyle('quote', options);
    const startY = this.doc.y;
    
    // Draw left border
    if (style.borderLeft) {
      this.doc.rect(
        this.doc.page.margins.left + style.indent - 10,
        startY,
        style.borderLeftWidth,
        this.doc.heightOfString(text, {
          width: this.doc.page.width - this.doc.page.margins.left - this.doc.page.margins.right - style.indent
        }) + 10
      )
      .fillColor(style.borderLeftColor)
      .fill()
      .fillColor(style.color);
    }
    
    // Add quote text
    this.doc.text(text, this.doc.page.margins.left + style.indent, startY, {
      width: this.doc.page.width - this.doc.page.margins.left - this.doc.page.margins.right - style.indent,
      lineGap: 3
    });
    
    this.doc.moveDown(1);
    return this;
  }

  /**
   * Add page break
   */
  addPageBreak() {
    this.doc.addPage();
    return this;
  }

  /**
   * Add footer to all pages
   */
  addFooter(text, options = {}) {
    const footerOptions = {
      font: 'Helvetica',
      size: 10,
      color: '#666666',
      align: 'center',
      ...options
    };
    
    const pages = this.doc.bufferedPageRange();
    
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      this.doc.switchToPage(i);
      
      const footerText = typeof text === 'function' 
        ? text(i + 1, pages.count) 
        : text.replace('{page}', i + 1).replace('{totalPages}', pages.count);
      
      this.doc.font(footerOptions.font)
        .fontSize(footerOptions.size)
        .fillColor(footerOptions.color)
        .text(footerText, 0, this.doc.page.height - 50, {
          align: footerOptions.align,
          width: this.doc.page.width
        });
    }
    
    return this;
  }

  /**
   * Generate PDF from template structure
   */
  async generateFromTemplate(templateData, outputPath) {
    try {
      this.initializeDocument();
      
      // Process template sections
      for (const section of templateData.sections || []) {
        await this.processSection(section);
      }
      
      // Add footer if specified
      if (templateData.footer) {
        this.addFooter(templateData.footer);
      }
      
      // Save PDF
      await this.savePDF(outputPath);
      
      consola.success(`PDF generated successfully: ${outputPath}`);
      return outputPath;
    } catch (error) {
      consola.error('PDF generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Process template section
   */
  async processSection(section) {
    switch (section.type) {
      case 'title':
        this.addTitle(section.content, section.options);
        break;
      case 'section':
        this.addSection(section.content, section.level || 1, section.options);
        break;
      case 'paragraph':
        this.addParagraph(section.content, section.options);
        break;
      case 'code':
        this.addCodeBlock(section.content, section.language, section.options);
        break;
      case 'list':
        this.addList(section.items, section.options);
        break;
      case 'table':
        this.addTable(section.data, section.options);
        break;
      case 'image':
        await this.addImage(section.path, section.options);
        break;
      case 'quote':
        this.addQuote(section.content, section.options);
        break;
      case 'pagebreak':
        this.addPageBreak();
        break;
      default:
        consola.warn(`Unknown section type: ${section.type}`);
    }
  }

  /**
   * Save PDF to file
   */
  async savePDF(outputPath) {
    return new Promise((resolve, reject) => {
      try {
        // Ensure output directory exists
        fs.ensureDirSync(path.dirname(outputPath));
        
        const stream = fs.createWriteStream(outputPath);
        
        this.doc.pipe(stream);
        this.doc.end();
        
        stream.on('finish', () => {
          consola.success(`PDF saved to: ${outputPath}`);
          resolve(outputPath);
        });
        
        stream.on('error', (error) => {
          consola.error('Failed to save PDF:', error.message);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get PDF as buffer
   */
  async getPDFBuffer() {
    return new Promise((resolve, reject) => {
      try {
        const buffers = [];
        
        this.doc.on('data', buffer => buffers.push(buffer));
        this.doc.on('end', () => resolve(Buffer.concat(buffers)));
        this.doc.on('error', reject);
        
        this.doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Performance optimization: batch operations
   */
  batch(operations) {
    operations.forEach(operation => {
      const { type, ...params } = operation;
      if (this[type]) {
        this[type](params);
      }
    });
    return this;
  }
}

/**
 * Factory function for creating PDF generators
 */
export function createPDFGenerator(options = {}) {
  return new PDFGenerator(options);
}

/**
 * Quick PDF generation utility
 */
export async function generatePDF(templateData, outputPath, options = {}) {
  const generator = createPDFGenerator(options);
  return await generator.generateFromTemplate(templateData, outputPath);
}

/**
 * LaTeX-style document builder
 */
export class LaTeXDocumentBuilder {
  constructor(options = {}) {
    this.generator = createPDFGenerator(options);
    this.sections = [];
  }

  title(text) {
    this.sections.push({ type: 'title', content: text });
    return this;
  }

  section(text, level = 1) {
    this.sections.push({ type: 'section', content: text, level });
    return this;
  }

  paragraph(text) {
    this.sections.push({ type: 'paragraph', content: text });
    return this;
  }

  code(content, language = '') {
    this.sections.push({ type: 'code', content, language });
    return this;
  }

  itemize(items) {
    this.sections.push({ type: 'list', items });
    return this;
  }

  tabular(headers, rows) {
    this.sections.push({ type: 'table', data: { headers, rows } });
    return this;
  }

  includegraphics(path, options = {}) {
    this.sections.push({ type: 'image', path, options });
    return this;
  }

  quote(text) {
    this.sections.push({ type: 'quote', content: text });
    return this;
  }

  newpage() {
    this.sections.push({ type: 'pagebreak' });
    return this;
  }

  async build(outputPath) {
    return await this.generator.generateFromTemplate({ sections: this.sections }, outputPath);
  }
}

/**
 * Export default PDF generator
 */
export default PDFGenerator;