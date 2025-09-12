#!/usr/bin/env node

/**
 * Deterministic Rendering Demonstration
 * 
 * Shows before/after comparison of non-deterministic vs deterministic rendering
 * Demonstrates guaranteed byte-identical outputs
 */

import { consola } from 'consola';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { HardenedDeterministicRenderer } from '../src/kgen/deterministic/hardened-renderer.js';

// Polyfill for process.hrtime.bigint if not available
if (!process.hrtime.bigint) {
  process.hrtime.bigint = () => BigInt(Date.now() * 1000000);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  consola.start('🚀 Deterministic Rendering Demo');

  try {
    // Setup demo templates directory
    const demoDir = path.join(__dirname, 'demo-templates');
    await fs.mkdir(demoDir, { recursive: true });

    // Create demonstration templates
    await createDemoTemplates(demoDir);

    // Initialize renderer
    const renderer = new HardenedDeterministicRenderer({
      templatesDir: demoDir,
      deterministicSeed: 'demo-seed-2024',
      staticBuildTime: '2024-01-01T12:00:00.000Z'
    });

    // Demonstration scenarios
    await demonstrateBasicDeterminism(renderer);
    await demonstrateHashConsistency(renderer);
    await demonstrateFilterDeterminism(renderer);
    await demonstrateCrossPlatformConsistency(renderer);
    await demonstratePerformance(renderer);

    // Cleanup
    await fs.rm(demoDir, { recursive: true, force: true });

    consola.success('✅ All demonstrations completed successfully!');

  } catch (error) {
    consola.error('Demo failed:', error.message);
    process.exit(1);
  }
}

/**
 * Create demonstration templates
 */
async function createDemoTemplates(demoDir) {
  // Template showing non-deterministic patterns (fixed by renderer)
  await fs.writeFile(
    path.join(demoDir, 'before-fix.njk'),
    `---
title: "Problem Template"
---
# {{ title }}

❌ These would be non-deterministic in regular templates:
- Current time: {{ "now" | date }}
- Random number: {{ "seed123" | random }}
- Generated ID: {{ user.name | hash }}
- UUID: {{ "user" | uuid }}

Build info:
- Time: {{ BUILD_TIME }}
- Hash: {{ BUILD_HASH }}
`
  );

  // Template demonstrating deterministic features
  await fs.writeFile(
    path.join(demoDir, 'deterministic-features.njk'),
    `---
title: "Deterministic Features Demo"
version: 1.0
---
# {{ title }} v{{ version }}

✅ All these outputs are deterministic:

## Hash-based Operations
- Content hash: {{ data | hash }}
- Shorter hash: {{ data | hash(12) }}
- Content ID: {{ data | contentId }}

## UUID Generation (deterministic)
- User UUID: {{ user.name | uuid("user") }}
- Session UUID: {{ session.id | uuid("session") }}
- Global UUID: {{ uuid("demo") }}

## Deterministic Random
- Seeded random 1: {{ "seed-1" | random }}
- Seeded random 2: {{ "seed-2" | random }}
- Same seed: {{ "seed-1" | random }}  <!-- Should match first -->

## Path Normalization
- Windows path: {{ "C:\\\\Users\\\\test\\\\file.txt" | normalizePath }}
- Unix path: {{ "/home/test/file.txt" | normalizePath }}
- Mixed path: {{ "relative\\\\path/to/file.txt" | normalizePath }}

## Data Processing
- Sorted data: {{ data | sortKeys | canonical }}
- Stripped temporal: {{ dataWithTimestamps | stripTemporal | canonical }}
- Slug: {{ title | slug }}

---
Generated deterministically at: {{ BUILD_TIME }}
Renderer seed: {{ BUILD_SEED }}
`
  );

  // Complex template for performance testing
  await fs.writeFile(
    path.join(demoDir, 'performance-test.njk'),
    `---
title: "Performance Test"
---
# {{ title }}

{% for item in items | sort("priority") %}
## Item {{ loop.index }}: {{ item.name }}

- ID: {{ item.id | hash(8) }}
- UUID: {{ item.name | uuid("item") }}
- Priority: {{ item.priority }}
- Hash: {{ item | hash }}
- Random: {{ item.name | random }}

{% if item.tags %}
Tags: {% for tag in item.tags | sort %}{{ tag | slug }}{% if not loop.last %}, {% endif %}{% endfor %}
{% endif %}

{% endfor %}

Summary:
- Total items: {{ items.length }}
- Content hash: {{ items | hash }}
- Build time: {{ BUILD_TIME }}
`
  );
}

/**
 * Demonstrate basic deterministic rendering
 */
async function demonstrateBasicDeterminism(renderer) {
  consola.box('Basic Deterministic Rendering');

  const context = {
    user: { name: 'TestUser' },
    data: { key: 'value', nested: { inner: 'data' } }
  };

  const renders = [];
  
  console.log('Rendering template 5 times...');
  for (let i = 0; i < 5; i++) {
    // Clear cache to ensure fresh render
    renderer.clearCache();
    const result = await renderer.render('before-fix.njk', context);
    renders.push(result);
    console.log(`Render ${i + 1}: ${result.contentHash.substring(0, 12)}... (${result.content.length} bytes)`);
  }

  // Check if all renders are identical
  const uniqueHashes = new Set(renders.map(r => r.contentHash));
  const identical = uniqueHashes.size === 1;

  if (identical) {
    consola.success(`✅ All 5 renders produced identical output!`);
    consola.info(`   Content hash: ${renders[0].contentHash}`);
    consola.info(`   Content length: ${renders[0].content.length} bytes`);
  } else {
    consola.error(`❌ Found ${uniqueHashes.size} different outputs!`);
  }

  console.log('\n' + '─'.repeat(60) + '\n');
}

/**
 * Demonstrate hash consistency across renders
 */
async function demonstrateHashConsistency(renderer) {
  consola.box('Hash Consistency Verification');

  const context = {
    user: { name: 'HashUser' },
    data: { test: 'hash-data', number: 42 }
  };

  console.log('Testing hash consistency across 10 renders...');
  
  const hashResults = [];
  for (let i = 0; i < 10; i++) {
    renderer.clearCache();
    const result = await renderer.render('deterministic-features.njk', context);
    
    // Extract specific hash values from content
    const contentHashes = extractHashesFromContent(result.content);
    hashResults.push({
      render: i + 1,
      contentHash: result.contentHash,
      extractedHashes: contentHashes
    });
  }

  // Verify all content hashes are identical
  const contentHashes = new Set(hashResults.map(r => r.contentHash));
  const contentIdentical = contentHashes.size === 1;

  // Verify all extracted hashes are identical across renders
  const firstExtracted = hashResults[0].extractedHashes;
  const extractedIdentical = hashResults.every(r => 
    JSON.stringify(r.extractedHashes) === JSON.stringify(firstExtracted)
  );

  if (contentIdentical && extractedIdentical) {
    consola.success('✅ Perfect hash consistency across all renders!');
    consola.info(`   Content hash: ${Array.from(contentHashes)[0].substring(0, 16)}...`);
    consola.info(`   Extracted hashes are identical: ${Object.keys(firstExtracted).join(', ')}`);
  } else {
    consola.error('❌ Hash inconsistency detected!');
    if (!contentIdentical) consola.error(`   Found ${contentHashes.size} different content hashes`);
    if (!extractedIdentical) consola.error(`   Extracted hashes vary between renders`);
  }

  console.log('\n' + '─'.repeat(60) + '\n');
}

/**
 * Demonstrate deterministic filter behavior
 */
async function demonstrateFilterDeterminism(renderer) {
  consola.box('Deterministic Filter Demonstration');

  const testCases = [
    {
      name: 'Hash Filter',
      context: { data: { test: 'data', num: 123 } },
      description: 'Same input should always produce same hash'
    },
    {
      name: 'Random Filter',
      context: { seed: 'consistent-seed' },
      description: 'Same seed should always produce same "random" number'
    },
    {
      name: 'UUID Filter',
      context: { user: { name: 'UUIDUser' } },
      description: 'Same input should always produce same UUID'
    }
  ];

  for (const testCase of testCases) {
    console.log(`Testing ${testCase.name}:`);
    console.log(`  Description: ${testCase.description}`);

    const results = [];
    for (let i = 0; i < 3; i++) {
      renderer.clearCache();
      const result = await renderer.render('deterministic-features.njk', testCase.context);
      results.push(result.contentHash);
    }

    const unique = new Set(results);
    if (unique.size === 1) {
      consola.success(`  ✅ Consistent across 3 renders`);
    } else {
      consola.error(`  ❌ Inconsistent: ${unique.size} different outputs`);
    }
  }

  console.log('\n' + '─'.repeat(60) + '\n');
}

/**
 * Demonstrate cross-platform path consistency
 */
async function demonstrateCrossPlatformConsistency(renderer) {
  consola.box('Cross-Platform Path Consistency');

  const pathTestContext = {
    user: { name: 'PathUser' },
    data: { paths: true }
  };

  console.log('Testing path normalization consistency...');

  const result = await renderer.render('deterministic-features.njk', pathTestContext);
  
  // Extract path normalizations from content
  const windowsPathMatch = result.content.match(/Windows path: ([^\n]+)/);
  const unixPathMatch = result.content.match(/Unix path: ([^\n]+)/);
  const mixedPathMatch = result.content.match(/Mixed path: ([^\n]+)/);

  console.log('Normalized paths:');
  if (windowsPathMatch) console.log(`  Windows: ${windowsPathMatch[1]}`);
  if (unixPathMatch) console.log(`  Unix: ${unixPathMatch[1]}`);
  if (mixedPathMatch) console.log(`  Mixed: ${mixedPathMatch[1]}`);

  // All should use forward slashes for consistency
  const allForwardSlashes = [windowsPathMatch, unixPathMatch, mixedPathMatch]
    .filter(match => match)
    .every(match => !match[1].includes('\\'));

  if (allForwardSlashes) {
    consola.success('✅ All paths normalized to forward slashes');
  } else {
    consola.error('❌ Path normalization inconsistency detected');
  }

  console.log('\n' + '─'.repeat(60) + '\n');
}

/**
 * Demonstrate performance characteristics
 */
async function demonstratePerformance(renderer) {
  consola.box('Performance Characteristics');

  const performanceContext = {
    items: Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      priority: Math.floor((i + 1) / 10) + 1,
      tags: [`tag-${i % 3}`, `category-${i % 5}`]
    }))
  };

  console.log('Running performance benchmark...');
  
  const benchmark = await renderer.benchmarkDeterministicRendering(
    'performance-test.njk',
    performanceContext,
    20
  );

  console.log('Results:');
  console.log(`  Iterations: ${benchmark.iterations}`);
  console.log(`  Deterministic: ${benchmark.deterministic ? '✅ Yes' : '❌ No'}`);
  console.log(`  Average time: ${benchmark.performance.averageTime.toFixed(2)}ms`);
  console.log(`  Min time: ${benchmark.performance.minTime.toFixed(2)}ms`);
  console.log(`  Max time: ${benchmark.performance.maxTime.toFixed(2)}ms`);
  console.log(`  Total time: ${benchmark.performance.totalTime.toFixed(2)}ms`);
  console.log(`  Variance: ${benchmark.performance.variance.toFixed(2)}ms²`);

  if (benchmark.deterministic) {
    consola.success('✅ Performance benchmark passed with deterministic output');
    consola.info(`   Content hash: ${benchmark.validation.contentHash.substring(0, 16)}...`);
  } else {
    consola.error('❌ Performance benchmark failed - non-deterministic output');
  }

  console.log('\n' + '─'.repeat(60) + '\n');
}

/**
 * Extract hash values from rendered content for verification
 */
function extractHashesFromContent(content) {
  const hashes = {};
  
  const patterns = [
    { key: 'contentHash', pattern: /Content hash: ([a-f0-9]+)/ },
    { key: 'shorterHash', pattern: /Shorter hash: ([a-f0-9]+)/ },
    { key: 'contentId', pattern: /Content ID: ([a-f0-9]+)/ },
    { key: 'userUUID', pattern: /User UUID: ([a-f0-9-]+)/ },
    { key: 'sessionUUID', pattern: /Session UUID: ([a-f0-9-]+)/ }
  ];

  for (const { key, pattern } of patterns) {
    const match = content.match(pattern);
    if (match) {
      hashes[key] = match[1];
    }
  }

  return hashes;
}

// Run demonstration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    consola.error('Demo failed:', error);
    process.exit(1);
  });
}

export { main as runDeterministicDemo };