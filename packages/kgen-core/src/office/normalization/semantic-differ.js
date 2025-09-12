/**
 * Semantic Differ for Office Content
 * 
 * Provides semantic comparison of Office documents that ignores
 * formatting noise and focuses on meaningful content differences.
 * 
 * @module semantic-differ
 * @version 1.0.0
 */

import crypto from 'crypto';

/**
 * Semantic differ for Office document content
 */
export class SemanticDiffer {
  constructor(options = {}) {
    this.options = {
      ignoreFormatting: true,
      ignoreWhitespace: true,
      ignoreMetadata: true,
      ignoreOrder: false, // Whether to ignore element order
      granularity: 'paragraph', // 'word', 'sentence', 'paragraph', 'section'
      ...options
    };
  }

  /**
   * Compare two Office documents semantically
   * 
   * @param {Buffer} doc1 - First document buffer
   * @param {Buffer} doc2 - Second document buffer
   * @returns {Promise<Object>} Comparison result
   */
  async compareDocuments(doc1, doc2) {
    // Extract semantic content from both documents
    const content1 = await this.extractSemanticContent(doc1);
    const content2 = await this.extractSemanticContent(doc2);
    
    // Compare the semantic content
    const comparison = this.compareSemanticContent(content1, content2);
    
    return {
      identical: comparison.identical,
      similarity: comparison.similarity,
      differences: comparison.differences,
      contentStructure1: content1,
      contentStructure2: content2,
      summary: {
        totalElements1: this.countElements(content1),
        totalElements2: this.countElements(content2),
        addedElements: comparison.differences.filter(d => d.type === 'added').length,
        removedElements: comparison.differences.filter(d => d.type === 'removed').length,
        modifiedElements: comparison.differences.filter(d => d.type === 'modified').length
      }
    };
  }

  /**
   * Extract semantic content from Office document
   * 
   * @param {Buffer} docBuffer - Document buffer
   * @returns {Promise<Object>} Extracted semantic content
   */
  async extractSemanticContent(docBuffer) {
    const fflate = await import('fflate');
    const files = fflate.unzipSync(docBuffer);
    
    const content = {
      text: {},
      structure: {},
      relationships: {},
      metadata: {}
    };
    
    // Process each file in the Office document
    for (const [path, fileContent] of Object.entries(files)) {
      const pathLower = path.toLowerCase();
      
      if (pathLower.includes('word/document.xml')) {
        content.text.main = this.extractWordContent(fileContent);
      } else if (pathLower.includes('xl/sharedstrings.xml')) {
        content.text.strings = this.extractExcelStrings(fileContent);
      } else if (pathLower.includes('xl/worksheets/')) {
        const sheetName = this.extractSheetName(path);
        content.text[`sheet_${sheetName}`] = this.extractExcelSheet(fileContent);
      } else if (pathLower.includes('ppt/slides/slide')) {
        const slideNumber = this.extractSlideNumber(path);
        content.text[`slide_${slideNumber}`] = this.extractPowerPointSlide(fileContent);
      } else if (pathLower.includes('_rels/')) {
        const relType = this.extractRelationshipType(path);
        content.relationships[relType] = this.extractRelationships(fileContent);
      }
      
      // Extract structural information
      if (pathLower.includes('styles.xml') || pathLower.includes('theme/')) {
        content.structure[path] = this.extractStructuralElements(fileContent);
      }
    }
    
    // Normalize the extracted content
    return this.normalizeSemanticContent(content);
  }

  /**
   * Extract text content from Word document XML
   * 
   * @param {Uint8Array} xmlContent - Document XML content
   * @returns {Array} Extracted text elements
   */
  extractWordContent(xmlContent) {
    const xmlString = new TextDecoder('utf-8').decode(xmlContent);
    const textElements = [];
    
    // Extract paragraphs (w:p elements)
    const paragraphMatches = xmlString.match(/<w:p[^>]*>(.*?)<\/w:p>/gs) || [];
    
    for (let i = 0; i < paragraphMatches.length; i++) {
      const paragraph = paragraphMatches[i];
      
      // Extract text runs (w:t elements)
      const textMatches = paragraph.match(/<w:t[^>]*>(.*?)<\/w:t>/gs) || [];
      const textContent = textMatches.map(t => t.replace(/<[^>]*>/g, '')).join('');
      
      if (textContent.trim()) {
        textElements.push({
          type: 'paragraph',
          index: i,
          content: this.normalizeText(textContent),
          hash: this.hashContent(textContent)
        });
      }
    }
    
    return textElements;
  }

  /**
   * Extract shared strings from Excel
   * 
   * @param {Uint8Array} xmlContent - Shared strings XML
   * @returns {Array} Extracted string elements
   */
  extractExcelStrings(xmlContent) {
    const xmlString = new TextDecoder('utf-8').decode(xmlContent);
    const strings = [];
    
    // Extract shared string items (si elements)
    const stringMatches = xmlString.match(/<si[^>]*>(.*?)<\/si>/gs) || [];
    
    for (let i = 0; i < stringMatches.length; i++) {
      const stringItem = stringMatches[i];
      const textMatch = stringItem.match(/<t[^>]*>(.*?)<\/t>/s);
      
      if (textMatch) {
        const textContent = textMatch[1].replace(/<[^>]*>/g, '');
        strings.push({
          type: 'string',
          index: i,
          content: this.normalizeText(textContent),
          hash: this.hashContent(textContent)
        });
      }
    }
    
    return strings;
  }

  /**
   * Extract content from Excel worksheet
   * 
   * @param {Uint8Array} xmlContent - Worksheet XML
   * @returns {Array} Extracted cell elements
   */
  extractExcelSheet(xmlContent) {
    const xmlString = new TextDecoder('utf-8').decode(xmlContent);
    const cells = [];
    
    // Extract cell values
    const cellMatches = xmlString.match(/<c[^>]*r="([^"]*)"[^>]*>(.*?)<\/c>/gs) || [];
    
    for (const cellMatch of cellMatches) {
      const refMatch = cellMatch.match(/r="([^"]*)"/);
      const valueMatch = cellMatch.match(/<v>(.*?)<\/v>/);
      
      if (refMatch && valueMatch) {
        const cellRef = refMatch[1];
        const value = valueMatch[1];
        
        cells.push({
          type: 'cell',
          ref: cellRef,
          content: this.normalizeText(value),
          hash: this.hashContent(value)
        });
      }
    }
    
    return cells;
  }

  /**
   * Extract content from PowerPoint slide
   * 
   * @param {Uint8Array} xmlContent - Slide XML
   * @returns {Array} Extracted text elements
   */
  extractPowerPointSlide(xmlContent) {
    const xmlString = new TextDecoder('utf-8').decode(xmlContent);
    const elements = [];
    
    // Extract text from shapes (a:t elements)
    const textMatches = xmlString.match(/<a:t[^>]*>(.*?)<\/a:t>/gs) || [];
    
    for (let i = 0; i < textMatches.length; i++) {
      const textMatch = textMatches[i];
      const textContent = textMatch.replace(/<[^>]*>/g, '');
      
      if (textContent.trim()) {
        elements.push({
          type: 'text_shape',
          index: i,
          content: this.normalizeText(textContent),
          hash: this.hashContent(textContent)
        });
      }
    }
    
    return elements;
  }

  /**
   * Extract relationships from _rels files
   * 
   * @param {Uint8Array} xmlContent - Relationships XML
   * @returns {Array} Extracted relationships
   */
  extractRelationships(xmlContent) {
    const xmlString = new TextDecoder('utf-8').decode(xmlContent);
    const relationships = [];
    
    const relMatches = xmlString.match(/<Relationship[^>]*\/>/g) || [];
    
    for (const relMatch of relMatches) {
      const typeMatch = relMatch.match(/Type="([^"]*)"/);
      const targetMatch = relMatch.match(/Target="([^"]*)"/);
      
      if (typeMatch && targetMatch) {
        relationships.push({
          type: typeMatch[1],
          target: targetMatch[1],
          hash: this.hashContent(`${typeMatch[1]}:${targetMatch[1]}`)
        });
      }
    }
    
    return relationships;
  }

  /**
   * Extract structural elements from XML
   * 
   * @param {Uint8Array} xmlContent - XML content
   * @returns {Object} Structural information
   */
  extractStructuralElements(xmlContent) {
    const xmlString = new TextDecoder('utf-8').decode(xmlContent);
    
    // This is a simplified extraction - could be expanded
    const elementCounts = {};
    const tagMatches = xmlString.match(/<(\w+)[^>]*>/g) || [];
    
    for (const tagMatch of tagMatches) {
      const tagName = tagMatch.match(/<(\w+)/)[1];
      elementCounts[tagName] = (elementCounts[tagName] || 0) + 1;
    }
    
    return {
      elementCounts,
      hash: this.hashContent(JSON.stringify(elementCounts))
    };
  }

  /**
   * Normalize semantic content for comparison
   * 
   * @param {Object} content - Extracted content
   * @returns {Object} Normalized content
   */
  normalizeSemanticContent(content) {
    const normalized = {
      text: {},
      structure: content.structure,
      relationships: content.relationships,
      hash: null
    };
    
    // Normalize text content
    for (const [key, textElements] of Object.entries(content.text)) {
      if (Array.isArray(textElements)) {
        normalized.text[key] = textElements.map(element => ({
          ...element,
          content: this.normalizeText(element.content)
        }));
        
        // Sort by content hash if order should be ignored
        if (this.options.ignoreOrder) {
          normalized.text[key].sort((a, b) => a.hash.localeCompare(b.hash));
        }
      }
    }
    
    // Generate overall content hash
    const contentString = JSON.stringify(normalized, null, 0);
    normalized.hash = this.hashContent(contentString);
    
    return normalized;
  }

  /**
   * Normalize text for comparison
   * 
   * @param {string} text - Text to normalize
   * @returns {string} Normalized text
   */
  normalizeText(text) {
    if (!text) return '';
    
    let normalized = text;
    
    if (this.options.ignoreWhitespace) {
      // Normalize whitespace
      normalized = normalized.replace(/\s+/g, ' ').trim();
    }
    
    // Additional text normalization could go here
    // (case normalization, punctuation, etc.)
    
    return normalized;
  }

  /**
   * Compare semantic content between two documents
   * 
   * @param {Object} content1 - First document content
   * @param {Object} content2 - Second document content
   * @returns {Object} Comparison result
   */
  compareSemanticContent(content1, content2) {
    const differences = [];
    let totalElements = 0;
    let identicalElements = 0;
    
    // Compare text content
    const textKeys = new Set([...Object.keys(content1.text), ...Object.keys(content2.text)]);
    
    for (const key of textKeys) {
      const elements1 = content1.text[key] || [];
      const elements2 = content2.text[key] || [];
      
      totalElements += Math.max(elements1.length, elements2.length);
      
      const textDiffs = this.compareTextElements(elements1, elements2, key);
      differences.push(...textDiffs);
      
      // Count identical elements
      const identical = Math.min(elements1.length, elements2.length) - textDiffs.filter(d => d.type === 'modified').length;
      identicalElements += Math.max(0, identical);
    }
    
    // Compare relationships
    const relDiffs = this.compareRelationships(content1.relationships, content2.relationships);
    differences.push(...relDiffs);
    
    // Calculate similarity score
    const similarity = totalElements > 0 ? identicalElements / totalElements : 1;
    const identical = differences.length === 0;
    
    return {
      identical,
      similarity,
      differences
    };
  }

  /**
   * Compare text elements between documents
   * 
   * @param {Array} elements1 - Elements from first document
   * @param {Array} elements2 - Elements from second document  
   * @param {string} context - Context (document section)
   * @returns {Array} Differences found
   */
  compareTextElements(elements1, elements2, context) {
    const differences = [];
    
    // Create hash maps for efficient comparison
    const hash1 = new Map(elements1.map(e => [e.hash, e]));
    const hash2 = new Map(elements2.map(e => [e.hash, e]));
    
    // Find added elements (in doc2 but not doc1)
    for (const [hash, element] of hash2) {
      if (!hash1.has(hash)) {
        differences.push({
          type: 'added',
          context,
          element,
          message: `Added ${element.type} in ${context}: "${element.content}"`
        });
      }
    }
    
    // Find removed elements (in doc1 but not doc2)
    for (const [hash, element] of hash1) {
      if (!hash2.has(hash)) {
        differences.push({
          type: 'removed',
          context,
          element,
          message: `Removed ${element.type} from ${context}: "${element.content}"`
        });
      }
    }
    
    return differences;
  }

  /**
   * Compare relationships between documents
   * 
   * @param {Object} rels1 - Relationships from first document
   * @param {Object} rels2 - Relationships from second document
   * @returns {Array} Relationship differences
   */
  compareRelationships(rels1, rels2) {
    const differences = [];
    const allKeys = new Set([...Object.keys(rels1), ...Object.keys(rels2)]);
    
    for (const key of allKeys) {
      const relations1 = rels1[key] || [];
      const relations2 = rels2[key] || [];
      
      if (relations1.length !== relations2.length) {
        differences.push({
          type: 'relationship_count_changed',
          context: key,
          message: `Relationship count changed in ${key}: ${relations1.length} vs ${relations2.length}`
        });
      }
      
      // Compare individual relationships
      const hash1 = new Set(relations1.map(r => r.hash));
      const hash2 = new Set(relations2.map(r => r.hash));
      
      for (const hash of hash2) {
        if (!hash1.has(hash)) {
          const rel = relations2.find(r => r.hash === hash);
          differences.push({
            type: 'relationship_added',
            context: key,
            relationship: rel,
            message: `Added relationship in ${key}: ${rel.type} -> ${rel.target}`
          });
        }
      }
      
      for (const hash of hash1) {
        if (!hash2.has(hash)) {
          const rel = relations1.find(r => r.hash === hash);
          differences.push({
            type: 'relationship_removed',
            context: key,
            relationship: rel,
            message: `Removed relationship from ${key}: ${rel.type} -> ${rel.target}`
          });
        }
      }
    }
    
    return differences;
  }

  /**
   * Count total elements in content structure
   * 
   * @param {Object} content - Content structure
   * @returns {number} Total element count
   */
  countElements(content) {
    let count = 0;
    
    for (const textElements of Object.values(content.text)) {
      if (Array.isArray(textElements)) {
        count += textElements.length;
      }
    }
    
    for (const relations of Object.values(content.relationships)) {
      if (Array.isArray(relations)) {
        count += relations.length;
      }
    }
    
    return count;
  }

  /**
   * Generate content hash for comparison
   * 
   * @param {string} content - Content to hash
   * @returns {string} SHA-256 hash
   */
  hashContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Extract sheet name from path
   * 
   * @param {string} path - File path
   * @returns {string} Sheet name
   */
  extractSheetName(path) {
    const match = path.match(/sheet(\d+)/i);
    return match ? match[1] : 'unknown';
  }

  /**
   * Extract slide number from path
   * 
   * @param {string} path - File path
   * @returns {string} Slide number
   */
  extractSlideNumber(path) {
    const match = path.match(/slide(\d+)/i);
    return match ? match[1] : 'unknown';
  }

  /**
   * Extract relationship type from path
   * 
   * @param {string} path - File path
   * @returns {string} Relationship type
   */
  extractRelationshipType(path) {
    if (path.includes('document.xml.rels')) return 'document';
    if (path.includes('workbook.xml.rels')) return 'workbook';
    if (path.includes('presentation.xml.rels')) return 'presentation';
    return 'other';
  }
}

/**
 * Create semantic differ with default settings
 * 
 * @param {Object} options - Differ options
 * @returns {SemanticDiffer} Configured differ
 */
export function createSemanticDiffer(options = {}) {
  return new SemanticDiffer(options);
}

/**
 * Quick semantic comparison function
 * 
 * @param {Buffer} doc1 - First document
 * @param {Buffer} doc2 - Second document
 * @param {Object} options - Comparison options
 * @returns {Promise<Object>} Comparison result
 */
export async function compareDocuments(doc1, doc2, options = {}) {
  const differ = new SemanticDiffer(options);
  return differ.compareDocuments(doc1, doc2);
}

export default SemanticDiffer;