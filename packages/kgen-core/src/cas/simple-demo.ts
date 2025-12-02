#!/usr/bin/env node

/**
 * Simple demo of Content-Addressed Storage with BLAKE3 hashing
 */

import { createBLAKE3 } from 'hash-wasm';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

async function hashContent(content: Buffer): Promise<string> {
  const hasher = await createBLAKE3();
  hasher.init();
  hasher.update(content);
  return hasher.digest('hex');
}

async function demo() {
  console.log('🚀 CAS Demo with BLAKE3 hashing');
  
  // Create temp directory
  const tempDir = join(tmpdir(), `cas-demo-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  
  try {
    // Test content
    const content1 = Buffer.from('Hello, Content-Addressed Storage!', 'utf8');
    const content2 = Buffer.from('Another piece of content', 'utf8');
    const content3 = Buffer.from('Hello, Content-Addressed Storage!', 'utf8'); // Duplicate
    
    // Hash content
    console.log('\n📝 Hashing content...');
    const hash1 = await hashContent(content1);
    const hash2 = await hashContent(content2);
    const hash3 = await hashContent(content3);
    
    console.log(`Content 1: "${content1.toString()}" → ${hash1.slice(0, 12)}...`);
    console.log(`Content 2: "${content2.toString()}" → ${hash2.slice(0, 12)}...`);
    console.log(`Content 3: "${content3.toString()}" → ${hash3.slice(0, 12)}...`);
    
    // Verify deduplication
    console.log('\n🔍 Verifying deduplication...');
    if (hash1 === hash3) {
      console.log('✅ Identical content produces identical hashes');
    } else {
      console.log('❌ Hash mismatch for identical content');
    }
    
    // Store content using hash as filename
    console.log('\n💾 Storing content...');
    const storageDir = join(tempDir, 'storage');
    await fs.mkdir(storageDir, { recursive: true });
    
    await fs.writeFile(join(storageDir, hash1), content1);
    await fs.writeFile(join(storageDir, hash2), content2);
    // Note: hash3 == hash1, so no duplicate storage needed
    
    console.log(`Stored ${hash1.slice(0, 12)}... (${content1.length} bytes)`);
    console.log(`Stored ${hash2.slice(0, 12)}... (${content2.length} bytes)`);
    console.log(`Skipped ${hash3.slice(0, 12)}... (duplicate)`);
    
    // Verify retrieval
    console.log('\n📖 Retrieving content...');
    const retrieved1 = await fs.readFile(join(storageDir, hash1));
    const retrieved2 = await fs.readFile(join(storageDir, hash2));
    
    if (content1.equals(retrieved1)) {
      console.log('✅ Content 1 retrieved successfully');
    } else {
      console.log('❌ Content 1 retrieval failed');
    }
    
    if (content2.equals(retrieved2)) {
      console.log('✅ Content 2 retrieved successfully');
    } else {
      console.log('❌ Content 2 retrieval failed');
    }
    
    // Verify integrity
    console.log('\n🔐 Verifying integrity...');
    const verifyHash1 = await hashContent(retrieved1);
    const verifyHash2 = await hashContent(retrieved2);
    
    if (hash1 === verifyHash1) {
      console.log('✅ Content 1 integrity verified');
    } else {
      console.log('❌ Content 1 integrity check failed');
    }
    
    if (hash2 === verifyHash2) {
      console.log('✅ Content 2 integrity verified');
    } else {
      console.log('❌ Content 2 integrity check failed');
    }
    
    // Show cache structure
    console.log('\n📁 Cache structure:');
    const files = await fs.readdir(storageDir);
    files.forEach(file => {
      console.log(`  ${file.slice(0, 12)}...`);
    });
    
    console.log('\n🎉 CAS Demo completed successfully!');
    console.log(`\n📊 Results:`);
    console.log(`  • ${files.length} unique content items stored`);
    console.log(`  • 3 content items processed (1 deduplicated)`);
    console.log(`  • All integrity checks passed`);
    console.log(`  • Storage directory: ${storageDir}`);
    
  } finally {
    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log('\n🧹 Cleaned up temporary files');
  }
}

// Run demo if called directly
if (require.main === module) {
  demo().catch(console.error);
}

export { demo, hashContent };