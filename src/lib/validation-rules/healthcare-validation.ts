/**
 * Healthcare Validation Rules
 * FHIR R4 compliance, HIPAA PHI protection, HL7 standards
 * FDA 21 CFR Part 11 compliance for pharmaceutical data
 */

import { Store, DataFactory, NamedNode, Literal } from 'n3';
import { ValidationContext, ComplianceStatus, ValidationResult, ValidationError, ValidationWarning } from '../semantic-validator';

const { namedNode, literal } = DataFactory;

// FHIR R4 Resource Types
const FHIR_RESOURCE_TYPES = [
  'Patient', 'Practitioner', 'Organization', 'Observation', 'Condition',
  'Medication', 'MedicationRequest', 'DiagnosticReport', 'Procedure',
  'Encounter', 'AllergyIntolerance', 'Immunization', 'CarePlan',
  'ClinicalImpression', 'Goal', 'RiskAssessment', 'Device', 'Specimen'
];

// PHI Data Elements (HIPAA Safe Harbor)
const PHI_ELEMENTS = [
  'name', 'address', 'birthDate', 'deathDate', 'ssn', 'mrn',
  'accountNumber', 'certificateNumber', 'vehicleNumber', 'deviceId',
  'webUrl', 'ipAddress', 'biometricId', 'photoImage', 'email',
  'phone', 'fax'
];

// HL7 Required Extensions
const HL7_EXTENSIONS = {
  US_CORE: 'http://hl7.org/fhir/us/core/StructureDefinition/',
  PATIENT_RACE: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race',
  PATIENT_ETHNICITY: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity',
  BIRTH_SEX: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex'
};

export class HealthcareValidator {
  private store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  /**
   * Validate FHIR R4 compliance
   */
  async validateFHIRCompliance(context: ValidationContext): Promise<ComplianceStatus> {
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Validate FHIR resource structure
    const resourceViolations = await this.validateFHIRResources();
    violations.push(...resourceViolations);

    // Validate required FHIR elements
    const elementViolations = await this.validateRequiredFHIRElements();
    violations.push(...elementViolations);

    // Validate FHIR cardinality constraints
    const cardinalityViolations = await this.validateFHIRCardinality();
    violations.push(...cardinalityViolations);

    // Validate FHIR terminology bindings
    const terminologyViolations = await this.validateFHIRTerminology();
    violations.push(...terminologyViolations);

    // US Core profile validation
    const usCoreViolations = await this.validateUSCoreProfiles();
    violations.push(...usCoreViolations);

    return {
      framework: 'FHIR_R4',
      status: violations.length === 0 ? 'compliant' : 'non-compliant',
      violationCount: violations.length,
      criticalViolations: violations,
      recommendedActions: [
        'Update to FHIR R4.0.1 specification',
        'Implement required US Core profiles',
        'Validate against FHIR StructureDefinitions',
        'Use standard FHIR terminologies (SNOMED CT, LOINC, RxNorm)',
        'Implement proper resource references'
      ]
    };
  }

  /**
   * Validate HIPAA PHI protection
   */
  async validateHIPAACompliance(context: ValidationContext): Promise<ComplianceStatus> {
    const violations: string[] = [];

    // Check for exposed PHI elements
    const phiExposures = await this.detectPHIExposure();
    violations.push(...phiExposures);

    // Validate encryption requirements
    const encryptionViolations = await this.validateEncryptionRequirements();
    violations.push(...encryptionViolations);

    // Check access control annotations
    const accessViolations = await this.validateAccessControls();
    violations.push(...accessViolations);

    // Validate audit trail requirements
    const auditViolations = await this.validateAuditRequirements();
    violations.push(...auditViolations);

    // Check minimum necessary standard
    const minimumNecessaryViolations = await this.validateMinimumNecessary();
    violations.push(...minimumNecessaryViolations);

    return {
      framework: 'HIPAA',
      status: violations.length === 0 ? 'compliant' : 'non-compliant',
      violationCount: violations.length,
      criticalViolations: violations,
      recommendedActions: [
        'Implement PHI encryption at rest and in transit',
        'Add proper access control annotations',
        'Implement comprehensive audit logging',
        'Apply de-identification techniques where possible',
        'Implement role-based access controls (RBAC)',
        'Add data loss prevention (DLP) controls'
      ]
    };
  }

  /**
   * Validate FDA 21 CFR Part 11 compliance for pharmaceutical data
   */
  async validateFDA21CFRPart11(context: ValidationContext): Promise<ComplianceStatus> {
    const violations: string[] = [];

    // Validate electronic signature requirements
    const signatureViolations = await this.validateElectronicSignatures();
    violations.push(...signatureViolations);

    // Check record integrity
    const integrityViolations = await this.validateRecordIntegrity();
    violations.push(...integrityViolations);

    // Validate audit trail completeness
    const auditViolations = await this.validateCFRAuditTrail();
    violations.push(...auditViolations);

    // Check system access controls
    const accessViolations = await this.validateCFRAccessControls();
    violations.push(...accessViolations);

    return {
      framework: 'FDA_21_CFR_PART_11',
      status: violations.length === 0 ? 'compliant' : 'non-compliant',
      violationCount: violations.length,
      criticalViolations: violations,
      recommendedActions: [
        'Implement qualified electronic signatures',
        'Add comprehensive audit trails',
        'Implement record retention policies',
        'Add data integrity validation',
        'Implement proper access controls and user authentication'
      ]
    };
  }

  /**
   * Validate FHIR resource structures
   */
  private async validateFHIRResources(): Promise<string[]> {
    const violations: string[] = [];

    // Check for FHIR resource type declarations
    const resourceTypeQuads = this.store.getQuads(
      null,
      namedNode('http://hl7.org/fhir/resource-type'),
      null,
      null
    );

    for (const quad of resourceTypeQuads) {
      const resourceType = (quad.object as Literal).value;
      
      if (!FHIR_RESOURCE_TYPES.includes(resourceType)) {
        violations.push(`Invalid FHIR resource type: ${resourceType}`);
      }

      // Validate required resource elements
      const resourceId = quad.subject.value;
      if (!this.hasRequiredFHIRElements(resourceId, resourceType)) {
        violations.push(`Missing required elements for FHIR ${resourceType}: ${resourceId}`);
      }
    }

    return violations;
  }

  /**
   * Validate required FHIR elements
   */
  private async validateRequiredFHIRElements(): Promise<string[]> {
    const violations: string[] = [];

    // Patient resource validation
    const patientResources = this.store.getQuads(
      null,
      namedNode('http://hl7.org/fhir/resource-type'),
      literal('Patient'),
      null
    );

    for (const patientQuad of patientResources) {
      const patientId = patientQuad.subject.value;
      
      // Check required Patient elements
      if (!this.hasElement(patientId, 'http://hl7.org/fhir/Patient.identifier')) {
        violations.push(`Patient resource missing required identifier: ${patientId}`);
      }

      if (!this.hasElement(patientId, 'http://hl7.org/fhir/Patient.active')) {
        violations.push(`Patient resource missing required active status: ${patientId}`);
      }
    }

    return violations;
  }

  /**
   * Validate FHIR cardinality constraints
   */
  private async validateFHIRCardinality(): Promise<string[]> {
    const violations: string[] = [];

    // Example: Patient can have 0..* identifiers but must have at least one
    const patientResources = this.store.getQuads(
      null,
      namedNode('http://hl7.org/fhir/resource-type'),
      literal('Patient'),
      null
    );

    for (const patientQuad of patientResources) {
      const patientId = patientQuad.subject.value;
      const identifiers = this.store.getQuads(
        namedNode(patientId),
        namedNode('http://hl7.org/fhir/Patient.identifier'),
        null,
        null
      );

      if (identifiers.length === 0) {
        violations.push(`Patient must have at least one identifier: ${patientId}`);
      }
    }

    return violations;
  }

  /**
   * Validate FHIR terminology bindings
   */
  private async validateFHIRTerminology(): Promise<string[]> {
    const violations: string[] = [];

    // Check for proper code system usage
    const codingQuads = this.store.getQuads(
      null,
      namedNode('http://hl7.org/fhir/Coding.system'),
      null,
      null
    );

    const validCodeSystems = [
      'http://snomed.info/sct',          // SNOMED CT
      'http://loinc.org',                // LOINC
      'http://www.nlm.nih.gov/research/umls/rxnorm', // RxNorm
      'http://hl7.org/fhir/administrative-gender',   // Gender
      'http://terminology.hl7.org/CodeSystem/condition-clinical' // Condition status
    ];

    for (const quad of codingQuads) {
      const codeSystem = (quad.object as Literal).value;
      
      if (!validCodeSystems.some(valid => codeSystem.startsWith(valid))) {
        violations.push(`Non-standard code system used: ${codeSystem}`);
      }
    }

    return violations;
  }

  /**
   * Validate US Core profiles
   */
  private async validateUSCoreProfiles(): Promise<string[]> {
    const violations: string[] = [];

    // Check for required US Core extensions on Patient resources
    const patientResources = this.store.getQuads(
      null,
      namedNode('http://hl7.org/fhir/resource-type'),
      literal('Patient'),
      null
    );

    for (const patientQuad of patientResources) {
      const patientId = patientQuad.subject.value;

      // Check for race extension (required for US Core Patient)
      if (!this.hasExtension(patientId, HL7_EXTENSIONS.PATIENT_RACE)) {
        violations.push(`US Core Patient missing race extension: ${patientId}`);
      }

      // Check for ethnicity extension (required for US Core Patient)
      if (!this.hasExtension(patientId, HL7_EXTENSIONS.PATIENT_ETHNICITY)) {
        violations.push(`US Core Patient missing ethnicity extension: ${patientId}`);
      }
    }

    return violations;
  }

  /**
   * Detect PHI exposure
   */
  private async detectPHIExposure(): Promise<string[]> {
    const violations: string[] = [];

    for (const phiElement of PHI_ELEMENTS) {
      // Check for unencrypted PHI
      const phiQuads = this.store.getQuads(
        null,
        namedNode(`http://hl7.org/fhir/${phiElement}`),
        null,
        null
      );

      for (const quad of phiQuads) {
        // Check if value is encrypted or anonymized
        const value = (quad.object as Literal).value;
        
        if (this.containsPotentialPHI(value) && !this.isEncryptedOrAnonymized(value)) {
          violations.push(`Potential PHI exposure in ${phiElement}: ${quad.subject.value}`);
        }
      }
    }

    return violations;
  }

  /**
   * Validate encryption requirements
   */
  private async validateEncryptionRequirements(): Promise<string[]> {
    const violations: string[] = [];

    // Check for encryption metadata
    const encryptionQuads = this.store.getQuads(
      null,
      namedNode('http://healthcare.security/encryption-status'),
      null,
      null
    );

    if (encryptionQuads.length === 0) {
      violations.push('No encryption metadata found - HIPAA requires encryption for PHI');
    }

    return violations;
  }

  /**
   * Validate access controls
   */
  private async validateAccessControls(): Promise<string[]> {
    const violations: string[] = [];

    // Check for access control annotations
    const accessControlQuads = this.store.getQuads(
      null,
      namedNode('http://healthcare.security/access-level'),
      null,
      null
    );

    if (accessControlQuads.length === 0) {
      violations.push('No access control annotations found - HIPAA requires proper access controls');
    }

    return violations;
  }

  /**
   * Validate audit requirements
   */
  private async validateAuditRequirements(): Promise<string[]> {
    const violations: string[] = [];

    // Check for audit trail metadata
    const auditQuads = this.store.getQuads(
      null,
      namedNode('http://healthcare.audit/audit-trail'),
      null,
      null
    );

    if (auditQuads.length === 0) {
      violations.push('No audit trail metadata found - HIPAA requires comprehensive audit logging');
    }

    return violations;
  }

  /**
   * Validate minimum necessary standard
   */
  private async validateMinimumNecessary(): Promise<string[]> {
    const violations: string[] = [];

    // Check for justification of PHI use
    const justificationQuads = this.store.getQuads(
      null,
      namedNode('http://healthcare.compliance/minimum-necessary-justification'),
      null,
      null
    );

    const phiQuads = this.store.getQuads(
      null,
      namedNode('http://healthcare.data/contains-phi'),
      literal('true'),
      null
    );

    if (phiQuads.length > 0 && justificationQuads.length === 0) {
      violations.push('PHI usage without minimum necessary justification violates HIPAA');
    }

    return violations;
  }

  /**
   * Validate electronic signatures for FDA compliance
   */
  private async validateElectronicSignatures(): Promise<string[]> {
    const violations: string[] = [];

    // Check for electronic signature metadata
    const signatureQuads = this.store.getQuads(
      null,
      namedNode('http://fda.compliance/electronic-signature'),
      null,
      null
    );

    for (const quad of signatureQuads) {
      const signatureId = quad.object.value;
      
      // Validate signature components
      if (!this.hasValidSignatureComponents(signatureId)) {
        violations.push(`Invalid electronic signature components: ${signatureId}`);
      }
    }

    return violations;
  }

  /**
   * Validate record integrity for FDA compliance
   */
  private async validateRecordIntegrity(): Promise<string[]> {
    const violations: string[] = [];

    // Check for integrity hashes
    const integrityQuads = this.store.getQuads(
      null,
      namedNode('http://fda.compliance/integrity-hash'),
      null,
      null
    );

    if (integrityQuads.length === 0) {
      violations.push('No integrity validation found - FDA 21 CFR Part 11 requires record integrity protection');
    }

    return violations;
  }

  /**
   * Validate CFR audit trail requirements
   */
  private async validateCFRAuditTrail(): Promise<string[]> {
    const violations: string[] = [];

    // More stringent audit requirements than HIPAA
    const auditQuads = this.store.getQuads(
      null,
      namedNode('http://fda.compliance/audit-trail'),
      null,
      null
    );

    for (const quad of auditQuads) {
      const auditRecord = quad.subject.value;
      
      // Check required audit elements
      const requiredElements = [
        'timestamp', 'user-id', 'action', 'record-id', 'reason'
      ];

      for (const element of requiredElements) {
        if (!this.hasElement(auditRecord, `http://fda.compliance/audit-${element}`)) {
          violations.push(`Missing required audit element ${element} in record: ${auditRecord}`);
        }
      }
    }

    return violations;
  }

  /**
   * Validate CFR access controls
   */
  private async validateCFRAccessControls(): Promise<string[]> {
    const violations: string[] = [];

    // Check for user authentication requirements
    const authQuads = this.store.getQuads(
      null,
      namedNode('http://fda.compliance/user-authentication'),
      null,
      null
    );

    if (authQuads.length === 0) {
      violations.push('No user authentication controls found - FDA 21 CFR Part 11 requires proper authentication');
    }

    return violations;
  }

  // Helper methods
  private hasRequiredFHIRElements(resourceId: string, resourceType: string): boolean {
    // Simplified check - would be more comprehensive in real implementation
    return this.hasElement(resourceId, 'http://hl7.org/fhir/Resource.id');
  }

  private hasElement(subjectId: string, predicate: string): boolean {
    const quads = this.store.getQuads(
      namedNode(subjectId),
      namedNode(predicate),
      null,
      null
    );
    return quads.length > 0;
  }

  private hasExtension(resourceId: string, extensionUrl: string): boolean {
    const extensionQuads = this.store.getQuads(
      namedNode(resourceId),
      namedNode('http://hl7.org/fhir/extension'),
      null,
      null
    );

    for (const quad of extensionQuads) {
      const extensionId = quad.object.value;
      const urlQuads = this.store.getQuads(
        namedNode(extensionId),
        namedNode('http://hl7.org/fhir/Extension.url'),
        literal(extensionUrl),
        null
      );
      
      if (urlQuads.length > 0) {
        return true;
      }
    }

    return false;
  }

  private containsPotentialPHI(value: string): boolean {
    // Simple heuristics for PHI detection
    const patterns = [
      /\d{3}-\d{2}-\d{4}/, // SSN pattern
      /\d{3}-\d{3}-\d{4}/, // Phone pattern
      /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email pattern
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/ // IP address pattern
    ];

    return patterns.some(pattern => pattern.test(value));
  }

  private isEncryptedOrAnonymized(value: string): boolean {
    // Check for encryption markers or anonymization patterns
    return value.includes('[ENCRYPTED]') || 
           value.includes('[ANONYMIZED]') ||
           value.startsWith('****') ||
           /^[A-Fa-f0-9]{32,}$/.test(value); // Hex string (potential hash)
  }

  private hasValidSignatureComponents(signatureId: string): boolean {
    const requiredComponents = [
      'http://fda.compliance/signature-user-id',
      'http://fda.compliance/signature-timestamp',
      'http://fda.compliance/signature-meaning'
    ];

    return requiredComponents.every(component => 
      this.hasElement(signatureId, component)
    );
  }
}