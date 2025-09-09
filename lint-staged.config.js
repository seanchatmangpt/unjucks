/**
 * Lint-staged configuration for pre-commit quality enforcement
 * Runs quality checks and auto-fixes on staged files
 */

export default {
  // JavaScript files - comprehensive quality checks
  '*.{js,mjs,cjs}': [
    // Format with Prettier first
    'prettier --config .prettierrc.quality --write',
    
    // ESLint with quality config (auto-fix enabled)
    'eslint --config .eslintrc.quality.js --fix --max-warnings 10',
    
    // Add back to staging area after fixes
    'git add'
  ],
  
  // JSON files - formatting only
  '*.json': [
    'prettier --config .prettierrc.quality --write',
    'git add'
  ],
  
  // Markdown files - formatting
  '*.md': [
    'prettier --config .prettierrc.quality --write --prose-wrap always',
    'git add'
  ],
  
  // YAML files - formatting
  '*.{yml,yaml}': [
    'prettier --config .prettierrc.quality --write',
    'git add'
  ],
  
  // Package.json - validate and format
  'package.json': [
    // Check for security vulnerabilities in dependencies
    'npm audit --audit-level moderate || echo "Security audit warnings detected"',
    
    // Format
    'prettier --config .prettierrc.quality --write',
    'git add'
  ],
  
  // Source files - additional validations
  'src/**/*.js': [
    // JSDoc validation for source files
    (filenames) => {
      const files = filenames.join(' ');
      return [
        `echo "🔍 Validating JSDoc for: ${files}"`,
        // Simple JSDoc syntax check
        `node -e "
          const fs = await import('fs');
          const files = '${files}'.split(' ');
          let hasErrors = false;
          
          files.forEach(file => {
            try {
              const content = fs.readFileSync(file, 'utf8');
              // Check for basic JSDoc syntax errors
              const jsdocBlocks = content.match(/\\/\\*\\*[\\s\\S]*?\\*\\//g) || [];
              jsdocBlocks.forEach(block => {
                if (block.includes('@param') && !block.match(/@param\\s+\\{[^}]+\\}\\s+\\w+/)) {
                  console.error('❌ Invalid @param syntax in ' + file);
                  hasErrors = true;
                }
                if (block.includes('@returns') && !block.match(/@returns?\\s+\\{[^}]+\\}/)) {
                  console.error('❌ Invalid @returns syntax in ' + file);
                  hasErrors = true;
                }
              });
            } catch (error) {
              console.error('❌ Error reading file ' + file + ':', error.message);
              hasErrors = true;
            }
          });
          
          if (hasErrors) {
            console.error('💡 Fix JSDoc syntax errors before committing');
            process.exit(1);
          } else {
            console.log('✅ JSDoc validation passed');
          }
        "`
      ];
    }
  ],
  
  // Test files - lighter validation
  '*.{test,spec}.js': [
    'prettier --config .prettierrc.quality --write',
    'eslint --config .eslintrc.quality.js --fix --rule "max-lines-per-function: off" --rule "no-magic-numbers: off"',
    'git add'
  ],
  
  // Configuration files - basic formatting
  '*.config.{js,mjs,cjs}': [
    'prettier --config .prettierrc.quality --write',
    'eslint --config .eslintrc.quality.js --fix --rule "camelcase: off"',
    'git add'
  ],
  
  // Scripts - security and quality checks
  'scripts/**/*.js': [
    'prettier --config .prettierrc.quality --write',
    'eslint --config .eslintrc.quality.js --fix --rule "no-process-exit: off"',
    
    // Security check for scripts
    (filenames) => {
      const files = filenames.join(' ');
      return [
        `echo "🔒 Security check for scripts: ${files}"`,
        `node -e "
          const fs = await import('fs');
          const files = '${files}'.split(' ');
          let hasSecurityIssues = false;
          
          files.forEach(file => {
            try {
              const content = fs.readFileSync(file, 'utf8');
              
              // Check for potential security issues
              const securityPatterns = [
                { pattern: /eval\\s*\\(/, message: 'Dangerous eval() usage' },
                { pattern: /exec\\s*\\(/, message: 'Potentially unsafe exec() usage' },
                { pattern: /process\\.env\\.[A-Z_]+\\s*=/, message: 'Environment variable assignment' },
                { pattern: /fs\\.unlinkSync\\s*\\(/, message: 'Synchronous file deletion' },
                { pattern: /rm\\s+-rf/, message: 'Dangerous rm command' }
              ];
              
              securityPatterns.forEach(({ pattern, message }) => {
                if (pattern.test(content)) {
                  console.warn('⚠️  Security concern in ' + file + ': ' + message);
                  // Don't fail for warnings, just alert
                }
              });
              
            } catch (error) {
              console.error('❌ Error reading file ' + file + ':', error.message);
              hasSecurityIssues = true;
            }
          });
          
          if (hasSecurityIssues) {
            process.exit(1);
          }
        "`
      ];
    },
    
    'git add'
  ]
};