# KGEN Resolver Error Codes and Troubleshooting Guide

## Overview

This document provides comprehensive error codes, diagnostic information, and troubleshooting procedures for all KGEN resolver modules. Each error includes actionable remediation steps for autonomous agents.

## Error Code Format

```
RESOLVER_OPERATION_ERROR_TYPE
```

- **RESOLVER**: Module name (PATH, CONTENT, DRIFT, ATTEST, POLICY)
- **OPERATION**: Specific operation (RESOLVE, STORE, VALIDATE, etc.)
- **ERROR_TYPE**: Error category (INVALID, NOT_FOUND, FAILED, etc.)

## PathResolver Errors

### PATH_RESOLVE_INVALID_FORMAT
**Description**: Path template contains invalid syntax or references  
**Causes**:
- Malformed Nunjucks template syntax
- Undefined template variables
- Circular variable references

**Example**:
```javascript
{
  code: 'PATH_RESOLVE_INVALID_FORMAT',
  message: 'Path template contains undefined variable: {{invalidVar}}',
  details: {
    template: 'src/{{invalidVar}}/{{name}}.js',
    undefinedVars: ['invalidVar'],
    context: { name: 'component' }
  }
}
```

**Resolution**:
1. Check template syntax using Nunjucks validator
2. Ensure all variables are defined in context
3. Use `{{ var | default('fallback') }}` for optional variables

### PATH_RESOLVE_CONFLICT_DETECTED
**Description**: Multiple operations attempt to use the same output path  
**Causes**:
- Race conditions in concurrent operations
- Duplicate template configurations
- Path normalization issues

**Example**:
```javascript
{
  code: 'PATH_RESOLVE_CONFLICT_DETECTED',
  message: 'Path conflict detected: src/components/Button.js',
  details: {
    conflictingOperations: ['op_123', 'op_456'],
    path: 'src/components/Button.js',
    similarPaths: [
      { path: 'src/components/button.js', similarity: 0.95 }
    ]
  }
}
```

**Resolution**:
1. Review template configurations for duplicates
2. Implement unique identifiers in path templates
3. Enable conflict detection and handle appropriately

### PATH_RESOLVE_VALIDATION_FAILED
**Description**: Generated path violates system constraints  
**Causes**:
- Path length exceeds maximum
- Contains invalid characters
- Uses reserved filenames

**Example**:
```javascript
{
  code: 'PATH_RESOLVE_VALIDATION_FAILED',
  message: 'Path length exceeds maximum: 280 > 260',
  details: {
    path: 'very/long/path/that/exceeds/the/maximum/allowed/length...',
    actualLength: 280,
    maxLength: 260,
    violations: ['PATH_TOO_LONG', 'INVALID_CHARACTERS']
  }
}
```

**Resolution**:
1. Shorten path templates or variable values
2. Remove invalid characters (< > : " | ? *)
3. Avoid reserved names (CON, PRN, AUX, etc.)

## ContentUriResolver Errors

### CONTENT_URI_INVALID_FORMAT
**Description**: URI doesn't match expected content:// format  
**Causes**:
- Incorrect URI scheme
- Missing or malformed components
- Invalid character encoding

**Example**:
```javascript
{
  code: 'CONTENT_URI_INVALID_FORMAT',
  message: 'Invalid content URI format: content://sha256/invalid-hash!',
  details: {
    uri: 'content://sha256/invalid-hash!',
    expectedFormat: 'content://algorithm/hash',
    issues: ['INVALID_HASH_CHARACTERS']
  }
}
```

**Resolution**:
1. Verify URI follows `content://algorithm/hash` format
2. Ensure hash contains only hexadecimal characters
3. Check algorithm is supported (sha256, sha512, blake2b, blake3)

### CONTENT_NOT_FOUND
**Description**: Referenced content doesn't exist in CAS storage  
**Causes**:
- Content never stored
- Storage corruption
- Incorrect hash calculation

**Example**:
```javascript
{
  code: 'CONTENT_NOT_FOUND',
  message: 'Content not found for hash: abc123...',
  details: {
    uri: 'content://sha256/abc123...',
    searchedPaths: [
      '/cas/ab/abc123...',
      '/cas/ab/abc123....js',
      '/cas/ab/abc123....json'
    ],
    storageIntegrity: true
  }
}
```

**Resolution**:
1. Verify content was successfully stored
2. Check CAS storage integrity
3. Ensure correct hash algorithm and calculation

### CONTENT_INTEGRITY_FAILED
**Description**: Stored content doesn't match expected hash  
**Causes**:
- Storage corruption
- Hash collision (extremely rare)
- Tampering or modification

**Example**:
```javascript
{
  code: 'CONTENT_INTEGRITY_FAILED',
  message: 'Content integrity verification failed',
  details: {
    uri: 'content://sha256/expected123...',
    expectedHash: 'expected123...',
    actualHash: 'actual456...',
    algorithm: 'sha256',
    contentSize: 1024
  }
}
```

**Resolution**:
1. Re-verify content hash independently
2. Check for storage system corruption
3. Restore from backup if available

### CONTENT_STORAGE_FULL
**Description**: Insufficient storage space for content  
**Causes**:
- Disk space exhausted
- Inode limit reached
- Quota restrictions

**Example**:
```javascript
{
  code: 'CONTENT_STORAGE_FULL',
  message: 'Insufficient storage space: 95% full',
  details: {
    storageDir: '/cas',
    availableBytes: 52428800, // 50MB
    requiredBytes: 104857600, // 100MB
    usagePercent: 95
  }
}
```

**Resolution**:
1. Free disk space or expand storage
2. Implement cleanup policies for old content
3. Enable compression to reduce space usage

## AttestResolver Errors

### ATTEST_SIGNATURE_INVALID
**Description**: Digital signature verification failed  
**Causes**:
- Wrong public key used
- Signature corruption
- Modified attestation content

**Example**:
```javascript
{
  code: 'ATTEST_SIGNATURE_INVALID',
  message: 'Signature verification failed: key mismatch',
  details: {
    uri: 'attest://sha256/abc123...',
    signatureAlgorithm: 'RSA-SHA256',
    keyId: 'key_789',
    errorDetails: 'Public key does not match signature'
  }
}
```

**Resolution**:
1. Verify correct public key is being used
2. Check signature wasn't corrupted during transmission
3. Ensure attestation content wasn't modified

### ATTEST_TIMESTAMP_EXPIRED
**Description**: Attestation timestamp is outside valid range  
**Causes**:
- Attestation too old
- Clock skew between systems
- Expired certificate/key

**Example**:
```javascript
{
  code: 'ATTEST_TIMESTAMP_EXPIRED',
  message: 'Attestation timestamp expired: 400 days old',
  details: {
    timestamp: '2023-01-01T00:00:00Z',
    currentTime: '2024-02-05T12:00:00Z',
    maxAgeMs: 31536000000, // 1 year
    actualAgeMs: 34560000000 // 400 days
  }
}
```

**Resolution**:
1. Check system clock synchronization
2. Verify attestation creation time
3. Adjust maxAge configuration if appropriate

### ATTEST_CRYPTOGRAPHIC_ERROR
**Description**: Cryptographic operation failed  
**Causes**:
- Unsupported algorithm
- Malformed key material
- Insufficient entropy

**Example**:
```javascript
{
  code: 'ATTEST_CRYPTOGRAPHIC_ERROR',
  message: 'Unsupported signature algorithm: RSA-SHA1',
  details: {
    requestedAlgorithm: 'RSA-SHA1',
    supportedAlgorithms: ['RSA-SHA256', 'RSA-SHA512', 'ECDSA'],
    securityReason: 'SHA1 deprecated due to collision vulnerabilities'
  }
}
```

**Resolution**:
1. Use supported cryptographic algorithms
2. Verify key format and validity
3. Update deprecated algorithms

## DriftURIResolver Errors

### DRIFT_PATCH_CORRUPT
**Description**: Patch data is corrupted or invalid  
**Causes**:
- Storage corruption
- Incomplete write operation
- Invalid patch format

**Example**:
```javascript
{
  code: 'DRIFT_PATCH_CORRUPT',
  message: 'Patch data corrupted: JSON parse error',
  details: {
    uri: 'drift://hash/QmXYZ...',
    error: 'Unexpected token at position 45',
    patchSize: 2048,
    expectedFormat: 'jsondiffpatch'
  }
}
```

**Resolution**:
1. Re-create patch from source data
2. Verify storage system integrity
3. Check patch generation process

### DRIFT_SEMANTIC_ANALYSIS_FAILED
**Description**: Semantic analysis couldn't complete  
**Causes**:
- Insufficient data for analysis
- Analysis timeout
- Resource constraints

**Example**:
```javascript
{
  code: 'DRIFT_SEMANTIC_ANALYSIS_FAILED',
  message: 'Semantic analysis timeout after 30000ms',
  details: {
    baseline: { size: 1048576, type: 'json' },
    current: { size: 1048576, type: 'json' },
    timeout: 30000,
    analysisType: 'structural'
  }
}
```

**Resolution**:
1. Increase analysis timeout
2. Reduce data complexity
3. Check system resources

## PolicyURIResolver Errors

### POLICY_SHACL_VALIDATION_FAILED
**Description**: SHACL validation couldn't complete  
**Causes**:
- Invalid SHACL shapes
- Malformed data graph
- Resource constraints

**Example**:
```javascript
{
  code: 'POLICY_SHACL_VALIDATION_FAILED',
  message: 'SHACL validation error: invalid shape definition',
  details: {
    policyURI: 'policy://template-security/pass',
    shapesPath: './shapes/security.ttl',
    validationError: 'sh:targetClass not defined',
    lineNumber: 25
  }
}
```

**Resolution**:
1. Validate SHACL shapes syntax
2. Ensure data graph is well-formed
3. Check shape definitions are complete

### POLICY_RULE_NOT_FOUND
**Description**: Referenced policy rule doesn't exist  
**Causes**:
- Incorrect rule identifier
- Missing rule file
- Path configuration error

**Example**:
```javascript
{
  code: 'POLICY_RULE_NOT_FOUND',
  message: 'Policy rule not found: custom-validation',
  details: {
    ruleId: 'custom-validation',
    expectedPath: './rules/custom-validation.ttl',
    searchedPaths: [
      './rules/custom-validation.ttl',
      './rules/custom-validation.json'
    ]
  }
}
```

**Resolution**:
1. Verify rule file exists at expected path
2. Check rule identifier spelling
3. Ensure proper file permissions

## Troubleshooting Procedures

### Diagnostic Commands

```bash
# Check resolver configuration
kgen diagnose --resolver=all

# Verify storage integrity
kgen verify-storage --cas-dir=./.cas

# Test URI resolution
kgen test-uri content://sha256/abc123...

# Validate SHACL shapes
kgen validate-shapes --shapes-dir=./shapes
```

### Common Resolution Steps

1. **Verify Configuration**:
   - Check all paths exist and are accessible
   - Validate configuration syntax
   - Test with minimal configuration

2. **Check Permissions**:
   - Ensure read/write access to storage directories
   - Verify user permissions for key files
   - Check SELinux/AppArmor restrictions

3. **Validate Dependencies**:
   - Confirm all required modules are installed
   - Check version compatibility
   - Test with updated dependencies

4. **Monitor Resources**:
   - Check disk space availability
   - Monitor memory usage patterns
   - Verify CPU capacity for crypto operations

5. **Review Logs**:
   - Enable debug logging
   - Check system event logs
   - Monitor application metrics

### Recovery Procedures

#### Storage Recovery
```bash
# Backup current state
tar -czf backup-$(date +%Y%m%d).tar.gz .kgen/

# Verify storage integrity
find .kgen/cas -name "*.json" -exec jq . {} \; > /dev/null

# Rebuild indices
kgen rebuild-index --cas-dir=./.kgen/cas
```

#### Configuration Recovery
```bash
# Generate default configuration
kgen init-config --output=kgen.config.js

# Validate configuration
kgen validate-config --config=kgen.config.js

# Test configuration
kgen test-config --dry-run
```

## Error Monitoring and Alerting

### Key Metrics to Monitor

1. **Error Rates**: Track errors per resolver type
2. **Response Times**: Monitor resolution latency
3. **Storage Health**: Track disk usage and integrity
4. **Cache Performance**: Monitor hit rates and efficiency
5. **Security Events**: Track verification failures

### Recommended Alerts

- Error rate > 5% for any resolver
- Storage usage > 90%
- Cache hit rate < 70%
- Signature verification failures
- Policy validation failures > 10%

### Integration with Monitoring Systems

```javascript
// Example monitoring integration
import { createResolverMetrics } from '@kgen/monitoring';

const metrics = createResolverMetrics({
  endpoint: 'http://prometheus:9090',
  interval: 30000
});

// Automatic error tracking
resolver.on('error', (error) => {
  metrics.recordError(error.code, error.resolver);
});
```

This troubleshooting guide provides comprehensive error handling and diagnostic procedures for autonomous agent integration with KGEN resolver systems.