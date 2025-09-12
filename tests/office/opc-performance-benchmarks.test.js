/**
 * OPC Normalization Performance Benchmarks
 * 
 * Performance benchmarking suite that validates the enhanced OPC normalizer
 * meets strict performance targets while achieving 99.9% reproducibility.
 * 
 * @module opc-performance-benchmarks-test
 * @version 2.0.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnhancedOPCNormalizer } from '../../packages/kgen-core/src/office/normalization/enhanced-opc-normalizer.js';
import * as fflate from 'fflate';
import crypto from 'crypto';
import { performance } from 'perf_hooks';

describe('OPC Performance Benchmarks', () => {
  let normalizer;
  
  // Performance targets (in milliseconds)
  const PERFORMANCE_TARGETS = {
    XML_CANONICALIZATION: 30,      // 30ms per XML file
    ZIP_CANONICALIZATION: 50,      // 50ms per ZIP operation
    FULL_DOCUMENT_PROCESSING: 150, // 150ms for complete document
    CONCURRENT_OVERHEAD: 200,      // 200ms for 10 concurrent operations
    REPRODUCIBILITY_RATE: 99.9,    // 99.9% reproducibility target
    MEMORY_EFFICIENCY: 100 * 1024 * 1024 // 100MB memory limit
  };

  beforeEach(() => {
    normalizer = new EnhancedOPCNormalizer({
      removeTimestamps: true,
      normalizeWhitespace: true,
      sortElements: true,
      removeComments: true,
      removeMetadata: true,
      useC14N: true,
      strictSorting: true,
      compressionLevel: 6
    });
  });

  describe('XML Canonicalization Performance', () => {
    it('should canonicalize simple XML within target time', () => {
      const simpleXML = createSimpleWordXML();
      const xmlBuffer = new TextEncoder().encode(simpleXML);
      
      const startTime = performance.now();
      const result = normalizer.canonicalizeXMLContent(xmlBuffer, 'document.xml');
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(PERFORMANCE_TARGETS.XML_CANONICALIZATION);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
      
      console.log(`Simple XML canonicalization: ${processingTime.toFixed(2)}ms`);
    });

    it('should canonicalize complex XML within target time', () => {
      const complexXML = createComplexWordXML();
      const xmlBuffer = new TextEncoder().encode(complexXML);
      
      const startTime = performance.now();
      const result = normalizer.canonicalizeXMLContent(xmlBuffer, 'document.xml');
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(PERFORMANCE_TARGETS.XML_CANONICALIZATION * 2); // Allow 2x for complex
      expect(result).toBeInstanceOf(Uint8Array);
      
      console.log(`Complex XML canonicalization: ${processingTime.toFixed(2)}ms (${complexXML.length} chars)`);
    });

    it('should handle XML with extensive timestamps efficiently', () => {
      const timestampXML = createTimestampHeavyXML();
      const xmlBuffer = new TextEncoder().encode(timestampXML);
      
      const startTime = performance.now();
      const result = normalizer.canonicalizeXMLContent(xmlBuffer, 'core.xml');
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      const resultString = new TextDecoder().decode(result);
      
      expect(processingTime).toBeLessThan(PERFORMANCE_TARGETS.XML_CANONICALIZATION);
      expect(resultString).not.toContain('dcterms:created');
      expect(resultString).not.toContain('dcterms:modified');
      
      console.log(`Timestamp removal performance: ${processingTime.toFixed(2)}ms`);
    });

    it('should maintain performance with repeated canonicalization', () => {
      const xmlContent = createMediumWordXML();
      const xmlBuffer = new TextEncoder().encode(xmlContent);
      const iterations = 20;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        normalizer.canonicalizeXMLContent(xmlBuffer, 'test.xml');
        const endTime = performance.now();
        times.push(endTime - startTime);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const variance = ((maxTime - minTime) / avgTime) * 100;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_TARGETS.XML_CANONICALIZATION);
      expect(variance).toBeLessThan(50); // Less than 50% variance
      
      console.log(`Repeated canonicalization: avg=${avgTime.toFixed(2)}ms, variance=${variance.toFixed(1)}%`);
    });
  });

  describe('ZIP Canonicalization Performance', () => {
    it('should create canonical ZIP within target time', () => {
      const files = createSimpleOfficeStructure();
      
      const startTime = performance.now();
      const zipBuffer = normalizer.opcCanonicalZip(files);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(PERFORMANCE_TARGETS.ZIP_CANONICALIZATION);
      expect(zipBuffer).toBeInstanceOf(Buffer);
      expect(zipBuffer.length).toBeGreaterThan(0);
      
      console.log(`Simple ZIP canonicalization: ${processingTime.toFixed(2)}ms`);
    });

    it('should handle large Office structures efficiently', () => {
      const files = createLargeOfficeStructure();
      const fileCount = Object.keys(files).length;
      
      const startTime = performance.now();
      const zipBuffer = normalizer.opcCanonicalZip(files);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(PERFORMANCE_TARGETS.ZIP_CANONICALIZATION * 3); // Allow 3x for large
      expect(zipBuffer).toBeInstanceOf(Buffer);
      
      console.log(`Large ZIP canonicalization: ${processingTime.toFixed(2)}ms (${fileCount} files)`);
    });

    it('should sort file paths efficiently', () => {
      const paths = createLargePathSet(1000);
      
      const startTime = performance.now();
      const sortedPaths = normalizer.sortFilePathsCanonically(paths);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(10); // 10ms for 1000 paths
      expect(sortedPaths).toHaveLength(paths.length);
      expect(sortedPaths[0]).toBe('[Content_Types].xml'); // Should be first
      
      console.log(`Path sorting performance: ${processingTime.toFixed(2)}ms for ${paths.length} paths`);
    });

    it('should calculate file metadata consistently', () => {
      const contents = Array.from({ length: 100 }, (_, i) => 
        new TextEncoder().encode(`Test content ${i}`)
      );
      
      const startTime = performance.now();
      const metadata = contents.map((content, i) => 
        normalizer.createCanonicalFileMetadata(`file${i}.xml`, content, normalizer.calculateCRC32(content))
      );
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(20); // 20ms for 100 files
      expect(metadata).toHaveLength(contents.length);
      
      // Verify all metadata has consistent timestamps
      const uniqueTimestamps = new Set(metadata.map(m => m.mtime.getTime()));
      expect(uniqueTimestamps.size).toBe(1);
      
      console.log(`Metadata generation: ${processingTime.toFixed(2)}ms for ${contents.length} files`);
    });
  });

  describe('Full Document Processing Performance', () => {
    it('should process complete DOCX within target time', async () => {
      const docxBuffer = createComplexDocx();
      
      const startTime = performance.now();
      const normalized = await normalizer.normalizeOfficeDocument(docxBuffer);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(PERFORMANCE_TARGETS.FULL_DOCUMENT_PROCESSING);
      expect(normalized).toBeInstanceOf(Buffer);
      expect(normalized.length).toBeGreaterThan(0);
      
      console.log(`Complete DOCX processing: ${processingTime.toFixed(2)}ms`);
    });

    it('should process complete XLSX within target time', async () => {
      const xlsxBuffer = createComplexXlsx();
      
      const startTime = performance.now();
      const normalized = await normalizer.normalizeOfficeDocument(xlsxBuffer);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(PERFORMANCE_TARGETS.FULL_DOCUMENT_PROCESSING);
      expect(normalized).toBeInstanceOf(Buffer);
      
      console.log(`Complete XLSX processing: ${processingTime.toFixed(2)}ms`);
    });

    it('should process complete PPTX within target time', async () => {
      const pptxBuffer = createComplexPptx();
      
      const startTime = performance.now();
      const normalized = await normalizer.normalizeOfficeDocument(pptxBuffer);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(PERFORMANCE_TARGETS.FULL_DOCUMENT_PROCESSING);
      expect(normalized).toBeInstanceOf(Buffer);
      
      console.log(`Complete PPTX processing: ${processingTime.toFixed(2)}ms`);
    });

    it('should maintain performance with progressive document sizes', async () => {
      const sizes = [1, 5, 10, 20, 50]; // Number of content elements
      const results = [];
      
      for (const size of sizes) {
        const docBuffer = createScalableDocx(size);
        
        const startTime = performance.now();
        await normalizer.normalizeOfficeDocument(docBuffer);
        const endTime = performance.now();
        
        const processingTime = endTime - startTime;
        results.push({ size, time: processingTime });
        
        console.log(`Size ${size}: ${processingTime.toFixed(2)}ms`);
      }
      
      // Verify linear or sub-linear scaling
      const largestTime = results[results.length - 1].time;
      const smallestTime = results[0].time;
      const scalingFactor = largestTime / smallestTime;
      const sizeRatio = sizes[sizes.length - 1] / sizes[0];
      
      expect(scalingFactor).toBeLessThan(sizeRatio); // Should be better than linear
      expect(largestTime).toBeLessThan(PERFORMANCE_TARGETS.FULL_DOCUMENT_PROCESSING);
      
      console.log(`Scaling performance: ${scalingFactor.toFixed(2)}x time for ${sizeRatio}x size`);
    });
  });

  describe('Concurrent Processing Performance', () => {
    it('should handle concurrent normalization efficiently', async () => {
      const docBuffer = createMediumDocx();
      const concurrentOperations = 10;
      
      const startTime = performance.now();
      const promises = Array.from({ length: concurrentOperations }, () => 
        normalizer.normalizeOfficeDocument(docBuffer)
      );
      
      const results = await Promise.all(promises);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const avgTimePerOperation = totalTime / concurrentOperations;
      
      expect(totalTime).toBeLessThan(PERFORMANCE_TARGETS.CONCURRENT_OVERHEAD);
      expect(results).toHaveLength(concurrentOperations);
      
      // Verify all results are identical
      const hashes = results.map(result => 
        crypto.createHash('sha256').update(result).digest('hex')
      );
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);
      
      console.log(`Concurrent processing: ${totalTime.toFixed(2)}ms total, ${avgTimePerOperation.toFixed(2)}ms avg per operation`);
    });

    it('should maintain determinism under concurrent load', async () => {
      const docBuffer = createTestDocx();
      const rounds = 5;
      const concurrentPerRound = 8;
      const allHashes = [];
      
      for (let round = 0; round < rounds; round++) {
        const promises = Array.from({ length: concurrentPerRound }, () => 
          normalizer.normalizeOfficeDocument(docBuffer)
        );
        
        const results = await Promise.all(promises);
        const hashes = results.map(result => 
          crypto.createHash('sha256').update(result).digest('hex')
        );
        
        allHashes.push(...hashes);
      }
      
      const uniqueHashes = new Set(allHashes);
      const reproducibilityRate = ((allHashes.length - uniqueHashes.size + 1) / allHashes.length) * 100;
      
      expect(reproducibilityRate).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.REPRODUCIBILITY_RATE);
      
      console.log(`Concurrent determinism: ${reproducibilityRate.toFixed(3)}% reproducibility over ${allHashes.length} operations`);
    });
  });

  describe('Memory Efficiency', () => {
    it('should process documents without excessive memory usage', async () => {
      const initialMemory = process.memoryUsage();
      const iterations = 20;
      const docBuffer = createMediumDocx();
      
      for (let i = 0; i < iterations; i++) {
        await normalizer.normalizeOfficeDocument(docBuffer);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_TARGETS.MEMORY_EFFICIENCY);
      
      console.log(`Memory usage: ${Math.round(memoryIncrease / 1024 / 1024)}MB increase after ${iterations} iterations`);
    });

    it('should handle large documents without memory leaks', async () => {
      const largeDocBuffer = createLargeDocx();
      const initialMemory = process.memoryUsage();
      
      // Process the large document multiple times
      for (let i = 0; i < 5; i++) {
        await normalizer.normalizeOfficeDocument(largeDocBuffer);
      }
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePerMB = memoryIncrease / (largeDocBuffer.length / 1024 / 1024);
      
      expect(memoryIncreasePerMB).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase per MB of document
      
      console.log(`Large document memory efficiency: ${Math.round(memoryIncreasePerMB / 1024 / 1024)}MB increase per MB processed`);
    });
  });

  describe('Reproducibility Performance', () => {
    it('should achieve target reproducibility rate efficiently', async () => {
      const docBuffer = createTestDocx();
      const iterations = 100;
      const hashes = [];
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        const normalized = await normalizer.normalizeOfficeDocument(docBuffer);
        const hash = crypto.createHash('sha256').update(normalized).digest('hex');
        hashes.push(hash);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      
      const uniqueHashes = new Set(hashes);
      const reproducibilityRate = ((iterations - uniqueHashes.size + 1) / iterations) * 100;
      
      expect(reproducibilityRate).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.REPRODUCIBILITY_RATE);
      expect(avgTime).toBeLessThan(PERFORMANCE_TARGETS.FULL_DOCUMENT_PROCESSING);
      
      console.log(`Reproducibility benchmark: ${reproducibilityRate.toFixed(3)}% in ${totalTime.toFixed(2)}ms (${avgTime.toFixed(2)}ms avg)`);
    });

    it('should detect differences efficiently', async () => {
      const doc1 = createTestDocx();
      const doc2 = createModifiedTestDocx();
      
      const startTime = performance.now();
      const comparison = await normalizer.verifyDocumentEquivalence(doc1, doc2);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(PERFORMANCE_TARGETS.FULL_DOCUMENT_PROCESSING * 2); // Allow 2x for comparison
      expect(comparison.identical).toBe(false);
      expect(comparison.differences.length).toBeGreaterThan(0);
      expect(comparison.reproducibilityScore).toBeLessThan(100);
      
      console.log(`Difference detection: ${processingTime.toFixed(2)}ms, score=${comparison.reproducibilityScore}%`);
    });
  });

  // Helper functions for creating test documents
  function createSimpleWordXML() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Simple test content</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;
  }

  function createComplexWordXML() {
    const paragraphs = Array.from({ length: 100 }, (_, i) => 
      `<w:p w:rsid="00${i.toString().padStart(6, '0')}">
        <w:pPr>
          <w:spacing w:line="276" w:lineRule="auto"/>
        </w:pPr>
        <w:r w:rsid="00${i.toString().padStart(6, '0')}">
          <w:t>Paragraph ${i} with complex formatting and revision IDs</w:t>
        </w:r>
      </w:p>`
    ).join('\n    ');

    return `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraphs}
  </w:body>
</w:document>`;
  }

  function createMediumWordXML() {
    const paragraphs = Array.from({ length: 20 }, (_, i) => 
      `<w:p>
        <w:r>
          <w:t>Medium content paragraph ${i}</w:t>
        </w:r>
      </w:p>`
    ).join('\n    ');

    return `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
  </w:body>
</w:document>`;
  }

  function createTimestampHeavyXML() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:dcmitype="http://purl.org/dc/dcmitype/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dcterms:created xsi:type="dcterms:W3CDTF">2024-03-15T10:30:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2024-03-15T11:45:00Z</dcterms:modified>
  <cp:lastModifiedBy>Test User ${this.getDeterministicTimestamp()}</cp:lastModifiedBy>
  <cp:revision>${Math.floor(Math.random() * 100)}</cp:revision>
  <cp:lastPrinted>2024-03-15T09:00:00Z</cp:lastPrinted>
  <dc:creator>Author ${this.getDeterministicTimestamp()}</dc:creator>
  <cp:totalTime>PT${Math.floor(Math.random() * 3600)}S</cp:totalTime>
  <cp:application>Microsoft Office Word</cp:application>
  <cp:appVersion>16.${Math.floor(Math.random() * 10000)}</cp:appVersion>
</cp:coreProperties>`;
  }

  function createSimpleOfficeStructure() {
    return {
      '[Content_Types].xml': new TextEncoder().encode('<?xml version="1.0"?><Types/>'),
      '_rels/.rels': new TextEncoder().encode('<?xml version="1.0"?><Relationships/>'),
      'word/document.xml': new TextEncoder().encode(createSimpleWordXML())
    };
  }

  function createLargeOfficeStructure() {
    const files = createSimpleOfficeStructure();
    
    // Add many files to test scaling
    for (let i = 1; i <= 200; i++) {
      files[`word/media/image${i}.png`] = crypto.randomBytes(500);
      files[`word/styles/style${i}.xml`] = new TextEncoder().encode(
        `<?xml version="1.0"?><style id="${i}">Style ${i}</style>`
      );
    }
    
    return files;
  }

  function createLargePathSet(count) {
    const paths = [
      '[Content_Types].xml',
      '_rels/.rels',
      'word/_rels/document.xml.rels',
      'word/document.xml',
      'word/styles.xml'
    ];
    
    for (let i = 1; i <= count - 5; i++) {
      paths.push(`word/media/image${i}.${i % 3 === 0 ? 'png' : i % 2 === 0 ? 'jpg' : 'gif'}`);
    }
    
    return paths;
  }

  function createComplexDocx() {
    const files = {
      '[Content_Types].xml': new TextEncoder().encode('<?xml version="1.0"?><Types/>'),
      '_rels/.rels': new TextEncoder().encode('<?xml version="1.0"?><Relationships/>'),
      'word/document.xml': new TextEncoder().encode(createComplexWordXML()),
      'docProps/core.xml': new TextEncoder().encode(createTimestampHeavyXML())
    };
    
    return Buffer.from(fflate.zipSync(files));
  }

  function createComplexXlsx() {
    const files = {
      '[Content_Types].xml': new TextEncoder().encode('<?xml version="1.0"?><Types/>'),
      '_rels/.rels': new TextEncoder().encode('<?xml version="1.0"?><Relationships/>'),
      'xl/workbook.xml': new TextEncoder().encode('<?xml version="1.0"?><workbook/>')
    };
    
    return Buffer.from(fflate.zipSync(files));
  }

  function createComplexPptx() {
    const files = {
      '[Content_Types].xml': new TextEncoder().encode('<?xml version="1.0"?><Types/>'),
      '_rels/.rels': new TextEncoder().encode('<?xml version="1.0"?><Relationships/>'),
      'ppt/presentation.xml': new TextEncoder().encode('<?xml version="1.0"?><presentation/>')
    };
    
    return Buffer.from(fflate.zipSync(files));
  }

  function createScalableDocx(elementCount) {
    const elements = Array.from({ length: elementCount }, (_, i) => 
      `<w:p><w:r><w:t>Content element ${i}</w:t></w:r></w:p>`
    ).join('\n    ');

    const documentXML = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${elements}
  </w:body>
</w:document>`;

    const files = {
      '[Content_Types].xml': new TextEncoder().encode('<?xml version="1.0"?><Types/>'),
      '_rels/.rels': new TextEncoder().encode('<?xml version="1.0"?><Relationships/>'),
      'word/document.xml': new TextEncoder().encode(documentXML)
    };
    
    return Buffer.from(fflate.zipSync(files));
  }

  function createMediumDocx() {
    const files = {
      '[Content_Types].xml': new TextEncoder().encode('<?xml version="1.0"?><Types/>'),
      '_rels/.rels': new TextEncoder().encode('<?xml version="1.0"?><Relationships/>'),
      'word/document.xml': new TextEncoder().encode(createMediumWordXML())
    };
    
    return Buffer.from(fflate.zipSync(files));
  }

  function createLargeDocx() {
    const largeContent = Array.from({ length: 1000 }, (_, i) => 
      `<w:p><w:r><w:t>Large document content line ${i} with substantial text to increase size</w:t></w:r></w:p>`
    ).join('\n    ');

    const documentXML = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${largeContent}
  </w:body>
</w:document>`;

    const files = {
      '[Content_Types].xml': new TextEncoder().encode('<?xml version="1.0"?><Types/>'),
      '_rels/.rels': new TextEncoder().encode('<?xml version="1.0"?><Relationships/>'),
      'word/document.xml': new TextEncoder().encode(documentXML)
    };
    
    // Add binary content to increase size
    for (let i = 0; i < 10; i++) {
      files[`word/media/large${i}.bin`] = crypto.randomBytes(100000); // 100KB each
    }
    
    return Buffer.from(fflate.zipSync(files));
  }

  function createTestDocx() {
    return createMediumDocx();
  }

  function createModifiedTestDocx() {
    const modifiedXML = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Modified content for difference testing</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

    const files = {
      '[Content_Types].xml': new TextEncoder().encode('<?xml version="1.0"?><Types/>'),
      '_rels/.rels': new TextEncoder().encode('<?xml version="1.0"?><Relationships/>'),
      'word/document.xml': new TextEncoder().encode(modifiedXML)
    };
    
    return Buffer.from(fflate.zipSync(files));
  }
});