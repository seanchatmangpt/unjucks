/**
 * Content-Addressed Storage (CAS) system with BLAKE3 hashing
 *
 * This module provides a robust content-addressed storage system that:
 * - Uses BLAKE3 for fast, secure hashing
 * - Stores content in organized directory structure (.kgen/cache/<type>/<hash>/)
 * - Supports graphs, templates, artifacts, and packs
 * - Includes integrity verification and garbage collection
 * - Provides reference counting for content lifecycle management
 */

export { ContentAddressedStorage } from './storage.js';
export { ContentRetrieval } from './retrieval.js';
export { GarbageCollector } from './gc.js';

// Re-export main classes for convenience
export { default as CAS } from './storage.js';
export { default as Retrieval } from './retrieval.js';
export { default as GC } from './gc.js';