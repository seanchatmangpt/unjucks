# KGEN Resolver Configuration Guide

## Overview

This guide provides comprehensive configuration options for all KGEN resolver modules, including security implications, performance tuning, and autonomous agent integration patterns.

## PathResolver Configuration

### Constructor Options

```javascript
new PathResolver({
  // Core Settings
  deterministic: true,              // Enable deterministic path resolution
  enableConflictDetection: true,    // Detect path conflicts
  baseDirectory: process.cwd(),     // Base directory for relative paths
  allowAbsolutePaths: false,        // Allow absolute path resolution
  
  // Path Constraints
  maxPathLength: 260,               // Maximum path length (Windows compatibility)
  pathSeparator: path.sep,          // Path separator (OS-specific)
  
  // Security Settings
  reservedNames: ['CON', 'PRN', ...], // Reserved filenames to reject
  
  // Performance Settings
  cacheSize: 5000,                  // Number of cached path resolutions
  useCache: true                    // Enable result caching
})
```

### Security Implications

- **allowAbsolutePaths**: 
  - `false` (default): Prevents path traversal attacks
  - `true`: Allows absolute paths - **SECURITY RISK** in untrusted environments

- **reservedNames**: 
  - Blocks Windows reserved names (CON, PRN, AUX, etc.)
  - Prevents filesystem conflicts
  - Should not be modified unless necessary

- **maxPathLength**:
  - Prevents buffer overflow attacks
  - Windows MAX_PATH limitation
  - Linux typically supports 4096 characters

### Performance Tuning

- **deterministic**: 
  - `true`: Consistent results, better caching
  - `false`: Slight performance improvement, less predictable

- **cacheSize**: 
  - Higher values: Better performance, more memory usage
  - Lower values: Less memory, more computation
  - Recommended: 1000-10000 depending on usage patterns

## ContentUriResolver Configuration

### Constructor Options

```javascript
new ContentUriResolver({
  // Storage Settings
  casDir: '.kgen/cas',              // CAS storage directory
  enableHardlinks: true,            // Create hardlinks for efficiency
  enableExtensionPreservation: true, // Preserve file extensions
  
  // Integrity Settings
  enableDriftDetection: false,      // Detect content drift
  integrityChecks: true,            // Verify content integrity
  
  // Performance Settings
  cacheSize: 5000,                  // Content cache size
  compressionEnabled: false,        // Enable content compression
  
  // Security Settings
  maxContentSize: 100 * 1024 * 1024, // Max content size (100MB)
  allowedExtensions: null,          // Whitelist of allowed extensions
  hashAlgorithm: 'sha256'           // Default hash algorithm
})
```

### Security Implications

- **casDir**: 
  - Should be outside web-accessible directories
  - Requires write permissions
  - Consider disk space and backup implications

- **enableHardlinks**: 
  - `true`: Space-efficient but creates filesystem dependencies
  - `false`: Uses more disk space but safer for distributed systems

- **integrityChecks**: 
  - `true` (recommended): Verifies content hasn't been tampered with
  - `false`: Performance improvement but **SECURITY RISK**

- **maxContentSize**: 
  - Prevents DoS attacks via large file uploads
  - Should be set based on expected content size
  - Consider available disk space

### Performance Tuning

- **cacheSize**: 
  - Stores frequently accessed content metadata
  - Memory usage: ~1KB per cached item
  - Recommended: 1000-10000

- **compressionEnabled**: 
  - Reduces storage space for text content
  - Increases CPU usage for compression/decompression
  - Threshold-based (default: 1KB)

- **enableDriftDetection**: 
  - Detects if stored content has changed
  - Adds computational overhead
  - Enable only if content integrity is critical

## AttestResolver Configuration

### Constructor Options

```javascript
new AttestResolver({
  // Storage Settings
  storageDir: '.attest-store',      // Attestation storage directory
  
  // Cache Settings
  cacheSize: 1000,                  // Attestation cache size
  
  // Security Settings
  verificationEnabled: true,        // Enable cryptographic verification
  requireSignature: false,          // Require digital signatures
  trustedIssuers: [],              // List of trusted attestation issuers
  
  // Validation Settings
  maxAttestationSize: 10 * 1024 * 1024, // Max attestation size (10MB)
  maxAge: 365 * 24 * 60 * 60 * 1000,    // Max attestation age (1 year)
  
  // Cryptographic Settings
  supportedAlgorithms: ['sha256', 'sha512'], // Supported hash algorithms
  signatureAlgorithms: ['RSA-SHA256', 'ECDSA'], // Supported signature algorithms
  minKeySize: 2048,                 // Minimum RSA key size
  
  // Performance Settings
  compressionEnabled: true,         // Enable attestation compression
  compressionThreshold: 1024        // Compression threshold (1KB)
})
```

### Security Implications

- **verificationEnabled**: 
  - `true` (recommended): Full cryptographic verification
  - `false`: **CRITICAL SECURITY RISK** - disables all verification

- **requireSignature**: 
  - `true`: All attestations must be digitally signed
  - `false`: Allows unsigned attestations - consider threat model

- **trustedIssuers**: 
  - Empty array: Accept attestations from any issuer
  - Populated: Only accept from specified issuers (recommended)

- **maxAge**: 
  - Prevents replay attacks with old attestations
  - Should align with your security policy
  - Consider certificate renewal cycles

- **minKeySize**: 
  - 2048 bits minimum for RSA (recommended: 3072+)
  - 256 bits minimum for ECDSA
  - Should follow current cryptographic standards

### Cryptographic Configuration

- **supportedAlgorithms**: 
  - `sha256`: Minimum recommended
  - `sha512`: Higher security, slightly slower
  - Avoid `md5`, `sha1` (deprecated)

- **signatureAlgorithms**: 
  - `RSA-SHA256`: Widely supported, good security
  - `ECDSA`: Smaller signatures, faster verification
  - `Ed25519`: Modern, high-performance option

## DriftURIResolver Configuration

### Constructor Options

```javascript
new DriftURIResolver({
  // Storage Settings
  storage: {
    patchDirectory: '.kgen/patches', // Patch storage directory
    maxPatchSize: 1024 * 1024,      // Maximum patch size (1MB)
    compressionThreshold: 1024,      // Compression threshold (1KB)
    retentionDays: 30               // Patch retention period
  },
  
  // Performance Settings
  performance: {
    cachePatches: true,             // Cache patch data
    enableCompression: true,        // Enable patch compression
    batchSize: 10                   // Batch processing size
  },
  
  // Semantic Analysis Settings
  semanticAnalysis: {
    enableSemanticAnalysis: true,   // Enable semantic change analysis
    semanticThreshold: 0.1,         // Significance threshold
    enableSHACLValidation: true,    // Enable SHACL validation
    enableCAS: true                 // Enable CAS integration
  }
})
```

### Configuration Categories

- **Storage Configuration**: 
  - Controls patch storage location and limits
  - Retention policies for cleanup
  - Compression settings for space efficiency

- **Performance Configuration**: 
  - Caching strategies for better response times
  - Batch processing for bulk operations
  - Compression trade-offs (space vs. CPU)

- **Analysis Configuration**: 
  - Semantic analysis sensitivity
  - Integration with validation systems
  - Content-addressed storage options

## PolicyURIResolver Configuration

### Constructor Options

```javascript
new PolicyURIResolver({
  // Path Settings
  shapesPath: './src/kgen/validation/shapes', // SHACL shapes directory
  rulesPath: './rules',             // Custom rules directory
  policiesPath: './policies',       // Policy definitions directory
  auditPath: './.kgen/audit',      // Audit trail storage
  
  // Validation Settings
  enableVerdictTracking: true,      // Track policy verdicts
  strictMode: true,                 // Strict policy enforcement
  
  // SHACL Engine Settings
  timeout: 30000,                   // Validation timeout (30s)
  includeDetails: true,             // Include detailed violation reports
  exitOnFailure: false,             // Continue processing after failures
  
  // Audit Settings
  auditFormat: 'json',              // Audit trail format (json, csv)
  maxAuditEntries: 10000,          // Maximum audit entries
  auditRetentionDays: 90           // Audit retention period
})
```

### Policy Configuration Best Practices

1. **Directory Structure**: 
   - Keep shapes, rules, and policies in separate directories
   - Use version control for policy changes
   - Implement policy review processes

2. **Timeout Settings**: 
   - Set appropriate timeouts for complex validations
   - Consider system resources and response time requirements
   - Monitor timeout occurrences

3. **Audit Configuration**: 
   - Enable comprehensive auditing for compliance
   - Set appropriate retention periods
   - Consider audit log size and storage requirements

## Environment Variables

### Global Settings
```bash
# Storage Locations
KGEN_CAS_DIR=/path/to/cas/storage
KGEN_ATTEST_DIR=/path/to/attestation/storage
KGEN_AUDIT_DIR=/path/to/audit/storage

# Security Settings
KGEN_REQUIRE_SIGNATURES=true
KGEN_ENABLE_VERIFICATION=true
KGEN_MAX_CONTENT_SIZE=104857600

# Performance Settings
KGEN_CACHE_SIZE=5000
KGEN_ENABLE_COMPRESSION=true
KGEN_BATCH_SIZE=10

# Debugging
KGEN_DEBUG=true
KGEN_LOG_LEVEL=info
KGEN_ENABLE_METRICS=true
```

### Security Environment Variables
```bash
# Cryptographic Settings
KGEN_MIN_KEY_SIZE=2048
KGEN_HASH_ALGORITHM=sha256
KGEN_SIGNATURE_ALGORITHM=RSA-SHA256

# Access Control
KGEN_TRUSTED_ISSUERS=issuer1,issuer2,issuer3
KGEN_REQUIRE_ATTESTATION=true

# Validation Settings
KGEN_SHACL_TIMEOUT=30000
KGEN_STRICT_VALIDATION=true
```

## Configuration Validation

### Validation Utilities

```javascript
// Validate resolver configuration
import { validateResolverConfig } from '@kgen/config-validator';

const config = {
  casDir: './.cas',
  verificationEnabled: true,
  cacheSize: 5000
};

const validation = validateResolverConfig(config);
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}
```

### Common Configuration Errors

1. **Invalid Paths**: 
   - Non-existent directories
   - Permission issues
   - Path traversal attempts

2. **Security Misconfigurations**: 
   - Disabled verification in production
   - Weak cryptographic settings
   - Overly permissive access controls

3. **Performance Issues**: 
   - Cache sizes too large for available memory
   - Timeouts too short for complex operations
   - Compression settings inappropriate for content type

## Production Deployment Guidelines

### Security Checklist

- [ ] Enable cryptographic verification
- [ ] Set appropriate content size limits
- [ ] Configure trusted issuer lists
- [ ] Enable comprehensive auditing
- [ ] Use strong cryptographic algorithms
- [ ] Set appropriate timeout values
- [ ] Validate all configuration options

### Performance Optimization

1. **Cache Configuration**: 
   - Size caches based on available memory
   - Monitor cache hit rates
   - Implement cache warming for critical content

2. **Storage Optimization**: 
   - Use SSD storage for better performance
   - Configure appropriate file system (ext4, XFS)
   - Implement regular cleanup procedures

3. **Monitoring**: 
   - Track resolution response times
   - Monitor error rates and types
   - Set up alerts for configuration issues

### Scalability Considerations

1. **Horizontal Scaling**: 
   - Use shared storage for multi-instance deployments
   - Implement distributed caching if needed
   - Consider load balancing for high-traffic scenarios

2. **Vertical Scaling**: 
   - Size memory based on cache requirements
   - Ensure adequate disk space for storage
   - Monitor CPU usage for cryptographic operations

This configuration guide provides the foundation for secure, performant, and reliable resolver deployments in production environments.