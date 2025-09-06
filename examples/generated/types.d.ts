// Generated from RDF/OWL ontology
// Do not edit manually - regenerate from source ontology

import { z } from 'zod';

/**
 * A person - the core entity in most enterprise systems
 * @ontology FOAF
 * @uri http://xmlns.com/foaf/0.1/Person
 */
export interface Person {
  /** The name of a person */
  name: string;
  /** Email address of a person */
  email?: string;
  /** Personal homepage URL */
  homepage?: string;
  /** Age of a person */
  age?: number;
  /** Person knows another person */
  knows?: Person;
}

/**
 * An organization such as a company, NGO, or government agency
 * @ontology Custom
 * @uri https://schema.org/Organization
 */
export interface Organization {
  /** Official name of the organization */
  name: string;
  /** Official website URL */
  url?: string;
  /** Number of employees */
  numberOfEmployees?: number;
  /** Date the organization was founded */
  foundingDate?: Date;
}

/**
 * An employee of an organization
 * @ontology Custom
 * @uri https://schema.org/Employee
 */
export interface Employee extends Person {
  /** Job title or position */
  jobTitle?: string;
  /** Annual salary */
  salary?: number;
  /** Employment start date */
  startDate?: Date;
  /** Organization the person works for */
  worksFor?: Organization;
}

/**
 * Any offered product or service
 * @ontology Custom
 * @uri https://schema.org/Product
 */
export interface Product {
  /** Product price */
  price?: number;
  /** Product description */
  description?: string;
  /** Organization that manufactures the product */
  manufacturer?: Organization;
}