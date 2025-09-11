/**
 * KGEN Artifact Generation Command
 * 
 * Integrates deterministic artifact generation with existing Unjucks infrastructure
 */

import { defineCommand } from "citty";
import chalk from "chalk";
import path from 'path';
import { promises as fs } from 'fs';
import { DeterministicArtifactGenerator } from '../artifacts/generator.js';

/**
 * Artifact generation subcommands
 */
export const artifactCommand = defineCommand({
  meta: {
    name: "artifact",
    description: "Generate deterministic artifacts with content addressing and attestations",
  },
  subCommands: {
    generate: defineCommand({
      meta: {
        name: "generate",
        description: "Generate deterministic artifacts from templates"
      },
      args: {
        template: {
          type: "string",
          description: "Template file path (relative to templates directory)",
          required: true
        },
        output: {
          type: "string", 
          description: "Output file path (relative to output directory)",
          required: false
        },
        context: {
          type: "string",
          description: "JSON context file path or inline JSON string",
          required: false
        },
        lockfile: {
          type: "string",
          description: "Lockfile path for reproducible builds",
          required: false
        },
        templatesDir: {
          type: "string",
          description: "Templates directory path",
          default: "_templates"
        },
        outputDir: {
          type: "string", 
          description: "Output directory path",
          default: "./generated"
        },
        contentAddressing: {
          type: "boolean",
          description: "Enable content-addressed filenames",
          default: true
        },
        attestations: {
          type: "boolean",
          description: "Generate attestation sidecars",
          default: true
        },
        verify: {
          type: "boolean",
          description: "Verify determinism by double-generation",
          default: false
        },
        cache: {
          type: "boolean",
          description: "Enable template caching",
          default: true
        },
        verbose: {
          type: "boolean",
          description: "Verbose output",
          default: false,
          alias: "v"
        }
      },
      async run({ args }) {
        try {
          console.log(chalk.blue("🔧 KGEN Deterministic Artifact Generation"));
          
          const generator = new DeterministicArtifactGenerator({
            templatesDir: args.templatesDir,
            outputDir: args.outputDir,
            enableContentAddressing: args.contentAddressing,
            enableAttestations: args.attestations,
            enableCache: args.cache,
            debug: args.verbose
          });

          let result;

          if (args.lockfile) {
            // Generate from lockfile
            console.log(chalk.cyan(`📄 Generating from lockfile: ${args.lockfile}`));
            result = await generator.generateFromLockfile(args.lockfile, args.outputDir);
            
            if (result.success) {
              console.log(chalk.green(`✅ Generated ${result.artifacts.length} artifacts from lockfile`));
              
              if (args.verbose) {
                result.artifacts.forEach(artifact => {
                  console.log(chalk.green(`  + ${artifact.outputPath}`));
                  console.log(chalk.gray(`    Hash: ${artifact.contentHash.substring(0, 16)}`));
                });
              }
            } else {
              console.error(chalk.red("❌ Lockfile generation failed"));
              return { success: false };
            }

          } else {
            // Generate single artifact
            console.log(chalk.cyan(`🎯 Generating artifact from template: ${args.template}`));
            
            // Parse context
            let context = {};
            if (args.context) {
              if (args.context.startsWith('{') || args.context.startsWith('[')) {
                // Inline JSON
                context = JSON.parse(args.context);
              } else {
                // Context file
                const contextContent = await fs.readFile(args.context, 'utf8');
                context = JSON.parse(contextContent);
              }
            }

            if (args.verbose) {
              console.log(chalk.gray("Context:"), context);
            }

            const templatePath = path.resolve(args.templatesDir, args.template);
            result = await generator.generate(templatePath, context, args.output);

            if (result.success) {
              console.log(chalk.green(`✅ Artifact generated successfully`));
              console.log(chalk.green(`   Output: ${result.outputPath}`));
              console.log(chalk.gray(`   Hash: ${result.contentHash.substring(0, 16)}`));
              
              if (args.attestations) {
                console.log(chalk.green(`   Attestation: ${result.outputPath}.attest.json`));
              }
            } else {
              console.error(chalk.red(`❌ Generation failed: ${result.error}`));
              return { success: false };
            }
          }

          // Verify determinism if requested
          if (args.verify && result.success) {
            console.log(chalk.cyan("\n🔍 Verifying deterministic generation..."));
            
            const artifacts = args.lockfile ? result.artifacts : [result];
            let allVerified = true;

            for (const artifact of artifacts) {
              const verification = await generator.verifyReproducibility(artifact.outputPath);
              if (verification.verified) {
                console.log(chalk.green(`✅ ${path.basename(artifact.outputPath)} - Verified deterministic`));
              } else {
                console.error(chalk.red(`❌ ${path.basename(artifact.outputPath)} - Verification failed`));
                if (verification.error) {
                  console.error(chalk.red(`   Error: ${verification.error}`));
                }
                allVerified = false;
              }
            }

            if (allVerified) {
              console.log(chalk.green("\n✅ All artifacts verified as deterministic"));
            } else {
              console.error(chalk.red("\n❌ Some artifacts failed determinism verification"));
              return { success: false };
            }
          }

          // Show stats if verbose
          if (args.verbose) {
            const stats = generator.getStats();
            console.log(chalk.cyan("\n📊 Generation Statistics:"));
            console.log(chalk.gray(`   Templates rendered: ${stats.generator.templateEngineStats.renders}`));
            console.log(chalk.gray(`   Cache hits: ${stats.generator.templateEngineStats.cacheHits}`));
            console.log(chalk.gray(`   Determinism rate: ${(stats.generator.templateEngineStats.determinismRate * 100).toFixed(1)}%`));
          }

          return { 
            success: true, 
            artifacts: args.lockfile ? result.artifacts.map(a => a.outputPath) : [result.outputPath]
          };

        } catch (error) {
          console.error(chalk.red(`\n❌ Artifact generation failed: ${error.message}`));
          if (args.verbose) {
            console.error(chalk.gray(error.stack));
          }
          return { success: false, error: error.message };
        }
      }
    }),

    lockfile: defineCommand({
      meta: {
        name: "lockfile",
        description: "Create lockfiles for reproducible builds"
      },
      args: {
        config: {
          type: "string",
          description: "Configuration file defining templates and contexts",
          required: true
        },
        output: {
          type: "string",
          description: "Output lockfile path",
          default: "kgen.lock"
        },
        templatesDir: {
          type: "string",
          description: "Templates directory path",
          default: "_templates"
        },
        verbose: {
          type: "boolean",
          description: "Verbose output",
          default: false,
          alias: "v"
        }
      },
      async run({ args }) {
        try {
          console.log(chalk.blue("📄 Creating KGEN Lockfile"));

          const generator = new DeterministicArtifactGenerator({
            templatesDir: args.templatesDir,
            debug: args.verbose
          });

          // Load configuration
          const configContent = await fs.readFile(args.config, 'utf8');
          const config = JSON.parse(configContent);

          if (!config.templates || !Array.isArray(config.templates)) {
            throw new Error("Configuration must have 'templates' array");
          }

          console.log(chalk.cyan(`📝 Processing ${config.templates.length} template configurations`));

          // Create lockfile
          const lockfile = await generator.createLockfile(config.templates, args.output);

          console.log(chalk.green(`✅ Lockfile created: ${args.output}`));
          console.log(chalk.gray(`   Templates: ${Object.keys(lockfile.templates).length}`));
          console.log(chalk.gray(`   Context hash: ${lockfile.contextHash.substring(0, 16)}`));

          if (args.verbose) {
            console.log(chalk.cyan("\n📋 Template entries:"));
            Object.entries(lockfile.templates).forEach(([name, template]) => {
              console.log(chalk.gray(`   ${name}: ${template.path}`));
              console.log(chalk.gray(`     Context hash: ${template.contextHash.substring(0, 16)}`));
            });
          }

          return { success: true, lockfile: args.output };

        } catch (error) {
          console.error(chalk.red(`\n❌ Lockfile creation failed: ${error.message}`));
          if (args.verbose) {
            console.error(chalk.gray(error.stack));
          }
          return { success: false, error: error.message };
        }
      }
    }),

    verify: defineCommand({
      meta: {
        name: "verify",
        description: "Verify artifact authenticity and determinism"
      },
      args: {
        artifact: {
          type: "string",
          description: "Path to artifact file to verify",
          required: true
        },
        verbose: {
          type: "boolean",
          description: "Verbose output",
          default: false,
          alias: "v"
        }
      },
      async run({ args }) {
        try {
          console.log(chalk.blue("🔍 Verifying Artifact"));

          const generator = new DeterministicArtifactGenerator({
            debug: args.verbose
          });

          const verification = await generator.verifyReproducibility(args.artifact);

          if (verification.verified) {
            console.log(chalk.green(`✅ Artifact verified: ${path.basename(args.artifact)}`));
            console.log(chalk.green(`   Content hash matches attestation`));
            
            if (args.verbose && verification.attestation) {
              console.log(chalk.cyan("\n📋 Attestation details:"));
              console.log(chalk.gray(`   Template: ${verification.attestation.generation.template}`));
              console.log(chalk.gray(`   Generated: ${verification.attestation.environment.generatedAt}`));
              console.log(chalk.gray(`   Node version: ${verification.attestation.environment.nodeVersion}`));
              console.log(chalk.gray(`   Platform: ${verification.attestation.environment.platform}`));
            }
          } else {
            console.error(chalk.red(`❌ Verification failed: ${path.basename(args.artifact)}`));
            if (verification.error) {
              console.error(chalk.red(`   Error: ${verification.error}`));
            }
            if (verification.currentHash && verification.expectedHash) {
              console.error(chalk.red(`   Expected: ${verification.expectedHash.substring(0, 16)}`));
              console.error(chalk.red(`   Actual:   ${verification.currentHash.substring(0, 16)}`));
            }
            return { success: false };
          }

          return { success: true, verified: verification.verified };

        } catch (error) {
          console.error(chalk.red(`\n❌ Verification failed: ${error.message}`));
          if (args.verbose) {
            console.error(chalk.gray(error.stack));
          }
          return { success: false, error: error.message };
        }
      }
    })
  }
});

export default artifactCommand;