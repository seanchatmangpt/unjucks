import fs from 'fs-extra';
import path from 'path';
import consola from 'consola';

/**
 * Detects Office file formats and validates file types
 * @class FileFormatDetector
 */
export class FileFormatDetector {
  /**
   * Creates an instance of FileFormatDetector
   */
  constructor() {
    this.logger = consola.create({ tag: 'FileFormatDetector' });
    
    // File signatures (magic numbers) for Office formats
    this.signatures = {
      // ZIP-based formats (modern Office files)
      zip: [0x50, 0x4B, 0x03, 0x04], // PK..
      
      // Legacy Office formats
      ole2: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], // OLE2 signature
      
      // PDF format
      pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
    };
    
    // File extension mappings
    this.extensionMap = {
      // Word formats
      '.docx': 'word',
      '.docm': 'word',
      '.dotx': 'word',
      '.dotm': 'word',
      '.doc': 'word',
      '.dot': 'word',
      '.rtf': 'word',
      
      // Excel formats
      '.xlsx': 'excel',
      '.xlsm': 'excel',
      '.xltx': 'excel',
      '.xltm': 'excel',
      '.xls': 'excel',
      '.xlt': 'excel',
      '.csv': 'excel',
      
      // PowerPoint formats
      '.pptx': 'powerpoint',
      '.pptm': 'powerpoint',
      '.potx': 'powerpoint',
      '.potm': 'powerpoint',
      '.ppsx': 'powerpoint',
      '.ppsm': 'powerpoint',
      '.ppt': 'powerpoint',
      '.pot': 'powerpoint',
      '.pps': 'powerpoint',
      
      // Other formats
      '.pdf': 'pdf',
      '.txt': 'text',
      '.html': 'html',
      '.htm': 'html'
    };
    
    // Content type mappings for modern Office formats
    this.contentTypes = {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.template': 'word',
      'application/vnd.ms-word.document.macroEnabled.12': 'word',
      'application/vnd.ms-word.template.macroEnabled.12': 'word',
      'application/msword': 'word',
      
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.template': 'excel',
      'application/vnd.ms-excel.sheet.macroEnabled.12': 'excel',
      'application/vnd.ms-excel.template.macroEnabled.12': 'excel',
      'application/vnd.ms-excel': 'excel',
      
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.template': 'powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.slideshow': 'powerpoint',
      'application/vnd.ms-powerpoint.presentation.macroEnabled.12': 'powerpoint',
      'application/vnd.ms-powerpoint.template.macroEnabled.12': 'powerpoint',
      'application/vnd.ms-powerpoint': 'powerpoint'
    };
  }

  /**
   * Detects the format of an Office file
   * @param {string} filePath - Path to the file to analyze
   * @returns {Promise<string>} - Detected file format
   */
  async detectFormat(filePath) {
    try {
      // Check if file exists
      if (!(await fs.pathExists(filePath))) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Get file stats
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }

      // Start with extension-based detection
      const extension = path.extname(filePath).toLowerCase();
      let detectedFormat = this.extensionMap[extension];
      
      if (detectedFormat) {
        this.logger.debug(`Format detected by extension: ${detectedFormat} (${extension})`);
      }

      // Verify with file signature for more accuracy
      const signatureFormat = await this.detectBySignature(filePath);
      if (signatureFormat) {
        this.logger.debug(`Format detected by signature: ${signatureFormat}`);
        
        // If signature detection differs from extension, prefer signature
        if (detectedFormat && detectedFormat !== signatureFormat) {
          this.logger.warn(`Extension suggests ${detectedFormat} but signature suggests ${signatureFormat}. Using signature detection.`);
        }
        detectedFormat = signatureFormat;
      }

      // For ZIP-based formats, check content types
      if (signatureFormat === 'zip' || extension.endsWith('x') || extension.endsWith('m')) {
        const contentTypeFormat = await this.detectByContentType(filePath);
        if (contentTypeFormat) {
          this.logger.debug(`Format detected by content type: ${contentTypeFormat}`);
          detectedFormat = contentTypeFormat;
        }
      }

      if (!detectedFormat) {
        throw new Error(`Unable to detect file format for: ${path.basename(filePath)}`);
      }

      this.logger.info(`Detected format: ${detectedFormat} for ${path.basename(filePath)}`);
      return detectedFormat;
      
    } catch (error) {
      this.logger.error(`Error detecting file format: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detects file format by reading file signature (magic numbers)
   * @private
   * @param {string} filePath - Path to the file
   * @returns {Promise<string|null>} - Detected format or null
   */
  async detectBySignature(filePath) {
    try {
      // Read first 16 bytes to check signatures
      const handle = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(16);
      await handle.read(buffer, 0, 16, 0);
      await handle.close();

      // Check ZIP signature (modern Office formats)
      if (this.matchesSignature(buffer, this.signatures.zip)) {
        return 'zip'; // Will be refined by content type detection
      }

      // Check OLE2 signature (legacy Office formats)
      if (this.matchesSignature(buffer, this.signatures.ole2)) {
        return 'ole2'; // Will be refined by further analysis
      }

      // Check PDF signature
      if (this.matchesSignature(buffer, this.signatures.pdf)) {
        return 'pdf';
      }

      return null;
    } catch (error) {
      this.logger.debug(`Error reading file signature: ${error.message}`);
      return null;
    }
  }

  /**
   * Detects format by analyzing content types in ZIP-based Office files
   * @private
   * @param {string} filePath - Path to the file
   * @returns {Promise<string|null>} - Detected format or null
   */
  async detectByContentType(filePath) {
    try {
      // For ZIP-based Office formats, we would need to:
      // 1. Extract [Content_Types].xml from the ZIP
      // 2. Parse XML to find the main content type
      // 3. Map content type to Office application
      
      // Simplified implementation based on common ZIP structure patterns
      const JSZip = await import('jszip').catch(() => null);
      if (!JSZip) {
        this.logger.debug('JSZip not available for content type detection');
        return null;
      }

      const data = await fs.readFile(filePath);
      const zip = new JSZip.default();
      const zipContent = await zip.loadAsync(data);

      // Check for Content_Types.xml
      const contentTypesFile = zipContent.file('[Content_Types].xml');
      if (contentTypesFile) {
        const contentTypesXml = await contentTypesFile.async('string');
        
        // Parse main content type from XML
        for (const [contentType, format] of Object.entries(this.contentTypes)) {
          if (contentTypesXml.includes(contentType)) {
            return format;
          }
        }
      }

      // Fallback: check for specific folder structures
      const fileNames = Object.keys(zipContent.files);
      
      if (fileNames.some(name => name.startsWith('word/'))) {
        return 'word';
      }
      if (fileNames.some(name => name.startsWith('xl/'))) {
        return 'excel';
      }
      if (fileNames.some(name => name.startsWith('ppt/'))) {
        return 'powerpoint';
      }

      return null;
    } catch (error) {
      this.logger.debug(`Error detecting content type: ${error.message}`);
      return null;
    }
  }

  /**
   * Checks if buffer matches a signature
   * @private
   * @param {Buffer} buffer - Buffer to check
   * @param {Array<number>} signature - Signature bytes to match
   * @returns {boolean} - Whether buffer matches signature
   */
  matchesSignature(buffer, signature) {
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
   * Gets detailed file information
   * @param {string} filePath - Path to the file
   * @returns {Promise<Object>} - Detailed file information
   */
  async getFileInfo(filePath) {
    const info = {
      path: filePath,
      basename: path.basename(filePath),
      extension: path.extname(filePath).toLowerCase(),
      exists: false,
      isFile: false,
      size: 0,
      detectedFormat: null,
      extensionFormat: null,
      signatureFormat: null,
      contentTypeFormat: null,
      isSupported: false,
      confidence: 'unknown'
    };

    try {
      // Check existence and basic info
      if (await fs.pathExists(filePath)) {
        info.exists = true;
        const stats = await fs.stat(filePath);
        info.isFile = stats.isFile();
        info.size = stats.size;
        info.lastModified = stats.mtime;
      }

      if (!info.exists || !info.isFile) {
        return info;
      }

      // Extension-based detection
      info.extensionFormat = this.extensionMap[info.extension] || null;

      // Signature-based detection
      info.signatureFormat = await this.detectBySignature(filePath);

      // Content type detection for ZIP-based formats
      if (info.signatureFormat === 'zip') {
        info.contentTypeFormat = await this.detectByContentType(filePath);
      }

      // Determine final format and confidence
      info.detectedFormat = await this.detectFormat(filePath);
      info.isSupported = ['word', 'excel', 'powerpoint'].includes(info.detectedFormat);
      
      // Calculate confidence level
      if (info.extensionFormat === info.signatureFormat && info.signatureFormat === info.contentTypeFormat) {
        info.confidence = 'high';
      } else if ((info.extensionFormat === info.signatureFormat) || (info.signatureFormat === info.contentTypeFormat)) {
        info.confidence = 'medium';
      } else if (info.extensionFormat || info.signatureFormat || info.contentTypeFormat) {
        info.confidence = 'low';
      }

      return info;
      
    } catch (error) {
      info.error = error.message;
      return info;
    }
  }

  /**
   * Checks if a file format is supported for injection
   * @param {string} format - Format to check
   * @returns {boolean} - Whether format is supported
   */
  isFormatSupported(format) {
    return ['word', 'excel', 'powerpoint'].includes(format?.toLowerCase());
  }

  /**
   * Gets supported file extensions
   * @returns {Array<string>} - Array of supported extensions
   */
  getSupportedExtensions() {
    return Object.keys(this.extensionMap).filter(ext => 
      this.isFormatSupported(this.extensionMap[ext])
    );
  }

  /**
   * Gets file format information
   * @returns {Object} - Format information and capabilities
   */
  getFormatInfo() {
    return {
      supportedFormats: ['word', 'excel', 'powerpoint'],
      supportedExtensions: this.getSupportedExtensions(),
      detectionMethods: ['extension', 'signature', 'contentType'],
      capabilities: {
        word: ['bookmarks', 'paragraphs', 'tables', 'headers', 'footers'],
        excel: ['cells', 'ranges', 'namedRanges', 'columns', 'rows', 'worksheets'],
        powerpoint: ['slides', 'placeholders', 'textBoxes', 'shapes', 'images', 'tables', 'charts']
      }
    };
  }

  /**
   * Validates that a file can be processed
   * @param {string} filePath - Path to the file
   * @returns {Promise<Object>} - Validation results
   */
  async validateFile(filePath) {
    const results = {
      valid: false,
      format: null,
      errors: [],
      warnings: [],
      info: null
    };

    try {
      // Get detailed file info
      results.info = await this.getFileInfo(filePath);
      
      if (!results.info.exists) {
        results.errors.push('File does not exist');
        return results;
      }

      if (!results.info.isFile) {
        results.errors.push('Path is not a file');
        return results;
      }

      if (results.info.size === 0) {
        results.warnings.push('File is empty');
      }

      if (results.info.size > 100 * 1024 * 1024) { // 100MB
        results.warnings.push('File is very large (>100MB) - processing may be slow');
      }

      if (!results.info.detectedFormat) {
        results.errors.push('Unable to detect file format');
        return results;
      }

      if (!this.isFormatSupported(results.info.detectedFormat)) {
        results.errors.push(`Format '${results.info.detectedFormat}' is not supported for injection`);
        return results;
      }

      if (results.info.confidence === 'low') {
        results.warnings.push('File format detection has low confidence');
      }

      results.valid = true;
      results.format = results.info.detectedFormat;
      
    } catch (error) {
      results.errors.push(`Validation error: ${error.message}`);
    }

    return results;
  }
}

export default FileFormatDetector;