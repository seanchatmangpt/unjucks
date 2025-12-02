/**
 * Golden Files Validator for KGEN v1 Testing
 * Provides byte-exact validation against reference golden files
 */

import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { blake3 } from 'hash-wasm';

export class GoldenFilesValidator {
  constructor(goldenDir = './tests/golden') {
    this.goldenDir = goldenDir;
    this.results = new Map();
  }

  /**
   * Initialize golden files directory structure
   */
  async initialize() {
    await mkdir(this.goldenDir, { recursive: true });
    await mkdir(join(this.goldenDir, 'artifacts'), { recursive: true });
    await mkdir(join(this.goldenDir, 'tarballs'), { recursive: true });
    await mkdir(join(this.goldenDir, 'attestations'), { recursive: true });
  }

  /**
   * Store golden file with metadata
   */
  async storeGolden(testName, content, metadata = {}) {
    const goldenPath = join(this.goldenDir, `${testName}.golden`);
    const metaPath = join(this.goldenDir, `${testName}.meta.json`);

    // Ensure directory exists
    await mkdir(dirname(goldenPath), { recursive: true });

    // Compute checksums
    const sha256 = createHash('sha256').update(content).digest('hex');
    const blake3Hash = await blake3(content);

    const goldenMetadata = {
      testName,
      created: new Date().toISOString(),
      size: content.length,
      checksums: {
        sha256,
        blake3: blake3Hash
      },
      platform: {
        os: process.platform,
        arch: process.arch,
        node: process.version
      },
      ...metadata
    };

    // Store content and metadata
    await writeFile(goldenPath, content);
    await writeFile(metaPath, JSON.stringify(goldenMetadata, null, 2));

    return { path: goldenPath, metadata: goldenMetadata };
  }

  /**
   * Validate content against golden file with byte-exact comparison
   */
  async validateAgainstGolden(testName, actualContent) {
    const goldenPath = join(this.goldenDir, `${testName}.golden`);
    const metaPath = join(this.goldenDir, `${testName}.meta.json`);

    try {
      // Read golden file and metadata
      const goldenContent = await readFile(goldenPath);
      const goldenMetadata = JSON.parse(await readFile(metaPath, 'utf-8'));

      // Byte-exact comparison
      const isIdentical = Buffer.compare(
        Buffer.from(actualContent),
        goldenContent
      ) === 0;

      // Compute checksums for actual content
      const actualSha256 = createHash('sha256').update(actualContent).digest('hex');
      const actualBlake3 = await blake3(actualContent);

      const result = {
        testName,
        passed: isIdentical,
        goldenMetadata,
        actual: {
          size: actualContent.length,
          checksums: {
            sha256: actualSha256,
            blake3: actualBlake3
          }
        },
        comparison: {
          sizeMatch: actualContent.length === goldenMetadata.size,
          sha256Match: actualSha256 === goldenMetadata.checksums.sha256,
          blake3Match: actualBlake3 === goldenMetadata.checksums.blake3,
          byteIdentical: isIdentical
        }
      };

      // Store detailed diff if not identical
      if (!isIdentical) {
        result.diff = this.generateBinaryDiff(goldenContent, actualContent);
      }

      this.results.set(testName, result);
      return result;

    } catch (error) {
      const result = {
        testName,
        passed: false,
        error: error.message,
        errorType: 'golden_file_missing'
      };
      this.results.set(testName, result);
      return result;
    }
  }

  /**
   * Generate binary diff information
   */
  generateBinaryDiff(golden, actual) {
    const goldenBuf = Buffer.from(golden);
    const actualBuf = Buffer.from(actual);
    const differences = [];
    const maxDiffs = 10; // Limit detailed diff output

    const maxLen = Math.max(goldenBuf.length, actualBuf.length);
    let diffCount = 0;

    for (let i = 0; i < maxLen && diffCount < maxDiffs; i++) {
      const goldenByte = i < goldenBuf.length ? goldenBuf[i] : null;
      const actualByte = i < actualBuf.length ? actualBuf[i] : null;

      if (goldenByte !== actualByte) {
        differences.push({
          offset: i,
          golden: goldenByte !== null ? `0x${goldenByte.toString(16).padStart(2, '0')}` : 'EOF',
          actual: actualByte !== null ? `0x${actualByte.toString(16).padStart(2, '0')}` : 'EOF'
        });
        diffCount++;
      }
    }

    return {
      totalDifferences: diffCount,
      sizeDifference: actualBuf.length - goldenBuf.length,
      firstDifferences: differences,
      truncated: diffCount >= maxDiffs
    };
  }

  /**
   * Validate TAR archive byte-equality across platforms
   */
  async validateTarball(testName, tarContent, expectedStructure) {
    // Extract and normalize TAR structure for comparison
    const tarMetadata = await this.extractTarMetadata(tarContent);
    
    const result = await this.validateAgainstGolden(testName, tarContent);
    
    // Add TAR-specific validation
    result.tarValidation = {
      fileCount: tarMetadata.fileCount,
      structure: tarMetadata.structure,
      structureMatch: this.compareStructures(tarMetadata.structure, expectedStructure)
    };

    return result;
  }

  /**
   * Extract TAR metadata for validation
   */
  async extractTarMetadata(tarContent) {
    // Basic TAR structure analysis
    const files = [];
    const buffer = Buffer.from(tarContent);
    let offset = 0;

    while (offset < buffer.length) {
      // TAR header is 512 bytes
      if (offset + 512 > buffer.length) break;

      const header = buffer.subarray(offset, offset + 512);
      const filename = header.subarray(0, 100).toString('utf-8').replace(/\0.*$/, '');
      
      if (!filename) break; // End of TAR

      const size = parseInt(header.subarray(124, 136).toString('utf-8').trim(), 8) || 0;
      const type = header[156];

      files.push({
        name: filename,
        size,
        type,
        offset
      });

      // Move to next header (size rounded up to 512-byte boundary)
      offset += 512 + Math.ceil(size / 512) * 512;
    }

    return {
      fileCount: files.length,
      structure: files,
      totalSize: buffer.length
    };
  }

  /**
   * Compare TAR structures for equality
   */
  compareStructures(actual, expected) {
    if (!expected) return true; // No expected structure provided

    if (actual.length !== expected.length) {
      return { match: false, reason: 'file_count_mismatch' };
    }

    for (let i = 0; i < actual.length; i++) {
      const actualFile = actual[i];
      const expectedFile = expected[i];

      if (actualFile.name !== expectedFile.name) {
        return { 
          match: false, 
          reason: 'filename_mismatch',
          details: { actual: actualFile.name, expected: expectedFile.name }
        };
      }

      if (actualFile.size !== expectedFile.size) {
        return { 
          match: false, 
          reason: 'size_mismatch',
          details: { file: actualFile.name, actual: actualFile.size, expected: expectedFile.size }
        };
      }
    }

    return { match: true };
  }

  /**
   * Generate comprehensive test report
   */
  async generateReport() {
    const allResults = Array.from(this.results.values());
    const passed = allResults.filter(r => r.passed).length;
    const failed = allResults.filter(r => !r.passed).length;

    const report = {
      summary: {
        total: allResults.length,
        passed,
        failed,
        passRate: allResults.length > 0 ? (passed / allResults.length * 100).toFixed(2) : 0
      },
      results: allResults,
      generatedAt: new Date().toISOString()
    };

    // Write report to file
    const reportPath = join(this.goldenDir, 'validation-report.json');
    await writeFile(reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  /**
   * Clean up test artifacts
   */
  async cleanup() {
    this.results.clear();
  }
}

export default GoldenFilesValidator;