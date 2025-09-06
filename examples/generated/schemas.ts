import { z } from 'zod';

// A person - the core entity in most enterprise systems
export const PersonSchema = z.object({
  name: z.string().describe("The name of a person"),
  email: z.string().email().regex(/^[^@]+@[^@]+\.[^@]+$/).describe("Email address of a person").optional(),
  homepage: z.string().describe("Personal homepage URL").optional(),
  age: z.number().describe("Age of a person").optional(),
  knows: PersonSchema.describe("Person knows another person").optional()
});

export type Person = z.infer<typeof PersonSchema>;

// An organization such as a company, NGO, or government agency
export const OrganizationSchema = z.object({
  name: z.string().describe("Official name of the organization"),
  url: z.string().url().describe("Official website URL").optional(),
  numberOfEmployees: z.number().describe("Number of employees").optional(),
  foundingDate: z.date().describe("Date the organization was founded").optional()
});

export type Organization = z.infer<typeof OrganizationSchema>;

// An employee of an organization
export const EmployeeSchema = z.object({
  jobTitle: z.string().describe("Job title or position").optional(),
  salary: z.number().describe("Annual salary").optional(),
  startDate: z.date().describe("Employment start date").optional(),
  worksFor: OrganizationSchema.describe("Organization the person works for").optional()
});

export type Employee = z.infer<typeof EmployeeSchema>;

// Any offered product or service
export const ProductSchema = z.object({
  price: z.number().describe("Product price").optional(),
  description: z.string().describe("Product description").optional(),
  manufacturer: OrganizationSchema.describe("Organization that manufactures the product").optional()
});

export type Product = z.infer<typeof ProductSchema>;