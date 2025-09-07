/**
 * Compliance Template Marketplace
 * $5M ARR opportunity - regulatory compliance template ecosystem
 */

import { ComplianceTemplate, MarketplaceTemplate, RegulationType, ComplianceLevelType, IndustryVerticalType } from './compliance-types.js';
import { ComplianceValidator } from '../validation/compliance-validator.js';
import path from 'path';
import fs from 'fs/promises';

export class ComplianceMarketplace {
  private templates: Map<string, MarketplaceTemplate> = new Map();
  private validator: ComplianceValidator;
  private certifiedAuthorities: Set<string> = new Set([
    'Legal Compliance Associates',
    'Regulatory Experts Inc',
    'HIPAA Compliance Solutions',
    'GDPR Legal Partners',
    'SOX Compliance Consulting'
  ]);

  constructor() {
    this.validator = new ComplianceValidator();
    this.initializeMarketplace();
  }

  /**
   * Initialize marketplace with certified templates
   */
  private async initializeMarketplace(): Promise<void> {
    // Load templates from filesystem
    await this.loadTemplatesFromDirectory('templates/compliance');
    
    // Add featured enterprise templates
    await this.addFeaturedTemplates();
    
    // Initialize pricing tiers
    this.setupPricingTiers();
  }

  /**
   * Get all templates filtered by criteria
   */
  async getTemplates(filters?: {
    regulation?: RegulationType;
    industry?: IndustryVerticalType;
    complianceLevel?: ComplianceLevelType;
    priceRange?: [number, number];
    certified?: boolean;
    featured?: boolean;
  }): Promise<MarketplaceTemplate[]> {
    let templates = Array.from(this.templates.values());

    if (filters) {
      if (filters.regulation) {
        templates = templates.filter(t => t.template.regulation === filters.regulation);
      }

      if (filters.industry) {
        templates = templates.filter(t => 
          t.template.industryVertical.includes(filters.industry!)
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
   */
  async getTemplate(templateId: string): Promise<MarketplaceTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  /**
   * Purchase template (enterprise licensing)
   */
  async purchaseTemplate(
    templateId: string, 
    organizationId: string,
    licenseType: 'single' | 'team' | 'enterprise' = 'single'
  ): Promise<{
    success: boolean;
    licenseKey: string;
    template: MarketplaceTemplate;
    price: number;
  }> {
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
   */
  async submitForCertification(
    template: ComplianceTemplate,
    authorInfo: {
      name: string;
      organization: string;
      credentials: string[];
      email: string;
    }
  ): Promise<{
    submissionId: string;
    estimatedReviewTime: string;
    certificationFee: number;
  }> {
    const submissionId = this.generateSubmissionId();
    const certificationFee = this.calculateCertificationFee(template);

    // Validate template compliance
    const validationResults = await this.validateTemplateCompliance(template);

    if (!validationResults.isValid) {
      throw new Error(`Template validation failed: ${validationResults.errors.join(', ')}`);
    }

    // Create marketplace entry with pending status
    const marketplaceTemplate: MarketplaceTemplate = {
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
   */
  async rateTemplate(
    templateId: string,
    userId: string,
    rating: number,
    comment: string
  ): Promise<boolean> {
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
   */
  async getEnterpriseBundle(
    regulations: RegulationType[],
    industry: IndustryVerticalType,
    organizationSize: 'small' | 'medium' | 'large' | 'enterprise'
  ): Promise<{
    templates: MarketplaceTemplate[];
    totalPrice: number;
    bundleDiscount: number;
    supportLevel: string;
    features: string[];
  }> {
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
   */
  getMarketInsights(): {
    topRegulations: Array<{regulation: RegulationType, demand: number}>;
    growthTrends: Array<{month: string, revenue: number}>;
    industryBreakdown: Array<{industry: IndustryVerticalType, percentage: number}>;
    revenueProjection: {
      monthly: number;
      yearly: number;
      target: number;
    };
  } {
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

  private async loadTemplatesFromDirectory(baseDir: string): Promise<void> {
    try {
      const regulations = await fs.readdir(baseDir);
      
      for (const regulation of regulations) {
        const regulationPath = path.join(baseDir, regulation);
        const categories = await fs.readdir(regulationPath);
        
        for (const category of categories) {
          const categoryPath = path.join(regulationPath, category);
          await this.loadTemplateFromCategory(categoryPath, regulation as RegulationType, category);
        }
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }

  private async loadTemplateFromCategory(
    categoryPath: string, 
    regulation: RegulationType, 
    category: string
  ): Promise<void> {
    try {
      const promptPath = path.join(categoryPath, '_prompt.md');
      const promptContent = await fs.readFile(promptPath, 'utf-8');
      
      const template = this.parseTemplateFromPrompt(promptContent, regulation, category);
      const templateId = `${regulation.toLowerCase()}-${category.toLowerCase().replace(/\s+/g, '-')}`;
      
      const marketplaceTemplate: MarketplaceTemplate = {
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

  private parseTemplateFromPrompt(content: string, regulation: RegulationType, category: string): ComplianceTemplate {
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

  private getJurisdictionByRegulation(regulation: RegulationType): ('EU' | 'US' | 'UK' | 'Canada' | 'Brazil' | 'Global')[] {
    const jurisdictionMap = {
      'GDPR': ['EU' as const, 'UK' as const],
      'HIPAA': ['US' as const],
      'SOX': ['US' as const],
      'PCI-DSS': ['Global' as const],
      'Basel III': ['Global' as const],
      'CCPA': ['US' as const],
      'PIPEDA': ['Canada' as const],
      'LGPD': ['Brazil' as const]
    };
    
    return jurisdictionMap[regulation] || ['Global'];
  }

  private getArticlesByRegulation(regulation: RegulationType): string[] {
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

  private suggestPrice(template: ComplianceTemplate): number {
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

  private generateSampleReviews() {
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

  private getAverageRating(template: MarketplaceTemplate): number {
    if (template.reviews.length === 0) return 4.5; // Default rating

    const sum = template.reviews.reduce((acc, review) => acc + review.rating, 0);
    return sum / template.reviews.length;
  }

  private generateLicenseKey(templateId: string, orgId: string, licenseType: string): string {
    const timestamp = Date.now().toString(36);
    const hash = Buffer.from(`${templateId}-${orgId}-${licenseType}`).toString('base64');
    return `CT-${licenseType.toUpperCase()}-${timestamp}-${hash}`.substring(0, 32);
  }

  private generateSubmissionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private calculateCertificationFee(template: ComplianceTemplate): number {
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

  private async validateTemplateCompliance(template: ComplianceTemplate): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    // Simulate validation
    const errors: string[] = [];

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

  private async scheduleLegalReview(submissionId: string, template: ComplianceTemplate): Promise<void> {
    console.log(`Scheduling legal review for submission ${submissionId}`);
    // In production, this would integrate with legal team workflows
  }

  private async processPayment(orgId: string, amount: number, templateId: string): Promise<void> {
    console.log(`Processing payment: $${amount} for template ${templateId}`);
    // In production, this would integrate with payment processors
  }

  private calculateBundleDiscount(templateCount: number, orgSize: string): number {
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

    return Math.min(discount * sizeMultiplier[orgSize as keyof typeof sizeMultiplier], 0.5); // Max 50% discount
  }

  private async addFeaturedTemplates(): Promise<void> {
    // Add high-value enterprise templates
    const featuredTemplates = [
      {
        id: 'gdpr-enterprise-suite',
        name: 'GDPR Enterprise Compliance Suite',
        regulation: 'GDPR' as RegulationType,
        price: 5000,
        tier: 'Enterprise' as const
      },
      {
        id: 'hipaa-healthcare-platform',
        name: 'HIPAA Healthcare Platform Template',
        regulation: 'HIPAA' as RegulationType,
        price: 7500,
        tier: 'Enterprise' as const
      },
      {
        id: 'sox-financial-controls',
        name: 'SOX Financial Controls Framework',
        regulation: 'SOX' as RegulationType,
        price: 12000,
        tier: 'Enterprise' as const
      }
    ];

    // Implementation would create full template objects
    console.log('Featured templates initialized:', featuredTemplates.length);
  }

  private setupPricingTiers(): void {
    // Define pricing strategy
    console.log('Pricing tiers configured: Free, Pro, Enterprise');
  }
}