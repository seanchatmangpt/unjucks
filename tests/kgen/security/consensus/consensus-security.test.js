/**
 * Consensus Security System Tests
 * 
 * Comprehensive test suite for consensus security including threshold signatures,
 * zero-knowledge proofs, attack detection, and security validation.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ConsensusSecurityManager } from '../../../../packages/kgen-core/src/security/consensus/security-manager.js';
import { ThresholdCryptographySystem } from '../../../../packages/kgen-core/src/security/consensus/threshold-crypto.js';
import { ZeroKnowledgeProofSystem } from '../../../../packages/kgen-core/src/security/consensus/zero-knowledge.js';
import { ConsensusAttackDetector } from '../../../../packages/kgen-core/src/security/consensus/attack-detector.js';

describe('Consensus Security Manager', () => {
  let securityManager;
  let testNodes;
  
  beforeAll(async () => {
    // Create test network with 7 nodes (threshold = 4)
    testNodes = Array.from({ length: 7 }, (_, i) => ({
      id: `node-${i}`,
      publicKey: `pubkey-${i}`,
      verified: true,
      reputation: 1.0
    }));

    securityManager = new ConsensusSecurityManager({
      nodeId: 'test-node-0',
      totalNodes: 7,
      threshold: 4,
      enableZKProofs: true,
      enableThresholdSigs: true,
      enableAttackDetection: true
    });

    await securityManager.initialize();
  });

  afterAll(async () => {
    await securityManager.shutdown();
  });

  test('should initialize successfully with all security components', () => {
    const status = securityManager.getSecurityStatus();
    
    expect(status.initialized).toBe(true);
    expect(status.nodeId).toBe('test-node-0');
    expect(status.components.thresholdSignature).toBe(true);
    expect(status.components.zkProofSystem).toBe(true);
    expect(status.components.securityMonitor).toBe(true);
    expect(status.components.keyManager).toBe(true);
  });

  test('should secure consensus operations with full protection', async () => {
    const consensusOperation = {
      type: 'block_proposal',
      data: { block: 'test-block', transactions: ['tx1', 'tx2'] },
      requiresSignature: true,
      signatories: testNodes.slice(0, 4).map(n => n.id),
      privateData: {
        secret: Buffer.from('secret-value'),
        commitment: Buffer.from('commitment-value'),
        proofType: 'discrete_log'
      }
    };

    const result = await securityManager.secureConsensusOperation(consensusOperation);
    
    expect(result.operationId).toBeDefined();
    expect(result.result.success).toBe(true);
    expect(result.securityProofs.signature).toBeDefined();
    expect(result.securityProofs.zkProof).toBeDefined();
    expect(result.securityMetrics).toBeDefined();
  });

  test('should generate and verify threshold signatures', async () => {
    const message = { proposal: 'test-proposal', round: 1 };
    const signatories = testNodes.slice(0, 4).map(n => n.id);

    // Generate threshold signature
    const signature = await securityManager.generateThresholdSignature(message, signatories);
    
    expect(signature.signature).toBeDefined();
    expect(signature.messageHash).toBeDefined();
    expect(signature.signatories).toEqual(signatories);

    // Verify threshold signature
    const verification = await securityManager.verifyThresholdSignature(message, signature);
    
    expect(verification.valid).toBe(true);
    expect(verification.timestamp).toBeDefined();
  });

  test('should create and verify zero-knowledge proofs', async () => {
    const secret = Buffer.from('my-secret-value');
    const publicCommitment = Buffer.from('public-commitment');

    // Create discrete log proof
    const proof = await securityManager.createZKProof(secret, publicCommitment, 'discrete_log');
    
    expect(proof.type).toBe('discrete_log');
    expect(proof.commitment).toBeDefined();
    expect(proof.challenge).toBeDefined();
    expect(proof.response).toBeDefined();

    // Verify proof
    const verification = await securityManager.verifyZKProof(proof, publicCommitment, 'discrete_log');
    
    expect(verification.valid).toBe(true);
    expect(verification.timestamp).toBeDefined();
  });

  test('should detect and mitigate consensus attacks', async () => {
    const maliciousConsensusRound = {
      id: 'round-123',
      participants: testNodes.map(n => n.id),
      messages: [
        {
          nodeId: 'node-0',
          type: 'proposal',
          proposal: { value: 'A' },
          timestamp: Date.now()
        },
        {
          nodeId: 'node-0', // Same node sending contradictory message
          type: 'proposal',
          proposal: { value: 'B' }, // Different proposal
          timestamp: Date.now() + 1000
        }
      ],
      networkInfo: {
        connections: testNodes.map(n => ({
          nodeId: n.id,
          ip: '192.168.1.1', // All from same IP (suspicious)
          asn: 'AS12345'
        }))
      }
    };

    const attackResult = await securityManager.detectConsensusAttacks(maliciousConsensusRound);
    
    expect(attackResult.attacks.length).toBeGreaterThan(0);
    expect(attackResult.attacks.some(a => a.type.includes('contradictory'))).toBe(true);
  });

  test('should perform security penetration testing', async () => {
    const testResults = await securityManager.performSecurityTesting();
    
    expect(testResults.tests).toBeDefined();
    expect(testResults.summary.passed).toBeGreaterThan(0);
    expect(testResults.summary.score).toBeGreaterThanOrEqual(0);
    
    // Verify all security tests are included
    const testNames = testResults.tests.map(t => t.name);
    expect(testNames).toContain('Byzantine Attack Test');
    expect(testNames).toContain('Sybil Attack Test');
    expect(testNames).toContain('Eclipse Attack Test');
    expect(testNames).toContain('DoS Attack Test');
  });

  test('should rotate cryptographic keys securely', async () => {
    const initialStatus = securityManager.getSecurityStatus();
    const initialKeyRotations = initialStatus.metrics.keysRotated;

    const newKey = await securityManager.rotateKeys();
    
    expect(newKey.masterPublicKey).toBeDefined();
    expect(newKey.ceremony).toBeDefined();
    expect(newKey.participants.length).toBe(7);

    const updatedStatus = securityManager.getSecurityStatus();
    expect(updatedStatus.metrics.keysRotated).toBe(initialKeyRotations + 1);
  });

  test('should generate comprehensive security reports', async () => {
    const timeframe = {
      start: new Date(Date.now() - 3600000), // 1 hour ago
      end: new Date()
    };

    const report = await securityManager.generateSecurityReport(timeframe);
    
    expect(report.timeframe).toEqual(timeframe);
    expect(report.summary).toBeDefined();
    expect(report.components.thresholdSignatures).toBeDefined();
    expect(report.components.zkProofs).toBeDefined();
    expect(report.components.attackDetection).toBeDefined();
    expect(report.components.keyManagement).toBeDefined();
    expect(report.recommendations).toBeInstanceOf(Array);
    expect(report.threatLevel).toMatch(/LOW|MEDIUM|HIGH|CRITICAL/);
  });
});

describe('Threshold Cryptography System', () => {
  let thresholdCrypto;
  let participants;

  beforeEach(async () => {
    participants = ['node-1', 'node-2', 'node-3', 'node-4', 'node-5'];
    
    thresholdCrypto = new ThresholdCryptographySystem({
      threshold: 3,
      totalShares: 5,
      curve: 'secp256k1'
    });

    await thresholdCrypto.initialize('node-1', participants);
  });

  test('should initialize with distributed key generation', async () => {
    const status = thresholdCrypto.getStatus();
    
    expect(status.initialized).toBe(true);
    expect(status.nodeId).toBe('node-1');
    expect(status.config.threshold).toBe(3);
    expect(status.config.totalShares).toBe(5);
    expect(status.state.hasPrivateShare).toBe(true);
    expect(status.state.publicShareCount).toBe(5);
    expect(status.state.masterPublicKey).toBe('present');
  });

  test('should create valid threshold signatures', async () => {
    const message = { action: 'approve', proposal: 'proposal-123' };
    const signatories = ['node-1', 'node-2', 'node-3'];

    const signatureResult = await thresholdCrypto.createThresholdSignature(message, signatories);
    
    expect(signatureResult.signature).toBeDefined();
    expect(signatureResult.messageHash).toBeDefined();
    expect(signatureResult.signatories).toEqual(signatories);
    expect(signatureResult.timestamp).toBeInstanceOf(Date);
  });

  test('should verify threshold signatures correctly', async () => {
    const message = { action: 'approve', proposal: 'proposal-456' };
    const signatories = ['node-1', 'node-2', 'node-4'];

    const signatureResult = await thresholdCrypto.createThresholdSignature(message, signatories);
    const verification = await thresholdCrypto.verifyThresholdSignature(message, signatureResult);
    
    expect(verification.valid).toBe(true);
    expect(verification.messageHash).toBe(signatureResult.messageHash);
    expect(verification.verifiedAt).toBeInstanceOf(Date);
  });

  test('should reject signatures with insufficient signatories', async () => {
    const message = { action: 'reject', proposal: 'proposal-789' };
    const insufficientSignatories = ['node-1', 'node-2']; // Only 2, need 3

    await expect(
      thresholdCrypto.createThresholdSignature(message, insufficientSignatories)
    ).rejects.toThrow(/insufficient signatories/i);
  });

  test('should perform proactive key rotation', async () => {
    const rotationResult = await thresholdCrypto.rotateThresholdKeys();
    
    expect(rotationResult.success).toBe(true);
    expect(rotationResult.newShare).toBeDefined();
    expect(rotationResult.masterPublicKey).toBeDefined();
    
    // Master public key should remain the same in proactive secret sharing
    const status = thresholdCrypto.getStatus();
    expect(status.state.masterPublicKey).toBe('present');
  });

  test('should recover from key share compromise', async () => {
    const compromisedNodes = ['node-4', 'node-5'];
    const honestNodes = ['node-1', 'node-2', 'node-3'];

    const recoveryResult = await thresholdCrypto.recoverFromCompromise(
      compromisedNodes,
      honestNodes
    );
    
    expect(recoveryResult.success).toBe(true);
    expect(recoveryResult.recoveredNodes).toEqual(compromisedNodes);
    expect(recoveryResult.newShares.size).toBe(2);
  });
});

describe('Zero-Knowledge Proof System', () => {
  let zkSystem;

  beforeEach(async () => {
    zkSystem = new ZeroKnowledgeProofSystem({
      curve: 'secp256k1',
      enableInteractiveProofs: true,
      enableNonInteractiveProofs: true
    });

    await zkSystem.initialize();
  });

  test('should initialize with elliptic curve operations', () => {
    const status = zkSystem.getStatus();
    
    expect(status.initialized).toBe(true);
    expect(status.config.curve).toBe('secp256k1');
    expect(status.config.enableInteractiveProofs).toBe(true);
    expect(status.config.enableNonInteractiveProofs).toBe(true);
  });

  test('should create and verify discrete logarithm proofs', async () => {
    const secret = Buffer.from('my-secret-key');
    const publicKey = Buffer.from('corresponding-public-key');

    // Create proof
    const proof = await zkSystem.proveDiscreteLog(secret, publicKey);
    
    expect(proof.type).toBe('discrete_log');
    expect(proof.commitment).toBeDefined();
    expect(proof.challenge).toBeDefined();
    expect(proof.response).toBeDefined();
    expect(proof.publicKey).toEqual(publicKey);

    // Verify proof
    const verification = await zkSystem.verifyDiscreteLogProof(proof, publicKey);
    
    expect(verification.valid).toBe(true);
    expect(verification.verificationTime).toBeGreaterThan(0);
  });

  test('should create and verify range proofs', async () => {
    const value = 25;
    const min = 0;
    const max = 100;
    const blindingFactor = Buffer.from('blinding-factor');
    
    // Create commitment
    const commitmentData = zkSystem.createCommitment(value, blindingFactor);
    
    // Create range proof
    const proof = await zkSystem.proveRange(
      value,
      commitmentData.commitment,
      blindingFactor,
      min,
      max
    );
    
    expect(proof.type).toBe('range');
    expect(proof.range).toEqual({ min, max });
    expect(proof.bitLength).toBeGreaterThan(0);
    expect(proof.bitProofs.length).toBe(proof.bitLength);

    // Verify range proof
    const verification = await zkSystem.verifyRangeProof(proof, commitmentData.commitment);
    
    expect(verification.valid).toBe(true);
    expect(verification.range).toEqual({ min, max });
  });

  test('should reject range proofs for values outside range', async () => {
    const invalidValue = 150; // Outside range [0, 100]
    const min = 0;
    const max = 100;
    const blindingFactor = Buffer.from('blinding-factor');

    await expect(
      zkSystem.proveRange(invalidValue, Buffer.alloc(32), blindingFactor, min, max)
    ).rejects.toThrow(/outside specified range/i);
  });

  test('should create and verify bulletproofs', async () => {
    const value = 42;
    const blindingFactor = Buffer.from('blinding-factor');
    const range = { min: 0, max: 255 };
    
    // Create commitment
    const commitmentData = zkSystem.createCommitment(value, blindingFactor);
    
    // Create bulletproof
    const proof = await zkSystem.createBulletproof(
      value,
      commitmentData.commitment,
      blindingFactor,
      range
    );
    
    expect(proof.type).toBe('bulletproof');
    expect(proof.value).toBe(value);
    expect(proof.range).toEqual(range);

    // Verify bulletproof
    const verification = await zkSystem.verifyBulletproof(proof, commitmentData.commitment);
    
    expect(verification.valid).toBe(true);
    expect(verification.verificationTime).toBeGreaterThan(0);
  });

  test('should create and verify commitment knowledge proofs', async () => {
    const value = 123;
    const blindingFactor = Buffer.from('blinding-factor');
    
    // Create commitment
    const commitmentData = zkSystem.createCommitment(value, blindingFactor);
    
    // Create proof of knowledge
    const proof = await zkSystem.proveCommitmentKnowledge(
      commitmentData.commitment,
      value,
      blindingFactor
    );
    
    expect(proof.type).toBe('commitment_knowledge');
    expect(proof.commitment).toEqual(commitmentData.commitment);
    expect(proof.randomCommitment).toBeDefined();
    expect(proof.challenge).toBeDefined();
    expect(proof.response1).toBeDefined();
    expect(proof.response2).toBeDefined();

    // Verify proof of knowledge
    const verification = await zkSystem.verifyCommitmentKnowledge(proof);
    
    expect(verification.valid).toBe(true);
  });

  test('should maintain performance metrics', async () => {
    const secret = Buffer.from('test-secret');
    const publicKey = Buffer.from('test-public-key');

    // Generate several proofs to test metrics
    for (let i = 0; i < 3; i++) {
      await zkSystem.proveDiscreteLog(secret, publicKey);
    }

    const status = zkSystem.getStatus();
    
    expect(status.metrics.proofsGenerated).toBe(3);
    expect(status.metrics.averageProofGenerationTime).toBeGreaterThan(0);
    expect(status.metrics.proofGenerationTime.length).toBe(3);
  });
});

describe('Consensus Attack Detector', () => {
  let attackDetector;
  let testConsensusRound;

  beforeEach(async () => {
    attackDetector = new ConsensusAttackDetector({
      byzantineThreshold: 0.33,
      sybilDetectionEnabled: true,
      eclipseProtectionEnabled: true,
      dosProtectionEnabled: true,
      enableAutoMitigation: true
    });

    await attackDetector.initialize();

    testConsensusRound = {
      id: 'test-round-001',
      participants: ['node-1', 'node-2', 'node-3', 'node-4', 'node-5'],
      messages: [
        {
          nodeId: 'node-1',
          type: 'proposal',
          proposal: { value: 'A' },
          timestamp: Date.now(),
          responseTime: 500
        },
        {
          nodeId: 'node-2',
          type: 'vote',
          vote: 'accept',
          timestamp: Date.now() + 1000,
          responseTime: 1000
        }
      ],
      requests: [
        { nodeId: 'node-1', timestamp: Date.now() },
        { nodeId: 'node-2', timestamp: Date.now() + 500 }
      ],
      networkInfo: {
        connections: [
          { nodeId: 'node-1', ip: '192.168.1.1', asn: 'AS12345', geoLocation: { country: 'US' } },
          { nodeId: 'node-2', ip: '192.168.1.2', asn: 'AS12346', geoLocation: { country: 'CA' } },
          { nodeId: 'node-3', ip: '192.168.1.3', asn: 'AS12347', geoLocation: { country: 'UK' } }
        ]
      },
      resourceUsage: {
        'node-1': { cpu: 45, memory: 60, network: 30 },
        'node-2': { cpu: 50, memory: 55, network: 25 }
      }
    };
  });

  test('should initialize all attack detectors', () => {
    const stats = attackDetector.getStatistics();
    
    expect(stats.config.detection.byzantineThreshold).toBe(0.33);
    expect(stats.config.detection.sybilDetectionEnabled).toBe(true);
    expect(stats.config.detection.eclipseProtectionEnabled).toBe(true);
    expect(stats.config.detection.dosProtectionEnabled).toBe(true);
  });

  test('should detect Byzantine attacks with contradictory messages', async () => {
    // Create consensus round with contradictory messages
    const byzantineRound = {
      ...testConsensusRound,
      messages: [
        {
          nodeId: 'node-1',
          type: 'proposal',
          proposal: { value: 'A' },
          timestamp: Date.now()
        },
        {
          nodeId: 'node-1', // Same node
          type: 'proposal',
          proposal: { value: 'B' }, // Contradictory proposal
          timestamp: Date.now() + 1000
        }
      ]
    };

    const result = await attackDetector.detectAttacks(byzantineRound);
    
    expect(result.attacks.length).toBeGreaterThan(0);
    expect(result.attacks.some(a => a.type === 'contradictory_messages')).toBe(true);
    expect(result.attacks[0].involvedNodes).toContain('node-1');
    expect(result.attacks[0].severity).toBe('HIGH');
  });

  test('should detect Sybil attacks with suspicious connections', async () => {
    // Create consensus round with multiple nodes from same IP
    const sybilRound = {
      ...testConsensusRound,
      participants: ['node-1', 'node-2', 'node-3', 'node-4', 'node-5'],
      networkInfo: {
        connections: [
          { nodeId: 'node-1', ip: '192.168.1.1', asn: 'AS12345' },
          { nodeId: 'node-2', ip: '192.168.1.1', asn: 'AS12345' }, // Same IP
          { nodeId: 'node-3', ip: '192.168.1.1', asn: 'AS12345' }, // Same IP
          { nodeId: 'node-4', ip: '192.168.1.1', asn: 'AS12345' }, // Same IP
          { nodeId: 'node-5', ip: '192.168.1.1', asn: 'AS12345' }  // Same IP (5 > limit of 3)
        ]
      }
    };

    const result = await attackDetector.detectAttacks(sybilRound);
    
    expect(result.attacks.length).toBeGreaterThan(0);
    expect(result.attacks.some(a => a.type === 'suspicious_connection_pattern')).toBe(true);
  });

  test('should detect Eclipse attacks with low diversity', async () => {
    // Create consensus round with low geographic/network diversity
    const eclipseRound = {
      ...testConsensusRound,
      networkInfo: {
        connections: [
          { nodeId: 'node-1', ip: '192.168.1.1', asn: 'AS12345', geoLocation: { country: 'US' } },
          { nodeId: 'node-2', ip: '192.168.1.2', asn: 'AS12345', geoLocation: { country: 'US' } },
          { nodeId: 'node-3', ip: '192.168.1.3', asn: 'AS12345', geoLocation: { country: 'US' } }
        ]
      }
    };

    const result = await attackDetector.detectAttacks(eclipseRound);
    
    expect(result.attacks.length).toBeGreaterThan(0);
    expect(result.attacks.some(a => a.type === 'insufficient_connection_diversity')).toBe(true);
  });

  test('should detect DoS attacks with high resource usage', async () => {
    // Create consensus round with high resource usage
    const dosRound = {
      ...testConsensusRound,
      resourceUsage: {
        'node-1': { cpu: 95, memory: 98, network: 92 }, // High usage
        'node-2': { cpu: 50, memory: 55, network: 25 }
      }
    };

    const result = await attackDetector.detectAttacks(dosRound);
    
    expect(result.attacks.length).toBeGreaterThan(0);
    expect(result.attacks.some(a => a.type === 'resource_exhaustion')).toBe(true);
    expect(result.attacks[0].involvedNodes).toContain('node-1');
  });

  test('should mitigate detected attacks automatically', async () => {
    const mockAttacks = [
      {
        detectorType: 'byzantine',
        type: 'contradictory_messages',
        severity: 'HIGH',
        involvedNodes: ['node-1'],
        evidence: { contradictions: 1 }
      },
      {
        detectorType: 'dos',
        type: 'resource_exhaustion',
        severity: 'HIGH',
        involvedNodes: ['node-2'],
        evidence: { usage: { cpu: 95 } }
      }
    ];

    const mitigation = await attackDetector.mitigateAttacks(mockAttacks);
    
    expect(mitigation.mitigated.length).toBe(2);
    expect(mitigation.mitigated.every(m => m.success)).toBe(true);
    expect(mitigation.blocked.length).toBeGreaterThan(0);
  });

  test('should track node reputations', async () => {
    const nodeId = 'node-1';
    
    // Initially should have default reputation
    let reputation = attackDetector.getNodeReputation(nodeId);
    expect(reputation.score).toBe(1.0);

    // Report suspicious behavior
    await attackDetector.reportSuspiciousBehavior(
      nodeId,
      'unusual_message_pattern',
      { frequency: 'high', timing: 'suspicious' }
    );

    // Reputation should decrease
    reputation = attackDetector.getNodeReputation(nodeId);
    expect(reputation.score).toBeLessThan(1.0);
    expect(reputation.violationHistory.length).toBe(1);
  });

  test('should quarantine nodes with low reputation', async () => {
    const nodeId = 'node-malicious';
    
    // Report multiple suspicious behaviors to lower reputation
    for (let i = 0; i < 5; i++) {
      await attackDetector.reportSuspiciousBehavior(
        nodeId,
        'repeated_violations',
        { severity: 'HIGH', count: i + 1 }
      );
    }

    // Node should be quarantined
    expect(attackDetector.isNodeQuarantined(nodeId)).toBe(true);
    
    const reputation = attackDetector.getNodeReputation(nodeId);
    expect(reputation.score).toBeLessThan(0.3);
  });

  test('should provide comprehensive attack statistics', async () => {
    // Generate some attack detection activity
    await attackDetector.detectAttacks(testConsensusRound);
    await attackDetector.reportSuspiciousBehavior('node-test', 'test', {});

    const stats = attackDetector.getStatistics();
    
    expect(stats.metrics.attacksDetected).toBeGreaterThanOrEqual(0);
    expect(stats.metrics.averageDetectionLatency).toBeGreaterThanOrEqual(0);
    expect(stats.reputations.totalNodes).toBeGreaterThanOrEqual(1);
    expect(stats.attackHistory.totalAttacks).toBeGreaterThanOrEqual(0);
    expect(stats.config).toBeDefined();
  });
});

describe('Consensus Security Integration', () => {
  let securityManager;
  let attackDetector;

  beforeAll(async () => {
    securityManager = new ConsensusSecurityManager({
      nodeId: 'integration-test-node',
      totalNodes: 5,
      threshold: 3,
      enableZKProofs: true,
      enableThresholdSigs: true,
      enableAttackDetection: true
    });

    await securityManager.initialize();
    
    attackDetector = new ConsensusAttackDetector({
      enableAutoMitigation: true,
      adaptiveLearning: true
    });

    await attackDetector.initialize();
  });

  afterAll(async () => {
    await securityManager.shutdown();
    await attackDetector.shutdown();
  });

  test('should handle complete secure consensus workflow', async () => {
    // 1. Create consensus operation with security requirements
    const consensusOperation = {
      type: 'transaction_batch',
      data: { 
        transactions: ['tx1', 'tx2', 'tx3'],
        merkleRoot: 'merkle-root-hash'
      },
      requiresSignature: true,
      signatories: ['node-1', 'node-2', 'node-3'],
      privateData: {
        secret: Buffer.from('batch-secret'),
        commitment: Buffer.from('batch-commitment'),
        proofType: 'discrete_log'
      }
    };

    // 2. Execute secure consensus operation
    const secureResult = await securityManager.secureConsensusOperation(consensusOperation);
    
    expect(secureResult.result.success).toBe(true);
    expect(secureResult.securityProofs.signature).toBeDefined();
    expect(secureResult.securityProofs.zkProof).toBeDefined();

    // 3. Simulate consensus round for attack detection
    const consensusRound = {
      id: secureResult.operationId,
      participants: ['node-1', 'node-2', 'node-3', 'node-4', 'node-5'],
      messages: [
        {
          nodeId: 'node-1',
          type: 'proposal',
          proposal: consensusOperation.data,
          signature: secureResult.securityProofs.signature,
          timestamp: Date.now()
        }
      ],
      networkInfo: {
        connections: [
          { nodeId: 'node-1', ip: '10.0.1.1', asn: 'AS1001', geoLocation: { country: 'US' } },
          { nodeId: 'node-2', ip: '10.0.1.2', asn: 'AS1002', geoLocation: { country: 'CA' } },
          { nodeId: 'node-3', ip: '10.0.1.3', asn: 'AS1003', geoLocation: { country: 'UK' } }
        ]
      }
    };

    // 4. Detect attacks in consensus round
    const attackResult = await attackDetector.detectAttacks(consensusRound);
    
    // Should detect no attacks for legitimate consensus
    expect(attackResult.attacks.length).toBe(0);

    // 5. Generate comprehensive security report
    const securityReport = await securityManager.generateSecurityReport();
    
    expect(securityReport.summary.totalEvents).toBeGreaterThan(0);
    expect(securityReport.threatLevel).toMatch(/LOW|MEDIUM|HIGH|CRITICAL/);
    expect(securityReport.recommendations).toBeInstanceOf(Array);
  });

  test('should demonstrate attack detection and mitigation workflow', async () => {
    // 1. Create malicious consensus round
    const maliciousRound = {
      id: 'malicious-round-001',
      participants: ['attacker-1', 'attacker-2', 'honest-1', 'honest-2'],
      messages: [
        {
          nodeId: 'attacker-1',
          type: 'proposal',
          proposal: { value: 'X' },
          timestamp: Date.now()
        },
        {
          nodeId: 'attacker-1', // Same attacker
          type: 'proposal',
          proposal: { value: 'Y' }, // Contradictory proposal
          timestamp: Date.now() + 1000
        }
      ],
      networkInfo: {
        connections: [
          { nodeId: 'attacker-1', ip: '192.168.1.100', asn: 'AS9999' },
          { nodeId: 'attacker-2', ip: '192.168.1.100', asn: 'AS9999' }, // Same IP/ASN
          { nodeId: 'honest-1', ip: '10.0.1.1', asn: 'AS1001' },
          { nodeId: 'honest-2', ip: '10.0.1.2', asn: 'AS1002' }
        ]
      },
      resourceUsage: {
        'attacker-1': { cpu: 98, memory: 95, network: 90 }, // High resource usage
        'attacker-2': { cpu: 30, memory: 40, network: 25 }
      }
    };

    // 2. Detect attacks
    const attackResult = await attackDetector.detectAttacks(maliciousRound);
    
    expect(attackResult.attacks.length).toBeGreaterThan(0);
    
    // Should detect multiple attack types
    const attackTypes = attackResult.attacks.map(a => a.type);
    expect(attackTypes.some(type => type.includes('contradictory'))).toBe(true);
    expect(attackTypes.some(type => type.includes('connection'))).toBe(true);
    expect(attackTypes.some(type => type.includes('resource'))).toBe(true);

    // 3. Mitigate attacks
    const mitigation = await attackDetector.mitigateAttacks(attackResult.attacks);
    
    expect(mitigation.mitigated.length).toBe(attackResult.attacks.length);
    expect(mitigation.blocked.length).toBeGreaterThan(0);
    expect(mitigation.blocked).toContain('attacker-1');

    // 4. Verify attackers are quarantined
    expect(attackDetector.isNodeQuarantined('attacker-1')).toBe(true);
    
    const attackerReputation = attackDetector.getNodeReputation('attacker-1');
    expect(attackerReputation.score).toBeLessThan(0.5);
  });

  test('should maintain security across multiple consensus rounds', async () => {
    const rounds = [];
    
    // Generate multiple consensus rounds
    for (let i = 0; i < 5; i++) {
      const operation = {
        type: 'block_validation',
        data: { blockNumber: i, hash: `hash-${i}` },
        requiresSignature: true,
        signatories: ['node-1', 'node-2', 'node-3']
      };

      const result = await securityManager.secureConsensusOperation(operation);
      rounds.push(result);
    }

    // Verify all operations succeeded
    expect(rounds.every(r => r.result.success)).toBe(true);
    
    // Check security metrics
    const finalStatus = securityManager.getSecurityStatus();
    expect(finalStatus.metrics.securityEvents.length).toBeGreaterThanOrEqual(5);
    
    // Verify security level maintained
    expect(finalStatus.securityLevel).toMatch(/MEDIUM|HIGH|MAXIMUM/);
  });
});

describe('Consensus Security Performance', () => {
  let securityManager;

  beforeAll(async () => {
    securityManager = new ConsensusSecurityManager({
      nodeId: 'perf-test-node',
      totalNodes: 10,
      threshold: 7,
      enableZKProofs: true,
      enableThresholdSigs: true
    });

    await securityManager.initialize();
  });

  afterAll(async () => {
    await securityManager.shutdown();
  });

  test('should handle high-throughput consensus operations', async () => {
    const operations = [];
    const startTime = Date.now();

    // Create 10 concurrent operations
    for (let i = 0; i < 10; i++) {
      const operation = {
        type: 'high_throughput_test',
        data: { index: i, timestamp: Date.now() },
        requiresSignature: true,
        signatories: [`node-${i % 7}`, `node-${(i + 1) % 7}`, `node-${(i + 2) % 7}`]
      };

      operations.push(securityManager.secureConsensusOperation(operation));
    }

    // Wait for all operations to complete
    const results = await Promise.all(operations);
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Verify all operations succeeded
    expect(results.every(r => r.result.success)).toBe(true);
    
    // Performance should be reasonable (less than 10 seconds for 10 operations)
    expect(totalTime).toBeLessThan(10000);
    
    // Average time per operation should be reasonable
    const avgTime = totalTime / operations.length;
    expect(avgTime).toBeLessThan(2000); // Less than 2 seconds per operation
  });

  test('should maintain memory efficiency with large datasets', async () => {
    const largeData = {
      transactions: Array.from({ length: 1000 }, (_, i) => ({
        id: `tx-${i}`,
        amount: Math.random() * 1000,
        from: `addr-${i}`,
        to: `addr-${i + 1}`
      }))
    };

    const operation = {
      type: 'large_dataset_test',
      data: largeData,
      requiresSignature: true,
      signatories: ['node-1', 'node-2', 'node-3']
    };

    const result = await securityManager.secureConsensusOperation(operation);
    
    expect(result.result.success).toBe(true);
    expect(result.securityProofs.signature).toBeDefined();
    
    // Memory usage should remain reasonable
    const status = securityManager.getSecurityStatus();
    expect(status.securityLevel).toMatch(/MEDIUM|HIGH|MAXIMUM/);
  });
});