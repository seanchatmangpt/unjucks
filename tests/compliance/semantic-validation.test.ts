import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { Parser, Store, DataFactory } from 'n3';
import { TurtleParser, TurtleUtils } from '../../src/lib/turtle-parser.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import type { 
  RDFDataSource, 
  RDFValidationResult,
  TurtleData,
  RDFTemplateContext 
} from '../../src/lib/types/turtle-types.js';
import fs from 'fs-extra';
import path from 'node:path';

const { namedNode, literal, quad } = DataFactory;

describe('Semantic Validation and Compliance Testing', () => {
  let parser: TurtleParser;
  let rdfLoader: RDFDataLoader;
  let rdfFilters: RDFFilters;
  let store: Store;

  beforeAll(async () => {
    await fs.ensureDir('tests/fixtures/compliance');
    await createComplianceTestData();
  });

  beforeEach(() => {
    parser = new TurtleParser();
    rdfLoader = new RDFDataLoader();
    store = new Store();
    rdfFilters = new RDFFilters({ store });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('SOX Compliance Validation', () => {
    it('should validate SOX compliance requirements for financial APIs', async () => {
      const soxComplianceRules = `
        @prefix sox: <http://example.org/sox#> .
        @prefix api: <http://example.org/api#> .
        @prefix audit: <http://example.org/audit#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

        # SOX Compliance Framework
        sox:FinancialSystem a sox:ComplianceScope ;
            sox:requiresAuditTrail true ;
            sox:requiresDataIntegrity true ;
            sox:requiresAccessControl true ;
            sox:requiresSeparationOfDuties true ;
            sox:retentionPeriod "7years" .

        # Financial API Classifications
        api:AccountingAPI a sox:FinancialAPI ;
            sox:handlesFinancialReporting true ;
            sox:affectsFinancialStatements true ;
            audit:loggingLevel "COMPREHENSIVE" ;
            audit:requiresApproval sox:CFOApproval .

        api:PayrollAPI a sox:FinancialAPI ;
            sox:handlesEmployeeCompensation true ;
            sox:affectsFinancialStatements true ;
            audit:loggingLevel "DETAILED" ;
            audit:requiresApproval sox:HRDirectorApproval .

        api:ExpenseAPI a sox:FinancialAPI ;
            sox:handlesExpenseReporting true ;
            sox:affectsFinancialStatements true ;
            audit:loggingLevel "STANDARD" ;
            audit:requiresApproval sox:ManagerApproval .

        # Compliance Rules (would be N3 rules in practice)
        sox:FinancialAPI rdfs:subClassOf api:API .
        sox:ComplianceScope rdfs:subClassOf sox:Framework .
      `;

      const parseResult = await parser.parse(soxComplianceRules);
      expect(parseResult.triples).toHaveLength(14);

      const quads = parseResult.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(quads);

      // Validate SOX compliance requirements
      const financialSystemRequirements = rdfFilters.rdfObject(
        'http://example.org/sox#FinancialSystem', 
        'http://example.org/sox#requiresAuditTrail'
      );
      expect(financialSystemRequirements[0].value).toBe('true');

      // Validate financial API compliance
      const accountingApiType = rdfFilters.rdfType('http://example.org/api#AccountingAPI');
      expect(accountingApiType).toContain('http://example.org/sox#FinancialAPI');

      const accountingLogging = rdfFilters.rdfObject(
        'http://example.org/api#AccountingAPI',
        'http://example.org/audit#loggingLevel'
      );
      expect(accountingLogging[0].value).toBe('COMPREHENSIVE');

      // Validate separation of duties
      const separationRequired = rdfFilters.rdfObject(
        'http://example.org/sox#FinancialSystem',
        'http://example.org/sox#requiresSeparationOfDuties'
      );
      expect(separationRequired[0].value).toBe('true');
    });

    it('should enforce SOX audit trail requirements', async () => {
      const auditTrailValidation = `
        @prefix audit: <http://example.org/audit#> .
        @prefix sox: <http://example.org/sox#> .
        @prefix api: <http://example.org/api#> .
        @prefix time: <http://www.w3.org/2006/time#> .

        # Audit Trail Requirements
        audit:AuditEvent a audit:Event ;
            audit:timestamp "2024-01-15T10:30:00Z"^^xsd:dateTime ;
            audit:user "john.doe@company.com" ;
            audit:action "READ" ;
            audit:resource api:AccountingData ;
            audit:ipAddress "192.168.1.100" ;
            audit:sessionId "sess_12345" .

        audit:AuditEvent2 a audit:Event ;
            audit:timestamp "2024-01-15T10:31:00Z"^^xsd:dateTime ;
            audit:user "jane.smith@company.com" ;
            audit:action "UPDATE" ;
            audit:resource api:FinancialReport ;
            audit:approver "cfo@company.com" ;
            audit:justification "Monthly closing adjustment" .

        # SOX Audit Requirements
        sox:AuditTrail sox:requires audit:UserIdentification,
                                    audit:ActionLogging,
                                    audit:TimestampAccuracy,
                                    audit:DataIntegrity,
                                    audit:ApprovalTracking .
      `;

      const parseResult = await parser.parse(auditTrailValidation);
      const quads = parseResult.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(quads);

      // Validate audit event structure
      const auditEvent1User = rdfFilters.rdfObject(
        'http://example.org/audit#AuditEvent',
        'http://example.org/audit#user'
      );
      expect(auditEvent1User[0].value).toBe('john.doe@company.com');

      const auditEvent2Approver = rdfFilters.rdfObject(
        'http://example.org/audit#AuditEvent2',
        'http://example.org/audit#approver'
      );
      expect(auditEvent2Approver[0].value).toBe('cfo@company.com');

      // Validate required audit components
      const auditRequirements = rdfFilters.rdfObject(
        'http://example.org/sox#AuditTrail',
        'http://example.org/sox#requires'
      );
      expect(auditRequirements.length).toBeGreaterThan(0);
    });
  });

  describe('GDPR Compliance Validation', () => {
    it('should validate GDPR data protection requirements', async () => {
      const gdprComplianceModel = `
        @prefix gdpr: <http://example.org/gdpr#> .
        @prefix data: <http://example.org/data#> .
        @prefix privacy: <http://example.org/privacy#> .
        @prefix consent: <http://example.org/consent#> .
        @prefix api: <http://example.org/api#> .

        # GDPR Data Categories
        gdpr:PersonalData a gdpr:DataCategory ;
            gdpr:requiresLawfulBasis true ;
            gdpr:requiresConsent true ;
            gdpr:subjectRights (gdpr:RightToAccess gdpr:RightToErasure gdpr:RightToPortability gdpr:RightToRectification) .

        gdpr:SensitivePersonalData rdfs:subClassOf gdpr:PersonalData ;
            gdpr:requiresExplicitConsent true ;
            gdpr:requiresDataProtectionOfficer true ;
            gdpr:restrictedProcessing true .

        # Data Processing API
        api:UserDataAPI a gdpr:DataProcessor ;
            gdpr:processes gdpr:PersonalData ;
            gdpr:dataRegion "EU" ;
            gdpr:lawfulBasis gdpr:LegitimateInterest ;
            privacy:privacyByDesign true ;
            privacy:privacyByDefault true .

        api:HealthDataAPI a gdpr:DataProcessor ;
            gdpr:processes gdpr:SensitivePersonalData ;
            gdpr:dataRegion "EU" ;
            gdpr:lawfulBasis gdpr:ExplicitConsent ;
            privacy:dataProtectionOfficer "dpo@company.com" .

        # Consent Management
        consent:UserConsent123 a consent:ConsentRecord ;
            consent:dataSubject "user123@email.com" ;
            consent:purpose "marketing" ;
            consent:givenAt "2024-01-01T00:00:00Z"^^xsd:dateTime ;
            consent:validUntil "2025-01-01T00:00:00Z"^^xsd:dateTime ;
            consent:withdrawable true .
      `;

      const parseResult = await parser.parse(gdprComplianceModel);
      expect(parseResult.triples).toHaveLength(16);

      const quads = parseResult.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(quads);

      // Validate GDPR requirements
      const personalDataConsent = rdfFilters.rdfObject(
        'http://example.org/gdpr#PersonalData',
        'http://example.org/gdpr#requiresConsent'
      );
      expect(personalDataConsent[0].value).toBe('true');

      // Validate sensitive data requirements
      const sensitiveDataExplicitConsent = rdfFilters.rdfObject(
        'http://example.org/gdpr#SensitivePersonalData',
        'http://example.org/gdpr#requiresExplicitConsent'
      );
      expect(sensitiveDataExplicitConsent[0].value).toBe('true');

      // Validate API compliance
      const userApiRegion = rdfFilters.rdfObject(
        'http://example.org/api#UserDataAPI',
        'http://example.org/gdpr#dataRegion'
      );
      expect(userApiRegion[0].value).toBe('EU');

      const healthApiDPO = rdfFilters.rdfObject(
        'http://example.org/api#HealthDataAPI',
        'http://example.org/privacy#dataProtectionOfficer'
      );
      expect(healthApiDPO[0].value).toBe('dpo@company.com');

      // Validate consent records
      const consentSubject = rdfFilters.rdfObject(
        'http://example.org/consent#UserConsent123',
        'http://example.org/consent#dataSubject'
      );
      expect(consentSubject[0].value).toBe('user123@email.com');
    });

    it('should validate data subject rights implementation', async () => {
      const dataSubjectRights = `
        @prefix gdpr: <http://example.org/gdpr#> .
        @prefix rights: <http://example.org/rights#> .
        @prefix api: <http://example.org/api#> .

        # Data Subject Rights Implementation
        rights:AccessRightAPI a api:Endpoint ;
            api:path "/api/gdpr/access" ;
            api:method "GET" ;
            gdpr:implements gdpr:RightToAccess ;
            rights:responseTime "30days" ;
            rights:dataFormat ("JSON" "CSV" "PDF") .

        rights:ErasureRightAPI a api:Endpoint ;
            api:path "/api/gdpr/erasure" ;
            api:method "DELETE" ;
            gdpr:implements gdpr:RightToErasure ;
            rights:responseTime "immediate" ;
            rights:cascadeDelete true .

        rights:PortabilityRightAPI a api:Endpoint ;
            api:path "/api/gdpr/portability" ;
            api:method "GET" ;
            gdpr:implements gdpr:RightToPortability ;
            rights:responseTime "30days" ;
            rights:dataFormat ("JSON" "XML") ;
            rights:machineReadable true .

        rights:RectificationRightAPI a api:Endpoint ;
            api:path "/api/gdpr/rectification" ;
            api:method "PATCH" ;
            gdpr:implements gdpr:RightToRectification ;
            rights:responseTime "immediate" ;
            rights:notifyThirdParties true .
      `;

      const parseResult = await parser.parse(dataSubjectRights);
      const quads = parseResult.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(quads);

      // Validate right to access implementation
      const accessRightPath = rdfFilters.rdfObject(
        'http://example.org/rights#AccessRightAPI',
        'http://example.org/api#path'
      );
      expect(accessRightPath[0].value).toBe('/api/gdpr/access');

      const accessResponseTime = rdfFilters.rdfObject(
        'http://example.org/rights#AccessRightAPI',
        'http://example.org/rights#responseTime'
      );
      expect(accessResponseTime[0].value).toBe('30days');

      // Validate right to erasure implementation
      const erasureMethod = rdfFilters.rdfObject(
        'http://example.org/rights#ErasureRightAPI',
        'http://example.org/api#method'
      );
      expect(erasureMethod[0].value).toBe('DELETE');

      const cascadeDelete = rdfFilters.rdfObject(
        'http://example.org/rights#ErasureRightAPI',
        'http://example.org/rights#cascadeDelete'
      );
      expect(cascadeDelete[0].value).toBe('true');

      // Validate right to portability
      const portabilityMachineReadable = rdfFilters.rdfObject(
        'http://example.org/rights#PortabilityRightAPI',
        'http://example.org/rights#machineReadable'
      );
      expect(portabilityMachineReadable[0].value).toBe('true');
    });
  });

  describe('PCI-DSS Compliance Validation', () => {
    it('should validate PCI-DSS payment card data protection requirements', async () => {
      const pciComplianceModel = `
        @prefix pci: <http://example.org/pci#> .
        @prefix payment: <http://example.org/payment#> .
        @prefix security: <http://example.org/security#> .
        @prefix crypto: <http://example.org/crypto#> .

        # PCI-DSS Requirements
        pci:CardholderDataEnvironment a pci:SecureEnvironment ;
            pci:requiresEncryptionAtRest true ;
            pci:requiresEncryptionInTransit true ;
            pci:requiresAccessControl true ;
            pci:requiresVulnerabilityManagement true ;
            pci:requiresNetworkSegmentation true .

        # Payment Processing API
        payment:PaymentAPI a pci:PaymentProcessor ;
            pci:handlesCardholderData true ;
            pci:environment pci:CardholderDataEnvironment ;
            security:encryptionStandard crypto:AES256 ;
            security:tlsVersion "1.3" ;
            pci:tokenization true ;
            pci:logMonitoring true .

        # Card Data Classifications
        pci:PrimaryAccountNumber a pci:CardholderData ;
            pci:dataClassification "Restricted" ;
            pci:requiresTokenization true ;
            pci:displayMasking true ;
            pci:storageProhibited true .

        pci:ExpirationDate a pci:CardholderData ;
            pci:dataClassification "Sensitive" ;
            pci:displayMasking true ;
            pci:storageAllowed true .

        pci:CardVerificationValue a pci:CardholderData ;
            pci:dataClassification "Prohibited" ;
            pci:storageProhibited true ;
            pci:transmissionEncrypted true .
      `;

      const parseResult = await parser.parse(pciComplianceModel);
      const quads = parseResult.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(quads);

      // Validate PCI-DSS environment requirements
      const encryptionAtRest = rdfFilters.rdfObject(
        'http://example.org/pci#CardholderDataEnvironment',
        'http://example.org/pci#requiresEncryptionAtRest'
      );
      expect(encryptionAtRest[0].value).toBe('true');

      const networkSegmentation = rdfFilters.rdfObject(
        'http://example.org/pci#CardholderDataEnvironment',
        'http://example.org/pci#requiresNetworkSegmentation'
      );
      expect(networkSegmentation[0].value).toBe('true');

      // Validate payment API compliance
      const paymentTokenization = rdfFilters.rdfObject(
        'http://example.org/payment#PaymentAPI',
        'http://example.org/pci#tokenization'
      );
      expect(paymentTokenization[0].value).toBe('true');

      const tlsVersion = rdfFilters.rdfObject(
        'http://example.org/payment#PaymentAPI',
        'http://example.org/security#tlsVersion'
      );
      expect(tlsVersion[0].value).toBe('1.3');

      // Validate card data handling rules
      const panStorageProhibited = rdfFilters.rdfObject(
        'http://example.org/pci#PrimaryAccountNumber',
        'http://example.org/pci#storageProhibited'
      );
      expect(panStorageProhibited[0].value).toBe('true');

      const cvvStorageProhibited = rdfFilters.rdfObject(
        'http://example.org/pci#CardVerificationValue',
        'http://example.org/pci#storageProhibited'
      );
      expect(cvvStorageProhibited[0].value).toBe('true');
    });
  });

  describe('HIPAA Compliance Validation', () => {
    it('should validate HIPAA healthcare data protection requirements', async () => {
      const hipaaComplianceModel = `
        @prefix hipaa: <http://example.org/hipaa#> .
        @prefix phi: <http://example.org/phi#> .
        @prefix healthcare: <http://example.org/healthcare#> .
        @prefix security: <http://example.org/security#> .

        # HIPAA Protected Health Information
        phi:PatientRecord a hipaa:ProtectedHealthInformation ;
            hipaa:requiresMinimumNecessary true ;
            hipaa:requiresBusinessAssociateAgreement true ;
            security:requiresEncryption true ;
            hipaa:accessLoggingRequired true .

        # Healthcare API
        healthcare:PatientAPI a hipaa:CoveredEntity ;
            hipaa:handlesProtectedHealthInformation true ;
            hipaa:safeguards (hipaa:AdministrativeSafeguards hipaa:PhysicalSafeguards hipaa:TechnicalSafeguards) ;
            security:authenticationRequired true ;
            security:authorizationRequired true ;
            hipaa:auditLogRetention "6years" .

        # Technical Safeguards
        hipaa:TechnicalSafeguards hipaa:requires hipaa:AccessControl,
                                                  hipaa:AuditControls,
                                                  hipaa:IntegrityControls,
                                                  hipaa:TransmissionSecurity .

        # Administrative Safeguards  
        hipaa:AdministrativeSafeguards hipaa:requires hipaa:SecurityOfficer,
                                                       hipaa:WorkforceTraining,
                                                       hipaa:AccessManagement,
                                                       hipaa:SecurityAwareness .
      `;

      const parseResult = await parser.parse(hipaaComplianceModel);
      const quads = parseResult.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(quads);

      // Validate PHI requirements
      const minimumNecessary = rdfFilters.rdfObject(
        'http://example.org/phi#PatientRecord',
        'http://example.org/hipaa#requiresMinimumNecessary'
      );
      expect(minimumNecessary[0].value).toBe('true');

      const accessLogging = rdfFilters.rdfObject(
        'http://example.org/phi#PatientRecord',
        'http://example.org/hipaa#accessLoggingRequired'
      );
      expect(accessLogging[0].value).toBe('true');

      // Validate covered entity requirements
      const patientApiType = rdfFilters.rdfType('http://example.org/healthcare#PatientAPI');
      expect(patientApiType).toContain('http://example.org/hipaa#CoveredEntity');

      const auditRetention = rdfFilters.rdfObject(
        'http://example.org/healthcare#PatientAPI',
        'http://example.org/hipaa#auditLogRetention'
      );
      expect(auditRetention[0].value).toBe('6years');

      // Validate safeguard requirements
      const technicalRequirements = rdfFilters.rdfObject(
        'http://example.org/hipaa#TechnicalSafeguards',
        'http://example.org/hipaa#requires'
      );
      expect(technicalRequirements.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Compliance Validation', () => {
    it('should validate compliance across multiple regulatory frameworks', async () => {
      const multiFrameworkCompliance = `
        @prefix compliance: <http://example.org/compliance#> .
        @prefix sox: <http://example.org/sox#> .
        @prefix gdpr: <http://example.org/gdpr#> .
        @prefix pci: <http://example.org/pci#> .
        @prefix api: <http://example.org/api#> .

        # Multi-compliance API
        api:FinancialHealthAPI a api:Service ;
            compliance:applicableFrameworks (sox:SarbanesOxley gdpr:GeneralDataProtectionRegulation pci:DataSecurityStandard) ;
            sox:handlesFinancialData true ;
            gdpr:processesPersonalData true ;
            pci:handlesPaymentData true .

        # Compliance intersection requirements
        compliance:MultiFrameworkRequirements a compliance:RequirementSet ;
            compliance:encryptionRequired "AES-256" ;
            compliance:auditRetentionPeriod "7years" ;
            compliance:accessControlRequired true ;
            compliance:dataClassificationRequired true ;
            compliance:incidentResponseRequired true .

        # Compliance conflicts resolution
        compliance:ConflictResolution compliance:priorityOrder (sox:SarbanesOxley pci:DataSecurityStandard gdpr:GeneralDataProtectionRegulation) ;
            compliance:strictestStandardApplies true .
      `;

      const parseResult = await parser.parse(multiFrameworkCompliance);
      const quads = parseResult.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(quads);

      // Validate multi-framework applicability
      const apiFrameworks = rdfFilters.rdfObject(
        'http://example.org/api#FinancialHealthAPI',
        'http://example.org/compliance#applicableFrameworks'
      );
      expect(apiFrameworks.length).toBeGreaterThan(0);

      // Validate framework-specific requirements
      const handlesFinancialData = rdfFilters.rdfObject(
        'http://example.org/api#FinancialHealthAPI',
        'http://example.org/sox#handlesFinancialData'
      );
      expect(handlesFinancialData[0].value).toBe('true');

      const processesPersonalData = rdfFilters.rdfObject(
        'http://example.org/api#FinancialHealthAPI',
        'http://example.org/gdpr#processesPersonalData'
      );
      expect(processesPersonalData[0].value).toBe('true');

      // Validate intersection requirements
      const encryptionRequired = rdfFilters.rdfObject(
        'http://example.org/compliance#MultiFrameworkRequirements',
        'http://example.org/compliance#encryptionRequired'
      );
      expect(encryptionRequired[0].value).toBe('AES-256');

      const auditRetention = rdfFilters.rdfObject(
        'http://example.org/compliance#MultiFrameworkRequirements',
        'http://example.org/compliance#auditRetentionPeriod'
      );
      expect(auditRetention[0].value).toBe('7years');
    });

    it('should resolve compliance conflicts and apply strictest standards', async () => {
      // In a real implementation, this would use N3 reasoning to resolve conflicts
      const conflictResolution = `
        @prefix conflict: <http://example.org/conflict#> .
        @prefix resolution: <http://example.org/resolution#> .

        # Example conflict: Different retention periods
        conflict:DataRetention a conflict:ComplianceConflict ;
            conflict:frameworks (sox:SarbanesOxley gdpr:GeneralDataProtectionRegulation) ;
            conflict:requirement "Data retention period" ;
            sox:requires "7years" ;
            gdpr:requires "2years" ;
            resolution:appliedStandard sox:SarbanesOxley ;
            resolution:rationale "Strictest standard applies" ;
            resolution:resolvedValue "7years" .
      `;

      const parseResult = await parser.parse(conflictResolution);
      const quads = parseResult.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(quads);

      const resolvedValue = rdfFilters.rdfObject(
        'http://example.org/conflict#DataRetention',
        'http://example.org/resolution#resolvedValue'
      );
      expect(resolvedValue[0].value).toBe('7years');

      const appliedStandard = rdfFilters.rdfObject(
        'http://example.org/conflict#DataRetention',
        'http://example.org/resolution#appliedStandard'
      );
      expect(appliedStandard[0].value).toBe('http://example.org/sox#SarbanesOxley');
    });
  });

  describe('Compliance Template Validation', () => {
    it('should validate template compliance with generated code patterns', async () => {
      const templateComplianceRules = `
        @prefix template: <http://example.org/template#> .
        @prefix code: <http://example.org/code#> .
        @prefix compliance: <http://example.org/compliance#> .

        # Template compliance requirements
        template:APITemplate compliance:mustInclude code:InputValidation,
                                                      code:ErrorHandling,
                                                      code:AuditLogging,
                                                      code:AuthenticationCheck .

        template:DatabaseTemplate compliance:mustInclude code:ParameterizedQueries,
                                                          code:ConnectionPooling,
                                                          code:TransactionManagement .

        template:SecurityTemplate compliance:mustInclude code:EncryptionAtRest,
                                                          code:EncryptionInTransit,
                                                          code:AccessControl .

        # Code pattern definitions
        code:InputValidation a code:SecurityPattern ;
            code:description "Validates all input parameters" ;
            code:implementation "joi schema validation" .

        code:AuditLogging a code:CompliancePattern ;
            code:description "Logs all security-relevant events" ;
            code:implementation "winston structured logging" .
      `;

      const parseResult = await parser.parse(templateComplianceRules);
      const quads = parseResult.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(quads);

      // Validate template requirements
      const apiTemplateRequirements = rdfFilters.rdfObject(
        'http://example.org/template#APITemplate',
        'http://example.org/compliance#mustInclude'
      );
      expect(apiTemplateRequirements.length).toBeGreaterThan(0);

      // Validate pattern definitions
      const inputValidationType = rdfFilters.rdfType('http://example.org/code#InputValidation');
      expect(inputValidationType).toContain('http://example.org/code#SecurityPattern');

      const auditLoggingType = rdfFilters.rdfType('http://example.org/code#AuditLogging');
      expect(auditLoggingType).toContain('http://example.org/code#CompliancePattern');
    });

    it('should generate compliance reports from semantic validation', async () => {
      // This would integrate with actual RDF validation results
      const validationResult: RDFValidationResult = {
        valid: false,
        errors: [
          {
            message: 'Missing required audit logging implementation',
            severity: 'error',
            line: 45,
            column: 12
          },
          {
            message: 'Encryption at rest not configured',
            severity: 'error', 
            line: 78,
            column: 5
          }
        ],
        warnings: [
          {
            message: 'Consider implementing additional input validation',
            line: 23,
            column: 8
          },
          {
            message: 'Rate limiting not configured',
            line: 156,
            column: 15
          }
        ]
      };

      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors).toHaveLength(2);
      expect(validationResult.warnings).toHaveLength(2);

      // Validate error categorization
      const criticalErrors = validationResult.errors.filter(e => e.severity === 'error');
      expect(criticalErrors).toHaveLength(2);

      // Validate error details include location information
      expect(validationResult.errors[0].line).toBeDefined();
      expect(validationResult.errors[0].column).toBeDefined();
    });
  });
});

async function createComplianceTestData(): Promise<void> {
  // This would create test data files for compliance testing
  await fs.ensureDir('tests/fixtures/compliance/ontologies');
  await fs.ensureDir('tests/fixtures/compliance/rules');
  await fs.ensureDir('tests/fixtures/compliance/templates');

  // Placeholder for test data creation
  // In practice, this would create comprehensive test ontologies
}