/**
 * Financial Validation Rules
 * Basel III compliance, Sarbanes-Oxley (SOX) compliance, GDPR financial data
 * MiFID II, PCI DSS, SWIFT messaging standards
 */

import { Store, DataFactory, NamedNode, Literal } from 'n3';
import { ValidationContext, ComplianceStatus, ValidationResult, ValidationError, ValidationWarning } from '../semantic-validator';

const { namedNode, literal } = DataFactory;

// Basel III Risk Categories
const BASEL_III_RISK_CATEGORIES = [
  'credit_risk', 'market_risk', 'operational_risk', 'liquidity_risk',
  'interest_rate_risk', 'concentration_risk', 'reputation_risk'
];

// Basel III Capital Requirements
const BASEL_III_CAPITAL_RATIOS = {
  COMMON_EQUITY_TIER1: 0.045,  // 4.5%
  TIER1_CAPITAL: 0.06,         // 6%
  TOTAL_CAPITAL: 0.08,         // 8%
  LEVERAGE_RATIO: 0.03,        // 3%
  LIQUIDITY_COVERAGE: 1.0      // 100%
};

// SOX Critical Controls
const SOX_CRITICAL_CONTROLS = [
  'revenue_recognition', 'inventory_valuation', 'fixed_assets',
  'accounts_payable', 'payroll', 'cash_management', 'investments',
  'debt_obligations', 'derivatives', 'related_party_transactions'
];

// GDPR Financial Data Categories
const GDPR_FINANCIAL_CATEGORIES = [
  'payment_data', 'credit_information', 'financial_statements',
  'transaction_history', 'investment_portfolio', 'loan_information',
  'insurance_data', 'tax_information'
];

// MiFID II Reporting Requirements
const MIFID_II_REQUIREMENTS = [
  'best_execution', 'transaction_reporting', 'position_reporting',
  'product_governance', 'investor_protection', 'market_transparency'
];

// SWIFT Message Types
const SWIFT_MESSAGE_TYPES = [
  'MT103', 'MT202', 'MT940', 'MT950', 'MT300', 'MT320', 'MT564', 'MT566'
];

export class FinancialValidator {
  private store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  /**
   * Validate Basel III compliance
   */
  async validateBaselIIICompliance(context: ValidationContext): Promise<ComplianceStatus> {
    const violations: string[] = [];

    // Validate capital adequacy requirements
    const capitalViolations = await this.validateCapitalAdequacy();
    violations.push(...capitalViolations);

    // Validate risk-weighted assets calculation
    const rwaViolations = await this.validateRiskWeightedAssets();
    violations.push(...rwaViolations);

    // Validate liquidity coverage ratio
    const liquidityViolations = await this.validateLiquidityCoverage();
    violations.push(...liquidityViolations);

    // Validate leverage ratio
    const leverageViolations = await this.validateLeverageRatio();
    violations.push(...leverageViolations);

    // Validate counterparty credit risk
    const ccrViolations = await this.validateCounterpartyCreditRisk();
    violations.push(...ccrViolations);

    // Validate operational risk capital
    const operationalRiskViolations = await this.validateOperationalRiskCapital();
    violations.push(...operationalRiskViolations);

    return {
      framework: 'BASEL_III',
      status: violations.length === 0 ? 'compliant' : 'non-compliant',
      violationCount: violations.length,
      criticalViolations: violations,
      recommendedActions: [
        'Maintain minimum capital ratios above regulatory requirements',
        'Implement comprehensive risk measurement systems',
        'Establish robust liquidity risk management',
        'Enhance counterparty credit risk monitoring',
        'Implement operational risk management framework',
        'Ensure accurate risk-weighted asset calculations'
      ]
    };
  }

  /**
   * Validate Sarbanes-Oxley (SOX) compliance
   */
  async validateSOXCompliance(context: ValidationContext): Promise<ComplianceStatus> {
    const violations: string[] = [];

    // Validate internal controls over financial reporting (ICFR)
    const icfrViolations = await this.validateICFR();
    violations.push(...icfrViolations);

    // Validate management assessment requirements
    const assessmentViolations = await this.validateManagementAssessment();
    violations.push(...assessmentViolations);

    // Validate auditor attestation requirements
    const attestationViolations = await this.validateAuditorAttestation();
    violations.push(...attestationViolations);

    // Validate disclosure controls
    const disclosureViolations = await this.validateDisclosureControls();
    violations.push(...disclosureViolations);

    // Validate financial statement accuracy
    const accuracyViolations = await this.validateFinancialStatementAccuracy();
    violations.push(...accuracyViolations);

    // Validate segregation of duties
    const segregationViolations = await this.validateSegregationOfDuties();
    violations.push(...segregationViolations);

    return {
      framework: 'SOX',
      status: violations.length === 0 ? 'compliant' : 'non-compliant',
      violationCount: violations.length,
      criticalViolations: violations,
      recommendedActions: [
        'Implement comprehensive ICFR framework',
        'Establish proper segregation of duties',
        'Maintain accurate financial records',
        'Implement management assessment processes',
        'Ensure proper disclosure controls',
        'Establish audit trail for all financial transactions'
      ]
    };
  }

  /**
   * Validate MiFID II compliance
   */
  async validateMiFIDIICompliance(context: ValidationContext): Promise<ComplianceStatus> {
    const violations: string[] = [];

    // Validate best execution requirements
    const bestExecutionViolations = await this.validateBestExecution();
    violations.push(...bestExecutionViolations);

    // Validate transaction reporting
    const transactionReportingViolations = await this.validateTransactionReporting();
    violations.push(...transactionReportingViolations);

    // Validate investor protection measures
    const investorProtectionViolations = await this.validateInvestorProtection();
    violations.push(...investorProtectionViolations);

    // Validate product governance
    const productGovernanceViolations = await this.validateProductGovernance();
    violations.push(...productGovernanceViolations);

    return {
      framework: 'MIFID_II',
      status: violations.length === 0 ? 'compliant' : 'non-compliant',
      violationCount: violations.length,
      criticalViolations: violations,
      recommendedActions: [
        'Implement best execution monitoring',
        'Establish comprehensive transaction reporting',
        'Enhance investor protection measures',
        'Implement product governance framework',
        'Maintain market transparency requirements'
      ]
    };
  }

  /**
   * Validate PCI DSS compliance for payment data
   */
  async validatePCIDSSCompliance(context: ValidationContext): Promise<ComplianceStatus> {
    const violations: string[] = [];

    // Validate secure network requirements
    const networkViolations = await this.validateSecureNetwork();
    violations.push(...networkViolations);

    // Validate cardholder data protection
    const dataProtectionViolations = await this.validateCardholderDataProtection();
    violations.push(...dataProtectionViolations);

    // Validate vulnerability management
    const vulnerabilityViolations = await this.validateVulnerabilityManagement();
    violations.push(...vulnerabilityViolations);

    // Validate access control measures
    const accessControlViolations = await this.validateAccessControlMeasures();
    violations.push(...accessControlViolations);

    return {
      framework: 'PCI_DSS',
      status: violations.length === 0 ? 'compliant' : 'non-compliant',
      violationCount: violations.length,
      criticalViolations: violations,
      recommendedActions: [
        'Implement secure network architecture',
        'Encrypt cardholder data at rest and in transit',
        'Maintain vulnerability management program',
        'Implement strong access control measures',
        'Monitor and test networks regularly'
      ]
    };
  }

  /**
   * Validate capital adequacy requirements
   */
  private async validateCapitalAdequacy(): Promise<string[]> {
    const violations: string[] = [];

    // Check Common Equity Tier 1 ratio
    const cet1Ratios = this.store.getQuads(
      null,
      namedNode('http://basel.org/capital/common-equity-tier1-ratio'),
      null,
      null
    );

    for (const quad of cet1Ratios) {
      const ratio = parseFloat((quad.object as Literal).value);
      if (ratio < BASEL_III_CAPITAL_RATIOS.COMMON_EQUITY_TIER1) {
        violations.push(`CET1 ratio ${ratio} below minimum requirement ${BASEL_III_CAPITAL_RATIOS.COMMON_EQUITY_TIER1}`);
      }
    }

    // Check Tier 1 capital ratio
    const tier1Ratios = this.store.getQuads(
      null,
      namedNode('http://basel.org/capital/tier1-capital-ratio'),
      null,
      null
    );

    for (const quad of tier1Ratios) {
      const ratio = parseFloat((quad.object as Literal).value);
      if (ratio < BASEL_III_CAPITAL_RATIOS.TIER1_CAPITAL) {
        violations.push(`Tier 1 capital ratio ${ratio} below minimum requirement ${BASEL_III_CAPITAL_RATIOS.TIER1_CAPITAL}`);
      }
    }

    // Check Total capital ratio
    const totalCapitalRatios = this.store.getQuads(
      null,
      namedNode('http://basel.org/capital/total-capital-ratio'),
      null,
      null
    );

    for (const quad of totalCapitalRatios) {
      const ratio = parseFloat((quad.object as Literal).value);
      if (ratio < BASEL_III_CAPITAL_RATIOS.TOTAL_CAPITAL) {
        violations.push(`Total capital ratio ${ratio} below minimum requirement ${BASEL_III_CAPITAL_RATIOS.TOTAL_CAPITAL}`);
      }
    }

    return violations;
  }

  /**
   * Validate risk-weighted assets calculation
   */
  private async validateRiskWeightedAssets(): Promise<string[]> {
    const violations: string[] = [];

    // Check for proper risk weight classifications
    const assetQuads = this.store.getQuads(
      null,
      namedNode('http://basel.org/assets/risk-weight'),
      null,
      null
    );

    const validRiskWeights = [0, 0.2, 0.5, 0.75, 1.0, 1.25, 1.5]; // Standard Basel III risk weights

    for (const quad of assetQuads) {
      const riskWeight = parseFloat((quad.object as Literal).value);
      
      if (!validRiskWeights.includes(riskWeight)) {
        violations.push(`Invalid risk weight ${riskWeight} for asset ${quad.subject.value}`);
      }
    }

    return violations;
  }

  /**
   * Validate liquidity coverage ratio
   */
  private async validateLiquidityCoverage(): Promise<string[]> {
    const violations: string[] = [];

    const lcrQuads = this.store.getQuads(
      null,
      namedNode('http://basel.org/liquidity/coverage-ratio'),
      null,
      null
    );

    for (const quad of lcrQuads) {
      const lcr = parseFloat((quad.object as Literal).value);
      
      if (lcr < BASEL_III_CAPITAL_RATIOS.LIQUIDITY_COVERAGE) {
        violations.push(`Liquidity Coverage Ratio ${lcr} below minimum requirement ${BASEL_III_CAPITAL_RATIOS.LIQUIDITY_COVERAGE}`);
      }
    }

    return violations;
  }

  /**
   * Validate leverage ratio
   */
  private async validateLeverageRatio(): Promise<string[]> {
    const violations: string[] = [];

    const leverageQuads = this.store.getQuads(
      null,
      namedNode('http://basel.org/capital/leverage-ratio'),
      null,
      null
    );

    for (const quad of leverageQuads) {
      const ratio = parseFloat((quad.object as Literal).value);
      
      if (ratio < BASEL_III_CAPITAL_RATIOS.LEVERAGE_RATIO) {
        violations.push(`Leverage ratio ${ratio} below minimum requirement ${BASEL_III_CAPITAL_RATIOS.LEVERAGE_RATIO}`);
      }
    }

    return violations;
  }

  /**
   * Validate counterparty credit risk
   */
  private async validateCounterpartyCreditRisk(): Promise<string[]> {
    const violations: string[] = [];

    // Check for proper counterparty risk calculations
    const counterpartyQuads = this.store.getQuads(
      null,
      namedNode('http://basel.org/risk/counterparty-exposure'),
      null,
      null
    );

    for (const quad of counterpartyQuads) {
      const counterpartyId = quad.subject.value;
      
      // Check for required risk measurements
      if (!this.hasElement(counterpartyId, 'http://basel.org/risk/potential-future-exposure')) {
        violations.push(`Missing PFE calculation for counterparty ${counterpartyId}`);
      }
      
      if (!this.hasElement(counterpartyId, 'http://basel.org/risk/credit-valuation-adjustment')) {
        violations.push(`Missing CVA calculation for counterparty ${counterpartyId}`);
      }
    }

    return violations;
  }

  /**
   * Validate operational risk capital
   */
  private async validateOperationalRiskCapital(): Promise<string[]> {
    const violations: string[] = [];

    // Check for operational risk capital calculations
    const opRiskQuads = this.store.getQuads(
      null,
      namedNode('http://basel.org/risk/operational-risk-capital'),
      null,
      null
    );

    if (opRiskQuads.length === 0) {
      violations.push('No operational risk capital calculations found - required under Basel III');
    }

    return violations;
  }

  /**
   * Validate Internal Controls over Financial Reporting (ICFR)
   */
  private async validateICFR(): Promise<string[]> {
    const violations: string[] = [];

    // Check for ICFR documentation
    const icfrQuads = this.store.getQuads(
      null,
      namedNode('http://sox.compliance/icfr-control'),
      null,
      null
    );

    for (const controlCategory of SOX_CRITICAL_CONTROLS) {
      const controlQuads = this.store.getQuads(
        null,
        namedNode('http://sox.compliance/control-category'),
        literal(controlCategory),
        null
      );

      if (controlQuads.length === 0) {
        violations.push(`Missing ICFR controls for ${controlCategory}`);
      }
    }

    return violations;
  }

  /**
   * Validate management assessment requirements
   */
  private async validateManagementAssessment(): Promise<string[]> {
    const violations: string[] = [];

    const assessmentQuads = this.store.getQuads(
      null,
      namedNode('http://sox.compliance/management-assessment'),
      null,
      null
    );

    if (assessmentQuads.length === 0) {
      violations.push('No management assessment of ICFR found - required under SOX Section 302');
    }

    // Check assessment date
    for (const quad of assessmentQuads) {
      const assessmentId = quad.subject.value;
      const dateQuads = this.store.getQuads(
        namedNode(assessmentId),
        namedNode('http://sox.compliance/assessment-date'),
        null,
        null
      );

      if (dateQuads.length === 0) {
        violations.push(`Missing assessment date for management assessment ${assessmentId}`);
      }
    }

    return violations;
  }

  /**
   * Validate auditor attestation requirements
   */
  private async validateAuditorAttestation(): Promise<string[]> {
    const violations: string[] = [];

    const attestationQuads = this.store.getQuads(
      null,
      namedNode('http://sox.compliance/auditor-attestation'),
      null,
      null
    );

    if (attestationQuads.length === 0) {
      violations.push('No auditor attestation found - required under SOX Section 404');
    }

    return violations;
  }

  /**
   * Validate disclosure controls
   */
  private async validateDisclosureControls(): Promise<string[]> {
    const violations: string[] = [];

    const disclosureQuads = this.store.getQuads(
      null,
      namedNode('http://sox.compliance/disclosure-control'),
      null,
      null
    );

    if (disclosureQuads.length === 0) {
      violations.push('No disclosure controls documentation found');
    }

    return violations;
  }

  /**
   * Validate financial statement accuracy
   */
  private async validateFinancialStatementAccuracy(): Promise<string[]> {
    const violations: string[] = [];

    // Check for material weakness disclosures
    const weaknessQuads = this.store.getQuads(
      null,
      namedNode('http://sox.compliance/material-weakness'),
      literal('true'),
      null
    );

    if (weaknessQuads.length > 0) {
      violations.push('Material weaknesses identified in financial reporting controls');
    }

    return violations;
  }

  /**
   * Validate segregation of duties
   */
  private async validateSegregationOfDuties(): Promise<string[]> {
    const violations: string[] = [];

    const segregationQuads = this.store.getQuads(
      null,
      namedNode('http://sox.compliance/segregation-of-duties'),
      null,
      null
    );

    if (segregationQuads.length === 0) {
      violations.push('No segregation of duties controls documented');
    }

    return violations;
  }

  /**
   * Validate best execution requirements
   */
  private async validateBestExecution(): Promise<string[]> {
    const violations: string[] = [];

    const bestExecQuads = this.store.getQuads(
      null,
      namedNode('http://mifid.compliance/best-execution'),
      null,
      null
    );

    if (bestExecQuads.length === 0) {
      violations.push('No best execution documentation found - required under MiFID II');
    }

    return violations;
  }

  /**
   * Validate transaction reporting
   */
  private async validateTransactionReporting(): Promise<string[]> {
    const violations: string[] = [];

    const reportingQuads = this.store.getQuads(
      null,
      namedNode('http://mifid.compliance/transaction-reporting'),
      null,
      null
    );

    if (reportingQuads.length === 0) {
      violations.push('No transaction reporting found - required under MiFID II');
    }

    return violations;
  }

  /**
   * Validate investor protection measures
   */
  private async validateInvestorProtection(): Promise<string[]> {
    const violations: string[] = [];

    const protectionQuads = this.store.getQuads(
      null,
      namedNode('http://mifid.compliance/investor-protection'),
      null,
      null
    );

    if (protectionQuads.length === 0) {
      violations.push('No investor protection measures documented');
    }

    return violations;
  }

  /**
   * Validate product governance
   */
  private async validateProductGovernance(): Promise<string[]> {
    const violations: string[] = [];

    const governanceQuads = this.store.getQuads(
      null,
      namedNode('http://mifid.compliance/product-governance'),
      null,
      null
    );

    if (governanceQuads.length === 0) {
      violations.push('No product governance framework documented');
    }

    return violations;
  }

  /**
   * Validate secure network requirements
   */
  private async validateSecureNetwork(): Promise<string[]> {
    const violations: string[] = [];

    const networkQuads = this.store.getQuads(
      null,
      namedNode('http://pci.compliance/secure-network'),
      null,
      null
    );

    if (networkQuads.length === 0) {
      violations.push('No secure network configuration documented - PCI DSS Requirement 1');
    }

    return violations;
  }

  /**
   * Validate cardholder data protection
   */
  private async validateCardholderDataProtection(): Promise<string[]> {
    const violations: string[] = [];

    const dataProtectionQuads = this.store.getQuads(
      null,
      namedNode('http://pci.compliance/cardholder-data-protection'),
      null,
      null
    );

    if (dataProtectionQuads.length === 0) {
      violations.push('No cardholder data protection measures documented - PCI DSS Requirement 3');
    }

    // Check for encryption
    const encryptionQuads = this.store.getQuads(
      null,
      namedNode('http://pci.compliance/data-encryption'),
      literal('true'),
      null
    );

    if (encryptionQuads.length === 0) {
      violations.push('Cardholder data must be encrypted - PCI DSS Requirement 4');
    }

    return violations;
  }

  /**
   * Validate vulnerability management
   */
  private async validateVulnerabilityManagement(): Promise<string[]> {
    const violations: string[] = [];

    const vulnerabilityQuads = this.store.getQuads(
      null,
      namedNode('http://pci.compliance/vulnerability-management'),
      null,
      null
    );

    if (vulnerabilityQuads.length === 0) {
      violations.push('No vulnerability management program documented - PCI DSS Requirement 6');
    }

    return violations;
  }

  /**
   * Validate access control measures
   */
  private async validateAccessControlMeasures(): Promise<string[]> {
    const violations: string[] = [];

    const accessControlQuads = this.store.getQuads(
      null,
      namedNode('http://pci.compliance/access-control'),
      null,
      null
    );

    if (accessControlQuads.length === 0) {
      violations.push('No access control measures documented - PCI DSS Requirements 7 & 8');
    }

    return violations;
  }

  // Helper method
  private hasElement(subjectId: string, predicate: string): boolean {
    const quads = this.store.getQuads(
      namedNode(subjectId),
      namedNode(predicate),
      null,
      null
    );
    return quads.length > 0;
  }
}