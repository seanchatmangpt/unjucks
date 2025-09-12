#!/usr/bin/env node

import fs from 'fs';

// Read the current file
const content = fs.readFileSync('/Users/sac/unjucks/bin/kgen.mjs', 'utf8');

// The improved analyzeRule method
const newAnalyzeRuleMethod = `  async analyzeRule(ruleName) {
    try {
      const rulesDir = this.config?.directories?.rules || './rules';
      let rulePath = null;
      
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
      }

      const content = fs.readFileSync(rulePath, 'utf8');
      const stats = fs.statSync(rulePath);
      
      // Basic rule analysis
      const lines = content.split('\\n');
      const ruleCount = lines.filter(line => line.trim() && !line.trim().startsWith('#')).length;
      
      // Extract prefixes
      const prefixes = [];
      const prefixMatches = content.matchAll(/@prefix\\s+([a-zA-Z0-9_]+):\\s*<([^>]+)>/g);
      for (const match of prefixMatches) {
        prefixes.push({ prefix: match[1], uri: match[2] });
      }

      return {
        name: ruleName,
        path: rulePath,
        type: path.extname(rulePath).slice(1),
        content: content,
        size: stats.size,
        lines: lines.length,
        ruleCount: ruleCount,
        prefixes: prefixes,
        modified: stats.mtime.toISOString()
      };
      
    } catch (error) {
      if (this.debug) console.error(\`❌ Failed to analyze rule \${ruleName}:\`, error);
      throw error;
    }
  }`;

// Find and replace the old method
const oldMethodRegex = /  async analyzeRule\(ruleName\) \{[\s\S]*?^\s*\}\s*$/m;
const newContent = content.replace(oldMethodRegex, newAnalyzeRuleMethod);

// Write the updated content back
fs.writeFileSync('/Users/sac/unjucks/bin/kgen.mjs', newContent);

console.log('✅ Updated analyzeRule method successfully');