# KGEN URI Scheme Specification

## Overview

KGEN implements several specialized URI schemes for content-addressed storage, semantic patches, cryptographic attestations, and policy validation. This specification provides formal definitions and usage guidelines for autonomous agents.

## Supported URI Schemes

### 1. Content URI Scheme (`content://`)

**Format**: `content://algorithm/hash`

**Purpose**: Content-addressed storage with cryptographic integrity

**Components**:
- `algorithm`: Hash algorithm identifier
- `hash`: Hexadecimal content hash

**Supported Algorithms**:
- `sha256`: SHA-256 (64 hex characters)
- `sha512`: SHA-512 (128 hex characters) 
- `blake2b`: BLAKE2b (128 hex characters)
- `blake3`: BLAKE3 (64 hex characters)

**Examples**:
```
content://sha256/a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3
content://sha512/b109f3bbbc244eb82441917ed06d618b9008dd09b3befd1b5e07394c706a8bb980b1d7785e5976ec049b46df5f1326af5a2ea6d103fd07c95385ffab0cacbc86
```

**Validation Rules**:
1. Algorithm must be from supported list
2. Hash length must match algorithm requirements
3. Hash must contain only hexadecimal characters (0-9, a-f)
4. Case insensitive (normalized to lowercase)

**Error Codes**:
- `CONTENT_URI_INVALID_FORMAT`: URI doesn't match expected pattern
- `CONTENT_URI_UNSUPPORTED_ALGORITHM`: Algorithm not supported
- `CONTENT_URI_INVALID_HASH_LENGTH`: Hash length doesn't match algorithm
- `CONTENT_URI_INVALID_HASH_CHARS`: Non-hexadecimal characters in hash
- `CONTENT_NOT_FOUND`: Referenced content doesn't exist in storage

### 2. Drift URI Scheme (`drift://`)

**Format**: Multiple schemes supported

#### Hash-based: `drift://hash/cid`
- Direct content-addressed patch retrieval
- `cid`: Content identifier from CAS

#### Semantic: `drift://semantic/type/id`  
- Semantic change categorization
- `type`: Change type (semantic, cosmetic, structural)
- `id`: Patch identifier

#### Temporal: `drift://temporal/timestamp/id`
- Time-based patch series
- `timestamp`: ISO 8601 timestamp or Unix epoch
- `id`: Patch identifier

#### RDF: `drift://rdf/format/hash`
- RDF graph diff patches
- `format`: RDF serialization (turtle, jsonld, rdfxml)
- `hash`: Content hash

#### Canonical: `drift://canonical/cid`
- Canonical form patches
- `cid`: Content identifier

**Examples**:
```
drift://hash/QmYwAPJzv5CZsnAzt8auVLrNxgHLPMYAs
drift://semantic/structural/QmYwAPJzv5CZsnAzt8auVLrNxgHLPMYAs
drift://temporal/2024-01-01T00:00:00Z/patch-001
drift://rdf/turtle/a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3
drift://canonical/QmYwAPJzv5CZsnAzt8auVLrNxgHLPMYAs
```

**Error Codes**:
- `DRIFT_URI_INVALID_SCHEME`: Unsupported drift scheme
- `DRIFT_PATCH_NOT_FOUND`: Patch not found in storage
- `DRIFT_SEMANTIC_ANALYSIS_FAILED`: Semantic analysis error
- `DRIFT_TEMPORAL_INVALID_TIMESTAMP`: Invalid timestamp format
- `DRIFT_RDF_UNSUPPORTED_FORMAT`: Unsupported RDF serialization

### 3. Attest URI Scheme (`attest://`)

**Format**: `attest://algorithm/hash`

**Purpose**: Cryptographic attestations with digital signatures

**Components**:
- `algorithm`: Hash algorithm (sha256, sha512)
- `hash`: Hexadecimal attestation hash

**Examples**:
```
attest://sha256/b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
attest://sha512/07e547d9586f6a73f73fbac0435ed76951218fb7d0c8d788a309d785436bbb642e93a252a954f23912547d1e8a3b5ed6e1bfd7097821233fa0538f3db854fee6
```

**Validation Rules**:
1. Algorithm must be sha256 or sha512
2. Hash must be valid hexadecimal
3. Attestation must exist in storage
4. Signature verification (if enabled)
5. Timestamp validation (if present)

**Error Codes**:
- `ATTEST_URI_INVALID_FORMAT`: Malformed URI
- `ATTEST_NOT_FOUND`: Attestation not in storage
- `ATTEST_SIGNATURE_INVALID`: Digital signature verification failed
- `ATTEST_TIMESTAMP_EXPIRED`: Attestation timestamp out of valid range
- `ATTEST_INTEGRITY_FAILED`: Content integrity check failed

### 4. Policy URI Scheme (`policy://`)

**Format**: `policy://ruleId/verdict`

**Purpose**: Machine-executable governance decisions

**Components**:
- `ruleId`: Policy rule identifier
- `verdict`: Expected verdict (pass, fail, pending)

**Supported Rules**:
- `template-security`: Template security validation
- `attestation-integrity`: Attestation verification
- `compliance-audit`: Compliance checking
- `shacl-validation`: SHACL constraint validation
- `provenance-chain`: Provenance verification
- `artifact-drift`: Artifact drift detection
- `template-constraints`: Template constraint checking
- `governance-rules`: General governance rules

**Examples**:
```
policy://template-security/pass
policy://attestation-integrity/fail
policy://shacl-validation/pass
policy://compliance-audit/pending
```

**Error Codes**:
- `POLICY_URI_INVALID_FORMAT`: Malformed policy URI
- `POLICY_RULE_NOT_FOUND`: Rule not found in system
- `POLICY_EXECUTION_FAILED`: Rule execution error
- `POLICY_VERDICT_MISMATCH`: Actual verdict doesn't match expected
- `POLICY_SHACL_VALIDATION_ERROR`: SHACL validation system error

## URI Validation

### Format Validation
All URI schemes follow RFC 3986 with scheme-specific constraints:

```regex
content://    -> ^content:\/\/([a-z0-9]+)\/([a-f0-9]+)$
drift://      -> ^drift:\/\/([a-z]+)(\/[^\/]*)*(\/[^\/]+)$
attest://     -> ^attest:\/\/([a-z0-9]+)\/([a-f0-9]+)$
policy://     -> ^policy:\/\/([a-z0-9_-]+)\/(pass|fail|pending)$
```

### Content Validation
1. **Hash Algorithms**: Must match supported algorithm list
2. **Hash Length**: Must match algorithm specification
3. **Character Set**: Hexadecimal only for hashes
4. **Case Sensitivity**: Normalized to lowercase

### Security Validation
1. **Cryptographic Integrity**: Hash verification for all schemes
2. **Signature Verification**: Required for attestations (if configured)
3. **Timestamp Validation**: Age and future-date checks
4. **Access Control**: Optional issuer/signer validation

## Performance Characteristics

### Caching Behavior
- **Content URIs**: LRU cache with configurable size
- **Drift URIs**: Semantic analysis results cached
- **Attest URIs**: Verification results cached
- **Policy URIs**: Rule execution results cached

### Scalability Limits
- **Storage**: Sharded directory structure (256 shards)
- **Cache Size**: Configurable (default: 1000-5000 entries)
- **File Size**: Configurable limits per scheme
- **Concurrent Operations**: Thread-safe with atomic operations

### Resource Usage
- **Memory**: O(cache_size) for in-memory operations
- **Disk**: O(content_size) with optional compression
- **Network**: Minimal (local storage only)
- **CPU**: Hash calculation and signature verification

## Error Handling

### Error Response Format
All resolvers return consistent error objects:

```javascript
{
  success: false,
  error: {
    code: 'ERROR_CODE',
    message: 'Human-readable description',
    details: {
      uri: 'original-uri',
      timestamp: 'ISO-8601-timestamp',
      context: {}
    }
  }
}
```

### Recovery Procedures
1. **Content Not Found**: Check URI format, verify storage integrity
2. **Hash Mismatch**: Re-calculate hash, check for corruption
3. **Signature Invalid**: Verify key material, check timestamp
4. **Policy Failed**: Review rule configuration, check input data

## Integration Guidelines

### For Autonomous Agents

1. **URI Validation**: Always validate URI format before resolution
2. **Error Handling**: Implement retry logic with exponential backoff
3. **Caching**: Respect cache headers and TTL values
4. **Security**: Verify signatures and timestamps for critical operations
5. **Performance**: Use batch operations where supported

### Best Practices

1. **URI Construction**: Use provided utility functions
2. **Error Codes**: Handle all documented error conditions
3. **Timeouts**: Set appropriate timeouts for operations
4. **Logging**: Log all resolution attempts with correlation IDs
5. **Monitoring**: Track success rates and performance metrics

## Compliance Requirements

### Cryptographic Standards
- Hash algorithms: FIPS 140-2 approved
- Signatures: PKCS#1, ECDSA, Ed25519
- Key lengths: Minimum 2048-bit RSA, 256-bit EC

### Data Integrity
- All content must be verifiable via cryptographic hash
- Attestations require digital signatures in production
- Provenance chains must be unbroken and verifiable

### Audit Requirements
- All operations logged with timestamps
- Resolution attempts tracked for compliance
- Error conditions reported to audit systems

This specification provides the foundation for autonomous agent integration with KGEN's URI resolution system.