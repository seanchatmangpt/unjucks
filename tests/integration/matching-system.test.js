/**
 * Integration Tests for Job Matching System
 * Tests end-to-end workflows and real-world scenarios
 */

const { describe, it, expect, beforeAll, afterAll } = require('vitest');
const { JobMatchingEngine } = require('../../src/core/matching');

describe('Job Matching System Integration', () => {
  let engine;
  let testData;

  beforeAll(() => {
    engine = new JobMatchingEngine({
      enableCache: true,
      minScore: 60,
      maxResults: 20
    });

    // Comprehensive test dataset
    testData = {
      jobs: [
        {
          id: 'job-1',
          title: 'Senior Full Stack Developer',
          company: 'TechCorp',
          requiredSkills: [
            { name: 'javascript', importance: 'critical' },
            { name: 'react', importance: 'critical' },
            { name: 'node.js', importance: 'high' },
            { name: 'postgresql', importance: 'medium' },
            { name: 'aws', importance: 'medium' },
            { name: 'docker', importance: 'low' }
          ],
          experience: '5+ years',
          education: { level: 'bachelor' },
          location: { city: 'San Francisco', state: 'CA', remote: true },
          salary: { min: 130000, max: 180000 },
          preferences: {
            workType: 'full-time',
            industry: 'technology',
            companySize: 'large'
          }
        },
        {
          id: 'job-2',
          title: 'Frontend Developer',
          company: 'StartupCo',
          requiredSkills: [
            { name: 'react', importance: 'critical' },
            { name: 'typescript', importance: 'high' },
            { name: 'css', importance: 'high' },
            { name: 'webpack', importance: 'medium' }
          ],
          experience: '3+ years',
          education: { level: 'bachelor' },
          location: { city: 'Austin', state: 'TX', remote: false },
          salary: { min: 90000, max: 130000 },
          preferences: {
            workType: 'full-time',
            industry: 'technology',
            companySize: 'small'
          }
        },
        {
          id: 'job-3',
          title: 'Data Engineer',
          company: 'DataTech',
          requiredSkills: [
            { name: 'python', importance: 'critical' },
            { name: 'sql', importance: 'critical' },
            { name: 'spark', importance: 'high' },
            { name: 'kafka', importance: 'medium' },
            { name: 'aws', importance: 'high' }
          ],
          experience: '4+ years',
          education: { level: 'bachelor' },
          location: { city: 'Seattle', state: 'WA', remote: true },
          salary: { min: 120000, max: 160000 },
          preferences: {
            workType: 'full-time',
            industry: 'technology',
            companySize: 'medium'
          }
        }
      ],
      candidates: [
        {
          id: 'candidate-1',
          name: 'Alice Johnson',
          skills: [
            { name: 'javascript', years: 7 },
            { name: 'react', years: 5 },
            { name: 'node.js', years: 6 },
            { name: 'typescript', years: 4 },
            { name: 'postgresql', years: 4 },
            { name: 'aws', years: 3 },
            { name: 'docker', years: 2 }
          ],
          totalExperience: 7,
          education: { level: 'bachelor', degree: 'Computer Science' },
          location: { 
            city: 'San Francisco', 
            state: 'CA', 
            remotePreference: true 
          },
          preferences: {
            workType: 'full-time',
            preferredIndustries: ['technology', 'fintech'],
            companySize: 'large',
            salaryExpectation: { min: 140000, max: 200000 }
          }
        },
        {
          id: 'candidate-2',
          name: 'Bob Smith',
          skills: [
            { name: 'react', years: 4 },
            { name: 'typescript', years: 3 },
            { name: 'css', years: 5 },
            { name: 'javascript', years: 4 },
            { name: 'webpack', years: 2 },
            { name: 'sass', years: 3 }
          ],
          totalExperience: 4,
          education: { level: 'bachelor', degree: 'Design' },
          location: { 
            city: 'Austin', 
            state: 'TX', 
            remotePreference: false 
          },
          preferences: {
            workType: 'full-time',
            preferredIndustries: ['technology'],
            companySize: 'small',
            salaryExpectation: { min: 85000, max: 120000 }
          }
        },
        {
          id: 'candidate-3',
          name: 'Carol Davis',
          skills: [
            { name: 'python', years: 6 },
            { name: 'sql', years: 7 },
            { name: 'pandas', years: 5 },
            { name: 'spark', years: 3 },
            { name: 'kafka', years: 2 },
            { name: 'aws', years: 4 }
          ],
          totalExperience: 6,
          education: { level: 'master', degree: 'Data Science' },
          location: { 
            city: 'Seattle', 
            state: 'WA', 
            remotePreference: true 
          },
          preferences: {
            workType: 'full-time',
            preferredIndustries: ['technology', 'healthcare'],
            companySize: 'medium',
            salaryExpectation: { min: 130000, max: 170000 }
          }
        },
        {
          id: 'candidate-4',
          name: 'David Wilson',
          skills: [
            { name: 'java', years: 8 },
            { name: 'spring', years: 6 },
            { name: 'mysql', years: 5 },
            { name: 'javascript', years: 2 },
            { name: 'docker', years: 3 }
          ],
          totalExperience: 8,
          education: { level: 'bachelor', degree: 'Computer Engineering' },
          location: { 
            city: 'Denver', 
            state: 'CO', 
            remotePreference: false,
            willingToRelocate: true 
          },
          preferences: {
            workType: 'full-time',
            preferredIndustries: ['technology', 'finance'],
            companySize: 'large',
            salaryExpectation: { min: 110000, max: 150000 }
          }
        }
      ]
    };
  });

  describe('End-to-End Job Matching Workflow', () => {
    it('should complete full matching workflow for a candidate', async () => {
      const candidate = testData.candidates[0]; // Alice Johnson
      const result = await engine.findJobsForCandidate(candidate, testData.jobs);

      // Verify basic structure
      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('searchMetadata');

      // Should find multiple matches
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches.length).toBeLessThanOrEqual(3);

      // Best match should be the full stack position (perfect skill overlap)
      const bestMatch = result.matches[0];
      expect(bestMatch.job.id).toBe('job-1');
      expect(bestMatch.compatibility.overallScore).toBeGreaterThan(80);

      // Should include career recommendations
      expect(result.recommendations).toHaveProperty('careerPaths');
      expect(result.recommendations).toHaveProperty('skillDevelopment');
    });

    it('should complete full matching workflow for a job posting', async () => {
      const job = testData.jobs[1]; // Frontend Developer position
      const result = await engine.findCandidatesForJob(job, testData.candidates);

      // Verify structure
      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('searchMetadata');

      // Should find qualified candidates
      expect(result.matches.length).toBeGreaterThan(0);

      // Bob Smith should be the best match (frontend specialist)
      const bestMatch = result.matches[0];
      expect(bestMatch.candidate.id).toBe('candidate-2');
      expect(bestMatch.compatibility.overallScore).toBeGreaterThan(75);

      // Should include hiring insights
      expect(result.insights).toHaveProperty('candidatePool');
      expect(result.insights).toHaveProperty('skillAvailability');
      expect(result.insights).toHaveProperty('timeToFill');
    });

    it('should perform mutual matching across all jobs and candidates', async () => {
      const result = await engine.findMutualMatches(testData.jobs, testData.candidates);

      expect(result).toHaveProperty('mutualMatches');
      expect(result).toHaveProperty('insights');

      // Should find several viable pairs
      expect(result.mutualMatches.length).toBeGreaterThan(3);
      expect(result.efficiency).toBeGreaterThan(0.1);

      // Top matches should have high mutual scores
      const topMatch = result.mutualMatches[0];
      expect(topMatch.mutualScore).toBeGreaterThan(75);
      expect(topMatch.mutualFit.balance).toBeGreaterThan(0.6);

      // Should include optimal pairs recommendation
      expect(result.insights.recommendedPairs.length).toBeGreaterThan(0);
    });
  });

  describe('Filtering and Search Scenarios', () => {
    it('should apply location filters correctly', async () => {
      const candidate = testData.candidates[1]; // Bob (Austin-based, no remote)
      
      // Filter for local Austin jobs only
      const localResult = await engine.findJobsForCandidate(candidate, testData.jobs, {
        filters: { location: { city: 'Austin', state: 'TX' } }
      });

      expect(localResult.matches.length).toBe(1);
      expect(localResult.matches[0].job.id).toBe('job-2');

      // Filter for remote jobs
      const remoteResult = await engine.findJobsForCandidate(candidate, testData.jobs, {
        filters: { remote: true }
      });

      expect(remoteResult.matches.length).toBe(2); // Jobs 1 and 3 allow remote
    });

    it('should apply experience level filters', async () => {
      const juniorCandidate = {
        ...testData.candidates[1],
        totalExperience: 2
      };

      const result = await engine.findJobsForCandidate(juniorCandidate, testData.jobs, {
        filters: { experienceLevel: { min: 0, max: 3 } }
      });

      // Should only match the frontend job (3+ years requirement)
      expect(result.matches.length).toBe(1);
      expect(result.matches[0].job.id).toBe('job-2');
    });

    it('should apply salary filters', async () => {
      const candidate = testData.candidates[0];
      
      const result = await engine.findJobsForCandidate(candidate, testData.jobs, {
        filters: { 
          salary: { min: 125000, max: 200000 } 
        }
      });

      // Should exclude the frontend job (lower salary range)
      expect(result.matches.every(m => m.job.salary.min >= 120000)).toBe(true);
    });

    it('should handle complex multi-filter scenarios', async () => {
      const candidate = testData.candidates[0];
      
      const result = await engine.findJobsForCandidate(candidate, testData.jobs, {
        filters: {
          location: { remote: true },
          salary: { min: 130000, max: 200000 },
          industry: 'technology'
        }
      });

      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches.every(m => 
        m.job.location.remote && 
        m.job.salary.min >= 130000 &&
        m.job.preferences.industry === 'technology'
      )).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', async () => {
      // Create larger dataset
      const manyJobs = Array.from({ length: 500 }, (_, i) => ({
        ...testData.jobs[i % 3],
        id: `job-${i}`,
        title: `Position ${i}`
      }));

      const manyCandidates = Array.from({ length: 200 }, (_, i) => ({
        ...testData.candidates[i % 4],
        id: `candidate-${i}`,
        name: `Person ${i}`
      }));

      const startTime = Date.now();
      const result = await engine.findMutualMatches(manyJobs.slice(0, 50), manyCandidates.slice(0, 20));
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.mutualMatches.length).toBeGreaterThan(0);
    });

    it('should utilize caching effectively', async () => {
      const candidate = testData.candidates[0];
      
      // First run - should cache results
      const startTime1 = Date.now();
      const result1 = await engine.findJobsForCandidate(candidate, testData.jobs);
      const endTime1 = Date.now();

      // Second run - should use cache
      const startTime2 = Date.now();
      const result2 = await engine.findJobsForCandidate(candidate, testData.jobs);
      const endTime2 = Date.now();

      // Results should be identical
      expect(result1.matches[0].compatibility.overallScore)
        .toBe(result2.matches[0].compatibility.overallScore);

      // Second run should be faster (cache hit)
      expect(endTime2 - startTime2).toBeLessThan(endTime1 - startTime1);
    });
  });

  describe('Real-World Matching Scenarios', () => {
    it('should handle career transition scenarios', async () => {
      const careerChangerCandidate = {
        id: 'career-changer',
        name: 'Emma Rodriguez',
        skills: [
          { name: 'excel', years: 8 },
          { name: 'sql', years: 2 },
          { name: 'python', years: 1 },
          { name: 'tableau', years: 1 }
        ],
        totalExperience: 8, // Total experience but new to tech
        education: { level: 'master', degree: 'Business Administration' },
        location: { 
          city: 'Chicago', 
          state: 'IL', 
          remotePreference: true,
          willingToRelocate: true 
        },
        preferences: {
          workType: 'full-time',
          preferredIndustries: ['technology', 'finance'],
          companySize: 'medium'
        }
      };

      const result = await engine.findJobsForCandidate(careerChangerCandidate, testData.jobs);
      
      // Should find some matches despite career transition
      expect(result.matches.length).toBeGreaterThan(0);
      
      // Should provide detailed career recommendations
      expect(result.recommendations.careerPaths.transition.length).toBeGreaterThan(0);
      expect(result.recommendations.skillDevelopment.immediate.length).toBeGreaterThan(0);
    });

    it('should handle overqualified candidate scenarios', async () => {
      const overqualifiedCandidate = {
        id: 'senior-architect',
        name: 'Frank Thompson',
        skills: [
          { name: 'javascript', years: 15 },
          { name: 'react', years: 8 },
          { name: 'node.js', years: 12 },
          { name: 'python', years: 10 },
          { name: 'aws', years: 8 },
          { name: 'kubernetes', years: 5 },
          { name: 'system-design', years: 10 },
          { name: 'technical-leadership', years: 8 }
        ],
        totalExperience: 15,
        education: { level: 'master', degree: 'Computer Science' },
        location: { 
          city: 'San Francisco', 
          state: 'CA', 
          remotePreference: true 
        },
        preferences: {
          workType: 'full-time',
          preferredIndustries: ['technology'],
          companySize: 'large',
          salaryExpectation: { min: 200000, max: 300000 }
        }
      };

      const result = await engine.findJobsForCandidate(overqualifiedCandidate, testData.jobs);
      
      // Should still find matches but with notes about overqualification
      expect(result.matches.length).toBeGreaterThan(0);
      
      const bestMatch = result.matches[0];
      expect(bestMatch.compatibility.breakdown.experience.score).toBeGreaterThan(90);
      expect(bestMatch.compatibility.breakdown.experience.status).toBe('qualified');
    });

    it('should handle skill gap scenarios appropriately', async () => {
      const skillGapCandidate = {
        id: 'skill-gap',
        name: 'Grace Kim',
        skills: [
          { name: 'html', years: 3 },
          { name: 'css', years: 3 },
          { name: 'javascript', years: 1 },
          { name: 'photoshop', years: 5 }
        ],
        totalExperience: 3,
        education: { level: 'bachelor', degree: 'Graphic Design' },
        location: { 
          city: 'Portland', 
          state: 'OR', 
          remotePreference: true 
        },
        preferences: {
          workType: 'full-time',
          preferredIndustries: ['technology', 'media'],
          companySize: 'small'
        }
      };

      const result = await engine.findJobsForCandidate(skillGapCandidate, testData.jobs);
      
      // May find some matches with lower scores
      const matches = result.matches;
      if (matches.length > 0) {
        expect(matches[0].compatibility.overallScore).toBeLessThan(75);
        expect(matches[0].compatibility.breakdown.skills.missing.length).toBeGreaterThan(2);
      }

      // Should provide specific skill development recommendations
      expect(result.recommendations.skillDevelopment.immediate.length).toBeGreaterThan(0);
      expect(result.recommendations.actionPlan.immediate.some(
        action => action.type === 'skill-development'
      )).toBe(true);
    });
  });

  describe('Analytics and Insights', () => {
    it('should provide comprehensive hiring insights', async () => {
      const job = testData.jobs[0]; // Senior Full Stack Developer
      const result = await engine.findCandidatesForJob(job, testData.candidates);

      const insights = result.insights;
      
      // Candidate pool analysis
      expect(insights.candidatePool).toHaveProperty('total');
      expect(insights.candidatePool).toHaveProperty('highQuality');
      expect(insights.candidatePool).toHaveProperty('qualified');
      expect(insights.candidatePool.total).toBe(testData.candidates.length);

      // Skill availability analysis
      expect(insights.skillAvailability).toHaveProperty('javascript');
      expect(insights.skillAvailability).toHaveProperty('react');
      expect(insights.skillAvailability.javascript.availability).toBeGreaterThan(0);

      // Competition and time to fill estimates
      expect(insights.competitionLevel).toHaveProperty('level');
      expect(insights.timeToFill).toHaveProperty('estimate');
      expect(insights.timeToFill.estimate).toBeGreaterThan(0);
    });

    it('should track diversity metrics', async () => {
      const candidatesWithDemographics = testData.candidates.map((candidate, index) => ({
        ...candidate,
        demographics: {
          gender: index % 2 === 0 ? 'female' : 'male',
          ethnicity: ['hispanic', 'asian', 'caucasian', 'african-american'][index],
          university: ['Stanford', 'MIT', 'Berkeley', 'Carnegie Mellon'][index]
        }
      }));

      const job = testData.jobs[0];
      const result = await engine.findCandidatesForJob(job, candidatesWithDemographics);

      expect(result.insights.diversityMetrics).toHaveProperty('dataAvailability');
      expect(result.insights.diversityMetrics).toHaveProperty('distribution');
      expect(result.insights.diversityMetrics.dataAvailability).toBe(1.0);
    });

    it('should generate market insights for candidates', async () => {
      const candidate = testData.candidates[0];
      const recommendations = engine.generateCareerRecommendations(candidate, testData.jobs);

      expect(recommendations.marketInsights).toHaveProperty('demandTrends');
      expect(recommendations.marketInsights).toHaveProperty('salaryBenchmarks');
      expect(recommendations.marketInsights).toHaveProperty('growingFields');
    });
  });

  afterAll(() => {
    engine.clearCaches();
  });
});