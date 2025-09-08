const katex = require('katex');
const puppeteer = require('puppeteer');
const { promises: fs } = require('fs');
const path = require('path');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

class LaTeXService {
  constructor() {
    this.browser = null;
    this.templateCache = new Map();
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Render LaTeX to HTML using KaTeX
   */
  async renderToHtml(latex, options = {}) {
    try {
      logger.info('Rendering LaTeX to HTML', { latexLength: latex.length });

      const renderOptions = {
        displayMode: options.displayMode || false,
        throwOnError: options.throwOnError || false,
        macros: options.macros || {},
        trust: options.trust || false,
        strict: options.strict || 'warn'
      };

      const html = katex.renderToString(latex, renderOptions);
      
      const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LaTeX Rendering</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" 
        integrity="sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV" crossorigin="anonymous">
  <style>
    body { 
      font-family: 'Computer Modern', 'Times New Roman', serif; 
      max-width: 800px; 
      margin: 0 auto; 
      padding: 20px;
      line-height: 1.6;
    }
    .katex { font-size: 1.1em; }
  </style>
</head>
<body>
  <div class="latex-content">${html}</div>
</body>
</html>`;

      return {
        html: fullHtml,
        rawHtml: html,
        success: true
      };
    } catch (error) {
      logger.error('LaTeX HTML rendering failed', { error: error.message, latex });
      throw new AppError(`LaTeX rendering failed: ${error.message}`, 400);
    }
  }

  /**
   * Render LaTeX to PDF using Puppeteer
   */
  async renderToPdf(latex, options = {}) {
    try {
      logger.info('Rendering LaTeX to PDF', { latexLength: latex.length });

      // First render to HTML
      const { html } = await this.renderToHtml(latex, options);
      
      await this.initBrowser();
      const page = await this.browser.newPage();
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfOptions = {
        format: 'A4',
        printBackground: true,
        margin: { 
          top: '1in', 
          right: '1in', 
          bottom: '1in', 
          left: '1in' 
        }
      };

      const pdfBuffer = await page.pdf(pdfOptions);
      await page.close();

      return {
        pdf: pdfBuffer,
        success: true,
        size: pdfBuffer.length
      };
    } catch (error) {
      logger.error('LaTeX PDF rendering failed', { error: error.message });
      throw new AppError(`PDF rendering failed: ${error.message}`, 500);
    }
  }

  /**
   * Parse LaTeX to AST (Abstract Syntax Tree)
   */
  async parseLatex(latex, options = {}) {
    try {
      logger.info('Parsing LaTeX to AST', { latexLength: latex.length });

      // Simple LaTeX parser - in production, you'd use a proper LaTeX parser
      const ast = this.parseLatexToAst(latex, options);
      
      return {
        ast,
        success: true,
        nodeCount: this.countNodes(ast)
      };
    } catch (error) {
      logger.error('LaTeX parsing failed', { error: error.message });
      throw new AppError(`LaTeX parsing failed: ${error.message}`, 400);
    }
  }

  /**
   * Simple LaTeX AST parser
   */
  parseLatexToAst(latex, options = {}) {
    const tokens = this.tokenize(latex);
    return this.buildAst(tokens, options);
  }

  tokenize(latex) {
    const tokens = [];
    const patterns = [
      { type: 'COMMAND', regex: /\\([a-zA-Z]+\*?)/ },
      { type: 'LBRACE', regex: /\{/ },
      { type: 'RBRACE', regex: /\}/ },
      { type: 'LBRACKET', regex: /\[/ },
      { type: 'RBRACKET', regex: /\]/ },
      { type: 'MATH_DELIMITER', regex: /\$\$?/ },
      { type: 'COMMENT', regex: /%.*$/ },
      { type: 'WHITESPACE', regex: /\s+/ },
      { type: 'TEXT', regex: /[^\\{}\[\]$%\s]+/ }
    ];

    let position = 0;
    while (position < latex.length) {
      let matched = false;
      
      for (const pattern of patterns) {
        const match = latex.slice(position).match(new RegExp(`^${pattern.regex.source}`, pattern.regex.flags));
        if (match) {
          if (pattern.type !== 'WHITESPACE' || position === 0 || position === latex.length - 1) {
            tokens.push({
              type: pattern.type,
              value: match[0],
              position: position
            });
          }
          position += match[0].length;
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        tokens.push({
          type: 'UNKNOWN',
          value: latex[position],
          position: position
        });
        position++;
      }
    }

    return tokens;
  }

  buildAst(tokens, options = {}) {
    const ast = {
      type: 'document',
      children: [],
      metadata: {
        tokenCount: tokens.length,
        parseOptions: options
      }
    };

    let position = 0;
    while (position < tokens.length) {
      const node = this.parseNode(tokens, position);
      if (node) {
        ast.children.push(node.node);
        position = node.nextPosition;
      } else {
        position++;
      }
    }

    return ast;
  }

  parseNode(tokens, position) {
    if (position >= tokens.length) return null;
    
    const token = tokens[position];
    
    switch (token.type) {
      case 'COMMAND':
        return this.parseCommand(tokens, position);
      case 'TEXT':
        return {
          node: { type: 'text', value: token.value },
          nextPosition: position + 1
        };
      case 'MATH_DELIMITER':
        return this.parseMath(tokens, position);
      case 'COMMENT':
        return {
          node: { type: 'comment', value: token.value },
          nextPosition: position + 1
        };
      default:
        return {
          node: { type: 'literal', value: token.value },
          nextPosition: position + 1
        };
    }
  }

  parseCommand(tokens, position) {
    const command = tokens[position];
    const node = {
      type: 'command',
      name: command.value,
      arguments: [],
      options: []
    };

    let pos = position + 1;
    
    // Parse optional arguments [...]
    while (pos < tokens.length && tokens[pos].type === 'LBRACKET') {
      const optArg = this.parseDelimited(tokens, pos, 'LBRACKET', 'RBRACKET');
      if (optArg) {
        node.options.push(optArg.content);
        pos = optArg.nextPosition;
      } else {
        break;
      }
    }

    // Parse required arguments {...}
    while (pos < tokens.length && tokens[pos].type === 'LBRACE') {
      const reqArg = this.parseDelimited(tokens, pos, 'LBRACE', 'RBRACE');
      if (reqArg) {
        node.arguments.push(reqArg.content);
        pos = reqArg.nextPosition;
      } else {
        break;
      }
    }

    return { node, nextPosition: pos };
  }

  parseMath(tokens, position) {
    const delimiter = tokens[position];
    const isDisplay = delimiter.value === '$$';
    
    const content = [];
    let pos = position + 1;
    
    while (pos < tokens.length) {
      if (tokens[pos].type === 'MATH_DELIMITER' && tokens[pos].value === delimiter.value) {
        pos++;
        break;
      }
      content.push(tokens[pos].value);
      pos++;
    }

    return {
      node: {
        type: 'math',
        displayMode: isDisplay,
        content: content.join('')
      },
      nextPosition: pos
    };
  }

  parseDelimited(tokens, position, openType, closeType) {
    if (tokens[position].type !== openType) return null;
    
    let pos = position + 1;
    let depth = 1;
    const content = [];
    
    while (pos < tokens.length && depth > 0) {
      if (tokens[pos].type === openType) {
        depth++;
      } else if (tokens[pos].type === closeType) {
        depth--;
      }
      
      if (depth > 0) {
        content.push(tokens[pos].value);
      }
      pos++;
    }

    return depth === 0 ? { content: content.join(''), nextPosition: pos } : null;
  }

  countNodes(ast) {
    let count = 1;
    if (ast.children) {
      count += ast.children.reduce((sum, child) => sum + this.countNodes(child), 0);
    }
    return count;
  }

  /**
   * Full document compilation
   */
  async compileDocument(latex, options = {}) {
    try {
      logger.info('Compiling full LaTeX document', { 
        latexLength: latex.length, 
        format: options.format 
      });

      const result = {
        success: true,
        format: options.format || 'pdf',
        compilation: {
          passes: options.passes || 2,
          engine: options.engine || 'pdflatex'
        }
      };

      switch (options.format) {
        case 'html':
          const htmlResult = await this.renderToHtml(latex, options);
          result.output = htmlResult.html;
          result.contentType = 'text/html';
          break;
        
        case 'pdf':
          const pdfResult = await this.renderToPdf(latex, options);
          result.output = pdfResult.pdf;
          result.contentType = 'application/pdf';
          result.size = pdfResult.size;
          break;
        
        case 'tex':
          // Return processed LaTeX (could include macro expansion, etc.)
          result.output = latex;
          result.contentType = 'text/plain';
          break;
        
        default:
          throw new AppError(`Unsupported format: ${options.format}`, 400);
      }

      return result;
    } catch (error) {
      logger.error('Document compilation failed', { error: error.message });
      throw new AppError(`Compilation failed: ${error.message}`, 500);
    }
  }
}

// Singleton instance
const latexService = new LaTeXService();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await latexService.closeBrowser();
});

process.on('SIGINT', async () => {
  await latexService.closeBrowser();
});

module.exports = latexService;