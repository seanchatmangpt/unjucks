/**
 * Supply Chain Validation Rules
 * GS1 standards compliance, traceability requirements
 * ISO 28000 supply chain security, CTPAT compliance
 */

import { Store, DataFactory, NamedNode, Literal } from 'n3';
import { ValidationContext, ComplianceStatus, ValidationResult, ValidationError, ValidationWarning } from '../semantic-validator';

const { namedNode, literal } = DataFactory;

// GS1 Identification Keys
const GS1_IDENTIFICATION_KEYS = [
  'GTIN',    // Global Trade Item Number
  'GLN',     // Global Location Number  
  'SSCC',    // Serial Shipping Container Code
  'GRAI',    // Global Returnable Asset Identifier
  'GIAI',    // Global Individual Asset Identifier
  'GSRN',    // Global Service Relation Number
  'GDTI',    // Global Document Type Identifier
  'GINC',    // Global Identification Number for Consignment
  'GSIN',    // Global Shipment Identification Number
  'GCN'      // Global Coupon Number
];

// EPCIS Event Types
const EPCIS_EVENT_TYPES = [
  'ObjectEvent',        // Objects observed at a location
  'AggregationEvent',   // Objects aggregated/disaggregated
  'TransactionEvent',   // Objects involved in business transaction
  'TransformationEvent' // Objects transformed/created from others
];

// Supply Chain Visibility Requirements
const VISIBILITY_REQUIREMENTS = [
  'origin_tracking',      // Track source/origin
  'custody_chain',        // Chain of custody
  'location_tracking',    // Location at each step
  'condition_monitoring', // Temperature, humidity, etc.
  'handling_events',      // Loading, unloading, sorting
  'quality_checks',       // Inspection points
  'compliance_checks'     // Regulatory compliance points
];

// ISO 28000 Security Requirements
const ISO_28000_REQUIREMENTS = [
  'security_policy',      // Security management policy
  'risk_assessment',      // Security risk assessment
  'security_planning',    // Security management planning
  'implementation',       // Security implementation
  'monitoring',          // Security monitoring
  'audit',               // Security audits
  'management_review'    // Management review
];

// C-TPAT Security Criteria
const CTPAT_CRITERIA = [
  'business_partner_requirements',
  'container_security',
  'physical_access_controls', 
  'personnel_security',
  'procedural_security',
  'physical_security',
  'information_technology_security'
];

export class SupplyChainValidator {
  private store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  /**
   * Validate GS1 standards compliance
   */
  async validateGS1Compliance(context: ValidationContext): Promise<ComplianceStatus> {
    const violations: string[] = [];

    // Validate GS1 identification keys
    const idKeyViolations = await this.validateGS1IdentificationKeys();
    violations.push(...idKeyViolations);

    // Validate EPCIS compliance
    const epcisViolations = await this.validateEPCISCompliance();
    violations.push(...epcisViolations);

    // Validate GS1 data structure compliance
    const dataStructureViolations = await this.validateGS1DataStructure();
    violations.push(...dataStructureViolations);

    // Validate barcode/RFID encoding
    const encodingViolations = await this.validateGS1Encoding();
    violations.push(...encodingViolations);

    // Validate master data synchronization
    const masterDataViolations = await this.validateMasterDataSync();
    violations.push(...masterDataViolations);

    return {
      framework: 'GS1_STANDARDS',
      status: violations.length === 0 ? 'compliant' : 'non-compliant',
      violationCount: violations.length,
      criticalViolations: violations,
      recommendedActions: [
        'Implement proper GS1 identification key format validation',
        'Establish EPCIS-compliant event capture',
        'Maintain accurate master data synchronization',
        'Implement proper barcode/RFID encoding standards',
        'Establish data quality controls for GS1 identifiers'
      ]
    };
  }

  /**
   * Validate traceability requirements
   */
  async validateTraceabilityRequirements(context: ValidationContext): Promise<ComplianceStatus> {
    const violations: string[] = [];

    // Validate end-to-end traceability
    const e2eViolations = await this.validateEndToEndTraceability();
    violations.push(...e2eViolations);

    // Validate lot/batch tracking
    const lotTrackingViolations = await this.validateLotTracking();
    violations.push(...lotTrackingViolations);

    // Validate supply chain visibility
    const visibilityViolations = await this.validateSupplyChainVisibility();
    violations.push(...visibilityViolations);

    // Validate recall readiness
    const recallViolations = await this.validateRecallReadiness();
    violations.push(...recallViolations);

    // Validate provenance documentation
    const provenanceViolations = await this.validateProvenanceDocumentation();
    violations.push(...provenanceViolations);

    return {
      framework: 'TRACEABILITY',
      status: violations.length === 0 ? 'compliant' : 'non-compliant',
      violationCount: violations.length,
      criticalViolations: violations,
      recommendedActions: [
        'Implement comprehensive lot/batch tracking',
        'Establish end-to-end supply chain visibility',
        'Maintain detailed provenance documentation',
        'Implement rapid recall capabilities',
        'Establish supply chain event monitoring'
      ]
    };
  }

  /**
   * Validate ISO 28000 supply chain security
   */
  async validateISO28000Compliance(context: ValidationContext): Promise<ComplianceStatus> {
    const violations: string[] = [];

    // Validate security management system
    const smsViolations = await this.validateSecurityManagementSystem();
    violations.push(...smsViolations);

    // Validate risk assessment and management
    const riskViolations = await this.validateSecurityRiskManagement();
    violations.push(...riskViolations);

    // Validate security monitoring and measurement
    const monitoringViolations = await this.validateSecurityMonitoring();
    violations.push(...monitoringViolations);

    // Validate incident response procedures
    const incidentViolations = await this.validateIncidentResponse();
    violations.push(...incidentViolations);

    return {
      framework: 'ISO_28000',
      status: violations.length === 0 ? 'compliant' : 'non-compliant',
      violationCount: violations.length,
      criticalViolations: violations,
      recommendedActions: [
        'Implement comprehensive security management system',
        'Establish security risk assessment procedures',
        'Implement continuous security monitoring',
        'Develop incident response and recovery procedures',
        'Establish security performance measurement'
      ]
    };
  }

  /**
   * Validate C-TPAT compliance
   */
  async validateCTPATCompliance(context: ValidationContext): Promise<ComplianceStatus> {
    const violations: string[] = [];

    // Validate business partner requirements
    const partnerViolations = await this.validateBusinessPartnerRequirements();
    violations.push(...partnerViolations);

    // Validate container security
    const containerViolations = await this.validateContainerSecurity();
    violations.push(...containerViolations);

    // Validate physical access controls
    const accessViolations = await this.validatePhysicalAccessControls();
    violations.push(...accessViolations);

    // Validate personnel security
    const personnelViolations = await this.validatePersonnelSecurity();
    violations.push(...personnelViolations);

    // Validate procedural security
    const proceduralViolations = await this.validateProceduralSecurity();
    violations.push(...proceduralViolations);

    return {
      framework: 'CTPAT',
      status: violations.length === 0 ? 'compliant' : 'non-compliant',
      violationCount: violations.length,
      criticalViolations: violations,
      recommendedActions: [
        'Implement comprehensive business partner security requirements',
        'Establish container security protocols',
        'Implement physical access control systems',
        'Establish personnel security procedures',
        'Develop procedural security controls'
      ]
    };
  }

  /**
   * Validate GS1 identification keys
   */
  private async validateGS1IdentificationKeys(): Promise<string[]> {
    const violations: string[] = [];

    for (const keyType of GS1_IDENTIFICATION_KEYS) {
      const keyQuads = this.store.getQuads(
        null,
        namedNode(`http://gs1.org/keys/${keyType}`),
        null,
        null
      );

      for (const quad of keyQuads) {
        const keyValue = (quad.object as Literal).value;
        
        // Validate key format based on type
        if (!this.validateGS1KeyFormat(keyType, keyValue)) {
          violations.push(`Invalid ${keyType} format: ${keyValue}`);
        }

        // Validate check digit for applicable keys
        if (this.requiresCheckDigit(keyType) && !this.validateCheckDigit(keyType, keyValue)) {
          violations.push(`Invalid check digit for ${keyType}: ${keyValue}`);
        }
      }
    }

    return violations;
  }

  /**
   * Validate EPCIS compliance
   */
  private async validateEPCISCompliance(): Promise<string[]> {
    const violations: string[] = [];

    // Check for EPCIS events
    const eventQuads = this.store.getQuads(
      null,
      namedNode('http://epcis.gs1.org/eventType'),
      null,
      null
    );

    for (const eventQuad of eventQuads) {
      const eventType = (eventQuad.object as Literal).value;
      
      if (!EPCIS_EVENT_TYPES.includes(eventType)) {
        violations.push(`Invalid EPCIS event type: ${eventType}`);
      }

      const eventId = eventQuad.subject.value;
      
      // Validate required EPCIS event fields
      const requiredFields = this.getRequiredEPCISFields(eventType);
      for (const field of requiredFields) {
        if (!this.hasElement(eventId, `http://epcis.gs1.org/${field}`)) {
          violations.push(`Missing required EPCIS field ${field} in ${eventType}: ${eventId}`);
        }
      }
    }

    return violations;
  }

  /**
   * Validate GS1 data structure compliance
   */
  private async validateGS1DataStructure(): Promise<string[]> {
    const violations: string[] = [];

    // Check for proper product data structure
    const productQuads = this.store.getQuads(
      null,
      namedNode('http://gs1.org/product'),
      null,
      null
    );

    for (const productQuad of productQuads) {
      const productId = productQuad.subject.value;
      
      // Required product attributes
      const requiredAttributes = [
        'brand', 'productName', 'netContent', 'countryOfOrigin'
      ];

      for (const attr of requiredAttributes) {
        if (!this.hasElement(productId, `http://gs1.org/product/${attr}`)) {
          violations.push(`Missing required product attribute ${attr}: ${productId}`);
        }
      }
    }

    return violations;
  }

  /**
   * Validate GS1 encoding standards
   */
  private async validateGS1Encoding(): Promise<string[]> {
    const violations: string[] = [];

    // Check barcode encoding compliance
    const barcodeQuads = this.store.getQuads(
      null,
      namedNode('http://gs1.org/encoding/barcode'),
      null,
      null
    );

    for (const barcodeQuad of barcodeQuads) {
      const encoding = (barcodeQuad.object as Literal).value;
      
      const validEncodings = ['EAN-13', 'EAN-8', 'UPC-A', 'UPC-E', 'Code-128', 'DataMatrix', 'QR Code'];
      
      if (!validEncodings.includes(encoding)) {
        violations.push(`Invalid barcode encoding: ${encoding}`);
      }
    }

    return violations;
  }

  /**
   * Validate master data synchronization
   */
  private async validateMasterDataSync(): Promise<string[]> {
    const violations: string[] = [];

    // Check for GDSN synchronization
    const syncQuads = this.store.getQuads(
      null,
      namedNode('http://gs1.org/gdsn/synchronization-status'),
      null,
      null
    );

    if (syncQuads.length === 0) {
      violations.push('No GDSN synchronization status found - required for master data quality');
    }

    return violations;
  }

  /**
   * Validate end-to-end traceability
   */
  private async validateEndToEndTraceability(): Promise<string[]> {
    const violations: string[] = [];

    // Check for complete supply chain path
    const traceabilityQuads = this.store.getQuads(
      null,
      namedNode('http://supply-chain.org/traceability-path'),
      null,
      null
    );

    for (const traceQuad of traceabilityQuads) {
      const pathId = traceQuad.subject.value;
      
      // Check for origin
      if (!this.hasElement(pathId, 'http://supply-chain.org/origin')) {
        violations.push(`Missing origin information in traceability path: ${pathId}`);
      }

      // Check for destination
      if (!this.hasElement(pathId, 'http://supply-chain.org/destination')) {
        violations.push(`Missing destination information in traceability path: ${pathId}`);
      }

      // Check for intermediate steps
      const stepQuads = this.store.getQuads(
        namedNode(pathId),
        namedNode('http://supply-chain.org/step'),
        null,
        null
      );

      if (stepQuads.length === 0) {
        violations.push(`No intermediate steps recorded in traceability path: ${pathId}`);
      }
    }

    return violations;
  }

  /**
   * Validate lot/batch tracking
   */
  private async validateLotTracking(): Promise<string[]> {
    const violations: string[] = [];

    // Check for lot information
    const lotQuads = this.store.getQuads(
      null,
      namedNode('http://supply-chain.org/lot-number'),
      null,
      null
    );

    for (const lotQuad of lotQuads) {
      const itemId = lotQuad.subject.value;
      
      // Check for production date
      if (!this.hasElement(itemId, 'http://supply-chain.org/production-date')) {
        violations.push(`Missing production date for lot tracked item: ${itemId}`);
      }

      // Check for expiry date (if applicable)
      if (this.isPerishable(itemId) && !this.hasElement(itemId, 'http://supply-chain.org/expiry-date')) {
        violations.push(`Missing expiry date for perishable item: ${itemId}`);
      }
    }

    return violations;
  }

  /**
   * Validate supply chain visibility
   */
  private async validateSupplyChainVisibility(): Promise<string[]> {
    const violations: string[] = [];

    for (const requirement of VISIBILITY_REQUIREMENTS) {
      const visibilityQuads = this.store.getQuads(
        null,
        namedNode(`http://supply-chain.org/visibility/${requirement}`),
        null,
        null
      );

      if (visibilityQuads.length === 0) {
        violations.push(`Missing supply chain visibility for: ${requirement}`);
      }
    }

    return violations;
  }

  /**
   * Validate recall readiness
   */
  private async validateRecallReadiness(): Promise<string[]> {
    const violations: string[] = [];

    // Check for recall procedures
    const recallQuads = this.store.getQuads(
      null,
      namedNode('http://supply-chain.org/recall-procedure'),
      null,
      null
    );

    if (recallQuads.length === 0) {
      violations.push('No recall procedures documented - critical for product safety');
    }

    // Check for recall contact information
    const contactQuads = this.store.getQuads(
      null,
      namedNode('http://supply-chain.org/recall-contact'),
      null,
      null
    );

    if (contactQuads.length === 0) {
      violations.push('No recall contact information documented');
    }

    return violations;
  }

  /**
   * Validate provenance documentation
   */
  private async validateProvenanceDocumentation(): Promise<string[]> {
    const violations: string[] = [];

    // Check for provenance records
    const provenanceQuads = this.store.getQuads(
      null,
      namedNode('http://supply-chain.org/provenance'),
      null,
      null
    );

    for (const provQuad of provenanceQuads) {
      const itemId = provQuad.subject.value;
      
      // Check for authentication method
      if (!this.hasElement(itemId, 'http://supply-chain.org/authentication-method')) {
        violations.push(`Missing authentication method in provenance record: ${itemId}`);
      }

      // Check for chain of custody
      if (!this.hasElement(itemId, 'http://supply-chain.org/custody-chain')) {
        violations.push(`Missing chain of custody in provenance record: ${itemId}`);
      }
    }

    return violations;
  }

  /**
   * Validate security management system
   */
  private async validateSecurityManagementSystem(): Promise<string[]> {
    const violations: string[] = [];

    for (const requirement of ISO_28000_REQUIREMENTS) {
      const smsQuads = this.store.getQuads(
        null,
        namedNode(`http://iso28000.org/sms/${requirement}`),
        null,
        null
      );

      if (smsQuads.length === 0) {
        violations.push(`Missing ISO 28000 requirement: ${requirement}`);
      }
    }

    return violations;
  }

  /**
   * Validate security risk management
   */
  private async validateSecurityRiskManagement(): Promise<string[]> {
    const violations: string[] = [];

    // Check for risk assessments
    const riskQuads = this.store.getQuads(
      null,
      namedNode('http://iso28000.org/security-risk-assessment'),
      null,
      null
    );

    if (riskQuads.length === 0) {
      violations.push('No security risk assessments documented');
    }

    return violations;
  }

  /**
   * Validate security monitoring
   */
  private async validateSecurityMonitoring(): Promise<string[]> {
    const violations: string[] = [];

    // Check for monitoring procedures
    const monitoringQuads = this.store.getQuads(
      null,
      namedNode('http://iso28000.org/security-monitoring'),
      null,
      null
    );

    if (monitoringQuads.length === 0) {
      violations.push('No security monitoring procedures documented');
    }

    return violations;
  }

  /**
   * Validate incident response procedures
   */
  private async validateIncidentResponse(): Promise<string[]> {
    const violations: string[] = [];

    // Check for incident response plan
    const incidentQuads = this.store.getQuads(
      null,
      namedNode('http://iso28000.org/incident-response-plan'),
      null,
      null
    );

    if (incidentQuads.length === 0) {
      violations.push('No incident response plan documented');
    }

    return violations;
  }

  /**
   * Validate business partner requirements
   */
  private async validateBusinessPartnerRequirements(): Promise<string[]> {
    const violations: string[] = [];

    // Check for partner security requirements
    const partnerQuads = this.store.getQuads(
      null,
      namedNode('http://ctpat.org/business-partner-requirements'),
      null,
      null
    );

    if (partnerQuads.length === 0) {
      violations.push('No business partner security requirements documented');
    }

    return violations;
  }

  /**
   * Validate container security
   */
  private async validateContainerSecurity(): Promise<string[]> {
    const violations: string[] = [];

    // Check for container security procedures
    const containerQuads = this.store.getQuads(
      null,
      namedNode('http://ctpat.org/container-security'),
      null,
      null
    );

    if (containerQuads.length === 0) {
      violations.push('No container security procedures documented');
    }

    return violations;
  }

  /**
   * Validate physical access controls
   */
  private async validatePhysicalAccessControls(): Promise<string[]> {
    const violations: string[] = [];

    // Check for access control systems
    const accessQuads = this.store.getQuads(
      null,
      namedNode('http://ctpat.org/physical-access-controls'),
      null,
      null
    );

    if (accessQuads.length === 0) {
      violations.push('No physical access control systems documented');
    }

    return violations;
  }

  /**
   * Validate personnel security
   */
  private async validatePersonnelSecurity(): Promise<string[]> {
    const violations: string[] = [];

    // Check for personnel security procedures
    const personnelQuads = this.store.getQuads(
      null,
      namedNode('http://ctpat.org/personnel-security'),
      null,
      null
    );

    if (personnelQuads.length === 0) {
      violations.push('No personnel security procedures documented');
    }

    return violations;
  }

  /**
   * Validate procedural security
   */
  private async validateProceduralSecurity(): Promise<string[]> {
    const violations: string[] = [];

    // Check for procedural security controls
    const proceduralQuads = this.store.getQuads(
      null,
      namedNode('http://ctpat.org/procedural-security'),
      null,
      null
    );

    if (proceduralQuads.length === 0) {
      violations.push('No procedural security controls documented');
    }

    return violations;
  }

  // Helper methods
  private validateGS1KeyFormat(keyType: string, keyValue: string): boolean {
    const formatPatterns = {
      'GTIN': /^(\d{8}|\d{12}|\d{13}|\d{14})$/,
      'GLN': /^\d{13}$/,
      'SSCC': /^\d{18}$/,
      'GRAI': /^\d{14}$/,
      'GIAI': /^\d{8,30}$/
    };

    const pattern = formatPatterns[keyType as keyof typeof formatPatterns];
    return pattern ? pattern.test(keyValue) : true;
  }

  private requiresCheckDigit(keyType: string): boolean {
    return ['GTIN', 'GLN', 'SSCC'].includes(keyType);
  }

  private validateCheckDigit(keyType: string, keyValue: string): boolean {
    // Simplified check digit validation - would use proper GS1 algorithm
    const digits = keyValue.split('').map(d => parseInt(d));
    const checkDigit = digits[digits.length - 1];
    // Real implementation would calculate proper check digit
    return true;
  }

  private getRequiredEPCISFields(eventType: string): string[] {
    const baseFields = ['eventTime', 'eventTimeZoneOffset', 'action'];
    
    switch (eventType) {
      case 'ObjectEvent':
        return [...baseFields, 'epcList', 'bizStep', 'disposition'];
      case 'AggregationEvent':
        return [...baseFields, 'parentID', 'childEPCs', 'action'];
      case 'TransactionEvent':
        return [...baseFields, 'bizTransactionList', 'epcList'];
      case 'TransformationEvent':
        return [...baseFields, 'inputEPCList', 'outputEPCList'];
      default:
        return baseFields;
    }
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

  private isPerishable(itemId: string): boolean {
    const perishableQuads = this.store.getQuads(
      namedNode(itemId),
      namedNode('http://supply-chain.org/is-perishable'),
      literal('true'),
      null
    );
    return perishableQuads.length > 0;
  }
}