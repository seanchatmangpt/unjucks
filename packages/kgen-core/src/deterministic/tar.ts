/**
 * Deterministic tar archive creation
 * Ensures identical bytes for identical inputs across all systems
 */

import * as tar from 'tar-stream';
import * as pako from 'pako';
import { pipeline } from 'stream/promises';
import { Readable, PassThrough } from 'stream';

export interface DeterministicTarOptions {
  /**
   * Whether to compress with gzip (using pako for determinism)
   */
  compress?: boolean;
  
  /**
   * Compression level (1-9, only used if compress=true)
   */
  compressionLevel?: number;
  
  /**
   * Custom mtime to use for all entries (defaults to 0)
   */
  mtime?: Date;
  
  /**
   * Whether to sort entries alphabetically
   */
  sortEntries?: boolean;
  
  /**
   * Default file mode for regular files
   */
  fileMode?: number;
  
  /**
   * Default directory mode
   */
  dirMode?: number;
}

export interface TarEntry {
  /**
   * Path within the archive
   */
  path: string;
  
  /**
   * File content (for files) or undefined (for directories)
   */
  content?: Buffer | string;
  
  /**
   * Whether this is a directory
   */
  isDirectory?: boolean;
  
  /**
   * Custom mode for this entry
   */
  mode?: number;
  
  /**
   * Custom mtime for this entry
   */
  mtime?: Date;
}

export class DeterministicTar {
  private options: Required<DeterministicTarOptions>;
  
  constructor(options: DeterministicTarOptions = {}) {
    this.options = {
      compress: options.compress ?? false,
      compressionLevel: options.compressionLevel ?? 6,
      mtime: options.mtime ?? new Date(0), // Unix epoch for determinism
      sortEntries: options.sortEntries ?? true,
      fileMode: options.fileMode ?? 0o644,
      dirMode: options.dirMode ?? 0o755
    };
  }
  
  /**
   * Create a deterministic tar archive from entries
   */
  async create(entries: TarEntry[]): Promise<Buffer> {
    // Sort entries if requested
    let sortedEntries = this.options.sortEntries 
      ? [...entries].sort((a, b) => a.path.localeCompare(b.path))
      : entries;
      
    // Ensure directories come before their contents
    sortedEntries = this.sortDirectoriesFirst(sortedEntries);
    
    const pack = tar.pack();
    const chunks: Buffer[] = [];
    
    // Collect all output chunks
    pack.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    
    // Add entries with deterministic headers
    for (const entry of sortedEntries) {
      await this.addEntry(pack, entry);
    }
    
    // Finalize the archive
    pack.finalize();
    
    // Wait for all data to be written
    await new Promise<void>((resolve, reject) => {
      pack.on('end', resolve);
      pack.on('error', reject);
    });
    
    // Concatenate all chunks
    const tarBuffer = Buffer.concat(chunks);
    
    // Apply compression if requested
    if (this.options.compress) {
      return this.compressDeterministic(tarBuffer);
    }
    
    return tarBuffer;
  }
  
  /**
   * Add a single entry to the tar pack with deterministic headers
   */
  private async addEntry(pack: tar.Pack, entry: TarEntry): Promise<void> {
    const isDirectory = entry.isDirectory ?? entry.path.endsWith('/');
    const normalizedPath = isDirectory && !entry.path.endsWith('/') 
      ? `${entry.path}/` 
      : entry.path;
    
    const header: tar.Headers = {
      name: normalizedPath,
      size: entry.content ? Buffer.byteLength(entry.content) : 0,
      type: isDirectory ? 'directory' : 'file',
      
      // Deterministic metadata
      mtime: entry.mtime ?? this.options.mtime,
      uid: 0,
      gid: 0,
      uname: '',
      gname: '',
      mode: entry.mode ?? (isDirectory ? this.options.dirMode : this.options.fileMode),
      
      // Remove non-deterministic fields (atime/ctime not supported in headers)
    };
    
    return new Promise<void>((resolve, reject) => {
      const stream = pack.entry(header, (err) => {
        if (err) {
          reject(new Error(`Failed to add entry ${entry.path}: ${err.message}`));
        } else {
          resolve();
        }
      });
      
      if (entry.content && !isDirectory) {
        const content = typeof entry.content === 'string' 
          ? Buffer.from(entry.content, 'utf8')
          : entry.content;
        stream.end(content);
      } else {
        stream.end();
      }
    });
  }
  
  /**
   * Sort entries so directories come before their contents
   */
  private sortDirectoriesFirst(entries: TarEntry[]): TarEntry[] {
    return [...entries].sort((a, b) => {
      // If one is a directory and the other isn't, directory goes first
      const aIsDir = a.isDirectory ?? a.path.endsWith('/');
      const bIsDir = b.isDirectory ?? b.path.endsWith('/');
      
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      
      // For paths in the same directory level, sort alphabetically
      return a.path.localeCompare(b.path);
    });
  }
  
  /**
   * Compress buffer using pako with deterministic settings
   */
  private compressDeterministic(buffer: Buffer): Buffer {
    const compressed = pako.gzip(buffer, {
      level: this.options.compressionLevel,
      
      // Deterministic gzip settings
      strategy: 0, // Z_DEFAULT_STRATEGY
      windowBits: 15,
      memLevel: 8,
      
      // Remove timestamp and other non-deterministic headers
      time: 0,
      os: 255, // Unknown OS for determinism
    });
    
    return Buffer.from(compressed);
  }
  
  /**
   * Extract entries from a tar archive
   */
  async extract(tarBuffer: Buffer): Promise<TarEntry[]> {
    const entries: TarEntry[] = [];
    
    // Decompress if this looks like a gzip archive
    let buffer = tarBuffer;
    if (this.isGzipped(tarBuffer)) {
      buffer = Buffer.from(pako.inflate(tarBuffer));
    }
    
    const extract = tar.extract();
    
    extract.on('entry', (header, stream, next) => {
      const chunks: Buffer[] = [];
      
      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      stream.on('end', () => {
        const content = Buffer.concat(chunks);
        
        entries.push({
          path: header.name || '',
          content: header.type === 'directory' ? undefined : content,
          isDirectory: header.type === 'directory',
          mode: header.mode,
          mtime: header.mtime
        });
        
        next();
      });
      
      stream.resume();
    });
    
    // Feed the buffer to the extractor
    const readable = new Readable({
      read() {
        this.push(buffer);
        this.push(null);
      }
    });
    
    await pipeline(readable, extract);
    
    return entries;
  }
  
  /**
   * Check if buffer starts with gzip magic bytes
   */
  private isGzipped(buffer: Buffer): boolean {
    return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
  }
}

/**
 * Create a deterministic tar archive from a directory structure
 */
export async function createDeterministicTar(
  entries: TarEntry[], 
  options?: DeterministicTarOptions
): Promise<Buffer> {
  const tar = new DeterministicTar(options);
  return tar.create(entries);
}

/**
 * Create tar entries from file system paths with content
 */
export function createTarEntries(files: Record<string, string | Buffer>): TarEntry[] {
  const entries: TarEntry[] = [];
  const directories = new Set<string>();
  
  // Collect all directory paths
  Object.keys(files).forEach(path => {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const dirPath = parts.slice(0, i).join('/');
      if (dirPath) {
        directories.add(dirPath + '/');
      }
    }
  });
  
  // Add directory entries
  Array.from(directories).sort().forEach(dirPath => {
    entries.push({
      path: dirPath,
      isDirectory: true
    });
  });
  
  // Add file entries
  Object.entries(files).forEach(([path, content]) => {
    entries.push({
      path,
      content: typeof content === 'string' ? Buffer.from(content, 'utf8') : content,
      isDirectory: false
    });
  });
  
  return entries;
}

/**
 * Create a deterministic hash of a tar archive
 */
export async function createTarHash(entries: TarEntry[]): Promise<string> {
  const tarBuffer = await createDeterministicTar(entries, { compress: false });
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(tarBuffer).digest('hex');
}