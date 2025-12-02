/**
 * Data Exhaust Monetization System
 * Main entry point for ethical data exhaust economy
 */

export { DataExhaustCollector } from './collector.js';
export { DataExhaustPublisher } from './publisher.js';
export { DifferentialPrivacy } from '../privacy/differential.js';
export { C2PACredentials } from '../credentials/c2pa.js';
export { ConsentManager } from '../consent/manager.js';

import { DataExhaustCollector } from './collector.js';
import { DataExhaustPublisher } from './publisher.js';
import { ConsentManager } from '../consent/manager.js';

/**
 * Initialize complete data exhaust system
 */
export function initializeDataExhaustSystem(options = {}) {
  const consent = new ConsentManager(options.consent);
  const collector = new DataExhaustCollector({
    ...options.collector,
    consent
  });
  const publisher = new DataExhaustPublisher({
    ...options.publisher,
    collector,
    consent
  });

  return {
    consent,
    collector,
    publisher,
    
    // Convenience methods
    async collectBuildMetrics(data) {
      return collector.collectBuildMetrics(data);
    },
    
    async collectDriftReport(data) {
      return collector.collectDriftReport(data);
    },
    
    async collectUsagePattern(data) {
      return collector.collectUsagePattern(data);
    },
    
    async publishData(options) {
      return publisher.publishDataExhaust(options);
    },
    
    async updateConsent(permissions, options) {
      return consent.updateConsent(permissions, options);
    },
    
    getConsentStatus() {
      return consent.getConsentStatus();
    },
    
    generateInsights() {
      return collector.generateInsights();
    }
  };
}

/**
 * Default configuration for data exhaust system
 */
export const defaultConfig = {
  collector: {
    batchSize: 100,
    flushInterval: 300000, // 5 minutes
    storageDir: '.kgen/exhaust'
  },
  
  publisher: {
    publishingInterval: 24 * 60 * 60 * 1000, // 24 hours
    minDataPoints: 100,
    valueCalculation: 'automatic'
  },
  
  consent: {
    consentFile: '.kgen/consent.json',
    defaultConsent: {
      build_metrics: false,
      drift_reports: false,
      usage_patterns: false,
      performance_data: false,
      error_reports: false,
      template_usage: false,
      monetization: false
    }
  },
  
  privacy: {
    epsilon: 1.0,
    delta: 1e-5,
    mechanism: 'laplace'
  },
  
  credentials: {
    issuer: 'kgen-marketplace',
    signingAlgorithm: 'RS256',
    version: '1.0'
  }
};

export default {
  initializeDataExhaustSystem,
  defaultConfig,
  DataExhaustCollector,
  DataExhaustPublisher,
  ConsentManager
};