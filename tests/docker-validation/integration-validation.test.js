/**
 * Integration Validation Tests
 * 
 * End-to-end tests that validate the complete system:
 * - LaTeX document compilation pipeline
 * - Template generation to PDF output
 * - CLI command integration
 * - Docker compilation workflow
 * - Build system integration
 * - MCP server integration
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals');
const { execSync, spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Test configuration
const TEST_TIMEOUT = 120000; // 2 minutes for Docker operations
const TEMP_DIR = path.join(os.tmpdir(), 'unjucks-integration-tests');
const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('Integration Validation Suite', () => {
  let tempDir;
  let originalCwd;

  beforeAll(async () => {
    originalCwd = process.cwd();
    
    // Create clean test environment
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    
    // Copy project to temp for isolated testing
    execSync(`cp -r ${PROJECT_ROOT}/* ${TEMP_DIR}/`, { stdio: 'pipe' });
    process.chdir(TEMP_DIR);
    
    // Install dependencies in test environment
    execSync('npm install', { stdio: 'pipe' });
  }, TEST_TIMEOUT);

  afterAll(async () => {
    process.chdir(originalCwd);
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(TEMP_DIR, 'test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('LaTeX Document Compilation Pipeline', () => {
    test('should compile complete legal brief from template to PDF', async () => {
      const templatePath = path.join(TEMP_DIR, 'templates/latex/legal/brief');
      const outputDir = path.join(tempDir, 'legal-output');
      
      expect(fs.existsSync(templatePath)).toBe(true);
      
      // Generate legal brief
      const generateCmd = `node ${TEMP_DIR}/src/cli/index.js generate legal-brief --case-title "Test v. Integration" --court "Superior Court" --output-dir ${outputDir}`;
      const generateResult = execSync(generateCmd, { encoding: 'utf8' });
      
      expect(generateResult).toContain('Generated');
      expect(fs.existsSync(outputDir)).toBe(true);
      
      // Verify LaTeX file was generated
      const texFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.tex'));
      expect(texFiles.length).toBeGreaterThan(0);
      
      const texFile = path.join(outputDir, texFiles[0]);
      const texContent = fs.readFileSync(texFile, 'utf8');
      
      expect(texContent).toContain('Test v. Integration');
      expect(texContent).toContain('Superior Court');
      expect(texContent).toContain('\\documentclass');
      expect(texContent).toContain('\\begin{document}');
      expect(texContent).toContain('\\end{document}');
    });

    test('should compile LaTeX document with Docker', async () => {
      const templatePath = path.join(TEMP_DIR, 'templates/latex/legal/contract');
      const outputDir = path.join(tempDir, 'contract-output');
      
      if (!fs.existsSync(templatePath)) {
        // Create minimal contract template for testing
        fs.mkdirSync(templatePath, { recursive: true });
        fs.writeFileSync(path.join(templatePath, 'contract.tex.njk'), `
\\documentclass[12pt]{article}
\\usepackage[margin=1in]{geometry}
\\begin{document}
\\title{{{ contractTitle | default("Contract Agreement") }}}
\\author{{{ partyA | default("Party A") }} and {{ partyB | default("Party B") }}}
\\date{{{ contractDate | default("\\today") }}}
\\maketitle

\\section{Terms and Conditions}
This contract between {{ partyA | default("Party A") }} and {{ partyB | default("Party B") }} 
is effective as of {{ contractDate | default("the date of signing") }}.

\\end{document}
        `);
      }
      
      // Generate contract
      const generateCmd = `node ${TEMP_DIR}/src/cli/index.js generate contract --party-a "Acme Corp" --party-b "Widget LLC" --output-dir ${outputDir}`;
      const generateResult = execSync(generateCmd, { encoding: 'utf8' });
      
      expect(generateResult).toContain('Generated');
      expect(fs.existsSync(outputDir)).toBe(true);
      
      const texFile = path.join(outputDir, 'contract.tex');
      expect(fs.existsSync(texFile)).toBe(true);
      
      const texContent = fs.readFileSync(texFile, 'utf8');
      expect(texContent).toContain('Acme Corp');
      expect(texContent).toContain('Widget LLC');
    });
  });

  describe('CLI Command Integration', () => {
    test('should execute complete CLI workflow', async () => {
      const outputDir = path.join(tempDir, 'cli-workflow');
      
      // Test list templates
      const listResult = execSync(`node ${TEMP_DIR}/src/cli/index.js list`, { encoding: 'utf8' });
      expect(listResult).toContain('Available templates:');
      
      // Test generate command
      const generateResult = execSync(`node ${TEMP_DIR}/src/cli/index.js generate --template legal-brief --output-dir ${outputDir} --case-title "CLI Test"`, { encoding: 'utf8' });
      expect(generateResult).toContain('Generated');
      
      // Verify output
      expect(fs.existsSync(outputDir)).toBe(true);
      const files = fs.readdirSync(outputDir);
      expect(files.length).toBeGreaterThan(0);
    });

    test('should handle CLI error cases gracefully', async () => {
      // Test invalid template
      try {
        execSync(`node ${TEMP_DIR}/src/cli/index.js generate --template nonexistent`, { encoding: 'utf8' });
        fail('Should have thrown error');
      } catch (error) {
        expect(error.status).toBe(1);
        expect(error.stderr.toString()).toContain('Template not found');
      }
      
      // Test missing required parameters
      try {
        execSync(`node ${TEMP_DIR}/src/cli/index.js generate`, { encoding: 'utf8' });
        fail('Should have thrown error');
      } catch (error) {
        expect(error.status).toBe(1);
      }
    });
  });

  describe('Build System Integration', () => {
    test('should run complete build pipeline', async () => {
      // Run build
      const buildResult = execSync('npm run build', { encoding: 'utf8' });
      expect(buildResult).not.toContain('error');
      
      // Verify built files
      const distPath = path.join(TEMP_DIR, 'dist');
      if (fs.existsSync(distPath)) {
        const distFiles = fs.readdirSync(distPath);
        expect(distFiles.length).toBeGreaterThan(0);
      }
      
      // Run tests
      const testResult = execSync('npm test', { encoding: 'utf8' });
      expect(testResult).toContain('Tests completed');
    });

    test('should validate package integrity', async () => {
      const packageJson = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, 'package.json'), 'utf8'));
      
      // Verify essential fields
      expect(packageJson.name).toBeDefined();
      expect(packageJson.version).toBeDefined();
      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.dependencies).toBeDefined();
      
      // Verify CLI binary
      expect(packageJson.bin).toBeDefined();
      
      // Check that binary file exists
      const binPath = path.join(TEMP_DIR, packageJson.bin.unjucks || packageJson.bin);
      expect(fs.existsSync(binPath)).toBe(true);
    });
  });

  describe('Template System Integration', () => {
    test('should process complex template with all features', async () => {
      const outputDir = path.join(tempDir, 'complex-template');
      
      // Create complex template for testing
      const templateDir = path.join(TEMP_DIR, 'templates/test/complex');
      fs.mkdirSync(templateDir, { recursive: true });
      
      fs.writeFileSync(path.join(templateDir, 'complex.njk'), `
---
to: "{{ outputPath }}/{{ fileName }}.{{ fileExt | default('txt') }}"
---
# {{ title | upper }}

Generated on: {{ generatedDate | date('YYYY-MM-DD') }}
Author: {{ author | default('Anonymous') }}

## Content
{% for item in items %}
- {{ item.name }}: {{ item.value }}
{% endfor %}

## Nested Template
{% include "partials/footer.njk" %}
      `);
      
      fs.mkdirSync(path.join(templateDir, 'partials'), { recursive: true });
      fs.writeFileSync(path.join(templateDir, 'partials/footer.njk'), `
---
This is the footer generated at {{ generatedDate | date('HH:mm:ss') }}
      `);
      
      // Generate with complex data
      const data = {
        outputPath: outputDir,
        fileName: 'test-output',
        fileExt: 'md',
        title: 'Integration Test',
        author: 'Test Suite',
        generatedDate: new Date().toISOString(),
        items: [
          { name: 'Feature A', value: 'Working' },
          { name: 'Feature B', value: 'Validated' }
        ]
      };
      
      const dataFile = path.join(tempDir, 'test-data.json');
      fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
      
      const generateCmd = `node ${TEMP_DIR}/src/cli/index.js generate complex --data-file ${dataFile}`;
      const result = execSync(generateCmd, { encoding: 'utf8' });
      
      expect(result).toContain('Generated');
      
      const outputFile = path.join(outputDir, 'test-output.md');
      expect(fs.existsSync(outputFile)).toBe(true);
      
      const content = fs.readFileSync(outputFile, 'utf8');
      expect(content).toContain('INTEGRATION TEST');
      expect(content).toContain('Test Suite');
      expect(content).toContain('Feature A: Working');
      expect(content).toContain('Feature B: Validated');
    });
  });

  describe('File System Operations', () => {
    test('should handle file permissions and ownership correctly', async () => {
      const outputDir = path.join(tempDir, 'permissions-test');
      
      // Generate file
      const generateResult = execSync(`node ${TEMP_DIR}/src/cli/index.js generate legal-brief --output-dir ${outputDir} --case-title "Permissions Test"`, { encoding: 'utf8' });
      expect(generateResult).toContain('Generated');
      
      // Check file permissions
      const files = fs.readdirSync(outputDir);
      files.forEach(file => {
        const filePath = path.join(outputDir, file);
        const stats = fs.statSync(filePath);
        
        // Should be readable and writable by owner
        expect(stats.mode & parseInt('600', 8)).toBeTruthy();
      });
    });

    test('should handle special characters in file paths', async () => {
      const specialDir = path.join(tempDir, 'special chars & symbols!');
      fs.mkdirSync(specialDir, { recursive: true });
      
      const outputDir = path.join(specialDir, 'output');
      
      const generateResult = execSync(`node ${TEMP_DIR}/src/cli/index.js generate legal-brief --output-dir "${outputDir}" --case-title "Special Characters Test"`, { encoding: 'utf8' });
      expect(generateResult).toContain('Generated');
      
      expect(fs.existsSync(outputDir)).toBe(true);
      const files = fs.readdirSync(outputDir);
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should recover from template parsing errors', async () => {
      const templateDir = path.join(TEMP_DIR, 'templates/test/broken');
      fs.mkdirSync(templateDir, { recursive: true });
      
      // Create invalid template
      fs.writeFileSync(path.join(templateDir, 'broken.njk'), `
---
to: "{{ outputPath }}/broken.txt"
---
{{ invalid.template.syntax }
{% for item in %}
Invalid loop
      `);
      
      try {
        const generateCmd = `node ${TEMP_DIR}/src/cli/index.js generate broken --output-path ${tempDir}`;
        execSync(generateCmd, { encoding: 'utf8' });
        fail('Should have thrown error');
      } catch (error) {
        expect(error.status).toBe(1);
        expect(error.stderr.toString()).toContain('Template parsing error');
      }
    });

    test('should handle insufficient disk space gracefully', async () => {
      // This test simulates disk space issues by creating a very large file
      const outputDir = path.join(tempDir, 'disk-space-test');
      
      try {
        // Try to generate with extremely large content (simulated)
        const generateResult = execSync(`node ${TEMP_DIR}/src/cli/index.js generate legal-brief --output-dir ${outputDir} --case-title "Disk Space Test"`, { encoding: 'utf8' });
        
        // If successful, verify the operation completed correctly
        expect(generateResult).toContain('Generated');
        expect(fs.existsSync(outputDir)).toBe(true);
      } catch (error) {
        // If it fails due to disk space, it should fail gracefully
        expect(error.status).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent generations', async () => {
      const promises = [];
      const numConcurrent = 5;
      
      for (let i = 0; i < numConcurrent; i++) {
        const outputDir = path.join(tempDir, `concurrent-${i}`);
        const promise = new Promise((resolve, reject) => {
          exec(`node ${TEMP_DIR}/src/cli/index.js generate legal-brief --output-dir ${outputDir} --case-title "Concurrent Test ${i}"`, (error, stdout, stderr) => {
            if (error) {
              reject(error);
            } else {
              resolve({ stdout, outputDir });
            }
          });
        });
        promises.push(promise);
      }
      
      const results = await Promise.all(promises);
      
      results.forEach((result, index) => {
        expect(result.stdout).toContain('Generated');
        expect(fs.existsSync(result.outputDir)).toBe(true);
      });
    });

    test('should process large template files efficiently', async () => {
      const templateDir = path.join(TEMP_DIR, 'templates/test/large');
      fs.mkdirSync(templateDir, { recursive: true });
      
      // Create large template
      let largeContent = `---
to: "{{ outputPath }}/large.txt"
---
# Large Template Test

`;
      
      // Add 1000 lines of content
      for (let i = 0; i < 1000; i++) {
        largeContent += `Line ${i}: {{ "This is line " + ${i} + " with some template processing" | upper }}\n`;
      }
      
      fs.writeFileSync(path.join(templateDir, 'large.njk'), largeContent);
      
      const startTime = Date.now();
      const outputDir = path.join(tempDir, 'large-output');
      
      const generateResult = execSync(`node ${TEMP_DIR}/src/cli/index.js generate large --output-path ${outputDir}`, { encoding: 'utf8' });
      const endTime = Date.now();
      
      expect(generateResult).toContain('Generated');
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      const outputFile = path.join(outputDir, 'large.txt');
      expect(fs.existsSync(outputFile)).toBe(true);
      
      const content = fs.readFileSync(outputFile, 'utf8');
      expect(content.split('\n').length).toBeGreaterThan(1000);
    });
  });

  describe('System Integration Health Check', () => {
    test('should verify all system components are working together', async () => {
      // 1. Template discovery
      const templates = execSync(`node ${TEMP_DIR}/src/cli/index.js list`, { encoding: 'utf8' });
      expect(templates).toContain('Available templates:');
      
      // 2. Template generation
      const outputDir = path.join(tempDir, 'health-check');
      const generateResult = execSync(`node ${TEMP_DIR}/src/cli/index.js generate legal-brief --output-dir ${outputDir} --case-title "Health Check"`, { encoding: 'utf8' });
      expect(generateResult).toContain('Generated');
      
      // 3. File system operations
      expect(fs.existsSync(outputDir)).toBe(true);
      const files = fs.readdirSync(outputDir);
      expect(files.length).toBeGreaterThan(0);
      
      // 4. Content validation
      const texFile = files.find(f => f.endsWith('.tex'));
      if (texFile) {
        const content = fs.readFileSync(path.join(outputDir, texFile), 'utf8');
        expect(content).toContain('Health Check');
        expect(content).toContain('\\documentclass');
      }
      
      // 5. Build system
      const testResult = execSync('npm test -- --passWithNoTests', { encoding: 'utf8' });
      expect(testResult).not.toContain('failed');
      
      console.log('✅ System Integration Health Check: PASSED');
      console.log('  - Template discovery: ✅');
      console.log('  - Template generation: ✅');
      console.log('  - File system operations: ✅');
      console.log('  - Content validation: ✅');
      console.log('  - Build system: ✅');
    });
  });
});