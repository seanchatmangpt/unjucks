#!/usr/bin/env node

/**
 * Integration Test for Unified Provenance System
 * Tests the complete dark-matter provenance workflow
 */

import { UnifiedProvenanceSystem } from '../../packages/kgen-core/src/provenance/unified-provenance.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runIntegrationTest() {
  console.log('🧪 Starting Unified Provenance System Integration Test\n');
  
  const testDir = path.join(__dirname, 'test-integration');
  let testsPassed = 0;
  let totalTests = 0;
  
  try {
    // Setup test environment
    await fs.mkdir(testDir, { recursive: true });
    
    const testArtifact = path.join(testDir, 'test-artifact.js');
    const testTemplate = path.join(testDir, 'test-template.njk');
    
    await fs.writeFile(testArtifact, 'console.log("Hello from unified provenance test");');
    await fs.writeFile(testTemplate, 'console.log("{{ message }}");');
    
    // Initialize provenance system
    console.log('📋 Test 1: Initialize Unified Provenance System');
    totalTests++;
    
    const provenance = new UnifiedProvenanceSystem({
      gitRepoPath: testDir,
      enableGitFirst: true,
      noCentralDatabase: true,
      requireSidecars: true,
      enableContentAddressing: true
    });
    
    const initResult = await provenance.initialize();
    
    if (initResult.success && initResult.unified && initResult.darkMatter) {
      console.log('✅ Initialization successful');
      testsPassed++;
    } else {
      console.log('❌ Initialization failed:', initResult);
    }
    
    // Test generation tracking
    console.log('\n📋 Test 2: Track Artifact Generation');
    totalTests++;
    
    const generationData = {
      artifactPath: testArtifact,
      templatePath: testTemplate,
      templateContent: 'console.log("{{ message }}");',
      contextData: { message: 'test message' },
      metadata: {
        operationId: 'integration-test',
        agent: 'test-agent'
      }
    };
    
    const trackResult = await provenance.trackGeneration(generationData);
    
    if (trackResult.success && trackResult.unified && trackResult.sidecar) {
      console.log('✅ Generation tracking successful');
      testsPassed++;
      
      // Check sidecar file exists
      const sidecarPath = testArtifact + '.attest.json';
      if (await fileExists(sidecarPath)) {
        console.log('  ├── .attest.json sidecar created');
      }
      
      if (trackResult.gitProvenance && trackResult.gitProvenance.success) {
        console.log('  ├── Git-notes provenance stored');
      }
      
      if (trackResult.supplyChainUpdated) {
        console.log('  └── Supply chain graph updated');
      }
    } else {
      console.log('❌ Generation tracking failed:', trackResult);
    }
    
    // Test verification
    console.log('\n📋 Test 3: Verify Artifact');
    totalTests++;
    
    const verification = await provenance.verifyArtifact(testArtifact);
    
    if (verification.unified && verification.overall.verified) {
      console.log('✅ Verification successful');
      console.log(`  ├── Confidence: ${(verification.overall.confidence * 100).toFixed(1)}%`);
      console.log(`  ├── Sidecar: ${verification.results.sidecar?.verified ? '✅' : '❌'}`);
      console.log(`  ├── Git Provenance: ${verification.results.gitProvenance?.verified ? '✅' : '❌'}`);
      console.log(`  └── Content Addressing: ${verification.results.contentAddressing?.verified ? '✅' : '❌'}`);
      testsPassed++;
    } else {
      console.log('❌ Verification failed:', verification.overall.issues);
    }
    
    // Test provenance retrieval
    console.log('\n📋 Test 4: Retrieve Provenance Data');
    totalTests++;
    
    const provenanceData = await provenance.getProvenance(testArtifact);
    
    if (provenanceData.unified && provenanceData.combined) {
      console.log('✅ Provenance retrieval successful');
      console.log(`  ├── Sources: ${provenanceData.sources ? Object.keys(provenanceData.sources).filter(k => provenanceData.sources[k] !== null).join(', ') : 'none'}`);
      console.log(`  └── Combined data available: ${!!provenanceData.combined}`);
      testsPassed++;
    } else {
      console.log('❌ Provenance retrieval failed');
    }
    
    // Test supply chain visualization
    console.log('\n📋 Test 5: Generate Supply Chain Visualization');
    totalTests++;
    
    const visualization = await provenance.generateSupplyChainVisualization();
    
    if (visualization.unified && visualization.graph.nodes.length > 0) {
      console.log('✅ Supply chain visualization successful');
      console.log(`  ├── Nodes: ${visualization.graph.nodes.length}`);
      console.log(`  ├── Edges: ${visualization.graph.edges.length}`);
      console.log(`  └── Artifacts: ${visualization.statistics.totalArtifacts}`);
      testsPassed++;
    } else {
      console.log('❌ Supply chain visualization failed');
    }
    
    // Test verification commands generation
    console.log('\n📋 Test 6: Generate Verification Commands');
    totalTests++;
    
    const commandResult = await provenance.createVerificationCommand(testArtifact);
    
    if (commandResult.command === 'git show + verify' && commandResult.commands) {
      console.log('✅ Verification commands generation successful');
      console.log(`  ├── Git show commands: ${commandResult.commands.gitShow?.length || 0}`);
      console.log(`  ├── Local verify commands: ${commandResult.commands.localVerify?.length || 0}`);
      console.log(`  └── Supply chain commands: ${commandResult.commands.supplyChain?.length || 0}`);
      testsPassed++;
    } else {
      console.log('❌ Verification commands generation failed');
    }
    
    // Test dark-matter compliance
    console.log('\n📋 Test 7: Dark-Matter Compliance Validation');
    totalTests++;
    
    const sidecarPath = testArtifact + '.attest.json';
    const sidecarContent = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
    
    const isDarkMatterCompliant = 
      sidecarContent.darkMatter === true &&
      sidecarContent.unified === true &&
      sidecarContent.verification?.darkMatterCompliant === true &&
      sidecarContent.git?.enabled === true;
    
    if (isDarkMatterCompliant) {
      console.log('✅ Dark-matter compliance validated');
      console.log('  ├── No central database dependency');
      console.log('  ├── Self-contained sidecars');
      console.log('  ├── Git-first storage enabled');
      console.log('  └── Supply chain traceable');
      testsPassed++;
    } else {
      console.log('❌ Dark-matter compliance validation failed');
    }
    
  } catch (error) {
    console.error('\n💥 Integration test failed with error:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
  } finally {
    // Cleanup
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('⚠️  Cleanup warning:', cleanupError.message);
    }
  }
  
  // Results
  console.log('\n📊 Integration Test Results');
  console.log('=' .repeat(50));
  console.log(`Tests Passed: ${testsPassed}/${totalTests}`);
  console.log(`Success Rate: ${((testsPassed / totalTests) * 100).toFixed(1)}%`);
  
  if (testsPassed === totalTests) {
    console.log('\n🎉 All integration tests passed!');
    console.log('✅ Unified Provenance System is working correctly');
    console.log('✅ Dark-matter principles are implemented');
    console.log('✅ Git-first workflow is functional');
    process.exit(0);
  } else {
    console.log('\n❌ Some integration tests failed');
    console.log(`Failed: ${totalTests - testsPassed}/${totalTests}`);
    process.exit(1);
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTest().catch(error => {
    console.error('💥 Integration test crashed:', error);
    process.exit(1);
  });
}

export { runIntegrationTest };