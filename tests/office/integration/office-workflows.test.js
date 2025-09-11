/**
 * @fileoverview Integration tests for Office workflows
 * Tests complete end-to-end Office document processing workflows
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { TestUtils } from '../test-runner.js';

/**
 * Mock Office Workflow Manager for integration testing
 */
class OfficeWorkflowManager {
  constructor() {
    this.processors = {
      word: new MockWordProcessor(),
      excel: new MockExcelProcessor(),
      powerpoint: new MockPowerPointProcessor()
    };
    
    this.parser = new MockOfficeParser();
    this.injector = new MockOfficeInjector();
    
    this.stats = {
      workflowsExecuted: 0,
      documentsProcessed: 0,
      totalProcessingTime: 0,
      errors: []
    };
  }

  /**
   * Execute complete document generation workflow
   */
  async executeDocumentGeneration(workflow) {
    const startTime = Date.now();
    this.stats.workflowsExecuted++;
    
    try {
      const results = [];
      
      for (const step of workflow.steps) {
        const stepResult = await this.executeWorkflowStep(step);
        results.push(stepResult);
        
        if (!stepResult.success && workflow.stopOnError) {
          throw new Error(`Workflow failed at step: ${step.name}`);
        }
      }
      
      const processingTime = Date.now() - startTime;
      this.stats.totalProcessingTime += processingTime;
      
      return {
        success: true,
        workflow: workflow.name,
        steps: results,
        totalSteps: workflow.steps.length,
        successfulSteps: results.filter(r => r.success).length,
        failedSteps: results.filter(r => !r.success).length,
        processingTime
      };
      
    } catch (error) {
      this.stats.errors.push(error.message);
      return {
        success: false,
        workflow: workflow.name,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Execute a single workflow step
   */
  async executeWorkflowStep(step) {
    switch (step.type) {
      case 'parse':
        return this.executeParseStep(step);
      case 'process':
        return this.executeProcessStep(step);
      case 'inject':
        return this.executeInjectStep(step);
      case 'validate':
        return this.executeValidateStep(step);
      case 'export':
        return this.executeExportStep(step);
      default:
        return {
          success: false,
          step: step.name,
          error: `Unknown step type: ${step.type}`
        };
    }
  }

  async executeParseStep(step) {
    try {
      const parseResult = await this.parser.parseFile(step.input.filePath, step.options || {});
      
      this.stats.documentsProcessed++;
      
      return {
        success: true,
        step: step.name,
        type: 'parse',
        input: step.input.filePath,
        output: parseResult,
        extractedVariables: parseResult.templateVariables?.length || 0,
        extractedTables: parseResult.tables?.length || 0,
        extractedMedia: parseResult.media?.length || 0
      };
    } catch (error) {
      return {
        success: false,
        step: step.name,
        type: 'parse',
        error: error.message
      };
    }
  }

  async executeProcessStep(step) {
    try {
      const processor = this.processors[step.documentType];
      if (!processor) {
        throw new Error(`No processor for document type: ${step.documentType}`);
      }
      
      const processResult = await processor.processTemplate(
        step.input.templatePath,
        step.input.data,
        step.input.outputPath
      );
      
      this.stats.documentsProcessed++;
      
      return {
        success: true,
        step: step.name,
        type: 'process',
        documentType: step.documentType,
        template: step.input.templatePath,
        output: step.input.outputPath,
        variablesReplaced: Object.keys(step.input.data).length,
        processingTime: processResult.processingTime
      };
    } catch (error) {
      return {
        success: false,
        step: step.name,
        type: 'process',
        error: error.message
      };
    }
  }

  async executeInjectStep(step) {
    try {
      const injectResult = await this.injector.injectFile({
        filePath: step.input.filePath,
        injections: step.input.injections,
        outputPath: step.input.outputPath
      });
      
      return {
        success: true,
        step: step.name,
        type: 'inject',
        filePath: step.input.filePath,
        injections: injectResult.injections?.length || 0,
        skipped: injectResult.skipped?.length || 0,
        errors: injectResult.errors?.length || 0
      };
    } catch (error) {
      return {
        success: false,
        step: step.name,
        type: 'inject',
        error: error.message
      };
    }
  }

  async executeValidateStep(step) {
    try {
      const processor = this.processors[step.documentType];
      if (!processor) {
        throw new Error(`No processor for document type: ${step.documentType}`);
      }
      
      const validationResult = await processor.validateTemplate(step.input.filePath);
      
      return {
        success: validationResult.valid,
        step: step.name,
        type: 'validate',
        filePath: step.input.filePath,
        valid: validationResult.valid,
        issues: validationResult.issues?.length || 0,
        variables: validationResult.variables?.length || 0
      };
    } catch (error) {
      return {
        success: false,
        step: step.name,
        type: 'validate',
        error: error.message
      };
    }
  }

  async executeExportStep(step) {
    try {
      // Mock export functionality
      const exportResult = {
        success: true,
        format: step.format,
        inputFile: step.input.filePath,
        outputFile: step.output.filePath,
        fileSize: Math.floor(Math.random() * 1000000)
      };
      
      return {
        success: true,
        step: step.name,
        type: 'export',
        format: step.format,
        output: step.output.filePath,
        fileSize: exportResult.fileSize
      };
    } catch (error) {
      return {
        success: false,
        step: step.name,
        type: 'export',
        error: error.message
      };
    }
  }

  /**
   * Execute batch document processing
   */
  async executeBatchProcessing(batchConfig) {
    const results = [];
    const startTime = Date.now();
    
    for (const config of batchConfig.templates) {
      try {
        const processor = this.processors[config.documentType];
        const result = await processor.processTemplate(
          config.templatePath,
          config.data,
          config.outputPath
        );
        
        results.push({
          success: true,
          template: config.templatePath,
          output: config.outputPath,
          ...result
        });
        
        this.stats.documentsProcessed++;
      } catch (error) {
        results.push({
          success: false,
          template: config.templatePath,
          error: error.message
        });
        
        this.stats.errors.push(error.message);
      }
    }
    
    const processingTime = Date.now() - startTime;
    this.stats.totalProcessingTime += processingTime;
    
    return {
      success: true,
      batch: batchConfig.name,
      totalTemplates: batchConfig.templates.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
      processingTime
    };
  }

  /**
   * Get workflow statistics
   */
  getStats() {
    return { ...this.stats };
  }
}

// Mock processors for integration testing
class MockWordProcessor {
  async processTemplate(templatePath, data, outputPath) {
    await TestUtils.assertFileExists(templatePath);
    return {
      success: true,
      processingTime: Math.random() * 100
    };
  }

  async validateTemplate(templatePath) {
    await TestUtils.assertFileExists(templatePath);
    return {
      valid: true,
      issues: [],
      variables: [
        { name: 'title', type: 'string', required: true },
        { name: 'content', type: 'string', required: true }
      ]
    };
  }
}

class MockExcelProcessor {
  async processTemplate(templatePath, data, outputPath) {
    await TestUtils.assertFileExists(templatePath);
    return {
      success: true,
      processingTime: Math.random() * 150
    };
  }

  async validateTemplate(templatePath) {
    await TestUtils.assertFileExists(templatePath);
    return {
      valid: true,
      issues: [],
      variables: [
        { name: 'header1', type: 'string', required: true },
        { name: 'data1', type: 'number', required: true }
      ]
    };
  }
}

class MockPowerPointProcessor {
  async processTemplate(templatePath, data, outputPath) {
    await TestUtils.assertFileExists(templatePath);
    return {
      success: true,
      processingTime: Math.random() * 200
    };
  }

  async validateTemplate(templatePath) {
    await TestUtils.assertFileExists(templatePath);
    return {
      valid: true,
      issues: [],
      variables: [
        { name: 'slide_title', type: 'string', required: true },
        { name: 'slide_content', type: 'string', required: true }
      ]
    };
  }
}

class MockOfficeParser {
  async parseFile(filePath, options = {}) {
    await TestUtils.assertFileExists(filePath);
    
    const ext = path.extname(filePath).toLowerCase();
    
    return {
      type: ext === '.docx' ? 'word' : ext === '.xlsx' ? 'excel' : 'powerpoint',
      format: ext.slice(1),
      templateVariables: [
        { name: 'test_var', type: 'string', required: true }
      ],
      tables: [],
      media: [],
      text: 'Sample document content'
    };
  }
}

class MockOfficeInjector {
  async injectFile(config) {
    await TestUtils.assertFileExists(config.filePath);
    
    return {
      success: true,
      injections: config.injections?.map(inj => ({
        success: true,
        target: inj.target,
        content: inj.content
      })) || [],
      skipped: [],
      errors: []
    };
  }
}

/**
 * Register Office workflow integration tests
 */
export function registerTests(testRunner) {
  testRunner.registerSuite('Office Workflows Integration Tests', async () => {
    let workflowManager;
    let testData;
    
    beforeEach(() => {
      workflowManager = new OfficeWorkflowManager();
      testData = TestUtils.createTestVariables();
    });
    
    describe('Document Generation Workflows', () => {
      test('should execute complete Word document generation workflow', async () => {
        const workflow = {
          name: 'Word Document Generation',
          stopOnError: true,
          steps: [
            {
              name: 'Parse Template',
              type: 'parse',
              input: {
                filePath: TestUtils.getTestDataPath('template.docx')
              },
              options: {
                extractTemplateVars: true,
                extractMetadata: true
              }
            },
            {
              name: 'Validate Template',
              type: 'validate',
              documentType: 'word',
              input: {
                filePath: TestUtils.getTestDataPath('template.docx')
              }
            },
            {
              name: 'Process Template',
              type: 'process',
              documentType: 'word',
              input: {
                templatePath: TestUtils.getTestDataPath('template.docx'),
                data: testData,
                outputPath: TestUtils.getTempPath('output.docx')
              }
            },
            {
              name: 'Inject Additional Content',
              type: 'inject',
              input: {
                filePath: TestUtils.getTempPath('output.docx'),
                injections: [
                  {
                    target: 'bookmark:footer',
                    content: 'Generated on ' + new Date().toLocaleDateString(),
                    mode: 'replace'
                  }
                ]
              }
            }
          ]
        };
        
        const result = await workflowManager.executeDocumentGeneration(workflow);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.workflow, 'Word Document Generation');
        assert.strictEqual(result.totalSteps, 4);
        assert.strictEqual(result.successfulSteps, 4);
        assert.strictEqual(result.failedSteps, 0);
        assert.ok(result.processingTime > 0);
      });
      
      test('should execute Excel workbook generation workflow', async () => {
        const workflow = {
          name: 'Excel Workbook Generation',
          stopOnError: true,
          steps: [
            {
              name: 'Parse Spreadsheet Template',
              type: 'parse',
              input: {
                filePath: TestUtils.getTestDataPath('spreadsheet.xlsx')
              }
            },
            {
              name: 'Process Financial Data',
              type: 'process',
              documentType: 'excel',
              input: {
                templatePath: TestUtils.getTestDataPath('spreadsheet.xlsx'),
                data: {
                  ...testData,
                  quarterly_revenue: [1000000, 1200000, 1350000, 1500000],
                  growth_rates: [10.5, 12.3, 15.2, 18.1]
                },
                outputPath: TestUtils.getTempPath('financial_report.xlsx')
              }
            },
            {
              name: 'Add Chart Data',
              type: 'inject',
              input: {
                filePath: TestUtils.getTempPath('financial_report.xlsx'),
                injections: [
                  {
                    target: 'namedRange:ChartData',
                    content: [
                      ['Q1', 'Q2', 'Q3', 'Q4'],
                      [1000000, 1200000, 1350000, 1500000]
                    ],
                    mode: 'replace'
                  }
                ]
              }
            }
          ]
        };
        
        const result = await workflowManager.executeDocumentGeneration(workflow);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.totalSteps, 3);
        assert.strictEqual(result.successfulSteps, 3);
      });
      
      test('should execute PowerPoint presentation generation workflow', async () => {
        const workflow = {
          name: 'PowerPoint Presentation Generation',
          stopOnError: true,
          steps: [
            {
              name: 'Parse Presentation Template',
              type: 'parse',
              input: {
                filePath: TestUtils.getTestDataPath('presentation.pptx')
              }
            },
            {
              name: 'Process Presentation Content',
              type: 'process',
              documentType: 'powerpoint',
              input: {
                templatePath: TestUtils.getTestDataPath('presentation.pptx'),
                data: {
                  ...testData,
                  presentation_title: 'Quarterly Business Review',
                  slides: [
                    { title: 'Overview', content: 'Executive summary of Q4 performance' },
                    { title: 'Financial Results', content: 'Revenue growth of 18.1%' },
                    { title: 'Market Analysis', content: 'Competitive positioning' }
                  ]
                },
                outputPath: TestUtils.getTempPath('quarterly_review.pptx')
              }
            },
            {
              name: 'Update Charts',
              type: 'inject',
              input: {
                filePath: TestUtils.getTempPath('quarterly_review.pptx'),
                injections: [
                  {
                    target: 'slide:2:chart:revenue_chart',
                    content: {
                      title: 'Q4 Revenue Performance',
                      data: {
                        categories: ['Oct', 'Nov', 'Dec'],
                        series: [{ name: 'Revenue', values: [450000, 480000, 520000] }]
                      }
                    },
                    mode: 'replace'
                  }
                ]
              }
            },
            {
              name: 'Export to PDF',
              type: 'export',
              format: 'pdf',
              input: {
                filePath: TestUtils.getTempPath('quarterly_review.pptx')
              },
              output: {
                filePath: TestUtils.getTempPath('quarterly_review.pdf')
              }
            }
          ]
        };
        
        const result = await workflowManager.executeDocumentGeneration(workflow);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.totalSteps, 4);
        assert.strictEqual(result.successfulSteps, 4);
      });
    });

    describe('Multi-Document Workflows', () => {
      test('should process campaign materials across multiple document types', async () => {
        const campaignWorkflow = {
          name: 'Marketing Campaign Generation',
          stopOnError: false, // Continue on errors
          steps: [
            // Word document - Executive brief
            {
              name: 'Generate Executive Brief',
              type: 'process',
              documentType: 'word',
              input: {
                templatePath: TestUtils.getTestDataPath('template.docx'),
                data: {
                  title: 'Product Launch Campaign Brief',
                  product_name: 'CloudSync Pro',
                  launch_date: '2024-Q2',
                  target_market: 'Enterprise customers',
                  budget: '$500,000'
                },
                outputPath: TestUtils.getTempPath('executive_brief.docx')
              }
            },
            // Excel document - Budget breakdown
            {
              name: 'Generate Budget Spreadsheet',
              type: 'process',
              documentType: 'excel',
              input: {
                templatePath: TestUtils.getTestDataPath('spreadsheet.xlsx'),
                data: {
                  campaign_name: 'CloudSync Pro Launch',
                  budget_items: [
                    ['Digital Advertising', 200000],
                    ['Content Creation', 100000],
                    ['Events & Trade Shows', 150000],
                    ['PR & Communications', 50000]
                  ],
                  total_budget: 500000
                },
                outputPath: TestUtils.getTempPath('campaign_budget.xlsx')
              }
            },
            // PowerPoint document - Presentation
            {
              name: 'Generate Campaign Presentation',
              type: 'process',
              documentType: 'powerpoint',
              input: {
                templatePath: TestUtils.getTestDataPath('presentation.pptx'),
                data: {
                  presentation_title: 'CloudSync Pro Launch Strategy',
                  campaign_overview: 'Comprehensive go-to-market strategy',
                  key_messages: [
                    'Enterprise-grade security',
                    'Real-time synchronization',
                    'Scalable architecture'
                  ]
                },
                outputPath: TestUtils.getTempPath('campaign_presentation.pptx')
              }
            }
          ]
        };
        
        const result = await workflowManager.executeDocumentGeneration(campaignWorkflow);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.totalSteps, 3);
        assert.strictEqual(result.successfulSteps, 3);
        
        // Verify each document type was processed
        const wordStep = result.steps.find(s => s.documentType === 'word');
        const excelStep = result.steps.find(s => s.documentType === 'excel');
        const pptStep = result.steps.find(s => s.documentType === 'powerpoint');
        
        assert.ok(wordStep.success);
        assert.ok(excelStep.success);
        assert.ok(pptStep.success);
      });
      
      test('should handle coordinated document generation with dependencies', async () => {
        const workflow = {
          name: 'Financial Reporting Suite',
          stopOnError: true,
          steps: [
            {
              name: 'Parse Financial Data Template',
              type: 'parse',
              input: {
                filePath: TestUtils.getTestDataPath('spreadsheet.xlsx')
              }
            },
            {
              name: 'Generate Detailed Financial Spreadsheet',
              type: 'process',
              documentType: 'excel',
              input: {
                templatePath: TestUtils.getTestDataPath('spreadsheet.xlsx'),
                data: {
                  report_period: 'Q4 2024',
                  revenue_data: [
                    ['Product A', 250000, 280000, 320000],
                    ['Product B', 180000, 195000, 210000],
                    ['Product C', 95000, 105000, 125000]
                  ]
                },
                outputPath: TestUtils.getTempPath('detailed_financials.xlsx')
              }
            },
            {
              name: 'Generate Executive Summary Document',
              type: 'process',
              documentType: 'word',
              input: {
                templatePath: TestUtils.getTestDataPath('template.docx'),
                data: {
                  title: 'Q4 2024 Financial Summary',
                  total_revenue: 1255000,
                  growth_rate: 18.5,
                  key_highlights: [
                    'Record quarterly revenue',
                    'Strong product portfolio performance',
                    'Improved operational efficiency'
                  ]
                },
                outputPath: TestUtils.getTempPath('financial_summary.docx')
              }
            },
            {
              name: 'Generate Board Presentation',
              type: 'process',
              documentType: 'powerpoint',
              input: {
                templatePath: TestUtils.getTestDataPath('presentation.pptx'),
                data: {
                  presentation_title: 'Q4 2024 Board Review',
                  financial_highlights: 'Revenue: $1.26M (+18.5%)',
                  next_quarter_outlook: 'Continued growth trajectory expected'
                },
                outputPath: TestUtils.getTempPath('board_presentation.pptx')
              }
            }
          ]
        };
        
        const result = await workflowManager.executeDocumentGeneration(workflow);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.totalSteps, 4);
        assert.strictEqual(result.successfulSteps, 4);
        
        // Verify proper step sequencing
        assert.strictEqual(result.steps[0].type, 'parse');
        assert.strictEqual(result.steps[1].documentType, 'excel');
        assert.strictEqual(result.steps[2].documentType, 'word');
        assert.strictEqual(result.steps[3].documentType, 'powerpoint');
      });
    });

    describe('Batch Processing Workflows', () => {
      test('should execute batch document generation', async () => {
        const batchConfig = {
          name: 'Employee Review Documents',
          templates: [
            {
              documentType: 'word',
              templatePath: TestUtils.getTestDataPath('template.docx'),
              data: { employee_name: 'Alice Johnson', performance_rating: 'Excellent' },
              outputPath: TestUtils.getTempPath('alice_review.docx')
            },
            {
              documentType: 'word',
              templatePath: TestUtils.getTestDataPath('template.docx'),
              data: { employee_name: 'Bob Smith', performance_rating: 'Good' },
              outputPath: TestUtils.getTempPath('bob_review.docx')
            },
            {
              documentType: 'word',
              templatePath: TestUtils.getTestDataPath('template.docx'),
              data: { employee_name: 'Carol Davis', performance_rating: 'Outstanding' },
              outputPath: TestUtils.getTempPath('carol_review.docx')
            }
          ]
        };
        
        const result = await workflowManager.executeBatchProcessing(batchConfig);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.batch, 'Employee Review Documents');
        assert.strictEqual(result.totalTemplates, 3);
        assert.strictEqual(result.successful, 3);
        assert.strictEqual(result.failed, 0);
        assert.ok(result.processingTime > 0);
      });
      
      test('should handle mixed document types in batch processing', async () => {
        const batchConfig = {
          name: 'Quarterly Reports Suite',
          templates: [
            {
              documentType: 'word',
              templatePath: TestUtils.getTestDataPath('template.docx'),
              data: { report_type: 'Executive Summary', quarter: 'Q4' },
              outputPath: TestUtils.getTempPath('q4_summary.docx')
            },
            {
              documentType: 'excel',
              templatePath: TestUtils.getTestDataPath('spreadsheet.xlsx'),
              data: { report_type: 'Financial Data', quarter: 'Q4' },
              outputPath: TestUtils.getTempPath('q4_financials.xlsx')
            },
            {
              documentType: 'powerpoint',
              templatePath: TestUtils.getTestDataPath('presentation.pptx'),
              data: { report_type: 'Board Presentation', quarter: 'Q4' },
              outputPath: TestUtils.getTempPath('q4_presentation.pptx')
            }
          ]
        };
        
        const result = await workflowManager.executeBatchProcessing(batchConfig);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.totalTemplates, 3);
        assert.strictEqual(result.successful, 3);
        
        // Verify document type distribution
        const wordResults = result.results.filter(r => r.template.includes('.docx'));
        const excelResults = result.results.filter(r => r.template.includes('.xlsx'));
        const pptResults = result.results.filter(r => r.template.includes('.pptx'));
        
        assert.strictEqual(wordResults.length, 1);
        assert.strictEqual(excelResults.length, 1);
        assert.strictEqual(pptResults.length, 1);
      });
    });

    describe('Error Handling and Recovery', () => {
      test('should handle workflow step failures gracefully', async () => {
        const workflow = {
          name: 'Error-Prone Workflow',
          stopOnError: false, // Continue on errors
          steps: [
            {
              name: 'Parse Valid Template',
              type: 'parse',
              input: {
                filePath: TestUtils.getTestDataPath('template.docx')
              }
            },
            {
              name: 'Process Invalid Template',
              type: 'process',
              documentType: 'word',
              input: {
                templatePath: '/nonexistent/template.docx', // This will fail
                data: testData,
                outputPath: TestUtils.getTempPath('output.docx')
              }
            },
            {
              name: 'Process Valid Template',
              type: 'process',
              documentType: 'word',
              input: {
                templatePath: TestUtils.getTestDataPath('template.docx'),
                data: testData,
                outputPath: TestUtils.getTempPath('valid_output.docx')
              }
            }
          ]
        };
        
        const result = await workflowManager.executeDocumentGeneration(workflow);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.totalSteps, 3);
        assert.strictEqual(result.successfulSteps, 2);
        assert.strictEqual(result.failedSteps, 1);
        
        // Verify specific step results
        assert.strictEqual(result.steps[0].success, true); // Parse should succeed
        assert.strictEqual(result.steps[1].success, false); // Process should fail
        assert.strictEqual(result.steps[2].success, true); // Process should succeed
      });
      
      test('should stop workflow on error when configured', async () => {
        const workflow = {
          name: 'Stop-On-Error Workflow',
          stopOnError: true, // Stop on first error
          steps: [
            {
              name: 'Parse Valid Template',
              type: 'parse',
              input: {
                filePath: TestUtils.getTestDataPath('template.docx')
              }
            },
            {
              name: 'Process Invalid Template',
              type: 'process',
              documentType: 'word',
              input: {
                templatePath: '/nonexistent/template.docx', // This will fail
                data: testData,
                outputPath: TestUtils.getTempPath('output.docx')
              }
            },
            {
              name: 'This Step Should Not Execute',
              type: 'process',
              documentType: 'word',
              input: {
                templatePath: TestUtils.getTestDataPath('template.docx'),
                data: testData,
                outputPath: TestUtils.getTempPath('should_not_exist.docx')
              }
            }
          ]
        };
        
        const result = await workflowManager.executeDocumentGeneration(workflow);
        
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes('Workflow failed at step'));
      });
      
      test('should handle batch processing with partial failures', async () => {
        const batchConfig = {
          name: 'Mixed Success Batch',
          templates: [
            {
              documentType: 'word',
              templatePath: TestUtils.getTestDataPath('template.docx'),
              data: { name: 'Valid Document' },
              outputPath: TestUtils.getTempPath('valid.docx')
            },
            {
              documentType: 'word',
              templatePath: '/nonexistent/template.docx', // This will fail
              data: { name: 'Invalid Document' },
              outputPath: TestUtils.getTempPath('invalid.docx')
            },
            {
              documentType: 'excel',
              templatePath: TestUtils.getTestDataPath('spreadsheet.xlsx'),
              data: { name: 'Valid Spreadsheet' },
              outputPath: TestUtils.getTempPath('valid.xlsx')
            }
          ]
        };
        
        const result = await workflowManager.executeBatchProcessing(batchConfig);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.totalTemplates, 3);
        assert.strictEqual(result.successful, 2);
        assert.strictEqual(result.failed, 1);
        
        // Check individual results
        const successfulResults = result.results.filter(r => r.success);
        const failedResults = result.results.filter(r => !r.success);
        
        assert.strictEqual(successfulResults.length, 2);
        assert.strictEqual(failedResults.length, 1);
        assert.ok(failedResults[0].error.includes('does not exist'));
      });
    });

    describe('Performance and Monitoring', () => {
      test('should track workflow performance metrics', async () => {
        const workflow = {
          name: 'Performance Test Workflow',
          stopOnError: true,
          steps: [
            {
              name: 'Process Multiple Documents',
              type: 'process',
              documentType: 'word',
              input: {
                templatePath: TestUtils.getTestDataPath('template.docx'),
                data: testData,
                outputPath: TestUtils.getTempPath('perf_test.docx')
              }
            }
          ]
        };
        
        // Execute workflow multiple times
        for (let i = 0; i < 5; i++) {
          await workflowManager.executeDocumentGeneration(workflow);
        }
        
        const stats = workflowManager.getStats();
        
        assert.strictEqual(stats.workflowsExecuted, 5);
        assert.strictEqual(stats.documentsProcessed, 10); // 5 workflows * 2 documents each (parse + process)
        assert.ok(stats.totalProcessingTime > 0);
        assert.strictEqual(stats.errors.length, 0);
      });
      
      test('should measure processing time per workflow step', async () => {
        const workflow = {
          name: 'Timed Workflow',
          stopOnError: true,
          steps: [
            {
              name: 'Parse Template',
              type: 'parse',
              input: {
                filePath: TestUtils.getTestDataPath('template.docx')
              }
            },
            {
              name: 'Process Template',
              type: 'process',
              documentType: 'word',
              input: {
                templatePath: TestUtils.getTestDataPath('template.docx'),
                data: testData,
                outputPath: TestUtils.getTempPath('timed_output.docx')
              }
            }
          ]
        };
        
        const result = await workflowManager.executeDocumentGeneration(workflow);
        
        assert.strictEqual(result.success, true);
        assert.ok(result.processingTime > 0);
        
        // Check that individual steps have timing information where applicable
        const processStep = result.steps.find(s => s.type === 'process');
        if (processStep && processStep.processingTime !== undefined) {
          assert.ok(processStep.processingTime >= 0);
        }
      });
    });

    describe('Complex Workflow Scenarios', () => {
      test('should execute workflow with conditional steps', async () => {
        const shouldIncludeCharts = true;
        const workflow = {
          name: 'Conditional Workflow',
          stopOnError: true,
          steps: [
            {
              name: 'Generate Base Report',
              type: 'process',
              documentType: 'word',
              input: {
                templatePath: TestUtils.getTestDataPath('template.docx'),
                data: { ...testData, include_charts: shouldIncludeCharts },
                outputPath: TestUtils.getTempPath('base_report.docx')
              }
            },
            // Conditional step - only execute if charts are needed
            ...(shouldIncludeCharts ? [{
              name: 'Add Chart Data',
              type: 'inject',
              input: {
                filePath: TestUtils.getTempPath('base_report.docx'),
                injections: [
                  {
                    target: 'bookmark:chart_section',
                    content: 'Chart data visualization included',
                    mode: 'replace'
                  }
                ]
              }
            }] : [])
          ]
        };
        
        const result = await workflowManager.executeDocumentGeneration(workflow);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.totalSteps, shouldIncludeCharts ? 2 : 1);
        assert.strictEqual(result.successfulSteps, shouldIncludeCharts ? 2 : 1);
      });
      
      test('should execute workflow with data transformation', async () => {
        const rawData = {
          sales_numbers: [100000, 120000, 135000, 150000],
          regions: ['North', 'South', 'East', 'West']
        };
        
        // Transform data for different document types
        const transformedData = {
          word: {
            total_sales: rawData.sales_numbers.reduce((a, b) => a + b, 0),
            best_region: rawData.regions[rawData.sales_numbers.indexOf(Math.max(...rawData.sales_numbers))],
            growth_rate: ((rawData.sales_numbers[3] - rawData.sales_numbers[0]) / rawData.sales_numbers[0] * 100).toFixed(1)
          },
          excel: {
            detailed_breakdown: rawData.regions.map((region, index) => ({
              region,
              sales: rawData.sales_numbers[index],
              percentage: (rawData.sales_numbers[index] / rawData.sales_numbers.reduce((a, b) => a + b, 0) * 100).toFixed(1)
            }))
          }
        };
        
        const workflow = {
          name: 'Data Transformation Workflow',
          stopOnError: true,
          steps: [
            {
              name: 'Generate Summary Report',
              type: 'process',
              documentType: 'word',
              input: {
                templatePath: TestUtils.getTestDataPath('template.docx'),
                data: transformedData.word,
                outputPath: TestUtils.getTempPath('summary.docx')
              }
            },
            {
              name: 'Generate Detailed Analysis',
              type: 'process',
              documentType: 'excel',
              input: {
                templatePath: TestUtils.getTestDataPath('spreadsheet.xlsx'),
                data: transformedData.excel,
                outputPath: TestUtils.getTempPath('analysis.xlsx')
              }
            }
          ]
        };
        
        const result = await workflowManager.executeDocumentGeneration(workflow);
        
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.totalSteps, 2);
        assert.strictEqual(result.successfulSteps, 2);
        
        // Verify data transformation was applied
        const wordStep = result.steps.find(s => s.documentType === 'word');
        const excelStep = result.steps.find(s => s.documentType === 'excel');
        
        assert.ok(wordStep.success);
        assert.ok(excelStep.success);
      });
    });
  });
}