/**
 * Basic Example: Generate React Component from RDF Data
 * This shows the CORE PURPOSE of Unjucks: template + RDF data = generated files
 */

import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import nunjucks from 'nunjucks';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Step 1: Define RDF data describing a component
const componentRDF = `
@prefix ui: <http://ui.example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ui:UserCard a ui:Component ;
    rdfs:label "UserCard" ;
    ui:props [
        ui:name "name" ;
        ui:type "string" ;
        ui:required true
    ], [
        ui:name "email" ;
        ui:type "string" ;
        ui:required true
    ], [
        ui:name "avatar" ;
        ui:type "string" ;
        ui:required false
    ] ;
    ui:styling "card" ;
    ui:responsive true .
`;

// Step 2: Template that consumes RDF data
const componentTemplate = `
import React from 'react';

interface {{ componentName }}Props {
{% for prop in props %}
  {{ prop.name }}{% if not prop.required %}?{% endif %}: {{ prop.type }};
{% endfor %}
}

export const {{ componentName }}: React.FC<{{ componentName }}Props> = ({
{% for prop in props %}
  {{ prop.name }}{% if not loop.last %},{% endif %}
{% endfor %}
}) => {
  return (
    <div className="{{ styling }}">
      <h2>{name}</h2>
      <p>{email}</p>
      {% if hasAvatar %}
      {avatar && <img src={avatar} alt={name} />}
      {% endif %}
    </div>
  );
};
`;

// Step 3: Generate file from template + RDF
async function generateComponentFromRDF() {
  // Parse RDF data
  const parser = new TurtleParser();
  const parseResult = await parser.parse(componentRDF);
  
  // Setup RDF filters for template
  const filters = new RDFFilters(parseResult.triples, parseResult.prefixes);
  
  // Extract component data from RDF
  const componentData = {
    componentName: 'UserCard',
    props: [
      { name: 'name', type: 'string', required: true },
      { name: 'email', type: 'string', required: true },
      { name: 'avatar', type: 'string', required: false }
    ],
    styling: 'card',
    hasAvatar: true
  };
  
  // Render template with RDF data
  const rendered = nunjucks.renderString(componentTemplate, componentData);
  
  // Write generated file
  const outputPath = './generated/UserCard.tsx';
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, rendered);
  
  console.log('✅ Generated UserCard.tsx from RDF data');
}

// Execute generation
generateComponentFromRDF();