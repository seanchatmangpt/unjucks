// @ts-nocheck
// Generated validation helpers
import { z } from 'zod';
import { EmployeeSchema } from './schemas.js';
import { DepartmentSchema } from './schemas.js';
import { PositionSchema } from './schemas.js';


export function validateEmployee(data: unknown): Employee {
  return EmployeeSchema.parse(data);
}

export function isEmployee(data: unknown): data is Employee {
  return EmployeeSchema.safeParse(data).success;
}


export function validateDepartment(data: unknown): Department {
  return DepartmentSchema.parse(data);
}

export function isDepartment(data: unknown): data is Department {
  return DepartmentSchema.safeParse(data).success;
}


export function validatePosition(data: unknown): Position {
  return PositionSchema.parse(data);
}

export function isPosition(data: unknown): data is Position {
  return PositionSchema.safeParse(data).success;
}


// Bulk validation
export const validators = {
  employee: EmployeeSchema,
  department: DepartmentSchema,
  position: PositionSchema
};