// @ts-nocheck
// Generated from RDF/OWL ontology
// Do not edit manually - regenerate from source ontology

import { z } from 'zod';

/**
 * Employee in the enterprise system
 * @ontology Custom
 * @uri http://enterprise.example.org/hr/Employee
 */
export interface Employee extends Person {
  /** Full name of employee */
  name: string;
  /** Business email address */
  email?: string;
  /** Unique employee identifier */
  employeeId?: string;
  /** Annual salary in USD */
  salary?: number;
  /** Employment start date */
  startDate?: Date;
  /** Employee works in department */
  worksIn?: Department;
  /** Employee holds position */
  holdsPosition?: Position;
}

/**
 * Organizational department
 * @ontology Custom
 * @uri http://enterprise.example.org/hr/Department
 */
export interface Department {
  
}

/**
 * Job position with specific responsibilities
 * @ontology Custom
 * @uri http://enterprise.example.org/hr/Position
 */
export interface Position {
  
}