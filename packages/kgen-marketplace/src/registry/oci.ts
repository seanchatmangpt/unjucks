/**
 * OCI (Open Container Initiative) Registry adapter implementation
 */

import { createHash } from 'crypto';
import { 
  RegistryAdapter, 
  RegistryPackage, 
  SearchOptions, 
  SearchResult, 
  PublishOptions, 
  RegistryConfig,
  RegistryAdapterFactory 
} from './adapter.js';

interface OciManifest {
  schemaVersion: number;
  mediaType: string;
  config: {
    mediaType: string;
    size: number;
    digest: string;
  };
  layers: Array<{
    mediaType: string;
    size: number;
    digest: string;
    annotations?: { [key: string]: string };
  }>;
  annotations?: { [key: string]: string };
}

interface OciConfig {
  created?: string;
  author?: string;
  config?: {
    Labels?: { [key: string]: string };
  };
}

export class OciRegistryAdapter extends RegistryAdapter {
  private baseUrl: string;
  private authToken?: string;

  constructor(config: RegistryConfig) {
    super(config);
    this.baseUrl = config.registry.replace(/\/$/, '');
  }

  async search(options: SearchOptions): Promise<SearchResult> {
    // OCI registries don't have a standard search API
    // This implementation uses the catalog API and filters locally
    const catalogUrl = `${this.baseUrl}/v2/_catalog`;
    
    try {
      const response = await this.fetch(catalogUrl);
      const data = await response.json();
      const repositories: string[] = data.repositories || [];

      // Filter repositories based on search query
      const filteredRepos = repositories.filter(repo => 
        repo.toLowerCase().includes(options.query.toLowerCase())
      );

      // Fetch details for each repository
      const packages: RegistryPackage[] = [];
      const limit = Math.min(options.limit || 20, filteredRepos.length);
      
      for (let i = 0; i < limit; i++) {
        const repo = filteredRepos[i + (options.offset || 0)];
        if (!repo) break;

        try {
          const pkg = await this.getLatestPackage(repo);
          packages.push(pkg);
        } catch (error) {
          console.warn(`Failed to fetch details for ${repo}:`, error);
        }
      }

      return {
        packages,
        total: filteredRepos.length,
      };
    } catch (error) {
      console.error('OCI search failed:', error);
      return {
        packages: [],
        total: 0,
      };
    }
  }

  async getPackage(name: string, version?: string): Promise<RegistryPackage> {
    const tag = version || 'latest';
    
    // Get manifest
    const manifestUrl = `${this.baseUrl}/v2/${name}/manifests/${tag}`;
    const manifestResponse = await this.fetch(manifestUrl, {
      headers: {
        'Accept': 'application/vnd.oci.image.manifest.v1+json',
      },
    });
    
    const manifest: OciManifest = await manifestResponse.json();
    
    // Get config blob
    const configUrl = `${this.baseUrl}/v2/${name}/blobs/${manifest.config.digest}`;
    const configResponse = await this.fetch(configUrl);
    const config: OciConfig = await configResponse.json();

    // Extract package metadata from annotations and config
    const annotations = manifest.annotations || {};
    const labels = config.config?.Labels || {};

    return {
      name,
      version: tag,
      description: annotations['org.opencontainers.image.description'] || 
                  labels['org.opencontainers.image.description'],
      author: annotations['org.opencontainers.image.authors'] || 
              labels['org.opencontainers.image.authors'],
      license: annotations['org.opencontainers.image.licenses'] || 
               labels['org.opencontainers.image.licenses'],
      keywords: this.parseKeywords(annotations['kgen.keywords'] || labels['kgen.keywords']),
      dist: {
        tarball: `${this.baseUrl}/v2/${name}/blobs/${manifest.layers[0]?.digest}`,
        integrity: manifest.layers[0]?.digest,
      },
      repository: {
        type: 'oci',
        url: annotations['org.opencontainers.image.source'] || 
             labels['org.opencontainers.image.source'] || 
             `${this.baseUrl}/${name}`,
      },
      attestations: this.extractAttestations(manifest),
    };
  }

  async downloadTarball(tarballUrl: string): Promise<Buffer> {
    const response = await this.fetch(tarballUrl);
    return Buffer.from(await response.arrayBuffer());
  }

  async publish(options: PublishOptions): Promise<void> {
    const { packageJson, tarball, attestations, dryRun } = options;
    
    if (dryRun) {
      console.log(`[DRY RUN] Would publish ${packageJson.name}@${packageJson.version} to OCI registry`);
      return;
    }

    const name = packageJson.name;
    const tag = packageJson.version;

    // 1. Upload tarball as blob
    const blobDigest = await this.uploadBlob(name, tarball);

    // 2. Create and upload config
    const config: OciConfig = {
      created: new Date().toISOString(),
      author: packageJson.author,
      config: {
        Labels: {
          'org.opencontainers.image.title': packageJson.name,
          'org.opencontainers.image.description': packageJson.description || '',
          'org.opencontainers.image.version': packageJson.version,
          'org.opencontainers.image.licenses': packageJson.license || '',
          'org.opencontainers.image.authors': packageJson.author || '',
          'kgen.keywords': (packageJson.keywords || []).join(','),
        },
      },
    };

    const configBlob = Buffer.from(JSON.stringify(config));
    const configDigest = await this.uploadBlob(name, configBlob);

    // 3. Create manifest
    const manifest: OciManifest = {
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      config: {
        mediaType: 'application/vnd.oci.image.config.v1+json',
        size: configBlob.length,
        digest: configDigest,
      },
      layers: [
        {
          mediaType: 'application/vnd.kgen.package.v1.tar+gzip',
          size: tarball.length,
          digest: blobDigest,
          annotations: {
            'kgen.package.name': packageJson.name,
            'kgen.package.version': packageJson.version,
          },
        },
      ],
      annotations: {
        'org.opencontainers.image.title': packageJson.name,
        'org.opencontainers.image.description': packageJson.description || '',
        'org.opencontainers.image.version': packageJson.version,
        'org.opencontainers.image.created': new Date().toISOString(),
        'kgen.attestations': JSON.stringify(attestations || []),
      },
    };

    // 4. Upload manifest
    await this.uploadManifest(name, tag, manifest);
  }

  async verify(pkg: RegistryPackage): Promise<boolean> {
    try {
      // For OCI, verify the digest matches
      if (pkg.dist.integrity) {
        const tarball = await this.downloadTarball(pkg.dist.tarball);
        const actualDigest = this.calculateDigest(tarball);
        return actualDigest === pkg.dist.integrity;
      }
      return true;
    } catch (error) {
      console.error(`OCI verification failed for ${pkg.name}@${pkg.version}:`, error);
      return false;
    }
  }

  async listVersions(name: string): Promise<string[]> {
    const tagsUrl = `${this.baseUrl}/v2/${name}/tags/list`;
    
    try {
      const response = await this.fetch(tagsUrl);
      const data = await response.json();
      return data.tags || [];
    } catch (error) {
      console.error(`Failed to list versions for ${name}:`, error);
      return [];
    }
  }

  async exists(name: string, version?: string): Promise<boolean> {
    try {
      if (version) {
        const manifestUrl = `${this.baseUrl}/v2/${name}/manifests/${version}`;
        const response = await this.fetch(manifestUrl, { method: 'HEAD' });
        return response.ok;
      } else {
        const tagsUrl = `${this.baseUrl}/v2/${name}/tags/list`;
        const response = await this.fetch(tagsUrl, { method: 'HEAD' });
        return response.ok;
      }
    } catch {
      return false;
    }
  }

  async getInfo(): Promise<{ registry: string; version?: string; healthy: boolean }> {
    try {
      const response = await this.fetch(`${this.baseUrl}/v2/`);
      return {
        registry: this.baseUrl,
        healthy: response.ok,
      };
    } catch {
      return {
        registry: this.baseUrl,
        healthy: false,
      };
    }
  }

  private async getLatestPackage(name: string): Promise<RegistryPackage> {
    const versions = await this.listVersions(name);
    const latestVersion = versions.includes('latest') ? 'latest' : versions[0];
    return this.getPackage(name, latestVersion);
  }

  private async uploadBlob(name: string, blob: Buffer): Promise<string> {
    const digest = this.calculateDigest(blob);
    
    // Check if blob already exists
    const headUrl = `${this.baseUrl}/v2/${name}/blobs/${digest}`;
    const headResponse = await this.fetch(headUrl, { method: 'HEAD' });
    
    if (headResponse.ok) {
      return digest;
    }

    // Start upload
    const uploadUrl = `${this.baseUrl}/v2/${name}/blobs/uploads/`;
    const startResponse = await this.fetch(uploadUrl, { method: 'POST' });
    
    if (!startResponse.ok) {
      throw new Error(`Failed to start blob upload: ${startResponse.statusText}`);
    }

    const location = startResponse.headers.get('Location');
    if (!location) {
      throw new Error('No upload location returned');
    }

    // Upload blob
    const putUrl = `${location}&digest=${digest}`;
    const putResponse = await this.fetch(putUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': blob.length.toString(),
      },
      body: blob as any, // Type assertion for Node.js Buffer
    });

    if (!putResponse.ok) {
      throw new Error(`Failed to upload blob: ${putResponse.statusText}`);
    }

    return digest;
  }

  private async uploadManifest(name: string, tag: string, manifest: OciManifest): Promise<void> {
    const manifestUrl = `${this.baseUrl}/v2/${name}/manifests/${tag}`;
    const manifestJson = JSON.stringify(manifest);
    
    const response = await this.fetch(manifestUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/vnd.oci.image.manifest.v1+json',
        'Content-Length': manifestJson.length.toString(),
      },
      body: manifestJson,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload manifest: ${response.statusText}`);
    }
  }

  private calculateDigest(data: Buffer): string {
    const hash = createHash('sha256').update(data).digest('hex');
    return `sha256:${hash}`;
  }

  private parseKeywords(keywordsStr?: string): string[] {
    if (!keywordsStr) return [];
    return keywordsStr.split(',').map(k => k.trim()).filter(Boolean);
  }

  private extractAttestations(manifest: OciManifest): any[] {
    try {
      const attestationsStr = manifest.annotations?.['kgen.attestations'];
      return attestationsStr ? JSON.parse(attestationsStr) : [];
    } catch {
      return [];
    }
  }

  private async fetch(url: string, options?: RequestInit): Promise<Response> {
    const headers: HeadersInit = {
      'User-Agent': this.config.userAgent || 'kgen-marketplace/1.0.0',
      ...options?.headers,
    };

    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// Register the OCI adapter
RegistryAdapterFactory.register('oci', OciRegistryAdapter);