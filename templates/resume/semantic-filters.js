/**
 * Semantic RDF Data Extraction Filters for Resume Templates
 * Provides Nunjucks filters for extracting and formatting semantic data
 */

module.exports = {
  /**
   * Convert text to URL-friendly slug format
   * @param {string} text - Input text to slugify
   * @returns {string} URL-friendly slug
   */
  slug: (text) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  },

  /**
   * Extract structured data from resume content using RDF-like patterns
   * @param {string} content - Resume content to analyze
   * @param {string} type - Type of data to extract (skills, experience, education)
   * @returns {Array} Extracted structured data
   */
  extractRdfData: (content, type) => {
    const patterns = {
      skills: {
        programming: /(?:programming|languages?|coding):\s*([^.]+)/gi,
        frameworks: /(?:frameworks?|libraries):\s*([^.]+)/gi,
        databases: /(?:databases?|db|storage):\s*([^.]+)/gi,
        tools: /(?:tools?|software|platforms?):\s*([^.]+)/gi
      },
      experience: {
        companies: /(?:at|@)\s+([A-Z][a-zA-Z\s&.,]+?)(?:\s+(?:as|for|in)|\.|$)/g,
        positions: /(?:as|position|role|title):\s*([^.]+)/gi,
        achievements: /(?:achieved|delivered|implemented|led|managed|developed):\s*([^.]+)/gi
      },
      education: {
        degrees: /(?:bachelor|master|phd|doctorate|diploma|certificate)(?:\s+of\s+)?(?:science|arts|engineering|business)?(?:\s+in\s+)?([^.]+)/gi,
        institutions: /(?:university|college|institute|school)(?:\s+of\s+)?([^.]+)/gi,
        years: /(?:graduated|completed|earned)(?:\s+in\s+)?(\d{4})/gi
      }
    };

    if (!patterns[type]) return [];

    const results = [];
    const typePatterns = patterns[type];

    Object.entries(typePatterns).forEach(([category, regex]) => {
      const matches = content.matchAll(regex);
      for (const match of matches) {
        if (match[1]) {
          results.push({
            category,
            value: match[1].trim(),
            context: match[0],
            confidence: calculateConfidence(match[0], category)
          });
        }
      }
    });

    return results.sort((a, b) => b.confidence - a.confidence);
  },

  /**
   * Generate Schema.org structured data for resume sections
   * @param {Object} data - Resume data object
   * @param {string} section - Section type (person, workExperience, education)
   * @returns {Object} Schema.org structured data
   */
  generateSchemaOrg: (data, section) => {
    const schemas = {
      person: {
        "@type": "Person",
        "name": data.name,
        "jobTitle": data.jobTitle,
        "email": data.email,
        "telephone": data.phone,
        "url": data.portfolioUrl,
        "sameAs": [data.linkedinUrl, data.githubUrl].filter(Boolean)
      },
      workExperience: {
        "@type": "WorkExperience",
        "jobTitle": data.position,
        "employer": {
          "@type": "Organization",
          "name": data.company
        },
        "startDate": data.startDate,
        "endDate": data.endDate || "Present",
        "workLocation": data.location,
        "description": data.description
      },
      education: {
        "@type": "EducationalOccupationalCredential",
        "credentialCategory": "degree",
        "name": data.degree,
        "sourceOrganization": {
          "@type": "EducationalOrganization",
          "name": data.institution
        },
        "dateCreated": data.graduationYear
      }
    };

    return schemas[section] || {};
  },

  /**
   * Extract semantic keywords for SEO and job matching
   * @param {string} industry - Industry type
   * @param {string} content - Resume content
   * @returns {Array} Relevant keywords for the industry
   */
  extractSemanticKeywords: (industry, content) => {
    const industryKeywords = {
      software: [
        'javascript', 'python', 'java', 'react', 'node.js', 'docker', 'kubernetes',
        'aws', 'microservices', 'api', 'database', 'full-stack', 'agile', 'ci/cd'
      ],
      'data-science': [
        'machine learning', 'python', 'r', 'tensorflow', 'pytorch', 'pandas',
        'numpy', 'sql', 'statistics', 'visualization', 'deep learning', 'ai'
      ],
      product: [
        'product management', 'roadmap', 'stakeholder', 'user research', 'analytics',
        'agile', 'scrum', 'strategy', 'market research', 'kpi', 'mvp', 'growth'
      ],
      design: [
        'ux design', 'ui design', 'figma', 'sketch', 'prototyping', 'user research',
        'design systems', 'accessibility', 'interaction design', 'visual design'
      ]
    };

    const keywords = industryKeywords[industry] || [];
    const foundKeywords = [];

    keywords.forEach(keyword => {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      if (regex.test(content)) {
        foundKeywords.push({
          keyword,
          frequency: (content.match(regex) || []).length,
          relevance: calculateKeywordRelevance(keyword, industry)
        });
      }
    });

    return foundKeywords
      .sort((a, b) => b.relevance * b.frequency - a.relevance * a.frequency)
      .slice(0, 10);
  },

  /**
   * Format date for semantic markup
   * @param {string|Date} date - Date to format
   * @param {string} format - Output format (iso, semantic, human)
   * @returns {string} Formatted date
   */
  formatSemanticDate: (date, format = 'iso') => {
    if (!date) return '';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    switch (format) {
      case 'iso':
        return dateObj.toISOString().split('T')[0];
      case 'semantic':
        return dateObj.toISOString();
      case 'human':
        return dateObj.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long' 
        });
      default:
        return dateObj.toString();
    }
  },

  /**
   * Generate RDF triples for resume data
   * @param {Object} data - Resume data
   * @param {string} baseUri - Base URI for the resume
   * @returns {Array} RDF triples
   */
  generateRdfTriples: (data, baseUri = 'https://example.com/resume') => {
    const triples = [];
    const personUri = `${baseUri}#person`;
    
    // Basic person triples
    triples.push({
      subject: personUri,
      predicate: 'rdf:type',
      object: 'foaf:Person'
    });
    
    if (data.name) {
      triples.push({
        subject: personUri,
        predicate: 'foaf:name',
        object: `"${data.name}"`
      });
    }
    
    if (data.email) {
      triples.push({
        subject: personUri,
        predicate: 'foaf:mbox',
        object: `<mailto:${data.email}>`
      });
    }
    
    if (data.jobTitle) {
      triples.push({
        subject: personUri,
        predicate: 'cv:hasJobTitle',
        object: `"${data.jobTitle}"`
      });
    }
    
    return triples;
  },

  /**
   * Validate semantic markup
   * @param {Object} markup - Structured data to validate
   * @param {string} type - Type of markup (schema.org, rdf, json-ld)
   * @returns {Object} Validation results
   */
  validateSemanticMarkup: (markup, type) => {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      score: 100
    };

    if (type === 'schema.org') {
      // Required fields for Person schema
      const requiredFields = ['@type', 'name'];
      requiredFields.forEach(field => {
        if (!markup[field]) {
          validation.errors.push(`Missing required field: ${field}`);
          validation.valid = false;
          validation.score -= 20;
        }
      });

      // Recommended fields
      const recommendedFields = ['email', 'jobTitle', 'url'];
      recommendedFields.forEach(field => {
        if (!markup[field]) {
          validation.warnings.push(`Missing recommended field: ${field}`);
          validation.score -= 5;
        }
      });
    }

    return validation;
  }
};

/**
 * Calculate confidence score for extracted data
 * @private
 */
function calculateConfidence(context, category) {
  let confidence = 0.5; // Base confidence
  
  // Increase confidence based on context indicators
  const indicators = {
    skills: ['proficient', 'experienced', 'expert', 'skilled'],
    experience: ['years', 'led', 'managed', 'achieved'],
    education: ['graduated', 'degree', 'certified', 'completed']
  };
  
  const categoryIndicators = indicators[category] || [];
  categoryIndicators.forEach(indicator => {
    if (context.toLowerCase().includes(indicator)) {
      confidence += 0.1;
    }
  });
  
  return Math.min(confidence, 1.0);
}

/**
 * Calculate keyword relevance for industry
 * @private
 */
function calculateKeywordRelevance(keyword, industry) {
  const relevanceMap = {
    software: {
      'javascript': 0.9,
      'python': 0.8,
      'react': 0.9,
      'node.js': 0.8,
      'docker': 0.7,
      'aws': 0.8
    },
    'data-science': {
      'machine learning': 0.9,
      'python': 0.9,
      'tensorflow': 0.8,
      'statistics': 0.8
    }
  };
  
  return relevanceMap[industry]?.[keyword.toLowerCase()] || 0.5;
}