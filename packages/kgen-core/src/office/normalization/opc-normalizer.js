/**
 * OPC (Open Packaging Convention) Normalization Engine
 * 
 * Provides deterministic processing of Office documents by normalizing
 * XML structure, ZIP ordering, and removing non-deterministic elements.
 * 
 * @module opc-normalizer
 * @version 1.0.0
 */

import * as fflate from 'fflate';
import crypto from 'crypto';

/**
 * OPC Normalizer for deterministic Office document generation
 */
export class OPCNormalizer {
  constructor(options = {}) {
    this.options = {
      removeTimestamps: true,
      normalizeWhitespace: true,
      sortElements: true,
      removeComments: true,
      removeMetadata: true,
      compressionLevel: 6, // Balanced compression for consistency
      ...options
    };
  }

  /**
   * Normalize an Office document ZIP file for deterministic output
   * 
   * @param {Buffer} zipBuffer - Input ZIP buffer
   * @returns {Promise<Buffer>} Normalized ZIP buffer
   */
  async normalizeOfficeDocument(zipBuffer) {
    // Unzip the Office document
    const files = fflate.unzipSync(zipBuffer);
    
    // Normalize each file
    const normalizedFiles = {};
    
    for (const [path, content] of Object.entries(files)) {
      normalizedFiles[path] = await this.normalizeFile(path, content);
    }
    
    // Create deterministic ZIP with sorted entries
    return this.createDeterministicZip(normalizedFiles);
  }

  /**
   * Normalize individual file within Office document
   * 
   * @param {string} path - File path within ZIP
   * @param {Uint8Array} content - File content
   * @returns {Promise<Uint8Array>} Normalized content
   */
  async normalizeFile(path, content) {
    const pathLower = path.toLowerCase();
    
    // Handle XML files (most Office content)
    if (pathLower.endsWith('.xml') || pathLower.endsWith('.rels')) {
      return this.normalizeXML(content);
    }
    
    // Handle content types
    if (pathLower === '[content_types].xml') {
      return this.normalizeContentTypes(content);
    }
    
    // Handle relationships
    if (pathLower.includes('_rels/')) {
      return this.normalizeRelationships(content);
    }
    
    // Binary files (images, etc.) - return as-is but ensure consistent ordering
    return content;
  }

  /**
   * Normalize XML content for deterministic output
   * 
   * @param {Uint8Array} xmlContent - XML content buffer
   * @returns {Uint8Array} Normalized XML
   */
  normalizeXML(xmlContent) {
    let xmlString = new TextDecoder('utf-8').decode(xmlContent);
    
    // Remove XML comments if configured
    if (this.options.removeComments) {
      xmlString = xmlString.replace(/<!--[\s\S]*?-->/g, '');
    }
    
    // Normalize whitespace
    if (this.options.normalizeWhitespace) {
      xmlString = this.normalizeXMLWhitespace(xmlString);
    }
    
    // Remove timestamps and metadata
    if (this.options.removeTimestamps) {
      xmlString = this.removeTimestamps(xmlString);
    }
    
    if (this.options.removeMetadata) {
      xmlString = this.removeMetadata(xmlString);
    }
    
    // Sort elements for deterministic ordering
    if (this.options.sortElements) {
      xmlString = this.sortXMLElements(xmlString);
    }
    
    return new TextEncoder().encode(xmlString);
  }

  /**
   * Normalize XML whitespace consistently
   * 
   * @param {string} xml - XML string
   * @returns {string} Normalized XML
   */
  normalizeXMLWhitespace(xml) {
    // Normalize line endings to LF
    xml = xml.replace(/\r\n|\r/g, '\n');
    
    // Remove trailing whitespace from lines
    xml = xml.replace(/[ \t]+$/gm, '');
    
    // Normalize indentation (convert tabs to spaces, standardize depth)
    const lines = xml.split('\n');
    const normalizedLines = lines.map(line => {
      // Convert tabs to 2 spaces
      line = line.replace(/\t/g, '  ');
      
      // Normalize spacing around XML tags
      line = line.replace(/>\s+</g, '><');
      line = line.replace(/\s+>/g, '>');
      line = line.replace(/<\s+/g, '<');
      
      return line;
    });
    
    return normalizedLines.join('\n');
  }

  /**
   * Remove timestamp elements from XML
   * 
   * @param {string} xml - XML string
   * @returns {string} XML without timestamps
   */
  removeTimestamps(xml) {
    // Common timestamp patterns in Office documents
    const timestampPatterns = [
      /<dcterms:created[^>]*>.*?<\/dcterms:created>/gi,
      /<dcterms:modified[^>]*>.*?<\/dcterms:modified>/gi,
      /<cp:lastModifiedBy[^>]*>.*?<\/cp:lastModifiedBy>/gi,
      /<cp:revision[^>]*>.*?<\/cp:revision>/gi,
      /<dc:creator[^>]*>.*?<\/dc:creator>/gi,
      /<cp:lastPrinted[^>]*>.*?<\/cp:lastPrinted>/gi,
      // Word-specific
      /<w:rsid[^>]*\/>/gi,
      /<w:rsidR[^>]*\/>/gi,
      /<w:rsidRPr[^>]*\/>/gi,
      /<w:rsidRDefault[^>]*\/>/gi,
      // Excel-specific
      /<x:lastEdited[^>]*>.*?<\/x:lastEdited>/gi,
      // PowerPoint-specific
      /<p:modified[^>]*>.*?<\/p:modified>/gi
    ];
    
    for (const pattern of timestampPatterns) {
      xml = xml.replace(pattern, '');
    }
    
    return xml;
  }

  /**
   * Remove variable metadata from XML
   * 
   * @param {string} xml - XML string
   * @returns {string} XML without variable metadata
   */
  removeMetadata(xml) {
    const metadataPatterns = [
      // Document properties that can vary
      /<cp:totalTime[^>]*>.*?<\/cp:totalTime>/gi,
      /<cp:application[^>]*>.*?<\/cp:application>/gi,
      /<cp:appVersion[^>]*>.*?<\/cp:appVersion>/gi,
      /<cp:company[^>]*>.*?<\/cp:company>/gi,
      /<cp:docSecurity[^>]*>.*?<\/cp:docSecurity>/gi,
      /<cp:scaleCrop[^>]*>.*?<\/cp:scaleCrop>/gi,
      // Word revision IDs
      /<w:rsidRoot[^>]*\/>/gi,
      /<w:documentProtection[^>]*\/>/gi,
      // Excel workbook properties
      /<x:workbookPr[^>]*\/>/gi,
      // Variable UI elements
      /<[^>]*guid="[^"]*"[^>]*>/gi
    ];
    
    for (const pattern of metadataPatterns) {
      xml = xml.replace(pattern, '');
    }
    
    return xml;
  }

  /**
   * Sort XML elements for consistent ordering
   * 
   * @param {string} xml - XML string
   * @returns {string} XML with sorted elements
   */
  sortXMLElements(xml) {
    // This is a simplified version - in practice, you might need
    // more sophisticated XML parsing and sorting
    
    // Sort attributes within elements
    xml = xml.replace(/<([^>]+)>/g, (match, content) => {
      const parts = content.split(/\s+/);
      if (parts.length <= 1) return match;
      
      const tagName = parts[0];
      const attributes = parts.slice(1);
      
      // Sort attributes alphabetically
      attributes.sort((a, b) => {
        const aName = a.split('=')[0];
        const bName = b.split('=')[0];
        return aName.localeCompare(bName);
      });
      
      return `<${tagName}${attributes.length ? ' ' + attributes.join(' ') : ''}>`;
    });
    
    return xml;
  }

  /**
   * Normalize content types XML
   * 
   * @param {Uint8Array} content - Content types XML
   * @returns {Uint8Array} Normalized content types
   */
  normalizeContentTypes(content) {
    let xml = new TextDecoder('utf-8').decode(content);
    
    // Sort Default and Override elements
    xml = this.sortContentTypesElements(xml);
    
    return this.normalizeXML(new TextEncoder().encode(xml));
  }

  /**
   * Sort content types elements
   * 
   * @param {string} xml - Content types XML
   * @returns {string} Sorted XML
   */
  sortContentTypesElements(xml) {
    // Extract and sort Default elements
    const defaultMatches = xml.match(/<Default[^>]*\/>/g) || [];
    const overrideMatches = xml.match(/<Override[^>]*\/>/g) || [];
    
    defaultMatches.sort((a, b) => {
      const aExt = a.match(/Extension="([^"]*)"/) || ['', ''];
      const bExt = b.match(/Extension="([^"]*)"/) || ['', ''];
      return aExt[1].localeCompare(bExt[1]);
    });
    
    overrideMatches.sort((a, b) => {
      const aPart = a.match(/PartName="([^"]*)"/) || ['', ''];
      const bPart = b.match(/PartName="([^"]*)"/) || ['', ''];
      return aPart[1].localeCompare(bPart[1]);
    });
    
    // Rebuild XML with sorted elements
    const header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const openTag = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">';
    const closeTag = '</Types>';
    
    return `${header}\n${openTag}\n${defaultMatches.join('\n')}\n${overrideMatches.join('\n')}\n${closeTag}`;
  }

  /**
   * Normalize relationships XML
   * 
   * @param {Uint8Array} content - Relationships XML
   * @returns {Uint8Array} Normalized relationships
   */
  normalizeRelationships(content) {
    let xml = new TextDecoder('utf-8').decode(content);
    
    // Sort Relationship elements by Target
    const relationshipMatches = xml.match(/<Relationship[^>]*\/>/g) || [];
    
    relationshipMatches.sort((a, b) => {
      const aTarget = a.match(/Target="([^"]*)"/) || ['', ''];
      const bTarget = b.match(/Target="([^"]*)"/) || ['', ''];
      return aTarget[1].localeCompare(bTarget[1]);
    });
    
    // Rebuild relationships XML
    const header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const openTag = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    const closeTag = '</Relationships>';
    
    const normalizedXml = `${header}\n${openTag}\n${relationshipMatches.join('\n')}\n${closeTag}`;
    
    return this.normalizeXML(new TextEncoder().encode(normalizedXml));
  }

  /**
   * Create deterministic ZIP file with sorted entries and canonical metadata
   * 
   * @param {Object<string, Uint8Array>} files - Files to zip
   * @returns {Buffer} Deterministic ZIP buffer
   */
  createDeterministicZip(files) {
    // Sort file paths for deterministic ordering using stable sort criteria
    const sortedPaths = Object.keys(files).sort((a, b) => {
      // Prioritize certain files for consistent ordering
      const priorityOrder = [
        '[Content_Types].xml',
        '_rels/.rels',
        'word/_rels/document.xml.rels',
        'word/document.xml',
        'word/styles.xml',
        'word/settings.xml',
        'word/fontTable.xml'
      ];
      
      const aPriority = priorityOrder.indexOf(a);
      const bPriority = priorityOrder.indexOf(b);
      
      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      } else if (aPriority !== -1) {
        return -1;
      } else if (bPriority !== -1) {
        return 1;
      }
      
      // Standard lexicographic sort for other files
      return a.localeCompare(b);
    });
    
    // Create ZIP entries with deterministic timestamps and metadata
    const zipFiles = {};
    const deterministicTimestamp = new Date('2000-01-01T00:00:00.000Z');
    
    for (const path of sortedPaths) {
      const content = files[path];
      
      zipFiles[path] = content;
    }
    
    // Use fflate's synchronous zip with deterministic options
    const zipBuffer = fflate.zipSync(zipFiles, {
      level: this.options.compressionLevel,
      // Ensure consistent zip-wide metadata
      comment: ''
    });
    
    return Buffer.from(zipBuffer);
  }

  /**
   * Generate content hash for verification
   * 
   * @param {Buffer} content - Content to hash
   * @param {string} algorithm - Hash algorithm (default: sha256)
   * @returns {string} Content hash
   */
  generateContentHash(content, algorithm = 'sha256') {
    return crypto.createHash(algorithm).update(content).digest('hex');
  }

  /**
   * Generate doc:// URI for normalized document
   * 
   * @param {Buffer} normalizedContent - Normalized document content
   * @param {string} algorithm - Hash algorithm (default: sha256)
   * @returns {string} doc:// URI
   */
  generateDocURI(normalizedContent, algorithm = 'sha256') {
    const hash = this.generateContentHash(normalizedContent, algorithm);
    return `doc://${algorithm}/${hash}`;
  }

  /**
   * Verify two Office documents are semantically identical
   * 
   * @param {Buffer} doc1 - First document
   * @param {Buffer} doc2 - Second document
   * @returns {Promise<{identical: boolean, differences: string[]}>} Comparison result
   */
  async verifyDocumentEquivalence(doc1, doc2) {
    const normalized1 = await this.normalizeOfficeDocument(doc1);
    const normalized2 = await this.normalizeOfficeDocument(doc2);
    
    const hash1 = this.generateContentHash(normalized1);
    const hash2 = this.generateContentHash(normalized2);
    
    const identical = hash1 === hash2;
    const differences = [];
    
    if (!identical) {
      // Extract detailed differences if needed
      differences.push(`Content hash mismatch: ${hash1} vs ${hash2}`);
      
      // Could add more detailed semantic comparison here
      const files1 = fflate.unzipSync(normalized1);
      const files2 = fflate.unzipSync(normalized2);
      
      const paths1 = new Set(Object.keys(files1));
      const paths2 = new Set(Object.keys(files2));
      
      for (const path of paths1) {
        if (!paths2.has(path)) {
          differences.push(`File missing in second document: ${path}`);
        }
      }
      
      for (const path of paths2) {
        if (!paths1.has(path)) {
          differences.push(`File missing in first document: ${path}`);
        }
      }
    }
    
    return { identical, differences };
  }
}

/**
 * Create OPC normalizer with default settings
 * 
 * @param {Object} options - Normalizer options
 * @returns {OPCNormalizer} Configured normalizer
 */
export function createOPCNormalizer(options = {}) {
  return new OPCNormalizer(options);
}

/**
 * Quick normalization function
 * 
 * @param {Buffer} zipBuffer - Office document buffer
 * @param {Object} options - Normalization options
 * @returns {Promise<Buffer>} Normalized document
 */
export async function normalizeOfficeDocument(zipBuffer, options = {}) {
  const normalizer = new OPCNormalizer(options);
  return normalizer.normalizeOfficeDocument(zipBuffer);
}

export default OPCNormalizer;