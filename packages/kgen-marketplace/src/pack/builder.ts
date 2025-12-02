/**
 * @fileoverview Deterministic TAR package builder for KGEN Marketplace
 * @version 1.0.0
 * @description Creates byte-identical TAR archives with fixed headers and sorted entries
 */

import * as tar from 'tar-stream';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import { KPackManifest, ContentAddress, createContentAddress } from '../types/kpack.js';

// ==============================================================================
// Types and Interfaces
// ==============================================================================

export interface PackageEntry {
  path: string;
  content?: Buffer;
  filePath?: string;
  size: number;
  mode: number;
  mtime: Date;
  contentHash: string;
}

export interface PackageManifest {
  entries: PackageEntry[];
  manifest: KPackManifest;
  totalSize: number;
  createdAt: Date;
}

export interface BuildOptions {
  /** Base directory to package */
  baseDir: string;
  /** Output file path */
  outputPath: string;
  /** KPack manifest */
  manifest: KPackManifest;
  /** Exclude patterns (glob) */
  exclude?: string[];
  /** Fix timestamps to this date for determinism */
  fixedTimestamp?: Date;
  /** Compression level (0-9) */
  compressionLevel?: number;
  /** Include hidden files */
  includeHidden?: boolean;
}

export interface BuildResult {
  packagePath: string;
  contentAddress: ContentAddress;
  manifest: KPackManifest;
  entries: PackageEntry[];
  size: number;
  buildTime: number;
}

// ==============================================================================
// Deterministic TAR Builder
// ==============================================================================

export class DeterministicTarBuilder {
  private readonly options: Required<BuildOptions>;
  private readonly fixedTimestamp: Date;

  constructor(options: BuildOptions) {
    // Set deterministic defaults
    this.options = {
      ...options,
      exclude: options.exclude || [],
      fixedTimestamp: options.fixedTimestamp || new Date('2025-01-01T00:00:00Z'),
      compressionLevel: options.compressionLevel ?? 6,
      includeHidden: options.includeHidden ?? false
    };
    this.fixedTimestamp = this.options.fixedTimestamp;
  }

  /**
   * Build a deterministic TAR package
   */
  async build(): Promise<BuildResult> {
    const startTime = Date.now();

    try {
      // 1. Discover and sort all entries
      const entries = await this.discoverEntries();
      
      // 2. Sort entries alphabetically for determinism
      const sortedEntries = this.sortEntries(entries);
      
      // 3. Add manifest as first entry
      const manifestEntry = await this.createManifestEntry();
      const allEntries = [manifestEntry, ...sortedEntries];
      
      // 4. Create TAR archive with fixed headers
      const packagePath = await this.createTarArchive(allEntries);
      
      // 5. Generate content address
      const contentAddress = await this.generateContentAddress(packagePath);
      
      // 6. Update manifest with content address
      const updatedManifest = {
        ...this.options.manifest,
        contentAddress,
        publishedAt: new Date().toISOString()
      };

      const buildTime = Date.now() - startTime;

      return {
        packagePath,
        contentAddress,
        manifest: updatedManifest,
        entries: allEntries,
        size: contentAddress.size,
        buildTime
      };

    } catch (error) {
      throw new Error(`Failed to build package: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Discover all files in the base directory
   */
  private async discoverEntries(): Promise<PackageEntry[]> {
    const entries: PackageEntry[] = [];
    const baseDir = this.options.baseDir;

    const walkDirectory = async (dir: string, relativePath: string = ''): Promise<void> => {
      const items = await fs.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dir, item.name);
        const itemRelativePath = path.join(relativePath, item.name).replace(/\\/g, '/');

        // Skip excluded patterns
        if (this.shouldExclude(itemRelativePath, item.name)) {
          continue;
        }

        if (item.isDirectory()) {
          await walkDirectory(itemPath, itemRelativePath);
        } else if (item.isFile()) {
          const stats = await fs.stat(itemPath);
          const content = await fs.readFile(itemPath);
          const contentHash = crypto.createHash('sha256').update(content).digest('hex');

          entries.push({
            path: itemRelativePath,
            filePath: itemPath,
            content,
            size: stats.size,
            mode: stats.mode & parseInt('777', 8), // Only permission bits
            mtime: this.fixedTimestamp, // Fixed timestamp for determinism
            contentHash
          });
        }
      }
    };

    await walkDirectory(baseDir);
    return entries;
  }

  /**
   * Check if a file should be excluded
   */
  private shouldExclude(relativePath: string, fileName: string): boolean {
    // Skip hidden files unless explicitly included
    if (!this.options.includeHidden && fileName.startsWith('.')) {
      return true;
    }

    // Check exclude patterns
    for (const pattern of this.options.exclude) {
      if (this.matchesPattern(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Simple glob pattern matching
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Sort entries alphabetically for determinism
   */
  private sortEntries(entries: PackageEntry[]): PackageEntry[] {
    return entries.sort((a, b) => {
      // Sort by path alphabetically
      if (a.path < b.path) return -1;
      if (a.path > b.path) return 1;
      
      // If paths are equal, sort by content hash
      if (a.contentHash < b.contentHash) return -1;
      if (a.contentHash > b.contentHash) return 1;
      
      return 0;
    });
  }

  /**
   * Create manifest entry as first entry in TAR
   */
  private async createManifestEntry(): Promise<PackageEntry> {
    const manifestContent = JSON.stringify(this.options.manifest, null, 2);
    const manifestBuffer = Buffer.from(manifestContent, 'utf8');
    const contentHash = crypto.createHash('sha256').update(manifestBuffer).digest('hex');

    return {
      path: 'kpack.json',
      content: manifestBuffer,
      size: manifestBuffer.length,
      mode: 0o644,
      mtime: this.fixedTimestamp,
      contentHash
    };
  }

  /**
   * Create TAR archive with fixed headers
   */
  private async createTarArchive(entries: PackageEntry[]): Promise<string> {
    const pack = tar.pack();
    const outputPath = this.options.outputPath;

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Create write stream
    const writeStream = createWriteStream(outputPath);

    // Set up pipeline
    const pipelinePromise = pipeline(pack, writeStream);

    // Add entries to TAR with fixed headers
    for (const entry of entries) {
      await this.addEntryToTar(pack, entry);
    }

    // Finalize the TAR
    pack.finalize();

    // Wait for pipeline to complete
    await pipelinePromise;

    return outputPath;
  }

  /**
   * Add a single entry to TAR with deterministic headers
   */
  private async addEntryToTar(pack: tar.Pack, entry: PackageEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create deterministic header
      const header: tar.Headers = {
        name: entry.path,
        size: entry.size,
        mode: entry.mode,
        mtime: this.fixedTimestamp, // Fixed timestamp
        type: 'file',
        uid: 0,     // Fixed UID
        gid: 0,     // Fixed GID
        uname: '',  // Empty username
        gname: '',  // Empty group name
        devmajor: 0,
        devminor: 0
      };

      const stream = pack.entry(header, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });

      if (entry.content) {
        stream.write(entry.content);
      }
      
      stream.end();
    });
  }

  /**
   * Generate content address for the package
   */
  private async generateContentAddress(packagePath: string): Promise<ContentAddress> {
    const stats = await fs.stat(packagePath);
    const content = await fs.readFile(packagePath);
    
    return createContentAddress(content, 'sha256');
  }

  /**
   * Validate that two builds produce identical results
   */
  static async validateDeterminism(
    options: BuildOptions,
    iterations: number = 2
  ): Promise<{ deterministic: boolean; hashes: string[]; error?: string }> {
    const hashes: string[] = [];

    try {
      for (let i = 0; i < iterations; i++) {
        const tempOutput = `${options.outputPath}.test-${i}`;
        const builder = new DeterministicTarBuilder({
          ...options,
          outputPath: tempOutput
        });

        const result = await builder.build();
        hashes.push(result.contentAddress.value);

        // Clean up test file
        await fs.unlink(tempOutput).catch(() => {});
      }

      const deterministic = hashes.every(hash => hash === hashes[0]);
      
      return {
        deterministic,
        hashes,
        error: deterministic ? undefined : 'Builds produced different hashes'
      };

    } catch (error) {
      return {
        deterministic: false,
        hashes,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// ==============================================================================
// Utility Functions
// ==============================================================================

/**
 * Create a package builder with sensible defaults
 */
export function createPackageBuilder(options: BuildOptions): DeterministicTarBuilder {
  return new DeterministicTarBuilder(options);
}

/**
 * Build a package with a single function call
 */
export async function buildPackage(options: BuildOptions): Promise<BuildResult> {
  const builder = createPackageBuilder(options);
  return builder.build();
}

/**
 * Extract package information without building
 */
export async function analyzePackage(baseDir: string, exclude?: string[]): Promise<{
  fileCount: number;
  totalSize: number;
  entries: { path: string; size: number; hash: string }[];
}> {
  const builder = new DeterministicTarBuilder({
    baseDir,
    outputPath: '/dev/null', // Not used for analysis
    manifest: {} as KPackManifest, // Not used for analysis
    exclude
  });

  const entries = await (builder as any).discoverEntries();
  const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);

  return {
    fileCount: entries.length,
    totalSize,
    entries: entries.map(entry => ({
      path: entry.path,
      size: entry.size,
      hash: entry.contentHash
    }))
  };
}

/**
 * Verify package integrity
 */
export async function verifyPackageIntegrity(
  packagePath: string,
  expectedContentAddress: ContentAddress
): Promise<{ valid: boolean; actualHash: string; expectedHash: string }> {
  try {
    const actualContentAddress = await createContentAddress(
      await fs.readFile(packagePath),
      expectedContentAddress.type
    );

    return {
      valid: actualContentAddress.value === expectedContentAddress.value,
      actualHash: actualContentAddress.value,
      expectedHash: expectedContentAddress.value
    };
  } catch (error) {
    throw new Error(`Failed to verify package integrity: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}