/**
 * File format detector for Office documents
 * 
 * Detects Office document formats based on file extensions, magic bytes,
 * and content analysis for reliable format identification.
 * 
 * @module office/utils/file-format-detector
 * @version 1.0.0
 */

import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Magic byte signatures for Office documents
 */
const MAGIC_SIGNATURES = {
  // OOXML formats (ZIP-based)
  OOXML: [0x50, 0x4B, 0x03, 0x04], // PK.. (ZIP header)
  
  // Legacy Office formats
  OLE2: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], // OLE2 Compound Document
  
  // PDF format
  PDF: [0x25, 0x50, 0x44, 0x46], // %PDF
};

/**
 * File extension mappings
 */
const EXTENSION_MAPPINGS = {
  // Word documents
  '.docx': 'word',
  '.doc': 'word',
  '.docm': 'word',
  '.dotx': 'word',
  '.dotm': 'word',
  
  // Excel documents
  '.xlsx': 'excel',
  '.xls': 'excel',
  '.xlsm': 'excel',
  '.xlsb': 'excel',
  '.xltx': 'excel',
  '.xltm': 'excel',
  '.csv': 'excel',
  
  // PowerPoint documents
  '.pptx': 'powerpoint',
  '.ppt': 'powerpoint',
  '.pptm': 'powerpoint',
  '.potx': 'powerpoint',
  '.potm': 'powerpoint',
  '.ppsx': 'powerpoint',
  '.ppsm': 'powerpoint',
  
  // PDF documents
  '.pdf': 'pdf'
};

/**
 * OOXML content type mappings
 */
const OOXML_CONTENT_TYPES = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template': 'word',
  'application/vnd.ms-word.document.macroEnabled.12': 'word',
  'application/vnd.ms-word.template.macroEnabled.12': 'word',
  
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.template': 'excel',
  'application/vnd.ms-excel.sheet.macroEnabled.12': 'excel',
  'application/vnd.ms-excel.template.macroEnabled.12': 'excel',
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12': 'excel',
  
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.template': 'powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow': 'powerpoint',
  'application/vnd.ms-powerpoint.presentation.macroEnabled.12': 'powerpoint',
  'application/vnd.ms-powerpoint.template.macroEnabled.12': 'powerpoint',
  'application/vnd.ms-powerpoint.slideshow.macroEnabled.12': 'powerpoint'
};

/**
 * File format detector for Office documents
 */
export class FileFormatDetector {
  /**
   * Creates a new file format detector
   * 
   * @param {Object} [options={}] - Detection options
   */
  constructor(options = {}) {
    this.options = {
      useExtensionFallback: true,
      useMagicBytes: true,
      useContentAnalysis: true,
      maxReadBytes: 8192,
      ...options
    };
  }

  /**
   * Detects the format of an Office document
   * 
   * @param {string} filePath - Path to the file to analyze
   * @returns {Promise<string>} Detected format (word, excel, powerpoint, pdf, unknown)
   */
  async detectFormat(filePath) {
    try {
      // First try extension-based detection
      if (this.options.useExtensionFallback) {
        const extensionFormat = this.detectFormatByExtension(filePath);
        if (extensionFormat && extensionFormat !== 'unknown') {
          // Verify with magic bytes if available
          if (this.options.useMagicBytes) {
            const magicFormat = await this.detectFormatByMagicBytes(filePath);
            if (magicFormat && this.isCompatibleFormat(extensionFormat, magicFormat)) {
              return extensionFormat;
            }
          } else {
            return extensionFormat;
          }
        }
      }

      // Try magic byte detection
      if (this.options.useMagicBytes) {
        const magicFormat = await this.detectFormatByMagicBytes(filePath);
        if (magicFormat && magicFormat !== 'unknown') {
          return magicFormat;
        }
      }

      // Try content analysis for OOXML files
      if (this.options.useContentAnalysis) {
        const contentFormat = await this.detectFormatByContent(filePath);
        if (contentFormat && contentFormat !== 'unknown') {
          return contentFormat;
        }
      }

      // Fallback to extension if all else fails
      const extensionFormat = this.detectFormatByExtension(filePath);
      return extensionFormat || 'unknown';

    } catch (error) {
      throw new Error(`Failed to detect file format: ${error.message}`);
    }
  }

  /**
   * Detects format based on file extension
   * 
   * @param {string} filePath - File path to analyze
   * @returns {string} Detected format or 'unknown'
   */
  detectFormatByExtension(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    return EXTENSION_MAPPINGS[extension] || 'unknown';
  }

  /**
   * Detects format based on magic bytes
   * 
   * @param {string} filePath - File path to analyze
   * @returns {Promise<string>} Detected format or 'unknown'
   */
  async detectFormatByMagicBytes(filePath) {
    try {
      const fileHandle = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(Math.max(...Object.values(MAGIC_SIGNATURES).map(sig => sig.length)));
      
      try {
        await fileHandle.read(buffer, 0, buffer.length, 0);
        
        // Check for OLE2 signature (legacy Office formats)
        if (this.matchesMagicBytes(buffer, MAGIC_SIGNATURES.OLE2)) {
          // Need additional analysis to determine specific Office type
          return await this.detectOLE2Format(filePath);
        }
        
        // Check for OOXML signature (modern Office formats)
        if (this.matchesMagicBytes(buffer, MAGIC_SIGNATURES.OOXML)) {
          // OOXML files are ZIP-based, need content analysis
          return await this.detectFormatByContent(filePath);
        }
        
        // Check for PDF signature
        if (this.matchesMagicBytes(buffer, MAGIC_SIGNATURES.PDF)) {
          return 'pdf';
        }
        
        return 'unknown';
        
      } finally {
        await fileHandle.close();
      }
      
    } catch (error) {
      // If we can't read the file, fall back to extension detection
      return this.detectFormatByExtension(filePath);
    }
  }

  /**
   * Detects format by analyzing OOXML content
   * 
   * @param {string} filePath - File path to analyze
   * @returns {Promise<string>} Detected format or 'unknown'
   */
  async detectFormatByContent(filePath) {
    try {
      // For OOXML files, we would typically:
      // 1. Extract the [Content_Types].xml file from the ZIP
      // 2. Parse the content types to determine the document type
      
      // This is a simplified implementation - in practice you'd use a ZIP library
      // to extract and parse the content types file
      
      const buffer = await fs.readFile(filePath);
      const content = buffer.toString('utf8', 0, Math.min(buffer.length, this.options.maxReadBytes));
      
      // Look for content type indicators in the file
      for (const [contentType, format] of Object.entries(OOXML_CONTENT_TYPES)) {
        if (content.includes(contentType)) {
          return format;
        }
      }
      
      // Look for document-specific XML namespaces
      if (content.includes('wordprocessingml') || content.includes('w:document')) {
        return 'word';
      }
      
      if (content.includes('spreadsheetml') || content.includes('x:workbook')) {
        return 'excel';
      }
      
      if (content.includes('presentationml') || content.includes('p:presentation')) {
        return 'powerpoint';
      }
      
      return 'unknown';
      
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Detects OLE2-based document format
   * 
   * @param {string} filePath - File path to analyze
   * @returns {Promise<string>} Detected format or 'unknown'
   */
  async detectOLE2Format(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      const content = buffer.toString('binary', 0, Math.min(buffer.length, this.options.maxReadBytes));
      
      // Look for OLE2 stream names that indicate document type
      if (content.includes('WordDocument') || content.includes('1Table')) {
        return 'word';
      }
      
      if (content.includes('Workbook') || content.includes('Book')) {
        return 'excel';
      }
      
      if (content.includes('PowerPoint Document') || content.includes('Current User')) {
        return 'powerpoint';
      }
      
      // Default to extension-based detection for OLE2 files
      return this.detectFormatByExtension(filePath);
      
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Checks if buffer matches magic byte signature
   * 
   * @param {Buffer} buffer - Buffer to check
   * @param {number[]} signature - Magic byte signature
   * @returns {boolean} Whether buffer matches signature
   * @private
   */
  matchesMagicBytes(buffer, signature) {
    if (buffer.length < signature.length) {
      return false;
    }
    
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Checks if two detected formats are compatible
   * 
   * @param {string} format1 - First format
   * @param {string} format2 - Second format
   * @returns {boolean} Whether formats are compatible
   * @private
   */
  isCompatibleFormat(format1, format2) {
    // Same format is always compatible
    if (format1 === format2) {
      return true;
    }
    
    // Unknown formats are considered incompatible
    if (format1 === 'unknown' || format2 === 'unknown') {
      return false;
    }
    
    // All other combinations are considered incompatible for now
    // In a more sophisticated implementation, you might allow some cross-compatibility
    return false;
  }

  /**
   * Gets supported file extensions
   * 
   * @returns {string[]} Array of supported extensions
   */
  getSupportedExtensions() {
    return Object.keys(EXTENSION_MAPPINGS);
  }

  /**
   * Gets supported document formats
   * 
   * @returns {string[]} Array of supported formats
   */
  getSupportedFormats() {
    return [...new Set(Object.values(EXTENSION_MAPPINGS))];
  }

  /**
   * Checks if a file extension is supported
   * 
   * @param {string} extension - File extension to check (with or without dot)
   * @returns {boolean} Whether extension is supported
   */
  isExtensionSupported(extension) {
    const normalizedExtension = extension.startsWith('.') ? extension : `.${extension}`;
    return normalizedExtension.toLowerCase() in EXTENSION_MAPPINGS;
  }

  /**
   * Checks if a format is supported
   * 
   * @param {string} format - Format to check
   * @returns {boolean} Whether format is supported
   */
  isFormatSupported(format) {
    return Object.values(EXTENSION_MAPPINGS).includes(format.toLowerCase());
  }

  /**
   * Gets MIME type for a detected format
   * 
   * @param {string} format - Document format
   * @returns {string} MIME type or 'application/octet-stream'
   */
  getMimeType(format) {
    const mimeTypes = {
      word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      powerpoint: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      pdf: 'application/pdf'
    };
    
    return mimeTypes[format.toLowerCase()] || 'application/octet-stream';
  }
}