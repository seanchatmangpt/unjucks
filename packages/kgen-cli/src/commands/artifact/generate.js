/**
 * Artifact Generate Command
 * 
 * Generate byte-for-byte identical artifacts from knowledge graphs.
 * Core deterministic compilation functionality for autonomous agents.
 */

import { defineCommand } from 'citty';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import path from 'path';
import { Parser } from 'n3';
import fs from 'fs-extra';

import { success, error, output } from '../../lib/output.js';
import { loadKgenConfig, validateTurtleFile, hashContent, createAttestation } from '../../lib/utils.js';
import { TemplateEngine } from '../../../../kgen-core/src/templating/template-engine.js';
import { SimpleKGenEngine } from '../../../../kgen-core/src/kgen/core/simple-engine.js';

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
      const templateDir = config.directories?.templates || resolve(process.cwd(), 'templates');
      
      // Initialize KGEN Engine for real artifact generation
      const engine = new SimpleKGenEngine({
        mode: 'production',
        templatesDir: templateDir,
        cacheDirectory: config.directories.cache,
        stateDirectory: config.directories.state,
        enableAuditTrail: true
      });
      
      await engine.initialize();
      
      try {
        // Load template variables
        let variables = config.generate.globalVars || {};
        if (args.variables) {
          if (existsSync(args.variables)) {
            const varContent = readFileSync(args.variables, 'utf8');
            variables = { ...variables, ...JSON.parse(varContent) };
          } else {
            variables = { ...variables, ...JSON.parse(args.variables) };
          }
        }

        // Ingest RDF knowledge graph
        const graphContent = readFileSync(args.graph, 'utf8');
        const knowledgeGraph = await engine.ingest([{
          type: 'rdf',
          content: graphContent,
          format: 'turtle'
        }], { user: 'kgen-cli' });

        // Find and process template files
        const templatePath = resolve(templateDir, args.template);
        if (!existsSync(templatePath)) {
          throw new Error(`Template not found: ${templatePath}`);
        }

        const templateFiles = await getTemplateFiles(templatePath);
        if (templateFiles.length === 0) {
          throw new Error(`No template files found in: ${templatePath}`);
        }

        // Convert template files to template definitions
        const templates = [];
        for (const templateFile of templateFiles) {
          const templateContent = readFileSync(templateFile, 'utf8');
          const basename = path.basename(templateFile);
          const templateId = basename.replace(/\.(njk|hbs|j2|ejs\.t)$/, '');
          
          templates.push({
            id: templateId,
            type: 'code',
            language: _inferLanguageFromExtension(basename),
            template: templateContent,
            outputPath: path.join(outputDir, templateId)
          });
        }

        // Generate artifacts using real KGEN engine
        const generatedArtifacts = await engine.generate(knowledgeGraph, templates, {
          user: 'kgen-cli',
          variables,
          project: config.project,
          dryRun: args.dryRun
        });

        // Write artifacts (unless dry run)
        const generatedFiles = [];
        if (!args.dryRun) {
          await fs.ensureDir(outputDir);
          
          for (const artifact of generatedArtifacts) {
            const outputPath = artifact.outputPath || path.join(outputDir, `${artifact.id}.${artifact.language}`);
            
            // Write main artifact
            await fs.writeFile(outputPath, artifact.content, 'utf8');
            
            // Generate attestation sidecar if enabled
            if (args.attest) {
              const attestation = engine.generateAttestation(
                artifact, 
                knowledgeGraph, 
                templates.find(t => t.id === artifact.templateId)
              );
              const attestPath = outputPath + '.attest.json';
              await fs.writeFile(attestPath, JSON.stringify(attestation, null, 2) + '\n', 'utf8');
            }
            
            generatedFiles.push({
              path: outputPath,
              size: artifact.size,
              hash: artifact.hash,
              templateId: artifact.templateId,
              attested: args.attest
            });
          }
        }

        const duration = Date.now() - startTime;
        
        const result = success({
          operation: 'generate',
          source: {
            graph: graphInfo.path,
            hash: knowledgeGraph.id,
            entities: knowledgeGraph.entities.length,
            triples: knowledgeGraph.triples.length
          },
          template: args.template,
          output: {
            directory: outputDir,
            filesGenerated: generatedFiles.length,
            files: generatedFiles
          },
          metrics: {
            durationMs: duration,
            entitiesProcessed: knowledgeGraph.entities.length,
            triplesProcessed: knowledgeGraph.triples.length,
            templatesRendered: generatedArtifacts.length,
            bytesGenerated: generatedFiles.reduce((sum, f) => sum + f.size, 0)
          },
          deterministic: true,
          reproducible: true,
          dryRun: args.dryRun || false
        });
        
        output(result, args.format);

      } finally {
        await engine.shutdown();
      }
      
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

/**
 * Infer programming language from template file extension
 */
function _inferLanguageFromExtension(filename) {
    const ext = path.extname(filename).toLowerCase();
    const langMap = {
      '.js': 'javascript',
      '.ts': 'typescript', 
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.scala': 'scala',
      '.kt': 'kotlin',
      '.swift': 'swift',
      '.sql': 'sql',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.json': 'json',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.md': 'markdown',
      '.txt': 'text'
    };
    
    return langMap[ext] || 'text';
}