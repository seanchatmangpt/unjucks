/**
 * Type Guards and Runtime Type Safety
 * 
 * This file provides comprehensive type guards and runtime validation
 * to ensure type safety throughout the application.
 */

import type {
  FrontmatterConfig,
  TemplateVariable,
  GeneratorConfig,
  TemplateConfig,
  InjectionOptions,
  InjectionResult,
  CommandResult,
  ValidationResult,
  RDFDataSource
} from "../types/core-interfaces.js";

// Basic type guards
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isNonNullObject(value: unknown): value is NonNullable<Record<string, unknown>> {
  return isObject(value) && value !== null;
}

// Template Variable Type Guards
export function isTemplateVariable(value: unknown): value is TemplateVariable {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.name) &&
    isString(obj.type) &&
    ["string", "number", "boolean", "array", "object"].includes(obj.type) &&
    isBoolean(obj.required)
  );
}

export function isTemplateVariableArray(value: unknown): value is TemplateVariable[] {
  return isArray(value) && value.every(isTemplateVariable);
}

// Frontmatter Configuration Type Guards
export function isFrontmatterConfig(value: unknown): value is FrontmatterConfig {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  
  // Check optional string properties
  if (obj.to !== undefined && !isString(obj.to)) return false;
  if (obj.before !== undefined && !isString(obj.before)) return false;
  if (obj.after !== undefined && !isString(obj.after)) return false;
  if (obj.skipIf !== undefined && !isString(obj.skipIf)) return false;
  if (obj.turtleData !== undefined && !isString(obj.turtleData)) return false;
  if (obj.rdfData !== undefined && !isString(obj.rdfData)) return false;
  if (obj.rdfBaseUri !== undefined && !isString(obj.rdfBaseUri)) return false;
  
  // Check optional boolean properties
  if (obj.inject !== undefined && !isBoolean(obj.inject)) return false;
  if (obj.append !== undefined && !isBoolean(obj.append)) return false;
  if (obj.prepend !== undefined && !isBoolean(obj.prepend)) return false;
  
  // Check optional number properties
  if (obj.lineAt !== undefined && !isNumber(obj.lineAt)) return false;
  
  // Check chmod (string or number)
  if (obj.chmod !== undefined && !isString(obj.chmod) && !isNumber(obj.chmod)) return false;
  
  // Check shell commands (string or array of strings)
  if (obj.sh !== undefined) {
    if (!isString(obj.sh) && !(isArray(obj.sh) && obj.sh.every(isString))) {
      return false;
    }
  }
  
  return true;
}

// Generator Configuration Type Guards
export function isGeneratorConfig(value: unknown): value is GeneratorConfig {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.name) &&
    isArray(obj.templates) &&
    obj.templates.every(isTemplateConfig) &&
    (obj.description === undefined || isString(obj.description))
  );
}

export function isTemplateConfig(value: unknown): value is TemplateConfig {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.name) &&
    isArray(obj.files) &&
    obj.files.every(isString) &&
    (obj.description === undefined || isString(obj.description)) &&
    (obj.prompts === undefined || isArray(obj.prompts))
  );
}

// Injection Options Type Guards
export function isInjectionOptions(value: unknown): value is InjectionOptions {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isBoolean(obj.force) &&
    isBoolean(obj.dry) &&
    (obj.backup === undefined || isBoolean(obj.backup))
  );
}

export function isInjectionResult(value: unknown): value is InjectionResult {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isBoolean(obj.success) &&
    isString(obj.message) &&
    isArray(obj.changes) &&
    obj.changes.every(isString) &&
    (obj.skipped === undefined || isBoolean(obj.skipped)) &&
    (obj.size === undefined || isNumber(obj.size)) &&
    (obj.exists === undefined || isBoolean(obj.exists)) &&
    (obj.action === undefined || isString(obj.action))
  );
}

// Command Result Type Guards
export function isCommandResult(value: unknown): value is CommandResult {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isBoolean(obj.success) &&
    isString(obj.message) &&
    (obj.errors === undefined || (isArray(obj.errors) && obj.errors.every(isString))) &&
    (obj.warnings === undefined || (isArray(obj.warnings) && obj.warnings.every(isString))) &&
    (obj.duration === undefined || isNumber(obj.duration))
  );
}

export function isValidationResult(value: unknown): value is ValidationResult {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isBoolean(obj.valid) &&
    isArray(obj.errors) &&
    obj.errors.every(isString) &&
    (obj.warnings === undefined || (isArray(obj.warnings) && obj.warnings.every(isString)))
  );
}

// RDF Data Source Type Guards
export function isRDFDataSource(value: unknown): value is RDFDataSource {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.type) &&
    ["file", "inline", "uri"].includes(obj.type) &&
    isString(obj.source) &&
    (obj.format === undefined || isString(obj.format)) &&
    (obj.baseUri === undefined || isString(obj.baseUri)) &&
    (obj.prefixes === undefined || isObject(obj.prefixes))
  );
}

// Path and URL validation
export function isValidPath(value: unknown): value is string {
  if (!isString(value)) return false;
  
  // Basic path validation - no null bytes, reasonable length
  return (
    value.length > 0 &&
    value.length < 4096 &&
    !value.includes('\0') &&
    !value.includes('%00')
  );
}

export function isValidUrl(value: unknown): value is string {
  if (!isString(value)) return false;
  
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// Null and undefined safety
export function assertNonNull<T>(value: T | null | undefined, name: string): asserts value is NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${name} to be non-null but received ${value}`);
  }
}

export function isNonNull<T>(value: T | null | undefined): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

// Record validation
export function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isObject(value)) return false;
  
  return Object.values(value).every(isString);
}

export function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value);
}

// Array validation helpers
export function isStringArray(value: unknown): value is string[] {
  return isArray(value) && value.every(isString);
}

export function isNumberArray(value: unknown): value is number[] {
  return isArray(value) && value.every(isNumber);
}

// Enum validation
export function isValidChmodFormat(value: unknown): value is string {
  return isString(value) && /^[0-7]{3,4}$/.test(value);
}

export function isValidFileType(value: unknown): value is string {
  return isString(value) && ["file", "inline", "uri"].includes(value);
}

// Complex validation functions
export function validateVariableValue(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case "string":
      return isString(value);
    case "number":
      return isNumber(value);
    case "boolean":
      return isBoolean(value);
    case "array":
      return isArray(value);
    case "object":
      return isObject(value);
    default:
      return false;
  }
}

export function validateRequiredFields<T extends Record<string, unknown>>(
  obj: T,
  requiredFields: (keyof T)[]
): ValidationResult {
  const errors: string[] = [];
  
  for (const field of requiredFields) {
    if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
      errors.push(`Required field '${String(field)}' is missing or null`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Safe parsing functions
export function safeParseNumber(value: unknown): number | null {
  if (isNumber(value)) return value;
  if (isString(value)) {
    const parsed = Number(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function safeParseBoolean(value: unknown): boolean | null {
  if (isBoolean(value)) return value;
  if (isString(value)) {
    const lower = value.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
  }
  return null;
}

export function safeParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

// Development-time type checking (removed in production)
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

export function debugTypeCheck<T>(value: T, typeName: string): T {
  if (isDevelopment()) {
    console.log(`Type check: ${typeName}`, typeof value, value);
  }
  return value;
}

// Export type predicate combinators
export function and<A, B>(
  guardA: (value: unknown) => value is A,
  guardB: (value: unknown) => value is B
): (value: unknown) => value is A & B {
  return (value: unknown): value is A & B => guardA(value) && guardB(value);
}

export function or<A, B>(
  guardA: (value: unknown) => value is A,
  guardB: (value: unknown) => value is B
): (value: unknown) => value is A | B {
  return (value: unknown): value is A | B => guardA(value) || guardB(value);
}