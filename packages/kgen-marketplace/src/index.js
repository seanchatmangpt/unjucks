/**
 * KGen Marketplace - Data Exhaust Monetization System
 * Main entry point for ethical data exhaust economy
 */

// Core data exhaust system
export {
  DataExhaustCollector,
  DataExhaustPublisher,
  initializeDataExhaustSystem,
  defaultConfig
} from './exhaust/index.js';

// Privacy and anonymization
export { DifferentialPrivacy } from './privacy/differential.js';

// Content credentials and provenance
export { C2PACredentials } from './credentials/c2pa.js';

// Consent management
export { ConsentManager } from './consent/manager.js';

// Demo functions
export { demonstrateDataExhaustSystem } from './exhaust/demo.js';
export { anonymizeBuildData } from './exhaust/simple-demo.js';

/**
 * Quick start function for data exhaust monetization
 */
export async function quickStart(options = {}) {
  const { initializeDataExhaustSystem } = await import('./exhaust/index.js');
  
  const system = initializeDataExhaustSystem({
    consent: {
      consentFile: '.kgen/consent.json',
      ...options.consent
    },
    collector: {
      batchSize: 100,
      storageDir: '.kgen/exhaust',
      ...options.collector
    },
    privacy: {
      epsilon: 1.0,
      delta: 1e-5,
      ...options.privacy
    },
    ...options
  });

  // Grant basic consent if requested
  if (options.grantConsent) {
    await system.updateConsent({
      build_metrics: true,
      usage_patterns: true,
      monetization: true
    });
  }

  return system;
}

/**
 * Privacy compliance checker
 */
export function checkPrivacyCompliance(data, requirements = {}) {
  const checks = {
    pii_removed: !hasPII(data),
    anonymized: isAnonymized(data),
    consent_obtained: requirements.consent === true,
    gdpr_compliant: true,
    ccpa_compliant: true
  };

  return {
    compliant: Object.values(checks).every(Boolean),
    checks,
    recommendations: generateRecommendations(checks)
  };
}

/**
 * Helper functions
 */
function hasPII(data) {
  const piiFields = ['email', 'phone', 'ssn', 'userId', 'name', 'address'];
  const dataStr = JSON.stringify(data).toLowerCase();
  
  return piiFields.some(field => dataStr.includes(field)) ||
         /@/.test(dataStr) || // Email pattern
         /\d{3}-\d{3}-\d{4}/.test(dataStr); // Phone pattern
}

function isAnonymized(data) {
  // Check for anonymization indicators
  const indicators = ['sessionId', 'hash', 'anon-', 'anonymous'];
  const dataStr = JSON.stringify(data).toLowerCase();
  
  return indicators.some(indicator => dataStr.includes(indicator));
}

function generateRecommendations(checks) {
  const recommendations = [];
  
  if (!checks.pii_removed) {
    recommendations.push('Remove or hash all PII before collection');
  }
  
  if (!checks.anonymized) {
    recommendations.push('Apply anonymization techniques like hashing or generalization');
  }
  
  if (!checks.consent_obtained) {
    recommendations.push('Obtain explicit user consent before data collection');
  }
  
  return recommendations;
}

export default {
  quickStart,
  checkPrivacyCompliance,
  initializeDataExhaustSystem,
  DifferentialPrivacy,
  C2PACredentials,
  ConsentManager
};