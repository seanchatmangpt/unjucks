/**
 * Document Structure Processor
 * Handles hierarchical document processing for legal and academic documents
 * Features: TOC generation, cross-references, floats, page breaks, formatting
 */

class DocumentStructureProcessor {
  constructor(options = {}) {
    this.options = {
      // Document type configuration
      documentType: 'academic', // 'legal', 'academic', 'technical'
      maxDepth: 6,
      numberingStyle: 'decimal', // 'decimal', 'roman', 'alpha', 'legal'
      
      // TOC configuration
      generateToc: true,
      tocDepth: 3,
      tocTitle: 'Table of Contents',
      
      // Cross-reference configuration
      enableCrossRefs: true,
      crossRefFormat: 'full', // 'full', 'short', 'page'
      
      // Float configuration
      floatPositions: ['h', 't', 'b', 'p'], // here, top, bottom, page
      figurePrefix: 'Figure',
      tablePrefix: 'Table',
      
      // Page break configuration
      pageBreaks: {
        chapter: 'always',
        section: 'avoid',
        figure: 'avoid'
      },
      
      // Legal document specific
      legalNumbering: {
        articles: true,
        sections: true,
        subsections: true,
        clauses: true
      },
      
      ...options
    };
    
    // Internal state
    this.structure = {
      hierarchy: [],
      crossRefs: new Map(),
      floats: new Map(),
      counters: new Map(),
      labels: new Map()
    };
    
    // Initialize counters
    this.initializeCounters();
  }
  
  /**
   * Initialize numbering counters
   */
  initializeCounters() {
    const levels = ['chapter', 'section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph'];
    levels.forEach(level => {
      this.structure.counters.set(level, 0);
    });
    
    this.structure.counters.set('figure', 0);
    this.structure.counters.set('table', 0);
    this.structure.counters.set('equation', 0);
  }
  
  /**
   * Process document structure from content
   * @param {string} content - Document content
   * @param {Object} metadata - Document metadata
   * @returns {Object} Processed document structure
   */
  processDocument(content, metadata = {}) {
    // Reset structure
    this.structure.hierarchy = [];
    this.structure.crossRefs.clear();
    this.structure.floats.clear();
    this.structure.labels.clear();
    this.initializeCounters();
    
    // Parse document content
    const parsedContent = this.parseContent(content);
    
    // Build hierarchy
    this.buildHierarchy(parsedContent);
    
    // Process cross-references
    this.processCrossReferences(parsedContent);
    
    // Process floats
    this.processFloats(parsedContent);
    
    // Generate table of contents
    const toc = this.generateTableOfContents();
    
    // Apply formatting
    const formattedContent = this.applyFormatting(parsedContent);
    
    return {
      content: formattedContent,
      structure: this.structure,
      toc: toc,
      metadata: {
        ...metadata,
        processed: this.getDeterministicDate().toISOString(),
        documentType: this.options.documentType,
        totalSections: this.structure.hierarchy.length
      }
    };
  }
  
  /**
   * Parse document content into structured elements
   * @param {string} content - Raw document content
   * @returns {Array} Parsed elements
   */
  parseContent(content) {
    const elements = [];
    const lines = content.split('\n');
    let currentElement = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        if (currentElement && currentElement.type === 'paragraph') {
          elements.push(currentElement);
          currentElement = null;
        }
        continue;
      }
      
      // Check for headings
      const heading = this.parseHeading(line);
      if (heading) {
        if (currentElement) {
          elements.push(currentElement);
        }
        elements.push(heading);
        currentElement = null;
        continue;
      }
      
      // Check for floats (figures, tables)
      const float = this.parseFloat(line);
      if (float) {
        if (currentElement) {
          elements.push(currentElement);
        }
        elements.push(float);
        currentElement = null;
        continue;
      }
      
      // Check for labels and references
      const labelMatch = line.match(/\\label\{([^}]+)\}/);
      if (labelMatch) {
        const label = {
          type: 'label',
          id: labelMatch[1],
          line: i + 1
        };
        elements.push(label);
        continue;
      }
      
      // Check for page breaks
      if (line.match(/\\(?:newpage|pagebreak|clearpage)/)) {
        elements.push({
          type: 'pagebreak',
          command: line,
          line: i + 1
        });
        continue;
      }
      
      // Regular paragraph content
      if (!currentElement || currentElement.type !== 'paragraph') {
        if (currentElement) {
          elements.push(currentElement);
        }
        currentElement = {
          type: 'paragraph',
          content: line,
          line: i + 1
        };
      } else {
        currentElement.content += ' ' + line;
      }
    }
    
    if (currentElement) {
      elements.push(currentElement);
    }
    
    return elements;
  }
  
  /**
   * Parse heading elements
   * @param {string} line - Line content
   * @returns {Object|null} Heading object or null
   */
  parseHeading(line) {
    // LaTeX-style headings
    const latexHeadingPatterns = [
      { pattern: /\\part\*?\{([^}]+)\}/, level: 0, type: 'part' },
      { pattern: /\\chapter\*?\{([^}]+)\}/, level: 1, type: 'chapter' },
      { pattern: /\\section\*?\{([^}]+)\}/, level: 2, type: 'section' },
      { pattern: /\\subsection\*?\{([^}]+)\}/, level: 3, type: 'subsection' },
      { pattern: /\\subsubsection\*?\{([^}]+)\}/, level: 4, type: 'subsubsection' },
      { pattern: /\\paragraph\*?\{([^}]+)\}/, level: 5, type: 'paragraph' },
      { pattern: /\\subparagraph\*?\{([^}]+)\}/, level: 6, type: 'subparagraph' }
    ];
    
    for (const { pattern, level, type } of latexHeadingPatterns) {
      const match = line.match(pattern);
      if (match) {
        const isNumbered = !line.includes('*');
        return {
          type: 'heading',
          level: level,
          headingType: type,
          title: match[1].trim(),
          numbered: isNumbered,
          raw: line
        };
      }
    }
    
    // Markdown-style headings
    const markdownMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (markdownMatch) {
      const level = markdownMatch[1].length;
      return {
        type: 'heading',
        level: level,
        headingType: this.getHeadingTypeByLevel(level),
        title: markdownMatch[2].trim(),
        numbered: true,
        raw: line
      };
    }
    
    // Legal document patterns
    if (this.options.documentType === 'legal') {
      const legalPatterns = [
        { pattern: /^Article\s+(\d+)[\.:]/i, level: 1, type: 'article' },
        { pattern: /^Section\s+(\d+)[\.:]/i, level: 2, type: 'section' },
        { pattern: /^\((\w+)\)/, level: 3, type: 'subsection' },
        { pattern: /^\d+\)/, level: 4, type: 'clause' }
      ];
      
      for (const { pattern, level, type } of legalPatterns) {
        const match = line.match(pattern);
        if (match) {
          return {
            type: 'heading',
            level: level,
            headingType: type,
            title: line.replace(pattern, '').trim(),
            numbered: true,
            number: match[1],
            raw: line
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Parse float elements (figures, tables)
   * @param {string} line - Line content
   * @returns {Object|null} Float object or null
   */
  parseFloat(line) {
    // Figure patterns
    const figurePatterns = [
      /\\begin\{figure\}(?:\[([htbp]+)\])?/,
      /!\[([^\]]+)\]\(([^)]+)\)/  // Markdown image
    ];
    
    for (const pattern of figurePatterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          type: 'float',
          floatType: 'figure',
          position: match[1] || 'h',
          caption: match[2] || '',
          raw: line
        };
      }
    }
    
    // Table patterns
    const tablePatterns = [
      /\\begin\{table\}(?:\[([htbp]+)\])?/,
      /\|.*\|/  // Markdown table row
    ];
    
    for (const pattern of tablePatterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          type: 'float',
          floatType: 'table',
          position: match[1] || 'h',
          raw: line
        };
      }
    }
    
    return null;
  }
  
  /**
   * Build document hierarchy
   * @param {Array} elements - Parsed elements
   */
  buildHierarchy(elements) {
    const stack = [];
    
    elements.forEach((element, index) => {
      if (element.type === 'heading') {
        // Update counters
        this.updateCounters(element);
        
        // Generate number
        const number = this.generateNumber(element);
        
        // Create hierarchy node
        const node = {
          ...element,
          number: number,
          id: this.generateId(element.title),
          children: [],
          parent: null,
          index: index
        };
        
        // Find parent in stack
        while (stack.length > 0 && stack[stack.length - 1].level >= element.level) {
          stack.pop();
        }
        
        if (stack.length > 0) {
          const parent = stack[stack.length - 1];
          node.parent = parent;
          parent.children.push(node);
        }
        
        stack.push(node);
        this.structure.hierarchy.push(node);
      }
      
      // Handle labels
      if (element.type === 'label' && stack.length > 0) {
        const currentSection = stack[stack.length - 1];
        this.structure.labels.set(element.id, {
          section: currentSection,
          type: 'section',
          number: currentSection.number,
          title: currentSection.title
        });
      }
    });
  }
  
  /**
   * Update section counters
   * @param {Object} element - Heading element
   */
  updateCounters(element) {
    if (!element.numbered) return;
    
    const level = element.level;
    const type = element.headingType;
    
    // Increment current level counter
    const currentCount = this.structure.counters.get(type) || 0;
    this.structure.counters.set(type, currentCount + 1);
    
    // Reset lower level counters
    const levels = ['chapter', 'section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph'];
    const currentIndex = levels.indexOf(type);
    
    if (currentIndex >= 0) {
      for (let i = currentIndex + 1; i < levels.length; i++) {
        this.structure.counters.set(levels[i], 0);
      }
    }
  }
  
  /**
   * Generate section number
   * @param {Object} element - Heading element
   * @returns {string} Generated number
   */
  generateNumber(element) {
    if (!element.numbered) return '';
    
    const type = element.headingType;
    const style = this.options.numberingStyle;
    
    if (this.options.documentType === 'legal') {
      return this.generateLegalNumber(element);
    }
    
    const levels = ['chapter', 'section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph'];
    const numbers = [];
    
    for (const level of levels) {
      const count = this.structure.counters.get(level) || 0;
      if (count > 0) {
        numbers.push(this.formatNumber(count, style));
      }
      if (level === type) break;
    }
    
    return numbers.join('.');
  }
  
  /**
   * Generate legal document numbering
   * @param {Object} element - Heading element
   * @returns {string} Legal number
   */
  generateLegalNumber(element) {
    const type = element.headingType;
    const count = this.structure.counters.get(type) || 0;
    
    switch (type) {
      case 'article':
        return `Article ${count}`;
      case 'section':
        return `Section ${count}`;
      case 'subsection':
        return `(${this.formatNumber(count, 'alpha')})`;
      case 'clause':
        return `${count})`;
      default:
        return this.formatNumber(count, 'decimal');
    }
  }
  
  /**
   * Format number according to style
   * @param {number} num - Number to format
   * @param {string} style - Numbering style
   * @returns {string} Formatted number
   */
  formatNumber(num, style) {
    switch (style) {
      case 'roman':
        return this.toRoman(num);
      case 'Roman':
        return this.toRoman(num).toUpperCase();
      case 'alpha':
        return this.toAlpha(num);
      case 'Alpha':
        return this.toAlpha(num).toUpperCase();
      case 'decimal':
      default:
        return num.toString();
    }
  }
  
  /**
   * Convert number to roman numerals
   * @param {number} num - Number to convert
   * @returns {string} Roman numeral
   */
  toRoman(num) {
    const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const numerals = ['m', 'cm', 'd', 'cd', 'c', 'xc', 'l', 'xl', 'x', 'ix', 'v', 'iv', 'i'];
    
    let result = '';
    for (let i = 0; i < values.length; i++) {
      while (num >= values[i]) {
        result += numerals[i];
        num -= values[i];
      }
    }
    return result;
  }
  
  /**
   * Convert number to alphabetic
   * @param {number} num - Number to convert
   * @returns {string} Alphabetic representation
   */
  toAlpha(num) {
    let result = '';
    while (num > 0) {
      num--;
      result = String.fromCharCode(97 + (num % 26)) + result;
      num = Math.floor(num / 26);
    }
    return result;
  }
  
  /**
   * Generate ID from title
   * @param {string} title - Section title
   * @returns {string} Generated ID
   */
  generateId(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  /**
   * Get heading type by level
   * @param {number} level - Heading level
   * @returns {string} Heading type
   */
  getHeadingTypeByLevel(level) {
    const types = ['part', 'chapter', 'section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph'];
    return types[Math.min(level - 1, types.length - 1)] || 'paragraph';
  }
  
  /**
   * Process cross-references
   * @param {Array} elements - Parsed elements
   */
  processCrossReferences(elements) {
    elements.forEach(element => {
      if (element.type === 'paragraph' && element.content) {
        // Find reference patterns
        const refPatterns = [
          /\\ref\{([^}]+)\}/g,
          /\\pageref\{([^}]+)\}/g,
          /\\autoref\{([^}]+)\}/g,
          /\[([^\]]+)\]\(#([^)]+)\)/g  // Markdown links
        ];
        
        refPatterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(element.content)) !== null) {
            const refId = match[1] || match[2];
            const refType = match[0].includes('pageref') ? 'page' : 
                           match[0].includes('autoref') ? 'auto' : 'full';
            
            this.structure.crossRefs.set(match[0], {
              id: refId,
              type: refType,
              element: element,
              match: match[0]
            });
          }
        });
      }
    });
  }
  
  /**
   * Process floats (figures, tables)
   * @param {Array} elements - Parsed elements
   */
  processFloats(elements) {
    elements.forEach((element, index) => {
      if (element.type === 'float') {
        // Increment float counter
        const floatType = element.floatType;
        const count = this.structure.counters.get(floatType) || 0;
        this.structure.counters.set(floatType, count + 1);
        
        // Generate float number and caption
        const number = this.structure.counters.get(floatType);
        const prefix = floatType === 'figure' ? this.options.figurePrefix : this.options.tablePrefix;
        
        const floatInfo = {
          ...element,
          number: number,
          id: `${floatType}-${number}`,
          fullCaption: `${prefix} ${number}: ${element.caption || ''}`,
          index: index
        };
        
        this.structure.floats.set(floatInfo.id, floatInfo);
      }
    });
  }
  
  /**
   * Generate table of contents
   * @returns {Object} Table of contents structure
   */
  generateTableOfContents() {
    if (!this.options.generateToc) {
      return null;
    }
    
    const toc = {
      title: this.options.tocTitle,
      entries: [],
      depth: this.options.tocDepth
    };
    
    const processNode = (node, depth = 0) => {
      if (depth >= this.options.tocDepth) return;
      
      toc.entries.push({
        level: node.level,
        number: node.number,
        title: node.title,
        id: node.id,
        page: this.calculatePageNumber(node),
        children: []
      });
      
      const entry = toc.entries[toc.entries.length - 1];
      
      // Process children
      node.children.forEach(child => {
        const childEntries = [];
        processNode(child, depth + 1);
        if (toc.entries.length > entry.children.length + 1) {
          entry.children = toc.entries.slice(toc.entries.length - child.children.length);
        }
      });
    };
    
    // Process top-level nodes
    this.structure.hierarchy
      .filter(node => !node.parent)
      .forEach(node => processNode(node));
    
    return toc;
  }
  
  /**
   * Calculate page number (placeholder implementation)
   * @param {Object} node - Hierarchy node
   * @returns {number} Estimated page number
   */
  calculatePageNumber(node) {
    // This is a simplified implementation
    // In a real application, you'd need actual page layout information
    return Math.floor(node.index / 10) + 1;
  }
  
  /**
   * Apply formatting to content
   * @param {Array} elements - Parsed elements
   * @returns {string} Formatted content
   */
  applyFormatting(elements) {
    let formatted = '';
    
    elements.forEach(element => {
      switch (element.type) {
        case 'heading':
          formatted += this.formatHeading(element);
          break;
        case 'paragraph':
          formatted += this.formatParagraph(element);
          break;
        case 'float':
          formatted += this.formatFloat(element);
          break;
        case 'pagebreak':
          formatted += this.formatPageBreak(element);
          break;
        case 'label':
          formatted += this.formatLabel(element);
          break;
        default:
          formatted += element.raw || element.content || '';
      }
      formatted += '\n';
    });
    
    // Process cross-references
    formatted = this.resolveCrossReferences(formatted);
    
    return formatted;
  }
  
  /**
   * Format heading element
   * @param {Object} element - Heading element
   * @returns {string} Formatted heading
   */
  formatHeading(element) {
    const number = element.number ? `${element.number} ` : '';
    const title = element.title;
    
    // Apply page break rules
    let pageBreak = '';
    const breakRule = this.options.pageBreaks[element.headingType];
    if (breakRule === 'always') {
      pageBreak = '\\newpage\n';
    }
    
    // Format based on document type
    if (this.options.documentType === 'legal') {
      return `${pageBreak}**${number}${title}**`;
    }
    
    // Academic/technical formatting
    const level = Math.min(element.level, 6);
    const hashes = '#'.repeat(level);
    return `${pageBreak}${hashes} ${number}${title}`;
  }
  
  /**
   * Format paragraph element
   * @param {Object} element - Paragraph element
   * @returns {string} Formatted paragraph
   */
  formatParagraph(element) {
    return element.content || '';
  }
  
  /**
   * Format float element
   * @param {Object} element - Float element
   * @returns {string} Formatted float
   */
  formatFloat(element) {
    const floatInfo = this.structure.floats.get(element.id);
    if (!floatInfo) return element.raw || '';
    
    const position = element.position || 'h';
    const caption = floatInfo.fullCaption;
    
    if (element.floatType === 'figure') {
      return `\n![${caption}](placeholder.png)\n{.figure-${position}}\n`;
    } else if (element.floatType === 'table') {
      return `\n**${caption}**\n{.table-${position}}\n`;
    }
    
    return element.raw || '';
  }
  
  /**
   * Format page break element
   * @param {Object} element - Page break element
   * @returns {string} Formatted page break
   */
  formatPageBreak(element) {
    return '\n\\newpage\n';
  }
  
  /**
   * Format label element
   * @param {Object} element - Label element
   * @returns {string} Formatted label
   */
  formatLabel(element) {
    return `{#${element.id}}`;
  }
  
  /**
   * Resolve cross-references in formatted content
   * @param {string} content - Content with unresolved references
   * @returns {string} Content with resolved references
   */
  resolveCrossReferences(content) {
    let resolved = content;
    
    this.structure.crossRefs.forEach((ref, refText) => {
      const label = this.structure.labels.get(ref.id);
      if (label) {
        let replacement = '';
        
        switch (ref.type) {
          case 'page':
            replacement = `page ${this.calculatePageNumber(label.section)}`;
            break;
          case 'auto':
            replacement = `${label.section.headingType} ${label.number}`;
            break;
          case 'full':
          default:
            replacement = label.number || label.title;
            break;
        }
        
        resolved = resolved.replace(new RegExp(this.escapeRegExp(refText), 'g'), replacement);
      }
    });
    
    return resolved;
  }
  
  /**
   * Escape string for regex
   * @param {string} string - String to escape
   * @returns {string} Escaped string
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * Export document structure to different formats
   * @param {string} format - Export format ('json', 'xml', 'yaml')
   * @returns {string} Exported structure
   */
  exportStructure(format = 'json') {
    const data = {
      hierarchy: this.structure.hierarchy.map(node => ({
        level: node.level,
        type: node.headingType,
        number: node.number,
        title: node.title,
        id: node.id,
        children: node.children.map(child => child.id)
      })),
      floats: Array.from(this.structure.floats.values()).map(float => ({
        type: float.floatType,
        number: float.number,
        id: float.id,
        caption: float.caption
      })),
      crossRefs: Array.from(this.structure.crossRefs.entries()).map(([ref, data]) => ({
        reference: ref,
        target: data.id,
        type: data.type
      }))
    };
    
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'xml':
        return this.toXML(data);
      case 'yaml':
        return this.toYAML(data);
      default:
        return JSON.stringify(data, null, 2);
    }
  }
  
  /**
   * Convert data to XML format
   * @param {Object} data - Data to convert
   * @returns {string} XML representation
   */
  toXML(data) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<document>\n';
    
    xml += '  <hierarchy>\n';
    data.hierarchy.forEach(item => {
      xml += `    <section level="${item.level}" type="${item.type}" id="${item.id}">\n`;
      xml += `      <number>${item.number}</number>\n`;
      xml += `      <title><![CDATA[${item.title}]]></title>\n`;
      xml += '    </section>\n';
    });
    xml += '  </hierarchy>\n';
    
    xml += '  <floats>\n';
    data.floats.forEach(item => {
      xml += `    <float type="${item.type}" id="${item.id}" number="${item.number}">\n`;
      xml += `      <caption><![CDATA[${item.caption || ''}]]></caption>\n`;
      xml += '    </float>\n';
    });
    xml += '  </floats>\n';
    
    xml += '</document>';
    return xml;
  }
  
  /**
   * Convert data to YAML format
   * @param {Object} data - Data to convert
   * @returns {string} YAML representation
   */
  toYAML(data) {
    let yaml = 'document:\n';
    
    yaml += '  hierarchy:\n';
    data.hierarchy.forEach(item => {
      yaml += `    - level: ${item.level}\n`;
      yaml += `      type: ${item.type}\n`;
      yaml += `      id: ${item.id}\n`;
      yaml += `      number: "${item.number}"\n`;
      yaml += `      title: "${item.title.replace(/"/g, '\\"')}"\n`;
    });
    
    yaml += '  floats:\n';
    data.floats.forEach(item => {
      yaml += `    - type: ${item.type}\n`;
      yaml += `      id: ${item.id}\n`;
      yaml += `      number: ${item.number}\n`;
      yaml += `      caption: "${(item.caption || '').replace(/"/g, '\\"')}"\n`;
    });
    
    return yaml;
  }
  
  /**
   * Validate document structure
   * @returns {Object} Validation results
   */
  validateStructure() {
    const issues = [];
    const warnings = [];
    
    // Check hierarchy consistency
    let previousLevel = 0;
    this.structure.hierarchy.forEach((node, index) => {
      if (node.level > previousLevel + 1) {
        issues.push({
          type: 'hierarchy-skip',
          message: `Section "${node.title}" skips heading levels (from ${previousLevel} to ${node.level})`,
          node: node,
          severity: 'warning'
        });
      }
      previousLevel = node.level;
    });
    
    // Check for orphaned references
    this.structure.crossRefs.forEach((ref, refText) => {
      if (!this.structure.labels.has(ref.id)) {
        issues.push({
          type: 'orphaned-reference',
          message: `Reference "${refText}" points to undefined label "${ref.id}"`,
          reference: refText,
          severity: 'error'
        });
      }
    });
    
    // Check for unused labels
    this.structure.labels.forEach((label, labelId) => {
      let referenced = false;
      this.structure.crossRefs.forEach(ref => {
        if (ref.id === labelId) referenced = true;
      });
      
      if (!referenced) {
        warnings.push({
          type: 'unused-label',
          message: `Label "${labelId}" is defined but never referenced`,
          label: labelId,
          severity: 'info'
        });
      }
    });
    
    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues: issues,
      warnings: warnings,
      stats: {
        totalSections: this.structure.hierarchy.length,
        totalFloats: this.structure.floats.size,
        totalCrossRefs: this.structure.crossRefs.size,
        totalLabels: this.structure.labels.size
      }
    };
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DocumentStructureProcessor;
} else if (typeof define === 'function' && define.amd) {
  define([], () => DocumentStructureProcessor);
} else if (typeof window !== 'undefined') {
  window.DocumentStructureProcessor = DocumentStructureProcessor;
}
