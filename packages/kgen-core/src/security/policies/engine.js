/**
 * Security Policy Engine
 * 
 * Advanced policy engine for enforcing security rules, data governance,
 * and business constraints across knowledge generation operations.
 */

import { EventEmitter } from 'events';
import consola from 'consola';

export class PolicyEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Policy Engine Configuration
      enableRealTimeEnforcement: true,
      enablePolicyInheritance: true,
      enableDynamicPolicies: false,
      enablePolicyVersioning: true,
      
      // Policy Evaluation
      defaultPolicyDecision: 'DENY', // ALLOW, DENY, WARN
      enablePolicyChaining: true,
      maxPolicyDepth: 10,
      
      // Performance
      enablePolicyCaching: true,
      cacheTimeout: 300000, // 5 minutes
      
      // Compliance
      strictComplianceMode: true,
      enablePolicyAudit: true,
      
      ...config
    };
    
    this.logger = consola.withTag('policy-engine');
    this.status = 'uninitialized';
    
    // Policy storage
    this.policies = new Map();
    this.policyGroups = new Map();
    this.policyRules = new Map();
    this.policyCache = new Map();
    this.policyInheritance = new Map();
    
    // Evaluation context
    this.evaluationHistory = [];
    this.policyViolations = [];
    
    // Metrics
    this.metrics = {
      policiesEvaluated: 0,
      policiesEnforced: 0,
      violations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      evaluationTime: 0
    };
    
    // Built-in policy types
    this.policyTypes = {
      DATA_CLASSIFICATION: 'data_classification',
      ACCESS_CONTROL: 'access_control',
      TEMPLATE_SECURITY: 'template_security',
      CODE_GENERATION: 'code_generation',
      COMPLIANCE: 'compliance',
      GOVERNANCE: 'governance'
    };
  }

  /**
   * Initialize policy engine
   */
  async initialize() {
    try {
      this.logger.info('Initializing policy engine...');
      this.status = 'initializing';
      
      // Load default policies
      await this._loadDefaultPolicies();
      
      // Setup policy inheritance
      if (this.config.enablePolicyInheritance) {
        await this._setupPolicyInheritance();
      }
      
      // Setup caching
      if (this.config.enablePolicyCaching) {
        this._setupCacheCleanup();
      }
      
      this.status = 'ready';
      this.logger.success('Policy engine initialized successfully');
      
      this.emit('policy:engine_initialized', {
        policies: this.policies.size,
        policyGroups: this.policyGroups.size,
        timestamp: this.getDeterministicDate()
      });
      
      return {
        status: 'success',
        policies: this.policies.size,
        policyTypes: Object.keys(this.policyTypes)
      };
      
    } catch (error) {
      this.status = 'error';
      this.logger.error('Policy engine initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create a new security policy
   */
  async createPolicy(policyDefinition) {
    try {
      this.logger.info(`Creating policy: ${policyDefinition.name}`);
      
      // Validate policy definition
      this._validatePolicyDefinition(policyDefinition);
      
      const policy = {
        id: policyDefinition.id || this._generatePolicyId(),
        name: policyDefinition.name,
        description: policyDefinition.description || '',
        type: policyDefinition.type,
        version: policyDefinition.version || '1.0.0',
        rules: policyDefinition.rules || [],
        conditions: policyDefinition.conditions || [],
        actions: policyDefinition.actions || [],
        severity: policyDefinition.severity || 'MEDIUM',
        enabled: policyDefinition.enabled !== false,
        metadata: {
          createdAt: this.getDeterministicDate(),
          updatedAt: this.getDeterministicDate(),
          createdBy: policyDefinition.createdBy,
          tags: policyDefinition.tags || []
        }
      };
      
      // Validate policy rules
      await this._validatePolicyRules(policy.rules);
      
      // Store policy
      this.policies.set(policy.id, policy);
      
      // Clear caches
      this._clearPolicyCache();
      
      this.emit('policy:created', {
        policyId: policy.id,
        policyName: policy.name,
        type: policy.type
      });
      
      this.logger.success(`Policy created: ${policy.name} (${policy.id})`);
      
      return policy;
      
    } catch (error) {
      this.logger.error('Policy creation failed:', error);
      throw error;
    }
  }

  /**
   * Evaluate operation against policies
   */
  async evaluateOperation(securityContext) {
    try {
      const startTime = this.getDeterministicTimestamp();
      this.metrics.policiesEvaluated++;
      
      this.logger.debug(`Evaluating policies for operation: ${securityContext.operationType}`);
      
      // Create evaluation context
      const evaluationContext = {
        ...securityContext,
        evaluationId: this._generateEvaluationId(),
        timestamp: this.getDeterministicDate()
      };
      
      // Check cache first
      const cacheKey = this._generateCacheKey(evaluationContext);
      if (this.config.enablePolicyCaching && this.policyCache.has(cacheKey)) {
        const cached = this.policyCache.get(cacheKey);
        if (this.getDeterministicTimestamp() - cached.timestamp < this.config.cacheTimeout) {
          this.metrics.cacheHits++;
          return cached.result;
        }
      }
      
      this.metrics.cacheMisses++;
      
      // Get applicable policies
      const applicablePolicies = await this._getApplicablePolicies(evaluationContext);
      
      if (applicablePolicies.length === 0) {
        const result = {
          compliant: this.config.defaultPolicyDecision === 'ALLOW',
          decision: this.config.defaultPolicyDecision,
          reason: 'No applicable policies found',
          appliedPolicies: [],
          violations: []
        };
        
        this._cacheResult(cacheKey, result);
        return result;
      }
      
      // Evaluate each policy
      const evaluationResults = [];
      for (const policy of applicablePolicies) {
        const policyResult = await this._evaluatePolicy(policy, evaluationContext);
        evaluationResults.push(policyResult);
      }
      
      // Combine results
      const combinedResult = this._combineEvaluationResults(evaluationResults, evaluationContext);
      
      // Record evaluation history
      this.evaluationHistory.push({
        evaluationId: evaluationContext.evaluationId,
        operationType: securityContext.operationType,
        result: combinedResult,
        timestamp: evaluationContext.timestamp,
        evaluationTime: this.getDeterministicTimestamp() - startTime
      });
      
      // Update metrics
      this.metrics.evaluationTime += this.getDeterministicTimestamp() - startTime;
      if (!combinedResult.compliant) {
        this.metrics.violations++;
      }
      
      // Cache result
      this._cacheResult(cacheKey, combinedResult);
      
      // Emit evaluation event
      this.emit('policy:evaluated', {
        evaluationId: evaluationContext.evaluationId,
        compliant: combinedResult.compliant,
        appliedPolicies: combinedResult.appliedPolicies.length,
        violations: combinedResult.violations.length
      });
      
      return combinedResult;
      
    } catch (error) {
      this.logger.error('Policy evaluation failed:', error);
      throw error;
    }
  }

  /**
   * Create policy group for related policies
   */
  async createPolicyGroup(groupDefinition) {
    try {
      this.logger.info(`Creating policy group: ${groupDefinition.name}`);
      
      const group = {
        id: groupDefinition.id || this._generateGroupId(),
        name: groupDefinition.name,
        description: groupDefinition.description || '',
        policies: groupDefinition.policies || [],
        evaluationStrategy: groupDefinition.evaluationStrategy || 'ALL_MUST_PASS',
        enabled: groupDefinition.enabled !== false,
        metadata: {
          createdAt: this.getDeterministicDate(),
          createdBy: groupDefinition.createdBy
        }
      };
      
      // Validate policies exist
      for (const policyId of group.policies) {
        if (!this.policies.has(policyId)) {
          throw new Error(`Policy '${policyId}' does not exist`);
        }
      }
      
      this.policyGroups.set(group.id, group);
      
      this.emit('policy:group_created', {
        groupId: group.id,
        groupName: group.name,
        policyCount: group.policies.length
      });
      
      return group;
      
    } catch (error) {
      this.logger.error('Policy group creation failed:', error);
      throw error;
    }
  }

  /**
   * Enable or disable policy
   */
  async togglePolicy(policyId, enabled) {
    try {
      const policy = this.policies.get(policyId);
      if (!policy) {
        throw new Error(`Policy '${policyId}' not found`);
      }
      
      policy.enabled = enabled;
      policy.metadata.updatedAt = this.getDeterministicDate();
      
      // Clear caches
      this._clearPolicyCache();
      
      this.emit('policy:toggled', {
        policyId,
        enabled,
        policyName: policy.name
      });
      
      this.logger.info(`Policy ${enabled ? 'enabled' : 'disabled'}: ${policy.name}`);
      
      return policy;
      
    } catch (error) {
      this.logger.error('Policy toggle failed:', error);
      throw error;
    }
  }

  /**
   * Get policy violations for timeframe
   */
  async getPolicyViolations(timeframe) {
    try {
      const violations = this.policyViolations.filter(violation => {
        const violationTime = new Date(violation.timestamp);
        return violationTime >= new Date(timeframe.start) && 
               violationTime <= new Date(timeframe.end);
      });
      
      return {
        timeframe,
        totalViolations: violations.length,
        violations,
        violationsByPolicy: this._groupBy(violations, 'policyId'),
        violationsBySeverity: this._groupBy(violations, 'severity'),
        summary: {
          critical: violations.filter(v => v.severity === 'CRITICAL').length,
          high: violations.filter(v => v.severity === 'HIGH').length,
          medium: violations.filter(v => v.severity === 'MEDIUM').length,
          low: violations.filter(v => v.severity === 'LOW').length
        }
      };
      
    } catch (error) {
      this.logger.error('Get policy violations failed:', error);
      throw error;
    }
  }

  /**
   * Get policy engine status
   */
  getStatus() {
    return {
      status: this.status,
      metrics: { ...this.metrics },
      configuration: {
        enableRealTimeEnforcement: this.config.enableRealTimeEnforcement,
        enablePolicyInheritance: this.config.enablePolicyInheritance,
        defaultPolicyDecision: this.config.defaultPolicyDecision,
        strictComplianceMode: this.config.strictComplianceMode
      },
      statistics: {
        totalPolicies: this.policies.size,
        enabledPolicies: Array.from(this.policies.values()).filter(p => p.enabled).length,
        policyGroups: this.policyGroups.size,
        cacheSize: this.policyCache.size,
        recentViolations: this.policyViolations.slice(-10)
      }
    };
  }

  /**
   * Shutdown policy engine
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down policy engine...');
      
      // Clear caches
      this.policyCache.clear();
      
      // Clear intervals
      if (this.cacheCleanupInterval) {
        clearInterval(this.cacheCleanupInterval);
      }
      
      this.removeAllListeners();
      this.status = 'shutdown';
      
      this.logger.success('Policy engine shutdown completed');
      
    } catch (error) {
      this.logger.error('Policy engine shutdown failed:', error);
      throw error;
    }
  }

  // Private methods

  async _loadDefaultPolicies() {
    const defaultPolicies = [
      {
        id: 'template_security_scan',
        name: 'Template Security Validation',
        type: this.policyTypes.TEMPLATE_SECURITY,
        description: 'Validates templates for security vulnerabilities',
        rules: [
          {
            id: 'no_code_injection',
            condition: 'template.content',
            operator: 'not_contains',
            value: ['eval(', 'exec(', 'system(', 'shell_exec('),
            message: 'Template contains potentially dangerous code execution patterns'
          },
          {
            id: 'no_file_inclusion',
            condition: 'template.content',
            operator: 'not_contains',
            value: ['../../../', 'file_get_contents(', 'include('],
            message: 'Template contains file inclusion vulnerabilities'
          }
        ],
        actions: ['BLOCK', 'LOG_VIOLATION'],
        severity: 'HIGH'
      },
      {
        id: 'data_classification_policy',
        name: 'Data Classification Enforcement',
        type: this.policyTypes.DATA_CLASSIFICATION,
        description: 'Enforces data classification requirements',
        rules: [
          {
            id: 'restricted_data_encryption',
            condition: 'data.classification',
            operator: 'equals',
            value: 'RESTRICTED',
            requires: 'encryption.enabled',
            message: 'RESTRICTED data must be encrypted'
          },
          {
            id: 'confidential_access_control',
            condition: 'data.classification',
            operator: 'in',
            value: ['CONFIDENTIAL', 'RESTRICTED'],
            requires: 'user.clearanceLevel',
            message: 'Insufficient clearance for classified data'
          }
        ],
        actions: ['BLOCK', 'REQUIRE_APPROVAL'],
        severity: 'HIGH'
      },
      {
        id: 'code_generation_safety',
        name: 'Safe Code Generation',
        type: this.policyTypes.CODE_GENERATION,
        description: 'Ensures generated code follows security best practices',
        rules: [
          {
            id: 'no_hardcoded_secrets',
            condition: 'generated.code',
            operator: 'not_regex',
            value: '(password|secret|key)\\s*=\\s*["\'][^"\']+["\']',
            message: 'Generated code contains hardcoded secrets'
          },
          {
            id: 'sql_injection_prevention',
            condition: 'generated.code',
            operator: 'not_contains',
            value: ['SELECT * FROM', 'DROP TABLE', 'DELETE FROM'],
            message: 'Generated code contains potentially unsafe SQL'
          }
        ],
        actions: ['SANITIZE', 'LOG_VIOLATION'],
        severity: 'MEDIUM'
      },
      {
        id: 'compliance_data_retention',
        name: 'Data Retention Compliance',
        type: this.policyTypes.COMPLIANCE,
        description: 'Enforces data retention policies for compliance',
        rules: [
          {
            id: 'gdpr_retention_limit',
            condition: 'data.personalData',
            operator: 'equals',
            value: true,
            requires: 'data.retentionPeriod',
            maxRetention: '6years',
            message: 'Personal data retention exceeds GDPR limits'
          },
          {
            id: 'financial_retention_requirement',
            condition: 'data.type',
            operator: 'equals',
            value: 'financial',
            requires: 'data.retentionPeriod',
            minRetention: '7years',
            message: 'Financial data must be retained for at least 7 years'
          }
        ],
        actions: ['ENFORCE_RETENTION', 'LOG_COMPLIANCE'],
        severity: 'HIGH'
      }
    ];
    
    for (const policyData of defaultPolicies) {
      if (!this.policies.has(policyData.id)) {
        const policy = {
          ...policyData,
          version: '1.0.0',
          enabled: true,
          metadata: {
            createdAt: this.getDeterministicDate(),
            updatedAt: this.getDeterministicDate(),
            createdBy: 'system',
            tags: ['default', 'security']
          }
        };
        this.policies.set(policy.id, policy);
      }
    }
  }

  async _setupPolicyInheritance() {
    // Setup policy inheritance relationships
    this.policyInheritance.set('template_security_scan', []);
    this.policyInheritance.set('data_classification_policy', ['template_security_scan']);
    this.policyInheritance.set('code_generation_safety', ['template_security_scan']);
    this.policyInheritance.set('compliance_data_retention', ['data_classification_policy']);
  }

  _setupCacheCleanup() {
    this.cacheCleanupInterval = setInterval(() => {
      this._cleanupExpiredCache();
    }, 60000); // Every minute
  }

  _validatePolicyDefinition(policyDefinition) {
    if (!policyDefinition.name || typeof policyDefinition.name !== 'string') {
      throw new Error('Policy name is required and must be a string');
    }
    
    if (!policyDefinition.type || !Object.values(this.policyTypes).includes(policyDefinition.type)) {
      throw new Error(`Invalid policy type. Must be one of: ${Object.values(this.policyTypes).join(', ')}`);
    }
    
    if (!policyDefinition.rules || !Array.isArray(policyDefinition.rules)) {
      throw new Error('Policy rules are required and must be an array');
    }
  }

  async _validatePolicyRules(rules) {
    for (const rule of rules) {
      if (!rule.id || !rule.condition || !rule.operator) {
        throw new Error('Policy rule must have id, condition, and operator');
      }
      
      const validOperators = [
        'equals', 'not_equals', 'contains', 'not_contains', 
        'in', 'not_in', 'regex', 'not_regex', 'greater_than', 
        'less_than', 'exists', 'not_exists'
      ];
      
      if (!validOperators.includes(rule.operator)) {
        throw new Error(`Invalid rule operator: ${rule.operator}`);
      }
    }
  }

  async _getApplicablePolicies(evaluationContext) {
    const applicablePolicies = [];
    
    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;
      
      // Check if policy applies to this operation type
      if (await this._isPolicyApplicable(policy, evaluationContext)) {
        applicablePolicies.push(policy);
      }
    }
    
    // Add inherited policies
    if (this.config.enablePolicyInheritance) {
      const inheritedPolicies = await this._getInheritedPolicies(applicablePolicies);
      applicablePolicies.push(...inheritedPolicies);
    }
    
    return applicablePolicies;
  }

  async _isPolicyApplicable(policy, evaluationContext) {
    // Check policy conditions to determine if it applies
    for (const condition of policy.conditions || []) {
      const conditionMet = await this._evaluateCondition(condition, evaluationContext);
      if (!conditionMet) {
        return false;
      }
    }
    
    // Check operation type matching
    const operationType = evaluationContext.operationType;
    const policyTargets = {
      [this.policyTypes.TEMPLATE_SECURITY]: ['template_generation', 'template_validation'],
      [this.policyTypes.DATA_CLASSIFICATION]: ['data_access', 'data_processing'],
      [this.policyTypes.CODE_GENERATION]: ['code_generation', 'file_creation'],
      [this.policyTypes.ACCESS_CONTROL]: ['*'],
      [this.policyTypes.COMPLIANCE]: ['*'],
      [this.policyTypes.GOVERNANCE]: ['*']
    };
    
    const targets = policyTargets[policy.type] || [];
    return targets.includes('*') || targets.includes(operationType);
  }

  async _evaluatePolicy(policy, evaluationContext) {
    const policyResult = {
      policyId: policy.id,
      policyName: policy.name,
      type: policy.type,
      compliant: true,
      violations: [],
      warnings: [],
      actions: []
    };
    
    // Evaluate each rule
    for (const rule of policy.rules) {
      const ruleResult = await this._evaluateRule(rule, evaluationContext);
      
      if (!ruleResult.passed) {
        policyResult.compliant = false;
        policyResult.violations.push({
          ruleId: rule.id,
          message: ruleResult.message || rule.message,
          severity: policy.severity,
          value: ruleResult.actualValue,
          expected: ruleResult.expectedValue
        });
      }
      
      if (ruleResult.warning) {
        policyResult.warnings.push({
          ruleId: rule.id,
          message: ruleResult.warning,
          value: ruleResult.actualValue
        });
      }
    }
    
    // Determine actions to take
    if (!policyResult.compliant) {
      policyResult.actions = policy.actions || [];
      
      // Record violation
      this.policyViolations.push({
        evaluationId: evaluationContext.evaluationId,
        policyId: policy.id,
        policyName: policy.name,
        severity: policy.severity,
        violations: policyResult.violations,
        timestamp: this.getDeterministicDate().toISOString(),
        context: evaluationContext
      });
      
      this.emit('policy:violation', {
        policyId: policy.id,
        violations: policyResult.violations.length,
        severity: policy.severity,
        operationType: evaluationContext.operationType
      });
    }
    
    return policyResult;
  }

  async _evaluateRule(rule, evaluationContext) {
    try {
      // Extract value from context using rule condition
      const actualValue = this._extractValue(rule.condition, evaluationContext);
      
      // Evaluate rule operator
      const result = await this._evaluateOperator(
        rule.operator, 
        actualValue, 
        rule.value, 
        evaluationContext
      );
      
      return {
        passed: result,
        actualValue,
        expectedValue: rule.value,
        message: result ? null : rule.message
      };
      
    } catch (error) {
      this.logger.error(`Rule evaluation failed for ${rule.id}:`, error);
      return {
        passed: false,
        message: `Rule evaluation error: ${error.message}`,
        actualValue: null,
        expectedValue: rule.value
      };
    }
  }

  _extractValue(condition, evaluationContext) {
    // Extract value from context using dot notation
    const parts = condition.split('.');
    let value = evaluationContext;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  async _evaluateOperator(operator, actualValue, expectedValue, evaluationContext) {
    switch (operator) {
      case 'equals':
        return actualValue === expectedValue;
      
      case 'not_equals':
        return actualValue !== expectedValue;
      
      case 'contains':
        if (typeof actualValue === 'string') {
          if (Array.isArray(expectedValue)) {
            return expectedValue.some(val => actualValue.includes(val));
          }
          return actualValue.includes(expectedValue);
        }
        return false;
      
      case 'not_contains':
        if (typeof actualValue === 'string') {
          if (Array.isArray(expectedValue)) {
            return !expectedValue.some(val => actualValue.includes(val));
          }
          return !actualValue.includes(expectedValue);
        }
        return true;
      
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(actualValue);
      
      case 'not_in':
        return !Array.isArray(expectedValue) || !expectedValue.includes(actualValue);
      
      case 'regex':
        if (typeof actualValue === 'string') {
          const regex = new RegExp(expectedValue);
          return regex.test(actualValue);
        }
        return false;
      
      case 'not_regex':
        if (typeof actualValue === 'string') {
          const regex = new RegExp(expectedValue);
          return !regex.test(actualValue);
        }
        return true;
      
      case 'greater_than':
        return Number(actualValue) > Number(expectedValue);
      
      case 'less_than':
        return Number(actualValue) < Number(expectedValue);
      
      case 'exists':
        return actualValue !== undefined && actualValue !== null;
      
      case 'not_exists':
        return actualValue === undefined || actualValue === null;
      
      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }

  async _evaluateCondition(condition, evaluationContext) {
    // Simplified condition evaluation - extend as needed
    return true;
  }

  async _getInheritedPolicies(basePolicies) {
    const inheritedPolicies = [];
    
    for (const policy of basePolicies) {
      const parentPolicyIds = this.policyInheritance.get(policy.id) || [];
      
      for (const parentId of parentPolicyIds) {
        const parentPolicy = this.policies.get(parentId);
        if (parentPolicy && parentPolicy.enabled) {
          inheritedPolicies.push(parentPolicy);
        }
      }
    }
    
    return inheritedPolicies;
  }

  _combineEvaluationResults(evaluationResults, evaluationContext) {
    const combinedResult = {
      compliant: true,
      decision: 'ALLOW',
      reason: '',
      appliedPolicies: [],
      violations: [],
      warnings: [],
      actions: [],
      block: false
    };
    
    let hasViolations = false;
    const allActions = new Set();
    
    for (const result of evaluationResults) {
      combinedResult.appliedPolicies.push({
        policyId: result.policyId,
        policyName: result.policyName,
        type: result.type,
        compliant: result.compliant
      });
      
      if (!result.compliant) {
        hasViolations = true;
        combinedResult.violations.push(...result.violations);
        
        // Collect actions
        for (const action of result.actions) {
          allActions.add(action);
        }
      }
      
      combinedResult.warnings.push(...result.warnings);
    }
    
    // Determine final decision
    if (hasViolations) {
      combinedResult.compliant = false;
      combinedResult.actions = Array.from(allActions);
      
      // Check if should block
      if (allActions.has('BLOCK') || this.config.strictComplianceMode) {
        combinedResult.decision = 'DENY';
        combinedResult.block = true;
        combinedResult.reason = 'Policy violations detected';
      } else if (allActions.has('WARN')) {
        combinedResult.decision = 'WARN';
        combinedResult.reason = 'Policy warnings issued';
      } else {
        combinedResult.decision = 'ALLOW_WITH_VIOLATIONS';
        combinedResult.reason = 'Violations detected but operation allowed';
      }
    } else {
      combinedResult.decision = 'ALLOW';
      combinedResult.reason = 'All policies compliant';
    }
    
    return combinedResult;
  }

  _generatePolicyId() {
    return `policy_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _generateGroupId() {
    return `group_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _generateEvaluationId() {
    return `eval_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _generateCacheKey(evaluationContext) {
    const keyData = {
      operationType: evaluationContext.operationType,
      userId: evaluationContext.user?.id,
      resourceType: evaluationContext.context?.type
    };
    return `policy_${JSON.stringify(keyData)}`;
  }

  _cacheResult(cacheKey, result) {
    if (this.config.enablePolicyCaching) {
      this.policyCache.set(cacheKey, {
        result,
        timestamp: this.getDeterministicTimestamp()
      });
    }
  }

  _clearPolicyCache() {
    this.policyCache.clear();
  }

  _cleanupExpiredCache() {
    const now = this.getDeterministicTimestamp();
    
    for (const [key, cached] of this.policyCache.entries()) {
      if (now - cached.timestamp > this.config.cacheTimeout) {
        this.policyCache.delete(key);
      }
    }
  }

  _groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key];
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  }
}

export default PolicyEngine;