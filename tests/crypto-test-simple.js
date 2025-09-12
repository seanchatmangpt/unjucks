#!/usr/bin/env node

/**
 * Simple Cryptographic Test
 * 
 * Tests the enhanced JOSE/Ed25519 implementation to ensure
 * real signatures are working and fake signatures are replaced.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module directory resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the enhanced cryptographic systems
import JOSESigningManager from '../packages/kgen-core/src/provenance/signing.js';
import KeyManager from '../packages/kgen-core/src/provenance/keys.js';

const TEST_DIR = path.join(__dirname, 'temp', 'simple-crypto-test');

async function runSimpleTest() {
  console.log('🔐 Simple KGEN Cryptographic Test\n');
  
  try {
    // Setup
    await fs.mkdir(TEST_DIR, { recursive: true });
    
    console.log('1️⃣ Testing Ed25519 Key Generation...');
    
    // Initialize key manager
    const keyManager = new KeyManager({
      keysDirectory: TEST_DIR,
      ed25519PrivateKeyPath: path.join(TEST_DIR, 'test-private.key'),
      ed25519PublicKeyPath: path.join(TEST_DIR, 'test-public.key')
    });
    
    await keyManager.initialize();
    
    // Generate Ed25519 key pair
    const keyInfo = await keyManager.generateEd25519KeyPair();
    console.log('✅ Ed25519 key pair generated:', {
      algorithm: keyInfo.algorithm,
      curve: keyInfo.curve,
      publicKeyHex: keyInfo.publicKeyHex?.substring(0, 16) + '...'
    });
    
    console.log('2️⃣ Testing JOSE Signing...');
    
    // Initialize JOSE manager
    const joseManager = new JOSESigningManager({
      keyPath: path.join(TEST_DIR, 'test-private.key'),
      publicKeyPath: path.join(TEST_DIR, 'test-public.key')
    });
    
    await joseManager.initialize();
    
    // Test payload
    const testPayload = {
      artifact: {
        path: '/test/file.js',
        hash: 'sha256:0123456789abcdef',
        size: 1024
      },
      generation: {
        operationId: 'simple-test-001',
        timestamp: new Date().toISOString()
      }
    };
    
    // Sign the payload
    const jwt = await joseManager.signAttestation(testPayload);
    console.log('✅ JWT signed:', {
      parts: jwt.split('.').length,
      header: jwt.split('.')[0],
      length: jwt.length
    });
    
    console.log('3️⃣ Testing JOSE Verification...');
    
    // Verify the signature
    const verification = await joseManager.verifyAttestation(jwt);
    console.log('✅ JWT verified:', {
      valid: verification.valid,
      hasPayload: !!verification.payload,
      verifiedAt: verification.verifiedAt
    });
    
    if (!verification.valid) {
      throw new Error('JWT verification failed');
    }
    
    console.log('4️⃣ Testing Complete Attestation Flow...');
    
    // Create a test file
    const testFilePath = path.join(TEST_DIR, 'test-artifact.js');
    const testContent = '// Test JavaScript file\\nconsole.log(\"Hello, KGEN with real crypto!\");\\n';
    await fs.writeFile(testFilePath, testContent);
    
    // Generate attestation with signature
    const crypto = await import('crypto');
    const signedAttestation = await joseManager.createSignedAttestation({
      artifact: {
        path: testFilePath,
        hash: 'sha256:' + crypto.createHash('sha256').update(testContent).digest('hex'),
        size: testContent.length
      },
      generation: {
        operationId: 'complete-test-001',
        timestamp: new Date().toISOString()
      }
    });
    
    console.log('✅ Complete attestation created:', {
      version: signedAttestation.version,
      signatureFormat: signedAttestation.signature?.format,
      signatureAlgorithm: signedAttestation.signature?.algorithm,
      signedAt: signedAttestation.signature?.signedAt
    });
    
    // Cleanup
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    
    console.log('\\n🎉 All tests passed! Real Ed25519 cryptographic signatures are working.');
    console.log('✨ KGEN now has authentic cryptographic attestation instead of fake signatures.');
    
    return true;
    
  } catch (error) {
    console.error('\\n❌ Test failed:', error.message);
    console.error(error.stack);
    
    // Cleanup on failure
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    return false;
  }
}

// Run test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSimpleTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { runSimpleTest };