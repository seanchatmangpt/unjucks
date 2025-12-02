/**
 * Abstract registry adapter interface for pluggable registry implementations
 */

export interface RegistryPackage {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  keywords?: string[];
  dist: {
    tarball: string;
    shasum?: string;
    integrity?: string;
  };
  repository?: {
    type: string;
    url: string;
  };
  attestations?: {
    signature: string;
    keyId: string;
    timestamp: string;
  }[];
  trustPolicy?: string;
}

export interface SearchOptions {
  query: string;
  facets?: {
    keywords?: string[];
    author?: string;
    license?: string[];
    scope?: string;
  };
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  packages: RegistryPackage[];
  total: number;
  facets?: {
    keywords: { [key: string]: number };
    authors: { [key: string]: number };
    licenses: { [key: string]: number };
  };
}

export interface PublishOptions {
  tarball: Buffer;
  packageJson: any;
  attestations?: {
    signature: string;
    keyId: string;
  }[];
  dryRun?: boolean;
}

export interface RegistryConfig {
  registry: string;
  token?: string;
  scope?: string;
  timeout?: number;
  retries?: number;
  userAgent?: string;
}

export abstract class RegistryAdapter {
  protected config: RegistryConfig;

  constructor(config: RegistryConfig) {
    this.config = config;
  }

  /**
   * Search for packages in the registry
   */
  abstract search(options: SearchOptions): Promise<SearchResult>;

  /**
   * Fetch package metadata
   */
  abstract getPackage(name: string, version?: string): Promise<RegistryPackage>;

  /**
   * Fetch package tarball
   */
  abstract downloadTarball(tarballUrl: string): Promise<Buffer>;

  /**
   * Publish package to registry
   */
  abstract publish(options: PublishOptions): Promise<void>;

  /**
   * Verify package integrity and signatures
   */
  abstract verify(pkg: RegistryPackage): Promise<boolean>;

  /**
   * List versions for a package
   */
  abstract listVersions(name: string): Promise<string[]>;

  /**
   * Check if package exists
   */
  abstract exists(name: string, version?: string): Promise<boolean>;

  /**
   * Get registry info/health
   */
  abstract getInfo(): Promise<{
    registry: string;
    version?: string;
    healthy: boolean;
  }>;
}

/**
 * Registry adapter factory
 */
export class RegistryAdapterFactory {
  private static adapters = new Map<string, typeof RegistryAdapter>();

  static register(type: string, adapter: typeof RegistryAdapter): void {
    this.adapters.set(type, adapter);
  }

  static create(type: string, config: RegistryConfig): RegistryAdapter {
    const AdapterClass = this.adapters.get(type);
    if (!AdapterClass) {
      throw new Error(`Unknown registry adapter type: ${type}`);
    }
    // Use type assertion since we know AdapterClass extends RegistryAdapter
    return new (AdapterClass as any)(config);
  }

  static getAvailableTypes(): string[] {
    return Array.from(this.adapters.keys());
  }
}

/**
 * Default registry configuration
 */
export const DEFAULT_REGISTRY_CONFIG: Partial<RegistryConfig> = {
  registry: 'https://registry.npmjs.org',
  timeout: 30000,
  retries: 3,
  userAgent: 'kgen-marketplace/1.0.0',
};