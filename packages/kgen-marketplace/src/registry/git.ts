/**
 * Git Registry adapter implementation for Git-based package repositories
 */

import { execSync, spawn } from 'child_process';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, basename } from 'path';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { 
  RegistryAdapter, 
  RegistryPackage, 
  SearchOptions, 
  SearchResult, 
  PublishOptions, 
  RegistryConfig,
  RegistryAdapterFactory 
} from './adapter.js';

interface GitPackageIndex {
  packages: {
    [name: string]: {
      [version: string]: {
        description?: string;
        author?: string;
        license?: string;
        keywords?: string[];
        tarball: string;
        shasum: string;
        repository?: {
          type: string;
          url: string;
        };
        attestations?: any[];
      };
    };
  };
  updated: string;
}

export class GitRegistryAdapter extends RegistryAdapter {
  private repoUrl: string;
  private workingDir: string;
  private indexPath: string;

  constructor(config: RegistryConfig) {
    super(config);
    this.repoUrl = config.registry;
    this.workingDir = join(tmpdir(), 'kgen-git-registry');
    this.indexPath = join(this.workingDir, 'index.json');
    
    this.initializeRepository();
  }

  async search(options: SearchOptions): Promise<SearchResult> {
    await this.updateIndex();
    const index = this.loadIndex();
    
    const allPackages: RegistryPackage[] = [];
    
    // Convert index to flat package list
    for (const [name, versions] of Object.entries(index.packages)) {
      for (const [version, pkg] of Object.entries(versions)) {
        allPackages.push({
          name,
          version,
          description: pkg.description,
          author: pkg.author,
          license: pkg.license,
          keywords: pkg.keywords,
          dist: {
            tarball: pkg.tarball,
            shasum: pkg.shasum,
          },
          repository: pkg.repository,
          attestations: pkg.attestations,
        });
      }
    }

    // Filter packages based on search query
    const query = options.query.toLowerCase();
    let filteredPackages = allPackages.filter(pkg => {
      const nameMatch = pkg.name.toLowerCase().includes(query);
      const descriptionMatch = pkg.description?.toLowerCase().includes(query);
      const keywordMatch = pkg.keywords?.some(k => k.toLowerCase().includes(query));
      
      return nameMatch || descriptionMatch || keywordMatch;
    });

    // Apply facet filters
    if (options.facets) {
      if (options.facets.author) {
        filteredPackages = filteredPackages.filter(pkg => 
          pkg.author?.includes(options.facets!.author!)
        );
      }
      
      if (options.facets.license?.length) {
        filteredPackages = filteredPackages.filter(pkg => 
          pkg.license && options.facets!.license!.includes(pkg.license)
        );
      }
      
      if (options.facets.keywords?.length) {
        filteredPackages = filteredPackages.filter(pkg => 
          pkg.keywords?.some(k => options.facets!.keywords!.includes(k))
        );
      }
      
      if (options.facets.scope) {
        filteredPackages = filteredPackages.filter(pkg => 
          pkg.name.startsWith(options.facets!.scope!)
        );
      }
    }

    // Pagination
    const offset = options.offset || 0;
    const limit = options.limit || 20;
    const paginatedPackages = filteredPackages.slice(offset, offset + limit);

    // Build facets
    const facets = {
      keywords: this.buildFacet(filteredPackages, 'keywords'),
      authors: this.buildFacet(filteredPackages, 'author'),
      licenses: this.buildFacet(filteredPackages, 'license'),
    };

    return {
      packages: paginatedPackages,
      total: filteredPackages.length,
      facets,
    };
  }

  async getPackage(name: string, version?: string): Promise<RegistryPackage> {
    await this.updateIndex();
    const index = this.loadIndex();
    
    const packageVersions = index.packages[name];
    if (!packageVersions) {
      throw new Error(`Package ${name} not found`);
    }

    const targetVersion = version || this.getLatestVersion(Object.keys(packageVersions));
    const pkg = packageVersions[targetVersion];
    
    if (!pkg) {
      throw new Error(`Version ${targetVersion} not found for package ${name}`);
    }

    return {
      name,
      version: targetVersion,
      description: pkg.description,
      author: pkg.author,
      license: pkg.license,
      keywords: pkg.keywords,
      dist: {
        tarball: pkg.tarball,
        shasum: pkg.shasum,
      },
      repository: pkg.repository,
      attestations: pkg.attestations,
    };
  }

  async downloadTarball(tarballUrl: string): Promise<Buffer> {
    // For git registry, tarball URL is relative to the git repo
    const relativePath = tarballUrl.replace(/^.*\//, '');
    const fullPath = join(this.workingDir, 'packages', relativePath);
    
    if (!existsSync(fullPath)) {
      throw new Error(`Tarball not found: ${fullPath}`);
    }

    // If it's gzipped, decompress it
    if (fullPath.endsWith('.gz')) {
      const decompressedPath = fullPath.replace(/\.gz$/, '');
      if (!existsSync(decompressedPath)) {
        await pipeline(
          createReadStream(fullPath),
          createGunzip(),
          createWriteStream(decompressedPath)
        );
      }
      return readFileSync(decompressedPath);
    }

    return readFileSync(fullPath);
  }

  async publish(options: PublishOptions): Promise<void> {
    const { packageJson, tarball, attestations, dryRun } = options;
    
    if (dryRun) {
      console.log(`[DRY RUN] Would publish ${packageJson.name}@${packageJson.version} to git registry`);
      return;
    }

    await this.updateIndex();
    
    // Create packages directory if it doesn't exist
    const packagesDir = join(this.workingDir, 'packages');
    if (!existsSync(packagesDir)) {
      mkdirSync(packagesDir, { recursive: true });
    }

    // Save tarball
    const tarballName = `${packageJson.name.replace(/[@\/]/g, '-')}-${packageJson.version}.tgz`;
    const tarballPath = join(packagesDir, tarballName);
    
    // Compress and save tarball
    await pipeline(
      require('stream').Readable.from([tarball]),
      createGzip(),
      createWriteStream(tarballPath)
    );

    // Calculate shasum
    const crypto = require('crypto');
    const shasum = crypto.createHash('sha1').update(tarball).digest('hex');

    // Update index
    const index = this.loadIndex();
    if (!index.packages[packageJson.name]) {
      index.packages[packageJson.name] = {};
    }

    index.packages[packageJson.name][packageJson.version] = {
      description: packageJson.description,
      author: packageJson.author,
      license: packageJson.license,
      keywords: packageJson.keywords,
      tarball: `packages/${tarballName}`,
      shasum,
      repository: packageJson.repository,
      attestations,
    };

    index.updated = new Date().toISOString();
    this.saveIndex(index);

    // Commit and push changes
    await this.commitAndPush(`Add ${packageJson.name}@${packageJson.version}`);
  }

  async verify(pkg: RegistryPackage): Promise<boolean> {
    try {
      const tarball = await this.downloadTarball(pkg.dist.tarball);
      
      if (pkg.dist.shasum) {
        const crypto = require('crypto');
        const actualShasum = crypto.createHash('sha1').update(tarball).digest('hex');
        return actualShasum === pkg.dist.shasum;
      }
      
      return true;
    } catch (error) {
      console.error(`Git verification failed for ${pkg.name}@${pkg.version}:`, error);
      return false;
    }
  }

  async listVersions(name: string): Promise<string[]> {
    await this.updateIndex();
    const index = this.loadIndex();
    
    const packageVersions = index.packages[name];
    if (!packageVersions) {
      return [];
    }

    return Object.keys(packageVersions).sort((a, b) => {
      // Simple version sort - in production would use semver
      return b.localeCompare(a);
    });
  }

  async exists(name: string, version?: string): Promise<boolean> {
    try {
      await this.getPackage(name, version);
      return true;
    } catch {
      return false;
    }
  }

  async getInfo(): Promise<{ registry: string; version?: string; healthy: boolean }> {
    try {
      await this.updateIndex();
      return {
        registry: this.repoUrl,
        healthy: true,
      };
    } catch {
      return {
        registry: this.repoUrl,
        healthy: false,
      };
    }
  }

  private initializeRepository(): void {
    if (!existsSync(this.workingDir)) {
      mkdirSync(this.workingDir, { recursive: true });
      
      try {
        // Clone the repository
        execSync(`git clone ${this.repoUrl} ${this.workingDir}`, {
          stdio: 'pipe',
        });
      } catch (error) {
        // If clone fails, initialize a new repo
        console.warn(`Failed to clone ${this.repoUrl}, initializing new repository`);
        execSync(`git init`, { cwd: this.workingDir });
        
        // Create initial index
        const initialIndex: GitPackageIndex = {
          packages: {},
          updated: new Date().toISOString(),
        };
        this.saveIndex(initialIndex);
      }
    }
  }

  private async updateIndex(): Promise<void> {
    try {
      // Pull latest changes
      execSync(`git pull origin main`, {
        cwd: this.workingDir,
        stdio: 'pipe',
      });
    } catch (error) {
      console.warn('Failed to pull latest changes:', error);
    }
  }

  private loadIndex(): GitPackageIndex {
    if (!existsSync(this.indexPath)) {
      return {
        packages: {},
        updated: new Date().toISOString(),
      };
    }

    try {
      const content = readFileSync(this.indexPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.warn('Failed to parse index, creating new one:', error);
      return {
        packages: {},
        updated: new Date().toISOString(),
      };
    }
  }

  private saveIndex(index: GitPackageIndex): void {
    require('fs').writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
  }

  private async commitAndPush(message: string): Promise<void> {
    try {
      execSync(`git add .`, { cwd: this.workingDir });
      execSync(`git commit -m "${message}"`, { cwd: this.workingDir });
      execSync(`git push origin main`, { cwd: this.workingDir });
    } catch (error) {
      console.error('Failed to commit and push:', error);
      throw error;
    }
  }

  private getLatestVersion(versions: string[]): string {
    // Simple latest version logic - in production would use semver
    return versions.sort((a, b) => b.localeCompare(a))[0];
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

// Register the git adapter
RegistryAdapterFactory.register('git', GitRegistryAdapter);