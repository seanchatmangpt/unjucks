/**
 * Job Matching System - Main Entry Point
 * Provides a unified interface for all matching capabilities
 */

const JobMatcher = require('./job-matcher');
const CompatibilityScorer = require('./compatibility-scorer');
const CareerRecommender = require('../recommendation/career-recommender');
const SkillOntology = require('../ontology/skill-ontology');

class JobMatchingEngine {
  constructor(options = {}) {
    this.matcher = new JobMatcher(options);
    this.scorer = new CompatibilityScorer();
    this.recommender = new CareerRecommender();
    this.ontology = new SkillOntology();
    
    this.config = {
      enableCache: options.enableCache !== false,
      minScore: options.minScore || 60,
      maxResults: options.maxResults || 20,
      enableRecommendations: options.enableRecommendations !== false,
      ...options
    };
  }

  /**
   * Find matching jobs for a candidate with recommendations
   * @param {Object} candidate - Candidate profile
   * @param {Array} jobs - Available job postings
   * @param {Object} options - Search options
   * @returns {Object} Complete matching results with recommendations
   */
  async findJobsForCandidate(candidate, jobs, options = {}) {
    const matches = await this.matcher.findMatchingJobs(candidate, jobs, options.filters);
    
    let recommendations = null;
    if (this.config.enableRecommendations) {
      recommendations = this.recommender.generateCareerRecommendations(candidate, jobs);
    }

    return {
      matches,
      totalJobs: jobs.length,
      filteredJobs: matches.length,
      recommendations,
      searchMetadata: {
        candidateId: candidate.id,
        searchedAt: new Date().toISOString(),
        filters: options.filters,
        config: this.config
      }
    };
  }

  /**
   * Find matching candidates for a job with diversity insights
   * @param {Object} job - Job posting
   * @param {Array} candidates - Available candidates
   * @param {Object} options - Search options
   * @returns {Object} Complete matching results with insights
   */
  async findCandidatesForJob(job, candidates, options = {}) {
    const matches = await this.matcher.findMatchingCandidates(job, candidates, options.filters);
    
    const insights = this.generateHiringInsights(job, matches);
    
    return {
      matches,
      totalCandidates: candidates.length,
      qualifiedCandidates: matches.length,
      insights,
      searchMetadata: {
        jobId: job.id,
        searchedAt: new Date().toISOString(),
        filters: options.filters,
        config: this.config
      }
    };
  }

  /**
   * Perform mutual matching analysis
   * @param {Array} jobs - Job postings
   * @param {Array} candidates - Candidate profiles
   * @returns {Object} Mutual matching results
   */
  async findMutualMatches(jobs, candidates) {
    const mutualMatches = await this.matcher.findMutualMatches(jobs, candidates);
    
    return {
      mutualMatches,
      totalPossiblePairs: jobs.length * candidates.length,
      viablePairs: mutualMatches.length,
      efficiency: mutualMatches.length / (jobs.length * candidates.length),
      insights: this.generateMutualMatchingInsights(mutualMatches)
    };
  }

  /**
   * Get detailed compatibility analysis
   * @param {Object} job - Job posting
   * @param {Object} candidate - Candidate profile
   * @returns {Object} Detailed analysis with recommendations
   */
  analyzeCompatibility(job, candidate) {
    const analysis = this.matcher.analyzeMatch(job, candidate);
    
    // Enhance with skill relationship details
    analysis.skillAnalysis = this.analyzeSkillRelationships(
      job.requiredSkills || [],
      candidate.skills || []
    );
    
    return analysis;
  }

  /**
   * Generate career development recommendations
   * @param {Object} candidate - Candidate profile
   * @param {Array} marketData - Current job market data
   * @returns {Object} Career recommendations
   */
  generateCareerRecommendations(candidate, marketData = []) {
    return this.recommender.generateCareerRecommendations(candidate, marketData);
  }

  /**
   * Analyze skill relationships between job requirements and candidate skills
   * @param {Array} requiredSkills - Job required skills
   * @param {Array} candidateSkills - Candidate skills
   * @returns {Object} Skill relationship analysis
   */
  analyzeSkillRelationships(requiredSkills, candidateSkills) {
    const relationships = this.ontology.calculateSkillSimilarity(
      requiredSkills.map(s => s.name || s),
      candidateSkills.map(s => s.name || s)
    );

    const analysis = {
      exactMatches: relationships.filter(r => r.match.type === 'exact'),
      relatedMatches: relationships.filter(r => r.match.type !== 'exact' && r.match.score > 0),
      missingSkills: relationships.filter(r => r.match.score === 0),
      strengthAreas: this.identifySkillStrengths(relationships),
      developmentAreas: this.identifySkillGaps(relationships),
      transferableSkills: this.identifyTransferableSkills(relationships)
    };

    return analysis;
  }

  /**
   * Get system performance metrics
   * @returns {Object} Performance and usage metrics
   */
  getSystemMetrics() {
    return {
      cache: this.matcher.getCacheStats(),
      ontology: {
        skillCount: this.ontology.skillHierarchy.size,
        synonymCount: this.ontology.skillSynonyms.size,
        domainCount: this.ontology.domainMappings.size
      },
      config: this.config,
      version: '1.0.0'
    };
  }

  /**
   * Update system configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Update component configurations
    this.matcher.options = { ...this.matcher.options, ...newConfig };
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.matcher.clearCache();
  }

  /**
   * Helper methods for insights generation
   */
  generateHiringInsights(job, matches) {
    const insights = {
      candidatePool: {
        total: matches.length,
        highQuality: matches.filter(m => m.compatibility.overallScore >= 80).length,
        qualified: matches.filter(m => m.compatibility.overallScore >= 70).length,
        potential: matches.filter(m => m.compatibility.overallScore >= 60).length
      },
      skillAvailability: this.analyzeSkillAvailability(job, matches),
      competitionLevel: this.assessCompetitionLevel(matches),
      diversityMetrics: this.calculateDiversityMetrics(matches),
      timeToFill: this.estimateTimeToFill(job, matches)
    };

    return insights;
  }

  generateMutualMatchingInsights(mutualMatches) {
    return {
      topMatches: mutualMatches.slice(0, 10),
      averageMutualScore: mutualMatches.reduce((sum, m) => sum + m.mutualScore, 0) / mutualMatches.length,
      balanceMetrics: this.calculateMatchBalance(mutualMatches),
      recommendedPairs: this.identifyOptimalPairs(mutualMatches)
    };
  }

  identifySkillStrengths(relationships) {
    return relationships
      .filter(r => r.match.score >= 0.8)
      .map(r => ({
        skill: r.required,
        match: r.match.skill,
        strength: r.match.score
      }));
  }

  identifySkillGaps(relationships) {
    return relationships
      .filter(r => r.match.score < 0.5)
      .map(r => ({
        skill: r.required,
        gap: 1 - r.match.score,
        priority: this.calculateGapPriority(r.required)
      }));
  }

  identifyTransferableSkills(relationships) {
    return relationships
      .filter(r => r.match.type === 'sibling' || r.match.type === 'domain')
      .map(r => ({
        from: r.match.skill,
        to: r.required,
        transferability: r.match.score
      }));
  }

  analyzeSkillAvailability(job, matches) {
    const requiredSkills = job.requiredSkills || [];
    const availability = {};

    for (const skill of requiredSkills) {
      const skillName = skill.name || skill;
      const candidatesWithSkill = matches.filter(m =>
        m.candidate.skills?.some(cs => 
          this.ontology.normalizeSkill(cs.name || cs) === this.ontology.normalizeSkill(skillName)
        )
      ).length;

      availability[skillName] = {
        candidateCount: candidatesWithSkill,
        availability: candidatesWithSkill / matches.length,
        scarcity: 1 - (candidatesWithSkill / matches.length)
      };
    }

    return availability;
  }

  assessCompetitionLevel(matches) {
    const averageScore = matches.reduce((sum, m) => sum + m.compatibility.overallScore, 0) / matches.length;
    const highQualityCandidates = matches.filter(m => m.compatibility.overallScore >= 80).length;
    
    return {
      level: highQualityCandidates > 10 ? 'high' : highQualityCandidates > 5 ? 'medium' : 'low',
      averageQuality: averageScore,
      topTierCount: highQualityCandidates
    };
  }

  calculateDiversityMetrics(matches) {
    // Simplified diversity calculation
    const demographics = {};
    let totalWithDemographics = 0;

    for (const match of matches) {
      if (match.candidate.demographics) {
        totalWithDemographics++;
        for (const [key, value] of Object.entries(match.candidate.demographics)) {
          if (!demographics[key]) demographics[key] = {};
          demographics[key][value] = (demographics[key][value] || 0) + 1;
        }
      }
    }

    return {
      dataAvailability: totalWithDemographics / matches.length,
      distribution: demographics
    };
  }

  estimateTimeToFill(job, matches) {
    const highQualityCandidates = matches.filter(m => m.compatibility.overallScore >= 80).length;
    
    if (highQualityCandidates >= 5) return { estimate: 30, confidence: 0.8 };
    if (highQualityCandidates >= 2) return { estimate: 45, confidence: 0.7 };
    return { estimate: 60, confidence: 0.6 };
  }

  calculateMatchBalance(mutualMatches) {
    const balanceScores = mutualMatches.map(m => m.mutualFit.balance);
    const averageBalance = balanceScores.reduce((sum, score) => sum + score, 0) / balanceScores.length;
    
    return {
      average: averageBalance,
      distribution: {
        highBalance: balanceScores.filter(s => s >= 0.8).length,
        mediumBalance: balanceScores.filter(s => s >= 0.6 && s < 0.8).length,
        lowBalance: balanceScores.filter(s => s < 0.6).length
      }
    };
  }

  identifyOptimalPairs(mutualMatches) {
    return mutualMatches
      .filter(m => m.mutualScore >= 80 && m.mutualFit.balance >= 0.7)
      .slice(0, 10)
      .map(m => ({
        jobId: m.job.id,
        candidateId: m.candidate.id,
        mutualScore: m.mutualScore,
        balance: m.mutualFit.balance,
        recommendation: 'immediate-interview'
      }));
  }

  calculateGapPriority(skill) {
    const skillData = this.recommender.skillDemandData.get(skill);
    return skillData ? skillData.demand * skillData.growth : 0.5;
  }
}

module.exports = {
  JobMatchingEngine,
  JobMatcher,
  CompatibilityScorer,
  CareerRecommender,
  SkillOntology
};