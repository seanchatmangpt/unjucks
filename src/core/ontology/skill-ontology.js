/**
 * Skill Ontology System
 * Manages hierarchical skill relationships and semantic mapping
 */

class SkillOntology {
  constructor() {
    this.skillHierarchy = new Map();
    this.skillSynonyms = new Map();
    this.skillWeights = new Map();
    this.domainMappings = new Map();
    this.initializeOntology();
  }

  initializeOntology() {
    // Core technology domains with hierarchical relationships
    this.addSkillDomain('programming', {
      'javascript': { weight: 0.9, children: ['react', 'vue', 'angular', 'node.js', 'express'] },
      'python': { weight: 0.95, children: ['django', 'flask', 'fastapi', 'pandas', 'numpy'] },
      'java': { weight: 0.9, children: ['spring', 'hibernate', 'maven', 'gradle'] },
      'typescript': { weight: 0.85, children: ['angular', 'react', 'vue'] },
      'react': { weight: 0.8, parents: ['javascript', 'typescript'] },
      'node.js': { weight: 0.85, parents: ['javascript'] },
      'spring': { weight: 0.8, parents: ['java'] }
    });

    this.addSkillDomain('databases', {
      'sql': { weight: 0.9, children: ['postgresql', 'mysql', 'oracle', 'sql-server'] },
      'nosql': { weight: 0.85, children: ['mongodb', 'redis', 'cassandra', 'dynamodb'] },
      'postgresql': { weight: 0.8, parents: ['sql'] },
      'mongodb': { weight: 0.8, parents: ['nosql'] }
    });

    this.addSkillDomain('cloud', {
      'aws': { weight: 0.9, children: ['ec2', 'lambda', 's3', 'rds', 'dynamodb'] },
      'azure': { weight: 0.9, children: ['app-service', 'cosmos-db', 'functions'] },
      'gcp': { weight: 0.85, children: ['compute-engine', 'cloud-functions', 'firestore'] },
      'docker': { weight: 0.85, children: ['kubernetes', 'docker-compose'] },
      'kubernetes': { weight: 0.8, parents: ['docker'] }
    });

    this.addSkillDomain('data-science', {
      'machine-learning': { weight: 0.9, children: ['tensorflow', 'pytorch', 'scikit-learn'] },
      'data-analysis': { weight: 0.85, children: ['pandas', 'numpy', 'matplotlib', 'seaborn'] },
      'statistics': { weight: 0.9, children: ['r', 'spss', 'sas'] }
    });

    // Add synonyms for better matching
    this.addSynonyms('javascript', ['js', 'ecmascript', 'es6', 'es2015']);
    this.addSynonyms('python', ['py']);
    this.addSynonyms('react', ['reactjs', 'react.js']);
    this.addSynonyms('node.js', ['nodejs', 'node']);
    this.addSynonyms('postgresql', ['postgres', 'psql']);
    this.addSynonyms('mongodb', ['mongo']);
    this.addSynonyms('kubernetes', ['k8s']);
    this.addSynonyms('machine-learning', ['ml', 'ai', 'artificial-intelligence']);
  }

  addSkillDomain(domain, skills) {
    this.domainMappings.set(domain, new Set(Object.keys(skills)));
    
    for (const [skill, config] of Object.entries(skills)) {
      this.skillHierarchy.set(skill, {
        domain,
        weight: config.weight,
        children: new Set(config.children || []),
        parents: new Set(config.parents || [])
      });
      this.skillWeights.set(skill, config.weight);
    }
  }

  addSynonyms(primarySkill, synonyms) {
    for (const synonym of synonyms) {
      this.skillSynonyms.set(synonym.toLowerCase(), primarySkill);
    }
  }

  normalizeSkill(skill) {
    const normalized = skill.toLowerCase().trim();
    return this.skillSynonyms.get(normalized) || normalized;
  }

  getSkillRelationship(skill1, skill2) {
    const norm1 = this.normalizeSkill(skill1);
    const norm2 = this.normalizeSkill(skill2);
    
    if (norm1 === norm2) return { type: 'exact', score: 1.0 };
    
    const hierarchy1 = this.skillHierarchy.get(norm1);
    const hierarchy2 = this.skillHierarchy.get(norm2);
    
    if (!hierarchy1 || !hierarchy2) return { type: 'none', score: 0.0 };
    
    // Check parent-child relationships
    if (hierarchy1.children.has(norm2)) {
      return { type: 'parent-child', score: 0.8 };
    }
    if (hierarchy1.parents.has(norm2)) {
      return { type: 'child-parent', score: 0.7 };
    }
    
    // Check sibling relationships (same parent)
    const commonParents = [...hierarchy1.parents].filter(parent => 
      hierarchy2.parents.has(parent)
    );
    if (commonParents.length > 0) {
      return { type: 'sibling', score: 0.6 };
    }
    
    // Check domain relationships
    if (hierarchy1.domain === hierarchy2.domain) {
      return { type: 'domain', score: 0.4 };
    }
    
    return { type: 'none', score: 0.0 };
  }

  calculateSkillSimilarity(requiredSkills, candidateSkills) {
    const similarities = [];
    
    for (const required of requiredSkills) {
      let bestMatch = { skill: null, score: 0, type: 'none' };
      
      for (const candidate of candidateSkills) {
        const relationship = this.getSkillRelationship(required, candidate);
        if (relationship.score > bestMatch.score) {
          bestMatch = {
            skill: candidate,
            score: relationship.score,
            type: relationship.type
          };
        }
      }
      
      similarities.push({
        required,
        match: bestMatch
      });
    }
    
    return similarities;
  }

  getSkillWeight(skill) {
    const normalized = this.normalizeSkill(skill);
    return this.skillWeights.get(normalized) || 0.5;
  }

  getDomainSkills(domain) {
    return Array.from(this.domainMappings.get(domain) || []);
  }
}

module.exports = SkillOntology;