#!/usr/bin/env node

import { OfficeInjector } from './injectors/office-injector.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Example usage of the Office file content injection system
 * Demonstrates various injection scenarios and capabilities
 */
async function demonstrateOfficeInjection() {
  console.log('🔧 Office File Content Injection System Demo\n');

  // Initialize the injector
  const injector = new OfficeInjector({
    preserveFormatting: true,
    validateInputs: true,
    dryRun: true, // Set to false to actually modify files
    force: false
  });

  console.log('📋 Available injection modes:', Object.values(OfficeInjector.INJECTION_MODES));
  console.log('📋 Available content types:', Object.values(OfficeInjector.CONTENT_TYPES));
  console.log('');

  // Example 1: Word document injection
  console.log('📝 Example 1: Word Document Injection');
  const wordConfig = {
    filePath: path.join(__dirname, 'examples', 'report_template.docx'),
    injections: [
      {
        id: 'title',
        target: 'bookmark:title',
        content: 'Q4 2024 Performance Report',
        mode: 'replace',
        type: 'text',
        formatting: {
          bold: true,
          fontSize: 18,
          color: '2E75B6',
          alignment: 'center'
        }
      },
      {
        id: 'summary',
        target: 'bookmark:executive_summary',
        content: 'Revenue increased by 23% this quarter, exceeding targets by $2.1M. Key growth drivers include new product launches and market expansion.',
        mode: 'replace',
        type: 'text',
        formatting: {
          alignment: 'justify'
        }
      },
      {
        id: 'metrics_table',
        target: 'table:1:cell:2,1',
        content: '$8.5M',
        mode: 'replace',
        type: 'text',
        formatting: {
          bold: true,
          color: '70AD47'
        }
      },
      {
        id: 'conditional_bonus',
        target: 'bookmark:bonus_announcement',
        content: 'Team bonus of $5,000 per employee will be distributed with next payroll.',
        mode: 'replace',
        type: 'text',
        skipIf: (doc, injection) => {
          // Only show bonus if revenue target was met
          return false; // Simulate target was met
        }
      }
    ],
    outputPath: path.join(__dirname, 'examples', 'generated_report.docx')
  };

  try {
    const wordResult = await injector.injectFile(wordConfig);
    console.log(`   ✅ Success: ${wordResult.injections.length} injections completed`);
    console.log(`   ⏭️  Skipped: ${wordResult.skipped.length} injections`);
    console.log(`   ❌ Errors: ${wordResult.errors.length} errors\n`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // Example 2: Excel spreadsheet injection
  console.log('📊 Example 2: Excel Spreadsheet Injection');
  const excelConfig = {
    filePath: path.join(__dirname, 'examples', 'sales_template.xlsx'),
    injections: [
      {
        id: 'header',
        target: 'Sheet1:A1:D1',
        content: [['Product', 'Q1 Sales', 'Q2 Sales', 'Total']],
        mode: 'replace',
        type: 'text',
        formatting: {
          font: { bold: true, color: 'FFFFFF' },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E75B6' } },
          alignment: { horizontal: 'center' }
        }
      },
      {
        id: 'product_data',
        target: 'Sheet1:A2:D4',
        content: [
          ['Product A', 125000, 145000, '=B2+C2'],
          ['Product B', 98000, 110000, '=B3+C3'],
          ['Product C', 156000, 189000, '=B4+C4']
        ],
        mode: 'replace',
        type: 'text',
        formatting: {
          numFmt: '$#,##0'
        }
      },
      {
        id: 'total_row',
        target: 'Sheet1:A5:D5',
        content: [['Total', '=SUM(B2:B4)', '=SUM(C2:C4)', '=SUM(D2:D4)']],
        mode: 'replace',
        type: 'text',
        formatting: {
          font: { bold: true },
          border: { top: { style: 'thin' } }
        }
      },
      {
        id: 'summary_cell',
        target: 'namedRange:SummaryText',
        content: 'Sales performance exceeded expectations with 18% growth over previous quarter.',
        mode: 'replace',
        type: 'text'
      }
    ],
    outputPath: path.join(__dirname, 'examples', 'generated_sales.xlsx')
  };

  try {
    const excelResult = await injector.injectFile(excelConfig);
    console.log(`   ✅ Success: ${excelResult.injections.length} injections completed`);
    console.log(`   ⏭️  Skipped: ${excelResult.skipped.length} injections`);
    console.log(`   ❌ Errors: ${excelResult.errors.length} errors\n`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // Example 3: PowerPoint presentation injection
  console.log('📽️ Example 3: PowerPoint Presentation Injection');
  const pptConfig = {
    filePath: path.join(__dirname, 'examples', 'presentation_template.pptx'),
    injections: [
      {
        id: 'title_slide',
        target: 'slide:1:placeholder:title',
        content: 'Product Launch Presentation',
        mode: 'replace',
        type: 'text',
        formatting: {
          fontSize: 32,
          bold: true,
          color: '2E75B6',
          align: 'center'
        }
      },
      {
        id: 'subtitle',
        target: 'slide:1:placeholder:subtitle',
        content: 'Revolutionary Features • Competitive Pricing • Market Ready',
        mode: 'replace',
        type: 'text',
        formatting: {
          fontSize: 18,
          color: '666666'
        }
      },
      {
        id: 'features_list',
        target: 'slide:2:placeholder:content',
        content: '• Advanced AI Integration\n• Real-time Collaboration\n• Enterprise Security\n• Mobile-First Design',
        mode: 'replace',
        type: 'text',
        formatting: {
          fontSize: 20
        }
      },
      {
        id: 'chart_data',
        target: 'slide:3:chart:bar',
        content: [
          {
            name: 'Market Share',
            labels: ['Competitor A', 'Competitor B', 'Our Product'],
            values: [25, 35, 40]
          }
        ],
        mode: 'replace',
        type: 'json',
        formatting: {
          title: 'Projected Market Share',
          width: 8,
          height: 5
        }
      },
      {
        id: 'contact_info',
        target: 'slide:4:textbox:1',
        content: 'Contact: sales@company.com | +1-555-0123',
        mode: 'replace',
        type: 'text',
        formatting: {
          fontSize: 14,
          align: 'center',
          backgroundColor: 'F0F0F0'
        }
      }
    ],
    outputPath: path.join(__dirname, 'examples', 'generated_presentation.pptx')
  };

  try {
    const pptResult = await injector.injectFile(pptConfig);
    console.log(`   ✅ Success: ${pptResult.injections.length} injections completed`);
    console.log(`   ⏭️  Skipped: ${pptResult.skipped.length} injections`);
    console.log(`   ❌ Errors: ${pptResult.errors.length} errors\n`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // Example 4: Batch processing multiple files
  console.log('🔄 Example 4: Batch Processing Multiple Files');
  const batchConfigs = [
    {
      filePath: path.join(__dirname, 'examples', 'template1.docx'),
      injections: [
        {
          target: 'bookmark:client_name',
          content: 'Acme Corporation',
          mode: 'replace'
        },
        {
          target: 'bookmark:date',
          content: this.getDeterministicDate().toLocaleDateString(),
          mode: 'replace'
        }
      ],
      outputPath: path.join(__dirname, 'examples', 'acme_report.docx')
    },
    {
      filePath: path.join(__dirname, 'examples', 'template2.xlsx'),
      injections: [
        {
          target: 'Sheet1:A1',
          content: 'Acme Corporation - Financial Summary',
          mode: 'replace'
        },
        {
          target: 'Sheet1:B3:D3',
          content: [['Revenue', 'Profit', 'Growth']],
          mode: 'replace'
        }
      ],
      outputPath: path.join(__dirname, 'examples', 'acme_financials.xlsx')
    }
  ];

  try {
    const batchResult = await injector.batchInject(batchConfigs, {
      concurrency: 2,
      continueOnError: true
    });
    
    console.log(`   ✅ Successful files: ${batchResult.success.length}`);
    console.log(`   ❌ Failed files: ${batchResult.failed.length}`);
    console.log(`   📊 Total injections: ${batchResult.totalInjections}`);
    console.log(`   ⚠️  Total errors: ${batchResult.totalErrors}\n`);
  } catch (error) {
    console.log(`   ❌ Batch Error: ${error.message}\n`);
  }

  // Example 5: Advanced features demonstration
  console.log('⚡ Example 5: Advanced Features');
  
  // Validation example
  console.log('   🔍 Validating configurations...');
  const validationResult = await injector.validateConfigurations([wordConfig, excelConfig]);
  console.log(`      Valid configs: ${validationResult.valid.length}`);
  console.log(`      Invalid configs: ${validationResult.invalid.length}`);
  
  // Statistics example
  console.log('   📈 Usage statistics:');
  const stats = injector.getStatistics();
  console.log(`      Total processed files: ${stats.totalProcessedFiles}`);
  console.log(`      Success rate: ${stats.successRate}%`);
  console.log(`      Word injections: ${stats.wordInjections.attempted} attempted, ${stats.wordInjections.successful} successful`);
  console.log(`      Excel injections: ${stats.excelInjections.attempted} attempted, ${stats.excelInjections.successful} successful`);
  console.log(`      PowerPoint injections: ${stats.powerPointInjections.attempted} attempted, ${stats.powerPointInjections.successful} successful`);
  
  // Injection specification helper
  console.log('\n   🛠️  Creating injection specs programmatically:');
  const spec = OfficeInjector.createInjectionSpec({
    target: 'bookmark:dynamic_content',
    content: `Generated at ${this.getDeterministicDate().toISOString()}`,
    mode: 'replace',
    formatting: { italics: true }
  });
  console.log(`      Spec ID: ${spec.id}`);
  console.log(`      Timestamp: ${spec.timestamp}`);
  console.log(`      Idempotent: ${spec.idempotent}`);
  
  console.log('\n🎉 Demo completed! Check the generated files in the examples directory.');
  console.log('\n💡 Tips:');
  console.log('   • Set dryRun: false to actually generate files');
  console.log('   • Use skipIf conditions for dynamic content');
  console.log('   • Batch process for efficiency with multiple files');
  console.log('   • Validate configurations before processing');
  console.log('   • Monitor statistics for performance insights');
}

// Run the demonstration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateOfficeInjection().catch(console.error);
}

export { demonstrateOfficeInjection };