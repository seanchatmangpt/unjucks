#!/usr/bin/env node
// test-workshop.js - Workshop functionality validator

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import { execSync } from 'child_process';

class WorkshopValidator {
  constructor() {
    this.results = {
      templates: { total: 0, valid: 0, errors: [] },
      knowledge: { total: 0, valid: 0, errors: [] },
      rules: { total: 0, valid: 0, errors: [] },
      tutorials: { total: 0, valid: 0, errors: [] },
      overall: 'pending'
    };
  }

  async validate() {
    console.log('🧪 KGEN Workshop Validation Suite\n');
    
    await this.validateTemplates();
    await this.validateKnowledge();
    await this.validateRules();
    await this.validateTutorials();
    
    this.generateReport();
  }

  async validateTemplates() {
    console.log('📋 Validating Templates...');
    
    const templateDir = '_templates';
    if (!existsSync(templateDir)) {
      this.results.templates.errors.push('Template directory not found');
      return;
    }

    // Find all .njk files
    const templates = this.findFiles(templateDir, '.njk');
    this.results.templates.total = templates.length;

    for (const template of templates) {
      try {
        await this.validateTemplate(template);
        this.results.templates.valid++;
        console.log(`  ✅ ${template}`);
      } catch (error) {
        this.results.templates.errors.push(`${template}: ${error.message}`);
        console.log(`  ❌ ${template}: ${error.message}`);
      }
    }
  }

  async validateTemplate(templatePath) {
    const content = readFileSync(templatePath, 'utf8');
    
    // Check for frontmatter
    if (!content.startsWith('---')) {
      throw new Error('Missing frontmatter');
    }

    const parts = content.split('---');
    if (parts.length < 3) {
      throw new Error('Invalid frontmatter structure');
    }

    const frontmatter = parts[1];
    const templateContent = parts.slice(2).join('---');

    // Parse frontmatter (simple YAML parsing)
    const lines = frontmatter.trim().split('\n');
    const config = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        config[key.trim()] = value;
      }
    }

    // Validate required fields
    if (!config.to) {
      throw new Error('Missing "to" field in frontmatter');
    }

    // Check for template variables usage
    const variablePattern = /\{\{[\s\w\|\.]+\}\}/g;
    const variables = templateContent.match(variablePattern) || [];
    
    if (variables.length === 0) {
      throw new Error('No template variables found - may not be a dynamic template');
    }

    // Validate Nunjucks syntax (basic check)
    const invalidSyntax = [
      /\{\{[^}]*\{\{/,  // Nested opening braces
      /\}\}[^{]*\}\}/   // Nested closing braces
    ];

    for (const pattern of invalidSyntax) {
      if (pattern.test(templateContent)) {
        throw new Error('Invalid Nunjucks syntax detected');
      }
    }

    return { config, variables: variables.length };
  }

  async validateKnowledge() {
    console.log('\n🧠 Validating Knowledge Base...');
    
    const knowledgeDir = 'knowledge';
    if (!existsSync(knowledgeDir)) {
      this.results.knowledge.errors.push('Knowledge directory not found');
      return;
    }

    const knowledgeFiles = this.findFiles(knowledgeDir, '.ttl');
    this.results.knowledge.total = knowledgeFiles.length;

    for (const file of knowledgeFiles) {
      try {
        await this.validateRDFFile(file);
        this.results.knowledge.valid++;
        console.log(`  ✅ ${file}`);
      } catch (error) {
        this.results.knowledge.errors.push(`${file}: ${error.message}`);
        console.log(`  ❌ ${file}: ${error.message}`);
      }
    }

    // Validate SHACL shapes if present
    const shapesFile = join(knowledgeDir, 'shapes.ttl');
    if (existsSync(shapesFile)) {
      try {
        await this.validateSHACLShapes(shapesFile);
        console.log(`  ✅ SHACL shapes validated`);
      } catch (error) {
        this.results.knowledge.errors.push(`SHACL validation: ${error.message}`);
        console.log(`  ❌ SHACL validation: ${error.message}`);
      }
    }
  }

  async validateRDFFile(filePath) {
    const content = readFileSync(filePath, 'utf8');
    
    // Basic RDF/Turtle syntax validation
    const lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
    
    let hasPrefix = false;
    let hasTriple = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check for prefix declarations
      if (trimmed.startsWith('@prefix')) {
        hasPrefix = true;
        
        // Validate prefix syntax
        if (!trimmed.match(/@prefix\s+\w*:\s+<[^>]+>\s+\./)) {
          throw new Error(`Invalid prefix syntax: ${trimmed}`);
        }
      }
      
      // Check for triples (simplified)
      if (trimmed.includes(' a ') || trimmed.includes(' rdfs:') || trimmed.includes(' kgen:')) {
        hasTriple = true;
      }
    }
    
    if (!hasPrefix) {
      throw new Error('No RDF prefix declarations found');
    }
    
    if (!hasTriple) {
      throw new Error('No RDF triples found');
    }

    // Check for KGEN ontology usage
    if (!content.includes('kgen:')) {
      console.warn(`    ⚠️  ${filePath}: No KGEN ontology terms used`);
    }

    return { prefixes: hasPrefix, triples: hasTriple };
  }

  async validateSHACLShapes(filePath) {
    const content = readFileSync(filePath, 'utf8');
    
    // Basic SHACL validation
    if (!content.includes('sh:NodeShape') && !content.includes('sh:PropertyShape')) {
      throw new Error('No SHACL shapes found');
    }
    
    if (!content.includes('sh:targetClass') && !content.includes('sh:targetNode')) {
      throw new Error('No SHACL targets defined');
    }
    
    return true;
  }

  async validateRules() {
    console.log('\n⚖️  Validating Rules...');
    
    const rulesDir = 'rules';
    if (!existsSync(rulesDir)) {
      this.results.rules.errors.push('Rules directory not found');
      return;
    }

    const ruleFiles = this.findFiles(rulesDir, '.n3');
    this.results.rules.total = ruleFiles.length;

    for (const file of ruleFiles) {
      try {
        await this.validateN3Rules(file);
        this.results.rules.valid++;
        console.log(`  ✅ ${file}`);
      } catch (error) {
        this.results.rules.errors.push(`${file}: ${error.message}`);
        console.log(`  ❌ ${file}: ${error.message}`);
      }
    }
  }

  async validateN3Rules(filePath) {
    const content = readFileSync(filePath, 'utf8');
    
    // Basic N3 rule validation
    const rulePattern = /\{[^}]+\}\s*=>\s*\{[^}]+\}/g;
    const rules = content.match(rulePattern) || [];
    
    if (rules.length === 0) {
      throw new Error('No N3 rules found');
    }
    
    // Check for proper prefix declarations
    if (!content.includes('@prefix')) {
      throw new Error('No prefix declarations found');
    }
    
    // Validate rule syntax (basic)
    for (const rule of rules) {
      if (!rule.includes('=>')) {
        throw new Error('Invalid rule syntax - missing implication (=>)');
      }
    }
    
    console.log(`    📏 Found ${rules.length} rules`);
    return { ruleCount: rules.length };
  }

  async validateTutorials() {
    console.log('\n📚 Validating Tutorials...');
    
    const tutorialDir = 'tutorials';
    if (!existsSync(tutorialDir)) {
      this.results.tutorials.errors.push('Tutorial directory not found');
      return;
    }

    const tutorials = this.findFiles(tutorialDir, '.md');
    this.results.tutorials.total = tutorials.length;

    const expectedTutorials = [
      '01-getting-started.md',
      '02-deterministic-generation.md', 
      '03-drift-detection.md'
    ];

    for (const expected of expectedTutorials) {
      const tutorialPath = join(tutorialDir, expected);
      if (existsSync(tutorialPath)) {
        try {
          await this.validateTutorial(tutorialPath);
          this.results.tutorials.valid++;
          console.log(`  ✅ ${expected}`);
        } catch (error) {
          this.results.tutorials.errors.push(`${expected}: ${error.message}`);
          console.log(`  ❌ ${expected}: ${error.message}`);
        }
      } else {
        this.results.tutorials.errors.push(`Missing tutorial: ${expected}`);
        console.log(`  ❌ Missing: ${expected}`);
      }
    }
  }

  async validateTutorial(filePath) {
    const content = readFileSync(filePath, 'utf8');
    
    // Check for required sections
    const requiredSections = ['# Tutorial', '## Overview', '## Step'];
    for (const section of requiredSections) {
      if (!content.includes(section)) {
        throw new Error(`Missing required section: ${section}`);
      }
    }
    
    // Check for code blocks
    const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length;
    if (codeBlocks < 3) {
      console.warn(`    ⚠️  Few code examples (${codeBlocks}) - consider adding more`);
    }
    
    // Check word count (should be substantial)
    const wordCount = content.split(/\s+/).length;
    if (wordCount < 1000) {
      console.warn(`    ⚠️  Tutorial may be too short (${wordCount} words)`);
    }
    
    return { codeBlocks, wordCount };
  }

  findFiles(dir, extension) {
    const files = [];
    
    const scan = (currentDir) => {
      const items = readdirSync(currentDir, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = join(currentDir, item.name);
        
        if (item.isDirectory()) {
          scan(itemPath);
        } else if (item.isFile() && extname(item.name) === extension) {
          files.push(itemPath);
        }
      }
    };
    
    scan(dir);
    return files;
  }

  generateReport() {
    console.log('\n📊 Workshop Validation Report\n');
    console.log('=' * 50);
    
    const categories = ['templates', 'knowledge', 'rules', 'tutorials'];
    let totalValid = 0;
    let totalFiles = 0;
    
    for (const category of categories) {
      const result = this.results[category];
      const percentage = result.total > 0 ? Math.round((result.valid / result.total) * 100) : 0;
      
      console.log(`${category.toUpperCase()}:`);
      console.log(`  Valid: ${result.valid}/${result.total} (${percentage}%)`);
      
      if (result.errors.length > 0) {
        console.log(`  Errors:`);
        result.errors.forEach(error => console.log(`    - ${error}`));
      }
      
      console.log('');
      
      totalValid += result.valid;
      totalFiles += result.total;
    }
    
    const overallPercentage = totalFiles > 0 ? Math.round((totalValid / totalFiles) * 100) : 0;
    
    console.log('OVERALL SUMMARY:');
    console.log(`  Total Files: ${totalFiles}`);
    console.log(`  Valid Files: ${totalValid}`);
    console.log(`  Success Rate: ${overallPercentage}%`);
    
    if (overallPercentage >= 80) {
      console.log('  Status: ✅ WORKSHOP READY');
      this.results.overall = 'ready';
    } else if (overallPercentage >= 60) {
      console.log('  Status: ⚠️  NEEDS IMPROVEMENT');
      this.results.overall = 'needs-improvement';
    } else {
      console.log('  Status: ❌ NOT READY');
      this.results.overall = 'not-ready';
    }
    
    console.log('\n' + '=' * 50);
    
    // Return status code for CI/CD
    return this.results.overall === 'ready' ? 0 : 1;
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new WorkshopValidator();
  
  validator.validate()
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((error) => {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    });
}

export default WorkshopValidator;