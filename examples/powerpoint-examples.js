/**
 * @fileoverview PowerPoint Processor Usage Examples
 * Demonstrates all major features of the PowerPoint processor
 * 
 * @author Unjucks Team
 * @version 2.0.8
 * @since 2024-09-10
 */

import PowerPointProcessor from '../src/office/processors/powerpoint-processor.js';
import fs from 'fs-extra';
import path from 'path';

/**
 * Example 1: Basic Presentation Creation
 */
async function example1_BasicPresentation() {
  console.log('\n📊 Example 1: Basic Presentation Creation');
  
  const processor = new PowerPointProcessor({
    enableLogging: true,
    tempDir: './temp/powerpoint-examples'
  });
  
  // Create presentation with configuration
  const presentation = await processor.createPresentation({
    title: 'Company Overview',
    author: 'John Smith',
    subject: 'Quarterly Business Review',
    company: 'ACME Corporation',
    theme: 'corporate'
  });
  
  // Add title slide
  const titleSlide = presentation.pptx.addSlide();
  titleSlide.addText('ACME Corporation', {
    x: 1, y: 2, w: 8, h: 1.5,
    fontSize: 36, bold: true, color: '1f4e79',
    align: 'center'
  });
  
  titleSlide.addText('Quarterly Business Review', {
    x: 1, y: 3.5, w: 8, h: 1,
    fontSize: 24, color: '666666',
    align: 'center'
  });
  
  titleSlide.addText('Q3 2024 Results', {
    x: 1, y: 5, w: 8, h: 1,
    fontSize: 20, color: '333333',
    align: 'center'
  });
  
  // Add content slide
  const contentSlide = presentation.pptx.addSlide();
  contentSlide.addText('Key Achievements', {
    x: 1, y: 0.5, w: 8, h: 1,
    fontSize: 28, bold: true, color: '1f4e79'
  });
  
  const bulletPoints = [
    'Revenue increased by 25% year-over-year',
    'Launched 3 new products successfully',
    'Expanded to 5 new markets',
    'Customer satisfaction improved to 95%'
  ];
  
  bulletPoints.forEach((point, index) => {
    contentSlide.addText(`• ${point}`, {
      x: 1.5, y: 2 + (index * 0.8), w: 7, h: 0.6,
      fontSize: 16, color: '333333'
    });
  });
  
  // Export presentation
  await fs.ensureDir('./examples/output');
  const result = await processor.exportPresentation(
    presentation.id,
    './examples/output/basic-presentation.pptx'
  );
  
  console.log('✅ Basic presentation created:', result.outputPath);
  processor.cleanupPresentation(presentation.id);
}

/**
 * Example 2: Template-Based Generation
 */
async function example2_TemplateGeneration() {
  console.log('\n🎨 Example 2: Template-Based Generation');
  
  const processor = new PowerPointProcessor({
    enableLogging: true
  });
  
  // Create template directory and template
  const templateDir = './temp/powerpoint-templates';
  await fs.ensureDir(templateDir);
  
  const productTemplate = {
    id: 'product-showcase',
    name: 'Product Showcase Template',
    layout: 'LAYOUT_16x9',
    elements: [
      {
        type: 'text',
        text: '{{product.name}}',
        x: 1, y: 0.5, width: 8, height: 1,
        fontSize: 32, bold: true, color: '2c3e50'
      },
      {
        type: 'text',
        text: '{{product.description}}',
        x: 1, y: 2, width: 8, height: 2,
        fontSize: 16, color: '666666'
      },
      {
        type: 'text',
        text: 'Price: ${{product.price}}',
        x: 1, y: 4.5, width: 4, height: 0.8,
        fontSize: 20, bold: true, color: 'e74c3c'
      },
      {
        type: 'text',
        text: 'Category: {{product.category}}',
        x: 5, y: 4.5, width: 4, height: 0.8,
        fontSize: 16, color: '7f8c8d'
      },
      {
        type: 'shape',
        shape: 'RECTANGLE',
        x: 1, y: 6, width: 8, height: 0.1,
        fill: '3498db'
      }
    ]
  };
  
  await fs.writeJson(
    path.join(templateDir, 'product-showcase.json'),
    productTemplate,
    { spaces: 2 }
  );
  
  // Load templates
  await processor.loadTemplates(templateDir);
  
  // Create presentation
  const presentation = await processor.createPresentation({
    title: 'Product Catalog',
    theme: 'modern'
  });
  
  // Product data
  const products = [
    {
      name: 'Wireless Headphones Pro',
      description: 'Premium noise-canceling headphones with 30-hour battery life and studio-quality sound.',
      price: 299,
      category: 'Audio Equipment'
    },
    {
      name: 'Smart Fitness Tracker',
      description: 'Advanced health monitoring with GPS, heart rate tracking, and sleep analysis.',
      price: 199,
      category: 'Wearable Technology'
    },
    {
      name: 'Portable Power Bank',
      description: 'High-capacity 20,000mAh power bank with fast charging and wireless charging pad.',
      price: 79,
      category: 'Mobile Accessories'
    }
  ];
  
  // Generate slides for each product
  for (const product of products) {
    await processor.generateFromTemplate(
      presentation.id,
      'product-showcase',
      { product }
    );
  }
  
  // Export presentation
  const result = await processor.exportPresentation(
    presentation.id,
    './examples/output/template-based-presentation.pptx'
  );
  
  console.log('✅ Template-based presentation created:', result.outputPath);
  processor.cleanupPresentation(presentation.id);
  
  // Cleanup
  await fs.remove(templateDir);
}

/**
 * Example 3: Charts and Data Visualization
 */
async function example3_ChartsAndVisualization() {
  console.log('\n📈 Example 3: Charts and Data Visualization');
  
  const processor = new PowerPointProcessor({
    enableLogging: true
  });
  
  const presentation = await processor.createPresentation({
    title: 'Sales Analytics Dashboard',
    theme: 'elegant'
  });
  
  // Slide 1: Bar Chart - Quarterly Sales
  const chartSlide1 = presentation.pptx.addSlide();
  chartSlide1.addText('Quarterly Sales Performance', {
    x: 1, y: 0.5, w: 8, h: 1,
    fontSize: 24, bold: true, color: '2c3e50'
  });
  
  chartSlide1.addChart('BAR', [
    {
      name: 'Sales (in thousands)',
      labels: ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024*'],
      values: [245, 312, 298, 387]
    }
  ], {
    x: 1, y: 1.5, w: 8, h: 4,
    title: 'Revenue by Quarter',
    showTitle: true
  });
  
  chartSlide1.addText('* Q4 projected', {
    x: 1, y: 6, w: 8, h: 0.5,
    fontSize: 12, italic: true, color: '666666'
  });
  
  // Slide 2: Pie Chart - Market Share
  const chartSlide2 = presentation.pptx.addSlide();
  chartSlide2.addText('Market Share Analysis', {
    x: 1, y: 0.5, w: 8, h: 1,
    fontSize: 24, bold: true, color: '2c3e50'
  });
  
  chartSlide2.addChart('PIE', [
    { name: 'ACME Corp', values: [35] },
    { name: 'Competitor A', values: [28] },
    { name: 'Competitor B', values: [20] },
    { name: 'Others', values: [17] }
  ], {
    x: 2, y: 1.5, w: 6, h: 4,
    title: 'Market Share Distribution',
    showTitle: true
  });
  
  // Slide 3: Line Chart - Growth Trend
  const chartSlide3 = presentation.pptx.addSlide();
  chartSlide3.addText('Growth Trend (12 Months)', {
    x: 1, y: 0.5, w: 8, h: 1,
    fontSize: 24, bold: true, color: '2c3e50'
  });
  
  chartSlide3.addChart('LINE', [
    {
      name: 'Revenue Growth %',
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      values: [5, 8, 12, 15, 18, 22, 25, 23, 28, 32, 35, 38]
    }
  ], {
    x: 1, y: 1.5, w: 8, h: 4,
    title: 'Monthly Growth Rate',
    showTitle: true
  });
  
  const result = await processor.exportPresentation(
    presentation.id,
    './examples/output/charts-presentation.pptx'
  );
  
  console.log('✅ Charts presentation created:', result.outputPath);
  processor.cleanupPresentation(presentation.id);
}

/**
 * Example 4: Dynamic Slides from Data Array
 */
async function example4_DynamicSlides() {
  console.log('\n🔄 Example 4: Dynamic Slides from Data Array');
  
  const processor = new PowerPointProcessor({
    enableLogging: true
  });
  
  const presentation = await processor.createPresentation({
    title: 'Employee Performance Review',
    author: 'HR Department'
  });
  
  // Employee data
  const employees = [
    {
      name: 'Alice Johnson',
      department: 'Engineering',
      role: 'Senior Developer',
      rating: 4.8,
      achievements: ['Led the mobile app redesign', 'Mentored 3 junior developers', 'Improved code quality by 40%'],
      goals: 'Advance to Tech Lead position'
    },
    {
      name: 'Bob Smith',
      department: 'Marketing',
      role: 'Marketing Manager',
      rating: 4.6,
      achievements: ['Increased social media engagement by 65%', 'Launched successful product campaign', 'Managed $500K budget'],
      goals: 'Expand digital marketing expertise'
    },
    {
      name: 'Carol Davis',
      department: 'Sales',
      role: 'Account Executive',
      rating: 4.9,
      achievements: ['Exceeded quota by 150%', 'Secured 3 major clients', 'Built strategic partnerships'],
      goals: 'Transition to Sales Director role'
    }
  ];
  
  const slideConfig = {
    layout: 'LAYOUT_16x9',
    elements: [
      {
        type: 'text',
        text: '{{name}}',
        x: 1, y: 0.5, width: 6, height: 1,
        fontSize: 28, bold: true, color: '2980b9'
      },
      {
        type: 'text',
        text: '{{role}} • {{department}}',
        x: 1, y: 1.5, width: 6, height: 0.6,
        fontSize: 18, color: '7f8c8d'
      },
      {
        type: 'text',
        text: 'Performance Rating: {{rating}}/5.0',
        x: 7, y: 0.5, width: 2.5, height: 1,
        fontSize: 20, bold: true, color: 'e74c3c',
        align: 'center'
      },
      {
        type: 'text',
        text: 'Key Achievements:',
        x: 1, y: 2.5, width: 8, height: 0.6,
        fontSize: 18, bold: true, color: '2c3e50'
      },
      {
        type: 'text',
        text: '• {{achievements.0}}\n• {{achievements.1}}\n• {{achievements.2}}',
        x: 1.5, y: 3.2, width: 7, height: 2,
        fontSize: 14, color: '333333'
      },
      {
        type: 'text',
        text: 'Career Goals:',
        x: 1, y: 5.5, width: 8, height: 0.6,
        fontSize: 18, bold: true, color: '2c3e50'
      },
      {
        type: 'text',
        text: '{{goals}}',
        x: 1.5, y: 6.2, width: 7, height: 1,
        fontSize: 14, color: '333333'
      }
    ]
  };
  
  // Generate slides dynamically
  const result = await processor.generateFromDataArray(
    presentation.id,
    employees,
    slideConfig,
    {
      addSlideNumbers: true,
      continueOnError: false
    }
  );
  
  console.log(`✅ Generated ${result.results.length} employee review slides`);
  
  const exportResult = await processor.exportPresentation(
    presentation.id,
    './examples/output/dynamic-slides-presentation.pptx'
  );
  
  console.log('✅ Dynamic presentation created:', exportResult.outputPath);
  processor.cleanupPresentation(presentation.id);
}

/**
 * Example 5: SmartArt and Advanced Shapes
 */
async function example5_SmartArtShapes() {
  console.log('\n🎨 Example 5: SmartArt and Advanced Shapes');
  
  const processor = new PowerPointProcessor({
    enableLogging: true
  });
  
  const presentation = await processor.createPresentation({
    title: 'Process Documentation',
    theme: 'modern'
  });
  
  // Slide 1: Process Flow
  const processSlide = presentation.pptx.addSlide();
  processSlide.addText('Software Development Process', {
    x: 1, y: 0.5, w: 8, h: 1,
    fontSize: 24, bold: true, color: '0078d4'
  });
  
  const processSteps = [
    { text: 'Planning' },
    { text: 'Design' },
    { text: 'Development' },
    { text: 'Testing' },
    { text: 'Deployment' }
  ];
  
  processor.createSmartArtProcess(processSlide, {
    x: 0.5, y: 2, itemWidth: 1.8, spacing: 0.2
  }, processSteps);
  
  // Slide 2: Organizational Hierarchy
  const orgSlide = presentation.pptx.addSlide();
  orgSlide.addText('Team Structure', {
    x: 1, y: 0.5, w: 8, h: 1,
    fontSize: 24, bold: true, color: '0078d4'
  });
  
  const orgStructure = [
    { text: 'Project Manager' },
    { text: 'Frontend Dev' },
    { text: 'Backend Dev' },
    { text: 'QA Engineer' }
  ];
  
  processor.createSmartArtHierarchy(orgSlide, {
    x: 1, y: 1.5, itemWidth: 2, itemHeight: 0.8
  }, orgStructure);
  
  // Slide 3: Feature List
  const featuresSlide = presentation.pptx.addSlide();
  featuresSlide.addText('Key Features', {
    x: 1, y: 0.5, w: 8, h: 1,
    fontSize: 24, bold: true, color: '0078d4'
  });
  
  const features = [
    { text: 'User Authentication' },
    { text: 'Real-time Notifications' },
    { text: 'Data Analytics' },
    { text: 'Mobile Responsive' }
  ];
  
  processor.createSmartArtList(featuresSlide, {
    x: 2, y: 2, width: 5, itemHeight: 0.8, spacing: 0.3,
    itemFill: '00bcf2'
  }, features);
  
  const result = await processor.exportPresentation(
    presentation.id,
    './examples/output/smartart-presentation.pptx'
  );
  
  console.log('✅ SmartArt presentation created:', result.outputPath);
  processor.cleanupPresentation(presentation.id);
}

/**
 * Example 6: Batch Processing
 */
async function example6_BatchProcessing() {
  console.log('\n⚡ Example 6: Batch Processing');
  
  const processor = new PowerPointProcessor({
    enableLogging: true
  });
  
  // Create batch jobs
  const batchJobs = [
    {
      id: 'monthly-report-jan',
      type: 'dataArray',
      config: { title: 'January Monthly Report', author: 'Analytics Team' },
      dataArray: [
        { metric: 'Revenue', value: '$125,000', change: '+12%' },
        { metric: 'New Customers', value: '342', change: '+8%' },
        { metric: 'Retention Rate', value: '94%', change: '+2%' }
      ],
      slideConfig: {
        elements: [
          { type: 'text', text: '{{metric}}', x: 1, y: 2, fontSize: 24, bold: true },
          { type: 'text', text: '{{value}}', x: 1, y: 3, fontSize: 32, color: '27ae60' },
          { type: 'text', text: '{{change}}', x: 1, y: 4, fontSize: 18, color: '2980b9' }
        ]
      },
      outputPath: './examples/output/batch-january-report.pptx'
    },
    {
      id: 'monthly-report-feb',
      type: 'dataArray',
      config: { title: 'February Monthly Report', author: 'Analytics Team' },
      dataArray: [
        { metric: 'Revenue', value: '$138,500', change: '+18%' },
        { metric: 'New Customers', value: '389', change: '+15%' },
        { metric: 'Retention Rate', value: '96%', change: '+4%' }
      ],
      slideConfig: {
        elements: [
          { type: 'text', text: '{{metric}}', x: 1, y: 2, fontSize: 24, bold: true },
          { type: 'text', text: '{{value}}', x: 1, y: 3, fontSize: 32, color: '27ae60' },
          { type: 'text', text: '{{change}}', x: 1, y: 4, fontSize: 18, color: '2980b9' }
        ]
      },
      outputPath: './examples/output/batch-february-report.pptx'
    }
  ];
  
  // Process batch with progress tracking
  let processedCount = 0;
  const results = await processor.batchProcess(batchJobs, {
    maxConcurrent: 2,
    continueOnError: true,
    progressCallback: (progress) => {
      console.log(`Progress: ${progress.processed}/${progress.total} completed`);
    },
    defaultVariables: {
      company: 'ACME Corporation',
      department: 'Analytics'
    }
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`✅ Batch processing completed: ${successCount}/${results.length} successful`);
  
  results.forEach(result => {
    if (result.success) {
      console.log(`  ✓ ${result.jobId}: ${result.outputPath}`);
    } else {
      console.log(`  ✗ ${result.jobId}: ${result.error}`);
    }
  });
}

/**
 * Example 7: Speaker Notes and Comments
 */
async function example7_NotesAndComments() {
  console.log('\n🗣️ Example 7: Speaker Notes and Comments');
  
  const processor = new PowerPointProcessor({
    enableLogging: true
  });
  
  const presentation = await processor.createPresentation({
    title: 'Product Launch Presentation',
    author: 'Marketing Team'
  });
  
  // Add slide with content
  const slide = presentation.pptx.addSlide();
  slide.addText('Introducing Our New Product', {
    x: 1, y: 2, w: 8, h: 1.5,
    fontSize: 32, bold: true, color: '2c3e50',
    align: 'center'
  });
  
  slide.addText('Revolutionary features that will change the market', {
    x: 1, y: 4, w: 8, h: 1,
    fontSize: 18, color: '666666',
    align: 'center'
  });
  
  // Add speaker notes
  await processor.addSpeakerNotes(
    presentation.id,
    1,
    'Welcome the audience and mention the excitement about the launch. ' +
    'Highlight that this product represents 2 years of R&D investment. ' +
    'Pause for questions after the introduction.'
  );
  
  // Add comments
  await processor.addComment(presentation.id, 1, {
    author: 'Sarah Johnson',
    text: 'Consider adding company logo to this slide',
    timestamp: Date.now()
  });
  
  await processor.addComment(presentation.id, 1, {
    author: 'Mike Chen',
    text: 'The subtitle could be more specific about the key features',
    timestamp: Date.now()
  });
  
  const result = await processor.exportPresentation(
    presentation.id,
    './examples/output/notes-comments-presentation.pptx'
  );
  
  // Show presentation info
  const info = processor.getPresentationInfo(presentation.id);
  console.log('✅ Presentation with notes and comments created');
  console.log(`   Comments: ${presentation.comments?.length || 0}`);
  console.log(`   File: ${result.outputPath}`);
  
  processor.cleanupPresentation(presentation.id);
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('🚀 PowerPoint Processor - Complete Examples');
  console.log('='.repeat(50));
  
  await fs.ensureDir('./examples/output');
  
  try {
    await example1_BasicPresentation();
    await example2_TemplateGeneration();
    await example3_ChartsAndVisualization();
    await example4_DynamicSlides();
    await example5_SmartArtShapes();
    await example6_BatchProcessing();
    await example7_NotesAndComments();
    
    console.log('\n🎉 All examples completed successfully!');
    console.log('📁 Check ./examples/output/ for generated presentations');
    
  } catch (error) {
    console.error('\n❌ Error running examples:', error.message);
    console.error(error.stack);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}

export {
  example1_BasicPresentation,
  example2_TemplateGeneration,
  example3_ChartsAndVisualization,
  example4_DynamicSlides,
  example5_SmartArtShapes,
  example6_BatchProcessing,
  example7_NotesAndComments,
  runAllExamples
};