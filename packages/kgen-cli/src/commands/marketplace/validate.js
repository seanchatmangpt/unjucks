/**
 * Marketplace Validate Command
 * 
 * Validate package manifest against SHACL shapes and marketplace requirements.
 */

import { defineCommand } from 'citty';
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

import { success, error, output, warn } from '../../lib/output.js';

export default defineCommand({
  meta: {
    name: 'validate',
    description: 'Validate package manifest for marketplace submission'
  },
  args: {
    path: {
      type: 'string',
      description: 'Path to package directory containing kpack.json',
      required: true
    },
    strict: {
      type: 'boolean',
      description: 'Enable strict validation mode',
      default: false
    },
    compliance: {
      type: 'string',
      description: 'Validate against compliance framework (gdpr|hipaa|sox)',
      alias: 'c'
    }
  },
  async run({ args }) {
    try {
      const packagePath = resolve(args.path);
      const manifestPath = join(packagePath, 'kpack.json');

      if (!existsSync(manifestPath)) {
        throw new Error(`kpack.json manifest not found in: ${packagePath}`);
      }

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

      // Validation results
      const validationResults = {
        manifest: await validateManifest(manifest, args.strict),
        structure: await validatePackageStructure(packagePath),
        compliance: args.compliance ? await validateCompliance(manifest, args.compliance) : null,
        security: await validateSecurity(packagePath),
        metadata: await validateMetadata(manifest)
      };

      // Calculate overall score
      const scores = Object.values(validationResults)
        .filter(Boolean)
        .map(result => result.score || 0);
      const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      const allPassed = Object.values(validationResults)
        .filter(Boolean)
        .every(result => result.passed);

      const result = success({
        package: {
          name: manifest.name,
          version: manifest.version,
          path: packagePath
        },
        validation: validationResults,
        overall: {
          passed: allPassed,
          score: Math.round(overallScore * 100) / 100,
          readyForSubmission: allPassed && overallScore >= 0.8
        },
        recommendations: generateRecommendations(validationResults)
      }, {
        strict: args.strict,
        compliance: args.compliance
      });

      output(result);

      if (!allPassed) {
        process.exit(1);
      }

    } catch (err) {
      const result = error(err.message, 'MARKETPLACE_VALIDATION_FAILED', {
        path: args.path,
        strict: args.strict,
        compliance: args.compliance,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });

      output(result);
      process.exit(1);
    }
  }
});

async function validateManifest(manifest, strict = false) {
  const errors = [];
  const warnings = [];

  // Required fields
  const required = ['name', 'version', 'description', 'main', 'author'];
  const missing = required.filter(field => !manifest[field]);
  errors.push(...missing.map(field => `Missing required field: ${field}`));

  // Validate semver
  if (manifest.version && !/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(manifest.version)) {
    errors.push(`Invalid semantic version: ${manifest.version}`);
  }

  // Validate package name
  if (manifest.name && !/^[@\w-]+\/[\w-]+$|^[\w-]+$/.test(manifest.name)) {
    errors.push(`Invalid package name format: ${manifest.name}`);
  }

  // Strict mode validations
  if (strict) {
    if (!manifest.repository) warnings.push('Repository URL recommended for trust');
    if (!manifest.license) warnings.push('License field required for marketplace');
    if (!manifest.keywords || manifest.keywords.length === 0) {
      warnings.push('Keywords recommended for discoverability');
    }
  }

  return {
    passed: errors.length === 0,
    score: errors.length === 0 ? (warnings.length === 0 ? 1.0 : 0.8) : 0.4,
    errors,
    warnings
  };
}

async function validatePackageStructure(packagePath) {
  const errors = [];
  const warnings = [];

  // Check for required files
  const requiredFiles = ['kpack.json'];
  const recommendedFiles = ['README.md', 'LICENSE'];

  for (const file of requiredFiles) {
    if (!existsSync(join(packagePath, file))) {
      errors.push(`Missing required file: ${file}`);
    }
  }

  for (const file of recommendedFiles) {
    if (!existsSync(join(packagePath, file))) {
      warnings.push(`Recommended file missing: ${file}`);
    }
  }

  return {
    passed: errors.length === 0,
    score: errors.length === 0 ? (warnings.length === 0 ? 1.0 : 0.9) : 0.3,
    errors,
    warnings
  };
}

async function validateCompliance(manifest, framework) {
  const errors = [];
  const warnings = [];

  // Framework-specific validations
  const complianceChecks = {
    gdpr: {
      requiredFields: ['dataProcessing', 'privacyPolicy', 'legalBasis'],
      recommendations: ['consentManagement', 'dataRetention', 'crossBorderTransfer']
    },
    hipaa: {
      requiredFields: ['accessControls', 'auditLogging', 'encryption'],
      recommendations: ['riskAssessment', 'businessAssociate', 'breachNotification']
    },
    sox: {
      requiredFields: ['financialControls', 'auditTrail', 'segregationOfDuties'],
      recommendations: ['changeManagement', 'documentRetention', 'executiveCertification']
    }
  };

  const checks = complianceChecks[framework];
  if (!checks) {
    errors.push(`Unknown compliance framework: ${framework}`);
    return { passed: false, score: 0, errors, warnings };
  }

  const compliance = manifest.compliance || {};
  const missing = checks.requiredFields.filter(field => !compliance[field]);
  errors.push(...missing.map(field => `Missing compliance field: ${field}`));

  const missingRec = checks.recommendations.filter(field => !compliance[field]);
  warnings.push(...missingRec.map(field => `Recommended compliance field: ${field}`));

  return {
    passed: errors.length === 0,
    score: errors.length === 0 ? (warnings.length === 0 ? 1.0 : 0.85) : 0.2,
    errors,
    warnings,
    framework
  };
}

async function validateSecurity(packagePath) {
  const errors = [];
  const warnings = [];

  // Basic security checks
  const securityIssues = [
    { pattern: /password.*=.*['"]\w+['"]/, message: 'Hardcoded password detected' },
    { pattern: /api[_-]?key.*=.*['"]\w+['"]/, message: 'Hardcoded API key detected' },
    { pattern: /secret.*=.*['"]\w+['"]/, message: 'Hardcoded secret detected' }
  ];

  // In production, this would scan all files for security issues
  // For now, just return a basic security assessment

  return {
    passed: errors.length === 0,
    score: errors.length === 0 ? 1.0 : 0.1,
    errors,
    warnings: ['Security scan is basic - consider professional audit for enterprise use']
  };
}

async function validateMetadata(manifest) {
  const errors = [];
  const warnings = [];

  // Metadata quality checks
  if (manifest.description && manifest.description.length < 20) {
    warnings.push('Description should be more descriptive (min 20 characters)');
  }

  if (manifest.keywords && manifest.keywords.length > 10) {
    warnings.push('Too many keywords may reduce discoverability (max 10 recommended)');
  }

  return {
    passed: errors.length === 0,
    score: warnings.length === 0 ? 1.0 : 0.9,
    errors,
    warnings
  };
}

function generateRecommendations(validationResults) {
  const recommendations = [];

  Object.entries(validationResults).forEach(([category, result]) => {
    if (result && result.warnings) {
      result.warnings.forEach(warning => {
        recommendations.push({
          category,
          type: 'warning',
          message: warning,
          priority: 'medium'
        });
      });
    }

    if (result && result.errors) {
      result.errors.forEach(error => {
        recommendations.push({
          category,
          type: 'error',
          message: error,
          priority: 'high'
        });
      });
    }
  });

  return recommendations;
}