/**
 * Consensus Attack Detection System
 * 
 * Implements comprehensive attack detection and mitigation for distributed
 * consensus protocols including Byzantine, Sybil, Eclipse, and DoS attacks.
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export class ConsensusAttackDetector extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      detection: {
        byzantineThreshold: options.byzantineThreshold || 0.33,
        sybilDetectionEnabled: options.sybilDetectionEnabled !== false,
        eclipseProtectionEnabled: options.eclipseProtectionEnabled !== false,
        dosProtectionEnabled: options.dosProtectionEnabled !== false,
        adaptiveLearning: options.adaptiveLearning !== false
      },
      thresholds: {
        contradictoryMessages: options.contradictoryMessages || 2,
        timingAnomalyThreshold: options.timingAnomalyThreshold || 1000, // ms
        collusionThreshold: options.collusionThreshold || 0.6,
        rateLimitThreshold: options.rateLimitThreshold || 100, // requests/minute
        connectionLimitPerSource: options.connectionLimitPerSource || 3
      },
      mitigation: {
        enableAutoMitigation: options.enableAutoMitigation !== false,
        quarantineEnabled: options.quarantineEnabled !== false,
        adaptiveRateLimiting: options.adaptiveRateLimiting !== false,
        reputationDecayRate: options.reputationDecayRate || 0.1
      }
    };

    // Detection components
    this.byzantineDetector = new ByzantineAttackDetector(this.config);
    this.sybilDetector = new SybilAttackDetector(this.config);
    this.eclipseDetector = new EclipseAttackDetector(this.config);
    this.dosDetector = new DoSAttackDetector(this.config);
    
    // State management
    this.nodeReputations = new Map();
    this.behaviorPatterns = new Map();
    this.attackHistory = [];
    this.quarantinedNodes = new Set();
    this.rateLimiters = new Map();
    
    // Metrics
    this.metrics = {
      attacksDetected: 0,
      attacksBlocked: 0,
      falsePositives: 0,
      detectionLatency: [],
      mitigationSuccess: 0
    };

    this.isInitialized = false;
  }

  /**
   * Initialize the attack detection system
   */
  async initialize() {
    try {
      await this.byzantineDetector.initialize();
      await this.sybilDetector.initialize();
      await this.eclipseDetector.initialize();
      await this.dosDetector.initialize();

      // Initialize reputation system
      this.initializeReputationSystem();
      
      // Start background monitoring
      this.startBackgroundMonitoring();

      this.isInitialized = true;
      
      this.emit('attack_detector_initialized', {
        detectors: ['byzantine', 'sybil', 'eclipse', 'dos'],
        config: this.config
      });

      return { success: true };
    } catch (error) {
      this.emit('initialization_failed', { error: error.message });
      throw new Error(`Attack detector initialization failed: ${error.message}`);
    }
  }

  /**
   * Detect attacks in a consensus round
   */
  async detectAttacks(consensusRound) {
    if (!this.isInitialized) {
      throw new Error('Attack detector not initialized');
    }

    const startTime = Date.now();
    const detectedAttacks = [];

    try {
      // Run all attack detectors in parallel
      const detectionPromises = [];

      if (this.config.detection.byzantineThreshold > 0) {
        detectionPromises.push(
          this.byzantineDetector.detectAttacks(consensusRound)
            .then(attacks => ({ type: 'byzantine', attacks }))
        );
      }

      if (this.config.detection.sybilDetectionEnabled) {
        detectionPromises.push(
          this.sybilDetector.detectAttacks(consensusRound)
            .then(attacks => ({ type: 'sybil', attacks }))
        );
      }

      if (this.config.detection.eclipseProtectionEnabled) {
        detectionPromises.push(
          this.eclipseDetector.detectAttacks(consensusRound)
            .then(attacks => ({ type: 'eclipse', attacks }))
        );
      }

      if (this.config.detection.dosProtectionEnabled) {
        detectionPromises.push(
          this.dosDetector.detectAttacks(consensusRound)
            .then(attacks => ({ type: 'dos', attacks }))
        );
      }

      const results = await Promise.all(detectionPromises);

      // Collect all detected attacks
      for (const result of results) {
        if (result.attacks && result.attacks.length > 0) {
          detectedAttacks.push(...result.attacks.map(attack => ({
            ...attack,
            detectorType: result.type,
            detectedAt: new Date(),
            consensusRound: consensusRound.id
          })));
        }
      }

      // Update metrics
      this.metrics.attacksDetected += detectedAttacks.length;
      this.metrics.detectionLatency.push(Date.now() - startTime);

      // Apply machine learning if enabled
      if (this.config.detection.adaptiveLearning) {
        await this.updateBehaviorPatterns(consensusRound, detectedAttacks);
      }

      // Update node reputations
      await this.updateReputations(consensusRound, detectedAttacks);

      if (detectedAttacks.length > 0) {
        this.emit('attacks_detected', {
          attacks: detectedAttacks,
          consensusRound: consensusRound.id,
          detectionTime: Date.now() - startTime
        });

        // Store attack history
        this.attackHistory.push({
          timestamp: new Date(),
          consensusRound: consensusRound.id,
          attacks: detectedAttacks
        });
      }

      return {
        attacks: detectedAttacks,
        detectionTime: Date.now() - startTime,
        consensusRound: consensusRound.id
      };

    } catch (error) {
      this.emit('attack_detection_failed', {
        error: error.message,
        consensusRound: consensusRound.id
      });
      throw error;
    }
  }

  /**
   * Mitigate detected attacks
   */
  async mitigateAttacks(attacks) {
    if (!this.config.mitigation.enableAutoMitigation) {
      return { mitigated: [], blocked: [] };
    }

    const mitigationResults = [];
    const blockedNodes = [];

    try {
      for (const attack of attacks) {
        const mitigation = await this.mitigateAttack(attack);
        mitigationResults.push(mitigation);

        if (mitigation.blocked) {
          blockedNodes.push(...mitigation.blockedNodes);
        }
      }

      this.metrics.mitigationSuccess += mitigationResults.filter(m => m.success).length;

      this.emit('attacks_mitigated', {
        mitigations: mitigationResults,
        blockedNodes: [...new Set(blockedNodes)]
      });

      return {
        mitigated: mitigationResults.filter(m => m.success),
        blocked: [...new Set(blockedNodes)]
      };

    } catch (error) {
      this.emit('attack_mitigation_failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if a node should be quarantined
   */
  isNodeQuarantined(nodeId) {
    return this.quarantinedNodes.has(nodeId);
  }

  /**
   * Get node reputation score
   */
  getNodeReputation(nodeId) {
    return this.nodeReputations.get(nodeId) || {
      score: 1.0,
      lastUpdated: new Date(),
      violationHistory: []
    };
  }

  /**
   * Manually report suspicious behavior
   */
  async reportSuspiciousBehavior(nodeId, behavior, evidence) {
    try {
      const suspicionReport = {
        nodeId,
        behavior,
        evidence,
        reportedAt: new Date(),
        reportedBy: 'manual'
      };

      // Update reputation
      await this.penalizeNode(nodeId, 'suspicious_behavior', evidence);

      // Check if node should be quarantined
      const reputation = this.getNodeReputation(nodeId);
      if (reputation.score < 0.3) {
        await this.quarantineNode(nodeId, 'low_reputation');
      }

      this.emit('suspicious_behavior_reported', suspicionReport);

      return { success: true, report: suspicionReport };
    } catch (error) {
      this.emit('suspicious_behavior_report_failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get attack detection statistics
   */
  getStatistics() {
    return {
      metrics: {
        ...this.metrics,
        averageDetectionLatency: this.calculateAverage(this.metrics.detectionLatency),
        detectionAccuracy: this.calculateDetectionAccuracy()
      },
      reputations: {
        totalNodes: this.nodeReputations.size,
        averageReputation: this.calculateAverageReputation(),
        quarantinedNodes: this.quarantinedNodes.size
      },
      attackHistory: {
        totalAttacks: this.attackHistory.length,
        recentAttacks: this.getRecentAttacks(24), // Last 24 hours
        attacksByType: this.getAttacksByType()
      },
      config: this.config
    };
  }

  // Private methods

  async mitigateAttack(attack) {
    const startTime = Date.now();

    try {
      let mitigation;

      switch (attack.detectorType) {
        case 'byzantine':
          mitigation = await this.mitigateByzantineAttack(attack);
          break;
        case 'sybil':
          mitigation = await this.mitigateSybilAttack(attack);
          break;
        case 'eclipse':
          mitigation = await this.mitigateEclipseAttack(attack);
          break;
        case 'dos':
          mitigation = await this.mitigateDoSAttack(attack);
          break;
        default:
          mitigation = await this.mitigateGenericAttack(attack);
      }

      mitigation.mitigationTime = Date.now() - startTime;
      return mitigation;

    } catch (error) {
      return {
        success: false,
        attack: attack,
        error: error.message,
        mitigationTime: Date.now() - startTime
      };
    }
  }

  async mitigateByzantineAttack(attack) {
    const maliciousNodes = attack.involvedNodes || [];
    const actions = [];

    // Penalize reputation of malicious nodes
    for (const nodeId of maliciousNodes) {
      await this.penalizeNode(nodeId, 'byzantine_behavior', attack);
      actions.push(`penalized_${nodeId}`);

      // Quarantine if reputation is too low
      const reputation = this.getNodeReputation(nodeId);
      if (reputation.score < 0.2) {
        await this.quarantineNode(nodeId, 'byzantine_attack');
        actions.push(`quarantined_${nodeId}`);
      }
    }

    return {
      success: true,
      attack: attack,
      actions: actions,
      blockedNodes: maliciousNodes.filter(id => this.quarantinedNodes.has(id)),
      blocked: actions.some(a => a.includes('quarantined'))
    };
  }

  async mitigateSybilAttack(attack) {
    const suspiciousNodes = attack.involvedNodes || [];
    const actions = [];

    // Block new connections from suspicious sources
    for (const nodeId of suspiciousNodes) {
      await this.blockNodeConnections(nodeId);
      actions.push(`blocked_connections_${nodeId}`);

      // Require additional verification
      await this.requireAdditionalVerification(nodeId);
      actions.push(`verification_required_${nodeId}`);
    }

    return {
      success: true,
      attack: attack,
      actions: actions,
      blockedNodes: suspiciousNodes,
      blocked: true
    };
  }

  async mitigateEclipseAttack(attack) {
    const attackerNodes = attack.involvedNodes || [];
    const actions = [];

    // Enforce connection diversity
    await this.enforceConnectionDiversity();
    actions.push('enforced_connection_diversity');

    // Block excessive connections from single sources
    for (const nodeId of attackerNodes) {
      await this.limitConnectionsFromSource(nodeId);
      actions.push(`limited_connections_${nodeId}`);
    }

    return {
      success: true,
      attack: attack,
      actions: actions,
      blockedNodes: attackerNodes,
      blocked: true
    };
  }

  async mitigateDoSAttack(attack) {
    const attackerNodes = attack.involvedNodes || [];
    const actions = [];

    // Apply rate limiting
    for (const nodeId of attackerNodes) {
      await this.applyRateLimit(nodeId, attack.severity);
      actions.push(`rate_limited_${nodeId}`);

      // Temporary ban for severe attacks
      if (attack.severity === 'HIGH') {
        await this.temporaryBan(nodeId, 3600000); // 1 hour
        actions.push(`banned_${nodeId}`);
      }
    }

    return {
      success: true,
      attack: attack,
      actions: actions,
      blockedNodes: attackerNodes.filter(id => this.quarantinedNodes.has(id)),
      blocked: actions.some(a => a.includes('banned'))
    };
  }

  async mitigateGenericAttack(attack) {
    const involvedNodes = attack.involvedNodes || [];
    const actions = [];

    // Generic mitigation: penalize reputation
    for (const nodeId of involvedNodes) {
      await this.penalizeNode(nodeId, 'generic_attack', attack);
      actions.push(`penalized_${nodeId}`);
    }

    return {
      success: true,
      attack: attack,
      actions: actions,
      blockedNodes: [],
      blocked: false
    };
  }

  async penalizeNode(nodeId, violationType, evidence) {
    const reputation = this.getNodeReputation(nodeId);
    const penalty = this.calculatePenalty(violationType, evidence);
    
    reputation.score = Math.max(0, reputation.score - penalty);
    reputation.lastUpdated = new Date();
    reputation.violationHistory.push({
      type: violationType,
      penalty: penalty,
      evidence: evidence,
      timestamp: new Date()
    });

    this.nodeReputations.set(nodeId, reputation);
    
    this.emit('node_penalized', {
      nodeId,
      violationType,
      penalty,
      newScore: reputation.score
    });
  }

  async quarantineNode(nodeId, reason) {
    this.quarantinedNodes.add(nodeId);
    
    this.emit('node_quarantined', {
      nodeId,
      reason,
      timestamp: new Date()
    });

    // Schedule automatic release after quarantine period
    setTimeout(() => {
      this.releaseFromQuarantine(nodeId);
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  releaseFromQuarantine(nodeId) {
    if (this.quarantinedNodes.delete(nodeId)) {
      this.emit('node_released_from_quarantine', {
        nodeId,
        timestamp: new Date()
      });
    }
  }

  async blockNodeConnections(nodeId) {
    // Implementation would depend on network layer
    this.emit('node_connections_blocked', { nodeId });
  }

  async requireAdditionalVerification(nodeId) {
    // Implementation would require additional verification protocols
    this.emit('additional_verification_required', { nodeId });
  }

  async enforceConnectionDiversity() {
    // Implementation would enforce network topology diversity
    this.emit('connection_diversity_enforced');
  }

  async limitConnectionsFromSource(sourceId) {
    // Implementation would limit connections from specific source
    this.emit('connections_limited', { sourceId });
  }

  async applyRateLimit(nodeId, severity) {
    const limit = this.calculateRateLimit(severity);
    this.rateLimiters.set(nodeId, {
      limit: limit,
      window: 60000, // 1 minute
      requests: 0,
      resetTime: Date.now() + 60000
    });

    this.emit('rate_limit_applied', { nodeId, limit });
  }

  async temporaryBan(nodeId, duration) {
    this.quarantineNode(nodeId, 'temporary_ban');
    
    setTimeout(() => {
      this.releaseFromQuarantine(nodeId);
    }, duration);

    this.emit('temporary_ban_applied', { nodeId, duration });
  }

  calculatePenalty(violationType, evidence) {
    const basePenalties = {
      'byzantine_behavior': 0.3,
      'suspicious_behavior': 0.1,
      'dos_attack': 0.2,
      'sybil_attack': 0.4,
      'eclipse_attack': 0.25,
      'generic_attack': 0.15
    };

    let penalty = basePenalties[violationType] || 0.1;

    // Adjust penalty based on evidence severity
    if (evidence && evidence.severity) {
      const severityMultipliers = {
        'LOW': 0.5,
        'MEDIUM': 1.0,
        'HIGH': 1.5,
        'CRITICAL': 2.0
      };
      penalty *= severityMultipliers[evidence.severity] || 1.0;
    }

    return Math.min(penalty, 1.0); // Cap at 1.0
  }

  calculateRateLimit(severity) {
    const baseLimits = {
      'LOW': 100,
      'MEDIUM': 50,
      'HIGH': 10,
      'CRITICAL': 1
    };

    return baseLimits[severity] || 50;
  }

  initializeReputationSystem() {
    // Initialize with default reputation scores
    this.nodeReputations.clear();
    
    // Reputation decay mechanism
    setInterval(() => {
      this.decayReputations();
    }, 60 * 60 * 1000); // Hourly decay
  }

  decayReputations() {
    for (const [nodeId, reputation] of this.nodeReputations) {
      // Gradually recover reputation over time
      if (reputation.score < 1.0) {
        reputation.score = Math.min(1.0, reputation.score + this.config.mitigation.reputationDecayRate);
        reputation.lastUpdated = new Date();
      }
    }
  }

  startBackgroundMonitoring() {
    // Monitor for patterns and anomalies
    setInterval(() => {
      this.analyzePatterns();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  analyzePatterns() {
    // Analyze behavior patterns for proactive detection
    for (const [nodeId, patterns] of this.behaviorPatterns) {
      const anomalies = this.detectAnomalies(patterns);
      if (anomalies.length > 0) {
        this.emit('behavioral_anomaly_detected', {
          nodeId,
          anomalies,
          timestamp: new Date()
        });
      }
    }
  }

  detectAnomalies(patterns) {
    // Simple anomaly detection based on statistical deviations
    const anomalies = [];
    
    // Check for message frequency anomalies
    if (patterns.messageFrequency && patterns.messageFrequency.length > 10) {
      const avg = this.calculateAverage(patterns.messageFrequency);
      const latest = patterns.messageFrequency[patterns.messageFrequency.length - 1];
      
      if (latest > avg * 3) {
        anomalies.push({
          type: 'high_message_frequency',
          expected: avg,
          actual: latest
        });
      }
    }

    return anomalies;
  }

  async updateBehaviorPatterns(consensusRound, attacks) {
    // Update machine learning models with new data
    for (const participant of consensusRound.participants) {
      if (!this.behaviorPatterns.has(participant)) {
        this.behaviorPatterns.set(participant, {
          messageFrequency: [],
          responseTime: [],
          consensusVotes: [],
          lastUpdated: new Date()
        });
      }

      const patterns = this.behaviorPatterns.get(participant);
      
      // Update patterns with new data
      patterns.messageFrequency.push(consensusRound.messageCount || 1);
      patterns.responseTime.push(consensusRound.responseTime || 1000);
      patterns.consensusVotes.push(consensusRound.vote || 'unknown');
      patterns.lastUpdated = new Date();

      // Keep only recent data (sliding window)
      const maxHistory = 100;
      patterns.messageFrequency = patterns.messageFrequency.slice(-maxHistory);
      patterns.responseTime = patterns.responseTime.slice(-maxHistory);
      patterns.consensusVotes = patterns.consensusVotes.slice(-maxHistory);
    }
  }

  async updateReputations(consensusRound, attacks) {
    // Update reputations based on consensus participation and attacks
    for (const participant of consensusRound.participants) {
      const reputation = this.getNodeReputation(participant);
      
      // Small positive adjustment for good behavior
      if (!attacks.some(attack => attack.involvedNodes?.includes(participant))) {
        reputation.score = Math.min(1.0, reputation.score + 0.01);
        reputation.lastUpdated = new Date();
        this.nodeReputations.set(participant, reputation);
      }
    }
  }

  calculateAverage(array) {
    if (array.length === 0) return 0;
    return array.reduce((sum, val) => sum + val, 0) / array.length;
  }

  calculateDetectionAccuracy() {
    const totalDetections = this.metrics.attacksDetected;
    const falsePositives = this.metrics.falsePositives;
    
    if (totalDetections === 0) return 1.0;
    return (totalDetections - falsePositives) / totalDetections;
  }

  calculateAverageReputation() {
    if (this.nodeReputations.size === 0) return 1.0;
    
    const scores = Array.from(this.nodeReputations.values()).map(r => r.score);
    return this.calculateAverage(scores);
  }

  getRecentAttacks(hours) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.attackHistory.filter(attack => attack.timestamp >= cutoff);
  }

  getAttacksByType() {
    const types = {};
    
    for (const attackEvent of this.attackHistory) {
      for (const attack of attackEvent.attacks) {
        const type = attack.detectorType;
        types[type] = (types[type] || 0) + 1;
      }
    }
    
    return types;
  }

  async shutdown() {
    this.isInitialized = false;
    this.emit('attack_detector_shutdown');
  }
}

/**
 * Byzantine Attack Detector
 */
class ByzantineAttackDetector {
  constructor(config) {
    this.config = config;
  }

  async initialize() {
    // Initialize Byzantine attack detection
  }

  async detectAttacks(consensusRound) {
    const attacks = [];
    
    // Detect contradictory messages
    const contradictions = this.detectContradictoryMessages(consensusRound.messages);
    if (contradictions.length > 0) {
      attacks.push({
        type: 'contradictory_messages',
        severity: 'HIGH',
        involvedNodes: contradictions.map(c => c.nodeId),
        evidence: contradictions
      });
    }

    // Detect timing attacks
    const timingAnomalies = this.detectTimingAnomalies(consensusRound.messages);
    if (timingAnomalies.length > 0) {
      attacks.push({
        type: 'timing_attack',
        severity: 'MEDIUM',
        involvedNodes: timingAnomalies.map(t => t.nodeId),
        evidence: timingAnomalies
      });
    }

    return attacks;
  }

  detectContradictoryMessages(messages) {
    const contradictions = [];
    const messagesByNode = new Map();

    // Group messages by node
    for (const message of messages) {
      if (!messagesByNode.has(message.nodeId)) {
        messagesByNode.set(message.nodeId, []);
      }
      messagesByNode.get(message.nodeId).push(message);
    }

    // Check for contradictions within each node's messages
    for (const [nodeId, nodeMessages] of messagesByNode) {
      for (let i = 0; i < nodeMessages.length; i++) {
        for (let j = i + 1; j < nodeMessages.length; j++) {
          if (this.areMessagesContradictory(nodeMessages[i], nodeMessages[j])) {
            contradictions.push({
              nodeId,
              message1: nodeMessages[i],
              message2: nodeMessages[j]
            });
          }
        }
      }
    }

    return contradictions;
  }

  areMessagesContradictory(msg1, msg2) {
    // Check if two messages from the same node contradict each other
    if (msg1.type === msg2.type && msg1.proposal && msg2.proposal) {
      return JSON.stringify(msg1.proposal) !== JSON.stringify(msg2.proposal);
    }
    return false;
  }

  detectTimingAnomalies(messages) {
    const anomalies = [];
    const avgResponseTime = this.calculateAverageResponseTime(messages);

    for (const message of messages) {
      if (message.responseTime > avgResponseTime * 3) {
        anomalies.push({
          nodeId: message.nodeId,
          responseTime: message.responseTime,
          expectedMax: avgResponseTime * 2
        });
      }
    }

    return anomalies;
  }

  calculateAverageResponseTime(messages) {
    const responseTimes = messages
      .filter(m => m.responseTime)
      .map(m => m.responseTime);
    
    if (responseTimes.length === 0) return 1000; // Default 1 second
    
    return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  }
}

/**
 * Sybil Attack Detector
 */
class SybilAttackDetector {
  constructor(config) {
    this.config = config;
  }

  async initialize() {
    // Initialize Sybil attack detection
  }

  async detectAttacks(consensusRound) {
    const attacks = [];
    
    // Detect identity verification failures
    const identityIssues = this.detectIdentityIssues(consensusRound.participants);
    if (identityIssues.length > 0) {
      attacks.push({
        type: 'identity_verification_failure',
        severity: 'HIGH',
        involvedNodes: identityIssues,
        evidence: { failedVerifications: identityIssues }
      });
    }

    // Detect suspicious connection patterns
    const connectionAnomalies = this.detectConnectionAnomalies(consensusRound.networkInfo);
    if (connectionAnomalies.length > 0) {
      attacks.push({
        type: 'suspicious_connection_pattern',
        severity: 'MEDIUM',
        involvedNodes: connectionAnomalies.map(c => c.nodeId),
        evidence: connectionAnomalies
      });
    }

    return attacks;
  }

  detectIdentityIssues(participants) {
    // Simplified identity verification check
    return participants.filter(p => !p.verified || p.reputation < 0.1);
  }

  detectConnectionAnomalies(networkInfo) {
    if (!networkInfo || !networkInfo.connections) return [];
    
    const anomalies = [];
    const connectionsByIP = new Map();

    // Group connections by IP address
    for (const connection of networkInfo.connections) {
      const ip = connection.ip;
      if (!connectionsByIP.has(ip)) {
        connectionsByIP.set(ip, []);
      }
      connectionsByIP.get(ip).push(connection);
    }

    // Detect too many connections from single IP
    for (const [ip, connections] of connectionsByIP) {
      if (connections.length > this.config.thresholds.connectionLimitPerSource) {
        anomalies.push({
          type: 'excessive_connections_per_ip',
          ip,
          connectionCount: connections.length,
          nodes: connections.map(c => c.nodeId)
        });
      }
    }

    return anomalies;
  }
}

/**
 * Eclipse Attack Detector
 */
class EclipseAttackDetector {
  constructor(config) {
    this.config = config;
  }

  async initialize() {
    // Initialize Eclipse attack detection
  }

  async detectAttacks(consensusRound) {
    const attacks = [];
    
    // Detect connection diversity issues
    const diversityIssues = this.detectDiversityIssues(consensusRound.networkInfo);
    if (diversityIssues.length > 0) {
      attacks.push({
        type: 'insufficient_connection_diversity',
        severity: 'HIGH',
        involvedNodes: diversityIssues.map(d => d.controllingNode),
        evidence: diversityIssues
      });
    }

    return attacks;
  }

  detectDiversityIssues(networkInfo) {
    if (!networkInfo || !networkInfo.connections) return [];
    
    const issues = [];
    
    // Check geographic diversity
    const geoEntropy = this.calculateGeographicEntropy(networkInfo.connections);
    if (geoEntropy < 2.0) {
      issues.push({
        type: 'low_geographic_diversity',
        entropy: geoEntropy,
        controllingNode: 'unknown'
      });
    }

    // Check network (ASN) diversity
    const networkEntropy = this.calculateNetworkEntropy(networkInfo.connections);
    if (networkEntropy < 1.5) {
      issues.push({
        type: 'low_network_diversity',
        entropy: networkEntropy,
        controllingNode: 'unknown'
      });
    }

    return issues;
  }

  calculateGeographicEntropy(connections) {
    const countries = new Map();
    
    for (const conn of connections) {
      const country = conn.geoLocation?.country || 'unknown';
      countries.set(country, (countries.get(country) || 0) + 1);
    }

    return this.calculateEntropy(Array.from(countries.values()));
  }

  calculateNetworkEntropy(connections) {
    const asns = new Map();
    
    for (const conn of connections) {
      const asn = conn.asn || 'unknown';
      asns.set(asn, (asns.get(asn) || 0) + 1);
    }

    return this.calculateEntropy(Array.from(asns.values()));
  }

  calculateEntropy(frequencies) {
    const total = frequencies.reduce((sum, freq) => sum + freq, 0);
    if (total === 0) return 0;
    
    let entropy = 0;
    for (const freq of frequencies) {
      const p = freq / total;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }
    
    return entropy;
  }
}

/**
 * DoS Attack Detector
 */
class DoSAttackDetector {
  constructor(config) {
    this.config = config;
    this.requestCounts = new Map();
  }

  async initialize() {
    // Initialize DoS attack detection
    this.startRateLimitReset();
  }

  async detectAttacks(consensusRound) {
    const attacks = [];
    
    // Detect rate limit violations
    const rateLimitViolations = this.detectRateLimitViolations(consensusRound.requests);
    if (rateLimitViolations.length > 0) {
      attacks.push({
        type: 'rate_limit_violation',
        severity: 'MEDIUM',
        involvedNodes: rateLimitViolations.map(v => v.nodeId),
        evidence: rateLimitViolations
      });
    }

    // Detect resource exhaustion attempts
    const resourceAttacks = this.detectResourceExhaustion(consensusRound.resourceUsage);
    if (resourceAttacks.length > 0) {
      attacks.push({
        type: 'resource_exhaustion',
        severity: 'HIGH',
        involvedNodes: resourceAttacks.map(r => r.nodeId),
        evidence: resourceAttacks
      });
    }

    return attacks;
  }

  detectRateLimitViolations(requests) {
    const violations = [];
    
    for (const request of requests) {
      const nodeId = request.nodeId;
      const currentCount = this.requestCounts.get(nodeId) || 0;
      this.requestCounts.set(nodeId, currentCount + 1);
      
      if (currentCount > this.config.thresholds.rateLimitThreshold) {
        violations.push({
          nodeId,
          requestCount: currentCount,
          threshold: this.config.thresholds.rateLimitThreshold
        });
      }
    }
    
    return violations;
  }

  detectResourceExhaustion(resourceUsage) {
    if (!resourceUsage) return [];
    
    const attacks = [];
    
    for (const [nodeId, usage] of Object.entries(resourceUsage)) {
      if (usage.cpu > 90 || usage.memory > 90 || usage.network > 90) {
        attacks.push({
          nodeId,
          usage,
          type: 'high_resource_usage'
        });
      }
    }
    
    return attacks;
  }

  startRateLimitReset() {
    // Reset rate limit counters every minute
    setInterval(() => {
      this.requestCounts.clear();
    }, 60000);
  }
}

export { ByzantineAttackDetector, SybilAttackDetector, EclipseAttackDetector, DoSAttackDetector };
export default ConsensusAttackDetector;