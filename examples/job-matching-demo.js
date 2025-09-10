/**
 * Job Matching System Demo
 * Demonstrates the semantic job-resume matching capabilities
 */

const { JobMatchingEngine } = require('../src/core/matching');

async function runJobMatchingDemo() {
  console.log('🚀 Job Matching System Demo\n');

  // Initialize the matching engine
  const engine = new JobMatchingEngine({
    enableCache: true,
    minScore: 60,
    maxResults: 10,
    enableRecommendations: true
  });

  // Sample job postings
  const jobs = [
    {
      id: 'job-1',
      title: 'Senior Full Stack Developer',
      company: 'TechCorp',
      requiredSkills: [
        { name: 'javascript', importance: 'critical' },
        { name: 'react', importance: 'critical' },
        { name: 'node.js', importance: 'high' },
        { name: 'postgresql', importance: 'medium' },
        { name: 'aws', importance: 'medium' }
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
      title: 'Data Scientist',
      company: 'DataTech',
      requiredSkills: [
        { name: 'python', importance: 'critical' },
        { name: 'machine-learning', importance: 'critical' },
        { name: 'pandas', importance: 'high' },
        { name: 'sql', importance: 'high' },
        { name: 'tensorflow', importance: 'medium' }
      ],
      experience: '4+ years',
      education: { level: 'master' },
      location: { city: 'Seattle', state: 'WA', remote: true },
      salary: { min: 140000, max: 190000 },
      preferences: {
        workType: 'full-time',
        industry: 'technology',
        companySize: 'medium'
      }
    }
  ];

  // Sample candidates
  const candidates = [
    {
      id: 'candidate-1',
      name: 'Alice Johnson',
      skills: [
        { name: 'javascript', years: 7 },
        { name: 'react', years: 5 },
        { name: 'node.js', years: 6 },
        { name: 'typescript', years: 4 },
        { name: 'postgresql', years: 4 },
        { name: 'aws', years: 3 }
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
        preferredIndustries: ['technology'],
        companySize: 'large'
      }
    },
    {
      id: 'candidate-2',
      name: 'Bob Davis',
      skills: [
        { name: 'python', years: 6 },
        { name: 'machine-learning', years: 4 },
        { name: 'pandas', years: 5 },
        { name: 'sql', years: 7 },
        { name: 'scikit-learn', years: 3 },
        { name: 'tensorflow', years: 2 }
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
        companySize: 'medium'
      }
    }
  ];

  console.log('📊 Demo Dataset:');
  console.log(`- Jobs: ${jobs.length}`);
  console.log(`- Candidates: ${candidates.length}\n`);

  // Demo 1: Find jobs for a candidate
  console.log('🎯 Demo 1: Finding Jobs for Alice Johnson');
  console.log('=' * 50);
  
  const aliceJobSearch = await engine.findJobsForCandidate(candidates[0], jobs);
  
  console.log(`Found ${aliceJobSearch.matches.length} matching jobs:`);
  for (const match of aliceJobSearch.matches) {
    console.log(`\n📋 ${match.job.title} at ${match.job.company}`);
    console.log(`   Overall Score: ${match.compatibility.overallScore}%`);
    console.log(`   Confidence: ${Math.round(match.compatibility.confidence * 100)}%`);
    console.log(`   Skills Score: ${match.compatibility.breakdown.skills.score}%`);
    console.log(`   Experience Score: ${match.compatibility.breakdown.experience.score}%`);
    console.log(`   Location Score: ${match.compatibility.breakdown.location.score}%`);
    
    if (match.compatibility.breakdown.skills.missing?.length > 0) {
      console.log(`   Missing Skills: ${match.compatibility.breakdown.skills.missing.join(', ')}`);
    }
  }

  // Career recommendations for Alice
  if (aliceJobSearch.recommendations) {
    console.log(`\n📈 Career Recommendations for Alice:`);
    console.log(`   Current Role: ${aliceJobSearch.recommendations.summary.currentRole.title} (${aliceJobSearch.recommendations.summary.currentRole.level})`);
    console.log(`   Confidence: ${Math.round(aliceJobSearch.recommendations.summary.currentRole.confidence * 100)}%`);
    
    if (aliceJobSearch.recommendations.skillDevelopment.immediate.length > 0) {
      console.log(`   Immediate Skill Development:`);
      for (const skill of aliceJobSearch.recommendations.skillDevelopment.immediate.slice(0, 3)) {
        console.log(`     - ${skill.skill} (Priority: ${Math.round(skill.priority * 100)}%)`);
      }
    }
  }

  console.log('\n\n🏢 Demo 2: Finding Candidates for Data Scientist Position');
  console.log('=' * 60);

  // Demo 2: Find candidates for a job
  const dataScientistHiring = await engine.findCandidatesForJob(jobs[1], candidates);
  
  console.log(`Found ${dataScientistHiring.matches.length} qualified candidates:`);
  for (const match of dataScientistHiring.matches) {
    console.log(`\n👤 ${match.candidate.name}`);
    console.log(`   Overall Score: ${match.compatibility.overallScore}%`);
    console.log(`   Confidence: ${Math.round(match.compatibility.confidence * 100)}%`);
    console.log(`   Skills Coverage: ${match.compatibility.breakdown.skills.coverage}%`);
    console.log(`   Experience: ${match.candidate.totalExperience} years`);
    
    if (match.compatibility.recommendations?.length > 0) {
      console.log(`   Recommendations:`);
      for (const rec of match.compatibility.recommendations.slice(0, 2)) {
        console.log(`     - ${rec.message}`);
      }
    }
  }

  // Hiring insights
  if (dataScientistHiring.insights) {
    console.log(`\n📊 Hiring Insights:`);
    const pool = dataScientistHiring.insights.candidatePool;
    console.log(`   Candidate Pool: ${pool.total} total, ${pool.highQuality} high-quality`);
    console.log(`   Competition Level: ${dataScientistHiring.insights.competitionLevel.level}`);
    console.log(`   Estimated Time to Fill: ${dataScientistHiring.insights.timeToFill.estimate} days`);
  }

  console.log('\n\n🤝 Demo 3: Mutual Matching Analysis');
  console.log('=' * 40);

  // Demo 3: Mutual matching
  const mutualMatches = await engine.findMutualMatches(jobs, candidates);
  
  console.log(`Found ${mutualMatches.mutualMatches.length} mutual matches:`);
  console.log(`Efficiency Rate: ${Math.round(mutualMatches.efficiency * 100)}%\n`);
  
  for (const match of mutualMatches.mutualMatches) {
    console.log(`🎯 ${match.candidate.name} ↔ ${match.job.title}`);
    console.log(`   Mutual Score: ${Math.round(match.mutualScore)}%`);
    console.log(`   Balance: ${Math.round(match.mutualFit.balance * 100)}%`);
    console.log(`   Job → Candidate: ${match.jobToCandidate.overallScore}%`);
    console.log(`   Candidate → Job: ${match.candidateToJob.overallScore}%\n`);
  }

  // Optimal pairs
  if (mutualMatches.insights.recommendedPairs.length > 0) {
    console.log(`🌟 Recommended Interview Pairs:`);
    for (const pair of mutualMatches.insights.recommendedPairs) {
      const job = jobs.find(j => j.id === pair.jobId);
      const candidate = candidates.find(c => c.id === pair.candidateId);
      console.log(`   ${candidate.name} → ${job.title} (Score: ${pair.mutualScore}%)`);
    }
  }

  console.log('\n\n🔍 Demo 4: Detailed Compatibility Analysis');
  console.log('=' * 50);

  // Demo 4: Detailed analysis
  const detailedAnalysis = engine.analyzeCompatibility(jobs[0], candidates[0]);
  
  console.log(`Detailed Analysis: Alice Johnson → Senior Full Stack Developer`);
  console.log(`Overall Score: ${detailedAnalysis.overallScore}% (Confidence: ${Math.round(detailedAnalysis.confidence * 100)}%)\n`);

  // Skill analysis breakdown
  console.log(`🛠️  Skill Analysis:`);
  for (const detail of detailedAnalysis.breakdown.skills.details) {
    const matchType = detail.type === 'exact' ? '✅' : detail.type === 'none' ? '❌' : '🔄';
    console.log(`   ${matchType} ${detail.required}: ${detail.score}% (${detail.type})`);
  }

  if (detailedAnalysis.skillAnalysis) {
    console.log(`\n📈 Skill Relationships:`);
    console.log(`   Exact Matches: ${detailedAnalysis.skillAnalysis.exactMatches.length}`);
    console.log(`   Related Matches: ${detailedAnalysis.skillAnalysis.relatedMatches.length}`);
    console.log(`   Missing Skills: ${detailedAnalysis.skillAnalysis.missingSkills.length}`);
    
    if (detailedAnalysis.skillAnalysis.transferableSkills.length > 0) {
      console.log(`   Transferable Skills:`);
      for (const transfer of detailedAnalysis.skillAnalysis.transferableSkills.slice(0, 3)) {
        console.log(`     ${transfer.from} → ${transfer.to} (${Math.round(transfer.transferability * 100)}%)`);
      }
    }
  }

  // Strength and improvement areas
  if (detailedAnalysis.analysis) {
    console.log(`\n💪 Strength Areas:`);
    for (const strength of detailedAnalysis.analysis.strengthAreas) {
      console.log(`   - ${strength}`);
    }
    
    if (detailedAnalysis.analysis.improvementAreas.length > 0) {
      console.log(`\n📚 Improvement Areas:`);
      for (const improvement of detailedAnalysis.analysis.improvementAreas) {
        console.log(`   - ${improvement}`);
      }
    }
  }

  console.log('\n\n📊 Demo 5: System Performance Metrics');
  console.log('=' * 45);

  // Demo 5: System metrics
  const metrics = engine.getSystemMetrics();
  
  console.log(`System Version: ${metrics.version}`);
  console.log(`Configuration:`);
  console.log(`   Min Score: ${metrics.config.minScore}%`);
  console.log(`   Max Results: ${metrics.config.maxResults}`);
  console.log(`   Cache Enabled: ${metrics.config.enableCache}`);
  
  console.log(`\nOntology Statistics:`);
  console.log(`   Skills in Database: ${metrics.ontology.skillCount}`);
  console.log(`   Synonyms: ${metrics.ontology.synonymCount}`);
  console.log(`   Domains: ${metrics.ontology.domainCount}`);
  
  console.log(`\nCache Statistics:`);
  console.log(`   Cached Entries: ${metrics.cache.size}`);
  console.log(`   Cache Enabled: ${metrics.cache.enabled}`);

  console.log('\n\n🎉 Demo Complete!');
  console.log('The job matching system successfully demonstrated:');
  console.log('✅ Semantic skill matching with 0-100% scoring');
  console.log('✅ Experience and education compatibility');
  console.log('✅ Location and preference matching');
  console.log('✅ Career development recommendations');
  console.log('✅ Mutual matching and optimization');
  console.log('✅ Comprehensive analytics and insights');
  
  // Clear cache for clean exit
  engine.clearCaches();
}

// Run the demo
if (require.main === module) {
  runJobMatchingDemo().catch(console.error);
}

module.exports = { runJobMatchingDemo };