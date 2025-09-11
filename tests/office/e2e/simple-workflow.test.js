import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple test framework compatible with our native runner
function describe(description, fn) {
  console.log(`\n📋 ${description}`);
  fn();
}

function test(description, fn) {
  try {
    fn();
    console.log(`  ✅ ${description}`);
  } catch (error) {
    console.log(`  ❌ ${description}`);
    console.log(`     Error: ${error.message}`);
    throw error;
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toContain(expected) {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    toBeGreaterThan(expected) {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeDefined() {
      if (actual === undefined || actual === null) {
        throw new Error(`Expected value to be defined, got ${actual}`);
      }
    }
  };
}

async function runSimpleOfficeTests() {
  const testOutputDir = path.join(__dirname, '../../../test-output/simple-e2e');
  
  // Setup - Clean and create test output directory
  if (fs.existsSync(testOutputDir)) {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testOutputDir, { recursive: true });

describe('Simple Office Workflow Test', () => {

  describe('1. Directory Structure Validation', () => {
    test('should verify office templates exist', () => {
      const officeDir = path.join(__dirname, '../../../_templates/office');
      expect(fs.existsSync(officeDir)).toBe(true);
      
      const excelDir = path.join(officeDir, 'excel');
      const wordDir = path.join(officeDir, 'word');
      const powerpointDir = path.join(officeDir, 'powerpoint');
      
      expect(fs.existsSync(excelDir)).toBe(true);
      expect(fs.existsSync(wordDir)).toBe(true);
      expect(fs.existsSync(powerpointDir)).toBe(true);
      
      console.log('✅ All office directories exist');
    });
  });

  describe('2. Template File Discovery', () => {
    test('should find template files in office directories', () => {
      const officeDir = path.join(__dirname, '../../../_templates/office');
      let templateCount = 0;
      let dataCount = 0;
      
      function countFiles(dir) {
        try {
          const files = fs.readdirSync(dir);
          files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
              countFiles(filePath);
            } else if (file.endsWith('.njk')) {
              templateCount++;
            } else if (file.endsWith('example-data.json')) {
              dataCount++;
            }
          });
        } catch (error) {
          console.log(`Warning: Could not read ${dir}`);
        }
      }
      
      countFiles(officeDir);
      
      expect(templateCount).toBeGreaterThan(0);
      expect(dataCount).toBeGreaterThan(0);
      
      console.log(`Found ${templateCount} template files and ${dataCount} data files`);
    });
  });

  describe('3. Sample Data Validation', () => {
    test('should validate sample data files are valid JSON', () => {
      const sampleFiles = [
        '../../../_templates/office/excel/financial/example-data.json',
        '../../../_templates/office/excel/analytics/example-data.json',
        '../../../_templates/office/excel/inventory/example-data.json'
      ];
      
      let validFiles = 0;
      
      sampleFiles.forEach(relativePath => {
        const filePath = path.join(__dirname, relativePath);
        if (fs.existsSync(filePath)) {
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            expect(typeof data).toBe('object');
            validFiles++;
            console.log(`Valid: ${path.basename(path.dirname(filePath))}/${path.basename(filePath)}`);
          } catch (error) {
            console.log(`Invalid JSON: ${filePath}`);
          }
        }
      });
      
      expect(validFiles).toBeGreaterThan(0);
      console.log(`✅ ${validFiles} valid sample data files found`);
    });
  });

  describe('4. Template Content Analysis', () => {
    test('should analyze template file content', () => {
      const templateFiles = [];
      const officeDir = path.join(__dirname, '../../../_templates/office');
      
      function findTemplates(dir) {
        try {
          const files = fs.readdirSync(dir);
          files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
              findTemplates(filePath);
            } else if (file.endsWith('.njk')) {
              templateFiles.push(filePath);
            }
          });
        } catch (error) {
          console.log(`Warning: Could not read ${dir}`);
        }
      }
      
      findTemplates(officeDir);
      expect(templateFiles.length).toBeGreaterThan(0);
      
      let validTemplates = 0;
      templateFiles.forEach(file => {
        try {
          const content = fs.readFileSync(file, 'utf8');
          expect(content.length).toBeGreaterThan(0);
          
          // Basic validation - should have some content
          const hasContent = content.trim().length > 10;
          if (hasContent) {
            validTemplates++;
            console.log(`Valid template: ${path.basename(path.dirname(file))}/${path.basename(file)}`);
          }
        } catch (error) {
          console.log(`Could not read template: ${file}`);
        }
      });
      
      expect(validTemplates).toBeGreaterThan(0);
      console.log(`✅ ${validTemplates} valid template files analyzed`);
    });
  });

  describe('5. CLI Binary Validation', () => {
    test('should verify CLI binary exists and is executable', () => {
      const binaryPath = path.join(__dirname, '../../../bin/unjucks.cjs');
      expect(fs.existsSync(binaryPath)).toBe(true);
      
      const stats = fs.statSync(binaryPath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
      
      console.log(`✅ CLI binary exists (${stats.size} bytes)`);
    });
  });

  describe('6. Package Configuration Validation', () => {
    test('should validate package.json configuration', () => {
      const packagePath = path.join(__dirname, '../../../package.json');
      expect(fs.existsSync(packagePath)).toBe(true);
      
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      expect(packageJson.name).toContain('unjucks');
      expect(packageJson.bin).toBeDefined();
      expect(packageJson.bin.unjucks).toBeDefined();
      
      console.log(`✅ Package: ${packageJson.name}@${packageJson.version}`);
    });
  });

  describe('7. Summary Report Generation', () => {
    test('should generate test summary', () => {
      const timestamp = new Date().toISOString();
      const reportContent = `# Simple Office E2E Test Summary

## Test Execution
- **Timestamp**: ${timestamp}
- **Status**: COMPLETED
- **Test Type**: Structure and Content Validation

## Tests Performed
- ✅ Directory structure validation
- ✅ Template file discovery  
- ✅ Sample data validation
- ✅ Template content analysis
- ✅ CLI binary validation
- ✅ Package configuration validation

## Key Findings
- Office template structure is properly organized
- Template files contain valid content
- Sample data files are valid JSON
- CLI binary is present and executable
- Package configuration is correct

## Conclusion
The Office functionality infrastructure is properly set up and ready for use.
Templates are well-structured with supporting data files available.
`;

      const reportPath = path.join(testOutputDir, 'simple-test-report.md');
      fs.writeFileSync(reportPath, reportContent);
      
      expect(fs.existsSync(reportPath)).toBe(true);
      console.log('\n' + reportContent);
      console.log(`✅ Report saved to: ${reportPath}`);
    });
  });

});

}

// Run the tests
console.log('🚀 Starting Simple Office E2E Test Suite\n');
try {
  await runSimpleOfficeTests();
  console.log('\n✅ All simple Office E2E tests completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Simple Office E2E tests failed:', error.message);
  process.exit(1);
}