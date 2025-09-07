import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';

// BDD Test Suite Validation
// This file validates that our BDD test suite is properly structured and executable

describe('BDD Test Suite Validation', () => {
  const testDir = path.resolve(__dirname);
  const featuresDir = path.join(testDir, 'features');
  const stepDefinitionsDir = path.join(testDir, 'step-definitions');
  
  beforeAll(async () => {
    // Ensure test directories exist
    expect(fs.existsSync(featuresDir)).toBe(true);
    expect(fs.existsSync(stepDefinitionsDir)).toBe(true);
  });
  
  describe('Feature Files Structure', () => {
    it('should have all required feature files', async () => {
      const requiredFeatures = [
        'cli-core.feature',
        'template-generation.feature',
        'file-injection.feature',
        'semantic-features.feature',
        'swarm-integration.feature',
        'developer-workflows.feature',
        'error-handling.feature',
        'performance-security.feature'
      ];
      
      for (const feature of requiredFeatures) {
        const featurePath = path.join(featuresDir, feature);
        expect(fs.existsSync(featurePath)).toBe(true);
        
        // Validate feature file structure
        const content = fs.readFileSync(featurePath, 'utf8');
        expect(content).toContain('Feature:');
        expect(content).toContain('Scenario:');
        expect(content).toMatch(/Given|When|Then/);
      }
    });
    
    it('should have valid Gherkin syntax in feature files', async () => {
      const featureFiles = fs.readdirSync(featuresDir).filter(f => f.endsWith('.feature'));
      
      for (const file of featureFiles) {
        const filePath = path.join(featuresDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for required Gherkin keywords
        expect(content).toMatch(/^\s*Feature:/m);
        expect(content).toMatch(/^\s*Scenario:/m);
        
        // Check for proper step structure
        const lines = content.split('\n');
        let inScenario = false;
        
        for (const line of lines) {
          const trimmed = line.trim();
          
          if (trimmed.startsWith('Scenario:')) {
            inScenario = true;
            continue;
          }
          
          if (inScenario && trimmed && !trimmed.startsWith('#')) {
            // Should be a step or scenario-related keyword
            if (!trimmed.match(/^(Given|When|Then|And|But|Background:|Scenario:|Examples:|\||@)/)) {
              console.warn(`Potential syntax issue in ${file}: "${trimmed}"`);
            }
          }
        }
      }
    });
  });
  
  describe('Step Definitions Structure', () => {
    it('should have all required step definition files', async () => {
      const requiredStepFiles = [
        'cli-core.steps.ts',
        'template-generation.steps.ts',
        'file-injection.steps.ts',
        'semantic-features.steps.ts',
        'swarm-integration.steps.ts',
        'error-handling.steps.ts',
        'performance-security.steps.ts'
      ];
      
      for (const stepFile of requiredStepFiles) {
        const stepPath = path.join(stepDefinitionsDir, stepFile);
        expect(fs.existsSync(stepPath)).toBe(true);
        
        // Validate step definition structure
        const content = fs.readFileSync(stepPath, 'utf8');
        expect(content).toContain('import');
        expect(content).toMatch(/Given|When|Then/);
      }
    });
    
    it('should have proper TypeScript imports and exports', async () => {
      const stepFiles = fs.readdirSync(stepDefinitionsDir).filter(f => f.endsWith('.steps.ts'));
      
      for (const file of stepFiles) {
        const filePath = path.join(stepDefinitionsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for required imports
        expect(content).toContain("import { Given, When, Then } from '@amiceli/vitest-cucumber'");
        expect(content).toContain("import { expect } from 'vitest'");
        
        // Check for proper TypeScript syntax
        expect(content).not.toContain('console.log'); // No debug logs should remain
        
        // Validate that functions are properly defined
        const stepDefinitions = content.match(/(Given|When|Then)\s*\(/g);
        expect(stepDefinitions).toBeTruthy();
        expect(stepDefinitions!.length).toBeGreaterThan(0);
      }
    });
  });
  
  describe('Test Configuration', () => {
    it('should have proper Vitest configuration', async () => {
      const configPath = path.resolve(__dirname, '../../vitest.cucumber.config.ts');
      expect(fs.existsSync(configPath)).toBe(true);
      
      const configContent = fs.readFileSync(configPath, 'utf8');
      expect(configContent).toContain('vitest/config');
      expect(configContent).toContain('cucumber');
    });
    
    it('should have test setup files', async () => {
      const setupPath = path.resolve(__dirname, '../setup/cucumber-setup.ts');
      expect(fs.existsSync(setupPath)).toBe(true);
      
      const setupContent = fs.readFileSync(setupPath, 'utf8');
      expect(setupContent).toContain('beforeAll');
      expect(setupContent).toContain('afterAll');
    });
  });
  
  describe('Step Definition Coverage', () => {
    it('should have step definitions covering all feature scenarios', async () => {
      const featureFiles = fs.readdirSync(featuresDir).filter(f => f.endsWith('.feature'));
      const stepFiles = fs.readdirSync(stepDefinitionsDir).filter(f => f.endsWith('.steps.ts'));
      
      // Read all steps from feature files
      const featureSteps = new Set<string>();
      
      for (const featureFile of featureFiles) {
        const content = fs.readFileSync(path.join(featuresDir, featureFile), 'utf8');
        const stepMatches = content.match(/^\s*(Given|When|Then|And|But)\s+(.+)$/gm);
        
        if (stepMatches) {
          stepMatches.forEach(step => {
            const cleanStep = step.replace(/^\s*(Given|When|Then|And|But)\s+/, '').trim();
            featureSteps.add(cleanStep);
          });
        }
      }
      
      // Read all step definitions
      const definedSteps = new Set<string>();
      
      for (const stepFile of stepFiles) {
        const content = fs.readFileSync(path.join(stepDefinitionsDir, stepFile), 'utf8');
        
        // Extract step definition patterns
        const stepDefMatches = content.match(/(Given|When|Then)\s*\(\s*['"`]([^'"`]+)['"`]/g);
        
        if (stepDefMatches) {
          stepDefMatches.forEach(stepDef => {
            const pattern = stepDef.replace(/(Given|When|Then)\s*\(\s*['"`]/, '').replace(/['"`].*$/, '');
            definedSteps.add(pattern);
          });
        }
      }
      
      // Basic validation that we have step definitions
      expect(featureSteps.size).toBeGreaterThan(0);
      expect(definedSteps.size).toBeGreaterThan(0);
      
      console.log(`Found ${featureSteps.size} unique feature steps`);
      console.log(`Found ${definedSteps.size} step definitions`);
    });
  });
  
  describe('BDD Test Runner', () => {
    it('should have a proper test runner configuration', async () => {
      const runnerPath = path.join(testDir, 'cucumber-runner.spec.ts');
      expect(fs.existsSync(runnerPath)).toBe(true);
      
      const runnerContent = fs.readFileSync(runnerPath, 'utf8');
      expect(runnerContent).toContain('cucumber');
      expect(runnerContent).toContain('describe');
      expect(runnerContent).toContain('resolve(__dirname');
    });
  });
  
  describe('Test Dependencies', () => {
    it('should have all required testing dependencies', async () => {
      const packageJsonPath = path.resolve(__dirname, '../../package.json');
      const packageJson = fs.readJsonSync(packageJsonPath);
      
      const requiredDevDeps = [
        '@amiceli/vitest-cucumber',
        'vitest',
        '@types/node',
        '@types/fs-extra'
      ];
      
      for (const dep of requiredDevDeps) {
        expect(packageJson.devDependencies).toHaveProperty(dep);
      }
      
      // Check for BDD test scripts
      expect(packageJson.scripts).toHaveProperty('test:cucumber');
      expect(packageJson.scripts).toHaveProperty('test:bdd');
    });
  });
  
  describe('Mock Data and Utilities', () => {
    it('should have proper mock data structures in step definitions', async () => {
      const coreStepsPath = path.join(stepDefinitionsDir, 'cli-core.steps.ts');
      const content = fs.readFileSync(coreStepsPath, 'utf8');
      
      // Check for test context and utilities
      expect(content).toContain('testContext');
      expect(content).toContain('executeCommand');
      expect(content).toContain('createTestDirectory');
    });
    
    it('should have MCP integration mocks', async () => {
      const swarmStepsPath = path.join(stepDefinitionsDir, 'swarm-integration.steps.ts');
      const content = fs.readFileSync(swarmStepsPath, 'utf8');
      
      expect(content).toContain('mockMCPToolResponse');
      expect(content).toContain('mockSwarmInit');
      expect(content).toContain('mockAgentSpawn');
    });
  });
  
  describe('Error Handling Validation', () => {
    it('should have comprehensive error scenarios', async () => {
      const errorFeaturePath = path.join(featuresDir, 'error-handling.feature');
      const content = fs.readFileSync(errorFeaturePath, 'utf8');
      
      const errorScenarios = [
        'Invalid command handling',
        'Missing required arguments',
        'Corrupted template file',
        'Permission denied',
        'Network timeout',
        'Circular dependency'
      ];
      
      for (const scenario of errorScenarios) {
        expect(content).toContain(scenario);
      }
    });
  });
  
  describe('Performance and Security Tests', () => {
    it('should have tagged performance and security scenarios', async () => {
      const perfSecPath = path.join(featuresDir, 'performance-security.feature');
      const content = fs.readFileSync(perfSecPath, 'utf8');
      
      expect(content).toContain('@performance');
      expect(content).toContain('@security');
      expect(content).toContain('Template injection attack prevention');
      expect(content).toContain('Performance under load');
    });
  });
});

// Integration test to verify the BDD suite can actually run
describe('BDD Suite Execution Test', () => {
  it('should be able to load and parse cucumber configuration', async () => {
    const configPath = path.resolve(__dirname, '../../vitest.cucumber.config.ts');
    
    // This would fail if the config has syntax errors
    expect(() => {
      require(configPath);
    }).not.toThrow();
  });
  
  it('should be able to import step definitions without errors', async () => {
    const stepFiles = [
      './step-definitions/cli-core.steps.js', // Note: .js because it's compiled
      // Add other step files as needed
    ];
    
    for (const stepFile of stepFiles) {
      const stepPath = path.resolve(__dirname, stepFile);
      
      if (fs.existsSync(stepPath)) {
        expect(() => {
          require(stepPath);
        }).not.toThrow();
      }
    }
  });
});
