/**
 * LaTeX Normalization Engine
 * 
 * Provides deterministic LaTeX document generation by normalizing
 * formatting, whitespace, and removing non-deterministic elements.
 * 
 * @module latex-normalizer
 * @version 1.0.0
 */

import crypto from 'crypto';

/**
 * LaTeX Normalizer for deterministic document generation
 */
export class LaTeXNormalizer {
  constructor(options = {}) {
    this.options = {
      normalizeWhitespace: true,
      removeComments: true,
      sortPackages: true,
      removeTimestamps: true,
      normalizeFloats: true,
      normalizeReferences: true,
      indentationSpaces: 2,
      maxLineLength: 80,
      ...options
    };
  }

  /**
   * Normalize LaTeX document content
   * 
   * @param {string} latexContent - Raw LaTeX content
   * @returns {string} Normalized LaTeX content
   */
  normalizeLaTeX(latexContent) {
    let normalized = latexContent;
    
    // Step 1: Normalize line endings
    normalized = this.normalizeLineEndings(normalized);
    
    // Step 2: Remove or normalize comments
    if (this.options.removeComments) {
      normalized = this.normalizeComments(normalized);
    }
    
    // Step 3: Normalize whitespace
    if (this.options.normalizeWhitespace) {
      normalized = this.normalizeWhitespace(normalized);
    }
    
    // Step 4: Sort packages and imports
    if (this.options.sortPackages) {
      normalized = this.sortPackages(normalized);
    }
    
    // Step 5: Remove timestamps
    if (this.options.removeTimestamps) {
      normalized = this.removeTimestamps(normalized);
    }
    
    // Step 6: Normalize float positions
    if (this.options.normalizeFloats) {
      normalized = this.normalizeFloats(normalized);
    }
    
    // Step 7: Normalize references and labels
    if (this.options.normalizeReferences) {
      normalized = this.normalizeReferences(normalized);
    }
    
    // Step 8: Final formatting pass
    normalized = this.finalFormatting(normalized);
    
    return normalized;
  }

  /**
   * Normalize line endings to LF
   * 
   * @param {string} content - LaTeX content
   * @returns {string} Content with normalized line endings
   */
  normalizeLineEndings(content) {
    return content.replace(/\r\n|\r/g, '\n');
  }

  /**
   * Normalize LaTeX comments
   * 
   * @param {string} content - LaTeX content
   * @returns {string} Content with normalized comments
   */
  normalizeComments(content) {
    const lines = content.split('\n');
    const processedLines = [];
    
    for (let line of lines) {
      // Remove end-of-line comments but preserve those that are part of code examples
      if (!line.trim().startsWith('\\begin{verbatim}') && 
          !line.trim().startsWith('\\begin{lstlisting}')) {
        // Remove comments that are not escaped
        line = line.replace(/(?<!\\)%.*$/, '').trimEnd();
      }
      
      // Skip empty lines that were only comments
      if (line.trim() !== '') {
        processedLines.push(line);
      }
    }
    
    return processedLines.join('\n');
  }

  /**
   * Normalize whitespace in LaTeX content
   * 
   * @param {string} content - LaTeX content
   * @returns {string} Content with normalized whitespace
   */
  normalizeWhitespace(content) {
    const lines = content.split('\n');
    const processedLines = [];
    let indentLevel = 0;
    
    for (let line of lines) {
      // Remove trailing whitespace
      line = line.replace(/\s+$/, '');
      
      // Skip completely empty lines, but preserve paragraph breaks
      if (line.trim() === '') {
        // Only add empty line if the previous line wasn't empty
        if (processedLines.length > 0 && processedLines[processedLines.length - 1].trim() !== '') {
          processedLines.push('');
        }
        continue;
      }
      
      // Normalize indentation
      const trimmed = line.trim();
      
      // Adjust indent level based on LaTeX structure
      if (trimmed.startsWith('\\end{')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      // Apply indentation
      const normalizedLine = ' '.repeat(indentLevel * this.options.indentationSpaces) + trimmed;
      
      // Increase indent for begin blocks
      if (trimmed.startsWith('\\begin{') && !trimmed.includes('\\end{')) {
        indentLevel++;
      }
      
      // Handle other structural elements
      if (trimmed.startsWith('\\item')) {
        // Don't change indent for items
      } else if (trimmed.startsWith('\\section') || 
                 trimmed.startsWith('\\subsection') || 
                 trimmed.startsWith('\\subsubsection')) {
        // Sections at base level
        const sectionLine = trimmed;
        processedLines.push(sectionLine);
        continue;
      }
      
      processedLines.push(normalizedLine);
    }
    
    // Remove multiple consecutive empty lines
    const finalLines = [];
    let emptyLineCount = 0;
    
    for (const line of processedLines) {
      if (line.trim() === '') {
        emptyLineCount++;
        if (emptyLineCount <= 1) {
          finalLines.push(line);
        }
      } else {
        emptyLineCount = 0;
        finalLines.push(line);
      }
    }
    
    return finalLines.join('\n');
  }

  /**
   * Sort package imports and usepackage statements
   * 
   * @param {string} content - LaTeX content
   * @returns {string} Content with sorted packages
   */
  sortPackages(content) {
    const lines = content.split('\n');
    const beforePackages = [];
    const packages = [];
    const afterPackages = [];
    
    let inPreamble = true;
    let foundFirstPackage = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check for document start
      if (trimmed.startsWith('\\begin{document}')) {
        inPreamble = false;
      }
      
      if (inPreamble && (trimmed.startsWith('\\usepackage') || trimmed.startsWith('\\RequirePackage'))) {
        packages.push(line);
        foundFirstPackage = true;
      } else if (inPreamble && !foundFirstPackage) {
        beforePackages.push(line);
      } else {
        afterPackages.push(line);
      }
    }
    
    // Sort packages alphabetically by package name
    packages.sort((a, b) => {
      const aMatch = a.match(/\\(?:usepackage|RequirePackage)(?:\[[^\]]*\])?\{([^}]+)\}/);
      const bMatch = b.match(/\\(?:usepackage|RequirePackage)(?:\[[^\]]*\])?\{([^}]+)\}/);
      
      const aName = aMatch ? aMatch[1] : a;
      const bName = bMatch ? bMatch[1] : b;
      
      return aName.localeCompare(bName);
    });
    
    return [...beforePackages, ...packages, ...afterPackages].join('\n');
  }

  /**
   * Remove timestamp-related content
   * 
   * @param {string} content - LaTeX content
   * @returns {string} Content without timestamps
   */
  removeTimestamps(content) {
    let processed = content;
    
    // Remove common timestamp patterns
    const timestampPatterns = [
      /\\date\{[^}]*\}/g, // Remove \date{...} unless it's a template variable
      /% Generated on.*$/gm,
      /% Created.*$/gm,
      /% Modified.*$/gm,
      /% Compiled.*$/gm,
      /\\today/g // Remove \today references
    ];
    
    for (const pattern of timestampPatterns) {
      processed = processed.replace(pattern, '');
    }
    
    // Clean up any resulting empty lines
    processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return processed;
  }

  /**
   * Normalize float positioning and options
   * 
   * @param {string} content - LaTeX content
   * @returns {string} Content with normalized floats
   */
  normalizeFloats(content) {
    let processed = content;
    
    // Normalize figure positioning options to a standard set
    processed = processed.replace(/\\begin{figure}\[([^\]]*)\]/g, (match, options) => {
      // Standardize common positioning options
      const standardOptions = 'htbp';
      return `\\begin{figure}[${standardOptions}]`;
    });
    
    processed = processed.replace(/\\begin{table}\[([^\]]*)\]/g, (match, options) => {
      const standardOptions = 'htbp';
      return `\\begin{table}[${standardOptions}]`;
    });
    
    return processed;
  }

  /**
   * Normalize references and labels
   * 
   * @param {string} content - LaTeX content
   * @returns {string} Content with normalized references
   */
  normalizeReferences(content) {
    let processed = content;
    
    // Extract and sort bibliography entries if present
    const bibMatch = processed.match(/(\\begin{thebibliography}.*?\\end{thebibliography})/s);
    if (bibMatch) {
      const bibContent = bibMatch[1];
      const sortedBib = this.sortBibliography(bibContent);
      processed = processed.replace(bibMatch[1], sortedBib);
    }
    
    return processed;
  }

  /**
   * Sort bibliography entries
   * 
   * @param {string} bibContent - Bibliography content
   * @returns {string} Sorted bibliography
   */
  sortBibliography(bibContent) {
    const lines = bibContent.split('\n');
    const beginLine = lines.find(line => line.trim().startsWith('\\begin{thebibliography}'));
    const endLine = lines.find(line => line.trim().startsWith('\\end{thebibliography}'));
    
    const bibItems = [];
    let currentItem = '';
    let inItem = false;
    
    for (const line of lines) {
      if (line.trim().startsWith('\\bibitem')) {
        if (currentItem) {
          bibItems.push(currentItem.trim());
        }
        currentItem = line;
        inItem = true;
      } else if (inItem && !line.trim().startsWith('\\begin') && !line.trim().startsWith('\\end')) {
        currentItem += '\n' + line;
      }
    }
    
    if (currentItem) {
      bibItems.push(currentItem.trim());
    }
    
    // Sort by bibitem label
    bibItems.sort((a, b) => {
      const aLabel = a.match(/\\bibitem\{([^}]+)\}/)?.[1] || '';
      const bLabel = b.match(/\\bibitem\{([^}]+)\}/)?.[1] || '';
      return aLabel.localeCompare(bLabel);
    });
    
    return [beginLine, ...bibItems, endLine].join('\n');
  }

  /**
   * Final formatting pass
   * 
   * @param {string} content - LaTeX content
   * @returns {string} Final formatted content
   */
  finalFormatting(content) {
    let processed = content;
    
    // Ensure consistent spacing around equations
    processed = processed.replace(/\n*\\begin{equation}\n*/g, '\n\\begin{equation}\n');
    processed = processed.replace(/\n*\\end{equation}\n*/g, '\n\\end{equation}\n');
    
    // Normalize spacing around sections
    processed = processed.replace(/\n*(\\(?:sub)*section\{[^}]+\})\n*/g, '\n\n$1\n\n');
    
    // Remove trailing whitespace
    processed = processed.replace(/[ \t]+$/gm, '');
    
    // Normalize final line ending
    processed = processed.replace(/\n*$/, '\n');
    
    return processed;
  }

  /**
   * Generate content hash for verification
   * 
   * @param {string} content - LaTeX content
   * @returns {string} SHA-256 hash
   */
  generateContentHash(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Verify two LaTeX documents are semantically identical
   * 
   * @param {string} doc1 - First document
   * @param {string} doc2 - Second document
   * @returns {Object} Comparison result
   */
  verifyDocumentEquivalence(doc1, doc2) {
    const normalized1 = this.normalizeLaTeX(doc1);
    const normalized2 = this.normalizeLaTeX(doc2);
    
    const hash1 = this.generateContentHash(normalized1);
    const hash2 = this.generateContentHash(normalized2);
    
    const identical = hash1 === hash2;
    const differences = [];
    
    if (!identical) {
      differences.push(`Content hash mismatch: ${hash1} vs ${hash2}`);
      
      // Line-by-line comparison for detailed differences
      const lines1 = normalized1.split('\n');
      const lines2 = normalized2.split('\n');
      
      const maxLines = Math.max(lines1.length, lines2.length);
      
      for (let i = 0; i < maxLines; i++) {
        const line1 = lines1[i] || '';
        const line2 = lines2[i] || '';
        
        if (line1 !== line2) {
          differences.push(`Line ${i + 1} differs: "${line1}" vs "${line2}"`);
        }
      }
    }
    
    return { identical, differences, normalized1, normalized2 };
  }
}

/**
 * Create LaTeX normalizer with default settings
 * 
 * @param {Object} options - Normalizer options
 * @returns {LaTeXNormalizer} Configured normalizer
 */
export function createLaTeXNormalizer(options = {}) {
  return new LaTeXNormalizer(options);
}

/**
 * Quick normalization function
 * 
 * @param {string} latexContent - LaTeX document content
 * @param {Object} options - Normalization options
 * @returns {string} Normalized LaTeX document
 */
export function normalizeLaTeX(latexContent, options = {}) {
  const normalizer = new LaTeXNormalizer(options);
  return normalizer.normalizeLaTeX(latexContent);
}

export default LaTeXNormalizer;