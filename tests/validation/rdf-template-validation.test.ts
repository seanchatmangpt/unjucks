import { describe, it, expect, beforeAll } from 'vitest';
import * as nunjucks from 'nunjucks';
import { N3Parser, DataFactory, Store } from 'n3';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader';
import { RDFFilters } from '../../src/lib/rdf-filters';

const { namedNode, literal, quad } = DataFactory;

describe('RDF Template Integration Validation', () => {
  let env: nunjucks.Environment;
  let rdfLoader: RDFDataLoader;
  let testStore: Store;
  let rdfFilters: RDFFilters;

  beforeAll(async () => {
    env = new nunjucks.Environment();
    rdfLoader = new RDFDataLoader();
    
    // Create comprehensive test RDF data
    testStore = new Store();
    
    // Add schema.org Person data
    testStore.addQuad(quad(
      namedNode('http://example.org/person/john'),
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode('http://schema.org/Person')
    ));
    testStore.addQuad(quad(
      namedNode('http://example.org/person/john'),
      namedNode('http://schema.org/name'),
      literal('John Doe')
    ));
    testStore.addQuad(quad(
      namedNode('http://example.org/person/john'),
      namedNode('http://xmlns.com/foaf/0.1/name'), // Use foaf:name for rdfLabel
      literal('John Doe')
    ));
    testStore.addQuad(quad(
      namedNode('http://example.org/person/john'),
      namedNode('http://schema.org/email'),
      literal('john@example.com')
    ));
    testStore.addQuad(quad(
      namedNode('http://example.org/person/john'),
      namedNode('http://schema.org/jobTitle'),
      literal('Software Developer')
    ));

    // Add OWL class definitions
    testStore.addQuad(quad(
      namedNode('http://example.org/ontology/User'),
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode('http://www.w3.org/2002/07/owl#Class')
    ));
    testStore.addQuad(quad(
      namedNode('http://example.org/ontology/User'),
      namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
      literal('User Account')
    ));

    // Add API description
    testStore.addQuad(quad(
      namedNode('http://example.org/api/users'),
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode('http://www.w3.org/ns/hydra/core#Resource')
    ));
    testStore.addQuad(quad(
      namedNode('http://example.org/api/users'),
      namedNode('http://www.w3.org/ns/hydra/core#method'),
      literal('GET')
    ));
    testStore.addQuad(quad(
      namedNode('http://example.org/api/users'),
      namedNode('http://schema.org/description'),
      literal('Retrieve user accounts')
    ));

    // Initialize RDF filters with the store
    rdfFilters = new RDFFilters({ store: testStore });
    
    // Register the filters with Nunjucks
    const filters = rdfFilters.getAllFilters();
    Object.entries(filters).forEach(([name, filter]) => {
      env.addFilter(name, filter);
    });

    // Add utility filters
    env.addFilter('rdfLocalName', (uri: string) => {
      const hashIndex = uri.lastIndexOf('#');
      const slashIndex = uri.lastIndexOf('/');
      const colonIndex = uri.lastIndexOf(':');
      const index = Math.max(hashIndex, slashIndex, colonIndex);
      return index >= 0 ? uri.substring(index + 1) : uri;
    });

    env.addFilter('lower', (str: string) => str ? str.toLowerCase() : str);
    env.addFilter('tojson', (obj: any) => JSON.stringify(obj));
  });

  describe('RDF Data Access in Templates', () => {
    it('should access RDF data via $rdf context', () => {
      const template = `
        {% for triple in $rdf %}
          Subject: {{ triple.subject.value }}
          Predicate: {{ triple.predicate.value }}
          Object: {{ triple.object.value }}
        {% endfor %}
      `;

      const quads = testStore.getQuads(null, null, null);
      const context = { $rdf: quads };
      
      const result = env.renderString(template, context);
      
      expect(result).toContain('http://example.org/person/john');
      expect(result).toContain('http://schema.org/name');
      expect(result).toContain('John Doe');
    });

    it('should use RDF filters in templates', () => {
      const template = `
        Name: {{ "http://example.org/person/john" | rdfLabel }}
        Type Count: {{ "http://example.org/person/john" | rdfCount }}
        Types: {{ "http://example.org/person/john" | rdfType }}
      `;

      const result = env.renderString(template);
      
      expect(result).toContain('Name: John Doe');
      expect(result).toContain('Type Count:');
      expect(result).toContain('Types:');
    });

    it('should extract variables from RDF data using filters', () => {
      const template = `
        Name: {{ "http://example.org/person/john" | rdfLabel }}
        Objects: {{ ("http://example.org/person/john" | rdfObject("http://schema.org/email")) }}
        Local Name: {{ "http://example.org/person/john" | rdfLocalName }}
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain('Name: John Doe');
      expect(result).toContain('Objects:');
      expect(result).toContain('Local Name: john');
    });
  });

  describe('RDF Filter Functions', () => {
    it('should use rdfLabel filter', () => {
      const template = `
        Person Label: {{ "http://example.org/person/john" | rdfLabel }}
        Class Label: {{ "http://example.org/ontology/User" | rdfLabel }}
        Missing Label: {{ "http://example.org/missing" | rdfLabel }}
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain('Person Label: John Doe');
      expect(result).toContain('Class Label: User Account');
      expect(result).toContain('Missing Label: missing'); // fallback to local name
    });

    it('should use rdfType filter', () => {
      const template = `
        Types: {{ "http://example.org/person/john" | rdfType }}
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain('http://schema.org/Person');
    });

    it('should use rdfObject filter', () => {
      const template = `
        Email: {{ ("http://example.org/person/john" | rdfObject("http://schema.org/email"))[0].value }}
        Job: {{ ("http://example.org/person/john" | rdfObject("http://schema.org/jobTitle"))[0].value }}
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain('Email: john@example.com');
      expect(result).toContain('Job: Software Developer');
    });

    it('should use rdfExists filter', () => {
      const template = `
        Person Exists: {{ "http://example.org/person/john" | rdfExists }}
        Missing Exists: {{ "http://example.org/missing" | rdfExists }}
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain('Person Exists: true');
      expect(result).toContain('Missing Exists: false');
    });

    it('should use rdfCount filter', () => {
      const template = `
        Person Triples: {{ "http://example.org/person/john" | rdfCount }}
        All Triples: {{ "" | rdfCount }}
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain('Person Triples:');
      expect(result).toContain('All Triples:');
    });

    it('should use rdfExpand and rdfCompact filters', () => {
      const template = `
        Expanded: {{ "schema:Person" | rdfExpand }}
        Compacted: {{ "http://schema.org/Person" | rdfCompact }}
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain('Expanded: http://schema.org/Person');
      expect(result).toContain('Compacted: schema:Person');
    });

    it('should use utility filters for URI processing', () => {
      const template = `
        Local Name: {{ "http://schema.org/Person" | rdfLocalName }}
        Namespace: {{ "schema" | rdfNamespace }}
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain('Local Name: Person');
      expect(result).toContain('Namespace: http://schema.org/');
    });
  });

  describe('Template Generation', () => {
    it('should generate TypeScript interfaces from OWL classes', () => {
      const template = `
        {% set owlClasses = "" | rdfQuery({ predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", object: "http://www.w3.org/2002/07/owl#Class" }) %}
        {% for classTriple in owlClasses %}
        export interface {{ classTriple[0].value | rdfLocalName }} {
          id: string;
          label: string;
          // {{ classTriple[0].value | rdfLabel }} interface
        }
        {% endfor %}
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain('export interface User');
      expect(result).toContain('id: string');
    });

    it('should generate API clients from RDF descriptions', () => {
      const template = `
        class ApiClient {
          {% set apis = "" | rdfQuery({ predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", object: "http://www.w3.org/ns/hydra/core#Resource" }) %}
          {% for apiTriple in apis %}
          {% set apiUri = apiTriple[0].value %}
          {% set methodResults = apiUri | rdfObject("http://www.w3.org/ns/hydra/core#method") %}
          {% set descResults = apiUri | rdfObject("http://schema.org/description") %}
          {% if methodResults.length > 0 and descResults.length > 0 %}
          {% set method = methodResults[0].value %}
          {% set description = descResults[0].value %}
          
          /**
           * {{ description }}
           */
          async {{ apiUri | rdfLocalName }}(): Promise<any> {
            return this.request('{{ method }}', '{{ apiUri }}');
          }
          {% endif %}
          {% endfor %}
        }
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain('async users(');
      expect(result).toContain('Retrieve user accounts');
      expect(result).toContain("this.request('GET'");
    });

    it('should generate configuration from RDF data', () => {
      const template = `
        export const config = {
          {% set persons = "" | rdfQuery({ predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", object: "http://schema.org/Person" }) %}
          {% for personTriple in persons %}
          {% set personUri = personTriple[0].value %}
          {% set nameResults = personUri | rdfObject("http://schema.org/name") %}
          {% set emailResults = personUri | rdfObject("http://schema.org/email") %}
          {% if nameResults.length > 0 and emailResults.length > 0 %}
          {% set name = nameResults[0].value %}
          {% set email = emailResults[0].value %}
          users: {
            '{{ name }}': {
              email: '{{ email }}',
              profile: '{{ personUri }}'
            }
          }
          {% endif %}
          {% endfor %}
        };
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain("'John Doe': {");
      expect(result).toContain("email: 'john@example.com'");
      expect(result).toContain("profile: 'http://example.org/person/john'");
    });
  });

  describe('Error Handling in Templates', () => {
    it('should handle missing resources gracefully', () => {
      const template = `
        Missing Label: {{ "http://example.org/missing" | rdfLabel }}
        Missing Exists: {{ "http://example.org/missing" | rdfExists }}
        Missing Count: {{ "http://example.org/missing" | rdfCount }}
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain('Missing Label: missing'); // fallback to local name
      expect(result).toContain('Missing Exists: false');
      expect(result).toContain('Missing Count: 0');
    });

    it('should handle empty results gracefully', () => {
      const template = `
        {% set emptyQuery = "" | rdfQuery({ subject: "http://example.org/nonexistent" }) %}
        Query Results: {{ emptyQuery.length }}
        {% set emptyTypes = "http://example.org/missing" | rdfType %}
        Types: {{ emptyTypes.length }}
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain('Query Results: 0');
      expect(result).toContain('Types: 0');
    });

    it('should handle invalid URI patterns safely', () => {
      const template = `
        {% set invalidExpansion = "invalid:uri" | rdfExpand %}
        Invalid Expansion: {{ invalidExpansion }}
        {% set invalidCompact = "not-a-uri" | rdfCompact %}
        Invalid Compact: {{ invalidCompact }}
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain('Invalid Expansion: invalid:uri'); // returns as-is
      expect(result).toContain('Invalid Compact: not-a-uri'); // returns as-is
    });

    it('should provide safe access to RDF objects', () => {
      const template = `
        {% set emailResults = "http://example.org/person/john" | rdfObject("http://schema.org/email") %}
        {% if emailResults and emailResults.length > 0 %}
        Email: {{ emailResults[0].value }}
        {% else %}
        No email found
        {% endif %}
        
        {% set missingResults = "http://example.org/missing" | rdfObject("http://schema.org/email") %}
        {% if missingResults and missingResults.length > 0 %}
        Missing Email: {{ missingResults[0].value }}
        {% else %}
        No missing email found
        {% endif %}
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain('Email: john@example.com');
      expect(result).toContain('No missing email found');
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should combine multiple RDF filters for rich data processing', () => {
      const template = `
        {% set persons = "" | rdfQuery({ predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", object: "http://schema.org/Person" }) %}
        {% for personTriple in persons %}
        {% set personUri = personTriple[0].value %}
        ## Person: {{ personUri | rdfLabel }}
        
        - URI: {{ personUri }}
        - Local Name: {{ personUri | rdfLocalName }}
        - Compact URI: {{ personUri | rdfCompact }}
        - Exists: {{ personUri | rdfExists }}
        - Type Count: {{ personUri | rdfCount }}
        
        Properties:
        {% set nameResults = personUri | rdfObject("http://schema.org/name") %}
        {% if nameResults.length > 0 %}
        - Name: {{ nameResults[0].value }}
        {% endif %}
        {% set emailResults = personUri | rdfObject("http://schema.org/email") %}
        {% if emailResults.length > 0 %}
        - Email: {{ emailResults[0].value }}
        {% endif %}
        {% endfor %}
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain('## Person: John Doe');
      expect(result).toContain('Local Name: john');
      expect(result).toContain('Compact URI: ex:person/john');
      expect(result).toContain('- Name: John Doe');
      expect(result).toContain('- Email: john@example.com');
    });

    it('should support conditional rendering based on RDF data', () => {
      const template = `
        {% set developers = "" | rdfQuery({ predicate: "http://schema.org/jobTitle", object: "Software Developer" }) %}
        {% if developers.length > 0 %}
        <div class="developer-section">
          <h2>Our Developers ({{ developers.length }})</h2>
          {% for devTriple in developers %}
          {% set devUri = devTriple[0].value %}
          <div class="developer-card">
            <h3>{{ devUri | rdfLabel }}</h3>
            {% set emailResults = devUri | rdfObject("http://schema.org/email") %}
            {% if emailResults.length > 0 %}
            <p>Contact: <a href="mailto:{{ emailResults[0].value }}">{{ emailResults[0].value }}</a></p>
            {% endif %}
          </div>
          {% endfor %}
        </div>
        {% else %}
        <p>No developers found.</p>
        {% endif %}
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain('<div class="developer-section">');
      expect(result).toContain('<h3>John Doe</h3>');
      expect(result).toContain('mailto:john@example.com');
    });

    it('should process hierarchical data structures', () => {
      const template = `
        Organizations and their members:
        {% set orgs = "" | rdfQuery({ predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", object: "http://www.w3.org/2002/07/owl#Class" }) %}
        {% for orgTriple in orgs %}
        {% set orgUri = orgTriple[0].value %}
        
        ### {{ orgUri | rdfLabel }} ({{ orgUri | rdfLocalName }})
        {% if orgUri | rdfExists %}
        - URI: {{ orgUri }}
        - Type: OWL Class
        - Has data: Yes
        {% else %}
        - No additional data found
        {% endif %}
        {% endfor %}
        
        People:
        {% set people = "" | rdfQuery({ predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", object: "http://schema.org/Person" }) %}
        {% for personTriple in people %}
        {% set personUri = personTriple[0].value %}
        
        #### {{ personUri | rdfLabel }}
        {% set types = personUri | rdfType %}
        - Types: {{ types }}
        {% endfor %}
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain('### User Account (User)');
      expect(result).toContain('#### John Doe');
      expect(result).toContain('http://schema.org/Person');
    });

    it('should validate data consistency and provide debugging info', () => {
      const template = `
        Data Validation Report:
        
        Person Data:
        {% set johnUri = "http://example.org/person/john" %}
        - Exists: {{ johnUri | rdfExists }}
        - Triple count: {{ johnUri | rdfCount }}
        - Has name: {{ (johnUri | rdfObject("http://schema.org/name")).length > 0 }}
        - Has email: {{ (johnUri | rdfObject("http://schema.org/email")).length > 0 }}
        - Has job title: {{ (johnUri | rdfObject("http://schema.org/jobTitle")).length > 0 }}
        
        Class Data:
        {% set userClassUri = "http://example.org/ontology/User" %}
        - User class exists: {{ userClassUri | rdfExists }}
        - User class label: {{ userClassUri | rdfLabel }}
        - User class types: {{ userClassUri | rdfType }}
        
        Namespace Resolution:
        - schema:Person expanded: {{ "schema:Person" | rdfExpand }}
        - Full URI compacted: {{ "http://schema.org/Person" | rdfCompact }}
      `;
      
      const result = env.renderString(template);
      
      expect(result).toContain('Exists: true');
      expect(result).toContain('Has name: true');
      expect(result).toContain('Has email: true');
      expect(result).toContain('User class label: User Account');
      expect(result).toContain('schema:Person expanded: http://schema.org/Person');
    });
  });
});