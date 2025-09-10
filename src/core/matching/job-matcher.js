/**
 * Job Matching Engine
 * Main orchestrator for semantic job-resume matching
 */

const CompatibilityScorer = require('./compatibility-scorer');

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

  /**
   * Find best matching jobs for a candidate
   * @param {Object} candidate - Candidate profile
   * @param {Array} jobs - Array of job postings
   * @param {Object} filters - Optional filters
   * @returns {Array} Ranked job matches
   */
  async findMatchingJobs(candidate, jobs, filters = {}) {
    const cacheKey = this.generateCacheKey('jobs', candidate.id, filters);
    
    if (this.options.enableCaching && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let filteredJobs = this.applyFilters(jobs, filters);
    const matches = [];

    for (const job of filteredJobs) {
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

    // Sort by score and confidence
    matches.sort((a, b) => {
      const scoreA = a.compatibility.overallScore * a.compatibility.confidence;
      const scoreB = b.compatibility.overallScore * b.compatibility.confidence;
      return scoreB - scoreA;
    });

    const results = matches.slice(0, this.options.maxResults);
    
    if (this.options.enableCaching) {
      this.cache.set(cacheKey, results);
    }

    return results;
  }

  /**
   * Find best matching candidates for a job
   * @param {Object} job - Job posting
   * @param {Array} candidates - Array of candidate profiles
   * @param {Object} filters - Optional filters
   * @returns {Array} Ranked candidate matches
   */
  async findMatchingCandidates(job, candidates, filters = {}) {
    const cacheKey = this.generateCacheKey('candidates', job.id, filters);
    
    if (this.options.enableCaching && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let filteredCandidates = this.applyCandidateFilters(candidates, filters);
    const matches = [];

    for (const candidate of filteredCandidates) {
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

    // Sort by score and confidence, with diversity consideration
    matches.sort((a, b) => {
      const scoreA = a.compatibility.overallScore * a.compatibility.confidence;
      const scoreB = b.compatibility.overallScore * b.compatibility.confidence;
      return scoreB - scoreA;
    });

    const results = this.diversifyResults(matches).slice(0, this.options.maxResults);
    
    if (this.options.enableCaching) {
      this.cache.set(cacheKey, results);
    }

    return results;
  }

  /**
   * Perform mutual matching - find best job-candidate pairs
   * @param {Array} jobs - Job postings
   * @param {Array} candidates - Candidate profiles
   * @returns {Array} Mutual matches
   */
  async findMutualMatches(jobs, candidates) {
    const mutualMatches = [];
    const processedPairs = new Set();

    for (const job of jobs) {
      const candidateMatches = await this.findMatchingCandidates(job, candidates);
      
      for (const match of candidateMatches.slice(0, 5)) { // Top 5 candidates per job
        const pairKey = `${job.id}-${match.candidate.id}`;
        
        if (!processedPairs.has(pairKey)) {
          // Check reverse compatibility
          const jobMatches = await this.findMatchingJobs(match.candidate, [job]);
          
          if (jobMatches.length > 0) {
            const mutualScore = (match.compatibility.overallScore + jobMatches[0].compatibility.overallScore) / 2;
            
            mutualMatches.push({
              job,
              candidate: match.candidate,
              mutualScore,
              jobToCandidate: match.compatibility,
              candidateToJob: jobMatches[0].compatibility,
              mutualFit: this.calculateMutualFit(match.compatibility, jobMatches[0].compatibility)
            });
          }
          
          processedPairs.add(pairKey);
        }
      }
    }

    return mutualMatches
      .sort((a, b) => b.mutualScore - a.mutualScore)
      .slice(0, this.options.maxResults);
  }

  /**
   * Get detailed match analysis
   * @param {Object} job - Job posting
   * @param {Object} candidate - Candidate profile
   * @returns {Object} Detailed analysis
   */
  analyzeMatch(job, candidate) {
    const compatibility = this.scorer.calculateCompatibility(job, candidate);
    
    return {
      ...compatibility,
      analysis: {
        strengthAreas: this.identifyStrengths(compatibility),
        improvementAreas: this.identifyImprovements(compatibility),
        riskFactors: this.identifyRisks(compatibility),
        competitiveAdvantages: this.identifyAdvantages(compatibility)
      },
      timeline: this.generateHiringTimeline(compatibility),
      metadata: {
        analyzedAt: new Date().toISOString(),
        jobId: job.id,
        candidateId: candidate.id,
        version: '1.0.0'
      }
    };
  }

  /**
   * Apply filters to job postings
   */
  applyFilters(jobs, filters) {
    return jobs.filter(job => {
      if (filters.location && !this.matchesLocation(job.location, filters.location)) {
        return false;
      }
      
      if (filters.salary && !this.matchesSalary(job.salary, filters.salary)) {
        return false;
      }
      
      if (filters.remote !== undefined && job.remote !== filters.remote) {
        return false;
      }
      
      if (filters.industry && job.industry !== filters.industry) {
        return false;
      }
      
      if (filters.experienceLevel && !this.matchesExperienceLevel(job.experience, filters.experienceLevel)) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Apply filters to candidates
   */
  applyCandidateFilters(candidates, filters) {
    return candidates.filter(candidate => {
      if (filters.experience && candidate.totalExperience < filters.experience.min) {
        return false;
      }
      
      if (filters.education && !this.matchesEducationFilter(candidate.education, filters.education)) {
        return false;
      }
      
      if (filters.skills && !this.hasRequiredSkills(candidate.skills, filters.skills)) {
        return false;
      }
      
      if (filters.location && !this.candidateMatchesLocation(candidate.location, filters.location)) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Diversify results to promote equality and inclusion
   */
  diversifyResults(matches) {
    // Group by different diversity factors
    const diversityGroups = new Map();
    
    for (const match of matches) {
      const candidate = match.candidate;
      const diversityKey = this.generateDiversityKey(candidate);
      
      if (!diversityGroups.has(diversityKey)) {
        diversityGroups.set(diversityKey, []);
      }
      diversityGroups.get(diversityKey).push(match);
    }

    // Interleave results to ensure diversity
    const diversified = [];
    const maxPerGroup = Math.ceil(this.options.maxResults / diversityGroups.size);
    
    for (const [key, groupMatches] of diversityGroups) {
      diversified.push(...groupMatches.slice(0, maxPerGroup));
    }

    return diversified.sort((a, b) => {
      const scoreA = a.compatibility.overallScore * a.compatibility.confidence;
      const scoreB = b.compatibility.overallScore * b.compatibility.confidence;
      return scoreB - scoreA;
    });
  }

  /**
   * Helper methods
   */
  generateCacheKey(type, id, filters) {
    return `${type}-${id}-${JSON.stringify(filters)}`;
  }

  calculateMutualFit(jobToCandidate, candidateToJob) {
    const avgScore = (jobToCandidate.overallScore + candidateToJob.overallScore) / 2;
    const avgConfidence = (jobToCandidate.confidence + candidateToJob.confidence) / 2;
    
    return {
      score: avgScore,
      confidence: avgConfidence,
      balance: 1 - Math.abs(jobToCandidate.overallScore - candidateToJob.overallScore) / 100
    };
  }

  identifyStrengths(compatibility) {
    const strengths = [];
    
    if (compatibility.breakdown.skills.score >= 80) {
      strengths.push('Strong technical skill match');
    }
    
    if (compatibility.breakdown.experience.score >= 85) {
      strengths.push('Excellent experience alignment');
    }
    
    if (compatibility.breakdown.location.score >= 90) {
      strengths.push('Ideal location fit');
    }
    
    return strengths;
  }

  identifyImprovements(compatibility) {
    const improvements = [];
    
    if (compatibility.breakdown.skills.score < 70) {
      improvements.push('Skill development needed');
    }
    
    if (compatibility.breakdown.experience.score < 60) {
      improvements.push('More experience required');
    }
    
    return improvements;
  }

  identifyRisks(compatibility) {
    const risks = [];
    
    if (compatibility.confidence < 0.6) {
      risks.push('Low confidence in match quality');
    }
    
    if (compatibility.breakdown.skills.missing?.length > 3) {
      risks.push('Significant skill gaps');
    }
    
    return risks;
  }

  identifyAdvantages(compatibility) {
    const advantages = [];
    
    if (compatibility.breakdown.experience.status === 'qualified' && compatibility.breakdown.experience.score > 90) {
      advantages.push('Overqualified candidate with strong experience');
    }
    
    return advantages;
  }

  generateHiringTimeline(compatibility) {
    const baseTime = 30; // 30 days base timeline
    const adjustments = {
      skillGap: compatibility.breakdown.skills.missing?.length * 5 || 0,
      experienceGap: compatibility.breakdown.experience.gap * 10 || 0,
      educationGap: compatibility.breakdown.education.gap * 15 || 0
    };
    
    return {
      estimated: baseTime + Object.values(adjustments).reduce((sum, adj) => sum + adj, 0),
      factors: adjustments
    };
  }

  generateDiversityKey(candidate) {
    // Create diversity key based on available demographic data
    // This is a simplified version - real implementation would be more sophisticated
    const factors = [];
    
    if (candidate.demographics?.gender) {
      factors.push(candidate.demographics.gender);
    }
    
    if (candidate.education?.university) {
      factors.push(candidate.education.university.slice(0, 3)); // University diversity
    }
    
    if (candidate.location?.state) {
      factors.push(candidate.location.state);
    }
    
    return factors.join('-') || 'default';
  }

  // Additional helper methods for filters
  matchesLocation(jobLocation, filterLocation) {
    if (filterLocation.remote && jobLocation.remote) return true;
    return jobLocation.city === filterLocation.city || jobLocation.state === filterLocation.state;
  }

  matchesSalary(jobSalary, filterSalary) {
    return jobSalary.min >= filterSalary.min && jobSalary.max <= filterSalary.max;
  }

  matchesExperienceLevel(jobExp, filterExp) {
    const jobYears = this.scorer.parseExperienceYears(jobExp);
    return jobYears >= filterExp.min && jobYears <= filterExp.max;
  }

  matchesEducationFilter(candidateEd, filterEd) {
    const candLevel = this.scorer.parseEducationLevel(candidateEd);
    return candLevel === filterEd.level;
  }

  hasRequiredSkills(candidateSkills, requiredSkills) {
    const candSkillNames = candidateSkills.map(s => s.name || s).map(s => s.toLowerCase());
    return requiredSkills.every(req => 
      candSkillNames.some(cand => cand.includes(req.toLowerCase()))
    );
  }

  candidateMatchesLocation(candidateLocation, filterLocation) {
    if (candidateLocation.remotePreference) return true;
    return this.matchesLocation(candidateLocation, filterLocation);
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

module.exports = JobMatcher;