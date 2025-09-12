#!/usr/bin/env node

/**
 * KGEN Enhanced Template Discovery Verification Test
 * 
 * Comprehensive test of the enhanced KGEN CLI template discovery system
 * Tests both UNJUCKS and KGEN template format support
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CLI_PATH = './bin/kgen-enhanced.mjs';

class KgenVerificationTest {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
    this.verbose = process.argv.includes('--verbose');
  }

  log(message) {
    if (this.verbose) {
      console.log(`[TEST] ${message}`);
    }
  }

  async runCommand(cmd) {
    try {
      const result = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
      return JSON.parse(result);
    } catch (error) {
      throw new Error(`Command failed: ${cmd}\n${error.message}`);
    }
  }

  test(name, testFn) {
    this.log(`Running: ${name}`);
    try {
      const result = testFn();
      if (result === true || result === undefined) {
        this.results.passed++;
        this.results.tests.push({ name, status: 'PASS' });
        console.log(`✅ ${name}`);
      } else {
        throw new Error(result || 'Test failed');
      }
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAIL', error: error.message });
      console.log(`❌ ${name}: ${error.message}`);
    }
  }

  async runAllTests() {
    console.log('🚀 KGEN Enhanced Template Discovery Verification\n');

    // Test 1: CLI Initialization
    this.test('CLI responds to help command', () => {
      try {
        execSync(`${CLI_PATH} --help`, { encoding: 'utf8', timeout: 10000 });
        return true;
      } catch (error) {
        return `CLI not accessible: ${error.message}`;
      }
    });

    // Test 2: Template Listing
    this.test('Template listing returns results', async () => {
      const result = await this.runCommand(`${CLI_PATH} templates ls`);
      
      if (!result.success) {
        return `Template listing failed: ${result.error}`;
      }
      
      if (!Array.isArray(result.templates)) {
        return 'Templates should be an array';
      }
      
      if (result.templates.length === 0) {
        return 'Should discover at least some templates';
      }
      
      this.log(`Found ${result.templates.length} templates`);
      return true;
    });

    // Test 3: Multi-format Support
    this.test('Discovers both UNJUCKS and KGEN formats', async () => {
      const result = await this.runCommand(`${CLI_PATH} templates ls`);
      
      const formats = new Set(result.templates.map(t => t.format));
      
      if (!formats.has('unjucks')) {
        return 'Should discover UNJUCKS templates';
      }
      
      if (!formats.has('kgen')) {
        return 'Should discover KGEN templates';
      }
      
      this.log(`Formats discovered: ${Array.from(formats).join(', ')}`);
      return true;
    });

    // Test 4: Multiple Template Sources
    this.test('Discovers templates from multiple sources', async () => {
      const result = await this.runCommand(`${CLI_PATH} templates stats`);
      
      if (!result.success) {
        return `Stats command failed: ${result.error}`;
      }
      
      const sources = result.stats.templateSources;
      if (!Array.isArray(sources) || sources.length < 2) {
        return 'Should discover from multiple template sources';
      }
      
      const existingSources = sources.filter(s => s.exists).length;
      if (existingSources < 2) {
        return `Should have at least 2 existing template sources, found ${existingSources}`;
      }
      
      this.log(`Template sources: ${existingSources} existing, ${sources.length} total`);
      return true;
    });

    // Test 5: Template Details
    this.test('Shows detailed template information', async () => {
      // First get a template to test
      const listResult = await this.runCommand(`${CLI_PATH} templates ls`);
      
      if (listResult.templates.length === 0) {
        return 'No templates to test details for';
      }
      
      const testTemplate = listResult.templates[0];
      const detailResult = await this.runCommand(`${CLI_PATH} templates show "${testTemplate.id}"`);
      
      if (!detailResult.success) {
        return `Template details failed: ${detailResult.error}`;
      }
      
      const template = detailResult.template;
      if (!template.variables || !Array.isArray(template.variables)) {
        return 'Template should have variables array';
      }
      
      if (!template.structure) {
        return 'Template should have structure analysis';
      }
      
      this.log(`Template "${testTemplate.id}" has ${template.variables.length} variables`);
      return true;
    });

    // Test 6: Search Functionality
    this.test('Search finds relevant templates', async () => {
      const searchResult = await this.runCommand(`${CLI_PATH} templates search "api"`);
      
      if (!searchResult.success) {
        return `Search failed: ${searchResult.error}`;
      }
      
      if (!Array.isArray(searchResult.templates)) {
        return 'Search should return template array';
      }
      
      // Verify results contain "api" in name, description, or tags
      const relevantResults = searchResult.templates.filter(t => 
        t.name.toLowerCase().includes('api') ||
        t.description.toLowerCase().includes('api') ||
        t.tags.some(tag => tag.toLowerCase().includes('api'))
      );
      
      if (relevantResults.length === 0 && searchResult.templates.length > 0) {
        return 'Search results should be relevant to query';
      }
      
      this.log(`Search for "api" found ${searchResult.templates.length} results`);
      return true;
    });

    // Test 7: Category Filtering
    this.test('Filters templates by category', async () => {
      const categoryResult = await this.runCommand(`${CLI_PATH} templates ls --category=backend`);
      
      if (!categoryResult.success) {
        return `Category filtering failed: ${categoryResult.error}`;
      }
      
      if (categoryResult.templates.length > 0) {
        const nonBackendTemplates = categoryResult.templates.filter(t => t.category !== 'backend');
        if (nonBackendTemplates.length > 0) {
          return `Category filter failed: found ${nonBackendTemplates.length} non-backend templates`;
        }
      }
      
      this.log(`Found ${categoryResult.templates.length} backend templates`);
      return true;
    });

    // Test 8: Variable Extraction
    this.test('Extracts template variables correctly', async () => {
      const listResult = await this.runCommand(`${CLI_PATH} templates ls`);
      
      // Find a template with variables
      const templateWithVars = listResult.templates.find(t => 
        t.variables && t.variables.length > 0
      );
      
      if (!templateWithVars) {
        return 'Should find at least one template with variables';
      }
      
      const detailResult = await this.runCommand(`${CLI_PATH} templates show "${templateWithVars.id}"`);
      const template = detailResult.template;
      
      // Verify variable structure
      const firstVar = template.variables[0];
      if (!firstVar.name || !firstVar.description) {
        return 'Variables should have name and description';
      }
      
      this.log(`Template "${templateWithVars.id}" has variables: ${template.variables.map(v => v.name).join(', ')}`);
      return true;
    });

    // Test 9: UNJUCKS Compatibility
    this.test('UNJUCKS templates maintain compatibility', async () => {
      const listResult = await this.runCommand(`${CLI_PATH} templates ls --format=unjucks`);
      
      if (!listResult.success) {
        return `UNJUCKS listing failed: ${listResult.error}`;
      }
      
      if (listResult.templates.length === 0) {
        return 'Should find some UNJUCKS templates';
      }
      
      const unjucksTemplate = listResult.templates[0];
      if (!unjucksTemplate.generator || !unjucksTemplate.template) {
        return 'UNJUCKS templates should have generator and template properties';
      }
      
      // Check expected UNJUCKS ID format
      if (unjucksTemplate.id !== `${unjucksTemplate.generator}/${unjucksTemplate.template}`) {
        return 'UNJUCKS template ID should follow generator/template format';
      }
      
      this.log(`UNJUCKS template: ${unjucksTemplate.id} (${unjucksTemplate.files.length} files)`);
      return true;
    });

    // Test 10: KGEN Format Support
    this.test('KGEN templates have rich metadata', async () => {
      const listResult = await this.runCommand(`${CLI_PATH} templates ls --format=kgen`);
      
      if (!listResult.success) {
        return `KGEN listing failed: ${listResult.error}`;
      }
      
      if (listResult.templates.length === 0) {
        return 'Should find some KGEN templates';
      }
      
      const kgenTemplate = listResult.templates.find(t => 
        t.frontmatter && Object.keys(t.frontmatter).length > 1
      );
      
      if (!kgenTemplate) {
        return 'Should find KGEN templates with rich frontmatter';
      }
      
      if (!kgenTemplate.version || !kgenTemplate.license) {
        return 'KGEN templates should have version and license';
      }
      
      this.log(`KGEN template: ${kgenTemplate.id} (v${kgenTemplate.version}, ${kgenTemplate.license})`);
      return true;
    });

    // Summary
    const total = this.results.passed + this.results.failed;
    const successRate = ((this.results.passed / total) * 100).toFixed(1);
    
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests
        .filter(t => t.status === 'FAIL')
        .forEach(t => console.log(`   ${t.name}: ${t.error}`));
    }
    
    console.log('\n🎯 Enhanced KGEN Template Discovery System:');
    
    try {
      const stats = await this.runCommand(`${CLI_PATH} templates stats`);
      if (stats.success) {
        console.log(`📚 Total Templates: ${stats.stats.total}`);
        console.log(`🔧 Template Sources: ${stats.stats.templateSources.length}`);
        console.log(`📊 Formats: ${Object.keys(stats.stats.formats).join(', ')}`);
        console.log(`🏷️  Categories: ${Object.keys(stats.stats.categories).length}`);
      }
    } catch (error) {
      console.log('Could not retrieve final stats');
    }
    
    return this.results.failed === 0;
  }
}

// Run tests
const tester = new KgenVerificationTest();
const success = await tester.runAllTests();
process.exit(success ? 0 : 1);