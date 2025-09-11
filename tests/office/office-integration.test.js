import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';
import { OfficeInjector } from '../../src/office/injectors/office-injector.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Integration tests for the Office injection system
 * Tests end-to-end scenarios with real-world use cases
 */
describe('Office Integration Tests', () => {
  let injector;
  let testDir;
  let sampleFiles;

  beforeEach(async () => {
    // Setup test environment
    injector = new OfficeInjector({
      preserveFormatting: true,
      validateInputs: true,
      dryRun: false
    });

    testDir = path.join(__dirname, 'integration_test_files');
    await fs.ensureDir(testDir);

    // Create sample Office files for testing
    sampleFiles = {
      report: path.join(testDir, 'monthly_report.docx'),
      spreadsheet: path.join(testDir, 'sales_data.xlsx'),
      presentation: path.join(testDir, 'quarterly_review.pptx')
    };

    // Create mock Office files
    for (const filePath of Object.values(sampleFiles)) {
      await fs.writeFile(filePath, Buffer.alloc(0));
    }
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('Document Generation Workflow', () => {
    it('should generate a complete monthly report', async () => {
      const reportConfig = {
        filePath: sampleFiles.report,
        injections: [
          {
            id: 'title',
            target: 'bookmark:title',
            content: 'Monthly Sales Report - December 2024',
            mode: 'replace',
            type: 'text',
            formatting: {
              bold: true,
              fontSize: 16,
              color: '2E75B6',
              alignment: 'center'
            }
          },
          {
            id: 'executive_summary',
            target: 'bookmark:summary',
            content: 'Sales increased by 15% compared to previous month. Key growth drivers include new product launches and expanded market reach.',
            mode: 'replace',
            type: 'text',
            formatting: {
              fontSize: 12,
              alignment: 'justify'
            }
          },
          {
            id: 'sales_figure',
            target: 'bookmark:total_sales',
            content: '$1,250,000',
            mode: 'replace',
            type: 'text',
            formatting: {
              bold: true,
              fontSize: 14,
              color: '70AD47'
            }
          },
          {
            id: 'growth_percentage',
            target: 'bookmark:growth',
            content: '+15.3%',
            mode: 'replace',
            type: 'text',
            formatting: {
              bold: true,
              color: '70AD47'
            }
          },
          {
            id: 'top_products',
            target: 'table:1:cell:2,1',
            content: 'Product A\nProduct B\nProduct C',
            mode: 'replace',
            type: 'text'
          },
          {
            id: 'footer_date',
            target: 'footer:default',
            content: `Generated on ${new Date().toLocaleDateString()}`,
            mode: 'replace',
            type: 'text',
            formatting: {
              fontSize: 10,
              italics: true,
              alignment: 'right'
            }
          }
        ]
      };

      const result = await injector.injectFile(reportConfig);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.injections.length, 6);
      assert.strictEqual(result.errors.length, 0);
      
      // Verify specific injections
      const titleInjection = result.injections.find(inj => inj.injection === 'title');
      assert.ok(titleInjection);
      assert.strictEqual(titleInjection.target, 'bookmark:title');
      assert.ok(titleInjection.content.includes('December 2024'));
    });

    it('should populate sales spreadsheet with data', async () => {
      const spreadsheetConfig = {
        filePath: sampleFiles.spreadsheet,
        injections: [
          {
            id: 'header_row',
            target: 'Sheet1:A1:E1',
            content: [['Month', 'Sales', 'Profit', 'Growth %', 'Target']],
            mode: 'replace',
            type: 'text',
            formatting: {
              font: { bold: true, color: 'FFFFFF' },
              fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E75B6' } }
            }
          },
          {
            id: 'january_data',
            target: 'Sheet1:A2:E2',
            content: [['January', 950000, 142500, '12.5%', 900000]],
            mode: 'replace',
            type: 'text'
          },
          {
            id: 'february_data', 
            target: 'Sheet1:A3:E3',
            content: [['February', 1080000, 162000, '13.7%', 1000000]],
            mode: 'replace',
            type: 'text'
          },
          {
            id: 'march_data',
            target: 'Sheet1:A4:E4',
            content: [['March', 1250000, 187500, '15.3%', 1100000]],
            mode: 'replace',
            type: 'text'
          },
          {
            id: 'total_formula',
            target: 'Sheet1:B5',
            content: '=SUM(B2:B4)',
            mode: 'replace',
            type: 'text',
            formatting: {
              font: { bold: true },
              border: { top: { style: 'thin' } }
            }
          },
          {
            id: 'chart_title',
            target: 'namedRange:ChartTitle',
            content: 'Q1 Sales Performance',
            mode: 'replace',
            type: 'text',
            formatting: {
              font: { size: 14, bold: true }
            }
          }
        ]
      };

      const result = await injector.injectFile(spreadsheetConfig);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.injections.length, 6);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should create quarterly presentation slides', async () => {
      const presentationConfig = {
        filePath: sampleFiles.presentation,
        injections: [
          {
            id: 'title_slide',
            target: 'slide:1:placeholder:title',
            content: 'Q4 2024 Business Review',
            mode: 'replace',
            type: 'text',
            formatting: {
              fontSize: 28,
              bold: true,
              color: '2E75B6',
              align: 'center'
            }
          },
          {
            id: 'subtitle',
            target: 'slide:1:placeholder:subtitle',
            content: 'Performance Highlights & Strategic Outlook',
            mode: 'replace',
            type: 'text',
            formatting: {
              fontSize: 18,
              color: '666666',
              align: 'center'
            }
          },
          {
            id: 'agenda_slide',
            target: 'slide:2:placeholder:title',
            content: 'Agenda',
            mode: 'replace',
            type: 'text'
          },
          {
            id: 'agenda_items',
            target: 'slide:2:placeholder:content',
            content: '• Financial Performance\n• Market Analysis\n• Strategic Initiatives\n• 2025 Outlook\n• Q&A',
            mode: 'replace',
            type: 'text',
            formatting: {
              fontSize: 20
            }
          },
          {
            id: 'financial_title',
            target: 'slide:3:placeholder:title',
            content: 'Financial Performance',
            mode: 'replace',
            type: 'text'
          },
          {
            id: 'revenue_chart',
            target: 'slide:3:chart:bar',
            content: [
              {
                name: 'Q1',
                labels: ['Jan', 'Feb', 'Mar'],
                values: [950, 1080, 1250]
              },
              {
                name: 'Q2',
                labels: ['Apr', 'May', 'Jun'],
                values: [1100, 1200, 1350]
              }
            ],
            mode: 'replace',
            type: 'json',
            formatting: {
              title: 'Monthly Revenue (K$)',
              x: 2,
              y: 2,
              width: 6,
              height: 4
            }
          }
        ]
      };

      const result = await injector.injectFile(presentationConfig);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.injections.length, 6);
      assert.strictEqual(result.errors.length, 0);
    });
  });

  describe('Multi-File Campaign Generation', () => {
    it('should generate coordinated campaign materials', async () => {
      const campaignData = {
        productName: 'CloudSync Pro',
        launchDate: '2024-Q2',
        targetRevenue: '$2.5M',
        keyFeatures: ['Real-time sync', 'Enterprise security', 'Mobile apps', 'API integration'],
        marketSegments: ['Enterprise', 'SMB', 'Developers']
      };

      const batchConfig = [
        // Executive brief document
        {
          filePath: sampleFiles.report,
          injections: [
            {
              target: 'bookmark:product_name',
              content: campaignData.productName,
              mode: 'replace'
            },
            {
              target: 'bookmark:launch_date',
              content: campaignData.launchDate,
              mode: 'replace'
            },
            {
              target: 'bookmark:revenue_target',
              content: campaignData.targetRevenue,
              mode: 'replace',
              formatting: { bold: true, color: '70AD47' }
            },
            {
              target: 'table:1:cell:1,1',
              content: campaignData.keyFeatures.join('\n'),
              mode: 'replace'
            }
          ]
        },
        
        // Financial projections spreadsheet
        {
          filePath: sampleFiles.spreadsheet,
          injections: [
            {
              target: 'Sheet1:A1',
              content: `${campaignData.productName} - Financial Projections`,
              mode: 'replace',
              formatting: { font: { bold: true, size: 14 } }
            },
            {
              target: 'Sheet1:B3',
              content: campaignData.targetRevenue,
              mode: 'replace',
              formatting: { numFmt: '$#,##0' }
            },
            {
              target: 'namedRange:ProductName',
              content: campaignData.productName,
              mode: 'replace'
            }
          ]
        },
        
        // Marketing presentation
        {
          filePath: sampleFiles.presentation,
          injections: [
            {
              target: 'slide:1:placeholder:title',
              content: `Introducing ${campaignData.productName}`,
              mode: 'replace',
              formatting: { fontSize: 32, bold: true }
            },
            {
              target: 'slide:2:placeholder:content',
              content: campaignData.keyFeatures.map(f => `• ${f}`).join('\n'),
              mode: 'replace'
            },
            {
              target: 'slide:3:table:1',
              content: campaignData.marketSegments.map(segment => [segment, 'High', 'Q2-Q3']),
              mode: 'replace'
            }
          ]
        }
      ];

      const result = await injector.batchInject(batchConfig, {
        concurrency: 2,
        continueOnError: false
      });

      assert.strictEqual(result.success.length, 3);
      assert.strictEqual(result.failed.length, 0);
      assert.strictEqual(result.totalInjections, 10);
      assert.strictEqual(result.totalErrors, 0);
    });
  });

  describe('Complex Data Integration', () => {
    it('should handle dynamic content with conditional injection', async () => {
      const quarterData = {
        quarter: 'Q4',
        year: '2024',
        revenue: 5200000,
        growth: 18.5,
        target: 5000000
      };

      const isTargetMet = quarterData.revenue >= quarterData.target;
      const performanceMessage = isTargetMet 
        ? 'Exceeded target - Outstanding performance!' 
        : 'Below target - Needs attention';
      const statusColor = isTargetMet ? '70AD47' : 'C5504B';

      const dynamicConfig = {
        filePath: sampleFiles.report,
        injections: [
          {
            target: 'bookmark:quarter_year',
            content: `${quarterData.quarter} ${quarterData.year}`,
            mode: 'replace'
          },
          {
            target: 'bookmark:revenue',
            content: `$${(quarterData.revenue / 1000000).toFixed(1)}M`,
            mode: 'replace',
            formatting: { bold: true, fontSize: 16 }
          },
          {
            target: 'bookmark:growth_rate',
            content: `+${quarterData.growth}%`,
            mode: 'replace',
            formatting: { color: '70AD47', bold: true }
          },
          {
            target: 'bookmark:performance_status',
            content: performanceMessage,
            mode: 'replace',
            formatting: { color: statusColor, bold: true }
          },
          {
            target: 'bookmark:congratulations',
            content: 'Team congratulations message and bonus announcement.',
            mode: 'replace',
            skipIf: !isTargetMet // Only show if target was met
          },
          {
            target: 'bookmark:improvement_plan',
            content: 'Action items for performance improvement next quarter.',
            mode: 'replace',
            skipIf: isTargetMet // Only show if target was not met
          }
        ]
      };

      const result = await injector.injectFile(dynamicConfig);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.injections.length, isTargetMet ? 5 : 5); // One conditional should be skipped
      assert.strictEqual(result.skipped.length, 1);
      
      // Verify the correct conditional content was included/excluded
      if (isTargetMet) {
        assert.ok(result.skipped.some(s => s.target === 'bookmark:improvement_plan'));
      } else {
        assert.ok(result.skipped.some(s => s.target === 'bookmark:congratulations'));
      }
    });
  });

  describe('Template Replication', () => {
    it('should create multiple documents from template with different data', async () => {
      const employees = [
        { name: 'Alice Johnson', department: 'Sales', performance: 'Excellent', bonus: 5000 },
        { name: 'Bob Smith', department: 'Engineering', performance: 'Good', bonus: 3000 },
        { name: 'Carol Davis', department: 'Marketing', performance: 'Outstanding', bonus: 7000 }
      ];

      const templatePath = sampleFiles.report;
      const outputDir = path.join(testDir, 'performance_reviews');
      await fs.ensureDir(outputDir);

      const batchConfigs = employees.map(employee => ({
        filePath: templatePath,
        outputPath: path.join(outputDir, `${employee.name.replace(' ', '_')}_review.docx`),
        injections: [
          {
            target: 'bookmark:employee_name',
            content: employee.name,
            mode: 'replace',
            formatting: { bold: true }
          },
          {
            target: 'bookmark:department',
            content: employee.department,
            mode: 'replace'
          },
          {
            target: 'bookmark:performance_rating',
            content: employee.performance,
            mode: 'replace',
            formatting: {
              color: employee.performance === 'Outstanding' ? '70AD47' : 
                     employee.performance === 'Excellent' ? '2E75B6' : '666666'
            }
          },
          {
            target: 'bookmark:bonus_amount',
            content: `$${employee.bonus.toLocaleString()}`,
            mode: 'replace',
            formatting: { bold: true, color: '70AD47' }
          },
          {
            target: 'bookmark:review_date',
            content: new Date().toLocaleDateString(),
            mode: 'replace'
          }
        ]
      }));

      const result = await injector.batchInject(batchConfigs);
      
      assert.strictEqual(result.success.length, 3);
      assert.strictEqual(result.failed.length, 0);
      assert.strictEqual(result.totalInjections, 15); // 5 injections × 3 employees
      
      // Verify output files were created
      const outputFiles = await fs.readdir(outputDir);
      assert.strictEqual(outputFiles.length, 3);
      assert.ok(outputFiles.includes('Alice_Johnson_review.docx'));
      assert.ok(outputFiles.includes('Bob_Smith_review.docx'));
      assert.ok(outputFiles.includes('Carol_Davis_review.docx'));
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle partial failures gracefully', async () => {
      const mixedConfig = [
        {
          filePath: sampleFiles.report,
          injections: [
            {
              target: 'bookmark:valid_target',
              content: 'This should work',
              mode: 'replace'
            }
          ]
        },
        {
          filePath: '/nonexistent/file.docx',
          injections: [
            {
              target: 'bookmark:any_target',
              content: 'This will fail',
              mode: 'replace'
            }
          ]
        },
        {
          filePath: sampleFiles.spreadsheet,
          injections: [
            {
              target: 'Sheet1:A1',
              content: 'This should also work',
              mode: 'replace'
            }
          ]
        }
      ];

      const result = await injector.batchInject(mixedConfig, {
        continueOnError: true
      });
      
      assert.strictEqual(result.success.length, 2);
      assert.strictEqual(result.failed.length, 1);
      assert.strictEqual(result.totalInjections, 2);
      assert.strictEqual(result.totalErrors, 1);
    });

    it('should validate all configurations before processing', async () => {
      const invalidConfigs = [
        {
          filePath: sampleFiles.report,
          injections: []
        },
        {
          filePath: sampleFiles.spreadsheet,
          // Missing injections array
        },
        {
          // Missing filePath
          injections: [
            {
              target: 'bookmark:test',
              content: 'Test'
            }
          ]
        }
      ];

      const validation = await injector.validateConfigurations(invalidConfigs);
      
      assert.strictEqual(validation.valid.length, 1); // First config is valid but has warnings
      assert.strictEqual(validation.invalid.length, 2);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large batch operations efficiently', async () => {
      // Create a large batch of injection operations
      const largeBatch = Array.from({ length: 20 }, (_, i) => ({
        filePath: sampleFiles.report,
        outputPath: path.join(testDir, `batch_output_${i}.docx`),
        injections: [
          {
            target: 'bookmark:sequence_number',
            content: `Document ${i + 1}`,
            mode: 'replace'
          },
          {
            target: 'bookmark:timestamp',
            content: new Date().toISOString(),
            mode: 'replace'
          }
        ]
      }));

      const startTime = Date.now();
      const result = await injector.batchInject(largeBatch, {
        concurrency: 5
      });
      const duration = Date.now() - startTime;

      assert.strictEqual(result.success.length, 20);
      assert.strictEqual(result.failed.length, 0);
      assert.strictEqual(result.totalInjections, 40); // 2 injections × 20 files
      
      // Should complete within reasonable time (adjust threshold as needed)
      assert.ok(duration < 30000, `Batch processing took too long: ${duration}ms`);
      
      // Verify memory usage doesn't grow excessively
      const memUsage = process.memoryUsage();
      assert.ok(memUsage.heapUsed < 500 * 1024 * 1024, 'Memory usage too high'); // 500MB threshold
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide comprehensive usage statistics', async () => {
      // Perform various operations to generate statistics
      await injector.injectFile({
        filePath: sampleFiles.report,
        injections: [
          { target: 'bookmark:test1', content: 'Test 1', mode: 'replace' },
          { target: 'bookmark:test2', content: 'Test 2', mode: 'replace' }
        ]
      });

      await injector.injectFile({
        filePath: sampleFiles.spreadsheet,
        injections: [
          { target: 'Sheet1:A1', content: 'Test', mode: 'replace' }
        ]
      });

      const stats = injector.getStatistics();
      
      assert.ok(stats.wordInjections);
      assert.ok(stats.excelInjections);
      assert.ok(stats.powerPointInjections);
      assert.ok(typeof stats.totalProcessedFiles === 'number');
      assert.ok(typeof stats.successRate === 'number');
      
      // Verify stats reflect actual operations
      assert.ok(stats.wordInjections.attempted >= 2);
      assert.ok(stats.excelInjections.attempted >= 1);
    });

    it('should allow statistics reset', async () => {
      // Generate some statistics
      await injector.injectFile({
        filePath: sampleFiles.report,
        injections: [
          { target: 'bookmark:test', content: 'Test', mode: 'replace' }
        ]
      });

      let stats = injector.getStatistics();
      assert.ok(stats.wordInjections.attempted > 0);

      // Reset and verify
      injector.resetStatistics();
      stats = injector.getStatistics();
      
      assert.strictEqual(stats.wordInjections.attempted, 0);
      assert.strictEqual(stats.excelInjections.attempted, 0);
      assert.strictEqual(stats.powerPointInjections.attempted, 0);
    });
  });
});