// TypeScript interfaces generated from RDF ontology
// Source: complex-schema.ttl
// Generated: 2025-09-06T20:24:53.909Z

/**
 * Organization
 * A formal organization entity
 * Generated from RDF ontology
 */
export interface Organization {
  hasProject: string;
}

/**
 * Project
 * A work project with team members and tasks
 * Generated from RDF ontology
 */
export interface Project {
  projectBudget: number;
  startDate: Date;
  priority: string;
}

