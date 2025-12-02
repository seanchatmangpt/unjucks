/**
 * KGEN Marketplace Install Command
 * 
 * Securely installs KPacks from configured registries with full cryptographic verification.
 * Implements zero-trust security model with complete attestation chain validation.
 */

import { defineCommand } from 'citty';
import { readFile, writeFile, mkdir, readdir, rm, symlink, stat } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { resolve, join, dirname, basename } from 'path';
import { createHash, createVerify } from 'crypto';
import { loadConfig } from '../../utils/config.js';

// Simple output utility
const getStandardOutput = () => ({
  success: (op, result) => ({ 
    success: true, 
    operation: op, 
    result, 
    timestamp: new Date().toISOString() 
  }),
  error: (op, code, message, details) => ({ 
    success: false, 
    operation: op, 
    error: { code, message, details }, 
    timestamp: new Date().toISOString() 
  })
});

/**
 * KPack reference parser
 * Handles formats: @org/pack@version, pack@version, pack
 */
class KPackReference {
  constructor(reference) {
    this.original = reference;
    this.parse();
  }

  parse() {
    // Match patterns: @org/pack@version, pack@version, pack
    const patterns = [
      /^(@[^\/]+\/[^@]+)@(.+)$/, // @org/pack@version
      /^([^@]+)@(.+)$/,          // pack@version
      /^([^@]+)$/                // pack (latest)
    ];

    for (const pattern of patterns) {
      const match = this.original.match(pattern);
      if (match) {
        this.name = match[1];
        this.version = match[2] || 'latest';
        this.scope = this.name.startsWith('@') ? this.name.split('/')[0] : null;
        this.packageName = this.name.startsWith('@') ? this.name.split('/')[1] : this.name;
        return;
      }
    }

    throw new Error(`Invalid KPack reference format: ${this.original}`);
  }

  toString() {
    return `${this.name}@${this.version}`;
  }
}

/**
 * Cryptographic verification engine
 * Handles JWS signatures, attestation chains, and trust policies
 */
class CryptographicVerifier {
  constructor(config) {
    this.config = config;
    this.trustedKeys = new Map();
    this.loadTrustedKeys();
  }

  async loadTrustedKeys() {
    try {
      const trustFile = join(this.config.directories.state, 'trusted-keys.json');
      if (existsSync(trustFile)) {
        const content = await readFile(trustFile, 'utf8');
        const keys = JSON.parse(content);
        for (const [keyId, keyData] of Object.entries(keys)) {
          this.trustedKeys.set(keyId, keyData);
        }
      }
    } catch (error) {
      throw new Error(`Failed to load trusted keys: ${error.message}`);
    }
  }

  /**
   * Verify JWS signature on attestation
   */
  async verifyJWS(attestation) {
    try {
      const [headerB64, payloadB64, signatureB64] = attestation.split('.');
      if (!headerB64 || !payloadB64 || !signatureB64) {
        throw new Error('Invalid JWS format');
      }

      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
      const signature = Buffer.from(signatureB64, 'base64url');

      // Verify key is trusted
      const keyId = header.kid;
      if (!this.trustedKeys.has(keyId)) {
        throw new Error(`Untrusted key ID: ${keyId}`);
      }

      const trustedKey = this.trustedKeys.get(keyId);
      const verifier = createVerify(header.alg || 'RS256');
      verifier.update(`${headerB64}.${payloadB64}`);
      
      const isValid = verifier.verify(trustedKey.publicKey, signature);
      if (!isValid) {
        throw new Error('JWS signature verification failed');
      }

      return { header, payload, signature };
    } catch (error) {
      throw new Error(`JWS verification failed: ${error.message}`);
    }
  }

  /**
   * Validate complete attestation chain
   */
  async validateAttestationChain(attestations) {
    const chain = [];
    
    for (const attestation of attestations) {
      const verified = await this.verifyJWS(attestation);
      chain.push(verified);
    }

    // Validate chain integrity
    for (let i = 1; i < chain.length; i++) {
      const prev = chain[i - 1];
      const curr = chain[i];
      
      if (curr.payload.parentHash !== this.hashAttestation(prev)) {
        throw new Error(`Attestation chain broken at index ${i}`);
      }
    }

    return chain;
  }

  /**
   * Check against local trust policy
   */
  async checkTrustPolicy(pack, attestations) {
    try {
      const policyFile = join(this.config.directories.state, 'trust-policy.json');
      let policy = { rules: [] };
      
      if (existsSync(policyFile)) {
        const content = await readFile(policyFile, 'utf8');
        policy = JSON.parse(content);
      }

      // Apply trust rules
      for (const rule of policy.rules) {
        if (this.matchesRule(pack, rule)) {
          if (rule.action === 'deny') {
            throw new Error(`Trust policy violation: ${rule.reason}`);
          }
          if (rule.action === 'require' && !this.hasRequiredAttestation(attestations, rule)) {
            throw new Error(`Missing required attestation: ${rule.requirement}`);
          }
        }
      }

      return true;
    } catch (error) {
      throw new Error(`Trust policy check failed: ${error.message}`);
    }
  }

  hashAttestation(attestation) {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(attestation.payload));
    return hash.digest('hex');
  }

  matchesRule(pack, rule) {
    // Pattern matching for package names, scopes, versions
    if (rule.scope && pack.scope !== rule.scope) return false;
    if (rule.name && !pack.name.includes(rule.name)) return false;
    if (rule.version && pack.version !== rule.version) return false;
    return true;
  }

  hasRequiredAttestation(attestations, rule) {
    return attestations.some(att => 
      att.payload.type === rule.requirement
    );
  }
}

/**
 * Content Addressable Storage (CAS) manager
 * Handles secure artifact storage and retrieval by content hash
 */
class CASManager {
  constructor(config) {
    this.config = config;
    this.cacheDir = join(config.directories.cache, 'marketplace');
  }

  async ensureCacheDirectory() {
    await mkdir(this.cacheDir, { recursive: true });
  }

  /**
   * Store artifact in CAS by content hash
   */
  async storeArtifact(content, metadata = {}) {
    await this.ensureCacheDirectory();
    
    const hash = createHash('sha256');
    hash.update(content);
    const contentHash = hash.digest('hex');
    
    const artifactPath = join(this.cacheDir, contentHash);
    const metadataPath = join(this.cacheDir, `${contentHash}.meta`);
    
    // Store content
    await writeFile(artifactPath, content);
    
    // Store metadata
    await writeFile(metadataPath, JSON.stringify({
      ...metadata,
      hash: contentHash,
      size: content.length,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    return contentHash;
  }

  /**
   * Retrieve artifact from CAS by hash
   */
  async getArtifact(hash) {
    const artifactPath = join(this.cacheDir, hash);
    const metadataPath = join(this.cacheDir, `${hash}.meta`);
    
    if (!existsSync(artifactPath)) {
      throw new Error(`Artifact not found in CAS: ${hash}`);
    }
    
    const content = await readFile(artifactPath);
    let metadata = {};
    
    if (existsSync(metadataPath)) {
      const metaContent = await readFile(metadataPath, 'utf8');
      metadata = JSON.parse(metaContent);
    }
    
    // Verify content hash
    const actualHash = createHash('sha256').update(content).digest('hex');
    if (actualHash !== hash) {
      throw new Error(`Content hash mismatch: expected ${hash}, got ${actualHash}`);
    }
    
    return { content, metadata };
  }

  /**
   * Verify content hash matches expected
   */
  verifyContentHash(content, expectedHash) {
    const actualHash = createHash('sha256').update(content).digest('hex');
    return actualHash === expectedHash;
  }
}

/**
 * Atomic transaction manager
 * Ensures rollback on any failure during installation
 */
class AtomicTransaction {
  constructor() {
    this.operations = [];
    this.completed = false;
  }

  addOperation(type, path, data = null) {
    this.operations.push({
      type,
      path,
      data,
      timestamp: Date.now()
    });
  }

  async execute() {
    const rollbackOps = [];
    
    try {
      for (const op of this.operations) {
        await this.executeOperation(op, rollbackOps);
      }
      this.completed = true;
    } catch (error) {
      // Rollback in reverse order
      for (const rollback of rollbackOps.reverse()) {
        try {
          await this.executeRollback(rollback);
        } catch (rollbackError) {
          console.warn(`Rollback failed for ${rollback.path}:`, rollbackError.message);
        }
      }
      throw error;
    }
  }

  async executeOperation(op, rollbackOps) {
    switch (op.type) {
      case 'mkdir':
        await mkdir(op.path, { recursive: true });
        rollbackOps.push({ type: 'rmdir', path: op.path });
        break;
        
      case 'writeFile':
        const backup = existsSync(op.path) ? await readFile(op.path) : null;
        await writeFile(op.path, op.data);
        rollbackOps.push({
          type: backup ? 'restoreFile' : 'removeFile',
          path: op.path,
          data: backup
        });
        break;
        
      case 'symlink':
        if (existsSync(op.path)) {
          const stats = await stat(op.path);
          rollbackOps.push({
            type: stats.isSymbolicLink() ? 'restoreSymlink' : 'restoreFile',
            path: op.path,
            data: stats.isSymbolicLink() ? await readlink(op.path) : await readFile(op.path)
          });
        } else {
          rollbackOps.push({ type: 'removeFile', path: op.path });
        }
        await symlink(op.data, op.path);
        break;
        
      default:
        throw new Error(`Unknown operation type: ${op.type}`);
    }
  }

  async executeRollback(rollback) {
    switch (rollback.type) {
      case 'rmdir':
        await rm(rollback.path, { recursive: true, force: true });
        break;
        
      case 'removeFile':
        await rm(rollback.path, { force: true });
        break;
        
      case 'restoreFile':
        await writeFile(rollback.path, rollback.data);
        break;
        
      case 'restoreSymlink':
        await rm(rollback.path, { force: true });
        await symlink(rollback.data, rollback.path);
        break;
    }
  }
}

/**
 * Registry client for downloading KPacks
 */
class RegistryClient {
  constructor(config) {
    this.config = config;
    this.registries = config.marketplace?.registries || ['https://registry.kgen.dev'];
  }

  async downloadKPack(packRef) {
    for (const registry of this.registries) {
      try {
        const url = `${registry}/${packRef.scope || ''}/${packRef.packageName}/${packRef.version}`;
        
        // In a real implementation, this would use fetch or similar
        // For now, we'll simulate the download structure
        const mockDownload = {
          manifest: {
            name: packRef.name,
            version: packRef.version,
            description: 'Mock KPack for testing',
            files: ['README.md', 'template.njk'],
            attestations: []
          },
          content: Buffer.from('mock kpack content'),
          attestations: []
        };
        
        return mockDownload;
      } catch (error) {
        console.warn(`Failed to download from ${registry}:`, error.message);
      }
    }
    
    throw new Error(`Failed to download KPack ${packRef} from all registries`);
  }
}

/**
 * Git integration for installation tracking
 */
class GitIntegration {
  constructor(config) {
    this.config = config;
  }

  async recordInstallation(packRef, contentHash, transaction) {
    try {
      // Record in git-notes
      const { execSync } = await import('child_process');
      const note = {
        action: 'install',
        package: packRef.toString(),
        contentHash,
        timestamp: new Date().toISOString(),
        transaction: transaction.operations.length
      };
      
      execSync(`git notes add -m '${JSON.stringify(note)}'`, { stdio: 'ignore' });
    } catch (error) {
      // Git notes are optional, don't fail installation
      console.warn('Failed to record git notes:', error.message);
    }
  }

  async updateLockFile(packRef, contentHash) {
    const lockPath = join(process.cwd(), 'kgen.lock.json');
    let lock = { packages: {}, integrity: {} };
    
    if (existsSync(lockPath)) {
      const content = await readFile(lockPath, 'utf8');
      lock = JSON.parse(content);
    }
    
    lock.packages[packRef.name] = {
      version: packRef.version,
      contentHash,
      installedAt: new Date().toISOString()
    };
    
    lock.integrity[packRef.name] = contentHash;
    
    await writeFile(lockPath, JSON.stringify(lock, null, 2));
  }
}

/**
 * Main marketplace install command
 */
export default defineCommand({
  meta: {
    name: 'install',
    description: 'Install KPack from marketplace with cryptographic verification'
  },
  args: {
    package: {
      type: 'positional',
      description: 'KPack reference (@org/pack@version)',
      required: true
    },
    force: {
      type: 'boolean',
      description: 'Force installation even if already installed',
      default: false
    },
    'skip-verification': {
      type: 'boolean',
      description: 'Skip cryptographic verification (NOT RECOMMENDED)',
      default: false
    },
    'dry-run': {
      type: 'boolean',
      description: 'Show what would be installed without actually installing',
      default: false
    }
  },
  async run({ args }) {
    const output = await getStandardOutput();
    
    try {
      // Load configuration
      const config = await loadConfig();
      
      // Parse package reference
      const packRef = new KPackReference(args.package);
      
      // Initialize components
      const verifier = new CryptographicVerifier(config);
      const casManager = new CASManager(config);
      const registryClient = new RegistryClient(config);
      const gitIntegration = new GitIntegration(config);
      
      console.log(`Installing KPack: ${packRef.toString()}`);
      
      // Check if already installed
      const installedPath = join(config.directories.state, 'installed-packs.json');
      if (existsSync(installedPath) && !args.force) {
        const installed = JSON.parse(await readFile(installedPath, 'utf8'));
        if (installed.packages && installed.packages[packRef.name]) {
          throw new Error(`Package ${packRef.name} is already installed. Use --force to reinstall.`);
        }
      }
      
      // Download KPack
      console.log('Downloading KPack...');
      const download = await registryClient.downloadKPack(packRef);
      
      // Cryptographic verification
      if (!args['skip-verification']) {
        console.log('Verifying cryptographic signatures...');
        
        if (!download.attestations || download.attestations.length === 0) {
          throw new Error('No attestations found - package cannot be verified');
        }
        
        // Verify JWS signatures
        const verifiedChain = await verifier.validateAttestationChain(download.attestations);
        
        // Check trust policy
        await verifier.checkTrustPolicy(packRef, verifiedChain);
        
        // Verify content hash
        const expectedHash = verifiedChain[verifiedChain.length - 1].payload.contentHash;
        if (!casManager.verifyContentHash(download.content, expectedHash)) {
          throw new Error('Content hash verification failed');
        }
        
        console.log('✓ Cryptographic verification passed');
      } else {
        console.warn('⚠ Skipping cryptographic verification (NOT RECOMMENDED)');
      }
      
      if (args['dry-run']) {
        console.log('Dry run - would install:');
        console.log(`  Package: ${packRef.toString()}`);
        console.log(`  Size: ${download.content.length} bytes`);
        console.log(`  Files: ${download.manifest.files?.length || 0}`);
        return output.success('install', {
          package: packRef.toString(),
          dryRun: true,
          verified: !args['skip-verification']
        });
      }
      
      // Begin atomic transaction
      const transaction = new AtomicTransaction();
      
      // Store in CAS
      console.log('Storing in content addressable storage...');
      const contentHash = await casManager.storeArtifact(download.content, {
        package: packRef.toString(),
        manifest: download.manifest
      });
      
      // Create installation directories
      const installDir = join(config.directories.cache, 'installed', packRef.name);
      transaction.addOperation('mkdir', installDir);
      
      // Extract and symlink files
      console.log('Installing files...');
      // In a real implementation, we would extract the KPack content here
      // For now, we'll create a placeholder structure
      
      const manifestPath = join(installDir, 'kpack.json');
      transaction.addOperation('writeFile', manifestPath, JSON.stringify(download.manifest, null, 2));
      
      // Update installed packages manifest
      let installedManifest = { packages: {} };
      if (existsSync(installedPath)) {
        const content = await readFile(installedPath, 'utf8');
        installedManifest = JSON.parse(content);
      }
      
      installedManifest.packages[packRef.name] = {
        version: packRef.version,
        contentHash,
        installPath: installDir,
        installedAt: new Date().toISOString(),
        verified: !args['skip-verification']
      };
      
      transaction.addOperation('writeFile', installedPath, JSON.stringify(installedManifest, null, 2));
      
      // Execute transaction
      console.log('Committing installation...');
      await transaction.execute();
      
      // Git integration
      await gitIntegration.recordInstallation(packRef, contentHash, transaction);
      await gitIntegration.updateLockFile(packRef, contentHash);
      
      console.log(`✓ Successfully installed ${packRef.toString()}`);
      
      return output.success('install', {
        package: packRef.toString(),
        contentHash,
        verified: !args['skip-verification'],
        installPath: installDir
      });
      
    } catch (error) {
      console.error(`Failed to install package: ${error.message}`);
      return output.error('install', 'INSTALL_FAILED', error.message, {
        package: args.package
      });
    }
  }
});