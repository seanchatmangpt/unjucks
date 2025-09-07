/**
 * TypeScript type definitions for Unjucks CLI commands
 * Provides type safety and validation interfaces for citty commands
 */

import type { GeneratorConfig, TemplateConfig } from '../lib/generator.js';

/**
 * Base interface for all command arguments
 */
export interface BaseCommandArgs {
  /** Enable verbose logging output */
  verbose?: boolean;
  /** Suppress non-essential output */
  quiet?: boolean;
  /** Display help information */
  help?: boolean;
}

/**
 * Arguments for the generate command
 */
export interface GenerateCommandArgs extends BaseCommandArgs {
  /** Name of the generator to use */
  generator?: string;
  /** Name of the template within the generator */
  template?: string;
  /** Name/identifier for the generated entity */
  name?: string;
  /** Destination directory for generated files */
  dest: string;
  /** Overwrite existing files without prompting */
  force: boolean;
  /** Show what would be generated without creating files */
  dry: boolean;
  /** Create backup files before overwriting */
  backup?: boolean;
  /** Skip confirmation prompts */
  skipPrompts?: boolean;
  /** Additional template variables as key-value pairs */
  [key: string]: any;
}

/**
 * Arguments for the list command
 */
export interface ListCommandArgs extends BaseCommandArgs {
  /** Name of specific generator to list templates for */
  generator?: string;
  /** Filter generators/templates by category */
  category?: string;
  /** Filter by search term in name or description */
  search?: string;
  /** Output format for results */
  format: 'table' | 'json' | 'yaml' | 'simple';
  /** Sort order for results */
  sort: 'name' | 'modified' | 'created' | 'usage';
  /** Sort direction */
  direction: 'asc' | 'desc';
  /** Show detailed information including variables */
  detailed: boolean;
  /** Show template usage statistics */
  stats?: boolean;
}

/**
 * Arguments for the init command
 */
export interface InitCommandArgs extends BaseCommandArgs {
  /** Type of project to initialize */
  type?: string;
  /** Destination directory for the project */
  dest: string;
  /** Initialize with git repository */
  git?: boolean;
  /** Install dependencies automatically */
  install?: boolean;
  /** Skip interactive prompts */
  skipPrompts?: boolean;
  /** Use specific template source */
  source?: string;
  /** Project name override */
  name?: string;
  /** Project description */
  description?: string;
}

/**
 * Arguments for the inject command
 */
export interface InjectCommandArgs extends BaseCommandArgs {
  /** Target file to inject content into */
  file: string;
  /** Content to inject */
  content?: string;
  /** Template file to render and inject */
  template?: string;
  /** Generator containing the template */
  generator?: string;
  /** Injection mode */
  mode: 'inject' | 'append' | 'prepend' | 'before' | 'after' | 'replace';
  /** Target marker for injection */
  target?: string;
  /** Line number for line-based injection */
  line?: number;
  /** Overwrite existing content */
  force: boolean;
  /** Show what would be injected without modifying files */
  dry: boolean;
  /** Create backup before modification */
  backup: boolean;
  /** Skip if condition is met */
  skipIf?: string;
  /** Template variables */
  vars?: Record<string, any>;
}

/**
 * Arguments for the github command
 */
export interface GitHubCommandArgs extends BaseCommandArgs {
  /** Repository to analyze (format: owner/repo) */
  repository?: string;
  /** Analysis depth: surface, deep, comprehensive */
  depth?: 'surface' | 'deep' | 'comprehensive';
  /** Include repository metrics in analysis */
  metrics?: boolean;
  /** Output format: json, yaml, table */
  format?: 'json' | 'yaml' | 'table';
  /** Source branch for PR operations */
  source?: string;
  /** Target branch for PR operations */
  target?: string;
  /** Create PR as draft */
  draft?: boolean;
  /** Auto-assign PR/issue based on code ownership */
  autoAssign?: boolean;
  /** PR template to use */
  template?: string;
  /** Include code quality analysis */
  codeQuality?: boolean;
  /** Include security analysis */
  security?: boolean;
  /** Include performance analysis */
  performance?: boolean;
  /** AI suggestion level: minimal, moderate, comprehensive */
  suggestionLevel?: 'minimal' | 'moderate' | 'comprehensive';
  /** Merge strategy: smart, squash, rebase, merge */
  mergeStrategy?: 'smart' | 'squash' | 'rebase' | 'merge';
  /** Automatically resolve merge conflicts */
  resolveConflicts?: boolean;
  /** Run tests before merge/deployment */
  runTests?: boolean;
  /** Update dependencies during merge */
  updateDeps?: boolean;
  /** Automatically apply labels based on analysis */
  autoLabel?: boolean;
  /** Assign priority levels to issues */
  prioritize?: boolean;
  /** Suggest solutions for issues */
  suggest?: boolean;
  /** Type of solution: code, documentation, configuration */
  solutionType?: 'code' | 'documentation' | 'configuration';
  /** Include tests in generated solutions */
  tests?: boolean;
  /** Include documentation in solutions */
  docs?: boolean;
  /** Create PR for generated solution */
  createPR?: boolean;
  /** Type of workflow: ci-cd, release, security, testing */
  workflowType?: 'ci-cd' | 'release' | 'security' | 'testing';
  /** Workflow triggers (comma-separated) */
  triggers?: string;
  /** Include deployment in workflow */
  deploy?: boolean;
}

/**
 * Available project types for initialization
 */
export type ProjectType = 
  | 'node-library'
  | 'node-cli'
  | 'express-api'
  | 'fastify-api'
  | 'react-app'
  | 'vue-app'
  | 'svelte-app'
  | 'next-app'
  | 'nuxt-app'
  | 'astro-app'
  | 'typescript-lib'
  | 'vite-app'
  | 'electron-app'
  | 'nestjs-api'
  | 'hono-api'
  | 'tauri-app'
  | 'custom';

/**
 * Output formats for list command
 */
export type OutputFormat = 'table' | 'json' | 'yaml' | 'simple';

/**
 * Sort options for list command
 */
export type SortOption = 'name' | 'modified' | 'created' | 'usage';

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Injection modes for inject command
 */
export type InjectionMode = 'inject' | 'append' | 'prepend' | 'before' | 'after' | 'replace';

/**
 * GitHub analysis depths
 */
export type AnalysisDepth = 'surface' | 'deep' | 'comprehensive';

/**
 * GitHub suggestion levels
 */
export type SuggestionLevel = 'minimal' | 'moderate' | 'comprehensive';

/**
 * GitHub merge strategies
 */
export type MergeStrategy = 'smart' | 'squash' | 'rebase' | 'merge';

/**
 * GitHub solution types
 */
export type SolutionType = 'code' | 'documentation' | 'configuration';

/**
 * GitHub workflow types
 */
export type WorkflowType = 'ci-cd' | 'release' | 'security' | 'testing';

/**
 * Command result interface
 */
export interface CommandResult {
  /** Whether the command succeeded */
  success: boolean;
  /** Human-readable message */
  message: string;
  /** Additional data from the command */
  data?: any;
  /** Error details if the command failed */
  error?: Error | string;
  /** Files that were created or modified */
  files?: string[];
  /** Duration of command execution in milliseconds */
  duration?: number;
}

/**
 * Validation result for command arguments
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation error messages */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Sanitized/normalized values */
  sanitized?: any;
}

/**
 * Available generator information
 */
export interface GeneratorInfo {
  /** Generator name */
  name: string;
  /** Generator description */
  description?: string;
  /** Generator category */
  category?: string;
  /** Path to generator directory */
  path: string;
  /** Available templates */
  templates: TemplateInfo[];
  /** Creation timestamp */
  created?: Date;
  /** Last modified timestamp */
  modified?: Date;
  /** Usage statistics */
  usage?: {
    /** Number of times used */
    count: number;
    /** Last used timestamp */
    lastUsed?: Date;
  };
}

/**
 * Template information
 */
export interface TemplateInfo {
  /** Template name */
  name: string;
  /** Template description */
  description?: string;
  /** Template file path */
  path: string;
  /** Required variables */
  variables: TemplateVariableInfo[];
  /** File patterns this template generates */
  outputs: string[];
  /** Template category/tags */
  tags?: string[];
  /** Creation timestamp */
  created?: Date;
  /** Last modified timestamp */
  modified?: Date;
}

/**
 * Template variable information
 */
export interface TemplateVariableInfo {
  /** Variable name */
  name: string;
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Variable description */
  description?: string;
  /** Default value */
  default?: any;
  /** Whether variable is required */
  required: boolean;
  /** Validation pattern or rules */
  validation?: string;
  /** Possible choices for the variable */
  choices?: any[];
}

/**
 * Project initialization options
 */
export interface ProjectInitOptions {
  /** Project type */
  type: ProjectType;
  /** Project name */
  name: string;
  /** Project description */
  description?: string;
  /** Destination directory */
  dest: string;
  /** Whether to initialize git repository */
  git: boolean;
  /** Whether to install dependencies */
  install: boolean;
  /** Additional template variables */
  variables?: Record<string, any>;
  /** Template source configuration */
  source?: {
    /** Source type */
    type: 'local' | 'git' | 'npm' | 'url';
    /** Source location */
    location: string;
    /** Version or branch */
    version?: string;
  };
}

/**
 * GitHub repository analysis result
 */
export interface GitHubAnalysisResult {
  /** Repository identifier */
  repository: string;
  /** Repository structure analysis */
  structure: {
    directories: string[];
    files: string[];
    languages: Record<string, number>;
    frameworks: string[];
  };
  /** Repository metrics */
  metrics?: {
    complexity: number;
    maintainability: number;
    testCoverage: number;
    documentation: number;
  };
  /** Generated insights */
  insights: string[];
  /** Recommendations for improvement */
  recommendations: string[];
}

/**
 * GitHub PR review result
 */
export interface GitHubPRReviewResult {
  /** PR number */
  prNumber: string;
  /** Review summary */
  summary: {
    linesChanged: number;
    filesModified: number;
    complexity: string;
  };
  /** Code quality analysis */
  codeQuality?: any;
  /** Security analysis */
  security?: any;
  /** Performance analysis */
  performance?: any;
  /** AI-generated suggestions */
  suggestions: any[];
  /** Overall PR score */
  overallScore: number;
}

/**
 * Error types for better error handling
 */
export enum CommandError {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  TEMPLATE_ERROR = 'TEMPLATE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Enhanced error class for commands
 */
export class UnjucksCommandError extends Error {
  constructor(
    message: string,
    public readonly code: CommandError,
    public readonly details?: any,
    public readonly suggestions?: string[]
  ) {
    super(message);
    this.name = 'UnjucksCommandError';
  }
}