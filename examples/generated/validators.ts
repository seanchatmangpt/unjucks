// @ts-nocheck
// Generated validation helpers
import { z } from 'zod';
import { PersonSchema } from './schemas.js';
import { OrganizationSchema } from './schemas.js';
import { EmployeeSchema } from './schemas.js';
import { ProductSchema } from './schemas.js';


export function validatePerson(data: unknown): Person {
  return PersonSchema.parse(data);
}

export function isPerson(data: unknown): data is Person {
  return PersonSchema.safeParse(data).success;
}


export function validateOrganization(data: unknown): Organization {
  return OrganizationSchema.parse(data);
}

export function isOrganization(data: unknown): data is Organization {
  return OrganizationSchema.safeParse(data).success;
}


export function validateEmployee(data: unknown): Employee {
  return EmployeeSchema.parse(data);
}

export function isEmployee(data: unknown): data is Employee {
  return EmployeeSchema.safeParse(data).success;
}


export function validateProduct(data: unknown): Product {
  return ProductSchema.parse(data);
}

export function isProduct(data: unknown): data is Product {
  return ProductSchema.safeParse(data).success;
}


// Bulk validation
export const validators = {
  person: PersonSchema,
  organization: OrganizationSchema,
  employee: EmployeeSchema,
  product: ProductSchema
};