#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Read the current file
const content = fs.readFileSync('/Users/sac/unjucks/bin/kgen.mjs', 'utf8');

// The old rule finding logic to replace
const oldLogic = `      // First discover all rules to find the right one
      const allRules = await this.discoverRules(rulesDir);
      const targetRule = allRules.find(rule => rule.name === ruleName);
      
      if (targetRule) {
        rulePath = targetRule.path;
      }
      
      if (!rulePath) {
        throw new Error(\`Rule not found: \${ruleName}. Available rules: \${allRules.map(r => r.name).join(', ')}\`);
      }`;

// The new enhanced rule finding logic
const newLogic = `      // Enhanced rule finding logic with multiple strategies
      
      // First check if it's an absolute path
      if (path.isAbsolute(ruleName)) {
        if (fs.existsSync(ruleName)) {
          rulePath = ruleName;
        }
      } else {
        // Try different strategies for finding the rule
        const extensions = ['.n3', '.ttl', '.rules'];
        
        // Strategy 1: Direct path with extension
        for (const ext of extensions) {
          const candidatePath = path.resolve(rulesDir, \`\${ruleName}\${ext}\`);
          if (fs.existsSync(candidatePath)) {
            rulePath = candidatePath;
            break;
          }
        }
        
        // Strategy 2: If no extension provided, try with subdirectories
        if (!rulePath && !path.extname(ruleName)) {
          for (const ext of extensions) {
            // Try compliance subdirectory
            const compliancePath = path.resolve(rulesDir, 'compliance', \`\${ruleName}\${ext}\`);
            if (fs.existsSync(compliancePath)) {
              rulePath = compliancePath;
              break;
            }
            
            // Try other common subdirectories
            const commonDirs = ['validation', 'business', 'security'];
            for (const dir of commonDirs) {
              const subDirPath = path.resolve(rulesDir, dir, \`\${ruleName}\${ext}\`);
              if (fs.existsSync(subDirPath)) {
                rulePath = subDirPath;
                break;
              }
            }
            if (rulePath) break;
          }
        }
        
        // Strategy 3: If it looks like a path with subdirectory, try it directly
        if (!rulePath && ruleName.includes('/')) {
          // Try as-is with extensions
          for (const ext of extensions) {
            const candidatePath = path.resolve(rulesDir, \`\${ruleName}\${ext}\`);
            if (fs.existsSync(candidatePath)) {
              rulePath = candidatePath;
              break;
            }
          }
          
          // Try without adding extension (maybe it's already included)
          const directPath = path.resolve(rulesDir, ruleName);
          if (fs.existsSync(directPath)) {
            rulePath = directPath;
          }
        }
        
        // Fallback: try to find by name using existing discovery method
        if (!rulePath) {
          const allRules = await this.discoverRules(rulesDir);
          const targetRule = allRules.find(rule => rule.name === ruleName);
          if (targetRule) {
            rulePath = targetRule.path;
          }
        }
      }
      
      if (!rulePath) {
        // Provide helpful error message with search paths
        const searchPaths = [
          path.resolve(rulesDir, \`\${ruleName}.n3\`),
          path.resolve(rulesDir, \`\${ruleName}.ttl\`),
          path.resolve(rulesDir, \`\${ruleName}.rules\`),
          path.resolve(rulesDir, 'compliance', \`\${ruleName}.n3\`),
          path.resolve(rulesDir, 'compliance', \`\${ruleName}.ttl\`)
        ];
        throw new Error(\`Rule not found: \${ruleName}\\nSearched in:\\n\${searchPaths.join('\\n')}\`);
      }`;

// Replace the old logic with the new one
const newContent = content.replace(oldLogic, newLogic);

// Verify the replacement worked (should be different)
if (newContent === content) {
  console.error('❌ Replacement failed - content unchanged');
  process.exit(1);
}

// Write the updated content back
fs.writeFileSync('/Users/sac/unjucks/bin/kgen.mjs', newContent);

console.log('✅ Enhanced analyzeRule method with improved path resolution');