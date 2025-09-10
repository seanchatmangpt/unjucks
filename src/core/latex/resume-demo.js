/**
 * LaTeX Resume Engine Demo
 * 
 * Demonstrates LaTeX resume generation with real data
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import nunjucks from 'nunjucks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple LaTeX filters implementation
const latexFilters = {
  texEscape: (str) => {
    if (typeof str !== 'string') return String(str);
    const escapeMap = {
      '&': '\\&',
      '%': '\\%',
      '$': '\\$',
      '#': '\\#',
      '^': '\\textasciicircum{}',
      '_': '\\_',
      '{': '\\{',
      '}': '\\}',
      '~': '\\textasciitilde{}',
      '\\': '\\textbackslash{}'
    };
    return str.replace(/[&%$#^_{}~\\]/g, match => escapeMap[match]);
  },
  
  kebabCase: (str) => {
    if (typeof str !== 'string') return String(str);
    return str.replace(/([a-z])([A-Z])/g, '$1-$2')
              .replace(/[\s_]+/g, '-')
              .toLowerCase();
  },
  
  dateFormat: (date, format = 'YYYY') => {
    if (!date) return '';
    const d = new Date(date);
    if (format === 'YYYY') return d.getFullYear().toString();
    if (format === 'MMM YYYY') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    }
    return d.toISOString().split('T')[0];
  },
  
  default: (value, defaultValue = '') => {
    return (value === null || value === undefined || value === '') ? defaultValue : value;
  },
  
  join: (array, separator = ', ') => {
    if (!Array.isArray(array)) return array;
    return array.join(separator);
  },
  
  upper: (str) => {
    if (typeof str !== 'string') return String(str);
    return str.toUpperCase();
  }
};

// Sample resume data
const sampleResumeData = {
  name: 'john-doe-resume',
  style: 'classic',
  color: 'blue',
  person: {
    firstName: 'John',
    lastName: 'Doe',
    title: 'Senior Software Engineer',
    email: 'john.doe@example.com',
    phone: '+1-555-123-4567',
    address: {
      street: '123 Main Street',
      city: 'San Francisco',
      state: 'CA',
      zip: '94105',
      country: 'USA'
    },
    linkedin: 'linkedin.com/in/johndoe',
    github: 'github.com/johndoe',
    website: 'johndoe.dev'
  },
  summary: 'Experienced software engineer with 8+ years developing scalable web applications and leading cross-functional teams. Expertise in full-stack development, cloud architecture, and agile methodologies.',
  experience: [
    {
      position: 'Senior Software Engineer',
      company: 'TechCorp Inc.',
      location: 'San Francisco, CA',
      startDate: '2021-01-01',
      endDate: '2023-12-31',
      type: 'Full-time',
      description: 'Led development of microservices architecture serving 10M+ daily users.',
      achievements: [
        'Improved application performance by 40% through optimization and caching strategies',
        'Mentored team of 5 junior developers and established code review practices',
        'Implemented CI/CD pipeline reducing deployment time from 2 hours to 15 minutes',
        'Designed and built real-time analytics dashboard used by executive team'
      ]
    },
    {
      position: 'Software Engineer',
      company: 'StartupXYZ',
      location: 'Palo Alto, CA',
      startDate: '2019-03-01',
      endDate: '2020-12-31',
      type: 'Full-time',
      description: 'Full-stack development for B2B SaaS platform.',
      achievements: [
        'Built responsive React frontend serving 50,000+ business users',
        'Developed RESTful APIs with Node.js handling 1M+ requests/day',
        'Implemented OAuth 2.0 authentication and role-based access control'
      ]
    }
  ],
  education: [
    {
      degree: 'Master of Science in Computer Science',
      institution: 'Stanford University',
      location: 'Stanford, CA',
      startDate: '2017-09-01',
      endDate: '2019-06-01',
      gpa: '3.9',
      description: 'Focus on Machine Learning and Distributed Systems',
      coursework: ['Advanced Algorithms', 'Machine Learning', 'Distributed Systems', 'Database Systems']
    },
    {
      degree: 'Bachelor of Science in Computer Engineering',
      institution: 'University of California, Berkeley',
      location: 'Berkeley, CA',
      startDate: '2013-08-01',
      endDate: '2017-05-01',
      gpa: '3.7',
      coursework: ['Data Structures', 'Computer Architecture', 'Software Engineering']
    }
  ],
  skills: [
    {
      category: 'Programming Languages',
      items: ['JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'SQL']
    },
    {
      category: 'Frameworks & Libraries',
      items: ['React', 'Node.js', 'Express.js', 'Django', 'Spring Boot']
    },
    {
      category: 'Cloud & DevOps',
      items: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'Jenkins', 'GitHub Actions']
    },
    {
      category: 'Databases',
      items: ['PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch']
    }
  ],
  projects: [
    {
      name: 'Real-time Analytics Platform',
      technologies: ['React', 'Node.js', 'WebSocket', 'Redis'],
      date: '2023-01-01',
      role: 'Technical Lead',
      description: 'Built scalable real-time dashboard processing 100K+ events/second.',
      achievements: [
        'Designed event-driven architecture with 99.9% uptime',
        'Implemented WebSocket-based real-time updates',
        'Optimized database queries reducing response time by 60%'
      ]
    }
  ],
  certifications: [
    {
      name: 'AWS Certified Solutions Architect',
      issuer: 'Amazon Web Services',
      date: '2022-06-01',
      id: 'AWS-CSA-123456',
      description: 'Professional level certification for cloud architecture'
    }
  ],
  awards: [
    {
      name: 'Employee of the Year',
      issuer: 'TechCorp Inc.',
      date: '2022-12-01',
      description: 'Recognized for outstanding technical contributions and leadership'
    }
  ],
  languages: [
    { language: 'English', proficiency: 'Native' },
    { language: 'Spanish', proficiency: 'Conversational' }
  ],
  interests: 'Open source software, machine learning research, hiking, photography'
};

// Academic resume data
const academicResumeData = {
  name: 'dr-jane-smith-cv',
  person: {
    firstName: 'Dr. Jane',
    lastName: 'Smith',
    title: 'Assistant Professor of Computer Science',
    email: 'jane.smith@university.edu',
    phone: '+1-555-987-6543',
    address: {
      street: '456 University Ave',
      city: 'Cambridge',
      state: 'MA',
      zip: '02138'
    }
  },
  summary: 'Research interests include machine learning, natural language processing, and computational linguistics with applications to educational technology.',
  education: [
    {
      degree: 'Ph.D. in Computer Science',
      institution: 'Massachusetts Institute of Technology',
      location: 'Cambridge, MA',
      startDate: '2015-09-01',
      endDate: '2020-05-01',
      description: 'Dissertation: "Deep Learning Approaches to Automated Essay Scoring"',
      gpa: '4.0'
    }
  ],
  experience: [
    {
      position: 'Assistant Professor',
      company: 'Harvard University',
      location: 'Cambridge, MA',
      startDate: '2020-09-01',
      description: 'Teaching and research in Computer Science department',
      achievements: [
        'Published 15 peer-reviewed papers in top-tier conferences',
        'Secured $500K NSF grant for educational AI research',
        'Developed new graduate course on Deep Learning for NLP'
      ]
    }
  ],
  publications: [
    {
      title: 'Automated Essay Scoring with Transformer Models',
      authors: ['Smith, J.', 'Johnson, R.', 'Williams, K.'],
      journal: 'Journal of Educational Technology',
      date: '2023-01-01',
      volume: '45',
      pages: '123-145',
      doi: '10.1000/example.doi'
    }
  ],
  research: [
    {
      title: 'Educational AI Systems',
      institution: 'Harvard University',
      startDate: '2020-09-01',
      advisor: 'Principal Investigator',
      description: 'Developing AI-powered tutoring systems for personalized learning'
    }
  ],
  teaching: [
    {
      role: 'Instructor',
      course: 'CS 181: Machine Learning',
      institution: 'Harvard University',
      semester: 'Fall',
      year: '2023',
      description: 'Graduate-level course covering supervised and unsupervised learning'
    }
  ],
  grants: [
    {
      title: 'AI for Educational Assessment',
      agency: 'National Science Foundation',
      amount: '$500,000',
      date: '2021-01-01',
      role: 'Principal Investigator'
    }
  ]
};

async function generateResumeDemo() {
  console.log('🎯 LaTeX Resume Engine Demo\n');
  
  try {
    // Setup Nunjucks environment
    const templateDir = join(__dirname, '../../../templates/resume');
    const env = nunjucks.configure(templateDir, { autoescape: false });
    
    // Add LaTeX filters
    Object.entries(latexFilters).forEach(([name, filter]) => {
      env.addFilter(name, filter);
    });
    
    console.log('✓ Nunjucks environment configured with LaTeX filters');
    
    // Generate LaTeX resumes
    const outputs = [];
    
    // 1. Professional Resume (ModernCV style)
    const professionalLatex = env.render('latex-resume.njk', sampleResumeData);
    outputs.push({
      filename: 'john-doe-professional.tex',
      content: professionalLatex,
      type: 'Professional (ModernCV)'
    });
    
    // 2. Academic Resume
    const academicLatex = env.render('academic-resume.njk', academicResumeData);
    outputs.push({
      filename: 'dr-jane-smith-academic.tex',
      content: academicLatex,
      type: 'Academic'
    });
    
    // 3. Executive Resume
    const executiveData = {
      ...sampleResumeData,
      name: 'executive-resume',
      coreCompetencies: [
        'Strategic Planning',
        'Team Leadership', 
        'Digital Transformation',
        'P&L Management',
        'Stakeholder Relations',
        'Change Management'
      ],
      boardPositions: [
        {
          position: 'Board Member',
          organization: 'TechStartup Advisory Board',
          startDate: '2022-01-01',
          type: 'Advisory',
          description: 'Strategic advisor for emerging technology companies'
        }
      ]
    };
    
    const executiveLatex = env.render('executive-resume.njk', executiveData);
    outputs.push({
      filename: 'john-doe-executive.tex',
      content: executiveLatex,
      type: 'Executive'
    });
    
    console.log('✓ Generated LaTeX templates for all resume types\n');
    
    // Write output files
    const outputDir = join(__dirname, '../../../generated');
    await fs.mkdir(outputDir, { recursive: true });
    
    for (const output of outputs) {
      const filePath = join(outputDir, output.filename);
      await fs.writeFile(filePath, output.content, 'utf8');
      
      console.log(`📄 ${output.type} Resume:`);
      console.log(`   File: ${output.filename}`);
      console.log(`   Size: ${(output.content.length / 1024).toFixed(2)} KB`);
      console.log(`   Lines: ${output.content.split('\n').length}`);
      
      // Show sample LaTeX content
      const preview = output.content.substring(0, 200).replace(/\n/g, ' ');
      console.log(`   Preview: ${preview}...`);
      console.log('');
    }
    
    // Test LaTeX syntax validation
    console.log('🔍 LaTeX Syntax Validation:');
    
    const syntaxChecks = [
      { test: 'Document class', pattern: /\\documentclass/, desc: 'Document class declaration' },
      { test: 'UTF-8 encoding', pattern: /\\usepackage\[utf8\]\{inputenc\}/, desc: 'UTF-8 input encoding' },
      { test: 'Begin document', pattern: /\\begin\{document\}/, desc: 'Document begin' },
      { test: 'End document', pattern: /\\end\{document\}/, desc: 'Document end' },
      { test: 'LaTeX escaping', pattern: /\\&|\\%|\\\$/, desc: 'Special character escaping' },
      { test: 'Sections', pattern: /\\section\{/, desc: 'Section headers' }
    ];
    
    outputs.forEach(output => {
      console.log(`   ${output.type}:`);
      syntaxChecks.forEach(check => {
        const found = check.pattern.test(output.content);
        console.log(`     ${check.test}: ${found ? '✓' : '✗'} ${check.desc}`);
      });
      console.log('');
    });
    
    console.log('🎉 LaTeX Resume Engine Demo Complete!');
    console.log('\n📁 Generated files are in the /generated directory');
    console.log('🔧 To compile to PDF, run: pdflatex <filename>.tex');
    
    return {
      success: true,
      filesGenerated: outputs.length,
      outputDir: outputDir,
      files: outputs.map(o => o.filename)
    };
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateResumeDemo().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

export { generateResumeDemo, sampleResumeData, academicResumeData, latexFilters };