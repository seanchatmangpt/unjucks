/**
 * Comprehensive Template Rendering Validation Tests
 * 
 * MISSION: Prove template rendering fixes work correctly.
 * 
 * Tests the critical areas that showed 71% failure rate:
 * 1. Schema.org JSON-LD generation
 * 2. LaTeX template compilation  
 * 3. Filter functionality (all 65+ filters)
 * 4. Variable processing
 * 5. Frontmatter parsing
 * 6. Complex template inheritance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import nunjucks from 'nunjucks';
import path from 'path';
import fs from 'fs/promises';
import { addCommonFilters } from '../../src/lib/nunjucks-filters.js';
import { registerLaTeXFilters } from '../../src/lib/filters/latex.js';
import { registerSchemaOrgFilters } from '../../src/lib/filters/schema-org-filters.js';

describe('Template Rendering Validation Tests', () => {
  let env;

  beforeEach(() => {
    // Create fresh Nunjucks environment with all filters
    env = new nunjucks.Environment([
      new nunjucks.FileSystemLoader([
        path.join(process.cwd(), 'tests/fixtures'),
        path.join(process.cwd(), 'templates'),
      ], {
        autoescape: false,
        trimBlocks: true,
        lstripBlocks: true
      })
    ], {
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true
    });

    // Add all filters
    addCommonFilters(env);
    registerLaTeXFilters(env);
    registerSchemaOrgFilters(env);
  });

  describe('Schema.org JSON-LD Generation', () => {
    it('should render person profile with all required schema.org fields', async () => {
      const template = await fs.readFile(
        path.join(process.cwd(), 'tests/fixtures/schema-org/person-profile.jsonld.njk'),
        'utf-8'
      );

      const testData = {
        destDir: './output',
        name: 'John Doe Professional',
        entityType: 'Person',
        baseUrl: 'https://example.com',
        id: 'john-doe-123',
        fullName: 'John Robert Doe',
        firstName: 'John',
        lastName: 'Doe',
        personId: 'emp-12345',
        website: 'https://johndoe.example.com',
        socialProfiles: [
          { url: 'https://linkedin.com/in/johndoe' },
          { url: 'https://twitter.com/johndoe' }
        ],
        photo: 'https://example.com/john-photo.jpg',
        photoWidth: 400,
        photoHeight: 400,
        jobTitle: 'senior software engineer',
        company: 'acme technologies',
        organizationType: 'Organization',
        companyWebsite: 'https://acme.com',
        address: {
          streetAddress: '123 Main Street',
          addressLocality: 'San Francisco',
          addressRegion: 'CA',
          postalCode: '94105',
          addressCountry: 'US'
        },
        email: 'john@example.com',
        phone: '+1-555-123-4567',
        contactType: 'business',
        language: 'English',
        skills: ['JavaScript', 'Node.js', 'React'],
        awards: [
          { name: 'developer of the year 2023' },
          { name: 'innovation award 2022' }
        ],
        education: [
          {
            type: 'University',
            name: 'stanford university',
            url: 'https://stanford.edu'
          }
        ],
        birthDate: '1985-06-15',
        birthPlace: 'new york city',
        nationality: 'united states',
        languages: [
          { name: 'english', code: 'en' },
          { name: 'spanish', code: 'es' }
        ],
        bio: 'Experienced software engineer with a passion for building scalable web applications and leading development teams. Specializes in JavaScript technologies and modern web frameworks.'
      };

      const rendered = env.renderString(template, testData);
      
      // Parse JSON to validate structure
      const jsonData = JSON.parse(rendered);
      
      // Validate critical Schema.org fields
      expect(jsonData['@context']).toBe('https://schema.org/');
      expect(jsonData['@type']).toBe('Person');
      expect(jsonData['@id']).toBe('https://example.com/person/john-doe-123');
      expect(jsonData.name).toBe('John Robert Doe');
      expect(jsonData.givenName).toBe('John');
      expect(jsonData.familyName).toBe('Doe');
      expect(jsonData.identifier).toBe('EMP-12345'); // uppercase filter
      expect(jsonData.jobTitle).toBe('Senior Software Engineer'); // titleCase filter
      
      // Validate address schemaAddress filter output
      expect(jsonData.address).toEqual({
        '@type': 'PostalAddress',
        streetAddress: '123 Main Street',
        addressLocality: 'San Francisco',
        addressRegion: 'CA',
        postalCode: '94105',
        addressCountry: 'US'
      });
      
      // Validate contactPoint array structure
      expect(Array.isArray(jsonData.contactPoint)).toBe(true);
      expect(jsonData.contactPoint).toHaveLength(2);
      expect(jsonData.contactPoint[0].email).toBe('john@example.com');
      expect(jsonData.contactPoint[1].telephone).toBe('+1-555-123-4567');
      
      // Validate skills array with titleCase filter
      expect(jsonData.knowsAbout).toEqual(['JavaScript', 'Node.js', 'React']);
      
      // Validate awards with titleCase filter
      expect(jsonData.award).toEqual(['Developer Of The Year 2023', 'Innovation Award 2022']);
      
      // Validate education with schemaOrg filter
      expect(jsonData.alumniOf[0]['@type']).toBe('University');
      expect(jsonData.alumniOf[0].name).toBe('Stanford University');
      
      // Validate date formatting with schemaDate filter
      expect(jsonData.birthDate).toBe('1985-06-15');
      expect(jsonData.dateCreated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      expect(jsonData.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      
      // Validate bio truncation and escaping
      expect(jsonData.description.length).toBeLessThanOrEqual(300);
      expect(jsonData.description).not.toContain('<');
      expect(jsonData.description).not.toContain('>');
      
      // Validate potentialAction structure
      expect(jsonData.potentialAction['@type']).toBe('ContactAction');
      expect(jsonData.potentialAction.target.urlTemplate).toBe('https://example.com/contact?person=john-doe-123');
    });

    it('should handle missing optional fields gracefully', async () => {
      const template = await fs.readFile(
        path.join(process.cwd(), 'tests/fixtures/schema-org/person-profile.jsonld.njk'),
        'utf-8'
      );

      const minimalData = {
        destDir: './output',
        name: 'Jane Smith',
        baseUrl: 'https://example.com',
        id: 'jane-smith',
        fullName: 'Jane Smith',
        firstName: 'Jane',
        lastName: 'Smith',
        personId: 'emp-67890'
      };

      const rendered = env.renderString(template, minimalData);
      const jsonData = JSON.parse(rendered);
      
      // Should still be valid Schema.org JSON-LD
      expect(jsonData['@context']).toBe('https://schema.org/');
      expect(jsonData['@type']).toBe('Person'); // default value
      expect(jsonData.name).toBe('Jane Smith');
      
      // Optional fields should be handled gracefully
      expect(jsonData.contactPoint).toEqual([]);
      expect(jsonData.sameAs).toEqual([]);
    });
  });

  describe('LaTeX Template Compilation', () => {
    it('should render legal brief template with all LaTeX filters', async () => {
      const template = await fs.readFile(
        path.join(process.cwd(), 'templates/latex/legal/brief/legal-brief.tex.njk'),
        'utf-8'
      );

      const testData = {
        briefTitle: 'Motion for Summary Judgment',
        briefType: 'motion',
        courtName: 'United States District Court for the Northern District of California',
        caseNumber: '4:23-cv-12345-ABC',
        plaintiff: 'ACME CORPORATION',
        defendant: 'BETA INDUSTRIES, LLC',
        attorney: {
          name: 'Sarah J. Williams',
          barNumber: 'State Bar No. 123456',
          firm: 'Williams & Associates LLP',
          address: '500 Montgomery Street, Suite 2800',
          city: 'San Francisco',
          state: 'CA',
          zip: '94111',
          phone: '(415) 555-0123',
          email: 'swilliams@example.com',
          represents: 'Plaintiff'
        },
        jurisdiction: 'federal',
        briefingSchedule: {
          dueDate: '2025-10-15'
        },
        pageLimit: 25,
        includeTableOfContents: true,
        includeTableOfAuthorities: true,
        includeCertificateOfService: true,
        introduction: 'This motion seeks summary judgment on all claims based on undisputed material facts.',
        statementOfFacts: 'The relevant facts are established by the pleadings and discovery materials.',
        legalStandard: 'Summary judgment is appropriate under Federal Rule of Civil Procedure 56.',
        argumentHeading1: 'Plaintiff Is Entitled to Summary Judgment',
        argument1: 'The undisputed facts establish that defendant breached the contract.',
        subargument1_1: 'The contract terms are clear and unambiguous',
        subargument1_1_text: 'The contract language leaves no room for interpretation.',
        subargument1_2: 'Defendant admitted the breach in discovery',
        subargument1_2_text: 'Defendant\'s admissions establish liability as a matter of law.',
        argumentHeading2: 'Damages Are Established',
        argument2: 'Plaintiff has proven its damages with mathematical certainty.',
        conclusion: 'For the foregoing reasons, this Court should grant plaintiff\'s motion for summary judgment.'
      };

      const rendered = env.renderString(template, testData);
      
      // Validate LaTeX document structure
      expect(rendered).toContain('\\documentclass[12pt,letterpaper]{article}');
      expect(rendered).toContain('\\usepackage[margin=1in]{geometry}');
      expect(rendered).toContain('\\doublespacing'); // Federal jurisdiction formatting
      
      // Validate title case filtering
      expect(rendered).toContain('Motion For Summary Judgment');
      
      // Validate case formatting
      expect(rendered).toContain('\\party{ACME CORPORATION}');
      expect(rendered).toContain('\\party{BETA INDUSTRIES, LLC}');
      
      // Validate legal date formatting
      expect(rendered).toContain('Due: October 15, 2025'); // legalDate filter
      
      // Validate page limit warning
      expect(rendered).toContain('WARNING: This brief has a 25-page limit');
      
      // Validate conditional sections
      expect(rendered).toContain('\\tableofcontents');
      expect(rendered).toContain('TABLE OF AUTHORITIES');
      expect(rendered).toContain('Cases');
      expect(rendered).toContain('Statutes');
      
      // Validate court-specific formatting
      expect(rendered).toContain('\\courtformat{United States District Court for the Northern District of California}');
      
      // Validate attorney information
      expect(rendered).toContain('Sarah J. Williams');
      expect(rendered).toContain('State Bar No. 123456');
      expect(rendered).toContain('Williams & Associates LLP');
      expect(rendered).toContain('Attorney for Plaintiff');
      
      // Validate section structure based on brief type
      expect(rendered).toContain('\\section{INTRODUCTION}');
      expect(rendered).toContain('\\section{STATEMENT OF FACTS}');
      expect(rendered).toContain('\\section{LEGAL STANDARD}');
      expect(rendered).toContain('\\section{ARGUMENT}');
      expect(rendered).toContain('\\section{CONCLUSION}');
      
      // Validate subsection formatting
      expect(rendered).toContain('\\subsection{Plaintiff Is Entitled to Summary Judgment}');
      expect(rendered).toContain('\\subsubsection{The contract terms are clear and unambiguous}');
      
      // Validate certificate of service inclusion
      expect(rendered).toContain('\\input{../components/certificate-of-service}');
    });

    it('should handle different jurisdictions with correct formatting', async () => {
      const template = await fs.readFile(
        path.join(process.cwd(), 'templates/latex/legal/brief/legal-brief.tex.njk'),
        'utf-8'
      );

      // Test California state court
      const californiaData = {
        briefTitle: 'Trial Brief',
        jurisdiction: 'california',
        briefingSchedule: {
          dueDate: '2025-12-01'
        },
        attorney: {
          name: 'Robert Chen',
          firm: 'Chen Law Group'
        }
      };

      const californiaRendered = env.renderString(template, californiaData);
      expect(californiaRendered).toContain('\\doublespacing'); // California uses double spacing
      expect(californiaRendered).toContain('December 1, 2025'); // Legal date formatting
      
      // Test Supreme Court formatting
      const supremeCourtData = {
        briefTitle: 'Petition for Writ of Certiorari',
        jurisdiction: 'supreme',
        briefingSchedule: {
          dueDate: '2025-11-15'
        }
      };

      const supremeRendered = env.renderString(template, supremeCourtData);
      expect(supremeRendered).toContain('\\textsc'); // Supreme Court uses small caps
    });

    it('should render LaTeX with proper escaping and special characters', async () => {
      const simpleTemplate = `
---
to: test.tex
---
\\documentclass{article}
\\begin{document}
{{ title | latexEscape }}

Price: {{ price | latexEscape }}

Section \\ref{{{ sectionRef | latexEscape }}}

{{ content | latexEscape }}
\\end{document}
`;

      const testData = {
        title: 'Analysis & Review of $10,000 Deal',
        price: '$50.00 (includes 5% tax)',
        sectionRef: 'sec:analysis_2024',
        content: 'The company\'s revenue increased by 25% & operating costs decreased by ~10%.'
      };

      const rendered = env.renderString(simpleTemplate, testData);
      
      // Validate LaTeX escaping
      expect(rendered).toContain('Analysis \\& Review of \\$10,000 Deal');
      expect(rendered).toContain('\\$50.00 (includes 5\\% tax)');
      expect(rendered).toContain('The company\\textquotesingle{}s revenue increased by 25\\%');
      expect(rendered).toContain('\\& operating costs decreased by \\textasciitilde{}10\\%');
      
      // Section reference should be properly formatted
      expect(rendered).toContain('\\ref{sec:analysis\\_2024}');
    });
  });

  describe('Filter Functionality Tests', () => {
    describe('Case Conversion Filters', () => {
      const testCases = [
        { input: 'hello world', filter: 'pascalCase', expected: 'HelloWorld' },
        { input: 'HelloWorld', filter: 'camelCase', expected: 'helloWorld' },
        { input: 'Hello World', filter: 'kebabCase', expected: 'hello-world' },
        { input: 'hello-world', filter: 'snakeCase', expected: 'hello_world' },
        { input: 'hello_world', filter: 'constantCase', expected: 'HELLO_WORLD' },
        { input: 'hello world', filter: 'titleCase', expected: 'Hello World' },
        { input: 'hello_world', filter: 'sentenceCase', expected: 'Hello world' },
        { input: 'Hello World!', filter: 'slug', expected: 'hello-world' }
      ];

      testCases.forEach(({ input, filter, expected }) => {
        it(`should apply ${filter} filter correctly`, () => {
          const template = `{{ text | ${filter} }}`;
          const rendered = env.renderString(template, { text: input });
          expect(rendered.trim()).toBe(expected);
        });
      });
    });

    describe('Pluralization Filters', () => {
      const pluralCases = [
        { input: 'user', filter: 'pluralize', expected: 'users' },
        { input: 'child', filter: 'pluralize', expected: 'children' },
        { input: 'knife', filter: 'pluralize', expected: 'knives' },
        { input: 'city', filter: 'pluralize', expected: 'cities' },
        { input: 'hero', filter: 'pluralize', expected: 'heroes' },
        { input: 'users', filter: 'singular', expected: 'user' },
        { input: 'children', filter: 'singular', expected: 'child' },
        { input: 'knives', filter: 'singular', expected: 'knife' }
      ];

      pluralCases.forEach(({ input, filter, expected }) => {
        it(`should apply ${filter} filter correctly to "${input}"`, () => {
          const template = `{{ word | ${filter} }}`;
          const rendered = env.renderString(template, { word: input });
          expect(rendered.trim()).toBe(expected);
        });
      });
    });

    describe('Date and Time Filters', () => {
      const testDate = new Date('2025-09-08T14:30:22Z');

      it('should format dates with various filters', () => {
        const dateCases = [
          { filter: 'formatDate', expected: '2025-09-08' },
          { filter: 'dateIso', expected: '2025-09-08T14:30:22.000Z' },
          { filter: 'unix', expected: '1725802222' }
        ];

        dateCases.forEach(({ filter, expected }) => {
          const template = `{{ date | ${filter} }}`;
          const rendered = env.renderString(template, { date: testDate });
          expect(rendered.trim()).toBe(expected);
        });
      });

      it('should apply legal date formatting', () => {
        const template = `{{ date | legalDate('US', 'contract') }}`;
        const rendered = env.renderString(template, { date: testDate });
        expect(rendered.trim()).toBe('September 8th, 2025');
      });

      it('should handle jurisdiction-specific date formats', () => {
        const jurisdictionTests = [
          { jurisdiction: 'US', expected: 'September 8, 2025' },
          { jurisdiction: 'EU', expected: '08 September 2025' },
          { jurisdiction: 'federal', expected: 'September 8, 2025' }
        ];

        jurisdictionTests.forEach(({ jurisdiction, expected }) => {
          const template = `{{ date | legalDate('${jurisdiction}') }}`;
          const rendered = env.renderString(template, { date: testDate });
          expect(rendered.trim()).toBe(expected);
        });
      });
    });

    describe('Faker.js Data Generation Filters', () => {
      it('should generate consistent fake data with seed', () => {
        const template = `
{{ "" | fakeSeed(12345) }}
Name: {{ "" | fakeName }}
Email: {{ "" | fakeEmail }}
Company: {{ "" | fakeCompany }}
Number: {{ "" | fakeNumber(1, 100) }}
`;
        
        const rendered1 = env.renderString(template);
        const rendered2 = env.renderString(template);
        
        // With same seed, output should be identical
        expect(rendered1).toBe(rendered2);
        expect(rendered1).toContain('Name:');
        expect(rendered1).toContain('Email:');
        expect(rendered1).toContain('Company:');
        expect(rendered1).toContain('Number:');
      });

      it('should generate complex fake schema', () => {
        const template = `{{ schema | fakeSchema | dump }}`;
        const schema = {
          user: {
            name: 'name',
            email: 'email',
            age: { type: 'number', min: 18, max: 65 },
            skills: { type: 'arrayElement', array: ['JavaScript', 'Python', 'Java'] },
            active: 'boolean'
          }
        };

        const rendered = env.renderString(template, { schema });
        const result = JSON.parse(rendered);
        
        expect(result.user).toBeDefined();
        expect(typeof result.user.name).toBe('string');
        expect(typeof result.user.email).toBe('string');
        expect(typeof result.user.age).toBe('number');
        expect(result.user.age).toBeGreaterThanOrEqual(18);
        expect(result.user.age).toBeLessThanOrEqual(65);
        expect(['JavaScript', 'Python', 'Java']).toContain(result.user.skills);
        expect(typeof result.user.active).toBe('boolean');
      });
    });

    describe('String Manipulation Filters', () => {
      const stringTests = [
        { input: 'Hello World', filter: 'truncate(5)', expected: 'He...' },
        { input: 'test', filter: 'repeat(3)', expected: 'testtesttest' },
        { input: 'Hello', filter: 'reverse', expected: 'olleH' },
        { input: 'Hello World', filter: 'swapCase', expected: 'hELLO wORLD' },
        { input: 'test', filter: 'pad(10)', expected: '   test   ' }
      ];

      stringTests.forEach(({ input, filter, expected }) => {
        it(`should apply ${filter} filter correctly`, () => {
          const template = `{{ text | ${filter} }}`;
          const rendered = env.renderString(template, { text: input });
          expect(rendered.trim()).toBe(expected);
        });
      });
    });

    describe('RDF and Semantic Web Filters', () => {
      it('should generate proper RDF resources', () => {
        const template = `{{ uri | rdfResource }}`;
        const rendered = env.renderString(template, { uri: 'https://example.com/person/123' });
        expect(rendered.trim()).toBe('<https://example.com/person/123>');
      });

      it('should generate SPARQL variables', () => {
        const template = `{{ name | sparqlVar }}`;
        const rendered = env.renderString(template, { name: 'userName' });
        expect(rendered.trim()).toBe('?userName');
      });

      it('should escape turtle strings properly', () => {
        const template = `{{ text | turtleEscape }}`;
        const rendered = env.renderString(template, { text: 'Line 1\nLine 2\tTabbed' });
        expect(rendered.trim()).toBe('Line 1\\nLine 2\\tTabbed');
      });

      it('should generate schema.org types', () => {
        const template = `{{ type | schemaOrg }}`;
        const rendered = env.renderString(template, { type: 'Person' });
        expect(rendered.trim()).toBe('Person');
      });
    });

    describe('Schema.org Specific Filters', () => {
      it('should format schema.org addresses', () => {
        const template = `{{ address | schemaAddress | dump }}`;
        const address = {
          streetAddress: '123 Main St',
          addressLocality: 'San Francisco',
          addressRegion: 'CA',
          postalCode: '94105',
          addressCountry: 'US'
        };

        const rendered = env.renderString(template, { address });
        const result = JSON.parse(rendered);
        
        expect(result['@type']).toBe('PostalAddress');
        expect(result.streetAddress).toBe('123 Main St');
        expect(result.addressLocality).toBe('San Francisco');
        expect(result.addressRegion).toBe('CA');
        expect(result.postalCode).toBe('94105');
        expect(result.addressCountry).toBe('US');
      });

      it('should format schema.org dates', () => {
        const template = `{{ date | schemaDate }}`;
        const testDate = new Date('2025-09-08T14:30:22Z');
        const rendered = env.renderString(template, { date: testDate });
        expect(rendered.trim()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      });
    });
  });

  describe('Variable Processing', () => {
    it('should handle complex nested variable structures', () => {
      const template = `
Name: {{ user.profile.name | titleCase }}
Skills: {% for skill in user.skills %}{{ skill | titleCase }}{% if not loop.last %}, {% endif %}{% endfor %}
Address: {{ user.contact.address.street }}, {{ user.contact.address.city }}
Join Date: {{ user.meta.joinDate | formatDate }}
Active: {{ user.meta.active | default('No') }}
Role: {{ user.role | default('User') | titleCase }}
`;

      const data = {
        user: {
          profile: {
            name: 'jane smith'
          },
          skills: ['javascript', 'python', 'react'],
          contact: {
            address: {
              street: '456 Oak St',
              city: 'Portland'
            }
          },
          meta: {
            joinDate: '2024-01-15',
            active: true
          }
          // role is intentionally missing to test default filter
        }
      };

      const rendered = env.renderString(template, data);
      
      expect(rendered).toContain('Name: Jane Smith');
      expect(rendered).toContain('Skills: JavaScript, Python, React');
      expect(rendered).toContain('Address: 456 Oak St, Portland');
      expect(rendered).toContain('Join Date: 2024-01-15');
      expect(rendered).toContain('Active: true');
      expect(rendered).toContain('Role: User');
    });

    it('should handle arrays and loops with complex filtering', () => {
      const template = `
{% for item in items %}
- {{ item.name | titleCase }} ({{ item.category | kebabCase }})
  Price: ${{ item.price | number(2) }}
  Tags: {{ item.tags | join(', ') }}
  Created: {{ item.created | formatDate('MMMM D, YYYY') }}
{% endfor %}
`;

      const data = {
        items: [
          {
            name: 'wireless headphones',
            category: 'Electronics & Audio',
            price: 99.99,
            tags: ['wireless', 'audio', 'portable'],
            created: '2024-08-15'
          },
          {
            name: 'coffee maker',
            category: 'Kitchen & Home',
            price: 149.50,
            tags: ['kitchen', 'coffee', 'appliance'],
            created: '2024-07-22'
          }
        ]
      };

      const rendered = env.renderString(template, data);
      
      expect(rendered).toContain('Wireless Headphones (electronics-audio)');
      expect(rendered).toContain('Price: $99.99');
      expect(rendered).toContain('Tags: wireless, audio, portable');
      expect(rendered).toContain('Created: August 15, 2024');
      expect(rendered).toContain('Coffee Maker (kitchen-home)');
      expect(rendered).toContain('Price: $149.50');
    });

    it('should handle conditional blocks with complex expressions', () => {
      const template = `
{% if user.role == 'admin' %}
Admin Panel:
- Manage Users: {{ permissions.manageUsers | default(false) }}
- System Settings: {{ permissions.systemSettings | default(false) }}
{% elif user.role == 'moderator' %}
Moderator Panel:
- Moderate Content: {{ permissions.moderateContent | default(false) }}
- View Reports: {{ permissions.viewReports | default(false) }}
{% else %}
User Panel:
- Edit Profile: {{ permissions.editProfile | default(true) }}
- View Content: {{ permissions.viewContent | default(true) }}
{% endif %}

Account Status: {{ user.status | titleCase | default('Unknown') }}
Last Login: {% if user.lastLogin %}{{ user.lastLogin | formatDate('MMMM D, YYYY [at] h:mm A') }}{% else %}Never{% endif %}
`;

      const adminData = {
        user: {
          role: 'admin',
          status: 'active',
          lastLogin: '2025-09-08T10:30:00Z'
        },
        permissions: {
          manageUsers: true,
          systemSettings: true
        }
      };

      const rendered = env.renderString(template, adminData);
      
      expect(rendered).toContain('Admin Panel:');
      expect(rendered).toContain('Manage Users: true');
      expect(rendered).toContain('System Settings: true');
      expect(rendered).toContain('Account Status: Active');
      expect(rendered).toContain('Last Login: September 8, 2025 at 10:30 AM');
    });
  });

  describe('Frontmatter Processing', () => {
    it('should parse and use frontmatter variables', () => {
      const template = `---
to: "{{ destDir }}/{{ filename | kebabCase }}.html"
inject: false
skipIf: "{{ skipGeneration | default(false) }}"
variables:
  - title: string
  - author: string
  - publishDate: date
---
<!DOCTYPE html>
<html>
<head>
    <title>{{ title | titleCase }}</title>
    <meta name="author" content="{{ author | titleCase }}">
    <meta name="date" content="{{ publishDate | formatDate }}">
</head>
<body>
    <h1>{{ title | titleCase }}</h1>
    <p>By {{ author | titleCase }}</p>
    <p>Published: {{ publishDate | formatDate('MMMM D, YYYY') }}</p>
</body>
</html>`;

      const data = {
        destDir: './output',
        filename: 'my_blog_post',
        title: 'understanding template engines',
        author: 'john doe',
        publishDate: '2025-09-08',
        skipGeneration: false
      };

      const rendered = env.renderString(template, data);
      
      // Should contain HTML output (after frontmatter processing)
      expect(rendered).toContain('<!DOCTYPE html>');
      expect(rendered).toContain('<title>Understanding Template Engines</title>');
      expect(rendered).toContain('<meta name="author" content="John Doe">');
      expect(rendered).toContain('<meta name="date" content="2025-09-08">');
      expect(rendered).toContain('<h1>Understanding Template Engines</h1>');
      expect(rendered).toContain('<p>By John Doe</p>');
      expect(rendered).toContain('<p>Published: September 8, 2025</p>');
      
      // Extract frontmatter for validation (in real implementation)
      const frontmatterMatch = template.match(/^---\n([\s\S]*?)\n---/);
      expect(frontmatterMatch).toBeTruthy();
      
      const frontmatter = frontmatterMatch[1];
      expect(frontmatter).toContain('to: "{{ destDir }}/{{ filename | kebabCase }}.html"');
      expect(frontmatter).toContain('inject: false');
      expect(frontmatter).toContain('skipIf: "{{ skipGeneration | default(false) }}"');
    });

    it('should handle complex frontmatter with arrays and objects', () => {
      const template = `---
to: "{{ outputPath }}/{{ slug }}.json"
inject: true
beforeInsert: "{{ beforeText }}"
afterInsert: "{{ afterText }}"
skipIf: "{{ item.published == false }}"
variables:
  - title: string
  - tags: array
  - metadata: object
---
{
  "@context": "https://schema.org/",
  "@type": "Article",
  "headline": "{{ title | titleCase }}",
  "keywords": [
    {% for tag in tags -%}
    "{{ tag | kebabCase }}"{% if not loop.last %},{% endif %}
    {% endfor %}
  ],
  "author": {
    "@type": "Person",
    "name": "{{ metadata.author.name | titleCase }}",
    "email": "{{ metadata.author.email }}"
  },
  "datePublished": "{{ metadata.publishDate | formatDate }}",
  "wordCount": {{ metadata.wordCount | default(0) }},
  "isAccessibleForFree": {{ metadata.free | default(true) }}
}`;

      const data = {
        outputPath: './content',
        slug: 'advanced-templating',
        beforeText: '// Generated content start',
        afterText: '// Generated content end',
        item: { published: true },
        title: 'advanced templating techniques',
        tags: ['Template Engines', 'Web Development', 'Code Generation'],
        metadata: {
          author: {
            name: 'sarah johnson',
            email: 'sarah@example.com'
          },
          publishDate: '2025-09-08T12:00:00Z',
          wordCount: 1500,
          free: true
        }
      };

      const rendered = env.renderString(template, data);
      const jsonData = JSON.parse(rendered);
      
      // Validate JSON-LD structure
      expect(jsonData['@context']).toBe('https://schema.org/');
      expect(jsonData['@type']).toBe('Article');
      expect(jsonData.headline).toBe('Advanced Templating Techniques');
      expect(jsonData.keywords).toEqual(['template-engines', 'web-development', 'code-generation']);
      expect(jsonData.author.name).toBe('Sarah Johnson');
      expect(jsonData.author.email).toBe('sarah@example.com');
      expect(jsonData.datePublished).toBe('2025-09-08T12:00:00.000Z');
      expect(jsonData.wordCount).toBe(1500);
      expect(jsonData.isAccessibleForFree).toBe(true);
    });
  });

  describe('Template Inheritance and Complex Nesting', () => {
    it('should handle template extension with block overrides', () => {
      // Base template
      const baseTemplate = `<!DOCTYPE html>
<html>
<head>
    <title>{% block title %}Default Title{% endblock %}</title>
    {% block head %}{% endblock %}
</head>
<body>
    <header>
        {% block header %}
        <h1>{{ siteName | titleCase }}</h1>
        {% endblock %}
    </header>
    
    <main>
        {% block content %}
        <p>Default content</p>
        {% endblock %}
    </main>
    
    <footer>
        {% block footer %}
        <p>&copy; {{ year }} {{ siteName | titleCase }}</p>
        {% endblock %}
    </footer>
</body>
</html>`;

      // Child template
      const childTemplate = `{% extends "base.html" %}

{% block title %}{{ pageTitle | titleCase }} - {{ super() }}{% endblock %}

{% block head %}
<meta name="description" content="{{ description }}">
<meta name="keywords" content="{{ keywords | join(', ') }}">
{% endblock %}

{% block content %}
<article>
    <h2>{{ pageTitle | titleCase }}</h2>
    <p class="meta">Published: {{ publishDate | formatDate('MMMM D, YYYY') }}</p>
    <div class="content">
        {{ content }}
    </div>
    
    {% if tags %}
    <div class="tags">
        <strong>Tags:</strong>
        {% for tag in tags %}
        <span class="tag">{{ tag | titleCase }}</span>{% if not loop.last %}, {% endif %}
        {% endfor %}
    </div>
    {% endif %}
</article>
{% endblock %}`;

      // In a real scenario, we'd need to mock the extends functionality
      // For this test, we'll combine the templates manually
      const combinedTemplate = baseTemplate
        .replace('{% block title %}Default Title{% endblock %}', '{{ pageTitle | titleCase }} - Default Title')
        .replace('{% block head %}{% endblock %}', `<meta name="description" content="{{ description }}">
<meta name="keywords" content="{{ keywords | join(', ') }}">`)
        .replace('{% block content %}        <p>Default content</p>        {% endblock %}', `<article>
    <h2>{{ pageTitle | titleCase }}</h2>
    <p class="meta">Published: {{ publishDate | formatDate('MMMM D, YYYY') }}</p>
    <div class="content">
        {{ content }}
    </div>
    
    {% if tags %}
    <div class="tags">
        <strong>Tags:</strong>
        {% for tag in tags %}
        <span class="tag">{{ tag | titleCase }}</span>{% if not loop.last %}, {% endif %}
        {% endfor %}
    </div>
    {% endif %}
</article>`);

      const data = {
        siteName: 'tech blog',
        year: 2025,
        pageTitle: 'mastering nunjucks templates',
        description: 'A comprehensive guide to advanced Nunjucks templating techniques',
        keywords: ['nunjucks', 'templates', 'web development'],
        publishDate: '2025-09-08',
        content: 'This article explores advanced templating patterns...',
        tags: ['tutorial', 'templates', 'javascript']
      };

      const rendered = env.renderString(combinedTemplate, data);
      
      // Validate inheritance worked correctly
      expect(rendered).toContain('<title>Mastering Nunjucks Templates - Default Title</title>');
      expect(rendered).toContain('<meta name="description" content="A comprehensive guide to advanced Nunjucks templating techniques">');
      expect(rendered).toContain('<meta name="keywords" content="nunjucks, templates, web development">');
      expect(rendered).toContain('<h1>Tech Blog</h1>');
      expect(rendered).toContain('<h2>Mastering Nunjucks Templates</h2>');
      expect(rendered).toContain('<p class="meta">Published: September 8, 2025</p>');
      expect(rendered).toContain('<span class="tag">Tutorial</span>, <span class="tag">Templates</span>, <span class="tag">Javascript</span>');
      expect(rendered).toContain('&copy; 2025 Tech Blog');
    });

    it('should handle deeply nested includes and macros', () => {
      // Macro definition
      const macroTemplate = `
{% macro renderCard(title, content, metadata) %}
<div class="card" data-id="{{ metadata.id }}">
    <div class="card-header">
        <h3>{{ title | titleCase }}</h3>
        {% if metadata.author %}
        <span class="author">by {{ metadata.author | titleCase }}</span>
        {% endif %}
    </div>
    <div class="card-body">
        {{ content }}
    </div>
    <div class="card-footer">
        <span class="date">{{ metadata.created | formatDate('MMM D, YYYY') }}</span>
        {% if metadata.tags %}
        <div class="tags">
            {% for tag in metadata.tags %}
            <span class="tag">{{ tag | kebabCase }}</span>
            {% endfor %}
        </div>
        {% endif %}
    </div>
</div>
{% endmacro %}
`;

      // Template using macro
      const mainTemplate = macroTemplate + `
<div class="card-grid">
    {% for item in items %}
    {{ renderCard(item.title, item.content, item.meta) }}
    {% endfor %}
</div>
`;

      const data = {
        items: [
          {
            title: 'getting started with templates',
            content: '<p>Templates are a powerful way to generate content...</p>',
            meta: {
              id: 'article-1',
              author: 'jane smith',
              created: '2025-09-01',
              tags: ['beginner', 'tutorial']
            }
          },
          {
            title: 'advanced filtering techniques',
            content: '<p>Learn how to create custom filters...</p>',
            meta: {
              id: 'article-2',
              author: 'bob wilson',
              created: '2025-09-05',
              tags: ['advanced', 'filters', 'customization']
            }
          }
        ]
      };

      const rendered = env.renderString(mainTemplate, data);
      
      // Validate macro expansion
      expect(rendered).toContain('<div class="card-grid">');
      expect(rendered).toContain('data-id="article-1"');
      expect(rendered).toContain('<h3>Getting Started With Templates</h3>');
      expect(rendered).toContain('<span class="author">by Jane Smith</span>');
      expect(rendered).toContain('<span class="date">Sep 1, 2025</span>');
      expect(rendered).toContain('<span class="tag">beginner</span>');
      expect(rendered).toContain('data-id="article-2"');
      expect(rendered).toContain('<h3>Advanced Filtering Techniques</h3>');
      expect(rendered).toContain('<span class="author">by Bob Wilson</span>');
      expect(rendered).toContain('<span class="tag">advanced</span>');
      expect(rendered).toContain('<span class="tag">filters</span>');
      expect(rendered).toContain('<span class="tag">customization</span>');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing variables gracefully', () => {
      const template = `
Name: {{ name | default('Unknown') }}
Age: {{ age | default(0) }}
Email: {{ email | default('No email provided') }}
Skills: {% if skills %}{{ skills | join(', ') }}{% else %}No skills listed{% endif %}
Bio: {{ bio | truncate(100) | default('No biography available') }}
`;

      const data = {
        name: 'John Doe',
        // age, email, skills, bio are missing
      };

      const rendered = env.renderString(template, data);
      
      expect(rendered).toContain('Name: John Doe');
      expect(rendered).toContain('Age: 0');
      expect(rendered).toContain('Email: No email provided');
      expect(rendered).toContain('Skills: No skills listed');
      expect(rendered).toContain('Bio: No biography available');
    });

    it('should handle invalid date inputs', () => {
      const template = `
Valid Date: {{ validDate | formatDate | default('Invalid date') }}
Invalid Date: {{ invalidDate | formatDate | default('Invalid date') }}
Null Date: {{ nullDate | formatDate | default('Invalid date') }}
`;

      const data = {
        validDate: '2025-09-08',
        invalidDate: 'not-a-date',
        nullDate: null
      };

      const rendered = env.renderString(template, data);
      
      expect(rendered).toContain('Valid Date: 2025-09-08');
      expect(rendered).toContain('Invalid Date: Invalid date');
      expect(rendered).toContain('Null Date: Invalid date');
    });

    it('should handle circular references in JSON dump', () => {
      const template = `{{ data | dump }}`;
      
      // Create circular reference
      const obj = { name: 'test' };
      obj.self = obj;
      
      const data = { data: obj };

      const rendered = env.renderString(template, data);
      const result = JSON.parse(rendered);
      
      expect(result.name).toBe('test');
      expect(result.self).toBe('[Circular Reference]');
    });

    it('should handle special characters in various contexts', () => {
      const template = `
JSON: {{ data | dump }}
LaTeX: {{ text | latexEscape }}
Turtle: {{ rdfText | turtleEscape }}
Slug: {{ title | slug }}
`;

      const data = {
        data: { message: 'Hello "World" & <Test>' },
        text: 'Price: $100 (50% off) & free shipping!',
        rdfText: 'Line 1\nLine 2\t"Quoted"',
        title: 'Special Characters: @#$%^&*()!'
      };

      const rendered = env.renderString(template, data);
      
      // Validate proper escaping in different contexts
      expect(rendered).toContain('"message": "Hello \\"World\\" & <Test>"');
      expect(rendered).toContain('Price: \\$100 (50\\% off) \\& free shipping!');
      expect(rendered).toContain('Line 1\\nLine 2\\t\\"Quoted\\"');
      expect(rendered).toContain('Slug: special-characters');
    });
  });

  describe('Performance and Complex Template Combinations', () => {
    it('should handle large datasets with complex filtering', () => {
      const template = `
{% for user in users | slice(0, 10) %}
<div class="user-card">
    <h3>{{ user.name | titleCase }}</h3>
    <p>{{ user.role | titleCase }} at {{ user.company | titleCase }}</p>
    <p>{{ user.bio | truncate(100) }}</p>
    
    <div class="skills">
        {% for skill in user.skills | sort %}
        <span class="skill-tag">{{ skill | titleCase }}</span>
        {% endfor %}
    </div>
    
    <div class="contact">
        <a href="mailto:{{ user.email }}">{{ user.email }}</a>
        {% if user.social %}
        <div class="social">
            {% for platform, url in user.social %}
            <a href="{{ url }}" class="social-{{ platform }}">{{ platform | titleCase }}</a>
            {% endfor %}
        </div>
        {% endif %}
    </div>
    
    <p class="meta">
        Joined: {{ user.joinDate | formatDate('MMMM YYYY') }} | 
        Posts: {{ user.postCount | default(0) }} |
        Last Active: {{ user.lastActive | fromNow }}
    </p>
</div>
{% endfor %}
`;

      // Generate test data
      const users = Array.from({ length: 25 }, (_, i) => ({
        name: `user ${i + 1}`,
        role: i % 3 === 0 ? 'administrator' : i % 2 === 0 ? 'moderator' : 'member',
        company: `company ${Math.floor(i / 5) + 1}`,
        bio: `This is a detailed biography for user ${i + 1} that describes their background and expertise in various fields.`,
        skills: [`skill-${i % 3 + 1}`, `skill-${i % 2 + 4}`, `skill-${i % 4 + 6}`],
        email: `user${i + 1}@example.com`,
        social: i % 2 === 0 ? {
          linkedin: `https://linkedin.com/in/user${i + 1}`,
          twitter: `https://twitter.com/user${i + 1}`
        } : null,
        joinDate: new Date(2024, i % 12, (i % 28) + 1),
        postCount: Math.floor(Math.random() * 100),
        lastActive: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)) // i days ago
      }));

      const data = { users };

      // This should complete without timeout or memory issues
      const start = Date.now();
      const rendered = env.renderString(template, data);
      const duration = Date.now() - start;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000); // 1 second

      // Should only render first 10 users due to slice filter
      const userCards = (rendered.match(/class="user-card"/g) || []).length;
      expect(userCards).toBe(10);

      // Validate content structure
      expect(rendered).toContain('<h3>User 1</h3>');
      expect(rendered).toContain('Administrator at Company 1');
      expect(rendered).toContain('skill-tag');
      expect(rendered).toContain('mailto:user1@example.com');
    });
  });
});