/**
 * Data Exhaust Monetization System Tests
 * Tests for privacy-preserving data collection and monetization
 */

import { strict as assert } from 'assert';
import { test, describe } from 'node:test';
import { DataExhaustCollector } from '../packages/kgen-marketplace/src/exhaust/collector.js';
import { DataExhaustPublisher } from '../packages/kgen-marketplace/src/exhaust/publisher.js';
import { DifferentialPrivacy } from '../packages/kgen-marketplace/src/privacy/differential.js';
import { C2PACredentials } from '../packages/kgen-marketplace/src/credentials/c2pa.js';
import { ConsentManager } from '../packages/kgen-marketplace/src/consent/manager.js';
import { initializeDataExhaustSystem } from '../packages/kgen-marketplace/src/exhaust/index.js';

describe('Data Exhaust System', () => {
  
  describe('DataExhaustCollector', () => {
    test('should collect and anonymize build metrics', () => {
      const collector = new DataExhaustCollector({
        batchSize: 5,
        storageDir: '.test-kgen/exhaust'
      });

      const buildData = {
        timestamp: Date.now(),
        buildType: 'production',
        duration: 45000,
        success: true,
        templateCount: 12,
        fileCount: 48,
        packageSize: 1024 * 1024,
        dependencies: [
          { name: 'react', version: '18.2.0', type: 'prod' },
          { name: 'jest', version: '29.1.0', type: 'dev' }
        ],
        platform: 'darwin',
        nodeVersion: '18.17.0'
      };

      // Mock consent
      collector.consent = {
        hasConsent: () => true
      };

      collector.collectBuildMetrics(buildData);
      
      assert.equal(collector.buffer.length, 1);
      assert.equal(collector.buffer[0].type, 'build_metrics');
      
      const anonymizedData = collector.buffer[0].data;
      assert.ok(anonymizedData.sessionId);
      assert.ok(anonymizedData.timestamp);
      assert.ok(typeof anonymizedData.duration === 'number');
      assert.equal(anonymizedData.success, true);
    });

    test('should generate insights from collected data', () => {
      const collector = new DataExhaustCollector();
      
      // Mock data
      collector.loadAllBatches = () => [
        {
          id: 'test-batch',
          data: [
            {
              type: 'build_metrics',
              data: {
                duration: 30000,
                success: true,
                templateCount: 5
              }
            },
            {
              type: 'usage_patterns',
              data: {
                command: 'generate',
                executionTime: 2000,
                success: true
              }
            }
          ]
        }
      ];

      const insights = collector.generateInsights();
      
      assert.ok(insights.buildPatterns);
      assert.ok(insights.usageStatistics);
      assert.ok(insights.performanceMetrics);
    });
  });

  describe('DifferentialPrivacy', () => {
    test('should add Laplace noise to numeric data', () => {
      const privacy = new DifferentialPrivacy({
        epsilon: 1.0,
        delta: 1e-5
      });

      const originalValue = 100;
      const noisyValue = privacy.addLaplaceNoise(originalValue);
      
      assert.ok(typeof noisyValue === 'number');
      assert.ok(noisyValue >= 0); // Should be non-negative
      assert.ok(Math.abs(noisyValue - originalValue) < originalValue); // Reasonable noise
    });

    test('should create private histogram', () => {
      const privacy = new DifferentialPrivacy();
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      
      const histogram = privacy.createPrivateHistogram(data, 5, 10);
      
      assert.equal(histogram.length, 5);
      histogram.forEach(count => {
        assert.ok(typeof count === 'number');
        assert.ok(count >= 0);
      });
    });

    test('should validate privacy budget', () => {
      const privacy = new DifferentialPrivacy({ epsilon: 1.0 });
      
      const operations = [
        { epsilon: 0.3 },
        { epsilon: 0.4 },
        { epsilon: 0.2 }
      ];
      
      const budgetUsage = privacy.computeBudgetUsage(operations);
      assert.equal(budgetUsage, 0.9);
      
      const withinBudget = privacy.isWithinBudget(operations, 1.0);
      assert.ok(withinBudget);
    });

    test('should generate privacy report', () => {
      const privacy = new DifferentialPrivacy({ epsilon: 1.0, delta: 1e-5 });
      
      const operations = [
        { epsilon: 0.5, delta: 1e-6 },
        { epsilon: 0.3, delta: 1e-6 }
      ];
      
      const report = privacy.generatePrivacyReport(operations);
      
      assert.ok(report.totalEpsilon);
      assert.ok(report.totalDelta);
      assert.ok(report.budgetUsed);
      assert.ok(report.privacyGuarantees);
      assert.ok(Array.isArray(report.recommendations));
    });
  });

  describe('C2PACredentials', () => {
    test('should create content credentials', () => {
      const credentials = new C2PACredentials({
        issuer: 'test-issuer'
      });

      const packageData = {
        buildMetrics: [{ duration: 30000, success: true }],
        insights: { averageBuildTime: 30000 }
      };

      const metadata = {
        title: 'Test Data Package',
        description: 'Test anonymized data',
        privacy: {
          epsilon: 1.0,
          delta: 1e-5
        }
      };

      const result = credentials.createCredentials(packageData, metadata);
      
      assert.ok(result.manifest);
      assert.ok(result.manifest.version);
      assert.ok(result.manifest.instanceID);
      assert.ok(result.manifest.content_hash);
      assert.ok(result.manifest.assertions);
      assert.ok(result.manifest.provenance);
      assert.ok(result.manifest.privacy);
      assert.ok(result.manifest.consent);
      
      assert.ok(result.credentials);
      assert.equal(result.credentials['@type'], 'CreativeWork');
    });

    test('should assess data quality', () => {
      const credentials = new C2PACredentials();
      
      const packageData = {
        buildMetrics: [1, 2, 3],
        usagePatterns: [1, 2],
        insights: { test: true }
      };

      const completeness = credentials.assessCompleteness(packageData);
      assert.ok(completeness.score >= 0 && completeness.score <= 1);
      
      const accuracy = credentials.assessAccuracy(packageData);
      assert.ok(accuracy.score >= 0 && accuracy.score <= 1);
      
      const consistency = credentials.assessConsistency(packageData);
      assert.ok(consistency.score >= 0 && consistency.score <= 1);
    });
  });

  describe('ConsentManager', () => {
    test('should manage consent permissions', () => {
      const consent = new ConsentManager({
        consentFile: '.test-kgen/consent.json'
      });

      // Initially no consent
      assert.equal(consent.hasConsent('build_metrics'), false);
      
      // Grant consent
      consent.grantConsent(['build_metrics', 'usage_patterns']);
      
      assert.equal(consent.hasConsent('build_metrics'), true);
      assert.equal(consent.hasConsent('usage_patterns'), true);
      assert.equal(consent.hasConsent('monetization'), false);
      
      // Revoke consent
      consent.revokeConsent(['build_metrics']);
      
      assert.equal(consent.hasConsent('build_metrics'), false);
      assert.equal(consent.hasConsent('usage_patterns'), true);
    });

    test('should validate consent for operations', () => {
      const consent = new ConsentManager();
      
      consent.updateConsent({
        build_metrics: true,
        monetization: false
      });

      const validationValid = consent.validateConsent('collection', ['build_metrics']);
      assert.equal(validationValid.valid, true);
      assert.equal(validationValid.missing.length, 0);
      
      const validationInvalid = consent.validateConsent('monetization', ['monetization']);
      assert.equal(validationInvalid.valid, false);
      assert.ok(validationInvalid.missing.includes('monetization'));
    });

    test('should generate consent proof', () => {
      const consent = new ConsentManager();
      
      consent.updateConsent({
        build_metrics: true,
        usage_patterns: true,
        monetization: true
      });

      const proof = consent.generateConsentProof(['build_metrics', 'monetization']);
      
      assert.ok(proof.timestamp);
      assert.ok(proof.consentHash);
      assert.ok(proof.permissions);
      assert.ok(proof.proof);
      assert.equal(proof.permissions.build_metrics, true);
      assert.equal(proof.permissions.monetization, true);
    });

    test('should check GDPR compliance', () => {
      const consent = new ConsentManager();
      
      const compliance = consent.checkGDPRCompliance();
      
      assert.ok(typeof compliance.compliant === 'boolean');
      assert.ok(Array.isArray(compliance.issues));
      assert.ok(Array.isArray(compliance.recommendations));
    });
  });

  describe('DataExhaustPublisher', () => {
    test('should validate publishing consent', () => {
      const mockConsent = {
        validateConsent: (operation, dataTypes) => ({
          valid: dataTypes.every(type => ['build_metrics', 'monetization'].includes(type)),
          missing: dataTypes.filter(type => !['build_metrics', 'monetization'].includes(type)),
          reasons: []
        })
      };

      const publisher = new DataExhaustPublisher({
        marketplaceEndpoint: 'https://test-api.example.com',
        minDataPoints: 10
      });
      
      publisher.consent = mockConsent;

      const validation = publisher.validatePublishingConsent();
      assert.equal(validation.valid, false); // Missing usage_patterns consent
      assert.ok(validation.missing.includes('usage_patterns'));
    });

    test('should calculate value vectors', () => {
      const publisher = new DataExhaustPublisher();
      
      const packageData = {
        metadata: {
          recordCount: 1000,
          timeRange: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString()
          },
          dataQuality: { overall: 0.9 }
        },
        insights: {
          buildPatterns: { diversity: 0.8 },
          usageAnalytics: { variety: 0.7 }
        }
      };

      const valueVectors = publisher.calculateValueVectors(packageData);
      
      assert.ok(valueVectors.volume);
      assert.ok(valueVectors.freshness);
      assert.ok(valueVectors.diversity);
      assert.ok(valueVectors.quality);
      assert.ok(valueVectors.uniqueness);
      
      // Check normalization
      Object.values(valueVectors).forEach(vector => {
        if (vector.normalized !== undefined) {
          assert.ok(vector.normalized >= 0 && vector.normalized <= 1);
        }
      });
    });
  });

  describe('Integration Tests', () => {
    test('should initialize complete data exhaust system', () => {
      const system = initializeDataExhaustSystem({
        collector: {
          batchSize: 10,
          storageDir: '.test-kgen/exhaust'
        },
        consent: {
          consentFile: '.test-kgen/consent.json'
        }
      });

      assert.ok(system.consent);
      assert.ok(system.collector);
      assert.ok(system.publisher);
      assert.ok(typeof system.collectBuildMetrics === 'function');
      assert.ok(typeof system.updateConsent === 'function');
      assert.ok(typeof system.publishData === 'function');
    });

    test('should handle end-to-end data flow', async () => {
      const system = initializeDataExhaustSystem({
        collector: {
          batchSize: 2,
          storageDir: '.test-kgen/exhaust'
        },
        publisher: {
          minDataPoints: 1
        }
      });

      // Grant consent
      await system.updateConsent({
        build_metrics: true,
        usage_patterns: true,
        monetization: true
      });

      // Collect some data
      await system.collectBuildMetrics({
        timestamp: Date.now(),
        duration: 30000,
        success: true,
        templateCount: 5
      });

      await system.collectUsagePattern({
        timestamp: Date.now(),
        command: 'generate',
        executionTime: 2000,
        success: true
      });

      // Check consent status
      const consentStatus = system.getConsentStatus();
      assert.equal(consentStatus.permissions.build_metrics, true);
      assert.equal(consentStatus.permissions.monetization, true);

      // Generate insights
      const insights = system.generateInsights();
      assert.ok(insights);
      
      // This would normally publish to marketplace
      // For testing, we just verify the system is properly configured
      assert.ok(system.publisher.config.minDataPoints);
    });
  });

  describe('Privacy Compliance Tests', () => {
    test('should ensure no PII in anonymized data', () => {
      const collector = new DataExhaustCollector();
      
      const buildData = {
        timestamp: Date.now(),
        userId: 'user123@email.com', // PII that should be removed
        projectPath: '/Users/john/my-secret-project', // Sensitive path
        duration: 45000,
        success: true,
        templateCount: 12
      };

      collector.consent = { hasConsent: () => true };

      const anonymized = collector.anonymizeBuildData(buildData);
      
      // Ensure no direct PII
      assert.ok(!anonymized.userId);
      assert.ok(!anonymized.projectPath);
      assert.ok(!anonymized.email);
      
      // Ensure data is still useful
      assert.ok(anonymized.sessionId);
      assert.ok(typeof anonymized.duration === 'number');
      assert.ok(typeof anonymized.templateCount === 'number');
      assert.equal(anonymized.success, true);
    });

    test('should respect data collection consent', () => {
      const collector = new DataExhaustCollector();
      
      // Mock consent that denies build metrics
      collector.consent = {
        hasConsent: (type) => type !== 'build_metrics'
      };

      const buildData = { duration: 30000, success: true };
      
      collector.collectBuildMetrics(buildData);
      
      // Should not collect data without consent
      assert.equal(collector.buffer.length, 0);
    });

    test('should apply differential privacy correctly', () => {
      const privacy = new DifferentialPrivacy({ epsilon: 1.0 });
      
      const sensitiveData = {
        userCount: 1000,
        averageTime: 45.5,
        errorRate: 0.05
      };

      const noisyData = privacy.addNoise(sensitiveData, ['userCount', 'averageTime']);
      
      // Data should be modified but still meaningful
      assert.notEqual(noisyData.userCount, sensitiveData.userCount);
      assert.notEqual(noisyData.averageTime, sensitiveData.averageTime);
      assert.equal(noisyData.errorRate, sensitiveData.errorRate); // Not in numeric fields
      
      // Values should be reasonably close
      assert.ok(Math.abs(noisyData.userCount - sensitiveData.userCount) < 200);
      assert.ok(Math.abs(noisyData.averageTime - sensitiveData.averageTime) < 20);
    });
  });
});