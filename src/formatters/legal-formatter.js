/**
 * Legal Document Formatter for Unjucks
 * Specialized module for formatting legal documents with hierarchical numbering,
 * contract clauses, definitions, annotations, and legal-specific formatting
 */

class LegalFormatter {
  constructor(options = {}) {
    this.options = {
      // Document structure options
      maxHierarchyDepth: options.maxHierarchyDepth || 6,
      numberingStyle: options.numberingStyle || 'mixed', // 'numeric', 'alpha', 'mixed'
      indentSize: options.indentSize || 4,
      
      // Legal formatting options
      clauseNumbering: options.clauseNumbering !== false,
      definitionStyle: options.definitionStyle || 'bold-caps',
      annotationStyle: options.annotationStyle || 'margin',
      citationFormat: options.citationFormat || 'bluebook',
      
      // Document metadata
      jurisdiction: options.jurisdiction || 'US',
      documentType: options.documentType || 'contract',
      
      // Validation options
      strictFormatting: options.strictFormatting !== false,
      validateCitations: options.validateCitations || false
    };

    // Initialize internal state
    this.hierarchyStack = [];
    this.definedTerms = new Map();
    this.citations = new Set();
    this.annotations = [];
    this.signatureBlocks = [];
    this.crossReferences = new Map();
  }

  /**
   * Format a complete legal document
   */
  formatDocument(content, metadata = {}) {
    this.reset();
    
    const document = {
      header: this.formatHeader(metadata),
      body: this.formatBody(content),
      footer: this.formatFooter(metadata),
      definitions: this.formatDefinitionsSection(),
      signatureBlock: this.formatSignatureBlock(metadata.signatures),
      annotations: this.formatAnnotations()
    };

    return this.assembleDocument(document);
  }

  /**
   * Reset internal state for new document
   */
  reset() {
    this.hierarchyStack = [];
    this.definedTerms.clear();
    this.citations.clear();
    this.annotations = [];
    this.signatureBlocks = [];
    this.crossReferences.clear();
  }

  /**
   * Hierarchical paragraph numbering system
   * Supports formats like: 1., 1.1, 1.1.1, 1.1.1.a, 1.1.1.a.i, 1.1.1.a.i.A
   */
  generateHierarchicalNumber(level, increment = true) {
    if (level < 1 || level > this.options.maxHierarchyDepth) {
      throw new Error(`Invalid hierarchy level: ${level}. Must be between 1 and ${this.options.maxHierarchyDepth}`);
    }

    // Adjust stack size to current level
    while (this.hierarchyStack.length < level) {
      this.hierarchyStack.push(0);
    }
    while (this.hierarchyStack.length > level) {
      this.hierarchyStack.pop();
    }

    if (increment) {
      this.hierarchyStack[level - 1]++;
      // Reset lower levels
      for (let i = level; i < this.hierarchyStack.length; i++) {
        this.hierarchyStack[i] = 0;
      }
    }

    return this.formatHierarchicalNumber(this.hierarchyStack);
  }

  /**
   * Format hierarchical number based on style
   */
  formatHierarchicalNumber(stack) {
    const numberingPatterns = {
      numeric: (n, level) => n.toString(),
      alpha: (n, level) => {
        if (level % 2 === 0) return String.fromCharCode(96 + n); // a, b, c
        return String.fromCharCode(64 + n); // A, B, C
      },
      roman: (n, level) => {
        const roman = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
        return level % 2 === 0 ? roman[n] : roman[n]?.toUpperCase() || n.toString();
      }
    };

    const formatNumber = (num, level) => {
      switch (this.options.numberingStyle) {
        case 'numeric':
          return numberingPatterns.numeric(num, level);
        case 'alpha':
          return numberingPatterns.alpha(num, level);
        case 'roman':
          return numberingPatterns.roman(num, level);
        case 'mixed':
        default:
          // Mixed style: 1, a, i, A, I, 1
          const patterns = [
            (n) => n.toString(),                    // Level 1: 1, 2, 3
            (n) => String.fromCharCode(96 + n),     // Level 2: a, b, c
            (n) => this.toRoman(n).toLowerCase(),   // Level 3: i, ii, iii
            (n) => String.fromCharCode(64 + n),     // Level 4: A, B, C
            (n) => this.toRoman(n).toUpperCase(),   // Level 5: I, II, III
            (n) => `(${n})`                         // Level 6: (1), (2), (3)
          ];
          const pattern = patterns[(level - 1) % patterns.length];
          return pattern(num);
      }
    };

    return stack
      .filter((num, index) => num > 0 || index === stack.length - 1)
      .map((num, index) => formatNumber(num, index + 1))
      .join('.');
  }

  /**
   * Convert number to Roman numerals
   */
  toRoman(num) {
    const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const literals = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
    
    let result = '';
    for (let i = 0; i < values.length; i++) {
      while (num >= values[i]) {
        result += literals[i];
        num -= values[i];
      }
    }
    return result;
  }

  /**
   * Format contract clauses with proper legal structure
   */
  formatClause(clause, options = {}) {
    const {
      title = '',
      level = 1,
      content = '',
      subclauses = [],
      crossRef = null,
      annotation = null
    } = clause;

    let formatted = '';
    const number = this.generateHierarchicalNumber(level);
    const indent = ' '.repeat((level - 1) * this.options.indentSize);

    // Format clause header
    if (title) {
      formatted += `${indent}${number} ${title.toUpperCase()}\n\n`;
    } else {
      formatted += `${indent}${number} `;
    }

    // Format clause content
    if (content) {
      const contentLines = content.split('\n');
      contentLines.forEach((line, index) => {
        if (index === 0) {
          formatted += `${line}\n`;
        } else {
          formatted += `${indent}${' '.repeat(number.length + 1)}${line}\n`;
        }
      });
    }

    // Add cross-reference if provided
    if (crossRef) {
      this.crossReferences.set(crossRef.id, {
        section: number,
        title: title,
        page: options.page || 'TBD'
      });
    }

    // Add annotation if provided
    if (annotation) {
      this.annotations.push({
        section: number,
        text: annotation,
        type: 'clause'
      });
    }

    // Format subclauses recursively
    if (subclauses && subclauses.length > 0) {
      subclauses.forEach(subclause => {
        formatted += '\n' + this.formatClause(subclause, { ...options, level: level + 1 });
      });
    }

    return formatted;
  }

  /**
   * Handle legal definitions and terms
   */
  formatDefinitions(terms) {
    if (!terms || terms.length === 0) return '';

    let formatted = this.generateHierarchicalNumber(1) + ' DEFINITIONS\n\n';
    
    terms.forEach((term, index) => {
      const {
        term: termName,
        definition,
        crossRefs = [],
        statutory = false
      } = term;

      // Store term for later reference
      this.definedTerms.set(termName.toLowerCase(), {
        definition,
        section: this.generateHierarchicalNumber(2, false),
        statutory
      });

      const number = this.generateHierarchicalNumber(2);
      const indent = ' '.repeat(this.options.indentSize);

      // Format term name based on style
      let formattedTerm;
      switch (this.options.definitionStyle) {
        case 'bold-caps':
          formattedTerm = `**${termName.toUpperCase()}**`;
          break;
        case 'italics':
          formattedTerm = `*${termName}*`;
          break;
        case 'quotes':
          formattedTerm = `"${termName}"`;
          break;
        default:
          formattedTerm = termName;
      }

      formatted += `${indent}${number} ${formattedTerm} means ${definition}`;
      
      // Add cross-references
      if (crossRefs.length > 0) {
        formatted += ` (See ${crossRefs.join(', ')})`;
      }

      formatted += '\n\n';
    });

    return formatted;
  }

  /**
   * Format margin notes and annotations
   */
  formatAnnotation(text, type = 'note', position = 'margin') {
    const annotation = {
      id: this.annotations.length + 1,
      text,
      type,
      position,
      section: this.getCurrentSection()
    };

    this.annotations.push(annotation);

    switch (position) {
      case 'margin':
        return `[^${annotation.id}]`;
      case 'inline':
        return `[${text}]`;
      case 'footnote':
        return `^${annotation.id}^`;
      default:
        return `[Note: ${text}]`;
    }
  }

  /**
   * Format legal headers
   */
  formatHeader(metadata) {
    const {
      title = 'LEGAL DOCUMENT',
      parties = [],
      date = new Date().toISOString().split('T')[0],
      jurisdiction = this.options.jurisdiction,
      documentType = this.options.documentType,
      confidential = false
    } = metadata;

    let header = '';

    // Confidentiality notice
    if (confidential) {
      header += 'CONFIDENTIAL\n';
      header += '=' .repeat(50) + '\n\n';
    }

    // Document title
    header += title.toUpperCase() + '\n';
    header += '=' .repeat(title.length) + '\n\n';

    // Parties section
    if (parties.length > 0) {
      header += 'This ' + documentType + ' is entered into on ' + date + ' between:\n\n';
      parties.forEach((party, index) => {
        const partyLabel = index === 0 ? 'FIRST PARTY:' : 
                          index === 1 ? 'SECOND PARTY:' : 
                          `PARTY ${index + 1}:`;
        
        header += `${partyLabel}\n`;
        header += `Name: ${party.name || 'N/A'}\n`;
        header += `Address: ${party.address || 'N/A'}\n`;
        if (party.title) header += `Title: ${party.title}\n`;
        if (party.entity) header += `Entity: ${party.entity}\n`;
        header += '\n';
      });
    }

    // Jurisdiction
    header += `Governing Jurisdiction: ${jurisdiction}\n\n`;

    return header;
  }

  /**
   * Format legal footers
   */
  formatFooter(metadata) {
    const {
      pageNumber = 1,
      totalPages = 1,
      confidential = false,
      attorney = null,
      firm = null
    } = metadata;

    let footer = '\n' + '-'.repeat(80) + '\n';

    // Page information
    footer += `Page ${pageNumber} of ${totalPages}\n`;

    // Attorney information
    if (attorney || firm) {
      footer += '\nPrepared by:\n';
      if (attorney) footer += `Attorney: ${attorney}\n`;
      if (firm) footer += `Firm: ${firm}\n`;
    }

    // Confidentiality footer
    if (confidential) {
      footer += '\nCONFIDENTIAL AND PRIVILEGED\n';
      footer += 'This document contains confidential and privileged information.\n';
    }

    return footer;
  }

  /**
   * Format signature blocks
   */
  formatSignatureBlock(signatures = []) {
    if (signatures.length === 0) return '';

    let block = '\n\nSIGNATURE PAGE\n';
    block += '=' .repeat(15) + '\n\n';

    signatures.forEach((sig, index) => {
      const {
        party,
        name,
        title,
        date = '_____________',
        witness = false,
        notarized = false
      } = sig;

      block += `${party.toUpperCase()}:\n\n`;
      block += `Signature: _________________________________\n`;
      block += `Print Name: ${name || '_________________________________'}\n`;
      if (title) block += `Title: ${title}\n`;
      block += `Date: ${date}\n`;

      if (witness) {
        block += '\nWitness:\n';
        block += 'Signature: _________________________________\n';
        block += 'Print Name: _________________________________\n';
        block += 'Date: _____________\n';
      }

      if (notarized) {
        block += '\nNotary Public:\n';
        block += 'Signature: _________________________________\n';
        block += 'Print Name: _________________________________\n';
        block += 'My Commission Expires: _____________\n';
        block += '\n[NOTARY SEAL]\n';
      }

      block += '\n' + '-'.repeat(50) + '\n\n';
    });

    return block;
  }

  /**
   * Format legal citations
   */
  formatCitation(citation, format = this.options.citationFormat) {
    const {
      type, // 'case', 'statute', 'regulation', 'secondary'
      title,
      citation: cite,
      year,
      court,
      volume,
      reporter,
      page,
      pinpoint
    } = citation;

    switch (format) {
      case 'bluebook':
        return this.formatBluebookCitation(citation);
      case 'alwd':
        return this.formatALWDCitation(citation);
      case 'chicago':
        return this.formatChicagoCitation(citation);
      default:
        return `${title}, ${cite} (${year})`;
    }
  }

  /**
   * Format citation in Bluebook style
   */
  formatBluebookCitation(citation) {
    const { type, title, volume, reporter, page, pinpoint, year, court } = citation;

    switch (type) {
      case 'case':
        let formatted = `${title}, ${volume} ${reporter} ${page}`;
        if (pinpoint) formatted += `, ${pinpoint}`;
        formatted += ` (${court} ${year})`;
        return formatted;
      
      case 'statute':
        return `${title} § ${page} (${year})`;
      
      default:
        return `${title}, ${volume} ${reporter} ${page} (${year})`;
    }
  }

  /**
   * Format body content with legal-specific formatting
   */
  formatBody(content) {
    if (typeof content === 'string') {
      return this.processLegalText(content);
    }

    if (Array.isArray(content)) {
      return content.map(item => {
        if (typeof item === 'string') {
          return this.processLegalText(item);
        } else if (item.type === 'clause') {
          return this.formatClause(item);
        } else if (item.type === 'definitions') {
          return this.formatDefinitions(item.terms);
        }
        return item;
      }).join('\n\n');
    }

    return '';
  }

  /**
   * Process legal text for defined terms, citations, etc.
   */
  processLegalText(text) {
    let processed = text;

    // Highlight defined terms
    this.definedTerms.forEach((definition, term) => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      processed = processed.replace(regex, (match) => {
        switch (this.options.definitionStyle) {
          case 'bold-caps':
            return `**${match.toUpperCase()}**`;
          case 'italics':
            return `*${match}*`;
          case 'quotes':
            return `"${match}"`;
          default:
            return match;
        }
      });
    });

    // Process cross-references
    processed = processed.replace(/§\s*(\d+(?:\.\d+)*)/g, (match, section) => {
      return `Section ${section}`;
    });

    return processed;
  }

  /**
   * Format definitions section
   */
  formatDefinitionsSection() {
    if (this.definedTerms.size === 0) return '';

    let section = '\n\nDEFINED TERMS\n';
    section += '=' .repeat(13) + '\n\n';

    this.definedTerms.forEach((definition, term) => {
      section += `${term.toUpperCase()}: ${definition.definition}\n`;
    });

    return section;
  }

  /**
   * Format all annotations
   */
  formatAnnotations() {
    if (this.annotations.length === 0) return '';

    let formatted = '\n\nNOTES AND ANNOTATIONS\n';
    formatted += '=' .repeat(21) + '\n\n';

    this.annotations.forEach(annotation => {
      formatted += `[${annotation.id}] Section ${annotation.section}: ${annotation.text}\n`;
    });

    return formatted;
  }

  /**
   * Get current section number
   */
  getCurrentSection() {
    return this.hierarchyStack.join('.');
  }

  /**
   * Assemble final document
   */
  assembleDocument(parts) {
    const document = [];

    if (parts.header) document.push(parts.header);
    if (parts.body) document.push(parts.body);
    if (parts.definitions) document.push(parts.definitions);
    if (parts.signatureBlock) document.push(parts.signatureBlock);
    if (parts.annotations) document.push(parts.annotations);
    if (parts.footer) document.push(parts.footer);

    return document.join('\n\n');
  }

  /**
   * Validate document structure
   */
  validateDocument(document) {
    const errors = [];
    const warnings = [];

    // Check for required sections
    if (!document.includes('SIGNATURE')) {
      warnings.push('Document lacks signature section');
    }

    // Check hierarchy consistency
    if (this.hierarchyStack.length === 0) {
      warnings.push('Document has no hierarchical structure');
    }

    // Check defined terms usage
    const unusedTerms = [];
    this.definedTerms.forEach((definition, term) => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      if (!regex.test(document)) {
        unusedTerms.push(term);
      }
    });

    if (unusedTerms.length > 0) {
      warnings.push(`Unused defined terms: ${unusedTerms.join(', ')}`);
    }

    return { errors, warnings, valid: errors.length === 0 };
  }

  /**
   * Export document to various formats
   */
  export(document, format = 'text') {
    switch (format) {
      case 'html':
        return this.toHTML(document);
      case 'markdown':
        return this.toMarkdown(document);
      case 'rtf':
        return this.toRTF(document);
      case 'text':
      default:
        return document;
    }
  }

  /**
   * Convert to HTML format
   */
  toHTML(document) {
    return document
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  /**
   * Convert to Markdown format
   */
  toMarkdown(document) {
    return document; // Already in markdown-like format
  }

  /**
   * Convert to RTF format (basic)
   */
  toRTF(document) {
    return '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}\\f0\\fs24 ' +
           document.replace(/\n/g, '\\par ') + '}';
  }
}

// Export the formatter
module.exports = LegalFormatter;

// For ES6 modules
export default LegalFormatter;