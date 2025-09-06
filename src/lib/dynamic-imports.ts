// Dynamic import optimization for CLI startup performance
// Implements lazy loading to reduce cold start time

export interface ModuleLoader {
  loadTime: number;
  success: boolean;
  module: string;
}

export interface PerformanceMetrics {
  startupTime: number;
  moduleLoadTime: number;
  cacheHitRate: number;
  totalCommands: number;
}

// Module cache to prevent re-imports
const moduleCache = new Map<string, any>();
const loadTimes = new Map<string, number>();
let totalLoadTime = 0;

// Lazy-loaded modules for better startup performance
let _inquirer: typeof import('inquirer') | null = null;
let _nunjucks: typeof import('nunjucks') | null = null;
let _fsExtra: typeof import('fs-extra') | null = null;
let _yaml: typeof import('yaml') | null = null;
let _ora: typeof import('ora') | null = null;
let _chalk: typeof import('chalk') | null = null;

export async function getInquirer() {
  if (!_inquirer) {
    const start = performance.now();
    _inquirer = moduleCache.get('inquirer') || await import('inquirer');
    const loadTime = performance.now() - start;
    loadTimes.set('inquirer', loadTime);
    totalLoadTime += loadTime;
    moduleCache.set('inquirer', _inquirer);
    if (process.env.DEBUG_UNJUCKS) {
      console.log(`Inquirer loaded in ${loadTime.toFixed(1)}ms`);
    }
  }
  return _inquirer;
}

export async function getNunjucks() {
  if (!_nunjucks) {
    const start = performance.now();
    _nunjucks = moduleCache.get('nunjucks') || await import('nunjucks');
    const loadTime = performance.now() - start;
    loadTimes.set('nunjucks', loadTime);
    totalLoadTime += loadTime;
    moduleCache.set('nunjucks', _nunjucks);
    if (process.env.DEBUG_UNJUCKS) {
      console.log(`Nunjucks loaded in ${loadTime.toFixed(1)}ms`);
    }
  }
  return _nunjucks;
}

export async function getFsExtra() {
  if (!_fsExtra) {
    const start = performance.now();
    _fsExtra = moduleCache.get('fs-extra') || await import('fs-extra');
    const loadTime = performance.now() - start;
    loadTimes.set('fs-extra', loadTime);
    totalLoadTime += loadTime;
    moduleCache.set('fs-extra', _fsExtra);
    if (process.env.DEBUG_UNJUCKS) {
      console.log(`fs-extra loaded in ${loadTime.toFixed(1)}ms`);
    }
  }
  return _fsExtra;
}

export async function getYaml() {
  if (!_yaml) {
    const start = performance.now();
    _yaml = moduleCache.get('yaml') || await import('yaml');
    const loadTime = performance.now() - start;
    loadTimes.set('yaml', loadTime);
    totalLoadTime += loadTime;
    moduleCache.set('yaml', _yaml);
    if (process.env.DEBUG_UNJUCKS) {
      console.log(`YAML loaded in ${loadTime.toFixed(1)}ms`);
    }
  }
  return _yaml;
}

export async function getOra() {
  if (!_ora) {
    const start = performance.now();
    _ora = moduleCache.get('ora') || await import('ora');
    const loadTime = performance.now() - start;
    loadTimes.set('ora', loadTime);
    totalLoadTime += loadTime;
    moduleCache.set('ora', _ora);
    if (process.env.DEBUG_UNJUCKS) {
      console.log(`Ora loaded in ${loadTime.toFixed(1)}ms`);
    }
  }
  return _ora;
}

export async function getChalk() {
  if (!_chalk) {
    const start = performance.now();
    _chalk = moduleCache.get('chalk') || await import('chalk');
    const loadTime = performance.now() - start;
    loadTimes.set('chalk', loadTime);
    totalLoadTime += loadTime;
    moduleCache.set('chalk', _chalk);
    if (process.env.DEBUG_UNJUCKS) {
      console.log(`Chalk loaded in ${loadTime.toFixed(1)}ms`);
    }
  }
  return _chalk;
}

// Preload critical modules for CLI operations
export async function loadCLIModules(): Promise<ModuleLoader[]> {
  const startTime = performance.now();
  const results: ModuleLoader[] = [];
  
  try {
    // Load only essential modules for CLI startup
    const moduleLoaders = [
      { name: 'chalk', loader: getChalk },
      { name: 'fs-extra', loader: getFsExtra }
    ];
    
    const loadPromises = moduleLoaders.map(async ({ name, loader }) => {
      const start = performance.now();
      try {
        await loader();
        return { 
          loadTime: performance.now() - start, 
          success: true, 
          module: name 
        };
      } catch (error) {
        return { 
          loadTime: performance.now() - start, 
          success: false, 
          module: name 
        };
      }
    });
    
    const moduleResults = await Promise.all(loadPromises);
    results.push(...moduleResults);
    
    return results;
  } catch (error) {
    if (process.env.DEBUG_UNJUCKS) {
      console.error('Module loading failed:', error);
    }
    return results;
  }
}

// Smart module loading based on command
export async function loadModulesForCommand(command: string): Promise<void> {
  const startTime = performance.now();
  
  switch (command) {
    case 'generate':
      // Load template rendering modules in parallel
      await Promise.all([
        getNunjucks(),
        getFsExtra(),
        getYaml(),
        getInquirer() // Pre-load for potential prompts
      ]);
      break;
      
    case 'list':
      // Only load file system module
      await Promise.all([
        getFsExtra(),
        getChalk() // For colored output
      ]);
      break;
      
    case 'help':
      // Load minimal modules
      await getChalk();
      break;
      
    case 'init':
      // Load modules needed for project initialization
      await Promise.all([
        getFsExtra(),
        getYaml(),
        getInquirer(),
        getChalk()
      ]);
      break;
      
    default:
      // Load all essential modules for unknown commands
      await loadCLIModules();
  }
  
  if (process.env.DEBUG_UNJUCKS) {
    const loadTime = performance.now() - startTime;
    console.log(`Command modules loaded in ${loadTime.toFixed(1)}ms for '${command}'`);
  }
}

// Get performance metrics
export function getPerformanceMetrics(): PerformanceMetrics {
  const cacheSize = moduleCache.size;
  const totalModules = loadTimes.size;
  
  return {
    startupTime: totalLoadTime,
    moduleLoadTime: totalLoadTime,
    cacheHitRate: cacheSize > 0 ? (cacheSize / Math.max(totalModules, 1)) * 100 : 0,
    totalCommands: totalModules
  };
}

// Clear module cache for testing
export function clearModuleCache(): void {
  moduleCache.clear();
  loadTimes.clear();
  totalLoadTime = 0;
  _inquirer = null;
  _nunjucks = null;
  _fsExtra = null;
  _yaml = null;
  _ora = null;
  _chalk = null;
}