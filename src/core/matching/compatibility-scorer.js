/**
 * Compatibility Scoring Engine
 * Implements semantic matching with confidence scoring (0-100%)
 */

const SkillOntology = require('../ontology/skill-ontology');

class CompatibilityScorer {
  constructor() {
    this.skillOntology = new SkillOntology();
    this.weights = {
      skills: 0.40,
      experience: 0.25,
      education: 0.15,
      location: 0.10,
      preferences: 0.10
    };
  }

  /**
   * Main compatibility scoring function
   * @param {Object} job - Job posting object
   * @param {Object} candidate - Candidate profile object
   * @returns {Object} Compatibility score with breakdown
   */
  calculateCompatibility(job, candidate) {
    const skillScore = this.calculateSkillCompatibility(job.requiredSkills, candidate.skills);
    const experienceScore = this.calculateExperienceCompatibility(job.experience, candidate.experience);
    const educationScore = this.calculateEducationCompatibility(job.education, candidate.education);
    const locationScore = this.calculateLocationCompatibility(job.location, candidate.location);
    const preferenceScore = this.calculatePreferenceCompatibility(job.preferences, candidate.preferences);

    const overallScore = Math.round(
      skillScore.score * this.weights.skills +
      experienceScore.score * this.weights.experience +
      educationScore.score * this.weights.education +
      locationScore.score * this.weights.location +
      preferenceScore.score * this.weights.preferences
    );

    return {
      overallScore,
      confidence: this.calculateConfidence([skillScore, experienceScore, educationScore, locationScore, preferenceScore]),
      breakdown: {
        skills: skillScore,
        experience: experienceScore,
        education: educationScore,
        location: locationScore,
        preferences: preferenceScore
      },
      recommendations: this.generateRecommendations(job, candidate, {
        skills: skillScore,
        experience: experienceScore,
        education: educationScore
      })
    };
  }

  /**
   * Calculate skill compatibility using semantic matching
   */
  calculateSkillCompatibility(requiredSkills, candidateSkills) {
    if (!requiredSkills?.length) {
      return { score: 50, confidence: 0.3, details: [], coverage: 0 };
    }

    const similarities = this.skillOntology.calculateSkillSimilarity(
      requiredSkills.map(s => s.name || s),
      candidateSkills.map(s => s.name || s)
    );

    let totalScore = 0;
    let weightedScore = 0;
    let totalWeight = 0;
    const matchDetails = [];

    for (const similarity of similarities) {
      const requiredSkill = requiredSkills.find(s => 
        (s.name || s) === similarity.required
      );
      const importance = requiredSkill?.importance || 'medium';
      const weight = this.getImportanceWeight(importance);
      
      const skillWeight = this.skillOntology.getSkillWeight(similarity.required);
      const adjustedScore = similarity.match.score * 100 * skillWeight;
      
      totalScore += adjustedScore;
      weightedScore += adjustedScore * weight;
      totalWeight += weight;
      
      matchDetails.push({
        required: similarity.required,
        matched: similarity.match.skill,
        score: Math.round(adjustedScore),
        type: similarity.match.type,
        importance,
        weight
      });
    }

    const coverage = similarities.filter(s => s.match.score > 0).length / similarities.length;
    const avgScore = totalScore / similarities.length;
    const weightedAvgScore = totalWeight > 0 ? weightedScore / totalWeight : avgScore;
    
    return {
      score: Math.round(weightedAvgScore),
      confidence: this.calculateSkillConfidence(matchDetails, coverage),
      details: matchDetails,
      coverage: Math.round(coverage * 100),
      missing: similarities.filter(s => s.match.score === 0).map(s => s.required)
    };
  }

  /**
   * Calculate experience level compatibility
   */
  calculateExperienceCompatibility(requiredExp, candidateExp) {
    if (!requiredExp) {
      return { score: 75, confidence: 0.5, details: 'No experience requirement specified' };
    }

    const reqYears = this.parseExperienceYears(requiredExp);
    const candYears = this.parseExperienceYears(candidateExp);

    if (candYears >= reqYears) {
      const overqualification = candYears - reqYears;
      const score = Math.min(100, 90 + (overqualification * 2)); // Bonus for experience
      return {
        score: Math.round(score),
        confidence: 0.9,
        details: `Candidate has ${candYears} years, requires ${reqYears} years`,
        status: 'qualified'
      };
    } else {
      const gap = reqYears - candYears;
      const score = Math.max(20, 80 - (gap * 15)); // Penalty for experience gap
      return {
        score: Math.round(score),
        confidence: 0.8,
        details: `Candidate has ${candYears} years, requires ${reqYears} years (${gap} year gap)`,
        status: 'underqualified',
        gap
      };
    }
  }

  /**
   * Calculate education compatibility
   */
  calculateEducationCompatibility(requiredEd, candidateEd) {
    if (!requiredEd) {
      return { score: 75, confidence: 0.5, details: 'No education requirement specified' };
    }

    const reqLevel = this.parseEducationLevel(requiredEd);
    const candLevel = this.parseEducationLevel(candidateEd);
    
    const educationHierarchy = {
      'high-school': 1,
      'associate': 2,
      'bachelor': 3,
      'master': 4,
      'phd': 5
    };

    const reqRank = educationHierarchy[reqLevel] || 3;
    const candRank = educationHierarchy[candLevel] || 3;

    if (candRank >= reqRank) {
      const score = Math.min(100, 80 + ((candRank - reqRank) * 10));
      return {
        score: Math.round(score),
        confidence: 0.8,
        details: `Candidate: ${candLevel}, Required: ${reqLevel}`,
        status: 'qualified'
      };
    } else {
      const gap = reqRank - candRank;
      const score = Math.max(30, 70 - (gap * 20));
      return {
        score: Math.round(score),
        confidence: 0.7,
        details: `Candidate: ${candLevel}, Required: ${reqLevel}`,
        status: 'underqualified',
        gap
      };
    }
  }

  /**
   * Calculate location compatibility
   */
  calculateLocationCompatibility(jobLocation, candidateLocation) {
    if (jobLocation?.remote === true || candidateLocation?.remotePreference === true) {
      return {
        score: 100,
        confidence: 0.9,
        details: 'Remote work available/preferred',
        type: 'remote'
      };
    }

    if (!jobLocation?.city || !candidateLocation?.city) {
      return {
        score: 60,
        confidence: 0.4,
        details: 'Insufficient location data',
        type: 'unknown'
      };
    }

    const distance = this.calculateDistance(jobLocation, candidateLocation);
    
    if (distance <= 25) {
      return {
        score: 95,
        confidence: 0.9,
        details: `${distance} miles apart`,
        type: 'local',
        distance
      };
    } else if (distance <= 100) {
      return {
        score: 70,
        confidence: 0.8,
        details: `${distance} miles apart (commutable)`,
        type: 'commutable',
        distance
      };
    } else {
      const score = candidateLocation.willingToRelocate ? 50 : 20;
      return {
        score,
        confidence: 0.6,
        details: `${distance} miles apart`,
        type: 'distant',
        distance,
        relocationRequired: true
      };
    }
  }

  /**
   * Calculate preference compatibility
   */
  calculatePreferenceCompatibility(jobPrefs, candidatePrefs) {
    if (!jobPrefs && !candidatePrefs) {
      return { score: 75, confidence: 0.5, details: 'No preferences specified' };
    }

    let matches = 0;
    let total = 0;
    const details = [];

    // Work type preference
    if (jobPrefs?.workType && candidatePrefs?.workType) {
      total++;
      if (jobPrefs.workType === candidatePrefs.workType) {
        matches++;
        details.push(`Work type match: ${jobPrefs.workType}`);
      } else {
        details.push(`Work type mismatch: wants ${candidatePrefs.workType}, offers ${jobPrefs.workType}`);
      }
    }

    // Industry preference
    if (jobPrefs?.industry && candidatePrefs?.preferredIndustries?.length) {
      total++;
      if (candidatePrefs.preferredIndustries.includes(jobPrefs.industry)) {
        matches++;
        details.push(`Industry match: ${jobPrefs.industry}`);
      } else {
        details.push(`Industry mismatch: wants ${candidatePrefs.preferredIndustries.join(', ')}, offers ${jobPrefs.industry}`);
      }
    }

    // Company size preference
    if (jobPrefs?.companySize && candidatePrefs?.companySize) {
      total++;
      if (jobPrefs.companySize === candidatePrefs.companySize) {
        matches++;
        details.push(`Company size match: ${jobPrefs.companySize}`);
      }
    }

    const score = total > 0 ? Math.round((matches / total) * 100) : 75;
    
    return {
      score,
      confidence: total > 0 ? 0.7 : 0.3,
      details,
      matches,
      total
    };
  }

  /**
   * Helper methods
   */
  getImportanceWeight(importance) {
    const weights = {
      'critical': 1.5,
      'high': 1.2,
      'medium': 1.0,
      'low': 0.8,
      'nice-to-have': 0.5
    };
    return weights[importance] || 1.0;
  }

  parseExperienceYears(experience) {
    if (typeof experience === 'number') return experience;
    if (typeof experience === 'string') {
      const match = experience.match(/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    }
    return experience?.years || 0;
  }

  parseEducationLevel(education) {
    if (typeof education === 'string') {
      const lower = education.toLowerCase();
      if (lower.includes('phd') || lower.includes('doctorate')) return 'phd';
      if (lower.includes('master')) return 'master';
      if (lower.includes('bachelor')) return 'bachelor';
      if (lower.includes('associate')) return 'associate';
      if (lower.includes('high school')) return 'high-school';
    }
    return education?.level || 'bachelor';
  }

  calculateDistance(loc1, loc2) {
    // Simplified distance calculation - in real implementation, use geocoding API
    if (loc1.city === loc2.city && loc1.state === loc2.state) return 0;
    if (loc1.state === loc2.state) return 50; // Same state approximation
    return 500; // Different state approximation
  }

  calculateSkillConfidence(matchDetails, coverage) {
    const avgMatchScore = matchDetails.reduce((sum, m) => sum + m.score, 0) / matchDetails.length;
    const criticalSkillsMatched = matchDetails.filter(m => 
      m.importance === 'critical' && m.score > 70
    ).length;
    const totalCriticalSkills = matchDetails.filter(m => m.importance === 'critical').length;
    
    const criticalCoverage = totalCriticalSkills > 0 ? criticalSkillsMatched / totalCriticalSkills : 1;
    
    return Math.min(0.95, (avgMatchScore / 100) * 0.4 + coverage * 0.3 + criticalCoverage * 0.3);
  }

  calculateConfidence(scores) {
    const avgConfidence = scores.reduce((sum, s) => sum + s.confidence, 0) / scores.length;
    const scoreVariance = this.calculateVariance(scores.map(s => s.score));
    const consistencyFactor = Math.max(0.5, 1 - (scoreVariance / 1000)); // Lower variance = higher confidence
    
    return Math.min(0.95, avgConfidence * consistencyFactor);
  }

  calculateVariance(scores) {
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  }

  generateRecommendations(job, candidate, scores) {
    const recommendations = [];

    // Skill gap recommendations
    if (scores.skills.missing?.length > 0) {
      recommendations.push({
        type: 'skill-development',
        priority: 'high',
        message: `Consider developing skills in: ${scores.skills.missing.join(', ')}`,
        skills: scores.skills.missing
      });
    }

    // Experience recommendations
    if (scores.experience.gap > 0) {
      recommendations.push({
        type: 'experience',
        priority: 'medium',
        message: `Gain ${scores.experience.gap} more years of relevant experience`,
        gap: scores.experience.gap
      });
    }

    // Education recommendations
    if (scores.education.gap > 0) {
      recommendations.push({
        type: 'education',
        priority: 'low',
        message: 'Consider pursuing additional education or certifications',
        gap: scores.education.gap
      });
    }

    return recommendations;
  }
}

module.exports = CompatibilityScorer;