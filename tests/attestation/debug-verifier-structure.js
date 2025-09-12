/**
 * Debug the AttestationVerifier structure validation issue
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

import { AttestationGenerator } from '../../packages/kgen-core/src/provenance/attestation/generator.js';
import { AttestationVerifier } from '../../packages/kgen-core/src/attestation/verifier.js';
import { CryptoManager } from '../../packages/kgen-core/src/provenance/crypto/manager.js';

async function debugVerifierStructure() {
  console.log('🔍 Debug: AttestationVerifier Structure Validation\n');
  
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'debug-verifier-'));
  console.log(`Working directory: ${tempDir}`);
  
  try {
    // Initialize crypto manager
    const cryptoManager = new CryptoManager({
      keyPath: path.join(tempDir, 'debug-private.pem'),
      publicKeyPath: path.join(tempDir, 'debug-public.pem'),
      keySize: 2048,
      autoGenerateKeys: true
    });
    
    await cryptoManager.initialize();
    
    // Initialize attestation generator
    const attestationGenerator = new AttestationGenerator({
      enableCryptographicSigning: true,
      cryptoManager: cryptoManager
    });
    
    const attestationVerifier = new AttestationVerifier();
    
    // Create test artifact
    const testContent = 'console.log("Debug test");';
    const testPath = path.join(tempDir, 'debug.js');
    await fs.writeFile(testPath, testContent);
    
    const hash = crypto.createHash('sha256').update(testContent).digest('hex');
    
    const context = {
      operationId: crypto.randomUUID(),
      type: 'debug-test',
      startTime: new Date(Date.now() - 100),
      endTime: new Date(),
      agent: {
        id: 'debug-agent',
        type: 'software',
        name: 'Debug Agent'
      }
    };
    
    const artifactInfo = {
      id: crypto.randomUUID(),
      path: testPath,
      size: testContent.length,
      hash: hash
    };
    
    // Generate attestation
    const attestation = await attestationGenerator.generateAttestation(context, artifactInfo);
    const sidecarPath = await attestationGenerator.writeAttestationSidecar(testPath, attestation);
    
    console.log('Generated attestation structure:');
    console.log('Fields in attestation:', Object.keys(attestation));
    console.log('');
    
    // Check what the verifier expects vs what we have
    const expectedFields = ['id', 'version', 'timestamp', 'artifact', 'provenance', 'integrity'];
    const actualFields = Object.keys(attestation);
    
    console.log('Verifier expects:', expectedFields);
    console.log('Attestation has:', actualFields);
    console.log('');
    
    const missingFields = expectedFields.filter(field => !attestation[field]);
    const extraFields = actualFields.filter(field => !expectedFields.includes(field));
    
    console.log('Missing fields (verifier expects):', missingFields);
    console.log('Extra fields (not expected by verifier):', extraFields);
    console.log('');
    
    // Check artifact structure
    if (attestation.artifact) {
      const expectedArtifactFields = ['path', 'hash', 'size'];
      const actualArtifactFields = Object.keys(attestation.artifact);
      
      console.log('Artifact - Verifier expects:', expectedArtifactFields);
      console.log('Artifact - Attestation has:', actualArtifactFields);
      
      const missingArtifactFields = expectedArtifactFields.filter(field => !attestation.artifact[field]);
      console.log('Missing artifact fields:', missingArtifactFields);
      console.log('');
    }
    
    // Check integrity structure
    if (attestation.integrity) {
      const expectedIntegrityFields = ['hashAlgorithm', 'verificationChain', 'chainIndex'];
      const actualIntegrityFields = Object.keys(attestation.integrity);
      
      console.log('Integrity - Verifier expects:', expectedIntegrityFields);
      console.log('Integrity - Attestation has:', actualIntegrityFields);
      
      const missingIntegrityFields = expectedIntegrityFields.filter(field => attestation.integrity[field] === undefined);
      console.log('Missing integrity fields:', missingIntegrityFields);
      console.log('');
    }
    
    // Try to verify and see what happens
    console.log('Attempting verification...');
    const verificationResult = await attestationVerifier.fastVerify(testPath);
    console.log('Verification result:', verificationResult);
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`\\n🧹 Cleaned up: ${tempDir}`);
    } catch (error) {
      console.warn(`Warning: Failed to cleanup: ${error.message}`);
    }
  }
}

debugVerifierStructure().catch(console.error);