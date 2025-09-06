import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

export default async function teardown() {
  console.log('🧹 Cleaning up deployment testing environment...');
  
  // Restore original directory if changed
  if (process.env.ORIGINAL_CWD) {
    process.chdir(process.env.ORIGINAL_CWD);
  }
  
  // Clean up any global npm installations made during testing
  try {
    console.log('🗑️  Cleaning up test npm installations...');
    
    // List global packages to see if unjucks was installed during testing
    const globalPackages = execSync('npm list -g --depth=0 --json', { encoding: 'utf8' });
    const packageList = JSON.parse(globalPackages);
    
    if (packageList.dependencies && packageList.dependencies.unjucks) {
      console.log('Removing test installation of unjucks...');
      try {
        execSync('npm uninstall -g unjucks', { stdio: 'inherit' });
      } catch (error) {
        console.warn('Could not remove global unjucks installation:', error);
      }
    }
  } catch (error) {
    console.warn('Could not check global packages:', error);
  }
  
  // Clean up any temporary directories created during testing
  try {
    console.log('🗂️  Cleaning up temporary test directories...');
    execSync('rm -rf /tmp/unjucks-test-*', { stdio: 'inherit' });
  } catch (error) {
    console.warn('Could not clean temporary directories:', error);
  }
  
  // Generate deployment test summary
  const testEndTime = new Date().toISOString();
  const testStartTime = process.env.DEPLOYMENT_TEST_START || testEndTime;
  
  const testSummary = {
    testType: 'deployment',
    startTime: testStartTime,
    endTime: testEndTime,
    nodeVersion: process.env.DEPLOYMENT_TEST_NODE_VERSION || process.version,
    platform: process.env.DEPLOYMENT_TEST_PLATFORM || process.platform,
    arch: process.env.DEPLOYMENT_TEST_ARCH || process.arch,
    duration: new Date(testEndTime).getTime() - new Date(testStartTime).getTime(),
    environment: {
      ci: process.env.CI === 'true',
      nodeEnv: process.env.NODE_ENV,
      testMode: process.env.UNJUCKS_TEST_MODE,
    }
  };
  
  // Write test summary
  const summaryPath = resolve(process.cwd(), 'test-results/deployment-summary.json');
  try {
    writeFileSync(summaryPath, JSON.stringify(testSummary, null, 2));
    console.log(`📊 Deployment test summary written to: ${summaryPath}`);
  } catch (error) {
    console.warn('Could not write test summary:', error);
  }
  
  // Display test completion message
  console.log('✨ Deployment testing environment cleaned up');
  console.log(`⏱️  Total test duration: ${Math.round(testSummary.duration / 1000)}s`);
  console.log(`🖥️  Platform: ${testSummary.platform} (${testSummary.arch})`);
  console.log(`📍 Node.js: ${testSummary.nodeVersion}`);
}