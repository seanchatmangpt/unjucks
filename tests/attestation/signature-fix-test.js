/**
 * Fix and validate the signature verification issue
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

import { AttestationGenerator } from '../../packages/kgen-core/src/provenance/attestation/generator.js';
import { CryptoManager } from '../../packages/kgen-core/src/provenance/crypto/manager.js';

async function fixSignatureIssue() {
  console.log('🔧 Fix: Cryptographic Signature Verification\n');
  
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'signature-fix-'));
  console.log(`Working directory: ${tempDir}`);
  
  try {
    // Initialize a single crypto manager that will be shared
    console.log('\n1. Initializing shared CryptoManager...');
    const cryptoManager = new CryptoManager({
      keyPath: path.join(tempDir, 'shared-private.pem'),
      publicKeyPath: path.join(tempDir, 'shared-public.pem'),
      keySize: 2048,
      autoGenerateKeys: true,
      keyPassphrase: 'shared-test-passphrase'
    });
    
    await cryptoManager.initialize();
    console.log('✅ Shared CryptoManager initialized');
    
    // Initialize attestation generator with the SAME crypto manager instance
    console.log('\n2. Initializing AttestationGenerator with shared CryptoManager...');
    const attestationGenerator = new AttestationGenerator({
      enableCryptographicSigning: true,
      // Pass the exact same cryptoManager instance, don't let it create its own
      cryptoManager: cryptoManager
    });
    
    // Don't call attestationGenerator.initialize() as it will create a new crypto manager
    console.log('✅ AttestationGenerator configured with shared CryptoManager');
    
    // Create test artifact
    console.log('\n3. Creating test artifact...');
    const testContent = 'function testFunction() { return "Hello, Attestation!"; }';
    const testPath = path.join(tempDir, 'test-function.js');
    await fs.writeFile(testPath, testContent);
    
    const hash = crypto.createHash('sha256').update(testContent).digest('hex');
    console.log(`Content hash: ${hash}`);
    
    // Prepare context and artifact
    const context = {
      operationId: crypto.randomUUID(),
      type: 'signature-fix-test',
      startTime: new Date(Date.now() - 500),
      endTime: new Date(),
      agent: {
        id: 'fix-test-agent',
        type: 'software',
        name: 'Signature Fix Test Agent'
      }
    };
    
    const artifactInfo = {
      id: crypto.randomUUID(),
      path: testPath,
      size: testContent.length,
      hash: hash
    };
    
    console.log('✅ Test context prepared');
    
    // Generate attestation
    console.log('\n4. Generating attestation...');
    const attestation = await attestationGenerator.generateAttestation(context, artifactInfo);
    
    console.log(`Attestation ID: ${attestation.attestationId}`);
    console.log(`Has signature: ${!!attestation.signature}`);
    console.log(`Signature algorithm: ${attestation.signature?.algorithm}`);
    console.log(`Key fingerprint: ${attestation.signature?.keyFingerprint}`);
    
    // Test verification with the SAME crypto manager
    console.log('\n5. Testing verification with shared CryptoManager...');
    const verificationResult = await cryptoManager.verifyAttestation(attestation);
    console.log(`Verification result: ${verificationResult}`);
    
    if (verificationResult) {
      console.log('✅ SUCCESS: Signature verification passed!');
      
      // Test tampering detection
      console.log('\n6. Testing tampering detection...');
      const tamperedAttestation = JSON.parse(JSON.stringify(attestation));
      tamperedAttestation.artifact.hash = 'tampered_hash_value';
      
      const tamperedVerification = await cryptoManager.verifyAttestation(tamperedAttestation);
      console.log(`Tampered verification result: ${tamperedVerification}`);
      
      if (!tamperedVerification) {
        console.log('✅ SUCCESS: Tampering detection works!');
      } else {
        console.log('❌ FAILED: Tampering detection failed');
      }
      
    } else {
      console.log('❌ FAILED: Signature verification still failing');
      
      // Debug the specific issue
      console.log('\n🔍 Debugging the issue...');
      const signingData = {
        attestationId: attestation.attestationId,
        artifactId: attestation.artifactId,
        artifact: attestation.artifact,
        generation: attestation.generation,
        provenance: attestation.provenance,
        system: attestation.system,
        integrity: attestation.integrity,
        timestamps: attestation.timestamps
      };
      
      console.log('Signing data structure:');
      console.log(JSON.stringify(signingData, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Fix test failed:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`\n🧹 Cleaned up: ${tempDir}`);
    } catch (error) {
      console.warn(`Warning: Failed to cleanup: ${error.message}`);
    }
  }
}

fixSignatureIssue().catch(console.error);