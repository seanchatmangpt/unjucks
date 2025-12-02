/**
 * Template Recommendation Algorithm
 * 
 * Matches templates to user's project configuration, technology stack,
 * and development patterns for maximum compatibility and utility.
 */

import { createLogger } from '../../utils/logger.js';

export class TemplateRecommender {
  constructor(sparqlEngine) {
    this.sparqlEngine = sparqlEngine;
    this.logger = createLogger('TemplateRecommender');
    
    // Technology compatibility matrix
    this.compatibilityMatrix = {
      'React': ['TypeScript', 'JavaScript', 'CSS', 'SCSS', 'Jest', 'Storybook'],
      'Vue': ['TypeScript', 'JavaScript', 'CSS', 'SCSS', 'Vitest'],
      'Angular': ['TypeScript', 'RxJS', 'Jasmine', 'Karma'],
      'Node.js': ['JavaScript', 'TypeScript', 'Express', 'Fastify', 'Jest'],
      'Python': ['Django', 'FastAPI', 'Flask', 'pytest', 'SQLAlchemy'],
      'Java': ['Spring Boot', 'Maven', 'Gradle', 'JUnit', 'Hibernate'],
      'Go': ['Gin', 'Echo', 'GORM', 'testify'],
      'Rust': ['Actix', 'Warp', 'Serde', 'Tokio']
    };
    
    // Template categories with usage patterns
    this.templateCategories = {
      'component': { frequency: 'high', impact: 'medium' },
      'service': { frequency: 'medium', impact: 'high' },
      'config': { frequency: 'low', impact: 'high' },
      'test': { frequency: 'high', impact: 'medium' },
      'deployment': { frequency: 'low', impact: 'high' },
      'documentation': { frequency: 'medium', impact: 'low' },
      'security': { frequency: 'low', impact: 'critical' }
    };
  }
  
  /**
   * Generate template recommendations based on user's project
   * @param {Object} userContext - User's project context
   * @param {Object} options - Recommendation options
   * @returns {Promise<Array>} Template recommendations
   */
  async recommend(userContext, options = {}) {
    try {
      this.logger.info('Generating template recommendations', { userContext });
      
      const {
        projectType = 'web-app',
        technologies = [],
        frameworks = [],
        languages = [],
        patterns = [],
        existingTemplates = [],
        developmentStage = 'development',
        teamSize = 'small'
      } = userContext.project || userContext;
      
      // Analyze project needs
      const projectAnalysis = this._analyzeProjectNeeds(userContext);
      
      // Get template suggestions from SPARQL
      const suggestions = await this.sparqlEngine.executeNamedQuery('suggestTemplates', {
        userFrameworks: this._formatArrayForSparql(frameworks),
        userLanguages: this._formatArrayForSparql(languages),
        userPatterns: this._formatArrayForSparql(patterns),
        userProjectType: projectType,
        userTemplates: this._formatArrayForSparql(existingTemplates),
        limit: options.limit || 50
      });
      
      // Score and rank templates
      const scoredRecommendations = suggestions.map(template => {
        const score = this._calculateTemplateScore(template, userContext, projectAnalysis);
        return {
          ...template,
          type: 'template',
          score,
          reasoning: this._generateTemplateReasoning(template, userContext, projectAnalysis),
          compatibility: this._assessCompatibility(template, userContext),
          usageEstimate: this._estimateUsage(template, userContext),
          implementationGuide: this._generateTemplateGuide(template, userContext)
        };
      });
      
      // Apply filters and sorting
      return scoredRecommendations
        .filter(rec => rec.score > 0.4)
        .sort((a, b) => b.score - a.score)
        .slice(0, options.limit || 15);
        
    } catch (error) {
      this.logger.error('Failed to generate template recommendations', error);
      throw error;
    }
  }
  
  /**
   * Find templates that complement existing ones
   * @param {Object} context - User context with existing templates
   * @returns {Promise<Array>} Complementary templates
   */
  async findMatches(context) {
    try {
      const { existingTemplates = [], technologies = [] } = context;
      
      // Find gaps in template coverage
      const gaps = this._identifyTemplateGaps(existingTemplates, technologies);
      
      // Get complementary templates
      const matches = [];
      
      for (const gap of gaps) {
        const gapTemplates = await this._findTemplatesForGap(gap, context);
        matches.push(...gapTemplates);
      }
      
      // Find templates that work well together
      const synergisticTemplates = await this._findSynergisticTemplates(existingTemplates, context);
      matches.push(...synergisticTemplates);
      
      return this._deduplicateAndRank(matches);
      
    } catch (error) {
      this.logger.error('Failed to find template matches', error);
      throw error;
    }
  }
  
  /**
   * Analyze project architecture and suggest templates
   * @param {Object} projectStructure - Project file structure and config
   * @returns {Promise<Object>} Architecture analysis with template suggestions
   */
  async analyzeArchitecture(projectStructure) {
    try {
      const analysis = {
        patterns: this._detectArchitecturalPatterns(projectStructure),
        technologies: this._detectTechnologies(projectStructure),
        gaps: this._identifyArchitecturalGaps(projectStructure),
        suggestions: []
      };
      
      // Generate suggestions based on detected patterns
      for (const pattern of analysis.patterns) {
        const patternTemplates = await this._getTemplatesForPattern(pattern);
        analysis.suggestions.push(...patternTemplates);
      }
      
      // Suggest templates for identified gaps
      for (const gap of analysis.gaps) {
        const gapTemplates = await this._getTemplatesForGap(gap);
        analysis.suggestions.push(...gapTemplates);
      }
      
      return analysis;
      
    } catch (error) {
      this.logger.error('Failed to analyze architecture', error);
      throw error;
    }
  }
  
  /**
   * Calculate template score based on multiple factors
   */
  _calculateTemplateScore(template, userContext, projectAnalysis) {
    let score = 0;
    
    // Technology compatibility (0-0.3)
    const techMatch = this._calculateTechnologyMatch(template, userContext);
    score += techMatch * 0.3;
    
    // Usage frequency potential (0-0.2)
    const usageScore = this._calculateUsageScore(template, userContext);
    score += usageScore * 0.2;
    
    // Project needs alignment (0-0.25)
    const needsAlignment = this._calculateNeedsAlignment(template, projectAnalysis);
    score += needsAlignment * 0.25;
    
    // Quality and popularity (0-0.15)
    const qualityScore = this._calculateQualityScore(template);
    score += qualityScore * 0.15;
    
    // Complementarity with existing templates (0-0.1)
    const complementScore = this._calculateComplementScore(template, userContext);
    score += complementScore * 0.1;
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Calculate technology compatibility match
   */
  _calculateTechnologyMatch(template, userContext) {
    const templateTechs = [
      template.framework?.value,
      template.language?.value,
      ...(template.technologies?.value?.split(',') || [])
    ].filter(Boolean);
    
    const userTechs = [
      ...(userContext.technologies || []),
      ...(userContext.frameworks || []),
      ...(userContext.languages || [])
    ];
    
    if (templateTechs.length === 0 || userTechs.length === 0) {
      return 0.5; // neutral score
    }
    
    const matches = templateTechs.filter(tech => 
      userTechs.some(userTech => 
        userTech.toLowerCase().includes(tech.toLowerCase()) ||
        tech.toLowerCase().includes(userTech.toLowerCase())
      )
    );
    
    return matches.length / templateTechs.length;
  }
  
  /**
   * Calculate potential usage frequency
   */
  _calculateUsageScore(template, userContext) {
    const category = template.category?.value || 'general';
    const projectType = userContext.projectType || userContext.project?.projectType;
    const teamSize = userContext.teamSize || userContext.project?.teamSize;
    
    // Base usage score from category
    let score = this.templateCategories[category]?.frequency === 'high' ? 0.8 :
                this.templateCategories[category]?.frequency === 'medium' ? 0.6 : 0.4;
    
    // Adjust for project type
    if (projectType === 'microservices' && category === 'service') score += 0.2;
    if (projectType === 'web-app' && category === 'component') score += 0.2;
    if (projectType === 'library' && category === 'test') score += 0.15;
    
    // Adjust for team size
    if (teamSize === 'large' && category === 'config') score += 0.1;
    if (teamSize === 'small' && category === 'documentation') score -= 0.1;
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Calculate alignment with project needs
   */
  _calculateNeedsAlignment(template, projectAnalysis) {
    const templateFeatures = template.features?.value?.split(',') || [];
    const projectNeeds = projectAnalysis.identifiedNeeds || [];
    
    if (templateFeatures.length === 0 || projectNeeds.length === 0) {
      return 0.5;
    }
    
    const alignedFeatures = templateFeatures.filter(feature =>
      projectNeeds.some(need => 
        need.toLowerCase().includes(feature.toLowerCase()) ||
        feature.toLowerCase().includes(need.toLowerCase())
      )
    );
    
    return alignedFeatures.length / Math.max(templateFeatures.length, projectNeeds.length);
  }
  
  /**
   * Calculate template quality score
   */
  _calculateQualityScore(template) {
    const rating = parseFloat(template.rating?.value || 3.0);
    const downloads = parseInt(template.usageCount?.value || 0);
    
    // Normalize rating (0-5 scale)
    const ratingScore = rating / 5.0;
    
    // Normalize downloads (logarithmic scale)
    const downloadScore = Math.min(Math.log10(downloads + 1) / 4.0, 1.0);
    
    return (ratingScore * 0.7) + (downloadScore * 0.3);
  }
  
  /**
   * Calculate complementarity with existing templates
   */
  _calculateComplementScore(template, userContext) {
    const existingTemplates = userContext.existingTemplates || userContext.project?.existingTemplates || [];
    
    if (existingTemplates.length === 0) {
      return 0.5; // neutral for new projects
    }
    
    const templateCategory = template.category?.value;
    const existingCategories = existingTemplates.map(t => t.category).filter(Boolean);
    
    // Bonus for filling gaps
    if (!existingCategories.includes(templateCategory)) {
      return 0.8;
    }
    
    // Check for synergistic combinations
    const synergies = this._checkSynergies(template, existingTemplates);
    return synergies.length > 0 ? 0.7 : 0.3;
  }
  
  /**
   * Analyze project needs from context
   */
  _analyzeProjectNeeds(userContext) {
    const needs = [];
    const project = userContext.project || userContext;
    
    // Analyze based on project type
    if (project.projectType === 'microservices') {
      needs.push('service-template', 'api-gateway', 'health-checks', 'monitoring');
    } else if (project.projectType === 'web-app') {
      needs.push('component-library', 'routing', 'state-management', 'testing');
    } else if (project.projectType === 'library') {
      needs.push('documentation', 'testing', 'build-system', 'packaging');
    }
    
    // Analyze based on technologies
    const techs = project.technologies || [];
    if (techs.includes('React')) {
      needs.push('component-templates', 'hook-templates', 'context-providers');
    }
    if (techs.includes('Node.js')) {
      needs.push('express-middleware', 'error-handling', 'logging');
    }
    if (techs.includes('TypeScript')) {
      needs.push('type-definitions', 'interface-templates');
    }
    
    // Analyze based on development stage
    if (project.developmentStage === 'early') {
      needs.push('boilerplate', 'scaffolding', 'quick-start');
    } else if (project.developmentStage === 'mature') {
      needs.push('optimization', 'monitoring', 'maintenance');
    }
    
    return {
      identifiedNeeds: [...new Set(needs)], // deduplicate
      priority: this._prioritizeNeeds(needs, project),
      gaps: this._identifyGaps(needs, project.existingTemplates || [])
    };
  }
  
  /**
   * Generate reasoning for template recommendation
   */
  _generateTemplateReasoning(template, userContext, projectAnalysis) {
    const reasons = [];
    
    // Technology match
    const techMatch = this._calculateTechnologyMatch(template, userContext);
    if (techMatch > 0.7) {
      reasons.push(`Strong technology compatibility (${Math.round(techMatch * 100)}%)`);
    }
    
    // Project needs
    const templateFeatures = template.features?.value?.split(',') || [];
    const matchedNeeds = templateFeatures.filter(feature =>
      projectAnalysis.identifiedNeeds.includes(feature)
    );
    if (matchedNeeds.length > 0) {
      reasons.push(`Addresses key needs: ${matchedNeeds.join(', ')}`);
    }
    
    // Quality indicators
    const rating = parseFloat(template.rating?.value || 0);
    if (rating >= 4.0) {
      reasons.push(`High-quality template (${rating}/5.0 rating)`);
    }
    
    // Usage popularity
    const downloads = parseInt(template.usageCount?.value || 0);
    if (downloads > 1000) {
      reasons.push(`Popular in community (${downloads.toLocaleString()} downloads)`);
    }
    
    // Project type alignment
    const projectType = userContext.projectType || userContext.project?.projectType;
    if (template.projectType?.value === projectType) {
      reasons.push(`Designed for ${projectType} projects`);
    }
    
    return reasons.join('; ');
  }
  
  /**
   * Assess compatibility with user's environment
   */
  _assessCompatibility(template, userContext) {
    const compatibility = {
      technologies: this._assessTechCompatibility(template, userContext),
      patterns: this._assessPatternCompatibility(template, userContext),
      infrastructure: this._assessInfraCompatibility(template, userContext),
      overall: 'unknown'
    };
    
    // Calculate overall compatibility
    const scores = Object.values(compatibility).filter(v => typeof v === 'number');
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    compatibility.overall = avgScore >= 0.8 ? 'high' :
                           avgScore >= 0.6 ? 'medium' :
                           avgScore >= 0.4 ? 'low' : 'incompatible';
    
    return compatibility;
  }
  
  /**
   * Estimate template usage frequency
   */
  _estimateUsage(template, userContext) {
    const category = template.category?.value || 'general';
    const projectSize = this._estimateProjectSize(userContext);
    
    const baseUsage = this.templateCategories[category]?.frequency || 'medium';
    
    let frequency = baseUsage === 'high' ? 'daily' :
                   baseUsage === 'medium' ? 'weekly' : 'monthly';
    
    // Adjust based on project characteristics
    if (projectSize === 'large' && category === 'component') {
      frequency = 'daily';
    } else if (projectSize === 'small' && category === 'deployment') {
      frequency = 'rarely';
    }
    
    return {
      frequency,
      estimatedUsesPerMonth: this._calculateMonthlyUsage(frequency),
      timeSavingsPerUse: this._estimateTimeSavings(template, userContext)
    };
  }
  
  /**
   * Generate implementation guide for template
   */
  _generateTemplateGuide(template, userContext) {
    return {
      setupSteps: this._generateSetupSteps(template, userContext),
      prerequisites: this._identifyPrerequisites(template, userContext),
      customization: this._suggestCustomizations(template, userContext),
      bestPractices: this._getBestPractices(template),
      troubleshooting: this._getCommonIssues(template)
    };
  }
  
  /**
   * Helper methods
   */
  _formatArrayForSparql(array) {
    return array.map(item => `"${item}"`).join(', ');
  }
  
  _identifyTemplateGaps(existingTemplates, technologies) {
    const gaps = [];
    
    // Standard gaps based on technologies
    for (const tech of technologies) {
      const expectedTemplates = this.compatibilityMatrix[tech] || [];
      const missingTemplates = expectedTemplates.filter(expected =>
        !existingTemplates.some(existing => 
          existing.name?.toLowerCase().includes(expected.toLowerCase())
        )
      );
      gaps.push(...missingTemplates.map(missing => ({ type: 'technology', tech, missing })));
    }
    
    // Category gaps
    const existingCategories = existingTemplates.map(t => t.category).filter(Boolean);
    const expectedCategories = Object.keys(this.templateCategories);
    const missingCategories = expectedCategories.filter(cat => !existingCategories.includes(cat));
    gaps.push(...missingCategories.map(cat => ({ type: 'category', category: cat })));
    
    return gaps;
  }
  
  async _findTemplatesForGap(gap, context) {
    // Implementation would query for templates that fill specific gaps
    return [];
  }
  
  async _findSynergisticTemplates(existingTemplates, context) {
    // Implementation would find templates that work well with existing ones
    return [];
  }
  
  _deduplicateAndRank(templates) {
    const seen = new Set();
    return templates
      .filter(template => {
        const key = template.name?.value || template.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }
  
  _detectArchitecturalPatterns(projectStructure) {
    // Analyze file structure and configuration to detect patterns
    const patterns = [];
    
    if (projectStructure.hasDockerfile) patterns.push('containerization');
    if (projectStructure.hasKubernetesConfigs) patterns.push('kubernetes');
    if (projectStructure.hasMicroservicesStructure) patterns.push('microservices');
    if (projectStructure.hasMonorepoStructure) patterns.push('monorepo');
    
    return patterns;
  }
  
  _detectTechnologies(projectStructure) {
    const techs = [];
    
    if (projectStructure.packageJson) {
      const deps = projectStructure.packageJson.dependencies || {};
      if (deps.react) techs.push('React');
      if (deps.vue) techs.push('Vue');
      if (deps.express) techs.push('Express');
      if (deps.typescript) techs.push('TypeScript');
    }
    
    return techs;
  }
  
  _identifyArchitecturalGaps(projectStructure) {
    const gaps = [];
    
    if (!projectStructure.hasTests) gaps.push('testing-framework');
    if (!projectStructure.hasCI) gaps.push('ci-cd-pipeline');
    if (!projectStructure.hasDocumentation) gaps.push('documentation');
    if (!projectStructure.hasMonitoring) gaps.push('monitoring');
    
    return gaps;
  }
  
  async _getTemplatesForPattern(pattern) {
    // Query templates that implement specific architectural patterns
    return [];
  }
  
  async _getTemplatesForGap(gap) {
    // Query templates that address specific gaps
    return [];
  }
  
  _prioritizeNeeds(needs, project) {
    return needs.sort((a, b) => {
      const priorities = {
        'security': 10,
        'testing': 9,
        'monitoring': 8,
        'documentation': 7,
        'scaffolding': 6
      };
      return (priorities[b] || 5) - (priorities[a] || 5);
    });
  }
  
  _identifyGaps(needs, existingTemplates) {
    return needs.filter(need =>
      !existingTemplates.some(template =>
        template.name?.toLowerCase().includes(need.toLowerCase()) ||
        template.category?.toLowerCase().includes(need.toLowerCase())
      )
    );
  }
  
  _checkSynergies(template, existingTemplates) {
    // Check for templates that work well together
    return [];
  }
  
  _assessTechCompatibility(template, userContext) {
    return this._calculateTechnologyMatch(template, userContext);
  }
  
  _assessPatternCompatibility(template, userContext) {
    // Assess architectural pattern compatibility
    return 0.8; // Mock value
  }
  
  _assessInfraCompatibility(template, userContext) {
    // Assess infrastructure compatibility
    return 0.7; // Mock value
  }
  
  _estimateProjectSize(userContext) {
    const teamSize = userContext.teamSize || userContext.project?.teamSize || 'small';
    const mapping = {
      'small': 'small',
      'medium': 'medium',
      'large': 'large',
      'enterprise': 'large'
    };
    return mapping[teamSize] || 'small';
  }
  
  _calculateMonthlyUsage(frequency) {
    const mapping = {
      'daily': 22,
      'weekly': 4,
      'monthly': 1,
      'rarely': 0.5
    };
    return mapping[frequency] || 1;
  }
  
  _estimateTimeSavings(template, userContext) {
    // Estimate time saved per template usage
    const category = template.category?.value || 'general';
    const savings = {
      'component': 30, // minutes
      'service': 120,
      'config': 60,
      'test': 20,
      'deployment': 180,
      'documentation': 45
    };
    return savings[category] || 60;
  }
  
  _generateSetupSteps(template, userContext) {
    return [
      'Install template dependencies',
      'Configure template variables',
      'Customize for your project',
      'Test template functionality',
      'Integrate with existing code'
    ];
  }
  
  _identifyPrerequisites(template, userContext) {
    return {
      software: ['Node.js >= 14', 'npm >= 6'],
      knowledge: ['Basic JavaScript', 'Project structure'],
      tools: ['Code editor', 'Terminal access']
    };
  }
  
  _suggestCustomizations(template, userContext) {
    return [
      'Update variable names to match your conventions',
      'Adjust file structure for your project',
      'Modify styling to match your design system',
      'Add project-specific validation rules'
    ];
  }
  
  _getBestPractices(template) {
    return [
      'Review generated code before committing',
      'Test templates in development environment first',
      'Keep templates updated with latest versions',
      'Document any customizations made'
    ];
  }
  
  _getCommonIssues(template) {
    return [
      {
        issue: 'Template variables not substituted',
        solution: 'Check variable naming and context configuration'
      },
      {
        issue: 'Generated files conflict with existing ones',
        solution: 'Use dry-run mode to preview changes first'
      }
    ];
  }
}

export default TemplateRecommender;