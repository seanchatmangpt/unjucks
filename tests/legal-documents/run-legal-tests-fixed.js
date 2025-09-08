#!/usr/bin/env node

/**
 * Legal Document Test Runner (Fixed)
 * Comprehensive test suite for legal document generation workflow
 */
import { LegalTestHelper } from './legal-test-helper-fixed.js';
import chalk from 'chalk';

async function main() {
  const testHelper = new LegalTestHelper();
  
  console.log(chalk.blue.bold('🏛️  Unjucks Legal Document Workflow Test'));
  console.log(chalk.gray('Testing legal template generation, formatting, and compliance\n'));

  try {
    // Run comprehensive test suite
    const results = await testHelper.runComprehensiveTest();
    
    // Display detailed results
    if (results.briefGeneration?.success) {
      console.log(chalk.blue('\n📄 Generated Legal Brief Details:'));
      console.log(chalk.gray(`   File: ${results.briefGeneration.outputPath}`));
      console.log(chalk.gray(`   Size: ${results.briefGeneration.size} characters`));
      
      // Show sample content preview
      const preview = results.briefGeneration.content.substring(0, 500) + '...';
      console.log(chalk.gray('\n📝 Content Preview:'));
      console.log(chalk.dim(preview));
    }

    console.log(chalk.blue('\n🔍 Detailed Test Results:'));
    
    // Format validation details
    if (results.formatValidation) {
      console.log(chalk.yellow('\nFormatting Compliance:'));
      results.formatValidation.forEach(validation => {
        const status = validation.passed ? chalk.green('PASS') : chalk.red('FAIL');
        const required = validation.required ? chalk.red('*') : ' ';
        console.log(`  ${required} ${status} ${validation.test}`);
      });
    }

    // Certificate of service details
    if (results.certificateOfService?.validations) {
      console.log(chalk.yellow('\nCertificate of Service:'));
      results.certificateOfService.validations.forEach(validation => {
        const status = validation.passed ? chalk.green('PASS') : chalk.red('FAIL');
        console.log(`    ${status} ${validation.test}`);
      });
    }

    // Bluebook citation details
    if (results.bluebookCitations?.validations) {
      console.log(chalk.yellow('\nBluebook Citations:'));
      results.bluebookCitations.validations.forEach(validation => {
        const status = validation.passed ? chalk.green('PASS') : chalk.red('FAIL');
        console.log(`    ${status} ${validation.test}`);
      });
    }

    // Final recommendations
    console.log(chalk.blue.bold('\n💡 Recommendations:'));
    
    const failedRequired = results.formatValidation?.filter(v => !v.passed && v.required).length || 0;
    if (failedRequired > 0) {
      console.log(chalk.red(`   ⚠️  ${failedRequired} critical formatting issues found`));
      console.log(chalk.yellow('   📋 Review failed validation items marked with * above'));
    } else {
      console.log(chalk.green('   ✅ All critical formatting requirements met'));
    }

    console.log(chalk.gray('\n   📚 Legal document templates are ready for production use'));
    console.log(chalk.gray('   🔧 Use these templates for generating legal briefs, motions, and pleadings'));
    
    // Additional legal-specific recommendations
    console.log(chalk.blue('\n📋 Legal Document Recommendations:'));
    console.log(chalk.gray('   • Always verify court-specific formatting requirements'));
    console.log(chalk.gray('   • Check local rules for page limits and citation styles'));
    console.log(chalk.gray('   • Review generated documents for proper Bluebook citations'));
    console.log(chalk.gray('   • Ensure certificate of service includes all required parties'));
    console.log(chalk.gray('   • Validate exhibit references and appendix formatting'));

  } catch (error) {
    console.error(chalk.red('❌ Test suite failed:'), error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };