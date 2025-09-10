/**
 * CommonJS Compatibility Scorer for Testing
 */

const SkillOntology = require('../ontology/skill-ontology-cjs');

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

  calculateCompatibility(job, candidate) {
    const skillScore = this.calculateSkillCompatibility(job.requiredSkills || [], candidate.skills || []);
    const experienceScore = this.calculateExperienceCompatibility(job.experience, candidate.totalExperience);
    const educationScore = this.calculateEducationCompatibility(job.education, candidate.education);
    const locationScore = this.calculateLocationCompatibility(job.location, candidate.location);
    const preferenceScore = { score: 75, confidence: 0.7 }; // Simplified

    const overallScore = Math.round(
      skillScore.score * this.weights.skills +
      experienceScore.score * this.weights.experience +
      educationScore.score * this.weights.education +
      locationScore.score * this.weights.location +
      preferenceScore.score * this.weights.preferences
    );

    return {
      overallScore,
      confidence: 0.8,
      breakdown: {
        skills: skillScore,
        experience: experienceScore,
        education: educationScore,
        location: locationScore,
        preferences: preferenceScore
      }
    };
  }

  calculateSkillCompatibility(requiredSkills, candidateSkills) {
    if (!requiredSkills.length) {
      return { score: 50, confidence: 0.3, details: [], coverage: 0 };
    }

    const similarities = this.skillOntology.calculateSkillSimilarity(
      requiredSkills.map(s => s.name || s),
      candidateSkills.map(s => s.name || s)
    );

    let totalScore = 0;
    const matchDetails = [];
    const missing = [];

    for (const similarity of similarities) {
      const score = similarity.match.score * 100;
      totalScore += score;
      
      matchDetails.push({
        required: similarity.required,
        matched: similarity.match.skill,
        score: Math.round(score),
        type: similarity.match.type
      });

      if (similarity.match.score === 0) {
        missing.push(similarity.required);
      }
    }

    const coverage = similarities.filter(s => s.match.score > 0).length / similarities.length;
    const avgScore = totalScore / similarities.length;
    
    return {
      score: Math.round(avgScore),
      confidence: 0.8,
      details: matchDetails,
      coverage: Math.round(coverage * 100),
      missing
    };
  }

  calculateExperienceCompatibility(requiredExp, candidateExp) {
    if (!requiredExp) {
      return { score: 75, confidence: 0.5, status: 'unknown' };
    }

    const reqYears = this.parseExperienceYears(requiredExp);
    const candYears = candidateExp || 0;

    if (candYears >= reqYears) {
      return {
        score: Math.min(100, 90 + (candYears - reqYears) * 2),
        confidence: 0.9,
        status: 'qualified'
      };
    } else {
      const gap = reqYears - candYears;
      return {
        score: Math.max(20, 80 - (gap * 15)),
        confidence: 0.8,
        status: 'underqualified',
        gap
      };
    }
  }

  calculateEducationCompatibility(requiredEd, candidateEd) {
    if (!requiredEd) {
      return { score: 75, confidence: 0.5 };
    }

    const reqLevel = this.parseEducationLevel(requiredEd);
    const candLevel = this.parseEducationLevel(candidateEd);
    
    const hierarchy = {
      'high-school': 1,
      'associate': 2,
      'bachelor': 3,
      'master': 4,
      'phd': 5
    };

    const reqRank = hierarchy[reqLevel] || 3;
    const candRank = hierarchy[candLevel] || 3;

    if (candRank >= reqRank) {
      return {
        score: Math.min(100, 80 + ((candRank - reqRank) * 10)),
        confidence: 0.8,
        status: 'qualified'
      };
    } else {
      const gap = reqRank - candRank;
      return {
        score: Math.max(30, 70 - (gap * 20)),
        confidence: 0.7,
        status: 'underqualified',
        gap
      };
    }
  }

  calculateLocationCompatibility(jobLocation, candidateLocation) {
    if (!jobLocation || !candidateLocation) {
      return { score: 60, confidence: 0.4, type: 'unknown' };
    }

    if (jobLocation.remote || candidateLocation.remotePreference) {
      return { score: 100, confidence: 0.9, type: 'remote' };
    }

    if (jobLocation.city === candidateLocation.city && jobLocation.state === candidateLocation.state) {
      return { score: 95, confidence: 0.9, type: 'local' };
    }

    return { score: 30, confidence: 0.6, type: 'distant' };
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
      if (lower.includes('phd')) return 'phd';
      if (lower.includes('master')) return 'master';
      if (lower.includes('bachelor')) return 'bachelor';
      if (lower.includes('associate')) return 'associate';
      return 'high-school';
    }
    return education?.level || 'bachelor';
  }
}

module.exports = CompatibilityScorer;