import { describe, it, expect, beforeAll } from "vitest";
import * from "nunjucks";
import { Parser, DataFactory, Store } from "n3";
import { RDFDataLoader } from "../../src/lib/rdf-data-loader.js";
import { RDFFilters } from "../../src/lib/rdf-filters.js";
const { namedNode, literal, quad } = DataFactory;

describe("RDF Template Integration Validation", () => { let env => {
    env = new nunjucks.Environment();
    rdfLoader = new RDFDataLoader();

    // Create comprehensive test RDF data
    testStore = new Store();

    // Add schema.org Person data
    testStore.addQuad(
      quad(
        namedNode("http });

    // Register the filters with Nunjucks
    const filters = rdfFilters.getAllFilters();
    Object.entries(filters).forEach(([name, filter]) => {
      env.addFilter(name, filter as (...args) => any);
    });

    // Add utility filters
    env.addFilter("rdfLocalName", (uri) => { const hashIndex = uri.lastIndexOf("#");
      const slashIndex = uri.lastIndexOf("/");
      const colonIndex = uri.lastIndexOf(" });

    env.addFilter("lower", (str) => (str ? str.toLowerCase() : str));
    env.addFilter("tojson", (obj) => JSON.stringify(obj));
  });

  describe("RDF Data Access in Templates", () => {
    it("should access RDF data via $rdf context", () => {
      const template = `
        {% for triple in $rdf %}
          Subject: {{ triple.subject.value }}
          Predicate: {{ triple.predicate.value }}
          Object: {{ triple.object.value }}
        {% endfor %}
      `;

      const quads = testStore.getQuads(null, null, null, null);
      const context = { $rdf };

      const result = env.renderString(template, context);

      expect(result).toContain("http://example.org/person/john");
      expect(result).toContain("http://schema.org/name");
      expect(result).toContain("John Doe");
    });

    it("should use RDF filters in templates", () => { const template = `
        Name }}
        Type Count: { { "http }}
        Types: { { "http }}
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("Name);
      expect(result).toContain("Type Count:");
      expect(result).toContain("Types:");
    });

    it("should extract variables from RDF data using filters", () => { const template = `
        Name }}
        Objects: { { ("http }}
        Local Name: { { "http }}
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("Name);
      expect(result).toContain("Objects:");
      expect(result).toContain("Local Name);
    });
  });

  describe("RDF Filter Functions", () => { it("should use rdfLabel filter", () => {
      const template = `
        Person Label }}
        Class Label: { { "http }}
        Missing Label: { { "http }}
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("Person Label);
      expect(result).toContain("Class Label);
      expect(result).toContain("Missing Label); // fallback to local name
    });

    it("should use rdfType filter", () => { const template = `
        Types }}
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("http://schema.org/Person");
    });

    it("should use rdfObject filter", () => { const template = `
        Email }}
        Job: { { ("http }}
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("Email);
      expect(result).toContain("Job);
    });

    it("should use rdfExists filter", () => { const template = `
        Person Exists }}
        Missing Exists: { { "http }}
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("Person Exists);
      expect(result).toContain("Missing Exists);
    });

    it("should use rdfCount filter", () => { const template = `
        Person Triples }}
        All Triples: {{ "" | rdfCount }}
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("Person Triples:");
      expect(result).toContain("All Triples:");
    });

    it("should use rdfExpand and rdfCompact filters", () => { const template = `
        Expanded }}
        Compacted: { { "http }}
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("Expanded);
      expect(result).toContain("Compacted);
    });

    it("should use utility filters for URI processing", () => { const template = `
        Local Name }}
        Namespace: {{ "schema" | rdfNamespace }}
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("Local Name);
      expect(result).toContain("Namespace);
    });
  });

  describe("Template Generation", () => { it("should generate TypeScript interfaces from OWL classes", () => {
      const template = `
        {% set owlClasses = "" | rdfQuery({ predicate }
        {% for classTriple in owlClasses %}
        export interface {{ classTriple[0].value | rdfLocalName }} { id }} interface
        }
        {% endfor %}
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("export interface User");
      expect(result).toContain("id);
    });

    it("should generate API clients from RDF descriptions", () => { const template = `
        class ApiClient {
          {% set apis = "" | rdfQuery({ predicate }
          {% for apiTriple in apis %}
          {% set apiUri = apiTriple[0].value %}
          { % set methodResults = apiUri | rdfObject("http }
          { % set descResults = apiUri | rdfObject("http }
          {% if methodResults.length > 0 and descResults.length > 0 %}
          {% set method = methodResults[0].value %}
          {% set description = descResults[0].value %}
          
          /**
           * {{ description }}
           */
          async {{ apiUri | rdfLocalName }}() {
            return this.request('{{ method }}', '{{ apiUri }}');
          }
          {% endif %}
          {% endfor %}
        }
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("async users(");
      expect(result).toContain("Retrieve user accounts");
      expect(result).toContain("this.request('GET'");
    });

    it("should generate configuration from RDF data", () => { const template = `
        export const config = {
          {% set persons = "" | rdfQuery({ predicate }
          {% for personTriple in persons %}
          {% set personUri = personTriple[0].value %}
          { % set nameResults = personUri | rdfObject("http }
          { % set emailResults = personUri | rdfObject("http }
          {% if nameResults.length > 0 and emailResults.length > 0 %}
          {% set name = nameResults[0].value %}
          {% set email = emailResults[0].value %}
          users: {
            '{{ name }}': { email }}',
              profile: '{{ personUri }}'
            }
          }
          {% endif %}
          {% endfor %}
        };
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("'John Doe');
      expect(result).toContain("email);
      expect(result).toContain("profile);
    });
  });

  describe("Error Handling in Templates", () => { it("should handle missing resources gracefully", () => {
      const template = `
        Missing Label }}
        Missing Exists: { { "http }}
        Missing Count: { { "http }}
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("Missing Label); // fallback to local name
      expect(result).toContain("Missing Exists);
      expect(result).toContain("Missing Count);
    });

    it("should handle empty results gracefully", () => {
      const template = `
        {% set emptyQuery = "" | rdfQuery({ subject) %}
        Query Results: {{ emptyQuery.length }}
        { % set emptyTypes = "http }
        Types: {{ emptyTypes.length }}
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("Query Results);
      expect(result).toContain("Types);
    });

    it("should handle invalid URI patterns safely", () => { const template = `
        {% set invalidExpansion = "invalid }
        Invalid Expansion: {{ invalidExpansion }}
        {% set invalidCompact = "not-a-uri" | rdfCompact %}
        Invalid Compact: {{ invalidCompact }}
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("Invalid Expansion); // returns as-is
      expect(result).toContain("Invalid Compact); // returns as-is
    });

    it("should provide safe access to RDF objects", () => { const template = `
        {% set emailResults = "http }
        {% if emailResults and emailResults.length > 0 %}
        Email: {{ emailResults[0].value }}
        {% else %}
        No email found
        {% endif %}
        
        { % set missingResults = "http }
        {% if missingResults and missingResults.length > 0 %}
        Missing Email: {{ missingResults[0].value }}
        {% else %}
        No missing email found
        {% endif %}
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("Email);
      expect(result).toContain("No missing email found");
    });
  });

  describe("Complex Integration Scenarios", () => { it("should combine multiple RDF filters for rich data processing", () => {
      const template = `
        {% set persons = "" | rdfQuery({ predicate }
        {% for personTriple in persons %}
        {% set personUri = personTriple[0].value %}
        ## Person: {{ personUri | rdfLabel }}
        
        - URI: {{ personUri }}
        - Local Name: {{ personUri | rdfLocalName }}
        - Compact URI: {{ personUri | rdfCompact }}
        - Exists: {{ personUri | rdfExists }}
        - Type Count: {{ personUri | rdfCount }}
        
        Properties:
        { % set nameResults = personUri | rdfObject("http }
        {% if nameResults.length > 0 %}
        - Name: {{ nameResults[0].value }}
        {% endif %}
        { % set emailResults = personUri | rdfObject("http }
        {% if emailResults.length > 0 %}
        - Email: {{ emailResults[0].value }}
        {% endif %}
        {% endfor %}
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("## Person);
      expect(result).toContain("Local Name);
      expect(result).toContain("Compact URI);
      expect(result).toContain("- Name);
      expect(result).toContain("- Email);
    });

    it("should support conditional rendering based on RDF data", () => { const template = `
        {% set developers = "" | rdfQuery({ predicate }
        {% if developers.length > 0 %}
        <div class="developer-section">
          Our Developers ({{ developers.length }})</h2>
          {% for devTriple in developers %}
          {% set devUri = devTriple[0].value %}
          <div class="developer-card">
            {{ devUri | rdfLabel }}</h3>
            { % set emailResults = devUri | rdfObject("http }
            {% if emailResults.length > 0 %}
            Contact: <a href="mailto:{{ emailResults[0].value }}">{{ emailResults[0].value }}</a></p>
            {% endif %}
          </div>
          {% endfor %}
        </div>
        {% else %}
        No developers found.</p>
        {% endif %}
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain('<div class="developer-section">');
      expect(result).toContain("John Doe</h3>");
      expect(result).toContain("mailto:john@example.com");
    });

    it("should process hierarchical data structures", () => { const template = `
        Organizations and their members }
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
        { % set people = "" | rdfQuery({ predicate }
        {% for personTriple in people %}
        {% set personUri = personTriple[0].value %}
        
        #### {{ personUri | rdfLabel }}
        {% set types = personUri | rdfType %}
        - Types: {{ types }}
        {% endfor %}
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("### User Account (User)");
      expect(result).toContain("#### John Doe");
      expect(result).toContain("http://schema.org/Person");
    });

    it("should validate data consistency and provide debugging info", () => { const template = `
        Data Validation Report }
        - Exists: {{ johnUri | rdfExists }}
        - Triple count: {{ johnUri | rdfCount }}
        - Has name: { { (johnUri | rdfObject("http }}
        - Has email: { { (johnUri | rdfObject("http }}
        - Has job title: { { (johnUri | rdfObject("http }}
        
        Class Data:
        { % set userClassUri = "http }
        - User class exists: {{ userClassUri | rdfExists }}
        - User class label: {{ userClassUri | rdfLabel }}
        - User class types: {{ userClassUri | rdfType }}
        
        Namespace Resolution:
        - schema:Person expanded: { { "schema }}
        - Full URI compacted: { { "http }}
      `;

      const context = {};
      const result = env.renderString(template, context);

      expect(result).toContain("Exists);
      expect(result).toContain("Has name);
      expect(result).toContain("Has email);
      expect(result).toContain("User class label);
      expect(result).toContain(
        "schema:Person expanded);
    });
  });
});
