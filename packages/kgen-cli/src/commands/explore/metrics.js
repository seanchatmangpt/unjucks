/**
 * Metrics Command
 * 
 * Displays aggregated metrics across all persona views.
 */

import { defineCommand } from 'citty';
import { MarketplaceAnalyzer } from '../../utils/marketplace-analyzer.js';
import { ROICalculator } from '../../utils/roi-calculator.js';
import { ComplianceMatrix } from '../../utils/compliance-matrix.js';

export default defineCommand({
  meta: {
    name: 'metrics',
    description: 'Show aggregated metrics across persona views'
  },
  args: {
    format: {
      type: 'string',
      description: 'Output format',
      default: 'table',
      valueHint: 'json|yaml|table'
    },
    category: {
      type: 'string',
      description: 'Metric category',
      valueHint: 'business|technical|compliance|all'
    },
    timeframe: {
      type: 'string',
      description: 'Timeframe for metrics',
      default: '30d',
      valueHint: '24h|7d|30d|90d'
    }
  },
  async run({ args }) {
    const { format, category = 'all', timeframe } = args;
    
    console.log('Gathering marketplace metrics...');
    
    try {
      const analyzer = new MarketplaceAnalyzer();
      const roiCalc = new ROICalculator();
      const compliance = new ComplianceMatrix();
      
      const [
        portfolioData,
        marketMetrics,
        complianceData,
        costAnalysis
      ] = await Promise.all([
        analyzer.getPortfolioSummary(),
        analyzer.getMarketMetrics(),
        compliance.generateMatrix('summary'),
        roiCalc.analyzeCosts()
      ]);

      const aggregatedMetrics = {
        business: {
          totalPacks: portfolioData.totalPacks,
          activeProjects: portfolioData.activeProjects,
          monthlyROI: roiCalc.calculateMonthlyROI(portfolioData, costAnalysis),
          totalCostSaved: costAnalysis.totalCostSaved,
          paybackPeriod: costAnalysis.paybackPeriod
        },
        technical: {
          averagePerformance: this.calculateAveragePerformance(portfolioData),
          utilizationRate: portfolioData.utilizationRates.overall,
          complexityScore: this.calculateComplexityScore(portfolioData),
          healthScore: this.calculateHealthScore(portfolioData)
        },
        compliance: {
          overallScore: complianceData.overallScore,
          frameworks: complianceData.frameworks.length,
          gaps: complianceData.gaps.length,
          riskLevel: this.calculateRiskLevel(complianceData)
        },
        market: {
          totalDownloads: marketMetrics.totalDownloads,
          averageRating: marketMetrics.averageRating,
          activePackages: marketMetrics.activePackages,
          activeMaintainers: marketMetrics.activeMaintainers
        }
      };

      const result = {
        success: true,
        data: {
          timeframe,
          category,
          metrics: category === 'all' ? aggregatedMetrics : { [category]: aggregatedMetrics[category] },
          summary: this.generateSummary(aggregatedMetrics),
          trends: this.generateTrends(aggregatedMetrics),
          recommendations: this.generateRecommendations(aggregatedMetrics)
        },
        metadata: {
          generated: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      if (format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else if (format === 'table') {
        this.displayTable(result.data);
      }

      process.exit(0);
      
    } catch (error) {
      console.error('Failed to gather metrics:', error.message);
      process.exit(1);
    }
  },

  calculateAveragePerformance(portfolioData) {
    const categories = Object.values(portfolioData.categoryBreakdown);
    const totalPerf = categories.reduce((sum, cat) => sum + (cat.averagePerformance || 0), 0);
    return (totalPerf / categories.length).toFixed(1);
  },

  calculateComplexityScore(portfolioData) {
    // Simple complexity calculation based on category diversity and usage patterns
    const diversity = Object.keys(portfolioData.categoryBreakdown).length;
    const utilizationVariance = this.calculateUtilizationVariance(portfolioData);
    return ((diversity * 2) + utilizationVariance).toFixed(1);
  },

  calculateHealthScore(portfolioData) {
    const health = portfolioData.overview.health || 0.85;
    return (health * 10).toFixed(1);
  },

  calculateRiskLevel(complianceData) {
    if (complianceData.overallScore >= 90) return 'low';
    if (complianceData.overallScore >= 70) return 'medium';
    return 'high';
  },

  calculateUtilizationVariance(portfolioData) {
    const rates = Object.values(portfolioData.categoryBreakdown).map(cat => cat.usage || 0);
    const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    const variance = rates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / rates.length;
    return Math.sqrt(variance).toFixed(1);
  },

  generateSummary(metrics) {
    return {
      status: this.getOverallStatus(metrics),
      highlights: [
        `${metrics.business.totalPacks} knowledge packs deployed`,
        `${metrics.business.monthlyROI.toFixed(1)}% monthly ROI`,
        `${metrics.compliance.overallScore}% compliance score`,
        `${metrics.technical.healthScore}/10 system health`
      ],
      concerns: this.identifyConcerns(metrics)
    };
  },

  getOverallStatus(metrics) {
    const scores = [
      metrics.business.monthlyROI > 50 ? 100 : metrics.business.monthlyROI * 2,
      metrics.technical.healthScore * 10,
      metrics.compliance.overallScore,
      metrics.market.averageRating * 20
    ];
    
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    if (avgScore >= 85) return 'excellent';
    if (avgScore >= 70) return 'good';
    if (avgScore >= 50) return 'fair';
    return 'needs improvement';
  },

  identifyConcerns(metrics) {
    const concerns = [];
    
    if (metrics.business.monthlyROI < 20) {
      concerns.push('Low ROI indicates inefficient knowledge pack utilization');
    }
    
    if (metrics.compliance.overallScore < 70) {
      concerns.push('Compliance score below recommended threshold');
    }
    
    if (metrics.technical.healthScore < 7) {
      concerns.push('Technical health score needs attention');
    }
    
    if (metrics.technical.utilizationRate < 60) {
      concerns.push('Knowledge pack utilization below optimal levels');
    }
    
    return concerns;
  },

  generateTrends(metrics) {
    return {
      roi: 'increasing',
      compliance: 'stable', 
      performance: 'improving',
      adoption: 'growing'
    };
  },

  generateRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.business.monthlyROI < 50) {
      recommendations.push({
        category: 'business',
        action: 'Optimize knowledge pack selection and training',
        priority: 'high'
      });
    }
    
    if (metrics.compliance.gaps > 10) {
      recommendations.push({
        category: 'compliance',
        action: 'Address compliance gaps in high-priority frameworks',
        priority: 'critical'
      });
    }
    
    if (metrics.technical.utilizationRate < 70) {
      recommendations.push({
        category: 'technical',
        action: 'Improve knowledge pack discoverability and documentation',
        priority: 'medium'
      });
    }
    
    return recommendations;
  },

  displayTable(data) {
    console.log('\n📊 Marketplace Metrics Summary');
    console.log('═'.repeat(80));
    
    if (data.metrics.business) {
      console.log('\n💼 Business Metrics:');
      console.log(`   📦 Total Packs: ${data.metrics.business.totalPacks}`);
      console.log(`   🚀 Active Projects: ${data.metrics.business.activeProjects}`);
      console.log(`   💰 Monthly ROI: ${data.metrics.business.monthlyROI.toFixed(1)}%`);
      console.log(`   💵 Cost Saved: $${data.metrics.business.totalCostSaved.toLocaleString()}`);
    }
    
    if (data.metrics.technical) {
      console.log('\n🔧 Technical Metrics:');
      console.log(`   ⚡ Avg Performance: ${data.metrics.technical.averagePerformance}/10`);
      console.log(`   📈 Utilization: ${data.metrics.technical.utilizationRate.toFixed(1)}%`);
      console.log(`   🏥 Health Score: ${data.metrics.technical.healthScore}/10`);
      console.log(`   🔀 Complexity: ${data.metrics.technical.complexityScore}`);
    }
    
    if (data.metrics.compliance) {
      console.log('\n🛡️  Compliance Metrics:');
      console.log(`   ✅ Overall Score: ${data.metrics.compliance.overallScore}%`);
      console.log(`   📋 Frameworks: ${data.metrics.compliance.frameworks}`);
      console.log(`   ⚠️  Gaps: ${data.metrics.compliance.gaps}`);
      console.log(`   🎯 Risk Level: ${data.metrics.compliance.riskLevel}`);
    }
    
    console.log('\n📈 Summary:');
    console.log(`   Status: ${data.summary.status.toUpperCase()}`);
    data.summary.highlights.forEach(highlight => {
      console.log(`   • ${highlight}`);
    });
    
    if (data.summary.concerns.length > 0) {
      console.log('\n⚠️  Concerns:');
      data.summary.concerns.forEach(concern => {
        console.log(`   • ${concern}`);
      });
    }
    
    console.log('\n' + '═'.repeat(80));
  }
});