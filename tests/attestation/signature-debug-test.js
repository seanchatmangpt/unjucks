/**
 * Signature Debug Test
 * Focused test to debug signature verification issues
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

import { AttestationGenerator } from '../../packages/kgen-core/src/provenance/attestation/generator.js';
import { CryptoManager } from '../../packages/kgen-core/src/provenance/crypto/manager.js';

async function debugSignatureVerification() {
  console.log('🔍 Debug: Signature Verification Issue\n');
  
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'signature-debug-'));
  console.log(`Working directory: ${tempDir}`);
  
  try {
    // Initialize crypto manager
    console.log('\n1. Initializing CryptoManager...');
    const cryptoManager = new CryptoManager({
      keyPath: path.join(tempDir, 'debug-private.pem'),
      publicKeyPath: path.join(tempDir, 'debug-public.pem'),
      keySize: 2048,
      autoGenerateKeys: true,
      keyPassphrase: 'debug-test-passphrase'
    });
    
    await cryptoManager.initialize();
    console.log('✅ CryptoManager initialized');
    
    // Initialize attestation generator
    console.log('\n2. Initializing AttestationGenerator...');
    const attestationGenerator = new AttestationGenerator({
      enableCryptographicSigning: true,
      cryptoManager: cryptoManager
    });
    
    await attestationGenerator.initialize();
    console.log('✅ AttestationGenerator initialized');
    
    // Create test content
    console.log('\n3. Creating test artifact...');
    const testContent = 'console.log("Hello, World!");';
    const testPath = path.join(tempDir, 'hello.js');
    await fs.writeFile(testPath, testContent);
    
    const hash = crypto.createHash('sha256').update(testContent).digest('hex');
    console.log(`Content hash: ${hash}`);
    
    // Prepare context
    const context = {
      operationId: crypto.randomUUID(),
      type: 'debug-test',
      startTime: new Date(Date.now() - 100),
      endTime: new Date(),
      agent: {
        id: 'debug-agent',
        type: 'software',
        name: 'Debug Test Agent'
      }
    };
    
    const artifactInfo = {
      id: crypto.randomUUID(),
      path: testPath,
      size: testContent.length,
      hash: hash
    };
    
    console.log('✅ Test artifact created');
    
    // Generate attestation
    console.log('\n4. Generating attestation...');
    const attestation = await attestationGenerator.generateAttestation(context, artifactInfo);
    
    console.log(`Attestation ID: ${attestation.attestationId}`);
    console.log(`Signature algorithm: ${attestation.signature?.algorithm}`);
    console.log(`Key fingerprint: ${attestation.signature?.keyFingerprint}`);
    console.log(`Signature length: ${attestation.signature?.signature?.length || 'undefined'}`);
    
    // Debug: Check what data was signed
    console.log('\n5. Debugging signature data...');
    
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
    
    console.log('Signing data keys:', Object.keys(signingData));
    
    // Test signature verification step by step
    console.log('\n6. Testing signature verification...');
    
    // Method 1: Direct crypto manager verification
    console.log('Method 1: CryptoManager.verifyAttestation()');
    try {
      const result1 = await cryptoManager.verifyAttestation(attestation);
      console.log(`Result: ${result1}`);
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
    
    // Method 2: Manual verification using Node.js crypto
    console.log('\nMethod 2: Manual verification with Node.js crypto');
    try {
      const canonicalJson = JSON.stringify(signingData, Object.keys(signingData).sort());
      console.log(`Canonical JSON length: ${canonicalJson.length}`);
      
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(canonicalJson, 'utf8');
      
      const publicKey = cryptoManager.publicKey;
      const signature = attestation.signature.signature;
      
      console.log(`Public key type: ${typeof publicKey}`);
      console.log(`Signature type: ${typeof signature}`);
      console.log(`Public key starts with: ${publicKey?.substring(0, 30)}...`);
      
      const result2 = verify.verify(publicKey, signature, 'base64');
      console.log(`Result: ${result2}`);
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
    
    // Method 3: Test signing and verifying a simple string
    console.log('\nMethod 3: Simple string sign/verify test');
    try {
      const testString = 'Hello, World!';
      const testSignature = await cryptoManager.signData(testString);
      console.log(`Test signature: ${testSignature.substring(0, 30)}...`);
      
      const testVerification = await cryptoManager.verifySignature(testString, testSignature);
      console.log(`Simple verification result: ${testVerification}`);
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
    
    // Method 4: Check if the issue is with the attestation structure
    console.log('\nMethod 4: Re-sign the attestation data manually');
    try {
      const manualSignature = await cryptoManager.signData(signingData);
      console.log(`Manual signature: ${manualSignature.substring(0, 30)}...`);
      
      const manualVerification = await cryptoManager.verifySignature(signingData, manualSignature);
      console.log(`Manual verification result: ${manualVerification}`);
      
      // Compare with original signature
      console.log(`Original signature: ${attestation.signature.signature.substring(0, 30)}...`);
      console.log(`Signatures match: ${manualSignature === attestation.signature.signature}`);
      
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
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

debugSignatureVerification().catch(console.error);