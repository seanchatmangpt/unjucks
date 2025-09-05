import { UnjucksWorld } from '../world';
import { createAdvancedCliSteps } from './advanced-cli-steps';
import { createTemplateEngineSteps } from './template-engine-steps';
import { createFileSystemSteps } from './filesystem-operations-steps';
import { createGeneratorDiscoverySteps } from './generator-discovery-steps';
import { createInjectionOperationSteps } from './injection-operations-steps';
import { createValidationAssertionSteps } from './validation-assertions-steps';

/**
 * Step Library Factory
 * Central factory for creating and managing step definition libraries
 * with context management, debugging capabilities, and performance monitoring
 */

export interface StepLibraryConfig {
  enableDebugging?: boolean;
  enablePerformanceMonitoring?: boolean;
  enableVerboseLogging?: boolean;
  customContext?: any;
  timeout?: number;
}

export interface StepLibraryRegistry {
  advancedCli: any;
  templateEngine: any;
  fileSystem: any;
  generatorDiscovery: any;
  injectionOperations: any;
  validationAssertions: any;
}

export class StepLibraryFactory {
  private static instance: StepLibraryFactory;
  private registry: StepLibraryRegistry;
  private config: StepLibraryConfig;
  private performanceMetrics: Map<string, any> = new Map();
  private debugLogs: any[] = [];

  private constructor(config: StepLibraryConfig = {}) {
    this.config = {
      enableDebugging: false,
      enablePerformanceMonitoring: false,
      enableVerboseLogging: false,
      timeout: 30000,
      ...config
    };

    this.registry = {
      advancedCli: null,
      templateEngine: null,
      fileSystem: null,
      generatorDiscovery: null,
      injectionOperations: null,
      validationAssertions: null
    };

    this.initializeLibraries();
  }

  public static getInstance(config?: StepLibraryConfig): StepLibraryFactory {
    if (!StepLibraryFactory.instance) {
      StepLibraryFactory.instance = new StepLibraryFactory(config);
    }
    return StepLibraryFactory.instance;
  }

  private initializeLibraries(): void {
    const startTime = Date.now();

    try {
      // Initialize all step libraries with factory pattern
      this.registry.advancedCli = createAdvancedCliSteps(this.config.customContext);
      this.registry.templateEngine = createTemplateEngineSteps(this.config.customContext);
      this.registry.fileSystem = createFileSystemSteps(this.config.customContext);
      this.registry.generatorDiscovery = createGeneratorDiscoverySteps(this.config.customContext);
      this.registry.injectionOperations = createInjectionOperationSteps(this.config.customContext);
      this.registry.validationAssertions = createValidationAssertionSteps(this.config.customContext);

      if (this.config.enablePerformanceMonitoring) {
        const initTime = Date.now() - startTime;
        this.performanceMetrics.set('initialization', {
          duration: initTime,
          timestamp: new Date().toISOString()
        });
      }

      if (this.config.enableDebugging) {
        this.log('Step libraries initialized successfully', 'info');
      }
    } catch (error) {
      this.log(`Failed to initialize step libraries: ${error}`, 'error');
      throw error;
    }
  }

  public getLibrary(name: keyof StepLibraryRegistry): any {
    if (!this.registry[name]) {
      throw new Error(`Step library "${name}" not found or not initialized`);
    }
    return this.registry[name];
  }

  public getAllLibraries(): StepLibraryRegistry {
    return { ...this.registry };
  }

  public getAvailableLibraries(): string[] {
    return Object.keys(this.registry);
  }

  // Enhanced step wrapper with debugging and performance monitoring
  public wrapStep(stepName: string, stepFunction: Function, libraryName: string): Function {
    return async function (this: UnjucksWorld, ...args: any[]) {
      const factory = StepLibraryFactory.getInstance();
      const startTime = Date.now();
      
      try {
        if (factory.config.enableDebugging) {
          factory.log(`Executing step: ${stepName} from ${libraryName}`, 'debug');
          factory.log(`Arguments: ${JSON.stringify(args)}`, 'debug');
        }

        // Set timeout if configured
        let timeoutId: NodeJS.Timeout | undefined;
        const timeoutPromise = factory.config.timeout ? new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Step "${stepName}" timed out after ${factory.config.timeout}ms`));
          }, factory.config.timeout);
        }) : null;

        // Execute the step function
        const stepPromise = stepFunction.apply(this, args);
        const result = timeoutPromise ? 
          await Promise.race([stepPromise, timeoutPromise]) : 
          await stepPromise;

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        const duration = Date.now() - startTime;

        if (factory.config.enablePerformanceMonitoring) {
          factory.recordStepPerformance(stepName, libraryName, duration, true);
        }

        if (factory.config.enableDebugging) {
          factory.log(`Step completed successfully in ${duration}ms`, 'debug');
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        if (factory.config.enablePerformanceMonitoring) {
          factory.recordStepPerformance(stepName, libraryName, duration, false, error);
        }

        if (factory.config.enableDebugging) {
          factory.log(`Step failed after ${duration}ms: ${error}`, 'error');
        }

        throw error;
      }
    };
  }

  private recordStepPerformance(stepName: string, libraryName: string, duration: number, success: boolean, error?: any): void {
    const key = `${libraryName}.${stepName}`;
    const existing = this.performanceMetrics.get(key) || {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalDuration: 0,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      errors: []
    };

    existing.totalExecutions++;
    existing.totalDuration += duration;
    existing.averageDuration = existing.totalDuration / existing.totalExecutions;
    existing.minDuration = Math.min(existing.minDuration, duration);
    existing.maxDuration = Math.max(existing.maxDuration, duration);

    if (success) {
      existing.successfulExecutions++;
    } else {
      existing.failedExecutions++;
      if (error) {
        existing.errors.push({
          message: error.message,
          timestamp: new Date().toISOString(),
          duration
        });
      }
    }

    this.performanceMetrics.set(key, existing);
  }

  public getPerformanceReport(): any {
    if (!this.config.enablePerformanceMonitoring) {
      return { message: 'Performance monitoring is not enabled' };
    }

    const report: any = {
      summary: {
        totalLibraries: Object.keys(this.registry).length,
        totalStepsExecuted: 0,
        totalSuccessfulSteps: 0,
        totalFailedSteps: 0,
        averageDuration: 0,
        reportGeneratedAt: new Date().toISOString()
      },
      libraryStats: {},
      topSlowSteps: [],
      topFailedSteps: []
    };

    const allMetrics = Array.from(this.performanceMetrics.entries());
    
    for (const [key, metrics] of allMetrics) {
      const [libraryName, stepName] = key.split('.');
      
      report.summary.totalStepsExecuted += metrics.totalExecutions;
      report.summary.totalSuccessfulSteps += metrics.successfulExecutions;
      report.summary.totalFailedSteps += metrics.failedExecutions;

      if (!report.libraryStats[libraryName]) {
        report.libraryStats[libraryName] = {
          totalSteps: 0,
          averageDuration: 0,
          successRate: 0,
          steps: {}
        };
      }

      report.libraryStats[libraryName].steps[stepName] = metrics;
      report.libraryStats[libraryName].totalSteps++;
    }

    // Calculate library averages and success rates
    for (const libraryName in report.libraryStats) {
      const library = report.libraryStats[libraryName];
      const steps = Object.values(library.steps) as any[];
      
      library.averageDuration = steps.reduce((sum: number, step: any) => sum + step.averageDuration, 0) / steps.length;
      library.successRate = steps.reduce((sum: number, step: any) => {
        return sum + (step.successfulExecutions / step.totalExecutions);
      }, 0) / steps.length;
    }

    // Top 10 slowest steps
    report.topSlowSteps = allMetrics
      .sort(([, a], [, b]) => b.averageDuration - a.averageDuration)
      .slice(0, 10)
      .map(([key, metrics]) => ({ step: key, averageDuration: metrics.averageDuration }));

    // Top 10 most failed steps
    report.topFailedSteps = allMetrics
      .sort(([, a], [, b]) => b.failedExecutions - a.failedExecutions)
      .slice(0, 10)
      .map(([key, metrics]) => ({ step: key, failedExecutions: metrics.failedExecutions }));

    return report;
  }

  public getDebugLogs(): any[] {
    return [...this.debugLogs];
  }

  public clearDebugLogs(): void {
    this.debugLogs = [];
  }

  public enableDebugging(): void {
    this.config.enableDebugging = true;
  }

  public disableDebugging(): void {
    this.config.enableDebugging = false;
  }

  public enablePerformanceMonitoring(): void {
    this.config.enablePerformanceMonitoring = true;
  }

  public disablePerformanceMonitoring(): void {
    this.config.enablePerformanceMonitoring = false;
  }

  private log(message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      source: 'StepLibraryFactory'
    };

    if (this.config.enableDebugging || this.config.enableVerboseLogging) {
      console.log(`[${logEntry.timestamp}] [${level.toUpperCase()}] ${message}`);
    }

    this.debugLogs.push(logEntry);
    
    // Keep only last 1000 log entries to prevent memory issues
    if (this.debugLogs.length > 1000) {
      this.debugLogs = this.debugLogs.slice(-1000);
    }
  }

  // Helper methods for step registration
  public registerCustomSteps(libraryName: string, steps: any): void {
    if (this.registry[libraryName as keyof StepLibraryRegistry]) {
      this.log(`Overriding existing library: ${libraryName}`, 'warn');
    }

    (this.registry as any)[libraryName] = steps;
    this.log(`Registered custom step library: ${libraryName}`, 'info');
  }

  public validateStepCoverage(featureFiles: string[]): any {
    // This would analyze feature files and check step coverage
    // Implementation would parse .feature files and match against available steps
    return {
      message: 'Step coverage validation not yet implemented',
      featureFiles: featureFiles.length,
      availableLibraries: this.getAvailableLibraries().length
    };
  }

  // Cleanup method
  public cleanup(): void {
    this.performanceMetrics.clear();
    this.debugLogs = [];
    this.log('StepLibraryFactory cleaned up', 'info');
  }
}

// Export convenience functions
export function createStepLibraries(config?: StepLibraryConfig): StepLibraryFactory {
  return StepLibraryFactory.getInstance(config);
}

export function getStepLibrary(name: keyof StepLibraryRegistry): any {
  return StepLibraryFactory.getInstance().getLibrary(name);
}

export function getAllStepLibraries(): StepLibraryRegistry {
  return StepLibraryFactory.getInstance().getAllLibraries();
}

export function getPerformanceReport(): any {
  return StepLibraryFactory.getInstance().getPerformanceReport();
}

export function enableStepDebugging(): void {
  StepLibraryFactory.getInstance().enableDebugging();
}

export function disableStepDebugging(): void {
  StepLibraryFactory.getInstance().disableDebugging();
}

// Default export for direct usage
export default StepLibraryFactory;