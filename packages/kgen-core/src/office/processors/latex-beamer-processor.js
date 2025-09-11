/**
 * LaTeX-based presentation processor replacing PowerPoint document processing
 * 
 * This module provides comprehensive LaTeX Beamer presentation generation including:
 * - Beamer template processing with Nunjucks
 * - Semantic presentation parsing and generation
 * - PDF compilation via LaTeX engines
 * - Advanced slide layouts and themes
 * - Data-driven slide generation
 * 
 * @module office/processors/latex-beamer-processor
 * @version 2.0.0
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import {
  DocumentType,
  ErrorSeverity
} from '../core/types.js';
import { BaseOfficeProcessor } from '../core/base-processor.js';
import { LaTeXCompiler } from '../../latex/compiler.js';
import { LaTeXParser } from '../../latex/parser.js';
import { LaTeXTemplateRenderer } from '../../latex/renderers/nunjucks.js';
import { LaTeXSyntaxValidator } from '../../latex/validators/syntax.js';

/**
 * LaTeX-based presentation processor implementation
 * 
 * Extends the base processor to provide LaTeX Beamer presentation generation
 * for creating professional presentations, lectures, and slideshows via LaTeX.
 */
export class LaTeXBeamerProcessor extends BaseOfficeProcessor {
  static SUPPORTED_EXTENSIONS = ['.tex', '.latex', '.ltx'];
  static FRONTMATTER_PROPERTY = 'unjucks:frontmatter';

  /**
   * Gets the document type supported by this processor
   * 
   * @returns {string} LaTeX Beamer presentation type
   */
  getSupportedType() {
    return DocumentType.LATEX_PRESENTATION;
  }

  /**
   * Gets supported file extensions
   * 
   * @returns {string[]} Array of supported extensions
   */
  getSupportedExtensions() {
    return [...LaTeXBeamerProcessor.SUPPORTED_EXTENSIONS];
  }

  /**
   * Initialize LaTeX components
   */
  async initialize() {
    if (this.initialized) return;

    this.compiler = new LaTeXCompiler({
      outputDir: this.options.outputDir || './dist/latex-presentations',
      tempDir: this.options.tempDir || './temp/latex-presentations',
      enableSyncTeX: true,
      security: {
        enabled: true,
        strictMode: this.options.strictMode || true
      }
    });

    this.renderer = new LaTeXTemplateRenderer({
      templatesDir: this.options.templatesDir || './templates/latex/beamer'
    });

    this.validator = new LaTeXSyntaxValidator({
      strictMode: this.options.strictMode || true
    });

    await this.compiler.initialize();
    await this.renderer.initialize();

    this.initialized = true;
  }

  /**
   * Loads a LaTeX Beamer template from file path
   * 
   * @param {string} templatePath - Path to the LaTeX template file
   * @returns {Promise<TemplateInfo>} Promise resolving to template info
   */
  async loadTemplate(templatePath) {
    this.logger.debug(`Loading LaTeX Beamer template: ${templatePath}`);
    
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      await fs.access(templatePath, fs.constants.R_OK);
      const stats = await fs.stat(templatePath);
      
      const extension = this.getFileExtension(templatePath);
      if (!this.getSupportedExtensions().includes(extension)) {
        throw new Error(`Unsupported file extension: ${extension}`);
      }
      
      // Read and parse LaTeX content
      const content = await fs.readFile(templatePath, 'utf8');
      const parseResult = this.parseLatexContent(content);
      
      const templateInfo = {
        path: templatePath,
        name: path.basename(templatePath, extension),
        type: DocumentType.LATEX_PRESENTATION,
        size: stats.size,
        lastModified: stats.mtime,
        content,
        parseResult,
        presentationInfo: this.extractPresentationInfo(parseResult)
      };
      
      templateInfo.hash = await this.calculateFileHash(templatePath);
      
      this.logger.info(`LaTeX Beamer template loaded successfully: ${templateInfo.name}`);
      return templateInfo;
      
    } catch (error) {
      this.logger.error(`Failed to load LaTeX Beamer template: ${templatePath}`, error);
      throw new Error(`Failed to load LaTeX Beamer template: ${error.message}`);
    }
  }

  /**
   * Parses frontmatter from LaTeX Beamer template comments
   * 
   * @param {TemplateInfo} template - Template info
   * @returns {Promise<TemplateFrontmatter|null>} Promise resolving to frontmatter or null
   */
  async parseFrontmatter(template) {
    this.logger.debug(`Parsing frontmatter from LaTeX Beamer template: ${template.name}`);
    
    try {
      const content = template.content || await fs.readFile(template.path, 'utf8');
      
      // Look for presentation-specific frontmatter
      const presentationMatch = content.match(/^%\\s*PRESENTATION-CONFIG\\s*:\\s*({[\\s\\S]*?})\\s*$/m);
      if (presentationMatch) {
        try {
          const frontmatter = JSON.parse(presentationMatch[1]);
          this.logger.debug(`Found presentation configuration frontmatter`);
          return frontmatter;
        } catch (jsonError) {
          this.logger.warn(`Failed to parse presentation configuration: ${jsonError.message}`);
        }
      }
      
      // Look for Beamer-specific metadata
      const beamerMatch = content.match(/^%\\s*BEAMER-META\\s*:\\s*({[\\s\\S]*?})\\s*$/m);
      if (beamerMatch) {
        try {
          const frontmatter = JSON.parse(beamerMatch[1]);
          return frontmatter;
        } catch (jsonError) {
          this.logger.warn(`Failed to parse Beamer metadata: ${jsonError.message}`);
        }
      }
      
      // Fallback to standard frontmatter
      const standardMatch = content.match(/^%\\s*---\\s*([\\s\\S]*?)%\\s*---\\s*/m);
      if (standardMatch) {
        const frontmatterYaml = standardMatch[1];
        try {
          const frontmatter = this.parseYamlFrontmatter(frontmatterYaml);
          return frontmatter;
        } catch (yamlError) {
          this.logger.warn(`Failed to parse YAML frontmatter: ${yamlError.message}`);
        }
      }
      
      return null;
      
    } catch (error) {
      this.logger.warn(`Failed to parse frontmatter: ${error.message}`);
      return null;
    }
  }

  /**
   * Extracts variables from LaTeX Beamer template content
   * 
   * @param {TemplateInfo} template - Template info
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   * @returns {Promise<VariableLocation[]>} Promise resolving to variable locations
   */
  async extractVariables(template, frontmatter) {
    this.logger.debug(`Extracting variables from LaTeX Beamer template: ${template.name}`);
    
    try {
      const content = template.content || await fs.readFile(template.path, 'utf8');
      const variables = this.extractNunjucksVariables(content);
      
      // Add presentation-specific variable extraction
      const slideVariables = this.extractSlideVariables(content);
      variables.push(...slideVariables);
      
      this.logger.info(`Extracted ${variables.length} variables from LaTeX Beamer template`);
      return variables;
      
    } catch (error) {
      this.logger.error(`Failed to extract variables: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract slide-specific variables (loops for slides, items)
   */
  extractSlideVariables(content) {
    const variables = [];
    
    // Extract slide loops
    const slideLoopPattern = /{%\\s*for\\s+(\\w+)\\s+in\\s+([^%]+)\\s*%}/g;
    let match;
    
    while ((match = slideLoopPattern.exec(content)) !== null) {
      variables.push({
        name: match[2].trim(),
        type: 'slide-data',
        loopVariable: match[1],
        position: match.index,
        fullMatch: match[0],
        location: 'slide-loop'
      });
    }
    
    // Extract frame/slide variables
    const framePattern = /{{\\s*([^}]+\\.(title|subtitle|content|author)[^}]*)\\s*}}/g;
    while ((match = framePattern.exec(content)) !== null) {
      variables.push({
        name: match[1].trim(),
        type: 'slide-content',
        contentType: match[2],
        position: match.index,
        fullMatch: match[0],
        location: 'slide-content'
      });
    }
    
    return variables;
  }

  /**
   * Processes the LaTeX Beamer template with provided data
   * 
   * @param {TemplateInfo} template - Template info
   * @param {Object} data - Data for variable replacement
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter
   * @returns {Promise<ProcessingResult>} Promise resolving to processing result
   */
  async processTemplate(template, data, frontmatter) {
    this.logger.debug(`Processing LaTeX Beamer template: ${template.name}`);
    
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Pre-process presentation data
      const processedData = await this.preprocessPresentationData(data, frontmatter);

      // Convert template path to relative path for Nunjucks renderer
      const templatesDir = this.options.templatesDir || './templates/latex';
      const relativePath = path.relative(templatesDir, template.path);
      
      // Render LaTeX Beamer template with Nunjucks
      const renderResult = await this.renderer.render(relativePath, processedData);
      
      // Validate generated LaTeX
      const validationResult = await this.validator.validate(renderResult.content);
      
      // Process injection points if defined
      let finalContent = renderResult.content;
      if (frontmatter?.injectionPoints) {
        finalContent = await this.processInjectionPoints(finalContent, processedData, frontmatter.injectionPoints);
      }
      
      // Parse the generated LaTeX for metadata extraction
      const parseResult = this.parseLatexContent(finalContent);
      
      const result = {
        success: true,
        content: finalContent,
        latexContent: finalContent,
        metadata: this.extractPresentationMetadata(parseResult, processedData),
        stats: this.getStats(),
        validation: validationResult,
        parseResult,
        presentationData: processedData
      };
      
      this.logger.info(`LaTeX Beamer template processed successfully: ${template.name}`);
      return result;
      
    } catch (error) {
      this.incrementErrorCount();
      this.logger.error(`Failed to process LaTeX Beamer template: ${error.message}`);
      
      return {
        success: false,
        stats: this.getStats(),
        validation: {
          valid: false,
          errors: [{
            message: error.message,
            code: 'PROCESSING_ERROR',
            severity: ErrorSeverity.ERROR
          }],
          warnings: []
        }
      };
    }
  }

  /**
   * Pre-process presentation data for LaTeX Beamer generation
   */
  async preprocessPresentationData(data, frontmatter) {
    const processed = { ...data };

    // Process slide data array
    if (data.slides && Array.isArray(data.slides)) {
      processed.slideCount = data.slides.length;
      processed.slides = data.slides.map((slide, index) => ({
        number: index + 1,
        ...slide,
        content: this.preprocessSlideContent(slide.content || ''),
        items: Array.isArray(slide.items) ? slide.items : []
      }));
    }

    // Set presentation metadata
    processed.presentation = {
      title: data.title || 'Presentation',
      subtitle: data.subtitle || '',
      author: data.author || 'Author',
      institute: data.institute || '',
      date: data.date || '\\today',
      theme: data.theme || 'default',
      colortheme: data.colortheme || 'default',
      fonttheme: data.fonttheme || 'default'
    };

    // Add Beamer-specific helpers
    processed.beamerHelpers = {
      escapeLatex: (str) => this.escapeLatexSpecialChars(String(str)),
      formatCode: (code) => `\\texttt{${this.escapeLatexSpecialChars(code)}}`,
      emphasize: (text) => `\\emph{${this.escapeLatexSpecialChars(text)}}`,
      alert: (text) => `\\alert{${this.escapeLatexSpecialChars(text)}}`,
      textbf: (text) => `\\textbf{${this.escapeLatexSpecialChars(text)}}`
    };

    // Generate section structure if not provided
    if (!processed.sections && processed.slides) {
      processed.sections = this.generateSectionStructure(processed.slides);
    }

    return processed;
  }

  /**
   * Preprocess slide content for LaTeX compatibility
   */
  preprocessSlideContent(content) {
    return content
      .replace(/\\n/g, '\n\n') // Convert newlines to paragraph breaks
      .replace(/\\*\\*(.*?)\\*\\*/g, '\\textbf{$1}') // Bold text
      .replace(/\\*(.*?)\\*/g, '\\emph{$1}') // Italic text
      .replace(/`(.*?)`/g, '\\texttt{$1}'); // Code text
  }

  /**
   * Generate section structure from slides
   */
  generateSectionStructure(slides) {
    const sections = [];
    let currentSection = null;

    slides.forEach(slide => {
      if (slide.section && slide.section !== currentSection) {
        sections.push({
          title: slide.section,
          slides: []
        });
        currentSection = slide.section;
      }
      
      if (sections.length > 0) {
        sections[sections.length - 1].slides.push(slide);
      }
    });

    return sections;
  }

  /**
   * Extract presentation information from parsed LaTeX
   */
  extractPresentationInfo(parseResult) {
    const presentationInfo = {
      frames: [],
      totalFrames: 0,
      themes: new Set(),
      sections: []
    };

    if (parseResult.ast) {
      // Find frame environments
      const frameNodes = this.findNodesByType(parseResult.ast, 'environment')
        .filter(node => node.value === 'frame');

      presentationInfo.frames = frameNodes.map(node => ({
        id: node.id,
        semantic: node.semantic
      }));

      presentationInfo.totalFrames = frameNodes.length;

      // Extract sections
      const sectionNodes = this.findNodesByType(parseResult.ast, 'command')
        .filter(node => node.value === 'section');

      presentationInfo.sections = sectionNodes.map(node => ({
        title: node.children?.[0]?.value || 'Untitled Section',
        id: node.id
      }));

      // Find theme usage
      const themeNodes = this.findNodesByType(parseResult.ast, 'command')
        .filter(node => ['usetheme', 'usecolortheme', 'usefonttheme'].includes(node.value));

      themeNodes.forEach(node => {
        if (node.children?.[0]) {
          presentationInfo.themes.add(node.children[0].value);
        }
      });
    }

    return presentationInfo;
  }

  /**
   * Extract metadata from processed presentation
   */
  extractPresentationMetadata(parseResult, presentationData) {
    return {
      title: presentationData.presentation?.title || parseResult.metadata?.title || 'LaTeX Beamer Presentation',
      author: presentationData.presentation?.author || parseResult.metadata?.author || 'Presenter',
      institute: presentationData.presentation?.institute || '',
      date: new Date().toISOString(),
      documentClass: parseResult.metadata?.documentClass || 'beamer',
      slideCount: presentationData.slideCount || 0,
      sectionCount: presentationData.sections?.length || 0,
      theme: presentationData.presentation?.theme || 'default',
      colortheme: presentationData.presentation?.colortheme || 'default',
      packages: this.extractRequiredPackages(parseResult),
      processingTime: parseResult.statistics?.processingTime || 0,
      errors: parseResult.errors?.length || 0,
      warnings: parseResult.warnings?.length || 0
    };
  }

  /**
   * Extract required LaTeX packages from content
   */
  extractRequiredPackages(parseResult) {
    const packages = ['beamer', 'graphicx', 'hyperref', 'url', 'amsmath', 'amsfonts'];
    
    if (parseResult.documentStructure?.preamble) {
      const usedPackages = parseResult.documentStructure.preamble
        .filter(node => node.type === 'command' && node.value === 'usepackage')
        .map(node => node.children?.[0]?.value || 'unknown');
      
      packages.push(...usedPackages);
    }
    
    return [...new Set(packages)];
  }

  /**
   * Escape LaTeX special characters in presentation content
   */
  escapeLatexSpecialChars(str) {
    return str
      .replace(/\\\\/g, '\\textbackslash{}')
      .replace(/\\{/g, '\\{')
      .replace(/\\}/g, '\\}')
      .replace(/\\$/g, '\\$')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/#/g, '\\#')
      .replace(/\\^/g, '\\textasciicircum{}')
      .replace(/_/g, '\\_')
      .replace(/~/g, '\\textasciitilde{}');
  }

  /**
   * Saves the processed LaTeX Beamer document to file and optionally compiles to PDF
   */
  async saveDocument(result, outputPath, options = {}) {
    this.logger.debug(`Saving LaTeX Beamer document to: ${outputPath}`);
    
    try {
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      if (typeof result.content === 'string' || result.latexContent) {
        const content = result.latexContent || result.content;
        await fs.writeFile(outputPath, content, 'utf8');
      } else {
        throw new Error('Invalid document content format for LaTeX Beamer document');
      }
      
      let pdfPath = null;
      
      // Compile to PDF if requested
      if (options.compileToPdf !== false && this.compiler) {
        try {
          const compilationResult = await this.compiler.compile(outputPath);
          if (compilationResult.success) {
            pdfPath = compilationResult.outputPath;
            this.logger.info(`LaTeX Beamer compiled to PDF: ${pdfPath}`);
          }
        } catch (compileError) {
          this.logger.warn(`PDF compilation failed: ${compileError.message}`);
        }
      }
      
      this.logger.info(`LaTeX Beamer document saved successfully: ${outputPath}`);
      return {
        texPath: outputPath,
        pdfPath,
        success: true
      };
      
    } catch (error) {
      this.logger.error(`Failed to save LaTeX Beamer document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate a complete standalone presentation document
   */
  async generateStandalonePresentation(slidesData, options = {}) {
    const {
      theme = 'Madrid',
      colortheme = 'default',
      fonttheme = 'default',
      title = 'Presentation',
      subtitle = '',
      author = 'LaTeX Beamer Generator',
      institute = '',
      date = '\\today'
    } = options;

    // Process the slides data
    const processedData = await this.preprocessPresentationData({ slides: slidesData }, null);
    
    const latexDocument = this.generatePresentationDocument(processedData, {
      theme,
      colortheme,
      fonttheme,
      title,
      subtitle,
      author,
      institute,
      date
    });

    return {
      success: true,
      content: latexDocument,
      latexContent: latexDocument,
      metadata: {
        title,
        subtitle,
        author,
        institute,
        slideCount: processedData.slideCount,
        theme,
        colortheme,
        fonttheme
      }
    };
  }

  /**
   * Generate complete LaTeX Beamer document with slides
   */
  generatePresentationDocument(presentationData, options) {
    const {
      theme,
      colortheme,
      fonttheme,
      title,
      subtitle,
      author,
      institute,
      date
    } = options;

    let latex = `\\documentclass{beamer}\n\n`;
    
    // Add theme configuration
    latex += `\\usetheme{${theme}}\n`;
    if (colortheme !== 'default') {
      latex += `\\usecolortheme{${colortheme}}\n`;
    }
    if (fonttheme !== 'default') {
      latex += `\\usefonttheme{${fonttheme}}\n`;
    }
    
    // Add common packages
    latex += `\\usepackage[utf8]{inputenc}\n`;
    latex += `\\usepackage{graphicx}\n`;
    latex += `\\usepackage{hyperref}\n\n`;
    
    // Title information
    latex += `\\title{${title}}\n`;
    if (subtitle) {
      latex += `\\subtitle{${subtitle}}\n`;
    }
    latex += `\\author{${author}}\n`;
    if (institute) {
      latex += `\\institute{${institute}}\n`;
    }
    latex += `\\date{${date}}\n\n`;
    
    latex += `\\begin{document}\n\n`;
    
    // Title frame
    latex += `\\frame{\\titlepage}\n\n`;
    
    // Table of contents if there are sections
    if (presentationData.sections && presentationData.sections.length > 0) {
      latex += `\\begin{frame}\n`;
      latex += `\\frametitle{Outline}\n`;
      latex += `\\tableofcontents\n`;
      latex += `\\end{frame}\n\n`;
    }
    
    // Generate slides
    if (presentationData.slides && presentationData.slides.length > 0) {
      let currentSection = null;
      
      for (const slide of presentationData.slides) {
        // Add section if changed
        if (slide.section && slide.section !== currentSection) {
          latex += `\\section{${this.escapeLatexSpecialChars(slide.section)}}\n\n`;
          currentSection = slide.section;
        }
        
        // Generate frame
        latex += `\\begin{frame}\n`;
        latex += `\\frametitle{${this.escapeLatexSpecialChars(slide.title || 'Slide')}}\n`;
        
        if (slide.subtitle) {
          latex += `\\framesubtitle{${this.escapeLatexSpecialChars(slide.subtitle)}}\n`;
        }
        
        latex += `\n`;
        
        // Add slide content
        if (slide.content) {
          latex += `${slide.content}\n\n`;
        }
        
        // Add items as itemize list
        if (slide.items && slide.items.length > 0) {
          latex += `\\begin{itemize}\n`;
          for (const item of slide.items) {
            latex += `\\item ${this.escapeLatexSpecialChars(String(item))}\n`;
          }
          latex += `\\end{itemize}\n\n`;
        }
        
        latex += `\\end{frame}\n\n`;
      }
    }
    
    latex += `\\end{document}\n`;
    
    return latex;
  }

  // Utility methods shared with other processors
  parseLatexContent(content) {
    try {
      const parser = new LaTeXParser(content, {
        semanticAnalysis: true,
        strictMode: false
      });
      
      return parser.parse();
      
    } catch (error) {
      this.logger.warn(`LaTeX parsing failed: ${error.message}`);
      return {
        type: 'document',
        ast: null,
        errors: [{ message: error.message, type: 'parse_error' }],
        warnings: [],
        metadata: {}
      };
    }
  }

  extractNunjucksVariables(content) {
    const variables = [];
    const variablePattern = /{{\\s*([^}\\s]+(?:\\.[^}\\s]+)*)\\s*}}/g;
    let match;
    
    while ((match = variablePattern.exec(content)) !== null) {
      const variableName = match[1].trim();
      variables.push({
        name: variableName,
        type: 'nunjucks',
        position: match.index,
        fullMatch: match[0],
        location: 'latex-content'
      });
    }
    
    return variables;
  }

  async processInjectionPoints(content, data, injectionPoints) {
    let processedContent = content;
    
    for (const injectionPoint of injectionPoints) {
      const injectionData = data[injectionPoint.id] || injectionPoint.defaultContent || '';
      
      if (injectionData && injectionPoint.marker) {
        const position = injectionPoint.processing?.position || 'replace';
        
        switch (position) {
          case 'replace':
            processedContent = processedContent.replace(injectionPoint.marker, injectionData);
            break;
          case 'before':
            processedContent = processedContent.replace(injectionPoint.marker, injectionData + injectionPoint.marker);
            break;
          case 'after':
            processedContent = processedContent.replace(injectionPoint.marker, injectionPoint.marker + injectionData);
            break;
        }
        
        this.incrementInjectionCount();
      }
    }
    
    return processedContent;
  }

  parseYamlFrontmatter(yamlContent) {
    const result = {};
    const lines = yamlContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('%')) {
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > 0) {
          const key = trimmed.substring(0, colonIndex).trim();
          let value = trimmed.substring(colonIndex + 1).trim();
          
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          
          if (value === 'true') value = true;
          else if (value === 'false') value = false;
          else if (/^\\d+$/.test(value)) value = parseInt(value);
          else if (/^\\d+\\.\\d+$/.test(value)) value = parseFloat(value);
          
          result[key] = value;
        }
      }
    }
    
    return result;
  }

  findNodesByType(node, type) {
    const results = [];
    
    if (node.type === type) {
      results.push(node);
    }
    
    if (node.children) {
      node.children.forEach(child => {
        results.push(...this.findNodesByType(child, type));
      });
    }
    
    return results;
  }

  async calculateFileHash(filePath) {
    const stats = await fs.stat(filePath);
    return `${stats.size}-${stats.mtime.getTime()}`;
  }
}

// Export both old and new names for compatibility
export const PowerPointProcessor = LaTeXBeamerProcessor;