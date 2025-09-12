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
import { ArtifactExplainer } from '../provenance/queries/explainer.js';

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
    }),

    explain: defineCommand({
      meta: {
        name: "explain",
        description: "Explain artifact provenance and generation lineage"
      },
      args: {
        artifact: {
          type: "string",
          description: "Path to artifact file to explain",
          required: true
        },
        format: {
          type: "string",
          description: "Explanation format (summary|detailed|comprehensive|technical|executive)",
          default: "detailed",
          alias: "f"
        },
        includeVerification: {
          type: "boolean",
          description: "Include integrity verification in explanation",
          default: false
        },
        includeLineage: {
          type: "boolean",
          description: "Include extended lineage analysis",
          default: true
        },
        depth: {
          type: "number",
          description: "Maximum traversal depth for lineage",
          default: 10
        },
        output: {
          type: "string",
          description: "Output explanation to file",
          required: false,
          alias: "o"
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
          console.log(chalk.blue("🔍 Explaining Artifact Provenance"));
          console.log(chalk.cyan(`📄 Artifact: ${path.basename(args.artifact)}`));

          // Check if artifact exists
          try {
            await fs.access(args.artifact);
          } catch (error) {
            console.error(chalk.red(`❌ Artifact not found: ${args.artifact}`));
            return { success: false, error: 'Artifact not found' };
          }

          // Look for attestation sidecar
          const attestationPath = `${args.artifact}.attest.json`;
          let attestation;
          
          try {
            const attestationContent = await fs.readFile(attestationPath, 'utf8');
            attestation = JSON.parse(attestationContent);
            console.log(chalk.green(`📋 Found attestation: ${path.basename(attestationPath)}`));
          } catch (error) {
            console.error(chalk.red(`❌ No attestation found: ${attestationPath}`));
            console.error(chalk.gray("   Cannot explain artifact without attestation"));
            return { success: false, error: 'No attestation found' };
          }

          // Create explainer (no store for now, will use attestation data)
          const explainer = new ArtifactExplainer(null, {
            explanationFormat: args.format,
            maxTraversalDepth: args.depth,
            includeSystemAgents: true,
            includeTemplateDetails: true,
            includeRuleDetails: true
          });

          // Generate explanation
          const explanation = await explainer.explainArtifact(attestation, {
            format: args.format,
            includeVerification: args.includeVerification,
            includeExtendedLineage: args.includeLineage,
            depth: args.depth
          });

          // Display explanation
          console.log(chalk.blue("\n📊 Artifact Explanation"));
          console.log(chalk.yellow("═".repeat(60)));

          // Basic artifact info
          console.log(chalk.cyan("\n🏷️  Artifact Information"));
          console.log(chalk.gray(`   Name: ${explanation.artifact.name}`));
          console.log(chalk.gray(`   Type: ${explanation.artifact.type}`));
          console.log(chalk.gray(`   Size: ${explanation.artifact.size} bytes`));
          console.log(chalk.gray(`   Hash: ${explanation.artifact.hash?.substring(0, 16)}...`));
          console.log(chalk.gray(`   Created: ${new Date(explanation.artifact.created).toLocaleString()}`));

          // Generation context
          console.log(chalk.cyan("\n⚙️  Generation Context"));
          console.log(chalk.gray(`   Operation ID: ${explanation.generation.operationId}`));
          console.log(chalk.gray(`   Operation Type: ${explanation.generation.operationType}`));
          console.log(chalk.gray(`   Engine: ${explanation.generation.engine.name} v${explanation.generation.engine.version}`));
          console.log(chalk.gray(`   Agent: ${explanation.generation.agent.name} (${explanation.generation.agent.type})`));
          console.log(chalk.gray(`   Duration: ${explanation.generation.duration}ms`));

          // Template information
          if (explanation.generation.template) {
            console.log(chalk.cyan("\n📄 Template"));
            console.log(chalk.gray(`   ID: ${explanation.generation.template.id}`));
            console.log(chalk.gray(`   Version: ${explanation.generation.template.version}`));
            console.log(chalk.gray(`   Path: ${explanation.generation.template.path}`));
          }

          // Rules applied
          if (explanation.generation.rules && explanation.generation.rules.length > 0) {
            console.log(chalk.cyan("\n📏 Rules Applied"));
            explanation.generation.rules.forEach(rule => {
              console.log(chalk.gray(`   • ${rule.id} (${rule.type})`));
            });
          }

          // Provenance information
          if (explanation.lineage && explanation.lineage.immediate) {
            const sources = explanation.lineage.immediate.sources;
            if (sources.length > 0) {
              console.log(chalk.cyan("\n🔗 Source Dependencies"));
              sources.forEach(source => {
                console.log(chalk.gray(`   • ${source.path} (${source.type})`));
                console.log(chalk.gray(`     Hash: ${source.hash?.substring(0, 16)}...`));
              });
            }
          }

          // Dependencies analysis
          if (explanation.dependencies && explanation.dependencies.analysis) {
            console.log(chalk.cyan("\n📦 Dependencies Analysis"));
            console.log(chalk.gray(`   Total Dependencies: ${explanation.dependencies.analysis.totalDependencies}`));
            console.log(chalk.gray(`   Complexity Score: ${explanation.dependencies.analysis.complexityScore}`));
            console.log(chalk.gray(`   Risk Level: ${explanation.dependencies.analysis.riskLevel}`));
            
            if (explanation.dependencies.circular.length > 0) {
              console.log(chalk.red(`   ⚠️  Circular Dependencies: ${explanation.dependencies.circular.length}`));
            }
            
            if (explanation.dependencies.missing.length > 0) {
              console.log(chalk.red(`   ⚠️  Missing Dependencies: ${explanation.dependencies.missing.length}`));
            }
          }

          // Quality assessment
          console.log(chalk.cyan("\n✅ Quality Assessment"));
          console.log(chalk.gray(`   Overall Score: ${explanation.quality.overall.score.toFixed(1)}/100 (${explanation.quality.overall.grade})`));
          console.log(chalk.gray(`   Integrity: ${explanation.quality.integrity.score.toFixed(1)}/100 ${explanation.quality.integrity.verified ? '✓' : '✗'}`));
          console.log(chalk.gray(`   Completeness: ${explanation.quality.completeness.score.toFixed(1)}/100`));
          console.log(chalk.gray(`   Accuracy: ${explanation.quality.accuracy.score.toFixed(1)}/100`));

          // Compliance assessment
          if (explanation.compliance) {
            console.log(chalk.cyan("\n🛡️  Compliance"));
            console.log(chalk.gray(`   Framework: ${explanation.compliance.framework}`));
            console.log(chalk.gray(`   Standards: ${explanation.compliance.standards.join(', ')}`));
            console.log(chalk.gray(`   Score: ${explanation.compliance.score.toFixed(1)}/100`));
            
            if (explanation.compliance.gaps.length > 0) {
              console.log(chalk.yellow(`   ⚠️  Compliance Gaps: ${explanation.compliance.gaps.length}`));
            }
          }

          // Governance
          if (explanation.governance && explanation.governance.auditability) {
            console.log(chalk.cyan("\n🏛️  Governance"));
            console.log(chalk.gray(`   Traceable: ${explanation.governance.auditability.traceable ? '✅' : '❌'}`));
            console.log(chalk.gray(`   Verifiable: ${explanation.governance.auditability.verifiable ? '✅' : '❌'}`));
            console.log(chalk.gray(`   Complete: ${explanation.governance.auditability.complete ? '✅' : '❌'}`));
            console.log(chalk.gray(`   Score: ${explanation.governance.auditability.score.toFixed(1)}/100`));
          }

          // Narrative
          if (explanation.narrative) {
            console.log(chalk.cyan("\n📖 Summary"));
            console.log(chalk.white(`   ${explanation.narrative}`));
          }

          // Verification results
          if (args.includeVerification && explanation.verification) {
            console.log(chalk.cyan("\n🔐 Verification"));
            console.log(chalk.gray(`   Verified: ${explanation.verification.verified ? '✅' : '❌'}`));
            if (explanation.verification.errors) {
              explanation.verification.errors.forEach(error => {
                console.log(chalk.red(`   ❌ ${error}`));
              });
            }
          }

          // Provenance graph hash
          if (attestation.provenance?.graphHash) {
            console.log(chalk.cyan("\n🔗 Provenance"));
            console.log(chalk.gray(`   Graph Hash: ${attestation.provenance.graphHash.substring(0, 32)}...`));
            console.log(chalk.gray(`   Canonicalization: ${attestation.provenance.canonicalizationMethod}`));
          }

          // Save explanation to file if requested
          if (args.output) {
            const outputData = {
              timestamp: new Date().toISOString(),
              artifact: args.artifact,
              explanation: explanation
            };
            
            await fs.writeFile(args.output, JSON.stringify(outputData, null, 2), 'utf8');
            console.log(chalk.green(`\n💾 Explanation saved to: ${args.output}`));
          }

          // Verbose details
          if (args.verbose) {
            console.log(chalk.cyan("\n🔧 Technical Details"));
            console.log(chalk.gray(`   Attestation ID: ${attestation.attestationId}`));
            console.log(chalk.gray(`   Artifact ID: ${attestation.artifactId}`));
            console.log(chalk.gray(`   Schema: ${attestation['$schema']}`));
            console.log(chalk.gray(`   Version: ${attestation.version}`));
            
            if (attestation.signature) {
              console.log(chalk.gray(`   Signed: ✅ (${attestation.signature.algorithm})`));
              console.log(chalk.gray(`   Key Fingerprint: ${attestation.signature.keyFingerprint}`));
              console.log(chalk.gray(`   Signed At: ${new Date(attestation.signature.signedAt).toLocaleString()}`));
            } else {
              console.log(chalk.yellow(`   Signed: ❌ (No signature found)`));
            }
          }

          console.log(chalk.green("\n✅ Artifact explanation completed"));

          return {
            success: true,
            explanation: explanation,
            attestationPath: attestationPath,
            outputFile: args.output
          };

        } catch (error) {
          console.error(chalk.red(`\n❌ Explanation failed: ${error.message}`));
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