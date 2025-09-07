---
to: <%= name %>.ttl
---
@prefix : <http://example.org/<%= name %>/>
@prefix owl: <http://www.w3.org/2002/07/owl#>
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>

:<%= name %> rdf:type owl:Ontology .

# Classes
:Book rdf:type owl:Class .
:Author rdf:type owl:Class .
:Publisher rdf:type owl:Class .

# Object Properties
:hasAuthor rdf:type owl:ObjectProperty ;
    rdfs:domain :Book ;
    rdfs:range :Author .

:publishedBy rdf:type owl:ObjectProperty ;
    rdfs:domain :Book ;
    rdfs:range :Publisher .

# Data Properties
:title rdf:type owl:DatatypeProperty ;
    rdfs:domain :Book ;
    rdfs:range xsd:string .

:isbn rdf:type owl:DatatypeProperty ;
    rdfs:domain :Book ;
    rdfs:range xsd:string .

:publicationDate rdf:type owl:DatatypeProperty ;
    rdfs:domain :Book ;
    rdfs:range xsd:date .