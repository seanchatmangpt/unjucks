/**
 * Semantic Job-Resume Matching Engine Tests
 * 
 * Comprehensive test suite for job-resume matching algorithms using semantic distance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RDFProcessor } from '../../src/core/rdf.js';

describe('Semantic Job-Resume Matching Engine', () => {
  let processor;
  let testData;

  beforeEach(async () => {
    processor = new RDFProcessor({
      baseUri: 'http://test.example.org/',
      enableCache: true
    });
    
    // Initialize job matching vocabularies
    processor.initializeJobMatchingVocabularies();
    
    // Load test data
    testData = createTestJobResumeData();
    await processor.loadData(testData);
  });

  describe('Semantic Distance Calculations', () => {
    it('should calculate identical skill distance as 0', () => {
      const distance = processor.calculateSemanticDistance(
        'http://test.example.org/skill/javascript',
        'http://test.example.org/skill/javascript'
      );
      expect(distance).toBe(0);
    });

    it('should calculate hierarchical distance for related skills', () => {
      const distance = processor.calculateSemanticDistance(
        'http://test.example.org/skill/javascript',
        'http://test.example.org/skill/programming'
      );
      expect(distance).toBeLessThan(0.5);
      expect(distance).toBeGreaterThan(0);
    });

    it('should calculate high distance for unrelated skills', () => {
      const distance = processor.calculateSemanticDistance(
        'http://test.example.org/skill/javascript',
        'http://test.example.org/skill/cooking'
      );
      expect(distance).toBeGreaterThan(0.8);
    });

    it('should use Levenshtein distance for label similarity', () => {
      const distance = processor.calculateLevenshteinDistance('javascript', 'typescript');
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(10);
    });
  });

  describe('Experience Level Matching', () => {
    it('should normalize experience levels correctly', () => {
      expect(processor.normalizeExperienceLevel('junior')).toBe(1);
      expect(processor.normalizeExperienceLevel('mid-level')).toBe(2);
      expect(processor.normalizeExperienceLevel('senior')).toBe(3);
      expect(processor.normalizeExperienceLevel('expert')).toBe(4);
      expect(processor.normalizeExperienceLevel('lead developer')).toBe(4);
    });

    it('should calculate experience match scores correctly', () => {
      const personExp = { level: 'senior' };
      const jobExp = { level: 'mid-level' };
      const score = processor.calculateExperienceMatchScore(personExp, jobExp);
      expect(score).toBe(1); // Person exceeds requirement
    });

    it('should penalize insufficient experience', () => {
      const personExp = { level: 'junior' };
      const jobExp = { level: 'senior' };
      const score = processor.calculateExperienceMatchScore(personExp, jobExp);
      expect(score).toBeLessThan(1);
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('Education Level Matching', () => {
    it('should normalize education levels correctly', () => {
      expect(processor.normalizeEducationLevel('high school')).toBe(1);
      expect(processor.normalizeEducationLevel('bachelor degree')).toBe(2);
      expect(processor.normalizeEducationLevel('master')).toBe(3);
      expect(processor.normalizeEducationLevel('phd')).toBe(4);
    });

    it('should match education requirements', () => {
      const personEd = { level: 'bachelor degree' };
      const jobEd = { level: 'bachelor degree' };
      const score = processor.calculateEducationMatchScore(personEd, jobEd);
      expect(score).toBe(1);
    });
  });

  describe('Skill Matching and Recommendations', () => {
    it('should find skill matches for a person', () => {
      const matches = processor.findSkillMatches('http://test.example.org/person/john', {
        threshold: 0.6,
        maxResults: 10
      });
      
      expect(Array.isArray(matches)).toBe(true);
      matches.forEach(match => {
        expect(match).toHaveProperty('skill');
        expect(match).toHaveProperty('similarity');
        expect(match).toHaveProperty('category');
        expect(match.similarity).toBeGreaterThanOrEqual(0.6);
      });
    });

    it('should calculate skill match scores', () => {
      const personSkills = [
        'http://test.example.org/skill/javascript',
        'http://test.example.org/skill/react'
      ];
      const jobSkills = [
        'http://test.example.org/skill/javascript',
        'http://test.example.org/skill/nodejs'
      ];
      
      const score = processor.calculateSkillMatchScore(personSkills, jobSkills);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should provide detailed skill match information', () => {
      const personSkills = [
        'http://test.example.org/skill/javascript',
        'http://test.example.org/skill/react'
      ];
      const jobSkills = [
        'http://test.example.org/skill/javascript',
        'http://test.example.org/skill/nodejs'
      ];
      
      const details = processor.calculateSkillMatchDetails(personSkills, jobSkills);
      expect(details).toHaveProperty('matches');
      expect(details).toHaveProperty('missing');
      expect(details).toHaveProperty('coverage');
      expect(Array.isArray(details.matches)).toBe(true);
      expect(Array.isArray(details.missing)).toBe(true);
    });
  });

  describe('Job Recommendations', () => {
    it('should generate job recommendations for a person', () => {
      const recommendations = processor.generateJobRecommendations(
        'http://test.example.org/person/john',
        {
          minMatchScore: 0.5,
          maxResults: 5
        }
      );
      
      expect(Array.isArray(recommendations)).toBe(true);
      recommendations.forEach(rec => {
        expect(rec).toHaveProperty('job');
        expect(rec).toHaveProperty('matchScore');
        expect(rec).toHaveProperty('skillMatch');
        expect(rec).toHaveProperty('gapAnalysis');
        expect(rec.matchScore).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('should calculate overall job match scores', () => {
      const personProfile = processor.getPersonProfile('http://test.example.org/person/john');
      const jobProfile = processor.getJobProfile('http://test.example.org/job/frontend-dev');
      
      if (personProfile && jobProfile) {
        const score = processor.calculateJobMatchScore(personProfile, jobProfile, {
          skillWeight: 0.5,
          experienceWeight: 0.3,
          educationWeight: 0.2
        });
        
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Gap Analysis', () => {
    it('should generate comprehensive gap analysis', () => {
      const personProfile = processor.getPersonProfile('http://test.example.org/person/john');
      const jobProfile = processor.getJobProfile('http://test.example.org/job/frontend-dev');
      
      if (personProfile && jobProfile) {
        const gapAnalysis = processor.generateGapAnalysis(personProfile, jobProfile);
        
        expect(gapAnalysis).toHaveProperty('skillGaps');
        expect(gapAnalysis).toHaveProperty('strengthAreas');
        expect(gapAnalysis).toHaveProperty('overallReadiness');
        expect(gapAnalysis).toHaveProperty('recommendations');
        expect(Array.isArray(gapAnalysis.skillGaps)).toBe(true);
        expect(Array.isArray(gapAnalysis.strengthAreas)).toBe(true);
        expect(Array.isArray(gapAnalysis.recommendations)).toBe(true);
      }
    });

    it('should categorize skill gaps by priority', () => {
      const personProfile = processor.getPersonProfile('http://test.example.org/person/john');
      const jobProfile = processor.getJobProfile('http://test.example.org/job/senior-backend-dev');
      
      if (personProfile && jobProfile) {
        const gapAnalysis = processor.generateGapAnalysis(personProfile, jobProfile);
        
        gapAnalysis.skillGaps.forEach(gap => {
          expect(gap).toHaveProperty('priority');
          expect(['high', 'medium', 'low']).toContain(gap.priority);
          expect(gap).toHaveProperty('recommendation');
        });
      }
    });

    it('should calculate overall readiness levels', () => {
      const readinessLevels = ['high', 'medium', 'low', 'very-low'];
      const personProfile = processor.getPersonProfile('http://test.example.org/person/john');
      const jobProfile = processor.getJobProfile('http://test.example.org/job/frontend-dev');
      
      if (personProfile && jobProfile) {
        const readiness = processor.calculateOverallReadiness(personProfile, jobProfile);
        expect(readinessLevels).toContain(readiness);
      }
    });
  });

  describe('Skill Learning Recommendations', () => {
    it('should generate skill learning recommendations', () => {
      const recommendation = processor.generateSkillRecommendation(
        'http://test.example.org/skill/react'
      );
      
      expect(recommendation).toHaveProperty('skill');
      expect(recommendation).toHaveProperty('category');
      expect(recommendation).toHaveProperty('suggestedLearningPath');
      expect(recommendation).toHaveProperty('estimatedLearningTime');
    });

    it('should categorize skills correctly', () => {
      const jsCategory = processor.getSkillCategory('http://test.example.org/skill/javascript');
      const mgmtCategory = processor.getSkillCategory('http://test.example.org/skill/team-management');
      const commCategory = processor.getSkillCategory('http://test.example.org/skill/communication');
      
      expect(jsCategory).toBe('technical');
      expect(mgmtCategory).toBe('management');
      expect(commCategory).toBe('soft-skills');
    });

    it('should estimate learning times by category', () => {
      const technicalTime = processor.estimateLearningTime('uri', 'technical');
      const managementTime = processor.estimateLearningTime('uri', 'management');
      const softSkillsTime = processor.estimateLearningTime('uri', 'soft-skills');
      
      expect(technicalTime).toBe('3-6 months');
      expect(managementTime).toBe('6-12 months');
      expect(softSkillsTime).toBe('2-4 months');
    });
  });

  describe('Semantic Query Patterns', () => {
    it('should generate comprehensive semantic query patterns', () => {
      const patterns = processor.generateSemanticQueryPatterns();
      
      expect(patterns).toHaveProperty('timestamp');
      expect(patterns).toHaveProperty('patterns');
      expect(patterns).toHaveProperty('algorithms');
      expect(patterns).toHaveProperty('optimization');
      
      // Check specific patterns
      expect(patterns.patterns).toHaveProperty('personSkills');
      expect(patterns.patterns).toHaveProperty('jobRequirements');
      expect(patterns.patterns).toHaveProperty('skillHierarchy');
      expect(patterns.patterns).toHaveProperty('experienceLevel');
      expect(patterns.patterns).toHaveProperty('educationLevel');
      
      // Check algorithms
      expect(patterns.algorithms).toHaveProperty('semanticDistance');
      expect(patterns.algorithms).toHaveProperty('matching');
      
      // Check optimization strategies
      expect(patterns.optimization).toHaveProperty('caching');
      expect(patterns.optimization).toHaveProperty('indexing');
    });
  });

  describe('Profile Extraction', () => {
    it('should extract comprehensive person profiles', () => {
      const profile = processor.getPersonProfile('http://test.example.org/person/john');
      
      if (profile) {
        expect(profile).toHaveProperty('uri');
        expect(profile).toHaveProperty('entity');
        expect(profile).toHaveProperty('skills');
        expect(profile).toHaveProperty('experience');
        expect(profile).toHaveProperty('education');
        expect(profile).toHaveProperty('profile');
        expect(Array.isArray(profile.skills)).toBe(true);
      }
    });

    it('should extract comprehensive job profiles', () => {
      const profile = processor.getJobProfile('http://test.example.org/job/frontend-dev');
      
      if (profile) {
        expect(profile).toHaveProperty('uri');
        expect(profile).toHaveProperty('entity');
        expect(profile).toHaveProperty('requiredSkills');
        expect(profile).toHaveProperty('jobDetails');
        expect(Array.isArray(profile.requiredSkills)).toBe(true);
        expect(profile.jobDetails).toHaveProperty('title');
        expect(profile.jobDetails).toHaveProperty('company');
      }
    });
  });
});

/**
 * Create test RDF data for job-resume matching scenarios
 */
function createTestJobResumeData() {
  return `
    @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix schema: <https://schema.org/> .
    @prefix skill: <http://data.europa.eu/esco/skill#> .
    @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
    @prefix test: <http://test.example.org/> .

    # Skills with hierarchical relationships
    test:skill/programming a skill:Skill ;
        rdfs:label "Programming" ;
        rdfs:comment "General programming skills" .

    test:skill/javascript a skill:Skill ;
        rdfs:label "JavaScript Programming" ;
        rdfs:comment "JavaScript development skills" ;
        skos:broader test:skill/programming ;
        skos:related test:skill/typescript .

    test:skill/typescript a skill:Skill ;
        rdfs:label "TypeScript Programming" ;
        rdfs:comment "TypeScript development skills" ;
        skos:broader test:skill/programming ;
        skos:related test:skill/javascript .

    test:skill/react a skill:Skill ;
        rdfs:label "React Development" ;
        rdfs:comment "React.js framework skills" ;
        skos:broader test:skill/javascript .

    test:skill/nodejs a skill:Skill ;
        rdfs:label "Node.js Development" ;
        rdfs:comment "Node.js backend development" ;
        skos:broader test:skill/javascript .

    test:skill/python a skill:Skill ;
        rdfs:label "Python Programming" ;
        rdfs:comment "Python development skills" ;
        skos:broader test:skill/programming .

    test:skill/team-management a skill:Skill ;
        rdfs:label "Team Management" ;
        rdfs:comment "Leading and managing development teams" ;
        skill:skillType "management" .

    test:skill/communication a skill:Skill ;
        rdfs:label "Communication Skills" ;
        rdfs:comment "Effective verbal and written communication" ;
        skill:skillType "soft-skills" .

    test:skill/cooking a skill:Skill ;
        rdfs:label "Cooking" ;
        rdfs:comment "Culinary skills" .

    # People with skills, experience, and education
    test:person/john a schema:Person ;
        rdfs:label "John Doe" ;
        schema:knowsAbout test:skill/javascript, test:skill/react, test:skill/communication ;
        schema:hasOccupation test:experience/john-frontend ;
        schema:hasCredential test:education/john-bachelor .

    test:experience/john-frontend a schema:WorkExperience ;
        schema:experienceLevel "mid-level" ;
        schema:occupationLocation "Frontend Developer" .

    test:education/john-bachelor a schema:EducationalOccupationalCredential ;
        schema:educationalLevel "bachelor degree" ;
        schema:educationalCredentialAwarded "Computer Science" .

    test:person/jane a schema:Person ;
        rdfs:label "Jane Smith" ;
        schema:knowsAbout test:skill/python, test:skill/team-management ;
        schema:hasOccupation test:experience/jane-backend ;
        schema:hasCredential test:education/jane-master .

    test:experience/jane-backend a schema:WorkExperience ;
        schema:experienceLevel "senior" ;
        schema:occupationLocation "Backend Developer" .

    test:education/jane-master a schema:EducationalOccupationalCredential ;
        schema:educationalLevel "master degree" ;
        schema:educationalCredentialAwarded "Software Engineering" .

    # Job postings with requirements
    test:job/frontend-dev a schema:JobPosting ;
        rdfs:label "Frontend Developer Position" ;
        schema:jobTitle "Frontend Developer" ;
        schema:hiringOrganization "Tech Corp" ;
        schema:jobLocation "San Francisco, CA" ;
        schema:employmentType "Full-time" ;
        schema:skills test:skill/javascript, test:skill/react, test:skill/typescript ;
        schema:experienceRequirements "mid-level" ;
        schema:educationRequirements "bachelor degree" .

    test:job/senior-backend-dev a schema:JobPosting ;
        rdfs:label "Senior Backend Developer Position" ;
        schema:jobTitle "Senior Backend Developer" ;
        schema:hiringOrganization "Enterprise Inc" ;
        schema:jobLocation "New York, NY" ;
        schema:employmentType "Full-time" ;
        schema:skills test:skill/python, test:skill/nodejs, test:skill/team-management ;
        schema:experienceRequirements "senior" ;
        schema:educationRequirements "bachelor degree" .

    test:job/fullstack-lead a schema:JobPosting ;
        rdfs:label "Full Stack Tech Lead" ;
        schema:jobTitle "Full Stack Tech Lead" ;
        schema:hiringOrganization "Startup Co" ;
        schema:jobLocation "Austin, TX" ;
        schema:employmentType "Full-time" ;
        schema:skills test:skill/javascript, test:skill/python, test:skill/react, test:skill/nodejs, test:skill/team-management ;
        schema:experienceRequirements "expert" ;
        schema:educationRequirements "master degree" .

    # Skill co-occurrence patterns (same job requires multiple skills)
    test:job/frontend-dev schema:skills test:skill/javascript, test:skill/react .
    test:job/senior-backend-dev schema:skills test:skill/python, test:skill/nodejs .
    test:job/fullstack-lead schema:skills test:skill/javascript, test:skill/python, test:skill/react, test:skill/nodejs .
  `;
}