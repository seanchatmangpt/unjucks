import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test global setup...');
  
  // Start browser for setup tasks
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Wait for the application to be ready
    console.log('⏳ Waiting for application to be ready...');
    await page.goto(config.projects[0].use.baseURL || 'http://localhost:3000');
    
    // Wait for critical elements to load
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Setup test data if needed
    console.log('📝 Setting up test data...');
    
    // Create test directories and files
    await page.evaluate(() => {
      // This would typically make API calls to set up test data
      // For now, we'll simulate the setup
      return Promise.resolve();
    });
    
    console.log('✅ E2E test global setup complete');
    
  } catch (error) {
    console.error('❌ E2E test global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;