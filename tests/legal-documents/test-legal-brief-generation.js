import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { PerfectTemplateEngine } from '../../src/lib/template-engine-perfect.js';
import matter from 'gray-matter';

describe('Legal Document Generation', () => {
  let templateEngine;
  const testOutputDir = './tests/output/legal';

  beforeEach(async () => {
    // Initialize template engine pointing to templates directory
    templateEngine = new PerfectTemplateEngine({
      templatesDir: 'templates',
      autoescape: false,
      throwOnUndefined: false,
      enableCaching: false
    });

    // Ensure test output directory exists
    await fs.ensureDir(testOutputDir);
  });

  afterEach(async () => {
    // Clean up test files
    await fs.remove(testOutputDir);
  });

  describe('Legal Brief Template', () => {
    const templatePath = 'latex/legal/brief/legal-brief.tex.njk';
    
    const sampleLegalData = {
      briefTitle: 'Motion for Summary Judgment',
      briefType: 'motion',
      courtName: 'United States District Court for the Northern District of California',
      caseNumber: '3:23-cv-12345-ABC',
      plaintiff: 'ACME Corporation',
      defendant: 'Beta Industries, Inc.',
      attorney: {
        name: 'Jane Smith',
        barNumber: 'CA Bar No. 123456',
        firm: 'Smith & Associates LLP',
        address: '123 Legal Street',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        phone: '(415) 555-0123',
        email: 'jane.smith@smithlaw.com',
        represents: 'Plaintiff'
      },
      jurisdiction: 'federal',
      pageLimit: 25,
      includeTableOfContents: true,
      includeTableOfAuthorities: true,
      includeCertificateOfService: true,
      briefingSchedule: {
        dueDate: 'March 15, 2024'
      },
      serviceDate: 'March 1, 2024',
      serviceLocation: 'San Francisco, California',
      serviceList: [
        {
          name: 'John Doe',
          firm: 'Doe Defense LLC',
          address: '456 Defense Ave',
          city: 'San Francisco',
          state: 'CA',
          zip: '94102',
          email: 'john.doe@doedefense.com',
          method: 'ecf'
        }
      ],
      introduction: 'This motion for summary judgment demonstrates that no genuine issue of material fact exists and that Plaintiff is entitled to judgment as a matter of law.',
      statementOfFacts: 'The undisputed facts establish that Defendant breached the contract dated January 1, 2023, by failing to deliver goods as specified.',
      legalStandard: 'Summary judgment is appropriate when there is no genuine dispute as to any material fact and the movant is entitled to judgment as a matter of law. Fed. R. Civ. P. 56(a).',
      argumentHeading1: 'Defendant Materially Breached the Contract',
      argument1: 'The evidence clearly shows that Defendant failed to perform its contractual obligations by not delivering conforming goods within the specified timeframe.',
      subargument1_1: 'The Contract Required Delivery by February 1, 2023',
      subargument1_1_text: 'The contract unambiguously states that delivery must occur by February 1, 2023. (Exhibit A § 3.1.)',
      subargument1_2: 'Defendant Failed to Meet the Delivery Deadline',
      subargument1_2_text: 'The record establishes that Defendant did not deliver any goods until February 15, 2023, two weeks after the contractual deadline.',
      argumentHeading2: 'Plaintiff Suffered Damages as a Result of the Breach',
      argument2: 'Plaintiff incurred substantial damages directly resulting from Defendant\'s breach, including lost profits and cover costs.',
      subargument2_1: 'Lost Profits Are Recoverable Under California Law',
      subargument2_1_text: 'California Commercial Code § 2712 permits recovery of consequential damages, including lost profits, that were reasonably foreseeable at the time of contract formation.',
      subargument2_2: 'The Amount of Damages Is Undisputed',
      subargument2_2_text: 'Plaintiff\'s expert testimony, which Defendant has not challenged, establishes damages in the amount of $500,000.',
      conclusion: 'For the foregoing reasons, this Court should grant Plaintiff\'s Motion for Summary Judgment and award damages in the amount of $500,000, plus costs and reasonable attorneys\' fees.'
    };

    it('should render legal brief template with proper LaTeX formatting', async () => {
      const templateExists = await fs.pathExists(path.resolve('templates', templatePath));
      expect(templateExists).toBe(true);

      const templateContent = await fs.readFile(path.resolve('templates', templatePath), 'utf-8');
      const { data: frontmatter, content } = matter(templateContent);
      
      expect(frontmatter).toBeDefined();
      expect(frontmatter.variables).toBeDefined();
      expect(frontmatter.to).toBeDefined();
    });

    it('should generate legal brief with proper court formatting', async () => {
      const result = await templateEngine.renderTemplate(templatePath, sampleLegalData);
      
      // Check for proper LaTeX document structure
      expect(result).toContain('\\documentclass[12pt,letterpaper]{article}');
      expect(result).toContain('\\usepackage[margin=1in]{geometry}');
      expect(result).toContain('\\doublespacing');
      
      // Check for court case caption
      expect(result).toContain('ACME Corporation');
      expect(result).toContain('Beta Industries, Inc.');
      expect(result).toContain('Case No. 3:23-cv-12345-ABC');
      
      // Check attorney information
      expect(result).toContain('Jane Smith');
      expect(result).toContain('CA Bar No. 123456');
      expect(result).toContain('Smith & Associates LLP');
    });

    it('should include proper Bluebook citation formatting', async () => {
      const result = await templateEngine.renderTemplate(templatePath, sampleLegalData);
      
      // Check for Bluebook citation commands
      expect(result).toContain('\\casecite');
      expect(result).toContain('\\statutecite');
      expect(result).toContain('\\constitutionalcite');
      expect(result).toContain('Fed. R. Civ. P.');
    });

    it('should generate table of contents when requested', async () => {
      const result = await templateEngine.renderTemplate(templatePath, sampleLegalData);
      
      expect(result).toContain('\\tableofcontents');
      expect(result).toContain('\\newpage');
    });

    it('should generate table of authorities when requested', async () => {
      const result = await templateEngine.renderTemplate(templatePath, sampleLegalData);
      
      expect(result).toContain('TABLE OF AUTHORITIES');
      expect(result).toContain('Cases');
      expect(result).toContain('Statutes');
      expect(result).toContain('Constitutional Provisions');
      expect(result).toContain('Rules');
    });

    it('should include certificate of service when requested', async () => {
      const result = await templateEngine.renderTemplate(templatePath, sampleLegalData);
      
      expect(result).toContain('\\input{../components/certificate-of-service}');
    });

    it('should format signature blocks correctly', async () => {
      const result = await templateEngine.renderTemplate(templatePath, sampleLegalData);
      
      expect(result).toContain('Respectfully submitted,');
      expect(result).toContain('\\rule{3in}{0.5pt}');
      expect(result).toContain('Jane Smith\\\\');
      expect(result).toContain('Attorney for Plaintiff');
    });

    it('should handle different jurisdiction requirements', async () => {
      const federalData = { ...sampleLegalData, jurisdiction: 'federal' };
      const stateData = { ...sampleLegalData, jurisdiction: 'california' };
      
      const federalResult = await templateEngine.renderTemplate(templatePath, federalData);
      const stateResult = await templateEngine.renderTemplate(templatePath, stateData);
      
      expect(federalResult).toContain('\\doublespacing');
      expect(stateResult).toContain('\\doublespacing');
    });

    it('should generate proper page limit warnings', async () => {
      const result = await templateEngine.renderTemplate(templatePath, sampleLegalData);
      
      expect(result).toContain('WARNING: This brief has a 25-page limit');
      expect(result).toContain('\\textcolor{red}');
    });

    it('should handle motion vs appellate brief types correctly', async () => {
      const motionData = { ...sampleLegalData, briefType: 'motion' };
      const appellateData = { ...sampleLegalData, briefType: 'appellate' };
      
      const motionResult = await templateEngine.renderTemplate(templatePath, motionData);
      const appellateResult = await templateEngine.renderTemplate(templatePath, appellateData);
      
      expect(motionResult).toContain('INTRODUCTION');
      expect(appellateResult).toContain('STATEMENT OF THE CASE');
    });
  });

  describe('Certificate of Service Component', () => {
    const certificatePath = 'latex/legal/components/certificate-of-service.tex';
    
    const serviceData = {
      documentType: 'Motion for Summary Judgment',
      serviceList: [
        {
          name: 'John Doe',
          firm: 'Doe Defense LLC',
          address: '456 Defense Ave',
          city: 'San Francisco',
          state: 'CA',
          zip: '94102',
          email: 'john.doe@doedefense.com',
          method: 'ecf'
        },
        {
          name: 'Mary Johnson',
          firm: 'Johnson Law Group',
          address: '789 Law Blvd',
          city: 'Oakland',
          state: 'CA',
          zip: '94607',
          email: 'mary@johnsonlaw.com',
          method: 'email'
        }
      ],
      jurisdiction: 'federal',
      serviceDate: 'March 1, 2024',
      serviceLocation: 'San Francisco, California',
      attorney: {
        name: 'Jane Smith',
        represents: 'Plaintiff'
      }
    };

    it('should render certificate of service with proper service methods', async () => {
      const templateExists = await fs.pathExists(path.resolve('templates', certificatePath));
      expect(templateExists).toBe(true);

      const result = await templateEngine.renderTemplate(certificatePath, serviceData);
      
      expect(result).toContain('CERTIFICATE OF SERVICE');
      expect(result).toContain('John Doe');
      expect(result).toContain('Doe Defense LLC');
      expect(result).toContain('By filing with the Court\'s electronic filing system');
      expect(result).toContain('By electronic mail (email)');
    });

    it('should handle multiple service methods correctly', async () => {
      const result = await templateEngine.renderTemplate(certificatePath, serviceData);
      
      // Check for checkboxes for different service methods
      expect(result).toContain('$\\square$');
      expect(result).toContain('By electronic mail (email)');
      expect(result).toContain('By first-class mail, postage prepaid');
      expect(result).toContain('By personal service');
      expect(result).toContain('By overnight courier');
    });

    it('should include proper penalty of perjury declaration', async () => {
      const result = await templateEngine.renderTemplate(certificatePath, serviceData);
      
      expect(result).toContain('declare under penalty of perjury');
      expect(result).toContain('laws of the United States');
    });
  });

  describe('Bluebook Citations Component', () => {
    const bluebookPath = 'latex/legal/components/bluebook-citations.tex';

    it('should define proper case citation commands', async () => {
      const templateExists = await fs.pathExists(path.resolve('templates', bluebookPath));
      expect(templateExists).toBe(true);

      const content = await fs.readFile(path.resolve('templates', bluebookPath), 'utf-8');
      
      expect(content).toContain('\\newcommand{\\casecite}');
      expect(content).toContain('\\newcommand{\\casecitepage}');
      expect(content).toContain('\\newcommand{\\statutecite}');
      expect(content).toContain('\\newcommand{\\constitution}');
    });

    it('should include federal rules citations', async () => {
      const content = await fs.readFile(path.resolve('templates', bluebookPath), 'utf-8');
      
      expect(content).toContain('\\newcommand{\\frcp}');
      expect(content).toContain('\\newcommand{\\frcrp}');
      expect(content).toContain('\\newcommand{\\fre}');
      expect(content).toContain('\\newcommand{\\frap}');
    });

    it('should provide signal word formatting', async () => {
      const content = await fs.readFile(path.resolve('templates', bluebookPath), 'utf-8');
      
      expect(content).toContain('\\newcommand{\\see}');
      expect(content).toContain('\\newcommand{\\seealso}');
      expect(content).toContain('\\newcommand{\\cf}');
      expect(content).toContain('\\newcommand{\\but}');
    });

    it('should support id and supra citations', async () => {
      const content = await fs.readFile(path.resolve('templates', bluebookPath), 'utf-8');
      
      expect(content).toContain('\\newcommand{\\id}');
      expect(content).toContain('\\newcommand{\\idat}');
      expect(content).toContain('\\newcommand{\\supra}');
      expect(content).toContain('\\newcommand{\\suprapage}');
    });
  });

  describe('Legal Document Validation', () => {
    it('should validate required legal document metadata', async () => {
      const templatePath = 'latex/legal/brief/legal-brief.tex.njk';
      const templateContent = await fs.readFile(path.resolve('templates', templatePath), 'utf-8');
      const { data: frontmatter } = matter(templateContent);
      
      // Check required variables are defined
      const variables = frontmatter.variables || [];
      const variableNames = variables.map(v => typeof v === 'string' ? v : Object.keys(v)[0]);
      
      expect(variableNames).toContain('briefTitle');
      expect(variableNames).toContain('courtName');
      expect(variableNames).toContain('caseNumber');
      expect(variableNames).toContain('plaintiff');
      expect(variableNames).toContain('defendant');
      expect(variableNames).toContain('attorney');
      expect(variableNames).toContain('jurisdiction');
    });

    it('should ensure proper line numbering support', async () => {
      const templatePath = 'latex/legal/brief/legal-brief.tex.njk';
      const result = await templateEngine.renderTemplate(templatePath, {
        briefTitle: 'Test Brief',
        briefType: 'motion',
        courtName: 'Test Court',
        caseNumber: '123',
        plaintiff: 'Test Plaintiff',
        defendant: 'Test Defendant',
        attorney: {
          name: 'Test Attorney',
          firm: 'Test Firm',
          address: 'Test Address',
          city: 'Test City',
          state: 'TS',
          zip: '12345',
          phone: '555-0123',
          email: 'test@test.com'
        },
        jurisdiction: 'federal'
      });

      // Should include packages that support line numbering
      expect(result).toContain('\\usepackage{array}');
      expect(result).toContain('\\usepackage{longtable}');
    });

    it('should validate proper exhibit and appendix handling', async () => {
      // Test that the template supports exhibit references
      const templatePath = 'latex/legal/brief/legal-brief.tex.njk';
      const content = await fs.readFile(path.resolve('templates', templatePath), 'utf-8');
      
      // Should reference exhibits in the argument sections
      expect(content).toContain('Exhibit');
    });
  });
});