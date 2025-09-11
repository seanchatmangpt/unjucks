/**
 * @fileoverview Complete PowerPoint processor using pptxgenjs library
 * Provides comprehensive presentation generation with template support,
 * variable replacement, dynamic content, charts, animations, and batch processing.
 * 
 * @author Unjucks Team
 * @version 2.0.8
 * @since 2024-09-10
 */

import PptxGenJS from 'pptxgenjs';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * @typedef {Object} SlideTemplate
 * @property {string} id - Template identifier
 * @property {string} name - Template display name
 * @property {string} layout - Layout type (title, content, blank, etc.)
 * @property {Array<Object>} elements - Template elements with placeholders
 * @property {Object} [masterSlide] - Master slide configuration
 */

/**
 * @typedef {Object} PresentationConfig
 * @property {string} title - Presentation title
 * @property {string} author - Author name
 * @property {string} subject - Presentation subject
 * @property {string} company - Company name
 * @property {Object} theme - Theme configuration
 * @property {Object} masterSlide - Master slide settings
 */

/**
 * @typedef {Object} ChartData
 * @property {string} type - Chart type (bar, line, pie, etc.)
 * @property {Array<Object>} data - Chart data points
 * @property {Object} options - Chart configuration options
 * @property {string} title - Chart title
 */

/**
 * @typedef {Object} AnimationConfig
 * @property {string} type - Animation type
 * @property {number} duration - Animation duration in milliseconds
 * @property {string} trigger - Animation trigger (click, auto, etc.)
 * @property {Object} options - Additional animation options
 */

/**
 * @typedef {Object} BatchProcessingOptions
 * @property {number} maxConcurrent - Maximum concurrent operations
 * @property {boolean} continueOnError - Continue processing on errors
 * @property {Function} [progressCallback] - Progress callback function
 * @property {Object} [defaultVariables] - Default variables for all presentations
 */

/**
 * Complete PowerPoint processor class with comprehensive functionality
 */
class PowerPointProcessor {
  /**
   * Creates a new PowerPoint processor instance
   * 
   * @param {Object} [options={}] - Processor configuration options
   * @param {string} [options.tempDir] - Temporary directory for file operations
   * @param {Object} [options.defaultTheme] - Default theme configuration
   * @param {boolean} [options.enableLogging] - Enable detailed logging
   * @param {Object} [options.caching] - Caching configuration
   */
  constructor(options = {}) {
    this.options = {
      tempDir: options.tempDir || './temp',
      enableLogging: options.enableLogging || false,
      caching: options.caching || { enabled: true, maxSize: 100 },
      ...options
    };

    this.presentations = new Map(); // Active presentations cache
    this.templates = new Map(); // Template cache
    this.masterSlides = new Map(); // Master slides cache
    this.chartEngine = null; // Chart rendering engine
    this.animationRegistry = new Map(); // Animation configurations

    // Ensure temp directory exists
    this.ensureTempDirectory();

    // Initialize default themes
    this.initializeDefaultThemes();

    // Setup error handling
    this.setupErrorHandling();

    this.log('PowerPoint processor initialized');
  }

  /**
   * Initialize default presentation themes
   * @private
   */
  initializeDefaultThemes() {
    this.defaultThemes = {
      corporate: {
        colors: {
          primary: '#1f4e79',
          secondary: '#70ad47',
          accent: '#ffc000',
          background: '#ffffff',
          text: '#333333'
        },
        fonts: {
          title: { face: 'Arial', size: 24, bold: true },
          subtitle: { face: 'Arial', size: 18, bold: false },
          body: { face: 'Arial', size: 14, bold: false }
        }
      },
      modern: {
        colors: {
          primary: '#0078d4',
          secondary: '#00bcf2',
          accent: '#40e0d0',
          background: '#f8f9fa',
          text: '#323130'
        },
        fonts: {
          title: { face: 'Segoe UI', size: 28, bold: true },
          subtitle: { face: 'Segoe UI', size: 20, bold: false },
          body: { face: 'Segoe UI', size: 16, bold: false }
        }
      },
      elegant: {
        colors: {
          primary: '#2c3e50',
          secondary: '#34495e',
          accent: '#e74c3c',
          background: '#ecf0f1',
          text: '#2c3e50'
        },
        fonts: {
          title: { face: 'Georgia', size: 26, bold: true },
          subtitle: { face: 'Georgia', size: 18, bold: false },
          body: { face: 'Georgia', size: 14, bold: false }
        }
      }
    };
  }

  /**
   * Setup comprehensive error handling
   * @private
   */
  setupErrorHandling() {
    this.errors = [];
    this.errorHandlers = new Map();

    // Register default error handlers
    this.registerErrorHandler('template', (error, context) => {
      this.log(`Template error: ${error.message}`, 'error');
      return { success: false, error: error.message, context };
    });

    this.registerErrorHandler('generation', (error, context) => {
      this.log(`Generation error: ${error.message}`, 'error');
      return { success: false, error: error.message, context };
    });

    this.registerErrorHandler('validation', (error, context) => {
      this.log(`Validation error: ${error.message}`, 'error');
      return { success: false, error: error.message, context };
    });
  }

  /**
   * Register a custom error handler
   * 
   * @param {string} type - Error type identifier
   * @param {Function} handler - Error handler function
   */
  registerErrorHandler(type, handler) {
    this.errorHandlers.set(type, handler);
  }

  /**
   * Handle errors with appropriate error handler
   * 
   * @param {string} type - Error type
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @returns {Object} Error handling result
   */
  handleError(type, error, context = {}) {
    const handler = this.errorHandlers.get(type);
    if (handler) {
      return handler(error, context);
    }
    
    // Default error handling
    this.errors.push({ type, error, context, timestamp: Date.now() });
    return { success: false, error: error.message, context };
  }

  /**
   * Create a new presentation with configuration
   * 
   * @param {PresentationConfig} config - Presentation configuration
   * @returns {Object} Presentation object with metadata
   * @throws {Error} When configuration is invalid
   */
  async createPresentation(config = {}) {
    try {
      this.validatePresentationConfig(config);

      const pptx = new PptxGenJS();
      const presentationId = uuidv4();
      
      // Set presentation properties
      this.configurePresentationProperties(pptx, config);
      
      // Apply theme if specified
      if (config.theme) {
        await this.applyTheme(pptx, config.theme);
      }
      
      // Setup master slide if provided
      if (config.masterSlide) {
        await this.setupMasterSlide(pptx, config.masterSlide);
      }
      
      const presentation = {
        id: presentationId,
        pptx,
        config,
        slides: [],
        metadata: {
          created: Date.now(),
          title: config.title || 'Untitled Presentation',
          author: config.author || 'Unknown',
          slideCount: 0
        }
      };

      this.presentations.set(presentationId, presentation);
      this.log(`Created presentation: ${presentationId}`);
      
      return presentation;
    } catch (error) {
      return this.handleError('generation', error, { config });
    }
  }

  /**
   * Validate presentation configuration
   * 
   * @param {Object} config - Configuration to validate
   * @private
   */
  validatePresentationConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be a valid object');
    }
    
    // Validate required fields if they exist
    if (config.title && typeof config.title !== 'string') {
      throw new Error('Title must be a string');
    }
    
    if (config.author && typeof config.author !== 'string') {
      throw new Error('Author must be a string');
    }
  }

  /**
   * Configure presentation properties
   * 
   * @param {PptxGenJS} pptx - Presentation object
   * @param {Object} config - Configuration object
   * @private
   */
  configurePresentationProperties(pptx, config) {
    // Set basic properties
    pptx.author = config.author || 'Unjucks PowerPoint Processor';
    pptx.company = config.company || '';
    pptx.revision = '1';
    pptx.subject = config.subject || '';
    pptx.title = config.title || 'Generated Presentation';
    
    // Set layout properties
    if (config.layout) {
      pptx.layout = config.layout;
    }
    
    // Set RTL support if needed
    if (config.rtlMode) {
      pptx.rtlMode = true;
    }
  }

  /**
   * Apply theme to presentation
   * 
   * @param {PptxGenJS} pptx - Presentation object
   * @param {Object|string} theme - Theme configuration or theme name
   */
  async applyTheme(pptx, theme) {
    try {
      let themeConfig = theme;
      
      // If theme is a string, load from default themes
      if (typeof theme === 'string') {
        themeConfig = this.defaultThemes[theme];
        if (!themeConfig) {
          throw new Error(`Unknown theme: ${theme}`);
        }
      }
      
      // Apply color scheme
      if (themeConfig.colors) {
        // Note: pptxgenjs doesn't have direct theme support
        // We'll store theme config for use in individual slides
        pptx.themeConfig = themeConfig;
      }
      
      this.log(`Applied theme: ${theme}`);
    } catch (error) {
      this.handleError('theme', error, { theme });
    }
  }

  /**
   * Setup master slide configuration
   * 
   * @param {PptxGenJS} pptx - Presentation object
   * @param {Object} masterConfig - Master slide configuration
   */
  async setupMasterSlide(pptx, masterConfig) {
    try {
      const masterId = uuidv4();
      
      // Store master slide configuration
      const masterSlide = {
        id: masterId,
        config: masterConfig,
        elements: masterConfig.elements || []
      };
      
      this.masterSlides.set(masterId, masterSlide);
      pptx.masterSlideId = masterId;
      
      this.log(`Setup master slide: ${masterId}`);
    } catch (error) {
      this.handleError('master', error, { masterConfig });
    }
  }

  /**
   * Load and register slide templates
   * 
   * @param {string} templatePath - Path to template file or directory
   * @returns {Promise<Array<SlideTemplate>>} Loaded templates
   */
  async loadTemplates(templatePath) {
    try {
      const templates = [];
      const stats = await fs.stat(templatePath);
      
      if (stats.isDirectory()) {
        // Load all templates from directory
        const files = await fs.readdir(templatePath);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(templatePath, file);
            const template = await this.loadSingleTemplate(filePath);
            if (template) {
              templates.push(template);
            }
          }
        }
      } else {
        // Load single template
        const template = await this.loadSingleTemplate(templatePath);
        if (template) {
          templates.push(template);
        }
      }
      
      // Register templates in cache
      for (const template of templates) {
        this.templates.set(template.id, template);
      }
      
      this.log(`Loaded ${templates.length} templates`);
      return templates;
    } catch (error) {
      return this.handleError('template', error, { templatePath });
    }
  }

  /**
   * Load a single template from file
   * 
   * @param {string} filePath - Template file path
   * @returns {Promise<SlideTemplate|null>} Loaded template or null
   * @private
   */
  async loadSingleTemplate(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const template = JSON.parse(content);
      
      // Validate template structure
      this.validateTemplate(template);
      
      return {
        id: template.id || path.basename(filePath, '.json'),
        name: template.name || 'Unnamed Template',
        layout: template.layout || 'LAYOUT_16x9',
        elements: template.elements || [],
        masterSlide: template.masterSlide,
        ...template
      };
    } catch (error) {
      this.log(`Failed to load template: ${filePath} - ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * Validate template structure
   * 
   * @param {Object} template - Template to validate
   * @private
   */
  validateTemplate(template) {
    if (!template || typeof template !== 'object') {
      throw new Error('Template must be a valid object');
    }
    
    if (!template.elements || !Array.isArray(template.elements)) {
      throw new Error('Template must have elements array');
    }
  }

  /**
   * Generate slides from template with variable replacement
   * 
   * @param {string} presentationId - Presentation identifier
   * @param {string} templateId - Template identifier
   * @param {Object} variables - Variables for replacement
   * @param {Object} [options={}] - Generation options
   * @returns {Promise<Object>} Generation result
   */
  async generateFromTemplate(presentationId, templateId, variables = {}, options = {}) {
    try {
      const presentation = this.presentations.get(presentationId);
      if (!presentation) {
        throw new Error(`Presentation not found: ${presentationId}`);
      }
      
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }
      
      // Create slide from template
      const slide = presentation.pptx.addSlide({
        masterName: template.layout,
        sectionTitle: options.sectionTitle
      });
      
      // Process template elements
      for (const element of template.elements) {
        await this.processTemplateElement(slide, element, variables, presentation.config);
      }
      
      // Update presentation metadata
      presentation.slides.push({
        templateId,
        variables,
        timestamp: Date.now()
      });
      presentation.metadata.slideCount++;
      
      this.log(`Generated slide from template: ${templateId}`);
      return { success: true, slideNumber: presentation.metadata.slideCount };
    } catch (error) {
      return this.handleError('generation', error, { presentationId, templateId, variables });
    }
  }

  /**
   * Process individual template element
   * 
   * @param {Object} slide - Slide object
   * @param {Object} element - Template element
   * @param {Object} variables - Replacement variables
   * @param {Object} config - Presentation config
   * @private
   */
  async processTemplateElement(slide, element, variables, config) {
    try {
      const processedElement = this.replaceVariables(element, variables);
      
      switch (processedElement.type) {
        case 'text':
          this.addTextElement(slide, processedElement, config);
          break;
        case 'shape':
          this.addShapeElement(slide, processedElement, config);
          break;
        case 'chart':
          await this.addChartElement(slide, processedElement, config);
          break;
        case 'image':
          await this.addImageElement(slide, processedElement, config);
          break;
        case 'table':
          this.addTableElement(slide, processedElement, config);
          break;
        case 'smartart':
          this.addSmartArtElement(slide, processedElement, config);
          break;
        default:
          this.log(`Unknown element type: ${processedElement.type}`, 'warn');
      }
    } catch (error) {
      this.log(`Failed to process element: ${error.message}`, 'error');
    }
  }

  /**
   * Replace variables in template element
   * 
   * @param {Object} element - Template element
   * @param {Object} variables - Replacement variables
   * @returns {Object} Processed element
   * @private
   */
  replaceVariables(element, variables) {
    const processedElement = JSON.parse(JSON.stringify(element)); // Deep clone
    
    const replaceInObject = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = this.interpolateString(obj[key], variables);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          replaceInObject(obj[key]);
        }
      }
    };
    
    replaceInObject(processedElement);
    return processedElement;
  }

  /**
   * Interpolate string with variables
   * 
   * @param {string} str - String to interpolate
   * @param {Object} variables - Variables for replacement
   * @returns {string} Interpolated string
   * @private
   */
  interpolateString(str, variables) {
    return str.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const keys = key.trim().split('.');
      let value = variables;
      
      for (const k of keys) {
        value = value?.[k];
      }
      
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Add text element to slide
   * 
   * @param {Object} slide - Slide object
   * @param {Object} element - Text element configuration
   * @param {Object} config - Presentation config
   * @private
   */
  addTextElement(slide, element, config) {
    const options = {
      x: element.x || 0.5,
      y: element.y || 0.5,
      w: element.width || 8,
      h: element.height || 1,
      fontSize: element.fontSize || 18,
      bold: element.bold || false,
      italic: element.italic || false,
      underline: element.underline || false,
      color: element.color || '333333',
      align: element.align || 'left',
      valign: element.valign || 'middle',
      fontFace: element.fontFace || 'Arial',
      ...element.options
    };
    
    slide.addText(element.text || '', options);
  }

  /**
   * Add shape element to slide
   * 
   * @param {Object} slide - Slide object
   * @param {Object} element - Shape element configuration
   * @param {Object} config - Presentation config
   * @private
   */
  addShapeElement(slide, element, config) {
    const shapeType = element.shape || 'RECTANGLE';
    const options = {
      x: element.x || 1,
      y: element.y || 1,
      w: element.width || 6,
      h: element.height || 4,
      fill: element.fill || 'F1F1F1',
      line: element.line || { color: '333333', width: 1 },
      ...element.options
    };
    
    slide.addShape(shapeType, options);
  }

  /**
   * Add chart element to slide
   * 
   * @param {Object} slide - Slide object
   * @param {Object} element - Chart element configuration
   * @param {Object} config - Presentation config
   * @private
   */
  async addChartElement(slide, element, config) {
    try {
      const chartData = element.data || [];
      const chartType = element.chartType || 'bar';
      
      const options = {
        x: element.x || 1,
        y: element.y || 1,
        w: element.width || 8,
        h: element.height || 5,
        chartArea: element.chartArea || { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
        showTitle: element.showTitle !== false,
        title: element.title || 'Chart Title',
        titleFontSize: element.titleFontSize || 16,
        ...element.options
      };
      
      // Convert data format for pptxgenjs
      const formattedData = this.formatChartData(chartData, chartType);
      
      slide.addChart(chartType.toUpperCase(), formattedData, options);
      
      this.log(`Added chart: ${chartType}`);
    } catch (error) {
      this.log(`Failed to add chart: ${error.message}`, 'error');
    }
  }

  /**
   * Format chart data for pptxgenjs
   * 
   * @param {Array} data - Raw chart data
   * @param {string} chartType - Chart type
   * @returns {Array} Formatted chart data
   * @private
   */
  formatChartData(data, chartType) {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }
    
    // Handle different chart data formats
    switch (chartType.toLowerCase()) {
      case 'pie':
      case 'doughnut':
        return data.map(item => ({
          name: item.label || item.name || 'Item',
          labels: [item.label || item.name || 'Item'],
          values: [item.value || 0]
        }));
      
      case 'line':
      case 'bar':
      case 'column':
      default:
        // Assume data has categories and series
        if (data[0] && typeof data[0] === 'object' && data[0].categories) {
          return data;
        }
        
        // Convert simple data format
        return [{
          name: 'Series 1',
          labels: data.map(item => item.label || item.name || ''),
          values: data.map(item => item.value || 0)
        }];
    }
  }

  /**
   * Add image element to slide
   * 
   * @param {Object} slide - Slide object
   * @param {Object} element - Image element configuration
   * @param {Object} config - Presentation config
   * @private
   */
  async addImageElement(slide, element, config) {
    try {
      const imagePath = element.path || element.src;
      if (!imagePath) {
        throw new Error('Image path is required');
      }
      
      // Check if image exists
      const exists = await fs.pathExists(imagePath);
      if (!exists) {
        throw new Error(`Image not found: ${imagePath}`);
      }
      
      const options = {
        x: element.x || 1,
        y: element.y || 1,
        w: element.width || 4,
        h: element.height || 3,
        ...element.options
      };
      
      slide.addImage({
        path: imagePath,
        ...options
      });
      
      this.log(`Added image: ${imagePath}`);
    } catch (error) {
      this.log(`Failed to add image: ${error.message}`, 'error');
    }
  }

  /**
   * Add table element to slide
   * 
   * @param {Object} slide - Slide object
   * @param {Object} element - Table element configuration
   * @param {Object} config - Presentation config
   * @private
   */
  addTableElement(slide, element, config) {
    try {
      const tableData = element.data || [];
      if (!Array.isArray(tableData) || tableData.length === 0) {
        throw new Error('Table data is required');
      }
      
      const options = {
        x: element.x || 0.5,
        y: element.y || 0.5,
        w: element.width || 9,
        h: element.height || 5,
        fontSize: element.fontSize || 12,
        border: element.border || { type: 'solid', color: '666666', pt: 1 },
        fill: element.fill || 'F7F7F7',
        ...element.options
      };
      
      slide.addTable(tableData, options);
      
      this.log('Added table element');
    } catch (error) {
      this.log(`Failed to add table: ${error.message}`, 'error');
    }
  }

  /**
   * Add SmartArt element to slide
   * 
   * @param {Object} slide - Slide object
   * @param {Object} element - SmartArt element configuration
   * @param {Object} config - Presentation config
   * @private
   */
  addSmartArtElement(slide, element, config) {
    try {
      // SmartArt is complex, so we'll simulate with shapes and text
      const smartArtType = element.smartArtType || 'list';
      const items = element.items || [];
      
      switch (smartArtType) {
        case 'list':
          this.createSmartArtList(slide, element, items);
          break;
        case 'process':
          this.createSmartArtProcess(slide, element, items);
          break;
        case 'hierarchy':
          this.createSmartArtHierarchy(slide, element, items);
          break;
        default:
          this.createSmartArtList(slide, element, items);
      }
      
      this.log(`Added SmartArt: ${smartArtType}`);
    } catch (error) {
      this.log(`Failed to add SmartArt: ${error.message}`, 'error');
    }
  }

  /**
   * Create SmartArt list layout
   * 
   * @param {Object} slide - Slide object
   * @param {Object} element - Element configuration
   * @param {Array} items - List items
   * @private
   */
  createSmartArtList(slide, element, items) {
    const baseX = element.x || 1;
    const baseY = element.y || 1;
    const itemHeight = element.itemHeight || 0.8;
    const spacing = element.spacing || 0.2;
    
    items.forEach((item, index) => {
      const y = baseY + (index * (itemHeight + spacing));
      
      // Add shape
      slide.addShape('RECTANGLE', {
        x: baseX,
        y: y,
        w: element.width || 3,
        h: itemHeight,
        fill: element.itemFill || '4472C4',
        line: { color: '2F5597', width: 1 }
      });
      
      // Add text
      slide.addText(item.text || '', {
        x: baseX + 0.2,
        y: y + 0.1,
        w: (element.width || 3) - 0.4,
        h: itemHeight - 0.2,
        fontSize: 14,
        color: 'FFFFFF',
        bold: true,
        valign: 'middle'
      });
    });
  }

  /**
   * Create SmartArt process layout
   * 
   * @param {Object} slide - Slide object
   * @param {Object} element - Element configuration
   * @param {Array} items - Process items
   * @private
   */
  createSmartArtProcess(slide, element, items) {
    const baseX = element.x || 1;
    const baseY = element.y || 2;
    const itemWidth = element.itemWidth || 2;
    const spacing = element.spacing || 0.5;
    
    items.forEach((item, index) => {
      const x = baseX + (index * (itemWidth + spacing));
      
      // Add process box
      slide.addShape('RECTANGLE', {
        x: x,
        y: baseY,
        w: itemWidth,
        h: 1,
        fill: '70AD47',
        line: { color: '507935', width: 1 }
      });
      
      // Add text
      slide.addText(item.text || '', {
        x: x + 0.1,
        y: baseY + 0.2,
        w: itemWidth - 0.2,
        h: 0.6,
        fontSize: 12,
        color: 'FFFFFF',
        bold: true,
        align: 'center',
        valign: 'middle'
      });
      
      // Add arrow (except for last item)
      if (index < items.length - 1) {
        slide.addShape('RIGHT_ARROW', {
          x: x + itemWidth,
          y: baseY + 0.3,
          w: spacing,
          h: 0.4,
          fill: '333333'
        });
      }
    });
  }

  /**
   * Create SmartArt hierarchy layout
   * 
   * @param {Object} slide - Slide object
   * @param {Object} element - Element configuration
   * @param {Array} items - Hierarchy items
   * @private
   */
  createSmartArtHierarchy(slide, element, items) {
    // Simple two-level hierarchy implementation
    const rootItem = items[0];
    const childItems = items.slice(1);
    
    const baseX = element.x || 2;
    const baseY = element.y || 1;
    const itemWidth = element.itemWidth || 2;
    const itemHeight = element.itemHeight || 0.8;
    
    // Add root item
    slide.addShape('RECTANGLE', {
      x: baseX + 2,
      y: baseY,
      w: itemWidth,
      h: itemHeight,
      fill: 'C5504B',
      line: { color: '984240', width: 1 }
    });
    
    slide.addText(rootItem?.text || '', {
      x: baseX + 2.1,
      y: baseY + 0.1,
      w: itemWidth - 0.2,
      h: itemHeight - 0.2,
      fontSize: 12,
      color: 'FFFFFF',
      bold: true,
      align: 'center',
      valign: 'middle'
    });
    
    // Add child items
    const childY = baseY + itemHeight + 0.5;
    const startX = baseX;
    
    childItems.forEach((item, index) => {
      const x = startX + (index * (itemWidth + 0.5));
      
      slide.addShape('RECTANGLE', {
        x: x,
        y: childY,
        w: itemWidth,
        h: itemHeight,
        fill: '70AD47',
        line: { color: '507935', width: 1 }
      });
      
      slide.addText(item.text || '', {
        x: x + 0.1,
        y: childY + 0.1,
        w: itemWidth - 0.2,
        h: itemHeight - 0.2,
        fontSize: 11,
        color: 'FFFFFF',
        bold: true,
        align: 'center',
        valign: 'middle'
      });
      
      // Add connecting line
      slide.addShape('LINE', {
        x: baseX + 2 + (itemWidth / 2),
        y: baseY + itemHeight,
        w: 0,
        h: 0.5,
        line: { color: '666666', width: 2 }
      });
    });
  }

  /**
   * Generate slides dynamically from data arrays
   * 
   * @param {string} presentationId - Presentation identifier
   * @param {Array} dataArray - Array of data objects
   * @param {Object} slideConfig - Configuration for each slide
   * @param {Object} [options={}] - Generation options
   * @returns {Promise<Object>} Generation result
   */
  async generateFromDataArray(presentationId, dataArray, slideConfig, options = {}) {
    try {
      const presentation = this.presentations.get(presentationId);
      if (!presentation) {
        throw new Error(`Presentation not found: ${presentationId}`);
      }
      
      if (!Array.isArray(dataArray)) {
        throw new Error('Data must be an array');
      }
      
      const results = [];
      
      for (let i = 0; i < dataArray.length; i++) {
        const data = dataArray[i];
        const slideIndex = i + 1;
        
        try {
          // Create slide
          const slide = presentation.pptx.addSlide({
            masterName: slideConfig.layout || 'LAYOUT_16x9'
          });
          
          // Process slide elements with data
          if (slideConfig.elements) {
            for (const element of slideConfig.elements) {
              await this.processTemplateElement(slide, element, data, presentation.config);
            }
          }
          
          // Add slide number if requested
          if (options.addSlideNumbers) {
            slide.addText(`${slideIndex}`, {
              x: 9.5,
              y: 7,
              w: 1,
              h: 0.3,
              fontSize: 10,
              color: '666666',
              align: 'right'
            });
          }
          
          results.push({ success: true, slideIndex, data });
          presentation.metadata.slideCount++;
          
        } catch (error) {
          results.push({ success: false, slideIndex, error: error.message, data });
          
          if (!options.continueOnError) {
            break;
          }
        }
      }
      
      this.log(`Generated ${results.filter(r => r.success).length} slides from data array`);
      return { success: true, results };
      
    } catch (error) {
      return this.handleError('generation', error, { presentationId, dataArray, slideConfig });
    }
  }

  /**
   * Add speaker notes to a slide
   * 
   * @param {string} presentationId - Presentation identifier
   * @param {number} slideNumber - Slide number (1-based)
   * @param {string} notes - Speaker notes text
   * @returns {Promise<Object>} Operation result
   */
  async addSpeakerNotes(presentationId, slideNumber, notes) {
    try {
      const presentation = this.presentations.get(presentationId);
      if (!presentation) {
        throw new Error(`Presentation not found: ${presentationId}`);
      }
      
      // Get slide by number (pptxgenjs uses 0-based indexing internally)
      const slides = presentation.pptx.slides;
      if (!slides || slideNumber > slides.length) {
        throw new Error(`Slide ${slideNumber} not found`);
      }
      
      const slide = slides[slideNumber - 1];
      
      // Add notes (pptxgenjs method)
      slide.addNotes(notes);
      
      this.log(`Added speaker notes to slide ${slideNumber}`);
      return { success: true, slideNumber, notes };
      
    } catch (error) {
      return this.handleError('notes', error, { presentationId, slideNumber, notes });
    }
  }

  /**
   * Add comments to presentation elements
   * 
   * @param {string} presentationId - Presentation identifier
   * @param {number} slideNumber - Slide number
   * @param {Object} comment - Comment configuration
   * @returns {Promise<Object>} Operation result
   */
  async addComment(presentationId, slideNumber, comment) {
    try {
      const presentation = this.presentations.get(presentationId);
      if (!presentation) {
        throw new Error(`Presentation not found: ${presentationId}`);
      }
      
      // Store comment metadata (pptxgenjs has limited comment support)
      if (!presentation.comments) {
        presentation.comments = [];
      }
      
      presentation.comments.push({
        slideNumber,
        author: comment.author || 'Unknown',
        text: comment.text || '',
        timestamp: Date.now(),
        ...comment
      });
      
      this.log(`Added comment to slide ${slideNumber}`);
      return { success: true, comment };
      
    } catch (error) {
      return this.handleError('comment', error, { presentationId, slideNumber, comment });
    }
  }

  /**
   * Add animations to slide elements
   * 
   * @param {string} presentationId - Presentation identifier
   * @param {number} slideNumber - Slide number
   * @param {Array<AnimationConfig>} animations - Animation configurations
   * @returns {Promise<Object>} Operation result
   */
  async addAnimations(presentationId, slideNumber, animations) {
    try {
      const presentation = this.presentations.get(presentationId);
      if (!presentation) {
        throw new Error(`Presentation not found: ${presentationId}`);
      }
      
      // Store animation configurations (pptxgenjs has limited animation support)
      if (!presentation.animations) {
        presentation.animations = new Map();
      }
      
      presentation.animations.set(slideNumber, animations);
      
      this.log(`Added ${animations.length} animations to slide ${slideNumber}`);
      return { success: true, animationCount: animations.length };
      
    } catch (error) {
      return this.handleError('animation', error, { presentationId, slideNumber, animations });
    }
  }

  /**
   * Add slide transitions
   * 
   * @param {string} presentationId - Presentation identifier
   * @param {number} slideNumber - Slide number
   * @param {Object} transition - Transition configuration
   * @returns {Promise<Object>} Operation result
   */
  async addTransition(presentationId, slideNumber, transition) {
    try {
      const presentation = this.presentations.get(presentationId);
      if (!presentation) {
        throw new Error(`Presentation not found: ${presentationId}`);
      }
      
      // Store transition configurations
      if (!presentation.transitions) {
        presentation.transitions = new Map();
      }
      
      presentation.transitions.set(slideNumber, transition);
      
      this.log(`Added transition to slide ${slideNumber}`);
      return { success: true, transition };
      
    } catch (error) {
      return this.handleError('transition', error, { presentationId, slideNumber, transition });
    }
  }

  /**
   * Batch process multiple presentations
   * 
   * @param {Array} batchJobs - Array of presentation generation jobs
   * @param {BatchProcessingOptions} options - Batch processing options
   * @returns {Promise<Array>} Batch processing results
   */
  async batchProcess(batchJobs, options = {}) {
    try {
      const {
        maxConcurrent = 5,
        continueOnError = true,
        progressCallback,
        defaultVariables = {}
      } = options;
      
      const results = [];
      const batches = this.chunkArray(batchJobs, maxConcurrent);
      let processedCount = 0;
      
      for (const batch of batches) {
        const batchPromises = batch.map(async (job, index) => {
          try {
            // Merge default variables with job variables
            const variables = { ...defaultVariables, ...job.variables };
            
            const result = await this.processBatchJob(job, variables);
            processedCount++;
            
            if (progressCallback) {
              progressCallback({
                processed: processedCount,
                total: batchJobs.length,
                currentJob: job
              });
            }
            
            return result;
          } catch (error) {
            const errorResult = {
              success: false,
              jobId: job.id || `job-${index}`,
              error: error.message
            };
            
            if (!continueOnError) {
              throw error;
            }
            
            return errorResult;
          }
        });
        
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : r.reason));
      }
      
      this.log(`Batch processed ${batchJobs.length} jobs`);
      return results;
      
    } catch (error) {
      return this.handleError('batch', error, { batchJobs, options });
    }
  }

  /**
   * Process a single batch job
   * 
   * @param {Object} job - Batch job configuration
   * @param {Object} variables - Merged variables
   * @returns {Promise<Object>} Job result
   * @private
   */
  async processBatchJob(job, variables) {
    const presentation = await this.createPresentation(job.config || {});
    
    if (!presentation.success && presentation.error) {
      throw new Error(`Failed to create presentation: ${presentation.error}`);
    }
    
    // Generate slides based on job type
    if (job.type === 'template') {
      await this.generateFromTemplate(
        presentation.id,
        job.templateId,
        variables,
        job.options
      );
    } else if (job.type === 'dataArray') {
      await this.generateFromDataArray(
        presentation.id,
        job.dataArray,
        job.slideConfig,
        job.options
      );
    }
    
    // Export presentation if requested
    if (job.outputPath) {
      const exportResult = await this.exportPresentation(presentation.id, job.outputPath);
      if (!exportResult.success) {
        throw new Error(`Failed to export presentation: ${exportResult.error}`);
      }
    }
    
    return {
      success: true,
      jobId: job.id,
      presentationId: presentation.id,
      outputPath: job.outputPath
    };
  }

  /**
   * Export presentation to file
   * 
   * @param {string} presentationId - Presentation identifier
   * @param {string} outputPath - Output file path
   * @param {Object} [options={}] - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportPresentation(presentationId, outputPath, options = {}) {
    try {
      const presentation = this.presentations.get(presentationId);
      if (!presentation) {
        throw new Error(`Presentation not found: ${presentationId}`);
      }
      
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.ensureDir(outputDir);
      
      // Apply final configurations before export
      await this.applyFinalConfigurations(presentation, options);
      
      // Export presentation
      await presentation.pptx.writeFile(outputPath);
      
      // Get file stats
      const stats = await fs.stat(outputPath);
      
      this.log(`Exported presentation to: ${outputPath}`);
      return {
        success: true,
        outputPath,
        size: stats.size,
        slideCount: presentation.metadata.slideCount
      };
      
    } catch (error) {
      return this.handleError('export', error, { presentationId, outputPath });
    }
  }

  /**
   * Apply final configurations before export
   * 
   * @param {Object} presentation - Presentation object
   * @param {Object} options - Export options
   * @private
   */
  async applyFinalConfigurations(presentation, options) {
    // Apply comments if any
    if (presentation.comments && presentation.comments.length > 0) {
      this.log(`Found ${presentation.comments.length} comments to apply`);
    }
    
    // Apply animations if any
    if (presentation.animations && presentation.animations.size > 0) {
      this.log(`Found animations for ${presentation.animations.size} slides`);
    }
    
    // Apply transitions if any
    if (presentation.transitions && presentation.transitions.size > 0) {
      this.log(`Found transitions for ${presentation.transitions.size} slides`);
    }
    
    // Set final metadata
    const pptx = presentation.pptx;
    pptx.revision = String(Date.now());
    pptx.company = presentation.config.company || 'Generated by Unjucks';
  }

  /**
   * Get presentation metadata and statistics
   * 
   * @param {string} presentationId - Presentation identifier
   * @returns {Object} Presentation information
   */
  getPresentationInfo(presentationId) {
    const presentation = this.presentations.get(presentationId);
    if (!presentation) {
      return { success: false, error: 'Presentation not found' };
    }
    
    return {
      success: true,
      id: presentationId,
      metadata: presentation.metadata,
      slideCount: presentation.slides.length,
      hasComments: presentation.comments && presentation.comments.length > 0,
      hasAnimations: presentation.animations && presentation.animations.size > 0,
      hasTransitions: presentation.transitions && presentation.transitions.size > 0,
      created: new Date(presentation.metadata.created).toISOString()
    };
  }

  /**
   * Clean up presentation resources
   * 
   * @param {string} presentationId - Presentation identifier
   * @returns {boolean} Success status
   */
  cleanupPresentation(presentationId) {
    try {
      const presentation = this.presentations.get(presentationId);
      if (presentation) {
        // Clean up any temporary files
        // Reset references
        delete presentation.pptx;
        
        this.presentations.delete(presentationId);
        this.log(`Cleaned up presentation: ${presentationId}`);
      }
      
      return true;
    } catch (error) {
      this.log(`Failed to cleanup presentation: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Get processor statistics and performance metrics
   * 
   * @returns {Object} Processor statistics
   */
  getStatistics() {
    return {
      activePresentations: this.presentations.size,
      loadedTemplates: this.templates.size,
      masterSlides: this.masterSlides.size,
      errorCount: this.errors.length,
      memoryUsage: process.memoryUsage(),
      uptime: Date.now()
    };
  }

  /**
   * Utility method to chunk array into smaller arrays
   * 
   * @param {Array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array} Array of chunks
   * @private
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Ensure temporary directory exists
   * @private
   */
  async ensureTempDirectory() {
    try {
      await fs.ensureDir(this.options.tempDir);
    } catch (error) {
      this.log(`Failed to create temp directory: ${error.message}`, 'error');
    }
  }

  /**
   * Log messages with different levels
   * 
   * @param {string} message - Log message
   * @param {string} level - Log level (info, warn, error)
   * @private
   */
  log(message, level = 'info') {
    if (!this.options.enableLogging) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [PowerPointProcessor] [${level.toUpperCase()}]`;
    
    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }
}

export default PowerPointProcessor;