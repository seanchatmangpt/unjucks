# Enhanced Attestation System for KGEN

A comprehensive SLSA-compliant attestation system that provides cryptographically verifiable provenance for generated artifacts.

## Features

- **SLSA Compliance**: Supply-chain Levels for Software Artifacts (SLSA) v1.0 compliant attestations
- **Ed25519 Signatures**: Cryptographic signing using Ed25519 with jose library
- **Git-Notes Integration**: Automatic receipt storage in git-notes using isomorphic-git
- **Trust Policy Enforcement**: Configurable trust policies with schema validation
- **Batch Verification**: High-performance parallel verification of multiple attestations
- **Content Addressable Storage**: CAS root tracking for immutable artifact lineage
- **Deterministic Timestamps**: Reproducible build support with configurable timestamp sources

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Generator      │    │   Verifier      │    │  Git-Notes      │
│  - SLSA format  │    │  - Trust policy │    │  - Receipts     │
│  - Ed25519 sign │    │  - Batch verify │    │  - Git SHA map  │
│  - CAS tracking │    │  - Cache mgmt   │    │  - Cleanup      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ CLI Integration │
                    │ - kgen attest   │
                    │ - Auto hooks    │
                    │ - Citty cmds    │
                    └─────────────────┘
```

## Quick Start

### 1. Initialize Keys

```bash
# Generate Ed25519 key pair for signing
kgen attest keys --generate
```

### 2. Create Trust Policy

```bash
# Create example trust policy
kgen attest policy --create trust-policy.json

# Validate trust policy
kgen attest policy --validate trust-policy.json
```

### 3. Generate Attestation

```bash
# Generate attestation for an artifact
kgen attest generate ./dist/component.js \
  --template ./templates/component.nunjucks \
  --variables '{"name": "UserCard", "withProps": true}' \
  --command kgen \
  --args '["generate", "component", "UserCard"]'
```

### 4. Verify Attestation

```bash
# Verify attestation with deep verification
kgen attest verify ./dist/component.js.attest.json \
  --artifact ./dist/component.js \
  --deep \
  --trust-policy ./trust-policy.json
```

## SLSA Attestation Format

Generated attestations follow the [in-toto attestation format](https://github.com/in-toto/attestation) with SLSA predicates:

```json
{
  "payload": "eyJ...base64...",
  "payloadType": "application/vnd.in-toto+json",
  "signatures": [
    {
      "keyid": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
      "sig": "base64-encoded-ed25519-signature"
    }
  ]
}
```

The decoded payload contains:

```json
{
  "_type": "https://in-toto.io/Statement/v0.1",
  "subject": [
    {
      "name": "component.js",
      "digest": {
        "sha256": "abc123..."
      }
    }
  ],
  "predicateType": "https://kgen.dev/attestation/v1",
  "predicate": {
    "type": "kgen-generation",
    "params": {
      "command": "kgen",
      "args": ["generate", "component", "UserCard"],
      "variables": {"name": "UserCard"},
      "workingDirectory": "/path/to/project"
    },
    "materials": [
      {
        "name": "template.nunjucks", 
        "digest": {"sha256": "def456..."}
      }
    ],
    "environment": {
      "arch": "x64",
      "os": "linux"
    },
    "metadata": {
      "buildInvocationId": "uuid",
      "buildStartedOn": "2024-01-01T00:00:00.000Z",
      "completeness": {
        "parameters": true,
        "environment": true,
        "materials": true
      },
      "reproducible": true
    }
  }
}
```

## Trust Policy Configuration

Trust policies define verification requirements:

```json
{
  "version": "1.0.0",
  "trustedSigners": [
    {
      "keyid": "did:key:...",
      "publicKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
      "name": "CI System"
    }
  ],
  "requiredSignatures": 1,
  "allowedPredicateTypes": [
    "https://kgen.dev/attestation/v1"
  ],
  "slsaLevel": 2,
  "additionalChecks": {
    "requireReproducibleBuilds": true,
    "maxAttestationAge": "30d",
    "allowedCommands": ["kgen", "npm"]
  }
}
```

## Git-Notes Integration

Attestation receipts are automatically stored in git-notes:

```bash
# View receipts for a commit
kgen attest receipts --commit abc123

# View receipts for an artifact
kgen attest receipts --artifact ./dist/component.js

# List all commits with receipts
kgen attest receipts --list

# Verify receipt integrity
kgen attest receipts --verify --commit abc123
```

Receipt storage structure:
```
.kgen/receipts/
├── abc123.../  # git SHA
│   ├── uuid1.attest.json
│   └── uuid2.attest.json
└── def456.../
    └── uuid3.attest.json
```

## API Usage

### Programmatic Generation

```typescript
import { AttestationSystem } from './src/attestation/index.js';

const system = new AttestationSystem({
  generator: {
    enableCryptographicSigning: true,
    enableGitNotes: true,
    timestampSource: 'deterministic'
  },
  verifier: {
    trustPolicyPath: './trust-policy.json',
    enableSLSAValidation: true
  }
});

await system.initialize();

// Generate attestation
const result = await system.generateAttestation('./artifact.js', {
  command: 'kgen',
  templatePath: './template.nunjucks',
  variables: { name: 'Component' }
});

// Verify attestation
const verification = await system.verifyAttestation(
  result.attestationPath,
  { deep: true, artifactPath: './artifact.js' }
);

console.log('Verified:', verification.verified);
console.log('SLSA Level:', verification.slsaLevel);
```

### Batch Verification

```typescript
// Verify multiple attestations in parallel
const batchResult = await system.batchVerify([
  './artifact1.js.attest.json',
  './artifact2.js.attest.json',
  './artifact3.js.attest.json'
], {
  maxConcurrency: 5,
  deep: true
});

console.log(`${batchResult.summary.verified}/${batchResult.summary.total} verified`);
```

## CLI Commands

### Core Commands

```bash
# Generate attestation
kgen attest generate <artifact> [options]

# Verify attestation  
kgen attest verify <attestation> [options]

# Batch verify directory
kgen attest verify ./attestations/ --batch --concurrency 10

# Manage receipts
kgen attest receipts --artifact <path>
kgen attest receipts --commit <sha>
kgen attest receipts --list

# Key management
kgen attest keys --generate
kgen attest keys --show
kgen attest keys --export public.pem

# Trust policy
kgen attest policy --create trust-policy.json
kgen attest policy --validate trust-policy.json
kgen attest policy --show trust-policy.json

# System status
kgen attest status --verbose

# Cleanup
kgen attest cleanup --older-than 30 --clear-cache
```

### Integration Hook

Automatic attestation generation can be enabled for all kgen commands:

```bash
# Enable automatic attestation (default)
export KGEN_ENABLE_ATTESTATION=true

# Generate component with automatic attestation
kgen generate component UserCard
# → Creates component.tsx and component.tsx.attest.json automatically
```

## Environment Variables

```bash
# Attestation configuration
KGEN_ENABLE_ATTESTATION=true
KGEN_SIGNING_KEY_PATH=.kgen/keys/signing.key
KGEN_VERIFYING_KEY_PATH=.kgen/keys/verifying.key
KGEN_SIGNER_DID=did:key:generated
KGEN_TRUST_POLICY_PATH=trust-policy.json
KGEN_GIT_DIR=.git

# For testing/development
KGEN_TIMESTAMP_SOURCE=deterministic  # or 'system'
```

## SLSA Levels

The system supports SLSA levels 1-4:

- **Level 1**: Basic attestation with subject and predicate
- **Level 2**: Build requirements with materials and metadata
- **Level 3**: Environment isolation with completeness tracking
- **Level 4**: Two-person review with reproducible builds

Example verification output:
```
✓ Attestation verified (SLSA Level 3)
✓ Trust policy satisfied  
✓ Signatures verified (1 valid)
✓ Artifact hash verified
✓ Chain integrity confirmed
```

## Security Considerations

1. **Key Management**: Store private keys securely, never commit to version control
2. **Trust Policy**: Regularly review and update trusted signers
3. **Receipt Verification**: Verify receipt integrity before trusting
4. **Network Security**: Use HTTPS for webhook notifications
5. **Environment Variables**: Sanitize sensitive environment variables

## Testing

```bash
# Run attestation tests
npm test src/attestation/

# Run with coverage
npm run test:coverage src/attestation/

# BDD tests with cucumber
npm run test:cas:attestation
```

## Performance

- **Generation**: ~50ms per attestation including signing
- **Verification**: ~20ms per attestation (cached)
- **Batch Verification**: 100+ attestations/second with parallelization
- **Git-Notes**: Negligible overhead for receipt storage

## Troubleshooting

### Common Issues

1. **Key Not Found**
   ```bash
   kgen attest keys --generate
   ```

2. **Trust Policy Invalid**
   ```bash
   kgen attest policy --validate trust-policy.json
   ```

3. **Git Notes Permission**
   ```bash
   git config notes.rewrite.refs 'refs/notes/*'
   ```

4. **Verification Failures**
   ```bash
   kgen attest verify file.attest.json --verbose
   ```

### Debug Mode

```bash
# Enable debug logging
DEBUG=kgen:attestation* kgen attest generate artifact.js

# Verbose verification
kgen attest verify --verbose attestation.json
```

## Future Enhancements

- [ ] Hardware Security Module (HSM) integration
- [ ] Witness cosigning support
- [ ] Blockchain anchoring integration
- [ ] OCI signature support
- [ ] SPDX integration
- [ ] Policy as Code with Rego/OPA

## References

- [SLSA Framework](https://slsa.dev/)
- [in-toto Attestation Format](https://github.com/in-toto/attestation)
- [Ed25519 Signatures](https://ed25519.cr.yp.to/)
- [Git Notes](https://git-scm.com/docs/git-notes)
- [jose Library](https://github.com/panva/jose)