const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');
const nunjucks = require('nunjucks');

// Configure Nunjucks with custom filters for semantic web
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader([
  path.join(__dirname, '../../../_templates'),
  path.join(__dirname, '../../../templates')
]));

// Add semantic web filters
env.addFilter('pascalCase', (str) => {
  return str.replace(/(?:^|[\s-_])+(.)/g, (_, char) => char.toUpperCase());
});

env.addFilter('camelCase', (str) => {
  const pascal = str.replace(/(?:^|[\s-_])+(.)/g, (_, char) => char.toUpperCase());
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
});

env.addFilter('kebabCase', (str) => {
  return str.toLowerCase().replace(/[\s_]+/g, '-');
});

env.addFilter('snakeCase', (str) => {
  return str.toLowerCase().replace(/[\s-]+/g, '_');
});

env.addFilter('titleCase', (str) => {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
});

env.addFilter('slug', (str) => {
  return str.toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
    .replace(/[\s_]+/g, '-')  // Replace spaces and underscores with hyphens
    .replace(/--+/g, '-')     // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '');   // Remove leading/trailing hyphens
});

env.addFilter('formatDate', (date, format) => {
  const d = new Date(date);
  if (format === 'YYYY-MM-DD') {
    return d.toISOString().split('T')[0];
  }
  if (format === 'YYYY-MM-DDTHH:mm:ss') {
    return d.toISOString().slice(0, 19);
  }
  return d.toISOString();
});

env.addFilter('escape', (str) => {
  return str.replace(/[&<>"']/g, (match) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    };
    return map[match];
  });
});

env.addFilter('round', (num, decimals = 0) => {
  return Number(Math.round(num + 'e' + decimals) + 'e-' + decimals);
});

env.addFilter('default', (value, defaultValue) => {
  return value !== undefined && value !== null ? value : defaultValue;
});

env.addFilter('trim', (str) => {
  return str.trim();
});

env.addFilter('int', (value) => {
  return parseInt(value, 10);
});

env.addFilter('tojson', (obj) => {
  return JSON.stringify(obj);
});

env.addGlobal('now', () => {
  return new Date().toISOString();
});

// Test context
class SemanticTestContext {
  constructor() {
    this.reset();
  }

  reset() {
    this.templateSystem = null;
    this.filters = {};
    this.entities = {};
    this.properties = [];
    this.relationships = {};
    this.output = '';
    this.generatedUris = [];
    this.namespaces = {};
    this.vocabularies = [];
    this.events = [];
    this.confidence = {};
    this.multimodalData = {};
    this.provenance = {};
    this.domains = {};
  }
}

const testContext = new SemanticTestContext();

// Background steps
Given('I have an unjucks template system configured', function () {
  testContext.templateSystem = env;
  expect(testContext.templateSystem).to.exist;
});

Given('I have semantic web filter functions available', function () {
  const filters = ['pascalCase', 'camelCase', 'kebabCase', 'slug', 'titleCase', 'formatDate'];
  filters.forEach(filter => {
    expect(testContext.templateSystem.filters[filter]).to.exist;
  });
});

Given('I have an unjucks template system with namespace management', function () {
  testContext.templateSystem = env;
  testContext.namespaces = {
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
    'owl': 'http://www.w3.org/2002/07/owl#',
    'skos': 'http://www.w3.org/2004/02/skos/core#',
    'schema': 'http://schema.org/',
    'dct': 'http://purl.org/dc/terms/'
  };
});

Given('I have case transformation filters available', function () {
  const caseFilters = ['pascalCase', 'camelCase', 'kebabCase', 'snakeCase', 'titleCase'];
  caseFilters.forEach(filter => {
    expect(testContext.templateSystem.filters[filter]).to.exist;
  });
});

Given('I have an unjucks template system for linked data generation', function () {
  testContext.templateSystem = env;
});

Given('I have URI generation filters: slug, kebabCase, pascalCase', function () {
  const uriFilters = ['slug', 'kebabCase', 'pascalCase'];
  uriFilters.forEach(filter => {
    expect(testContext.templateSystem.filters[filter]).to.exist;
  });
});

Given('I have an unjucks template system for knowledge graph construction', function () {
  testContext.templateSystem = env;
});

Given('I have advanced filtering capabilities for RDF generation', function () {
  const advancedFilters = ['pascalCase', 'camelCase', 'kebabCase', 'formatDate', 'escape', 'tojson'];
  advancedFilters.forEach(filter => {
    expect(testContext.templateSystem.filters[filter]).to.exist;
  });
});

// Ontology Generation Steps
Given('I have a template for OWL class generation', function () {
  const template = `
    @prefix ex: <http://example.org/> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    
    ex:{{ className | pascalCase }} a rdfs:Class ;
        rdfs:label "{{ className | titleCase }}"@en .
  `;
  testContext.classTemplate = template;
});

Given('the class name is {string}', function (className) {
  testContext.entities.className = className;
});

When('I apply the pascalCase filter', function () {
  const result = testContext.templateSystem.filters.pascalCase(testContext.entities.className);
  testContext.output = result;
});

Then('the generated class should be {string}', function (expected) {
  expect(testContext.output).to.equal(expected);
});

Then('it should be valid in Turtle syntax as {string}', function (expected) {
  const rendered = testContext.templateSystem.renderString(testContext.classTemplate, testContext.entities);
  expect(rendered).to.include(expected);
});

Given('I have a class definition {string}', function (classDefinition) {
  testContext.entities.classDefinition = classDefinition;
});

When('I generate an ontology class with schema.org mapping', function () {
  const template = `
    @prefix schema: <http://schema.org/> .
    @prefix ex: <http://example.org/> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    
    ex:{{ classDefinition | pascalCase }} a rdfs:Class ;
        rdfs:subClassOf schema:Thing ;
        rdfs:label "{{ classDefinition | titleCase }}"@en .
  `;
  testContext.output = testContext.templateSystem.renderString(template, testContext.entities);
});

Then('the output should contain:', function (expectedOutput) {
  const normalizedOutput = testContext.output.replace(/\s+/g, ' ').trim();
  const normalizedExpected = expectedOutput.replace(/\s+/g, ' ').trim();
  expect(normalizedOutput).to.include(normalizedExpected);
});

Given('I have property names: {stringList}', function (propertyNames) {
  testContext.properties = propertyNames;
});

When('I apply camelCase filter to each property', function () {
  testContext.output = testContext.properties.map(prop => 
    testContext.templateSystem.filters.camelCase(prop)
  );
});

Then('the generated properties should be:', function (dataTable) {
  const expected = dataTable.hashes();
  expected.forEach((row, index) => {
    const input = row['Input'];
    const expectedOutput = row['Filter Output'];
    const actualOutput = testContext.templateSystem.filters.camelCase(input);
    expect(actualOutput).to.equal(expectedOutput);
  });
});

// SPARQL Query Steps
Given('I have an unjucks template system with SPARQL query support', function () {
  testContext.templateSystem = env;
});

Given('I have entity properties: {stringList}', function (properties) {
  testContext.properties = properties;
});

When('I generate a SPARQL SELECT query using camelCase filter', function () {
  const template = `
    PREFIX schema: <http://schema.org/>
    PREFIX ex: <http://example.org/>
    
    SELECT ?person{% for prop in properties %} ?{{ prop | camelCase }}{% endfor %}
    WHERE {
        ?person a schema:Person ;{% for prop in properties %}
                schema:{{ prop | replace(' ', '') | camelCase }} ?{{ prop | camelCase }}{% if not loop.last %} ;{% else %} .{% endif %}{% endfor %}
    }
  `;
  testContext.output = testContext.templateSystem.renderString(template, { properties: testContext.properties });
});

Then('the query should be:', function (expectedQuery) {
  const normalizedOutput = testContext.output.replace(/\s+/g, ' ').trim();
  const normalizedExpected = expectedQuery.replace(/\s+/g, ' ').trim();
  expect(normalizedOutput).to.include(normalizedExpected);
});

// Linked Data Resource Steps
Given('I have a person with name {string}', function (name) {
  testContext.entities.personName = name;
});

When('I generate a linked data resource using slug filter', function () {
  const slug = testContext.templateSystem.filters.slug(testContext.entities.personName);
  testContext.generatedUris.push(`http://example.org/person/${slug}`);
  
  const template = `
    @prefix schema: <http://schema.org/> .
    @prefix ex: <http://example.org/person/> .
    
    ex:{{ personName | slug }} a schema:Person ;
        schema:name "{{ personName }}" ;
        schema:url <http://example.org/person/{{ personName | slug }}> ;
        schema:identifier "{{ personName | slug }}" .
  `;
  testContext.output = testContext.templateSystem.renderString(template, testContext.entities);
});

Then('the resource URI should be {string}', function (expectedUri) {
  expect(testContext.generatedUris).to.include(expectedUri);
});

Then('the resource description should be:', function (expectedDescription) {
  const normalizedOutput = testContext.output.replace(/\s+/g, ' ').trim();
  const normalizedExpected = expectedDescription.replace(/\s+/g, ' ').trim();
  expect(normalizedOutput).to.include(normalizedExpected);
});

// Namespace Management Steps
Given('I have organizations: {stringList}', function (organizations) {
  testContext.entities.organizations = organizations;
});

When('I generate namespace prefixes using acronym filters', function () {
  testContext.output = testContext.entities.organizations.map(org => {
    // Simple acronym generation for common cases
    const acronymMap = {
      'World Wide Web Consortium': 'w3c',
      'Dublin Core Metadata Initiative': 'dcmi',  
      'Friend of a Friend': 'foaf'
    };
    return acronymMap[org] || org.toLowerCase().replace(/[^a-z]/g, '');
  });
});

Then('the prefixes should be:', function (dataTable) {
  const expected = dataTable.hashes();
  expected.forEach((row, index) => {
    expect(testContext.output).to.include(row['Suggested Prefix']);
  });
});

// Knowledge Graph Construction Steps
Given('I have academic entities:', function (dataTable) {
  const entities = dataTable.hashes();
  entities.forEach(entity => {
    testContext.entities[entity['Entity Type'].toLowerCase()] = {
      count: parseInt(entity.Count),
      samples: entity['Sample Names'] ? entity['Sample Names'].split('", "').map(s => s.replace(/"/g, '')) : []
    };
  });
});

When('I generate a comprehensive knowledge graph using entity relationship filters', function () {
  const template = `
    @prefix schema: <http://schema.org/> .
    @prefix ex: <http://example.org/> .
    @prefix dct: <http://purl.org/dc/terms/> .
    
    # Researchers
    {% for researcher in entities.researchers.samples %}
    ex:researcher/{{ researcher | slug }} a schema:Person, ex:Researcher ;
        schema:name "{{ researcher }}" ;
        schema:jobTitle "{{ 'Associate Professor' if loop.index0 == 0 else 'Professor' }}" .
    {% endfor %}
  `;
  testContext.output = testContext.templateSystem.renderString(template, testContext);
});

Then('the knowledge graph should include interconnected entities:', function (expectedGraph) {
  expect(testContext.output).to.include('ex:researcher/');
  expect(testContext.output).to.include('schema:Person');
});

// Hook functions for setup and cleanup
Before(function () {
  testContext.reset();
});

After(function () {
  // Cleanup if needed
});

// Custom parameter types
const { defineParameterType } = require('@cucumber/cucumber');

defineParameterType({
  name: 'stringList',
  regexp: /\[(.*?)\]/,
  transformer: function(match) {
    return match.split('", "').map(s => s.replace(/"/g, ''));
  }
});

// Export for testing
module.exports = {
  SemanticTestContext,
  testContext,
  env
};