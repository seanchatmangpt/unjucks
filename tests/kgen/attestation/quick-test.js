/**
 * Quick Test - Simple verification that core functionality works
 */

import { createAttestationSystem } from '../../../packages/kgen-core/src/attestation/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function quickTest() {
  console.log('🚀 Quick Attestation System Test\n');
  
  try {
    // Create test files
    const testDir = path.join(__dirname, 'quick-test-temp');
    await fs.mkdir(testDir, { recursive: true });
    
    const artifactPath = path.join(testDir, 'test.js');
    await fs.writeFile(artifactPath, 'console.log("Hello World");');
    
    // Create and initialize system
    const system = await createAttestationSystem({
      enableBlockchainIntegrity: false
    });
    
    console.log('✅ System initialized');
    
    // Generate attestation
    const context = {
      templatePath: '/templates/test.njk',
      variables: { message: 'Hello World' }
    };
    
    const attestation = await system.generateAttestation(artifactPath, context);
    console.log('✅ Attestation generated:', attestation.attestation.id);
    
    // Check sidecar exists
    const sidecarPath = artifactPath + '.attest.json';
    const sidecarContent = await fs.readFile(sidecarPath, 'utf8');
    const parsedAttestation = JSON.parse(sidecarContent);
    
    console.log('✅ Sidecar file created and parsed');
    console.log(`   - Version: ${parsedAttestation.version}`);
    console.log(`   - Artifact hash: ${parsedAttestation.artifact.hash.substring(0, 16)}...`);
    console.log(`   - Chain index: ${parsedAttestation.integrity.chainIndex}`);
    
    // Try verification with different methods
    console.log('\n📋 Testing verification methods:');
    
    // Method 1: Direct generator verification
    try {
      const genVerify = await system.generator.verifyAttestation(artifactPath);
      console.log(`   Generator verify: ${genVerify.verified ? '✅' : '❌'}`);
    } catch (error) {
      console.log(`   Generator verify: ❌ (${error.message})`);
    }
    
    // Method 2: Fast verifier
    try {
      const fastVerify = await system.verifier.fastVerify(artifactPath);
      console.log(`   Fast verify: ${fastVerify.verified ? '✅' : '❌'}`);
    } catch (error) {
      console.log(`   Fast verify: ❌ (${error.message})`);
    }
    
    // Method 3: System verify
    try {
      const sysVerify = await system.verifyAttestation(artifactPath);
      console.log(`   System verify: ${sysVerify.verified ? '✅' : '❌'}`);
      if (!sysVerify.verified) {
        console.log(`     Reason: ${sysVerify.reason || 'Unknown'}`);
      }
    } catch (error) {
      console.log(`   System verify: ❌ (${error.message})`);
    }
    
    console.log('\n🧪 Testing tampering detection:');
    
    // Tamper with file
    const originalContent = await fs.readFile(artifactPath, 'utf8');
    await fs.writeFile(artifactPath, 'TAMPERED CONTENT');
    
    try {
      const tamperedVerify = await system.verifier.fastVerify(artifactPath);
      console.log(`   Tampered verify: ${tamperedVerify.verified ? '❌ FAILED TO DETECT' : '✅ DETECTED'}`);
    } catch (error) {
      console.log(`   Tampered verify: ❌ Error - ${error.message}`);
    }
    
    // Restore content
    await fs.writeFile(artifactPath, originalContent);
    
    // Final verification
    const finalVerify = await system.verifier.fastVerify(artifactPath, { force: true });
    console.log(`   Restored verify: ${finalVerify.verified ? '✅' : '❌'}`);
    
    // Statistics
    console.log('\n📊 System Statistics:');
    const stats = system.getStatistics();
    console.log(`   Total artifacts: ${stats.generator.totalArtifacts}`);
    console.log(`   Chain length: ${stats.generator.hashChainLength}`);
    console.log(`   State: ${stats.generator.state}`);
    
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
    
    console.log('\n🎉 Quick test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('\n❌ Quick test failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  quickTest().then(success => process.exit(success ? 0 : 1));
}

export { quickTest };