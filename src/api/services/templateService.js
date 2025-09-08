const { promises: fs } = require('fs');
const path = require('path');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

class TemplateService {
  constructor() {
    this.templatesDir = path.join(process.cwd(), 'templates');
    this.templateCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get all available templates with metadata
   */
  async getTemplates(options = {}) {
    try {
      logger.info('Fetching templates', options);

      const templates = await this.loadTemplatesFromDirectory();
      
      // Apply filtering
      let filtered = templates;
      if (options.category) {
        filtered = filtered.filter(t => t.category === options.category);
      }

      // Apply pagination
      const { limit = 20, offset = 0 } = options;
      const paginated = filtered.slice(offset, offset + limit);

      const result = {
        templates: paginated,
        total: filtered.length,
        pagination: {
          limit,
          offset,
          hasMore: offset + limit < filtered.length
        }
      };

      if (options.format === 'list') {
        result.templates = result.templates.map(t => ({
          name: t.name,
          description: t.description,
          category: t.category
        }));
      }

      return result;
    } catch (error) {
      logger.error('Failed to get templates', { error: error.message });
      throw new AppError('Failed to retrieve templates', 500);
    }
  }

  /**
   * Get a specific template by name
   */
  async getTemplate(name) {
    try {
      const templates = await this.loadTemplatesFromDirectory();
      const template = templates.find(t => t.name === name);
      
      if (!template) {
        throw new AppError(`Template '${name}' not found`, 404);
      }

      return template;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get template', { error: error.message, name });
      throw new AppError('Failed to retrieve template', 500);
    }
  }

  /**
   * Load templates from directory with caching
   */
  async loadTemplatesFromDirectory() {
    const cacheKey = 'all_templates';
    const cached = this.templateCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      await this.ensureTemplatesDirectory();
      const templateFiles = await this.findTemplateFiles();
      const templates = await Promise.all(
        templateFiles.map(file => this.loadTemplateFromFile(file))
      );

      // Add built-in templates
      const builtInTemplates = this.getBuiltInTemplates();
      const allTemplates = [...templates, ...builtInTemplates];

      // Cache the result
      this.templateCache.set(cacheKey, {
        data: allTemplates,
        timestamp: Date.now()
      });

      return allTemplates;
    } catch (error) {
      logger.error('Failed to load templates from directory', { error: error.message });
      return this.getBuiltInTemplates(); // Fallback to built-in templates
    }
  }

  /**
   * Ensure templates directory exists
   */
  async ensureTemplatesDirectory() {
    try {
      await fs.access(this.templatesDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(this.templatesDir, { recursive: true });
      await this.createDefaultTemplates();
    }
  }

  /**
   * Find all template files in directory
   */
  async findTemplateFiles() {
    try {
      const files = await fs.readdir(this.templatesDir, { withFileTypes: true });
      return files
        .filter(file => file.isFile() && (file.name.endsWith('.tex') || file.name.endsWith('.json')))
        .map(file => path.join(this.templatesDir, file.name));
    } catch (error) {
      logger.warn('No template files found', { error: error.message });
      return [];
    }
  }

  /**
   * Load template from file
   */
  async loadTemplateFromFile(filePath) {
    try {
      const fileName = path.basename(filePath, path.extname(filePath));
      const content = await fs.readFile(filePath, 'utf-8');
      
      if (filePath.endsWith('.json')) {
        // JSON template with metadata
        return JSON.parse(content);
      } else {
        // Raw LaTeX file
        return {
          name: fileName,
          description: `LaTeX template: ${fileName}`,
          category: 'custom',
          content,
          variables: this.extractVariables(content),
          created: (await fs.stat(filePath)).birthtime,
          source: 'file'
        };
      }
    } catch (error) {
      logger.warn('Failed to load template file', { file: filePath, error: error.message });
      return null;
    }
  }

  /**
   * Extract variables from LaTeX content
   */
  extractVariables(content) {
    const variables = new Set();
    const variablePattern = /\\(?:newcommand|def)(?:\*)?(?:\s*)\{\\(\w+)\}/g;
    const placeholderPattern = /\{\{(\w+)\}\}/g;
    
    let match;
    while ((match = variablePattern.exec(content)) !== null) {
      variables.add(match[1]);
    }
    
    while ((match = placeholderPattern.exec(content)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  /**
   * Get built-in templates
   */
  getBuiltInTemplates() {
    return [
      {
        name: 'article',
        description: 'Basic article template with title, author, and abstract',
        category: 'article',
        content: `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{graphicx}

\\title{{{title}}}
\\author{{{author}}}
\\date{{{date}}}

\\begin{document}

\\maketitle

\\begin{abstract}
{{abstract}}
\\end{abstract}

\\section{Introduction}
{{content}}

\\end{document}`,
        variables: ['title', 'author', 'date', 'abstract', 'content'],
        source: 'builtin'
      },
      {
        name: 'beamer',
        description: 'Presentation template using Beamer class',
        category: 'beamer',
        content: `\\documentclass{beamer}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}

\\title{{{title}}}
\\author{{{author}}}
\\institute{{{institute}}}
\\date{{{date}}}

\\begin{document}

\\frame{\\titlepage}

\\begin{frame}
\\frametitle{{{slide_title}}}
{{slide_content}}
\\end{frame}

\\end{document}`,
        variables: ['title', 'author', 'institute', 'date', 'slide_title', 'slide_content'],
        source: 'builtin'
      },
      {
        name: 'letter',
        description: 'Formal letter template',
        category: 'letter',
        content: `\\documentclass{letter}
\\usepackage[utf8]{inputenc}

\\address{{{sender_address}}}
\\signature{{{sender_name}}}

\\begin{document}

\\begin{letter}{{{recipient_address}}}

\\opening{Dear {{recipient_name}},}

{{letter_body}}

\\closing{{{closing}}}

\\end{letter}
\\end{document}`,
        variables: ['sender_address', 'sender_name', 'recipient_address', 'recipient_name', 'letter_body', 'closing'],
        source: 'builtin'
      },
      {
        name: 'report',
        description: 'Technical report template with chapters',
        category: 'report',
        content: `\\documentclass{report}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{{{title}}}
\\author{{{author}}}
\\date{{{date}}}

\\begin{document}

\\maketitle
\\tableofcontents

\\chapter{Introduction}
{{introduction}}

\\chapter{{{chapter_title}}}
{{chapter_content}}

\\end{document}`,
        variables: ['title', 'author', 'date', 'introduction', 'chapter_title', 'chapter_content'],
        source: 'builtin'
      },
      {
        name: 'book',
        description: 'Book template with parts and chapters',
        category: 'book',
        content: `\\documentclass{book}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{{{title}}}
\\author{{{author}}}
\\date{{{date}}}

\\begin{document}

\\frontmatter
\\maketitle
\\tableofcontents

\\mainmatter

\\part{{{part_title}}}
\\chapter{{{chapter_title}}}
{{chapter_content}}

\\backmatter
\\appendix

\\end{document}`,
        variables: ['title', 'author', 'date', 'part_title', 'chapter_title', 'chapter_content'],
        source: 'builtin'
      }
    ];
  }

  /**
   * Create default template files
   */
  async createDefaultTemplates() {
    try {
      const builtInTemplates = this.getBuiltInTemplates();
      
      for (const template of builtInTemplates) {
        const filePath = path.join(this.templatesDir, `${template.name}.json`);
        await fs.writeFile(filePath, JSON.stringify(template, null, 2));
      }
      
      logger.info('Created default template files', { count: builtInTemplates.length });
    } catch (error) {
      logger.error('Failed to create default templates', { error: error.message });
    }
  }

  /**
   * Clear template cache
   */
  clearCache() {
    this.templateCache.clear();
    logger.info('Template cache cleared');
  }

  /**
   * Add custom template
   */
  async addTemplate(templateData) {
    try {
      const filePath = path.join(this.templatesDir, `${templateData.name}.json`);
      
      // Check if template already exists
      try {
        await fs.access(filePath);
        throw new AppError(`Template '${templateData.name}' already exists`, 409);
      } catch (error) {
        if (error instanceof AppError) throw error;
        // File doesn't exist, proceed
      }

      const template = {
        ...templateData,
        created: new Date().toISOString(),
        source: 'custom'
      };

      await fs.writeFile(filePath, JSON.stringify(template, null, 2));
      this.clearCache(); // Clear cache to reload templates

      logger.info('Template added successfully', { name: templateData.name });
      return template;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to add template', { error: error.message });
      throw new AppError('Failed to add template', 500);
    }
  }
}

module.exports = new TemplateService();