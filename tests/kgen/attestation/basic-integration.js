/**
 * Basic Integration Test for Attestation System
 * 
 * Simple test to verify the attestation system works end-to-end
 */

import { createAttestationSystem } from '../../../packages/kgen-core/src/attestation/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runBasicIntegrationTest() {
  console.log('🧪 Running Basic Attestation System Integration Test...\n');
  
  try {
    // Create test directory
    const testDir = path.join(__dirname, 'basic-test-temp');
    await fs.mkdir(testDir, { recursive: true });
    
    // Initialize attestation system
    console.log('1️⃣ Initializing attestation system...');
    const system = await createAttestationSystem({
      enableBlockchainIntegrity: false // Disable for testing
    });
    console.log('✅ Attestation system initialized');
    
    // Create test artifact
    console.log('\n2️⃣ Creating test artifact...');
    const artifactPath = path.join(testDir, 'test-component.jsx');
    const artifactContent = `import React from 'react';

export const TestComponent = () => {
  return <div>Hello World</div>;
};`;
    
    await fs.writeFile(artifactPath, artifactContent);
    console.log('✅ Test artifact created:', path.basename(artifactPath));
    
    // Generate attestation
    console.log('\n3️⃣ Generating attestation...');
    const context = {
      templatePath: '/templates/react-component.njk',
      templateHash: 'test-template-hash-123',
      sourceGraph: {
        Component: { name: 'string', props: 'object' }
      },
      variables: {
        name: 'TestComponent',
        content: 'Hello World'
      },
      agent: 'test-generator',
      templateFamily: 'react-components'
    };
    
    const attestationResult = await system.generateAttestation(artifactPath, context);
    console.log('✅ Attestation generated');
    console.log(`   - Attestation ID: ${attestationResult.attestation.id}`);
    console.log(`   - Artifact Hash: ${attestationResult.artifactHash.substring(0, 16)}...`);
    console.log(`   - Sidecar Path: ${path.basename(attestationResult.sidecarPath)}`);
    
    // Verify sidecar file exists
    console.log('\n4️⃣ Verifying sidecar file...');
    const sidecarExists = await fs.access(attestationResult.sidecarPath).then(() => true).catch(() => false);
    if (sidecarExists) {
      console.log('✅ Sidecar file exists');
      
      const sidecarContent = await fs.readFile(attestationResult.sidecarPath, 'utf8');
      const parsedAttestation = JSON.parse(sidecarContent);
      console.log(`   - Version: ${parsedAttestation.version}`);
      console.log(`   - Chain Index: ${parsedAttestation.integrity.chainIndex}`);
    } else {
      throw new Error('Sidecar file not found');
    }
    
    // Verify attestation
    console.log('\n5️⃣ Verifying attestation...');
    const verification = await system.verifyAttestation(artifactPath);
    if (verification.verified) {
      console.log('✅ Attestation verified successfully');
      console.log(`   - Hash verification: ${verification.verificationDetails?.hash?.verified ? '✅' : '❌'}`);
      console.log(`   - Structure verification: ${verification.verificationDetails?.structure?.verified ? '✅' : '❌'}`);
    } else {
      throw new Error(`Verification failed: ${verification.reason}`);
    }
    
    // Explain artifact
    console.log('\n6️⃣ Explaining artifact origin...');
    const explanation = await system.explainArtifact(artifactPath);
    if (explanation.success) {
      console.log('✅ Artifact explanation generated');
      console.log(`   - Template: ${path.basename(explanation.explanation.origin.template.path || 'unknown')}`);
      console.log(`   - Template Version: ${explanation.explanation.origin.template.version}`);
      console.log(`   - Generated At: ${new Date(explanation.explanation.artifact.generatedAt).toLocaleString()}`);
      console.log(`   - Chain Position: ${explanation.explanation.lineage.chainPosition}`);
    } else {
      throw new Error(`Explanation failed: ${explanation.reason}`);
    }
    
    // Test tamper detection
    console.log('\n7️⃣ Testing tamper detection...');
    const originalContent = await fs.readFile(artifactPath, 'utf8');
    await fs.writeFile(artifactPath, 'TAMPERED CONTENT');
    
    const tamperedVerification = await system.verifyAttestation(artifactPath);
    if (!tamperedVerification.verified) {
      console.log('✅ Tamper detection working');
      console.log(`   - Reason: ${tamperedVerification.verificationDetails?.hash?.reason}`);
    } else {
      throw new Error('Tamper detection failed - should have detected modification');
    }
    
    // Restore original content
    await fs.writeFile(artifactPath, originalContent);
    
    // Test system statistics
    console.log('\n8️⃣ Checking system statistics...');
    const stats = system.getStatistics();
    console.log('✅ Statistics retrieved');
    console.log(`   - Total Artifacts: ${stats.generator.totalArtifacts}`);
    console.log(`   - Hash Chain Length: ${stats.generator.hashChainLength}`);
    console.log(`   - Template Versions: ${stats.generator.templateVersions}`);
    console.log(`   - System State: ${stats.generator.state}`);
    
    // Cleanup
    console.log('\n9️⃣ Cleaning up...');
    await fs.rm(testDir, { recursive: true, force: true });
    console.log('✅ Test directory cleaned up');
    
    console.log('\n🎉 Basic Integration Test PASSED');
    console.log('\n📊 Summary:');
    console.log('   ✅ Attestation generation');
    console.log('   ✅ Sidecar file creation');
    console.log('   ✅ Attestation verification');
    console.log('   ✅ Artifact explanation');
    console.log('   ✅ Tamper detection');
    console.log('   ✅ System statistics');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Basic Integration Test FAILED');
    console.error('Error:', error.message);
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    return false;
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBasicIntegrationTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

export { runBasicIntegrationTest };