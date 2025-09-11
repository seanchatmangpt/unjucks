/**
 * @fileoverview Smoke test for PowerPoint processor
 * Quick verification that the basic functionality works
 */

import PowerPointProcessor from '../src/office/processors/powerpoint-processor.js';
import fs from 'fs-extra';
import path from 'path';

async function runSmokeTest() {
  console.log('🧪 PowerPoint Processor Smoke Test');
  
  try {
    // Test 1: Create processor instance
    console.log('1️⃣ Creating PowerPoint processor...');
    const processor = new PowerPointProcessor({
      enableLogging: true,
      tempDir: './temp/powerpoint-test'
    });
    console.log('✅ PowerPoint processor created successfully');
    
    // Test 2: Create a presentation
    console.log('2️⃣ Creating presentation...');
    const presentation = await processor.createPresentation({
      title: 'Smoke Test Presentation',
      author: 'Test Suite',
      company: 'Unjucks Testing'
    });
    
    if (!presentation || !presentation.id) {
      throw new Error(`Failed to create presentation: ${presentation?.error || 'Unknown error'}`);
    }
    console.log('✅ Presentation created successfully');
    console.log(`   ID: ${presentation.id}`);
    console.log(`   Title: ${presentation.metadata.title}`);
    
    // Test 3: Add a simple slide
    console.log('3️⃣ Adding slide with text...');
    const slide = presentation.pptx.addSlide();
    slide.addText('Hello, PowerPoint World!', {
      x: 1,
      y: 2,
      w: 8,
      h: 1,
      fontSize: 24,
      bold: true,
      color: '333333'
    });
    
    slide.addText('This is a test slide created by the PowerPoint processor.', {
      x: 1,
      y: 3,
      w: 8,
      h: 2,
      fontSize: 16,
      color: '666666'
    });
    console.log('✅ Slide content added successfully');
    
    // Test 4: Export presentation
    console.log('4️⃣ Exporting presentation...');
    const outputDir = './temp/powerpoint-output';
    await fs.ensureDir(outputDir);
    const outputPath = path.join(outputDir, 'smoke-test.pptx');
    
    const exportResult = await processor.exportPresentation(
      presentation.id,
      outputPath
    );
    
    if (!exportResult.success) {
      throw new Error(`Failed to export presentation: ${exportResult.error}`);
    }
    console.log('✅ Presentation exported successfully');
    console.log(`   Path: ${exportResult.outputPath}`);
    console.log(`   Size: ${exportResult.size} bytes`);
    
    // Test 5: Verify file exists
    console.log('5️⃣ Verifying exported file...');
    const fileExists = await fs.pathExists(outputPath);
    if (!fileExists) {
      throw new Error('Exported file does not exist');
    }
    
    const stats = await fs.stat(outputPath);
    if (stats.size === 0) {
      throw new Error('Exported file is empty');
    }
    console.log('✅ Exported file verified');
    console.log(`   File size: ${stats.size} bytes`);
    
    // Test 6: Get processor statistics
    console.log('6️⃣ Getting processor statistics...');
    const processorStats = processor.getStatistics();
    console.log('✅ Statistics retrieved');
    console.log(`   Active presentations: ${processorStats.activePresentations}`);
    console.log(`   Loaded templates: ${processorStats.loadedTemplates}`);
    console.log(`   Error count: ${processorStats.errorCount}`);
    
    // Test 7: Clean up
    console.log('7️⃣ Cleaning up...');
    processor.cleanupPresentation(presentation.id);
    await fs.remove('./temp/powerpoint-test');
    console.log('✅ Cleanup completed');
    
    console.log('\n🎉 All smoke tests passed!');
    console.log('✅ PowerPoint processor is working correctly');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Smoke test failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run the smoke test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSmokeTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export default runSmokeTest;