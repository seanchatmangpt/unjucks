/**
 * Main registry client with support for multiple adapters
 */

import { 
  RegistryAdapter, 
  RegistryAdapterFactory, 
  RegistryConfig, 
  RegistryPackage,
  SearchOptions,
  SearchResult,
  PublishOptions,
  DEFAULT_REGISTRY_CONFIG 
} from './adapter.js';
import { TrustVerifier, VerificationResult } from './trust.js';

export interface RegistryClientConfig extends RegistryConfig {
  type?: 'npm' | 'oci' | 'git';
  trustPolicyPath?: string;
  enableTrustVerification?: boolean;
  cacheEnabled?: boolean;
  cacheTtl?: number;
}

export interface RegistryClientOptions {
  config?: Partial<RegistryClientConfig>;
  adapter?: RegistryAdapter;
  trustVerifier?: TrustVerifier;
}

export class RegistryClient {
  private adapter: RegistryAdapter;
  private trustVerifier?: TrustVerifier;
  private config: RegistryClientConfig;
  private cache = new Map<string, { data: any; expires: number }>();

  constructor(options: RegistryClientOptions = {}) {
    this.config = {
      ...DEFAULT_REGISTRY_CONFIG,
      type: 'npm',
      enableTrustVerification: true,
      cacheEnabled: true,
      cacheTtl: 300000, // 5 minutes
      ...options.config,
    } as RegistryClientConfig;

    // Initialize adapter
    if (options.adapter) {
      this.adapter = options.adapter;
    } else {
      this.adapter = RegistryAdapterFactory.create(this.config.type!, this.config);
    }

    // Initialize trust verifier
    if (this.config.enableTrustVerification) {
      this.trustVerifier = options.trustVerifier || new TrustVerifier(this.config.trustPolicyPath);
    }
  }

  /**
   * Search for packages
   */
  async search(options: SearchOptions): Promise<SearchResult & { trustScores?: { [key: string]: VerificationResult } }> {
    const cacheKey = `search:${JSON.stringify(options)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.adapter.search(options);

    // Add trust verification
    const trustScores: { [key: string]: VerificationResult } = {};
    if (this.trustVerifier) {
      await Promise.all(
        result.packages.map(async (pkg) => {
          const trustResult = await this.trustVerifier!.verifyPackage(pkg);
          trustScores[`${pkg.name}@${pkg.version}`] = trustResult;
        })
      );
    }

    const enrichedResult = { ...result, trustScores };
    this.setCache(cacheKey, enrichedResult);
    return enrichedResult;
  }

  /**
   * Get package metadata with trust verification
   */
  async getPackage(name: string, version?: string): Promise<RegistryPackage & { trustResult?: VerificationResult }> {
    const cacheKey = `package:${name}:${version || 'latest'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const pkg = await this.adapter.getPackage(name, version);

    // Add trust verification
    let trustResult: VerificationResult | undefined;
    if (this.trustVerifier) {
      trustResult = await this.trustVerifier.verifyPackage(pkg);
    }

    const enrichedPackage = { ...pkg, trustResult };
    this.setCache(cacheKey, enrichedPackage);
    return enrichedPackage;
  }

  /**
   * Download and verify package tarball
   */
  async downloadTarball(tarballUrl: string, verify: boolean = true): Promise<Buffer> {
    const tarball = await this.adapter.downloadTarball(tarballUrl);
    
    if (verify) {
      // Extract package info from URL to verify
      const urlParts = tarballUrl.split('/');
      const filename = urlParts[urlParts.length - 1];
      const match = filename.match(/^(.+)-(\d+\.\d+\.\d+.*?)\.tgz$/);
      
      if (match) {
        const [, name, version] = match;
        try {
          const pkg = await this.getPackage(name, version);
          const isValid = await this.adapter.verify(pkg);
          if (!isValid) {
            throw new Error(`Tarball verification failed for ${name}@${version}`);
          }
        } catch (error) {
          console.warn(`Could not verify tarball ${tarballUrl}:`, error);
        }
      }
    }

    return tarball;
  }

  /**
   * Publish package with optional signing
   */
  async publish(options: PublishOptions): Promise<void> {
    // Validate package before publishing
    if (this.trustVerifier) {
      const mockPackage: RegistryPackage = {
        name: options.packageJson.name,
        version: options.packageJson.version,
        description: options.packageJson.description,
        author: options.packageJson.author,
        license: options.packageJson.license,
        keywords: options.packageJson.keywords,
        dist: {
          tarball: 'mock-tarball-url',
        },
        attestations: options.attestations?.map(att => ({
          ...att,
          timestamp: new Date().toISOString(),
        })),
      };

      const trustResult = await this.trustVerifier.verifyPackage(mockPackage);
      if (!trustResult.trusted && !options.dryRun) {
        throw new Error(`Package fails trust verification: ${trustResult.reasons.join(', ')}`);
      }
    }

    await this.adapter.publish(options);
    
    // Clear relevant cache entries
    this.clearCachePattern(`package:${options.packageJson.name}:`);
    this.clearCachePattern('search:');
  }

  /**
   * List all versions of a package
   */
  async listVersions(name: string): Promise<string[]> {
    const cacheKey = `versions:${name}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const versions = await this.adapter.listVersions(name);
    this.setCache(cacheKey, versions, 60000); // Cache for 1 minute
    return versions;
  }

  /**
   * Check if package exists
   */
  async exists(name: string, version?: string): Promise<boolean> {
    const cacheKey = `exists:${name}:${version || 'any'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const exists = await this.adapter.exists(name, version);
    this.setCache(cacheKey, exists, 60000); // Cache for 1 minute
    return exists;
  }

  /**
   * Get registry health info
   */
  async getInfo(): Promise<{ registry: string; version?: string; healthy: boolean }> {
    return await this.adapter.getInfo();
  }

  /**
   * Verify package trust without downloading
   */
  async verifyTrust(pkg: RegistryPackage): Promise<VerificationResult> {
    if (!this.trustVerifier) {
      throw new Error('Trust verification is disabled');
    }
    return await this.trustVerifier.verifyPackage(pkg);
  }

  /**
   * Get current configuration
   */
  getConfig(): RegistryClientConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<RegistryClientConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Recreate adapter if type changed
    if (updates.type && updates.type !== this.config.type) {
      this.adapter = RegistryAdapterFactory.create(updates.type, this.config);
    }

    // Recreate trust verifier if trust settings changed
    if (updates.enableTrustVerification !== undefined || updates.trustPolicyPath) {
      if (this.config.enableTrustVerification) {
        this.trustVerifier = new TrustVerifier(this.config.trustPolicyPath);
      } else {
        this.trustVerifier = undefined;
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get available adapter types
   */
  static getAvailableAdapterTypes(): string[] {
    return RegistryAdapterFactory.getAvailableTypes();
  }

  private getFromCache(key: string): any {
    if (!this.config.cacheEnabled) {
      return undefined;
    }

    const entry = this.cache.get(key);
    if (entry && entry.expires > Date.now()) {
      return entry.data;
    }

    this.cache.delete(key);
    return undefined;
  }

  private setCache(key: string, data: any, ttl?: number): void {
    if (!this.config.cacheEnabled) {
      return;
    }

    const expires = Date.now() + (ttl || this.config.cacheTtl!);
    this.cache.set(key, { data, expires });
  }

  private clearCachePattern(pattern: string): void {
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}