# KGEN Marketplace Registry Client

## Overview

A comprehensive, client-only registry system supporting multiple package distribution formats (NPM, OCI, Git) with built-in trust verification and security features.

## Architecture

### Core Components

1. **Abstract Adapter Interface** (`adapter.ts`)
   - Base `RegistryAdapter` class with standard operations
   - Factory pattern for pluggable registry implementations
   - Common interfaces for packages, search, and publishing

2. **NPM Registry Adapter** (`npm.ts`)
   - Full NPM v1 API compatibility
   - Tarball upload and download with integrity verification
   - Advanced search with facet filtering
   - Support for scoped packages and authentication tokens

3. **OCI Registry Adapter** (`oci.ts`)
   - Compatible with GitHub Container Registry, Docker Hub, etc.
   - Stores packages as OCI images with annotations
   - Blob upload with digest verification
   - Manifest-based metadata storage

4. **Git Registry Adapter** (`git.ts`)
   - Uses Git repositories as package registries
   - JSON index file for package discovery
   - Compressed tarball storage in Git
   - Git-based versioning and provenance

5. **Trust Verification System** (`trust.ts`)
   - Cryptographic signature verification
   - Trust policy enforcement via `trust-policy.json`
   - License validation against allowed lists
   - Package trust scoring algorithm
   - Security-focused package validation

6. **Registry Client** (`client.ts`)
   - Main client with caching and configuration
   - Multi-registry support
   - Automatic trust verification integration
   - Performance optimizations

## Features

### Registry Operations
- ✅ **Search**: Faceted search with filters (keywords, author, license)
- ✅ **Publish**: Upload packages with optional signing
- ✅ **Download**: Fetch and verify package tarballs
- ✅ **List**: Get package versions and metadata
- ✅ **Verify**: Integrity and signature verification

### Trust & Security
- ✅ **Signatures**: Ed25519, ECDSA, RSA signature support
- ✅ **Trust Policies**: Configurable trust requirements
- ✅ **License Validation**: OSI license compliance checks
- ✅ **Package Scoring**: Automated trust scoring
- ✅ **Blocklists**: Package and author blocking

### Performance
- ✅ **Caching**: In-memory LRU cache with TTL
- ✅ **Batching**: Concurrent operations support
- ✅ **Retry Logic**: Configurable retry policies
- ✅ **Streaming**: Large file handling

## Usage Examples

### Basic NPM Registry Usage

```typescript
import { createRegistryClient, REGISTRY_PRESETS } from '@kgen/marketplace';

const client = createRegistryClient({
  ...REGISTRY_PRESETS.npm,
  token: process.env.NPM_TOKEN,
});

// Search packages
const results = await client.search({
  query: 'kgen templates',
  facets: {
    keywords: ['generator', 'template'],
    license: ['MIT', 'Apache-2.0'],
  },
  limit: 10,
});

console.log(`Found ${results.total} packages`);
results.packages.forEach(pkg => {
  const trust = results.trustScores?.[`${pkg.name}@${pkg.version}`];
  console.log(`${pkg.name}@${pkg.version}: ${trust?.trusted ? 'TRUSTED' : 'UNTRUSTED'}`);
});
```

### Publishing with Attestations

```typescript
// Create package tarball
const tarball = await createPackageTarball('./my-package/');

// Generate attestation
const attestation = await TrustVerifier.createSignature(
  { name: 'my-package', version: '1.0.0' },
  privateKey,
  'my-key-id'
);

// Publish with attestation
await client.publish({
  packageJson: {
    name: 'my-package',
    version: '1.0.0',
    description: 'My awesome package',
    license: 'MIT',
  },
  tarball,
  attestations: [attestation],
});
```

### OCI Registry Usage

```typescript
const ociClient = createRegistryClient({
  type: 'oci',
  registry: 'ghcr.io',
  token: process.env.GITHUB_TOKEN,
  scope: 'my-org',
});

// Publish to GitHub Container Registry
await ociClient.publish({
  packageJson: {
    name: 'my-org/my-package',
    version: '1.0.0',
  },
  tarball,
});
```

### Git Registry Usage

```typescript
const gitClient = createRegistryClient({
  type: 'git',
  registry: 'https://github.com/my-org/package-registry.git',
});

// Search git registry
const results = await gitClient.search({
  query: 'template',
  facets: { keywords: ['generator'] },
});
```

### Trust Policy Configuration

```json
{
  "version": "1.0.0",
  "trustedKeys": [
    {
      "keyId": "my-signing-key",
      "algorithm": "RSA-SHA256",
      "publicKey": "-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----",
      "owner": "my-organization",
      "scope": ["@my-org"]
    }
  ],
  "requireSignature": true,
  "allowedLicenses": ["MIT", "Apache-2.0"],
  "blockedPackages": ["malicious-package"],
  "minimumTrustScore": 70,
  "policies": [
    {
      "scope": "@my-org",
      "requireAttestation": true,
      "minimumSignatures": 1
    }
  ]
}
```

## Configuration

### Registry Presets

```typescript
export const REGISTRY_PRESETS = {
  npm: {
    type: 'npm',
    registry: 'https://registry.npmjs.org',
  },
  github: {
    type: 'oci',
    registry: 'ghcr.io',
  },
  dockerHub: {
    type: 'oci',
    registry: 'registry-1.docker.io',
  },
  gitHub: {
    type: 'git',
    registry: 'https://github.com/your-org/registry.git',
  },
};
```

### Client Configuration

```typescript
const client = createRegistryClient({
  type: 'npm',
  registry: 'https://registry.npmjs.org',
  token: process.env.NPM_TOKEN,
  
  // Trust settings
  enableTrustVerification: true,
  trustPolicyPath: './trust-policy.json',
  
  // Performance settings
  cacheEnabled: true,
  cacheTtl: 300000, // 5 minutes
  timeout: 30000,
  retries: 3,
});
```

## File Structure

```
packages/kgen-marketplace/src/registry/
├── adapter.ts      # Abstract interface & factory
├── npm.ts          # NPM registry implementation  
├── oci.ts          # OCI registry implementation
├── git.ts          # Git registry implementation
├── client.ts       # Main registry client
├── trust.ts        # Trust verification system
├── examples.ts     # Usage examples
└── index.ts        # Public exports
```

## Key Benefits

- **Client-Only**: No server infrastructure required
- **Multi-Registry**: Support for npm, OCI, Git registries
- **Trust-First**: Built-in signature verification and trust policies
- **Performance**: Caching, retries, and optimization
- **Type-Safe**: Full TypeScript support with strict typing
- **Extensible**: Pluggable adapter architecture
- **Secure**: Package integrity verification and security scanning

## Integration with KGEN

The registry client integrates seamlessly with the broader KGEN ecosystem:

- **Knowledge Packs**: Distribute KGEN knowledge packs via any registry
- **Provenance**: Track package origins and modifications
- **Trust Scoring**: Automated quality and security assessment
- **Content Addressing**: Immutable package identification
- **Semantic Search**: Ontology-driven package discovery

## Security Considerations

- All package downloads are verified for integrity
- Cryptographic signatures validate package authenticity
- Trust policies enforce organizational security requirements
- License compliance prevents legal issues
- Blocklists protect against known malicious packages
- Rate limiting prevents abuse

This registry client provides a foundation for secure, scalable package distribution in the KGEN ecosystem.