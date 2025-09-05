// Export the main CLI functionality
export { Generator } from "./lib/generator.js";
export type {
  TemplateFile,
  GeneratorConfig,
  TemplateConfig,
  PromptConfig,
  GenerateOptions,
  GenerateResult,
  InitOptions,
} from "./lib/generator.js";

// Export template scanner
export { TemplateScanner } from "./lib/template-scanner.js";
export type {
  TemplateVariable,
  TemplateScanResult,
} from "./lib/template-scanner.js";

// Export CLI commands
export { generateCommand } from "./commands/generate.js";
export { listCommand } from "./commands/list.js";
export { initCommand } from "./commands/init.js";
export { versionCommand } from "./commands/version.js";

// Export dynamic commands
export {
  createDynamicGenerateCommand,
  createTemplateHelpCommand,
} from "./lib/dynamic-commands.js";

// Export utility functions
export {
  promptForGenerator,
  promptForTemplate,
  promptForProjectType,
} from "./lib/prompts.js";
