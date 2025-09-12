# Git URI Integration for KGEN

## Overview

The Git URI integration provides a git:// URI scheme for resolving git objects and file content with built-in attestation and provenance tracking. This enables content-addressable artifact retrieval directly from git repositories with full traceability.

## Git URI Scheme Format

### Basic Syntax
```
git://<repository>@<object-id>[/<filepath>]
```

### URI Types

1. **Raw Git Object**
   ```
   git://myrepo@abc123def456789012345678901234567890abcd
   ```
   Returns the raw git blob content.

2. **File Content**
   ```
   git://myrepo@abc123def456789012345678901234567890abcd/src/index.js
   ```
   Returns file content from a git tree object.

3. **Tree Listing**
   ```
   git://myrepo@abc123def456789012345678901234567890abcd/tree
   ```
   Returns directory listing from a git tree object.

4. **Git Notes (Attestations)**
   ```
   git://myrepo@abc123def456789012345678901234567890abcd/.notes
   ```
   Returns attestation data stored in git notes.

## Components

### GitUriResolver

The core resolver for git:// URIs with caching and attestation support.

```javascript
import { GitUriResolver } from '@kgen/core/resolvers/git-uri-resolver';

const resolver = new GitUriResolver({
  allowRemoteRepos: true,
  cacheDir: '.kgen/git-cache',
  enableAttestation: true
});

await resolver.initialize();
```

#### Methods

- `resolve(uri)` - Resolve git URI to content
- `attachAttestation(objectSha, attestationData)` - Attach attestation via git notes
- `getAttestations(objectSha)` - Retrieve attestations for object
- `validateGitUri(uri)` - Validate URI format
- `createGitUri(dir, oid, filepath)` - Create URI from components

### GitProvenanceIntegration

Integrates URI resolution with provenance tracking system.

```javascript
import { GitProvenanceIntegration } from '@kgen/core/provenance/git-integration';

const integration = new GitProvenanceIntegration({
  enableUriResolution: true,
  enableAttestations: true,
  autoTrackGeneration: true
});
```

#### Methods

- `resolveWithProvenance(uri)` - Resolve URI with provenance tracking
- `generateFromGitUri(templateUri, context, outputPath)` - Generate from git template
- `attachAttestationWithProvenance(objectSha, attestation)` - Enhanced attestation
- `getArtifactInfo(identifier)` - Comprehensive artifact information

### Git Workflow Integration

Complete workflow with integrated operations.

```javascript
import { createGitFirstWorkflow } from '@kgen/core/git';

const workflow = createGitFirstWorkflow({
  enableContentAddressing: true,
  enableAttestation: true
});

await workflow.initialize();
```

## Usage Examples

### Basic URI Resolution

```javascript
// Resolve file content from git URI
const result = await resolver.resolve(
  'git://templates@abc123def456789012345678901234567890abcd/component.njk'
);

console.log(result.content); // Template content
console.log(result.sha);     // Object SHA
console.log(result.type);    // 'file'
```

### Template Generation from Git URI

```javascript
// Generate artifact from git template
const generation = await integration.generateFromGitUri(
  'git://templates@def456abc789012345678901234567890abcd123/api-route.js',
  { 
    name: 'UserController',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  },
  './src/controllers/user.js'
);

console.log(generation.success);       // true
console.log(generation.templateUri);   // Original template URI
console.log(generation.provenance);    // Full provenance data
```

### Attestation Management

```javascript
// Attach code review attestation
await resolver.attachAttestation(objectSha, {
  type: 'CodeReview',
  reviewer: 'senior-dev@company.com',
  status: 'approved',
  timestamp: new Date().toISOString(),
  comments: 'Security review passed, performance optimized'
});

// Retrieve all attestations
const attestations = await resolver.getAttestations(objectSha);
console.log(attestations.attestations); // Array of attestations
```

### Provenance-Enhanced Resolution

```javascript
// Resolve with full provenance tracking
const result = await integration.resolveWithProvenance(
  'git://artifacts@789abc123def456789012345678901234567890/generated.json',
  { trackAccess: true }
);

console.log(result.provenanceIntegrated); // true
console.log(result.existingProvenance);   // Previous provenance if available
console.log(result.provenanceActivity);   // New resolution activity
```

## Attestation Types

### Code Review Attestation
```javascript
{
  type: 'CodeReview',
  reviewer: 'reviewer@company.com',
  status: 'approved' | 'rejected' | 'changes-requested',
  timestamp: '2024-01-01T12:00:00Z',
  comments: 'Review comments',
  checklist: {
    security: true,
    performance: true,
    maintainability: true
  }
}
```

### Security Scan Attestation
```javascript
{
  type: 'SecurityScan',
  scanner: 'security-tool-v1.0',
  status: 'clean' | 'vulnerable',
  timestamp: '2024-01-01T12:00:00Z',
  findings: [],
  score: 95
}
```

### Quality Check Attestation
```javascript
{
  type: 'QualityCheck',
  tool: 'eslint',
  version: '8.0.0',
  score: 98,
  issues: 2,
  warnings: 5,
  timestamp: '2024-01-01T12:00:00Z'
}
```

## Provenance Integration

### Automatic Tracking

When `autoTrackGeneration` is enabled, the system automatically tracks:

- URI resolution activities
- Template generation processes
- Attestation attachments
- Artifact relationships

### PROV-O Compliance

All provenance data follows PROV-O vocabulary:

```json
{
  "@context": "http://www.w3.org/ns/prov#",
  "@id": "kgen:resolution-abc123",
  "@type": "prov:Activity",
  "prov:used": {
    "@type": "prov:Entity",
    "kgen:gitUri": "git://templates@def456.../template.njk",
    "kgen:resolvedSha": "def456...",
    "kgen:resolvedType": "file"
  },
  "prov:wasAssociatedWith": {
    "@type": "prov:Agent",
    "kgen:agent": "GitUriResolver"
  },
  "prov:startedAtTime": "2024-01-01T12:00:00Z"
}
```

## Configuration Options

### GitUriResolver Options

```javascript
{
  allowRemoteRepos: true,        // Allow remote repository access
  cacheDir: '.kgen/git-cache',   // Cache directory
  enableAttestation: true,       // Enable attestation features
  cacheMaxAge: 300000,          // Cache expiry (5 minutes)
  author: {                      // Git author for operations
    name: 'KGEN System',
    email: 'kgen@system.local'
  }
}
```

### GitProvenanceIntegration Options

```javascript
{
  enableUriResolution: true,     // Enable URI resolution
  enableAttestations: true,      // Enable attestation integration
  autoTrackGeneration: true,     // Auto-track all activities
  repoPath: process.cwd(),      // Repository path
  notesRef: 'refs/notes/kgen-provenance' // Git notes reference
}
```

## Performance Considerations

### Caching

- URI resolution results are cached for 5 minutes by default
- Cache can be cleared manually via `resolver.clearCache()`
- Cache statistics available via `resolver.getStats()`

### Git Operations

- Uses isomorphic-git and simple-git for optimal performance
- Windows filesystem optimizations with hardlink caching
- Blob-based content addressing for efficient storage

### Metrics

```javascript
const stats = workflow.getPerformanceStats();
console.log(stats.git.operationsCount);
console.log(stats.git.averageTime);
console.log(stats.integration.resolver.cacheSize);
```

## Error Handling

### URI Format Validation

```javascript
const validation = resolver.validateGitUri(uri);
if (!validation.valid) {
  console.error('Invalid URI:', validation.error);
}
```

### Resolution Errors

```javascript
try {
  const result = await resolver.resolve(uri);
} catch (error) {
  if (error.message.includes('not found')) {
    // Handle missing object
  } else if (error.message.includes('Invalid git URI')) {
    // Handle malformed URI
  }
}
```

### Attestation Errors

```javascript
try {
  await resolver.attachAttestation(sha, attestation);
} catch (error) {
  if (error.message.includes('Attestation data must be an object')) {
    // Handle invalid attestation format
  }
}
```

## Testing

Comprehensive test suite covers:

- URI parsing and validation
- Object resolution (blob, file, tree, notes)
- Attestation attachment and retrieval
- Provenance integration
- Caching behavior
- Error conditions

```bash
npm test -- tests/integration/git-uri-resolver.test.js
```

## Security Considerations

### Repository Access

- Repository access is controlled via `allowRemoteRepos` option
- Local repository operations are sandboxed
- Git notes are stored in separate namespace

### Attestation Integrity

- Attestations include cryptographic hashes
- Provenance context prevents tampering
- Timestamp validation for temporal integrity

### Content Addressing

- Git SHA-based content addressing ensures integrity
- Blob verification prevents content modification
- Chain validation for multi-step processes

## CLI Integration

The git URI integration is exposed through CLI commands:

```bash
# Resolve git URI
kgen git-artifact resolve git://repo@sha/file.txt

# Generate from git template
kgen git-artifact generate git://templates@sha/component.njk --context data.json

# Attach attestation
kgen git-artifact attest <object-sha> --type CodeReview --data review.json

# Get artifact info
kgen git-artifact info <sha-or-uri> --verify-integrity
```

## Future Enhancements

1. **Remote Repository Support**
   - Fetch objects from remote git repositories
   - Authentication and authorization integration
   - Distributed attestation networks

2. **Advanced Caching**
   - Persistent cache with LRU eviction
   - Distributed cache for team environments
   - Cache warming and preloading

3. **Enhanced Attestation**
   - Digital signatures for attestations
   - Multi-party attestation workflows
   - Attestation policy enforcement

4. **Performance Optimization**
   - Parallel object resolution
   - Streaming for large objects
   - Delta compression for updates