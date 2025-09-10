/**
 * Career Development Recommendation Engine
 * Provides personalized career growth suggestions
 */

const SkillOntology = require('../ontology/skill-ontology');

class CareerRecommender {
  constructor() {
    this.skillOntology = new SkillOntology();
    this.careerPaths = this.initializeCareerPaths();
    this.skillDemandData = this.initializeSkillDemand();
  }

  initializeCareerPaths() {
    return new Map([
      ['software-engineer', {
        levels: ['junior', 'mid', 'senior', 'staff', 'principal'],
        paths: ['frontend', 'backend', 'fullstack', 'devops', 'mobile', 'data'],
        nextRoles: ['tech-lead', 'engineering-manager', 'architect'],
        skillProgression: {
          'junior': ['javascript', 'html', 'css', 'git', 'debugging'],
          'mid': ['react', 'node.js', 'databases', 'testing', 'ci/cd'],
          'senior': ['system-design', 'mentoring', 'architecture', 'performance-optimization'],
          'staff': ['technical-leadership', 'cross-team-collaboration', 'strategic-planning'],
          'principal': ['technical-vision', 'industry-expertise', 'innovation']
        }
      }],
      ['data-scientist', {
        levels: ['junior', 'mid', 'senior', 'staff', 'principal'],
        paths: ['ml-engineer', 'data-engineer', 'research-scientist'],
        nextRoles: ['head-of-data', 'chief-data-officer'],
        skillProgression: {
          'junior': ['python', 'sql', 'statistics', 'pandas', 'matplotlib'],
          'mid': ['machine-learning', 'tensorflow', 'data-visualization', 'feature-engineering'],
          'senior': ['deep-learning', 'mlops', 'model-deployment', 'data-strategy'],
          'staff': ['research-leadership', 'cross-functional-collaboration', 'data-governance'],
          'principal': ['ai-strategy', 'thought-leadership', 'innovation']
        }
      }],
      ['product-manager', {
        levels: ['associate', 'mid', 'senior', 'staff', 'principal'],
        paths: ['technical-pm', 'growth-pm', 'platform-pm'],
        nextRoles: ['director-product', 'vp-product', 'cpo'],
        skillProgression: {
          'associate': ['market-research', 'user-stories', 'roadmapping', 'analytics'],
          'mid': ['a/b-testing', 'user-experience', 'stakeholder-management', 'prioritization'],
          'senior': ['product-strategy', 'go-to-market', 'cross-functional-leadership'],
          'staff': ['portfolio-management', 'org-influence', 'strategic-partnerships'],
          'principal': ['market-vision', 'innovation-strategy', 'executive-presence']
        }
      }]
    ]);
  }

  initializeSkillDemand() {
    return new Map([
      ['javascript', { demand: 0.95, growth: 0.15, salary_impact: 1.2 }],
      ['python', { demand: 0.92, growth: 0.25, salary_impact: 1.3 }],
      ['react', { demand: 0.88, growth: 0.20, salary_impact: 1.15 }],
      ['aws', { demand: 0.85, growth: 0.30, salary_impact: 1.4 }],
      ['machine-learning', { demand: 0.80, growth: 0.40, salary_impact: 1.6 }],
      ['kubernetes', { demand: 0.75, growth: 0.35, salary_impact: 1.5 }],
      ['typescript', { demand: 0.70, growth: 0.25, salary_impact: 1.25 }],
      ['data-science', { demand: 0.78, growth: 0.35, salary_impact: 1.55 }]
    ]);
  }

  /**
   * Generate comprehensive career recommendations
   * @param {Object} candidate - Candidate profile
   * @param {Array} marketData - Current job market data
   * @returns {Object} Career recommendations
   */
  generateCareerRecommendations(candidate, marketData = []) {
    const currentRole = this.identifyCurrentRole(candidate);
    const skillGaps = this.analyzeSkillGaps(candidate, marketData);
    const careerPath = this.suggestCareerPaths(candidate, currentRole);
    const skillRecommendations = this.recommendSkills(candidate, skillGaps);
    const roleProgression = this.analyzeRoleProgression(candidate, currentRole);

    return {
      summary: {
        currentRole,
        experience: candidate.totalExperience || 0,
        strengths: this.identifyStrengths(candidate),
        primaryRecommendation: careerPath.recommended[0]
      },
      careerPaths: careerPath,
      skillDevelopment: skillRecommendations,
      roleProgression,
      marketInsights: this.generateMarketInsights(candidate, marketData),
      actionPlan: this.createActionPlan(candidate, skillRecommendations, careerPath),
      timeline: this.generateTimeline(skillRecommendations, roleProgression),
      confidence: this.calculateConfidence(candidate, skillGaps, marketData)
    };
  }

  /**
   * Identify candidate's current role based on skills and experience
   */
  identifyCurrentRole(candidate) {
    const skills = candidate.skills?.map(s => s.name || s) || [];
    const experience = candidate.totalExperience || 0;
    
    // Analyze skill patterns to determine role
    const roleScores = new Map();
    
    for (const [role, pathData] of this.careerPaths) {
      let score = 0;
      const currentLevel = this.determineLevel(experience);
      const requiredSkills = pathData.skillProgression[currentLevel] || [];
      
      for (const skill of skills) {
        const normalized = this.skillOntology.normalizeSkill(skill);
        if (requiredSkills.includes(normalized)) {
          score += 2;
        } else {
          // Check for related skills
          for (const reqSkill of requiredSkills) {
            const relationship = this.skillOntology.getSkillRelationship(skill, reqSkill);
            score += relationship.score * 0.5;
          }
        }
      }
      
      roleScores.set(role, score / requiredSkills.length);
    }

    const bestMatch = Array.from(roleScores.entries())
      .sort((a, b) => b[1] - a[1])[0];

    return {
      title: bestMatch[0],
      level: this.determineLevel(experience),
      confidence: Math.min(0.95, bestMatch[1]),
      alternatives: Array.from(roleScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(1, 4)
        .map(([role, score]) => ({ role, score }))
    };
  }

  /**
   * Analyze skill gaps based on market demand
   */
  analyzeSkillGaps(candidate, marketData) {
    const candidateSkills = new Set(
      candidate.skills?.map(s => this.skillOntology.normalizeSkill(s.name || s)) || []
    );
    
    // Analyze market demand from job postings
    const marketSkills = new Map();
    for (const job of marketData) {
      for (const skill of job.requiredSkills || []) {
        const normalized = this.skillOntology.normalizeSkill(skill.name || skill);
        marketSkills.set(normalized, (marketSkills.get(normalized) || 0) + 1);
      }
    }

    // Identify gaps
    const gaps = [];
    const totalJobs = marketData.length;
    
    for (const [skill, count] of marketSkills) {
      const demand = count / totalJobs;
      const hasSkill = candidateSkills.has(skill);
      
      if (!hasSkill && demand > 0.3) { // High demand threshold
        const skillData = this.skillDemandData.get(skill) || {
          demand: demand,
          growth: 0.1,
          salary_impact: 1.1
        };
        
        gaps.push({
          skill,
          demand,
          priority: this.calculateSkillPriority(skill, skillData, demand),
          impact: skillData.salary_impact,
          difficulty: this.estimateLearnDifficulty(skill, candidateSkills),
          timeToLearn: this.estimateLearnTime(skill, candidate)
        });
      }
    }

    return gaps.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Suggest career progression paths
   */
  suggestCareerPaths(candidate, currentRole) {
    const currentRoleData = this.careerPaths.get(currentRole.title);
    const currentLevel = currentRole.level;
    const experience = candidate.totalExperience || 0;

    const paths = {
      vertical: this.suggestVerticalProgression(currentRoleData, currentLevel, experience),
      lateral: this.suggestLateralMoves(candidate, currentRole),
      transition: this.suggestRoleTransitions(candidate, currentRole),
      recommended: []
    };

    // Rank all paths by suitability
    const allPaths = [...paths.vertical, ...paths.lateral, ...paths.transition];
    paths.recommended = allPaths
      .sort((a, b) => b.suitability - a.suitability)
      .slice(0, 5);

    return paths;
  }

  /**
   * Recommend specific skills to develop
   */
  recommendSkills(candidate, skillGaps) {
    const recommendations = {
      immediate: [], // 0-6 months
      shortTerm: [], // 6-18 months
      longTerm: [], // 18+ months
      stackRecommendations: this.recommendTechStacks(candidate)
    };

    for (const gap of skillGaps.slice(0, 10)) { // Top 10 gaps
      const timeframe = this.categorizeTimeframe(gap.timeToLearn);
      const recommendation = {
        skill: gap.skill,
        priority: gap.priority,
        difficulty: gap.difficulty,
        timeToLearn: gap.timeToLearn,
        salaryImpact: gap.impact,
        learningResources: this.suggestLearningResources(gap.skill),
        prerequisites: this.identifyPrerequisites(gap.skill, candidate),
        careerImpact: this.assessCareerImpact(gap.skill, candidate)
      };

      recommendations[timeframe].push(recommendation);
    }

    return recommendations;
  }

  /**
   * Analyze role progression opportunities
   */
  analyzeRoleProgression(candidate, currentRole) {
    const currentRoleData = this.careerPaths.get(currentRole.title);
    const nextLevel = this.getNextLevel(currentRole.level);
    const experience = candidate.totalExperience || 0;

    return {
      currentLevel: currentRole.level,
      nextLevel,
      timeToPromotion: this.estimatePromotionTime(currentRole.level, experience),
      readiness: this.assessPromotionReadiness(candidate, currentRole, nextLevel),
      requirements: this.getPromotionRequirements(currentRole.title, nextLevel),
      gaps: this.identifyPromotionGaps(candidate, currentRole.title, nextLevel),
      alternativePaths: this.suggestAlternativeProgression(candidate, currentRole)
    };
  }

  /**
   * Generate market insights
   */
  generateMarketInsights(candidate, marketData) {
    const insights = {
      demandTrends: this.analyzeDemandTrends(marketData),
      salaryBenchmarks: this.generateSalaryBenchmarks(candidate, marketData),
      growingFields: this.identifyGrowingFields(marketData),
      competitiveFactors: this.analyzeCompetition(candidate, marketData),
      geographicTrends: this.analyzeGeographicTrends(marketData)
    };

    return insights;
  }

  /**
   * Create actionable career development plan
   */
  createActionPlan(candidate, skillRecommendations, careerPath) {
    const plan = {
      immediate: [], // Next 3 months
      quarterly: [], // 3-6 months
      annual: [], // 6-12 months
      longTerm: [] // 12+ months
    };

    // Immediate actions (next 3 months)
    plan.immediate = [
      ...skillRecommendations.immediate.slice(0, 2).map(skill => ({
        type: 'skill-development',
        action: `Start learning ${skill.skill}`,
        priority: skill.priority,
        effort: 'high'
      })),
      {
        type: 'networking',
        action: 'Join relevant professional communities',
        priority: 0.8,
        effort: 'medium'
      }
    ];

    // Quarterly actions
    plan.quarterly = [
      ...skillRecommendations.shortTerm.slice(0, 1).map(skill => ({
        type: 'skill-development',
        action: `Complete ${skill.skill} certification or project`,
        priority: skill.priority,
        effort: 'high'
      })),
      {
        type: 'visibility',
        action: 'Seek stretch assignments or leadership opportunities',
        priority: 0.7,
        effort: 'medium'
      }
    ];

    return plan;
  }

  /**
   * Generate development timeline
   */
  generateTimeline(skillRecommendations, roleProgression) {
    const milestones = [];
    let currentDate = new Date();

    // Skill development milestones
    for (const skill of skillRecommendations.immediate) {
      milestones.push({
        date: new Date(currentDate.getTime() + skill.timeToLearn * 30 * 24 * 60 * 60 * 1000),
        type: 'skill',
        description: `Complete ${skill.skill} development`,
        impact: skill.careerImpact
      });
    }

    // Role progression milestone
    if (roleProgression.timeToPromotion) {
      milestones.push({
        date: new Date(currentDate.getTime() + roleProgression.timeToPromotion * 365 * 24 * 60 * 60 * 1000),
        type: 'promotion',
        description: `Eligible for ${roleProgression.nextLevel} promotion`,
        impact: 'high'
      });
    }

    return milestones.sort((a, b) => a.date - b.date);
  }

  /**
   * Helper methods
   */
  determineLevel(experience) {
    if (experience < 2) return 'junior';
    if (experience < 5) return 'mid';
    if (experience < 8) return 'senior';
    if (experience < 12) return 'staff';
    return 'principal';
  }

  calculateSkillPriority(skill, skillData, marketDemand) {
    return (
      skillData.demand * 0.4 +
      skillData.growth * 0.3 +
      marketDemand * 0.2 +
      skillData.salary_impact * 0.1
    );
  }

  estimateLearnDifficulty(skill, existingSkills) {
    // Calculate difficulty based on skill relationships
    let difficulty = 0.5; // Base difficulty
    
    for (const existing of existingSkills) {
      const relationship = this.skillOntology.getSkillRelationship(skill, existing);
      if (relationship.score > 0.5) {
        difficulty -= 0.1; // Easier if related skills exist
      }
    }
    
    return Math.max(0.1, Math.min(1.0, difficulty));
  }

  estimateLearnTime(skill, candidate) {
    const baseTimes = new Map([
      ['javascript', 3],
      ['python', 3],
      ['react', 4],
      ['aws', 6],
      ['machine-learning', 8],
      ['kubernetes', 6]
    ]);
    
    const baseTime = baseTimes.get(skill) || 4;
    const experienceMultiplier = Math.max(0.5, 1 - (candidate.totalExperience || 0) * 0.05);
    
    return Math.round(baseTime * experienceMultiplier);
  }

  categorizeTimeframe(timeToLearn) {
    if (timeToLearn <= 6) return 'immediate';
    if (timeToLearn <= 18) return 'shortTerm';
    return 'longTerm';
  }

  calculateConfidence(candidate, skillGaps, marketData) {
    const factors = {
      dataQuality: marketData.length > 50 ? 0.9 : 0.6,
      profileCompleteness: this.assessProfileCompleteness(candidate),
      marketCoverage: Math.min(0.9, marketData.length / 100)
    };
    
    return Object.values(factors).reduce((sum, factor) => sum + factor, 0) / Object.keys(factors).length;
  }

  assessProfileCompleteness(candidate) {
    const requiredFields = ['skills', 'experience', 'education'];
    const presentFields = requiredFields.filter(field => candidate[field]);
    return presentFields.length / requiredFields.length;
  }

  // Additional helper methods would continue here...
  // (Implementation truncated for brevity)

  suggestVerticalProgression(roleData, currentLevel, experience) {
    // Implementation for vertical progression suggestions
    return [];
  }

  suggestLateralMoves(candidate, currentRole) {
    // Implementation for lateral move suggestions
    return [];
  }

  suggestRoleTransitions(candidate, currentRole) {
    // Implementation for role transition suggestions
    return [];
  }

  recommendTechStacks(candidate) {
    // Implementation for tech stack recommendations
    return [];
  }

  suggestLearningResources(skill) {
    // Implementation for learning resource suggestions
    return [];
  }

  identifyPrerequisites(skill, candidate) {
    // Implementation for prerequisite identification
    return [];
  }

  assessCareerImpact(skill, candidate) {
    // Implementation for career impact assessment
    return 'medium';
  }

  getNextLevel(currentLevel) {
    const levels = ['junior', 'mid', 'senior', 'staff', 'principal'];
    const currentIndex = levels.indexOf(currentLevel);
    return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : currentLevel;
  }

  estimatePromotionTime(currentLevel, experience) {
    // Implementation for promotion time estimation
    return 2; // years
  }

  assessPromotionReadiness(candidate, currentRole, nextLevel) {
    // Implementation for promotion readiness assessment
    return 0.7;
  }

  getPromotionRequirements(roleTitle, nextLevel) {
    // Implementation for promotion requirements
    return [];
  }

  identifyPromotionGaps(candidate, roleTitle, nextLevel) {
    // Implementation for promotion gap identification
    return [];
  }

  suggestAlternativeProgression(candidate, currentRole) {
    // Implementation for alternative progression suggestions
    return [];
  }

  analyzeDemandTrends(marketData) {
    // Implementation for demand trend analysis
    return {};
  }

  generateSalaryBenchmarks(candidate, marketData) {
    // Implementation for salary benchmark generation
    return {};
  }

  identifyGrowingFields(marketData) {
    // Implementation for growing field identification
    return [];
  }

  analyzeCompetition(candidate, marketData) {
    // Implementation for competition analysis
    return {};
  }

  analyzeGeographicTrends(marketData) {
    // Implementation for geographic trend analysis
    return {};
  }

  identifyStrengths(candidate) {
    // Implementation for strength identification
    return [];
  }
}

module.exports = CareerRecommender;