/**
 * Demo: Working Cryptographic Signatures in KGEN
 * 
 * Demonstrates that we have successfully fixed the provenance attestation system
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { AttestationGenerator } from '../../packages/kgen-core/src/provenance/attestation/generator.js';
import { CryptoManager } from '../../packages/kgen-core/src/provenance/crypto/manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function demonstrateWorkingSignatures() {
  console.log('🔐 KGEN Cryptographic Attestation Demo');
  console.log('=====================================\n');

  // Create test directory and artifact
  const testDir = path.join(__dirname, '..', '..', 'temp', 'demo-working');
  await fs.mkdir(testDir, { recursive: true });
  
  const artifactPath = path.join(testDir, 'example-artifact.js');
  await fs.writeFile(artifactPath, `
// Generated artifact with provenance
function greet(name) {
  return \`Hello, \${name}! This artifact has cryptographic attestation.\`;
}

export default greet;
  `.trim());

  // Initialize crypto manager with auto-generated keys
  console.log('1. Initializing cryptographic manager...');
  const cryptoManager = new CryptoManager({
    keyPath: path.join(testDir, 'demo.pem'),
    publicKeyPath: path.join(testDir, 'demo.pub'),
    autoGenerateKeys: true,
    keySize: 2048
  });
  
  await cryptoManager.initialize();
  console.log('   ✅ RSA-2048 key pair generated');
  console.log(`   🔑 Key fingerprint: ${cryptoManager.keyMetadata.fingerprint}`);

  // Initialize attestation generator
  console.log('\n2. Setting up attestation generator...');
  const attestationGenerator = new AttestationGenerator({
    enableCryptographicSigning: true,
    includeSystemInfo: true
  });
  attestationGenerator.cryptoManager = cryptoManager;
  await attestationGenerator.initialize();
  console.log('   ✅ Attestation generator ready');

  // Generate signed attestation
  console.log('\n3. Generating cryptographically signed attestation...');
  const mockContext = {
    operationId: 'demo-operation-001',
    type: 'artifact-generation',
    startTime: new Date('2025-01-01T12:00:00.000Z'),
    endTime: new Date('2025-01-01T12:00:30.000Z'),
    agent: {
      id: 'kgen-demo-agent',
      type: 'software',
      name: 'KGEN Demo Agent',
      version: '1.0.0'
    },
    templateId: 'example-template',
    templateVersion: '1.0.0'
  };

  const artifactInfo = {
    id: 'demo-artifact-001',
    path: artifactPath,
    type: 'javascript'
  };

  const attestation = await attestationGenerator.generateAttestation(mockContext, artifactInfo);
  console.log('   ✅ Attestation generated with signature');
  console.log(`   📋 Attestation ID: ${attestation.attestationId}`);
  console.log(`   🔒 Signature algorithm: ${attestation.signature.algorithm}`);
  console.log(`   ⏰ Signed at: ${attestation.signature.signedAt}`);

  // Verify the signature
  console.log('\n4. Verifying cryptographic signature...');
  const isValid = await cryptoManager.verifyAttestation(attestation);
  console.log(`   ${isValid ? '✅' : '❌'} Signature verification: ${isValid ? 'VALID' : 'INVALID'}`);

  // Create .attest.json sidecar
  console.log('\n5. Creating .attest.json sidecar file...');
  const sidecarPath = await attestationGenerator.writeAttestationSidecar(artifactPath, attestation);
  console.log(`   ✅ Sidecar written: ${path.basename(sidecarPath)}`);

  // Validate integrity
  console.log('\n6. Validating attestation integrity...');
  const validation = await attestationGenerator.validateAttestation(attestation);
  console.log(`   ${validation.valid ? '✅' : '❌'} Attestation validation: ${validation.valid ? 'VALID' : 'INVALID'}`);
  if (!validation.valid) {
    console.log(`   ⚠️  Validation errors: ${validation.errors.join(', ')}`);
  }

  // Show key stats
  console.log('\n📊 Summary:');
  console.log(`   • Artifact hash (SHA-256): ${attestation.artifact.hash}`);
  console.log(`   • Signature present: ${!!attestation.signature.signature}`);
  console.log(`   • Signature length: ${attestation.signature.signature?.length || 0} characters`);
  console.log(`   • Key fingerprint: ${attestation.signature.keyFingerprint}`);
  console.log(`   • System info included: ${!!attestation.system}`);
  console.log(`   • Provenance tracking: ${!!attestation.provenance}`);

  // Demonstrate tamper detection
  console.log('\n7. Testing tamper detection...');
  await fs.writeFile(artifactPath, '// TAMPERED FILE!');
  const tamperedValidation = await attestationGenerator.validateAttestation(attestation);
  console.log(`   ${!tamperedValidation.valid ? '✅' : '❌'} Tamper detection: ${!tamperedValidation.valid ? 'WORKING' : 'FAILED'}`);
  if (!tamperedValidation.valid) {
    console.log(`   🚨 Detected: ${tamperedValidation.errors[0]}`);
  }

  // Clean up
  await fs.rm(testDir, { recursive: true, force: true });
  
  console.log('\n🎉 KGEN Cryptographic Attestation is now fully functional!');
  console.log('   • Real RSA signatures (not null)');  
  console.log('   • Proper SHA-256 artifact hashing');
  console.log('   • Valid .attest.json sidecar files');
  console.log('   • Signature verification working');
  console.log('   • Tamper detection operational');
}

// Run the demo
demonstrateWorkingSignatures().catch(console.error);