/**
 * @typedef {import('../lib/types/turtle-types.js').TurtleData} TurtleData
 * @typedef {import('../lib/types/turtle-types.js').RDFResource} RDFResource
 * @typedef {import('../lib/types/turtle-types.js').RDFValue} RDFValue
 * @typedef {import('../lib/semantic-validator.js').ValidationError} ValidationError
 */

/**
 * GDPR (General Data Protection Regulation) validation rules
 * Focus: Personal data protection, consent tracking, purpose limitation
 */
export class GDPRValidator {
  constructor() {
    /** @type {string[]} */
    this.personalDataIndicators = [
      // Direct identifiers
      'email', 'phone', 'ssn', 'passport', 'id_number',
      // Personal attributes
      'name', 'first_name', 'last_name', 'full_name',
      'address', 'location', 'birth_date', 'age',
      // Sensitive data
      'health', 'medical', 'biometric', 'genetic', 'political',
      'religious', 'sexual', 'ethnicity', 'race'
    ];

    /** @type {string[]} */
    this.requiredGDPRProperties = [
      'http://purl.org/dc/terms/purpose', // Purpose limitation
      'http://purl.org/dc/terms/created', // Data retention
      'http://example.org/gdpr/lawfulBasis', // Legal basis
      'http://example.org/gdpr/dataSubjectRights' // Subject rights
    ];
  }

  /**
   * Validate GDPR compliance for turtle data
   * @param {TurtleData} data - Turtle data to validate
   * @returns {ValidationError[]} Array of validation errors
   */
  validate(data) {
    /** @type {ValidationError[]} */
    const violations = [];

    // 1. Personal Data Detection and Protection
    this.validatePersonalDataProtection(data, violations);

    // 2. Consent and Legal Basis Validation
    this.validateConsentTracking(data, violations);

    // 3. Purpose Limitation Validation
    this.validatePurposeLimitation(data, violations);

    // 4. Data Retention Validation
    this.validateDataRetention(data, violations);

    // 5. Data Subject Rights
    this.validateDataSubjectRights(data, violations);

    return violations;
  }

  /**
   * Validate personal data protection measures
   * @private
   * @param {TurtleData} data - Turtle data
   * @param {ValidationError[]} violations - Violations array to populate
   */
  validatePersonalDataProtection(data, violations) {
    for (const [subjectUri, resource] of Object.entries(data.subjects)) {
      const containsPersonalData = this.containsPersonalData(resource);

      if (containsPersonalData) {
        // Check for protection mechanisms
        const hasProtection = this.hasDataProtectionMeasures(resource);
        
        if (!hasProtection) {
          violations.push({
            code: 'GDPR_MISSING_PROTECTION',
            message: `Personal data in ${subjectUri} lacks adequate protection measures`,
            severity: 'error',
            complianceFramework: 'GDPR',
            context: { subject: subjectUri }
          });
        }

        // Check for consent tracking
        const hasConsent = this.hasConsentTracking(resource);
        if (!hasConsent) {
          violations.push({
            code: 'GDPR_MISSING_CONSENT',
            message: `Personal data processing without documented consent: ${subjectUri}`,
            severity: 'error',
            complianceFramework: 'GDPR',
            context: { subject: subjectUri }
          });
        }
      }
    }
  }

  /**
   * Validate consent tracking
   * @private
   * @param {TurtleData} data - Turtle data
   * @param {ValidationError[]} violations - Violations array to populate
   */
  validateConsentTracking(data, violations) {
    for (const [subjectUri, resource] of Object.entries(data.subjects)) {
      if (this.containsPersonalData(resource)) {
        const consentProps = [
          'http://example.org/gdpr/consent',
          'http://example.org/gdpr/consentDate',
          'http://example.org/gdpr/consentPurpose'
        ];

        const hasConsentDoc = consentProps.some(prop => 
          resource.properties[prop] && resource.properties[prop].length > 0
        );

        if (!hasConsentDoc) {
          violations.push({
            code: 'GDPR_CONSENT_UNDOCUMENTED',
            message: `Missing consent documentation for personal data: ${subjectUri}`,
            severity: 'error',
            complianceFramework: 'GDPR',
            context: { subject: subjectUri, requiredProperties: consentProps }
          });
        }
      }
    }
  }

  /**
   * Validate purpose limitation
   * @private
   * @param {TurtleData} data - Turtle data
   * @param {ValidationError[]} violations - Violations array to populate
   */
  validatePurposeLimitation(data, violations) {
    for (const [subjectUri, resource] of Object.entries(data.subjects)) {
      if (this.containsPersonalData(resource)) {
        const purposeProperty = 'http://purl.org/dc/terms/purpose';
        
        if (!resource.properties[purposeProperty] || resource.properties[purposeProperty].length === 0) {
          violations.push({
            code: 'GDPR_MISSING_PURPOSE',
            message: `Personal data processing purpose not specified: ${subjectUri}`,
            severity: 'error',
            complianceFramework: 'GDPR',
            context: { subject: subjectUri, property: purposeProperty }
          });
        }
      }
    }
  }

  /**
   * Validate data retention
   * @private
   * @param {TurtleData} data - Turtle data
   * @param {ValidationError[]} violations - Violations array to populate
   */
  validateDataRetention(data, violations) {
    const currentDate = new Date();
    
    for (const [subjectUri, resource] of Object.entries(data.subjects)) {
      if (this.containsPersonalData(resource)) {
        const createdProp = 'http://purl.org/dc/terms/created';
        const retentionProp = 'http://example.org/gdpr/retentionPeriod';

        const created = resource.properties[createdProp]?.[0];
        const retention = resource.properties[retentionProp]?.[0];

        if (created && retention) {
          const createdDate = new Date(created.value);
          const retentionDays = parseInt(retention.value, 10);
          const expiryDate = new Date(createdDate.getTime() + (retentionDays * 24 * 60 * 60 * 1000));

          if (currentDate > expiryDate) {
            violations.push({
              code: 'GDPR_RETENTION_EXCEEDED',
              message: `Data retention period exceeded for ${subjectUri}`,
              severity: 'error',
              complianceFramework: 'GDPR',
              context: { 
                subject: subjectUri, 
                created: createdDate, 
                expiry: expiryDate,
                current: currentDate
              }
            });
          }
        } else {
          violations.push({
            code: 'GDPR_RETENTION_UNDEFINED',
            message: `Data retention period not defined for personal data: ${subjectUri}`,
            severity: 'warning',
            complianceFramework: 'GDPR',
            context: { subject: subjectUri }
          });
        }
      }
    }
  }

  /**
   * Validate data subject rights
   * @private
   * @param {TurtleData} data - Turtle data
   * @param {ValidationError[]} violations - Violations array to populate
   */
  validateDataSubjectRights(data, violations) {
    for (const [subjectUri, resource] of Object.entries(data.subjects)) {
      if (this.containsPersonalData(resource)) {
        const rightsProperty = 'http://example.org/gdpr/dataSubjectRights';
        
        if (!resource.properties[rightsProperty]) {
          violations.push({
            code: 'GDPR_MISSING_RIGHTS',
            message: `Data subject rights not documented: ${subjectUri}`,
            severity: 'warning',
            complianceFramework: 'GDPR',
            context: { subject: subjectUri }
          });
        }
      }
    }
  }

  /**
   * Check if resource contains personal data
   * @private
   * @param {RDFResource} resource - RDF resource to check
   * @returns {boolean} True if contains personal data
   */
  containsPersonalData(resource) {
    const allValues = Object.values(resource.properties)
      .flat()
      .map(v => v.value.toLowerCase())
      .join(' ');

    const allKeys = Object.keys(resource.properties)
      .map(k => k.toLowerCase())
      .join(' ');

    const searchText = `${allValues} ${allKeys}`;

    return this.personalDataIndicators.some(indicator => 
      searchText.includes(indicator.toLowerCase())
    );
  }

  /**
   * Check if resource has data protection measures
   * @private
   * @param {RDFResource} resource - RDF resource to check
   * @returns {boolean} True if has protection measures
   */
  hasDataProtectionMeasures(resource) {
    const protectionProperties = [
      'http://example.org/security/encrypted',
      'http://example.org/security/access_control',
      'http://example.org/gdpr/pseudonymized',
      'http://example.org/gdpr/anonymized'
    ];

    return protectionProperties.some(prop => 
      resource.properties[prop] && resource.properties[prop].length > 0
    );
  }

  /**
   * Check if resource has consent tracking
   * @private
   * @param {RDFResource} resource - RDF resource to check
   * @returns {boolean} True if has consent tracking
   */
  hasConsentTracking(resource) {
    const consentProperties = [
      'http://example.org/gdpr/consent',
      'http://example.org/gdpr/consentDate',
      'http://example.org/gdpr/lawfulBasis'
    ];

    return consentProperties.some(prop => 
      resource.properties[prop] && resource.properties[prop].length > 0
    );
  }
}

/**
 * HIPAA (Health Insurance Portability and Accountability Act) validation rules
 * Focus: Protected Health Information (PHI) safeguards
 */
export class HIPAAValidator {
  constructor() {
    /** @type {string[]} */
    this.phiIndicators = [
      // Medical identifiers
      'medical_record', 'patient_id', 'health_plan', 'insurance',
      // Health information
      'diagnosis', 'treatment', 'medication', 'procedure',
      'symptoms', 'condition', 'disease', 'illness',
      // Healthcare providers
      'doctor', 'physician', 'hospital', 'clinic', 'pharmacy'
    ];

    /** @type {string[]} */
    this.requiredSafeguards = [
      'http://example.org/hipaa/administrative_safeguards',
      'http://example.org/hipaa/physical_safeguards', 
      'http://example.org/hipaa/technical_safeguards'
    ];
  }

  /**
   * Validate HIPAA compliance for turtle data
   * @param {TurtleData} data - Turtle data to validate
   * @returns {ValidationError[]} Array of validation errors
   */
  validate(data) {
    /** @type {ValidationError[]} */
    const violations = [];

    // 1. PHI Detection and Protection
    this.validatePHIProtection(data, violations);

    // 2. Administrative Safeguards
    this.validateAdministrativeSafeguards(data, violations);

    // 3. Physical Safeguards
    this.validatePhysicalSafeguards(data, violations);

    // 4. Technical Safeguards
    this.validateTechnicalSafeguards(data, violations);

    // 5. Minimum Necessary Standard
    this.validateMinimumNecessary(data, violations);

    return violations;
  }

  /**
   * Validate PHI protection
   * @private
   * @param {TurtleData} data - Turtle data
   * @param {ValidationError[]} violations - Violations array to populate
   */
  validatePHIProtection(data, violations) {
    for (const [subjectUri, resource] of Object.entries(data.subjects)) {
      if (this.containsPHI(resource)) {
        const hasEncryption = this.hasEncryption(resource);
        
        if (!hasEncryption) {
          violations.push({
            code: 'HIPAA_PHI_UNENCRYPTED',
            message: `PHI data not encrypted: ${subjectUri}`,
            severity: 'error',
            complianceFramework: 'HIPAA',
            context: { subject: subjectUri }
          });
        }

        const hasAccessControl = this.hasAccessControls(resource);
        if (!hasAccessControl) {
          violations.push({
            code: 'HIPAA_MISSING_ACCESS_CONTROL',
            message: `PHI lacks proper access controls: ${subjectUri}`,
            severity: 'error',
            complianceFramework: 'HIPAA',
            context: { subject: subjectUri }
          });
        }
      }
    }
  }

  /**
   * Validate administrative safeguards
   * @private
   * @param {TurtleData} data - Turtle data
   * @param {ValidationError[]} violations - Violations array to populate
   */
  validateAdministrativeSafeguards(data, violations) {
    const adminSafeguardProp = 'http://example.org/hipaa/administrative_safeguards';
    let hasAdminSafeguards = false;

    for (const resource of Object.values(data.subjects)) {
      if (resource.properties[adminSafeguardProp]) {
        hasAdminSafeguards = true;
        break;
      }
    }

    if (!hasAdminSafeguards) {
      violations.push({
        code: 'HIPAA_MISSING_ADMIN_SAFEGUARDS',
        message: 'Missing HIPAA administrative safeguards documentation',
        severity: 'error',
        complianceFramework: 'HIPAA'
      });
    }
  }

  /**
   * Validate physical safeguards
   * @private
   * @param {TurtleData} data - Turtle data
   * @param {ValidationError[]} violations - Violations array to populate
   */
  validatePhysicalSafeguards(data, violations) {
    const physicalSafeguardProp = 'http://example.org/hipaa/physical_safeguards';
    let hasPhysicalSafeguards = false;

    for (const resource of Object.values(data.subjects)) {
      if (resource.properties[physicalSafeguardProp]) {
        hasPhysicalSafeguards = true;
        break;
      }
    }

    if (!hasPhysicalSafeguards) {
      violations.push({
        code: 'HIPAA_MISSING_PHYSICAL_SAFEGUARDS',
        message: 'Missing HIPAA physical safeguards documentation',
        severity: 'error',
        complianceFramework: 'HIPAA'
      });
    }
  }

  /**
   * Validate technical safeguards
   * @private
   * @param {TurtleData} data - Turtle data
   * @param {ValidationError[]} violations - Violations array to populate
   */
  validateTechnicalSafeguards(data, violations) {
    for (const [subjectUri, resource] of Object.entries(data.subjects)) {
      if (this.containsPHI(resource)) {
        const technicalSafeguards = [
          'http://example.org/hipaa/audit_controls',
          'http://example.org/hipaa/integrity_controls',
          'http://example.org/hipaa/transmission_security'
        ];

        const hasTechnicalSafeguards = technicalSafeguards.some(prop => 
          resource.properties[prop] && resource.properties[prop].length > 0
        );

        if (!hasTechnicalSafeguards) {
          violations.push({
            code: 'HIPAA_MISSING_TECHNICAL_SAFEGUARDS',
            message: `PHI lacks technical safeguards: ${subjectUri}`,
            severity: 'error',
            complianceFramework: 'HIPAA',
            context: { subject: subjectUri }
          });
        }
      }
    }
  }

  /**
   * Validate minimum necessary standard
   * @private
   * @param {TurtleData} data - Turtle data
   * @param {ValidationError[]} violations - Violations array to populate
   */
  validateMinimumNecessary(data, violations) {
    for (const [subjectUri, resource] of Object.entries(data.subjects)) {
      if (this.containsPHI(resource)) {
        const purposeProp = 'http://purl.org/dc/terms/purpose';
        const purpose = resource.properties[purposeProp]?.[0];

        if (!purpose) {
          violations.push({
            code: 'HIPAA_MINIMUM_NECESSARY',
            message: `PHI access purpose not documented (minimum necessary): ${subjectUri}`,
            severity: 'warning',
            complianceFramework: 'HIPAA',
            context: { subject: subjectUri }
          });
        }
      }
    }
  }

  /**
   * Check if resource contains PHI
   * @private
   * @param {RDFResource} resource - RDF resource to check
   * @returns {boolean} True if contains PHI
   */
  containsPHI(resource) {
    const allValues = Object.values(resource.properties)
      .flat()
      .map(v => v.value.toLowerCase())
      .join(' ');

    return this.phiIndicators.some(indicator => 
      allValues.includes(indicator.toLowerCase())
    );
  }

  /**
   * Check if resource has encryption
   * @private
   * @param {RDFResource} resource - RDF resource to check
   * @returns {boolean} True if has encryption
   */
  hasEncryption(resource) {
    const encryptionProps = [
      'http://example.org/security/encrypted',
      'http://example.org/security/encryption_method'
    ];

    return encryptionProps.some(prop => 
      resource.properties[prop] && resource.properties[prop].length > 0
    );
  }

  /**
   * Check if resource has access controls
   * @private
   * @param {RDFResource} resource - RDF resource to check
   * @returns {boolean} True if has access controls
   */
  hasAccessControls(resource) {
    const accessControlProps = [
      'http://example.org/security/access_control',
      'http://example.org/security/role_based_access',
      'http://example.org/security/user_authentication'
    ];

    return accessControlProps.some(prop => 
      resource.properties[prop] && resource.properties[prop].length > 0
    );
  }
}

/**
 * SOX (Sarbanes-Oxley Act) validation rules
 * Focus: Financial reporting controls and audit trails
 */
export class SOXValidator {
  constructor() {
    /** @type {string[]} */
    this.financialIndicators = [
      // Financial data
      'revenue', 'expense', 'asset', 'liability', 'equity',
      'balance', 'income', 'cash_flow', 'profit', 'loss',
      // Financial controls
      'accounting', 'audit', 'financial_report', 'disclosure',
      'internal_control', 'financial_statement'
    ];
  }

  /**
   * Validate SOX compliance for turtle data
   * @param {TurtleData} data - Turtle data to validate
   * @returns {ValidationError[]} Array of validation errors
   */
  validate(data) {
    /** @type {ValidationError[]} */
    const violations = [];

    // 1. Financial Data Controls
    this.validateFinancialDataControls(data, violations);

    // 2. Audit Trail Requirements
    this.validateAuditTrails(data, violations);

    // 3. Internal Controls Documentation
    this.validateInternalControls(data, violations);

    // 4. Change Management Controls
    this.validateChangeManagement(data, violations);

    return violations;
  }

  /**
   * Validate financial data controls
   * @private
   * @param {TurtleData} data - Turtle data
   * @param {ValidationError[]} violations - Violations array to populate
   */
  validateFinancialDataControls(data, violations) {
    for (const [subjectUri, resource] of Object.entries(data.subjects)) {
      if (this.containsFinancialData(resource)) {
        const hasControls = this.hasInternalControls(resource);
        
        if (!hasControls) {
          violations.push({
            code: 'SOX_MISSING_CONTROLS',
            message: `Financial data lacks internal controls: ${subjectUri}`,
            severity: 'error',
            complianceFramework: 'SOX',
            context: { subject: subjectUri }
          });
        }

        const hasApproval = this.hasApprovalProcess(resource);
        if (!hasApproval) {
          violations.push({
            code: 'SOX_MISSING_APPROVAL',
            message: `Financial data lacks approval documentation: ${subjectUri}`,
            severity: 'error',
            complianceFramework: 'SOX',
            context: { subject: subjectUri }
          });
        }
      }
    }
  }

  /**
   * Validate audit trails
   * @private
   * @param {TurtleData} data - Turtle data
   * @param {ValidationError[]} violations - Violations array to populate
   */
  validateAuditTrails(data, violations) {
    for (const [subjectUri, resource] of Object.entries(data.subjects)) {
      if (this.containsFinancialData(resource)) {
        const auditTrailProps = [
          'http://purl.org/dc/terms/created',
          'http://purl.org/dc/terms/creator',
          'http://purl.org/dc/terms/modified',
          'http://example.org/sox/audit_trail'
        ];

        const hasAuditTrail = auditTrailProps.every(prop => 
          resource.properties[prop] && resource.properties[prop].length > 0
        );

        if (!hasAuditTrail) {
          violations.push({
            code: 'SOX_INCOMPLETE_AUDIT_TRAIL',
            message: `Incomplete audit trail for financial data: ${subjectUri}`,
            severity: 'error',
            complianceFramework: 'SOX',
            context: { subject: subjectUri, requiredProperties: auditTrailProps }
          });
        }
      }
    }
  }

  /**
   * Validate internal controls
   * @private
   * @param {TurtleData} data - Turtle data
   * @param {ValidationError[]} violations - Violations array to populate
   */
  validateInternalControls(data, violations) {
    const controlsProp = 'http://example.org/sox/internal_controls';
    let hasInternalControlsDoc = false;

    for (const resource of Object.values(data.subjects)) {
      if (resource.properties[controlsProp]) {
        hasInternalControlsDoc = true;
        break;
      }
    }

    if (!hasInternalControlsDoc) {
      violations.push({
        code: 'SOX_MISSING_INTERNAL_CONTROLS_DOC',
        message: 'Missing internal controls documentation',
        severity: 'error',
        complianceFramework: 'SOX'
      });
    }
  }

  /**
   * Validate change management
   * @private
   * @param {TurtleData} data - Turtle data
   * @param {ValidationError[]} violations - Violations array to populate
   */
  validateChangeManagement(data, violations) {
    for (const [subjectUri, resource] of Object.entries(data.subjects)) {
      if (this.containsFinancialData(resource)) {
        const changeProps = [
          'http://purl.org/dc/terms/modified',
          'http://example.org/sox/change_authorization',
          'http://example.org/sox/change_approval'
        ];

        const modifiedProp = resource.properties['http://purl.org/dc/terms/modified'];
        
        if (modifiedProp && modifiedProp.length > 0) {
          const hasChangeControls = changeProps.slice(1).some(prop => 
            resource.properties[prop] && resource.properties[prop].length > 0
          );

          if (!hasChangeControls) {
            violations.push({
              code: 'SOX_UNAUTHORIZED_CHANGES',
              message: `Financial data changes lack proper authorization: ${subjectUri}`,
              severity: 'error',
              complianceFramework: 'SOX',
              context: { subject: subjectUri }
            });
          }
        }
      }
    }
  }

  /**
   * Check if resource contains financial data
   * @private
   * @param {RDFResource} resource - RDF resource to check
   * @returns {boolean} True if contains financial data
   */
  containsFinancialData(resource) {
    const allValues = Object.values(resource.properties)
      .flat()
      .map(v => v.value.toLowerCase())
      .join(' ');

    const allKeys = Object.keys(resource.properties)
      .map(k => k.toLowerCase())
      .join(' ');

    const searchText = `${allValues} ${allKeys}`;

    return this.financialIndicators.some(indicator => 
      searchText.includes(indicator.toLowerCase())
    );
  }

  /**
   * Check if resource has internal controls
   * @private
   * @param {RDFResource} resource - RDF resource to check
   * @returns {boolean} True if has internal controls
   */
  hasInternalControls(resource) {
    const controlProps = [
      'http://example.org/sox/internal_controls',
      'http://example.org/sox/control_procedures',
      'http://example.org/security/access_control'
    ];

    return controlProps.some(prop => 
      resource.properties[prop] && resource.properties[prop].length > 0
    );
  }

  /**
   * Check if resource has approval process
   * @private
   * @param {RDFResource} resource - RDF resource to check
   * @returns {boolean} True if has approval process
   */
  hasApprovalProcess(resource) {
    const approvalProps = [
      'http://example.org/sox/approved_by',
      'http://example.org/sox/approval_date',
      'http://example.org/workflow/approval_status'
    ];

    return approvalProps.some(prop => 
      resource.properties[prop] && resource.properties[prop].length > 0
    );
  }
}

/**
 * Main compliance rules registry
 */
export const ComplianceRules = {
  GDPR: new GDPRValidator(),
  HIPAA: new HIPAAValidator(),
  SOX: new SOXValidator()
};

/**
 * @typedef {'GDPR'|'HIPAA'|'SOX'} ComplianceFramework
 */