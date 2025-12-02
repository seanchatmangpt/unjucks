/**
 * NPM Registry adapter implementation
 */

import { createHash } from 'crypto';
import { gzipSync } from 'zlib';
import { 
  RegistryAdapter, 
  RegistryPackage, 
  SearchOptions, 
  SearchResult, 
  PublishOptions, 
  RegistryConfig,
  RegistryAdapterFactory 
} from './adapter.js';

interface NpmSearchResponse {
  objects: Array<{
    package: {
      name: string;
      version: string;
      description?: string;
      author?: { name: string };
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
    };
    flags?: {
      unstable?: boolean;
    };
    score: {
      final: number;
      detail: {
        quality: number;
        popularity: number;
        maintenance: number;
      };
    };
  }>;
  total: number;
  time: string;
}

interface NpmPackageResponse {
  name: string;
  'dist-tags': { [tag: string]: string };
  versions: {
    [version: string]: {
      name: string;
      version: string;
      description?: string;
      author?: string | { name: string };
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
      _attestations?: {
        signature: string;
        keyId: string;
        timestamp: string;
      }[];
    };
  };
  time: { [version: string]: string };
}

export class NpmRegistryAdapter extends RegistryAdapter {
  private baseUrl: string;

  constructor(config: RegistryConfig) {
    super(config);
    this.baseUrl = config.registry.replace(/\/$/, '');
  }

  async search(options: SearchOptions): Promise<SearchResult> {
    const searchUrl = new URL('/-/v1/search', this.baseUrl);
    
    // Build search query
    let query = options.query;
    if (options.facets?.scope) {
      query = `scope:${options.facets.scope} ${query}`;
    }
    if (options.facets?.author) {
      query = `author:${options.facets.author} ${query}`;
    }
    if (options.facets?.keywords?.length) {
      query = `keywords:${options.facets.keywords.join(',')} ${query}`;
    }

    searchUrl.searchParams.set('text', query.trim());
    searchUrl.searchParams.set('size', (options.limit || 20).toString());
    searchUrl.searchParams.set('from', (options.offset || 0).toString());

    const response = await this.fetch(searchUrl.toString());
    const data: NpmSearchResponse = await response.json();

    const packages: RegistryPackage[] = data.objects.map(obj => ({
      name: obj.package.name,
      version: obj.package.version,
      description: obj.package.description,
      author: typeof obj.package.author === 'string' 
        ? obj.package.author 
        : obj.package.author?.name,
      license: obj.package.license,
      keywords: obj.package.keywords,
      dist: obj.package.dist,
      repository: obj.package.repository,
    }));

    // Build facets from results
    const facets = {
      keywords: this.buildFacet(packages, 'keywords'),
      authors: this.buildFacet(packages, 'author'),
      licenses: this.buildFacet(packages, 'license'),
    };

    return {
      packages,
      total: data.total,
      facets,
    };
  }

  async getPackage(name: string, version?: string): Promise<RegistryPackage> {
    const packageUrl = `${this.baseUrl}/${encodeURIComponent(name)}`;
    const response = await this.fetch(packageUrl);
    const data: NpmPackageResponse = await response.json();

    const targetVersion = version || data['dist-tags'].latest;
    const versionData = data.versions[targetVersion];

    if (!versionData) {
      throw new Error(`Version ${targetVersion} not found for package ${name}`);
    }

    return {
      name: versionData.name,
      version: versionData.version,
      description: versionData.description,
      author: typeof versionData.author === 'string' 
        ? versionData.author 
        : (versionData.author as any)?.name,
      license: versionData.license,
      keywords: versionData.keywords,
      dist: versionData.dist,
      repository: versionData.repository,
      attestations: versionData._attestations,
    };
  }

  async downloadTarball(tarballUrl: string): Promise<Buffer> {
    const response = await this.fetch(tarballUrl);
    return Buffer.from(await response.arrayBuffer());
  }

  async publish(options: PublishOptions): Promise<void> {
    const { packageJson, tarball, attestations, dryRun } = options;
    
    if (dryRun) {
      console.log(`[DRY RUN] Would publish ${packageJson.name}@${packageJson.version}`);
      return;
    }

    // Create package document
    const shasum = createHash('sha1').update(tarball).digest('hex');
    const integrity = `sha512-${createHash('sha512').update(tarball).digest('base64')}`;
    const tarballBase64 = tarball.toString('base64');

    const packageDoc = {
      _id: packageJson.name,
      name: packageJson.name,
      description: packageJson.description,
      'dist-tags': {
        latest: packageJson.version,
      },
      versions: {
        [packageJson.version]: {
          ...packageJson,
          _id: `${packageJson.name}@${packageJson.version}`,
          dist: {
            shasum,
            integrity,
            tarball: `${this.baseUrl}/${packageJson.name}/-/${packageJson.name}-${packageJson.version}.tgz`,
          },
          _attestations: attestations,
        },
      },
      access: 'public',
      _attachments: {
        [`${packageJson.name}-${packageJson.version}.tgz`]: {
          content_type: 'application/octet-stream',
          data: tarballBase64,
          length: tarball.length,
        },
      },
    };

    const publishUrl = `${this.baseUrl}/${encodeURIComponent(packageJson.name)}`;
    
    await this.fetch(publishUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.token}`,
      },
      body: JSON.stringify(packageDoc),
    });
  }

  async verify(pkg: RegistryPackage): Promise<boolean> {
    try {
      // Verify tarball integrity
      const tarball = await this.downloadTarball(pkg.dist.tarball);
      
      if (pkg.dist.shasum) {
        const actualShasum = createHash('sha1').update(tarball).digest('hex');
        if (actualShasum !== pkg.dist.shasum) {
          return false;
        }
      }

      if (pkg.dist.integrity) {
        const [algorithm, expectedHash] = pkg.dist.integrity.split('-');
        const actualHash = createHash(algorithm).update(tarball).digest('base64');
        if (actualHash !== expectedHash) {
          return false;
        }
      }

      // Additional signature verification would go here
      // This would integrate with the trust system

      return true;
    } catch (error) {
      console.error(`Verification failed for ${pkg.name}@${pkg.version}:`, error);
      return false;
    }
  }

  async listVersions(name: string): Promise<string[]> {
    const packageUrl = `${this.baseUrl}/${encodeURIComponent(name)}`;
    const response = await this.fetch(packageUrl);
    const data: NpmPackageResponse = await response.json();
    
    return Object.keys(data.versions).sort((a, b) => {
      // Simple version sort - in production would use semver
      return b.localeCompare(a);
    });
  }

  async exists(name: string, version?: string): Promise<boolean> {
    try {
      const pkg = await this.getPackage(name, version);
      return !!pkg;
    } catch {
      return false;
    }
  }

  async getInfo(): Promise<{ registry: string; version?: string; healthy: boolean }> {
    try {
      const response = await this.fetch(`${this.baseUrl}/-/ping`);
      const healthy = response.ok;
      
      return {
        registry: this.baseUrl,
        healthy,
      };
    } catch {
      return {
        registry: this.baseUrl,
        healthy: false,
      };
    }
  }

  private async fetch(url: string, options?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': this.config.userAgent || 'kgen-marketplace/1.0.0',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildFacet(packages: RegistryPackage[], field: keyof RegistryPackage): { [key: string]: number } {
    const facet: { [key: string]: number } = {};
    
    packages.forEach(pkg => {
      const value = pkg[field];
      if (Array.isArray(value)) {
        value.forEach(item => {
          facet[item] = (facet[item] || 0) + 1;
        });
      } else if (value) {
        facet[value as string] = (facet[value as string] || 0) + 1;
      }
    });

    return facet;
  }
}

// Register the npm adapter
RegistryAdapterFactory.register('npm', NpmRegistryAdapter);