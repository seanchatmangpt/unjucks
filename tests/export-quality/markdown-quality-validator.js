/**
 * Markdown Export Quality Validator
 * Validates Markdown export formatting, syntax compliance, and cross-platform compatibility
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import TestDocumentBuilder from './test-documents.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Markdown Quality Validator Class
 */
export class MarkdownQualityValidator {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || path.join(__dirname, 'markdown-outputs'),
      testDataDir: options.testDataDir || path.join(__dirname, 'test-data'),
      validateGFM: options.validateGFM !== false, // GitHub Flavored Markdown
      validateCommonMark: options.validateCommonMark !== false,
      validateExtensions: options.validateExtensions !== false,
      ...options
    };

    this.testResults = {
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };

    this.documentBuilder = new TestDocumentBuilder();
    
    // Markdown syntax patterns for validation
    this.syntaxPatterns = {
      headers: /^#{1,6}\s+.+$/gm,
      boldText: /\*\*.+?\*\*/g,
      italicText: /(?<!\*)\*(?!\*).+?\*(?!\*)/g,
      inlineCode: /`.+?`/g,
      codeBlocks: /^```[\s\S]*?```$/gm,
      unorderedLists: /^\s*[-*+]\s+.+$/gm,
      orderedLists: /^\s*\d+\.\s+.+$/gm,
      links: /\[.+?\]\(.+?\)/g,
      images: /!\[.*?\]\(.+?\)/g,
      tables: /^\|.+\|$/gm,
      blockquotes: /^>\s*.+$/gm,
      horizontalRules: /^---+$/gm
    };
  }

  /**
   * Run comprehensive Markdown quality validation tests
   */
  async runValidation() {
    console.log('📝 Starting Markdown Quality Validation...\n');

    try {
      await this.setupTestEnvironment();
      const testDocuments = await this.generateTestDocuments();

      await this.validateMarkdownGeneration(testDocuments);
      await this.validateSyntaxCompliance();
      await this.validateGitHubFlavoredMarkdown();
      await this.validateCommonMarkCompliance();
      await this.validateTableFormatting();
      await this.validateCodeBlockHandling();
      await this.validateLinkValidation();
      await this.validateImageHandling();
      await this.validateCrossPlatformCompatibility();
      await this.validateMetadataPreservation();

      const report = await this.generateValidationReport();
      
      console.log('\n📊 Markdown Quality Validation Complete!');
      console.log(`✅ Passed: ${this.testResults.passed}`);
      console.log(`❌ Failed: ${this.testResults.failed}`);
      console.log(`⚠️  Warnings: ${this.testResults.warnings}`);

      return report;
    } catch (error) {
      console.error('❌ Markdown Quality Validation failed:', error.message);
      throw error;
    }
  }

  /**
   * Setup test environment
   */
  async setupTestEnvironment() {
    await fs.ensureDir(this.options.outputDir);
    await fs.ensureDir(this.options.testDataDir);
  }

  /**
   * Generate test documents
   */
  async generateTestDocuments() {
    console.log('📝 Generating Markdown test documents...');
    
    const variations = this.documentBuilder.generateTestVariations();
    const testFiles = {};

    for (const [name, document] of Object.entries(variations)) {
      const filePath = path.join(this.options.testDataDir, `${name}-markdown-test.json`);
      await fs.writeJSON(filePath, document, { spaces: 2 });
      testFiles[name] = filePath;
    }

    this.addTestResult('Markdown Document Generation', 'passed', 'Successfully generated Markdown test documents');
    return testFiles;
  }

  /**
   * Validate Markdown generation from different document types
   */
  async validateMarkdownGeneration(testDocuments) {
    console.log('🔧 Validating Markdown generation...');

    for (const [name, documentPath] of Object.entries(testDocuments)) {
      try {
        const documentData = await fs.readJSON(documentPath);
        const markdownContent = this.generateMarkdown(documentData, name);
        
        const outputPath = path.join(this.options.outputDir, `${name}-generated.md`);
        await fs.writeFile(outputPath, markdownContent);

        // Validate Markdown structure
        const isValidMarkdown = this.validateMarkdownSyntax(markdownContent);
        if (isValidMarkdown.isValid) {
          this.addTestResult(`Markdown Generation: ${name}`, 'passed', 
            `Generated valid Markdown: ${markdownContent.length} chars, ${isValidMarkdown.elements} elements`);
        } else {
          this.addTestResult(`Markdown Generation: ${name}`, 'failed', 
            `Markdown syntax issues: ${isValidMarkdown.errors.join(', ')}`);
        }
      } catch (error) {
        this.addTestResult(`Markdown Generation: ${name}`, 'failed', error.message);
      }
    }
  }

  /**
   * Generate Markdown content from document data
   */
  generateMarkdown(documentData, name) {
    const metadata = documentData.metadata || {};
    const sections = documentData.sections || [];

    let markdownContent = '';

    // Add frontmatter if metadata exists
    if (Object.keys(metadata).length > 0) {
      markdownContent += '---\n';
      for (const [key, value] of Object.entries(metadata)) {
        if (Array.isArray(value)) {
          markdownContent += `${key}:\n${value.map(v => `  - ${v}`).join('\n')}\n`;
        } else {
          markdownContent += `${key}: ${value}\n`;
        }
      }
      markdownContent += '---\n\n';
    }

    // Convert sections to Markdown
    for (const section of sections) {
      markdownContent += this.convertSectionToMarkdown(section);
    }

    return markdownContent;
  }

  /**
   * Convert document section to Markdown
   */
  convertSectionToMarkdown(section) {
    switch (section.type) {
      case 'title':
        return `# ${section.content}\n\n`;
      
      case 'section':
        const level = Math.min(section.level || 1, 6);
        const hashes = '#'.repeat(level);
        return `${hashes} ${section.content}\n\n`;
      
      case 'paragraph':
        const processedContent = this.processInlineFormatting(section.content);
        return `${processedContent}\n\n`;
      
      case 'codeblock':
        const language = section.language || '';
        return `\`\`\`${language}\n${section.content}\n\`\`\`\n\n`;
      
      case 'list':
        const items = (section.items || []).map((item, index) => {
          const processedItem = this.processInlineFormatting(item);
          if (section.ordered) {
            return `${index + 1}. ${processedItem}`;
          } else {
            return `- ${processedItem}`;
          }
        }).join('\n');
        return `${items}\n\n`;
      
      case 'table':
        return this.generateMarkdownTable(section.data, section.caption);
      
      case 'image':
        const alt = section.alt || '';
        const caption = section.caption ? `\n\n*${section.caption}*` : '';
        return `![${alt}](${section.src})${caption}\n\n`;
      
      case 'quote':
        const quoteLines = section.content.split('\n')
          .map(line => `> ${line}`)
          .join('\n');
        return `${quoteLines}\n\n`;
      
      case 'pagebreak':
        return `---\n\n`;
      
      case 'math':
        // Use LaTeX math syntax (supported by many Markdown renderers)
        if (section.content.includes('$$')) {
          return `${section.content}\n\n`;
        } else {
          return `$$${section.content}$$\n\n`;
        }
      
      default:
        return `<!-- Unknown section type: ${section.type} -->\n\n`;
    }
  }

  /**
   * Generate Markdown table
   */
  generateMarkdownTable(data, caption) {
    if (!data || !data.headers || !data.rows) return '';

    let table = '';
    
    // Add caption if provided
    if (caption) {
      table += `*${caption}*\n\n`;
    }

    // Generate headers
    const headers = data.headers.map(header => this.escapeMarkdown(header));
    table += `| ${headers.join(' | ')} |\n`;
    
    // Generate separator
    const separator = data.headers.map(() => '---');
    table += `| ${separator.join(' | ')} |\n`;
    
    // Generate rows
    for (const row of data.rows) {
      const cells = row.map(cell => this.escapeMarkdown(String(cell)));
      table += `| ${cells.join(' | ')} |\n`;
    }
    
    return `${table}\n`;
  }

  /**
   * Process inline formatting
   */
  processInlineFormatting(text) {
    if (typeof text !== 'string') return this.escapeMarkdown(String(text));
    
    // Convert formatting but keep Markdown syntax
    return text
      .replace(/\*\*(.*?)\*\*/g, '**$1**') // Bold (already correct)
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '*$1*') // Italic (already correct)
      .replace(/`(.*?)`/g, '`$1`'); // Code (already correct)
  }

  /**
   * Escape Markdown special characters in table cells
   */
  escapeMarkdown(text) {
    return text
      .replace(/\|/g, '\\|')
      .replace(/\n/g, ' ')
      .trim();
  }

  /**
   * Validate Markdown syntax
   */
  validateMarkdownSyntax(markdown) {
    const errors = [];
    let elementCount = 0;

    // Check for common syntax issues
    const checks = [
      {
        name: 'Unmatched code blocks',
        pattern: /```/g,
        validator: (matches) => matches && matches.length % 2 === 0
      },
      {
        name: 'Unmatched bold formatting',
        pattern: /\*\*/g,
        validator: (matches) => matches && matches.length % 2 === 0
      },
      {
        name: 'Unmatched italic formatting',
        pattern: /(?<!\*)\*(?!\*)/g,
        validator: (matches) => matches && matches.length % 2 === 0
      },
      {
        name: 'Unmatched inline code',
        pattern: /`/g,
        validator: (matches) => matches && matches.length % 2 === 0
      }
    ];

    for (const check of checks) {
      const matches = markdown.match(check.pattern);
      if (!check.validator(matches)) {
        errors.push(check.name);
      }
    }

    // Count elements
    for (const [name, pattern] of Object.entries(this.syntaxPatterns)) {
      const matches = markdown.match(pattern);
      if (matches) {
        elementCount += matches.length;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      elements: elementCount
    };
  }

  /**
   * Validate syntax compliance
   */
  async validateSyntaxCompliance() {
    console.log('📋 Validating Markdown syntax compliance...');

    const markdownFiles = await fs.readdir(this.options.outputDir);
    const mdFiles = markdownFiles.filter(file => file.endsWith('.md'));

    for (const file of mdFiles) {
      const filePath = path.join(this.options.outputDir, file);
      const content = await fs.readFile(filePath, 'utf-8');

      const syntaxTests = [
        {
          name: 'Headers',
          pattern: this.syntaxPatterns.headers,
          description: 'ATX-style headers (# ## ###)'
        },
        {
          name: 'Bold Text',
          pattern: this.syntaxPatterns.boldText,
          description: 'Bold text formatting (**text**)'
        },
        {
          name: 'Italic Text',
          pattern: this.syntaxPatterns.italicText,
          description: 'Italic text formatting (*text*)'
        },
        {
          name: 'Code Blocks',
          pattern: this.syntaxPatterns.codeBlocks,
          description: 'Fenced code blocks (```)'
        },
        {
          name: 'Lists',
          pattern: new RegExp(this.syntaxPatterns.unorderedLists.source + '|' + this.syntaxPatterns.orderedLists.source, 'gm'),
          description: 'Unordered and ordered lists'
        }
      ];

      for (const test of syntaxTests) {
        const matches = content.match(test.pattern);
        if (matches && matches.length > 0) {
          this.addTestResult(`Syntax ${file}: ${test.name}`, 'passed', 
            `Found ${matches.length} instances - ${test.description}`);
        } else {
          this.addTestResult(`Syntax ${file}: ${test.name}`, 'warning', 
            `No instances found - ${test.description}`);
        }
      }
    }
  }

  /**
   * Validate GitHub Flavored Markdown features
   */
  async validateGitHubFlavoredMarkdown() {
    console.log('🐙 Validating GitHub Flavored Markdown features...');

    const gfmTests = [
      {
        name: 'Tables',
        pattern: this.syntaxPatterns.tables,
        description: 'GFM table syntax'
      },
      {
        name: 'Strikethrough',
        pattern: /~~.+?~~/g,
        description: 'Strikethrough text (~~text~~)'
      },
      {
        name: 'Task Lists',
        pattern: /^\s*-\s+\[[x\s]\]\s+/gm,
        description: 'Task list items (- [ ] or - [x])'
      },
      {
        name: 'Mentions',
        pattern: /@\w+/g,
        description: 'User mentions (@username)'
      },
      {
        name: 'Issue References',
        pattern: /#\d+/g,
        description: 'Issue references (#123)'
      }
    ];

    const markdownFiles = await fs.readdir(this.options.outputDir);
    const mdFiles = markdownFiles.filter(file => file.endsWith('.md'));

    for (const file of mdFiles) {
      const filePath = path.join(this.options.outputDir, file);
      const content = await fs.readFile(filePath, 'utf-8');

      for (const test of gfmTests) {
        const matches = content.match(test.pattern);
        if (matches && matches.length > 0) {
          this.addTestResult(`GFM ${file}: ${test.name}`, 'passed', 
            `Found ${matches.length} instances - ${test.description}`);
        } else {
          this.addTestResult(`GFM ${file}: ${test.name}`, 'warning', 
            `Feature not used - ${test.description}`);
        }
      }
    }
  }

  /**
   * Validate CommonMark compliance
   */
  async validateCommonMarkCompliance() {
    console.log('📖 Validating CommonMark compliance...');

    const commonMarkTests = [
      {
        name: 'ATX Headers',
        test: (content) => /^#{1,6}\s+[^\n]+$/gm.test(content),
        description: 'Headers use ATX style'
      },
      {
        name: 'Emphasis Consistency',
        test: (content) => {
          const asteriskEmphasis = (content.match(/\*[^*\n]+\*/g) || []).length;
          const underscoreEmphasis = (content.match(/_[^_\n]+_/g) || []).length;
          return asteriskEmphasis === 0 || underscoreEmphasis === 0; // Consistent usage
        },
        description: 'Consistent emphasis markers'
      },
      {
        name: 'List Markers',
        test: (content) => {
          const dashLists = (content.match(/^\s*-\s+/gm) || []).length;
          const asteriskLists = (content.match(/^\s*\*\s+/gm) || []).length;
          const plusLists = (content.match(/^\s*\+\s+/gm) || []).length;
          const nonZeroCount = [dashLists, asteriskLists, plusLists].filter(count => count > 0).length;
          return nonZeroCount <= 1; // Consistent list markers
        },
        description: 'Consistent list markers'
      },
      {
        name: 'Line Endings',
        test: (content) => !/\r\n|\r/.test(content), // Only LF line endings
        description: 'Unix-style line endings (LF)'
      }
    ];

    const markdownFiles = await fs.readdir(this.options.outputDir);
    const mdFiles = markdownFiles.filter(file => file.endsWith('.md'));

    for (const file of mdFiles) {
      const filePath = path.join(this.options.outputDir, file);
      const content = await fs.readFile(filePath, 'utf-8');

      for (const test of commonMarkTests) {
        try {
          const passes = test.test(content);
          if (passes) {
            this.addTestResult(`CommonMark ${file}: ${test.name}`, 'passed', test.description);
          } else {
            this.addTestResult(`CommonMark ${file}: ${test.name}`, 'warning', 
              `May not comply with CommonMark - ${test.description}`);
          }
        } catch (error) {
          this.addTestResult(`CommonMark ${file}: ${test.name}`, 'failed', error.message);
        }
      }
    }
  }

  /**
   * Validate table formatting
   */
  async validateTableFormatting() {
    console.log('📊 Validating table formatting...');

    const markdownFiles = await fs.readdir(this.options.outputDir);
    const mdFiles = markdownFiles.filter(file => file.endsWith('.md'));

    for (const file of mdFiles) {
      const filePath = path.join(this.options.outputDir, file);
      const content = await fs.readFile(filePath, 'utf-8');

      const tableBlocks = content.match(/\|.*\|[\s\S]*?\n\n/g) || [];
      
      for (let i = 0; i < tableBlocks.length; i++) {
        const table = tableBlocks[i];
        const lines = table.split('\n').filter(line => line.trim());
        
        if (lines.length >= 2) {
          const headerLine = lines[0];
          const separatorLine = lines[1];
          const dataLines = lines.slice(2);

          // Check header format
          const headerCells = headerLine.split('|').filter(cell => cell.trim());
          if (headerCells.length > 0) {
            this.addTestResult(`Table ${file} #${i + 1}: Header`, 'passed', 
              `Table has ${headerCells.length} columns`);
          }

          // Check separator format
          if (/^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(separatorLine.trim())) {
            this.addTestResult(`Table ${file} #${i + 1}: Separator`, 'passed', 
              'Valid table separator');
          } else {
            this.addTestResult(`Table ${file} #${i + 1}: Separator`, 'failed', 
              'Invalid table separator format');
          }

          // Check data rows
          let validRows = 0;
          for (const row of dataLines) {
            if (row.trim() && row.includes('|')) {
              validRows++;
            }
          }
          
          if (validRows === dataLines.length) {
            this.addTestResult(`Table ${file} #${i + 1}: Data Rows`, 'passed', 
              `All ${validRows} data rows are valid`);
          } else {
            this.addTestResult(`Table ${file} #${i + 1}: Data Rows`, 'warning', 
              `${validRows}/${dataLines.length} valid data rows`);
          }
        }
      }
    }
  }

  /**
   * Validate code block handling
   */
  async validateCodeBlockHandling() {
    console.log('💻 Validating code block handling...');

    const markdownFiles = await fs.readdir(this.options.outputDir);
    const mdFiles = markdownFiles.filter(file => file.endsWith('.md'));

    for (const file of mdFiles) {
      const filePath = path.join(this.options.outputDir, file);
      const content = await fs.readFile(filePath, 'utf-8');

      // Test different code block types
      const codeBlockTests = [
        {
          name: 'Fenced Code Blocks',
          pattern: /^```[\s\S]*?```$/gm,
          description: 'Triple backtick fenced blocks'
        },
        {
          name: 'Language Specification',
          pattern: /^```\w+/gm,
          description: 'Code blocks with language specified'
        },
        {
          name: 'Inline Code',
          pattern: /`[^`\n]+`/g,
          description: 'Inline code spans'
        }
      ];

      for (const test of codeBlockTests) {
        const matches = content.match(test.pattern);
        if (matches && matches.length > 0) {
          this.addTestResult(`Code ${file}: ${test.name}`, 'passed', 
            `Found ${matches.length} instances - ${test.description}`);
        } else {
          this.addTestResult(`Code ${file}: ${test.name}`, 'warning', 
            `No instances found - ${test.description}`);
        }
      }

      // Validate code block syntax
      const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
      let validBlocks = 0;
      
      for (const block of codeBlocks) {
        const lines = block.split('\n');
        if (lines.length >= 2 && lines[0].startsWith('```') && lines[lines.length - 1].trim() === '```') {
          validBlocks++;
        }
      }

      if (codeBlocks.length === validBlocks) {
        this.addTestResult(`Code ${file}: Block Syntax`, 'passed', 
          `All ${validBlocks} code blocks have valid syntax`);
      } else {
        this.addTestResult(`Code ${file}: Block Syntax`, 'failed', 
          `${validBlocks}/${codeBlocks.length} code blocks have valid syntax`);
      }
    }
  }

  /**
   * Validate link validation
   */
  async validateLinkValidation() {
    console.log('🔗 Validating links...');

    const markdownFiles = await fs.readdir(this.options.outputDir);
    const mdFiles = markdownFiles.filter(file => file.endsWith('.md'));

    for (const file of mdFiles) {
      const filePath = path.join(this.options.outputDir, file);
      const content = await fs.readFile(filePath, 'utf-8');

      const linkTests = [
        {
          name: 'Inline Links',
          pattern: /\[([^\]]+)\]\(([^)]+)\)/g,
          description: 'Standard inline links [text](url)'
        },
        {
          name: 'Reference Links',
          pattern: /\[([^\]]+)\]\[([^\]]*)\]/g,
          description: 'Reference-style links [text][ref]'
        },
        {
          name: 'Autolinks',
          pattern: /<https?:\/\/[^>]+>/g,
          description: 'Automatic links <http://example.com>'
        }
      ];

      for (const test of linkTests) {
        const matches = content.match(test.pattern);
        if (matches && matches.length > 0) {
          // Validate link format
          let validLinks = 0;
          for (const match of matches) {
            if (test.name === 'Inline Links') {
              const linkMatch = match.match(/\[([^\]]+)\]\(([^)]+)\)/);
              if (linkMatch && linkMatch[1].trim() && linkMatch[2].trim()) {
                validLinks++;
              }
            } else {
              validLinks++; // Simplified validation for other types
            }
          }

          if (validLinks === matches.length) {
            this.addTestResult(`Links ${file}: ${test.name}`, 'passed', 
              `Found ${validLinks} valid ${test.description.toLowerCase()}`);
          } else {
            this.addTestResult(`Links ${file}: ${test.name}`, 'warning', 
              `${validLinks}/${matches.length} valid links found`);
          }
        } else {
          this.addTestResult(`Links ${file}: ${test.name}`, 'warning', 
            `No ${test.description.toLowerCase()} found`);
        }
      }
    }
  }

  /**
   * Validate image handling
   */
  async validateImageHandling() {
    console.log('🖼️  Validating image handling...');

    const markdownFiles = await fs.readdir(this.options.outputDir);
    const mdFiles = markdownFiles.filter(file => file.endsWith('.md'));

    for (const file of mdFiles) {
      const filePath = path.join(this.options.outputDir, file);
      const content = await fs.readFile(filePath, 'utf-8');

      const images = content.match(this.syntaxPatterns.images) || [];
      
      if (images.length > 0) {
        let validImages = 0;
        const imageFormats = { jpg: 0, jpeg: 0, png: 0, gif: 0, svg: 0, webp: 0 };
        
        for (const image of images) {
          const imageMatch = image.match(/!\[(.*?)\]\(([^)]+)\)/);
          if (imageMatch) {
            const alt = imageMatch[1];
            const src = imageMatch[2];
            
            if (src.trim()) {
              validImages++;
              
              // Check image format
              const ext = path.extname(src).toLowerCase().substring(1);
              if (imageFormats.hasOwnProperty(ext)) {
                imageFormats[ext]++;
              }
            }
          }
        }

        this.addTestResult(`Images ${file}: Syntax`, 'passed', 
          `Found ${validImages}/${images.length} images with valid syntax`);

        const formatSummary = Object.entries(imageFormats)
          .filter(([format, count]) => count > 0)
          .map(([format, count]) => `${format}: ${count}`)
          .join(', ');

        if (formatSummary) {
          this.addTestResult(`Images ${file}: Formats`, 'passed', 
            `Image formats used: ${formatSummary}`);
        }

        // Check alt text usage
        const imagesWithAlt = images.filter(img => {
          const match = img.match(/!\[(.*?)\]/);
          return match && match[1].trim().length > 0;
        });

        if (imagesWithAlt.length === images.length) {
          this.addTestResult(`Images ${file}: Alt Text`, 'passed', 
            'All images have alt text');
        } else {
          this.addTestResult(`Images ${file}: Alt Text`, 'warning', 
            `${imagesWithAlt.length}/${images.length} images have alt text`);
        }
      } else {
        this.addTestResult(`Images ${file}: Detection`, 'warning', 
          'No images found in document');
      }
    }
  }

  /**
   * Validate cross-platform compatibility
   */
  async validateCrossPlatformCompatibility() {
    console.log('🌐 Validating cross-platform compatibility...');

    const markdownFiles = await fs.readdir(this.options.outputDir);
    const mdFiles = markdownFiles.filter(file => file.endsWith('.md'));

    const platformTests = [
      {
        name: 'Line Endings',
        test: (content) => !content.includes('\r'),
        description: 'Unix-style line endings for cross-platform compatibility'
      },
      {
        name: 'File Encoding',
        test: (content) => {
          // Check for UTF-8 compatibility
          try {
            Buffer.from(content, 'utf8').toString('utf8');
            return true;
          } catch {
            return false;
          }
        },
        description: 'UTF-8 encoding compatibility'
      },
      {
        name: 'Special Characters',
        test: (content) => /[^\x00-\x7F]/.test(content),
        description: 'Unicode character handling'
      }
    ];

    for (const file of mdFiles) {
      const filePath = path.join(this.options.outputDir, file);
      const content = await fs.readFile(filePath, 'utf-8');

      for (const test of platformTests) {
        try {
          const result = test.test(content);
          const status = test.name === 'Special Characters' ? (result ? 'passed' : 'warning') : (result ? 'passed' : 'failed');
          this.addTestResult(`Platform ${file}: ${test.name}`, status, test.description);
        } catch (error) {
          this.addTestResult(`Platform ${file}: ${test.name}`, 'failed', error.message);
        }
      }
    }
  }

  /**
   * Validate metadata preservation (frontmatter)
   */
  async validateMetadataPreservation() {
    console.log('📋 Validating metadata preservation...');

    const markdownFiles = await fs.readdir(this.options.outputDir);
    const mdFiles = markdownFiles.filter(file => file.endsWith('.md'));

    for (const file of mdFiles) {
      const filePath = path.join(this.options.outputDir, file);
      const content = await fs.readFile(filePath, 'utf-8');

      // Check for YAML frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
      
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const lines = frontmatter.split('\n').filter(line => line.trim());
        
        const metadataFields = [];
        for (const line of lines) {
          if (line.includes(':')) {
            const [key] = line.split(':');
            metadataFields.push(key.trim());
          }
        }

        this.addTestResult(`Metadata ${file}: Frontmatter`, 'passed', 
          `Found ${metadataFields.length} metadata fields: ${metadataFields.join(', ')}`);

        // Validate YAML syntax (simplified)
        const hasValidYAML = !frontmatter.match(/^[^:\n]*:\s*$/gm); // No empty values
        if (hasValidYAML) {
          this.addTestResult(`Metadata ${file}: YAML Syntax`, 'passed', 
            'Valid YAML frontmatter syntax');
        } else {
          this.addTestResult(`Metadata ${file}: YAML Syntax`, 'warning', 
            'Potential YAML syntax issues');
        }
      } else {
        this.addTestResult(`Metadata ${file}: Frontmatter`, 'warning', 
          'No YAML frontmatter found');
      }
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
      timestamp: this.getDeterministicDate().toISOString()
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
        timestamp: this.getDeterministicDate().toISOString()
      },
      details: this.testResults.details,
      recommendations: this.generateRecommendations()
    };

    const reportPath = path.join(this.options.outputDir, 'markdown-quality-validation-report.json');
    await fs.writeJSON(reportPath, report, { spaces: 2 });

    console.log(`\n📄 Markdown validation report saved to: ${reportPath}`);
    return report;
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations() {
    const recommendations = [];
    const failedTests = this.testResults.details.filter(test => test.status === 'failed');
    const warningTests = this.testResults.details.filter(test => test.status === 'warning');

    if (failedTests.some(test => test.test.includes('Syntax'))) {
      recommendations.push('Fix Markdown syntax errors to ensure proper rendering across platforms');
    }

    if (failedTests.some(test => test.test.includes('Table'))) {
      recommendations.push('Correct table formatting to ensure proper display');
    }

    if (failedTests.some(test => test.test.includes('Code'))) {
      recommendations.push('Fix code block syntax for better syntax highlighting');
    }

    if (warningTests.some(test => test.test.includes('GFM'))) {
      recommendations.push('Consider adding GitHub Flavored Markdown features for enhanced functionality');
    }

    if (warningTests.some(test => test.test.includes('Alt Text'))) {
      recommendations.push('Add alt text to all images for better accessibility');
    }

    if (warningTests.some(test => test.test.includes('Metadata'))) {
      recommendations.push('Consider adding YAML frontmatter for better metadata support');
    }

    return recommendations;
  }
}

export default MarkdownQualityValidator;