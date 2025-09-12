/**
 * KGEN Core OPC (Open Packaging Conventions) Normalizer
 * 
 * Migrated and enhanced from unjucks/packages/kgen-core/src/office/deterministic-processor.js
 * Provides deterministic normalization for MS Office documents (.docx, .xlsx, .pptx):
 * - Removes non-deterministic metadata (timestamps, versions, etc.)
 * - Sorts XML elements and attributes consistently
 * - Normalizes ZIP archive structure
 * - Ensures byte-identical outputs for identical inputs
 * - Handles core.xml, app.xml, and other OPC parts deterministically
 */

import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import crypto from 'crypto';

/**
 * OPC Normalizer for deterministic MS Office document processing
 */
export class OPCNormalizer {
  constructor(options = {}) {
    this.options = {
      // Core normalization settings
      removeTimestamps: options.removeTimestamps !== false,
      removeVersionInfo: options.removeVersionInfo !== false,
      removeUserInfo: options.removeUserInfo !== false,
      sortElements: options.sortElements !== false,
      sortAttributes: options.sortAttributes !== false,
      
      // ZIP normalization
      normalizeZipStructure: options.normalizeZipStructure !== false,
      useStaticTimestamps: options.useStaticTimestamps !== false,
      staticTimestamp: options.staticTimestamp || new Date('2024-01-01T00:00:00.000Z'),
      
      // Advanced options
      preserveFormatting: options.preserveFormatting !== false,
      enableDeepNormalization: options.enableDeepNormalization !== false,
      strictMode: options.strictMode !== false,
      
      ...options
    };
    
    // Static timestamp for SOURCE_DATE_EPOCH compatibility
    this.staticTimestamp = this.options.staticTimestamp;
    
    // Initialize DOM parser with consistent settings
    this.parser = new DOMParser();
    this.serializer = new XMLSerializer();
    
    // Track normalization statistics
    this.stats = {
      filesProcessed: 0,
      elementsNormalized: 0,
      attributesNormalized: 0,
      timestampsRemoved: 0
    };
  }
  
  /**
   * Normalize Office document for deterministic output
   */
  async normalizeOfficeDocument(documentBuffer, options = {}) {
    try {
      const zip = await JSZip.loadAsync(documentBuffer);
      const normalizedZip = new JSZip();
      
      // Process all files in deterministic order
      const fileEntries = Object.keys(zip.files).sort();
      
      for (const fileName of fileEntries) {
        const file = zip.files[fileName];
        
        if (file.dir) {
          // Handle directories
          normalizedZip.folder(fileName);
          continue;
        }
        
        let content;
        
        if (this._isXMLFile(fileName)) {
          // Normalize XML files
          const xmlContent = await file.async('text');
          content = this._normalizeXML(xmlContent, fileName);
          this.stats.filesProcessed++;
        } else if (this._isBinaryFile(fileName)) {
          // Keep binary files as-is but normalize metadata
          content = await file.async('uint8array');
        } else {
          // Other text files - normalize line endings
          const textContent = await file.async('text');
          content = this._normalizeTextContent(textContent);
        }
        
        // Add to normalized ZIP with static timestamp
        normalizedZip.file(fileName, content, {
          date: this.staticTimestamp,
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });
      }
      
      // Generate with consistent options
      return await normalizedZip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
        platform: 'UNIX', // Consistent platform
        mimeType: this._getMimeType(fileEntries)
      });
      
    } catch (error) {
      throw new Error(`OPC normalization failed: ${error.message}`);
    }
  }
  
  /**
   * Normalize XML content for deterministic output
   */
  _normalizeXML(xmlContent, fileName) {
    try {
      // Parse XML
      const doc = this.parser.parseFromString(xmlContent, 'text/xml');
      
      // Apply normalization based on file type
      if (fileName.includes('core.xml')) {
        this._normalizeCoreProperties(doc);
      } else if (fileName.includes('app.xml')) {
        this._normalizeAppProperties(doc);
      } else if (fileName.includes('document.xml') || fileName.includes('workbook.xml') || fileName.includes('presentation.xml')) {
        this._normalizeMainDocument(doc);
      } else if (fileName.includes('.rels')) {
        this._normalizeRelationships(doc);
      } else {
        this._normalizeGenericXML(doc);
      }
      
      // Serialize back to XML with consistent formatting
      let serialized = this.serializer.serializeToString(doc);
      
      // Post-process for consistency
      serialized = this._postProcessXML(serialized);
      
      return serialized;
      
    } catch (error) {
      // If XML parsing fails, return normalized text
      return this._normalizeTextContent(xmlContent);
    }
  }
  
  /**
   * Normalize core properties (core.xml)
   */
  _normalizeCoreProperties(doc) {
    const coreProperties = doc.documentElement;
    
    if (this.options.removeTimestamps) {
      this._removeElements(coreProperties, [
        'dcterms:created',
        'dcterms:modified',
        'cp:lastModifiedBy',
        'cp:revision'
      ]);
      this.stats.timestampsRemoved++;
    }
    
    if (this.options.removeUserInfo) {
      this._removeElements(coreProperties, [
        'dc:creator',
        'cp:lastModifiedBy'
      ]);
    }
    
    if (this.options.removeVersionInfo) {
      this._removeElements(coreProperties, [
        'cp:revision'
      ]);
    }
    
    // Add static timestamps if configured
    if (this.options.useStaticTimestamps) {
      this._setStaticTimestamps(coreProperties);
    }
    
    // Sort child elements
    if (this.options.sortElements) {
      this._sortChildElements(coreProperties);
    }
    
    this.stats.elementsNormalized++;
  }
  
  /**
   * Normalize app properties (app.xml)
   */
  _normalizeAppProperties(doc) {
    const appProperties = doc.documentElement;
    
    if (this.options.removeVersionInfo) {
      this._removeElements(appProperties, [
        'Application',
        'AppVersion',
        'DocSecurity',
        'ScaleCrop',
        'Manager',
        'Company'
      ]);
    }
    
    // Sort child elements
    if (this.options.sortElements) {
      this._sortChildElements(appProperties);
    }
    
    this.stats.elementsNormalized++;
  }
  
  /**
   * Normalize main document content
   */
  _normalizeMainDocument(doc) {
    // Remove revision information
    if (this.options.removeVersionInfo) {
      this._removeAttributes(doc.documentElement, [
        'w:rsidRoot',
        'w:rsidR',
        'w:rsidRDefault',
        'w:rsidP'
      ]);
    }
    
    // Normalize all elements recursively
    this._normalizeElementRecursively(doc.documentElement);
    
    this.stats.elementsNormalized++;
  }
  
  /**
   * Normalize relationships
   */
  _normalizeRelationships(doc) {
    const relationships = doc.documentElement;
    
    // Sort relationship elements by Id
    if (this.options.sortElements) {
      this._sortChildElements(relationships, (a, b) => {
        const aId = a.getAttribute('Id');
        const bId = b.getAttribute('Id');
        return aId.localeCompare(bId);
      });
    }
    
    this.stats.elementsNormalized++;
  }
  
  /**
   * Generic XML normalization
   */
  _normalizeGenericXML(doc) {
    this._normalizeElementRecursively(doc.documentElement);
    this.stats.elementsNormalized++;
  }
  
  /**
   * Normalize element and all children recursively
   */
  _normalizeElementRecursively(element) {
    if (!element || element.nodeType !== 1) return; // Only process element nodes
    
    // Sort attributes
    if (this.options.sortAttributes) {
      this._sortAttributes(element);
    }
    
    // Remove non-deterministic attributes
    this._removeNonDeterministicAttributes(element);
    
    // Sort child elements if enabled
    if (this.options.sortElements && this._canSortChildren(element)) {
      this._sortChildElements(element);
    }
    
    // Process all child elements
    const children = Array.from(element.childNodes);
    for (const child of children) {
      if (child.nodeType === 1) { // Element node
        this._normalizeElementRecursively(child);
      }
    }
    
    this.stats.elementsNormalized++;
  }
  
  /**
   * Sort element attributes alphabetically
   */
  _sortAttributes(element) {
    if (!element.attributes || element.attributes.length <= 1) {
      return;
    }
    
    const attrs = Array.from(element.attributes);
    const sortedAttrs = attrs.sort((a, b) => a.name.localeCompare(b.name));
    
    // Remove all attributes
    for (const attr of attrs) {
      element.removeAttribute(attr.name);
    }
    
    // Add them back in sorted order
    for (const attr of sortedAttrs) {
      element.setAttribute(attr.name, attr.value);
    }
    
    this.stats.attributesNormalized += attrs.length;
  }
  
  /**
   * Sort child elements
   */
  _sortChildElements(parent, compareFn = null) {
    const children = Array.from(parent.childNodes).filter(node => node.nodeType === 1);
    
    if (children.length <= 1) {
      return;
    }
    
    const defaultCompareFn = (a, b) => {
      // Compare by tag name first
      const tagCompare = a.tagName.localeCompare(b.tagName);
      if (tagCompare !== 0) {
        return tagCompare;
      }
      
      // Then by attributes
      const aAttrs = this._getAttributeString(a);
      const bAttrs = this._getAttributeString(b);
      return aAttrs.localeCompare(bAttrs);
    };
    
    const sortedChildren = children.sort(compareFn || defaultCompareFn);
    
    // Remove all child elements
    for (const child of children) {
      parent.removeChild(child);
    }
    
    // Add them back in sorted order
    for (const child of sortedChildren) {
      parent.appendChild(child);
    }
  }
  
  /**
   * Remove specified elements
   */
  _removeElements(parent, elementNames) {
    for (const elementName of elementNames) {
      const elements = parent.getElementsByTagName(elementName);
      const elementsArray = Array.from(elements);
      
      for (const element of elementsArray) {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }
    }
  }
  
  /**
   * Remove non-deterministic attributes
   */
  _removeNonDeterministicAttributes(element) {
    const nonDeterministicAttrs = [
      'w:rsidR', 'w:rsidRPr', 'w:rsidRDefault', 'w:rsidP', 'w:rsidRoot',
      'mc:Ignorable', 'x:Ignorable'
    ];
    
    for (const attrName of nonDeterministicAttrs) {
      if (element.hasAttribute(attrName)) {
        element.removeAttribute(attrName);
      }
    }
  }
  
  /**
   * Remove specified attributes
   */
  _removeAttributes(parent, attributeNames) {
    const walker = parent.ownerDocument.createTreeWalker(
      parent,
      4, // NodeFilter.SHOW_ELEMENT
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      for (const attrName of attributeNames) {
        if (node.hasAttribute && node.hasAttribute(attrName)) {
          node.removeAttribute(attrName);
        }
      }
    }
  }
  
  /**
   * Set static timestamps for reproducible builds
   */
  _setStaticTimestamps(coreProperties) {
    const staticIso = this.staticTimestamp.toISOString();
    
    // Set static creation time
    let created = coreProperties.getElementsByTagName('dcterms:created')[0];
    if (!created) {
      created = coreProperties.ownerDocument.createElement('dcterms:created');
      coreProperties.appendChild(created);
    }
    created.setAttribute('xsi:type', 'dcterms:W3CDTF');
    created.textContent = staticIso;
    
    // Set static modification time
    let modified = coreProperties.getElementsByTagName('dcterms:modified')[0];
    if (!modified) {
      modified = coreProperties.ownerDocument.createElement('dcterms:modified');
      coreProperties.appendChild(modified);
    }
    modified.setAttribute('xsi:type', 'dcterms:W3CDTF');
    modified.textContent = staticIso;
  }
  
  /**
   * Post-process XML for consistent formatting
   */
  _postProcessXML(xmlString) {
    // Normalize line endings
    let normalized = xmlString.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Remove extra whitespace between elements if preserveFormatting is false
    if (!this.options.preserveFormatting) {
      normalized = normalized.replace(/>\s+</g, '><');
    }
    
    // Ensure XML declaration is consistent
    if (!normalized.startsWith('<?xml')) {
      normalized = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + normalized;
    }
    
    return normalized;
  }
  
  /**
   * Normalize text content
   */
  _normalizeTextContent(content) {
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+$/gm, '') // Remove trailing whitespace
      .trim();
  }
  
  /**
   * Check if file is XML
   */
  _isXMLFile(fileName) {
    return fileName.endsWith('.xml') || 
           fileName.endsWith('.rels') || 
           fileName.includes('content-types');
  }
  
  /**
   * Check if file is binary
   */
  _isBinaryFile(fileName) {
    const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.wmf', '.emf'];
    return binaryExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  }
  
  /**
   * Get MIME type based on file entries
   */
  _getMimeType(fileEntries) {
    if (fileEntries.some(f => f.includes('word/'))) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (fileEntries.some(f => f.includes('xl/'))) {
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (fileEntries.some(f => f.includes('ppt/'))) {
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }
    return 'application/zip';
  }
  
  /**
   * Check if element children can be safely sorted
   */
  _canSortChildren(element) {
    // Some elements have order-dependent children
    const orderSensitive = [
      'w:p', 'w:r', 'w:t', // Word paragraph/run/text
      'row', 'c', // Excel row/cell
      'p:sp', 'p:txBody' // PowerPoint shape/text
    ];
    
    return !orderSensitive.includes(element.tagName);
  }
  
  /**
   * Get attribute string for comparison
   */
  _getAttributeString(element) {
    if (!element.attributes || element.attributes.length === 0) {
      return '';
    }
    
    const attrs = Array.from(element.attributes)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(attr => `${attr.name}="${attr.value}"`)
      .join(' ');
    
    return attrs;
  }
  
  /**
   * Validate document normalization
   */
  async validateNormalization(originalBuffer, normalizedBuffer) {
    try {
      const originalHash = crypto.createHash('sha256').update(originalBuffer).digest('hex');
      const normalizedHash = crypto.createHash('sha256').update(normalizedBuffer).digest('hex');
      
      // Load both archives for comparison
      const originalZip = await JSZip.loadAsync(originalBuffer);
      const normalizedZip = await JSZip.loadAsync(normalizedBuffer);
      
      const originalFiles = Object.keys(originalZip.files).sort();
      const normalizedFiles = Object.keys(normalizedZip.files).sort();
      
      return {
        normalized: true,
        identical: originalHash === normalizedHash,
        originalHash,
        normalizedHash,
        fileCount: {
          original: originalFiles.length,
          normalized: normalizedFiles.length
        },
        stats: this.stats
      };
      
    } catch (error) {
      return {
        normalized: false,
        error: error.message,
        stats: this.stats
      };
    }
  }
  
  /**
   * Get normalization statistics
   */
  getStats() {
    return {
      ...this.stats,
      options: this.options
    };
  }
  
  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      filesProcessed: 0,
      elementsNormalized: 0,
      attributesNormalized: 0,
      timestampsRemoved: 0
    };
  }
}

/**
 * Factory function for creating OPC normalizer
 */
export function createOPCNormalizer(options = {}) {
  return new OPCNormalizer(options);
}

/**
 * Quick normalize function
 */
export async function normalizeOPCDocument(documentBuffer, options = {}) {
  const normalizer = new OPCNormalizer(options);
  return await normalizer.normalizeOfficeDocument(documentBuffer);
}

export default OPCNormalizer;