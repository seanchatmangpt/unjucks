/**
 * Comprehensive Test Suite for Integrated Office Document Processor
 * 
 * Tests the full integration of:
 * - doc:// URI resolution
 * - OPC canonical normalization
 * - Deterministic document processing
 * - Content-addressed storage
 * 
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { IntegratedOfficeProcessor } from '../../packages/kgen-core/src/office/integrated-office-processor.js';
import { DocURIResolver } from '../../packages/kgen-core/src/office/doc-uri-resolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DATA_DIR = path.join(__dirname, 'test-data');
const TEMP_DIR = path.join(__dirname, '.tmp-integrated-test');

describe('IntegratedOfficeProcessor', () => {
  let processor;
  let testDocuments = {};

  beforeEach(async () => {
    // Clean up and create temp directory
    try {
      await fs.rm(TEMP_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
    
    await fs.mkdir(TEMP_DIR, { recursive: true });
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });

    // Initialize processor with test configuration
    processor = new IntegratedOfficeProcessor({
      casDirectory: path.join(TEMP_DIR, 'cas'),
      enableDeterministic: true,
      enableNormalization: true,
      enableContentAddressing: true,
      enableCache: true,
      defaultHashAlgorithm: 'sha256'
    });

    // Create test documents
    await setupTestDocuments();
  });

  afterEach(async () => {
    try {
      await fs.rm(TEMP_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Basic Functionality', () => {
    it('should initialize with correct configuration', () => {
      expect(processor).toBeDefined();
      expect(processor.options.enableDeterministic).toBe(true);
      expect(processor.options.enableNormalization).toBe(true);
      expect(processor.options.enableContentAddressing).toBe(true);
    });

    it('should validate system configuration', () => {
      const validation = processor.validateConfiguration();
      
      expect(validation.valid).toBe(true);
      expect(validation.components.deterministicProcessor).toBe(true);
      expect(validation.components.docResolver).toBe(true);
      expect(validation.components.opcNormalizer).toBe(true);
    });

    it('should get system status', () => {
      const status = processor.getSystemStatus();
      
      expect(status).toHaveProperty('deterministic');
      expect(status).toHaveProperty('docResolver');
      expect(status).toHaveProperty('cas');
      expect(status).toHaveProperty('normalization');
    });
  });

  describe('doc:// URI Processing', () => {
    it('should process template to doc:// URI', async () => {
      const context = {
        title: 'Test Document',
        author: 'Test Author',
        date: new Date('2024-01-01T00:00:00.000Z').toISOString()
      };

      const result = await processor.processToDocURI(
        testDocuments.simpleTemplate,
        context
      );

      expect(result.success).toBe(true);
      expect(result.docURI).toMatch(/^doc:\/\/sha256\/[a-f0-9]{64}$/);
      expect(result.contentAddressed).toBe(true);
      expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.deterministic).toBe(true);
    });

    it('should resolve doc:// URI to file', async () => {
      // First, create a doc:// URI
      const context = { title: 'Test', content: 'Hello World' };
      const processResult = await processor.processToDocURI(
        testDocuments.simpleTemplate,
        context
      );

      expect(processResult.success).toBe(true);

      // Then resolve it back to a file
      const outputPath = path.join(TEMP_DIR, 'resolved-document.txt');
      const resolveResult = await processor.resolveToFile(
        processResult.docURI,
        outputPath
      );

      expect(resolveResult.success).toBe(true);
      expect(resolveResult.writtenToFile).toBe(true);
      
      // Verify file was created and has content
      const fileExists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      const fileContent = await fs.readFile(outputPath);
      expect(fileContent.length).toBeGreaterThan(0);
    });

    it('should handle invalid doc:// URIs gracefully', async () => {
      const invalidURI = 'doc://sha256/invalid-hash';
      const outputPath = path.join(TEMP_DIR, 'should-not-exist.txt');
      
      const result = await processor.resolveToFile(invalidURI, outputPath);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.writtenToFile).toBe(false);
    });
  });

  describe('Document Canonicalization', () => {
    it('should canonicalize file:// URI to doc:// URI', async () => {
      const fileURI = `file://${testDocuments.sampleOfficeDoc}`;
      
      const result = await processor.canonicalizeDocument(fileURI);
      
      expect(result.success).toBe(true);
      expect(result.canonical).toBe(true);
      expect(result.docURI).toMatch(/^doc:\/\/sha256\/[a-f0-9]{64}$/);
      expect(result.sourceUri).toBe(fileURI);
    });

    it('should handle already canonical doc:// URIs', async () => {
      // First canonicalize a document
      const fileURI = `file://${testDocuments.sampleOfficeDoc}`;
      const firstResult = await processor.canonicalizeDocument(fileURI);
      
      expect(firstResult.success).toBe(true);
      
      // Then try to canonicalize the resulting doc:// URI
      const secondResult = await processor.canonicalizeDocument(firstResult.docURI);
      
      expect(secondResult.success).toBe(true);
      expect(secondResult.alreadyCanonical).toBe(true);
      expect(secondResult.docURI).toBe(firstResult.docURI);
    });
  });

  describe('Document Normalization', () => {
    it('should normalize Office documents deterministically', async () => {
      const documentBuffer = await fs.readFile(testDocuments.sampleOfficeDoc);
      
      // Normalize the same document multiple times
      const normalized1 = await processor.normalizeDocument(documentBuffer);
      const normalized2 = await processor.normalizeDocument(documentBuffer);
      
      // Results should be identical
      expect(Buffer.compare(normalized1, normalized2)).toBe(0);
      
      // Should be different from original (unless already normalized)
      expect(normalized1.length).toBeGreaterThan(0);
    });

    it('should reject non-Office documents', async () => {
      const textBuffer = Buffer.from('This is not an Office document');
      
      await expect(processor.normalizeDocument(textBuffer))
        .rejects.toThrow('not a valid Office document');
    });
  });

  describe('Document Comparison', () => {
    it('should compare identical documents', async () => {
      const doc1URI = `file://${testDocuments.sampleOfficeDoc}`;
      const doc2URI = `file://${testDocuments.sampleOfficeDoc}`;
      
      const result = await processor.compareDocuments(doc1URI, doc2URI);
      
      expect(result.success).toBe(true);
      expect(result.identical).toBe(true);
      expect(result.hash1).toBe(result.hash2);
      expect(result.differences).toHaveLength(0);
    });

    it('should compare different documents', async () => {
      const doc1URI = `file://${testDocuments.sampleOfficeDoc}`;
      const doc2URI = `file://${testDocuments.anotherOfficeDoc}`;
      
      const result = await processor.compareDocuments(doc1URI, doc2URI);
      
      expect(result.success).toBe(true);
      expect(result.identical).toBe(false);
      expect(result.hash1).not.toBe(result.hash2);
      expect(result.differences.length).toBeGreaterThan(0);
    });
  });

  describe('Batch Processing', () => {
    it('should batch process templates to doc:// URIs', async () => {
      const templates = [
        {
          templatePath: testDocuments.simpleTemplate,
          context: { title: 'Doc 1', content: 'Content 1' }
        },
        {
          templatePath: testDocuments.simpleTemplate,
          context: { title: 'Doc 2', content: 'Content 2' }
        },
        {
          templatePath: testDocuments.simpleTemplate,
          context: { title: 'Doc 3', content: 'Content 3' }
        }
      ];

      const result = await processor.batchProcess(templates, {
        outputType: 'docuri',
        concurrency: 2
      });

      expect(result.success).toBe(true);
      expect(result.totalTemplates).toBe(3);
      expect(result.successfullyProcessed).toBe(3);
      expect(result.results).toHaveLength(3);
      expect(result.errors).toHaveLength(0);

      // Check that all results have doc:// URIs
      result.results.forEach(res => {
        expect(res.docURI).toMatch(/^doc:\/\/sha256\/[a-f0-9]{64}$/);
        expect(res.contentAddressed).toBe(true);
      });

      // Check that different contexts produce different doc:// URIs
      const docURIs = result.results.map(r => r.docURI);
      const uniqueURIs = new Set(docURIs);
      expect(uniqueURIs.size).toBe(3);
    });

    it('should batch process templates to files', async () => {
      const templates = [
        {
          templatePath: testDocuments.simpleTemplate,
          context: { title: 'Doc 1' },
          outputPath: path.join(TEMP_DIR, 'batch1.txt')
        },
        {
          templatePath: testDocuments.simpleTemplate,
          context: { title: 'Doc 2' },
          outputPath: path.join(TEMP_DIR, 'batch2.txt')
        }
      ];

      const result = await processor.batchProcess(templates, {
        outputType: 'file',
        concurrency: 2
      });

      expect(result.success).toBe(true);
      expect(result.totalTemplates).toBe(2);
      expect(result.successfullyProcessed).toBe(2);

      // Verify files were created
      for (const template of templates) {
        const fileExists = await fs.access(template.outputPath)
          .then(() => true)
          .catch(() => false);
        expect(fileExists).toBe(true);
      }
    });

    it('should handle batch processing errors gracefully', async () => {
      const templates = [
        {
          templatePath: 'non-existent-template.txt',
          context: { title: 'Should fail' }
        },
        {
          templatePath: testDocuments.simpleTemplate,
          context: { title: 'Should succeed' }
        }
      ];

      const result = await processor.batchProcess(templates, {
        outputType: 'docuri'
      });

      expect(result.success).toBe(false); // Overall failure due to one error
      expect(result.totalTemplates).toBe(2);
      expect(result.successfullyProcessed).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('Reproducibility and Determinism', () => {
    it('should produce identical results for identical inputs', async () => {
      const context = {
        title: 'Reproducibility Test',
        date: '2024-01-01T00:00:00.000Z'
      };

      // Process the same template multiple times
      const results = await Promise.all([
        processor.processToDocURI(testDocuments.simpleTemplate, context),
        processor.processToDocURI(testDocuments.simpleTemplate, context),
        processor.processToDocURI(testDocuments.simpleTemplate, context)
      ]);

      // All results should be successful
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.deterministic).toBe(true);
      });

      // All doc:// URIs should be identical
      const docURIs = results.map(r => r.docURI);
      const uniqueURIs = new Set(docURIs);
      expect(uniqueURIs.size).toBe(1);

      // All content hashes should be identical
      const contentHashes = results.map(r => r.contentHash);
      const uniqueHashes = new Set(contentHashes);
      expect(uniqueHashes.size).toBe(1);
    });

    it('should produce different results for different contexts', async () => {
      const contexts = [
        { title: 'Context 1', value: 'A' },
        { title: 'Context 2', value: 'B' },
        { title: 'Context 3', value: 'C' }
      ];

      const results = await Promise.all(
        contexts.map(context => 
          processor.processToDocURI(testDocuments.simpleTemplate, context)
        )
      );

      // All should be successful
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // All should have different doc:// URIs
      const docURIs = results.map(r => r.docURI);
      const uniqueURIs = new Set(docURIs);
      expect(uniqueURIs.size).toBe(3);
    });
  });

  describe('Cache Management', () => {
    it('should use cache for repeated operations', async () => {
      const context = { title: 'Cache Test' };

      // First processing
      const result1 = await processor.processToDocURI(
        testDocuments.simpleTemplate,
        context
      );

      // Second processing should use cache
      const result2 = await processor.processToDocURI(
        testDocuments.simpleTemplate,
        context
      );

      expect(result1.docURI).toBe(result2.docURI);
      expect(result1.contentHash).toBe(result2.contentHash);

      // Check cache stats
      const status = processor.getSystemStatus();
      expect(status.docResolver.size).toBeGreaterThan(0);
    });

    it('should clear caches properly', () => {
      processor.clearCaches();
      
      const status = processor.getSystemStatus();
      expect(status.docResolver.size).toBe(0);
    });
  });

  // Helper function to set up test documents
  async function setupTestDocuments() {
    // Create simple template
    const simpleTemplate = path.join(TEST_DATA_DIR, 'simple-template.txt');
    const templateContent = `Title: {{title}}
Author: {{author}}
Date: {{date}}
Content: {{content}}`;
    
    await fs.writeFile(simpleTemplate, templateContent);
    testDocuments.simpleTemplate = simpleTemplate;

    // Create sample Office documents (mock ZIP files with Office structure)
    testDocuments.sampleOfficeDoc = await createMockOfficeDocument('sample.docx');
    testDocuments.anotherOfficeDoc = await createMockOfficeDocument('another.docx');
  }

  // Helper function to create mock Office documents
  async function createMockOfficeDocument(filename) {
    const filePath = path.join(TEST_DATA_DIR, filename);
    
    // Create a minimal ZIP file structure that resembles an Office document
    const zipSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // ZIP file signature
    const mockContent = Buffer.concat([
      zipSignature,
      Buffer.from('PK'), // Additional ZIP headers
      Buffer.from([0x01, 0x02]), // Version
      Buffer.from(filename), // Mock content with filename for uniqueness
      Buffer.from('</xml>') // Mock XML ending
    ]);
    
    await fs.writeFile(filePath, mockContent);
    return filePath;
  }
});

describe('DocURIResolver Standalone', () => {
  let resolver;

  beforeEach(async () => {
    try {
      await fs.rm(TEMP_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
    
    await fs.mkdir(TEMP_DIR, { recursive: true });

    resolver = new DocURIResolver({
      casDirectory: path.join(TEMP_DIR, 'cas'),
      enableCache: true,
      enableNormalization: true
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(TEMP_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('URI Parsing', () => {
    it('should parse valid doc:// URIs correctly', () => {
      const uri = 'doc://sha256/abc123def456789012345678901234567890123456789012345678901234567890';
      const parsed = resolver.parseURI(uri);

      expect(parsed.scheme).toBe('doc');
      expect(parsed.algorithm).toBe('sha256');
      expect(parsed.hash).toBe('abc123def456789012345678901234567890123456789012345678901234567890');
      expect(parsed.isCanonical).toBe(true);
    });

    it('should reject invalid doc:// URIs', () => {
      const invalidURIs = [
        'doc://invalid/hash',
        'doc://sha256/tooshort',
        'doc://sha256/toolonghashabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefextra',
        'doc://unsupported-algo/abc123def456789012345678901234567890123456789012345678901234567890'
      ];

      invalidURIs.forEach(uri => {
        expect(() => resolver.parseURI(uri)).toThrow();
      });
    });

    it('should parse file:// URIs correctly', () => {
      const uri = 'file:///path/to/document.docx';
      const parsed = resolver.parseURI(uri);

      expect(parsed.scheme).toBe('file');
      expect(parsed.pathname).toBe('/path/to/document.docx');
      expect(parsed.isCanonical).toBeUndefined();
    });
  });

  describe('Hash Validation', () => {
    it('should validate SHA-256 hashes correctly', () => {
      const validHash = 'abc123def456789012345678901234567890123456789012345678901234567890';
      const invalidHashes = [
        'abc123def456', // Too short
        'abc123def456789012345678901234567890123456789012345678901234567890xyz', // Too long
        'ABC123DEF456789012345678901234567890123456789012345678901234567890', // Uppercase (should still work)
        'xyz123def456789012345678901234567890123456789012345678901234567890' // Invalid hex
      ];

      expect(resolver.isValidHash(validHash, 'sha256')).toBe(true);
      expect(resolver.isValidHash(validHash.toUpperCase(), 'sha256')).toBe(true);
      
      invalidHashes.slice(0, -1).forEach(hash => {
        expect(resolver.isValidHash(hash, 'sha256')).toBe(false);
      });
    });
  });

  describe('Content Hash Computation', () => {
    it('should compute consistent SHA-256 hashes', () => {
      const content = Buffer.from('Hello, World!');
      
      const hash1 = resolver.computeContentHash(content, 'sha256');
      const hash2 = resolver.computeContentHash(content, 'sha256');
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce different hashes for different content', () => {
      const content1 = Buffer.from('Hello, World!');
      const content2 = Buffer.from('Goodbye, World!');
      
      const hash1 = resolver.computeContentHash(content1);
      const hash2 = resolver.computeContentHash(content2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Office Document Detection', () => {
    it('should detect valid Office documents', () => {
      // Office documents are ZIP files starting with PK signature
      const officeDoc = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00]);
      expect(resolver.isOfficeDocument(officeDoc)).toBe(true);
    });

    it('should reject non-Office documents', () => {
      const textDoc = Buffer.from('This is just text');
      const pdfDoc = Buffer.from([0x25, 0x50, 0x44, 0x46]); // PDF signature
      
      expect(resolver.isOfficeDocument(textDoc)).toBe(false);
      expect(resolver.isOfficeDocument(pdfDoc)).toBe(false);
    });
  });
});