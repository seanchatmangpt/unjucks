/**
 * Filter Pipeline - Stub for build
 * Full implementation exists elsewhere, this is minimal stub for building
 */

export function createFilterPipeline(options = {}) {
  return {
    filters: new Map(),
    apply: (value, filterName, ...args) => value
  };
}

export function registerFiltersWithNunjucks(env, pipeline) {
  // Stub - no-op for basic build
  return env;
}

export default { createFilterPipeline, registerFiltersWithNunjucks };
