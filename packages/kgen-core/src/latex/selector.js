/**
 * LaTeX Template Selector - Enhanced for KGEN
 * Provides intelligent template selection for academic papers, reports, and documents
 * Integrated with KGEN's ontology-driven generation system
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Extended template registry for KGEN LaTeX integration
 */
export const LATEX_TEMPLATES = {
  // Academic templates
  'article': {
    name: 'Academic Article',
    description: 'IEEE/ACM style academic paper with proper sectioning',
    file: 'article.tex',
    category: 'academic',
    features: ['Abstract', 'Bibliography', 'Math support', 'Figures/Tables'],
    bestFor: ['Research papers', 'Conference submissions', 'Journal articles'],
    requiredFields: ['title', 'author', 'abstract'],
    optionalFields: ['keywords', 'acknowledgments', 'appendix']
  },
  
  'thesis': {
    name: 'PhD/Masters Thesis',
    description: 'Complete thesis template with chapters and appendices',
    file: 'thesis.tex',
    category: 'academic',
    features: ['Multi-chapter', 'TOC/LOF/LOT', 'Bibliography', 'Index'],
    bestFor: ['PhD thesis', 'Masters thesis', 'Dissertations'],
    requiredFields: ['title', 'author', 'university', 'degree'],
    optionalFields: ['dedication', 'acknowledgments', 'abstract']
  },
  
  'report': {
    name: 'Technical Report',
    description: 'Professional technical report with executive summary',
    file: 'report.tex',
    category: 'professional',
    features: ['Executive summary', 'Sections', 'Appendices', 'References'],
    bestFor: ['Technical reports', 'Project documentation', 'White papers'],
    requiredFields: ['title', 'author', 'summary'],
    optionalFields: ['company', 'date', 'confidential']
  },
  
  'beamer': {
    name: 'Presentation Slides',
    description: 'Beamer presentation template for conferences',
    file: 'beamer.tex',
    category: 'presentation',
    features: ['Slide themes', 'Transitions', 'Math/Code', 'Bibliography'],
    bestFor: ['Conference talks', 'Academic presentations', 'Lectures'],
    requiredFields: ['title', 'author', 'institute'],
    optionalFields: ['date', 'theme', 'colortheme']
  },
  
  // Resume templates (migrated from original)
  'modern-clean': {
    name: 'Modern Clean Resume',
    description: 'ATS-friendly minimalist design with clean lines',
    file: 'modern-clean.tex',
    category: 'resume',
    features: ['ATS-friendly', 'Clean design', 'Easy to scan', 'Professional'],
    bestFor: ['Tech roles', 'Startups', 'Modern companies'],
    requiredFields: ['name', 'email', 'experience'],
    optionalFields: ['phone', 'linkedin', 'github', 'skills']
  },
  
  'professional-classic': {
    name: 'Professional Classic Resume',
    description: 'Traditional format with excellent alignment and readability',
    file: 'professional-classic.tex',
    category: 'resume',
    features: ['Traditional layout', 'Excellent spacing', 'Detailed sections', 'Formal'],
    bestFor: ['Corporate', 'Finance', 'Consulting', 'Traditional industries'],
    requiredFields: ['name', 'email', 'experience'],
    optionalFields: ['phone', 'address', 'objective']
  },
  
  'executive-premium': {
    name: 'Executive Premium Resume',
    description: 'Premium design for senior leadership positions',
    file: 'executive-premium.tex',
    category: 'resume',
    features: ['Executive format', 'Metrics focus', 'Leadership emphasis', 'Premium look'],
    bestFor: ['C-suite', 'Director level', 'Senior management', 'Executive roles'],
    requiredFields: ['name', 'email', 'experience'],
    optionalFields: ['achievements', 'board-positions']
  },
  
  'academic-cv': {
    name: 'Academic CV',
    description: 'Comprehensive CV format for academic and research positions',
    file: 'academic-cv.tex',
    category: 'resume',
    features: ['Publications section', 'Research focus', 'Teaching experience', 'Detailed'],
    bestFor: ['Academia', 'Research', 'PhD positions', 'Postdoc'],
    requiredFields: ['name', 'email', 'education'],
    optionalFields: ['publications', 'grants', 'teaching']
  }
};

/**
 * Enhanced LaTeX Template Selector for KGEN
 */
export class LaTeXTemplateSelector {
  constructor(options = {}) {
    this.templatesDir = options.templatesDir || join(__dirname, 'templates');
    this.defaultTemplate = options.defaultTemplate || 'article';
    this.ontologyEngine = options.ontologyEngine || null;
  }

  /**
   * Intelligent template selection using KGEN ontology
   */
  selectTemplate(context, preferences = {}) {
    // Direct template request
    if (preferences.template && LATEX_TEMPLATES[preferences.template]) {
      return this.validateTemplateSelection(preferences.template, context);
    }

    // Use ontology engine for intelligent selection if available
    if (this.ontologyEngine) {
      return this.ontologyBasedSelection(context, preferences);
    }

    // Fallback to rule-based selection
    return this.ruleBasedSelection(context, preferences);
  }

  /**
   * Ontology-driven template selection
   */
  ontologyBasedSelection(context, preferences) {
    const documentType = this.ontologyEngine.inferDocumentType(context);
    const domain = this.ontologyEngine.inferDomain(context);
    
    // Map ontology concepts to templates
    const conceptTemplateMap = {
      'research-paper': 'article',
      'thesis': 'thesis',
      'technical-report': 'report',
      'presentation': 'beamer',
      'resume': this.selectResumeTemplate(context, preferences),
      'cv': 'academic-cv'
    };
    
    const selectedTemplate = conceptTemplateMap[documentType] || this.defaultTemplate;
    return this.validateTemplateSelection(selectedTemplate, context);
  }

  /**
   * Rule-based template selection (fallback)
   */
  ruleBasedSelection(context, preferences) {
    const { type, domain, length, audience } = context;
    
    // Academic documents
    if (type === 'paper' || domain === 'academic') {
      if (length > 50 || type === 'thesis') {
        return 'thesis';
      }
      return 'article';
    }
    
    // Professional documents
    if (type === 'report' || domain === 'business') {
      return 'report';
    }
    
    // Presentations
    if (type === 'presentation' || type === 'slides') {
      return 'beamer';
    }
    
    // Resumes/CVs
    if (type === 'resume' || type === 'cv') {
      return this.selectResumeTemplate(context, preferences);
    }
    
    return this.defaultTemplate;
  }

  /**
   * Specialized resume template selection
   */
  selectResumeTemplate(context, preferences) {
    const { job, person, industry } = context;
    
    if (!job && !person) {
      return 'professional-classic';
    }
    
    const jobTitle = job?.title?.toLowerCase() || '';
    const seniorityLevel = this.detectSeniority(jobTitle);
    
    if (seniorityLevel === 'executive') {
      return 'executive-premium';
    }
    
    if (jobTitle.includes('professor') || jobTitle.includes('researcher') || 
        jobTitle.includes('phd') || industry === 'academic') {
      return 'academic-cv';
    }
    
    if (preferences.atsOptimized || industry === 'tech' || industry === 'startup') {
      return 'modern-clean';
    }
    
    return 'professional-classic';
  }

  /**
   * Validate template selection against context requirements
   */
  validateTemplateSelection(templateId, context) {
    const template = LATEX_TEMPLATES[templateId];
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    // Check required fields
    const missingFields = template.requiredFields.filter(field => 
      !context[field] && !context.data?.[field]
    );
    
    if (missingFields.length > 0) {
      console.warn(`Template '${templateId}' requires fields: ${missingFields.join(', ')}`);
    }

    return {
      templateId,
      template,
      missingFields,
      recommendations: this.getRecommendations(template, context)
    };
  }

  /**
   * Get template recommendations based on context
   */
  getRecommendations(template, context) {
    const recommendations = [];
    
    if (template.category === 'academic' && !context.bibliography) {
      recommendations.push('Consider adding bibliography for academic documents');
    }
    
    if (template.features.includes('Math support') && !context.mathMode) {
      recommendations.push('Enable math support for mathematical content');
    }
    
    return recommendations;
  }

  /**
   * Detect seniority level from job title
   */
  detectSeniority(jobTitle) {
    const executiveKeywords = ['chief', 'ceo', 'cto', 'cfo', 'vp', 'vice president', 'director', 'head of'];
    const seniorKeywords = ['senior', 'lead', 'principal', 'staff', 'architect'];
    
    const lowerTitle = jobTitle.toLowerCase();
    
    if (executiveKeywords.some(keyword => lowerTitle.includes(keyword))) {
      return 'executive';
    }
    
    if (seniorKeywords.some(keyword => lowerTitle.includes(keyword))) {
      return 'senior';
    }
    
    return 'mid';
  }

  /**
   * Load and process template with enhanced Nunjucks rendering
   */
  async loadTemplate(templateId, context, options = {}) {
    const template = LATEX_TEMPLATES[templateId];
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    const templatePath = join(this.templatesDir, template.file);
    
    try {
      let content = readFileSync(templatePath, 'utf8');
      
      // Enhanced variable substitution with Nunjucks-style processing
      content = await this.renderTemplate(content, context, options);
      
      return {
        content,
        template,
        metadata: {
          templateId,
          generatedAt: this.getDeterministicDate().toISOString(),
          kgenVersion: process.env.KGEN_VERSION || '1.0.0'
        }
      };
    } catch (error) {
      throw new Error(`Failed to load template '${templateId}': ${error.message}`);
    }
  }

  /**
   * Enhanced template rendering with Nunjucks-style processing
   */
  async renderTemplate(templateContent, context, options) {
    // Support for advanced Nunjucks features
    let rendered = templateContent;
    
    // Handle conditionals: {% if condition %} ... {% endif %}
    rendered = this.processConditionals(rendered, context);
    
    // Handle loops: {% for item in items %} ... {% endfor %}
    rendered = this.processLoops(rendered, context);
    
    // Handle variable substitution: {{ variable }}
    rendered = this.processVariables(rendered, context);
    
    // Handle filters: {{ variable | filter }}
    rendered = this.processFilters(rendered, context);
    
    return rendered;
  }

  /**
   * Process conditional blocks
   */
  processConditionals(content, context) {
    const conditionalRegex = /\{%\s*if\s+([^%]+)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g;
    
    return content.replace(conditionalRegex, (match, condition, block) => {
      const conditionValue = this.evaluateCondition(condition.trim(), context);
      return conditionValue ? block : '';
    });
  }

  /**
   * Process loop blocks
   */
  processLoops(content, context) {
    const loopRegex = /\{%\s*for\s+(\w+)\s+in\s+(\w+)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g;
    
    return content.replace(loopRegex, (match, item, collection, block) => {
      const items = context[collection] || [];
      return items.map(itemValue => {
        const itemContext = { ...context, [item]: itemValue };
        return this.processVariables(block, itemContext);
      }).join('');
    });
  }

  /**
   * Process variable substitution
   */
  processVariables(content, context) {
    const variableRegex = /\{\{\s*([^}]+)\s*\}\}/g;
    
    return content.replace(variableRegex, (match, path) => {
      const value = this.getValueByPath(context, path.trim());
      return value !== undefined ? String(value) : '';
    });
  }

  /**
   * Process filters
   */
  processFilters(content, context) {
    const filterRegex = /\{\{\s*([^|]+)\s*\|\s*([^}]+)\s*\}\}/g;
    
    return content.replace(filterRegex, (match, variable, filter) => {
      const value = this.getValueByPath(context, variable.trim());
      const filteredValue = this.applyFilter(value, filter.trim());
      return filteredValue !== undefined ? String(filteredValue) : '';
    });
  }

  /**
   * Evaluate conditional expressions
   */
  evaluateCondition(condition, context) {
    // Simple condition evaluation (can be enhanced)
    const value = this.getValueByPath(context, condition);
    return Boolean(value);
  }

  /**
   * Get value by path from context
   */
  getValueByPath(context, path) {
    const keys = path.split('.');
    let value = context;
    
    for (const key of keys) {
      value = value?.[key];
    }
    
    return value;
  }

  /**
   * Apply filters to values
   */
  applyFilter(value, filter) {
    switch (filter) {
      case 'upper':
        return typeof value === 'string' ? value.toUpperCase() : value;
      case 'lower':
        return typeof value === 'string' ? value.toLowerCase() : value;
      case 'title':
        return typeof value === 'string' ? 
          value.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
          ) : value;
      case 'join':
        return Array.isArray(value) ? value.join(', ') : value;
      case 'length':
        return Array.isArray(value) || typeof value === 'string' ? value.length : 0;
      default:
        return value;
    }
  }

  /**
   * Get template information by ID
   */
  getTemplateInfo(templateId) {
    return LATEX_TEMPLATES[templateId];
  }

  /**
   * List all available templates
   */
  listTemplates(category = null) {
    const templates = Object.entries(LATEX_TEMPLATES)
      .filter(([key, template]) => !category || template.category === category)
      .map(([key, template]) => ({ id: key, ...template }));
    
    return templates;
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory() {
    const categories = {};
    
    Object.entries(LATEX_TEMPLATES).forEach(([key, template]) => {
      if (!categories[template.category]) {
        categories[template.category] = [];
      }
      categories[template.category].push({ id: key, ...template });
    });
    
    return categories;
  }

  /**
   * Search templates by features or keywords
   */
  searchTemplates(query) {
    const lowerQuery = query.toLowerCase();
    
    return Object.entries(LATEX_TEMPLATES)
      .filter(([key, template]) => {
        const searchText = [
          template.name,
          template.description,
          ...template.features,
          ...template.bestFor
        ].join(' ').toLowerCase();
        
        return searchText.includes(lowerQuery);
      })
      .map(([key, template]) => ({ id: key, ...template }));
  }
}

export default LaTeXTemplateSelector;