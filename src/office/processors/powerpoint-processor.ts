/**
 * PowerPoint document processor for Office template processing in Unjucks
 * 
 * This module provides comprehensive PowerPoint document processing capabilities including:
 * - PPTX file reading and writing
 * - Slide template processing with layouts
 * - Text box and shape variable replacement
 * - Speaker notes and comments processing
 * - Dynamic slide generation
 * 
 * @module office/processors/powerpoint-processor
 * @version 1.0.0
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import {
  DocumentType,
  TemplateInfo,
  TemplateFrontmatter,
  ProcessingResult,
  ValidationResult,
  VariableLocation,
  ErrorSeverity,
  InjectionPoint,
  DocumentMetadata
} from '../core/types.js';
import { BaseOfficeProcessor } from '../core/base-processor.js';

/**
 * PowerPoint-specific document structure
 */
interface PowerPointDocument {
  /** Document slides */
  slides: PowerPointSlide[];
  /** Document properties */
  properties: DocumentProperties;
  /** Slide layouts */
  layouts: SlideLayout[];
  /** Master slides */
  masters: SlideMaster[];
  /** Document themes */
  themes: PresentationTheme[];
  /** Custom slide shows */
  customShows: CustomSlideShow[];
}

/**
 * PowerPoint slide structure
 */
interface PowerPointSlide {
  /** Slide ID */
  id: string;
  /** Slide index */
  index: number;
  /** Slide layout reference */
  layout?: string;
  /** Slide title */
  title?: string;
  /** Slide content elements */
  content: SlideElement[];
  /** Speaker notes */
  notes?: string;
  /** Slide transitions */
  transition?: SlideTransition;
  /** Slide animations */
  animations: SlideAnimation[];
  /** Slide comments */
  comments: SlideComment[];
  /** Slide properties */
  properties: SlideProperties;
}

/**
 * Slide element (text box, shape, image, etc.)
 */
interface SlideElement {
  /** Element ID */
  id: string;
  /** Element type */
  type: 'textBox' | 'shape' | 'image' | 'chart' | 'table' | 'video' | 'audio';
  /** Element content */
  content: any;
  /** Element position */
  position: ElementPosition;
  /** Element size */
  size: ElementSize;
  /** Element formatting */
  formatting?: ElementFormatting;
  /** Element animations */
  animations: ElementAnimation[];
}

/**
 * Text box element
 */
interface TextBoxElement extends SlideElement {
  type: 'textBox';
  content: {
    /** Text paragraphs */
    paragraphs: TextParagraph[];
    /** Text box properties */
    properties: TextBoxProperties;
  };
}

/**
 * Shape element
 */
interface ShapeElement extends SlideElement {
  type: 'shape';
  content: {
    /** Shape type */
    shapeType: string;
    /** Shape text (if any) */
    text?: string;
    /** Shape properties */
    properties: ShapeProperties;
  };
}

/**
 * Image element
 */
interface ImageElement extends SlideElement {
  type: 'image';
  content: {
    /** Image source */
    src: string;
    /** Image data */
    data?: Buffer;
    /** Image properties */
    properties: ImageProperties;
  };
}

/**
 * Chart element
 */
interface ChartElement extends SlideElement {
  type: 'chart';
  content: {
    /** Chart type */
    chartType: string;
    /** Chart data */
    data: ChartData;
    /** Chart properties */
    properties: ChartProperties;
  };
}

/**
 * Table element
 */
interface TableElement extends SlideElement {
  type: 'table';
  content: {
    /** Table rows */
    rows: TableRow[];
    /** Table properties */
    properties: TableProperties;
  };
}

/**
 * Text paragraph
 */
interface TextParagraph {
  /** Paragraph text */
  text: string;
  /** Text runs with formatting */
  runs: TextRun[];
  /** Paragraph formatting */
  formatting?: ParagraphFormatting;
}

/**
 * Text run (formatted text segment)
 */
interface TextRun {
  /** Run text */
  text: string;
  /** Run formatting */
  formatting?: TextFormatting;
}

/**
 * Table row
 */
interface TableRow {
  /** Row cells */
  cells: TableCell[];
  /** Row properties */
  properties?: RowProperties;
}

/**
 * Table cell
 */
interface TableCell {
  /** Cell text */
  text: string;
  /** Cell properties */
  properties?: CellProperties;
}

/**
 * Slide layout definition
 */
interface SlideLayout {
  /** Layout ID */
  id: string;
  /** Layout name */
  name: string;
  /** Layout type */
  type: string;
  /** Placeholder definitions */
  placeholders: LayoutPlaceholder[];
}

/**
 * Layout placeholder
 */
interface LayoutPlaceholder {
  /** Placeholder type */
  type: 'title' | 'content' | 'text' | 'object' | 'chart' | 'table' | 'media';
  /** Placeholder position */
  position: ElementPosition;
  /** Placeholder size */
  size: ElementSize;
  /** Placeholder formatting */
  formatting?: ElementFormatting;
}

/**
 * Slide master definition
 */
interface SlideMaster {
  /** Master ID */
  id: string;
  /** Master name */
  name: string;
  /** Master layouts */
  layouts: SlideLayout[];
  /** Master theme */
  theme?: string;
}

/**
 * Presentation theme
 */
interface PresentationTheme {
  /** Theme ID */
  id: string;
  /** Theme name */
  name: string;
  /** Color scheme */
  colors: ThemeColors;
  /** Font scheme */
  fonts: ThemeFonts;
  /** Effect scheme */
  effects: ThemeEffects;
}

/**
 * Custom slide show
 */
interface CustomSlideShow {
  /** Show ID */
  id: string;
  /** Show name */
  name: string;
  /** Slide indices */
  slides: number[];
}

/**
 * Position and size interfaces
 */
interface ElementPosition {
  x: number;
  y: number;
  z?: number;
}

interface ElementSize {
  width: number;
  height: number;
}

/**
 * Animation interfaces
 */
interface SlideTransition {
  type: string;
  duration: number;
  direction?: string;
}

interface SlideAnimation {
  id: string;
  type: string;
  target: string;
  trigger: 'onEnter' | 'onClick' | 'afterPrevious';
  duration: number;
  delay?: number;
}

interface ElementAnimation {
  id: string;
  type: string;
  trigger: 'onEnter' | 'onClick' | 'afterPrevious';
  duration: number;
  delay?: number;
  properties: Record<string, any>;
}

/**
 * Comment interface
 */
interface SlideComment {
  id: string;
  author: string;
  text: string;
  position: ElementPosition;
  timestamp: Date;
}

/**
 * Property interfaces
 */
interface DocumentProperties {
  title?: string;
  author?: string;
  subject?: string;
  description?: string;
  keywords?: string;
  created?: Date;
  modified?: Date;
  slideCount?: number;
  custom?: Record<string, any>;
}

interface SlideProperties {
  hidden?: boolean;
  background?: SlideBackground;
  timing?: SlideTiming;
}

interface SlideBackground {
  type: 'solid' | 'gradient' | 'image' | 'pattern';
  color?: string;
  image?: string;
  properties?: Record<string, any>;
}

interface SlideTiming {
  advanceOnClick?: boolean;
  advanceAfter?: number;
}

interface ElementFormatting {
  fill?: FillFormatting;
  line?: LineFormatting;
  shadow?: ShadowFormatting;
  effects?: EffectFormatting;
}

interface TextBoxProperties {
  autoFit?: 'none' | 'normal' | 'shape';
  wrap?: boolean;
  margins?: { top: number; right: number; bottom: number; left: number };
  verticalAlignment?: 'top' | 'middle' | 'bottom';
}

interface ShapeProperties {
  shapeType: string;
  rotation?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
}

interface ImageProperties {
  brightness?: number;
  contrast?: number;
  transparency?: number;
  crop?: { top: number; right: number; bottom: number; left: number };
}

interface ChartData {
  categories: string[];
  series: ChartSeries[];
}

interface ChartSeries {
  name: string;
  values: number[];
  color?: string;
}

interface ChartProperties {
  title?: string;
  showLegend?: boolean;
  showDataLabels?: boolean;
  style?: string;
}

interface TableProperties {
  style?: string;
  showHeader?: boolean;
  showTotalRow?: boolean;
  bandedRows?: boolean;
  bandedColumns?: boolean;
}

interface TextFormatting {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

interface ParagraphFormatting {
  alignment?: 'left' | 'center' | 'right' | 'justify';
  indent?: number;
  spacing?: { before: number; after: number; line: number };
  bulletStyle?: string;
}

interface RowProperties {
  height?: number;
}

interface CellProperties {
  verticalAlignment?: 'top' | 'middle' | 'bottom';
  margins?: { top: number; right: number; bottom: number; left: number };
}

interface FillFormatting {
  type: 'solid' | 'gradient' | 'pattern' | 'picture';
  color?: string;
  transparency?: number;
}

interface LineFormatting {
  color?: string;
  width?: number;
  style?: 'solid' | 'dash' | 'dot' | 'dashDot';
}

interface ShadowFormatting {
  type: 'outer' | 'inner';
  color?: string;
  blur?: number;
  distance?: number;
  direction?: number;
}

interface EffectFormatting {
  glow?: { color: string; size: number };
  reflection?: { transparency: number; size: number };
  softEdges?: { size: number };
}

interface ThemeColors {
  accent1?: string;
  accent2?: string;
  accent3?: string;
  accent4?: string;
  accent5?: string;
  accent6?: string;
  dark1?: string;
  dark2?: string;
  light1?: string;
  light2?: string;
  hyperlink?: string;
  followedHyperlink?: string;
}

interface ThemeFonts {
  major?: { latin: string; eastAsia?: string; complexScript?: string };
  minor?: { latin: string; eastAsia?: string; complexScript?: string };
}

interface ThemeEffects {
  fillStyleList?: any[];
  lineStyleList?: any[];
  effectStyleList?: any[];
  backgroundFillStyleList?: any[];
}

/**
 * PowerPoint document processor implementation
 * 
 * Extends the base processor to provide PowerPoint-specific functionality for
 * reading, processing, and writing PPTX files with template capabilities.
 */
export class PowerPointProcessor extends BaseOfficeProcessor {
  private static readonly SUPPORTED_EXTENSIONS = ['.pptx', '.ppt'];
  private static readonly FRONTMATTER_PROPERTY = 'unjucks:frontmatter';
  
  /**
   * Gets the document type supported by this processor
   * 
   * @returns PowerPoint document type
   */
  getSupportedType(): DocumentType {
    return DocumentType.POWERPOINT;
  }

  /**
   * Gets supported file extensions
   * 
   * @returns Array of supported extensions
   */
  getSupportedExtensions(): string[] {
    return [...PowerPointProcessor.SUPPORTED_EXTENSIONS];
  }

  /**
   * Loads a PowerPoint template from file path
   * 
   * @param templatePath - Path to the PowerPoint template file
   * @returns Promise resolving to template info
   */
  async loadTemplate(templatePath: string): Promise<TemplateInfo> {
    this.logger.debug(`Loading PowerPoint template: ${templatePath}`);
    
    try {
      await fs.access(templatePath, fs.constants.R_OK);
      const stats = await fs.stat(templatePath);
      
      const extension = this.getFileExtension(templatePath);
      if (!this.getSupportedExtensions().includes(extension)) {
        throw new Error(`Unsupported file extension: ${extension}`);
      }
      
      const templateInfo: TemplateInfo = {
        path: templatePath,
        name: path.basename(templatePath, extension),
        type: DocumentType.POWERPOINT,
        size: stats.size,
        lastModified: stats.mtime
      };
      
      templateInfo.hash = await this.calculateFileHash(templatePath);
      
      this.logger.info(`PowerPoint template loaded successfully: ${templateInfo.name}`);
      return templateInfo;
      
    } catch (error) {
      this.logger.error(`Failed to load PowerPoint template: ${templatePath}`, error);
      throw new Error(`Failed to load PowerPoint template: ${error.message}`);
    }
  }

  /**
   * Parses frontmatter from PowerPoint document properties
   * 
   * @param template - Template info
   * @returns Promise resolving to frontmatter or null
   */
  async parseFrontmatter(template: TemplateInfo): Promise<TemplateFrontmatter | null> {
    this.logger.debug(`Parsing frontmatter from PowerPoint template: ${template.name}`);
    
    try {
      const document = await this.loadPowerPointDocument(template.path);
      
      // Check for frontmatter in custom document properties
      const frontmatterData = document.properties.custom?.[PowerPointProcessor.FRONTMATTER_PROPERTY];
      
      if (frontmatterData) {
        if (typeof frontmatterData === 'string') {
          return JSON.parse(frontmatterData);
        } else if (typeof frontmatterData === 'object') {
          return frontmatterData as TemplateFrontmatter;
        }
      }
      
      // Try to parse from first slide notes
      if (document.slides.length > 0 && document.slides[0].notes) {
        const frontmatter = await this.parseFrontmatterFromText(document.slides[0].notes);
        if (frontmatter) {
          return frontmatter;
        }
      }
      
      // Check for frontmatter in first slide's first text box
      if (document.slides.length > 0) {
        const firstSlide = document.slides[0];
        const textBoxes = firstSlide.content.filter(el => el.type === 'textBox') as TextBoxElement[];
        
        if (textBoxes.length > 0 && textBoxes[0].content.paragraphs.length > 0) {
          const firstParagraph = textBoxes[0].content.paragraphs[0].text.trim();
          if (firstParagraph.startsWith('---') || firstParagraph.startsWith('{')) {
            const frontmatter = await this.parseFrontmatterFromText(firstParagraph);
            if (frontmatter) {
              return frontmatter;
            }
          }
        }
      }
      
      this.logger.debug('No frontmatter found in PowerPoint template');
      return null;
      
    } catch (error) {
      this.logger.warn(`Failed to parse frontmatter from PowerPoint template: ${error.message}`);
      return null;
    }
  }

  /**
   * Extracts variables from PowerPoint document content
   * 
   * @param template - Template info
   * @param frontmatter - Template frontmatter
   * @returns Promise resolving to variable locations
   */
  async extractVariables(template: TemplateInfo, frontmatter?: TemplateFrontmatter): Promise<VariableLocation[]> {
    this.logger.debug(`Extracting variables from PowerPoint template: ${template.name}`);
    
    try {
      const document = await this.loadPowerPointDocument(template.path);
      const variables = this.variableExtractor.extractFromDocument(document, 'powerpoint');
      
      this.logger.info(`Extracted ${variables.length} variables from PowerPoint template`);
      return variables;
      
    } catch (error) {
      this.logger.error(`Failed to extract variables from PowerPoint template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Processes the PowerPoint template with provided data
   * 
   * @param template - Template info
   * @param data - Data for variable replacement
   * @param frontmatter - Template frontmatter
   * @returns Promise resolving to processing result
   */
  async processTemplate(
    template: TemplateInfo, 
    data: Record<string, any>, 
    frontmatter?: TemplateFrontmatter
  ): Promise<ProcessingResult> {
    this.logger.debug(`Processing PowerPoint template: ${template.name}`);
    
    try {
      const document = await this.loadPowerPointDocument(template.path);
      
      // Process variables in slides
      await this.processVariablesInDocument(document, data, frontmatter);
      
      // Process dynamic slide generation
      await this.processDynamicSlides(document, data, frontmatter);
      
      // Process charts with dynamic data
      await this.processCharts(document, data, frontmatter);
      
      // Process injection points if defined
      if (frontmatter?.injectionPoints) {
        await this.processInjectionPoints(document, data, frontmatter.injectionPoints);
      }
      
      // Generate processed document content
      const content = await this.generateDocumentContent(document);
      
      // Extract metadata
      const metadata = this.extractDocumentMetadata(document);
      
      const result: ProcessingResult = {
        success: true,
        content,
        metadata,
        stats: this.getStats(),
        validation: { valid: true, errors: [], warnings: [] }
      };
      
      this.logger.info(`PowerPoint template processed successfully: ${template.name}`);
      return result;
      
    } catch (error) {
      this.incrementErrorCount();
      this.logger.error(`Failed to process PowerPoint template: ${error.message}`);
      
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
   * Saves the processed PowerPoint document to file
   * 
   * @param result - Processing result
   * @param outputPath - Output file path
   * @returns Promise resolving to saved file path
   */
  async saveDocument(result: ProcessingResult, outputPath: string): Promise<string> {
    this.logger.debug(`Saving PowerPoint document to: ${outputPath}`);
    
    try {
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      if (result.content instanceof Buffer) {
        await fs.writeFile(outputPath, result.content);
      } else {
        throw new Error('Invalid document content format for PowerPoint document');
      }
      
      this.logger.info(`PowerPoint document saved successfully: ${outputPath}`);
      return outputPath;
      
    } catch (error) {
      this.logger.error(`Failed to save PowerPoint document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validates PowerPoint template structure
   * 
   * @param template - Template info
   * @returns Promise resolving to validation result
   */
  async validateTemplate(template: TemplateInfo): Promise<ValidationResult> {
    this.logger.debug(`Validating PowerPoint template: ${template.name}`);
    
    const errors: any[] = [];
    const warnings: any[] = [];
    
    try {
      await fs.access(template.path, fs.constants.R_OK);
      const document = await this.loadPowerPointDocument(template.path);
      
      // Check if document has slides
      if (!document.slides || document.slides.length === 0) {
        warnings.push({
          message: 'PowerPoint template has no slides',
          code: 'NO_SLIDES',
          severity: ErrorSeverity.WARNING
        });
      }
      
      // Validate each slide
      for (const slide of document.slides) {
        if (!slide.id) {
          errors.push({
            message: `Slide at index ${slide.index} has no ID`,
            code: 'MISSING_SLIDE_ID',
            severity: ErrorSeverity.ERROR
          });
        }
        
        // Check for empty slides
        if (!slide.content || slide.content.length === 0) {
          warnings.push({
            message: `Slide ${slide.index + 1} appears to be empty`,
            code: 'EMPTY_SLIDE',
            severity: ErrorSeverity.WARNING
          });
        }
        
        // Validate slide elements
        for (const element of slide.content) {
          if (!element.id) {
            warnings.push({
              message: `Element in slide ${slide.index + 1} has no ID`,
              code: 'MISSING_ELEMENT_ID',
              severity: ErrorSeverity.WARNING
            });
          }
        }
      }
      
      // Validate layouts
      for (const layout of document.layouts) {
        if (!layout.id || !layout.name) {
          errors.push({
            message: 'Slide layout missing ID or name',
            code: 'INVALID_LAYOUT',
            severity: ErrorSeverity.ERROR
          });
        }
      }
      
      this.logger.info(`PowerPoint template validation completed: ${errors.length} errors, ${warnings.length} warnings`);
      
    } catch (error) {
      errors.push({
        message: `Template validation failed: ${error.message}`,
        code: 'VALIDATION_ERROR',
        severity: ErrorSeverity.ERROR
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Loads PowerPoint document from file path
   * 
   * @param filePath - Path to PowerPoint document
   * @returns Promise resolving to PowerPoint document structure
   */
  private async loadPowerPointDocument(filePath: string): Promise<PowerPointDocument> {
    try {
      // In a real implementation, you would use a library like 'officegen' or 'pptxgenjs'
      // to parse the PPTX file. This is a simplified placeholder implementation.
      
      const fileContent = await fs.readFile(filePath);
      
      // Placeholder implementation
      const document: PowerPointDocument = {
        slides: [
          {
            id: 'slide1',
            index: 0,
            title: 'Sample Slide',
            content: [
              {
                id: 'title1',
                type: 'textBox',
                content: {
                  paragraphs: [
                    {
                      text: 'Welcome {{userName}}',
                      runs: [{ text: 'Welcome {{userName}}' }]
                    }
                  ],
                  properties: {}
                },
                position: { x: 100, y: 100 },
                size: { width: 400, height: 100 },
                animations: []
              } as TextBoxElement
            ],
            notes: 'Speaker notes with {{speakerNote}}',
            animations: [],
            comments: [],
            properties: {}
          }
        ],
        properties: {
          title: 'Sample PowerPoint Template',
          author: 'Template System',
          created: new Date(),
          modified: new Date(),
          slideCount: 1
        },
        layouts: [
          {
            id: 'layout1',
            name: 'Title Slide',
            type: 'title',
            placeholders: [
              {
                type: 'title',
                position: { x: 100, y: 100 },
                size: { width: 400, height: 100 }
              }
            ]
          }
        ],
        masters: [],
        themes: [],
        customShows: []
      };
      
      return document;
      
    } catch (error) {
      throw new Error(`Failed to load PowerPoint document: ${error.message}`);
    }
  }

  /**
   * Processes variables in PowerPoint document
   * 
   * @param document - PowerPoint document
   * @param data - Replacement data
   * @param frontmatter - Template frontmatter
   */
  private async processVariablesInDocument(
    document: PowerPointDocument, 
    data: Record<string, any>, 
    frontmatter?: TemplateFrontmatter
  ): Promise<void> {
    for (const slide of document.slides) {
      // Process slide title
      if (slide.title) {
        slide.title = this.variableExtractor.replaceVariables(slide.title, data);
        this.incrementVariableCount();
      }
      
      // Process slide content elements
      for (const element of slide.content) {
        await this.processElementVariables(element, data);
      }
      
      // Process speaker notes
      if (slide.notes) {
        slide.notes = this.variableExtractor.replaceVariables(slide.notes, data);
        this.incrementVariableCount();
      }
      
      // Process comments
      for (const comment of slide.comments) {
        comment.text = this.variableExtractor.replaceVariables(comment.text, data);
        this.incrementVariableCount();
      }
    }
  }

  /**
   * Processes variables in slide element
   * 
   * @param element - Slide element
   * @param data - Replacement data
   */
  private async processElementVariables(element: SlideElement, data: Record<string, any>): Promise<void> {
    switch (element.type) {
      case 'textBox':
        const textBox = element as TextBoxElement;
        for (const paragraph of textBox.content.paragraphs) {
          paragraph.text = this.variableExtractor.replaceVariables(paragraph.text, data);
          for (const run of paragraph.runs) {
            run.text = this.variableExtractor.replaceVariables(run.text, data);
          }
        }
        this.incrementVariableCount();
        break;
        
      case 'shape':
        const shape = element as ShapeElement;
        if (shape.content.text) {
          shape.content.text = this.variableExtractor.replaceVariables(shape.content.text, data);
          this.incrementVariableCount();
        }
        break;
        
      case 'chart':
        const chart = element as ChartElement;
        if (chart.content.properties.title) {
          chart.content.properties.title = this.variableExtractor.replaceVariables(
            chart.content.properties.title, 
            data
          );
        }
        
        // Process chart series names
        for (const series of chart.content.data.series) {
          series.name = this.variableExtractor.replaceVariables(series.name, data);
        }
        this.incrementVariableCount();
        break;
        
      case 'table':
        const table = element as TableElement;
        for (const row of table.content.rows) {
          for (const cell of row.cells) {
            cell.text = this.variableExtractor.replaceVariables(cell.text, data);
          }
        }
        this.incrementVariableCount();
        break;
    }
  }

  /**
   * Processes dynamic slide generation
   * 
   * @param document - PowerPoint document
   * @param data - Data for slide generation
   * @param frontmatter - Template frontmatter
   */
  private async processDynamicSlides(
    document: PowerPointDocument, 
    data: Record<string, any>, 
    frontmatter?: TemplateFrontmatter
  ): Promise<void> {
    const slideConfigs = frontmatter?.metadata?.dynamicSlides;
    if (!slideConfigs || !Array.isArray(slideConfigs)) {
      return;
    }
    
    for (const slideConfig of slideConfigs) {
      const slideData = data[slideConfig.dataSource];
      if (Array.isArray(slideData)) {
        await this.generateSlidesFromData(document, slideConfig, slideData);
      }
    }
  }

  /**
   * Generates slides from data array
   * 
   * @param document - PowerPoint document
   * @param slideConfig - Slide generation configuration
   * @param slideData - Data for slide generation
   */
  private async generateSlidesFromData(
    document: PowerPointDocument, 
    slideConfig: any, 
    slideData: any[]
  ): Promise<void> {
    const templateSlideIndex = slideConfig.templateSlide || 0;
    const templateSlide = document.slides[templateSlideIndex];
    
    if (!templateSlide) {
      this.logger.warn(`Template slide at index ${templateSlideIndex} not found`);
      return;
    }
    
    // Generate new slides based on data
    for (let i = 0; i < slideData.length; i++) {
      const itemData = slideData[i];
      const newSlide = await this.cloneSlide(templateSlide, document.slides.length + i);
      
      // Replace variables in new slide with item data
      await this.processSlideWithData(newSlide, itemData);
      
      document.slides.push(newSlide);
      this.incrementInjectionCount();
    }
    
    // Remove template slide if configured
    if (slideConfig.removeTemplate) {
      document.slides.splice(templateSlideIndex, 1);
      
      // Update slide indices
      document.slides.forEach((slide, index) => {
        slide.index = index;
      });
    }
  }

  /**
   * Clones a slide
   * 
   * @param templateSlide - Slide to clone
   * @param newIndex - New slide index
   * @returns Cloned slide
   */
  private async cloneSlide(templateSlide: PowerPointSlide, newIndex: number): Promise<PowerPointSlide> {
    return {
      ...templateSlide,
      id: `slide${newIndex + 1}`,
      index: newIndex,
      content: templateSlide.content.map(element => ({ ...element, id: `${element.id}_${newIndex}` })),
      animations: [...templateSlide.animations],
      comments: [...templateSlide.comments]
    };
  }

  /**
   * Processes slide with specific data
   * 
   * @param slide - Slide to process
   * @param data - Data for processing
   */
  private async processSlideWithData(slide: PowerPointSlide, data: Record<string, any>): Promise<void> {
    // Process slide title
    if (slide.title) {
      slide.title = this.variableExtractor.replaceVariables(slide.title, data);
    }
    
    // Process slide content elements
    for (const element of slide.content) {
      await this.processElementVariables(element, data);
    }
    
    // Process speaker notes
    if (slide.notes) {
      slide.notes = this.variableExtractor.replaceVariables(slide.notes, data);
    }
  }

  /**
   * Processes charts with dynamic data
   * 
   * @param document - PowerPoint document
   * @param data - Data for charts
   * @param frontmatter - Template frontmatter
   */
  private async processCharts(
    document: PowerPointDocument, 
    data: Record<string, any>, 
    frontmatter?: TemplateFrontmatter
  ): Promise<void> {
    for (const slide of document.slides) {
      const chartElements = slide.content.filter(el => el.type === 'chart') as ChartElement[];
      
      for (const chart of chartElements) {
        // Update chart data from provided data
        const chartDataSource = frontmatter?.metadata?.charts?.[chart.id];
        if (chartDataSource && data[chartDataSource]) {
          await this.updateChartData(chart, data[chartDataSource]);
        }
      }
    }
  }

  /**
   * Updates chart data
   * 
   * @param chart - Chart element
   * @param newData - New chart data
   */
  private async updateChartData(chart: ChartElement, newData: any): Promise<void> {
    if (newData.categories) {
      chart.content.data.categories = newData.categories;
    }
    
    if (newData.series) {
      chart.content.data.series = newData.series;
    }
  }

  /**
   * Processes injection points in PowerPoint document
   * 
   * @param document - PowerPoint document
   * @param data - Injection data
   * @param injectionPoints - Injection point definitions
   */
  private async processInjectionPoints(
    document: PowerPointDocument, 
    data: Record<string, any>, 
    injectionPoints: InjectionPoint[]
  ): Promise<void> {
    for (const injectionPoint of injectionPoints) {
      const content = data[injectionPoint.id] || injectionPoint.defaultContent || '';
      
      if (content) {
        await this.injectContentAtMarker(document, injectionPoint.marker, content, injectionPoint);
        this.incrementInjectionCount();
      }
    }
  }

  /**
   * Injects content at specified marker in document
   * 
   * @param document - PowerPoint document
   * @param marker - Marker string to find
   * @param content - Content to inject
   * @param injectionPoint - Injection point configuration
   */
  private async injectContentAtMarker(
    document: PowerPointDocument, 
    marker: string, 
    content: string, 
    injectionPoint: InjectionPoint
  ): Promise<void> {
    for (const slide of document.slides) {
      // Check slide title
      if (slide.title && slide.title.includes(marker)) {
        slide.title = this.replaceMarker(slide.title, marker, content, injectionPoint);
      }
      
      // Check slide notes
      if (slide.notes && slide.notes.includes(marker)) {
        slide.notes = this.replaceMarker(slide.notes, marker, content, injectionPoint);
      }
      
      // Check slide content elements
      for (const element of slide.content) {
        await this.injectIntoElement(element, marker, content, injectionPoint);
      }
    }
  }

  /**
   * Injects content into slide element
   * 
   * @param element - Slide element
   * @param marker - Marker string
   * @param content - Content to inject
   * @param injectionPoint - Injection point configuration
   */
  private async injectIntoElement(
    element: SlideElement, 
    marker: string, 
    content: string, 
    injectionPoint: InjectionPoint
  ): Promise<void> {
    switch (element.type) {
      case 'textBox':
        const textBox = element as TextBoxElement;
        for (const paragraph of textBox.content.paragraphs) {
          if (paragraph.text.includes(marker)) {
            paragraph.text = this.replaceMarker(paragraph.text, marker, content, injectionPoint);
            
            // Update runs
            paragraph.runs = [{ text: paragraph.text }];
          }
        }
        break;
        
      case 'shape':
        const shape = element as ShapeElement;
        if (shape.content.text && shape.content.text.includes(marker)) {
          shape.content.text = this.replaceMarker(shape.content.text, marker, content, injectionPoint);
        }
        break;
    }
  }

  /**
   * Replaces marker with content based on position
   * 
   * @param text - Text containing marker
   * @param marker - Marker to replace
   * @param content - Content to inject
   * @param injectionPoint - Injection point configuration
   * @returns Updated text
   */
  private replaceMarker(
    text: string, 
    marker: string, 
    content: string, 
    injectionPoint: InjectionPoint
  ): string {
    const position = injectionPoint.processing?.position || 'replace';
    
    switch (position) {
      case 'replace':
        return text.replace(marker, content);
      case 'before':
        return text.replace(marker, content + marker);
      case 'after':
        return text.replace(marker, marker + content);
      default:
        return text.replace(marker, content);
    }
  }

  /**
   * Generates document content from PowerPoint document structure
   * 
   * @param document - PowerPoint document
   * @returns Promise resolving to document content buffer
   */
  private async generateDocumentContent(document: PowerPointDocument): Promise<Buffer> {
    // In a real implementation, you would use a library like 'officegen' or 'pptxgenjs'
    // to generate the PPTX file from the document structure
    
    // Placeholder implementation
    const content = JSON.stringify(document, null, 2);
    return Buffer.from(content, 'utf-8');
  }

  /**
   * Extracts metadata from PowerPoint document
   * 
   * @param document - PowerPoint document
   * @returns Document metadata
   */
  private extractDocumentMetadata(document: PowerPointDocument): DocumentMetadata {
    const totalElements = document.slides.reduce(
      (total, slide) => total + slide.content.length, 
      0
    );
    
    return {
      title: document.properties.title,
      author: document.properties.author,
      subject: document.properties.subject,
      keywords: document.properties.keywords ? [document.properties.keywords] : undefined,
      created: document.properties.created,
      modified: document.properties.modified,
      properties: {
        slideCount: document.slides.length,
        elementCount: totalElements,
        layoutCount: document.layouts.length,
        masterCount: document.masters.length,
        themeCount: document.themes.length
      }
    };
  }

  /**
   * Parses frontmatter from text content
   * 
   * @param text - Text content to parse
   * @returns Parsed frontmatter or null
   */
  private async parseFrontmatterFromText(text: string): Promise<TemplateFrontmatter | null> {
    try {
      if (text.trim().startsWith('{')) {
        return JSON.parse(text);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculates hash of file for caching
   * 
   * @param filePath - File path
   * @returns Promise resolving to file hash
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    const stats = await fs.stat(filePath);
    return `${stats.size}-${stats.mtime.getTime()}`;
  }
}
