#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

console.log('🔧 Fixing CLI syntax error...');

const cliIndexPath = resolve('./src/cli/index.js');
let cliIndex = readFileSync(cliIndexPath, 'utf8');

// Remove the extra closing brace that's causing the syntax error
cliIndex = cliIndex.replace(/return \{ success: true, action: 'version', output: version \};\s*\}\s*\}/m, 
                           'return { success: true, action: \'version\', output: version };\n    }');

writeFileSync(cliIndexPath, cliIndex);

console.log('✅ Fixed CLI syntax error - removed duplicate closing brace');