/**
 * CommonJS Skill Ontology for Testing
 */

class SkillOntology {
  constructor() {
    this.skillHierarchy = new Map();
    this.skillSynonyms = new Map();
    this.skillWeights = new Map();
    this.initializeOntology();
  }

  initializeOntology() {
    // Basic skills for testing
    this.addSkill('javascript', { weight: 0.9, synonyms: ['js'] });
    this.addSkill('react', { weight: 0.8, parents: ['javascript'] });
    this.addSkill('node.js', { weight: 0.85, parents: ['javascript'], synonyms: ['nodejs'] });
    this.addSkill('python', { weight: 0.95 });
    this.addSkill('sql', { weight: 0.9 });
    this.addSkill('postgresql', { weight: 0.8, parents: ['sql'], synonyms: ['postgres'] });
  }

  addSkill(skill, config) {
    this.skillHierarchy.set(skill, config);
    this.skillWeights.set(skill, config.weight);
    
    if (config.synonyms) {
      for (const synonym of config.synonyms) {
        this.skillSynonyms.set(synonym.toLowerCase(), skill);
      }
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
    
    // Simple parent-child check
    const config1 = this.skillHierarchy.get(norm1);
    const config2 = this.skillHierarchy.get(norm2);
    
    if (config1?.parents?.includes(norm2)) {
      return { type: 'child-parent', score: 0.7 };
    }
    if (config2?.parents?.includes(norm1)) {
      return { type: 'parent-child', score: 0.8 };
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
}

module.exports = SkillOntology;