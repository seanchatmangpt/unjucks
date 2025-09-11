/**
 * Project Lock Command
 * 
 * Generate deterministic lockfile for reproducible builds.
 * Essential for ensuring identical artifacts across deployments.
 */

import { defineCommand } from 'citty';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { createHash } from 'crypto';

import { success, error, output } from '../../lib/output.js';
import { loadKgenConfig, validateTurtleFile, findFiles, hashFile } from '../../lib/utils.js';

export default defineCommand({
  meta: {
    name: 'lock',
    description: 'Generate deterministic lockfile for reproducible builds'
  },
  args: {
    graph: {
      type: 'string',
      description: 'Path to primary TTL/RDF knowledge graph',
      required: true,
      alias: 'g'
    },
    output: {
      type: 'string',
      description: 'Output path for lockfile',
      default: './kgen.lock.json',
      alias: 'o'
    },
    includeTemplates: {
      type: 'boolean',
      description: 'Include template hashes in lockfile',
      default: true
    },
    includeRules: {
      type: 'boolean', 
      description: 'Include rule pack hashes in lockfile',
      default: true
    },
    includeArtifacts: {
      type: 'boolean',
      description: 'Include existing artifact hashes',
      default: false
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
      
      // Validate primary graph
      const graphInfo = validateTurtleFile(args.graph);
      
      // Build lockfile data
      const lockData = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        project: {
          name: config.project.name,
          version: config.project.version
        },
        source: {
          graph: {
            path: graphInfo.path,
            hash: graphInfo.hash,
            size: graphInfo.size,
            lastModified: graphInfo.lastModified
          }
        },
        dependencies: {},
        templates: {},
        rules: {},
        artifacts: {},
        integrity: {}
      };
      
      // Include template dependencies
      if (args.includeTemplates) {
        const templatesDir = config.directories.templates;
        if (existsSync(templatesDir)) {
          const templateFiles = findFiles(['**/*.njk', '**/*.j2'], {
            cwd: templatesDir,
            absolute: true
          });
          
          for (const templatePath of templateFiles) {
            const relativePath = templatePath.replace(templatesDir + '/', '');
            lockData.templates[relativePath] = {
              path: templatePath,
              hash: hashFile(templatePath),
              size: statSync(templatePath).size
            };
          }
        }
      }
      
      // Include rule pack dependencies
      if (args.includeRules) {
        const rulesDir = config.directories.rules;
        if (existsSync(rulesDir)) {
          const ruleFiles = findFiles(['**/*.n3', '**/*.rules'], {
            cwd: rulesDir,
            absolute: true
          });
          
          for (const rulePath of ruleFiles) {
            const relativePath = rulePath.replace(rulesDir + '/', '');
            lockData.rules[relativePath] = {
              path: rulePath,
              hash: hashFile(rulePath),
              size: statSync(rulePath).size
            };
          }
        }
      }
      
      // Include existing artifact hashes
      if (args.includeArtifacts) {
        const outDir = config.directories.out;
        if (existsSync(outDir)) {
          const artifactFiles = findFiles(['**/*', '!**/*.attest.json'], {
            cwd: outDir,
            absolute: true
          });
          
          for (const artifactPath of artifactFiles) {
            const relativePath = artifactPath.replace(outDir + '/', '');
            lockData.artifacts[relativePath] = {
              path: artifactPath,
              hash: hashFile(artifactPath),
              size: statSync(artifactPath).size,
              lastModified: statSync(artifactPath).mtime.toISOString()
            };
          }
        }
      }
      
      // Calculate integrity hashes
      const combinedHashes = [
        graphInfo.hash,
        ...Object.values(lockData.templates).map(t => t.hash),
        ...Object.values(lockData.rules).map(r => r.hash)
      ].join('');
      
      lockData.integrity = {
        combined: createHash('sha256').update(combinedHashes).digest('hex'),
        components: {
          graph: graphInfo.hash,
          templates: Object.keys(lockData.templates).length,
          rules: Object.keys(lockData.rules).length,
          artifacts: Object.keys(lockData.artifacts).length
        }
      };
      
      // Write lockfile
      const outputPath = resolve(args.output);
      mkdirSync(dirname(outputPath), { recursive: true });
      
      const lockContent = JSON.stringify(lockData, null, 2);
      writeFileSync(outputPath, lockContent + '\n', 'utf8');
      
      const duration = Date.now() - startTime;
      
      const result = success({
        lockfile: {
          path: outputPath,
          hash: createHash('sha256').update(lockContent).digest('hex'),
          size: lockContent.length
        },
        components: {
          graph: lockData.source.graph,
          templates: Object.keys(lockData.templates).length,
          rules: Object.keys(lockData.rules).length,
          artifacts: Object.keys(lockData.artifacts).length
        },
        integrity: lockData.integrity,
        metrics: {
          durationMs: duration,
          filesAnalyzed: Object.keys(lockData.templates).length + Object.keys(lockData.rules).length + Object.keys(lockData.artifacts).length + 1
        }
      }, {
        deterministic: true,
        reproducible: true
      });
      
      output(result, args.format);
      
    } catch (err) {
      const result = error(err.message, 'LOCK_FAILED', {
        graph: args.graph,
        output: args.output,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });
      
      output(result, args.format);
      process.exit(1);
    }
  }
});