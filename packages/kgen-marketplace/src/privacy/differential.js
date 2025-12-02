/**
 * Differential Privacy Implementation
 * Provides privacy-preserving data analysis with formal guarantees
 */

import { randomBytes } from 'crypto';

export class DifferentialPrivacy {
  constructor(options = {}) {
    this.epsilon = options.epsilon || 1.0; // Privacy budget
    this.delta = options.delta || 1e-5;     // Failure probability
    this.sensitivity = options.sensitivity || 1.0; // Global sensitivity
    this.mechanism = options.mechanism || 'laplace'; // laplace, gaussian, exponential
  }

  /**
   * Add calibrated noise to numeric data
   */
  addNoise(data, numericFields = []) {
    const result = { ...data };
    
    numericFields.forEach(field => {
      if (typeof result[field] === 'number') {
        result[field] = this.addLaplaceNoise(result[field]);
      }
    });
    
    return result;
  }

  /**
   * Add noise to aggregated statistics
   */
  addNoiseToAggregates(aggregates) {
    const result = {};
    
    Object.keys(aggregates).forEach(key => {
      const value = aggregates[key];
      
      if (typeof value === 'number') {
        result[key] = this.addLaplaceNoise(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.addNoiseToObject(value);
      } else {
        result[key] = value;
      }
    });
    
    return result;
  }

  /**
   * Add Laplace noise for differential privacy
   */
  addLaplaceNoise(value, sensitivity = this.sensitivity) {
    const scale = sensitivity / this.epsilon;
    const noise = this.sampleLaplace(0, scale);
    return Math.max(0, value + noise); // Ensure non-negative
  }

  /**
   * Add Gaussian noise (for (ε,δ)-differential privacy)
   */
  addGaussianNoise(value, sensitivity = this.sensitivity) {
    const sigma = (sensitivity * Math.sqrt(2 * Math.log(1.25 / this.delta))) / this.epsilon;
    const noise = this.sampleGaussian(0, sigma);
    return Math.max(0, value + noise);
  }

  /**
   * Exponential mechanism for categorical data
   */
  exponentialMechanism(candidates, qualityFunction, sensitivity = this.sensitivity) {
    const scores = candidates.map(candidate => qualityFunction(candidate));
    const maxScore = Math.max(...scores);
    
    // Normalize scores and apply exponential weighting
    const weights = scores.map(score => {
      const normalizedScore = score - maxScore;
      return Math.exp((this.epsilon * normalizedScore) / (2 * sensitivity));
    });
    
    // Sample proportionally to weights
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const probabilities = weights.map(w => w / totalWeight);
    
    return this.sampleCategorical(candidates, probabilities);
  }

  /**
   * Compute privacy budget usage
   */
  computeBudgetUsage(operations) {
    return operations.reduce((total, op) => {
      return total + (op.epsilon || this.epsilon);
    }, 0);
  }

  /**
   * Check if operation is within privacy budget
   */
  isWithinBudget(operations, maxBudget = 1.0) {
    return this.computeBudgetUsage(operations) <= maxBudget;
  }

  /**
   * Apply composition theorem for multiple operations
   */
  composePrivacy(operations) {
    // Basic composition (can be improved with advanced composition)
    const totalEpsilon = operations.reduce((sum, op) => sum + op.epsilon, 0);
    const totalDelta = operations.reduce((sum, op) => sum + op.delta, 0);
    
    return {
      epsilon: totalEpsilon,
      delta: Math.min(1.0, totalDelta)
    };
  }

  /**
   * Sanitize query results with differential privacy
   */
  sanitizeQueryResult(query, result, queryType = 'count') {
    switch (queryType) {
      case 'count':
        return this.addLaplaceNoise(result, 1); // Count queries have sensitivity 1
      
      case 'sum':
        return this.addLaplaceNoise(result, query.maxValue || 1);
      
      case 'average':
        return this.sanitizeAverage(result, query);
      
      case 'histogram':
        return this.sanitizeHistogram(result);
      
      default:
        throw new Error(`Unknown query type: ${queryType}`);
    }
  }

  /**
   * Create differentially private histogram
   */
  createPrivateHistogram(data, bins, domainSize) {
    const histogram = new Array(bins).fill(0);
    
    // Count items in each bin
    data.forEach(item => {
      const bin = this.mapToBin(item, bins, domainSize);
      if (bin >= 0 && bin < bins) {
        histogram[bin]++;
      }
    });
    
    // Add noise to each bin
    return histogram.map(count => this.addLaplaceNoise(count, 1));
  }

  /**
   * Private data release mechanism
   */
  releasePrivateData(data, releaseConfig) {
    const {
      fields = [],
      aggregations = [],
      k_anonymity = 5,
      l_diversity = 2
    } = releaseConfig;
    
    let processedData = this.applyKAnonymity(data, fields, k_anonymity);
    processedData = this.applyLDiversity(processedData, fields, l_diversity);
    
    // Add differential privacy noise
    if (aggregations.length > 0) {
      processedData = this.addNoiseToAggregations(processedData, aggregations);
    }
    
    return processedData;
  }

  /**
   * Helper methods
   */
  addNoiseToObject(obj) {
    const result = {};
    
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      
      if (typeof value === 'number') {
        result[key] = this.addLaplaceNoise(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map(v => 
          typeof v === 'number' ? this.addLaplaceNoise(v) : v
        );
      } else {
        result[key] = value;
      }
    });
    
    return result;
  }

  sanitizeAverage(average, query) {
    // For average, we need to add noise to both sum and count
    const noisySum = this.addLaplaceNoise(average * query.count, query.maxValue || 1);
    const noisyCount = this.addLaplaceNoise(query.count, 1);
    
    return noisyCount > 0 ? noisySum / noisyCount : 0;
  }

  sanitizeHistogram(histogram) {
    return histogram.map(bin => ({
      ...bin,
      count: this.addLaplaceNoise(bin.count, 1)
    }));
  }

  mapToBin(item, bins, domainSize) {
    if (typeof item === 'number') {
      return Math.floor((item / domainSize) * bins);
    }
    // For categorical data, hash to bin
    return this.hashToBin(item, bins);
  }

  hashToBin(item, bins) {
    let hash = 0;
    const str = String(item);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % bins;
  }

  applyKAnonymity(data, quasiIdentifiers, k) {
    // Simplified k-anonymity implementation
    // In practice, use more sophisticated algorithms like Mondrian
    const groups = this.groupByQuasiIdentifiers(data, quasiIdentifiers);
    
    return groups.filter(group => group.length >= k)
                 .flatMap(group => group);
  }

  applyLDiversity(data, sensitiveAttributes, l) {
    // Simplified l-diversity implementation
    const groups = this.groupBySensitiveAttributes(data, sensitiveAttributes);
    
    return groups.filter(group => {
      const uniqueValues = new Set(group.map(record => 
        sensitiveAttributes.map(attr => record[attr]).join('|')
      ));
      return uniqueValues.size >= l;
    }).flatMap(group => group);
  }

  groupByQuasiIdentifiers(data, identifiers) {
    const groups = new Map();
    
    data.forEach(record => {
      const key = identifiers.map(id => record[id]).join('|');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(record);
    });
    
    return Array.from(groups.values());
  }

  groupBySensitiveAttributes(data, attributes) {
    // Group by all non-sensitive attributes
    const groups = new Map();
    
    data.forEach(record => {
      const key = Object.keys(record)
                        .filter(k => !attributes.includes(k))
                        .map(k => record[k])
                        .join('|');
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(record);
    });
    
    return Array.from(groups.values());
  }

  addNoiseToAggregations(data, aggregations) {
    return data.map(record => {
      const noisyRecord = { ...record };
      
      aggregations.forEach(agg => {
        if (agg.type === 'sum' && noisyRecord[agg.field] !== undefined) {
          noisyRecord[agg.field] = this.addLaplaceNoise(noisyRecord[agg.field], agg.sensitivity || 1);
        }
      });
      
      return noisyRecord;
    });
  }

  /**
   * Sampling methods
   */
  sampleLaplace(mu, b) {
    const u = Math.random() - 0.5;
    return mu - b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  sampleGaussian(mu, sigma) {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mu + sigma * z0;
  }

  sampleCategorical(categories, probabilities) {
    const random = Math.random();
    let cumulativeProb = 0;
    
    for (let i = 0; i < categories.length; i++) {
      cumulativeProb += probabilities[i];
      if (random <= cumulativeProb) {
        return categories[i];
      }
    }
    
    return categories[categories.length - 1];
  }

  /**
   * Privacy accounting and reporting
   */
  generatePrivacyReport(operations) {
    const composition = this.composePrivacy(operations);
    
    return {
      totalEpsilon: composition.epsilon,
      totalDelta: composition.delta,
      budgetUsed: (composition.epsilon / this.epsilon) * 100,
      operations: operations.length,
      recommendations: this.generateRecommendations(composition),
      privacyGuarantees: this.describeGuarantees(composition)
    };
  }

  generateRecommendations(composition) {
    const recommendations = [];
    
    if (composition.epsilon > 1.0) {
      recommendations.push('Consider reducing epsilon for stronger privacy');
    }
    
    if (composition.delta > 1e-3) {
      recommendations.push('Delta value is high, consider using pure differential privacy');
    }
    
    return recommendations;
  }

  describeGuarantees(composition) {
    return {
      interpretation: `This release provides (${composition.epsilon.toFixed(3)}, ${composition.delta.toExponential(2)})-differential privacy`,
      meaning: 'The probability of any individual being identified is bounded',
      strength: composition.epsilon < 0.1 ? 'very strong' : 
               composition.epsilon < 1.0 ? 'strong' : 
               composition.epsilon < 10 ? 'moderate' : 'weak'
    };
  }
}

export default DifferentialPrivacy;