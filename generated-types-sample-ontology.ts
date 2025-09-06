// TypeScript interfaces generated from RDF ontology
// Source: sample-ontology.ttl
// Generated: 2025-09-06T20:24:53.910Z

/**
 * Person
 * A person - the core entity in most enterprise systems
 * Generated from RDF ontology
 */
export interface Person {
  name: string;
  email: string;
  homepage: string;
  age: number;
  knows: string;
}

/**
 * Organization
 * An organization such as a company, NGO, or government agency
 * Generated from RDF ontology
 */
export interface Organization {
  name: string;
  url: string;
  numberOfEmployees: number;
  foundingDate: Date;
}

/**
 * Employee
 * An employee of an organization
 * Generated from RDF ontology
 */
export interface Employee {
  jobTitle: string;
  salary: number;
  startDate: Date;
  worksFor: string;
}

/**
 * Product
 * Any offered product or service
 * Generated from RDF ontology
 */
export interface Product {
  price: number;
  description: string;
  manufacturer: string;
}

