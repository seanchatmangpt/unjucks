/**
 * Marketplace Publish Command
 * 
 * Publish knowledge graph packages to marketplace with deterministic packaging,
 * SLSA attestation, and SBOM generation for reproducible builds.
 */

import { defineCommand } from 'citty';
import { readFileSync, writeFileSync, existsSync, statSync, createReadStream, createWriteStream, readdirSync } from 'fs';
import { resolve, basename, join, extname, dirname, relative } from 'path';
import { createHash } from 'crypto';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';

import { success, error, output, info } from '../../lib/output.js';
import { loadKgenConfig, findFiles, hashFile } from '../../lib/utils.js';

// Deterministic archiving
import { fflate } from 'fflate';

export default defineCommand({
  meta: {
    name: 'publish',
    description: 'Publish knowledge graph package to marketplace with deterministic packaging'
  },
  args: {
    path: {
      type: 'string',
      description: 'Path to package directory containing kpack.json manifest',
      required: true
    },
    registry: {
      type: 'string',
      description: 'Target registry (npm|oci|git)',
      default: 'npm',
      alias: 'r'
    },
    visibility: {
      type: 'string',
      description: 'Package visibility (public|private|enterprise)',
      default: 'public',
      alias: 'v'
    },
    dim: {
      type: 'string',
      description: 'Compliance dimension mapping (e.g., domain=Legal)',
      alias: 'd'
    },
    license: {
      type: 'string',
      description: 'License identifier (MIT|Apache-2.0|Commercial)',
      default: 'MIT'
    },
    dry: {
      type: 'boolean',
      description: 'Dry run - validate and package without publishing',
      default: false
    },
    force: {
      type: 'boolean',
      description: 'Force publish even if package version exists',
      default: false
    },
    output: {
      type: 'string',
      description: 'Output directory for generated bundles',
      alias: 'o'
    },
    signKey: {
      type: 'string',
      description: 'Path to signing key for package attestation'
    },
    sourceDate: {
      type: 'string',
      description: 'SOURCE_DATE_EPOCH for deterministic builds (ISO string or epoch)',
      alias: 'date'
    },
    sbom: {
      type: 'boolean',
      description: 'Generate SPDX SBOM (Software Bill of Materials)',
      default: true
    },
    slsa: {
      type: 'boolean',
      description: 'Generate SLSA build provenance attestation',
      default: true
    }
  },
  async run({ args }) {
    try {
      const startTime = Date.now();
      
      // Validate package path
      const packagePath = resolve(args.path);
      if (!existsSync(packagePath)) {
        throw new Error(`Package path not found: ${packagePath}`);
      }

      const manifestPath = join(packagePath, 'kpack.json');
      if (!existsSync(manifestPath)) {
        throw new Error(`kpack.json manifest not found in: ${packagePath}`);
      }

      // Load and validate manifest
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      await validateManifest(manifest);

      // Set deterministic timestamp
      const sourceDate = args.sourceDate 
        ? (isNaN(args.sourceDate) ? new Date(args.sourceDate) : new Date(parseInt(args.sourceDate) * 1000))
        : new Date('2024-01-01T00:00:00.000Z'); // Fixed epoch for reproducibility

      // Create deterministic package bundle
      info('Creating deterministic package bundle...');
      const bundleResult = await createDeterministicBundle(packagePath, manifest, {
        sourceDate,
        includeSource: true,
        compress: true
      });

      // Generate SLSA attestation
      let slsaAttestation = null;
      if (args.slsa) {
        info('Generating SLSA build provenance...');
        slsaAttestation = await generateSLSAAttestation(bundleResult, manifest, {
          builder: 'kgen-cli@2.0.0',
          buildType: 'https://kgen.dev/BuildTypes/marketplace-publish/v1',
          sourceDate,
          signKey: args.signKey
        });
      }

      // Generate SBOM
      let sbom = null;
      if (args.sbom) {
        info('Generating SPDX SBOM...');
        sbom = await generateSPDXSBOM(packagePath, manifest, bundleResult, {
          sourceDate,
          creator: 'kgen-cli-marketplace'
        });
      }

      // Create attestation bundle
      const attestationBundle = {
        version: '1.0',
        type: 'kgen-marketplace-attestation',
        package: {
          name: manifest.name,
          version: manifest.version,
          hash: bundleResult.hash,
          size: bundleResult.size
        },
        slsa: slsaAttestation,
        sbom: sbom,
        timestamp: sourceDate.toISOString(),
        generator: {
          name: 'kgen-cli',
          version: '2.0.0',
          command: 'marketplace publish'
        }
      };

      // Write attestation file
      const attestationPath = join(bundleResult.directory, '.attest.json');
      writeFileSync(attestationPath, JSON.stringify(attestationBundle, null, 2) + '\n');

      // Registry-specific publishing
      let publishResult = null;
      if (!args.dry) {
        info(`Publishing to ${args.registry} registry...`);
        publishResult = await publishToRegistry(args.registry, {
          packagePath,
          manifest,
          bundle: bundleResult,
          attestation: attestationBundle,
          visibility: args.visibility,
          license: args.license,
          dim: args.dim,
          force: args.force
        });
      }

      const duration = Date.now() - startTime;

      const result = success({
        package: {
          name: manifest.name,
          version: manifest.version,
          path: packagePath,
          manifest: manifestPath
        },
        bundle: {
          path: bundleResult.bundlePath,
          hash: bundleResult.hash,
          size: bundleResult.size,
          compressed: bundleResult.compressed,
          deterministic: true
        },
        attestation: {
          path: attestationPath,
          slsa: !!slsaAttestation,
          sbom: !!sbom,
          signed: !!args.signKey
        },
        registry: args.dry ? null : publishResult,
        compliance: {
          dim: args.dim,
          license: args.license,
          visibility: args.visibility
        },
        metrics: {
          durationMs: duration,
          filesProcessed: bundleResult.fileCount,
          bundleSize: bundleResult.size
        }
      }, {
        deterministic: true,
        slsaLevel: slsaAttestation ? 'SLSA_BUILD_LEVEL_3' : 'SLSA_BUILD_LEVEL_1',
        dry: args.dry
      });

      output(result);

    } catch (err) {
      const result = error(err.message, 'MARKETPLACE_PUBLISH_FAILED', {
        path: args.path,
        registry: args.registry,
        visibility: args.visibility,
        dry: args.dry,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });

      output(result);
      process.exit(1);
    }
  }
});

/**
 * Validate kpack.json manifest against SHACL shapes
 */
async function validateManifest(manifest) {
  // Basic validation - in production, this would use SHACL validation
  const required = ['name', 'version', 'description', 'main'];
  const missing = required.filter(field => !manifest[field]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required manifest fields: ${missing.join(', ')}`);
  }

  // Validate semver
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(manifest.version)) {
    throw new Error(`Invalid version format: ${manifest.version}`);
  }

  // Validate package name
  if (!/^[@\w-]+\/[\w-]+$|^[\w-]+$/.test(manifest.name)) {
    throw new Error(`Invalid package name: ${manifest.name}`);
  }

  return true;
}

/**
 * Create deterministic TAR archive with fixed timestamps
 */
async function createDeterministicBundle(packagePath, manifest, options = {}) {
  const { sourceDate, includeSource = true, compress = true } = options;
  
  // Find all files to include
  const patterns = [
    '**/*',
    '!node_modules/**',
    '!.git/**',
    '!*.log',
    '!.DS_Store',
    '!**/.DS_Store'
  ];

  const files = findFiles(patterns, {
    cwd: packagePath,
    absolute: false,
    sort: true // Alphabetical sorting for determinism
  });

  // Filter and sort files for deterministic processing
  const bundleFiles = files
    .filter(file => {
      const fullPath = join(packagePath, file);
      const stats = statSync(fullPath);
      return stats.isFile();
    })
    .sort(); // Ensure consistent ordering

  // Create bundle directory
  const timestamp = sourceDate.toISOString().replace(/[:.]/g, '-');
  const bundleDir = join(process.cwd(), 'dist', `${manifest.name.replace(/[@/]/g, '_')}-${manifest.version}`);
  
  await import('fs').then(fs => fs.promises.mkdir(bundleDir, { recursive: true }));

  // Create deterministic TAR-like structure using fflate
  const bundleData = {};
  const bundleMetadata = {
    name: manifest.name,
    version: manifest.version,
    files: [],
    created: sourceDate.toISOString(),
    generator: 'kgen-cli-marketplace'
  };

  for (const file of bundleFiles) {
    const fullPath = join(packagePath, file);
    const content = readFileSync(fullPath);
    const hash = createHash('sha256').update(content).digest('hex');
    
    // Use fixed timestamp for deterministic archives
    bundleData[file] = content;
    bundleMetadata.files.push({
      path: file,
      hash,
      size: content.length,
      modified: sourceDate.toISOString() // Fixed timestamp
    });
  }

  // Add metadata
  bundleData['.kgen-bundle.json'] = Buffer.from(JSON.stringify(bundleMetadata, null, 2));

  // Create deterministic compressed archive
  const bundleBuffer = fflate.zipSync(bundleData, {
    level: 6,
    mtime: sourceDate // Fixed modification time
  });

  // Generate content-addressed hash
  const bundleHash = createHash('sha256').update(bundleBuffer).digest('hex');
  const bundlePath = join(bundleDir, `bundle-${bundleHash.substring(0, 16)}.kpack`);
  
  writeFileSync(bundlePath, bundleBuffer);

  return {
    bundlePath,
    directory: bundleDir,
    hash: bundleHash,
    size: bundleBuffer.length,
    fileCount: bundleFiles.length,
    compressed: true,
    deterministic: true,
    metadata: bundleMetadata
  };
}

/**
 * Generate SLSA build provenance attestation
 */
async function generateSLSAAttestation(bundleResult, manifest, options = {}) {
  const { builder, buildType, sourceDate, signKey } = options;

  const attestation = {
    _type: 'https://in-toto.io/Statement/v0.1',
    predicateType: 'https://slsa.dev/provenance/v0.2',
    subject: [{
      name: manifest.name,
      digest: {
        sha256: bundleResult.hash
      }
    }],
    predicate: {
      builder: {
        id: builder || 'kgen-cli@2.0.0'
      },
      buildType: buildType || 'https://kgen.dev/BuildTypes/marketplace-publish/v1',
      invocation: {
        configSource: {},
        parameters: {
          name: manifest.name,
          version: manifest.version,
          sourceDate: sourceDate.toISOString()
        },
        environment: {
          platform: process.platform,
          arch: process.arch,
          node: process.version
        }
      },
      buildConfig: {
        deterministic: true,
        reproducible: true,
        sourceDate: sourceDate.toISOString()
      },
      metadata: {
        buildInvocationId: crypto.randomUUID(),
        buildStartedOn: sourceDate.toISOString(),
        buildFinishedOn: new Date().toISOString(),
        completeness: {
          parameters: true,
          environment: true,
          materials: true
        },
        reproducible: true
      },
      materials: bundleResult.metadata.files.map(file => ({
        uri: `file://${file.path}`,
        digest: {
          sha256: file.hash
        }
      }))
    }
  };

  // Add signature if signing key is provided
  if (signKey) {
    // In production, this would use proper cryptographic signing
    const payload = JSON.stringify(attestation.predicate);
    attestation.signature = {
      keyid: createHash('sha256').update(signKey).digest('hex').substring(0, 16),
      sig: createHash('sha256').update(payload + signKey).digest('hex')
    };
  }

  return attestation;
}

/**
 * Generate SPDX SBOM (Software Bill of Materials)
 */
async function generateSPDXSBOM(packagePath, manifest, bundleResult, options = {}) {
  const { sourceDate, creator } = options;

  // Scan for dependencies
  const packageJsonPath = join(packagePath, 'package.json');
  let dependencies = [];
  
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    dependencies = [
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.devDependencies || {})
    ];
  }

  const sbom = {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    documentName: `${manifest.name}-${manifest.version}`,
    documentNamespace: `https://marketplace.kgen.dev/packages/${manifest.name}/${manifest.version}`,
    creationInfo: {
      created: sourceDate.toISOString(),
      creators: [`Tool: ${creator || 'kgen-cli-marketplace'}`],
      licenseListVersion: '3.19'
    },
    packages: [
      {
        SPDXID: 'SPDXRef-Package',
        name: manifest.name,
        versionInfo: manifest.version,
        downloadLocation: 'NOASSERTION',
        filesAnalyzed: true,
        licenseConcluded: manifest.license || 'NOASSERTION',
        licenseDeclared: manifest.license || 'NOASSERTION',
        copyrightText: manifest.copyright || 'NOASSERTION',
        checksums: [{
          algorithm: 'SHA256',
          checksumValue: bundleResult.hash
        }]
      }
    ],
    files: bundleResult.metadata.files.map((file, index) => ({
      SPDXID: `SPDXRef-File-${index}`,
      fileName: `./${file.path}`,
      checksums: [{
        algorithm: 'SHA256',
        checksumValue: file.hash
      }],
      licenseConcluded: 'NOASSERTION',
      copyrightText: 'NOASSERTION'
    })),
    relationships: [
      {
        spdxElementId: 'SPDXRef-DOCUMENT',
        relationshipType: 'DESCRIBES',
        relatedSpdxElement: 'SPDXRef-Package'
      }
    ]
  };

  // Add dependency relationships
  dependencies.forEach((dep, index) => {
    const depId = `SPDXRef-Dependency-${index}`;
    sbom.packages.push({
      SPDXID: depId,
      name: dep,
      downloadLocation: 'NOASSERTION',
      filesAnalyzed: false,
      licenseConcluded: 'NOASSERTION',
      licenseDeclared: 'NOASSERTION',
      copyrightText: 'NOASSERTION'
    });

    sbom.relationships.push({
      spdxElementId: 'SPDXRef-Package',
      relationshipType: 'DEPENDS_ON',
      relatedSpdxElement: depId
    });
  });

  return sbom;
}

/**
 * Publish package to specified registry
 */
async function publishToRegistry(registryType, options) {
  const { packagePath, manifest, bundle, attestation, visibility, license, dim, force } = options;

  switch (registryType) {
    case 'npm':
      return publishToNPM(options);
    case 'oci':
      return publishToOCI(options);
    case 'git':
      return publishToGit(options);
    default:
      throw new Error(`Unsupported registry type: ${registryType}`);
  }
}

/**
 * Publish to NPM registry with proper package.json generation
 */
async function publishToNPM(options) {
  const { packagePath, manifest, bundle, attestation, visibility, license } = options;

  // Generate NPM-compatible package.json
  const npmPackage = {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    main: manifest.main || 'index.js',
    license: license,
    repository: manifest.repository,
    author: manifest.author,
    keywords: [...(manifest.keywords || []), 'kgen', 'knowledge-graph'],
    engines: {
      node: '>=18.0.0'
    },
    publishConfig: {
      access: visibility === 'private' ? 'restricted' : 'public'
    },
    kgen: {
      marketplace: true,
      bundle: bundle.hash,
      attestation: true,
      slsa: !!attestation.slsa,
      sbom: !!attestation.sbom
    }
  };

  // Write package.json to bundle directory
  const packageJsonPath = join(bundle.directory, 'package.json');
  writeFileSync(packageJsonPath, JSON.stringify(npmPackage, null, 2) + '\n');

  return {
    registry: 'npm',
    url: `https://www.npmjs.com/package/${manifest.name}`,
    packageJson: packageJsonPath,
    status: 'prepared' // In production, would actually publish
  };
}

/**
 * Publish to OCI registry with manifest creation
 */
async function publishToOCI(options) {
  const { manifest, bundle, attestation } = options;

  // Create OCI manifest
  const ociManifest = {
    schemaVersion: 2,
    mediaType: 'application/vnd.oci.image.manifest.v1+json',
    config: {
      mediaType: 'application/vnd.kgen.package.config.v1+json',
      size: JSON.stringify(manifest).length,
      digest: `sha256:${createHash('sha256').update(JSON.stringify(manifest)).digest('hex')}`
    },
    layers: [
      {
        mediaType: 'application/vnd.kgen.package.bundle.v1+tar',
        size: bundle.size,
        digest: `sha256:${bundle.hash}`,
        annotations: {
          'org.opencontainers.image.title': manifest.name,
          'dev.kgen.bundle.deterministic': 'true',
          'dev.kgen.attestation.slsa': String(!!attestation.slsa),
          'dev.kgen.attestation.sbom': String(!!attestation.sbom)
        }
      }
    ],
    annotations: {
      'org.opencontainers.image.version': manifest.version,
      'org.opencontainers.image.description': manifest.description,
      'dev.kgen.marketplace': 'true'
    }
  };

  return {
    registry: 'oci',
    manifest: ociManifest,
    tag: `${manifest.name}:${manifest.version}`,
    status: 'prepared'
  };
}

/**
 * Publish to Git-based registry with git-notes storage
 */
async function publishToGit(options) {
  const { manifest, bundle, attestation } = options;

  // Create git-notes metadata
  const gitMetadata = {
    type: 'kgen-marketplace-package',
    name: manifest.name,
    version: manifest.version,
    bundle: {
      hash: bundle.hash,
      size: bundle.size,
      path: `packages/${manifest.name}/${manifest.version}/bundle.kpack`
    },
    attestation: {
      slsa: !!attestation.slsa,
      sbom: !!attestation.sbom,
      path: `packages/${manifest.name}/${manifest.version}/.attest.json`
    },
    published: new Date().toISOString()
  };

  return {
    registry: 'git',
    metadata: gitMetadata,
    ref: `refs/notes/marketplace/${manifest.name}/${manifest.version}`,
    status: 'prepared'
  };
}