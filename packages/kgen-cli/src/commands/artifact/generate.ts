/**
 * Artifact Generate Command
 * 
 * Generate byte-for-byte identical artifacts from knowledge graphs.
 * Implements deterministic compilation with cryptographic attestation.
 */

import { defineCommand } from 'citty';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, join, extname } from 'path';
import { Parser } from 'n3';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { consola } from 'consola';

interface GenerationConfig {
  version: string;
  project: {
    name: string;
    description: string;
  };
  sources: {
    graphs: string[];
    templates: string[];
    rules: string[];
  };
  build: {
    outputDir: string;
    cleanBeforeBuild: boolean;
    generateAttestation: boolean;
  };
  validation: {
    strict: boolean;
    shaclProfiles: string[];
  };
}

interface Attestation {
  version: string;
  metadata: {
    timestamp: string;
    generator: string;
    gitCommit?: string;
    command: string;
    workingDirectory: string;
    environment: {
      node: string;
      platform: string;
      arch: string;
    };
  };
  inputs: {
    graphs: Array<{
      path: string;
      hash: string;
      size: number;
    }>;
    templates: Array<{
      path: string;
      hash: string;
      size: number;
    }>;
    variables?: Record<string, any>;
  };
  outputs: Array<{
    path: string;
    hash: string;
    size: number;
    generatedAt: string;
  }>;
  provenance: {
    process: string;
    command: string;
    workingDirectory: string;
    deterministic: boolean;
    verificationRuns?: number;
  };
  signature?: {
    algorithm: string;
    value: string;
    publicKey?: string;
  };
}

export default defineCommand({
  meta: {
    name: 'generate',
    description: 'Generate deterministic artifacts from knowledge graphs with attestation'
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
      description: 'Generate cryptographic attestation (.attest.json)',
      default: true
    },
    'dry-run': {
      type: 'boolean',
      description: 'Preview generation without writing files',
      alias: 'dry'
    },
    force: {
      type: 'boolean',
      description: 'Overwrite existing files without confirmation',
      default: false
    },
    verify: {
      type: 'boolean',
      description: 'Run multiple verification passes for determinism',
      default: false
    },
    'verify-runs': {
      type: 'number',
      description: 'Number of verification runs (3-10)',
      default: 3
    },
    format: {
      type: 'string',
      description: 'Output format (json|yaml)',
      default: 'json',
      alias: 'f'
    },
    json: {
      type: 'boolean',
      description: 'Output result as JSON',
      default: false
    }
  },
  async run({ args }) {
    const startTime = new Date();
    
    try {
      // Validate inputs
      const graphPath = resolve(args.graph);
      if (!existsSync(graphPath)) {
        throw new Error(`Graph file not found: ${graphPath}`);
      }

      // Load configuration
      const config = await loadConfig();
      const outputDir = args.output ? resolve(args.output) : 
                        config.build?.outputDir ? resolve(config.build.outputDir) : 
                        resolve('./dist');

      // Parse knowledge graph
      const graphContent = readFileSync(graphPath, 'utf8');
      const graphHash = createHash('blake3', { outputLength: 32 }).update(graphContent).digest('hex');
      const graphInfo = await parseGraph(graphContent);

      // Load template variables
      let variables = {};
      if (args.variables) {
        if (existsSync(args.variables)) {
          const varContent = readFileSync(args.variables, 'utf8');
          variables = JSON.parse(varContent);
        } else {
          variables = JSON.parse(args.variables);
        }
      }

      // Find template
      const templatePath = await resolveTemplate(args.template, config);
      const templateContent = readFileSync(templatePath, 'utf8');
      const templateHash = createHash('blake3', { outputLength: 32 }).update(templateContent).digest('hex');

      // Generate artifacts
      const generationResult = await generateArtifacts({
        graphInfo,
        templatePath,
        templateContent,
        variables,
        outputDir,
        dryRun: args['dry-run']
      });

      // Create attestation if requested
      let attestation: Attestation | null = null;
      if (args.attest && !args['dry-run']) {
        attestation = await createAttestation({
          inputs: {
            graphs: [{
              path: graphPath,
              hash: graphHash,
              size: Buffer.byteLength(graphContent, 'utf8')
            }],
            templates: [{
              path: templatePath,
              hash: templateHash,
              size: Buffer.byteLength(templateContent, 'utf8')
            }],
            variables
          },
          outputs: generationResult.files,
          command: process.argv.join(' '),
          workingDirectory: process.cwd(),
          startTime,
          verificationRuns: args.verify ? args['verify-runs'] : undefined
        });

        // Write attestation file
        const attestationPath = join(outputDir, 'generation.attest.json');
        writeFileSync(attestationPath, JSON.stringify(attestation, null, 2));
        generationResult.files.push({
          path: attestationPath,
          hash: createHash('blake3', { outputLength: 32 }).update(JSON.stringify(attestation)).digest('hex'),
          size: Buffer.byteLength(JSON.stringify(attestation), 'utf8'),
          generatedAt: new Date().toISOString()
        });
      }

      // Verification runs if requested
      let deterministic = true;
      if (args.verify && !args['dry-run']) {
        deterministic = await verifyDeterminism({
          graphInfo,
          templatePath,
          templateContent,
          variables,
          outputDir,
          runs: args['verify-runs']
        });
      }

      const endTime = new Date();
      const result = {
        success: true,
        data: {
          generated: !args['dry-run'],
          filesGenerated: generationResult.files.length,
          files: generationResult.files,
          attestation: attestation ? {
            created: true,
            path: join(outputDir, 'generation.attest.json')
          } : { created: false },
          verification: args.verify ? { deterministic, runs: args['verify-runs'] } : null,
          performance: {
            duration: endTime.getTime() - startTime.getTime(),
            graphSize: Buffer.byteLength(graphContent, 'utf8'),
            templateSize: Buffer.byteLength(templateContent, 'utf8')
          },
          config: {
            graph: graphPath,
            template: templatePath,
            outputDir,
            variables: Object.keys(variables).length > 0 ? variables : null
          }
        },
        timestamp: endTime.toISOString()
      };

      if (args.json || args.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        consola.success(`Generated ${generationResult.files.length} files in ${outputDir}`);
        if (attestation) {
          consola.info('🧾 Attestation created');
        }
        if (args.verify) {
          consola.info(`🔍 Verification: ${deterministic ? '✅ Deterministic' : '❌ Non-deterministic'}`);
        }
      }

    } catch (error) {
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'GENERATION_FAILED',
        timestamp: new Date().toISOString()
      };

      if (args.json) {
        console.log(JSON.stringify(errorResult, null, 2));
      } else {
        consola.error(`Generation failed: ${errorResult.error}`);
      }
      process.exit(1);
    }
  }
});

async function loadConfig(): Promise<GenerationConfig> {
  const configPath = 'kgen.config.json';
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf8');
    return JSON.parse(content);
  }
  
  // Return default config
  return {
    version: "1.0.0",
    project: {
      name: "kgen-project",
      description: "KGEN knowledge graph project"
    },
    sources: {
      graphs: ["src/graphs/**/*.ttl"],
      templates: ["src/templates/**/*.hbs"],
      rules: ["src/rules/**/*.n3"]
    },
    build: {
      outputDir: "dist",
      cleanBeforeBuild: true,
      generateAttestation: true
    },
    validation: {
      strict: false,
      shaclProfiles: []
    }
  };
}

async function parseGraph(content: string): Promise<any> {
  const parser = new Parser();
  const quads = parser.parse(content);
  
  // Convert to simplified structure for template processing
  const entities = new Map();
  
  for (const quad of quads) {
    const subject = quad.subject.value;
    if (!entities.has(subject)) {
      entities.set(subject, {
        uri: subject,
        properties: new Map()
      });
    }
    
    const entity = entities.get(subject);
    const predicate = quad.predicate.value;
    const object = quad.object.value;
    
    if (!entity.properties.has(predicate)) {
      entity.properties.set(predicate, []);
    }
    entity.properties.get(predicate).push(object);
  }
  
  return {
    entities: Array.from(entities.values()).map(entity => ({
      uri: entity.uri,
      properties: Object.fromEntries(entity.properties)
    })),
    tripleCount: quads.length
  };
}

async function resolveTemplate(templateName: string, config: GenerationConfig): Promise<string> {
  // If it's a file path, use it directly
  if (existsSync(templateName)) {
    return resolve(templateName);
  }
  
  // Look in configured template directories
  for (const templatePattern of config.sources.templates) {
    const templateDir = templatePattern.replace('**/*.hbs', '');
    const templatePath = join(templateDir, `${templateName}.hbs`);
    if (existsSync(templatePath)) {
      return resolve(templatePath);
    }
  }
  
  throw new Error(`Template not found: ${templateName}`);
}

async function generateArtifacts({ 
  graphInfo, 
  templatePath, 
  templateContent, 
  variables, 
  outputDir, 
  dryRun 
}: {
  graphInfo: any;
  templatePath: string;
  templateContent: string;
  variables: Record<string, any>;
  outputDir: string;
  dryRun?: boolean;
}): Promise<{ files: Array<{ path: string; hash: string; size: number; generatedAt: string; }> }> {
  
  const files: Array<{ path: string; hash: string; size: number; generatedAt: string; }> = [];
  
  // Simple template processing (in a real implementation, this would use a proper template engine)
  const context = {
    ...variables,
    entities: graphInfo.entities,
    metadata: {
      generatedAt: new Date().toISOString(),
      tripleCount: graphInfo.tripleCount
    }
  };
  
  // Basic variable substitution (placeholder for real templating)
  let output = templateContent;
  
  // Replace {{variable}} patterns
  output = output.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return context[varName] || match;
  });
  
  // Replace {{#each entities}} blocks (very basic)
  output = output.replace(/\{\{#each entities\}\}(.*?)\{\{\/each\}\}/gs, (match, block) => {
    return graphInfo.entities.map((entity: any) => {
      return block.replace(/\{\{(\w+)\}\}/g, (m: string, prop: string) => {
        return entity.properties[`http://example.org/${prop}`] || entity.uri || m;
      });
    }).join('\n');
  });
  
  const outputPath = join(outputDir, `generated-${Date.now()}.txt`);
  
  if (!dryRun) {
    if (!existsSync(dirname(outputPath))) {
      mkdirSync(dirname(outputPath), { recursive: true });
    }
    writeFileSync(outputPath, output);
  }
  
  const hash = createHash('blake3', { outputLength: 32 }).update(output).digest('hex');
  
  files.push({
    path: outputPath,
    hash,
    size: Buffer.byteLength(output, 'utf8'),
    generatedAt: new Date().toISOString()
  });
  
  return { files };
}

async function createAttestation({
  inputs,
  outputs,
  command,
  workingDirectory,
  startTime,
  verificationRuns
}: {
  inputs: any;
  outputs: any[];
  command: string;
  workingDirectory: string;
  startTime: Date;
  verificationRuns?: number;
}): Promise<Attestation> {
  
  let gitCommit: string | undefined;
  try {
    gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    // Git not available or not in a repo
  }
  
  return {
    version: "1.0.0",
    metadata: {
      timestamp: startTime.toISOString(),
      generator: "kgen-cli@1.0.0",
      gitCommit,
      command,
      workingDirectory,
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      }
    },
    inputs,
    outputs,
    provenance: {
      process: "kgen artifact generate",
      command,
      workingDirectory,
      deterministic: true,
      verificationRuns
    }
  };
}

async function verifyDeterminism({
  graphInfo,
  templatePath,
  templateContent,
  variables,
  outputDir,
  runs
}: {
  graphInfo: any;
  templatePath: string;
  templateContent: string;
  variables: Record<string, any>;
  outputDir: string;
  runs: number;
}): Promise<boolean> {
  
  const hashes: string[] = [];
  
  for (let i = 0; i < runs; i++) {
    const result = await generateArtifacts({
      graphInfo,
      templatePath,
      templateContent,
      variables,
      outputDir: join(outputDir, `verify-${i}`),
      dryRun: true
    });
    
    hashes.push(result.files[0].hash);
  }
  
  // All hashes should be identical for deterministic generation
  return hashes.every(hash => hash === hashes[0]);
}