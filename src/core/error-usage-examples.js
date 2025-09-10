/**
 * Error Handling Usage Examples
 * Demonstrates how to use the comprehensive error handling system
 */

import { 
  ErrorHandler,
  CommandParseError,
  TemplateNotFoundError,
  MissingVariablesError,
  FileConflictError,
  CLIErrorIntegration,
  ErrorRecoveryUtils
} from './errors.js';

/**
 * Example 1: Command parsing with error recovery
 */
export async function exampleCommandParsing() {
  try {
    // Simulate command parsing
    throw new CommandParseError('generat', ['generate', 'list']);
  } catch (error) {
    // Handle with error system
    const result = await ErrorHandler.handle(error, { 
      interactive: true,
      exitOnError: false 
    });
    
    if (result.recovered) {
      console.log('User provided correction:', result.data);
    }
  }
}

/**
 * Example 2: Template discovery with suggestions
 */
export async function exampleTemplateDiscovery() {
  try {
    // Simulate template not found
    throw new TemplateNotFoundError(
      'react-comp',
      ['./templates', '~/.unjucks/templates'],
      ['react-component', 'vue-component', 'angular-component']
    );
  } catch (error) {
    await ErrorHandler.handle(error, { exitOnError: false });
  }
}

/**
 * Example 3: Interactive variable collection
 */
export async function exampleVariableCollection() {
  try {
    // Simulate missing variables
    throw new MissingVariablesError(['name', 'type'], './templates/component.md');
  } catch (error) {
    const result = await ErrorHandler.handle(error, { 
      interactive: true,
      exitOnError: false 
    });
    
    if (result.recovered) {
      console.log('Collected variables:', result.data);
      // Continue with generation using collected variables
    }
  }
}

/**
 * Example 4: File conflict resolution
 */
export async function exampleFileConflict() {
  try {
    // Simulate file conflict
    throw new FileConflictError('./src/Component.jsx', 'exists');
  } catch (error) {
    const result = await ErrorHandler.handle(error, { 
      interactive: true,
      exitOnError: false 
    });
    
    switch (result.action) {
      case 'backup':
        console.log('Creating backup and overwriting');
        break;
      case 'skip':
        console.log('Skipping file');
        break;
      case 'diff':
        console.log('Showing diff');
        break;
      default:
        console.log('Operation aborted');
    }
  }
}

/**
 * Example 5: CLI command wrapper with error handling
 */
export async function exampleCLIWrapper() {
  const result = await CLIErrorIntegration.wrapCommand(async () => {
    // Your command logic here
    throw new Error('Something went wrong');
  }, {
    command: 'generate',
    args: ['component', 'react'],
    nonInteractive: false
  });
  
  console.log('Command result:', result);
}

/**
 * Example 6: Retry with backoff
 */
export async function exampleRetryPattern() {
  const unstableOperation = async () => {
    if (Math.random() < 0.7) {
      throw new Error('Temporary network error');
    }
    return 'Success!';
  };
  
  try {
    const result = await ErrorRecoveryUtils.retryWithBackoff(
      unstableOperation,
      3, // max retries
      1000 // base delay
    );
    
    console.log('Operation succeeded:', result);
  } catch (error) {
    console.log('Operation failed after retries:', error.message);
  }
}

/**
 * Example 7: Graceful fallback
 */
export async function exampleGracefulFallback() {
  const primaryOperation = async () => {
    throw new Error('Primary service unavailable');
  };
  
  const fallbackOperation = async () => {
    return 'Fallback result';
  };
  
  const result = await ErrorRecoveryUtils.gracefulFallback(
    primaryOperation,
    fallbackOperation
  );
  
  console.log('Final result:', result);
}

/**
 * Example 8: Template operation with error handling
 */
export async function exampleTemplateOperation() {
  const { TemplateErrorIntegration } = await import('./error-integration.js');
  
  try {
    await TemplateErrorIntegration.wrapTemplateOperation(
      async () => {
        // Template processing logic
        throw new Error('ENOENT: template file not found');
      },
      './templates/missing.md',
      {
        searchPaths: ['./templates', '~/.unjucks'],
        availableTemplates: ['component.md', 'page.md']
      }
    );
  } catch (error) {
    console.log('Template error handled:', error.message);
  }
}

/**
 * Example 9: Complete generation workflow with error handling
 */
export async function exampleCompleteWorkflow() {
  console.log('🚀 Starting template generation with error handling...');
  
  try {
    // Step 1: Parse command
    await exampleCommandParsing();
    
    // Step 2: Find template
    await exampleTemplateDiscovery();
    
    // Step 3: Collect variables
    await exampleVariableCollection();
    
    // Step 4: Handle file conflicts
    await exampleFileConflict();
    
    // Step 5: Generate files with retry
    await exampleRetryPattern();
    
    console.log('✅ Generation completed successfully!');
    
  } catch (error) {
    console.log('❌ Generation failed:', error.message);
    await ErrorHandler.handle(error, { exitOnError: false });
  }
}

// Export all examples for testing
export const examples = {
  commandParsing: exampleCommandParsing,
  templateDiscovery: exampleTemplateDiscovery,
  variableCollection: exampleVariableCollection,
  fileConflict: exampleFileConflict,
  cliWrapper: exampleCLIWrapper,
  retryPattern: exampleRetryPattern,
  gracefulFallback: exampleGracefulFallback,
  templateOperation: exampleTemplateOperation,
  completeWorkflow: exampleCompleteWorkflow,
};

export default examples;