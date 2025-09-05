import { UnjucksWorld } from '../world';
import { Given, When, Then } from '@cucumber/cucumber';
import { StepLibraryFactory } from './step-library-factory';

/**
 * Debug Utilities for Step Definitions
 * Comprehensive debugging and logging capabilities for step libraries
 * Provides introspection, performance monitoring, and troubleshooting tools
 */

// Debug mode activation
Given('debug mode is enabled', function (this: UnjucksWorld) {
  const factory = StepLibraryFactory.getInstance();
  factory.enableDebugging();
  this.context.debugMode = true;
});

Given('performance monitoring is enabled', function (this: UnjucksWorld) {
  const factory = StepLibraryFactory.getInstance();
  factory.enablePerformanceMonitoring();
  this.context.performanceMonitoring = true;
});

Given('verbose logging is enabled', function (this: UnjucksWorld) {
  this.context.verboseLogging = true;
});

// Context inspection
When('I inspect the test context', function (this: UnjucksWorld) {
  const contextSnapshot = {
    tempDirectory: this.context.tempDirectory,
    generators: Object.keys(this.context.generators || {}),
    templateVariables: Object.keys(this.context.templateVariables || {}),
    lastCommand: this.context.templateVariables?.lastCommand,
    existingFiles: Object.keys(this.context.existingFiles || {}),
    debugMode: this.context.debugMode,
    performanceMonitoring: this.context.performanceMonitoring
  };
  
  this.context.contextSnapshot = contextSnapshot;
  
  if (this.context.verboseLogging) {
    console.log('📊 Test Context Snapshot:', JSON.stringify(contextSnapshot, null, 2));
  }
});

When('I capture the current step execution state', function (this: UnjucksWorld) {
  const factory = StepLibraryFactory.getInstance();
  const debugLogs = factory.getDebugLogs();
  const performanceReport = factory.getPerformanceReport();
  
  this.context.stepExecutionState = {
    debugLogs: debugLogs.slice(-10), // Last 10 debug entries
    performanceSnapshot: performanceReport,
    timestamp: new Date().toISOString(),
    activeLibraries: factory.getAvailableLibraries()
  };
  
  if (this.context.verboseLogging) {
    console.log('🔍 Step Execution State:', JSON.stringify(this.context.stepExecutionState, null, 2));
  }
});

When('I generate a performance report', function (this: UnjucksWorld) {
  const factory = StepLibraryFactory.getInstance();
  const report = factory.getPerformanceReport();
  
  this.context.performanceReport = report;
  
  if (this.context.verboseLogging) {
    console.log('⚡ Performance Report:', JSON.stringify(report, null, 2));
  }
});

// File system state debugging
When('I debug the file system state', async function (this: UnjucksWorld) {
  const fileSystemState: any = {
    workingDirectory: process.cwd(),
    tempDirectory: this.context.tempDirectory,
    files: [],
    directories: []
  };
  
  if (this.context.tempDirectory) {
    try {
      const items = await this.helper.listFiles();
      for (const item of items) {
        const fullPath = `${this.context.tempDirectory}/${item}`;
        try {
          const stats = await this.helper.getFileStats(fullPath);
          if (stats.isFile) {
            fileSystemState.files.push({
              path: item,
              size: stats.size,
              modified: stats.mtime
            });
          } else if (stats.isDirectory) {
            fileSystemState.directories.push({
              path: item
            });
          }
        } catch (error) {
          // File might not exist or be inaccessible
        }
      }
    } catch (error) {
      fileSystemState.error = error;
    }
  }
  
  this.context.fileSystemState = fileSystemState;
  
  if (this.context.verboseLogging) {
    console.log('📁 File System State:', JSON.stringify(fileSystemState, null, 2));
  }
});

// Template debugging
When('I debug template rendering state', function (this: UnjucksWorld) {
  const templateState = {
    templateContent: this.context.templateContent?.substring(0, 200) + '...', // First 200 chars
    templateVariables: this.context.templateVariables,
    globalVariables: this.context.globalVariables,
    frontmatter: this.context.frontmatter,
    renderedOutput: this.context.renderedOutput?.substring(0, 200) + '...', // First 200 chars
    renderError: this.context.renderError?.message,
    nunjucksEnvConfigured: !!this.context.nunjucksEnv
  };
  
  this.context.templateDebugState = templateState;
  
  if (this.context.verboseLogging) {
    console.log('🎨 Template Rendering State:', JSON.stringify(templateState, null, 2));
  }
});

// Command execution debugging
When('I debug the last command execution', function (this: UnjucksWorld) {
  const lastResult = this.getLastCommandResult();
  const commandDebugState = {
    command: this.context.templateVariables?.lastCommand,
    exitCode: lastResult?.exitCode,
    stdout: lastResult?.stdout?.substring(0, 500) + '...', // First 500 chars
    stderr: lastResult?.stderr?.substring(0, 500) + '...', // First 500 chars
    duration: lastResult?.duration,
    timestamp: lastResult?.timestamp || new Date().toISOString()
  };
  
  this.context.commandDebugState = commandDebugState;
  
  if (this.context.verboseLogging) {
    console.log('⚡ Command Execution Debug:', JSON.stringify(commandDebugState, null, 2));
  }
});

// Generator state debugging
When('I debug generator configuration', function (this: UnjucksWorld) {
  const generatorState = {
    totalGenerators: Object.keys(this.context.generators || {}).length,
    generators: Object.entries(this.context.generators || {}).map(([name, config]) => ({
      name,
      path: (config as any).path,
      templates: (config as any).templates?.length || 0,
      hasHelp: !!(config as any).hasHelp,
      hasFrontmatter: !!(config as any).frontmatter,
      isValid: !!(config as any).valid
    })),
    templatesDirectory: this.context.templatesDirectory,
    invalidGenerators: this.context.invalidGenerators?.length || 0
  };
  
  this.context.generatorDebugState = generatorState;
  
  if (this.context.verboseLogging) {
    console.log('🛠️  Generator Configuration Debug:', JSON.stringify(generatorState, null, 2));
  }
});

// Injection debugging
When('I debug injection operations', function (this: UnjucksWorld) {
  const injectionState = {
    existingFiles: Object.keys(this.context.existingFiles || {}),
    skipIfConditions: this.context.skipIfConditions || [],
    skipIfMatched: this.context.skipIfMatched,
    skipIfLogic: this.context.skipIfLogic,
    injectionForced: this.context.injectionForced,
    targetFileExists: this.context.targetFileExists,
    customSkipIfFunction: !!this.context.customSkipIfFunction
  };
  
  this.context.injectionDebugState = injectionState;
  
  if (this.context.verboseLogging) {
    console.log('💉 Injection Operations Debug:', JSON.stringify(injectionState, null, 2));
  }
});

// Assertion debugging
Then('I should see debug information', function (this: UnjucksWorld) {
  const hasDebugInfo = !!(
    this.context.contextSnapshot ||
    this.context.stepExecutionState ||
    this.context.fileSystemState ||
    this.context.templateDebugState ||
    this.context.commandDebugState ||
    this.context.generatorDebugState ||
    this.context.injectionDebugState
  );
  
  if (!hasDebugInfo) {
    throw new Error('No debug information available. Ensure debugging steps were executed.');
  }
});

Then('the performance report should show execution metrics', function (this: UnjucksWorld) {
  const report = this.context.performanceReport;
  
  if (!report || report.message?.includes('not enabled')) {
    throw new Error('Performance monitoring is not enabled or no metrics available');
  }
  
  if (!report.summary || typeof report.summary.totalStepsExecuted === 'undefined') {
    throw new Error('Performance report should contain execution metrics');
  }
});

Then('the debug logs should contain step execution details', function (this: UnjucksWorld) {
  const state = this.context.stepExecutionState;
  
  if (!state || !state.debugLogs) {
    throw new Error('No step execution state available');
  }
  
  if (state.debugLogs.length === 0) {
    throw new Error('Debug logs should contain step execution details');
  }
});

Then('the file system debug should show current state', function (this: UnjucksWorld) {
  const fsState = this.context.fileSystemState;
  
  if (!fsState) {
    throw new Error('No file system debug state available');
  }
  
  if (!fsState.tempDirectory && !fsState.workingDirectory) {
    throw new Error('File system debug should show directory information');
  }
});

Then('the template debug should show rendering details', function (this: UnjucksWorld) {
  const templateState = this.context.templateDebugState;
  
  if (!templateState) {
    throw new Error('No template debug state available');
  }
});

Then('the command debug should show execution details', function (this: UnjucksWorld) {
  const commandState = this.context.commandDebugState;
  
  if (!commandState) {
    throw new Error('No command debug state available');
  }
  
  if (typeof commandState.exitCode === 'undefined') {
    throw new Error('Command debug should show execution details including exit code');
  }
});

Then('the generator debug should show configuration details', function (this: UnjucksWorld) {
  const generatorState = this.context.generatorDebugState;
  
  if (!generatorState) {
    throw new Error('No generator debug state available');
  }
  
  if (typeof generatorState.totalGenerators === 'undefined') {
    throw new Error('Generator debug should show configuration details');
  }
});

Then('the injection debug should show operation details', function (this: UnjucksWorld) {
  const injectionState = this.context.injectionDebugState;
  
  if (!injectionState) {
    throw new Error('No injection debug state available');
  }
});

// Memory and cleanup debugging
When('I debug memory usage', function (this: UnjucksWorld) {
  const memoryUsage = process.memoryUsage();
  const memoryState = {
    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
    timestamp: new Date().toISOString()
  };
  
  this.context.memoryState = memoryState;
  
  if (this.context.verboseLogging) {
    console.log('💾 Memory Usage:', JSON.stringify(memoryState, null, 2));
  }
});

When('I trigger garbage collection', function (this: UnjucksWorld) {
  // Force garbage collection if available (requires --expose-gc flag)
  if (global.gc) {
    global.gc();
    this.context.garbageCollectionTriggered = true;
  } else {
    this.context.garbageCollectionTriggered = false;
    console.warn('Garbage collection not available. Run with --expose-gc flag.');
  }
});

// Utility functions for debugging
export function logStepExecution(stepName: string, args: any[], context: any): void {
  console.log(`🔍 Executing step: ${stepName}`);
  console.log(`📋 Arguments:`, args);
  console.log(`🎯 Context keys:`, Object.keys(context));
}

export function logStepCompletion(stepName: string, duration: number, success: boolean, error?: any): void {
  const status = success ? '✅' : '❌';
  console.log(`${status} Step completed: ${stepName} (${duration}ms)`);
  if (error) {
    console.error(`❌ Error:`, error.message);
  }
}

export function dumpContextToFile(context: any, filename: string): void {
  const fs = require('fs');
  const contextDump = JSON.stringify(context, null, 2);
  fs.writeFileSync(filename, contextDump);
  console.log(`📄 Context dumped to: ${filename}`);
}

// Export debugging utilities
export const DebugUtilities = {
  logStepExecution,
  logStepCompletion,
  dumpContextToFile
};

export default DebugUtilities;