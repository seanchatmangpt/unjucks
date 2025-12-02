/**
 * Similarity Matching Algorithm
 * 
 * Uses collaborative filtering and content-based similarity
 * to find packages similar to user's current stack or preferences.
 */

import { createLogger } from '../../utils/logger.js';

export class SimilarityMatcher {
  constructor(sparqlEngine) {
    this.sparqlEngine = sparqlEngine;
    this.logger = createLogger('SimilarityMatcher');
    
    // Similarity weights for different factors
    this.similarityWeights = {
      facetSimilarity: 0.3,
      userOverlap: 0.25,
      contentSimilarity: 0.2,
      technologyOverlap: 0.15,
      useCaseSimilarity: 0.1
    };
    
    // Technology relationship mappings
    this.technologyRelationships = {
      'React': ['Vue', 'Angular', 'Svelte'],
      'Vue': ['React', 'Angular', 'Nuxt'],
      'Angular': ['React', 'Vue', 'TypeScript'],
      'Node.js': ['Express', 'Fastify', 'Nest.js'],
      'Python': ['Django', 'FastAPI', 'Flask'],
      'Java': ['Spring Boot', 'Quarkus', 'Micronaut'],
      'TypeScript': ['JavaScript', 'Angular', 'React'],
      'Docker': ['Kubernetes', 'Podman', 'Containerd'],
      'AWS': ['Azure', 'GCP', 'DigitalOcean']
    };
    
    // Facet categories and their importance
    this.facetCategories = {
      'technology': { weight: 0.3, importance: 'high' },
      'domain': { weight: 0.25, importance: 'high' },
      'architecture': { weight: 0.2, importance: 'medium' },
      'industry': { weight: 0.15, importance: 'medium' },
      'complexity': { weight: 0.1, importance: 'low' }
    };
  }
  
  /**
   * Generate similarity-based recommendations
   * @param {Object} userContext - User's preferences and current packages
   * @param {Object} options - Recommendation options
   * @returns {Promise<Array>} Similar packages
   */
  async recommend(userContext, options = {}) {
    try {
      this.logger.info('Generating similarity-based recommendations', { userContext });
      
      const {
        currentPackages = [],
        favoritePackages = [],
        technologies = [],
        useCases = [],
        industry = null
      } = userContext;
      
      // Find similar packages for each reference package
      const allSimilarPackages = [];
      
      for (const refPackage of [...currentPackages, ...favoritePackages]) {
        const similarPackages = await this._findSimilarPackages(refPackage, userContext, options);
        allSimilarPackages.push(...similarPackages);
      }
      
      // If no reference packages, use user profile similarity
      if (allSimilarPackages.length === 0) {
        const profileBasedPackages = await this._findPackagesByProfile(userContext, options);
        allSimilarPackages.push(...profileBasedPackages);
      }
      
      // Deduplicate and score
      const uniquePackages = this._deduplicatePackages(allSimilarPackages);
      const scoredPackages = uniquePackages.map(pkg => ({
        ...pkg,
        type: 'similarity',
        reasoning: this._generateSimilarityReasoning(pkg, userContext),
        matchDetails: this._generateMatchDetails(pkg, userContext)
      }));
      
      // Sort by similarity score and apply filters
      return scoredPackages
        .filter(pkg => pkg.similarity >= (options.minSimilarity || 0.3))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, options.limit || 20);
        
    } catch (error) {
      this.logger.error('Failed to generate similarity recommendations', error);
      throw error;
    }
  }
  
  /**
   * Find packages similar to a specific reference package
   * @param {Object} referencePackage - Package to find similarities for
   * @param {Object} userContext - User context
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Similar packages
   */
  async findSimilarPackages(referencePackage, userContext, options = {}) {
    try {
      this.logger.info('Finding similar packages', { referencePackage });
      
      const similarities = await this.sparqlEngine.executeNamedQuery('findSimilarPacks', {
        referencePackage: referencePackage.uri || referencePackage.id,
        minRating: options.minRating || 3.0,
        minSimilarity: options.minSimilarity || 0.3,
        limit: options.limit || 30
      });
      
      // Calculate detailed similarity scores
      const detailedSimilarities = await Promise.all(
        similarities.map(sim => this._calculateDetailedSimilarity(sim, referencePackage, userContext))
      );
      
      return detailedSimilarities.sort((a, b) => b.similarity - a.similarity);
      
    } catch (error) {
      this.logger.error('Failed to find similar packages', error);
      throw error;
    }
  }
  
  /**
   * Analyze similarity patterns in user's package choices
   * @param {Object} userHistory - User's package adoption history
   * @returns {Promise<Object>} Similarity pattern analysis
   */
  async analyzeUserPatterns(userHistory) {
    try {
      const {
        adoptedPackages = [],
        abandonedPackages = [],
        ratedPackages = []
      } = userHistory;
      
      // Extract patterns from adopted packages
      const adoptionPatterns = this._extractPatterns(adoptedPackages);
      
      // Analyze technology preferences
      const technologyPreferences = this._analyzeTechnologyPreferences(adoptedPackages);
      
      // Identify preference clusters
      const clusters = this._identifyPreferenceClusters(adoptedPackages, ratedPackages);
      
      // Generate preference profile
      const preferenceProfile = this._generatePreferenceProfile(adoptionPatterns, technologyPreferences, clusters);
      
      return {
        patterns: adoptionPatterns,
        preferences: technologyPreferences,
        clusters,
        profile: preferenceProfile,
        recommendations: this._generatePatternBasedRecommendations(preferenceProfile)
      };
      
    } catch (error) {
      this.logger.error('Failed to analyze user patterns', error);
      throw error;
    }
  }
  
  /**
   * Find packages similar to a specific reference package
   */
  async _findSimilarPackages(referencePackage, userContext, options) {
    const packageId = referencePackage.uri || referencePackage.id || referencePackage.name;
    
    const similarities = await this.sparqlEngine.executeNamedQuery('findSimilarPacks', {
      referencePackage: packageId,
      minRating: options.minRating || 3.0,
      minSimilarity: options.minSimilarity || 0.2,
      limit: options.limit || 20
    });
    
    return Promise.all(
      similarities.map(sim => this._calculateDetailedSimilarity(sim, referencePackage, userContext))
    );
  }
  
  /**
   * Find packages based on user profile similarity
   */
  async _findPackagesByProfile(userContext, options) {
    const {
      technologies = [],
      industry = null,
      useCases = [],
      projectType = null
    } = userContext;
    
    // Create a synthetic profile-based query
    const profileQuery = `
      SELECT DISTINCT ?pack ?name ?category ?rating ?downloads WHERE {
        ?pack a kgen:Package ;
              kgen:hasName ?name ;
              kgen:hasCategory ?category ;
              kgen:hasRating ?rating ;
              kgen:hasDownloads ?downloads .
        
        # Technology match
        ${technologies.length > 0 ? `
        ?pack kgen:hasTechnology ?tech .
        FILTER(?tech IN (${technologies.map(t => `"${t}"`).join(', ')}))
        ` : ''}
        
        # Industry match
        ${industry ? `
        OPTIONAL {
          ?pack kgen:hasIndustryVertical "${industry}" .
          BIND(1.0 AS ?industryMatch)
        }
        ` : ''}
        
        # Use case match
        ${useCases.length > 0 ? `
        OPTIONAL {
          ?pack kgen:hasUseCase ?useCase .
          FILTER(?useCase IN (${useCases.map(uc => `"${uc}"`).join(', ')}))
          BIND(1.0 AS ?useCaseMatch)
        }
        ` : ''}
        
        FILTER(?rating >= 3.0)
      }
      ORDER BY DESC(?downloads) DESC(?rating)
      LIMIT ${options.limit || 20}
    `;
    
    const results = await this.sparqlEngine.query(profileQuery);
    
    return results.map(result => ({
      ...result,
      similarity: this._calculateProfileSimilarity(result, userContext),
      source: 'profile-match'
    }));
  }
  
  /**
   * Calculate detailed similarity between packages
   */
  async _calculateDetailedSimilarity(similarPackage, referencePackage, userContext) {
    const facetSimilarity = parseFloat(similarPackage.sharedFacets?.value || 0) / 10; // Normalize
    const userOverlap = parseFloat(similarPackage.userOverlap?.value || 0) / 100; // Normalize
    const contentSimilarity = parseFloat(similarPackage.contentSimilarity?.value || 0);
    
    // Calculate technology overlap
    const technologyOverlap = this._calculateTechnologyOverlap(similarPackage, referencePackage, userContext);
    
    // Calculate use case similarity
    const useCaseSimilarity = this._calculateUseCaseSimilarity(similarPackage, referencePackage, userContext);
    
    // Weighted similarity score
    const similarity = 
      (facetSimilarity * this.similarityWeights.facetSimilarity) +
      (userOverlap * this.similarityWeights.userOverlap) +
      (contentSimilarity * this.similarityWeights.contentSimilarity) +
      (technologyOverlap * this.similarityWeights.technologyOverlap) +
      (useCaseSimilarity * this.similarityWeights.useCaseSimilarity);
    
    return {
      ...similarPackage,
      similarity: Math.min(similarity, 1.0),
      components: {
        facetSimilarity,
        userOverlap,
        contentSimilarity,
        technologyOverlap,
        useCaseSimilarity
      }
    };
  }
  
  /**
   * Calculate technology overlap between packages
   */
  _calculateTechnologyOverlap(package1, package2, userContext) {
    const pkg1Tech = this._extractTechnologies(package1);
    const pkg2Tech = this._extractTechnologies(package2);
    const userTech = userContext.technologies || [];
    
    // Direct technology matches
    const directMatches = pkg1Tech.filter(tech => pkg2Tech.includes(tech)).length;
    
    // Related technology matches
    const relatedMatches = pkg1Tech.reduce((count, tech) => {
      const related = this.technologyRelationships[tech] || [];
      return count + pkg2Tech.filter(t => related.includes(t)).length;
    }, 0);
    
    // User technology alignment
    const userAlignment = pkg1Tech.filter(tech => userTech.includes(tech)).length / Math.max(userTech.length, 1);
    
    const totalPossible = Math.max(pkg1Tech.length, pkg2Tech.length);
    const baseScore = totalPossible > 0 ? (directMatches + relatedMatches * 0.5) / totalPossible : 0;
    
    return (baseScore * 0.7) + (userAlignment * 0.3);
  }
  
  /**
   * Calculate use case similarity
   */
  _calculateUseCaseSimilarity(package1, package2, userContext) {
    const pkg1UseCases = this._extractUseCases(package1);
    const pkg2UseCases = this._extractUseCases(package2);
    const userUseCases = userContext.useCases || [];
    
    if (pkg1UseCases.length === 0 || pkg2UseCases.length === 0) {
      return 0.5; // Neutral score when data is missing
    }
    
    const commonUseCases = pkg1UseCases.filter(uc => pkg2UseCases.includes(uc));
    const totalUseCases = [...new Set([...pkg1UseCases, ...pkg2UseCases])];
    
    const jaccardSimilarity = commonUseCases.length / totalUseCases.length;
    
    // Boost score if use cases align with user's needs
    const userAlignment = commonUseCases.filter(uc => userUseCases.includes(uc)).length;
    const alignmentBonus = userAlignment > 0 ? 0.2 : 0;
    
    return Math.min(jaccardSimilarity + alignmentBonus, 1.0);
  }
  
  /**
   * Calculate profile-based similarity
   */
  _calculateProfileSimilarity(packageResult, userContext) {
    let score = 0;
    
    // Technology alignment
    const packageTech = this._extractTechnologies(packageResult);
    const userTech = userContext.technologies || [];
    const techMatch = packageTech.filter(tech => userTech.includes(tech)).length;
    score += Math.min(techMatch / Math.max(userTech.length, 1), 1.0) * 0.4;
    
    // Industry alignment
    if (userContext.industry && packageResult.industry?.value === userContext.industry) {
      score += 0.3;
    }
    
    // Use case alignment
    const packageUseCases = this._extractUseCases(packageResult);
    const userUseCases = userContext.useCases || [];
    const useCaseMatch = packageUseCases.filter(uc => userUseCases.includes(uc)).length;
    score += Math.min(useCaseMatch / Math.max(userUseCases.length, 1), 1.0) * 0.2;
    
    // Quality factor
    const rating = parseFloat(packageResult.rating?.value || 3.0);
    score += (rating / 5.0) * 0.1;
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Extract patterns from user's package history
   */
  _extractPatterns(packages) {
    const patterns = {
      categoryPreferences: this._extractCategoryPatterns(packages),
      technologyCombinations: this._extractTechnologyCombinations(packages),
      complexityPreferences: this._extractComplexityPatterns(packages),
      temporalPatterns: this._extractTemporalPatterns(packages)
    };
    
    return patterns;
  }
  
  /**
   * Analyze technology preferences from package history
   */
  _analyzeTechnologyPreferences(packages) {
    const techCounts = {};
    const techRatings = {};
    
    packages.forEach(pkg => {
      const technologies = this._extractTechnologies(pkg);
      const rating = parseFloat(pkg.rating || 3.0);
      
      technologies.forEach(tech => {
        techCounts[tech] = (techCounts[tech] || 0) + 1;
        techRatings[tech] = (techRatings[tech] || []);
        techRatings[tech].push(rating);
      });
    });
    
    // Calculate preference scores
    const preferences = {};
    Object.keys(techCounts).forEach(tech => {
      const count = techCounts[tech];
      const avgRating = techRatings[tech].reduce((sum, r) => sum + r, 0) / techRatings[tech].length;
      
      preferences[tech] = {
        frequency: count,
        averageRating: avgRating,
        preferenceScore: (count / packages.length) * (avgRating / 5.0)
      };
    });
    
    return preferences;
  }
  
  /**
   * Identify preference clusters using simple clustering
   */
  _identifyPreferenceClusters(adoptedPackages, ratedPackages) {
    // Simple clustering based on technology and category preferences
    const clusters = {
      frontend: this._findCluster(adoptedPackages, ['React', 'Vue', 'Angular', 'frontend']),
      backend: this._findCluster(adoptedPackages, ['Node.js', 'Python', 'Java', 'backend']),
      devops: this._findCluster(adoptedPackages, ['Docker', 'Kubernetes', 'AWS', 'devops']),
      testing: this._findCluster(adoptedPackages, ['Jest', 'Cypress', 'testing']),
      security: this._findCluster(adoptedPackages, ['security', 'authentication', 'authorization'])
    };
    
    return clusters;
  }
  
  /**
   * Generate preference profile from patterns and clusters
   */
  _generatePreferenceProfile(patterns, preferences, clusters) {
    const profile = {
      primaryTechnologies: this._identifyPrimaryTechnologies(preferences),
      preferredCategories: this._identifyPreferredCategories(patterns.categoryPreferences),
      complexityTolerance: this._determineComplexityTolerance(patterns.complexityPreferences),
      explorationVsExploitation: this._calculateExplorationRatio(patterns),
      strongClusters: this._identifyStrongClusters(clusters),
      preferenceStrength: this._calculatePreferenceStrength(patterns, preferences)
    };
    
    return profile;
  }
  
  /**
   * Generate recommendations based on preference patterns
   */
  _generatePatternBasedRecommendations(profile) {
    const recommendations = [];
    
    // Recommend based on primary technologies
    profile.primaryTechnologies.forEach(tech => {
      const related = this.technologyRelationships[tech.name] || [];
      related.forEach(relatedTech => {
        recommendations.push({
          type: 'technology-expansion',
          technology: relatedTech,
          reason: `Related to preferred technology: ${tech.name}`,
          confidence: tech.score * 0.8
        });
      });
    });
    
    // Recommend based on strong clusters
    profile.strongClusters.forEach(cluster => {
      recommendations.push({
        type: 'cluster-completion',
        cluster: cluster.name,
        reason: `Strong preference in ${cluster.name} domain`,
        confidence: cluster.strength
      });
    });
    
    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * Helper methods for pattern extraction
   */
  _extractCategoryPatterns(packages) {
    const categories = {};
    packages.forEach(pkg => {
      const category = pkg.category || 'unknown';
      categories[category] = (categories[category] || 0) + 1;
    });
    return categories;
  }
  
  _extractTechnologyCombinations(packages) {
    const combinations = {};
    packages.forEach(pkg => {
      const technologies = this._extractTechnologies(pkg).sort();
      if (technologies.length > 1) {
        const combo = technologies.join('+');
        combinations[combo] = (combinations[combo] || 0) + 1;
      }
    });
    return combinations;
  }
  
  _extractComplexityPatterns(packages) {
    const complexities = {};
    packages.forEach(pkg => {
      const complexity = pkg.complexity || 'medium';
      complexities[complexity] = (complexities[complexity] || 0) + 1;
    });
    return complexities;
  }
  
  _extractTemporalPatterns(packages) {
    // Analyze adoption timing patterns
    const timeline = packages
      .filter(pkg => pkg.adoptedAt)
      .sort((a, b) => new Date(a.adoptedAt) - new Date(b.adoptedAt));
    
    return {
      adoptionVelocity: timeline.length > 1 ? this._calculateAdoptionVelocity(timeline) : 0,
      seasonalPatterns: this._identifySeasonalPatterns(timeline),
      trendFollowing: this._calculateTrendFollowing(timeline)
    };
  }
  
  _extractTechnologies(packageOrResult) {
    // Extract technologies from various possible fields
    const technologies = [];
    
    if (packageOrResult.technologies) {
      technologies.push(...packageOrResult.technologies);
    }
    
    if (packageOrResult.technology?.value) {
      technologies.push(packageOrResult.technology.value);
    }
    
    if (packageOrResult.framework?.value) {
      technologies.push(packageOrResult.framework.value);
    }
    
    if (packageOrResult.language?.value) {
      technologies.push(packageOrResult.language.value);
    }
    
    return [...new Set(technologies)]; // Deduplicate
  }
  
  _extractUseCases(packageOrResult) {
    const useCases = [];
    
    if (packageOrResult.useCases) {
      useCases.push(...packageOrResult.useCases);
    }
    
    if (packageOrResult.useCase?.value) {
      useCases.push(packageOrResult.useCase.value);
    }
    
    if (packageOrResult.category?.value) {
      useCases.push(packageOrResult.category.value);
    }
    
    return [...new Set(useCases)];
  }
  
  _deduplicatePackages(packages) {
    const seen = new Set();
    return packages.filter(pkg => {
      const key = pkg.pack?.value || pkg.name?.value || pkg.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  
  _generateSimilarityReasoning(package_, userContext) {
    const reasons = [];
    
    if (package_.components?.facetSimilarity > 0.7) {
      reasons.push('Strong feature overlap with your preferences');
    }
    
    if (package_.components?.userOverlap > 0.5) {
      reasons.push('Popular with users who have similar package choices');
    }
    
    if (package_.components?.technologyOverlap > 0.6) {
      reasons.push('Compatible with your technology stack');
    }
    
    if (package_.components?.contentSimilarity > 0.6) {
      reasons.push('Similar functionality and use cases');
    }
    
    return reasons.join('; ') || 'General similarity based on usage patterns';
  }
  
  _generateMatchDetails(package_, userContext) {
    return {
      primaryMatchFactors: this._identifyPrimaryMatchFactors(package_),
      strengthAreas: this._identifyStrengthAreas(package_, userContext),
      potentialConcerns: this._identifyPotentialConcerns(package_, userContext),
      complementaryPackages: this._suggestComplementaryPackages(package_, userContext)
    };
  }
  
  _identifyPrimaryMatchFactors(package_) {
    const factors = [];
    const components = package_.components || {};
    
    if (components.facetSimilarity > 0.6) factors.push('Feature similarity');
    if (components.userOverlap > 0.4) factors.push('Community overlap');
    if (components.technologyOverlap > 0.5) factors.push('Technology compatibility');
    if (components.contentSimilarity > 0.5) factors.push('Content similarity');
    
    return factors;
  }
  
  _identifyStrengthAreas(package_, userContext) {
    // Identify what makes this package a good match
    return [
      'Technology stack alignment',
      'Use case compatibility',
      'Community validation'
    ];
  }
  
  _identifyPotentialConcerns(package_, userContext) {
    // Identify potential issues or considerations
    const concerns = [];
    
    if (package_.components?.userOverlap < 0.2) {
      concerns.push('Limited community overlap - may require more evaluation');
    }
    
    if (package_.components?.technologyOverlap < 0.3) {
      concerns.push('Technology stack differences - check compatibility');
    }
    
    return concerns;
  }
  
  _suggestComplementaryPackages(package_, userContext) {
    // Suggest packages that work well with this one
    return []; // Would be populated with actual complementary package suggestions
  }
  
  _findCluster(packages, keywords) {
    const clusterPackages = packages.filter(pkg => {
      const searchText = `${pkg.name} ${pkg.description} ${pkg.category}`.toLowerCase();
      return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
    });
    
    return {
      packages: clusterPackages,
      strength: clusterPackages.length / packages.length,
      keywords
    };
  }
  
  _identifyPrimaryTechnologies(preferences) {
    return Object.entries(preferences)
      .map(([tech, data]) => ({ name: tech, score: data.preferenceScore }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }
  
  _identifyPreferredCategories(categoryPreferences) {
    return Object.entries(categoryPreferences)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }
  
  _determineComplexityTolerance(complexityPreferences) {
    const total = Object.values(complexityPreferences).reduce((sum, count) => sum + count, 0);
    const highComplexity = complexityPreferences.high || 0;
    return highComplexity / total;
  }
  
  _calculateExplorationRatio(patterns) {
    // Calculate how much the user explores new vs sticks to known patterns
    return 0.7; // Mock value - would calculate based on actual patterns
  }
  
  _identifyStrongClusters(clusters) {
    return Object.entries(clusters)
      .filter(([_, cluster]) => cluster.strength > 0.3)
      .map(([name, cluster]) => ({ name, strength: cluster.strength }));
  }
  
  _calculatePreferenceStrength(patterns, preferences) {
    // Calculate how strong/consistent the user's preferences are
    const categoryEntropy = this._calculateEntropy(Object.values(patterns.categoryPreferences));
    const techEntropy = this._calculateEntropy(Object.values(preferences).map(p => p.frequency));
    
    return 1 - (categoryEntropy + techEntropy) / 2; // Lower entropy = stronger preferences
  }
  
  _calculateEntropy(values) {
    const total = values.reduce((sum, v) => sum + v, 0);
    if (total === 0) return 1;
    
    const probabilities = values.map(v => v / total);
    return -probabilities.reduce((sum, p) => p > 0 ? sum + p * Math.log2(p) : sum, 0) / Math.log2(values.length);
  }
  
  _calculateAdoptionVelocity(timeline) {
    if (timeline.length < 2) return 0;
    
    const timeSpan = new Date(timeline[timeline.length - 1].adoptedAt) - new Date(timeline[0].adoptedAt);
    const timeSpanMonths = timeSpan / (1000 * 60 * 60 * 24 * 30);
    
    return timeline.length / timeSpanMonths; // Packages per month
  }
  
  _identifySeasonalPatterns(timeline) {
    // Analyze if adoption follows seasonal patterns
    const monthCounts = {};
    timeline.forEach(pkg => {
      const month = new Date(pkg.adoptedAt).getMonth();
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    
    const maxMonth = Object.entries(monthCounts).reduce((max, [month, count]) => 
      count > max.count ? { month: parseInt(month), count } : max, { month: 0, count: 0 });
    
    return {
      peakMonth: maxMonth.month,
      seasonality: this._calculateSeasonality(monthCounts)
    };
  }
  
  _calculateTrendFollowing(timeline) {
    // Calculate how much the user follows trends vs sets them
    return 0.6; // Mock value - would analyze against market trends
  }
  
  _calculateSeasonality(monthCounts) {
    const values = Object.values(monthCounts);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    return variance / (avg || 1); // Higher variance = more seasonal
  }
}

export default SimilarityMatcher;