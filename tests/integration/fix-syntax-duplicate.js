#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

console.log('🔧 Fixing duplicate catch block syntax error...');

const testPath = resolve('./tests/integration/e2e-workflows.test.js');
let testContent = readFileSync(testPath, 'utf8');

// Remove the duplicate catch block
testContent = testContent.replace(
  /};[\s\n]*\} catch \(error\) \{[\s\S]*?code: error\.status[\s\S]*?\}[\s\S]*?\};/,
  '};'
);

writeFileSync(testPath, testContent);

console.log('✅ Fixed duplicate catch block syntax error');