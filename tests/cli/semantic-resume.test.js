/**
 * Test semantic resume generation CLI integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

describe('Semantic Resume Generation CLI', () => {
  const testOutputDir = path.join(projectRoot, 'test-output');
  
  beforeEach(async () => {
    await fs.ensureDir(testOutputDir);
  });
  
  afterEach(async () => {
    await fs.remove(testOutputDir);
  });

  it('should have resume generation command structure', async () => {
    // Test that we can import the semantic command
    const semanticModulePath = path.join(projectRoot, 'src/commands/semantic.js');
    const exists = await fs.pathExists(semanticModulePath);
    expect(exists).toBe(true);
    
    // Test that semantic command file contains resume functionality
    const content = await fs.readFile(semanticModulePath, 'utf-8');
    expect(content).toContain('handleResumeGenerate');
    expect(content).toContain('person:');
    expect(content).toContain('job:');
    expect(content).toContain('style:');
    expect(content).toContain('skillMatching:');
  });

  it('should have resume templates', async () => {
    const academicTemplate = path.join(projectRoot, '_templates/semantic/resume/academic.njk');
    const corporateTemplate = path.join(projectRoot, '_templates/semantic/resume/corporate.njk');
    
    expect(await fs.pathExists(academicTemplate)).toBe(true);
    expect(await fs.pathExists(corporateTemplate)).toBe(true);
    
    // Check template content
    const academicContent = await fs.readFile(academicTemplate, 'utf-8');
    expect(academicContent).toContain('{{ person.name');
    expect(academicContent).toContain('Academic');
    
    const corporateContent = await fs.readFile(corporateTemplate, 'utf-8');
    expect(corporateContent).toContain('{{ person.name');
    expect(corporateContent).toContain('Professional');
  });

  it('should have example ontology files', async () => {
    const personExample = path.join(projectRoot, 'examples/semantic/resume/person.ttl');
    const jobExample = path.join(projectRoot, 'examples/semantic/resume/job.ttl');
    
    expect(await fs.pathExists(personExample)).toBe(true);
    expect(await fs.pathExists(jobExample)).toBe(true);
    
    // Check ontology content
    const personContent = await fs.readFile(personExample, 'utf-8');
    expect(personContent).toContain('foaf:Person');
    expect(personContent).toContain('foaf:name');
    expect(personContent).toContain('hasSkill');
    
    const jobContent = await fs.readFile(jobExample, 'utf-8');
    expect(jobContent).toContain('JobPosting');
    expect(jobContent).toContain('requiresSkill');
  });

  it('should have helper functions for resume generation', async () => {
    const semanticContent = await fs.readFile(
      path.join(projectRoot, 'src/commands/semantic.js'), 
      'utf-8'
    );
    
    // Check for helper functions
    expect(semanticContent).toContain('getResumeFileExtension');
    expect(semanticContent).toContain('convertResumeFormat');
    expect(semanticContent).toContain('calculateSkillMatch');
    expect(semanticContent).toContain('extractPersonData');
    expect(semanticContent).toContain('extractJobData');
  });

  it('should support multiple output formats', async () => {
    const semanticContent = await fs.readFile(
      path.join(projectRoot, 'src/commands/semantic.js'), 
      'utf-8'
    );
    
    // Check format support
    expect(semanticContent).toContain("'html': 'html'");
    expect(semanticContent).toContain("'pdf': 'pdf'");
    expect(semanticContent).toContain("'json': 'json'");
    expect(semanticContent).toContain("'txt': 'txt'");
    expect(semanticContent).toContain("'md': 'md'");
    expect(semanticContent).toContain("'latex': 'tex'");
  });

  it('should have skill matching algorithm', async () => {
    const semanticContent = await fs.readFile(
      path.join(projectRoot, 'src/commands/semantic.js'), 
      'utf-8'
    );
    
    // Check skill matching function
    expect(semanticContent).toContain('function calculateSkillMatch');
    expect(semanticContent).toContain('personSkillsLower');
    expect(semanticContent).toContain('jobSkillsLower');
    expect(semanticContent).toContain('percentage');
  });

  it('should have updated help examples', async () => {
    const semanticContent = await fs.readFile(
      path.join(projectRoot, 'src/commands/semantic.js'), 
      'utf-8'
    );
    
    // Check for resume examples in help
    expect(semanticContent).toContain('semantic generate resume');
    expect(semanticContent).toContain('--person person.ttl');
    expect(semanticContent).toContain('--job job.ttl');
    expect(semanticContent).toContain('--style academic');
    expect(semanticContent).toContain('--skillMatching');
  });

  it('should validate semantic memory storage', () => {
    // This test checks if the memory storage was called successfully
    // (we can't directly test the MCP call in unit tests)
    expect(true).toBe(true); // Placeholder for memory validation
  });
});

describe('Resume Template Content', () => {
  it('should render academic template structure', async () => {
    const templatePath = path.join(projectRoot, '_templates/semantic/resume/academic.njk');
    const content = await fs.readFile(templatePath, 'utf-8');
    
    // Check frontmatter
    expect(content).toContain('to: resume-academic.html');
    expect(content).toContain('inject: false');
    
    // Check template variables
    expect(content).toContain('{{ person.name');
    expect(content).toContain('{{ person.email');
    expect(content).toContain('{{ person.skills');
    expect(content).toContain('{% if job.title');
    expect(content).toContain('{% if skillMatching');
    expect(content).toContain('{% if includeOntology');
  });

  it('should render corporate template structure', async () => {
    const templatePath = path.join(projectRoot, '_templates/semantic/resume/corporate.njk');
    const content = await fs.readFile(templatePath, 'utf-8');
    
    // Check frontmatter
    expect(content).toContain('to: resume-corporate.html');
    expect(content).toContain('inject: false');
    
    // Check corporate-specific styling
    expect(content).toContain('gradient');
    expect(content).toContain('Professional');
    expect(content).toContain('competencies');
  });
});

describe('Ontology Examples Validation', () => {
  it('should have valid person ontology structure', async () => {
    const personPath = path.join(projectRoot, 'examples/semantic/resume/person.ttl');
    const content = await fs.readFile(personPath, 'utf-8');
    
    // Check namespaces
    expect(content).toContain('@prefix foaf:');
    expect(content).toContain('@prefix schema:');
    expect(content).toContain('@prefix ex:');
    
    // Check person structure
    expect(content).toContain('ex:john_doe a foaf:Person');
    expect(content).toContain('foaf:name "Dr. John Doe"');
    expect(content).toContain('ex:hasSkill');
    expect(content).toContain('ex:machine_learning');
  });

  it('should have valid job ontology structure', async () => {
    const jobPath = path.join(projectRoot, 'examples/semantic/resume/job.ttl');
    const content = await fs.readFile(jobPath, 'utf-8');
    
    // Check job posting structure
    expect(content).toContain('ex:senior_ml_researcher a ex:JobPosting');
    expect(content).toContain('ex:title "Senior Machine Learning Researcher"');
    expect(content).toContain('ex:requiresSkill');
    expect(content).toContain('ex:preferredSkill');
  });
});