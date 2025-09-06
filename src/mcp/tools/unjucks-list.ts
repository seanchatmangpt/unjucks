/**
 * Implementation of the unjucks_list MCP tool
 * Discovers and lists available generators and templates
 */

import { Generator } from '../../lib/generator.js';
import type { ToolResult, UnjucksListParams } from '../types.js';
import { createTextToolResult, createJSONToolResult, handleToolError, validateObjectSchema, logPerformance } from '../utils.js';
import { TOOL_SCHEMAS } from '../types.js';

/**
 * List available generators and templates using real unjucks functionality
 */
export async function unjucksList(params: UnjucksListParams): Promise<ToolResult> {
  const startTime = performance.now();
  
  try {
    // Validate input parameters
    const validation = validateObjectSchema(params, TOOL_SCHEMAS.unjucks_list);
    if (!validation.valid) {
      return createTextToolResult(`Invalid parameters: ${validation.errors.join(', ')}`, true);
    }

    const { generator, detailed = false } = params;

    // Initialize generator instance
    const gen = new Generator();
    
    // Get templates directory for context
    const templatesDir = gen.getTemplatesDirectory();

    if (generator) {
      // List templates for a specific generator
      try {
        const templates = await gen.listTemplates(generator);
        const generatorPath = `${templatesDir}/${generator}`;
        
        let result: any = {
          generator,
          templatesDir,
          generatorPath,
          templates: templates.map(template => ({
            name: template.name,
            description: template.description,
            ...(detailed && {
              files: template.files,
              fileCount: template.files.length
            })
          }))
        };

        if (detailed) {
          // Add detailed information including variable scanning
          const detailedTemplates = [];
          
          for (const template of templates) {
            try {
              const { variables } = await gen.scanTemplateForVariables(generator, template.name);
              detailedTemplates.push({
                name: template.name,
                description: template.description,
                files: template.files,
                fileCount: template.files.length,
                variables: variables.map(v => ({
                  name: v.name,
                  type: v.type,
                  description: v.description,
                  defaultValue: v.defaultValue,
                  required: v.required
                })),
                variableCount: variables.length
              });
            } catch (error) {
              // If scanning fails, just include basic info
              detailedTemplates.push({
                name: template.name,
                description: template.description,
                files: template.files,
                fileCount: template.files.length,
                variables: [],
                variableCount: 0,
                scanError: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
          
          result.templates = detailedTemplates;
        }

        // Performance logging
        const duration = performance.now() - startTime;
        logPerformance({
          operation: `list templates for ${generator}`,
          duration,
          filesProcessed: result.templates.length
        });

        return createJSONToolResult(result);
        
      } catch (error) {
        return handleToolError(error, 'unjucks_list', `listing templates for generator "${generator}"`);
      }
    } else {
      // List all available generators
      try {
        const generators = await gen.listGenerators();
        
        let result: any = {
          templatesDir,
          generators: generators.map(gen => ({
            name: gen.name,
            description: gen.description,
            templateCount: gen.templates.length,
            ...(detailed && {
              templates: gen.templates.map(template => ({
                name: template.name,
                description: template.description,
                files: template.files,
                fileCount: template.files.length
              }))
            })
          }))
        };

        if (detailed) {
          // Add detailed information for each generator
          const detailedGenerators = [];
          
          for (const generator of generators) {
            const generatorDetail: any = {
              name: generator.name,
              description: generator.description,
              templateCount: generator.templates.length,
              templates: []
            };

            for (const template of generator.templates) {
              try {
                const { variables } = await gen.scanTemplateForVariables(generator.name, template.name);
                generatorDetail.templates.push({
                  name: template.name,
                  description: template.description,
                  files: template.files,
                  fileCount: template.files.length,
                  variables: variables.map(v => ({
                    name: v.name,
                    type: v.type,
                    description: v.description,
                    defaultValue: v.defaultValue,
                    required: v.required
                  })),
                  variableCount: variables.length
                });
              } catch (error) {
                // If scanning fails, include basic info
                generatorDetail.templates.push({
                  name: template.name,
                  description: template.description,
                  files: template.files,
                  fileCount: template.files.length,
                  variables: [],
                  variableCount: 0,
                  scanError: error instanceof Error ? error.message : 'Unknown error'
                });
              }
            }
            
            detailedGenerators.push(generatorDetail);
          }
          
          result.generators = detailedGenerators;
        }

        // Add summary
        result.summary = {
          totalGenerators: generators.length,
          totalTemplates: generators.reduce((sum, gen) => sum + gen.templates.length, 0),
          templatesDirectory: templatesDir
        };

        // Performance logging
        const duration = performance.now() - startTime;
        logPerformance({
          operation: 'list all generators',
          duration,
          filesProcessed: result.summary.totalTemplates
        });

        return createJSONToolResult(result);
        
      } catch (error) {
        return handleToolError(error, 'unjucks_list', 'listing all generators');
      }
    }
    
  } catch (error) {
    return handleToolError(error, 'unjucks_list', 'general operation');
  }
}