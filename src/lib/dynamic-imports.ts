// Dynamic import optimization for CLI startup performance
// Implements lazy loading to reduce cold start time

export interface ModuleLoader {
  loadTime: number;
  success: boolean;
}

// Lazy-loaded modules for better startup performance
let _inquirer: typeof import('inquirer') | null = null;
let _nunjucks: typeof import('nunjucks') | null = null;
let _fsExtra: typeof import('fs-extra') | null = null;
let _yaml: typeof import('yaml') | null = null;

export async function getInquirer() {
  if (!_inquirer) {
    const start = performance.now();
    _inquirer = await import('inquirer');
    console.log(`Inquirer loaded in ${(performance.now() - start).toFixed(1)}ms`);
  }
  return _inquirer;
}

export async function getNunjucks() {
  if (!_nunjucks) {
    const start = performance.now();
    _nunjucks = await import('nunjucks');
    console.log(`Nunjucks loaded in ${(performance.now() - start).toFixed(1)}ms`);
  }
  return _nunjucks;
}

export async function getFsExtra() {
  if (!_fsExtra) {
    const start = performance.now();
    _fsExtra = await import('fs-extra');
    console.log(`fs-extra loaded in ${(performance.now() - start).toFixed(1)}ms`);
  }
  return _fsExtra;
}

export async function getYaml() {
  if (!_yaml) {
    const start = performance.now();
    _yaml = await import('yaml');
    console.log(`YAML loaded in ${(performance.now() - start).toFixed(1)}ms`);
  }
  return _yaml;
}

// Preload critical modules for CLI operations
export async function loadCLIModules(): Promise<ModuleLoader[]> {
  const startTime = performance.now();
  const results: ModuleLoader[] = [];
  
  try {
    // Load only essential modules for CLI startup
    await Promise.all([
      getInquirer().then(() => ({ loadTime: performance.now() - startTime, success: true })),
      getFsExtra().then(() => ({ loadTime: performance.now() - startTime, success: true }))
    ]).then(moduleResults => {
      results.push(...moduleResults);
    });
    
    return results;
  } catch (error) {
    console.error('Module loading failed:', error);
    return results;
  }
}

// Smart module loading based on command
export async function loadModulesForCommand(command: string): Promise<void> {
  switch (command) {
    case 'generate':
      // Load template rendering modules
      await Promise.all([
        getNunjucks(),
        getFsExtra(),
        getYaml()
      ]);
      break;
      
    case 'list':
      // Only load file system module
      await getFsExtra();
      break;
      
    case 'help':
      // No additional modules needed
      break;
      
    default:
      // Load all modules for unknown commands
      await loadCLIModules();
  }
}