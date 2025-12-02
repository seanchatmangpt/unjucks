/**
 * ROI Calculator Utility
 * 
 * Calculates return on investment metrics for knowledge pack utilization.
 */

export class ROICalculator {
  constructor() {
    this.hourlyRate = 150; // Average developer hourly rate
    this.defaultProjectDuration = 30; // Days
  }

  calculateMonthlyROI(portfolioData, costAnalysis) {
    const totalInvestment = this.calculateTotalInvestment(portfolioData);
    const monthlySavings = this.calculateMonthlySavings(costAnalysis);
    
    return ((monthlySavings - totalInvestment) / totalInvestment) * 100;
  }

  calculateTotalInvestment(portfolioData) {
    // Base cost per pack + implementation time
    const baseCostPerPack = 500; // Licensing/acquisition cost
    const implementationHours = 8; // Average implementation time per pack
    
    return portfolioData.totalPacks * (baseCostPerPack + (implementationHours * this.hourlyRate));
  }

  calculateMonthlySavings(costAnalysis) {
    return costAnalysis?.totalCostSaved || this.estimateMonthlySavings();
  }

  estimateMonthlySavings() {
    // Estimated savings based on typical knowledge pack utilization
    const averageTimeSavedPerPackPerMonth = 40; // Hours
    const averagePacksUsedPerMonth = 5;
    
    return averageTimeSavedPerPackPerMonth * averagePacksUsedPerMonth * this.hourlyRate;
  }

  async analyzeCosts() {
    // In production, this would analyze actual project costs and time savings
    return {
      totalTimeSaved: 2400, // Hours per month
      totalCostSaved: 360000, // $360k per month  
      roi: 85.5, // 85.5% ROI
      paybackPeriod: 3.2 // Months
    };
  }

  calculateRevenueImpact(portfolioData) {
    const fasterDelivery = portfolioData.timeMetrics?.improvement || 25; // 25% faster
    const qualityImprovement = 15; // 15% fewer bugs
    const teamProductivity = 30; // 30% more productive
    
    // Simplified revenue impact calculation
    const baseProjectValue = 500000; // Average project value
    const projectsPerYear = 12;
    
    const revenueFromSpeed = baseProjectValue * projectsPerYear * (fasterDelivery / 100) * 0.3;
    const revenueFromQuality = baseProjectValue * projectsPerYear * (qualityImprovement / 100) * 0.2;
    const revenueFromProductivity = baseProjectValue * projectsPerYear * (teamProductivity / 100) * 0.4;
    
    return {
      totalImpact: revenueFromSpeed + revenueFromQuality + revenueFromProductivity,
      breakdown: {
        fasterDelivery: revenueFromSpeed,
        qualityImprovement: revenueFromQuality,
        teamProductivity: revenueFromProductivity
      }
    };
  }

  async generateForecasts() {
    // Generate ROI forecasts for different scenarios
    return {
      conservative: {
        year1: 45000,
        year2: 95000,
        year3: 180000
      },
      realistic: {
        year1: 85000,
        year2: 200000,
        year3: 425000
      },
      optimistic: {
        year1: 150000,
        year2: 380000,
        year3: 750000
      }
    };
  }

  calculatePaybackPeriod(investment, monthlySavings) {
    return investment / monthlySavings;
  }

  calculateNetPresentValue(cashFlows, discountRate = 0.08) {
    let npv = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      npv += cashFlows[i] / Math.pow(1 + discountRate, i + 1);
    }
    return npv;
  }

  calculateInternalRateOfReturn(cashFlows) {
    // Simplified IRR calculation using approximation
    let rate = 0.1;
    let npv = this.calculateNetPresentValue(cashFlows, rate);
    
    while (Math.abs(npv) > 0.01) {
      const derivative = this.calculateNPVDerivative(cashFlows, rate);
      rate = rate - npv / derivative;
      npv = this.calculateNetPresentValue(cashFlows, rate);
    }
    
    return rate * 100;
  }

  calculateNPVDerivative(cashFlows, rate) {
    let derivative = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      derivative -= (i + 1) * cashFlows[i] / Math.pow(1 + rate, i + 2);
    }
    return derivative;
  }
}