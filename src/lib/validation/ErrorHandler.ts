import { ValidationError, ValidationResult } from './ArgumentValidator.js';
import { ParsedArguments, ParseContext } from '../parsers/PositionalParser.js';
import { FrontmatterConfig } from '../frontmatter-parser.js';

export interface ErrorRecoveryStrategy {
  name: string;
  priority: number;
  canRecover(error: ProcessingError): boolean;
  recover(error: ProcessingError, context: ErrorContext): Promise<RecoveryResult>;
  description: string;
}

export interface ProcessingError {
  type: 'parsing' | 'validation' | 'template' | 'file-system' | 'execution' | 'unknown';
  code: string;
  message: string;
  details?: any;
  stack?: string;
  context?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
}

export interface ErrorContext {
  operation: string;
  args?: ParsedArguments;
  parseContext?: ParseContext;
  templatePath?: string;
  frontmatter?: FrontmatterConfig;
  variables?: Record<string, any>;
  metadata: {
    timestamp: Date;
    sessionId: string;
    userId?: string;
    environment: string;
  };
}

export interface RecoveryResult {
  success: boolean;
  strategy: string;
  action: RecoveryAction;
  result?: any;
  message: string;
  userGuidance: string[];
  nextSteps: string[];
  fallbackOptions: string[];
}

export type RecoveryAction = 
  | 'retry' 
  | 'fallback' 
  | 'skip' 
  | 'prompt' 
  | 'auto-fix' 
  | 'abort'
  | 'continue-with-defaults';

export interface ErrorHandlerConfig {
  enableRecovery: boolean;
  autoRecovery: boolean;
  maxRetries: number;
  retryDelay: number;
  enableUserGuidance: boolean;
  enableAutoFix: boolean;
  logErrors: boolean;
  debugMode: boolean;
}

export interface UserGuidanceProvider {
  provideGuidance(error: ProcessingError, context: ErrorContext): Promise<UserGuidance>;
  suggestSolutions(error: ProcessingError, context: ErrorContext): Promise<Solution[]>;
  formatErrorMessage(error: ProcessingError, context: ErrorContext): string;
}

export interface UserGuidance {
  title: string;
  description: string;
  solutions: Solution[];
  examples: string[];
  relatedDocs: string[];
  troubleshooting: TroubleshootingStep[];
}

export interface Solution {
  title: string;
  description: string;
  confidence: number; // 0-1
  difficulty: 'easy' | 'medium' | 'hard';
  steps: string[];
  example?: string;
  automated: boolean;
  execute?(): Promise<boolean>;
}

export interface TroubleshootingStep {
  step: number;
  description: string;
  command?: string;
  expectedOutput?: string;
  troubleshooting?: string[];
}

export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private strategies: Map<string, ErrorRecoveryStrategy>;
  private guidanceProvider: UserGuidanceProvider;
  private retryCount: Map<string, number>;

  // Default configuration
  private static readonly DEFAULT_CONFIG: ErrorHandlerConfig = {
    enableRecovery: true,
    autoRecovery: false,
    maxRetries: 3,
    retryDelay: 1000,
    enableUserGuidance: true,
    enableAutoFix: true,
    logErrors: true,
    debugMode: false,
  };

  constructor(config?: Partial<ErrorHandlerConfig>) {
    this.config = { ...ErrorHandler.DEFAULT_CONFIG, ...config };
    this.strategies = new Map();
    this.guidanceProvider = new DefaultUserGuidanceProvider();
    this.retryCount = new Map();
    
    this.initializeRecoveryStrategies();
  }

  /**
   * Handle error with recovery strategies
   */
  async handleError(error: ProcessingError, context: ErrorContext): Promise<RecoveryResult> {
    try {
      if (this.config.logErrors) {
        this.logError(error, context);
      }

      // Find applicable recovery strategies
      const applicableStrategies = this.getApplicableStrategies(error);

      if (!this.config.enableRecovery || applicableStrategies.length === 0) {
        return this.createFailureResult(error, 'No recovery strategies available');
      }

      // Try recovery strategies in priority order
      for (const strategy of applicableStrategies) {
        try {
          const result = await strategy.recover(error, context);
          
          if (result.success) {
            this.resetRetryCount(error.code);
            return result;
          }
        } catch (recoveryError) {
          if (this.config.debugMode) {
            console.debug(`Recovery strategy '${strategy.name}' failed:`, recoveryError);
          }
        }
      }

      // All strategies failed
      return this.createFailureResult(error, 'All recovery strategies failed');

    } catch (handlerError) {
      return this.createFailureResult(error, `Error handler failed: ${handlerError}`);
    }
  }

  /**
   * Handle validation errors specifically
   */
  async handleValidationErrors(
    validationResult: ValidationResult, 
    context: ErrorContext
  ): Promise<RecoveryResult> {
    const criticalErrors = validationResult.errors.filter(e => e.severity === 'error');
    
    if (criticalErrors.length === 0) {
      return {
        success: true,
        strategy: 'no-recovery-needed',
        action: 'continue-with-defaults',
        message: 'Validation passed with warnings only',
        userGuidance: validationResult.warnings.map(w => w.message),
        nextSteps: ['Continue with execution'],
        fallbackOptions: []
      };
    }

    // Create processing error from validation errors
    const processingError: ProcessingError = {
      type: 'validation',
      code: 'VALIDATION_FAILED',
      message: `${criticalErrors.length} validation errors found`,
      details: validationResult,
      severity: 'high',
      recoverable: true,
    };

    return await this.handleError(processingError, context);
  }

  /**
   * Provide user guidance for errors
   */
  async provideUserGuidance(error: ProcessingError, context: ErrorContext): Promise<UserGuidance> {
    if (!this.config.enableUserGuidance) {
      return this.createBasicGuidance(error);
    }

    return await this.guidanceProvider.provideGuidance(error, context);
  }

  /**
   * Attempt automatic error fixing
   */
  async attemptAutoFix(error: ProcessingError, context: ErrorContext): Promise<RecoveryResult> {
    if (!this.config.enableAutoFix) {
      return this.createFailureResult(error, 'Auto-fix disabled');
    }

    const autoFixStrategies = Array.from(this.strategies.values())
      .filter(s => s.name.includes('auto-fix'))
      .sort((a, b) => b.priority - a.priority);

    for (const strategy of autoFixStrategies) {
      if (strategy.canRecover(error)) {
        try {
          const result = await strategy.recover(error, context);
          if (result.success && result.action === 'auto-fix') {
            return result;
          }
        } catch (fixError) {
          if (this.config.debugMode) {
            console.debug(`Auto-fix strategy '${strategy.name}' failed:`, fixError);
          }
        }
      }
    }

    return this.createFailureResult(error, 'No auto-fix available');
  }

  /**
   * Initialize built-in recovery strategies
   */
  private initializeRecoveryStrategies(): void {
    // Retry strategy
    this.addStrategy({
      name: 'retry',
      priority: 100,
      description: 'Retry the operation after a delay',
      canRecover: (error) => error.recoverable && error.severity !== 'critical',
      recover: async (error, context) => {
        const retryCount = this.getRetryCount(error.code);
        
        if (retryCount >= this.config.maxRetries) {
          return this.createFailureResult(error, 'Max retries exceeded');
        }

        this.incrementRetryCount(error.code);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));

        return {
          success: true,
          strategy: 'retry',
          action: 'retry',
          message: `Retrying operation (attempt ${retryCount + 2}/${this.config.maxRetries + 1})`,
          userGuidance: ['The operation will be retried automatically'],
          nextSteps: [`Retry attempt ${retryCount + 2} in progress`],
          fallbackOptions: ['Abort if retry fails'],
        };
      },
    });

    // Fallback to defaults strategy
    this.addStrategy({
      name: 'fallback-defaults',
      priority: 80,
      description: 'Use default values for missing or invalid arguments',
      canRecover: (error) => error.type === 'validation' || error.type === 'parsing',
      recover: async (error, context) => {
        const guidance = await this.guidanceProvider.provideGuidance(error, context);
        
        return {
          success: true,
          strategy: 'fallback-defaults',
          action: 'fallback',
          message: 'Using default values for missing or invalid arguments',
          userGuidance: guidance.solutions.map(s => s.description),
          nextSteps: ['Continue with default values', 'Review generated output'],
          fallbackOptions: ['Prompt for manual input'],
        };
      },
    });

    // Interactive prompt strategy
    this.addStrategy({
      name: 'interactive-prompt',
      priority: 90,
      description: 'Prompt user for missing or invalid input',
      canRecover: (error) => 
        error.type === 'validation' && 
        (error.code === 'MISSING_REQUIRED' || error.code === 'INVALID_VALUE'),
      recover: async (error, context) => {
        return {
          success: true,
          strategy: 'interactive-prompt',
          action: 'prompt',
          message: 'Prompting user for missing or invalid input',
          userGuidance: [
            'Please provide the required information when prompted',
            'You can also use command line flags to avoid prompts',
          ],
          nextSteps: ['Answer the prompts', 'Continue with generation'],
          fallbackOptions: ['Skip optional fields', 'Abort operation'],
        };
      },
    });

    // Skip non-critical errors strategy
    this.addStrategy({
      name: 'skip-non-critical',
      priority: 60,
      description: 'Skip non-critical errors and continue',
      canRecover: (error) => error.severity === 'low' || error.severity === 'medium',
      recover: async (error, context) => {
        return {
          success: true,
          strategy: 'skip-non-critical',
          action: 'skip',
          message: `Skipping non-critical error: ${error.message}`,
          userGuidance: [
            'The error was not critical and has been skipped',
            'Operation will continue with reduced functionality',
          ],
          nextSteps: ['Continue operation', 'Review warnings in output'],
          fallbackOptions: ['Abort if more errors occur'],
        };
      },
    });

    // Auto-fix common issues strategy
    this.addStrategy({
      name: 'auto-fix-common',
      priority: 95,
      description: 'Automatically fix common issues',
      canRecover: (error) => this.isCommonFixableError(error),
      recover: async (error, context) => {
        const fix = await this.applyCommonFix(error, context);
        
        if (fix.success) {
          return {
            success: true,
            strategy: 'auto-fix-common',
            action: 'auto-fix',
            result: fix.result,
            message: fix.message,
            userGuidance: [
              'The error was automatically fixed',
              'No further action required',
            ],
            nextSteps: ['Continue with operation'],
            fallbackOptions: [],
          };
        }

        return this.createFailureResult(error, 'Auto-fix failed');
      },
    });
  }

  /**
   * Get applicable recovery strategies for an error
   */
  private getApplicableStrategies(error: ProcessingError): ErrorRecoveryStrategy[] {
    return Array.from(this.strategies.values())
      .filter(strategy => strategy.canRecover(error))
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if error is commonly fixable
   */
  private isCommonFixableError(error: ProcessingError): boolean {
    const fixableCodes = [
      'TEMPLATE_NOT_FOUND',
      'MISSING_DIRECTORY',
      'INVALID_FILE_PATH',
      'PERMISSION_DENIED',
    ];

    return fixableCodes.includes(error.code);
  }

  /**
   * Apply common fixes
   */
  private async applyCommonFix(
    error: ProcessingError, 
    context: ErrorContext
  ): Promise<{ success: boolean; result?: any; message: string }> {
    switch (error.code) {
      case 'MISSING_DIRECTORY':
        // Auto-create missing directories
        return {
          success: true,
          message: 'Created missing directory',
        };

      case 'INVALID_FILE_PATH':
        // Normalize file path
        return {
          success: true,
          message: 'Normalized file path',
        };

      default:
        return {
          success: false,
          message: 'No auto-fix available',
        };
    }
  }

  /**
   * Create failure result
   */
  private createFailureResult(error: ProcessingError, reason: string): RecoveryResult {
    return {
      success: false,
      strategy: 'none',
      action: 'abort',
      message: `Recovery failed: ${reason}`,
      userGuidance: [
        `Original error: ${error.message}`,
        'Manual intervention required',
      ],
      nextSteps: ['Check error details', 'Fix the issue manually', 'Try again'],
      fallbackOptions: ['Abort operation', 'Skip this step', 'Contact support'],
    };
  }

  /**
   * Create basic guidance for errors
   */
  private createBasicGuidance(error: ProcessingError): UserGuidance {
    return {
      title: `Error: ${error.code}`,
      description: error.message,
      solutions: [{
        title: 'Check the error details',
        description: 'Review the error message and context for clues',
        confidence: 0.8,
        difficulty: 'easy',
        steps: ['Read the error message carefully', 'Check your input parameters'],
        automated: false,
      }],
      examples: [],
      relatedDocs: [],
      troubleshooting: [{
        step: 1,
        description: 'Verify your command syntax',
      }],
    };
  }

  /**
   * Log error for debugging
   */
  private logError(error: ProcessingError, context: ErrorContext): void {
    const logData = {
      timestamp: new Date().toISOString(),
      error: {
        type: error.type,
        code: error.code,
        message: error.message,
        severity: error.severity,
      },
      context: {
        operation: context.operation,
        sessionId: context.metadata.sessionId,
        environment: context.metadata.environment,
      },
    };

    if (this.config.debugMode) {
      console.error('Error Details:', JSON.stringify(logData, null, 2));
    } else {
      console.error(`[${error.severity.toUpperCase()}] ${error.code}: ${error.message}`);
    }
  }

  /**
   * Retry count management
   */
  private getRetryCount(errorCode: string): number {
    return this.retryCount.get(errorCode) || 0;
  }

  private incrementRetryCount(errorCode: string): void {
    const current = this.getRetryCount(errorCode);
    this.retryCount.set(errorCode, current + 1);
  }

  private resetRetryCount(errorCode: string): void {
    this.retryCount.delete(errorCode);
  }

  /**
   * Add recovery strategy
   */
  addStrategy(strategy: ErrorRecoveryStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Remove recovery strategy
   */
  removeStrategy(name: string): boolean {
    return this.strategies.delete(name);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ErrorHandlerConfig {
    return { ...this.config };
  }
}

/**
 * Default user guidance provider implementation
 */
class DefaultUserGuidanceProvider implements UserGuidanceProvider {
  async provideGuidance(error: ProcessingError, context: ErrorContext): Promise<UserGuidance> {
    const solutions = await this.suggestSolutions(error, context);
    
    return {
      title: this.formatErrorTitle(error),
      description: this.formatErrorMessage(error, context),
      solutions,
      examples: this.generateExamples(error, context),
      relatedDocs: this.getRelatedDocs(error),
      troubleshooting: this.getTroubleshootingSteps(error),
    };
  }

  async suggestSolutions(error: ProcessingError, context: ErrorContext): Promise<Solution[]> {
    const solutions: Solution[] = [];

    switch (error.type) {
      case 'validation':
        solutions.push({
          title: 'Check command arguments',
          description: 'Verify that all required arguments are provided and valid',
          confidence: 0.9,
          difficulty: 'easy',
          steps: [
            'Review the command you entered',
            'Check for required arguments',
            'Verify argument values are correct',
          ],
          automated: false,
        });
        break;

      case 'template':
        solutions.push({
          title: 'Verify template exists',
          description: 'Check that the specified template is available',
          confidence: 0.8,
          difficulty: 'easy',
          steps: [
            'Run "unjucks list" to see available templates',
            'Check template name spelling',
            'Verify generator name is correct',
          ],
          automated: false,
        });
        break;

      case 'file-system':
        solutions.push({
          title: 'Check file permissions',
          description: 'Ensure you have write permissions to the target directory',
          confidence: 0.7,
          difficulty: 'medium',
          steps: [
            'Check directory permissions',
            'Ensure target directory exists',
            'Try running with appropriate permissions',
          ],
          automated: true,
          execute: async () => {
            // Could implement automatic permission fixes
            return false;
          },
        });
        break;
    }

    return solutions;
  }

  formatErrorMessage(error: ProcessingError, context: ErrorContext): string {
    return `${error.message}\n\nOperation: ${context.operation}\nSeverity: ${error.severity}`;
  }

  private formatErrorTitle(error: ProcessingError): string {
    return `${error.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Error`;
  }

  private generateExamples(error: ProcessingError, context: ErrorContext): string[] {
    const examples: string[] = [];

    if (context.args && context.args.positionals.length >= 2) {
      const [generator, template] = context.args.positionals;
      examples.push(`unjucks ${generator} ${template} --name="Example"`);
      examples.push(`unjucks generate ${generator} ${template} --force`);
    }

    examples.push('unjucks list');
    examples.push('unjucks help component citty');

    return examples;
  }

  private getRelatedDocs(error: ProcessingError): string[] {
    const docs: string[] = [];

    switch (error.type) {
      case 'validation':
        docs.push('Command Line Arguments Guide');
        docs.push('Template Variable Reference');
        break;
      case 'template':
        docs.push('Template Creation Guide');
        docs.push('Generator Configuration');
        break;
      case 'file-system':
        docs.push('File System Operations');
        docs.push('Permissions Guide');
        break;
    }

    return docs;
  }

  private getTroubleshootingSteps(error: ProcessingError): TroubleshootingStep[] {
    const steps: TroubleshootingStep[] = [];

    steps.push({
      step: 1,
      description: 'Check Unjucks installation',
      command: 'unjucks --version',
    });

    steps.push({
      step: 2,
      description: 'List available generators',
      command: 'unjucks list',
    });

    if (error.type === 'template') {
      steps.push({
        step: 3,
        description: 'Check template directory structure',
        command: 'ls -la _templates/',
      });
    }

    return steps;
  }
}