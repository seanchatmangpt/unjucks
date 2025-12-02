/**
 * Git Registry backend implementation
 * Uses Git repositories as package storage with semantic versioning via tags
 */

import { RegistryInterface, RegistryError, RegistryNotFoundError, RegistryAuthError, RegistryNetworkError } from '../registry-interface.js';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, mkdir, access, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

export class GitRegistry extends RegistryInterface {
  constructor(config = {}) {
    super({
      type: 'git',
      baseUrl: config.baseUrl || 'https://github.com',
      timeout: config.timeout || 60000,
      ...config
    });

    this.organization = config.organization || null;
    this.username = config.username || null;
    this.password = config.password || null;
    this.accessToken = config.accessToken || process.env.GITHUB_TOKEN;
    this.sshKey = config.sshKey || null;
    this.branch = config.branch || 'main';
    this.packageDir = config.packageDir || 'packages';
    this.tempDir = join(tmpdir(), 'kgen-git-registry');
  }

  async initialize() {
    try {
      // Ensure git is available
      await this.executeGit(['--version']);
      
      // Create temp directory
      await mkdir(this.tempDir, { recursive: true });
      
      this.emit('initialized', { registry: this.name, type: this.type });
      return true;
    } catch (error) {
      this.emit('error', { operation: 'initialize', error });
      throw new RegistryNetworkError('git', 'initialize', error);
    }
  }

  async isHealthy() {
    try {
      await this.executeGit(['--version']);
      return true;
    } catch (error) {
      return false;
    }
  }

  async publish(packageInfo, options = {}) {
    this.validatePackageInfo(packageInfo);
    
    try {
      const { name, version, content } = packageInfo;
      const repoName = this.getRepositoryName(name);
      const repoUrl = this.getRepositoryUrl(repoName);
      const workDir = join(this.tempDir, `publish-${randomBytes(8).toString('hex')}`);
      
      // Clone or create repository
      let isNewRepo = false;
      try {
        await this.cloneRepository(repoUrl, workDir);
      } catch (error) {
        if (error.message.includes('not found') || error.message.includes('does not exist')) {
          // Create new repository
          await this.createRepository(repoName, workDir);
          isNewRepo = true;
        } else {
          throw error;
        }
      }

      // Check if version already exists
      if (!isNewRepo) {
        const tags = await this.listTags(workDir);
        if (tags.includes(`v${version}`)) {
          throw new RegistryError(
            `Version ${version} already exists for package ${name}`,
            'VERSION_EXISTS'
          );
        }
      }

      // Prepare package content
      await this.writePackageContent(workDir, packageInfo);
      
      // Commit and tag
      await this.commitAndTag(workDir, packageInfo);
      
      // Push to remote
      await this.pushToRemote(workDir, repoUrl);
      
      // Clean up
      await rm(workDir, { recursive: true, force: true });
      
      this.emit('published', { name: repoName, version, repository: repoUrl });
      
      return {
        success: true,
        name: name,
        version: version,
        repository: repoUrl,
        tag: `v${version}`,
        location: `${repoUrl}/releases/tag/v${version}`
      };
    } catch (error) {
      this.emit('error', { operation: 'publish', error });
      if (error instanceof RegistryError) {
        throw error;
      }
      throw new RegistryError(`Publish failed: ${error.message}`, 'PUBLISH_FAILED', error);
    }
  }

  async search(query, options = {}) {
    try {
      // Use GitHub API for search if available
      if (this.baseUrl.includes('github.com') && this.accessToken) {
        return await this.searchGitHub(query, options);
      }
      
      // Fallback to basic organization repo listing
      if (this.organization) {
        return await this.searchOrganization(query, options);
      }
      
      throw new RegistryError('Search not supported for this Git registry configuration', 'SEARCH_NOT_SUPPORTED');
    } catch (error) {
      this.emit('error', { operation: 'search', error });
      if (error instanceof RegistryError) {
        throw error;
      }
      throw new RegistryNetworkError('git', 'search', error);
    }
  }

  async getPackageInfo(name, version = 'latest') {
    try {
      const repoName = this.getRepositoryName(name);
      const repoUrl = this.getRepositoryUrl(repoName);
      const workDir = join(this.tempDir, `info-${randomBytes(8).toString('hex')}`);
      
      // Clone repository
      await this.cloneRepository(repoUrl, workDir);
      
      // Get version info
      let targetVersion = version;
      if (version === 'latest') {
        const tags = await this.listTags(workDir);
        const versionTags = tags.filter(tag => tag.startsWith('v')).sort().reverse();
        targetVersion = versionTags[0]?.substring(1) || '0.0.1';
      }
      
      // Checkout specific version
      await this.executeGit(['checkout', `v${targetVersion}`], { cwd: workDir });
      
      // Read package metadata
      const packageData = await this.readPackageMetadata(workDir);
      
      // Get commit info
      const commitInfo = await this.getCommitInfo(workDir);
      
      // Clean up
      await rm(workDir, { recursive: true, force: true });
      
      return {
        name: name,
        version: targetVersion,
        description: packageData.description || '',
        author: packageData.author || commitInfo.author,
        license: packageData.license || 'MIT',
        keywords: packageData.keywords || [],
        repository: repoUrl,
        homepage: packageData.homepage || repoUrl,
        publishedAt: commitInfo.date,
        commit: commitInfo.hash,
        branch: this.branch,
        tags: await this.listTags(workDir)
      };
    } catch (error) {
      this.emit('error', { operation: 'getPackageInfo', error });
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        throw new RegistryNotFoundError(name, 'git');
      }
      throw new RegistryNetworkError('git', 'getPackageInfo', error);
    }
  }

  async downloadPackage(name, version = 'latest', options = {}) {
    try {
      const repoName = this.getRepositoryName(name);
      const repoUrl = this.getRepositoryUrl(repoName);
      const workDir = join(this.tempDir, `download-${randomBytes(8).toString('hex')}`);
      
      // Clone repository
      await this.cloneRepository(repoUrl, workDir);
      
      // Get version info
      let targetVersion = version;
      if (version === 'latest') {
        const tags = await this.listTags(workDir);
        const versionTags = tags.filter(tag => tag.startsWith('v')).sort().reverse();
        targetVersion = versionTags[0]?.substring(1) || '0.0.1';
      }
      
      // Checkout specific version
      await this.executeGit(['checkout', `v${targetVersion}`], { cwd: workDir });
      
      // Create archive
      const archiveBuffer = await this.createArchive(workDir);
      
      // Clean up
      await rm(workDir, { recursive: true, force: true });
      
      this.emit('downloaded', { name, version: targetVersion, size: archiveBuffer.length });
      return archiveBuffer;
    } catch (error) {
      this.emit('error', { operation: 'downloadPackage', error });
      if (error instanceof RegistryError) {
        throw error;
      }
      throw new RegistryNetworkError('git', 'downloadPackage', error);
    }
  }

  async listVersions(name) {
    try {
      const repoName = this.getRepositoryName(name);
      const repoUrl = this.getRepositoryUrl(repoName);
      const workDir = join(this.tempDir, `versions-${randomBytes(8).toString('hex')}`);
      
      // Clone repository
      await this.cloneRepository(repoUrl, workDir);
      
      // Get all tags
      const tags = await this.listTags(workDir);
      const versions = tags
        .filter(tag => tag.startsWith('v'))
        .map(tag => tag.substring(1))
        .sort((a, b) => this.compareVersions(b, a)); // Newest first
      
      // Clean up
      await rm(workDir, { recursive: true, force: true });
      
      return versions;
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        throw new RegistryNotFoundError(name, 'git');
      }
      throw new RegistryNetworkError('git', 'listVersions', error);
    }
  }

  async authenticate(credentials) {
    try {
      if (credentials.token) {
        this.accessToken = credentials.token;
      } else if (credentials.username && credentials.password) {
        this.username = credentials.username;
        this.password = credentials.password;
      } else if (credentials.sshKey) {
        this.sshKey = credentials.sshKey;
      }

      // Test authentication with a simple operation
      await this.testAuthentication();
      
      this.emit('authenticated', { username: this.username || 'token-user' });
      
      return {
        success: true,
        username: this.username || 'token-user',
        method: this.accessToken ? 'token' : this.sshKey ? 'ssh' : 'password'
      };
    } catch (error) {
      this.emit('error', { operation: 'authenticate', error });
      throw new RegistryAuthError('git', 'authenticate');
    }
  }

  async getCapabilities() {
    const base = await super.getCapabilities();
    return {
      ...base,
      supports: {
        ...base.supports,
        authentication: true,
        versioning: true,
        tags: true,
        branches: true,
        history: true
      },
      endpoints: {
        ...base.endpoints,
        clone: `${this.baseUrl}/{owner}/{repo}.git`,
        archive: `${this.baseUrl}/{owner}/{repo}/archive/{ref}.zip`,
        releases: `${this.baseUrl}/{owner}/{repo}/releases`
      },
      features: [
        'git-versioning',
        'semantic-versioning',
        'tag-based-releases',
        'branch-support',
        'commit-history',
        'ssh-authentication',
        'token-authentication'
      ]
    };
  }

  getRepositoryName(packageName) {
    return `kgen-${packageName}`;
  }

  getRepositoryUrl(repoName) {
    if (this.organization) {
      return `${this.baseUrl}/${this.organization}/${repoName}.git`;
    }
    return `${this.baseUrl}/${this.username}/${repoName}.git`;
  }

  async executeGit(args, options = {}) {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, {
        cwd: options.cwd || process.cwd(),
        env: {
          ...process.env,
          ...this.getGitEnv()
        }
      });

      let stdout = '';
      let stderr = '';

      git.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Git command failed: ${stderr || stdout}`));
        }
      });

      git.on('error', reject);
    });
  }

  getGitEnv() {
    const env = {};
    
    if (this.accessToken) {
      env.GIT_ASKPASS = 'echo';
      env.GIT_USERNAME = this.username || 'token';
      env.GIT_PASSWORD = this.accessToken;
    }
    
    return env;
  }

  async cloneRepository(repoUrl, workDir) {
    await mkdir(workDir, { recursive: true });
    
    const cloneArgs = ['clone'];
    
    // Add authentication to URL if needed
    const authUrl = this.addAuthToUrl(repoUrl);
    
    cloneArgs.push(authUrl, workDir);
    
    await this.executeGit(cloneArgs);
  }

  async createRepository(repoName, workDir) {
    await mkdir(workDir, { recursive: true });
    await this.executeGit(['init'], { cwd: workDir });
    
    // Configure git
    await this.executeGit(['config', 'user.email', 'kgen@marketplace.com'], { cwd: workDir });
    await this.executeGit(['config', 'user.name', 'Kgen Marketplace'], { cwd: workDir });
    
    // Create initial commit
    const readmePath = join(workDir, 'README.md');
    await writeFile(readmePath, `# ${repoName}\n\nKgen marketplace package repository.\n`);
    
    await this.executeGit(['add', 'README.md'], { cwd: workDir });
    await this.executeGit(['commit', '-m', 'Initial commit'], { cwd: workDir });
  }

  async writePackageContent(workDir, packageInfo) {
    const packagePath = join(workDir, this.packageDir);
    await mkdir(packagePath, { recursive: true });
    
    // Write package.json
    const packageJson = {
      name: packageInfo.name,
      version: packageInfo.version,
      description: packageInfo.description || '',
      author: packageInfo.author || '',
      license: packageInfo.license || 'MIT',
      keywords: packageInfo.keywords || [],
      repository: packageInfo.repository || {},
      ...packageInfo.metadata
    };
    
    await writeFile(
      join(packagePath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Write content
    if (typeof packageInfo.content === 'string') {
      await writeFile(join(packagePath, 'index.js'), packageInfo.content);
    } else if (Buffer.isBuffer(packageInfo.content)) {
      await writeFile(join(packagePath, 'package.tar.gz'), packageInfo.content);
    }
  }

  async commitAndTag(workDir, packageInfo) {
    await this.executeGit(['add', '.'], { cwd: workDir });
    await this.executeGit([
      'commit', 
      '-m', 
      `Release ${packageInfo.name}@${packageInfo.version}`
    ], { cwd: workDir });
    
    await this.executeGit([
      'tag', 
      '-a', 
      `v${packageInfo.version}`, 
      '-m', 
      `Version ${packageInfo.version}`
    ], { cwd: workDir });
  }

  async pushToRemote(workDir, repoUrl) {
    const authUrl = this.addAuthToUrl(repoUrl);
    await this.executeGit(['remote', 'add', 'origin', authUrl], { cwd: workDir });
    await this.executeGit(['push', '-u', 'origin', this.branch], { cwd: workDir });
    await this.executeGit(['push', '--tags'], { cwd: workDir });
  }

  async listTags(workDir) {
    try {
      const output = await this.executeGit(['tag', '-l'], { cwd: workDir });
      return output ? output.split('\n').filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }

  async readPackageMetadata(workDir) {
    try {
      const packageJsonPath = join(workDir, this.packageDir, 'package.json');
      const content = await readFile(packageJsonPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return {};
    }
  }

  async getCommitInfo(workDir) {
    const hash = await this.executeGit(['rev-parse', 'HEAD'], { cwd: workDir });
    const author = await this.executeGit(['log', '-1', '--pretty=format:%an'], { cwd: workDir });
    const date = await this.executeGit(['log', '-1', '--pretty=format:%aI'], { cwd: workDir });
    
    return {
      hash: hash.substring(0, 7),
      author,
      date
    };
  }

  async createArchive(workDir) {
    // Create tar.gz archive of the package directory
    const archivePath = join(workDir, 'package.tar.gz');
    await this.executeGit(['archive', '--format=tar.gz', `--output=${archivePath}`, 'HEAD'], { cwd: workDir });
    return await readFile(archivePath);
  }

  addAuthToUrl(url) {
    if (this.accessToken) {
      const urlObj = new URL(url);
      urlObj.username = this.username || 'token';
      urlObj.password = this.accessToken;
      return urlObj.toString();
    }
    return url;
  }

  async testAuthentication() {
    // Simple test - try to access user info if using GitHub
    if (this.baseUrl.includes('github.com') && this.accessToken) {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${this.accessToken}`,
          'User-Agent': 'kgen-marketplace'
        }
      });
      
      if (!response.ok) {
        throw new Error('Authentication test failed');
      }
    }
  }

  async searchGitHub(query, options = {}) {
    const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+kgen-${options.limit || 20}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `token ${this.accessToken}`,
        'User-Agent': 'kgen-marketplace'
      }
    });
    
    if (!response.ok) {
      throw new RegistryNetworkError('git', 'search', `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.items.map(item => ({
      name: item.name.replace(/^kgen-/, ''),
      description: item.description,
      author: item.owner.login,
      repository: item.clone_url,
      homepage: item.html_url,
      stars: item.stargazers_count,
      forks: item.forks_count,
      updatedAt: item.updated_at
    }));
  }

  async searchOrganization(query, options = {}) {
    // Simplified organization search
    const orgUrl = `https://api.github.com/orgs/${this.organization}/repos`;
    
    const response = await fetch(orgUrl, {
      headers: {
        'Authorization': `token ${this.accessToken}`,
        'User-Agent': 'kgen-marketplace'
      }
    });
    
    if (!response.ok) {
      throw new RegistryNetworkError('git', 'search', `HTTP ${response.status}`);
    }
    
    const repos = await response.json();
    return repos
      .filter(repo => repo.name.includes(query) && repo.name.startsWith('kgen-'))
      .slice(0, options.limit || 20)
      .map(repo => ({
        name: repo.name.replace(/^kgen-/, ''),
        description: repo.description,
        author: repo.owner.login,
        repository: repo.clone_url,
        homepage: repo.html_url,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        updatedAt: repo.updated_at
      }));
  }

  compareVersions(a, b) {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }
    
    return 0;
  }
}

export default GitRegistry;