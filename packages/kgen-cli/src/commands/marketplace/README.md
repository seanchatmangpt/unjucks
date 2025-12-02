# KGEN Marketplace Install Command

## Overview

The `kgen marketplace install` command provides secure installation of KPacks from configured registries with full cryptographic verification. This implementation follows zero-trust security principles and ensures complete integrity verification of all installed packages.

## Features

### 🔐 Cryptographic Verification
- **JWS Signature Verification**: Supports RS256, RS384, RS512, ES256, ES384, ES512, PS256, PS384, PS512 algorithms
- **Attestation Chain Validation**: Complete validation of certificate chains and temporal ordering
- **Trust Policy Enforcement**: Configurable policies for package acceptance/rejection
- **Key Management**: Trusted key storage with rotation and revocation support

### 📦 Content Addressable Storage (CAS)
- **Immutable Storage**: Content stored by SHA256 hash for integrity
- **Deduplication**: Automatic deduplication of identical content
- **Compression**: Optional gzip compression for space efficiency  
- **Encryption**: Optional AES256 encryption for sensitive content
- **Garbage Collection**: LRU/FIFO/size-based cleanup strategies

### ⚡ Atomic Transactions
- **Rollback on Failure**: Complete rollback if any verification step fails
- **Idempotent Operations**: Safe to re-run installations
- **Version Conflict Resolution**: Graceful handling of version conflicts

### 🔗 Git Integration
- **Installation Tracking**: Records installations in git-notes
- **Lock File Management**: Updates kgen.lock.json with dependency info
- **Provenance Records**: Complete audit trail of installations

## Usage

```bash
# Install specific version with verification
kgen marketplace install @org/package@1.0.0

# Install latest version
kgen marketplace install @org/package

# Force reinstall
kgen marketplace install @org/package --force

# Dry run (show what would be installed)
kgen marketplace install @org/package --dry-run

# Skip verification (NOT RECOMMENDED)
kgen marketplace install @org/package --skip-verification
```

## Configuration

### Registry Configuration
```json
{
  "marketplace": {
    "registries": [
      "https://registry.kgen.dev",
      "https://marketplace.kgen.io"
    ],
    "timeout": 30000,
    "retries": 3
  }
}
```

### Trust Policy Example
```json
{
  "version": "1.0",
  "default": "deny",
  "rules": [
    {
      "name": "allow-trusted-org",
      "match": { "scope": "@trusted" },
      "action": "allow",
      "reason": "Packages from trusted organization"
    },
    {
      "name": "require-security-scan",
      "match": { "name": "*" },
      "action": "allow", 
      "conditions": [
        {
          "type": "required_attestation",
          "attestationType": "security-scan"
        }
      ]
    }
  ]
}
```

### CAS Configuration
```json
{
  "cas": {
    "compression": true,
    "encryption": false,
    "maxFileSize": 104857600,
    "gcThreshold": 1073741824
  }
}
```

## Security Model

### Zero-Trust Verification
1. **Download** KPack from registry
2. **Verify** JWS signatures on all attestations  
3. **Validate** complete attestation chain integrity
4. **Check** against local trust policy
5. **Verify** content hash matches attestation
6. **Store** in CAS by content hash
7. **Install** with atomic transaction
8. **Record** in git-notes and lock file

### Failure Modes
- **No Attestations**: Installation fails immediately
- **Invalid Signatures**: Verification fails, no installation
- **Broken Chain**: Attestation chain validation fails
- **Policy Violation**: Trust policy rejects package
- **Hash Mismatch**: Content integrity check fails
- **Transaction Failure**: Complete rollback of all operations

## File Structure

```
src/commands/marketplace/
├── install.js              # Main install command
src/lib/marketplace/
├── crypto-verifier.js      # Cryptographic verification
├── cas-manager.js          # Content addressable storage  
├── registry-client.js      # Registry communication
test/commands/marketplace/
├── install.test.js         # Comprehensive test suite
├── install-basic.test.js   # Basic functionality tests
```

## Implementation Classes

### Core Classes
- **KPackReference**: Parses and validates package references
- **CryptographicVerifier**: Handles all cryptographic operations
- **CASManager**: Manages content addressable storage
- **AtomicTransaction**: Ensures rollback safety
- **RegistryClient**: Handles registry communication
- **GitIntegration**: Git-notes and lock file management

### Security Classes  
- **JWSVerifier**: JSON Web Signature verification
- **AttestationChainValidator**: Chain integrity validation
- **TrustPolicyEngine**: Policy evaluation and enforcement
- **KeyManager**: Trusted key lifecycle management

## Error Handling

All operations implement comprehensive error handling with detailed error messages:

- **Network Errors**: Retry logic with exponential backoff
- **Verification Errors**: Clear indication of what failed verification
- **Policy Errors**: Specific policy violations with remediation guidance
- **Transaction Errors**: Rollback details and recovery suggestions

## Testing

The implementation includes comprehensive tests covering:

- KPack reference parsing and validation
- Cryptographic signature verification  
- Attestation chain integrity checks
- Trust policy evaluation
- CAS storage and retrieval
- Atomic transaction rollback
- Git integration functionality

## Integration

The install command integrates with the main KGEN CLI:

```bash
kgen marketplace install @org/package
```

This provides a secure, verifiable way to install KPacks while maintaining complete audit trails and zero-trust security principles.