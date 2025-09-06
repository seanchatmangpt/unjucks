import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

export default async function setup() {
  console.log('🚀 Setting up deployment testing environment...');
  
  // Ensure test results directory exists
  const testResultsDir = resolve(process.cwd(), 'test-results');
  if (!existsSync(testResultsDir)) {
    mkdirSync(testResultsDir, { recursive: true });
  }
  
  // Store original directory
  process.env.ORIGINAL_CWD = process.cwd();
  
  // Verify Node.js version
  const nodeVersion = process.version;
  console.log(`📍 Node.js version: ${nodeVersion}`);
  
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 18) {
    throw new Error(`Node.js 18+ required for deployment testing. Current: ${nodeVersion}`);
  }
  
  // Verify npm is available
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    console.log(`📦 npm version: ${npmVersion}`);
  } catch (error) {
    throw new Error('npm is required for deployment testing');
  }
  
  // Build the package if not already built
  console.log('🔨 Building package for testing...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to build package:', error);
    throw error;
  }
  
  // Verify essential files exist
  const requiredFiles = [
    'dist/index.cjs',
    'bin/unjucks.cjs',
    'package.json'
  ];
  
  for (const file of requiredFiles) {
    const filePath = resolve(process.cwd(), file);
    if (!existsSync(filePath)) {
      throw new Error(`Required file missing: ${file}`);
    }
  }
  
  console.log('✅ Deployment testing environment ready');
  
  // Store deployment test metadata
  process.env.DEPLOYMENT_TEST_START = new Date().toISOString();
  process.env.DEPLOYMENT_TEST_NODE_VERSION = nodeVersion;
  process.env.DEPLOYMENT_TEST_PLATFORM = process.platform;
  process.env.DEPLOYMENT_TEST_ARCH = process.arch;
}