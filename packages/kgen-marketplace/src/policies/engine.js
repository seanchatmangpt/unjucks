/**
 * Policy Engine for Settlement Rules
 * Handles AND/OR logic, thresholds, and complex settlement policies
 */

class PolicyEngine {
  constructor() {
    this.operators = {
      AND: 'and',
      OR: 'or',
      XOR: 'xor',
      NAND: 'nand',
      NOR: 'nor'
    };
  }

  /**
   * Evaluate if user balances satisfy requirement under given policy
   */
  static evaluate(userBalances, requirement, policy) {
    const engine = new PolicyEngine();
    return engine.evaluate(userBalances, requirement, policy);
  }

  evaluate(userBalances, requirement, policy) {
    if (!policy) {
      // Default policy: all dimensions must be satisfied
      return this.evaluateDefault(userBalances, requirement);
    }

    if (typeof policy === 'string') {
      policy = this.parsePolicy(policy);
    }

    return this.evaluatePolicy(userBalances, requirement, policy);
  }

  /**
   * Default evaluation: all dimensions >= requirement
   */
  evaluateDefault(userBalances, requirement) {
    for (const [dimension, requiredAmount] of Object.entries(requirement.dimensions)) {
      const userAmount = userBalances.dimensions[dimension] || 0;
      if (userAmount < requiredAmount) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate complex policy rules
   */
  evaluatePolicy(userBalances, requirement, policy) {
    switch (policy.type) {
      case 'simple':
        return this.evaluateSimplePolicy(userBalances, requirement, policy);
      
      case 'logical':
        return this.evaluateLogicalPolicy(userBalances, requirement, policy);
      
      case 'threshold':
        return this.evaluateThresholdPolicy(userBalances, requirement, policy);
      
      case 'vesting':
        return this.evaluateVestingPolicy(userBalances, requirement, policy);
      
      case 'composite':
        return this.evaluateCompositePolicy(userBalances, requirement, policy);
      
      default:
        throw new Error(`Unknown policy type: ${policy.type}`);
    }
  }

  /**
   * Simple policy: basic dimension requirements
   */
  evaluateSimplePolicy(userBalances, requirement, policy) {
    const { dimensions, operator = 'and' } = policy;
    
    if (!dimensions) {
      return this.evaluateDefault(userBalances, requirement);
    }

    const results = [];
    for (const dimension of dimensions) {
      const requiredAmount = requirement.dimensions[dimension] || 0;
      const userAmount = userBalances.dimensions[dimension] || 0;
      results.push(userAmount >= requiredAmount);
    }

    return this.applyLogicalOperator(results, operator);
  }

  /**
   * Logical policy: AND/OR combinations
   */
  evaluateLogicalPolicy(userBalances, requirement, policy) {
    const { rules, operator = 'and' } = policy;
    
    const results = rules.map(rule => {
      if (rule.type === 'dimension') {
        return this.evaluateDimensionRule(userBalances, requirement, rule);
      } else if (rule.type === 'nested') {
        return this.evaluatePolicy(userBalances, requirement, rule.policy);
      }
      throw new Error(`Unknown rule type: ${rule.type}`);
    });

    return this.applyLogicalOperator(results, operator);
  }

  /**
   * Threshold policy: percentage or ratio requirements
   */
  evaluateThresholdPolicy(userBalances, requirement, policy) {
    const { threshold, mode = 'percentage' } = policy;
    
    if (mode === 'percentage') {
      // User must have at least X% of required amount across all dimensions
      let totalRequired = 0;
      let totalAvailable = 0;
      
      for (const [dimension, requiredAmount] of Object.entries(requirement.dimensions)) {
        totalRequired += requiredAmount;
        totalAvailable += userBalances.dimensions[dimension] || 0;
      }
      
      const availablePercentage = totalRequired > 0 ? (totalAvailable / totalRequired) * 100 : 100;
      return availablePercentage >= threshold;
      
    } else if (mode === 'minimum_dimensions') {
      // User must satisfy at least X number of dimensions
      let satisfiedCount = 0;
      
      for (const [dimension, requiredAmount] of Object.entries(requirement.dimensions)) {
        const userAmount = userBalances.dimensions[dimension] || 0;
        if (userAmount >= requiredAmount) {
          satisfiedCount++;
        }
      }
      
      return satisfiedCount >= threshold;
    }

    throw new Error(`Unknown threshold mode: ${mode}`);
  }

  /**
   * Vesting policy: time-based requirements
   */
  evaluateVestingPolicy(userBalances, requirement, policy) {
    const { vestingSchedule, currentTime } = policy;
    const now = currentTime ? new Date(currentTime) : new Date();
    
    // Calculate vested percentage based on time
    let vestedPercentage = 0;
    
    for (const schedule of vestingSchedule) {
      const startTime = new Date(schedule.startTime);
      const endTime = new Date(schedule.endTime);
      
      if (now >= endTime) {
        vestedPercentage += schedule.percentage;
      } else if (now >= startTime) {
        const elapsed = now - startTime;
        const total = endTime - startTime;
        const progress = elapsed / total;
        vestedPercentage += schedule.percentage * progress;
      }
    }
    
    vestedPercentage = Math.min(vestedPercentage, 100);
    
    // Apply vested percentage to requirements
    const adjustedRequirement = {
      dimensions: {}
    };
    
    for (const [dimension, amount] of Object.entries(requirement.dimensions)) {
      adjustedRequirement.dimensions[dimension] = amount * (vestedPercentage / 100);
    }
    
    return this.evaluateDefault(userBalances, { dimensions: adjustedRequirement.dimensions });
  }

  /**
   * Composite policy: multiple sub-policies
   */
  evaluateCompositePolicy(userBalances, requirement, policy) {
    const { policies, operator = 'and' } = policy;
    
    const results = policies.map(subPolicy => 
      this.evaluatePolicy(userBalances, requirement, subPolicy)
    );
    
    return this.applyLogicalOperator(results, operator);
  }

  /**
   * Evaluate individual dimension rule
   */
  evaluateDimensionRule(userBalances, requirement, rule) {
    const { dimension, operator = '>=', multiplier = 1 } = rule;
    const requiredAmount = (requirement.dimensions[dimension] || 0) * multiplier;
    const userAmount = userBalances.dimensions[dimension] || 0;
    
    switch (operator) {
      case '>=': return userAmount >= requiredAmount;
      case '>': return userAmount > requiredAmount;
      case '<=': return userAmount <= requiredAmount;
      case '<': return userAmount < requiredAmount;
      case '==': return userAmount === requiredAmount;
      case '!=': return userAmount !== requiredAmount;
      default: throw new Error(`Unknown operator: ${operator}`);
    }
  }

  /**
   * Apply logical operator to array of boolean results
   */
  applyLogicalOperator(results, operator) {
    switch (operator.toLowerCase()) {
      case 'and':
        return results.every(r => r);
      
      case 'or':
        return results.some(r => r);
      
      case 'xor':
        return results.filter(r => r).length === 1;
      
      case 'nand':
        return !results.every(r => r);
      
      case 'nor':
        return !results.some(r => r);
      
      default:
        throw new Error(`Unknown logical operator: ${operator}`);
    }
  }

  /**
   * Parse policy from string representation
   */
  parsePolicy(policyString) {
    try {
      return JSON.parse(policyString);
    } catch {
      // Simple string policies like "fiat AND crypto OR reputation"
      return this.parseSimplePolicyString(policyString);
    }
  }

  /**
   * Parse simple policy string
   */
  parseSimplePolicyString(policyString) {
    const tokens = policyString.split(/\s+(AND|OR|XOR|NAND|NOR)\s+/i);
    
    if (tokens.length === 1) {
      return {
        type: 'simple',
        dimensions: [tokens[0].trim()]
      };
    }
    
    // For now, handle simple cases
    const dimensions = tokens.filter((token, index) => index % 2 === 0);
    const operators = tokens.filter((token, index) => index % 2 === 1);
    
    return {
      type: 'logical',
      operator: operators[0]?.toLowerCase() || 'and',
      rules: dimensions.map(dim => ({
        type: 'dimension',
        dimension: dim.trim()
      }))
    };
  }
}

export { PolicyEngine };