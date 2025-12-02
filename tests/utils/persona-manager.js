const crypto = require('crypto');
const TestDataFactory = require('../fixtures/test-data-factory');

class PersonaManager {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:5000';
    
    // Internal state for testing
    this._personas = new Map();
    this._activePersona = null;
    this._userProfiles = new Map();
    this._interactionHistory = new Map();
    this._curationRules = new Map();
    this._analytics = {
      enabled: true,
      metrics: new Map(),
      interactions: []
    };
    this._accessibility = {
      enabled: true,
      features: ['screen_reader', 'high_contrast', 'keyboard_navigation', 'content_simplification']
    };
    this._feedbackSystem = {
      enabled: true,
      mechanisms: ['rating', 'text_feedback', 'survey', 'suggestion_box']
    };
    
    // Initialize default personas
    this._initializePersonas();
    this._initializeCurationRules();
  }

  _initializePersonas() {
    const personaData = TestDataFactory.createPersonaTestData();
    
    Object.entries(personaData).forEach(([name, config]) => {
      this._personas.set(name, {
        name: name,
        displayName: name.replace(/([A-Z])/g, ' $1').trim(),
        config: config,
        curationRules: this._generateCurationRules(config),
        active: false,
        userCount: Math.floor(Math.random() * 10000),
        lastUpdated: new Date().toISOString()
      });
    });
  }

  _initializeCurationRules() {
    this._personas.forEach((persona, name) => {
      this._curationRules.set(name, {
        contentFilters: persona.config.categories,
        complexityLevels: persona.config.complexity,
        displayOptions: persona.config.displayOptions,
        prioritization: this._generatePrioritization(persona.config)
      });
    });
  }

  async getPersonaStatus() {
    return {
      enabled: true,
      totalPersonas: this._personas.size,
      activePersonas: Array.from(this._personas.values()).filter(p => p.active).length,
      lastUpdated: new Date().toISOString()
    };
  }

  async getAvailablePersonas() {
    return Array.from(this._personas.values()).map(persona => ({
      name: persona.name,
      displayName: persona.displayName,
      description: this._generatePersonaDescription(persona),
      userCount: persona.userCount,
      curationRules: persona.curationRules
    }));
  }

  async activatePersona(personaName) {
    const persona = this._personas.get(personaName);
    if (!persona) {
      throw new Error(`Persona ${personaName} not found`);
    }
    
    // Deactivate current persona
    if (this._activePersona) {
      this._activePersona.active = false;
    }
    
    // Activate new persona
    persona.active = true;
    this._activePersona = persona;
    
    this._trackInteraction({
      type: 'persona_activated',
      persona: personaName,
      timestamp: new Date().toISOString()
    });
    
    return {
      active: true,
      persona: personaName,
      config: persona.config,
      curationRules: this._curationRules.get(personaName)
    };
  }

  async switchPersona(newPersonaName) {
    const startTime = Date.now();
    
    const previousPersona = this._activePersona?.name;
    await this.activatePersona(newPersonaName);
    
    const switchTime = Date.now() - startTime;
    
    this._trackInteraction({
      type: 'persona_switched',
      from: previousPersona,
      to: newPersonaName,
      switchTime: switchTime,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: true,
      transitionTime: switchTime,
      from: previousPersona,
      to: newPersonaName
    };
  }

  async recordInteractions(interactions) {
    const userId = 'current-user'; // Mock current user
    if (!this._interactionHistory.has(userId)) {
      this._interactionHistory.set(userId, []);
    }
    
    const userHistory = this._interactionHistory.get(userId);
    userHistory.push(...interactions);
    
    // Update analytics
    interactions.forEach(interaction => this._trackInteraction(interaction));
  }

  async updateUserInterests(interests) {
    const userId = 'current-user';
    this._userProfiles.set(userId, {
      interests: interests,
      lastUpdated: new Date().toISOString()
    });
  }

  async initiateOnboarding(personaName) {
    const persona = this._personas.get(personaName);
    if (!persona) {
      throw new Error(`Persona ${personaName} not found`);
    }
    
    return {
      persona: personaName,
      isNewUser: true,
      onboardingFlow: this._generateOnboardingFlow(persona),
      estimatedDuration: 5 // minutes
    };
  }

  async getOnboardingExperience(personaName, isNewUser) {
    const persona = this._personas.get(personaName);
    
    return {
      guidedTour: {
        steps: this._generateTourSteps(persona),
        interactive: true,
        skippable: true,
        skipOption: 'Skip Tour'
      },
      welcomeMessage: `Welcome to the ${persona.displayName} experience!`,
      personalizedContent: this._getPersonalizedContent(persona),
      estimatedTime: '5-10 minutes'
    };
  }

  async enableAccessibility(personaName, features) {
    const persona = this._personas.get(personaName);
    if (!persona) {
      throw new Error(`Persona ${personaName} not found`);
    }
    
    const adaptations = {};
    
    features.forEach(feature => {
      switch (feature) {
        case 'screen_reader':
          adaptations[feature] = ['semantic markup', 'alt-texts', 'aria-labels'];
          break;
        case 'high_contrast':
          adaptations[feature] = ['enhanced color schemes', 'dark mode', 'contrast ratios'];
          break;
        case 'keyboard_navigation':
          adaptations[feature] = ['tabindex', 'keyboard shortcuts', 'focus indicators'];
          break;
        case 'content_simplification':
          adaptations[feature] = ['plain language summaries', 'simplified navigation'];
          break;
      }
    });
    
    return {
      persona: personaName,
      accessibilityEnabled: true,
      features: features,
      adaptations: adaptations,
      contentAccessibility: {
        compliant: true,
        wcagLevel: 'AA'
      }
    };
  }

  async createHybridPersona(roles, preferences) {
    const hybridId = 'hybrid_' + crypto.randomBytes(8).toString('hex');
    
    const combinedViews = {};
    roles.forEach(role => {
      const persona = this._personas.get(role);
      if (persona) {
        combinedViews[role] = this._getPersonaContentTypes(persona);
      }
    });
    
    const hybridPersona = {
      id: hybridId,
      roles: roles,
      combinedViews: combinedViews,
      balance: {
        primary: preferences.balancePreference,
        secondary: 1 - preferences.balancePreference
      },
      adjustableBalance: true,
      balanceControls: {
        slider: true,
        presets: ['developer-focused', 'balanced', 'manager-focused']
      },
      created: new Date().toISOString()
    };
    
    this._personas.set(hybridId, hybridPersona);
    
    return hybridPersona;
  }

  async getAnalyticsStatus() {
    return {
      enabled: this._analytics.enabled,
      trackingPersonas: true,
      totalInteractions: this._analytics.interactions.length,
      lastUpdated: new Date().toISOString()
    };
  }

  async trackInteraction(interaction) {
    this._trackInteraction(interaction);
  }

  async getPersonaAnalytics() {
    const metrics = {
      persona_popularity: this._calculatePersonaPopularity(),
      content_effectiveness: this._calculateContentEffectiveness(),
      search_patterns: this._analyzeSearchPatterns(),
      persona_switching: this._analyzePersonaSwitching()
    };
    
    return {
      metrics: metrics,
      generated: new Date().toISOString(),
      period: 'last_30_days'
    };
  }

  async getEditorialCuration() {
    return {
      enabled: true,
      teams: [
        { name: 'Developer Content Team', personas: ['Developer', 'DevOps Engineer'] },
        { name: 'Business Content Team', personas: ['Business Analyst', 'Product Manager'] },
        { name: 'Data Science Team', personas: ['Data Scientist', 'ML Engineer'] }
      ],
      lastReview: new Date().toISOString()
    };
  }

  async evaluateForPersonas(kpack) {
    const evaluation = {
      kpack: kpack.name,
      evaluation: {},
      personaRelevance: {}
    };
    
    this._personas.forEach((persona, name) => {
      const relevance = this._calculatePersonaRelevance(kpack, persona);
      evaluation.evaluation[name] = {
        technical_complexity: this._categorizeComplexity(kpack),
        use_case_alignment: this._categorizeUseCase(kpack, persona),
        role_applicability: this._categorizeRoleApplicability(kpack, persona)
      };
      evaluation.personaRelevance[name] = relevance;
    });
    
    return evaluation;
  }

  async getCuratedCollections() {
    const collections = {};
    
    this._personas.forEach((persona, name) => {
      collections[name] = this._generateCuratedCollection(persona);
    });
    
    return collections;
  }

  async getFeaturedContent() {
    const featured = {};
    
    this._personas.forEach((persona, name) => {
      featured[name] = {
        items: this._getFeaturedForPersona(persona),
        rotationSchedule: 'weekly',
        engagementMetrics: {
          viewRate: Math.random() * 0.8 + 0.2,
          clickRate: Math.random() * 0.5 + 0.1,
          conversionRate: Math.random() * 0.3 + 0.05
        },
        lastRotation: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      };
    });
    
    return featured;
  }

  async getFeedbackSystem() {
    return this._feedbackSystem;
  }

  async getOptimizationInsights() {
    return {
      recommendations: [
        {
          type: 'content_gap',
          persona: 'Developer',
          description: 'Need more intermediate-level testing tools',
          priority: 'high'
        },
        {
          type: 'user_flow',
          persona: 'Business Analyst',
          description: 'Simplify technical terminology in descriptions',
          priority: 'medium'
        }
      ],
      lastAnalysis: new Date().toISOString(),
      nextAnalysis: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  async getImprovementCycle() {
    return {
      feedbackIntegration: true,
      iterationFrequency: 'monthly',
      lastImprovement: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      nextIteration: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      improvementAreas: ['content_relevance', 'interface_usability', 'persona_accuracy']
    };
  }

  // Private helper methods
  _generateCurationRules(config) {
    return {
      include: config.categories,
      complexity: config.complexity,
      prioritize: config.displayOptions,
      exclude: ['deprecated', 'experimental']
    };
  }

  _generatePrioritization(config) {
    return {
      primary: config.categories.slice(0, 2),
      secondary: config.categories.slice(2),
      complexityWeight: config.complexity.includes('advanced') ? 0.8 : 0.5
    };
  }

  _generatePersonaDescription(persona) {
    const descriptions = {
      Developer: 'Technical professionals building applications and systems',
      'Data Scientist': 'Analysts working with data to derive insights and build models',
      'Business Analyst': 'Professionals analyzing business requirements and processes',
      'DevOps Engineer': 'Engineers managing infrastructure and deployment pipelines'
    };
    
    return descriptions[persona.name] || 'Professional working in their domain';
  }

  _generateOnboardingFlow(persona) {
    return {
      steps: [
        { id: 'welcome', title: 'Welcome', duration: 30 },
        { id: 'persona_benefits', title: 'Persona Benefits', duration: 60 },
        { id: 'key_features', title: 'Key Features', duration: 90 },
        { id: 'first_search', title: 'Try Your First Search', duration: 120 }
      ],
      totalDuration: 300 // seconds
    };
  }

  _generateTourSteps(persona) {
    return [
      {
        element: 'persona benefits',
        description: `how ${persona.displayName} view differs from others`,
        duration: 60
      },
      {
        element: 'key categories',
        description: persona.config.categories.join(', '),
        duration: 90
      },
      {
        element: 'success metrics',
        description: 'roi-calculators, kpi-dashboards',
        duration: 60
      },
      {
        element: 'community resources',
        description: `${persona.name.toLowerCase()}-specific forums and guides`,
        duration: 90
      }
    ];
  }

  _getPersonalizedContent(persona) {
    return {
      recommendedCategories: persona.config.categories.slice(0, 3),
      featuredKPacks: this._getFeaturedForPersona(persona),
      learningPath: this._generateLearningPath(persona)
    };
  }

  _getPersonaContentTypes(persona) {
    const contentMap = {
      Developer: ['technical_specifications', 'code'],
      'Data Scientist': ['algorithm_details', 'performance_metrics'],
      'Business Analyst': ['business_value', 'roi_analysis'],
      'Product Manager': ['timelines', 'resource_requirements']
    };
    
    return contentMap[persona.name] || ['general_content'];
  }

  _trackInteraction(interaction) {
    this._analytics.interactions.push({
      ...interaction,
      id: crypto.randomBytes(8).toString('hex'),
      timestamp: interaction.timestamp || new Date().toISOString()
    });
    
    // Update metrics
    this._updateMetrics(interaction);
  }

  _updateMetrics(interaction) {
    const metricKey = `${interaction.type}_${interaction.persona || 'unknown'}`;
    const current = this._analytics.metrics.get(metricKey) || 0;
    this._analytics.metrics.set(metricKey, current + 1);
  }

  _calculatePersonaPopularity() {
    const popularity = {};
    
    this._personas.forEach((persona, name) => {
      const interactions = this._analytics.interactions.filter(i => i.persona === name);
      popularity[name] = {
        usage_frequency: interactions.length,
        session_time: Math.random() * 30 + 10, // Mock session time
        unique_users: Math.floor(Math.random() * 1000) + 100
      };
    });
    
    return popularity;
  }

  _calculateContentEffectiveness() {
    const effectiveness = {};
    
    this._personas.forEach((persona, name) => {
      effectiveness[name] = {
        click_rates: Math.random() * 0.4 + 0.1,
        conversion_rates: Math.random() * 0.2 + 0.05,
        engagement_score: Math.random() * 0.8 + 0.2
      };
    });
    
    return effectiveness;
  }

  _analyzeSearchPatterns() {
    return {
      top_queries: [
        { query: 'machine learning', frequency: 245, personas: ['Data Scientist'] },
        { query: 'react components', frequency: 189, personas: ['Developer'] },
        { query: 'roi dashboard', frequency: 156, personas: ['Business Analyst'] }
      ],
      query_trends: 'increasing',
      persona_specific_patterns: true
    };
  }

  _analyzePersonaSwitching() {
    return {
      frequency: Math.floor(Math.random() * 100) + 50,
      common_switches: [
        { from: 'Developer', to: 'DevOps Engineer', frequency: 45 },
        { from: 'Business Analyst', to: 'Product Manager', frequency: 32 }
      ],
      average_time_between_switches: Math.random() * 60 + 30 // minutes
    };
  }

  _calculatePersonaRelevance(kpack, persona) {
    let score = 0;
    
    // Check category alignment
    if (kpack.facets?.category) {
      const overlap = kpack.facets.category.filter(cat => 
        persona.config.categories.some(pCat => pCat.includes(cat))
      );
      score += overlap.length * 0.3;
    }
    
    // Check complexity alignment
    if (kpack.facets?.difficulty) {
      const complexityMatch = persona.config.complexity.includes(kpack.facets.difficulty[0]);
      if (complexityMatch) score += 0.4;
    }
    
    return Math.min(score, 1.0);
  }

  _categorizeComplexity(kpack) {
    const difficulty = kpack.facets?.difficulty?.[0] || 'intermediate';
    return {
      categories: ['beginner', 'intermediate', 'advanced'],
      current: difficulty,
      score: difficulty === 'advanced' ? 0.9 : difficulty === 'intermediate' ? 0.6 : 0.3
    };
  }

  _categorizeUseCase(kpack, persona) {
    const alignment = this._calculatePersonaRelevance(kpack, persona);
    if (alignment > 0.7) return { categories: ['direct', 'indirect', 'tangential'], current: 'direct' };
    if (alignment > 0.4) return { categories: ['direct', 'indirect', 'tangential'], current: 'indirect' };
    return { categories: ['direct', 'indirect', 'tangential'], current: 'tangential' };
  }

  _categorizeRoleApplicability(kpack, persona) {
    const relevance = this._calculatePersonaRelevance(kpack, persona);
    if (relevance > 0.6) return { categories: ['primary', 'secondary', 'tertiary'], current: 'primary' };
    if (relevance > 0.3) return { categories: ['primary', 'secondary', 'tertiary'], current: 'secondary' };
    return { categories: ['primary', 'secondary', 'tertiary'], current: 'tertiary' };
  }

  _generateCuratedCollection(persona) {
    return [
      {
        name: `Essential ${persona.displayName} Tools`,
        description: `Curated tools for ${persona.displayName.toLowerCase()}`,
        itemCount: Math.floor(Math.random() * 20) + 10,
        lastUpdated: new Date().toISOString()
      },
      {
        name: `Trending in ${persona.displayName}`,
        description: `Popular items among ${persona.displayName.toLowerCase()}s`,
        itemCount: Math.floor(Math.random() * 15) + 5,
        lastUpdated: new Date().toISOString()
      }
    ];
  }

  _getFeaturedForPersona(persona) {
    return [
      {
        name: `featured-${persona.name.toLowerCase()}-tool-1`,
        reason: 'highly_rated',
        engagement: Math.random() * 0.8 + 0.2
      },
      {
        name: `featured-${persona.name.toLowerCase()}-tool-2`,
        reason: 'recently_updated',
        engagement: Math.random() * 0.8 + 0.2
      }
    ];
  }

  _generateLearningPath(persona) {
    return {
      beginner: [`Intro to ${persona.displayName}`, 'Basic Tools'],
      intermediate: ['Advanced Techniques', 'Best Practices'],
      advanced: ['Expert Strategies', 'Cutting-edge Tools']
    };
  }
}

module.exports = PersonaManager;