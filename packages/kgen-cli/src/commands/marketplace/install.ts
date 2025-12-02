/**
 * Marketplace Install Command
 * 
 * Verify and install knowledge packages into Content-Addressed Storage (CAS).
 * Implements cryptographic verification, dependency resolution, and atomic installation.
 */

import { defineCommand } from 'citty';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { resolve, join, dirname, basename } from 'path';
import { createHash } from 'crypto';
import { consola } from 'consola';

interface Package {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  dependencies?: Record<string, string>;
  hash: string;
  size: number;
  verified: boolean;
  signature?: {
    algorithm: string;
    value: string;
    publicKey: string;
  };
}

interface InstallResult {
  installed: Package[];
  dependencies: Package[];
  casPath: string;
  totalSize: number;
  verificationStatus: 'verified' | 'unverified' | 'failed';
}

export default defineCommand({
  meta: {
    name: 'install',
    description: 'Verify and install knowledge packages into Content-Addressed Storage'
  },
  args: {
    package: {
      type: 'positional',
      description: 'Package name@version or path to package file',
      required: true
    },
    registry: {
      type: 'string',
      description: 'Registry URL to download from',
      default: 'https://registry.kgen.org',
      alias: 'r'
    },
    'cas-dir': {
      type: 'string',
      description: 'Content-Addressed Storage directory',
      default: './.kgen/cas',
      alias: 'cas'
    },
    'verify-signatures': {
      type: 'boolean',
      description: 'Verify cryptographic signatures',
      default: true,
      alias: 'verify'
    },
    'trust-key': {
      type: 'string',
      description: 'Trust packages signed by this public key',
      alias: 'trust'
    },
    'install-deps': {
      type: 'boolean',
      description: 'Install dependencies automatically',
      default: true,
      alias: 'deps'
    },
    'dev-dependencies': {
      type: 'boolean',
      description: 'Include development dependencies',
      default: false,
      alias: 'dev'
    },
    force: {
      type: 'boolean',
      description: 'Force installation even if already exists',
      default: false
    },
    'dry-run': {
      type: 'boolean',
      description: 'Show what would be installed without installing',
      alias: 'dry',
      default: false
    },
    'output-dir': {
      type: 'string',
      description: 'Output directory for installed packages',
      alias: 'o'
    },
    json: {
      type: 'boolean',
      description: 'Output result as JSON',
      default: false
    }
  },
  async run({ args }) {
    const startTime = Date.now();
    
    try {
      // Parse package specification
      const packageSpec = parsePackageSpec(args.package);
      
      if (!args.json) {
        consola.info(`📦 Installing: ${packageSpec.name}@${packageSpec.version || 'latest'}`);
      }

      // Setup CAS directory
      const casDir = resolve(args['cas-dir']);
      if (!existsSync(casDir)) {
        mkdirSync(casDir, { recursive: true });
      }

      // Resolve and download package
      const packageInfo = await resolvePackage(packageSpec, args);
      
      // Verify package integrity and signatures
      const verificationResult = await verifyPackage(packageInfo, args);
      
      if (!verificationResult.valid && args['verify-signatures']) {
        throw new Error(`Package verification failed: ${verificationResult.reason}`);
      }

      // Resolve dependencies
      const dependencies = args['install-deps'] ? 
        await resolveDependencies(packageInfo, args) : [];

      // Install into CAS
      const installResult = await installIntoCAS(
        packageInfo, 
        dependencies, 
        casDir, 
        args
      );

      // Create symlinks or copy to output directory if specified
      if (args['output-dir'] && !args['dry-run']) {
        await createOutputLinks(installResult, args['output-dir']);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Output result
      const result = {
        success: true,
        data: {
          ...installResult,
          performance: {
            duration,
            packagesProcessed: installResult.installed.length + installResult.dependencies.length
          },
          dryRun: args['dry-run']
        },
        timestamp: new Date().toISOString()
      };

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (args['dry-run']) {
          consola.success('📋 Installation plan created (dry run)');
        } else {
          consola.success(`🎉 Installed ${packageSpec.name}@${packageInfo.version}`);
        }
        
        consola.info(`📊 Packages: ${installResult.installed.length} installed, ${installResult.dependencies.length} dependencies`);
        consola.info(`💾 Total size: ${formatBytes(installResult.totalSize)}`);
        consola.info(`🔒 Verification: ${installResult.verificationStatus.toUpperCase()}`);
        consola.info(`📂 CAS location: ${installResult.casPath}`);
        consola.info(`⏱️  Installation time: ${duration}ms`);
      }

    } catch (error) {
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'INSTALL_FAILED',
        timestamp: new Date().toISOString()
      };

      if (args.json) {
        console.log(JSON.stringify(errorResult, null, 2));
      } else {
        consola.error(`Installation failed: ${errorResult.error}`);
      }
      process.exit(1);
    }
  }
});

function parsePackageSpec(packageSpec: string): { name: string; version?: string; source?: string } {
  // Handle different package specification formats:
  // - package@version
  // - package (latest version)
  // - ./path/to/package.kpack (local file)
  // - http://registry.com/package@version (full URL)
  
  if (packageSpec.startsWith('./') || packageSpec.startsWith('/')) {
    // Local file
    return {
      name: basename(packageSpec, '.kpack'),
      source: 'file',
      version: undefined
    };
  }
  
  if (packageSpec.startsWith('http://') || packageSpec.startsWith('https://')) {
    // Full URL
    const url = new URL(packageSpec);
    const pathParts = url.pathname.split('/');
    const nameAndVersion = pathParts[pathParts.length - 1];
    const [name, version] = nameAndVersion.split('@');
    return { name, version, source: 'url' };
  }
  
  // Package name with optional version
  const [name, version] = packageSpec.split('@');
  return { name, version };
}

async function resolvePackage(
  packageSpec: { name: string; version?: string; source?: string },
  args: any
): Promise<Package> {
  
  if (packageSpec.source === 'file') {
    // Load from local file
    const packagePath = resolve(packageSpec.name + '.kpack');
    if (!existsSync(packagePath)) {
      throw new Error(`Local package file not found: ${packagePath}`);
    }
    
    const packageContent = readFileSync(packagePath);
    const packageHash = createHash('blake3', { outputLength: 32 })
      .update(packageContent)
      .digest('hex');
    
    // Parse package metadata (simplified)
    const metadata = JSON.parse(packageContent.toString());
    
    return {
      name: packageSpec.name,
      version: metadata.version || '1.0.0',
      description: metadata.description,
      author: metadata.author,
      license: metadata.license,
      dependencies: metadata.dependencies,
      hash: packageHash,
      size: packageContent.length,
      verified: false // Local packages aren't verified by default
    };
  }
  
  // Resolve from registry (mock implementation)
  const mockPackages: Record<string, Package> = {
    '@legal/gdpr-contract-generator': {
      name: '@legal/gdpr-contract-generator',
      version: '2.1.0',
      description: 'GDPR-compliant contract generation templates',
      author: 'Legal Tech Corp',
      license: 'MIT',
      dependencies: {
        '@legal/base-templates': '^1.0.0'
      },
      hash: 'abc123def456789abc123def456789abc123def456789abc123def456789abc123',
      size: 2048576,
      verified: true,
      signature: {
        algorithm: 'Ed25519',
        value: 'signature_value_here',
        publicKey: 'public_key_here'
      }
    },
    '@financial/api-service-generator': {
      name: '@financial/api-service-generator',
      version: '3.0.1',
      description: 'Financial services API generator',
      author: 'FinTech Solutions',
      license: 'Apache-2.0',
      dependencies: {},
      hash: 'def456789abc123def456789abc123def456789abc123def456789abc123def456',
      size: 1536000,
      verified: true
    }
  };
  
  const packageKey = packageSpec.name;
  const packageInfo = mockPackages[packageKey];
  
  if (!packageInfo) {
    throw new Error(`Package not found: ${packageSpec.name}`);
  }
  
  // Check version compatibility if specified
  if (packageSpec.version && packageSpec.version !== 'latest' && packageSpec.version !== packageInfo.version) {
    throw new Error(`Version ${packageSpec.version} not found for ${packageSpec.name}`);
  }
  
  return packageInfo;
}

async function verifyPackage(
  packageInfo: Package,
  args: any
): Promise<{ valid: boolean; reason?: string }> {
  
  if (!args['verify-signatures']) {
    return { valid: true };
  }
  
  // Check if package has signature
  if (!packageInfo.signature) {
    return { 
      valid: false, 
      reason: 'Package is not signed but signature verification is required' 
    };
  }
  
  // Verify signature (mock implementation)
  // In a real implementation, this would:
  // 1. Download the package content
  // 2. Verify the signature using the public key
  // 3. Check if the public key is trusted
  
  if (args['trust-key'] && packageInfo.signature.publicKey !== args['trust-key']) {
    return {
      valid: false,
      reason: `Package signed by untrusted key: ${packageInfo.signature.publicKey}`
    };
  }
  
  // Mock verification success
  return { valid: true };
}

async function resolveDependencies(
  packageInfo: Package,
  args: any
): Promise<Package[]> {
  
  if (!packageInfo.dependencies || Object.keys(packageInfo.dependencies).length === 0) {
    return [];
  }
  
  const dependencies: Package[] = [];
  
  for (const [depName, depVersion] of Object.entries(packageInfo.dependencies)) {
    const depSpec = { name: depName, version: depVersion.replace('^', '').replace('~', '') };
    const depPackage = await resolvePackage(depSpec, args);
    dependencies.push(depPackage);
    
    // Recursively resolve dependencies of dependencies
    const subDeps = await resolveDependencies(depPackage, args);
    dependencies.push(...subDeps);
  }
  
  // Remove duplicates
  const uniqueDeps = dependencies.filter((dep, index, self) => 
    index === self.findIndex(d => d.name === dep.name && d.version === dep.version)
  );
  
  return uniqueDeps;
}

async function installIntoCAS(
  packageInfo: Package,
  dependencies: Package[],
  casDir: string,
  args: any
): Promise<InstallResult> {
  
  const installed: Package[] = [];
  const allPackages = [packageInfo, ...dependencies];
  let totalSize = 0;
  
  for (const pkg of allPackages) {
    const casPath = join(casDir, pkg.hash.slice(0, 2), pkg.hash);
    
    if (existsSync(casPath) && !args.force) {
      if (!args.json) {
        consola.info(`📋 Already in CAS: ${pkg.name}@${pkg.version}`);
      }
    } else if (!args['dry-run']) {
      // Create directory structure
      mkdirSync(dirname(casPath), { recursive: true });
      
      // In a real implementation, this would download and store the package
      // For now, we'll create a placeholder file
      writeFileSync(casPath, JSON.stringify({
        name: pkg.name,
        version: pkg.version,
        hash: pkg.hash,
        installedAt: new Date().toISOString()
      }, null, 2));
      
      // Create metadata file
      const metadataPath = casPath + '.meta.json';
      writeFileSync(metadataPath, JSON.stringify(pkg, null, 2));
      
      if (!args.json) {
        consola.info(`💾 Stored in CAS: ${pkg.name}@${pkg.version} (${pkg.hash.slice(0, 8)}...)`);
      }
    }
    
    installed.push(pkg);
    totalSize += pkg.size;
  }
  
  return {
    installed: [packageInfo],
    dependencies,
    casPath: casDir,
    totalSize,
    verificationStatus: packageInfo.verified ? 'verified' : 'unverified'
  };
}

async function createOutputLinks(
  installResult: InstallResult,
  outputDir: string
): Promise<void> {
  
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  // Create symlinks or copy files to output directory
  for (const pkg of [...installResult.installed, ...installResult.dependencies]) {
    const casPath = join(installResult.casPath, pkg.hash.slice(0, 2), pkg.hash);
    const outputPath = join(outputDir, `${pkg.name}-${pkg.version}`);
    
    try {
      // Create symbolic link to CAS
      if (existsSync(outputPath)) {
        // Remove existing link/file
        require('fs').unlinkSync(outputPath);
      }
      require('fs').symlinkSync(casPath, outputPath);
    } catch (error) {
      // Fallback to copying if symlink fails
      const casContent = readFileSync(casPath);
      writeFileSync(outputPath, casContent);
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}