/**
 * Dependency Analyzer Utility
 * 
 * Analyzes knowledge pack dependencies and generates dependency graphs.
 */

import { GraphDatabase } from './graph-database.js';

export class DependencyAnalyzer {
  constructor() {
    this.graph = new GraphDatabase();
  }

  async generateDependencyGraph(filter = null) {
    await this.graph.loadGraph();
    
    const nodes = await this.collectNodes(filter);
    const edges = await this.collectEdges(nodes);
    const analysis = this.analyzeGraph(nodes, edges);
    
    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      graph: {
        nodes: nodes.map(this.formatNode),
        edges: edges.map(this.formatEdge)
      },
      criticalPaths: analysis.criticalPaths,
      cycles: analysis.cycles,
      conflicts: analysis.conflicts,
      recommendations: this.generateRecommendations(analysis)
    };
  }

  async collectNodes(filter) {
    const allNodes = [
      ...this.graph.getNodes('KnowledgePack'),
      ...this.graph.getNodes('Project'),
      ...this.graph.getNodes('Dependency')
    ];
    
    if (filter) {
      return allNodes.filter(node => 
        node.properties.category?.includes(filter) ||
        node.properties.name?.includes(filter) ||
        node.id.includes(filter)
      );
    }
    
    return allNodes;
  }

  async collectEdges(nodes) {
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = [];
    
    for (const node of nodes) {
      const nodeEdges = this.graph.getEdges(node.id);
      
      // Only include edges where both nodes are in our filtered set
      const validEdges = nodeEdges.filter(edge => 
        nodeIds.has(edge.from) && nodeIds.has(edge.to)
      );
      
      edges.push(...validEdges);
    }
    
    return edges;
  }

  analyzeGraph(nodes, edges) {
    const analysis = {
      criticalPaths: this.findCriticalPaths(nodes, edges),
      cycles: this.detectCycles(nodes, edges),
      conflicts: this.detectVersionConflicts(nodes),
      complexity: this.calculateComplexity(nodes, edges),
      stability: this.calculateStability(nodes, edges)
    };
    
    return analysis;
  }

  findCriticalPaths(nodes, edges) {
    const paths = [];
    const entryPoints = this.findEntryPoints(nodes, edges);
    
    for (const entry of entryPoints) {
      const path = this.tracePath(entry, nodes, edges);
      if (path.length > 3) { // Consider paths with 3+ dependencies critical
        paths.push({
          start: entry.id,
          end: path[path.length - 1].id,
          length: path.length,
          nodes: path.map(n => n.id),
          riskScore: this.calculatePathRisk(path),
          dependencies: path.length - 1
        });
      }
    }
    
    return paths.sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);
  }

  findEntryPoints(nodes, edges) {
    const hasIncoming = new Set(edges.map(e => e.to));
    return nodes.filter(node => !hasIncoming.has(node.id));
  }

  tracePath(startNode, nodes, edges, visited = new Set()) {
    if (visited.has(startNode.id)) return [];
    
    visited.add(startNode.id);
    const path = [startNode];
    
    const outgoing = edges.filter(e => e.from === startNode.id);
    
    if (outgoing.length === 0) return path;
    
    // Follow the edge with highest weight/importance
    const nextEdge = outgoing.sort((a, b) => (b.properties.weight || 1) - (a.properties.weight || 1))[0];
    const nextNode = nodes.find(n => n.id === nextEdge.to);
    
    if (nextNode) {
      const subPath = this.tracePath(nextNode, nodes, edges, visited);
      path.push(...subPath);
    }
    
    return path;
  }

  calculatePathRisk(path) {
    let risk = 0;
    
    for (const node of path) {
      // Higher risk for older versions, unstable packages, or high complexity
      if (node.properties.version && this.isOldVersion(node.properties.version)) {
        risk += 2;
      }
      
      if (node.properties.stability && node.properties.stability < 0.8) {
        risk += 3;
      }
      
      if (node.type === 'Dependency' && !node.properties.resolved) {
        risk += 4;
      }
    }
    
    return risk / path.length; // Average risk per node
  }

  detectCycles(nodes, edges) {
    const cycles = [];
    const visited = new Set();
    const recursionStack = new Set();
    
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        const cycle = this.dfsDetectCycle(node.id, nodes, edges, visited, recursionStack, []);
        if (cycle.length > 0) {
          cycles.push({
            nodes: cycle,
            length: cycle.length,
            severity: this.calculateCycleSeverity(cycle, nodes)
          });
        }
      }
    }
    
    return cycles;
  }

  dfsDetectCycle(nodeId, nodes, edges, visited, recursionStack, path) {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);
    
    const outgoing = edges.filter(e => e.from === nodeId);
    
    for (const edge of outgoing) {
      if (!visited.has(edge.to)) {
        const cycle = this.dfsDetectCycle(edge.to, nodes, edges, visited, recursionStack, [...path]);
        if (cycle.length > 0) return cycle;
      } else if (recursionStack.has(edge.to)) {
        // Found cycle
        const cycleStart = path.indexOf(edge.to);
        return path.slice(cycleStart);
      }
    }
    
    recursionStack.delete(nodeId);
    return [];
  }

  calculateCycleSeverity(cycle, nodes) {
    // Cycles involving critical nodes are more severe
    const criticalNodes = cycle.filter(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      return node?.properties.critical || node?.type === 'KnowledgePack';
    });
    
    return criticalNodes.length / cycle.length;
  }

  detectVersionConflicts(nodes) {
    const conflicts = [];
    const packageVersions = new Map();
    
    // Group nodes by package name
    for (const node of nodes) {
      if (node.type === 'Dependency' && node.properties.version) {
        const packageName = this.extractPackageName(node.id);
        if (!packageVersions.has(packageName)) {
          packageVersions.set(packageName, []);
        }
        packageVersions.get(packageName).push({
          nodeId: node.id,
          version: node.properties.version,
          resolved: node.properties.resolved
        });
      }
    }
    
    // Detect conflicts
    for (const [packageName, versions] of packageVersions) {
      if (versions.length > 1) {
        const uniqueVersions = new Set(versions.map(v => v.version));
        if (uniqueVersions.size > 1) {
          conflicts.push({
            package: packageName,
            versions: Array.from(uniqueVersions),
            nodes: versions.map(v => v.nodeId),
            severity: this.calculateConflictSeverity(versions),
            resolutionStrategy: this.suggestResolution(versions)
          });
        }
      }
    }
    
    return conflicts;
  }

  extractPackageName(nodeId) {
    // Extract package name from node ID (simplified)
    return nodeId.split('-')[0] || nodeId;
  }

  calculateConflictSeverity(versions) {
    const majorVersions = new Set(versions.map(v => v.version.split('.')[0]));
    return majorVersions.size > 1 ? 'high' : 'medium';
  }

  suggestResolution(versions) {
    // Suggest using the latest version if all are resolved
    const resolvedVersions = versions.filter(v => v.resolved);
    if (resolvedVersions.length === versions.length) {
      return 'Upgrade all to latest version';
    }
    return 'Resolve version specifications';
  }

  calculateComplexity(nodes, edges) {
    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    const maxEdges = nodeCount * (nodeCount - 1);
    
    return {
      nodes: nodeCount,
      edges: edgeCount,
      density: maxEdges > 0 ? edgeCount / maxEdges : 0,
      averageDegree: nodeCount > 0 ? (edgeCount * 2) / nodeCount : 0,
      complexity: this.getComplexityLevel(nodeCount, edgeCount)
    };
  }

  getComplexityLevel(nodes, edges) {
    const ratio = edges / nodes;
    if (ratio > 3) return 'very high';
    if (ratio > 2) return 'high';
    if (ratio > 1.5) return 'medium';
    return 'low';
  }

  calculateStability(nodes, edges) {
    let stableNodes = 0;
    
    for (const node of nodes) {
      if (this.isStableNode(node)) {
        stableNodes++;
      }
    }
    
    return {
      stableNodes,
      totalNodes: nodes.length,
      stabilityRatio: stableNodes / nodes.length,
      level: this.getStabilityLevel(stableNodes / nodes.length)
    };
  }

  isStableNode(node) {
    // Consider a node stable if it has a resolved version and isn't too old
    const hasResolvedVersion = node.properties.resolved || node.properties.version;
    const isNotOld = !this.isOldVersion(node.properties.version);
    const hasLowRisk = (node.properties.riskScore || 0) < 0.3;
    
    return hasResolvedVersion && isNotOld && hasLowRisk;
  }

  getStabilityLevel(ratio) {
    if (ratio >= 0.9) return 'excellent';
    if (ratio >= 0.7) return 'good';
    if (ratio >= 0.5) return 'fair';
    return 'poor';
  }

  isOldVersion(version) {
    if (!version) return false;
    
    const major = parseInt(version.split('.')[0]);
    const versionAge = this.estimateVersionAge(version);
    
    return major === 0 || versionAge > 365; // Pre-1.0 or older than 1 year
  }

  estimateVersionAge(version) {
    // Mock version age calculation - would use actual release dates in production
    const major = parseInt(version.split('.')[0]) || 1;
    const minor = parseInt(version.split('.')[1]) || 0;
    
    // Estimate days since release based on version numbers
    return (3 - major) * 365 + (10 - minor) * 30;
  }

  generateRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.cycles.length > 0) {
      recommendations.push({
        type: 'critical',
        title: 'Resolve circular dependencies',
        description: `Found ${analysis.cycles.length} circular dependencies that need resolution`,
        priority: 'high',
        effort: 'high'
      });
    }
    
    if (analysis.conflicts.length > 0) {
      recommendations.push({
        type: 'warning',
        title: 'Address version conflicts',
        description: `${analysis.conflicts.length} package version conflicts detected`,
        priority: 'medium',
        effort: 'medium'
      });
    }
    
    if (analysis.complexity.complexity === 'very high') {
      recommendations.push({
        type: 'info',
        title: 'Simplify dependency structure',
        description: 'Consider refactoring to reduce dependency complexity',
        priority: 'low',
        effort: 'high'
      });
    }
    
    if (analysis.stability.level === 'poor') {
      recommendations.push({
        type: 'warning',
        title: 'Improve dependency stability',
        description: 'Update unstable or outdated dependencies',
        priority: 'medium',
        effort: 'medium'
      });
    }
    
    return recommendations;
  }

  formatNode(node) {
    return {
      id: node.id,
      label: node.properties.name || node.id,
      type: node.type,
      category: node.properties.category,
      version: node.properties.version,
      stability: this.isStableNode(node) ? 'stable' : 'unstable',
      risk: node.properties.riskScore || 0,
      properties: node.properties
    };
  }

  formatEdge(edge) {
    return {
      id: edge.id,
      source: edge.from,
      target: edge.to,
      relationship: edge.relationship,
      weight: edge.properties.weight || 1,
      type: edge.properties.type || 'dependency',
      properties: edge.properties
    };
  }
}