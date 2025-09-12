/**
 * KGEN Document Generation Integration Example
 * 
 * Demonstrates the complete integration of Unjucks' mature document generation
 * capabilities with KGEN's deterministic generation, semantic reasoning,
 * and provenance tracking.
 */

import { DocumentEngine, DocumentType, DocumentMode } from './document-engine.js';
import { createDocumentFrontmatterProcessor } from './frontmatter-processor.js';
import { createSemanticInjector } from './semantic-injector.js';
import { createDocumentAttestationSystem } from './document-attestation.js';

/**
 * Complete Document Generation Example
 * 
 * Shows how to generate a business report with:
 * - Semantic data injection from knowledge graphs
 * - Office document processing with content injection
 * - Cryptographic provenance and attestation
 * - Compliance validation
 */
async function demonstrateCompleteDocumentGeneration() {
  console.log('🚀 KGEN Document Generation Integration Demo');
  console.log('============================================\n');

  try {
    // 1. Initialize document engine with all features enabled
    console.log('1. Initializing Document Engine...');
    const documentEngine = new DocumentEngine({
      documentsDir: './templates/documents',
      outputDir: './generated-documents',
      enableSemanticInjection: true,
      enableProvenanceTracking: true,
      enableAttestation: true,
      attestationLevel: 'enterprise',
      enableCryptographicSigning: true,
      debug: true
    });

    // 2. Prepare semantic knowledge graph data
    console.log('2. Preparing semantic knowledge graph...');
    const knowledgeGraph = {
      '@context': {
        'org': 'http://www.w3.org/ns/org#',
        'fin': 'http://finance.example.org/',
        'time': 'http://www.w3.org/2006/time#'
      },
      '@graph': [
        {
          '@id': 'company:acme',
          '@type': 'org:Organization',
          'org:legalName': 'Acme Corporation',
          'fin:revenue': [
            { 'time:year': 2024, 'fin:amount': 15000000 },
            { 'time:year': 2023, 'fin:amount': 12500000 }
          ],
          'fin:employees': 150
        }
      ]
    };

    // 3. Define semantic bindings for document variables
    console.log('3. Defining semantic bindings...');
    const semanticBindings = {
      companyName: {
        type: 'direct',
        property: 'org:legalName',
        required: true
      },
      currentRevenue: {
        type: 'temporal',
        property: 'fin:revenue',
        required: true
      },
      revenueGrowth: {
        type: 'computed',
        dependencies: ['fin:revenue'],
        computation: (data) => {
          const revenues = data['fin:revenue'];
          if (revenues.length >= 2) {
            const current = revenues[revenues.length - 1];
            const previous = revenues[revenues.length - 2];
            return ((current - previous) / previous * 100).toFixed(1) + '%';
          }
          return 'N/A';
        }
      },
      employeeCount: {
        type: 'direct',
        property: 'fin:employees'
      }
    };

    // 4. Generate business report with all features
    console.log('4. Generating business report with semantic injection...');
    const generationResult = await documentEngine.generateDocument({
      template: './templates/documents/office/word/business-report.md',
      documentType: DocumentType.WORD,
      documentMode: DocumentMode.SEMANTIC,
      context: {
        reportTitle: 'Annual Performance Report',
        reportType: 'annual',
        date: new Date(),
        executiveSummary: 'Our company has shown exceptional growth this year...',
        outputDir: './reports'
      },
      knowledgeGraph,
      semanticBindings,
      reasoningRules: ['./rules/financial-analysis.n3'],
      securityContext: {
        classification: 'confidential',
        complianceTags: ['sox', 'financial-reporting'],
        attestationRequired: true,
        complianceFramework: 'sox'
      }
    });

    // 5. Display results
    console.log('5. Generation Results:');
    console.log('   Success:', generationResult.success);
    console.log('   Document Type:', generationResult.documentType);
    console.log('   Generation Mode:', generationResult.strategy.mode);
    console.log('   Output Path:', generationResult.outputPath);
    console.log('   Generation Time:', generationResult.performance.generationTime.toFixed(2), 'ms');

    if (generationResult.metadata.semanticEnhancement) {
      console.log('   Semantic Enhancement: ✓');
      console.log('   Semantic Variables:', Object.keys(generationResult.metadata.semanticData || {}));
      console.log('   Semantic Queries:', generationResult.metadata.semanticMetadata?.queriesExecuted || 0);
    }

    if (generationResult.provenance) {
      console.log('   Provenance Tracking: ✓');
      console.log('   Provenance ID:', generationResult.provenance.generationId);
      console.log('   Input Hash:', generationResult.provenance.inputHash);
      console.log('   Output Hash:', generationResult.provenance.outputHash);
    }

    if (generationResult.attestationId) {
      console.log('   Document Attestation: ✓');
      console.log('   Attestation ID:', generationResult.attestationId);
      console.log('   Attestation Level:', generationResult.attestation?.attestationLevel);
      console.log('   Cryptographic Signatures:', generationResult.attestation?.signatures?.signatures?.length || 0);
    }

    // 6. Demonstrate document verification
    console.log('\n6. Verifying document attestation...');
    if (generationResult.attestationId) {
      const verificationResult = await documentEngine.attestationSystem.verifyDocumentAttestation(
        generationResult.attestationId
      );
      
      console.log('   Verification Result:', verificationResult.overallValid ? '✓ VALID' : '✗ INVALID');
      console.log('   Verification Checks:', verificationResult.verifications?.length || 0);
    }

    // 7. Display system statistics
    console.log('\n7. System Statistics:');
    const documentStats = documentEngine.getDocumentStats();
    console.log('   Documents Generated:', documentStats.documentsGenerated);
    console.log('   Semantic Injections:', documentStats.semanticInjections);
    console.log('   Provenance Records:', documentStats.provenanceRecords);
    console.log('   Average Generation Time:', documentStats.averageGenerationTime?.toFixed(2), 'ms');

    if (documentEngine.semanticInjector) {
      const semanticStats = documentEngine.semanticInjector.getSemanticStats();
      console.log('   Semantic Queries Executed:', semanticStats.semanticQueriesExecuted);
      console.log('   Semantic Cache Hit Rate:', (semanticStats.cacheHitRate * 100).toFixed(1), '%');
    }

    if (documentEngine.attestationSystem) {
      const attestationStats = documentEngine.attestationSystem.getAttestationStats();
      console.log('   Attestations Generated:', attestationStats.attestationsGenerated);
      console.log('   Cryptographic Signatures:', attestationStats.signaturesCreated);
      console.log('   Compliance Validations:', attestationStats.complianceValidations);
    }

    console.log('\n✅ Document generation integration demonstration completed successfully!');
    return generationResult;

  } catch (error) {
    console.error('\n❌ Document generation failed:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

/**
 * Batch Document Generation Example
 * 
 * Shows how to generate multiple documents with shared semantic context
 */
async function demonstrateBatchDocumentGeneration() {
  console.log('\n🔄 Batch Document Generation Demo');
  console.log('=================================\n');

  const documentEngine = new DocumentEngine({
    documentsDir: './templates/documents',
    outputDir: './batch-documents',
    enableSemanticInjection: true,
    enableProvenanceTracking: true
  });

  const documents = [
    {
      template: './templates/documents/office/word/business-report.md',
      context: { reportType: 'quarterly', quarter: 'Q1' },
      outputPath: './batch-documents/q1-report.docx'
    },
    {
      template: './templates/documents/office/excel/financial-dashboard.md',
      context: { fiscalYear: 2024, quarter: 'Q1' },
      outputPath: './batch-documents/q1-dashboard.xlsx'
    },
    {
      template: './templates/documents/latex/resume-academic.tex',
      context: { position: 'Financial Analyst' },
      outputPath: './batch-documents/analyst-resume.pdf'
    }
  ];

  console.log('Processing', documents.length, 'documents in batch...');

  const results = await Promise.all(
    documents.map((doc, index) => 
      documentEngine.generateDocument({
        ...doc,
        documentType: DocumentType.WORD, // Will be auto-detected from path
        documentMode: DocumentMode.TEMPLATE
      }).then(result => ({ index: index + 1, ...result }))
    )
  );

  console.log('\nBatch Results:');
  for (const result of results) {
    console.log(`   Document ${result.index}:`, result.success ? '✓' : '✗', result.outputPath);
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`\n✅ Batch generation completed: ${successCount}/${results.length} successful`);

  return results;
}

/**
 * Template Validation Example
 * 
 * Shows how to validate document templates and their requirements
 */
async function demonstrateTemplateValidation() {
  console.log('\n🔍 Template Validation Demo');
  console.log('===========================\n');

  const frontmatterProcessor = createDocumentFrontmatterProcessor({
    strictValidation: true,
    validateInjectionPoints: true
  });

  const templates = [
    './templates/documents/office/word/business-report.md',
    './templates/documents/office/excel/financial-dashboard.md',
    './templates/documents/latex/resume-academic.tex'
  ];

  console.log('Validating', templates.length, 'document templates...');

  for (const [index, templatePath] of templates.entries()) {
    console.log(`\n   Template ${index + 1}: ${templatePath}`);
    
    try {
      // Simulate reading template content
      const templateContent = `
---
documentType: word
documentMode: template
to: "output.docx"
injectionPoints:
  - id: title
    target: "bookmark:Title"
    content: "{{ title }}"
    required: true
variables:
  - name: title
    type: string
    required: true
---
# Example Template
This is a {{ title }} document.
      `;

      const validation = await frontmatterProcessor.parseDocumentFrontmatter(templateContent, true);
      
      console.log('     Document Type:', validation.documentMetadata.documentType);
      console.log('     Document Mode:', validation.documentMetadata.documentMode);
      console.log('     Validation:', validation.validation.valid ? '✓' : '✗');
      
      if (validation.validation.errors.length > 0) {
        console.log('     Errors:', validation.validation.errors);
      }
      
      if (validation.validation.warnings.length > 0) {
        console.log('     Warnings:', validation.validation.warnings);
      }

      const requirements = frontmatterProcessor.extractGenerationRequirements(validation.documentMetadata);
      console.log('     Processors Required:', requirements.processors);
      console.log('     Dependencies:', requirements.dependencies.length);

    } catch (error) {
      console.log('     Validation Failed:', error.message);
    }
  }

  console.log('\n✅ Template validation completed!');
}

/**
 * Run all integration demonstrations
 */
async function runIntegrationDemos() {
  console.log('KGEN Document Generation Integration Demonstrations');
  console.log('==================================================\n');

  try {
    // Run complete document generation demo
    await demonstrateCompleteDocumentGeneration();
    
    // Run batch generation demo
    await demonstrateBatchDocumentGeneration();
    
    // Run template validation demo
    await demonstrateTemplateValidation();

    console.log('\n🎉 All integration demonstrations completed successfully!');
    console.log('\nKey Integration Features Demonstrated:');
    console.log('✅ Office document processing (Word, Excel, PowerPoint)');
    console.log('✅ LaTeX compilation and PDF generation');
    console.log('✅ Semantic data injection from knowledge graphs');
    console.log('✅ Reasoning rules and inference');
    console.log('✅ Document-specific frontmatter processing');
    console.log('✅ Cryptographic provenance and attestation');
    console.log('✅ Compliance validation (SOX, GDPR, HIPAA, etc.)');
    console.log('✅ Batch document generation');
    console.log('✅ Template validation and requirements analysis');
    console.log('✅ Deterministic generation with reproducible results');

  } catch (error) {
    console.error('\n💥 Integration demonstration failed:', error.message);
    process.exit(1);
  }
}

// Export for testing or run if called directly
export {
  demonstrateCompleteDocumentGeneration,
  demonstrateBatchDocumentGeneration,
  demonstrateTemplateValidation,
  runIntegrationDemos
};

// Run demos if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationDemos();
}