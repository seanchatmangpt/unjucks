/**
 * Compliance Template Marketplace
 * $5M ARR opportunity - regulatory compliance template ecosystem
 */

import path from 'node:path';
import fs from 'fs/promises';

/**
 * @typedef {'GDPR' | 'HIPAA' | 'SOX' | 'PCI-DSS' | 'Basel III' | 'CCPA' | 'PIPEDA' | 'LGPD'} RegulationType
 */

/**
 * @typedef {'Basic' | 'Standard' | 'Enterprise'} ComplianceLevelType
 */

/**
 * @typedef {'Healthcare' | 'Financial' | 'E-commerce' | 'Government' | 'Technology'} IndustryVerticalType
 */

/**
 * @typedef {('EU' | 'US' | 'UK' | 'Canada' | 'Brazil' | 'Global')[]} JurisdictionType
 */

/**
 * @typedef {'Low' | 'Medium' | 'High' | 'Critical'} RiskAssessmentType
 */

/**
 * @typedef {'Pending' | 'Under Review' | 'Certified' | 'Rejected'} CertificationStatusType
 */

/**
 * @typedef {Object} ComplianceTemplate
 * @property {string} id - Template ID
 * @property {string} name - Template name
 * @property {RegulationType} regulation - Regulation type
 * @property {JurisdictionType} jurisdiction - Applicable jurisdictions
 * @property {ComplianceLevelType} complianceLevel - Compliance level
 * @property {IndustryVerticalType[]} industryVertical - Applicable industries
 * @property {boolean} auditTrail - Whether audit trail is included
 * @property {RiskAssessmentType} riskAssessment - Risk assessment level
 * @property {boolean} legalReview - Whether legal review is required
 * @property {string} updateFrequency - Update frequency
 * @property {string} version - Template version
 * @property {Date} lastUpdated - Last update date
 * @property {CertificationStatusType} certificationStatus - Certification status
 * @property {string} templatePath - Path to template files
 * @property {Object} metadata - Additional metadata
 * @property {string[]} metadata.regulatoryArticles - Relevant regulatory articles
 * @property {string[]} metadata.complianceRequirements - Compliance requirements
 * @property {string[]} metadata.auditCheckpoints - Audit checkpoints
 * @property {string[]} metadata.riskMitigations - Risk mitigations
 * @property {string[]} metadata.documentationRequired - Required documentation
 * @property {boolean} metadata.automaticValidation - Whether automatic validation is enabled
 * @property {boolean} metadata.expertReviewRequired - Whether expert review is required
 */

/**
 * @typedef {Object} MarketplaceTemplate
 * @property {ComplianceTemplate} template - The compliance template
 * @property {Object} pricing - Pricing information
 * @property {'Free' | 'Pro' | 'Enterprise'} pricing.tier - Pricing tier
 * @property {number} pricing.price - Price in USD
 * @property {'One-time' | 'Monthly' | 'Annual'} pricing.billingPeriod - Billing period
 * @property {Object} author - Author information
 * @property {string} author.name - Author name
 * @property {string} author.organization - Author organization
 * @property {string[]} author.credentials - Author credentials
 * @property {boolean} author.verified - Whether author is verified
 * @property {Object[]} reviews - Template reviews
 * @property {string} reviews[].userId - Reviewer user ID
 * @property {number} reviews[].rating - Review rating (1-5)
 * @property {string} reviews[].comment - Review comment
 * @property {Date} reviews[].date - Review date
 * @property {number} downloads - Download count
 * @property {number} successRate - Success rate percentage
 * @property {string} supportLevel - Support level
 */

export class ComplianceMarketplace {
  constructor() {
    /** @type {Map<string, MarketplaceTemplate>} */
    this.templates = new Map();
    this.validator = null; // ComplianceValidator would be imported if available
    /** @type {Set<string>} */
    this.certifiedAuthorities = new Set([
      'Legal Compliance Associates',
      'Regulatory Experts Inc',
      'HIPAA Compliance Solutions',
      'GDPR Legal Partners',
      'SOX Compliance Consulting'
    ]);
    
    this.initializeMarketplace();
  }

  /**
   * Initialize marketplace with certified templates
   * @private
   */
  async initializeMarketplace() {
    // Load templates from filesystem
    await this.loadTemplatesFromDirectory('templates/compliance');
    
    // Add featured enterprise templates
    await this.addFeaturedTemplates();
    
    // Initialize pricing tiers
    this.setupPricingTiers();
  }

  /**
   * Get all templates filtered by criteria
   * @param {Object} [filters] - Filter criteria
   * @param {RegulationType} [filters.regulation] - Filter by regulation
   * @param {IndustryVerticalType} [filters.industry] - Filter by industry
   * @param {ComplianceLevelType} [filters.complianceLevel] - Filter by compliance level
   * @param {[number, number]} [filters.priceRange] - Filter by price range
   * @param {boolean} [filters.certified] - Filter by certification status
   * @param {boolean} [filters.featured] - Filter by featured status
   * @returns {Promise<MarketplaceTemplate[]>} Filtered templates
   */
  async getTemplates(filters) {
    let templates = Array.from(this.templates.values());

    if (filters) {
      if (filters.regulation) {
        templates = templates.filter(t => t.template.regulation === filters.regulation);
      }

      if (filters.industry) {
        templates = templates.filter(t => 
          t.template.industryVertical.includes(filters.industry)
        );
      }

      if (filters.complianceLevel) {
        templates = templates.filter(t => t.template.complianceLevel === filters.complianceLevel);
      }

      if (filters.priceRange) {
        const [min, max] = filters.priceRange;
        templates = templates.filter(t => 
          t.pricing.price >= min && t.pricing.price <= max
        );
      }

      if (filters.certified) {
        templates = templates.filter(t => 
          t.template.certificationStatus === 'Certified'
        );
      }

      if (filters.featured) {
        templates = templates.filter(t => t.downloads > 1000);
      }
    }

    // Sort by popularity and rating
    return templates.sort((a, b) => {
      const aScore = a.downloads * 0.3 + this.getAverageRating(a) * 100;
      const bScore = b.downloads * 0.3 + this.getAverageRating(b) * 100;
      return bScore - aScore;
    });
  }

  /**
   * Get specific template by ID
   * @param {string} templateId - Template ID
   * @returns {Promise<MarketplaceTemplate | null>} Template or null
   */
  async getTemplate(templateId) {
    return this.templates.get(templateId) || null;
  }

  /**
   * Purchase template (enterprise licensing)
   * @param {string} templateId - Template ID
   * @param {string} organizationId - Organization ID
   * @param {'single' | 'team' | 'enterprise'} [licenseType='single'] - License type
   * @returns {Promise<Object>} Purchase result
   */
  async purchaseTemplate(templateId, organizationId, licenseType = 'single') {
    const template = this.templates.get(templateId);
    
    if (!template) {
      throw new Error('Template not found');
    }

    // Calculate pricing based on license type
    const basePrice = template.pricing.price;
    const licenseMultiplier = {
      single: 1,
      team: 5,
      enterprise: 20
    };

    const finalPrice = basePrice * licenseMultiplier[licenseType];
    const licenseKey = this.generateLicenseKey(templateId, organizationId, licenseType);

    // Update download count
    template.downloads += 1;

    // Generate invoice and process payment
    await this.processPayment(organizationId, finalPrice, templateId);

    return {
      success: true,
      licenseKey,
      template,
      price: finalPrice
    };
  }

  /**
   * Submit template for certification
   * @param {ComplianceTemplate} template - Template to certify
   * @param {Object} authorInfo - Author information
   * @param {string} authorInfo.name - Author name
   * @param {string} authorInfo.organization - Author organization
   * @param {string[]} authorInfo.credentials - Author credentials
   * @param {string} authorInfo.email - Author email
   * @returns {Promise<Object>} Submission result
   */
  async submitForCertification(template, authorInfo) {
    const submissionId = this.generateSubmissionId();
    const certificationFee = this.calculateCertificationFee(template);

    // Validate template compliance
    const validationResults = await this.validateTemplateCompliance(template);

    if (!validationResults.isValid) {
      throw new Error(`Template validation failed: ${validationResults.errors.join(', ')}`);
    }

    // Create marketplace entry with pending status
    /** @type {MarketplaceTemplate} */
    const marketplaceTemplate = {
      template: {
        ...template,
        certificationStatus: 'Under Review',
        id: submissionId
      },
      pricing: {
        tier: 'Pro',
        price: this.suggestPrice(template),
        billingPeriod: 'One-time'
      },
      author: {
        ...authorInfo,
        verified: this.certifiedAuthorities.has(authorInfo.organization)
      },
      reviews: [],
      downloads: 0,
      successRate: 95, // Initial estimate
      supportLevel: 'Professional'
    };

    this.templates.set(submissionId, marketplaceTemplate);

    // Schedule legal review
    await this.scheduleLegalReview(submissionId, template);

    return {
      submissionId,
      estimatedReviewTime: '5-10 business days',
      certificationFee
    };
  }

  /**
   * Rate and review template
   * @param {string} templateId - Template ID
   * @param {string} userId - User ID
   * @param {number} rating - Rating (1-5)
   * @param {string} comment - Review comment
   * @returns {Promise<boolean>} Success status
   */
  async rateTemplate(templateId, userId, rating, comment) {
    const template = this.templates.get(templateId);
    
    if (!template) {
      return false;
    }

    // Check if user already reviewed
    const existingReview = template.reviews.find(r => r.userId === userId);
    
    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      existingReview.comment = comment;
      existingReview.date = new Date();
    } else {
      // Add new review
      template.reviews.push({
        userId,
        rating,
        comment,
        date: new Date()
      });
    }

    return true;
  }

  /**
   * Get enterprise compliance bundle
   * @param {RegulationType[]} regulations - Required regulations
   * @param {IndustryVerticalType} industry - Industry vertical
   * @param {'small' | 'medium' | 'large' | 'enterprise'} organizationSize - Organization size
   * @returns {Promise<Object>} Enterprise bundle
   */
  async getEnterpriseBundle(regulations, industry, organizationSize) {
    const relevantTemplates = await this.getTemplates({
      industry,
      certified: true
    });

    const bundleTemplates = relevantTemplates.filter(t =>
      regulations.includes(t.template.regulation)
    );

    const basePrice = bundleTemplates.reduce((sum, t) => sum + t.pricing.price, 0);
    const bundleDiscount = this.calculateBundleDiscount(bundleTemplates.length, organizationSize);
    const totalPrice = basePrice * (1 - bundleDiscount);

    const features = [
      'Priority support',
      'Custom template modifications',
      'Regulatory update notifications',
      'Compliance consulting hours',
      'Multi-jurisdiction support',
      'Enterprise deployment tools'
    ];

    return {
      templates: bundleTemplates,
      totalPrice,
      bundleDiscount,
      supportLevel: 'Enterprise',
      features
    };
  }

  /**
   * Get compliance market insights
   * @returns {Object} Market insights
   */
  getMarketInsights() {
    // Simulate market data
    return {
      topRegulations: [
        { regulation: 'GDPR', demand: 85 },
        { regulation: 'HIPAA', demand: 72 },
        { regulation: 'SOX', demand: 58 },
        { regulation: 'PCI-DSS', demand: 45 },
        { regulation: 'Basel III', demand: 32 }
      ],
      growthTrends: [
        { month: '2024-01', revenue: 180000 },
        { month: '2024-02', revenue: 220000 },
        { month: '2024-03', revenue: 280000 },
        { month: '2024-04', revenue: 350000 },
        { month: '2024-05', revenue: 420000 },
        { month: '2024-06', revenue: 480000 }
      ],
      industryBreakdown: [
        { industry: 'Healthcare', percentage: 35 },
        { industry: 'Financial', percentage: 28 },
        { industry: 'E-commerce', percentage: 20 },
        { industry: 'Government', percentage: 10 },
        { industry: 'Technology', percentage: 7 }
      ],
      revenueProjection: {
        monthly: 480000,
        yearly: 5760000,
        target: 5000000
      }
    };
  }

  // Private helper methods

  /**
   * @private
   */
  async loadTemplatesFromDirectory(baseDir) {
    try {
      const regulations = await fs.readdir(baseDir);
      
      for (const regulation of regulations) {
        const regulationPath = path.join(baseDir, regulation);
        const categories = await fs.readdir(regulationPath);
        
        for (const category of categories) {
          const categoryPath = path.join(regulationPath, category);
          await this.loadTemplateFromCategory(categoryPath, regulation, category);
        }
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }

  /**
   * @private
   */
  async loadTemplateFromCategory(categoryPath, regulation, category) {
    try {
      const promptPath = path.join(categoryPath, '_prompt.md');
      const promptContent = await fs.readFile(promptPath, 'utf-8');
      
      const template = this.parseTemplateFromPrompt(promptContent, regulation, category);
      const templateId = `${regulation.toLowerCase()}-${category.toLowerCase().replace(/\s+/g, '-')}`;
      
      /** @type {MarketplaceTemplate} */
      const marketplaceTemplate = {
        template: {
          ...template,
          id: templateId
        },
        pricing: {
          tier: template.complianceLevel === 'Enterprise' ? 'Enterprise' : 'Pro',
          price: this.suggestPrice(template),
          billingPeriod: 'One-time'
        },
        author: {
          name: 'Compliance Templates Inc',
          organization: 'Legal Compliance Associates',
          credentials: ['JD', 'CIPP/E', 'CISSP'],
          verified: true
        },
        reviews: this.generateSampleReviews(),
        downloads: Math.floor(Math.random() * 5000) + 100,
        successRate: 95 + Math.floor(Math.random() * 5),
        supportLevel: 'Professional'
      };

      this.templates.set(templateId, marketplaceTemplate);
    } catch (error) {
      console.error(`Error loading template from ${categoryPath}:`, error);
    }
  }

  /**
   * @private
   */
  parseTemplateFromPrompt(content, regulation, category) {
    /** @type {ComplianceTemplate} */
    return {
      id: '',
      name: `${regulation} ${category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
      regulation,
      jurisdiction: this.getJurisdictionByRegulation(regulation),
      complianceLevel: 'Standard',
      industryVertical: ['Healthcare', 'Financial', 'E-commerce'],
      auditTrail: true,
      riskAssessment: 'High',
      legalReview: true,
      updateFrequency: 'Quarterly',
      version: '1.0.0',
      lastUpdated: new Date(),
      certificationStatus: 'Certified',
      templatePath: category,
      metadata: {
        regulatoryArticles: this.getArticlesByRegulation(regulation),
        complianceRequirements: [],
        auditCheckpoints: [],
        riskMitigations: [],
        documentationRequired: [],
        automaticValidation: true,
        expertReviewRequired: true
      }
    };
  }

  /**
   * @private
   */
  getJurisdictionByRegulation(regulation) {
    const jurisdictionMap = {
      'GDPR': ['EU', 'UK'],
      'HIPAA': ['US'],
      'SOX': ['US'],
      'PCI-DSS': ['Global'],
      'Basel III': ['Global'],
      'CCPA': ['US'],
      'PIPEDA': ['Canada'],
      'LGPD': ['Brazil']
    };
    
    return jurisdictionMap[regulation] || ['Global'];
  }

  /**
   * @private
   */
  getArticlesByRegulation(regulation) {
    const articleMap = {
      'GDPR': ['Article 5', 'Article 6', 'Article 7', 'Article 17', 'Article 20', 'Article 25'],
      'HIPAA': ['§164.308', '§164.310', '§164.312', '§164.314'],
      'SOX': ['Section 302', 'Section 404', 'Section 409', 'Section 906'],
      'PCI-DSS': ['Requirement 1', 'Requirement 2', 'Requirement 3', 'Requirement 4'],
      'Basel III': ['Pillar I', 'Pillar II', 'Pillar III'],
      'CCPA': ['Section 1798.100', 'Section 1798.105', 'Section 1798.110'],
      'PIPEDA': ['Principle 1', 'Principle 4.1', 'Principle 4.3'],
      'LGPD': ['Article 6', 'Article 7', 'Article 18']
    };
    
    return articleMap[regulation] || [];
  }

  /**
   * @private
   */
  suggestPrice(template) {
    let basePrice = 299; // Base price

    // Adjust for compliance level
    const levelMultiplier = {
      'Basic': 1,
      'Standard': 1.5,
      'Enterprise': 3
    };
    basePrice *= levelMultiplier[template.complianceLevel];

    // Adjust for risk level
    const riskMultiplier = {
      'Low': 1,
      'Medium': 1.2,
      'High': 1.5,
      'Critical': 2
    };
    basePrice *= riskMultiplier[template.riskAssessment];

    // Premium for certified templates
    if (template.certificationStatus === 'Certified') {
      basePrice *= 1.3;
    }

    return Math.round(basePrice);
  }

  /**
   * @private
   */
  generateSampleReviews() {
    const reviews = [
      {
        userId: 'user1',
        rating: 5,
        comment: 'Excellent compliance template. Saved us months of legal work.',
        date: new Date('2024-01-15')
      },
      {
        userId: 'user2',
        rating: 4,
        comment: 'Very comprehensive and well-documented. Minor customization needed.',
        date: new Date('2024-02-10')
      },
      {
        userId: 'user3',
        rating: 5,
        comment: 'Perfect for our compliance needs. Highly recommended.',
        date: new Date('2024-02-28')
      }
    ];

    return reviews.slice(0, Math.floor(Math.random() * 3) + 1);
  }

  /**
   * @private
   */
  getAverageRating(template) {
    if (template.reviews.length === 0) return 4.5; // Default rating

    const sum = template.reviews.reduce((acc, review) => acc + review.rating, 0);
    return sum / template.reviews.length;
  }

  /**
   * @private
   */
  generateLicenseKey(templateId, orgId, licenseType) {
    const timestamp = Date.now().toString(36);
    const hash = Buffer.from(`${templateId}-${orgId}-${licenseType}`).toString('base64');
    return `CT-${licenseType.toUpperCase()}-${timestamp}-${hash}`.substring(0, 32);
  }

  /**
   * @private
   */
  generateSubmissionId() {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * @private
   */
  calculateCertificationFee(template) {
    let baseFee = 1500;

    // Premium for enterprise templates
    if (template.complianceLevel === 'Enterprise') {
      baseFee *= 2;
    }

    // Premium for high-risk regulations
    if (['HIPAA', 'SOX', 'Basel III'].includes(template.regulation)) {
      baseFee *= 1.5;
    }

    return baseFee;
  }

  /**
   * @private
   */
  async validateTemplateCompliance(template) {
    // Simulate validation
    /** @type {string[]} */
    const errors = [];

    if (!template.name || template.name.length < 3) {
      errors.push('Template name must be at least 3 characters');
    }

    if (!template.metadata.regulatoryArticles.length) {
      errors.push('Must specify relevant regulatory articles');
    }

    if (template.riskAssessment === 'Critical' && !template.legalReview) {
      errors.push('Critical risk templates require legal review');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * @private
   */
  async scheduleLegalReview(submissionId, template) {
    console.log(`Scheduling legal review for submission ${submissionId}`);
    // In production, this would integrate with legal team workflows
  }

  /**
   * @private
   */
  async processPayment(orgId, amount, templateId) {
    console.log(`Processing payment: $${amount} for template ${templateId}`);
    // In production, this would integrate with payment processors
  }

  /**
   * @private
   */
  calculateBundleDiscount(templateCount, orgSize) {
    let discount = 0.1; // Base 10% bundle discount

    // Volume discounts
    if (templateCount >= 5) discount += 0.1;
    if (templateCount >= 10) discount += 0.15;

    // Organization size discounts
    const sizeMultiplier = {
      'small': 1,
      'medium': 1.1,
      'large': 1.2,
      'enterprise': 1.5
    };

    return Math.min(discount * sizeMultiplier[orgSize], 0.5); // Max 50% discount
  }

  /**
   * @private
   */
  async addFeaturedTemplates() {
    // Add high-value enterprise templates
    const featuredTemplates = [
      {
        id: 'gdpr-enterprise-suite',
        name: 'GDPR Enterprise Compliance Suite',
        regulation: 'GDPR',
        price: 5000,
        tier: 'Enterprise'
      },
      {
        id: 'hipaa-healthcare-platform',
        name: 'HIPAA Healthcare Platform Template',
        regulation: 'HIPAA',
        price: 7500,
        tier: 'Enterprise'
      },
      {
        id: 'sox-financial-controls',
        name: 'SOX Financial Controls Framework',
        regulation: 'SOX',
        price: 12000,
        tier: 'Enterprise'
      }
    ];

    // Implementation would create full template objects
    console.log('Featured templates initialized:', featuredTemplates.length);
  }

  /**
   * @private
   */
  setupPricingTiers() {
    // Define pricing strategy
    console.log('Pricing tiers configured: Free, Pro, Enterprise');
  }
}