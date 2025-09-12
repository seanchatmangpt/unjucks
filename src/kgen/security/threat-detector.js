/**
 * Threat Detection System
 * Advanced threat detection for malicious inputs and behavioral analysis
 * Real-time security monitoring with ML-based pattern recognition
 */

import { EventEmitter } from 'events';
import consola from 'consola';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export class ThreatDetector extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Detection settings
      enableRealTimeDetection: true,
      enableBehavioralAnalysis: true,
      enableMLDetection: false, // Requires ML models
      
      // Threat thresholds
      riskScoreThreshold: 75,
      suspiciousPatternThreshold: 3,
      anomalyDetectionThreshold: 2.5,
      
      // Detection categories
      detectInjectionAttacks: true,
      detectMalwarePatterns: true,
      detectAnomalousRequests: true,
      detectDataExfiltration: true,
      
      // Response settings
      autoBlock: false,
      alertThreshold: 50,
      quarantineThreshold: 85,
      
      // Performance settings
      maxPatternCacheSize: 10000,
      detectionTimeout: 5000,
      batchProcessingSize: 100,
      
      ...config
    };
    
    this.logger = consola.withTag('threat-detector');
    
    // Threat detection patterns
    this.threatPatterns = this._initializeThreatPatterns();
    this.behaviorBaselines = new Map();
    this.suspiciousActivities = new Map();
    this.threatCache = new Map();
    
    // Detection metrics
    this.metrics = {
      threatsDetected: 0,
      falsePositives: 0,
      detectionAccuracy: 0,
      avgDetectionTime: 0,
      patternsMatched: 0,
      behavioralAnomalies: 0
    };
    
    // Threat intelligence
    this.threatIntelligence = {
      knownMalwareHashes: new Set(),
      suspiciousIPs: new Set(),
      maliciousDomains: new Set(),
      compromisedCredentials: new Set()
    };
    
    // Real-time detection state
    this.detectionQueue = [];
    this.isProcessing = false;
  }

  /**
   * Initialize threat detector
   */
  async initialize() {
    try {
      this.logger.info('Initializing threat detection system...');
      
      // Load threat intelligence feeds
      await this._loadThreatIntelligence();
      
      // Initialize behavioral baselines
      await this._initializeBehavioralBaselines();
      
      // Start real-time processing
      if (this.config.enableRealTimeDetection) {
        this._startRealTimeProcessing();
      }
      
      // Setup cleanup intervals
      this.cleanupInterval = setInterval(() => {
        this._cleanupThreatCache();
        this._cleanupSuspiciousActivities();
      }, 300000); // Every 5 minutes
      
      this.logger.success('Threat detection system initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize threat detector:', error);
      throw error;
    }
  }

  /**
   * Analyze input for threats
   * @param {string|object} input - Input to analyze
   * @param {object} context - Analysis context
   * @returns {Promise<object>} Threat analysis result
   */
  async analyzeThreats(input, context = {}) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      const analysisResult = {
        safe: true,
        riskScore: 0,
        threats: [],
        recommendations: [],
        metadata: {
          analysisType: 'comprehensive',
          timestamp: this.getDeterministicDate(),
          context,
          analysisTime: 0
        }
      };
      
      // Input validation
      if (!input) {
        analysisResult.metadata.analysisTime = this.getDeterministicTimestamp() - startTime;
        return analysisResult;
      }
      
      const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
      const inputHash = this._generateInputHash(inputStr);
      
      // Check threat cache
      const cachedResult = this.threatCache.get(inputHash);
      if (cachedResult && (this.getDeterministicTimestamp() - cachedResult.timestamp) < 60000) { // 1 minute cache
        return { ...cachedResult.result, fromCache: true };
      }
      
      // Pattern-based threat detection
      const patternThreats = await this._detectPatternThreats(inputStr, context);
      analysisResult.threats.push(...patternThreats);
      
      // Behavioral analysis
      if (this.config.enableBehavioralAnalysis) {
        const behavioralThreats = await this._detectBehavioralAnomalies(inputStr, context);
        analysisResult.threats.push(...behavioralThreats);
      }
      
      // Content analysis
      const contentThreats = await this._analyzeContent(inputStr, context);
      analysisResult.threats.push(...contentThreats);
      
      // ML-based detection (if enabled)
      if (this.config.enableMLDetection) {
        const mlThreats = await this._detectMLThreats(inputStr, context);
        analysisResult.threats.push(...mlThreats);
      }
      
      // Calculate risk score
      analysisResult.riskScore = this._calculateRiskScore(analysisResult.threats);
      
      // Determine safety
      analysisResult.safe = analysisResult.riskScore < this.config.riskScoreThreshold;
      
      // Generate recommendations
      analysisResult.recommendations = this._generateRecommendations(analysisResult);
      
      // Update metrics
      this.metrics.threatsDetected += analysisResult.threats.length;
      this.metrics.patternsMatched += analysisResult.threats.filter(t => t.source === 'pattern').length;
      this.metrics.behavioralAnomalies += analysisResult.threats.filter(t => t.source === 'behavioral').length;
      
      const analysisTime = this.getDeterministicTimestamp() - startTime;
      this._updateDetectionMetrics(analysisTime);
      
      analysisResult.metadata.analysisTime = analysisTime;
      
      // Cache result
      this.threatCache.set(inputHash, {
        result: analysisResult,
        timestamp: this.getDeterministicTimestamp()
      });
      
      // Emit events for high-risk threats
      if (analysisResult.riskScore > this.config.alertThreshold) {
        this.emit('threat-detected', {
          riskScore: analysisResult.riskScore,
          threats: analysisResult.threats,
          context,
          input: inputStr.substring(0, 200) // Limited for logging
        });
      }
      
      if (analysisResult.riskScore > this.config.quarantineThreshold) {
        this.emit('high-risk-threat', {
          riskScore: analysisResult.riskScore,
          threats: analysisResult.threats,
          context
        });
      }
      
      return analysisResult;
      
    } catch (error) {
      this.logger.error('Threat analysis failed:', error);
      
      return {
        safe: false,
        riskScore: 100,
        threats: [{
          type: 'analysis-error',
          severity: 'high',
          description: 'Threat analysis failed',
          source: 'system',
          evidence: error.message
        }],
        recommendations: ['Manual review required'],
        metadata: {
          analysisType: 'error',
          timestamp: this.getDeterministicDate(),
          context,
          analysisTime: this.getDeterministicTimestamp() - startTime,
          error: error.message
        }
      };
    }
  }

  /**
   * Monitor behavioral patterns for anomalies
   * @param {string} userId - User identifier
   * @param {object} activity - Activity data
   * @returns {Promise<object>} Behavioral analysis result
   */
  async monitorBehavior(userId, activity) {
    try {
      const result = {
        anomalous: false,
        anomalyScore: 0,
        patterns: [],
        baseline: null
      };
      
      // Get or create user baseline
      const baseline = this._getUserBaseline(userId);
      result.baseline = baseline;
      
      // Update activity tracking
      this._updateActivityTracking(userId, activity);
      
      // Detect anomalies
      const anomalies = this._detectActivityAnomalies(userId, activity, baseline);
      result.patterns = anomalies;
      result.anomalous = anomalies.length > 0;
      result.anomalyScore = anomalies.reduce((sum, a) => sum + a.score, 0);
      
      // Update baseline with new activity
      this._updateBaseline(userId, activity);
      
      if (result.anomalous) {
        this.emit('behavioral-anomaly', {
          userId,
          activity,
          anomalies,
          score: result.anomalyScore
        });
      }
      
      return result;
      
    } catch (error) {
      this.logger.error('Behavioral monitoring failed:', error);
      return {
        anomalous: true,
        anomalyScore: 50,
        patterns: [],
        baseline: null,
        error: error.message
      };
    }
  }

  /**
   * Check against threat intelligence feeds
   * @param {object} indicators - Threat indicators
   * @returns {Promise<object>} Intelligence check result
   */
  async checkThreatIntelligence(indicators) {
    try {
      const result = {
        matches: [],
        riskLevel: 'low',
        sources: []
      };
      
      // Check file hashes
      if (indicators.fileHash) {
        if (this.threatIntelligence.knownMalwareHashes.has(indicators.fileHash)) {
          result.matches.push({
            type: 'malware-hash',
            value: indicators.fileHash,
            source: 'threat-intelligence'
          });
        }
      }
      
      // Check IP addresses
      if (indicators.ipAddress) {
        if (this.threatIntelligence.suspiciousIPs.has(indicators.ipAddress)) {
          result.matches.push({
            type: 'suspicious-ip',
            value: indicators.ipAddress,
            source: 'threat-intelligence'
          });
        }
      }
      
      // Check domains
      if (indicators.domain) {
        if (this.threatIntelligence.maliciousDomains.has(indicators.domain)) {
          result.matches.push({
            type: 'malicious-domain',
            value: indicators.domain,
            source: 'threat-intelligence'
          });
        }
      }
      
      // Determine risk level
      if (result.matches.length > 0) {
        result.riskLevel = result.matches.some(m => m.type === 'malware-hash') ? 'critical' :
                          result.matches.length > 2 ? 'high' : 'medium';
      }
      
      return result;
      
    } catch (error) {
      this.logger.error('Threat intelligence check failed:', error);
      return {
        matches: [],
        riskLevel: 'unknown',
        sources: [],
        error: error.message
      };
    }
  }

  /**
   * Get threat detection metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.threatCache.size,
      suspiciousActivities: this.suspiciousActivities.size,
      behaviorBaselines: this.behaviorBaselines.size,
      queueSize: this.detectionQueue.length,
      threatIntelligence: {
        malwareHashes: this.threatIntelligence.knownMalwareHashes.size,
        suspiciousIPs: this.threatIntelligence.suspiciousIPs.size,
        maliciousDomains: this.threatIntelligence.maliciousDomains.size
      }
    };
  }

  /**
   * Update threat intelligence feeds
   * @param {object} feeds - New threat intelligence data
   */
  async updateThreatIntelligence(feeds) {
    try {
      this.logger.info('Updating threat intelligence feeds...');
      
      if (feeds.malwareHashes) {
        feeds.malwareHashes.forEach(hash => 
          this.threatIntelligence.knownMalwareHashes.add(hash)
        );
      }
      
      if (feeds.suspiciousIPs) {
        feeds.suspiciousIPs.forEach(ip => 
          this.threatIntelligence.suspiciousIPs.add(ip)
        );
      }
      
      if (feeds.maliciousDomains) {
        feeds.maliciousDomains.forEach(domain => 
          this.threatIntelligence.maliciousDomains.add(domain)
        );
      }
      
      this.emit('threat-intelligence-updated', {
        timestamp: this.getDeterministicDate(),
        feedsUpdated: Object.keys(feeds)
      });
      
      this.logger.success('Threat intelligence updated successfully');
      
    } catch (error) {
      this.logger.error('Failed to update threat intelligence:', error);
      throw error;
    }
  }

  /**
   * Shutdown threat detector
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down threat detection system...');
      
      // Clear cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      // Clear caches and state
      this.threatCache.clear();
      this.behaviorBaselines.clear();
      this.suspiciousActivities.clear();
      this.detectionQueue.length = 0;
      
      this.logger.success('Threat detection system shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during threat detector shutdown:', error);
      throw error;
    }
  }

  // Private methods

  _initializeThreatPatterns() {
    return {
      // SQL Injection patterns
      sqlInjection: [
        /'\s*(OR|AND)\s*'\s*=\s*'/gi,
        /;\s*(DROP|DELETE|INSERT|UPDATE|ALTER)\s+/gi,
        /UNION\s+(ALL\s+)?SELECT/gi,
        /'\s*;\s*(--|\/\*)/gi,
        /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b.*\b(FROM|INTO|SET|WHERE)\b/gi
      ],
      
      // XSS patterns
      xss: [
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /onload\s*=/gi,
        /onerror\s*=/gi,
        /onclick\s*=/gi,
        /<iframe[^>]*>/gi,
        /<object[^>]*>/gi
      ],
      
      // Command injection patterns
      commandInjection: [
        /;\s*(rm|del|format|shutdown|halt)\s+/gi,
        /\|\s*(curl|wget|nc|telnet|ssh)\s+/gi,
        /`[^`]*`/g,
        /\$\([^)]*\)/g,
        /&&\s*[a-zA-Z_]/g,
        /\|\|\s*[a-zA-Z_]/g
      ],
      
      // Path traversal patterns
      pathTraversal: [
        /\.\.\/|\.\.\\/g,
        /\%2e\%2e\%2f/gi,
        /\%2e\%2e\%5c/gi,
        /\.\.\x2f|\.\.\/|\.\.\x5c/g
      ],
      
      // Malware patterns
      malware: [
        /eval\s*\(/gi,
        /exec\s*\(/gi,
        /system\s*\(/gi,
        /shell_exec\s*\(/gi,
        /base64_decode\s*\(/gi,
        /\\x[0-9a-fA-F]{2}/g, // Hex encoded strings
        /%[0-9a-fA-F]{2}/g     // URL encoded strings
      ],
      
      // Data exfiltration patterns
      dataExfiltration: [
        /password\s*[=:]\s*["'][^"']+["']/gi,
        /api[_-]?key\s*[=:]\s*["'][^"']+["']/gi,
        /token\s*[=:]\s*["'][^"']+["']/gi,
        /secret\s*[=:]\s*["'][^"']+["']/gi,
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g         // Credit card numbers
      ]
    };
  }

  async _loadThreatIntelligence() {
    try {
      // Load sample threat intelligence (in production, load from feeds)
      const sampleMalwareHashes = [
        '44d88612fea8a8f36de82e1278abb02f',
        '3395856ce81f2b7382dee72602f798b6',
        'e3b0c44298fc1c149afbf4c8996fb924'
      ];
      
      const sampleSuspiciousIPs = [
        '192.0.2.1',
        '203.0.113.1',
        '198.51.100.1'
      ];
      
      const sampleMaliciousDomains = [
        'example-malware.com',
        'phishing-site.net',
        'suspicious-domain.org'
      ];
      
      sampleMalwareHashes.forEach(hash => 
        this.threatIntelligence.knownMalwareHashes.add(hash)
      );
      sampleSuspiciousIPs.forEach(ip => 
        this.threatIntelligence.suspiciousIPs.add(ip)
      );
      sampleMaliciousDomains.forEach(domain => 
        this.threatIntelligence.maliciousDomains.add(domain)
      );
      
      this.logger.info('Threat intelligence feeds loaded');
      
    } catch (error) {
      this.logger.warn('Failed to load threat intelligence:', error);
    }
  }

  async _initializeBehavioralBaselines() {
    // Initialize behavioral analysis baselines
    this.logger.info('Initializing behavioral baselines...');
  }

  _startRealTimeProcessing() {
    setInterval(async () => {
      if (!this.isProcessing && this.detectionQueue.length > 0) {
        this.isProcessing = true;
        await this._processDetectionQueue();
        this.isProcessing = false;
      }
    }, 1000); // Process queue every second
  }

  async _processDetectionQueue() {
    const batch = this.detectionQueue.splice(0, this.config.batchProcessingSize);
    
    for (const item of batch) {
      try {
        const result = await this.analyzeThreats(item.input, item.context);
        if (item.callback) {
          item.callback(null, result);
        }
      } catch (error) {
        if (item.callback) {
          item.callback(error);
        }
      }
    }
  }

  async _detectPatternThreats(input, context) {
    const threats = [];
    
    for (const [category, patterns] of Object.entries(this.threatPatterns)) {
      for (const pattern of patterns) {
        const matches = input.match(pattern);
        if (matches) {
          threats.push({
            type: category,
            severity: this._getThreatSeverity(category),
            description: `${category} pattern detected`,
            source: 'pattern',
            evidence: {
              pattern: pattern.toString(),
              matches: matches.slice(0, 3) // Limit to first 3 matches
            },
            riskScore: this._getPatternRiskScore(category),
            timestamp: this.getDeterministicDate()
          });
        }
      }
    }
    
    return threats;
  }

  async _detectBehavioralAnomalies(input, context) {
    const threats = [];
    
    if (!context.userId) {
      return threats; // Skip behavioral analysis without user context
    }
    
    try {
      const behaviorResult = await this.monitorBehavior(context.userId, {
        inputSize: input.length,
        inputType: context.inputType || 'unknown',
        timestamp: this.getDeterministicTimestamp(),
        context
      });
      
      if (behaviorResult.anomalous) {
        threats.push({
          type: 'behavioral-anomaly',
          severity: 'medium',
          description: 'Anomalous user behavior detected',
          source: 'behavioral',
          evidence: {
            anomalies: behaviorResult.patterns,
            score: behaviorResult.anomalyScore
          },
          riskScore: Math.min(behaviorResult.anomalyScore * 10, 100),
          timestamp: this.getDeterministicDate()
        });
      }
    } catch (error) {
      this.logger.warn('Behavioral analysis failed:', error);
    }
    
    return threats;
  }

  async _analyzeContent(input, context) {
    const threats = [];
    
    try {
      // Entropy analysis
      const entropy = this._calculateEntropy(input);
      if (entropy > 7.5) { // High entropy might indicate encryption/encoding
        threats.push({
          type: 'high-entropy-content',
          severity: 'low',
          description: 'Content has unusually high entropy',
          source: 'content-analysis',
          evidence: { entropy },
          riskScore: Math.min((entropy - 7.5) * 20, 30),
          timestamp: this.getDeterministicDate()
        });
      }
      
      // Length analysis
      if (input.length > 1000000) { // Very large inputs
        threats.push({
          type: 'oversized-input',
          severity: 'medium',
          description: 'Input size exceeds normal limits',
          source: 'content-analysis',
          evidence: { size: input.length },
          riskScore: 40,
          timestamp: this.getDeterministicDate()
        });
      }
      
      // Character frequency analysis
      const suspiciousChars = (input.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g) || []).length;
      if (suspiciousChars > input.length * 0.1) {
        threats.push({
          type: 'suspicious-characters',
          severity: 'medium',
          description: 'High frequency of non-printable characters',
          source: 'content-analysis',
          evidence: { suspiciousChars, percentage: (suspiciousChars / input.length) * 100 },
          riskScore: 35,
          timestamp: this.getDeterministicDate()
        });
      }
      
    } catch (error) {
      this.logger.warn('Content analysis failed:', error);
    }
    
    return threats;
  }

  async _detectMLThreats(input, context) {
    // Placeholder for ML-based threat detection
    // In production, this would integrate with trained models
    return [];
  }

  _calculateRiskScore(threats) {
    if (threats.length === 0) return 0;
    
    const severityWeights = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4
    };
    
    let totalScore = 0;
    let maxIndividualScore = 0;
    
    for (const threat of threats) {
      const threatScore = threat.riskScore || (severityWeights[threat.severity] || 1) * 10;
      totalScore += threatScore;
      maxIndividualScore = Math.max(maxIndividualScore, threatScore);
    }
    
    // Use weighted average with emphasis on highest individual threat
    const avgScore = totalScore / threats.length;
    const finalScore = (avgScore * 0.6) + (maxIndividualScore * 0.4);
    
    return Math.min(Math.round(finalScore), 100);
  }

  _generateRecommendations(analysisResult) {
    const recommendations = [];
    
    if (analysisResult.riskScore > 85) {
      recommendations.push('IMMEDIATE ACTION: Block and quarantine input');
      recommendations.push('Conduct manual security review');
    } else if (analysisResult.riskScore > 70) {
      recommendations.push('HIGH RISK: Review input carefully before processing');
      recommendations.push('Apply additional validation and sanitization');
    } else if (analysisResult.riskScore > 50) {
      recommendations.push('MEDIUM RISK: Monitor processing closely');
      recommendations.push('Consider additional logging and audit trails');
    } else if (analysisResult.riskScore > 25) {
      recommendations.push('LOW RISK: Standard monitoring sufficient');
    }
    
    // Threat-specific recommendations
    const threatTypes = new Set(analysisResult.threats.map(t => t.type));
    
    if (threatTypes.has('sqlInjection')) {
      recommendations.push('Use parameterized queries and input validation');
    }
    
    if (threatTypes.has('xss')) {
      recommendations.push('Apply HTML encoding and CSP headers');
    }
    
    if (threatTypes.has('commandInjection')) {
      recommendations.push('Sanitize system command inputs and use allowlists');
    }
    
    if (threatTypes.has('pathTraversal')) {
      recommendations.push('Validate and normalize file paths');
    }
    
    return recommendations;
  }

  _generateInputHash(input) {
    return createHash('sha256').update(input).digest('hex').substring(0, 16);
  }

  _getThreatSeverity(category) {
    const severityMap = {
      sqlInjection: 'critical',
      commandInjection: 'critical',
      xss: 'high',
      pathTraversal: 'high',
      malware: 'critical',
      dataExfiltration: 'high'
    };
    
    return severityMap[category] || 'medium';
  }

  _getPatternRiskScore(category) {
    const riskMap = {
      sqlInjection: 90,
      commandInjection: 95,
      xss: 75,
      pathTraversal: 80,
      malware: 100,
      dataExfiltration: 85
    };
    
    return riskMap[category] || 50;
  }

  _calculateEntropy(str) {
    const freq = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    const length = str.length;
    
    for (const count of Object.values(freq)) {
      const p = count / length;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
  }

  _getUserBaseline(userId) {
    if (!this.behaviorBaselines.has(userId)) {
      this.behaviorBaselines.set(userId, {
        avgInputSize: 0,
        avgRequestFrequency: 0,
        commonInputTypes: new Map(),
        activityPattern: new Map(),
        firstSeen: this.getDeterministicTimestamp(),
        lastUpdated: this.getDeterministicTimestamp(),
        sampleCount: 0
      });
    }
    
    return this.behaviorBaselines.get(userId);
  }

  _updateActivityTracking(userId, activity) {
    const activities = this.suspiciousActivities.get(userId) || [];
    activities.push({
      ...activity,
      timestamp: this.getDeterministicTimestamp()
    });
    
    // Keep only last 100 activities
    if (activities.length > 100) {
      activities.splice(0, activities.length - 100);
    }
    
    this.suspiciousActivities.set(userId, activities);
  }

  _detectActivityAnomalies(userId, activity, baseline) {
    const anomalies = [];
    
    // Input size anomaly
    if (baseline.sampleCount > 10) {
      const sizeRatio = activity.inputSize / (baseline.avgInputSize || 1);
      if (sizeRatio > 10 || sizeRatio < 0.1) {
        anomalies.push({
          type: 'input-size-anomaly',
          score: Math.min(Math.abs(Math.log10(sizeRatio)) * 20, 100),
          details: {
            currentSize: activity.inputSize,
            avgSize: baseline.avgInputSize,
            ratio: sizeRatio
          }
        });
      }
    }
    
    return anomalies;
  }

  _updateBaseline(userId, activity) {
    const baseline = this.behaviorBaselines.get(userId);
    if (!baseline) return;
    
    baseline.sampleCount++;
    
    // Update averages using exponential moving average
    const alpha = 0.1;
    baseline.avgInputSize = (1 - alpha) * baseline.avgInputSize + alpha * activity.inputSize;
    
    // Update input type frequency
    const inputType = activity.inputType || 'unknown';
    const currentCount = baseline.commonInputTypes.get(inputType) || 0;
    baseline.commonInputTypes.set(inputType, currentCount + 1);
    
    baseline.lastUpdated = this.getDeterministicTimestamp();
  }

  _updateDetectionMetrics(detectionTime) {
    const totalDetections = this.metrics.threatsDetected + 1;
    this.metrics.avgDetectionTime = (
      (this.metrics.avgDetectionTime * (totalDetections - 1) + detectionTime) /
      totalDetections
    );
  }

  _cleanupThreatCache() {
    const now = this.getDeterministicTimestamp();
    const expired = [];
    
    for (const [key, entry] of this.threatCache.entries()) {
      if (now - entry.timestamp > 300000) { // 5 minutes
        expired.push(key);
      }
    }
    
    expired.forEach(key => this.threatCache.delete(key));
    
    // Limit cache size
    if (this.threatCache.size > this.config.maxPatternCacheSize) {
      const entries = Array.from(this.threatCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, Math.floor(this.threatCache.size * 0.2));
      toRemove.forEach(([key]) => this.threatCache.delete(key));
    }
  }

  _cleanupSuspiciousActivities() {
    const now = this.getDeterministicTimestamp();
    const dayMs = 24 * 60 * 60 * 1000;
    
    for (const [userId, activities] of this.suspiciousActivities.entries()) {
      const filtered = activities.filter(a => now - a.timestamp < dayMs);
      if (filtered.length === 0) {
        this.suspiciousActivities.delete(userId);
      } else {
        this.suspiciousActivities.set(userId, filtered);
      }
    }
  }
}

export default ThreatDetector;