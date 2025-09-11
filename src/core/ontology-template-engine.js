/**
 * Ontology-Driven Template Engine
 * Integrates RDF/Turtle ontology data with Nunjucks templates
 */

import * as N3 from 'n3';
import nunjucks from 'nunjucks';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class OntologyTemplateEngine {
  constructor(options = {}) {
    this.store = new N3.Store();
    this.parser = new N3.Parser();
    
    // Configure Nunjucks
    this.env = nunjucks.configure(options.templatePath || join(__dirname, '../../templates'), {
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true
    });
    
    // Add custom filters for ontology data
    this.registerOntologyFilters();
  }

  /**
   * Load RDF/Turtle ontology data
   */
  async loadOntology(ttlFilePath) {
    const ttlContent = await fs.readFile(ttlFilePath, 'utf8');
    return new Promise((resolve, reject) => {
      this.parser.parse(ttlContent, (error, quad) => {
        if (error) {
          reject(error);
        } else if (quad) {
          this.store.addQuad(quad);
        } else {
          resolve(this.store);
        }
      });
    });
  }

  /**
   * Load multiple ontology files
   */
  async loadOntologies(ttlFilePaths) {
    for (const path of ttlFilePaths) {
      await this.loadOntology(path);
    }
    return this.store;
  }

  /**
   * Execute SPARQL query on loaded ontologies
   */
  async query(sparqlQuery) {
    const bindingsStream = await this.store.match();
    const results = [];
    
    // Simple SPARQL-like query implementation
    // For production, use a proper SPARQL engine
    return new Promise((resolve) => {
      bindingsStream.on('data', (quad) => {
        results.push({
          subject: quad.subject.value,
          predicate: quad.predicate.value,
          object: quad.object.value
        });
      });
      
      bindingsStream.on('end', () => {
        resolve(results);
      });
    });
  }

  /**
   * Extract structured data from ontology for templates
   */
  async extractTemplateData(subjectUri) {
    const data = {
      subject: subjectUri,
      properties: {},
      relationships: []
    };

    // Get all quads for this subject
    const quads = this.store.getQuads(subjectUri, null, null);
    
    for (const quad of quads) {
      const predicate = quad.predicate.value;
      const object = quad.object.value;
      
      // Handle different predicate types
      if (predicate.includes('name') || predicate.includes('Name')) {
        data.properties.name = object;
      } else if (predicate.includes('firstName')) {
        data.properties.firstName = object;
      } else if (predicate.includes('lastName')) {
        data.properties.lastName = object;
      } else if (predicate.includes('email') || predicate.includes('mbox')) {
        data.properties.email = object.replace('mailto:', '');
      } else if (predicate.includes('jobTitle')) {
        data.properties.jobTitle = object;
      } else if (predicate.includes('hasSkill')) {
        if (!data.properties.skills) data.properties.skills = [];
        data.properties.skills.push(this.extractSkillName(object));
      } else if (predicate.includes('hasExperience')) {
        data.properties.experience = await this.extractExperience(quad.object);
      } else if (predicate.includes('hasEducation')) {
        data.properties.education = await this.extractEducation(quad.object);
      } else {
        // Store other relationships
        data.relationships.push({
          predicate: this.simplifyPredicate(predicate),
          object: object
        });
      }
    }
    
    return data;
  }

  /**
   * Extract skill name from URI
   */
  extractSkillName(skillUri) {
    const parts = skillUri.split('/');
    const skill = parts[parts.length - 1].replace(/[-_]/g, ' ');
    return skill.charAt(0).toUpperCase() + skill.slice(1);
  }

  /**
   * Extract experience details from blank node
   */
  async extractExperience(node) {
    const experience = {};
    const quads = this.store.getQuads(node, null, null);
    
    for (const quad of quads) {
      const predicate = quad.predicate.value;
      const object = quad.object.value;
      
      if (predicate.includes('name')) {
        experience.title = object;
      } else if (predicate.includes('description')) {
        experience.description = object;
      } else if (predicate.includes('yearsOfExperience')) {
        experience.years = parseInt(object);
      } else if (predicate.includes('company')) {
        experience.company = object;
      }
    }
    
    return experience;
  }

  /**
   * Extract education details from blank node
   */
  async extractEducation(node) {
    const education = {};
    const quads = this.store.getQuads(node, null, null);
    
    for (const quad of quads) {
      const predicate = quad.predicate.value;
      const object = quad.object.value;
      
      if (predicate.includes('name')) {
        education.degree = object;
      } else if (predicate.includes('description')) {
        education.institution = object;
      } else if (predicate.includes('gpa')) {
        education.gpa = object;
      }
    }
    
    return education;
  }

  /**
   * Simplify predicate URI to readable name
   */
  simplifyPredicate(predicateUri) {
    const parts = predicateUri.split(/[#/]/);
    const name = parts[parts.length - 1];
    return name.charAt(0).toLowerCase() + name.slice(1);
  }

  /**
   * Register custom Nunjucks filters for ontology data
   */
  registerOntologyFilters() {
    // Filter to format URIs
    this.env.addFilter('formatUri', (uri) => {
      if (!uri) return '';
      const parts = uri.split(/[#/]/);
      return parts[parts.length - 1].replace(/[-_]/g, ' ');
    });

    // Filter to extract namespace
    this.env.addFilter('namespace', (uri) => {
      if (!uri) return '';
      const match = uri.match(/^(.*[#/])/);
      return match ? match[1] : '';
    });

    // Filter to check if URI matches pattern
    this.env.addFilter('matchesOntology', (uri, pattern) => {
      return uri && uri.includes(pattern);
    });

    // Filter to get property from ontology data
    this.env.addFilter('getOntologyProperty', (subject, predicate) => {
      const quads = this.store.getQuads(subject, predicate, null);
      return quads.length > 0 ? quads[0].object.value : '';
    });

    // Filter to get all values for a predicate
    this.env.addFilter('getAllOntologyValues', (subject, predicate) => {
      const quads = this.store.getQuads(subject, predicate, null);
      return quads.map(q => q.object.value);
    });
  }

  /**
   * Render template with ontology data
   */
  async renderTemplate(templatePath, ontologyData) {
    const template = await fs.readFile(templatePath, 'utf8');
    return this.env.renderString(template, {
      ontology: ontologyData,
      store: this.store,
      ...ontologyData.properties
    });
  }

  /**
   * Generate from ontology and template
   */
  async generate(options) {
    const {
      ontologyPath,
      templatePath,
      subjectUri,
      outputPath
    } = options;

    // Load ontology
    await this.loadOntology(ontologyPath);
    
    // Extract data for subject
    const data = await this.extractTemplateData(subjectUri);
    
    // Render template
    const rendered = await this.renderTemplate(templatePath, data);
    
    // Write output
    if (outputPath) {
      await fs.writeFile(outputPath, rendered);
      console.log(`✅ Generated: ${outputPath}`);
    }
    
    return rendered;
  }

  /**
   * Query ontology and generate multiple outputs
   */
  async generateBatch(options) {
    const {
      ontologyPath,
      templatePath,
      outputDir,
      subjectPattern
    } = options;

    await this.loadOntology(ontologyPath);
    
    // Find all subjects matching pattern
    const subjects = new Set();
    const quads = this.store.getQuads(null, null, null);
    
    for (const quad of quads) {
      if (!subjectPattern || quad.subject.value.includes(subjectPattern)) {
        subjects.add(quad.subject.value);
      }
    }

    const results = [];
    
    for (const subject of subjects) {
      const data = await this.extractTemplateData(subject);
      const rendered = await this.renderTemplate(templatePath, data);
      
      // Generate output filename from subject
      const filename = subject.split('/').pop() + '.generated';
      const outputPath = join(outputDir, filename);
      
      await fs.writeFile(outputPath, rendered);
      results.push({ subject, outputPath });
    }
    
    return results;
  }

  /**
   * Create inference rules for template generation
   */
  createInferenceRules() {
    // Add N3 rules for reasoning
    const rules = `
      @prefix person: <http://unjucks.dev/person/> .
      @prefix schema: <http://schema.org/> .
      
      # Rule: If someone has 5+ years experience, they are senior
      {
        ?person person:yearsOfExperience ?years .
        ?years math:greaterThan 5 .
      } => {
        ?person person:seniorityLevel "Senior" .
      } .
      
      # Rule: Match skills to job requirements
      {
        ?person person:hasSkill ?skill .
        ?job person:requiresSkill ?skill .
      } => {
        ?person person:qualifiedFor ?job .
      } .
    `;
    
    return rules;
  }
}

export default OntologyTemplateEngine;