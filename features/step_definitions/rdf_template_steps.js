/**
 * RDF Template Step Definitions for KGEN Templates
 * Tests for RDF variable injection, SPARQL generation, and semantic web features
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { defineParameterType } from '@cucumber/cucumber';
import { KgenTemplateEngine } from '../../packages/kgen-templates/src/template-engine.js';
import { TemplateRenderer } from '../../packages/kgen-templates/src/renderer.js';

/**
 * RDF test state interface
 * @typedef {Object} RDFTestState
 * @property {KgenTemplateEngine} engine - Template engine instance
 * @property {TemplateRenderer} renderer - Template renderer instance
 * @property {any} rdfData - RDF data for testing
 * @property {string} templateContent - Template content
 * @property {string} renderedOutput - Rendered output
 * @property {Record<string, any>} context - Template context
 * @property {string} sparqlQuery - Generated SPARQL query
 * @property {Record<string, string>} namespaces - Namespace definitions
 * @property {Record<string, string>} prefixes - Prefix definitions
 * @property {Array<any>} triples - RDF triples
 * @property {Record<string, any>} entities - Entity definitions
 * @property {Array<any>} ontologyClasses - Ontology class definitions
 * @property {Array<any>} properties - Property definitions
 */

/** @type {RDFTestState} */
const rdfState = {
  engine: null,
  renderer: null,
  rdfData: null,
  templateContent: '',
  renderedOutput: '',
  context: {},
  sparqlQuery: '',
  namespaces: {},
  prefixes: {},
  triples: [],
  entities: {},
  ontologyClasses: [],
  properties: []
};

// Initialize RDF-enabled template system
Given('I have an RDF-enabled template system', function() {
  rdfState.engine = new KgenTemplateEngine({
    templateDirs: ['/Users/sac/unjucks/features/fixtures/templates'],
    deterministic: true
  });
  
  rdfState.renderer = new TemplateRenderer({
    enableRDF: true,
    enableCache: false,
    debug: true
  });
  
  expect(rdfState.engine).to.not.be.null;
  expect(rdfState.renderer).to.not.be.null;
});

// RDF data setup
Given('I have RDF data with prefixes:', function(docString) {
  const rdfData = JSON.parse(docString);
  rdfState.rdfData = rdfData;
  rdfState.prefixes = rdfData.prefixes || {};
  rdfState.triples = rdfData.triples || [];
});

Given('I have namespace definitions:', function(dataTable) {
  const namespaces = {};
  for (const row of dataTable.hashes()) {
    namespaces[row.Prefix] = row.URI;
  }
  rdfState.namespaces = namespaces;
});

Given('I have RDF triples:', function(dataTable) {
  const triples = [];
  for (const row of dataTable.hashes()) {
    triples.push({
      subject: row.Subject,
      predicate: row.Predicate,
      object: row.Object
    });
  }
  rdfState.triples = triples;
});

// Template with RDF variables
Given('I have a template with RDF variables:', function(docString) {
  rdfState.templateContent = docString;
});

When('I render the template with RDF context', async function() {
  const template = {
    id: 'rdf-test',
    content: rdfState.templateContent,
    metadata: {
      name: 'rdf-template',
      category: 'semantic',
      rdf: {
        enabled: true,
        namespaces: rdfState.namespaces,
        prefixes: rdfState.prefixes
      }
    },
    config: {}
  };

  const context = {
    ...rdfState.context,
    rdfData: rdfState.rdfData,
    namespaces: rdfState.namespaces,
    prefixes: rdfState.prefixes,
    triples: rdfState.triples
  };

  rdfState.renderedOutput = await rdfState.renderer.render(template, context);
});

Then('the output should contain RDF triples', function() {
  expect(rdfState.renderedOutput).to.match(/\w+:\w+\s+\w+:\w+\s+.+\s*\./);
});

Then('the output should use correct prefixes', function() {
  Object.keys(rdfState.prefixes).forEach(prefix => {
    expect(rdfState.renderedOutput).to.contain(`@prefix ${prefix}:`);
  });
});

// SPARQL query generation
Given('I have entity types: {stringList}', function(entityTypes) {
  rdfState.entities.types = entityTypes;
});

Given('I have properties: {stringList}', function(properties) {
  rdfState.properties = properties.map(prop => ({ name: prop }));
});

When('I generate a SPARQL query using RDF variables', function() {
  const template = `
PREFIX {{ prefixes.schema }}: <http://schema.org/>
PREFIX {{ prefixes.ex }}: <http://example.org/>

SELECT {% for type in entities.types %}?{{ type | camelCase }}{% if not loop.last %} {% endif %}{% endfor %}
WHERE {
  {% for type in entities.types %}
  ?{{ type | camelCase }} a {{ prefixes.schema }}:{{ type | pascalCase }} .
  {% endfor %}
  {% for prop in properties %}
  ?person {{ prefixes.schema }}:{{ prop.name | camelCase }} ?{{ prop.name | camelCase }} .
  {% endfor %}
}`;

  const context = {
    prefixes: { schema: 'schema', ex: 'ex' },
    entities: rdfState.entities,
    properties: rdfState.properties
  };

  rdfState.sparqlQuery = rdfState.engine.env.renderString(template, context);
});

Then('the SPARQL query should be syntactically valid', function() {
  expect(rdfState.sparqlQuery).to.contain('SELECT');
  expect(rdfState.sparqlQuery).to.contain('WHERE');
  expect(rdfState.sparqlQuery).to.match(/PREFIX\s+\w+:\s*<[^>]+>/);
});

Then('the query should select entity variables', function() {
  rdfState.entities.types.forEach(type => {
    const camelCaseType = type.replace(/(?:^|[\s-_])+(.)/g, (_, char) => char.toLowerCase());
    expect(rdfState.sparqlQuery).to.contain(`?${camelCaseType}`);
  });
});

// Ontology class generation
Given('I have class definitions:', function(dataTable) {
  const classes = [];
  for (const row of dataTable.hashes()) {
    classes.push({
      name: row.ClassName,
      baseClass: row.BaseClass,
      namespace: row.Namespace
    });
  }
  rdfState.ontologyClasses = classes;
});

When('I generate OWL classes with inheritance', function() {
  const template = `
{% for prefix, uri in namespaces %}
@prefix {{ prefix }}: <{{ uri }}> .
{% endfor %}

{% for cls in ontologyClasses %}
{{ cls.namespace }}:{{ cls.name | pascalCase }} a owl:Class ;
  rdfs:label "{{ cls.name | titleCase }}"@en{% if cls.baseClass %} ;
  rdfs:subClassOf {{ cls.namespace }}:{{ cls.baseClass | pascalCase }}{% endif %} .
{% endfor %}`;

  const context = {
    namespaces: rdfState.namespaces,
    ontologyClasses: rdfState.ontologyClasses
  };

  rdfState.renderedOutput = rdfState.engine.env.renderString(template, context);
});

Then('the output should contain OWL class definitions', function() {
  expect(rdfState.renderedOutput).to.contain('a owl:Class');
  expect(rdfState.renderedOutput).to.contain('rdfs:label');
});

Then('classes should have proper inheritance hierarchy', function() {
  expect(rdfState.renderedOutput).to.contain('rdfs:subClassOf');
});

// RDF validation
Then('the RDF should be valid Turtle syntax', function() {
  // Basic Turtle syntax validation
  expect(rdfState.renderedOutput).to.match(/@prefix\s+\w+:\s*<[^>]+>\s*\./);
  expect(rdfState.renderedOutput).to.match(/\w+:\w+\s+\w+:\w+\s+[^;.]+[;.]/);
});

Then('the RDF should contain proper URI references', function() {
  expect(rdfState.renderedOutput).to.match(/<[^>]+>/);
});

// RDF data injection
Given('I have Person entities:', function(dataTable) {
  const persons = [];
  for (const row of dataTable.hashes()) {
    persons.push({
      name: row.Name,
      email: row.Email,
      jobTitle: row.JobTitle
    });
  }
  rdfState.entities.persons = persons;
});

When('I generate linked data for persons', function() {
  const template = `
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix schema: <http://schema.org/> .
@prefix ex: <http://example.org/> .

{% for person in entities.persons %}
ex:person/{{ person.name | kebabCase }} a foaf:Person, schema:Person ;
  foaf:name "{{ person.name }}" ;
  schema:email "{{ person.email }}" ;
  schema:jobTitle "{{ person.jobTitle }}" .
{% endfor %}`;

  const context = {
    entities: rdfState.entities
  };

  rdfState.renderedOutput = rdfState.engine.env.renderString(template, context);
});

Then('each person should have a unique URI', function() {
  expect(rdfState.renderedOutput).to.match(/ex:person\/[\w-]+/g);
  const uris = rdfState.renderedOutput.match(/ex:person\/[\w-]+/g);
  const uniqueUris = [...new Set(uris)];
  expect(uniqueUris.length).to.equal(uris.length);
});

Then('the output should contain FOAF properties', function() {
  expect(rdfState.renderedOutput).to.contain('foaf:Person');
  expect(rdfState.renderedOutput).to.contain('foaf:name');
});

// Complex RDF template scenarios
Given('I have a knowledge graph template:', function(docString) {
  rdfState.templateContent = docString;
});

When('I render with semantic context', function() {
  const context = {
    ...rdfState.context,
    namespaces: rdfState.namespaces,
    entities: rdfState.entities,
    properties: rdfState.properties,
    prefixes: rdfState.prefixes
  };

  rdfState.renderedOutput = rdfState.engine.env.renderString(rdfState.templateContent, context);
});

Then('the knowledge graph should be well-formed', function() {
  expect(rdfState.renderedOutput).to.contain('@prefix');
  expect(rdfState.renderedOutput).to.match(/\w+:\w+\s+a\s+\w+:\w+/);
});

// Custom parameter type for string lists
defineParameterType({
  name: 'stringList',
  regexp: /\[(.*?)\]/,
  transformer: function(match) {
    return match.split('", "').map(s => s.replace(/"/g, ''));
  }
});

export { rdfState };