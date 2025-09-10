/**
 * Comprehensive Test Suite for Job Matching Engine
 * Tests all core matching algorithms and scoring functions
 */

const { describe, it, expect, beforeEach, afterEach } = require('vitest');
const { JobMatchingEngine } = require('../../src/core/matching');

describe('Job Matching Engine', () => {
  let engine;
  let sampleJob;
  let sampleCandidate;
  let sampleJobs;
  let sampleCandidates;

  beforeEach(() => {
    engine = new JobMatchingEngine({
      enableCache: false, // Disable cache for testing
      minScore: 50
    });

    sampleJob = {
      id: 'job-1',
      title: 'Senior Software Engineer',
      requiredSkills: [
        { name: 'javascript', importance: 'critical' },
        { name: 'react', importance: 'high' },
        { name: 'node.js', importance: 'medium' },
        { name: 'postgresql', importance: 'medium' }
      ],
      experience: '5+ years',
      education: { level: 'bachelor', required: true },
      location: { city: 'San Francisco', state: 'CA', remote: false },
      salary: { min: 120000, max: 180000 },
      preferences: {
        workType: 'full-time',
        industry: 'technology',
        companySize: 'medium'
      }
    };

    sampleCandidate = {
      id: 'candidate-1',
      name: 'John Doe',
      skills: [
        { name: 'javascript', years: 6 },
        { name: 'react', years: 4 },
        { name: 'typescript', years: 3 },
        { name: 'node.js', years: 5 },
        { name: 'mongodb', years: 3 }
      ],
      totalExperience: 6,
      education: { level: 'bachelor', degree: 'Computer Science' },
      location: { 
        city: 'San Francisco', 
        state: 'CA', 
        remotePreference: false,
        willingToRelocate: false 
      },
      preferences: {
        workType: 'full-time',
        preferredIndustries: ['technology', 'fintech'],
        companySize: 'medium'
      }
    };

    sampleJobs = [sampleJob];
    sampleCandidates = [sampleCandidate];
  });

  describe('Skill Ontology', () => {
    it('should normalize skills correctly', () => {
      const ontology = engine.ontology;
      expect(ontology.normalizeSkill('JavaScript')).toBe('javascript');
      expect(ontology.normalizeSkill('JS')).toBe('javascript');
      expect(ontology.normalizeSkill('React.js')).toBe('react');
    });

    it('should calculate skill relationships accurately', () => {
      const ontology = engine.ontology;
      
      // Exact match
      const exactMatch = ontology.getSkillRelationship('javascript', 'javascript');
      expect(exactMatch.type).toBe('exact');
      expect(exactMatch.score).toBe(1.0);

      // Parent-child relationship
      const parentChild = ontology.getSkillRelationship('javascript', 'react');
      expect(parentChild.type).toBe('parent-child');
      expect(parentChild.score).toBe(0.8);

      // No relationship
      const noRelation = ontology.getSkillRelationship('javascript', 'photoshop');
      expect(noRelation.type).toBe('none');
      expect(noRelation.score).toBe(0.0);
    });

    it('should handle skill synonyms', () => {
      const ontology = engine.ontology;
      const jsRelation = ontology.getSkillRelationship('js', 'javascript');
      expect(jsRelation.score).toBe(1.0);
    });
  });

  describe('Compatibility Scoring', () => {
    it('should calculate overall compatibility score', () => {
      const analysis = engine.analyzeCompatibility(sampleJob, sampleCandidate);
      
      expect(analysis.overallScore).toBeGreaterThan(70);
      expect(analysis.confidence).toBeGreaterThan(0.7);
      expect(analysis.breakdown).toHaveProperty('skills');
      expect(analysis.breakdown).toHaveProperty('experience');
      expect(analysis.breakdown).toHaveProperty('education');
      expect(analysis.breakdown).toHaveProperty('location');
    });

    it('should score skill compatibility accurately', () => {
      const scorer = engine.scorer;
      const skillScore = scorer.calculateSkillCompatibility(
        sampleJob.requiredSkills,
        sampleCandidate.skills
      );

      expect(skillScore.score).toBeGreaterThan(70);
      expect(skillScore.coverage).toBeGreaterThan(50);
      expect(skillScore.details).toHaveLength(sampleJob.requiredSkills.length);
      
      // Should find exact matches for javascript and react
      const jsMatch = skillScore.details.find(d => d.required === 'javascript');
      expect(jsMatch.type).toBe('exact');
      expect(jsMatch.score).toBe(100);
    });

    it('should handle missing skills appropriately', () => {
      const candidateWithFewSkills = {
        ...sampleCandidate,
        skills: [{ name: 'python', years: 2 }]
      };

      const analysis = engine.analyzeCompatibility(sampleJob, candidateWithFewSkills);
      expect(analysis.breakdown.skills.score).toBeLessThan(50);
      expect(analysis.breakdown.skills.missing).toContain('javascript');
      expect(analysis.breakdown.skills.missing).toContain('react');
    });

    it('should calculate experience compatibility', () => {
      const scorer = engine.scorer;
      
      // Qualified candidate
      const qualifiedScore = scorer.calculateExperienceCompatibility('5+ years', 6);
      expect(qualifiedScore.score).toBeGreaterThan(80);
      expect(qualifiedScore.status).toBe('qualified');

      // Underqualified candidate
      const underqualifiedScore = scorer.calculateExperienceCompatibility('5+ years', 2);
      expect(underqualifiedScore.score).toBeLessThan(70);
      expect(underqualifiedScore.status).toBe('underqualified');
      expect(underqualifiedScore.gap).toBe(3);
    });

    it('should evaluate location compatibility', () => {
      const scorer = engine.scorer;
      
      // Same city
      const localScore = scorer.calculateLocationCompatibility(
        { city: 'San Francisco', state: 'CA' },
        { city: 'San Francisco', state: 'CA' }
      );
      expect(localScore.score).toBeGreaterThan(90);
      expect(localScore.type).toBe('local');

      // Remote work
      const remoteScore = scorer.calculateLocationCompatibility(
        { remote: true },
        { remotePreference: true }
      );
      expect(remoteScore.score).toBe(100);
      expect(remoteScore.type).toBe('remote');
    });
  });

  describe('Job Matching', () => {
    it('should find matching jobs for candidate', async () => {
      const result = await engine.findJobsForCandidate(sampleCandidate, sampleJobs);
      
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].compatibility.overallScore).toBeGreaterThan(70);
      expect(result.totalJobs).toBe(1);
      expect(result.searchMetadata).toHaveProperty('candidateId');
    });

    it('should find matching candidates for job', async () => {
      const result = await engine.findCandidatesForJob(sampleJob, sampleCandidates);
      
      expect(result.matches).toHaveLength(1);
      expect(result.totalCandidates).toBe(1);
      expect(result.insights).toHaveProperty('candidatePool');
      expect(result.insights).toHaveProperty('skillAvailability');
    });

    it('should filter results by minimum score', async () => {
      const lowQualityCandidate = {
        ...sampleCandidate,
        skills: [{ name: 'photoshop', years: 1 }],
        totalExperience: 1
      };

      const result = await engine.findCandidatesForJob(sampleJob, [lowQualityCandidate]);
      expect(result.matches).toHaveLength(0); // Should be filtered out
    });

    it('should apply location filters correctly', async () => {
      const remoteJob = {
        ...sampleJob,
        location: { remote: true }
      };

      const result = await engine.findJobsForCandidate(sampleCandidate, [remoteJob], {
        filters: { remote: true }
      });

      expect(result.matches).toHaveLength(1);
    });

    it('should handle salary filters', async () => {
      const result = await engine.findJobsForCandidate(sampleCandidate, sampleJobs, {
        filters: { 
          salary: { min: 100000, max: 200000 } 
        }
      });

      expect(result.matches).toHaveLength(1);
    });
  });

  describe('Mutual Matching', () => {
    it('should find mutual matches between jobs and candidates', async () => {
      const result = await engine.findMutualMatches(sampleJobs, sampleCandidates);
      
      expect(result.mutualMatches).toHaveLength(1);
      expect(result.totalPossiblePairs).toBe(1);
      expect(result.efficiency).toBe(1);
      expect(result.insights).toHaveProperty('topMatches');
      expect(result.insights).toHaveProperty('balanceMetrics');
    });

    it('should calculate mutual scores correctly', async () => {
      const result = await engine.findMutualMatches(sampleJobs, sampleCandidates);
      const mutualMatch = result.mutualMatches[0];
      
      expect(mutualMatch.mutualScore).toBeGreaterThan(70);
      expect(mutualMatch.mutualFit).toHaveProperty('score');
      expect(mutualMatch.mutualFit).toHaveProperty('confidence');
      expect(mutualMatch.mutualFit).toHaveProperty('balance');
    });
  });

  describe('Career Recommendations', () => {
    it('should generate career recommendations', () => {
      const recommendations = engine.generateCareerRecommendations(sampleCandidate, sampleJobs);
      
      expect(recommendations).toHaveProperty('summary');
      expect(recommendations).toHaveProperty('careerPaths');
      expect(recommendations).toHaveProperty('skillDevelopment');
      expect(recommendations).toHaveProperty('roleProgression');
      expect(recommendations.confidence).toBeGreaterThan(0.5);
    });

    it('should identify current role correctly', () => {
      const recommendations = engine.generateCareerRecommendations(sampleCandidate, sampleJobs);
      
      expect(recommendations.summary.currentRole.title).toBe('software-engineer');
      expect(recommendations.summary.currentRole.level).toBe('senior');
      expect(recommendations.summary.currentRole.confidence).toBeGreaterThan(0.7);
    });

    it('should suggest skill development', () => {
      const recommendations = engine.generateCareerRecommendations(sampleCandidate, sampleJobs);
      
      expect(recommendations.skillDevelopment).toHaveProperty('immediate');
      expect(recommendations.skillDevelopment).toHaveProperty('shortTerm');
      expect(recommendations.skillDevelopment).toHaveProperty('longTerm');
    });
  });

  describe('Skill Analysis', () => {
    it('should analyze skill relationships comprehensively', () => {
      const analysis = engine.analyzeSkillRelationships(
        sampleJob.requiredSkills,
        sampleCandidate.skills
      );

      expect(analysis).toHaveProperty('exactMatches');
      expect(analysis).toHaveProperty('relatedMatches');
      expect(analysis).toHaveProperty('missingSkills');
      expect(analysis).toHaveProperty('transferableSkills');

      // Should find exact matches for javascript, react, node.js
      expect(analysis.exactMatches.length).toBeGreaterThan(0);
      
      // Should identify missing PostgreSQL
      expect(analysis.missingSkills.some(m => m.required === 'postgresql')).toBe(true);
    });

    it('should identify transferable skills', () => {
      const jobRequiringSQL = {
        ...sampleJob,
        requiredSkills: [
          { name: 'javascript', importance: 'high' },
          { name: 'mysql', importance: 'medium' }
        ]
      };

      const candidateWithMongoDB = {
        ...sampleCandidate,
        skills: [
          { name: 'javascript', years: 5 },
          { name: 'mongodb', years: 3 }
        ]
      };

      const analysis = engine.analyzeSkillRelationships(
        jobRequiringSQL.requiredSkills,
        candidateWithMongoDB.skills
      );

      // MongoDB should be identified as transferable to MySQL (both databases)
      expect(analysis.transferableSkills.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Metrics', () => {
    it('should provide system metrics', () => {
      const metrics = engine.getSystemMetrics();
      
      expect(metrics).toHaveProperty('cache');
      expect(metrics).toHaveProperty('ontology');
      expect(metrics).toHaveProperty('config');
      expect(metrics.version).toBe('1.0.0');
      expect(metrics.ontology.skillCount).toBeGreaterThan(0);
    });

    it('should update configuration correctly', () => {
      engine.updateConfig({ minScore: 80, maxResults: 10 });
      
      expect(engine.config.minScore).toBe(80);
      expect(engine.config.maxResults).toBe(10);
    });

    it('should handle cache operations', () => {
      engine.updateConfig({ enableCache: true });
      
      // Test cache stats
      const initialStats = engine.getSystemMetrics().cache;
      expect(initialStats).toHaveProperty('enabled');
      
      // Clear cache
      engine.clearCaches();
      const clearedStats = engine.getSystemMetrics().cache;
      expect(clearedStats.size).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty job arrays', async () => {
      const result = await engine.findJobsForCandidate(sampleCandidate, []);
      expect(result.matches).toHaveLength(0);
      expect(result.totalJobs).toBe(0);
    });

    it('should handle empty candidate arrays', async () => {
      const result = await engine.findCandidatesForJob(sampleJob, []);
      expect(result.matches).toHaveLength(0);
      expect(result.totalCandidates).toBe(0);
    });

    it('should handle candidates with missing data', () => {
      const incompleteCandidate = {
        id: 'incomplete-1',
        name: 'Incomplete User'
        // Missing skills, experience, education
      };

      const analysis = engine.analyzeCompatibility(sampleJob, incompleteCandidate);
      expect(analysis.overallScore).toBeLessThan(60);
      expect(analysis.confidence).toBeLessThan(0.5);
    });

    it('should handle jobs with missing requirements', () => {
      const incompleteJob = {
        id: 'incomplete-job',
        title: 'Vague Position'
        // Missing skills, experience, location requirements
      };

      const analysis = engine.analyzeCompatibility(incompleteJob, sampleCandidate);
      expect(analysis.breakdown.skills.score).toBe(50); // Default score for missing requirements
    });

    it('should handle invalid skill data gracefully', () => {
      const candidateWithInvalidSkills = {
        ...sampleCandidate,
        skills: [
          null,
          undefined,
          { name: '', years: 0 },
          { name: 'valid-skill', years: 3 }
        ]
      };

      const analysis = engine.analyzeCompatibility(sampleJob, candidateWithInvalidSkills);
      expect(analysis.overallScore).toBeGreaterThan(0);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle large dataset efficiently', async () => {
      const manyJobs = Array.from({ length: 100 }, (_, i) => ({
        ...sampleJob,
        id: `job-${i}`,
        title: `Job ${i}`
      }));

      const startTime = Date.now();
      const result = await engine.findJobsForCandidate(sampleCandidate, manyJobs);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should maintain consistency across multiple runs', async () => {
      const result1 = await engine.findJobsForCandidate(sampleCandidate, sampleJobs);
      const result2 = await engine.findJobsForCandidate(sampleCandidate, sampleJobs);

      expect(result1.matches[0].compatibility.overallScore)
        .toBe(result2.matches[0].compatibility.overallScore);
    });

    it('should work with real-world-like data variations', async () => {
      const variedCandidates = [
        {
          ...sampleCandidate,
          id: 'senior-dev',
          totalExperience: 10,
          skills: [
            { name: 'javascript', years: 10 },
            { name: 'react', years: 6 },
            { name: 'vue', years: 4 },
            { name: 'node.js', years: 8 },
            { name: 'postgresql', years: 5 },
            { name: 'aws', years: 3 }
          ]
        },
        {
          ...sampleCandidate,
          id: 'junior-dev',
          totalExperience: 1,
          skills: [
            { name: 'javascript', years: 1 },
            { name: 'html', years: 1 },
            { name: 'css', years: 1 }
          ]
        },
        {
          ...sampleCandidate,
          id: 'career-changer',
          totalExperience: 0,
          skills: [
            { name: 'python', years: 1 },
            { name: 'data-analysis', years: 2 }
          ],
          education: { level: 'master', degree: 'Data Science' }
        }
      ];

      const result = await engine.findCandidatesForJob(sampleJob, variedCandidates);
      
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].candidate.id).toBe('senior-dev'); // Should rank highest
      expect(result.insights.candidatePool.highQuality).toBeGreaterThan(0);
    });
  });

  afterEach(() => {
    if (engine) {
      engine.clearCaches();
    }
  });
});