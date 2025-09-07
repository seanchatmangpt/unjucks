/**
 * Error Transformation Patterns - Common hostile exit patterns and their actionable replacements
 */

import { handleError, NetworkError, ConfigurationError, ValidationError, ErrorCategory, ActionableError } from './actionable-error.js';

export interface ErrorTransformation {
  pattern: RegExp;
  transform: (match: RegExpMatchArray, context: string) => string;
}

/**
 * Transform hostile process.exit calls into actionable error handling
 */
export function transformHostileExits(content: string, filePath: string): string {
  // Pattern 1: Workflow/MCP related failures
  content = content.replace(
    /(\s+)console\.error\(chalk\.red\("\\n❌ (.*?) failed:"\)\);\s*console\.error\(chalk\.red\(`\s+\${error instanceof Error \? error\.message : String\(error\)}`\)\);\s*process\.exit\(1\);/g,
    '$1console.error(chalk.red("\\n❌ $2 failed:"));\n$1console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));\n$1handleError(getContextualError(error, "$2"));'
  );

  // Pattern 2: Simple validation failures
  content = content.replace(
    /(\s+)console\.error\(chalk\.red\(`([^`]+)`\)\);\s*process\.exit\(1\);/g,
    '$1console.error(chalk.red(`$2`));\n$1handleError(new ValidationError(["$2"], "command validation"));'
  );

  // Pattern 3: Validation errors with forEach
  content = content.replace(
    /(\s+)validation\.errors\.forEach\(error => \{\s*console\.error\(chalk\.red\(`\s+• \${error}`\)\);\s*\}\);\s*process\.exit\(1\);/g,
    '$1validation.errors.forEach(error => {\n$1  console.error(chalk.red(`  • ${error}`));\n$1});\n$1handleError(new ValidationError(validation.errors, "workflow validation"));'
  );

  // Pattern 4: Monitor/follow mode failures
  content = content.replace(
    /(\s+)if \(!args\.follow\) \{\s*process\.exit\(1\);\s*\}/g,
    '$1if (!args.follow) {\n$1  handleError(new NetworkError("monitoring", undefined, error));\n$1}'
  );

  // Pattern 5: Generic monitoring failures
  content = content.replace(
    /(\s+)console\.error\(chalk\.red\(`❌ (.*?) failed: \${error instanceof Error \? error\.message : String\(error\)}`\)\);\s*process\.exit\(1\);/g,
    '$1console.error(chalk.red(`❌ $2 failed: ${error instanceof Error ? error.message : String(error)}`));\n$1handleError(getContextualError(error, "$2"));'
  );

  // Add helper function if not present
  if (!content.includes('getContextualError')) {
    const helperFunction = `

/**
 * Convert generic errors to contextual actionable errors
 */
function getContextualError(error: Error | unknown, context: string): ActionableError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('timeout')) {
    return new NetworkError(context);
  } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
    return new ValidationError([errorMessage], context);
  } else if (errorMessage.includes('config') || errorMessage.includes('setting')) {
    return new ConfigurationError(context, errorMessage);
  } else {
    return new ActionableError({
      message: \`\${context} failed: \${errorMessage}\`,
      solution: \`Check \${context} configuration and try again\`,
      category: ErrorCategory.RUNTIME_ERROR,
      examples: [
        'Verify MCP connection is active',
        'Check workflow configuration syntax',
        'Ensure required permissions are set'
      ]
    });
  }
}`;

    // Insert before the last export
    const lastExportIndex = content.lastIndexOf('export');
    if (lastExportIndex !== -1) {
      content = content.slice(0, lastExportIndex) + helperFunction + '\n\n' + content.slice(lastExportIndex);
    } else {
      content += helperFunction;
    }
  }

  return content;
}

/**
 * Transform simple process.exit patterns across command files
 */
export function transformSimpleExits(content: string): string {
  // Pattern: consola.error + process.exit(1)
  content = content.replace(
    /(\s+)consola\.error\(['"]([^'"]+)['"], error\);\s*process\.exit\(1\);/g,
    '$1consola.error(\'$2\', error);\n$1handleError(error instanceof Error ? error : new Error(String(error)));'
  );

  // Pattern: consola.error with string + process.exit(1)
  content = content.replace(
    /(\s+)consola\.error\(['"]([^'"]+)['"]\);\s*process\.exit\(1\);/g,
    '$1consola.error(\'$2\');\n$1handleError(new ActionableError({\n$1  message: \'$2\',\n$1  solution: \'Check the error details and fix the underlying issue\',\n$1  category: ErrorCategory.RUNTIME_ERROR\n$1}));'
  );

  // Pattern: Simple console.error + process.exit(1)
  content = content.replace(
    /(\s+)console\.error\(['"]([^'"]+)['"]\);\s*process\.exit\(1\);/g,
    '$1console.error(\'$2\');\n$1handleError(new ActionableError({\n$1  message: \'$2\',\n$1  solution: \'Check the error details and fix the underlying issue\',\n$1  category: ErrorCategory.RUNTIME_ERROR\n$1}));'
  );

  return content;
}

/**
 * Add required imports if they don't exist
 */
export function ensureImports(content: string): string {
  if (!content.includes('from "../lib/actionable-error.js"')) {
    // Find existing imports and add our imports
    const lastImportIndex = content.lastIndexOf('import');
    if (lastImportIndex !== -1) {
      const nextLineIndex = content.indexOf('\n', lastImportIndex);
      if (nextLineIndex !== -1) {
        const importStatement = `import { handleError, NetworkError, ConfigurationError, ValidationError, ErrorCategory, ActionableError } from "../lib/actionable-error.js";\nimport { ErrorRecovery } from "../lib/error-recovery.js";\n`;
        content = content.slice(0, nextLineIndex + 1) + importStatement + content.slice(nextLineIndex + 1);
      }
    }
  }

  return content;
}

/**
 * Main transformation function
 */
export function transformErrorHandling(content: string, filePath: string): string {
  content = ensureImports(content);
  content = transformHostileExits(content, filePath);
  content = transformSimpleExits(content);
  return content;
}