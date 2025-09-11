/**
 * KGEN Academic Paper Generation Workflow
 * Complete workflow for generating academic papers, theses, and research documents
 * Integrates with KGEN's ontology system for intelligent document structure
 */

import { LaTeXTemplateRenderer } from '../renderers/nunjucks.js';
import { LaTeXTemplateSelector } from '../selector.js';
import { LaTeXCompiler } from '../compiler.js';
import { LaTeXSyntaxValidator } from '../validators/syntax.js';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { EventEmitter } from 'events';

/**
 * Academic Document Types Configuration
 */
const ACADEMIC_DOCUMENT_TYPES = {
  'research-paper': {
    name: 'Research Paper',
    template: 'article',
    sections: ['abstract', 'introduction', 'related-work', 'methodology', 'results', 'discussion', 'conclusion'],
    requiredFields: ['title', 'author', 'abstract', 'keywords'],
    optionalFields: ['acknowledgments', 'funding'],
    citationStyle: 'ieee',
    mathSupport: true,
    figureSupport: true
  },
  
  'conference-paper': {
    name: 'Conference Paper',
    template: 'article',
    sections: ['abstract', 'introduction', 'background', 'approach', 'evaluation', 'conclusion'],
    requiredFields: ['title', 'author', 'abstract'],
    optionalFields: ['keywords', 'categories'],
    citationStyle: 'acm',
    mathSupport: true,
    figureSupport: true,
    pageLimit: 8
  },
  
  'journal-article': {
    name: 'Journal Article',
    template: 'article',
    sections: ['abstract', 'introduction', 'literature-review', 'methodology', 'results', 'discussion', 'conclusion'],
    requiredFields: ['title', 'author', 'abstract', 'keywords'],
    optionalFields: ['acknowledgments', 'conflicts', 'funding'],
    citationStyle: 'apa',
    mathSupport: true,
    figureSupport: true,
    peerReview: true
  },
  
  'thesis': {
    name: 'Thesis/Dissertation',
    template: 'thesis',
    sections: ['abstract', 'introduction', 'literature-review', 'methodology', 'results', 'discussion', 'conclusion', 'appendices'],
    requiredFields: ['title', 'author', 'university', 'degree', 'advisor'],
    optionalFields: ['committee', 'dedication', 'acknowledgments'],
    citationStyle: 'apa',
    mathSupport: true,
    figureSupport: true,
    multiChapter: true
  },
  
  'technical-report': {
    name: 'Technical Report',
    template: 'report',
    sections: ['executive-summary', 'introduction', 'background', 'analysis', 'recommendations', 'conclusion'],
    requiredFields: ['title', 'author', 'organization', 'date'],
    optionalFields: ['report-number', 'classification'],
    citationStyle: 'ieee',
    mathSupport: false,
    figureSupport: true
  },
  
  'literature-review': {
    name: 'Literature Review',
    template: 'article',
    sections: ['abstract', 'introduction', 'search-methodology', 'findings', 'analysis', 'conclusion'],
    requiredFields: ['title', 'author', 'abstract'],
    optionalFields: ['keywords', 'search-terms'],
    citationStyle: 'apa',
    mathSupport: false,
    figureSupport: true,
    citationHeavy: true
  }
};

/**
 * Academic Paper Generation Workflow
 */
export class AcademicPaperWorkflow extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      outputDir: './dist/academic',
      templatesDir: './templates/latex',
      validateOutput: true,
      autoCompile: false,
      citationValidation: true,
      plagiarismCheck: false,
      ...options
    };
    
    this.renderer = new LaTeXTemplateRenderer({
      templatesDir: this.options.templatesDir,
      validateOutput: this.options.validateOutput
    });
    
    this.selector = new LaTeXTemplateSelector();
    this.compiler = new LaTeXCompiler();
    this.validator = new LaTeXSyntaxValidator();
    
    this.initialized = false;
  }
  
  /**
   * Initialize the workflow
   */
  async initialize() {
    if (this.initialized) return;
    
    await this.renderer.initialize();
    await this.compiler.initialize();
    
    this.initialized = true;
    this.emit('initialized');
  }
  
  /**
   * Generate academic paper
   */
  async generatePaper(paperConfig, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const config = this.validatePaperConfig(paperConfig);
    const workflowOptions = { ...this.options, ...options };
    
    this.emit('generation-started', { config });
    
    try {
      // Analyze paper requirements
      const requirements = await this.analyzePaperRequirements(config);
      
      // Select appropriate template
      const templateSelection = await this.selectTemplate(config, requirements);
      
      // Prepare document context
      const context = await this.prepareDocumentContext(config, requirements, templateSelection);
      
      // Generate document sections
      const sections = await this.generateSections(config, context);
      
      // Render complete document
      const renderedDocument = await this.renderDocument(templateSelection, context, sections);
      
      // Validate document
      const validation = await this.validateDocument(renderedDocument);
      
      // Save document
      const savedDocument = await this.saveDocument(renderedDocument, config, workflowOptions);
      
      // Compile if requested
      let compilationResult = null;
      if (workflowOptions.autoCompile) {
        compilationResult = await this.compileDocument(savedDocument.path);
      }
      
      // Generate auxiliary files
      const auxiliaryFiles = await this.generateAuxiliaryFiles(config, context, workflowOptions);
      
      const result = {
        success: true,
        document: savedDocument,
        validation,
        compilation: compilationResult,
        auxiliaryFiles,
        metadata: {
          paperType: config.type,
          generatedAt: new Date().toISOString(),
          sections: sections.length,
          wordCount: this.estimateWordCount(renderedDocument.content)
        }
      };
      
      this.emit('generation-complete', result);
      return result;
      
    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message,
        config
      };
      
      this.emit('generation-error', errorResult);
      return errorResult;
    }
  }
  
  /**
   * Validate paper configuration
   */
  validatePaperConfig(config) {
    if (!config.type) {
      throw new Error('Paper type is required');
    }
    
    const documentType = ACADEMIC_DOCUMENT_TYPES[config.type];
    if (!documentType) {
      throw new Error(`Unknown paper type: ${config.type}`);
    }
    
    // Check required fields
    const missingFields = documentType.requiredFields.filter(field => 
      !config.data || !config.data[field]
    );
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    return {
      ...config,
      documentType
    };
  }
  
  /**
   * Analyze paper requirements
   */
  async analyzePaperRequirements(config) {
    const { documentType, data } = config;
    
    const requirements = {
      sections: documentType.sections,
      citationStyle: documentType.citationStyle,
      mathSupport: documentType.mathSupport,
      figureSupport: documentType.figureSupport,
      bibliography: data.bibliography || data.references || [],
      figures: data.figures || [],
      tables: data.tables || [],
      equations: data.equations || [],
      pageLimit: documentType.pageLimit,
      multiChapter: documentType.multiChapter,
      citationHeavy: documentType.citationHeavy
    };
    
    // Analyze content complexity
    requirements.complexity = this.analyzeContentComplexity(data);
    
    // Check for specialized packages needed
    requirements.packages = this.determineRequiredPackages(requirements);
    
    return requirements;
  }
  
  /**
   * Analyze content complexity
   */
  analyzeContentComplexity(data) {
    let complexity = 'simple';
    
    // Check for mathematical content
    const mathIndicators = ['equation', 'formula', 'theorem', 'proof'];
    const hasmath = Object.values(data).some(value => {
      if (typeof value === 'string') {
        return mathIndicators.some(indicator => value.toLowerCase().includes(indicator));
      }
      return false;
    });
    
    if (hasmath) complexity = 'mathematical';
    
    // Check for multi-disciplinary content
    const disciplines = ['computer science', 'physics', 'chemistry', 'biology', 'mathematics'];
    const disciplineCount = disciplines.filter(discipline => {
      return Object.values(data).some(value => 
        typeof value === 'string' && value.toLowerCase().includes(discipline)
      );
    }).length;
    
    if (disciplineCount > 2) complexity = 'interdisciplinary';
    
    // Check for large-scale content
    const contentLength = Object.values(data).join(' ').length;
    if (contentLength > 50000) complexity = 'comprehensive';
    
    return complexity;
  }
  
  /**
   * Determine required LaTeX packages
   */
  determineRequiredPackages(requirements) {
    const packages = ['inputenc', 'fontenc', 'babel'];
    
    if (requirements.mathSupport) {
      packages.push('amsmath', 'amsfonts', 'amssymb');
    }
    
    if (requirements.figureSupport) {
      packages.push('graphicx', 'float');
    }
    
    if (requirements.bibliography.length > 0) {
      if (requirements.citationStyle === 'ieee') {
        packages.push('cite');
      } else if (requirements.citationStyle === 'apa') {
        packages.push('natbib');
      } else if (requirements.citationStyle === 'acm') {
        packages.push('natbib');
      }
    }
    
    if (requirements.tables?.length > 0) {
      packages.push('booktabs', 'longtable');
    }
    
    if (requirements.complexity === 'mathematical') {
      packages.push('theorem', 'proof');
    }
    
    if (requirements.pageLimit) {
      packages.push('geometry');
    }
    
    return [...new Set(packages)];
  }
  
  /**
   * Select appropriate template
   */
  async selectTemplate(config, requirements) {
    const context = {
      type: config.documentType.template,
      data: config.data,
      requirements
    };
    
    return this.selector.selectTemplate(context, {
      template: config.documentType.template
    });
  }
  
  /**
   * Prepare document context
   */
  async prepareDocumentContext(config, requirements, templateSelection) {
    const context = {
      // Document metadata
      title: config.data.title,
      author: config.data.author,
      date: config.data.date || new Date().toISOString().split('T')[0],
      
      // Document configuration
      documentClass: templateSelection.template.file.includes('thesis') ? 'book' : 'article',
      fontSize: config.data.fontSize || '12pt',
      paperSize: config.data.paperSize || 'a4paper',
      
      // Content sections
      sections: {},
      
      // Bibliography
      bibliography: requirements.bibliography,
      citationStyle: requirements.citationStyle,
      
      // Packages
      packages: requirements.packages,
      
      // Features
      mathSupport: requirements.mathSupport,
      figureSupport: requirements.figureSupport,
      tableOfContents: config.data.tableOfContents || requirements.multiChapter,
      
      // Academic-specific
      abstract: config.data.abstract,
      keywords: config.data.keywords,
      acknowledgments: config.data.acknowledgments,
      
      // Thesis-specific
      university: config.data.university,
      degree: config.data.degree,
      advisor: config.data.advisor,
      committee: config.data.committee,
      
      // Report-specific
      organization: config.data.organization,
      reportNumber: config.data.reportNumber
    };
    
    return context;
  }
  
  /**
   * Generate document sections
   */
  async generateSections(config, context) {
    const sections = [];
    const { documentType, data } = config;
    
    for (const sectionName of documentType.sections) {
      const sectionContent = data[sectionName] || data.sections?.[sectionName];
      
      if (sectionContent) {
        sections.push({
          name: sectionName,
          title: this.formatSectionTitle(sectionName),
          content: sectionContent,
          level: this.getSectionLevel(sectionName, documentType.multiChapter)
        });
        
        // Add section to context
        context.sections[sectionName] = {
          title: this.formatSectionTitle(sectionName),
          content: sectionContent
        };
      }
    }
    
    return sections;
  }
  
  /**
   * Format section title
   */
  formatSectionTitle(sectionName) {
    return sectionName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  /**
   * Get section level for LaTeX
   */
  getSectionLevel(sectionName, multiChapter = false) {
    const chapterSections = ['introduction', 'literature-review', 'methodology', 'results', 'discussion', 'conclusion'];
    const mainSections = ['abstract', 'background', 'related-work', 'approach', 'evaluation'];
    
    if (multiChapter && chapterSections.includes(sectionName)) {
      return 'chapter';
    } else if (mainSections.includes(sectionName) || chapterSections.includes(sectionName)) {
      return 'section';
    } else {
      return 'subsection';
    }
  }
  
  /**
   * Render complete document
   */
  async renderDocument(templateSelection, context, sections) {
    const templateName = templateSelection.template.file;
    
    return this.renderer.render(templateName, context, {
      validateOutput: this.options.validateOutput
    });
  }
  
  /**
   * Validate document
   */
  async validateDocument(renderedDocument) {
    return this.validator.validate(renderedDocument.content, {
      strictMode: false,
      enableAllRules: true
    });
  }
  
  /**
   * Save document to file
   */
  async saveDocument(renderedDocument, config, options) {
    const filename = this.generateFilename(config);
    const outputPath = join(options.outputDir || this.options.outputDir, filename);
    
    // Ensure output directory exists
    await fs.mkdir(dirname(outputPath), { recursive: true });
    
    // Save document
    await fs.writeFile(outputPath, renderedDocument.content, 'utf8');
    
    return {
      path: outputPath,
      filename,
      content: renderedDocument.content,
      size: Buffer.byteLength(renderedDocument.content, 'utf8')
    };
  }
  
  /**
   * Generate filename for document
   */
  generateFilename(config) {
    const title = config.data.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    
    const timestamp = new Date().toISOString().split('T')[0];
    return `${title}-${timestamp}.tex`;
  }
  
  /**
   * Compile document to PDF
   */
  async compileDocument(documentPath) {
    return this.compiler.compile(documentPath, {
      enableBibtex: true,
      cleanTemp: true
    });
  }
  
  /**
   * Generate auxiliary files
   */
  async generateAuxiliaryFiles(config, context, options) {
    const files = [];
    
    // Generate bibliography file if needed
    if (context.bibliography && context.bibliography.length > 0) {
      const bibFile = await this.generateBibliographyFile(config, context, options);
      files.push(bibFile);
    }
    
    // Generate README file
    if (options.generateReadme !== false) {
      const readmeFile = await this.generateReadmeFile(config, context, options);
      files.push(readmeFile);
    }
    
    return files;
  }
  
  /**
   * Generate bibliography file
   */
  async generateBibliographyFile(config, context, options) {
    const bibliography = context.bibliography;
    let bibContent = '% Generated bibliography file\n\n';
    
    bibliography.forEach(entry => {
      bibContent += this.formatBibliographyEntry(entry);
      bibContent += '\n\n';
    });
    
    const bibFilename = this.generateFilename(config).replace('.tex', '.bib');
    const bibPath = join(options.outputDir || this.options.outputDir, bibFilename);
    
    await fs.writeFile(bibPath, bibContent, 'utf8');
    
    return {
      type: 'bibliography',
      path: bibPath,
      filename: bibFilename,
      entries: bibliography.length
    };
  }
  
  /**
   * Format bibliography entry
   */
  formatBibliographyEntry(entry) {
    const type = entry.type || 'article';
    const key = entry.key || entry.id || 'unknown';
    
    let bibEntry = `@${type}{${key},\n`;
    
    const fields = {
      title: entry.title,
      author: entry.author || entry.authors,
      year: entry.year || entry.date,
      journal: entry.journal,
      booktitle: entry.booktitle,
      publisher: entry.publisher,
      volume: entry.volume,
      number: entry.number,
      pages: entry.pages,
      doi: entry.doi,
      url: entry.url
    };
    
    Object.entries(fields).forEach(([field, value]) => {
      if (value) {
        bibEntry += `  ${field} = {${value}},\n`;
      }
    });
    
    bibEntry += '}';
    return bibEntry;
  }
  
  /**
   * Generate README file
   */
  async generateReadmeFile(config, context, options) {
    const readmeContent = `# ${context.title}

## Document Information

- **Type**: ${config.documentType.name}
- **Author**: ${context.author}
- **Generated**: ${new Date().toISOString()}
- **KGEN Version**: ${process.env.KGEN_VERSION || '1.0.0'}

## Compilation Instructions

\`\`\`bash
# Compile with pdflatex
pdflatex ${this.generateFilename(config)}

# If bibliography is present
bibtex ${this.generateFilename(config).replace('.tex', '')}
pdflatex ${this.generateFilename(config)}
pdflatex ${this.generateFilename(config)}
\`\`\`

## Required Packages

${context.packages.map(pkg => `- ${pkg}`).join('\n')}

## Document Structure

${config.documentType.sections.map(section => `- ${this.formatSectionTitle(section)}`).join('\n')}

---

*Generated by KGEN Academic Paper Workflow*
`;
    
    const readmeFilename = 'README.md';
    const readmePath = join(options.outputDir || this.options.outputDir, readmeFilename);
    
    await fs.writeFile(readmePath, readmeContent, 'utf8');
    
    return {
      type: 'readme',
      path: readmePath,
      filename: readmeFilename
    };
  }
  
  /**
   * Estimate word count
   */
  estimateWordCount(content) {
    // Remove LaTeX commands and count words
    const cleanContent = content
      .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^}]*\})*|\\./g, ' ')
      .replace(/[{}\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleanContent.split(' ').length;
  }
  
  /**
   * Get available document types
   */
  getDocumentTypes() {
    return Object.entries(ACADEMIC_DOCUMENT_TYPES).map(([id, type]) => ({
      id,
      ...type
    }));
  }
  
  /**
   * Generate paper outline
   */
  async generateOutline(paperType, requirements = {}) {
    const documentType = ACADEMIC_DOCUMENT_TYPES[paperType];
    if (!documentType) {
      throw new Error(`Unknown paper type: ${paperType}`);
    }
    
    return {
      type: paperType,
      name: documentType.name,
      sections: documentType.sections.map(section => ({
        name: section,
        title: this.formatSectionTitle(section),
        level: this.getSectionLevel(section, documentType.multiChapter),
        required: true,
        description: this.getSectionDescription(section)
      })),
      requiredFields: documentType.requiredFields,
      optionalFields: documentType.optionalFields,
      features: {
        mathSupport: documentType.mathSupport,
        figureSupport: documentType.figureSupport,
        citationStyle: documentType.citationStyle,
        multiChapter: documentType.multiChapter
      }
    };
  }
  
  /**
   * Get section description
   */
  getSectionDescription(sectionName) {
    const descriptions = {
      'abstract': 'Brief summary of the paper, including objectives, methods, results, and conclusions',
      'introduction': 'Introduction to the topic, problem statement, and paper organization',
      'literature-review': 'Review of existing research and related work',
      'methodology': 'Description of research methods, experimental setup, or approach',
      'results': 'Presentation of research findings and experimental results',
      'discussion': 'Analysis and interpretation of results',
      'conclusion': 'Summary of contributions, limitations, and future work',
      'background': 'Background information and context for the research',
      'related-work': 'Review of related research and comparison with existing work',
      'approach': 'Description of the proposed approach or solution',
      'evaluation': 'Evaluation of the approach through experiments or analysis'
    };
    
    return descriptions[sectionName] || 'Content section';
  }
}

export default AcademicPaperWorkflow;