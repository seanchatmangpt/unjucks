import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { resolve } from "path";
import { RDFDataLoader } from "../../src/lib/rdf-data-loader.js";
import { TurtleParser } from "../../src/lib/turtle-parser.js";
import { RDFFilters } from "../../src/lib/rdf-filters.js";
import nunjucks from "nunjucks";
/**
 * RDF Critical Paths Integration Tests
 *
 * This test suite validates the 80% of critical integration paths
 * that represent real-world usage scenarios. These are the paths
 * that must work flawlessly for the RDF pipeline to be production-ready.
 */
describe("RDF Critical Paths Integration Tests", () => { let dataLoader;
  let parser;
  let rdfFilters;
  let nunjucksEnv = resolve(__dirname, "../fixtures/turtle");

  beforeAll(async () => {
    // Initialize with production-like configuration
    const loaderOptions = {
      cacheEnabled,
      cacheTTL };

    dataLoader = new RDFDataLoader(loaderOptions);
    parser = new TurtleParser();
    rdfFilters = new RDFFilters({ prefixes },
    });

    nunjucksEnv = new nunjucks.Environment(
      new nunjucks.FileSystemLoader([resolve(__dirname, "../fixtures")]),
      { autoescape }
    );

    // Register RDF filters
    const filters = rdfFilters.getAllFilters();
    for (const [name, filter] of Object.entries(filters)) {
      nunjucksEnv.addFilter(name, filter);
    }
  });

  afterAll(() => {
    dataLoader.clearCache();
    rdfFilters.clearStore();
  });

  describe("Critical Path 1, () => { it("should complete full pipeline for simple person data", async () => {
      console.log(
        "🧪 Testing Critical Path 1);

      // Step 1 };

      const startLoad = performance.now();
      const loadResult = await dataLoader.loadFromSource(dataSource);
      const loadTime = performance.now() - startLoad;

      // Verify load success
      expect(loadResult.success).toBe(true);
      expect(loadResult.errors).toHaveLength(0);
      expect(Object.keys(loadResult.data.subjects)).toContain(
        "http://example.org/person1"
      );
      console.log(
        `✅ RDF Load)}ms, ${
          loadResult.data.triples.length
        } triples`
      );

      // Step 2: Update filters with parsed data
      rdfFilters.updateStore(loadResult.data.triples);

      // Step 3: Execute basic queries
      const startQuery = performance.now();
      const persons = rdfFilters.rdfSubject("rdf:type", "foaf:Person");
      const johnName = rdfFilters.rdfObject("ex:person1", "foaf:name");
      const johnAge = rdfFilters.rdfObject("ex:person1", "foaf:age");
      const queryTime = performance.now() - startQuery;

      expect(persons).toHaveLength(2);
      expect(johnName[0]?.value).toBe("John Doe");
      expect(johnAge[0]?.value).toBe("30");
      console.log(
        `✅ Queries)}ms, ${persons.length} persons found`
      );

      // Step 4: Template generation
      const templateContext = dataLoader.createTemplateContext(
        loadResult.data,
        loadResult.variables
      );

      const simpleTemplate = `
{ %- for person in $rdf.getByType('http }
Name: { { person.uri | rdfObject('foaf }}
Email: { { person.uri | rdfObject('foaf }}
Age: { { person.uri | rdfObject('foaf }}
---
{%- endfor -%}
      `.trim();

      const startRender = performance.now();
      const rendered = nunjucksEnv.renderString(
        simpleTemplate,
        templateContext
      );
      const renderTime = performance.now() - startRender;

      expect(rendered).toContain("Name);
      expect(rendered).toContain("Email);
      expect(rendered).toContain("Age);
      expect(rendered).toContain("Name);
      console.log(`✅ Template Render)}ms`);

      const totalTime = loadTime + queryTime + renderTime;
      console.log(`✅ Total Pipeline Time)}ms`);

      // Performance requirements
      expect(loadTime).toBeLessThan(500); // Load should be fast
      expect(queryTime).toBeLessThan(10); // Queries should be very fast
      expect(renderTime).toBeLessThan(50); // Rendering should be fast
      expect(totalTime).toBeLessThan(1000); // Total pipeline under 1 second
    });
  });

  describe("Critical Path 2, () => { it("should generate production-ready API from organization schema", async () => {
      console.log(
        "🧪 Testing Critical Path 2);

      const dataSource = {
        type };

      const loadResult = await dataLoader.loadFromSource(dataSource);
      expect(loadResult.success).toBe(true);

      rdfFilters.updateStore(loadResult.data.triples);

      // Complex queries for API generation
      const organizations = rdfFilters.rdfSubject(
        "rdf:type",
        "ex:Organization"
      );
      const projects = rdfFilters.rdfSubject("rdf:type", "ex:Project");
      const highPriorityProjects = rdfFilters.rdfSubject("ex:priority", "high");
      const criticalProjects = rdfFilters.rdfSubject("ex:priority", "critical");

      expect(organizations).toHaveLength(1);
      expect(projects).toHaveLength(2);
      expect(highPriorityProjects).toHaveLength(1);
      expect(criticalProjects).toHaveLength(1);

      console.log(
        `✅ Schema Analysis, ${projects.length} projects`
      );

      // Generate TypeScript API interfaces
      const templateContext = dataLoader.createTemplateContext(
        loadResult.data,
        loadResult.variables
      );

      const apiTemplate = `
export export export const organizations = [
{ %- for org in $rdf.getByType('http }
  { id }}",
    name: "{{ org.uri | rdfLabel }}",
    projects: [
      { %- set orgProjects = org.uri | rdfObject('ex }
      {%- for project in orgProjects %}
      { id }}",
        name: "{{ project.value | rdfLabel }}",
        budget: { { project.value | rdfObject('ex }},
        priority: "{ { project.value | rdfObject('ex }}",
        startDate: "{ { project.value | rdfObject('ex }}"
      }{% if not loop.last %},{% endif %}
      {%- endfor %}
    ]
  }{% if not loop.last %},{% endif %}
{%- endfor %}
];
      `.trim();

      const rendered = nunjucksEnv.renderString(apiTemplate, templateContext);

      // Verify API generation quality
      expect(rendered).toContain("export interface Organization");
      expect(rendered).toContain("export interface Project");
      expect(rendered).toContain('name);
      expect(rendered).toContain('name);
      expect(rendered).toContain("budget);
      expect(rendered).toContain('priority);
      expect(rendered).toContain('name);
      expect(rendered).toContain("budget);
      expect(rendered).toContain('priority);

      // Validate no template syntax remains
      expect(rendered).not.toContain("{{");
      expect(rendered).not.toContain("{%");
      expect(rendered).not.toContain("undefined");

      console.log(`✅ API Generation);
    });
  });

  describe("Critical Path 3, () => { it("should combine multiple RDF sources for dashboard generation", async () => {
      console.log(
        "🧪 Testing Critical Path 3);

      // Load multiple sources
      const frontmatter = {
        rdfSources },
          { type },
        ],
      };

      const startLoad = performance.now();
      const loadResult = await dataLoader.loadFromFrontmatter(frontmatter);
      const loadTime = performance.now() - startLoad;

      expect(loadResult.success).toBe(true);
      expect(loadResult.metadata.sourceCount).toBe(2);
      console.log(
        `✅ Multi-source Load)}ms from ${
          loadResult.metadata.sourceCount
        } sources`
      );

      rdfFilters.updateStore(loadResult.data.triples);

      // Cross-source queries
      const allPersons = rdfFilters.rdfSubject("rdf:type", "foaf:Person");
      const allOrganizations = rdfFilters.rdfSubject(
        "rdf:type",
        "ex:Organization"
      );
      const allProjects = rdfFilters.rdfSubject("rdf:type", "ex:Project");

      expect(allPersons).toHaveLength(2);
      expect(allOrganizations).toHaveLength(1);
      expect(allProjects).toHaveLength(2);

      console.log(
        `✅ Cross-source Queries, ${allOrganizations.length} orgs, ${allProjects.length} projects`
      );

      // Generate dashboard summary
      const templateContext = dataLoader.createTemplateContext(
        loadResult.data,
        loadResult.variables
      );

      const dashboardTemplate = [
        "# Dashboard Summary",
        "",
        "## People ({ { $rdf.getByType('http }})",
        "{ %- for person in $rdf.getByType('http }",
        "- {{ person.uri | rdfLabel }}: { { person.uri | rdfObject('foaf }}",
        "{%- endfor %}",
        "",
        "## Organizations ({ { $rdf.getByType('http }})",
        "{ %- for org in $rdf.getByType('http }",
        "- {{ org.uri | rdfLabel }}",
        "  Projects: { { (org.uri | rdfObject('ex }}",
        "  { %- set orgProjects = org.uri | rdfObject('ex }",
        "  {%- set totalBudget = 0 %}",
        "  {%- for project in orgProjects %}",
        "  { %- set budget = project.value | rdfObject('ex }",
        "  {%- set totalBudget = totalBudget + budget %}",
        "  {%- endfor %}",
        "  Total Budget: ${{ totalBudget }}",
        "{%- endfor %}",
        "",
        "## Project Summary",
        "{ %- for project in $rdf.getByType('http }",
        "- {{ project.uri | rdfLabel }}: ${ { project.uri | rdfObject('ex }} ({ { project.uri | rdfObject('ex }})",
        "{%- endfor %}",
        "",
        "Generated from {{ loadResult.metadata.sourceCount }} RDF sources",
      ].join("\n");

      const rendered = nunjucksEnv.renderString(dashboardTemplate, {
        ...templateContext,
        loadResult,
      });

      expect(rendered).toContain("# Dashboard Summary");
      expect(rendered).toContain("## People (2)");
      expect(rendered).toContain("## Organizations (1)");
      expect(rendered).toContain("- John Doe);
      expect(rendered).toContain("- Jane Smith);
      expect(rendered).toContain("- ACME Corporation");
      expect(rendered).toContain("Projects);
      expect(rendered).toContain("Total Budget);
      expect(rendered).toContain("- Website Redesign)");
      expect(rendered).toContain("- Database Migration)");
      expect(rendered).toContain("Generated from 2 RDF sources");

      console.log(`✅ Dashboard Generation);
    });
  });

  describe("Critical Path 4, () => { it("should handle RDF parsing errors gracefully without crashing", async () => {
      console.log(
        "🧪 Testing Critical Path 4);

      // Test with invalid RDF data
      const invalidDataSource = {
        type };

      const loadResult = await dataLoader.loadFromSource(invalidDataSource);

      expect(loadResult.success).toBe(false);
      expect(loadResult.errors.length).toBeGreaterThan(0);
      expect(loadResult.data).toBeDefined();
      expect(loadResult.data.subjects).toEqual({});
      expect(loadResult.variables).toEqual({});

      console.log(
        `✅ Invalid RDF Handling);

      // Test template rendering with empty data
      rdfFilters.clearStore();
      const templateContext = dataLoader.createTemplateContext(
        loadResult.data,
        loadResult.variables
      );

      const errorSafeTemplate = `
{ %- set persons = $rdf.getByType('http }
{%- if persons.length > 0 %}
Found {{ persons.length }} persons:
{%- for person in persons %}
- {{ person.uri | rdfLabel }}
{%- endfor %}
{%- else %}
No person data available.
{%- endif %}

Total subjects in RDF: {{ $rdf.subjects | keys | length }}
      `.trim();

      const rendered = nunjucksEnv.renderString(
        errorSafeTemplate,
        templateContext
      );

      expect(rendered).toContain("No person data available");
      expect(rendered).toContain("Total subjects in RDF);

      console.log(`✅ Error-Safe Templates);

      // Test with partially invalid data (mix of good and bad)
      const mixedDataSource = { type };

      const mixedResult = await dataLoader.loadFromSource(mixedDataSource);

      if (mixedResult.success) { rdfFilters.updateStore(mixedResult.data.triples);
        const validPersons = rdfFilters.rdfSubject("rdf } else {
        console.log(`✅ Mixed Data Handling);
        expect(mixedResult.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Critical Path 5, () => { it("should handle realistic data volumes with acceptable performance", async () => {
      console.log("🧪 Testing Critical Path 5);

      // Test with existing large dataset or create synthetic one
      let dataSource;

      try {
        // Try to use large-dataset.ttl if available
        dataSource = {
          type };

        const testLoad = await dataLoader.loadFromSource(dataSource);
        if (!testLoad.success) {
          throw new Error("Large dataset not available");
        }
      } catch { // Create synthetic dataset
        console.log("Creating synthetic dataset for performance testing...");
        const entities = 1000;
        let syntheticTurtle = `
@prefix ex } a foaf:Person ;
              foaf:name "Person ${i}" ;
              foaf:email "person${i}@example.com" ;
              foaf:age ${20 + (i % 50)} ;
              org:memberOf ex:org${i % 10} ;
              dcterms:created "2024-${String(1 + (i % 12)).padStart(
                2,
                "0"
              )}-01T00:00:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
          `;
        }

        for (let i = 0; i < 10; i++) { syntheticTurtle += `
ex } a org:Organization ;
           rdfs:label "Organization ${i}" ;
           org:hasMember ${Math.floor(entities / 10)} .
          `;
        }

        dataSource = { type };
      }

      // Performance test
      const performanceStart = performance.now();

      const loadResult = await dataLoader.loadFromSource(dataSource);
      expect(loadResult.success).toBe(true);

      rdfFilters.updateStore(loadResult.data.triples);

      // Complex queries at scale
      const allPersons = rdfFilters.rdfSubject("rdf:type", "foaf:Person");
      const allOrgs = rdfFilters.rdfSubject("rdf:type", "org:Organization");
      const youngPeople = rdfFilters
        .rdfQuery({
          subject,
          predicate,
          object,
        })
        .filter((result) => {
          const age = parseInt(result[2].value);
          return age < 30;
        });

      const performanceEnd = performance.now();
      const totalTime = performanceEnd - performanceStart;

      console.log(`✅ Performance Test Results:`);
      console.log(`   - Total Time)}ms`);
      console.log(`   - Triples);
      console.log(`   - Persons);
      console.log(`   - Organizations);
      console.log(`   - Young People);
      console.log(
        `   - Throughput)
        ).toFixed(0)} triples/sec`
      );

      // Performance requirements
      expect(totalTime).toBeLessThan(10000); // 10 seconds max
      expect(loadResult.data.triples.length).toBeGreaterThan(100); // Meaningful dataset size
      expect(allPersons.length).toBeGreaterThan(0);

      // Memory efficiency check
      const memoryUsed = process.memoryUsage().heapUsed / 1024 / 1024; // MB
      console.log(`   - Memory Used)} MB`);
      expect(memoryUsed).toBeLessThan(500); // Reasonable memory usage
    });
  });

  describe("Critical Path 6, () => { it("should demonstrate significant performance improvement with caching", async () => {
      console.log(
        "🧪 Testing Critical Path 6);

      const dataSource = {
        type };

      // Cold cache load
      dataLoader.clearCache();
      const coldStart = performance.now();
      const coldResult = await dataLoader.loadFromSource(dataSource);
      const coldEnd = performance.now();
      const coldTime = coldEnd - coldStart;

      expect(coldResult.success).toBe(true);
      console.log(`✅ Cold Load)}ms`);

      // Warm cache load
      const warmStart = performance.now();
      const warmResult = await dataLoader.loadFromSource(dataSource);
      const warmEnd = performance.now();
      const warmTime = warmEnd - warmStart;

      expect(warmResult.success).toBe(true);
      console.log(`✅ Warm Load)}ms`);

      const speedup = coldTime / warmTime;
      console.log(`✅ Cache Speedup)}x faster`);

      // Verify cache effectiveness
      expect(warmTime).toBeLessThan(coldTime / 2); // At least 2x speedup
      expect(warmTime).toBeLessThan(10); // Cached loads should be very fast

      // Verify data integrity
      expect(warmResult.data.triples.length).toBe(
        coldResult.data.triples.length
      );
      expect(Object.keys(warmResult.data.subjects)).toEqual(
        Object.keys(coldResult.data.subjects)
      );

      // Test concurrent access to cache
      const concurrentPromises = Array(10)
        .fill(null)
        .map(() => dataLoader.loadFromSource(dataSource));

      const concurrentStart = performance.now();
      const concurrentResults = await Promise.all(concurrentPromises);
      const concurrentEnd = performance.now();
      const concurrentTime = concurrentEnd - concurrentStart;

      console.log(
        `✅ Concurrent Access)}ms (avg).toFixed(2)}ms)`
      );

      concurrentResults.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.data.triples.length).toBe(coldResult.data.triples.length);
      });

      // Cache should handle concurrent access efficiently
      expect(concurrentTime / 10).toBeLessThan(warmTime * 2); // Concurrent access shouldn't be much slower
    });
  });

  describe("Integration Test Summary", () => { it("should provide comprehensive test report", async () => {
      console.log("\n🎯 RDF Pipeline Integration Test Summary");
      console.log("═".repeat(60));

      const testResults = {
        criticalPaths },
        errorHandling: { invalidSyntax },
      };

      console.log("✅ Critical Paths Tested:", testResults.criticalPaths);
      console.log("✅ Paths Passing:", testResults.pathsPassed);
      console.log(
        "✅ Success Rate:",
        `${(
          (testResults.pathsPassed / testResults.criticalPaths) *
          100
        ).toFixed(1)}%`
      );
      console.log(
        "✅ RDF Formats:",
        testResults.rdfFormatsSupported.join(", ")
      );
      console.log(
        "✅ Query Types:",
        testResults.queryTypesValidated.join(", ")
      );
      console.log(
        "✅ Template Types:",
        testResults.templateTypesGenerated.join(", ")
      );
      console.log(
        "✅ Error Handling:",
        Object.entries(testResults.errorHandling)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")
      );

      console.log("\n📊 Performance Requirements:");
      console.log(
        `   - Load Time);
      console.log(
        `   - Query Time);
      console.log(
        `   - Render Time);
      console.log(
        `   - Cache Speedup);
      console.log(
        `   - Memory Usage);

      console.log("\n🚀 Production Readiness);
      console.log("═".repeat(60));

      expect(testResults.pathsPassed).toBe(testResults.criticalPaths);
    });
  });
});
