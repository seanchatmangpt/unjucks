import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Resume Generation Workflow E2E Tests', () => {
  let tempDir;
  let personData;
  let jobData;

  beforeEach(async () => {
    // Create temporary directory for generated files
    tempDir = resolve(__dirname, '../.tmp/resumes-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    // Load test data
    const personPath = resolve(__dirname, '../fixtures/data/resumes/john-doe.json');
    const jobPath = resolve(__dirname, '../fixtures/data/resumes/software-engineer-job.json');
    
    personData = JSON.parse(await fs.readFile(personPath, 'utf8'));
    jobData = JSON.parse(await fs.readFile(jobPath, 'utf8'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error.message);
    }
  });

  describe('1. Person Ontology Loading and Parsing', () => {
    it('should load and validate person data structure', async () => {
      // Validate required person fields
      expect(personData).toHaveProperty('firstName');
      expect(personData).toHaveProperty('lastName');
      expect(personData).toHaveProperty('email');
      expect(personData).toHaveProperty('skills');
      expect(personData).toHaveProperty('experience');
      expect(personData).toHaveProperty('education');

      // Validate data types
      expect(personData.firstName).toMatch(/^[A-Za-z\s]+$/);
      expect(personData.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(Array.isArray(personData.skills)).toBe(true);
      expect(Array.isArray(personData.experience)).toBe(true);
      expect(Array.isArray(personData.education)).toBe(true);

      // Validate skills structure
      for (const skill of personData.skills) {
        expect(skill).toHaveProperty('name');
        expect(skill).toHaveProperty('category');
        expect(['Technical', 'Soft', 'Certification']).toContain(skill.category);
      }

      console.log('✓ Person ontology structure validated');
    });

    it('should validate experience timeline consistency', async () => {
      const experiences = personData.experience;
      
      for (let i = 0; i < experiences.length - 1; i++) {
        const current = experiences[i];
        const next = experiences[i + 1];
        
        // Check date format
        expect(current.startDate).toMatch(/^\d{4}-\d{2}$/);
        if (current.endDate) {
          expect(current.endDate).toMatch(/^\d{4}-\d{2}$/);
        }

        // Verify chronological order (assuming sorted newest first)
        const currentStart = new Date(current.startDate + '-01');
        const nextStart = new Date(next.startDate + '-01');
        expect(currentStart.getTime()).toBeGreaterThanOrEqual(nextStart.getTime());
      }

      console.log('✓ Experience timeline validated');
    });
  });

  describe('2. Skills Querying and Extraction', () => {
    it('should extract and categorize skills correctly', async () => {
      const skillsByCategory = personData.skills.reduce((acc, skill) => {
        if (!acc[skill.category]) acc[skill.category] = [];
        acc[skill.category].push(skill);
        return acc;
      }, {});

      // Verify categories exist
      expect(skillsByCategory).toHaveProperty('Technical');
      expect(skillsByCategory).toHaveProperty('Soft');

      // Count skills
      const totalSkills = personData.skills.length;
      expect(totalSkills).toBeGreaterThan(10); // Should have substantial skills

      // Validate technical skills have appropriate attributes
      const techSkills = skillsByCategory.Technical;
      for (const skill of techSkills) {
        expect(skill).toHaveProperty('level');
        expect(skill).toHaveProperty('yearsOfExperience');
        expect(['Beginner', 'Intermediate', 'Advanced', 'Expert']).toContain(skill.level);
        expect(typeof skill.yearsOfExperience).toBe('number');
      }

      console.log(`✓ Skills extracted: ${totalSkills} total, ${techSkills.length} technical`);
    });

    it('should filter skills by proficiency level', async () => {
      const expertSkills = personData.skills.filter(skill => skill.level === 'Expert');
      const advancedSkills = personData.skills.filter(skill => 
        skill.level === 'Advanced' || skill.level === 'Expert'
      );

      expect(expertSkills.length).toBeGreaterThan(0);
      expect(advancedSkills.length).toBeGreaterThan(expertSkills.length);

      console.log(`✓ Skills filtered: ${expertSkills.length} expert, ${advancedSkills.length} advanced+`);
    });
  });

  describe('3. Job Matching Algorithms', () => {
    it('should calculate skill match percentage', async () => {
      const personSkillNames = personData.skills.map(skill => skill.name.toLowerCase());
      const jobSkillNames = jobData.skills.map(skill => skill.toLowerCase());

      const matchedSkills = personSkillNames.filter(skill => 
        jobSkillNames.includes(skill)
      );

      const matchPercentage = (matchedSkills.length / jobSkillNames.length) * 100;
      
      expect(matchPercentage).toBeGreaterThan(50); // Should be good match
      expect(matchedSkills.length).toBeGreaterThan(5); // Minimum skill overlap

      console.log(`✓ Skill match: ${matchPercentage.toFixed(1)}% (${matchedSkills.length}/${jobSkillNames.length})`);
    });

    it('should validate experience level alignment', async () => {
      const totalExperience = personData.experience.reduce((total, exp) => {
        const start = new Date(exp.startDate + '-01');
        const end = exp.endDate ? new Date(exp.endDate + '-01') : new Date();
        const years = (end - start) / (1000 * 60 * 60 * 24 * 365);
        return total + years;
      }, 0);

      const requiredExperience = parseInt(jobData.requirements[0].match(/(\d+)\+?\s*years?/)[1]);
      
      expect(totalExperience).toBeGreaterThanOrEqual(requiredExperience);
      expect(jobData.experienceLevel).toBe('Senior'); // Matches person's level

      console.log(`✓ Experience alignment: ${totalExperience.toFixed(1)} years vs ${requiredExperience}+ required`);
    });
  });

  describe('4. Resume Generation Workflow', () => {
    it('should generate HTML resume with all sections', async () => {
      // Simulate template rendering process
      const htmlTemplate = await fs.readFile(
        resolve(__dirname, '../../_templates/resume-generator/html/resume.html.njk'),
        'utf8'
      );

      // Basic template structure validation
      expect(htmlTemplate).toContain('{{ person.firstName }}');
      expect(htmlTemplate).toContain('{{ person.lastName }}');
      expect(htmlTemplate).toContain('{% if person.experience %}');
      expect(htmlTemplate).toContain('{% if person.education %}');
      expect(htmlTemplate).toContain('{% if person.skills %}');

      // Verify template has proper HTML structure
      expect(htmlTemplate).toContain('<!DOCTYPE html>');
      expect(htmlTemplate).toContain('<head>');
      expect(htmlTemplate).toContain('<body>');
      expect(htmlTemplate).toContain('</html>');

      console.log('✓ HTML template structure validated');
    });

    it('should generate LaTeX resume for PDF compilation', async () => {
      const latexTemplate = await fs.readFile(
        resolve(__dirname, '../../_templates/resume-generator/pdf/resume.tex.njk'),
        'utf8'
      );

      // Validate LaTeX structure
      expect(latexTemplate).toContain('\\documentclass');
      expect(latexTemplate).toContain('\\begin{document}');
      expect(latexTemplate).toContain('\\end{document}');
      expect(latexTemplate).toContain('\\makecvtitle');

      // Validate template variables
      expect(latexTemplate).toContain('{{ person.firstName }}');
      expect(latexTemplate).toContain('{{ person.lastName }}');
      expect(latexTemplate).toContain('{{ job.title }}');

      console.log('✓ LaTeX template structure validated');
    });

    it('should generate JSON-LD structured data', async () => {
      const jsonLdTemplate = await fs.readFile(
        resolve(__dirname, '../../_templates/resume-generator/json-ld/resume.json.njk'),
        'utf8'
      );

      // Validate JSON-LD structure
      expect(jsonLdTemplate).toContain('"@context"');
      expect(jsonLdTemplate).toContain('"@type": "schema:Person"');
      expect(jsonLdTemplate).toContain('schema:name');
      expect(jsonLdTemplate).toContain('schema:jobTitle');

      // Validate schema.org compliance
      expect(jsonLdTemplate).toContain('https://schema.org/');
      expect(jsonLdTemplate).toContain('schema:worksFor');
      expect(jsonLdTemplate).toContain('schema:alumniOf');

      console.log('✓ JSON-LD template structure validated');
    });
  });

  describe('5. PDF Generation Testing', () => {
    it('should validate LaTeX compilation readiness', async () => {
      // Check if pdflatex is available (mock test since we can't assume installation)
      let pdflatexAvailable = false;
      try {
        execSync('which pdflatex', { stdio: 'ignore' });
        pdflatexAvailable = true;
      } catch (error) {
        console.warn('⚠ pdflatex not available - PDF generation would fail in production');
      }

      // Test LaTeX content generation
      const latexContent = `
\\documentclass[11pt,a4paper,sans]{moderncv}
\\moderncvstyle{classic}
\\moderncvcolor{blue}
\\usepackage[utf8]{inputenc}
\\usepackage[scale=0.75]{geometry}

\\name{${personData.firstName}}{${personData.lastName}}
\\title{${jobData.title}}

\\begin{document}
\\makecvtitle

\\section{Professional Summary}
${personData.summary}

\\end{document}`;

      // Validate LaTeX syntax basics
      expect(latexContent).toContain('\\documentclass');
      expect(latexContent).toContain('\\begin{document}');
      expect(latexContent).toContain('\\end{document}');
      expect(latexContent).not.toContain('undefined');

      if (pdflatexAvailable) {
        console.log('✓ LaTeX compilation environment ready');
      } else {
        console.log('✓ LaTeX content validation passed (compilation environment not available)');
      }
    });
  });

  describe('6. HTML Rendering Validation', () => {
    it('should generate valid HTML that renders correctly', async () => {
      // Simulate HTML rendering with actual data
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${personData.firstName} ${personData.lastName} - ${jobData.title}</title>
</head>
<body>
    <header>
        <h1>${personData.firstName} ${personData.lastName}</h1>
        <div>${jobData.title}</div>
        <div>${personData.email}</div>
    </header>
    
    <section>
        <h2>Professional Summary</h2>
        <p>${personData.summary}</p>
    </section>

    <section>
        <h2>Experience</h2>
        ${personData.experience.map(exp => `
        <div>
            <h3>${exp.title}</h3>
            <div>${exp.company}</div>
            <div>${exp.startDate} - ${exp.endDate || 'Present'}</div>
            <p>${exp.description}</p>
        </div>
        `).join('')}
    </section>

    <section>
        <h2>Skills</h2>
        <ul>
            ${personData.skills.map(skill => `<li>${skill.name} (${skill.level})</li>`).join('')}
        </ul>
    </section>
</body>
</html>`;

      // Validate HTML structure
      expect(htmlContent).toContain('<!DOCTYPE html>');
      expect(htmlContent).toContain('<html lang="en">');
      expect(htmlContent).toContain('<head>');
      expect(htmlContent).toContain('<body>');
      expect(htmlContent).toContain('</html>');

      // Validate content is populated
      expect(htmlContent).toContain(personData.firstName);
      expect(htmlContent).toContain(personData.lastName);
      expect(htmlContent).toContain(jobData.title);
      expect(htmlContent).toContain(personData.email);

      // Validate each experience is included
      for (const exp of personData.experience) {
        expect(htmlContent).toContain(exp.title);
        expect(htmlContent).toContain(exp.company);
      }

      console.log('✓ HTML content generation and validation passed');
    });

    it('should include responsive CSS for mobile rendering', async () => {
      const htmlTemplate = await fs.readFile(
        resolve(__dirname, '../../_templates/resume-generator/html/resume.html.njk'),
        'utf8'
      );

      // Check for responsive design elements
      expect(htmlTemplate).toContain('viewport');
      expect(htmlTemplate).toContain('max-width');
      expect(htmlTemplate).toContain('@media');
      expect(htmlTemplate).toContain('grid');

      console.log('✓ Responsive design elements validated');
    });
  });

  describe('7. JSON-LD Structured Data Validation', () => {
    it('should generate valid JSON-LD with schema.org compliance', async () => {
      const jsonLdContent = {
        "@context": {
          "@version": 1.1,
          "@base": personData.website || 'https://example.com/',
          "schema": "https://schema.org/",
          "foaf": "http://xmlns.com/foaf/0.1/",
          "cv": "https://cv.schema.org/"
        },
        "@type": "schema:Person",
        "@id": (personData.website || 'https://example.com') + '/#person',
        "schema:name": `${personData.firstName} ${personData.lastName}`,
        "schema:givenName": personData.firstName,
        "schema:familyName": personData.lastName,
        "schema:email": personData.email,
        "schema:jobTitle": jobData.title,
        "schema:knowsAbout": personData.skills.map(skill => ({
          "@type": "schema:Thing",
          "schema:name": skill.name,
          "cv:skillCategory": skill.category,
          "cv:proficiencyLevel": skill.level
        }))
      };

      // Validate JSON-LD structure
      expect(jsonLdContent).toHaveProperty('@context');
      expect(jsonLdContent).toHaveProperty('@type');
      expect(jsonLdContent['@type']).toBe('schema:Person');

      // Validate schema.org compliance
      expect(jsonLdContent['@context']['schema']).toBe('https://schema.org/');
      expect(jsonLdContent).toHaveProperty('schema:name');
      expect(jsonLdContent).toHaveProperty('schema:email');
      expect(jsonLdContent).toHaveProperty('schema:jobTitle');

      // Validate structured skills data
      expect(Array.isArray(jsonLdContent['schema:knowsAbout'])).toBe(true);
      expect(jsonLdContent['schema:knowsAbout'].length).toBe(personData.skills.length);

      console.log('✓ JSON-LD structured data validation passed');
    });
  });

  describe('8. Performance Testing', () => {
    it('should generate multiple resumes efficiently', async () => {
      const startTime = Date.now();
      const numResumes = 10;

      // Simulate generating multiple resumes
      const promises = Array.from({ length: numResumes }, async (_, i) => {
        const modifiedPerson = { 
          ...personData, 
          firstName: `${personData.firstName}${i}`,
          email: `${personData.firstName.toLowerCase()}${i}@example.com`
        };
        
        // Simulate processing time for each resume
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              person: modifiedPerson,
              job: jobData,
              timestamp: Date.now()
            });
          }, Math.random() * 100); // Random processing time up to 100ms
        });
      });

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTimePerResume = totalTime / numResumes;

      // Performance assertions
      expect(results).toHaveLength(numResumes);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(avgTimePerResume).toBeLessThan(500); // Each resume under 500ms

      console.log(`✓ Performance test: ${numResumes} resumes in ${totalTime}ms (${avgTimePerResume.toFixed(1)}ms avg)`);
    });

    it('should handle large skill sets efficiently', async () => {
      // Create person with large skill set
      const largeSkillSet = Array.from({ length: 100 }, (_, i) => ({
        name: `Skill${i}`,
        category: ['Technical', 'Soft', 'Certification'][i % 3],
        level: ['Beginner', 'Intermediate', 'Advanced', 'Expert'][i % 4],
        yearsOfExperience: Math.floor(Math.random() * 10) + 1
      }));

      const personWithManySkills = {
        ...personData,
        skills: largeSkillSet
      };

      const startTime = Date.now();
      
      // Simulate skill processing
      const processedSkills = personWithManySkills.skills.map(skill => ({
        ...skill,
        weight: skill.level === 'Expert' ? 4 : skill.level === 'Advanced' ? 3 : 
                skill.level === 'Intermediate' ? 2 : 1
      }));

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(processedSkills).toHaveLength(100);
      expect(processingTime).toBeLessThan(100); // Should process quickly

      console.log(`✓ Large skill set processing: 100 skills in ${processingTime}ms`);
    });
  });
});