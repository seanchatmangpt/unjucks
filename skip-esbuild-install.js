#!/usr/bin/env node

// Minimal dependency installer that skips esbuild
import { spawn } from 'child_process';

const dependencies = [
  'nunjucks@3.2.4',
  'citty@0.1.6', 
  'chalk@4.1.2',
  'fs-extra@11.3.1',
  'gray-matter@4.0.3',
  'consola@3.2.0',
  'glob@10.3.10'
];

console.log('Installing core dependencies without esbuild...');

const install = spawn('npm', ['install', '--no-package-lock', '--ignore-scripts', ...dependencies], {
  stdio: 'inherit'
});

install.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Core dependencies installed successfully');
    
    // Test CLI
    const test = spawn('node', ['/Users/sac/unjucks/bin/unjucks.cjs', '--version'], {
      stdio: 'inherit'
    });
    
    test.on('close', (testCode) => {
      if (testCode === 0) {
        console.log('✅ CLI is working');
      } else {
        console.log('❌ CLI test failed');
      }
    });
  } else {
    console.log('❌ Installation failed');
  }
});