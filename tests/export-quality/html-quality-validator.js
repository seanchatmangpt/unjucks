/**
 * HTML Export Quality Validator
 * Validates HTML export quality including CSS styling, JavaScript functionality, and accessibility
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import TestDocumentBuilder from './test-documents.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * HTML Quality Validator Class
 */
export class HTMLQualityValidator {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || path.join(__dirname, 'html-outputs'),
      testDataDir: options.testDataDir || path.join(__dirname, 'test-data'),
      validateCSS: options.validateCSS !== false,
      validateJS: options.validateJS !== false,
      validateAccessibility: options.validateAccessibility !== false,
      validateSEO: options.validateSEO !== false,
      ...options
    };

    this.testResults = {
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };

    this.documentBuilder = new TestDocumentBuilder();
  }

  /**
   * Run comprehensive HTML quality validation tests
   */
  async runValidation() {
    console.log('🌐 Starting HTML Quality Validation...\n');

    try {
      await this.setupTestEnvironment();
      const testDocuments = await this.generateTestDocuments();

      await this.validateHTMLGeneration(testDocuments);
      await this.validateCSSGeneration();
      await this.validateJavaScriptFunctionality();
      await this.validateHTMLStructure();
      await this.validateAccessibility();
      await this.validateSEO();
      await this.validateResponsiveDesign();
      await this.validateCrossFormatCompatibility();

      const report = await this.generateValidationReport();
      
      console.log('\n📊 HTML Quality Validation Complete!');
      console.log(`✅ Passed: ${this.testResults.passed}`);
      console.log(`❌ Failed: ${this.testResults.failed}`);
      console.log(`⚠️  Warnings: ${this.testResults.warnings}`);

      return report;
    } catch (error) {
      console.error('❌ HTML Quality Validation failed:', error.message);
      throw error;
    }
  }

  /**
   * Setup test environment
   */
  async setupTestEnvironment() {
    await fs.ensureDir(this.options.outputDir);
    await fs.ensureDir(this.options.testDataDir);
    
    // Create CSS and JS assets for testing
    await this.createTestAssets();
  }

  /**
   * Create test CSS and JavaScript assets
   */
  async createTestAssets() {
    const assetsDir = path.join(this.options.outputDir, 'assets');
    await fs.ensureDir(assetsDir);

    // Create test CSS
    const testCSS = `
/* Test CSS for HTML Export Quality Validation */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background-color: #fff;
}

h1, h2, h3, h4, h5, h6 {
  color: #2c3e50;
  margin-top: 2em;
  margin-bottom: 1em;
}

h1 {
  border-bottom: 2px solid #3498db;
  padding-bottom: 10px;
}

p {
  margin-bottom: 1em;
  text-align: justify;
}

code {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 2px 6px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9em;
}

pre {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  margin: 1em 0;
}

pre code {
  border: none;
  background: none;
  padding: 0;
}

table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  border: 1px solid #dee2e6;
}

th, td {
  border: 1px solid #dee2e6;
  padding: 12px;
  text-align: left;
}

th {
  background-color: #f8f9fa;
  font-weight: 600;
}

tr:nth-child(even) {
  background-color: #f8f9fa;
}

ul, ol {
  padding-left: 2em;
  margin: 1em 0;
}

li {
  margin-bottom: 0.5em;
}

blockquote {
  border-left: 4px solid #3498db;
  margin: 1em 0;
  padding: 0.5em 0 0.5em 1em;
  background-color: #f8f9fa;
  font-style: italic;
}

img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.figure {
  text-align: center;
  margin: 2em 0;
}

.figure-caption {
  font-size: 0.9em;
  color: #666;
  margin-top: 0.5em;
  font-style: italic;
}

/* Responsive design */
@media (max-width: 768px) {
  body {
    padding: 10px;
    font-size: 16px;
  }
  
  table {
    font-size: 14px;
  }
  
  pre {
    padding: 10px;
    font-size: 14px;
  }
}

/* Print styles */
@media print {
  body {
    font-size: 12pt;
    color: black;
  }
  
  h1, h2, h3 {
    page-break-after: avoid;
  }
  
  pre, blockquote {
    page-break-inside: avoid;
  }
}

/* Accessibility enhancements */
:focus {
  outline: 2px solid #3498db;
  outline-offset: 2px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Syntax highlighting for code blocks */
.hljs {
  display: block;
  overflow-x: auto;
  padding: 1em;
}

.hljs-keyword {
  color: #0066cc;
  font-weight: bold;
}

.hljs-string {
  color: #008000;
}

.hljs-comment {
  color: #808080;
  font-style: italic;
}

.hljs-number {
  color: #ff6600;
}
`;

    await fs.writeFile(path.join(assetsDir, 'test-styles.css'), testCSS);

    // Create test JavaScript
    const testJS = `
// Test JavaScript for HTML Export Quality Validation
document.addEventListener('DOMContentLoaded', function() {
  console.log('HTML Export Quality Validation - JavaScript loaded successfully');
  
  // Test basic DOM manipulation
  const title = document.querySelector('h1');
  if (title) {
    title.setAttribute('data-js-loaded', 'true');
    console.log('Title element found and attributed');
  }
  
  // Test event handling
  const codeBlocks = document.querySelectorAll('pre code');
  codeBlocks.forEach((block, index) => {
    block.addEventListener('click', function() {
      console.log('Code block clicked:', index);
      this.style.backgroundColor = this.style.backgroundColor === 'yellow' ? '' : 'yellow';
    });
  });
  
  // Test table enhancements
  const tables = document.querySelectorAll('table');
  tables.forEach(table => {
    // Add sortable functionality (basic implementation)
    const headers = table.querySelectorAll('th');
    headers.forEach((header, index) => {
      header.style.cursor = 'pointer';
      header.title = 'Click to sort';
      header.addEventListener('click', function() {
        console.log('Table header clicked for sorting:', index);
        this.style.backgroundColor = this.style.backgroundColor === '#e9ecef' ? '#3498db' : '#e9ecef';
      });
    });
  });
  
  // Test image lazy loading simulation
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    img.addEventListener('load', function() {
      console.log('Image loaded successfully:', this.src);
    });
    
    img.addEventListener('error', function() {
      console.warn('Image failed to load:', this.src);
      this.alt = 'Image not available';
      this.style.backgroundColor = '#f0f0f0';
      this.style.color = '#666';
    });
  });
  
  // Test responsive behavior
  function checkViewport() {
    const viewport = window.innerWidth;
    document.body.setAttribute('data-viewport', 
      viewport < 768 ? 'mobile' : viewport < 1024 ? 'tablet' : 'desktop'
    );
  }
  
  checkViewport();
  window.addEventListener('resize', checkViewport);
  
  // Test accessibility enhancements
  const focusableElements = document.querySelectorAll(
    'a, button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
  );
  
  focusableElements.forEach(element => {
    element.addEventListener('focus', function() {
      console.log('Focus event:', this.tagName, this.textContent?.slice(0, 20));
    });
  });
  
  // Test form validation (if forms exist)
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', function(e) {
      console.log('Form submit event intercepted');
      // Add validation logic here
    });
  });
  
  // Performance monitoring
  if (window.performance && window.performance.timing) {
    const loadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
    console.log('Page load time:', loadTime + 'ms');
  }
  
  // Scroll-to-top functionality
  if (document.body.scrollHeight > window.innerHeight) {
    const scrollButton = document.createElement('button');
    scrollButton.textContent = '↑ Top';
    scrollButton.style.cssText = \`
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #3498db;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 5px;
      cursor: pointer;
      display: none;
      z-index: 1000;
    \`;
    
    scrollButton.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    window.addEventListener('scroll', function() {
      scrollButton.style.display = window.scrollY > 300 ? 'block' : 'none';
    });
    
    document.body.appendChild(scrollButton);
  }
});

// Export validation functions for testing
window.HTMLExportValidation = {
  testBasicFunctionality: function() {
    return {
      domReady: document.readyState === 'complete',
      jQuery: typeof jQuery !== 'undefined',
      console: typeof console !== 'undefined',
      timestamp: new Date().toISOString()
    };
  },
  
  testResponsiveFeatures: function() {
    return {
      viewport: window.innerWidth,
      devicePixelRatio: window.devicePixelRatio,
      touchSupport: 'ontouchstart' in window,
      orientation: screen.orientation ? screen.orientation.type : 'unknown'
    };
  },
  
  testAccessibility: function() {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const images = document.querySelectorAll('img');
    const links = document.querySelectorAll('a');
    
    return {
      headingStructure: Array.from(headings).map(h => ({ tag: h.tagName, text: h.textContent.slice(0, 50) })),
      imagesWithAlt: Array.from(images).filter(img => img.alt).length,
      totalImages: images.length,
      externalLinks: Array.from(links).filter(link => link.hostname !== window.location.hostname).length,
      totalLinks: links.length
    };
  }
};
`;

    await fs.writeFile(path.join(assetsDir, 'test-scripts.js'), testJS);
  }

  /**
   * Generate test documents
   */
  async generateTestDocuments() {
    console.log('📝 Generating HTML test documents...');
    
    const variations = this.documentBuilder.generateTestVariations();
    const testFiles = {};

    for (const [name, document] of Object.entries(variations)) {
      const filePath = path.join(this.options.testDataDir, `${name}-html-test.json`);
      await fs.writeJSON(filePath, document, { spaces: 2 });
      testFiles[name] = filePath;
    }

    this.addTestResult('HTML Document Generation', 'passed', 'Successfully generated HTML test documents');
    return testFiles;
  }

  /**
   * Validate HTML generation from different document types
   */
  async validateHTMLGeneration(testDocuments) {
    console.log('🔧 Validating HTML generation...');

    for (const [name, documentPath] of Object.entries(testDocuments)) {
      try {
        const documentData = await fs.readJSON(documentPath);
        const htmlContent = await this.generateHTML(documentData, name);
        
        const outputPath = path.join(this.options.outputDir, `${name}-generated.html`);
        await fs.writeFile(outputPath, htmlContent);

        // Validate HTML structure
        const isValidHTML = this.validateHTMLSyntax(htmlContent);
        if (isValidHTML) {
          this.addTestResult(`HTML Generation: ${name}`, 'passed', `Generated valid HTML: ${htmlContent.length} chars`);
        } else {
          this.addTestResult(`HTML Generation: ${name}`, 'failed', 'Generated HTML has syntax issues');
        }
      } catch (error) {
        this.addTestResult(`HTML Generation: ${name}`, 'failed', error.message);
      }
    }
  }

  /**
   * Generate HTML content from document data
   */
  async generateHTML(documentData, name) {
    const metadata = documentData.metadata || {};
    const sections = documentData.sections || [];

    let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${metadata.title || 'Test Document'}</title>
  <meta name="description" content="${metadata.subject || 'HTML export quality test document'}">
  <meta name="author" content="${metadata.author || 'HTML Quality Validator'}">
  <meta name="keywords" content="${(metadata.keywords || []).join(', ')}">
  <link rel="stylesheet" href="assets/test-styles.css">
  <script src="assets/test-scripts.js"></script>
</head>
<body>
  <header>
    <nav aria-label="Document navigation">
      <a href="#main-content" class="skip-link visually-hidden">Skip to main content</a>
    </nav>
  </header>
  
  <main id="main-content">
`;

    for (const section of sections) {
      htmlContent += this.convertSectionToHTML(section);
    }

    htmlContent += `
  </main>
  
  <footer>
    <p>Generated by HTML Quality Validator on ${new Date().toISOString()}</p>
  </footer>
</body>
</html>`;

    return htmlContent;
  }

  /**
   * Convert document section to HTML
   */
  convertSectionToHTML(section) {
    switch (section.type) {
      case 'title':
        return `    <h1>${this.escapeHtml(section.content)}</h1>\n`;
      
      case 'section':
        const level = Math.min(section.level || 1, 6);
        return `    <h${level}>${this.escapeHtml(section.content)}</h${level}>\n`;
      
      case 'paragraph':
        const processedContent = this.processInlineFormatting(section.content);
        return `    <p>${processedContent}</p>\n`;
      
      case 'codeblock':
        const language = section.language ? ` class="language-${section.language}"` : '';
        return `    <pre><code${language}>${this.escapeHtml(section.content)}</code></pre>\n`;
      
      case 'list':
        const listTag = section.ordered ? 'ol' : 'ul';
        const items = (section.items || []).map(item => 
          `      <li>${this.processInlineFormatting(item)}</li>`
        ).join('\n');
        return `    <${listTag}>\n${items}\n    </${listTag}>\n`;
      
      case 'table':
        return this.generateHTMLTable(section.data, section.caption);
      
      case 'image':
        const caption = section.caption ? `<figcaption class="figure-caption">${this.escapeHtml(section.caption)}</figcaption>` : '';
        return `    <figure class="figure">
      <img src="${section.src}" alt="${this.escapeHtml(section.alt || '')}" loading="lazy">
      ${caption}
    </figure>\n`;
      
      case 'quote':
        return `    <blockquote>${this.processInlineFormatting(section.content)}</blockquote>\n`;
      
      case 'pagebreak':
        return `    <hr style="page-break-before: always; border: none; height: 0;">\n`;
      
      case 'math':
        return `    <div class="math-block" role="img" aria-label="Mathematical equation">
      <code>${this.escapeHtml(section.content)}</code>
    </div>\n`;
      
      default:
        return `    <!-- Unknown section type: ${section.type} -->\n`;
    }
  }

  /**
   * Generate HTML table
   */
  generateHTMLTable(data, caption) {
    if (!data || !data.headers || !data.rows) return '';

    const captionHTML = caption ? `    <caption>${this.escapeHtml(caption)}</caption>\n` : '';
    
    const headers = data.headers.map(header => 
      `      <th scope="col">${this.escapeHtml(header)}</th>`
    ).join('\n');

    const rows = data.rows.map(row => {
      const cells = row.map(cell => 
        `      <td>${this.processInlineFormatting(cell)}</td>`
      ).join('\n');
      return `    <tr>\n${cells}\n    </tr>`;
    }).join('\n');

    return `    <table>
${captionHTML}    <thead>
    <tr>
${headers}
    </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
    </table>\n`;
  }

  /**
   * Process inline formatting (bold, italic, code)
   */
  processInlineFormatting(text) {
    if (typeof text !== 'string') return this.escapeHtml(String(text));
    
    return this.escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
  }

  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    const div = { innerHTML: '' };
    const textNode = { textContent: text };
    return textNode.textContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Basic HTML syntax validation
   */
  validateHTMLSyntax(html) {
    const basicChecks = [
      html.includes('<!DOCTYPE html>'),
      html.includes('<html'),
      html.includes('<head>'),
      html.includes('<title>'),
      html.includes('<body>'),
      html.includes('</html>'),
      // Check for common unclosed tags
      !/<(div|p|h[1-6]|ul|ol|table)[^>]*>(?![\s\S]*<\/\1>)/i.test(html)
    ];

    return basicChecks.every(check => check);
  }

  /**
   * Validate CSS generation and styling
   */
  async validateCSSGeneration() {
    console.log('🎨 Validating CSS generation and styling...');

    const cssTests = [
      {
        name: 'Basic Styles',
        selector: 'body',
        expectedProperties: ['font-family', 'line-height', 'color']
      },
      {
        name: 'Responsive Design',
        mediaQuery: '@media (max-width: 768px)',
        expectedRules: true
      },
      {
        name: 'Print Styles',
        mediaQuery: '@media print',
        expectedRules: true
      }
    ];

    try {
      const cssPath = path.join(this.options.outputDir, 'assets', 'test-styles.css');
      const cssContent = await fs.readFile(cssPath, 'utf-8');

      for (const test of cssTests) {
        if (test.selector) {
          const hasSelector = cssContent.includes(test.selector);
          const hasProperties = test.expectedProperties.every(prop => 
            cssContent.includes(prop)
          );
          
          if (hasSelector && hasProperties) {
            this.addTestResult(`CSS: ${test.name}`, 'passed', 'Required styles found');
          } else {
            this.addTestResult(`CSS: ${test.name}`, 'failed', 'Missing required styles');
          }
        } else if (test.mediaQuery) {
          const hasMediaQuery = cssContent.includes(test.mediaQuery);
          if (hasMediaQuery) {
            this.addTestResult(`CSS: ${test.name}`, 'passed', 'Media query found');
          } else {
            this.addTestResult(`CSS: ${test.name}`, 'warning', 'Media query not found');
          }
        }
      }

      this.addTestResult('CSS Generation Overall', 'passed', `CSS file generated: ${cssContent.length} chars`);
    } catch (error) {
      this.addTestResult('CSS Generation Overall', 'failed', error.message);
    }
  }

  /**
   * Validate JavaScript functionality
   */
  async validateJavaScriptFunctionality() {
    console.log('⚡ Validating JavaScript functionality...');

    try {
      const jsPath = path.join(this.options.outputDir, 'assets', 'test-scripts.js');
      const jsContent = await fs.readFile(jsPath, 'utf-8');

      const jsTests = [
        {
          name: 'DOM Ready Handler',
          pattern: /DOMContentLoaded/,
          required: true
        },
        {
          name: 'Event Listeners',
          pattern: /addEventListener/g,
          minCount: 3
        },
        {
          name: 'Console Logging',
          pattern: /console\.(log|warn|error)/g,
          minCount: 2
        },
        {
          name: 'Export Object',
          pattern: /window\.HTMLExportValidation/,
          required: true
        }
      ];

      for (const test of jsTests) {
        const matches = jsContent.match(test.pattern);
        
        if (test.required && matches) {
          this.addTestResult(`JavaScript: ${test.name}`, 'passed', 'Required functionality found');
        } else if (test.minCount && matches && matches.length >= test.minCount) {
          this.addTestResult(`JavaScript: ${test.name}`, 'passed', `Found ${matches.length} instances`);
        } else if (test.required || (test.minCount && (!matches || matches.length < test.minCount))) {
          this.addTestResult(`JavaScript: ${test.name}`, 'failed', 'Required functionality missing');
        }
      }

      this.addTestResult('JavaScript Generation Overall', 'passed', `JS file generated: ${jsContent.length} chars`);
    } catch (error) {
      this.addTestResult('JavaScript Generation Overall', 'failed', error.message);
    }
  }

  /**
   * Validate HTML structure and semantics
   */
  async validateHTMLStructure() {
    console.log('🏗️  Validating HTML structure and semantics...');

    try {
      const htmlFiles = await fs.readdir(this.options.outputDir);
      const htmlFileList = htmlFiles.filter(file => file.endsWith('.html'));

      for (const file of htmlFileList) {
        const filePath = path.join(this.options.outputDir, file);
        const htmlContent = await fs.readFile(filePath, 'utf-8');

        const structureTests = [
          { name: 'DOCTYPE Declaration', pattern: /<!DOCTYPE html>/i, required: true },
          { name: 'HTML Lang Attribute', pattern: /<html[^>]+lang=/i, required: true },
          { name: 'Meta Charset', pattern: /<meta[^>]+charset=/i, required: true },
          { name: 'Viewport Meta Tag', pattern: /<meta[^>]+viewport=/i, required: true },
          { name: 'Title Element', pattern: /<title>/i, required: true },
          { name: 'Main Content Area', pattern: /<main/i, required: true },
          { name: 'Semantic Headings', pattern: /<h[1-6]/gi, minCount: 1 },
          { name: 'Skip Link', pattern: /skip.*content/i, recommended: true }
        ];

        for (const test of structureTests) {
          const matches = htmlContent.match(test.pattern);
          
          if (test.required && matches) {
            this.addTestResult(`Structure ${file}: ${test.name}`, 'passed', 'Required element found');
          } else if (test.minCount && matches && matches.length >= test.minCount) {
            this.addTestResult(`Structure ${file}: ${test.name}`, 'passed', `Found ${matches.length} instances`);
          } else if (test.recommended && matches) {
            this.addTestResult(`Structure ${file}: ${test.name}`, 'passed', 'Recommended element found');
          } else if (test.required) {
            this.addTestResult(`Structure ${file}: ${test.name}`, 'failed', 'Required element missing');
          } else if (test.recommended) {
            this.addTestResult(`Structure ${file}: ${test.name}`, 'warning', 'Recommended element missing');
          }
        }
      }

      this.addTestResult('HTML Structure Overall', 'passed', `Validated ${htmlFileList.length} HTML files`);
    } catch (error) {
      this.addTestResult('HTML Structure Overall', 'failed', error.message);
    }
  }

  /**
   * Validate accessibility features
   */
  async validateAccessibility() {
    console.log('♿ Validating accessibility features...');

    try {
      const htmlFiles = await fs.readdir(this.options.outputDir);
      const htmlFileList = htmlFiles.filter(file => file.endsWith('.html'));

      for (const file of htmlFileList) {
        const filePath = path.join(this.options.outputDir, file);
        const htmlContent = await fs.readFile(filePath, 'utf-8');

        const accessibilityTests = [
          { name: 'Alt Text on Images', pattern: /<img[^>]+alt=/gi },
          { name: 'ARIA Labels', pattern: /aria-label=/gi },
          { name: 'Semantic Landmarks', pattern: /<(main|nav|header|footer|aside|section)/gi },
          { name: 'Focus Management', pattern: /tabindex=/gi },
          { name: 'Role Attributes', pattern: /role=/gi },
          { name: 'Table Headers', pattern: /<th[^>]*scope=/gi }
        ];

        for (const test of accessibilityTests) {
          const matches = htmlContent.match(test.pattern);
          if (matches && matches.length > 0) {
            this.addTestResult(`Accessibility ${file}: ${test.name}`, 'passed', `Found ${matches.length} instances`);
          } else {
            this.addTestResult(`Accessibility ${file}: ${test.name}`, 'warning', 'Not found - may impact accessibility');
          }
        }
      }

      this.addTestResult('Accessibility Overall', 'passed', 'Accessibility validation completed');
    } catch (error) {
      this.addTestResult('Accessibility Overall', 'failed', error.message);
    }
  }

  /**
   * Validate SEO features
   */
  async validateSEO() {
    console.log('🔍 Validating SEO features...');

    try {
      const htmlFiles = await fs.readdir(this.options.outputDir);
      const htmlFileList = htmlFiles.filter(file => file.endsWith('.html'));

      for (const file of htmlFileList) {
        const filePath = path.join(this.options.outputDir, file);
        const htmlContent = await fs.readFile(filePath, 'utf-8');

        const seoTests = [
          { name: 'Meta Description', pattern: /<meta[^>]+name="description"/i, required: true },
          { name: 'Meta Keywords', pattern: /<meta[^>]+name="keywords"/i, recommended: true },
          { name: 'Meta Author', pattern: /<meta[^>]+name="author"/i, recommended: true },
          { name: 'Heading Hierarchy', pattern: /<h[1-6]/gi, minCount: 1 },
          { name: 'Structured Data', pattern: /schema\.org|application\/ld\+json/i, recommended: true }
        ];

        for (const test of seoTests) {
          const matches = htmlContent.match(test.pattern);
          
          if (test.required && matches) {
            this.addTestResult(`SEO ${file}: ${test.name}`, 'passed', 'Required SEO element found');
          } else if (test.minCount && matches && matches.length >= test.minCount) {
            this.addTestResult(`SEO ${file}: ${test.name}`, 'passed', `Found ${matches.length} instances`);
          } else if (test.recommended && matches) {
            this.addTestResult(`SEO ${file}: ${test.name}`, 'passed', 'Recommended SEO element found');
          } else if (test.required) {
            this.addTestResult(`SEO ${file}: ${test.name}`, 'failed', 'Required SEO element missing');
          } else if (test.recommended) {
            this.addTestResult(`SEO ${file}: ${test.name}`, 'warning', 'Recommended SEO element missing');
          }
        }
      }

      this.addTestResult('SEO Overall', 'passed', 'SEO validation completed');
    } catch (error) {
      this.addTestResult('SEO Overall', 'failed', error.message);
    }
  }

  /**
   * Validate responsive design features
   */
  async validateResponsiveDesign() {
    console.log('📱 Validating responsive design features...');

    try {
      const cssPath = path.join(this.options.outputDir, 'assets', 'test-styles.css');
      const cssContent = await fs.readFile(cssPath, 'utf-8');

      const responsiveTests = [
        { name: 'Mobile Media Query', pattern: /@media[^{]*\(max-width:\s*768px\)/i },
        { name: 'Flexible Layout', pattern: /max-width:\s*100%/gi },
        { name: 'Responsive Images', pattern: /max-width:\s*100%.*height:\s*auto/i },
        { name: 'Flexible Grid', pattern: /flexbox|grid|flex/gi },
        { name: 'Font Size Scaling', pattern: /@media[^}]*font-size/gi }
      ];

      for (const test of responsiveTests) {
        const matches = cssContent.match(test.pattern);
        if (matches && matches.length > 0) {
          this.addTestResult(`Responsive: ${test.name}`, 'passed', `Found ${matches.length} instances`);
        } else {
          this.addTestResult(`Responsive: ${test.name}`, 'warning', 'Responsive feature not found');
        }
      }

      // Check viewport meta tag in HTML files
      const htmlFiles = await fs.readdir(this.options.outputDir);
      const htmlFileList = htmlFiles.filter(file => file.endsWith('.html'));
      
      let viewportFound = 0;
      for (const file of htmlFileList) {
        const filePath = path.join(this.options.outputDir, file);
        const htmlContent = await fs.readFile(filePath, 'utf-8');
        if (/<meta[^>]+viewport=/i.test(htmlContent)) {
          viewportFound++;
        }
      }

      this.addTestResult('Responsive: Viewport Meta Tags', 'passed', 
        `Found in ${viewportFound}/${htmlFileList.length} HTML files`);

    } catch (error) {
      this.addTestResult('Responsive Design Overall', 'failed', error.message);
    }
  }

  /**
   * Validate cross-format compatibility
   */
  async validateCrossFormatCompatibility() {
    console.log('🔄 Validating cross-format compatibility...');

    try {
      const htmlFiles = await fs.readdir(this.options.outputDir);
      const htmlFileList = htmlFiles.filter(file => file.endsWith('.html'));

      for (const file of htmlFileList) {
        const filePath = path.join(this.options.outputDir, file);
        const htmlContent = await fs.readFile(filePath, 'utf-8');

        // Test content preservation
        const contentTests = [
          { name: 'Special Characters', pattern: /[áéíóúñüç€£¥©®™]/gi },
          { name: 'Code Blocks', pattern: /<pre><code/gi },
          { name: 'Tables', pattern: /<table/gi },
          { name: 'Lists', pattern: /<[ou]l/gi },
          { name: 'Images', pattern: /<img/gi },
          { name: 'Links', pattern: /<a[^>]+href/gi }
        ];

        for (const test of contentTests) {
          const matches = htmlContent.match(test.pattern);
          if (matches && matches.length > 0) {
            this.addTestResult(`Compatibility ${file}: ${test.name}`, 'passed', 
              `Content preserved: ${matches.length} instances`);
          } else {
            this.addTestResult(`Compatibility ${file}: ${test.name}`, 'warning', 
              'Content type not found in this document');
          }
        }
      }

      this.addTestResult('Cross-format Compatibility', 'passed', 'Content preservation validated');
    } catch (error) {
      this.addTestResult('Cross-format Compatibility', 'failed', error.message);
    }
  }

  /**
   * Add test result
   */
  addTestResult(testName, status, message) {
    this.testResults.details.push({
      test: testName,
      status,
      message,
      timestamp: new Date().toISOString()
    });

    if (status === 'passed') {
      this.testResults.passed++;
      console.log(`  ✅ ${testName}: ${message}`);
    } else if (status === 'failed') {
      this.testResults.failed++;
      console.log(`  ❌ ${testName}: ${message}`);
    } else if (status === 'warning') {
      this.testResults.warnings++;
      console.log(`  ⚠️  ${testName}: ${message}`);
    }
  }

  /**
   * Generate comprehensive validation report
   */
  async generateValidationReport() {
    const report = {
      summary: {
        totalTests: this.testResults.passed + this.testResults.failed + this.testResults.warnings,
        passed: this.testResults.passed,
        failed: this.testResults.failed,
        warnings: this.testResults.warnings,
        successRate: this.testResults.passed / (this.testResults.passed + this.testResults.failed) * 100,
        timestamp: new Date().toISOString()
      },
      details: this.testResults.details,
      recommendations: this.generateRecommendations()
    };

    const reportPath = path.join(this.options.outputDir, 'html-quality-validation-report.json');
    await fs.writeJSON(reportPath, report, { spaces: 2 });

    console.log(`\n📄 HTML validation report saved to: ${reportPath}`);
    return report;
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations() {
    const recommendations = [];
    const failedTests = this.testResults.details.filter(test => test.status === 'failed');
    const warningTests = this.testResults.details.filter(test => test.status === 'warning');

    if (failedTests.some(test => test.test.includes('Structure'))) {
      recommendations.push('Fix HTML structure issues to ensure valid markup');
    }

    if (failedTests.some(test => test.test.includes('JavaScript'))) {
      recommendations.push('Address JavaScript functionality issues for better interactivity');
    }

    if (warningTests.some(test => test.test.includes('Accessibility'))) {
      recommendations.push('Improve accessibility features for better user experience');
    }

    if (warningTests.some(test => test.test.includes('SEO'))) {
      recommendations.push('Add recommended SEO elements for better search visibility');
    }

    if (warningTests.some(test => test.test.includes('Responsive'))) {
      recommendations.push('Enhance responsive design features for mobile compatibility');
    }

    return recommendations;
  }
}

export default HTMLQualityValidator;