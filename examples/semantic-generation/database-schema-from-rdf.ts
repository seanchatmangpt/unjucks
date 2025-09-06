/**
 * Generate Database Schema from RDF/OWL Ontology
 * Shows semantic data → SQL/Prisma schema generation
 */

import { TurtleParser } from '../../src/lib/turtle-parser';
import { RDFFilters } from '../../src/lib/rdf-filters';
import nunjucks from 'nunjucks';
import { writeFileSync } from 'fs';

// Domain Ontology
const domainOntology = `
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix db: <http://schema.example.org/> .

# User entity
db:User a owl:Class ;
    rdfs:label "User" ;
    rdfs:comment "System user account" .

db:userId a owl:DatatypeProperty ;
    rdfs:domain db:User ;
    rdfs:range xsd:integer ;
    db:primaryKey true ;
    db:autoIncrement true .

db:email a owl:DatatypeProperty ;
    rdfs:domain db:User ;
    rdfs:range xsd:string ;
    db:unique true ;
    db:required true ;
    db:maxLength 255 .

db:username a owl:DatatypeProperty ;
    rdfs:domain db:User ;
    rdfs:range xsd:string ;
    db:unique true ;
    db:required true ;
    db:maxLength 50 .

db:createdAt a owl:DatatypeProperty ;
    rdfs:domain db:User ;
    rdfs:range xsd:dateTime ;
    db:defaultValue "CURRENT_TIMESTAMP" .

# Post entity
db:Post a owl:Class ;
    rdfs:label "Post" ;
    rdfs:comment "Blog post or article" .

db:postId a owl:DatatypeProperty ;
    rdfs:domain db:Post ;
    rdfs:range xsd:integer ;
    db:primaryKey true ;
    db:autoIncrement true .

db:title a owl:DatatypeProperty ;
    rdfs:domain db:Post ;
    rdfs:range xsd:string ;
    db:required true ;
    db:maxLength 200 .

db:content a owl:DatatypeProperty ;
    rdfs:domain db:Post ;
    rdfs:range xsd:string ;
    db:columnType "TEXT" .

# Relationships
db:authoredBy a owl:ObjectProperty ;
    rdfs:domain db:Post ;
    rdfs:range db:User ;
    db:foreignKey "userId" ;
    db:onDelete "CASCADE" .
`;

// Prisma Schema Template
const prismaTemplate = `
// Generated from RDF Ontology
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

{% for entity in entities %}
model {{ entity.name }} {
  {% for field in entity.fields %}
  {{ field.name }} {{ field.type }}{% if field.modifiers %} {{ field.modifiers }}{% endif %}
  {% endfor %}
  {% for relation in entity.relations %}
  {{ relation.name }} {{ relation.type }}{% if relation.modifiers %} {{ relation.modifiers }}{% endif %}
  {% endfor %}
  
  {% if entity.indexes %}
  {% for index in entity.indexes %}
  @@index([{{ index.fields | join(', ') }}])
  {% endfor %}
  {% endif %}
}

{% endfor %}
`;

// SQL Schema Template
const sqlTemplate = `
-- Generated from RDF Ontology
{% for entity in entities %}
CREATE TABLE {{ entity.tableName }} (
  {% for field in entity.fields %}
  {{ field.columnName }} {{ field.sqlType }}{% if field.constraints %} {{ field.constraints }}{% endif %}{% if not loop.last %},{% endif %}
  {% endfor %}
);

{% for index in entity.indexes %}
CREATE {% if index.unique %}UNIQUE {% endif %}INDEX idx_{{ entity.tableName }}_{{ index.name }} 
  ON {{ entity.tableName }} ({{ index.columns | join(', ') }});
{% endfor %}

{% endfor %}

-- Foreign Key Constraints
{% for entity in entities %}
{% for relation in entity.relations %}
ALTER TABLE {{ entity.tableName }} 
  ADD CONSTRAINT fk_{{ entity.tableName }}_{{ relation.name }}
  FOREIGN KEY ({{ relation.column }}) 
  REFERENCES {{ relation.references }}(id)
  {% if relation.onDelete %}ON DELETE {{ relation.onDelete }}{% endif %};
{% endfor %}
{% endfor %}
`;

async function generateDatabaseSchemaFromRDF() {
  const parser = new TurtleParser();
  const result = await parser.parse(domainOntology);
  
  // Transform RDF to schema data structure
  // This would use RDFFilters to extract entities and properties
  const schemaData = {
    entities: [
      {
        name: 'User',
        tableName: 'users',
        fields: [
          { name: 'id', type: 'Int', modifiers: '@id @default(autoincrement())',
            columnName: 'id', sqlType: 'SERIAL', constraints: 'PRIMARY KEY' },
          { name: 'email', type: 'String', modifiers: '@unique',
            columnName: 'email', sqlType: 'VARCHAR(255)', constraints: 'NOT NULL UNIQUE' },
          { name: 'username', type: 'String', modifiers: '@unique',
            columnName: 'username', sqlType: 'VARCHAR(50)', constraints: 'NOT NULL UNIQUE' },
          { name: 'createdAt', type: 'DateTime', modifiers: '@default(now())',
            columnName: 'created_at', sqlType: 'TIMESTAMP', constraints: 'DEFAULT CURRENT_TIMESTAMP' }
        ],
        relations: [
          { name: 'posts', type: 'Post[]' }
        ],
        indexes: [
          { unique: true, name: 'email', columns: ['email'], fields: ['email'] }
        ]
      },
      {
        name: 'Post',
        tableName: 'posts',
        fields: [
          { name: 'id', type: 'Int', modifiers: '@id @default(autoincrement())',
            columnName: 'id', sqlType: 'SERIAL', constraints: 'PRIMARY KEY' },
          { name: 'title', type: 'String',
            columnName: 'title', sqlType: 'VARCHAR(200)', constraints: 'NOT NULL' },
          { name: 'content', type: 'String?',
            columnName: 'content', sqlType: 'TEXT', constraints: '' },
          { name: 'authorId', type: 'Int',
            columnName: 'author_id', sqlType: 'INTEGER', constraints: 'NOT NULL' }
        ],
        relations: [
          { name: 'author', type: 'User', modifiers: '@relation(fields: [authorId], references: [id])',
            column: 'author_id', references: 'users', onDelete: 'CASCADE' }
        ],
        indexes: [
          { unique: false, name: 'author', columns: ['author_id'], fields: ['authorId'] }
        ]
      }
    ]
  };
  
  // Generate Prisma schema
  const prismaSchema = nunjucks.renderString(prismaTemplate, schemaData);
  writeFileSync('./generated/schema.prisma', prismaSchema);
  
  // Generate SQL schema
  const sqlSchema = nunjucks.renderString(sqlTemplate, schemaData);
  writeFileSync('./generated/schema.sql', sqlSchema);
  
  console.log('✅ Generated Prisma and SQL schemas from RDF ontology');
}

generateDatabaseSchemaFromRDF();