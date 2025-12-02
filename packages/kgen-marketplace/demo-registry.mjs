#!/usr/bin/env node

/**
 * Demo script for KGEN Marketplace Registry Client
 * Shows NPM, OCI, and Git registry adapter functionality
 */

console.log('🚀 KGEN Marketplace Registry Client Demo');
console.log('==========================================\n');

// Simulate registry operations without actual network calls
function simulateRegistryDemo() {
  console.log('📦 Registry Client Features:');
  console.log('');
  
  console.log('✅ 1. NPM Registry Adapter');
  console.log('   - Publish tarballs to npm registry');
  console.log('   - Search with facet filtering (keywords, author, license)');
  console.log('   - Fetch and verify packages with integrity checks');
  console.log('   - Support for scoped packages and authentication');
  console.log('');
  
  console.log('✅ 2. OCI Registry Adapter'); 
  console.log('   - Compatible with GitHub Container Registry, Docker Hub');
  console.log('   - Store packages as OCI images with annotations');
  console.log('   - Upload blobs with digest verification');
  console.log('   - Manifest-based package metadata');
  console.log('');
  
  console.log('✅ 3. Git Registry Adapter');
  console.log('   - Use Git repositories as package registries');
  console.log('   - JSON index file for package discovery');
  console.log('   - Compressed tarball storage');
  console.log('   - Git-based versioning and history');
  console.log('');
  
  console.log('✅ 4. Trust Verification System');
  console.log('   - Cryptographic signature verification');
  console.log('   - Trust policy enforcement (trust-policy.json)');
  console.log('   - License validation against allowed lists');
  console.log('   - Package trust scoring algorithm');
  console.log('');
  
  console.log('✅ 5. Pluggable Architecture');
  console.log('   - Abstract registry adapter interface');
  console.log('   - Factory pattern for adapter creation');
  console.log('   - Extensible for custom registry types');
  console.log('   - Configuration-driven adapter selection');
  console.log('');

  console.log('🔧 Example Usage:');
  console.log('');
  console.log('```typescript');
  console.log('import { createRegistryClient, REGISTRY_PRESETS } from "@kgen/marketplace";');
  console.log('');
  console.log('// NPM Registry');
  console.log('const npmClient = createRegistryClient({');
  console.log('  ...REGISTRY_PRESETS.npm,');
  console.log('  token: process.env.NPM_TOKEN');
  console.log('});');
  console.log('');
  console.log('// Search packages');
  console.log('const results = await npmClient.search({');
  console.log('  query: "kgen templates",');
  console.log('  facets: { keywords: ["generator"], license: ["MIT"] }');
  console.log('});');
  console.log('');
  console.log('// Publish package');
  console.log('await npmClient.publish({');
  console.log('  packageJson: { name: "@org/package", version: "1.0.0" },');
  console.log('  tarball: packageBuffer,');
  console.log('  attestations: [{ signature: "...", keyId: "key1" }]');
  console.log('});');
  console.log('```');
  console.log('');
  
  console.log('📁 File Structure:');
  console.log('');
  console.log('packages/kgen-marketplace/src/registry/');
  console.log('├── adapter.ts      # Abstract interface & factory');
  console.log('├── npm.ts          # NPM registry implementation');  
  console.log('├── oci.ts          # OCI registry implementation');
  console.log('├── git.ts          # Git registry implementation');
  console.log('├── client.ts       # Main registry client');
  console.log('├── trust.ts        # Trust verification system');
  console.log('├── examples.ts     # Usage examples');
  console.log('└── index.ts        # Public exports');
  console.log('');
  
  console.log('🎯 Key Benefits:');
  console.log('- Client-only solution (no server required)');
  console.log('- Multi-registry support (npm, OCI, Git)');
  console.log('- Built-in trust and security verification');
  console.log('- Faceted search and filtering');
  console.log('- Caching and performance optimization');
  console.log('- TypeScript with full type safety');
  console.log('');
  
  console.log('✨ Demo completed successfully!');
}

simulateRegistryDemo();