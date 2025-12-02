import { describe, it, expect } from 'vitest';
import {
  hashString,
  hashBuffer,
  isValidHash,
  shortHash,
  inferContentType,
  formatBytes,
  getCacheStructure,
  isInCacheDir,
  generateFingerprint,
  compareFingerprints,
  sanitizeFilename,
  isBinary,
  getMimeType,
  createPackManifest,
  validatePackManifest
} from '../../src/cas/utils.js';
import { createBLAKE3 } from 'hash-wasm';

describe('CAS Utils', () => {
  describe('hashing functions', () => {
    it('should hash strings correctly', () => {
      const content = 'Hello, World!';
      const expectedHash = createHash().update(Buffer.from(content, 'utf8')).digest('hex');
      
      const hash = hashString(content);
      
      expect(hash).toBe(expectedHash);
      expect(hash).toHaveLength(64); // BLAKE3 produces 64-char hex strings
    });

    it('should hash buffers correctly', () => {
      const buffer = Buffer.from('Binary content', 'utf8');
      const expectedHash = createHash().update(buffer).digest('hex');
      
      const hash = hashBuffer(buffer);
      
      expect(hash).toBe(expectedHash);
      expect(hash).toHaveLength(64);
    });

    it('should produce consistent hashes', () => {
      const content = 'consistent content';
      
      const hash1 = hashString(content);
      const hash2 = hashString(content);
      const hash3 = hashBuffer(Buffer.from(content, 'utf8'));
      
      expect(hash1).toBe(hash2);
      expect(hash1).toBe(hash3);
    });
  });

  describe('hash validation', () => {
    it('should validate correct BLAKE3 hashes', () => {
      const validHash = 'a'.repeat(64);
      
      expect(isValidHash(validHash)).toBe(true);
    });

    it('should reject invalid hashes', () => {
      expect(isValidHash('too-short')).toBe(false);
      expect(isValidHash('a'.repeat(63))).toBe(false); // Too short
      expect(isValidHash('a'.repeat(65))).toBe(false); // Too long
      expect(isValidHash('g'.repeat(64))).toBe(false); // Invalid hex character
      expect(isValidHash('A'.repeat(64))).toBe(false); // Uppercase not allowed
      expect(isValidHash('')).toBe(false);
    });

    it('should create short hashes', () => {
      const fullHash = 'abcdef1234567890'.repeat(4); // 64 chars
      const short = shortHash(fullHash);
      
      expect(short).toBe('abcdef123456');
      expect(short).toHaveLength(12);
    });
  });

  describe('content type inference', () => {
    it('should infer graph types', () => {
      expect(inferContentType('data.nq')).toBe('graphs');
      expect(inferContentType('ontology.ttl')).toBe('graphs');
      expect(inferContentType('schema.rdf')).toBe('graphs');
    });

    it('should infer template types', () => {
      expect(inferContentType('template.njk')).toBe('templates');
      expect(inferContentType('template.nunjucks')).toBe('templates');
      expect(inferContentType('template.j2')).toBe('templates');
      expect(inferContentType('template.jinja')).toBe('templates');
    });

    it('should infer pack types', () => {
      expect(inferContentType('archive.tar')).toBe('packs');
      expect(inferContentType('archive.tgz')).toBe('packs');
      expect(inferContentType('archive.zip')).toBe('packs');
    });

    it('should default to artifacts for unknown types', () => {
      expect(inferContentType('unknown.xyz')).toBe('artifacts');
      expect(inferContentType('file.txt')).toBe('artifacts');
      expect(inferContentType('code.js')).toBe('artifacts');
    });

    it('should handle files without extensions', () => {
      expect(inferContentType('README')).toBe('artifacts');
      expect(inferContentType('makefile')).toBe('artifacts');
    });
  });

  describe('byte formatting', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
    });

    it('should handle fractional values', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });
  });

  describe('cache structure', () => {
    it('should generate correct cache structure', () => {
      const basePath = '/cache';
      const structure = getCacheStructure(basePath);
      
      expect(structure.graphs).toBe('/cache/graphs');
      expect(structure.templates).toBe('/cache/templates');
      expect(structure.artifacts).toBe('/cache/artifacts');
      expect(structure.packs).toBe('/cache/packs');
      expect(structure.metadata).toBe('/cache/metadata');
    });

    it('should check if path is in cache directory', () => {
      const cacheDir = '/cache';
      
      expect(isInCacheDir('/cache/graphs/abc123', cacheDir)).toBe(true);
      expect(isInCacheDir('/cache/templates/def456', cacheDir)).toBe(true);
      expect(isInCacheDir('/other/path', cacheDir)).toBe(false);
      expect(isInCacheDir('/cachedir/file', cacheDir)).toBe(false);
    });
  });

  describe('fingerprinting', () => {
    it('should generate content fingerprints', () => {
      const content = Buffer.from('fingerprint test', 'utf8');
      const fingerprint = generateFingerprint(content, 'templates');
      
      expect(fingerprint.hash).toBe(hashBuffer(content));
      expect(fingerprint.size).toBe(content.length);
      expect(fingerprint.type).toBe('templates');
      expect(fingerprint.firstBytes).toBe(content.subarray(0, 32).toString('hex'));
    });

    it('should handle content shorter than 32 bytes', () => {
      const content = Buffer.from('short', 'utf8');
      const fingerprint = generateFingerprint(content, 'artifacts');
      
      expect(fingerprint.firstBytes).toBe(content.toString('hex'));
    });

    it('should compare fingerprints correctly', () => {
      const content1 = Buffer.from('same content', 'utf8');
      const content2 = Buffer.from('same content', 'utf8');
      const content3 = Buffer.from('different content', 'utf8');
      
      const fp1 = generateFingerprint(content1, 'templates');
      const fp2 = generateFingerprint(content2, 'templates');
      const fp3 = generateFingerprint(content3, 'templates');
      const fp4 = generateFingerprint(content1, 'graphs'); // Different type
      
      expect(compareFingerprints(fp1, fp2)).toBe(true);
      expect(compareFingerprints(fp1, fp3)).toBe(false);
      expect(compareFingerprints(fp1, fp4)).toBe(false); // Different type
    });
  });

  describe('filename sanitization', () => {
    it('should sanitize invalid filename characters', () => {
      expect(sanitizeFilename('file<name>')).toBe('file_name_');
      expect(sanitizeFilename('file:name')).toBe('file_name');
      expect(sanitizeFilename('file"name')).toBe('file_name');
      expect(sanitizeFilename('file/name')).toBe('file_name');
      expect(sanitizeFilename('file\\name')).toBe('file_name');
      expect(sanitizeFilename('file|name')).toBe('file_name');
      expect(sanitizeFilename('file?name')).toBe('file_name');
      expect(sanitizeFilename('file*name')).toBe('file_name');
    });

    it('should replace spaces with underscores', () => {
      expect(sanitizeFilename('file name')).toBe('file_name');
      expect(sanitizeFilename('file   name')).toBe('file_name'); // Multiple spaces
      expect(sanitizeFilename('  file name  ')).toBe('_file_name_');
    });

    it('should handle already clean filenames', () => {
      expect(sanitizeFilename('clean_filename.txt')).toBe('clean_filename.txt');
      expect(sanitizeFilename('file-name_123.json')).toBe('file-name_123.json');
    });
  });

  describe('binary detection', () => {
    it('should detect text content', () => {
      const textContent = Buffer.from('This is plain text content', 'utf8');
      
      expect(isBinary(textContent)).toBe(false);
    });

    it('should detect binary content', () => {
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF]);
      
      expect(isBinary(binaryContent)).toBe(true);
    });

    it('should handle content with tabs and newlines', () => {
      const textWithWhitespace = Buffer.from('Text\twith\ttabs\nand\nnewlines\r\n', 'utf8');
      
      expect(isBinary(textWithWhitespace)).toBe(false);
    });

    it('should detect null bytes as binary', () => {
      const contentWithNull = Buffer.from('Text with\x00null byte', 'utf8');
      
      expect(isBinary(contentWithNull)).toBe(true);
    });
  });

  describe('MIME type detection', () => {
    it('should detect MIME types by magic bytes', () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      const pdfHeader = Buffer.from('%PDF-1.4', 'ascii');
      
      expect(getMimeType(pngHeader)).toBe('image/png');
      expect(getMimeType(jpegHeader)).toBe('image/jpeg');
      expect(getMimeType(pdfHeader)).toBe('application/pdf');
    });

    it('should detect MIME types by filename extension', () => {
      const textContent = Buffer.from('text content', 'utf8');
      
      expect(getMimeType(textContent, 'file.json')).toBe('application/json');
      expect(getMimeType(textContent, 'file.xml')).toBe('application/xml');
      expect(getMimeType(textContent, 'file.html')).toBe('text/html');
      expect(getMimeType(textContent, 'file.css')).toBe('text/css');
      expect(getMimeType(textContent, 'file.js')).toBe('application/javascript');
      expect(getMimeType(textContent, 'file.ts')).toBe('application/typescript');
      expect(getMimeType(textContent, 'file.md')).toBe('text/markdown');
      expect(getMimeType(textContent, 'file.yaml')).toBe('application/yaml');
      expect(getMimeType(textContent, 'file.njk')).toBe('text/x-nunjucks');
      expect(getMimeType(textContent, 'file.nq')).toBe('application/n-quads');
      expect(getMimeType(textContent, 'file.ttl')).toBe('text/turtle');
    });

    it('should default to text/plain for text content', () => {
      const textContent = Buffer.from('plain text', 'utf8');
      
      expect(getMimeType(textContent)).toBe('text/plain');
    });

    it('should default to application/octet-stream for binary content', () => {
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xFF]);
      
      expect(getMimeType(binaryContent)).toBe('application/octet-stream');
    });
  });

  describe('pack manifest', () => {
    it('should create pack manifest', () => {
      const files = {
        'config.json': Buffer.from(JSON.stringify({ version: '1.0.0' })),
        'src/main.ts': Buffer.from('export const version = "1.0.0";'),
        'README.md': Buffer.from('# Test Package')
      };
      
      const metadata = { author: 'test', license: 'MIT' };
      const manifest = createPackManifest(files, metadata);
      
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.created).toBeTruthy();
      expect(new Date(manifest.created)).toBeInstanceOf(Date);
      expect(manifest.files).toHaveLength(3);
      expect(manifest.metadata).toEqual(metadata);
      
      const configFile = manifest.files.find(f => f.path === 'config.json');
      expect(configFile).toBeTruthy();
      expect(configFile!.hash).toBe(hashBuffer(files['config.json']));
      expect(configFile!.size).toBe(files['config.json'].length);
      expect(configFile!.mimeType).toBe('application/json');
    });

    it('should validate pack manifest', () => {
      const files = {
        'file1.txt': Buffer.from('Content 1'),
        'file2.txt': Buffer.from('Content 2')
      };
      
      const manifest = createPackManifest(files);
      
      expect(validatePackManifest(manifest, files)).toBe(true);
    });

    it('should reject invalid pack manifest', () => {
      const files = {
        'file1.txt': Buffer.from('Content 1'),
        'file2.txt': Buffer.from('Content 2')
      };
      
      const manifest = createPackManifest(files);
      
      // Test with missing file
      const incompleteFiles = { 'file1.txt': files['file1.txt'] };
      expect(validatePackManifest(manifest, incompleteFiles)).toBe(false);
      
      // Test with corrupted content
      const corruptedFiles = {
        'file1.txt': Buffer.from('Different content'),
        'file2.txt': files['file2.txt']
      };
      expect(validatePackManifest(manifest, corruptedFiles)).toBe(false);
      
      // Test with invalid manifest structure
      const invalidManifest = { ...manifest, files: null as any };
      expect(validatePackManifest(invalidManifest, files)).toBe(false);
    });
  });
});