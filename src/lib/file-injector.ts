// BACKWARD COMPATIBILITY LAYER
// This file maintains the original API while using the new atomic architecture
// For new code, import from './file-injector/index.js' directly

export * from './file-injector/index.js';
export type { FrontmatterConfig } from "./frontmatter-parser.js";