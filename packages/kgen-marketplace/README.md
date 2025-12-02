# KGen Marketplace - N-Dimensional Payment System

A flexible, multi-currency payment and settlement system for the KGen marketplace that supports fiat, cryptocurrency, reputation credits, and compute resources.

## Features

🎯 **N-Dimensional Value Vectors** - Support for multiple currency types in a single transaction  
🔒 **Cryptographic Receipts** - Immutable transaction records with digital signatures  
⚖️ **Policy Engine** - Complex settlement rules with AND/OR logic, thresholds, and vesting  
🔌 **Pluggable Adapters** - Support for Stripe, Web3, GitHub, and compute credit systems  
⚡ **Atomic Transactions** - All-or-nothing settlement with automatic rollback  
📊 **Git Integration** - Store receipts in git-notes for distributed immutability  

## Quick Start

```bash
npm install @kgen/marketplace
```

```javascript
import { MarketplaceSetup, ValueVector, PolicyTemplates } from '@kgen/marketplace';

// Setup settlement engine
const engine = await MarketplaceSetup.createSettlementEngine({
  stripe: { apiKey: process.env.STRIPE_SECRET_KEY },
  web3: { rpcUrl: process.env.WEB3_RPC_URL },
  github: { token: process.env.GITHUB_TOKEN },
  compute: { provider: 'aws' }
});

// Create payment requirement
const requirement = new ValueVector({
  fiat: 25.00,     // $25 USD
  crypto: 0.01,    // 0.01 ETH
  reputation: 500, // 500 GitHub reputation points
  compute: 100     // 100 compute units
});

// Settle payment with flexible policy
const result = await engine.settle({
  userId: 'user123',
  kpackId: 'enterprise-api-template',
  requirement,
  policy: PolicyTemplates.FLEXIBLE_PAYMENT // fiat OR crypto OR reputation
});

console.log('Settlement result:', result);
```

## KPack Integration

KPack manifests can specify payment requirements directly:

```json
{
  "name": "enterprise-api-template",
  "version": "1.0.0",
  "payment": {
    "fiat": 49.99,
    "reputation": 750,
    "custom": {
      "enterprise_credits": 5
    }
  }
}
```

```javascript
// Parse from manifest
const requirement = ValueVector.fromKPackManifest(manifest);

// Settle with enterprise policy
const result = await engine.settle({
  userId: 'enterprise_user',
  kpackId: manifest.name,
  requirement,
  policy: PolicyTemplates.ENTERPRISE_TIER
});
```

## Payment Adapters

### Stripe Adapter (Fiat Currency)
```javascript
import { StripeAdapter } from '@kgen/marketplace';

const stripeAdapter = new StripeAdapter({
  apiKey: 'sk_live_...'
});
```

### Web3 Adapter (Cryptocurrency)
```javascript
import { Web3Adapter } from '@kgen/marketplace';

const web3Adapter = new Web3Adapter({
  rpcUrl: 'https://mainnet.infura.io/v3/...',
  contractAddress: '0x...'
});
```

### GitHub Adapter (Reputation Credits)
```javascript
import { GitHubAdapter } from '@kgen/marketplace';

const githubAdapter = new GitHubAdapter({
  token: 'ghp_...'
});
```

### Compute Adapter (AI/ML Resources)
```javascript
import { ComputeAdapter } from '@kgen/marketplace';

const computeAdapter = new ComputeAdapter({
  provider: 'aws',
  region: 'us-east-1'
});
```

## Settlement Policies

### Predefined Policies

```javascript
import { PolicyTemplates } from '@kgen/marketplace';

// Flexible: fiat OR crypto OR reputation
PolicyTemplates.FLEXIBLE_PAYMENT

// Premium: fiat AND reputation (50% discount on reputation)
PolicyTemplates.PREMIUM_ACCESS

// Enterprise: high requirements across all dimensions
PolicyTemplates.ENTERPRISE_TIER

// Compute-focused: compute credits OR fiat (20% markup)
PolicyTemplates.COMPUTE_FOCUSED

// Partial: accept 70% of total requirement value
PolicyTemplates.PARTIAL_PAYMENT

// Subscription: unlock over 12 months
PolicyTemplates.SUBSCRIPTION_VESTING
```

### Custom Policies

```javascript
// AND/OR Logic
const customPolicy = {
  type: 'logical',
  operator: 'or',
  rules: [
    { type: 'dimension', dimension: 'fiat' },
    { 
      type: 'nested',
      policy: {
        type: 'logical',
        operator: 'and',
        rules: [
          { type: 'dimension', dimension: 'reputation', multiplier: 0.8 },
          { type: 'dimension', dimension: 'compute', multiplier: 0.2 }
        ]
      }
    }
  ]
};

// Threshold Policy
const thresholdPolicy = {
  type: 'threshold',
  threshold: 75, // Need 75% of total requirement
  mode: 'percentage'
};

// Vesting Policy
const vestingPolicy = {
  type: 'vesting',
  vestingSchedule: [
    {
      percentage: 50,
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-06-01T00:00:00Z'
    },
    {
      percentage: 50,
      startTime: '2024-06-01T00:00:00Z',
      endTime: '2024-12-01T00:00:00Z'
    }
  ]
};
```

## Cryptographic Receipts

Every transaction generates a cryptographically signed receipt:

```javascript
{
  "@context": "https://kgen.dev/contexts/marketplace-receipt",
  "@type": "kmkt:Receipt",
  "id": "receipt:txn_123456",
  "transaction": {
    "id": "txn_123456",
    "userId": "user123",
    "kpackId": "enterprise-api",
    "timestamp": "2024-01-15T10:30:00Z",
    "status": "completed",
    "requirement": { "fiat": 25, "reputation": 100 },
    "operations": [...]
  },
  "cryptographic": {
    "contentHash": "sha256:abc123...",
    "signature": {
      "value": "RSA256:def456...",
      "publicKey": "-----BEGIN PUBLIC KEY-----...",
      "algorithm": "SHA256withRSA"
    },
    "merkleProof": {
      "root": "merkle_root_hash",
      "path": ["leaf1", "leaf2", "leaf3"]
    },
    "timestampProof": {
      "timestamp": "2024-01-15T10:30:00Z",
      "blockHeight": 18500000,
      "nonce": "random_nonce"
    }
  }
}
```

Receipts are automatically stored in:
- `.kgen/receipts/` directory
- Git notes for immutability  
- IPFS for distributed storage (optional)

## Receipt Verification

```javascript
import { ReceiptGenerator } from '@kgen/marketplace';

const generator = new ReceiptGenerator();
const verification = await generator.verifyReceipt(receipt);

console.log(verification);
// {
//   contentHash: true,
//   signature: true,
//   merkleProof: true,
//   timestamp: true,
//   overall: true
// }
```

## Testing

```bash
npm test
```

Run specific test suites:
```bash
npm test -- tests/settlement.test.js
npm test -- tests/policies.test.js
npm test -- tests/receipts.test.js
npm test -- tests/integration.test.js
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   KPack         │    │  Settlement     │    │   Payment       │
│   Manifest      │───▶│  Engine         │───▶│   Adapters      │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Policy        │    │   Transaction   │    │   Stripe API    │
│   Engine        │    │   Processing    │    │   Web3 RPC      │
│                 │    │                 │    │   GitHub API    │
└─────────────────┘    └─────────────────┘    │   Compute Pool  │
                                │              └─────────────────┘
                                ▼
┌─────────────────┐    ┌─────────────────┐
│   Receipt       │    │   Storage       │
│   Generator     │───▶│   • Filesystem  │
│                 │    │   • Git Notes   │
└─────────────────┘    │   • IPFS        │
                       └─────────────────┘
```

## Value Vectors

The core concept is an N-dimensional value vector representing payment requirements:

```javascript
const vector = new ValueVector({
  fiat: 10.00,        // USD
  crypto: 0.005,      // ETH
  reputation: 250,    // GitHub points
  compute: 50,        // Compute units
  custom_credits: 5   // Custom dimension
});

// Vector operations
const userBalance = new ValueVector({ fiat: 100, crypto: 1.0 });
const cost = new ValueVector({ fiat: 25, crypto: 0.1 });

const remaining = userBalance.subtract(cost);
// { fiat: 75, crypto: 0.9 }

const total = userBalance.add(cost);
// { fiat: 125, crypto: 1.1 }

// Satisfaction check
userBalance.satisfies(cost); // true
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Security

For security issues, please email security@kgen.dev instead of opening a public issue.