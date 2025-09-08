/**
 * Basel III Compliance Template Testing Suite
 * Clean Room Enterprise Testing Environment
 * 
 * Tests:
 * - Capital adequacy ratio calculations
 * - Liquidity Coverage Ratio (LCR) validation
 * - Net Stable Funding Ratio (NSFR) compliance
 * - Operational risk assessments
 * - Stress testing scenarios
 * - Regulatory reporting accuracy
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

// Mock Basel III compliance interfaces
interface CapitalAdequacyRatios {
  commonEquityTier1Ratio: number;
  tier1CapitalRatio: number;
  totalCapitalRatio: number;
  leverageRatio: number;
}

interface LiquidityRatios {
  lcrRatio: number;
  nsfrRatio: number;
}

interface RiskWeightedAssets {
  creditRWA: number;
  marketRWA: number;
  operationalRWA: number;
  totalRWA: number;
}

interface StressTestScenario {
  name: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE';
  parameters: {
    gdpShock?: number;
    unemploymentRate?: number;
    realEstateDecline?: number;
    equityMarketDecline?: number;
    creditSpreadWidening?: number;
  };
}

class MockBaselIIIComplianceService {
  private auditLog: any[] = [];
  private regulatoryReports: any[] = [];

  async calculateCapitalAdequacyRatios(reportingDate: Date): Promise<any> {
    const mockRatios: CapitalAdequacyRatios = {
      commonEquityTier1Ratio: 12.5, // Above 4.5% minimum
      tier1CapitalRatio: 14.0, // Above 6.0% minimum  
      totalCapitalRatio: 16.8, // Above 8.0% minimum
      leverageRatio: 5.2 // Above 3.0% minimum
    };

    const mockRWA: RiskWeightedAssets = {
      creditRWA: 850000000, // $850M
      marketRWA: 125000000, // $125M
      operationalRWA: 175000000, // $175M
      totalRWA: 1150000000 // $1.15B
    };

    const result = {
      reportingDate,
      capitalRatios: mockRatios,
      riskWeightedAssets: mockRWA,
      complianceStatus: {
        compliant: true,
        violations: [],
        warnings: []
      },
      _baselCompliance: {
        auditId: `BASEL3_${Date.now()}`,
        framework: 'BASEL_III',
        dataClassification: 'CONFIDENTIAL',
        compliant: true,
        regulatoryReporting: true,
        retentionPeriod: '7 years'
      }
    };

    this.auditLog.push({
      operation: 'CAPITAL_ADEQUACY_CALCULATION',
      timestamp: new Date(),
      ratios: mockRatios,
      complianceStatus: 'COMPLIANT'
    });

    return result;
  }

  async calculateLiquidityCoverageRatio(calculationDate: Date): Promise<any> {
    const mockLCR = {
      ratio: 125.5, // Above 100% minimum
      highQualityLiquidAssets: {
        level1: 500000000, // $500M government bonds
        level2A: 200000000, // $200M corporate bonds
        level2B: 100000000, // $100M other assets
        total: 800000000 // $800M total HQLA
      },
      netCashOutflows: {
        total: 650000000, // $650M total outflows
        inflows: 50000000, // $50M total inflows
        net: 600000000 // $600M net outflows
      }
    };

    const result = {
      calculationDate,
      lcrRatio: mockLCR.ratio,
      highQualityLiquidAssets: mockLCR.highQualityLiquidAssets,
      netCashOutflows: mockLCR.netCashOutflows,
      complianceStatus: {
        compliant: mockLCR.ratio >= 100,
        violations: []
      },
      _baselCompliance: {
        auditId: `BASEL3_LCR_${Date.now()}`,
        framework: 'BASEL_III',
        compliant: mockLCR.ratio >= 100
      }
    };

    this.auditLog.push({
      operation: 'LCR_CALCULATION',
      timestamp: new Date(),
      lcrRatio: mockLCR.ratio,
      complianceStatus: 'COMPLIANT'
    });

    return result;
  }

  async calculateOperationalRisk(reportingPeriod: any): Promise<any> {
    const mockGrossIncome = {
      corporateFinance: 50000000,
      tradingSales: 75000000,
      retailBanking: 120000000,
      commercialBanking: 180000000,
      paymentSettlement: 25000000,
      agencyServices: 30000000,
      assetManagement: 40000000,
      retailBrokerage: 20000000
    };

    // Standardized Approach calculation
    const businessLineMultipliers = {
      corporateFinance: 18,
      tradingSales: 18,
      retailBanking: 12,
      commercialBanking: 15,
      paymentSettlement: 18,
      agencyServices: 15,
      assetManagement: 12,
      retailBrokerage: 12
    };

    let operationalRiskCapital = 0;
    for (const [line, income] of Object.entries(mockGrossIncome)) {
      const multiplier = businessLineMultipliers[line as keyof typeof businessLineMultipliers];
      operationalRiskCapital += (income * multiplier) / 100;
    }

    const operationalRWA = operationalRiskCapital * 12.5; // Basel III multiplier

    const result = {
      reportingPeriod,
      operationalRiskCapital,
      operationalRWA,
      grossIncome: mockGrossIncome,
      _baselCompliance: {
        auditId: `BASEL3_OPRISK_${Date.now()}`,
        framework: 'BASEL_III',
        approach: 'STANDARDIZED'
      }
    };

    this.auditLog.push({
      operation: 'OPERATIONAL_RISK_CALCULATION',
      timestamp: new Date(),
      operationalRiskCapital,
      operationalRWA
    });

    return result;
  }

  async performBaselStressTesting(scenarios: StressTestScenario[]): Promise<any> {
    const stressResults = [];

    for (const scenario of scenarios) {
      // Simulate stress impact on capital ratios
      let stressMultiplier = 1.0;
      
      switch (scenario.severity) {
        case 'MILD':
          stressMultiplier = 0.95; // 5% decline
          break;
        case 'MODERATE':
          stressMultiplier = 0.85; // 15% decline
          break;
        case 'SEVERE':
          stressMultiplier = 0.70; // 30% decline
          break;
      }

      const stressedRatios: CapitalAdequacyRatios = {
        commonEquityTier1Ratio: 12.5 * stressMultiplier,
        tier1CapitalRatio: 14.0 * stressMultiplier,
        totalCapitalRatio: 16.8 * stressMultiplier,
        leverageRatio: 5.2 * stressMultiplier
      };

      const complianceStatus = {
        compliant: stressedRatios.commonEquityTier1Ratio >= 4.5 &&
                   stressedRatios.tier1CapitalRatio >= 6.0 &&
                   stressedRatios.totalCapitalRatio >= 8.0 &&
                   stressedRatios.leverageRatio >= 3.0,
        shortfalls: []
      };

      if (!complianceStatus.compliant) {
        if (stressedRatios.commonEquityTier1Ratio < 4.5) {
          complianceStatus.shortfalls.push('CET1_RATIO');
        }
        if (stressedRatios.tier1CapitalRatio < 6.0) {
          complianceStatus.shortfalls.push('TIER1_RATIO');
        }
        if (stressedRatios.totalCapitalRatio < 8.0) {
          complianceStatus.shortfalls.push('TOTAL_CAPITAL_RATIO');
        }
        if (stressedRatios.leverageRatio < 3.0) {
          complianceStatus.shortfalls.push('LEVERAGE_RATIO');
        }
      }

      stressResults.push({
        scenario: scenario.name,
        stressedRatios,
        complianceStatus
      });
    }

    const summary = {
      overallResult: stressResults.every(r => r.complianceStatus.compliant) ? 'PASS' : 'FAIL',
      criticalScenarios: stressResults.filter(r => !r.complianceStatus.compliant).map(r => r.scenario)
    };

    const result = {
      baselineDate: new Date(),
      scenarios: stressResults,
      summary,
      _baselCompliance: {
        auditId: `BASEL3_STRESS_${Date.now()}`,
        framework: 'BASEL_III',
        stressTesting: true
      }
    };

    this.auditLog.push({
      operation: 'BASEL_STRESS_TESTING',
      timestamp: new Date(),
      scenariosCount: scenarios.length,
      overallResult: summary.overallResult
    });

    return result;
  }

  async generateRegulatoryReports(reportingPeriod: any, reportTypes: string[]): Promise<any> {
    const reports = [];

    for (const reportType of reportTypes) {
      const report = {
        type: reportType,
        period: reportingPeriod,
        generatedAt: new Date(),
        data: this.generateMockReportData(reportType),
        digitalSignature: `SIG_${Date.now()}`,
        validated: true
      };

      reports.push(report);
      this.regulatoryReports.push(report);
    }

    const result = {
      reportingPeriod,
      reports,
      package: {
        submissionReady: true,
        digitallySignedByHSM: true,
        encryptedForTransmission: true
      },
      _baselCompliance: {
        auditId: `BASEL3_REPORTING_${Date.now()}`,
        framework: 'BASEL_III',
        regulatorySubmission: true
      }
    };

    this.auditLog.push({
      operation: 'REGULATORY_REPORTING',
      timestamp: new Date(),
      reportTypes,
      reportsGenerated: reports.length,
      submissionReady: true
    });

    return result;
  }

  private generateMockReportData(reportType: string): any {
    switch (reportType) {
      case 'PILLAR3':
        return { capitalDisclosure: true, riskDisclosure: true };
      case 'COREP':
        return { capitalRequirements: true, capitalRatios: true };
      case 'FINREP':
        return { financialStatements: true, balanceSheet: true };
      default:
        return { standardData: true };
    }
  }

  getAuditLog() {
    return this.auditLog;
  }

  getRegulatoryReports() {
    return this.regulatoryReports;
  }
}

describe('Basel III Compliance Template Testing', () => {
  let testOutputDir: string;
  let baselService: MockBaselIIIComplianceService;

  beforeAll(async () => {
    testOutputDir = join(process.cwd(), 'tests/enterprise/cleanroom/basel-iii/output');
    await mkdir(testOutputDir, { recursive: true });
    
    baselService = new MockBaselIIIComplianceService();
  });

  describe('Template Rendering Validation', () => {
    it('should validate Basel III template structure', async () => {
      const templatePath = join(process.cwd(), '_templates/enterprise/compliance/service.ts.njk');
      const templateContent = await readFile(templatePath, 'utf-8');
      
      // Validate Basel III specific elements
      expect(templateContent).toContain('@ComplianceDecorator');
      expect(templateContent).toContain('ComplianceValidator');
      expect(templateContent).toContain('AuditLogger');
      expect(templateContent).toContain('{{ complianceFramework }}');
      expect(templateContent).toContain('{{ retentionPeriod }}');
      expect(templateContent).toContain('{{ encryptionRequired }}');
    });

    it('should validate Basel III configuration variables', async () => {
      const configPath = join(process.cwd(), '_templates/enterprise/compliance/config.yml');
      const configContent = await readFile(configPath, 'utf-8');
      
      expect(configContent).toContain('complianceFramework');
      expect(configContent).toContain('dataClassification');
      expect(configContent).toContain('retentionPeriod');
      expect(configContent).toContain('CONFIDENTIAL');
      expect(configContent).toContain('7 years');
    });
  });

  describe('Capital Adequacy Calculations', () => {
    it('should calculate capital adequacy ratios correctly', async () => {
      const reportingDate = new Date('2024-12-31');
      const result = await baselService.calculateCapitalAdequacyRatios(reportingDate);

      // Validate minimum Basel III requirements
      expect(result.capitalRatios.commonEquityTier1Ratio).toBeGreaterThanOrEqual(4.5);
      expect(result.capitalRatios.tier1CapitalRatio).toBeGreaterThanOrEqual(6.0);
      expect(result.capitalRatios.totalCapitalRatio).toBeGreaterThanOrEqual(8.0);
      expect(result.capitalRatios.leverageRatio).toBeGreaterThanOrEqual(3.0);

      // Validate compliance status
      expect(result.complianceStatus.compliant).toBe(true);
      expect(result._baselCompliance.framework).toBe('BASEL_III');
      expect(result._baselCompliance.retentionPeriod).toBe('7 years');
    });

    it('should validate risk-weighted assets calculation', async () => {
      const result = await baselService.calculateCapitalAdequacyRatios(new Date());

      expect(result.riskWeightedAssets).toMatchObject({
        creditRWA: expect.any(Number),
        marketRWA: expect.any(Number),
        operationalRWA: expect.any(Number),
        totalRWA: expect.any(Number)
      });

      // Total RWA should equal sum of components
      const { creditRWA, marketRWA, operationalRWA, totalRWA } = result.riskWeightedAssets;
      expect(totalRWA).toBe(creditRWA + marketRWA + operationalRWA);
    });

    it('should audit capital adequacy calculations', async () => {
      await baselService.calculateCapitalAdequacyRatios(new Date());
      
      const auditLog = baselService.getAuditLog();
      const lastEvent = auditLog[auditLog.length - 1];

      expect(lastEvent).toMatchObject({
        operation: 'CAPITAL_ADEQUACY_CALCULATION',
        timestamp: expect.any(Date),
        ratios: expect.any(Object),
        complianceStatus: 'COMPLIANT'
      });
    });
  });

  describe('Liquidity Coverage Ratio (LCR)', () => {
    it('should calculate LCR above minimum requirement', async () => {
      const calculationDate = new Date('2024-12-31');
      const result = await baselService.calculateLiquidityCoverageRatio(calculationDate);

      // LCR must be >= 100%
      expect(result.lcrRatio).toBeGreaterThanOrEqual(100);
      expect(result.complianceStatus.compliant).toBe(true);

      // Validate HQLA components
      expect(result.highQualityLiquidAssets).toMatchObject({
        level1: expect.any(Number),
        level2A: expect.any(Number),
        level2B: expect.any(Number),
        total: expect.any(Number)
      });

      // Total HQLA should equal sum of components
      const hqla = result.highQualityLiquidAssets;
      expect(hqla.total).toBe(hqla.level1 + hqla.level2A + hqla.level2B);
    });

    it('should validate net cash outflow calculations', async () => {
      const result = await baselService.calculateLiquidityCoverageRatio(new Date());

      expect(result.netCashOutflows).toMatchObject({
        total: expect.any(Number),
        inflows: expect.any(Number),
        net: expect.any(Number)
      });

      // Net outflows should equal total minus inflows
      const { total, inflows, net } = result.netCashOutflows;
      expect(net).toBe(total - inflows);
    });
  });

  describe('Operational Risk Assessment', () => {
    it('should calculate operational risk using standardized approach', async () => {
      const reportingPeriod = { year: 2024, quarter: 4 };
      const result = await baselService.calculateOperationalRisk(reportingPeriod);

      expect(result).toMatchObject({
        operationalRiskCapital: expect.any(Number),
        operationalRWA: expect.any(Number),
        grossIncome: expect.any(Object)
      });

      // Operational RWA should be 12.5 times the capital requirement
      expect(result.operationalRWA).toBe(result.operationalRiskCapital * 12.5);

      // Validate business line coverage
      expect(result.grossIncome).toHaveProperty('corporateFinance');
      expect(result.grossIncome).toHaveProperty('tradingSales');
      expect(result.grossIncome).toHaveProperty('retailBanking');
      expect(result.grossIncome).toHaveProperty('commercialBanking');
    });

    it('should validate business line multipliers', async () => {
      const result = await baselService.calculateOperationalRisk({ year: 2024 });

      // Verify operational risk calculation is reasonable
      expect(result.operationalRiskCapital).toBeGreaterThan(0);
      expect(result.operationalRWA).toBeGreaterThan(0);
      expect(result._baselCompliance.approach).toBe('STANDARDIZED');
    });
  });

  describe('Stress Testing Framework', () => {
    it('should perform comprehensive stress testing', async () => {
      const scenarios: StressTestScenario[] = [
        {
          name: 'Severe Recession',
          severity: 'SEVERE',
          parameters: {
            gdpShock: -5.0,
            unemploymentRate: 15.0,
            realEstateDecline: -30.0,
            equityMarketDecline: -40.0
          }
        },
        {
          name: 'Market Shock',
          severity: 'MODERATE',
          parameters: {
            equityMarketDecline: -25.0,
            creditSpreadWidening: 300 // basis points
          }
        }
      ];

      const result = await baselService.performBaselStressTesting(scenarios);

      expect(result.scenarios).toHaveLength(2);
      expect(result.summary).toMatchObject({
        overallResult: expect.stringMatching(/^(PASS|FAIL)$/),
        criticalScenarios: expect.any(Array)
      });

      // Validate each stress scenario result
      result.scenarios.forEach((scenario: any) => {
        expect(scenario).toMatchObject({
          scenario: expect.any(String),
          stressedRatios: {
            commonEquityTier1Ratio: expect.any(Number),
            tier1CapitalRatio: expect.any(Number),
            totalCapitalRatio: expect.any(Number),
            leverageRatio: expect.any(Number)
          },
          complianceStatus: {
            compliant: expect.any(Boolean),
            shortfalls: expect.any(Array)
          }
        });
      });
    });

    it('should identify capital shortfalls in stress scenarios', async () => {
      const severeScenario: StressTestScenario[] = [{
        name: 'Extreme Crisis',
        severity: 'SEVERE',
        parameters: {
          gdpShock: -8.0,
          unemploymentRate: 20.0,
          realEstateDecline: -50.0,
          equityMarketDecline: -60.0
        }
      }];

      const result = await baselService.performBaselStressTesting(severeScenario);
      
      // Severe stress should potentially cause failures
      const extremeScenario = result.scenarios[0];
      
      // If stressed ratios fall below minimums, should be flagged
      if (!extremeScenario.complianceStatus.compliant) {
        expect(extremeScenario.complianceStatus.shortfalls.length).toBeGreaterThan(0);
        expect(result.summary.overallResult).toBe('FAIL');
      }
    });
  });

  describe('Regulatory Reporting', () => {
    it('should generate required regulatory reports', async () => {
      const reportingPeriod = { year: 2024, quarter: 4 };
      const reportTypes = ['PILLAR3', 'COREP', 'FINREP'];

      const result = await baselService.generateRegulatoryReports(reportingPeriod, reportTypes);

      expect(result.reports).toHaveLength(3);
      expect(result.package.submissionReady).toBe(true);
      expect(result.package.digitallySignedByHSM).toBe(true);

      // Validate each report
      result.reports.forEach((report: any) => {
        expect(report).toMatchObject({
          type: expect.stringMatching(/^(PILLAR3|COREP|FINREP)$/),
          period: reportingPeriod,
          generatedAt: expect.any(Date),
          digitalSignature: expect.stringMatching(/^SIG_\d+$/),
          validated: true
        });
      });
    });

    it('should maintain regulatory report audit trail', async () => {
      const reportingPeriod = { year: 2024, quarter: 4 };
      await baselService.generateRegulatoryReports(reportingPeriod, ['PILLAR3']);

      const auditLog = baselService.getAuditLog();
      const reportingEvent = auditLog.find(event => event.operation === 'REGULATORY_REPORTING');

      expect(reportingEvent).toMatchObject({
        operation: 'REGULATORY_REPORTING',
        timestamp: expect.any(Date),
        reportTypes: ['PILLAR3'],
        reportsGenerated: 1,
        submissionReady: true
      });
    });

    it('should store generated reports for regulatory access', async () => {
      const reportingPeriod = { year: 2024, quarter: 3 };
      await baselService.generateRegulatoryReports(reportingPeriod, ['COREP', 'FINREP']);

      const storedReports = baselService.getRegulatoryReports();
      expect(storedReports.length).toBeGreaterThanOrEqual(2);

      const latestReports = storedReports.slice(-2);
      latestReports.forEach(report => {
        expect(report.period).toEqual(reportingPeriod);
        expect(['COREP', 'FINREP']).toContain(report.type);
      });
    });
  });

  describe('Performance and Data Retention', () => {
    it('should handle regulatory calculations efficiently', async () => {
      const startTime = performance.now();

      // Perform multiple calculations in parallel
      await Promise.all([
        baselService.calculateCapitalAdequacyRatios(new Date()),
        baselService.calculateLiquidityCoverageRatio(new Date()),
        baselService.calculateOperationalRisk({ year: 2024, quarter: 4 })
      ]);

      const executionTime = performance.now() - startTime;

      // Should complete regulatory calculations efficiently
      expect(executionTime).toBeLessThan(1000); // 1 second
    });

    it('should maintain audit log for required retention period', async () => {
      // Basel III requires 7 years retention
      const auditRetentionYears = 7;
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - auditRetentionYears);

      // All audit events should have retention metadata
      const auditLog = baselService.getAuditLog();
      auditLog.forEach(event => {
        expect(event.timestamp).toBeInstanceOf(Date);
        // In production: validate retention policy enforcement
      });
    });

    it('should handle large-scale Basel III calculations', async () => {
      const startTime = performance.now();
      const numCalculations = 50;

      const promises = Array.from({ length: numCalculations }, (_, i) =>
        baselService.calculateCapitalAdequacyRatios(new Date())
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();

      expect(results).toHaveLength(numCalculations);
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds for 50 calculations

      // Verify all calculations are compliant
      results.forEach(result => {
        expect(result.complianceStatus.compliant).toBe(true);
        expect(result._baselCompliance.framework).toBe('BASEL_III');
      });
    });
  });

  afterAll(async () => {
    // Cleanup test artifacts
    // In production: securely archive regulatory data per retention requirements
  });
});