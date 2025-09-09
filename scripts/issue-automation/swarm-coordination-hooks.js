#!/usr/bin/env node

/**
 * Swarm Coordination Hooks for Issue Tracking
 * Provides coordination between automated issue tracking and swarm resolution
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

class SwarmCoordinationHooks {
  constructor(options = {}) {
    this.sessionId = options.sessionId || `swarm-${Date.now()}`;
    this.taskType = options.taskType || 'issue-tracking';
    this.agentRole = options.agentRole || 'coordinator';
    this.memoryNamespace = options.memoryNamespace || 'issue-tracking';
  }

  /**
   * Initialize swarm coordination for issue tracking
   */
  async initializeSwarm(config = {}) {
    console.log('🤖 Initializing swarm coordination for issue tracking...');
    
    const swarmConfig = {
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      topology: config.topology || 'mesh',
      max_agents: config.maxAgents || 6,
      coordination_strategy: config.strategy || 'adaptive',
      issue_types: [
        'ci-failure',
        'performance-regression', 
        'security-vulnerability',
        'quality-gate-failure',
        'workflow-health'
      ],
      agent_roles: {
        coordinator: 'Overall coordination and triage',
        monitor: 'Continuous monitoring and detection',
        analyzer: 'Root cause analysis and investigation',
        resolver: 'Automated resolution attempts',
        notifier: 'Alert and notification management',
        documenter: 'Documentation and reporting'
      }
    };

    try {
      // Initialize swarm using claude-flow hooks
      await this.executeHook('pre-task', {
        description: 'Initializing automated issue tracking swarm',
        task_type: this.taskType,
        expected_agents: swarmConfig.max_agents
      });

      // Store swarm configuration in memory
      await this.storeInMemory('swarm/config', swarmConfig);
      
      // Initialize agent assignment matrix
      const agentMatrix = this.createAgentMatrix(swarmConfig);
      await this.storeInMemory('swarm/agent-matrix', agentMatrix);
      
      console.log(`✅ Swarm coordination initialized with session ID: ${this.sessionId}`);
      return swarmConfig;
      
    } catch (error) {
      console.error('❌ Swarm initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Coordinate issue creation with swarm agents
   */
  async coordinateIssueCreation(issueData) {
    console.log(`🎯 Coordinating issue creation: ${issueData.type}`);
    
    try {
      // Assign appropriate agents based on issue type
      const assignedAgents = await this.assignAgentsForIssue(issueData);
      
      // Store issue coordination data
      const coordinationData = {
        issue_id: issueData.id || `issue-${Date.now()}`,
        issue_type: issueData.type,
        severity: issueData.severity || 'medium',
        assigned_agents: assignedAgents,
        coordination_strategy: this.determineCoordinationStrategy(issueData),
        created_at: new Date().toISOString(),
        status: 'active'
      };
      
      await this.storeInMemory(`issue/${coordinationData.issue_id}`, coordinationData);
      
      // Notify assigned agents
      for (const agent of assignedAgents) {
        await this.notifyAgent(agent, {
          action: 'issue_assigned',
          issue_data: coordinationData,
          role_instructions: this.getAgentInstructions(agent.role, issueData.type)
        });
      }
      
      // Execute coordination hooks
      await this.executeHook('post-edit', {
        file: 'issue-coordination.json',
        memory_key: `swarm/issue/${coordinationData.issue_id}`,
        action: 'issue_created'
      });
      
      console.log(`✅ Issue coordination established for ${coordinationData.issue_id}`);
      return coordinationData;
      
    } catch (error) {
      console.error('❌ Issue coordination failed:', error.message);
      throw error;
    }
  }

  /**
   * Update issue progress with swarm coordination
   */
  async updateIssueProgress(issueId, progressData) {
    console.log(`📊 Updating issue progress: ${issueId}`);
    
    try {
      // Retrieve existing coordination data
      const coordinationData = await this.retrieveFromMemory(`issue/${issueId}`);
      if (!coordinationData) {
        throw new Error(`No coordination data found for issue ${issueId}`);
      }
      
      // Update progress
      coordinationData.progress = progressData;
      coordinationData.last_updated = new Date().toISOString();
      
      // Determine if coordination strategy needs adjustment
      if (progressData.status === 'blocked' || progressData.status === 'escalated') {
        coordinationData.coordination_strategy = 'escalated';
        await this.escalateIssue(coordinationData);
      }
      
      // Store updated coordination data
      await this.storeInMemory(`issue/${issueId}`, coordinationData);
      
      // Notify relevant agents
      await this.broadcastProgressUpdate(coordinationData);
      
      // Execute progress hooks
      await this.executeHook('notify', {
        message: `Issue ${issueId} progress updated: ${progressData.status}`,
        type: 'progress_update'
      });
      
      console.log(`✅ Issue progress updated for ${issueId}`);
      return coordinationData;
      
    } catch (error) {
      console.error('❌ Issue progress update failed:', error.message);
      throw error;
    }
  }

  /**
   * Coordinate issue resolution with swarm
   */
  async coordinateIssueResolution(issueId, resolutionData) {
    console.log(`🎯 Coordinating issue resolution: ${issueId}`);
    
    try {
      // Retrieve coordination data
      const coordinationData = await this.retrieveFromMemory(`issue/${issueId}`);
      if (!coordinationData) {
        throw new Error(`No coordination data found for issue ${issueId}`);
      }
      
      // Update with resolution data
      coordinationData.resolution = resolutionData;
      coordinationData.status = 'resolved';
      coordinationData.resolved_at = new Date().toISOString();
      
      // Calculate resolution metrics
      const resolutionMetrics = this.calculateResolutionMetrics(coordinationData);
      coordinationData.metrics = resolutionMetrics;
      
      // Store final coordination data
      await this.storeInMemory(`issue/${issueId}`, coordinationData);
      
      // Archive successful resolution patterns
      await this.archiveResolutionPattern(coordinationData);
      
      // Execute resolution hooks
      await this.executeHook('post-task', {
        task_id: `issue-resolution-${issueId}`,
        status: 'completed',
        metrics: resolutionMetrics
      });
      
      console.log(`✅ Issue resolution coordinated for ${issueId}`);
      return coordinationData;
      
    } catch (error) {
      console.error('❌ Issue resolution coordination failed:', error.message);
      throw error;
    }
  }

  /**
   * Create agent assignment matrix based on issue types
   */
  createAgentMatrix(swarmConfig) {
    return {
      'ci-failure': [
        { role: 'monitor', priority: 'high', capabilities: ['failure-detection', 'log-analysis'] },
        { role: 'analyzer', priority: 'high', capabilities: ['root-cause-analysis', 'debugging'] },
        { role: 'resolver', priority: 'medium', capabilities: ['automation', 'fix-implementation'] }
      ],
      'performance-regression': [
        { role: 'monitor', priority: 'high', capabilities: ['performance-monitoring', 'trend-analysis'] },
        { role: 'analyzer', priority: 'high', capabilities: ['regression-analysis', 'benchmarking'] },
        { role: 'resolver', priority: 'medium', capabilities: ['optimization', 'performance-tuning'] }
      ],
      'security-vulnerability': [
        { role: 'monitor', priority: 'critical', capabilities: ['vulnerability-scanning', 'threat-detection'] },
        { role: 'analyzer', priority: 'critical', capabilities: ['security-analysis', 'impact-assessment'] },
        { role: 'resolver', priority: 'high', capabilities: ['patching', 'security-fixes'] }
      ],
      'quality-gate-failure': [
        { role: 'monitor', priority: 'medium', capabilities: ['quality-monitoring', 'metrics-analysis'] },
        { role: 'analyzer', priority: 'medium', capabilities: ['code-analysis', 'quality-assessment'] },
        { role: 'resolver', priority: 'medium', capabilities: ['refactoring', 'quality-improvement'] }
      ],
      'workflow-health': [
        { role: 'monitor', priority: 'medium', capabilities: ['health-monitoring', 'system-analysis'] },
        { role: 'analyzer', priority: 'medium', capabilities: ['trend-analysis', 'capacity-planning'] },
        { role: 'coordinator', priority: 'high', capabilities: ['orchestration', 'resource-management'] }
      ]
    };
  }

  /**
   * Assign agents for specific issue types
   */
  async assignAgentsForIssue(issueData) {
    const agentMatrix = await this.retrieveFromMemory('swarm/agent-matrix');
    if (!agentMatrix) {
      throw new Error('Agent matrix not initialized');
    }
    
    const agentTemplate = agentMatrix[issueData.type] || agentMatrix['ci-failure'];
    
    return agentTemplate.map(template => ({
      id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      role: template.role,
      priority: template.priority,
      capabilities: template.capabilities,
      assigned_at: new Date().toISOString(),
      status: 'active'
    }));
  }

  /**
   * Determine coordination strategy based on issue characteristics
   */
  determineCoordinationStrategy(issueData) {
    const { type, severity, urgency } = issueData;
    
    if (type === 'security-vulnerability' || severity === 'critical') {
      return 'immediate-response';
    }
    
    if (type === 'ci-failure' && urgency === 'high') {
      return 'rapid-resolution';
    }
    
    if (type === 'performance-regression') {
      return 'analysis-driven';
    }
    
    return 'standard-coordination';
  }

  /**
   * Get agent-specific instructions for issue types
   */
  getAgentInstructions(role, issueType) {
    const instructions = {
      monitor: {
        'ci-failure': 'Monitor workflow logs and detect failure patterns. Alert on recurring issues.',
        'performance-regression': 'Track performance metrics and identify regression triggers.',
        'security-vulnerability': 'Continuously scan for new vulnerabilities and assess impact.',
        'quality-gate-failure': 'Monitor code quality metrics and identify degradation trends.',
        'workflow-health': 'Track workflow health indicators and system resource usage.'
      },
      analyzer: {
        'ci-failure': 'Perform root cause analysis of workflow failures and identify fix patterns.',
        'performance-regression': 'Analyze performance data and identify regression causes.',
        'security-vulnerability': 'Assess vulnerability impact and determine remediation priority.',
        'quality-gate-failure': 'Analyze code quality issues and recommend improvements.',
        'workflow-health': 'Analyze workflow performance trends and capacity requirements.'
      },
      resolver: {
        'ci-failure': 'Implement automated fixes for common CI failures and workflow issues.',
        'performance-regression': 'Apply performance optimizations and conduct regression testing.',
        'security-vulnerability': 'Apply security patches and implement vulnerability fixes.',
        'quality-gate-failure': 'Implement code quality improvements and refactoring.',
        'workflow-health': 'Optimize workflow configurations and resource allocation.'
      }
    };
    
    return instructions[role]?.[issueType] || 'General coordination and monitoring tasks';
  }

  /**
   * Execute claude-flow coordination hooks
   */
  async executeHook(hookType, data) {
    try {
      const hookCommands = {
        'pre-task': `npx claude-flow@alpha hooks pre-task --description "${data.description}"`,
        'post-edit': `npx claude-flow@alpha hooks post-edit --file "${data.file}" --memory-key "${data.memory_key}"`,
        'notify': `npx claude-flow@alpha hooks notify --message "${data.message}"`,
        'post-task': `npx claude-flow@alpha hooks post-task --task-id "${data.task_id}"`
      };
      
      const command = hookCommands[hookType];
      if (!command) {
        console.warn(`Unknown hook type: ${hookType}`);
        return;
      }
      
      execSync(command, { stdio: 'pipe' });
      
    } catch (error) {
      console.warn(`Hook execution failed (${hookType}):`, error.message);
      // Don't throw - hooks are optional coordination mechanisms
    }
  }

  /**
   * Store data in swarm memory
   */
  async storeInMemory(key, data) {
    try {
      execSync(`npx claude-flow@alpha memory store --key "${key}" --namespace "${this.memoryNamespace}" --value '${JSON.stringify(data)}'`, {
        stdio: 'pipe'
      });
    } catch (error) {
      console.warn(`Memory storage failed for key ${key}:`, error.message);
      // Fallback to local file storage
      const localMemoryPath = `temp/swarm-memory-${key.replace(/\//g, '-')}.json`;
      writeFileSync(localMemoryPath, JSON.stringify(data, null, 2));
    }
  }

  /**
   * Retrieve data from swarm memory
   */
  async retrieveFromMemory(key) {
    try {
      const result = execSync(`npx claude-flow@alpha memory retrieve --key "${key}" --namespace "${this.memoryNamespace}"`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      return JSON.parse(result);
    } catch (error) {
      console.warn(`Memory retrieval failed for key ${key}:`, error.message);
      // Fallback to local file storage
      const localMemoryPath = `temp/swarm-memory-${key.replace(/\//g, '-')}.json`;
      if (existsSync(localMemoryPath)) {
        return JSON.parse(readFileSync(localMemoryPath, 'utf8'));
      }
      return null;
    }
  }

  /**
   * Notify specific agent with coordination data
   */
  async notifyAgent(agent, notification) {
    console.log(`📤 Notifying agent ${agent.id} (${agent.role}): ${notification.action}`);
    
    const agentNotification = {
      agent_id: agent.id,
      agent_role: agent.role,
      notification_type: notification.action,
      timestamp: new Date().toISOString(),
      data: notification
    };
    
    await this.storeInMemory(`agent/${agent.id}/notifications/${Date.now()}`, agentNotification);
    
    // Execute notification hook
    await this.executeHook('notify', {
      message: `Agent ${agent.role} notified: ${notification.action}`,
      type: 'agent_notification'
    });
  }

  /**
   * Broadcast progress updates to all relevant agents
   */
  async broadcastProgressUpdate(coordinationData) {
    const { assigned_agents, issue_id, progress } = coordinationData;
    
    for (const agent of assigned_agents) {
      await this.notifyAgent(agent, {
        action: 'progress_update',
        issue_id: issue_id,
        progress: progress,
        coordination_data: coordinationData
      });
    }
  }

  /**
   * Escalate issue when standard coordination fails
   */
  async escalateIssue(coordinationData) {
    console.log(`🚨 Escalating issue: ${coordinationData.issue_id}`);
    
    // Add escalation agent
    const escalationAgent = {
      id: `escalation-agent-${Date.now()}`,
      role: 'escalation-coordinator',
      priority: 'critical',
      capabilities: ['escalation-management', 'expert-coordination'],
      assigned_at: new Date().toISOString(),
      status: 'active'
    };
    
    coordinationData.assigned_agents.push(escalationAgent);
    coordinationData.escalated_at = new Date().toISOString();
    
    await this.notifyAgent(escalationAgent, {
      action: 'issue_escalated',
      issue_data: coordinationData,
      escalation_reason: 'Standard coordination insufficient'
    });
  }

  /**
   * Calculate resolution metrics for learning
   */
  calculateResolutionMetrics(coordinationData) {
    const createdAt = new Date(coordinationData.created_at);
    const resolvedAt = new Date(coordinationData.resolved_at);
    const resolutionTime = resolvedAt - createdAt;
    
    return {
      resolution_time_ms: resolutionTime,
      resolution_time_hours: resolutionTime / (1000 * 60 * 60),
      agents_involved: coordinationData.assigned_agents.length,
      coordination_strategy: coordinationData.coordination_strategy,
      escalated: !!coordinationData.escalated_at,
      issue_type: coordinationData.issue_type,
      severity: coordinationData.severity
    };
  }

  /**
   * Archive successful resolution patterns for future learning
   */
  async archiveResolutionPattern(coordinationData) {
    const pattern = {
      issue_type: coordinationData.issue_type,
      severity: coordinationData.severity,
      coordination_strategy: coordinationData.coordination_strategy,
      agents_used: coordinationData.assigned_agents.map(a => a.role),
      resolution_time: coordinationData.metrics.resolution_time_hours,
      success_factors: coordinationData.resolution?.success_factors || [],
      lessons_learned: coordinationData.resolution?.lessons_learned || [],
      archived_at: new Date().toISOString()
    };
    
    await this.storeInMemory(`patterns/resolution/${Date.now()}`, pattern);
    
    console.log(`📚 Resolution pattern archived for ${coordinationData.issue_type}`);
  }

  /**
   * Cleanup and finalize swarm session
   */
  async finalizeSession() {
    console.log('🏁 Finalizing swarm coordination session...');
    
    try {
      // Execute session end hook
      await this.executeHook('post-task', {
        task_id: this.sessionId,
        status: 'completed',
        type: 'session_finalization'
      });
      
      // Generate session summary
      const sessionSummary = await this.generateSessionSummary();
      await this.storeInMemory(`sessions/${this.sessionId}/summary`, sessionSummary);
      
      console.log(`✅ Swarm coordination session finalized: ${this.sessionId}`);
      return sessionSummary;
      
    } catch (error) {
      console.error('❌ Session finalization failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate session summary for learning and metrics
   */
  async generateSessionSummary() {
    // This would collect and summarize all session activities
    return {
      session_id: this.sessionId,
      start_time: new Date().toISOString(), // Would be stored at session start
      end_time: new Date().toISOString(),
      issues_processed: 0, // Would count from memory
      resolutions_achieved: 0, // Would count from memory
      agents_utilized: [], // Would collect from memory
      coordination_effectiveness: 'high', // Would calculate from metrics
      lessons_learned: []
    };
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const action = args[0];
  const options = {};
  
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i].replace('--', '').replace(/-/g, '_');
    const value = args[i + 1];
    options[key] = value;
  }
  
  const hooks = new SwarmCoordinationHooks(options);
  
  switch (action) {
    case 'init':
      hooks.initializeSwarm(options).catch(console.error);
      break;
    case 'coordinate':
      if (options.issue_data) {
        const issueData = JSON.parse(options.issue_data);
        hooks.coordinateIssueCreation(issueData).catch(console.error);
      }
      break;
    case 'finalize':
      hooks.finalizeSession().catch(console.error);
      break;
    default:
      console.log('Usage: swarm-coordination-hooks.js <init|coordinate|finalize> [options]');
  }
}

export { SwarmCoordinationHooks };