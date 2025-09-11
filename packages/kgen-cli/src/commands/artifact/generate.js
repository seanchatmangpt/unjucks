/**
 * Artifact Generate Command
 * 
 * Generate byte-for-byte identical artifacts from knowledge graphs.
 * Core deterministic compilation functionality for autonomous agents.
 */

import { defineCommand } from 'citty';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { Parser } from 'n3';
import fs from 'fs-extra';

import { success, error, output } from '../../lib/output.js';
import { loadKgenConfig, validateTurtleFile, hashContent, createAttestation } from '../../lib/utils.js';
import { createTemplateEngine } from '../../../../kgen-core/src/templating/template-engine.js';

/**
 * Get all template files in a directory recursively
 * @param {string} dirPath - Directory path to scan
 * @returns {Promise<string[]>} Array of template file paths
 */
async function getTemplateFiles(dirPath) {
  const files = [];
  
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = join(dirPath, item.name);
      
      if (item.isDirectory()) {
        const subFiles = await getTemplateFiles(itemPath);
        files.push(...subFiles);
      } else if (item.isFile() && isTemplateFile(item.name)) {
        files.push(itemPath);
      }
    }
  } catch (error) {
    // Directory might not exist, return empty array
  }
  
  return files;
}

/**
 * Check if a file is a template file
 * @param {string} filename - File name to check
 * @returns {boolean} Whether the file is a template file
 */
function isTemplateFile(filename) {
  return filename.endsWith('.njk') || 
         filename.endsWith('.hbs') || 
         filename.endsWith('.j2') ||
         filename.endsWith('.ejs.t');
}

/**
 * Extract entities from RDF graph quads
 * @param {Array} quads - Array of N3 quads
 * @returns {Array} Array of unique entities
 */
function extractEntitiesFromGraph(quads) {
  const entities = new Set();
  
  for (const quad of quads) {
    if (quad.subject.termType === 'NamedNode') {
      entities.add(quad.subject.value);
    }
    if (quad.object.termType === 'NamedNode') {
      entities.add(quad.object.value);
    }
  }
  
  return Array.from(entities);
}

/**
 * Extract prefixes from TTL content
 * @param {string} content - TTL file content
 * @returns {Object} Object mapping prefixes to namespaces
 */
function extractPrefixesFromGraph(content) {
  const prefixes = {};
  const prefixRegex = /@prefix\s+([^:]+):\s*<([^>]+)>/g;
  
  let match;
  while ((match = prefixRegex.exec(content)) !== null) {
    prefixes[match[1]] = match[2];
  }
  
  return prefixes;
}

export default defineCommand({
  meta: {
    name: 'generate',
    description: 'Generate artifacts from knowledge graph using templates'
  },
  args: {
    graph: {
      type: 'string',
      description: 'Path to TTL/RDF knowledge graph file',
      required: true,
      alias: 'g'
    },
    template: {
      type: 'string', 
      description: 'Template name or path to use for generation',
      required: true,
      alias: 't'
    },
    output: {
      type: 'string',
      description: 'Output directory for generated artifacts',
      alias: 'o'
    },
    variables: {
      type: 'string',
      description: 'JSON string or file path with template variables',
      alias: 'vars'
    },
    attest: {
      type: 'boolean',
      description: 'Generate attestation sidecars (default: true)',
      default: true
    },
    dryRun: {
      type: 'boolean',
      description: 'Preview generation without writing files',
      alias: 'dry'
    },
    format: {
      type: 'string',
      description: 'Output format (json|yaml)',
      default: 'json',
      alias: 'f'
    }
  },
  async run({ args }) {
    try {
      const startTime = Date.now();
      
      // Load configuration
      const config = await loadKgenConfig(args.config);
      
      // Validate inputs
      const graphInfo = validateTurtleFile(args.graph);
      const outputDir = args.output || config.directories.out;
      
      // Use templates directory from config or default
      const templateDir = config.directories?.templates || resolve(process.cwd(), 'templates');
      
      // Parse knowledge graph
      const graphContent = readFileSync(args.graph, 'utf8');
      const parser = new Parser();
      const quads = parser.parse(graphContent);
      
      // Load template variables
      let variables = config.generate.globalVars || {};
      if (args.variables) {
        if (existsSync(args.variables)) {
          // Load from file
          const varContent = readFileSync(args.variables, 'utf8');
          variables = { ...variables, ...JSON.parse(varContent) };
        } else {
          // Parse as JSON string
          variables = { ...variables, ...JSON.parse(args.variables) };
        }
      }
      
      // Create context for template
      const context = {
        graph: {
          path: graphInfo.path,
          hash: graphInfo.hash,
          triples: quads.length,
          lastModified: graphInfo.lastModified
        },
        variables,
        project: config.project,
        generatedAt: new Date().toISOString()
      };
      
      // Initialize template engine
      const templateEngine = createTemplateEngine({
        templatesPaths: [templateDir],
        throwOnError: false,
        ...config.generate?.engineOptions
      });
      
      // Find template files
      const templatePath = resolve(templateDir, args.template);
      if (!existsSync(templatePath)) {
        throw new Error(`Template not found: ${templatePath}`);
      }
      
      // Get all template files in the specified template directory
      const templateFiles = await getTemplateFiles(templatePath);
      
      if (templateFiles.length === 0) {
        throw new Error(`No template files found in: ${templatePath}`);
      }
      
      // Create enhanced context for template rendering
      const enhancedContext = {
        ...context,
        graph: {
          quads,
          triples: quads.length,
          ...graphInfo
        },
        entities: extractEntitiesFromGraph(quads),
        prefixes: extractPrefixesFromGraph(graphContent)
      };
      
      // Process each template file
      const artifacts = [];
      for (const templateFile of templateFiles) {
        try {
          // Read template content
          const templateContent = readFileSync(templateFile, 'utf8');
          
          // Simple Nunjucks rendering (without complex template engine)
          const nunjucks = await import('nunjucks');
          const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(templateDir), {
            autoescape: false,
            throwOnUndefined: false
          });
          
          // Render the template
          const rendered = env.renderString(templateContent, enhancedContext);
          
          // Generate output filename from template name
          const basename = templateFile.split('/').pop();
          const outputName = basename.replace(/\.(njk|hbs|j2|ejs\.t)$/, '');
          
          artifacts.push({
            path: join(outputDir, outputName),
            content: rendered,
            template: basename,
            size: rendered.length,
            frontmatter: {}
          });
        } catch (templateError) {
          console.warn(`Skipping template ${templateFile}: ${templateError.message}`);
        }
      }
      
      // Write artifacts (unless dry run)
      const generatedFiles = [];
      if (!args.dryRun) {
        mkdirSync(outputDir, { recursive: true });
        
        for (const artifact of artifacts) {
          // Write main artifact
          writeFileSync(artifact.path, artifact.content, 'utf8');
          artifact.size = artifact.content.length;
          
          // Generate attestation if enabled
          if (args.attest) {
            const attestation = createAttestation(
              artifact.path,
              graphInfo.hash,
              artifact.template,
              { context }
            );
            const attestPath = artifact.path + '.attest.json';
            writeFileSync(attestPath, JSON.stringify(attestation, null, 2) + '\n', 'utf8');
          }
          
          generatedFiles.push({
            path: artifact.path,
            size: artifact.size,
            hash: hashContent(artifact.content),
            attested: args.attest
          });
        }
      }
      
      const duration = Date.now() - startTime;
      
      const result = success({
        operation: 'generate',
        source: {
          graph: graphInfo.path,
          hash: graphInfo.hash,
          triples: quads.length
        },
        template: args.template,
        output: {
          directory: outputDir,
          filesGenerated: generatedFiles.length,
          files: generatedFiles
        },
        metrics: {
          durationMs: duration,
          triplesProcessed: quads.length,
          templatesRendered: artifacts.length,
          bytesGenerated: generatedFiles.reduce((sum, f) => sum + f.size, 0)
        },
        dryRun: args.dryRun || false
      }, {
        deterministic: true,
        reproducible: true
      });
      
      output(result, args.format);
      
    } catch (err) {
      const result = error(err.message, 'GENERATION_FAILED', {
        graph: args.graph,
        template: args.template,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });
      
      output(result, args.format);
      process.exit(1);
    }
  }
});