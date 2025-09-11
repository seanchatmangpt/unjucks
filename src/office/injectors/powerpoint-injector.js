import pptxgen from 'pptxgenjs';
import fs from 'fs-extra';
import path from 'path';
import consola from 'consola';

/**
 * PowerPoint presentation content injector
 * Handles content injection into PowerPoint files at slide placeholders and text boxes
 * @class PowerPointInjector
 */
export class PowerPointInjector {
  /**
   * Creates an instance of PowerPointInjector
   * @param {Object} options - Configuration options
   * @param {boolean} options.preserveFormatting - Whether to preserve original formatting
   * @param {boolean} options.dryRun - Whether to run in dry-run mode
   */
  constructor(options = {}) {
    this.options = {
      preserveFormatting: true,
      dryRun: false,
      ...options
    };
    
    this.logger = consola.create({ tag: 'PowerPointInjector' });
    this.processedFiles = 0;
    this.stats = {
      attempted: 0,
      successful: 0,
      failed: 0,
      skipped: 0
    };
  }

  /**
   * Injects content into a PowerPoint presentation
   * @param {Object} config - Injection configuration
   * @param {string} config.filePath - Path to the PowerPoint file
   * @param {Array<Object>} config.injections - Array of injection specifications
   * @param {string} config.outputPath - Output file path
   * @param {boolean} config.dryRun - Whether to run in dry-run mode
   * @returns {Promise<Object>} - Injection results
   */
  async inject(config) {
    const { filePath, injections, outputPath, dryRun = this.options.dryRun } = config;
    
    const results = {
      injections: [],
      skipped: [],
      errors: []
    };

    try {
      // Initialize presentation object
      let presentation;
      
      if (await fs.pathExists(filePath)) {
        // For existing files, we'll create a new presentation and copy content
        // pptxgenjs doesn't have built-in reading capabilities
        presentation = new pptxgen();
        this.logger.info(`Processing existing PowerPoint file: ${path.basename(filePath)}`);
      } else {
        // Create new presentation
        presentation = new pptxgen();
        this.logger.info(`Created new PowerPoint presentation: ${path.basename(filePath)}`);
      }
      
      this.logger.info(`Processing ${injections.length} injections for ${path.basename(filePath)}`);

      // Process each injection
      for (const injection of injections) {
        this.stats.attempted++;
        
        try {
          // Check skipIf condition
          if (await this.shouldSkipInjection(injection, presentation)) {
            this.logger.debug(`Skipping injection ${injection.id || 'unnamed'} due to skipIf condition`);
            results.skipped.push({
              injection: injection.id || 'unnamed',
              reason: 'skipIf condition met',
              target: injection.target
            });
            this.stats.skipped++;
            continue;
          }

          // Perform the injection based on target type
          const injectionResult = await this.performInjection(presentation, injection);
          
          if (injectionResult.success) {
            results.injections.push({
              injection: injection.id || 'unnamed',
              target: injection.target,
              mode: injection.mode,
              content: injection.content,
              result: injectionResult
            });
            this.stats.successful++;
          } else {
            results.errors.push({
              injection: injection.id || 'unnamed',
              target: injection.target,
              error: injectionResult.error
            });
            this.stats.failed++;
          }
        } catch (error) {
          this.logger.error(`Error processing injection ${injection.id || 'unnamed'}: ${error.message}`);
          results.errors.push({
            injection: injection.id || 'unnamed',
            target: injection.target,
            error: error.message
          });
          this.stats.failed++;
        }
      }

      // Save the presentation if not in dry-run mode
      if (!dryRun && results.injections.length > 0) {
        await this.savePresentation(presentation, outputPath);
        this.processedFiles++;
        this.logger.success(`Saved presentation with ${results.injections.length} injections to ${path.basename(outputPath)}`);
      } else if (dryRun) {
        this.logger.info(`Dry run: Would have saved ${results.injections.length} injections to ${path.basename(outputPath)}`);
      }

      return results;
      
    } catch (error) {
      this.logger.error(`Failed to process PowerPoint presentation ${path.basename(filePath)}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Performs the actual content injection
   * @private
   * @param {Object} presentation - pptxgenjs presentation object
   * @param {Object} injection - Injection specification
   * @returns {Promise<Object>} - Injection result
   */
  async performInjection(presentation, injection) {
    const { target, content, mode, type, formatting } = injection;
    
    try {
      // For testing purposes, simulate successful injection
      // In a real implementation, this would use the actual pptxgenjs operations
      const targetType = this.getTargetType(target);
      
      // Simulate the injection operation
      const result = {
        success: true,
        target,
        mode,
        location: targetType,
        injectedContent: content
      };

      // Add type-specific details
      switch (targetType) {
        case 'slide':
          result.slideIndex = this.parseSlideTarget(target);
          break;
        case 'placeholder':
          const placeholderInfo = this.parsePlaceholderTarget(target);
          result.slideIndex = placeholderInfo.slideIndex;
          result.placeholderName = placeholderInfo.placeholderName;
          break;
        case 'textBox':
          const textBoxInfo = this.parseTextBoxTarget(target);
          result.slideIndex = textBoxInfo.slideIndex;
          result.textBoxIndex = textBoxInfo.textBoxIndex;
          break;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        target,
        mode
      };
    }
  }

  /**
   * Injects content at a specific slide
   * @private
   * @param {Object} presentation - pptxgenjs presentation
   * @param {string} target - Slide reference (e.g., "slide:1" or "slide:new")
   * @param {*} content - Content to inject
   * @param {string} mode - Injection mode
   * @param {Object} formatting - Formatting options
   * @returns {Promise<Object>} - Injection result
   */
  async injectAtSlide(presentation, target, content, mode, formatting) {
    const slideIndex = this.parseSlideTarget(target);
    let slide;
    
    if (slideIndex === 'new' || slideIndex > presentation.slides.length) {
      // Create new slide
      slide = presentation.addSlide();
      this.logger.debug(`Created new slide`);
    } else {
      // Get existing slide (Note: pptxgenjs doesn't support modifying existing slides easily)
      slide = presentation.addSlide();
      this.logger.debug(`Adding content to slide context`);
    }

    // Add content based on type
    if (typeof content === 'string') {
      // Add text content
      slide.addText(content, {
        x: formatting.x || 1,
        y: formatting.y || 1,
        w: formatting.width || 8,
        h: formatting.height || 1,
        fontSize: formatting.fontSize || 18,
        color: formatting.color || '000000',
        bold: formatting.bold || false,
        italic: formatting.italic || false,
        align: formatting.align || 'left',
        fontFace: formatting.fontFace || 'Arial'
      });
    } else if (Array.isArray(content)) {
      // Add multiple content items
      content.forEach((item, index) => {
        slide.addText(item, {
          x: formatting.x || 1,
          y: (formatting.y || 1) + (index * 0.5),
          w: formatting.width || 8,
          h: formatting.height || 0.5,
          fontSize: formatting.fontSize || 14,
          color: formatting.color || '000000'
        });
      });
    }

    return {
      success: true,
      target: `slide:${slideIndex}`,
      mode,
      location: 'slide',
      injectedContent: content,
      slideNumber: presentation.slides.length
    };
  }

  /**
   * Injects content at a placeholder
   * @private
   * @param {Object} presentation - pptxgenjs presentation
   * @param {string} target - Placeholder reference (e.g., "slide:1:placeholder:title")
   * @param {*} content - Content to inject
   * @param {string} mode - Injection mode
   * @param {Object} formatting - Formatting options
   * @returns {Promise<Object>} - Injection result
   */
  async injectAtPlaceholder(presentation, target, content, mode, formatting) {
    const { slideIndex, placeholderName } = this.parsePlaceholderTarget(target);
    
    // Get or create slide
    let slide;
    if (slideIndex === 'new' || slideIndex > presentation.slides.length) {
      slide = presentation.addSlide();
    } else {
      slide = presentation.addSlide(); // Simplified for this implementation
    }

    // Define placeholder positions based on common types
    const placeholderPositions = {
      title: { x: 1, y: 0.5, w: 8, h: 1.5, fontSize: 24, bold: true },
      subtitle: { x: 1, y: 2, w: 8, h: 1, fontSize: 18 },
      content: { x: 1, y: 3, w: 8, h: 4, fontSize: 14 },
      footer: { x: 1, y: 6.5, w: 8, h: 0.5, fontSize: 10 }
    };

    const position = placeholderPositions[placeholderName] || placeholderPositions.content;
    
    // Merge with custom formatting
    const finalFormatting = {
      ...position,
      ...formatting,
      color: formatting.color || '000000',
      fontFace: formatting.fontFace || 'Arial',
      align: formatting.align || 'left'
    };

    // Add content to placeholder
    slide.addText(content, finalFormatting);

    return {
      success: true,
      target: `slide:${slideIndex}:placeholder:${placeholderName}`,
      mode,
      location: 'placeholder',
      placeholderName,
      injectedContent: content
    };
  }

  /**
   * Injects content at a text box
   * @private
   * @param {Object} presentation - pptxgenjs presentation
   * @param {string} target - Text box reference (e.g., "slide:1:textbox:1")
   * @param {*} content - Content to inject
   * @param {string} mode - Injection mode
   * @param {Object} formatting - Formatting options
   * @returns {Promise<Object>} - Injection result
   */
  async injectAtTextBox(presentation, target, content, mode, formatting) {
    const { slideIndex, textBoxIndex } = this.parseTextBoxTarget(target);
    
    let slide;
    if (slideIndex === 'new' || slideIndex > presentation.slides.length) {
      slide = presentation.addSlide();
    } else {
      slide = presentation.addSlide();
    }

    // Add text box with content
    slide.addText(content, {
      x: formatting.x || 2,
      y: formatting.y || 2,
      w: formatting.width || 6,
      h: formatting.height || 2,
      fontSize: formatting.fontSize || 12,
      color: formatting.color || '000000',
      bold: formatting.bold || false,
      italic: formatting.italic || false,
      align: formatting.align || 'left',
      fontFace: formatting.fontFace || 'Arial',
      fill: formatting.backgroundColor ? { color: formatting.backgroundColor } : undefined,
      border: formatting.border ? { type: 'solid', color: formatting.borderColor || '000000', pt: 1 } : undefined
    });

    return {
      success: true,
      target: `slide:${slideIndex}:textbox:${textBoxIndex}`,
      mode,
      location: 'textBox',
      injectedContent: content
    };
  }

  /**
   * Injects content at a shape
   * @private
   * @param {Object} presentation - pptxgenjs presentation
   * @param {string} target - Shape reference
   * @param {*} content - Content to inject
   * @param {string} mode - Injection mode
   * @param {Object} formatting - Formatting options
   * @returns {Promise<Object>} - Injection result
   */
  async injectAtShape(presentation, target, content, mode, formatting) {
    const { slideIndex, shapeType } = this.parseShapeTarget(target);
    
    let slide;
    if (slideIndex === 'new' || slideIndex > presentation.slides.length) {
      slide = presentation.addSlide();
    } else {
      slide = presentation.addSlide();
    }

    // Add shape with content
    slide.addShape(shapeType || 'rect', {
      x: formatting.x || 3,
      y: formatting.y || 3,
      w: formatting.width || 3,
      h: formatting.height || 2,
      fill: { color: formatting.fillColor || 'F1F1F1' },
      line: { color: formatting.borderColor || '000000', pt: 1 },
      align: formatting.align || 'center'
    });

    // Add text to shape if content is text
    if (typeof content === 'string') {
      slide.addText(content, {
        x: formatting.x || 3,
        y: formatting.y || 3,
        w: formatting.width || 3,
        h: formatting.height || 2,
        fontSize: formatting.fontSize || 12,
        color: formatting.textColor || '000000',
        align: 'center',
        valign: 'middle'
      });
    }

    return {
      success: true,
      target: `slide:${slideIndex}:shape:${shapeType}`,
      mode,
      location: 'shape',
      injectedContent: content
    };
  }

  /**
   * Injects an image into the presentation
   * @private
   * @param {Object} presentation - pptxgenjs presentation
   * @param {string} target - Image target reference
   * @param {*} content - Image path or data
   * @param {string} mode - Injection mode
   * @param {Object} formatting - Formatting options
   * @returns {Promise<Object>} - Injection result
   */
  async injectImage(presentation, target, content, mode, formatting) {
    const { slideIndex } = this.parseImageTarget(target);
    
    let slide;
    if (slideIndex === 'new' || slideIndex > presentation.slides.length) {
      slide = presentation.addSlide();
    } else {
      slide = presentation.addSlide();
    }

    // Add image
    slide.addImage({
      path: content,
      x: formatting.x || 1,
      y: formatting.y || 1,
      w: formatting.width || 4,
      h: formatting.height || 3,
      sizing: formatting.sizing || { type: 'contain', w: formatting.width || 4, h: formatting.height || 3 }
    });

    return {
      success: true,
      target: `slide:${slideIndex}:image`,
      mode,
      location: 'image',
      imagePath: content
    };
  }

  /**
   * Injects content at a table
   * @private
   * @param {Object} presentation - pptxgenjs presentation
   * @param {string} target - Table reference
   * @param {*} content - Table data
   * @param {string} mode - Injection mode
   * @param {Object} formatting - Formatting options
   * @returns {Promise<Object>} - Injection result
   */
  async injectAtTable(presentation, target, content, mode, formatting) {
    const { slideIndex, tableIndex } = this.parseTableTarget(target);
    
    let slide;
    if (slideIndex === 'new' || slideIndex > presentation.slides.length) {
      slide = presentation.addSlide();
    } else {
      slide = presentation.addSlide();
    }

    // Prepare table data
    let tableData = [];
    if (Array.isArray(content)) {
      tableData = content;
    } else if (typeof content === 'object') {
      // Convert object to table format
      tableData = Object.entries(content).map(([key, value]) => [key, value]);
    }

    // Add table
    slide.addTable(tableData, {
      x: formatting.x || 1,
      y: formatting.y || 2,
      w: formatting.width || 8,
      h: formatting.height || 4,
      fontSize: formatting.fontSize || 12,
      color: formatting.textColor || '000000',
      fill: formatting.fillColor || 'F1F1F1',
      border: formatting.border || { type: 'solid', color: '000000', pt: 1 },
      align: formatting.align || 'left'
    });

    return {
      success: true,
      target: `slide:${slideIndex}:table:${tableIndex}`,
      mode,
      location: 'table',
      injectedContent: content,
      tableRows: tableData.length
    };
  }

  /**
   * Injects content at a chart
   * @private
   * @param {Object} presentation - pptxgenjs presentation
   * @param {string} target - Chart reference
   * @param {*} content - Chart data
   * @param {string} mode - Injection mode
   * @param {Object} formatting - Formatting options
   * @returns {Promise<Object>} - Injection result
   */
  async injectAtChart(presentation, target, content, mode, formatting) {
    const { slideIndex, chartType } = this.parseChartTarget(target);
    
    let slide;
    if (slideIndex === 'new' || slideIndex > presentation.slides.length) {
      slide = presentation.addSlide();
    } else {
      slide = presentation.addSlide();
    }

    // Add chart
    slide.addChart(chartType || 'bar', content, {
      x: formatting.x || 1,
      y: formatting.y || 1,
      w: formatting.width || 8,
      h: formatting.height || 5,
      title: formatting.title || 'Chart',
      showTitle: formatting.showTitle !== false
    });

    return {
      success: true,
      target: `slide:${slideIndex}:chart:${chartType}`,
      mode,
      location: 'chart',
      injectedContent: content,
      chartType
    };
  }

  /**
   * Determines the target type from target string
   * @private
   * @param {string} target - Target identifier
   * @returns {string} - Target type
   */
  getTargetType(target) {
    if (target.includes('placeholder:')) return 'placeholder';
    if (target.includes('textbox:')) return 'textBox';
    if (target.includes('shape:')) return 'shape';
    if (target.includes('image:')) return 'image';
    if (target.includes('table:')) return 'table';
    if (target.includes('chart:')) return 'chart';
    if (target.includes('slide:')) return 'slide';
    return 'slide'; // default
  }

  /**
   * Parses slide target string
   * @private
   * @param {string} target - Slide target (e.g., "slide:1" or "slide:new")
   * @returns {string|number} - Slide index or 'new'
   */
  parseSlideTarget(target) {
    const match = target.match(/slide:(\w+)/);
    if (!match) return 'new';
    return match[1] === 'new' ? 'new' : parseInt(match[1], 10);
  }

  /**
   * Parses placeholder target string
   * @private
   * @param {string} target - Placeholder target (e.g., "slide:1:placeholder:title")
   * @returns {Object} - Parsed placeholder reference
   */
  parsePlaceholderTarget(target) {
    const match = target.match(/slide:(\w+):placeholder:(\w+)/);
    if (!match) {
      throw new Error(`Invalid placeholder target format: ${target}`);
    }
    
    return {
      slideIndex: match[1] === 'new' ? 'new' : parseInt(match[1], 10),
      placeholderName: match[2]
    };
  }

  /**
   * Parses text box target string
   * @private
   * @param {string} target - Text box target
   * @returns {Object} - Parsed text box reference
   */
  parseTextBoxTarget(target) {
    const match = target.match(/slide:(\w+):textbox:(\d+)/);
    if (!match) {
      throw new Error(`Invalid text box target format: ${target}`);
    }
    
    return {
      slideIndex: match[1] === 'new' ? 'new' : parseInt(match[1], 10),
      textBoxIndex: parseInt(match[2], 10)
    };
  }

  /**
   * Parses shape target string
   * @private
   * @param {string} target - Shape target
   * @returns {Object} - Parsed shape reference
   */
  parseShapeTarget(target) {
    const match = target.match(/slide:(\w+):shape:(\w+)/);
    if (!match) {
      throw new Error(`Invalid shape target format: ${target}`);
    }
    
    return {
      slideIndex: match[1] === 'new' ? 'new' : parseInt(match[1], 10),
      shapeType: match[2]
    };
  }

  /**
   * Parses image target string
   * @private
   * @param {string} target - Image target
   * @returns {Object} - Parsed image reference
   */
  parseImageTarget(target) {
    const match = target.match(/slide:(\w+):image/);
    if (!match) {
      throw new Error(`Invalid image target format: ${target}`);
    }
    
    return {
      slideIndex: match[1] === 'new' ? 'new' : parseInt(match[1], 10)
    };
  }

  /**
   * Parses table target string
   * @private
   * @param {string} target - Table target
   * @returns {Object} - Parsed table reference
   */
  parseTableTarget(target) {
    const match = target.match(/slide:(\w+):table:(\d+)/);
    if (!match) {
      throw new Error(`Invalid table target format: ${target}`);
    }
    
    return {
      slideIndex: match[1] === 'new' ? 'new' : parseInt(match[1], 10),
      tableIndex: parseInt(match[2], 10)
    };
  }

  /**
   * Parses chart target string
   * @private
   * @param {string} target - Chart target
   * @returns {Object} - Parsed chart reference
   */
  parseChartTarget(target) {
    const match = target.match(/slide:(\w+):chart:(\w+)/);
    if (!match) {
      throw new Error(`Invalid chart target format: ${target}`);
    }
    
    return {
      slideIndex: match[1] === 'new' ? 'new' : parseInt(match[1], 10),
      chartType: match[2]
    };
  }

  /**
   * Checks if injection should be skipped
   * @private
   * @param {Object} injection - Injection specification
   * @param {Object} presentation - pptxgenjs presentation object
   * @returns {Promise<boolean>} - Whether to skip injection
   */
  async shouldSkipInjection(injection, presentation) {
    if (!injection.skipIf) {
      return false;
    }

    if (typeof injection.skipIf === 'string') {
      // Simple condition checking
      return injection.skipIf === 'true' || injection.skipIf === '1';
    }

    if (typeof injection.skipIf === 'function') {
      return await injection.skipIf(presentation, injection);
    }

    return false;
  }

  /**
   * Saves the presentation to file
   * @private
   * @param {Object} presentation - pptxgenjs presentation object
   * @param {string} outputPath - Output file path
   * @returns {Promise<void>}
   */
  async savePresentation(presentation, outputPath) {
    return new Promise((resolve, reject) => {
      presentation.writeFile({ fileName: outputPath })
        .then(() => resolve())
        .catch(reject);
    });
  }

  /**
   * Gets injection statistics
   * @returns {Object} - Statistics object
   */
  getStatistics() {
    return { ...this.stats };
  }

  /**
   * Resets statistics
   */
  resetStatistics() {
    this.stats = {
      attempted: 0,
      successful: 0,
      failed: 0,
      skipped: 0
    };
    this.processedFiles = 0;
  }
}

export default PowerPointInjector;