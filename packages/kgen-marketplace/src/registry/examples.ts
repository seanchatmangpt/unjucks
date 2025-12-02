/**
 * Usage examples for the registry client
 */

import { createRegistryClient, REGISTRY_PRESETS, TrustVerifier } from './index.js';

/**
 * Example: Basic NPM registry usage
 */
export async function npmRegistryExample() {
  const client = createRegistryClient({
    ...REGISTRY_PRESETS.npm,
    token: process.env.NPM_TOKEN,
  });

  // Search for packages
  const searchResult = await client.search({
    query: 'kgen templates',
    facets: {
      keywords: ['template', 'generator'],
      license: ['MIT', 'Apache-2.0'],
    },
    limit: 10,
  });

  console.log(`Found ${searchResult.total} packages:`);
  searchResult.packages.forEach(pkg => {
    console.log(`- ${pkg.name}@${pkg.version}: ${pkg.description}`);
    if (searchResult.trustScores?.[`${pkg.name}@${pkg.version}`]) {
      const trust = searchResult.trustScores[`${pkg.name}@${pkg.version}`];
      console.log(`  Trust: ${trust.trusted ? 'TRUSTED' : 'UNTRUSTED'} (score: ${trust.score})`);
    }
  });

  // Get specific package
  const pkg = await client.getPackage('@kgen/core', '1.0.0');
  console.log('Package details:', pkg);

  // Verify trust
  if (pkg.trustResult) {
    console.log('Trust verification:', pkg.trustResult);
  }

  return { searchResult, pkg };
}

/**
 * Example: Publishing to NPM registry
 */
export async function npmPublishExample() {
  const client = createRegistryClient({
    ...REGISTRY_PRESETS.npm,
    token: process.env.NPM_TOKEN,
  });

  const packageJson = {
    name: '@kgen/example-template',
    version: '1.0.0',
    description: 'Example template for kgen',
    author: 'Your Name',
    license: 'MIT',
    keywords: ['kgen', 'template', 'generator'],
    repository: {
      type: 'git',
      url: 'https://github.com/your-org/example-template.git',
    },
  };

  // Create a dummy tarball (in real usage, this would be a proper package tarball)
  const tarball = Buffer.from('dummy tarball content');

  // Optional: Create attestations
  const attestations = [
    {
      signature: 'dummy-signature',
      keyId: 'your-key-id',
    },
  ];

  // Dry run first
  await client.publish({
    packageJson,
    tarball,
    attestations,
    dryRun: true,
  });

  console.log('Dry run successful, ready to publish');

  // Uncomment to actually publish
  // await client.publish({
  //   packageJson,
  //   tarball,
  //   attestations,
  // });
}

/**
 * Example: Using OCI registry (GitHub Container Registry)
 */
export async function ociRegistryExample() {
  const client = createRegistryClient({
    type: 'oci',
    registry: 'ghcr.io',
    token: process.env.GITHUB_TOKEN,
    scope: 'your-org',
  });

  // Search is limited in OCI registries
  const searchResult = await client.search({
    query: 'kgen',
    limit: 5,
  });

  console.log('OCI packages found:', searchResult.packages.length);

  // Get package from OCI registry
  try {
    const pkg = await client.getPackage('your-org/kgen-template', 'latest');
    console.log('OCI package:', pkg);
  } catch (error) {
    console.log('Package not found in OCI registry');
  }

  return searchResult;
}

/**
 * Example: Using Git registry
 */
export async function gitRegistryExample() {
  const client = createRegistryClient({
    type: 'git',
    registry: 'https://github.com/your-org/kgen-registry.git',
  });

  // Search git registry
  const searchResult = await client.search({
    query: 'template',
    facets: {
      keywords: ['generator'],
    },
  });

  console.log('Git registry packages:', searchResult.packages);

  // List versions
  if (searchResult.packages.length > 0) {
    const pkg = searchResult.packages[0];
    const versions = await client.listVersions(pkg.name);
    console.log(`Versions for ${pkg.name}:`, versions);
  }

  return searchResult;
}

/**
 * Example: Trust verification with custom policy
 */
export async function trustVerificationExample() {
  // Custom trust policy
  const trustPolicy = {
    version: '1.0.0',
    trustedKeys: [
      {
        keyId: 'your-signing-key',
        algorithm: 'RSA-SHA256',
        publicKey: '-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----',
        owner: 'your-organization',
        scope: ['@your-org'],
      },
    ],
    requireSignature: true,
    allowedLicenses: ['MIT', 'Apache-2.0'],
    blockedPackages: ['malicious-package'],
    minimumTrustScore: 70,
    policies: [
      {
        scope: '@your-org',
        requireAttestation: true,
        minimumSignatures: 1,
      },
    ],
  };

  // Save trust policy
  require('fs').writeFileSync('./trust-policy.json', JSON.stringify(trustPolicy, null, 2));

  const client = createRegistryClient({
    ...REGISTRY_PRESETS.npm,
    trustPolicyPath: './trust-policy.json',
    enableTrustVerification: true,
  });

  // Search with trust verification
  const searchResult = await client.search({
    query: '@your-org',
    limit: 10,
  });

  console.log('Trust verification results:');
  searchResult.packages.forEach(pkg => {
    const trustScore = searchResult.trustScores?.[`${pkg.name}@${pkg.version}`];
    if (trustScore) {
      console.log(`${pkg.name}@${pkg.version}:`);
      console.log(`  Trusted: ${trustScore.trusted}`);
      console.log(`  Score: ${trustScore.score}`);
      console.log(`  Reasons: ${trustScore.reasons.join(', ')}`);
      if (trustScore.signatures.length > 0) {
        console.log(`  Signatures: ${trustScore.signatures.length} found`);
      }
    }
  });

  return searchResult;
}

/**
 * Example: Multi-registry search
 */
export async function multiRegistryExample() {
  const clients = {
    npm: createRegistryClient(REGISTRY_PRESETS.npm),
    github: createRegistryClient({
      ...REGISTRY_PRESETS.github,
      token: process.env.GITHUB_TOKEN,
    }),
  };

  const query = 'kgen template';
  const results = await Promise.allSettled([
    clients.npm.search({ query, limit: 5 }),
    clients.github.search({ query, limit: 5 }),
  ]);

  console.log('Multi-registry search results:');
  results.forEach((result, index) => {
    const registryName = index === 0 ? 'NPM' : 'GitHub';
    if (result.status === 'fulfilled') {
      console.log(`${registryName}: ${result.value.packages.length} packages found`);
      result.value.packages.forEach(pkg => {
        console.log(`  - ${pkg.name}@${pkg.version}`);
      });
    } else {
      console.log(`${registryName}: Search failed -`, result.reason.message);
    }
  });

  return results;
}

/**
 * Example: Registry health monitoring
 */
export async function registryHealthExample() {
  const registries = [
    { name: 'NPM', client: createRegistryClient(REGISTRY_PRESETS.npm) },
    { name: 'GitHub', client: createRegistryClient(REGISTRY_PRESETS.github) },
  ];

  console.log('Registry health check:');
  
  for (const { name, client } of registries) {
    try {
      const info = await client.getInfo();
      console.log(`${name}: ${info.healthy ? 'HEALTHY' : 'UNHEALTHY'} (${info.registry})`);
    } catch (error) {
      console.log(`${name}: ERROR - ${error.message}`);
    }
  }
}

// Export all examples for easy testing
export const examples = {
  npmRegistryExample,
  npmPublishExample,
  ociRegistryExample,
  gitRegistryExample,
  trustVerificationExample,
  multiRegistryExample,
  registryHealthExample,
};

// CLI runner for examples
if (require.main === module) {
  const exampleName = process.argv[2];
  
  if (!exampleName || !examples[exampleName as keyof typeof examples]) {
    console.log('Available examples:');
    Object.keys(examples).forEach(name => console.log(`  - ${name}`));
    process.exit(1);
  }

  examples[exampleName as keyof typeof examples]()
    .then(() => console.log('Example completed'))
    .catch(error => {
      console.error('Example failed:', error);
      process.exit(1);
    });
}