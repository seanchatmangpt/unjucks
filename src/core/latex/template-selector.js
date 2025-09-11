/**
 * LaTeX Resume Template Selector
 * Provides multiple professional resume templates with proper alignment
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const RESUME_TEMPLATES = {
  'modern-clean': {
    name: 'Modern Clean',
    description: 'ATS-friendly minimalist design with clean lines',
    file: 'modern-clean.tex',
    features: ['ATS-friendly', 'Clean design', 'Easy to scan', 'Professional'],
    bestFor: ['Tech roles', 'Startups', 'Modern companies']
  },
  'professional-classic': {
    name: 'Professional Classic',
    description: 'Traditional format with excellent alignment and readability',
    file: 'professional-classic.tex',
    features: ['Traditional layout', 'Excellent spacing', 'Detailed sections', 'Formal'],
    bestFor: ['Corporate', 'Finance', 'Consulting', 'Traditional industries']
  },
  'executive-premium': {
    name: 'Executive Premium',
    description: 'Premium design for senior leadership positions',
    file: 'executive-premium.tex',
    features: ['Executive format', 'Metrics focus', 'Leadership emphasis', 'Premium look'],
    bestFor: ['C-suite', 'Director level', 'Senior management', 'Executive roles']
  },
  'moderncv-fixed': {
    name: 'ModernCV Fixed',
    description: 'Classic ModernCV with corrected alignment and spacing',
    file: 'moderncv-fixed.tex',
    features: ['ModernCV package', 'Professional icons', 'Color accents', 'Structured'],
    bestFor: ['Academic', 'Research', 'European markets', 'Technical roles']
  },
  'academic-cv': {
    name: 'Academic CV',
    description: 'Comprehensive CV format for academic and research positions',
    file: 'academic-cv.tex',
    features: ['Publications section', 'Research focus', 'Teaching experience', 'Detailed'],
    bestFor: ['Academia', 'Research', 'PhD positions', 'Postdoc']
  },
  'creative-designer': {
    name: 'Creative Designer',
    description: 'Visually appealing template for creative professionals',
    file: 'creative-designer.tex',
    features: ['Visual design', 'Portfolio links', 'Color scheme', 'Modern layout'],
    bestFor: ['Design', 'UX/UI', 'Creative roles', 'Marketing']
  }
};

export class TemplateSelector {
  constructor(options = {}) {
    this.templatesDir = options.templatesDir || join(__dirname, 'templates');
    this.defaultTemplate = options.defaultTemplate || 'professional-classic';
  }

  /**
   * Select best template based on job requirements and user preferences
   */
  selectTemplate(person, job, preferences = {}) {
    // Check if specific template requested
    if (preferences.template && RESUME_TEMPLATES[preferences.template]) {
      return preferences.template;
    }

    // Auto-select based on job title and seniority
    const jobTitle = job.title.toLowerCase();
    const seniorityLevel = this.detectSeniority(jobTitle);
    
    if (seniorityLevel === 'executive') {
      return 'executive-premium';
    }
    
    if (jobTitle.includes('professor') || jobTitle.includes('researcher') || jobTitle.includes('phd')) {
      return 'academic-cv';
    }
    
    if (jobTitle.includes('designer') || jobTitle.includes('ux') || jobTitle.includes('ui') || jobTitle.includes('creative')) {
      return 'creative-designer';
    }
    
    if (preferences.atsOptimized || job.company?.type === 'startup') {
      return 'modern-clean';
    }
    
    // Default to professional classic
    return this.defaultTemplate;
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
   * Load template content with variable substitution
   */
  loadTemplate(templateName, data) {
    const template = RESUME_TEMPLATES[templateName];
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    const templatePath = join(this.templatesDir, template.file);
    let content = readFileSync(templatePath, 'utf8');

    // Simple variable substitution for demonstration
    // In production, this would use Nunjucks rendering
    content = this.substituteVariables(content, data);

    return content;
  }

  /**
   * Substitute template variables
   */
  substituteVariables(template, data) {
    // Replace {{variable}} patterns
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const keys = path.trim().split('.');
      let value = data;
      
      for (const key of keys) {
        // Handle array methods like join(', ')
        if (key.includes('(')) {
          const [method, args] = key.split('(');
          const cleanArgs = args.replace(')', '').replace(/['"]/g, '');
          
          if (method === 'join' && Array.isArray(value)) {
            value = value.join(cleanArgs || ', ');
          } else if (method === 'filter' && Array.isArray(value)) {
            // Simple filter implementation
            value = value;
          } else if (method === 'map' && Array.isArray(value)) {
            // Simple map implementation
            value = value;
          } else if (method === 'charAt' && typeof value === 'string') {
            const index = parseInt(cleanArgs);
            value = value.charAt(index);
          } else if (method === 'toUpperCase' && typeof value === 'string') {
            value = value.toUpperCase();
          } else if (method === 'toLowerCase' && typeof value === 'string') {
            value = value.toLowerCase();
          } else if (method === 'slice') {
            const params = cleanArgs.split(',').map(p => parseInt(p.trim()));
            value = value.slice(...params);
          }
        } else {
          value = value?.[key];
        }
      }
      
      // Handle defaults with ||
      if (path.includes('||')) {
        const [primary, fallback] = path.split('||').map(s => s.trim());
        const primaryValue = this.evaluatePath(data, primary);
        return primaryValue || fallback.replace(/['"]/g, '');
      }
      
      return value !== undefined ? value : '';
    });
  }

  /**
   * Evaluate a property path
   */
  evaluatePath(data, path) {
    const keys = path.split('.');
    let value = data;
    
    for (const key of keys) {
      value = value?.[key];
    }
    
    return value;
  }

  /**
   * Get template information
   */
  getTemplateInfo(templateName) {
    return RESUME_TEMPLATES[templateName];
  }

  /**
   * List all available templates
   */
  listTemplates() {
    return Object.entries(RESUME_TEMPLATES).map(([key, template]) => ({
      id: key,
      ...template
    }));
  }
}

export default TemplateSelector;