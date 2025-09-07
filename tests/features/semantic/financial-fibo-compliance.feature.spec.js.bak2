import { defineFeature, loadFeature } from 'jest-cucumber';
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { Store, DataFactory } from 'n3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TurtleParser } from '../../../src/lib/turtle-parser.js';
import { RdfDataLoader } from '../../../src/lib/rdf-data-loader.js';

const feature = loadFeature(join(__dirname, 'financial-fibo-compliance.feature'));

defineFeature(feature, (test) => {
  let store;
  let parser;
  let dataLoader;
  let fiboOntology;
  let portfolioData => {
    parser = new TurtleParser();
    dataLoader = new RdfDataLoader();
    
    // Load FIBO ontology
    const fiboData = readFileSync(
      join(__dirname, '../../fixtures/semantic/fibo-ontology-subset.ttl'),
      'utf8'
    );
    fiboOntology = await parser.parseToStore(fiboData);
    
    // Load Basel III rules
    const baselRules = readFileSync(
      join(__dirname, '../../fixtures/semantic/basel-iii-rules.ttl'),
      'utf8'
    );
    const baselStore = await parser.parseToStore(baselRules);
    fiboOntology.addQuads(baselStore.getQuads(null, null, null, null));
  });

  beforeEach(() => {
    processedData = null;
    startTime = Date.now();
  });

  test('Process Derivatives Portfolio with FIBO Classification', ({ given, when, then }) => {
    given('I have a derivatives portfolio with 500 instruments', async () => {
      const portfolioJson = readFileSync(
        join(__dirname, '../../fixtures/semantic/derivatives-portfolio-500.json'),
        'utf8'
      );
      portfolioData = JSON.parse(portfolioJson);
      expect(portfolioData.instruments).toHaveLength(500);
    });

    given('each instrument has FIBO-compliant metadata', () => {
      portfolioData.instruments.forEach(instrument => {
        expect(instrument.fiboType).toBeDefined();
        expect(instrument.underlyingAsset).toBeDefined();
        expect(instrument.counterparty).toBeDefined();
        expect(instrument.notionalAmount).toBeDefined();
      });
    });

    when('I process the portfolio through financial templates', async () => {
      startTime = Date.now();
      processedData = await processDerivativesPortfolio(portfolioData, fiboOntology);
    });

    then('instruments should be properly classified using FIBO types', () => {
      expect(processedData.classifications).toBeDefined();
      expect(processedData.classifications.length).toBe(500);
      
      processedData.classifications.forEach(classification => {
        expect(classification.instrumentId).toBeDefined();
        expect(classification.fiboClass).toBeDefined();
        expect(classification.assetClass).toBeDefined();
        expect(['Derivative', 'Swap', 'Option', 'Forward', 'Future']).toContain(classification.fiboClass);
      });
    });

    then('risk calculations should follow Basel III methodologies', () => {
      expect(processedData.riskMetrics).toBeDefined();
      
      const cvdRisk = processedData.riskMetrics.creditValueAdjustment;
      expect(cvdRisk).toBeDefined();
      expect(typeof cvdRisk.total).toBe('number');
      
      const counterpartyRisk = processedData.riskMetrics.counterpartyExposure;
      expect(counterpartyRisk).toBeDefined();
      expect(Array.isArray(counterpartyRisk.exposures)).toBe(true);
    });

    then('counterparty exposure should be accurately computed', () => {
      const exposures = processedData.riskMetrics.counterpartyExposure.exposures;
      
      exposures.forEach(exposure => {
        expect(exposure.counterpartyId).toBeDefined();
        expect(exposure.currentExposure).toBeDefined();
        expect(exposure.potentialFutureExposure).toBeDefined();
        expect(exposure.riskWeighting).toBeDefined();
        expect(exposure.nettingAgreement).toBeDefined();
      });
      
      const totalExposure = exposures.reduce((sum, exp) => sum + exp.currentExposure, 0);
      expect(totalExposure).toBeGreaterThan(0);
    });

    then('all calculations should be auditable per SOX requirements', () => {
      expect(processedData.auditTrail).toBeDefined();
      expect(processedData.auditTrail.length).toBeGreaterThan(0);
      
      processedData.auditTrail.forEach(entry => {
        expect(entry.timestamp).toBeDefined();
        expect(entry.calculationType).toBeDefined();
        expect(entry.inputData).toBeDefined();
        expect(entry.formula).toBeDefined();
        expect(entry.result).toBeDefined();
        expect(entry.validator).toBeDefined();
      });
    });
  });

  test('Generate Regulatory Capital Reports', ({ given, when, then }) => {
    given('I have bank portfolio data with various asset classes', async () => {
      const bankPortfolio = readFileSync(
        join(__dirname, '../../fixtures/semantic/bank-portfolio-mixed-assets.json'),
        'utf8'
      );
      portfolioData = JSON.parse(bankPortfolio);
      
      const assetClasses = new Set(portfolioData.assets.map(asset => asset.assetClass));
      expect(assetClasses.size).toBeGreaterThan(3); // Multiple asset classes
    });

    given('FIBO risk ontologies are loaded', async () => {
      const riskOntology = readFileSync(
        join(__dirname, '../../fixtures/semantic/fibo-risk-ontology.ttl'),
        'utf8'
      );
      const riskStore = await parser.parseToStore(riskOntology);
      fiboOntology.addQuads(riskStore.getQuads(null, null, null, null));
    });

    when('I generate Basel III capital adequacy reports', async () => {
      processedData = await generateCapitalAdequacyReport(portfolioData, fiboOntology);
    });

    then('risk-weighted assets should be calculated correctly', () => {
      expect(processedData.riskWeightedAssets).toBeDefined();
      expect(processedData.riskWeightedAssets.total).toBeGreaterThan(0);
      
      const rwaByClass = processedData.riskWeightedAssets.byAssetClass;
      expect(Object.keys(rwaByClass).length).toBeGreaterThan(0);
      
      Object.values(rwaByClass).forEach((rwa) => {
        expect(rwa.exposure).toBeGreaterThan(0);
        expect(rwa.riskWeight).toBeGreaterThan(0);
        expect(rwa.riskWeightedAmount).toBe(rwa.exposure * rwa.riskWeight);
      });
    });

    then('capital ratios should meet regulatory minimums', () => {
      const ratios = processedData.capitalRatios;
      
      expect(ratios.cet1Ratio).toBeGreaterThanOrEqual(0.045); // 4.5% minimum
      expect(ratios.tier1CapitalRatio).toBeGreaterThanOrEqual(0.06); // 6% minimum
      expect(ratios.totalCapitalRatio).toBeGreaterThanOrEqual(0.08); // 8% minimum
    });

    then('leverage ratios should be computed per Basel III rules', () => {
      expect(processedData.leverageRatio).toBeDefined();
      expect(processedData.leverageRatio.ratio).toBeGreaterThanOrEqual(0.03); // 3% minimum
      expect(processedData.leverageRatio.tier1Capital).toBeDefined();
      expect(processedData.leverageRatio.exposureMeasure).toBeDefined();
    });

    then('reports should be generated in XBRL format', () => { expect(processedData.xbrlReport).toBeDefined();
      expect(processedData.xbrlReport).toContain('<xbrli });
  });

  test('Trade Settlement Risk Analysis', ({ given, when, then }) => {
    given('I have trade settlement data with counterparty information', async () => {
      const settlementData = readFileSync(
        join(__dirname, '../../fixtures/semantic/trade-settlement-data.json'),
        'utf8'
      );
      portfolioData = JSON.parse(settlementData);
      
      expect(portfolioData.trades).toBeDefined();
      expect(portfolioData.trades.length).toBeGreaterThan(0);
      
      portfolioData.trades.forEach(trade => {
        expect(trade.counterparty).toBeDefined();
        expect(trade.settlementDate).toBeDefined();
        expect(trade.tradeAmount).toBeDefined();
      });
    });

    given('FIBO party and agreement ontologies are loaded', async () => {
      const partyOntology = readFileSync(
        join(__dirname, '../../fixtures/semantic/fibo-party-ontology.ttl'),
        'utf8'
      );
      const agreementOntology = readFileSync(
        join(__dirname, '../../fixtures/semantic/fibo-agreement-ontology.ttl'),
        'utf8'
      );
      
      const partyStore = await parser.parseToStore(partyOntology);
      const agreementStore = await parser.parseToStore(agreementOntology);
      
      fiboOntology.addQuads(partyStore.getQuads(null, null, null, null));
      fiboOntology.addQuads(agreementStore.getQuads(null, null, null, null));
    });

    when('I analyze settlement risk exposure', async () => {
      processedData = await analyzeSettlementRisk(portfolioData, fiboOntology);
    });

    then('counterparty credit ratings should be properly weighted', () => {
      expect(processedData.counterpartyRisk).toBeDefined();
      
      processedData.counterpartyRisk.forEach(risk => {
        expect(risk.counterpartyId).toBeDefined();
        expect(risk.creditRating).toBeDefined();
        expect(risk.riskWeight).toBeDefined();
        expect(risk.exposureAmount).toBeDefined();
        
        // Higher risk weight for lower ratings
        if (risk.creditRating.includes('AAA')) {
          expect(risk.riskWeight).toBeLessThan(0.5);
        } else if (risk.creditRating.includes('BBB')) {
          expect(risk.riskWeight).toBeGreaterThan(0.5);
        }
      });
    });

    then('settlement timeframes should affect risk calculations', () => {
      const riskByTimeframe = processedData.settlementRiskByTimeframe;
      expect(riskByTimeframe).toBeDefined();
      
      // T+0 should have lower risk than T+3
      if (riskByTimeframe['T+0'] && riskByTimeframe['T+3']) {
        expect(riskByTimeframe['T+0'].riskMultiplier).toBeLessThan(riskByTimeframe['T+3'].riskMultiplier);
      }
    });

    then('netting agreements should be factored into exposure', () => {
      expect(processedData.nettingAnalysis).toBeDefined();
      
      const grossExposure = processedData.nettingAnalysis.grossExposure;
      const netExposure = processedData.nettingAnalysis.netExposure;
      const nettingBenefit = processedData.nettingAnalysis.nettingBenefit;
      
      expect(netExposure).toBeLessThanOrEqual(grossExposure);
      expect(nettingBenefit).toBe(grossExposure - netExposure);
    });

    then('concentration risk should be identified and reported', () => {
      expect(processedData.concentrationRisk).toBeDefined();
      
      const concentrations = processedData.concentrationRisk.concentrations;
      expect(Array.isArray(concentrations)).toBe(true);
      
      concentrations.forEach(concentration => {
        expect(concentration.entity).toBeDefined();
        expect(concentration.exposureAmount).toBeDefined();
        expect(concentration.percentageOfCapital).toBeDefined();
        expect(concentration.riskLevel).toBeDefined();
      });
    });
  });

  // Helper functions for real financial processing
  async function processDerivativesPortfolio(portfolio, ontology) { const processed = {
      classifications },
        counterpartyExposure: { exposures }
      },
      auditTrail: []
    };

    for (const instrument of portfolio.instruments) { // FIBO classification
      const classification = {
        instrumentId };
      processed.classifications.push(classification);

      // CVA calculation
      const cva = calculateCVA(instrument);
      processed.riskMetrics.creditValueAdjustment.total += cva;
      processed.riskMetrics.creditValueAdjustment.byInstrument.push({ instrumentId };
      processed.riskMetrics.counterpartyExposure.exposures.push(exposure);

      // Audit trail
      processed.auditTrail.push({ timestamp).toISOString(),
        calculationType },
        formula: 'CVA = LGD × EAD × PD',
        result,
        validator: 'system'
      });
    }

    return processed;
  }

  async function generateCapitalAdequacyReport(portfolio, ontology) { const riskWeightedAssets = calculateRiskWeightedAssets(portfolio);
    const capitalAmounts = calculateCapitalAmounts(portfolio);
    
    return {
      riskWeightedAssets,
      capitalRatios },
      leverageRatio: { ratio },
      xbrlReport: generateXBRLReport(capitalAmounts, riskWeightedAssets)
    };
  }

  async function analyzeSettlementRisk(data, ontology) { const counterpartyRisk = data.trades.map(trade => ({
      counterpartyId }));

    const settlementRiskByTimeframe = { 'T+0' },
      'T+1': { riskMultiplier },
      'T+2': { riskMultiplier },
      'T+3': { riskMultiplier }
    };

    const grossExposure = data.trades.reduce((sum, trade) => sum + trade.tradeAmount, 0);
    const nettingBenefit = calculateNettingBenefit(data.trades);
    const netExposure = grossExposure - nettingBenefit;

    const concentrations = calculateConcentrationRisk(data.trades);

    return { counterpartyRisk,
      settlementRiskByTimeframe,
      nettingAnalysis },
      concentrationRisk: { concentrations }
    };
  }

  function classifyInstrument(instrument) {
    const type = instrument.instrumentType?.toLowerCase();
    if (type?.includes('swap')) return 'Swap';
    if (type?.includes('option')) return 'Option';
    if (type?.includes('forward')) return 'Forward';
    if (type?.includes('future')) return 'Future';
    return 'Derivative';
  }

  function calculateCVA(instrument) {
    // Simplified CVA calculation = LGD × EAD × PD
    const lgd = 0.6; // Loss Given Default
    const ead = instrument.notionalAmount * 0.1; // Exposure at Default
    const pd = getProbabilityOfDefault(instrument.counterparty.rating);
    return lgd * ead * pd;
  }

  function getRiskWeight(rating) { const weights = {
      'AAA' };
    return weights[rating] || 1.0;
  }

  function getProbabilityOfDefault(rating) { const pdRates = {
      'AAA' };
    return pdRates[rating] || 0.05;
  }

  function calculateRiskWeightedAssets(portfolio) {
    const total = portfolio.assets.reduce((sum, asset) => {
      const riskWeight = getRiskWeight(asset.rating || 'BBB');
      return sum + (asset.exposure * riskWeight);
    }, 0);

    const byAssetClass = {};
    portfolio.assets.forEach(asset => { const riskWeight = getRiskWeight(asset.rating || 'BBB');
      if (!byAssetClass[asset.assetClass]) {
        byAssetClass[asset.assetClass] = {
          exposure };
      }
      byAssetClass[asset.assetClass].exposure += asset.exposure;
      byAssetClass[asset.assetClass].riskWeightedAmount += asset.exposure * riskWeight;
    });

    return { total, byAssetClass };
  }

  function calculateCapitalAmounts(portfolio) { return {
      cet1 };
  }

  function generateXBRLReport(capital, rwa) { return `<?xml version="1.0" encoding="UTF-8"?>
<xbrli }</CET1_Ratio>
  <Tier1_Capital_Ratio contextRef="current">${(capital.tier1 / rwa.total).toFixed(4)}</Tier1_Capital_Ratio>
  <Total_Capital_Ratio contextRef="current">${(capital.total / rwa.total).toFixed(4)}</Total_Capital_Ratio>
</xbrli:xbrl>`;
  }

  function calculateNettingBenefit(trades) {
    // Group trades by counterparty and calculate netting benefit
    const byCounterparty = {};
    trades.forEach(trade => {
      if (!byCounterparty[trade.counterparty.id]) {
        byCounterparty[trade.counterparty.id] = [];
      }
      byCounterparty[trade.counterparty.id].push(trade);
    });

    let totalBenefit = 0;
    Object.values(byCounterparty).forEach((counterpartyTrades) => {
      const gross = counterpartyTrades.reduce((sum, trade) => sum + Math.abs(trade.tradeAmount), 0);
      const net = Math.abs(counterpartyTrades.reduce((sum, trade) => sum + trade.tradeAmount, 0));
      totalBenefit += (gross - net);
    });

    return totalBenefit;
  }

  function calculateConcentrationRisk(trades) {
    const exposureByEntity = {};
    const totalCapital = 1000000000; // $1B assumed capital

    trades.forEach(trade => { if (!exposureByEntity[trade.counterparty.id]) {
        exposureByEntity[trade.counterparty.id] = {
          entity };
      }
      exposureByEntity[trade.counterparty.id].exposureAmount += Math.abs(trade.tradeAmount);
    });

    return Object.values(exposureByEntity).map((exposure) => ({ ...exposure,
      percentageOfCapital }
});