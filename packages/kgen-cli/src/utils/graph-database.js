/**
 * Graph Database Utility
 * 
 * Mock graph database for marketplace knowledge graph operations.
 */

import fs from 'fs/promises';
import path from 'path';

export class GraphDatabase {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.indices = new Map();
    this.loaded = false;
  }

  async loadGraph() {
    if (this.loaded) return;

    try {
      // Load from kgen.lock.json if available
      const lockPath = path.join(process.cwd(), 'kgen.lock.json');
      const lockData = JSON.parse(await fs.readFile(lockPath, 'utf-8'));
      
      await this.processLockData(lockData);
      
      // Load ontology data
      await this.loadOntologies();
      
      this.loaded = true;
    } catch (error) {
      console.warn('Could not load graph data:', error.message);
      await this.generateMockData();
      this.loaded = true;
    }
  }

  async processLockData(lockData) {
    // Process projects
    if (lockData.projects) {
      Object.entries(lockData.projects).forEach(([projectId, project]) => {
        this.addNode(projectId, 'Project', {
          name: project.name || projectId,
          path: project.path,
          lastModified: project.lastModified,
          ...project
        });
      });
    }

    // Process dependencies
    if (lockData.dependencies) {
      Object.entries(lockData.dependencies).forEach(([depId, dep]) => {
        this.addNode(depId, 'Dependency', {
          version: dep.version,
          resolved: dep.resolved,
          integrity: dep.integrity,
          ...dep
        });
      });
    }

    // Process attestations
    if (lockData.attestations) {
      Object.entries(lockData.attestations).forEach(([attestId, attest]) => {
        this.addNode(attestId, 'Attestation', {
          timestamp: attest.timestamp,
          signature: attest.signature,
          provenance: attest.provenance,
          ...attest
        });
      });
    }
  }

  async loadOntologies() {
    try {
      const ontologyDir = path.join(process.cwd(), 'ontologies');
      const files = await fs.readdir(ontologyDir);
      
      for (const file of files) {
        if (file.endsWith('.ttl')) {
          const filePath = path.join(ontologyDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          await this.processTurtleFile(content, file);
        }
      }
    } catch (error) {
      console.warn('Could not load ontologies:', error.message);
    }
  }

  async processTurtleFile(content, filename) {
    // Basic Turtle parsing for ontology classes and properties
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.includes(' a owl:Class')) {
        const match = trimmed.match(/^(\S+)\s+a\s+owl:Class/);
        if (match) {
          const className = match[1];
          this.addNode(className, 'OntologyClass', {
            source: filename,
            definition: trimmed
          });
        }
      }
      
      if (trimmed.includes(' a owl:ObjectProperty') || trimmed.includes(' a owl:DatatypeProperty')) {
        const match = trimmed.match(/^(\S+)\s+a\s+owl:/);
        if (match) {
          const propertyName = match[1];
          this.addNode(propertyName, 'OntologyProperty', {
            source: filename,
            definition: trimmed
          });
        }
      }
    }
  }

  async generateMockData() {
    // Generate mock marketplace data
    const categories = ['api-services', 'data-processing', 'ui-components', 'security', 'testing'];
    const maintainers = ['team-alpha', 'team-beta', 'team-gamma', 'team-delta', 'team-epsilon'];
    
    for (let i = 0; i < 50; i++) {
      const packId = `pack-${i}`;
      const category = categories[i % categories.length];
      const maintainer = maintainers[i % maintainers.length];
      
      this.addNode(packId, 'KnowledgePack', {
        name: `Knowledge Pack ${i}`,
        category,
        maintainer,
        version: `${Math.floor(i / 10) + 1}.${i % 10}.0`,
        downloads: Math.floor(Math.random() * 10000),
        rating: (3 + Math.random() * 2).toFixed(1),
        lastUpdate: this.getRandomDate(),
        usage: Math.floor(Math.random() * 100),
        performance: (7 + Math.random() * 3).toFixed(1)
      });
      
      // Add relationships
      this.addEdge(packId, maintainer, 'maintainedBy');
      this.addEdge(packId, category, 'belongsToCategory');
    }
    
    // Add category nodes
    categories.forEach(category => {
      this.addNode(category, 'Category', {
        name: category,
        description: `${category} related knowledge packs`
      });
    });
    
    // Add maintainer nodes
    maintainers.forEach(maintainer => {
      this.addNode(maintainer, 'Maintainer', {
        name: maintainer,
        type: 'team'
      });
    });
  }

  addNode(id, type, properties = {}) {
    this.nodes.set(id, {
      id,
      type,
      properties,
      createdAt: new Date().toISOString()
    });
    
    // Add to type index
    if (!this.indices.has(type)) {
      this.indices.set(type, new Set());
    }
    this.indices.get(type).add(id);
  }

  addEdge(fromId, toId, relationship, properties = {}) {
    const edgeId = `${fromId}-${relationship}-${toId}`;
    this.edges.set(edgeId, {
      id: edgeId,
      from: fromId,
      to: toId,
      relationship,
      properties,
      createdAt: new Date().toISOString()
    });
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  getNodes(type) {
    if (!this.indices.has(type)) return [];
    
    const nodeIds = Array.from(this.indices.get(type));
    return nodeIds.map(id => this.nodes.get(id)).filter(Boolean);
  }

  getEdges(fromId, relationship) {
    const edges = [];
    for (const edge of this.edges.values()) {
      if (edge.from === fromId && (!relationship || edge.relationship === relationship)) {
        edges.push(edge);
      }
    }
    return edges;
  }

  async query(sparqlQuery) {
    await this.loadGraph();
    
    // Mock SPARQL execution - in production would use real SPARQL engine
    if (sparqlQuery.includes('kmkt:KnowledgePack')) {
      return this.getNodes('KnowledgePack').map(node => ({
        pack: node.id,
        category: node.properties.category,
        usage: node.properties.usage,
        performance: node.properties.performance,
        version: node.properties.version,
        downloads: node.properties.downloads,
        rating: node.properties.rating,
        lastUpdate: node.properties.lastUpdate,
        maintainer: node.properties.maintainer
      }));
    }
    
    return [];
  }

  getStats() {
    return {
      nodes: this.nodes.size,
      edges: this.edges.size,
      types: this.indices.size,
      nodesByType: Array.from(this.indices.entries()).map(([type, ids]) => ({
        type,
        count: ids.size
      }))
    };
  }

  getRandomDate() {
    const now = new Date();
    const daysBack = Math.floor(Math.random() * 90);
    const date = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    return date.toISOString();
  }
}