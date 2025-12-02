/**
 * Simple test script for registry functionality
 */

import { createRegistryClient, REGISTRY_PRESETS } from './index.js';

async function testRegistryClient() {
  console.log('Testing KGEN Marketplace Registry Client...');
  
  try {
    // Create NPM registry client
    const client = createRegistryClient({
      ...REGISTRY_PRESETS.npm,
      enableTrustVerification: false, // Disable for simple test
      cacheEnabled: false,
    });

    console.log('✓ Registry client created');

    // Test registry health
    const info = await client.getInfo();
    console.log('✓ Registry health:', info);

    // Test package existence check
    const exists = await client.exists('express');
    console.log('✓ Express package exists:', exists);

    // Test versions listing
    const versions = await client.listVersions('express');
    console.log('✓ Express versions found:', versions.slice(0, 5));

    // Test package metadata
    const pkg = await client.getPackage('express', '4.18.0');
    console.log('✓ Express package metadata:', {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      license: pkg.license,
    });

    // Test search
    const searchResult = await client.search({
      query: 'express',
      limit: 3,
    });
    console.log('✓ Search results:', {
      total: searchResult.total,
      packages: searchResult.packages.length,
    });

    console.log('\n🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testRegistryClient().catch(console.error);
}

export { testRegistryClient };