/**
 * KGEN Document Generation Command
 * 
 * Provides CLI interface for generating Office and LaTeX documents with
 * KGEN's deterministic artifact pipeline and enterprise compliance features.
 * 
 * @module commands/document
 * @version 1.0.0
 */

import { defineCommand } from "citty";
import chalk from "chalk";
import path from 'path';
import { promises as fs } from 'fs';
import { DocumentArtifactGenerator, DOCUMENT_TYPES, DOCUMENT_CATEGORIES, ENTERPRISE_TEMPLATES } from '../artifacts/document-generator.js';

/**
 * Document generation command with subcommands
 */
export const documentCommand = defineCommand({
  meta: {
    name: "document",
    description: "Generate deterministic Office and LaTeX documents with enterprise compliance",
  },
  subCommands: {
    generate: defineCommand({
      meta: {
        name: "generate",
        description: "Generate a single document from template"
      },
      args: {
        template: {
          type: "string",
          description: "Document template path or enterprise template name",
          required: true
        },
        type: {
          type: "string",
          description: "Document type (latex, word, excel, powerpoint)",
          required: false
        },
        data: {
          type: "string",
          description: "JSON data file or inline JSON for template variables",
          required: false
        },
        output: {
          type: "string",
          description: "Output file path (supports content addressing)",
          required: false
        },
        category: {
          type: "string",
          description: "Document category (compliance, technical, business, academic, legal)",
          required: false
        },
        templatesDir: {
          type: "string",
          description: "Templates directory path",
          default: "_templates/documents"
        },
        outputDir: {
          type: "string",
          description: "Output directory path",
          default: "./generated/documents"
        },
        compilePdf: {
          type: "boolean",
          description: "Compile LaTeX documents to PDF",
          default: true
        },
        compliance: {
          type: "boolean",
          description: "Enable compliance mode with strict validation and attestations",
          default: false
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
        cache: {
          type: "boolean",
          description: "Enable template and result caching",
          default: true
        },
        verbose: {
          type: "boolean",
          description: "Verbose output with detailed logging",
          default: false,
          alias: "v"
        }
      },
      async run({ args }) {
        try {
          console.log(chalk.blue("📄 KGEN Document Generation"));
          
          const generator = new DocumentArtifactGenerator({
            templatesDir: args.templatesDir,
            outputDir: args.outputDir,
            compilePdf: args.compilePdf,
            complianceMode: args.compliance,
            enableContentAddressing: args.contentAddressing,
            enableAttestations: args.attestations,
            enableCache: args.cache,
            debug: args.verbose
          });
          
          await generator.initialize();
          
          // Parse template specification
          let template = args.template;
          let documentType = args.type;
          
          // Check if it's an enterprise template
          const enterpriseTemplate = ENTERPRISE_TEMPLATES[args.template];
          if (enterpriseTemplate) {
            template = enterpriseTemplate.template;
            documentType = documentType || enterpriseTemplate.type;
            console.log(chalk.cyan(`📋 Using enterprise template: ${args.template}`));
            console.log(chalk.gray(`   Description: ${enterpriseTemplate.description}`));
            console.log(chalk.gray(`   Type: ${documentType}`));
            console.log(chalk.gray(`   Category: ${enterpriseTemplate.category}`));
          }
          
          // Auto-detect type from template if not specified
          if (!documentType) {
            if (template.includes('.tex.')) documentType = DOCUMENT_TYPES.LATEX;
            else if (template.includes('.docx.')) documentType = DOCUMENT_TYPES.WORD;
            else if (template.includes('.xlsx.')) documentType = DOCUMENT_TYPES.EXCEL;
            else if (template.includes('.pptx.')) documentType = DOCUMENT_TYPES.POWERPOINT;
            else documentType = DOCUMENT_TYPES.LATEX; // Default to LaTeX
          }
          
          // Parse data
          let data = {};
          if (args.data) {
            if (args.data.startsWith('{') || args.data.startsWith('[')) {
              // Inline JSON
              data = JSON.parse(args.data);
            } else {
              // Data file
              const dataContent = await fs.readFile(args.data, 'utf8');
              data = JSON.parse(dataContent);
            }
          }
          
          if (args.verbose) {
            console.log(chalk.cyan("📊 Generation Configuration:"));
            console.log(chalk.gray(`   Template: ${template}`));
            console.log(chalk.gray(`   Type: ${documentType}`));
            console.log(chalk.gray(`   Category: ${args.category || 'general'}`));
            console.log(chalk.gray(`   Compliance: ${args.compliance ? 'enabled' : 'disabled'}`));
            console.log(chalk.gray(`   Data keys: ${Object.keys(data).join(', ')}`));
          }
          
          // Create document specification
          const specification = {
            template,
            type: documentType,
            data,
            outputPath: args.output,
            category: args.category,
            compliance: args.compliance,
            complianceFramework: args.compliance ? 'enterprise' : undefined,
            standards: args.compliance ? ['ISO-27001', 'SOX'] : undefined
          };
          
          console.log(chalk.cyan(`🚀 Generating ${documentType} document...`));
          
          const result = await generator.generateDocument(specification);
          
          if (result.success) {
            console.log(chalk.green("✅ Document generated successfully"));
            console.log(chalk.green(`   Output: ${result.outputPath}`));
            console.log(chalk.gray(`   Artifact ID: ${result.artifactId.substring(0, 16)}`));
            console.log(chalk.gray(`   Content Hash: ${result.contentHash.substring(0, 16)}`));
            
            if (result.pdfPath) {
              console.log(chalk.green(`   PDF: ${result.pdfPath}`));
            }
            
            if (result.attestation) {
              console.log(chalk.green(`   Attestation: ${result.attestation.path}`));
            }
            
            if (result.validation && !result.validation.valid) {
              console.log(chalk.yellow(`⚠️  Validation warnings: ${result.validation.warnings.length}`));
              if (args.verbose && result.validation.warnings.length > 0) {
                result.validation.warnings.forEach(warning => {
                  console.log(chalk.yellow(`     - ${warning.message}`));
                });
              }
            }
            
            if (args.verbose) {
              console.log(chalk.cyan("\n📈 Generation Stats:"));
              console.log(chalk.gray(`   Generation time: ${result.generationTime}ms`));
              console.log(chalk.gray(`   Template hash: ${result.templateHash.substring(0, 16)}`));
              console.log(chalk.gray(`   Context hash: ${result.contextHash.substring(0, 16)}`));
            }
            
          } else {
            console.error(chalk.red(`❌ Document generation failed: ${result.error}`));
            return { success: false };
          }
          
          return { 
            success: true, 
            outputPath: result.outputPath,
            artifactId: result.artifactId
          };
          
        } catch (error) {
          console.error(chalk.red(`\n❌ Document generation error: ${error.message}`));
          if (args.verbose) {
            console.error(chalk.gray(error.stack));
          }
          return { success: false, error: error.message };
        }
      }
    }),
    
    batch: defineCommand({
      meta: {
        name: "batch",
        description: "Generate multiple documents from configuration file"
      },
      args: {
        config: {
          type: "string",
          description: "Configuration file defining document specifications",
          required: true
        },
        outputDir: {
          type: "string",
          description: "Output directory for all documents",
          default: "./generated/documents"
        },
        templatesDir: {
          type: "string",
          description: "Templates directory path",
          default: "_templates/documents"
        },
        parallel: {
          type: "boolean",
          description: "Process documents in parallel",
          default: true
        },
        compliance: {
          type: "boolean",
          description: "Enable compliance mode for all documents",
          default: false
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
          console.log(chalk.blue("📄 KGEN Batch Document Generation"));
          
          const generator = new DocumentArtifactGenerator({
            templatesDir: args.templatesDir,
            outputDir: args.outputDir,
            complianceMode: args.compliance,
            parallelGeneration: args.parallel,
            debug: args.verbose
          });
          
          await generator.initialize();
          
          // Load configuration
          const configContent = await fs.readFile(args.config, 'utf8');
          const config = JSON.parse(configContent);
          
          if (!config.documents || !Array.isArray(config.documents)) {
            throw new Error("Configuration must have 'documents' array");
          }
          
          console.log(chalk.cyan(`📋 Processing ${config.documents.length} document specifications`));
          
          const specifications = config.documents.map(doc => ({
            ...doc,
            compliance: args.compliance || doc.compliance
          }));
          
          const result = await generator.batchGenerate(specifications);
          
          console.log(chalk.green(`✅ Batch generation completed`));
          console.log(chalk.green(`   Successful: ${result.successful}`));
          console.log(chalk.green(`   Failed: ${result.failed}`));
          console.log(chalk.green(`   Total: ${result.total}`));
          
          if (result.failed > 0 && args.verbose) {
            console.log(chalk.yellow("\n⚠️  Failed documents:"));
            result.results.filter(r => !r.success).forEach(failure => {
              console.log(chalk.red(`   - ${failure.specification?.template}: ${failure.error}`));
            });
          }
          
          if (args.verbose) {
            const stats = generator.getStats();
            console.log(chalk.cyan("\n📊 Batch Statistics:"));
            console.log(chalk.gray(`   Documents generated: ${stats.documentsGenerated}`));
            console.log(chalk.gray(`   Cache hits: ${stats.cacheHits}`));
            console.log(chalk.gray(`   Attestations created: ${stats.attestationsCreated}`));
          }
          
          return { 
            success: result.failed === 0,
            total: result.total,
            successful: result.successful,
            failed: result.failed
          };
          
        } catch (error) {
          console.error(chalk.red(`\n❌ Batch generation failed: ${error.message}`));
          if (args.verbose) {
            console.error(chalk.gray(error.stack));
          }
          return { success: false, error: error.message };
        }
      }
    }),
    
    list: defineCommand({
      meta: {
        name: "list",
        description: "List available document templates"
      },
      args: {
        category: {
          type: "string",
          description: "Filter by category (compliance, technical, business, academic, legal)",
          required: false
        },
        enterprise: {
          type: "boolean",
          description: "Show enterprise templates only",
          default: false
        },
        templatesDir: {
          type: "string",
          description: "Templates directory path",
          default: "_templates/documents"
        },
        verbose: {
          type: "boolean",
          description: "Show detailed template information",
          default: false,
          alias: "v"
        }
      },
      async run({ args }) {
        try {
          console.log(chalk.blue("📋 Available Document Templates"));
          
          if (args.enterprise) {
            console.log(chalk.cyan("\n🏢 Enterprise Templates:"));
            Object.entries(ENTERPRISE_TEMPLATES).forEach(([name, template]) => {
              if (!args.category || template.category === args.category) {
                console.log(chalk.green(`   ${name}`));
                console.log(chalk.gray(`     Type: ${template.type}`));
                console.log(chalk.gray(`     Category: ${template.category}`));
                console.log(chalk.gray(`     Template: ${template.template}`));
                console.log(chalk.gray(`     Description: ${template.description}`));
                
                if (args.verbose && template.requiredData) {
                  console.log(chalk.gray(`     Required data: ${template.requiredData.join(', ')}`));
                }
                console.log('');
              }
            });
            
            return { success: true };
          }
          
          const generator = new DocumentArtifactGenerator({
            templatesDir: args.templatesDir
          });
          
          await generator.initialize();
          
          const templates = generator.getAvailableTemplates(args.category);
          
          if (templates.length === 0) {
            console.log(chalk.yellow("No templates found"));
            return { success: true };
          }
          
          console.log(chalk.cyan(`\n📄 Found ${templates.length} templates:`));
          
          templates.forEach(template => {
            console.log(chalk.green(`   ${template.name}`));
            console.log(chalk.gray(`     Path: ${template.path}`));
            console.log(chalk.gray(`     Type: ${template.type}`));
            console.log(chalk.gray(`     Category: ${template.category}`));
            
            if (template.description) {
              console.log(chalk.gray(`     Description: ${template.description}`));
            }
            
            if (args.verbose) {
              console.log(chalk.gray(`     Size: ${template.size} bytes`));
              console.log(chalk.gray(`     Modified: ${template.modified}`));
              
              if (template.requiredData && template.requiredData.length > 0) {
                console.log(chalk.gray(`     Required data: ${template.requiredData.join(', ')}`));
              }
            }
            
            console.log('');
          });
          
          // Show categories summary
          const allTemplates = generator.getAvailableTemplates();
          const categories = {};
          allTemplates.forEach(t => {
            categories[t.category] = (categories[t.category] || 0) + 1;
          });
          
          console.log(chalk.cyan("📊 Templates by category:"));
          Object.entries(categories).forEach(([cat, count]) => {
            console.log(chalk.gray(`   ${cat}: ${count} templates`));
          });
          
          return { success: true, templates: templates.length };
          
        } catch (error) {
          console.error(chalk.red(`\n❌ Failed to list templates: ${error.message}`));
          return { success: false, error: error.message };
        }
      }
    }),
    
    verify: defineCommand({
      meta: {
        name: "verify",
        description: "Verify document artifact authenticity and compliance"
      },
      args: {
        document: {
          type: "string",
          description: "Path to document artifact to verify",
          required: true
        },
        attestation: {
          type: "string",
          description: "Path to attestation file (optional if sidecar exists)",
          required: false
        },
        verbose: {
          type: "boolean",
          description: "Verbose verification output",
          default: false,
          alias: "v"
        }
      },
      async run({ args }) {
        try {
          console.log(chalk.blue("🔍 Verifying Document Artifact"));
          
          // Check if document exists
          await fs.access(args.document);
          
          // Look for attestation sidecar if not provided
          let attestationPath = args.attestation;
          if (!attestationPath) {
            attestationPath = `${args.document}.attest.json`;
            try {
              await fs.access(attestationPath);
            } catch {
              throw new Error(`No attestation provided and sidecar not found: ${attestationPath}`);
            }
          }
          
          // Load attestation
          const attestationContent = await fs.readFile(attestationPath, 'utf8');
          const attestation = JSON.parse(attestationContent);
          
          // Calculate current document hash
          const documentContent = await fs.readFile(args.document, 'utf8');
          const crypto = await import('crypto');
          const currentHash = crypto.createHash('sha256').update(documentContent).digest('hex');
          
          // Verify hash matches attestation
          const verified = currentHash === attestation.contentHash;
          
          if (verified) {
            console.log(chalk.green(`✅ Document verified: ${path.basename(args.document)}`));
            console.log(chalk.green(`   Content hash matches attestation`));
            console.log(chalk.green(`   Artifact ID: ${attestation.artifactId.substring(0, 16)}`));
            
            if (args.verbose) {
              console.log(chalk.cyan("\n📋 Attestation Details:"));
              console.log(chalk.gray(`   Template: ${attestation.specification.template}`));
              console.log(chalk.gray(`   Type: ${attestation.specification.type}`));
              console.log(chalk.gray(`   Generated: ${attestation.generatedAt}`));
              console.log(chalk.gray(`   KGEN Version: ${attestation.kgenVersion}`));
              console.log(chalk.gray(`   Node Version: ${attestation.environment.nodeVersion}`));
              console.log(chalk.gray(`   Platform: ${attestation.environment.platform}`));
              
              if (attestation.compliance) {
                console.log(chalk.cyan("\n🔒 Compliance Information:"));
                console.log(chalk.gray(`   Framework: ${attestation.compliance.framework}`));
                console.log(chalk.gray(`   Standards: ${attestation.compliance.standards.join(', ')}`));
              }
            }
            
          } else {
            console.error(chalk.red(`❌ Verification failed: ${path.basename(args.document)}`));
            console.error(chalk.red(`   Content hash mismatch`));
            console.error(chalk.red(`   Expected: ${attestation.contentHash.substring(0, 16)}`));
            console.error(chalk.red(`   Actual:   ${currentHash.substring(0, 16)}`));
            return { success: false };
          }
          
          return { success: true, verified };
          
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

export default documentCommand;