/**
 * ValidationEngine - Specification validation engine
 * 
 * Provides comprehensive validation for project specifications,
 * ensuring they meet all requirements and constraints.
 */

export class ValidationEngine {
  constructor(options = {}) {
    this.options = {
      enableMcpIntegration: false,
      strictMode: true,
      ...options
    };
  }

  /**
   * Validate a project specification
   * @param {Object} spec - Specification to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateSpecification(spec) {
    const errors = [];
    const warnings = [];
    const context = {};

    try {
      // Basic structure validation
      if (!spec.metadata) {
        errors.push({
          code: 'MISSING_METADATA',
          message: 'Specification missing metadata section',
          severity: 'error',
          path: 'metadata'
        });
      }

      if (!spec.specification) {
        errors.push({
          code: 'MISSING_SPECIFICATION',
          message: 'Specification missing specification section',
          severity: 'error',
          path: 'specification'
        });
      }

      // Metadata validation
      if (spec.metadata) {
        if (!spec.metadata.name) {
          errors.push({
            code: 'MISSING_NAME',
            message: 'Project name is required',
            severity: 'error',
            path: 'metadata.name'
          });
        }

        if (!spec.metadata.version) {
          warnings.push({
            code: 'MISSING_VERSION',
            message: 'Project version not specified, defaulting to 1.0.0',
            severity: 'warning',
            path: 'metadata.version'
          });
        }
      }

      // Specification content validation
      if (spec.specification) {
        if (!spec.specification.requirements) {
          warnings.push({
            code: 'MISSING_REQUIREMENTS',
            message: 'No requirements specified',
            severity: 'warning',
            path: 'specification.requirements'
          });
        }

        if (!spec.specification.components) {
          warnings.push({
            code: 'MISSING_COMPONENTS',
            message: 'No components specified',
            severity: 'warning',
            path: 'specification.components'
          });
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        metrics: {
          totalChecks: errors.length + warnings.length + 5,
          errorsFound: errors.length,
          warningsFound: warnings.length
        },
        context
      };

    } catch (error) {
      return {
        valid: false,
        errors: [{
          code: 'VALIDATION_EXCEPTION',
          message: `Validation failed: ${error.message}`,
          severity: 'error',
          path: 'root'
        }],
        warnings: [],
        metrics: {},
        context: { error: error.message }
      };
    }
  }

  /**
   * Validate generator mappings
   * @param {Array} mappings - Generator mappings to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateGeneratorMappings(mappings) {
    const errors = [];
    const warnings = [];

    for (const mapping of mappings) {
      if (!mapping.generator) {
        errors.push({
          code: 'MISSING_GENERATOR',
          message: 'Generator name is required',
          severity: 'error',
          path: `mappings[${mappings.indexOf(mapping)}].generator`
        });
      }

      if (!mapping.template) {
        errors.push({
          code: 'MISSING_TEMPLATE',
          message: 'Template name is required',
          severity: 'error',
          path: `mappings[${mappings.indexOf(mapping)}].template`
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metrics: {
        totalMappings: mappings.length,
        validMappings: mappings.length - errors.length,
        invalidMappings: errors.length
      }
    };
  }
}