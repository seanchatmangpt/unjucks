import { promises as fs } from 'fs';
import { join } from 'path';
import { createBLAKE3 } from 'hash-wasm';
import { ContentType } from './storage.js';

/**
 * Utility functions for Content-Addressed Storage
 */

/**
 * Compute BLAKE3 hash from string content
 */
export async function hashString(content: string): Promise<string> {
  const hasher = await createBLAKE3();
  hasher.init();
  hasher.update(Buffer.from(content, 'utf8'));
  return hasher.digest('hex');
}

/**
 * Compute BLAKE3 hash from buffer
 */
export async function hashBuffer(buffer: Buffer): Promise<string> {
  const hasher = await createBLAKE3();
  hasher.init();
  hasher.update(buffer);
  return hasher.digest('hex');
}

/**
 * Validate that a string is a valid BLAKE3 hash (64 hex characters)
 */
export function isValidHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash);
}

/**
 * Get the short form of a hash (first 12 characters)
 */
export function shortHash(hash: string): string {
  return hash.substring(0, 12);
}

/**
 * Parse content type from file extension
 */
export function inferContentType(filename: string): ContentType | null {
  const ext = filename.toLowerCase().split('.').pop();
  
  switch (ext) {
    case 'nq':
    case 'ttl':
    case 'rdf':
      return 'graphs';
    
    case 'njk':
    case 'nunjucks':
    case 'j2':
    case 'jinja':
      return 'templates';
    
    case 'tar':
    case 'tgz':
    case 'zip':
      return 'packs';
    
    default:
      return 'artifacts';
  }
}

/**
 * Format bytes as human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get cache directory structure for a given base path
 */
export function getCacheStructure(basePath: string): {
  graphs: string;
  templates: string;
  artifacts: string;
  packs: string;
  metadata: string;
} {
  return {
    graphs: join(basePath, 'graphs'),
    templates: join(basePath, 'templates'),
    artifacts: join(basePath, 'artifacts'),
    packs: join(basePath, 'packs'),
    metadata: join(basePath, 'metadata')
  };
}

/**
 * Ensure all cache directories exist
 */
export async function ensureCacheStructure(basePath: string): Promise<void> {
  const structure = getCacheStructure(basePath);
  
  await Promise.all(
    Object.values(structure).map(dir => 
      fs.mkdir(dir, { recursive: true }).catch(() => {})
    )
  );
}

/**
 * Check if path is within allowed cache directory
 */
export function isInCacheDir(path: string, cacheDir: string): boolean {
  const normalized = join(path);
  const normalizedCache = join(cacheDir);
  return normalized.startsWith(normalizedCache);
}

/**
 * Clean up empty directories recursively
 */
export async function cleanupEmptyDirs(dirPath: string, stopAt?: string): Promise<void> {
  try {
    const entries = await fs.readdir(dirPath);
    
    if (entries.length === 0) {
      await fs.rmdir(dirPath);
      
      // Recursively clean parent directories
      const parent = join(dirPath, '..');
      if (stopAt && parent !== stopAt && dirPath !== parent) {
        await cleanupEmptyDirs(parent, stopAt);
      }
    }
  } catch {
    // Directory might not exist or not be empty
  }
}

/**
 * Generate a content fingerprint for deduplication
 */
export interface ContentFingerprint {
  hash: string;
  size: number;
  type: ContentType;
  firstBytes: string; // First 32 bytes as hex for quick comparison
}

export async function generateFingerprint(content: Buffer, type: ContentType): Promise<ContentFingerprint> {
  const hash = await hashBuffer(content);
  const firstBytes = content.subarray(0, 32).toString('hex');
  
  return {
    hash,
    size: content.length,
    type,
    firstBytes
  };
}

/**
 * Compare two fingerprints for equality
 */
export function compareFingerprints(fp1: ContentFingerprint, fp2: ContentFingerprint): boolean {
  return fp1.hash === fp2.hash && 
         fp1.size === fp2.size && 
         fp1.type === fp2.type &&
         fp1.firstBytes === fp2.firstBytes;
}

/**
 * Safe filename for storing content (replace invalid characters)
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
}

/**
 * Check if file is binary or text
 */
export function isBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 512);
  
  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i];
    
    // Check for null bytes or other control characters that indicate binary
    if (byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get MIME type from content and filename
 */
export function getMimeType(content: Buffer, filename?: string): string {
  // Check for common binary formats by magic bytes
  if (content.length >= 4) {
    const magic = content.subarray(0, 4);
    
    // PNG
    if (magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47) {
      return 'image/png';
    }
    
    // JPEG
    if (magic[0] === 0xFF && magic[1] === 0xD8) {
      return 'image/jpeg';
    }
    
    // PDF
    if (magic.toString('ascii').startsWith('%PDF')) {
      return 'application/pdf';
    }
  }
  
  // Check by filename extension
  if (filename) {
    const ext = filename.toLowerCase().split('.').pop();
    
    switch (ext) {
      case 'json': return 'application/json';
      case 'xml': return 'application/xml';
      case 'html': case 'htm': return 'text/html';
      case 'css': return 'text/css';
      case 'js': case 'mjs': return 'application/javascript';
      case 'ts': return 'application/typescript';
      case 'md': return 'text/markdown';
      case 'txt': return 'text/plain';
      case 'yaml': case 'yml': return 'application/yaml';
      case 'njk': case 'nunjucks': return 'text/x-nunjucks';
      case 'nq': return 'application/n-quads';
      case 'ttl': return 'text/turtle';
      case 'tar': return 'application/tar';
      case 'gz': return 'application/gzip';
    }
  }
  
  // Default to text or binary based on content analysis
  return isBinary(content) ? 'application/octet-stream' : 'text/plain';
}

/**
 * Create a content manifest for a pack
 */
export interface PackManifest {
  version: string;
  created: string;
  files: Array<{
    path: string;
    hash: string;
    size: number;
    mimeType: string;
  }>;
  metadata?: Record<string, any>;
}

export async function createPackManifest(files: Record<string, Buffer>, metadata?: Record<string, any>): Promise<PackManifest> {
  const manifest: PackManifest = {
    version: '1.0.0',
    created: new Date().toISOString(),
    files: [],
    metadata
  };

  for (const [path, content] of Object.entries(files)) {
    manifest.files.push({
      path,
      hash: await hashBuffer(content),
      size: content.length,
      mimeType: getMimeType(content, path)
    });
  }

  return manifest;
}

/**
 * Validate pack manifest
 */
export async function validatePackManifest(manifest: PackManifest, files: Record<string, Buffer>): Promise<boolean> {
  if (!manifest.version || !manifest.created || !Array.isArray(manifest.files)) {
    return false;
  }

  for (const fileInfo of manifest.files) {
    const content = files[fileInfo.path];
    
    if (!content) {
      return false;
    }
    
    const actualHash = await hashBuffer(content);
    if (actualHash !== fileInfo.hash) {
      return false;
    }
    
    if (content.length !== fileInfo.size) {
      return false;
    }
  }

  return true;
}