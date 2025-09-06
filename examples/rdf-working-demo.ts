#!/usr/bin/env node
/**
 * 80/20 Working RDF Demo - Minimal implementation that works
 * This demonstrates the core 20% of RDF functionality that provides 80% of value
 */

import { Parser, Store } from 'n3';
import * as fs from 'node:fs/promises';
import nunjucks from 'nunjucks';

// Simple RDF loader (80/20 approach - just the essentials)
class SimpleRDFLoader {
  private parser: Parser;
  private store: Store;

  constructor() {
    this.parser = new Parser();
    this.store = new Store();
  }

  async loadTurtle(content: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const quads: any[] = [];
      this.parser.parse(content, (error, quad, prefixes) => {
        if (error) {
          reject(error);
        } else if (quad) {
          quads.push(quad);
          this.store.add(quad);
        } else {
          // Parsing complete
          resolve({
            quads,
            prefixes,
            store: this.store
          });
        }
      });
    });
  }

  // Extract template variables from RDF (80/20 - most common pattern)
  extractVariables(store: Store): Record<string, any> {
    const variables: Record<string, any> = {};
    
    // Get all subjects
    const subjects = store.getSubjects(null, null, null);
    
    subjects.forEach(subject => {
      const subjectName = this.getLocalName(subject.value);
      variables[subjectName] = {};
      
      // Get all properties for this subject
      const quads = store.getQuads(subject, null, null, null);
      quads.forEach(quad => {
        const propName = this.getLocalName(quad.predicate.value);
        variables[subjectName][propName] = quad.object.value;
      });
    });
    
    return variables;
  }

  private getLocalName(uri: string): string {
    return uri.split(/[#/]/).pop() || uri;
  }
}

// Simple RDF filters for Nunjucks (80/20 - most useful filters)
const createRDFFilters = (store: Store) => ({
  rdfQuery: (subject: string, predicate: string) => {
    const quads = store.getQuads(null, null, null, null);
    return quads
      .filter(q => 
        (!subject || q.subject.value.includes(subject)) &&
        (!predicate || q.predicate.value.includes(predicate))
      )
      .map(q => q.object.value);
  },
  
  rdfLabel: (uri: string) => {
    if (!uri) return '';
    return String(uri).split(/[#/]/).pop() || uri;
  },
  
  rdfType: (subject: string) => {
    const typeQuads = store.getQuads(
      null,
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      null,
      null
    );
    return typeQuads
      .filter(q => q.subject.value.includes(subject))
      .map(q => q.object.value);
  }
});

// Main demo
async function runDemo() {
  console.log('=€ RDF Template Integration Demo (80/20 Approach)\n');
  
  // 1. Sample Turtle data
  const turtleData = `
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    @prefix schema: <https://schema.org/> .
    
    ex:company1 a schema:Organization ;
        schema:name "Acme Corp" ;
        schema:numberOfEmployees 500 ;
        schema:url "https://acme.example.com" .
    
    ex:person1 a foaf:Person ;
        foaf:name "Alice Johnson" ;
        foaf:title "CTO" ;
        schema:memberOf ex:company1 .
    
    ex:person2 a foaf:Person ;
        foaf:name "Bob Smith" ;
        foaf:title "Developer" ;
        schema:memberOf ex:company1 .
  `;
  
  // 2. Load and parse RDF
  const loader = new SimpleRDFLoader();
  const rdfData = await loader.loadTurtle(turtleData);
  console.log(' Loaded RDF data:');
  console.log(`   - ${rdfData.quads.length} triples`);
  console.log(`   - Prefixes:`, Object.keys(rdfData.prefixes || {}));
  
  // 3. Extract template variables
  const variables = loader.extractVariables(rdfData.store);
  console.log('\n Extracted template variables:');
  console.log(JSON.stringify(variables, null, 2));
  
  // 4. Create Nunjucks environment with RDF filters
  const env = nunjucks.configure({ autoescape: false });
  const filters = createRDFFilters(rdfData.store);
  Object.entries(filters).forEach(([name, filter]) => {
    env.addFilter(name, filter);
  });
  
  // 5. Template with RDF data
  const template = `
// Generated from RDF data
export class Organization {
  name = "{{ company1.name }}";
  employees = {{ company1.numberOfEmployees }};
  url = "{{ company1.url }}";
  
  team = [
    {% for person in [person1, person2] %}
    {
      name: "{{ person.name }}",
      title: "{{ person.title }}",
      type: "{{ person.type | rdfLabel }}"
    },
    {% endfor %}
  ];
}

// Using RDF filters
const organizationTypes = {{ 'company1' | rdfType | dump }};
const personNames = {{ 'Person' | rdfQuery('name') | dump }};
  `;
  
  // 6. Render template
  const output = env.renderString(template, variables);
  console.log('\n Generated code from RDF:');
  console.log(output);
  
  // 7. Save to file
  const outputPath = 'examples/generated-from-rdf.ts';
  await fs.writeFile(outputPath, output);
  console.log(`\n Saved to ${outputPath}`);
  
  console.log('\n<‰ Demo complete! This shows the core 20% of RDF features that provide 80% of value:');
  console.log('   1. Load Turtle/RDF data');
  console.log('   2. Extract template variables');
  console.log('   3. Use RDF filters in templates');
  console.log('   4. Generate code from semantic data');
}

// Run the demo
runDemo().catch(console.error);