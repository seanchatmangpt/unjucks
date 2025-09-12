/**
 * Enhanced OPC Normalization Validation Tests
 * 
 * Comprehensive test suite for the enhanced OPC normalizer that validates
 * 99.9% Office document reproducibility through extensive normalization testing.
 * 
 * @module enhanced-opc-validation-test
 * @version 2.0.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnhancedOPCNormalizer, createEnhancedOPCNormalizer, normalizeOfficeDocumentEnhanced, validateDocumentReproducibility } from '../../packages/kgen-core/src/office/normalization/enhanced-opc-normalizer.js';
import * as fflate from 'fflate';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

describe('Enhanced OPC Normalization Validation', () => {
  let normalizer;
  let testDir;

  beforeEach(async () => {
    // Create test directory
    testDir = `/tmp/opc-test-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 9)}`;
    await fs.mkdir(testDir, { recursive: true });

    // Initialize enhanced normalizer with strict settings
    normalizer = new EnhancedOPCNormalizer({
      removeTimestamps: true,
      normalizeWhitespace: true,
      sortElements: true,
      removeComments: true,
      removeMetadata: true,
      useC14N: true,
      strictSorting: true,
      compressionLevel: 6,
      deterministicTimestamp: new Date('2000-01-01T00:00:00.000Z')
    });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Enhanced opcCanonicalZip Function', () => {
    it('should create deterministic ZIP with canonical ordering', async () => {
      const testFiles = createComplexOfficeStructure();
      
      // Generate ZIP multiple times
      const zips = [];
      for (let i = 0; i < 5; i++) {
        const zipBuffer = normalizer.opcCanonicalZip(testFiles);
        zips.push(zipBuffer);
      }
      
      // All ZIP files should be identical
      const hashes = zips.map(zip => crypto.createHash('sha256').update(zip).digest('hex'));
      const uniqueHashes = new Set(hashes);
      
      expect(uniqueHashes.size).toBe(1);
      console.log(`Canonical ZIP consistency: ${hashes.length} identical hashes`);
    });

    it('should sort file paths with Office-specific priorities', () => {
      const testPaths = [
        'word/media/image1.png',
        'word/document.xml',
        '[Content_Types].xml',
        '_rels/.rels',
        'word/_rels/document.xml.rels',
        'word/styles.xml',
        'docProps/core.xml',
        'word/settings.xml',
        'word/fontTable.xml'
      ];
      
      const sortedPaths = normalizer.sortFilePathsCanonically(testPaths);
      
      // Verify correct priority ordering
      expect(sortedPaths[0]).toBe('[Content_Types].xml');
      expect(sortedPaths[1]).toBe('_rels/.rels');
      expect(sortedPaths[2]).toBe('word/_rels/document.xml.rels');
      expect(sortedPaths[3]).toBe('word/document.xml');
      
      console.log('Sorted paths:', sortedPaths);
    });

    it('should create canonical file metadata', () => {
      const testContent = new TextEncoder().encode('Test content');
      const crc32 = normalizer.calculateCRC32(testContent);
      
      const metadata = normalizer.createCanonicalFileMetadata('test.xml', testContent, crc32);
      
      expect(metadata.mtime).toEqual(new Date('2000-01-01T00:00:00.000Z'));
      expect(metadata.mode).toBe(0o100644);
      expect(metadata.uid).toBe(0);
      expect(metadata.gid).toBe(0);
      expect(metadata.size).toBe(testContent.length);
      expect(metadata.comment).toBe('');
      expect(metadata.extra).toEqual(Buffer.alloc(0));
    });

    it('should choose optimal compression methods consistently', () => {
      const smallContent = new TextEncoder().encode('small');
      const largeContent = new TextEncoder().encode('x'.repeat(20000));
      const mediumTextContent = new TextEncoder().encode('test content with repeated patterns'.repeat(50));
      const mediumBinaryContent = crypto.randomBytes(5000);
      
      expect(normalizer.getOptimalCompressionMethod(smallContent)).toBe(0); // Store
      expect(normalizer.getOptimalCompressionMethod(largeContent)).toBe(8); // Deflate
      expect(normalizer.getOptimalCompressionMethod(mediumTextContent)).toBe(8); // Deflate (low entropy)
      expect(normalizer.getOptimalCompressionMethod(mediumBinaryContent)).toBe(0); // Store (high entropy)
    });

    it('should calculate entropy correctly', () => {
      const lowEntropyData = new TextEncoder().encode('aaaaaaaaaa'); // Repeated characters
      const highEntropyData = crypto.randomBytes(1000); // Random data
      
      const lowEntropy = normalizer.calculateEntropy(lowEntropyData);
      const highEntropy = normalizer.calculateEntropy(highEntropyData);
      
      expect(lowEntropy).toBeLessThan(2); // Very predictable
      expect(highEntropy).toBeGreaterThan(7); // Very random
      
      console.log(`Entropy: Low=${lowEntropy.toFixed(2)}, High=${highEntropy.toFixed(2)}`);
    });
  });

  describe('Advanced XML Canonicalization', () => {
    it('should canonicalize XML with comprehensive normalization', () => {
      const testXML = `<?xml version="1.0" encoding="UTF-8"?>
<!-- This is a comment -->
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            w:rsid="00123456">
  <w:body>
    <w:p w:rsidRDefault="00654321" w:rsidR="00987654">
      <w:pPr>
        <w:spacing w:line="276" w:lineRule="auto"/>
      </w:pPr>
      <w:r w:rsid="00111111">
        <w:t>Test content</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;
      
      const normalized = normalizer.canonicalizeXMLContent(
        new TextEncoder().encode(testXML), 
        'word/document.xml'
      );
      
      const normalizedString = new TextDecoder().decode(normalized);
      
      // Verify comment removal
      expect(normalizedString).not.toContain('<!-- This is a comment -->');
      
      // Verify rsid removal
      expect(normalizedString).not.toContain('w:rsid');
      expect(normalizedString).not.toContain('w:rsidR');
      expect(normalizedString).not.toContain('w:rsidRDefault');
      
      // Verify consistent structure
      expect(normalizedString).toContain('<w:t>Test content</w:t>');
      
      console.log('Canonicalized XML length:', normalizedString.length);
    });

    it('should remove comprehensive timestamp patterns', () => {
      const timestampXML = `<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties">
  <dcterms:created xsi:type="dcterms:W3CDTF">2024-03-15T10:30:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2024-03-15T11:45:00Z</dcterms:modified>
  <cp:lastModifiedBy>John Doe</cp:lastModifiedBy>
  <cp:revision>5</cp:revision>
  <cp:lastPrinted>2024-03-15T09:00:00Z</cp:lastPrinted>
  <dc:creator>Author Name</dc:creator>
</cp:coreProperties>`;
      
      const normalized = normalizer.canonicalizeXMLContent(
        new TextEncoder().encode(timestampXML),
        'docProps/core.xml'
      );
      
      const normalizedString = new TextDecoder().decode(normalized);
      
      // Verify all timestamps removed
      expect(normalizedString).not.toContain('dcterms:created');
      expect(normalizedString).not.toContain('dcterms:modified');
      expect(normalizedString).not.toContain('lastModifiedBy');
      expect(normalizedString).not.toContain('revision');
      expect(normalizedString).not.toContain('lastPrinted');
      expect(normalizedString).not.toContain('dc:creator');
      
      console.log('Timestamp-cleaned XML:', normalizedString.slice(0, 200));
    });

    it('should normalize XML whitespace consistently', () => {
      const messyXML = `<?xml version="1.0" encoding="UTF-8"?>
<root>
	<element    attr="value"   >
		    <child>  content  </child>
  	</element>
	
	<element2>
  </element2>
</root>`;
      
      const normalized = normalizer.normalizeXMLWhitespaceAdvanced(messyXML);
      
      // Verify consistent formatting
      expect(normalized).not.toContain('\t'); // No tabs
      expect(normalized).not.toContain('  </'); // No trailing spaces before closing tags
      expect(normalized).not.toContain('>  <'); // No extra spaces between tags
      
      // Should preserve text content spacing
      expect(normalized).toContain('  content  '); // Preserve internal content spacing
      
      console.log('Normalized whitespace XML:', normalized);
    });

    it('should sort XML attributes consistently', () => {
      const attributeXML = `<element zebra="z" alpha="a" beta="b" w:val="word" xmlns:w="namespace" id="test">content</element>`;
      
      const sorted = normalizer.sortXMLElementsAdvanced(attributeXML);
      
      // Verify priority attributes come first, then alphabetical
      expect(sorted).toContain('xmlns:w="namespace" id="test" alpha="a" beta="b"');
      
      console.log('Sorted attributes:', sorted);
    });
  });

  describe('Content Types and Relationships Normalization', () => {
    it('should normalize content types with deterministic sorting', () => {
      const contentTypesXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
      
      const normalized = normalizer.normalizeContentTypesAdvanced(
        new TextEncoder().encode(contentTypesXML)
      );
      
      const normalizedString = new TextDecoder().decode(normalized);
      
      // Verify sorting: Default elements first (by extension), then Override elements (by PartName)
      const lines = normalizedString.split('\n').filter(line => line.trim());
      const defaultLines = lines.filter(line => line.includes('<Default'));
      const overrideLines = lines.filter(line => line.includes('<Override'));
      
      // Verify Default extensions are sorted
      expect(defaultLines[0]).toContain('Extension="rels"');
      expect(defaultLines[1]).toContain('Extension="xml"');
      
      // Verify Override parts are sorted
      expect(overrideLines[0]).toContain('PartName="/word/document.xml"');
      expect(overrideLines[1]).toContain('PartName="/word/styles.xml"');
      
      console.log('Normalized content types structure confirmed');
    });

    it('should normalize relationships with type-aware sorting', () => {
      const relationshipsXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="document.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;
      
      const normalized = normalizer.normalizeRelationshipsAdvanced(
        new TextEncoder().encode(relationshipsXML)
      );
      
      const normalizedString = new TextDecoder().decode(normalized);
      
      // Verify relationships are sorted by Type, then Target, then Id
      const lines = normalizedString.split('\n').filter(line => line.includes('<Relationship'));
      
      // Should be sorted by Type (alphabetically)
      expect(lines[0]).toContain('officeDocument');
      expect(lines[1]).toContain('settings');
      expect(lines[2]).toContain('styles');
      
      console.log('Normalized relationships structure confirmed');
    });

    it('should extract XML attributes correctly', () => {
      const element = '<Relationship Id="rId1" Type="document" Target="doc.xml"/>';
      
      expect(normalizer.extractAttribute(element, 'Id')).toBe('rId1');
      expect(normalizer.extractAttribute(element, 'Type')).toBe('document');
      expect(normalizer.extractAttribute(element, 'Target')).toBe('doc.xml');
      expect(normalizer.extractAttribute(element, 'NonExistent')).toBe('');
    });
  });

  describe('Office Format Support and Validation', () => {
    it('should validate DOCX document structure', async () => {
      const docxBuffer = createTestDocx();
      const validation = await normalizer.validateOfficeDocument(docxBuffer);
      
      expect(validation.valid).toBe(true);
      expect(validation.format).toBe('docx');
      expect(validation.errors).toHaveLength(0);
      
      console.log('DOCX validation result:', validation);
    });

    it('should validate XLSX document structure', async () => {
      const xlsxBuffer = createTestXlsx();
      const validation = await normalizer.validateOfficeDocument(xlsxBuffer);
      
      expect(validation.valid).toBe(true);
      expect(validation.format).toBe('xlsx');
      expect(validation.errors).toHaveLength(0);
      
      console.log('XLSX validation result:', validation);
    });

    it('should validate PPTX document structure', async () => {
      const pptxBuffer = createTestPptx();
      const validation = await normalizer.validateOfficeDocument(pptxBuffer);
      
      expect(validation.valid).toBe(true);
      expect(validation.format).toBe('pptx');
      expect(validation.errors).toHaveLength(0);
      
      console.log('PPTX validation result:', validation);
    });

    it('should detect invalid Office documents', async () => {
      const invalidBuffer = Buffer.from('This is not an Office document');
      const validation = await normalizer.validateOfficeDocument(invalidBuffer);
      
      expect(validation.valid).toBe(false);
      expect(validation.format).toBe('unknown');
      expect(validation.errors.length).toBeGreaterThan(0);
      
      console.log('Invalid document validation:', validation.errors);
    });
  });

  describe('99.9% Reproducibility Target', () => {
    it('should achieve 99.9% reproducibility with identical inputs', async () => {
      const testDocument = createComplexTestDocx();
      const runs = 100;
      const hashes = [];
      
      for (let i = 0; i < runs; i++) {
        const normalized = await normalizer.normalizeOfficeDocument(testDocument);
        const hash = crypto.createHash('sha256').update(normalized).digest('hex');
        hashes.push(hash);
      }
      
      const uniqueHashes = new Set(hashes);
      const reproducibilityRate = ((runs - uniqueHashes.size + 1) / runs) * 100;
      
      expect(reproducibilityRate).toBeGreaterThanOrEqual(99.9);
      
      console.log(`Reproducibility rate: ${reproducibilityRate.toFixed(3)}% (${uniqueHashes.size} unique hashes out of ${runs} runs)`);
    });

    it('should demonstrate deterministic document comparison', async () => {
      const doc1 = createTestDocx();
      const doc2 = createTestDocx(); // Identical document
      
      const comparison = await normalizer.verifyDocumentEquivalence(doc1, doc2);
      
      expect(comparison.identical).toBe(true);
      expect(comparison.differences).toHaveLength(0);
      expect(comparison.reproducibilityScore).toBe(100.0);
      
      console.log('Document comparison result:', comparison);
    });

    it('should detect semantic differences correctly', async () => {
      const doc1 = createTestDocx();
      const doc2 = createModifiedTestDocx(); // Modified content
      
      const comparison = await normalizer.verifyDocumentEquivalence(doc1, doc2);
      
      expect(comparison.identical).toBe(false);
      expect(comparison.differences.length).toBeGreaterThan(0);
      expect(comparison.reproducibilityScore).toBeLessThan(100.0);
      
      console.log('Different documents comparison:', comparison);
    });

    it('should handle concurrent normalization correctly', async () => {
      const testDocument = createTestDocx();
      const concurrentRuns = 10;
      
      const promises = [];
      for (let i = 0; i < concurrentRuns; i++) {
        promises.push(normalizer.normalizeOfficeDocument(testDocument));
      }
      
      const results = await Promise.all(promises);
      
      // All results should be identical
      const hashes = results.map(result => 
        crypto.createHash('sha256').update(result).digest('hex')
      );
      
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);
      
      console.log(`Concurrent normalization: ${concurrentRuns} runs, ${uniqueHashes.size} unique result`);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance targets for XML canonicalization', () => {
      const complexXML = createComplexXMLContent();
      
      const startTime = performance.now();
      const normalized = normalizer.canonicalizeXMLContent(
        new TextEncoder().encode(complexXML),
        'complex.xml'
      );
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(50); // 50ms target for complex XML
      expect(normalized.length).toBeGreaterThan(0);
      
      console.log(`XML canonicalization: ${processingTime.toFixed(2)}ms for ${complexXML.length} chars`);
    });

    it('should meet performance targets for ZIP canonicalization', () => {
      const complexOfficeStructure = createLargeOfficeStructure();
      
      const startTime = performance.now();
      const canonicalZip = normalizer.opcCanonicalZip(complexOfficeStructure);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(100); // 100ms target for ZIP canonicalization
      expect(canonicalZip.length).toBeGreaterThan(0);
      
      console.log(`ZIP canonicalization: ${processingTime.toFixed(2)}ms for ${Object.keys(complexOfficeStructure).length} files`);
    });

    it('should maintain consistent performance under load', async () => {
      const testDocument = createTestDocx();
      const iterations = 20;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await normalizer.normalizeOfficeDocument(testDocument);
        const endTime = performance.now();
        times.push(endTime - startTime);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const variance = maxTime - minTime;
      
      expect(avgTime).toBeLessThan(80); // 80ms average target
      expect(variance).toBeLessThan(50); // Consistent performance
      
      console.log(`Performance consistency: avg=${avgTime.toFixed(2)}ms, range=${minTime.toFixed(2)}-${maxTime.toFixed(2)}ms`);
    });
  });

  // Helper functions for creating test documents
  function createComplexOfficeStructure() {
    return {
      '[Content_Types].xml': new TextEncoder().encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
        '<Default Extension="xml" ContentType="application/xml"/>\n' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\n' +
        '</Types>'
      ),
      '_rels/.rels': new TextEncoder().encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>\n' +
        '</Relationships>'
      ),
      'word/document.xml': new TextEncoder().encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n' +
        '<w:body><w:p><w:r><w:t>Test content</w:t></w:r></w:p></w:body>\n' +
        '</w:document>'
      )
    };
  }

  function createTestDocx() {
    const files = {
      '[Content_Types].xml': new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`),
      '_rels/.rels': new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`),
      'word/document.xml': new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Test document content</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`)
    };
    
    return Buffer.from(fflate.zipSync(files));
  }

  function createTestXlsx() {
    const files = {
      '[Content_Types].xml': new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
</Types>`),
      '_rels/.rels': new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
      'xl/workbook.xml': new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`)
    };
    
    return Buffer.from(fflate.zipSync(files));
  }

  function createTestPptx() {
    const files = {
      '[Content_Types].xml': new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
</Types>`),
      '_rels/.rels': new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`),
      'ppt/presentation.xml': new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
</p:presentation>`)
    };
    
    return Buffer.from(fflate.zipSync(files));
  }

  function createComplexTestDocx() {
    const files = createComplexOfficeStructure();
    
    // Add timestamp and metadata to test normalization
    files['docProps/core.xml'] = new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties">
  <dcterms:created xsi:type="dcterms:W3CDTF">2024-03-15T10:30:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2024-03-15T11:45:00Z</dcterms:modified>
  <cp:lastModifiedBy>Test User</cp:lastModifiedBy>
  <cp:revision>1</cp:revision>
</cp:coreProperties>`);
    
    return Buffer.from(fflate.zipSync(files));
  }

  function createModifiedTestDocx() {
    const files = createComplexOfficeStructure();
    
    // Modify content to create differences
    files['word/document.xml'] = new TextEncoder().encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n' +
      '<w:body><w:p><w:r><w:t>Modified test content</w:t></w:r></w:p></w:body>\n' +
      '</w:document>'
    );
    
    return Buffer.from(fflate.zipSync(files));
  }

  function createComplexXMLContent() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Complex XML with many elements -->
<root xmlns:w="http://example.com/word" xmlns:r="http://example.com/relationships">
  ${Array.from({ length: 100 }, (_, i) => 
    `<element${i} attr3="c" attr1="a" attr2="b" w:rsid="${i.toString().padStart(8, '0')}">
      <child>Content ${i}</child>
      <timestamp>${this.getDeterministicDate().toISOString()}</timestamp>
    </element${i}>`
  ).join('\n  ')}
</root>`;
  }

  function createLargeOfficeStructure() {
    const files = createComplexOfficeStructure();
    
    // Add many files to test performance
    for (let i = 1; i <= 50; i++) {
      files[`word/media/image${i}.png`] = crypto.randomBytes(1000);
      files[`word/embeddings/data${i}.xml`] = new TextEncoder().encode(
        `<?xml version="1.0"?><data id="${i}">Sample data ${i}</data>`
      );
    }
    
    return files;
  }
});