/**
 * CommonJS Version of Job Matching System for Testing
 */

const SkillOntology = require('../ontology/skill-ontology-cjs');
const CompatibilityScorer = require('./compatibility-scorer-cjs');

// Simplified version for testing without full ES module setup
class JobMatcher {
  constructor(options = {}) {
    this.scorer = new CompatibilityScorer();
    this.cache = new Map();
    this.options = {
      minScore: options.minScore || 60,
      maxResults: options.maxResults || 20,
      enableCaching: options.enableCaching !== false,
      ...options
    };
  }

  async findMatchingJobs(candidate, jobs, filters = {}) {
    const matches = [];
    
    for (const job of jobs) {
      const compatibility = this.scorer.calculateCompatibility(job, candidate);
      
      if (compatibility.overallScore >= this.options.minScore) {
        matches.push({
          job,
          candidate,
          compatibility,
          matchedAt: new Date().toISOString()
        });
      }
    }

    return matches.sort((a, b) => b.compatibility.overallScore - a.compatibility.overallScore);
  }

  analyzeMatch(job, candidate) {
    return this.scorer.calculateCompatibility(job, candidate);
  }

  clearCache() {
    this.cache.clear();
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      enabled: this.options.enableCaching
    };
  }
}

class JobMatchingEngine {
  constructor(options = {}) {
    this.matcher = new JobMatcher(options);
    this.ontology = new SkillOntology();
  }

  async findJobsForCandidate(candidate, jobs) {
    const matches = await this.matcher.findMatchingJobs(candidate, jobs);
    return {
      matches,
      totalJobs: jobs.length,
      filteredJobs: matches.length
    };
  }

  analyzeCompatibility(job, candidate) {
    return this.matcher.analyzeMatch(job, candidate);
  }

  getSystemMetrics() {
    return {
      cache: this.matcher.getCacheStats(),
      version: '1.0.0'
    };
  }

  clearCaches() {
    this.matcher.clearCache();
  }
}

module.exports = {
  JobMatchingEngine,
  JobMatcher,
  CompatibilityScorer,
  SkillOntology
};