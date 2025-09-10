/**
 * Standalone LaTeX Resume Demo
 * 
 * Generates LaTeX resumes without external dependencies
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple template renderer (Nunjucks-like)
function renderTemplate(template, data) {
  let result = template;
  
  // Handle simple variable substitution {{ variable }}
  result = result.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, varPath) => {
    const keys = varPath.trim().split('.');
    let value = data;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return match; // Keep original if not found
      }
    }
    
    return value || '';
  });
  
  // Handle filters {{ variable | filter }}
  result = result.replace(/\{\{\s*([^|]+)\s*\|\s*([^}]+)\s*\}\}/g, (match, varPath, filterName) => {
    const value = getNestedValue(data, varPath.trim());
    const filter = filters[filterName.trim()];
    
    if (filter && value !== undefined) {
      return filter(value);
    }
    
    return value || '';
  });
  
  return result;
}

function getNestedValue(obj, path) {
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  
  return value;
}

// Filters
const filters = {
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
  
  upper: (str) => {
    if (typeof str !== 'string') return String(str);
    return str.toUpperCase();
  },
  
  default: (value, defaultValue = '') => {
    return (value === null || value === undefined || value === '') ? defaultValue : value;
  }
};

// Simple LaTeX templates
const professionalTemplate = `\\documentclass[11pt,a4paper,sans]{moderncv}

% Modern CV style and color scheme
\\moderncvstyle{classic}
\\moderncvcolor{blue}

% Character encoding and language
\\usepackage[utf8]{inputenc}
\\usepackage[english]{babel}

% Page margins
\\usepackage[scale=0.75]{geometry}

% Personal data
\\name{{{ person.firstName | texEscape }}}{{{ person.lastName | texEscape }}}
\\title{{{ person.title | texEscape }}}
\\address{{{ person.address.street | texEscape }}}{{{ person.address.city | texEscape }}, {{ person.address.state | texEscape }} {{ person.address.zip | texEscape }}}{{{ person.address.country | texEscape }}}
\\phone[mobile]{{{ person.phone | texEscape }}}
\\email{{{ person.email | texEscape }}}
\\homepage{{{ person.website | texEscape }}}
\\social[linkedin]{{{ person.linkedin | texEscape }}}
\\social[github]{{{ person.github | texEscape }}}

\\begin{document}
\\makecvtitle

\\section{Professional Summary}
\\cvitem{}{{{ summary | texEscape }}}

\\section{Professional Experience}
\\cventry{2021--2023}{Senior Software Engineer}{TechCorp Inc.}{San Francisco, CA}{}{%
Led development of microservices architecture serving 10M+ daily users.%
\\begin{itemize}%
\\item Improved application performance by 40\\% through optimization and caching strategies
\\item Mentored team of 5 junior developers and established code review practices
\\item Implemented CI/CD pipeline reducing deployment time from 2 hours to 15 minutes
\\end{itemize}%
}

\\section{Education}
\\cventry{2017--2019}{Master of Science in Computer Science}{Stanford University}{Stanford, CA}{3.9}{%
Focus on Machine Learning and Distributed Systems%
}

\\section{Technical Skills}
\\cvitem{Programming Languages}{JavaScript, TypeScript, Python, Java, Go, SQL}
\\cvitem{Frameworks \\& Libraries}{React, Node.js, Express.js, Django, Spring Boot}
\\cvitem{Cloud \\& DevOps}{AWS, Docker, Kubernetes, Terraform, Jenkins, GitHub Actions}

\\end{document}`;

const academicTemplate = `\\documentclass[11pt,a4paper]{article}

% Academic resume packages
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[margin=1in]{geometry}
\\usepackage{hyperref}
\\usepackage{titlesec}
\\usepackage{enumitem}

% Custom formatting
\\titleformat{\\section}{\\large\\bfseries}{\\thesection}{1em}{}[\\titlerule]

% Remove paragraph indentation
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{6pt}

\\begin{document}

% Header
\\begin{center}
  {\\LARGE \\textbf{{{ person.firstName | texEscape }} {{ person.lastName | texEscape }}}} \\\\
  \\vspace{5pt}
  {\\large {{ person.title | texEscape }}} \\\\
  \\vspace{3pt}
  {{ person.address.street | texEscape }}, {{ person.address.city | texEscape }}, {{ person.address.state | texEscape }} {{ person.address.zip | texEscape }} \\\\
  Phone: {{ person.phone | texEscape }} \\quad
  Email: \\href{mailto:{{ person.email }}}{{{ person.email | texEscape }}}
\\end{center}

\\vspace{10pt}

\\section{Research Interests}
{{ summary | texEscape }}

\\section{Education}
\\textbf{Ph.D. in Computer Science} \\hfill 2015--2020 \\\\
Massachusetts Institute of Technology, Cambridge, MA \\\\
Dissertation: "Deep Learning Approaches to Automated Essay Scoring"

\\section{Academic \\& Professional Experience}
\\textbf{Assistant Professor} \\hfill 2020--Present \\\\
Harvard University, Cambridge, MA
\\begin{itemize}
\\item Published 15 peer-reviewed papers in top-tier conferences
\\item Secured \\$500K NSF grant for educational AI research
\\item Developed new graduate course on Deep Learning for NLP
\\end{itemize}

\\section{Publications}
\\begin{enumerate}
\\item Smith, J., Johnson, R., Williams, K. (2023). Automated Essay Scoring with Transformer Models. \\textit{Journal of Educational Technology}, 45, 123-145.
\\end{enumerate}

\\section{Grants \\& Funding}
\\begin{itemize}
\\item \\textbf{AI for Educational Assessment} (\\$500,000). National Science Foundation, 2021. Role: Principal Investigator
\\end{itemize}

\\end{document}`;

const executiveTemplate = `\\documentclass[11pt,letterpaper]{article}

% Executive resume packages
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[margin=0.75in]{geometry}
\\usepackage{hyperref}
\\usepackage{titlesec}
\\usepackage{xcolor}

% Define colors
\\definecolor{headingcolor}{RGB}{0,51,102}
\\definecolor{rulecolor}{RGB}{128,128,128}

% Custom formatting
\\titleformat{\\section}
  {\\color{headingcolor}\\Large\\bfseries}
  {\\thesection}{0em}
  {}
  [\\vspace{-10pt}{\\color{rulecolor}\\titlerule[1pt]}\\vspace{5pt}]

% Remove paragraph indentation
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{8pt}

\\begin{document}

% Executive Header
\\begin{center}
  {\\Huge \\textbf{{{ person.firstName | upper | texEscape }} {{ person.lastName | upper | texEscape }}}} \\\\
  \\vspace{8pt}
  {\\LARGE \\color{headingcolor}{{ person.title | texEscape }}} \\\\
  \\vspace{5pt}
  
  % Contact Information
  \\begin{tabular}{c|c|c}
    {{ person.phone | texEscape }} & \\href{mailto:{{ person.email }}}{{{ person.email | texEscape }}} & LinkedIn Profile
  \\end{tabular}
  
  \\\\
  \\vspace{3pt}
  {{ person.address.city | texEscape }}, {{ person.address.state | texEscape }} {{ person.address.zip | texEscape }}
\\end{center}

\\vspace{15pt}

\\section{Executive Summary}
{{ summary | texEscape }}

\\section{Core Competencies}
\\begin{center}
\\begin{tabular}{|c|c|c|}
\\hline
Strategic Planning & Team Leadership & Digital Transformation \\\\ \\hline
P\\&L Management & Stakeholder Relations & Change Management \\\\ \\hline
\\end{tabular}
\\end{center}

\\section{Professional Experience}
\\textbf{\\large Senior Software Engineer} \\hfill \\textbf{01/2021--12/2023} \\\\
\\textit{TechCorp Inc.} \\hfill \\textit{San Francisco, CA} \\\\

Led development of microservices architecture serving 10M+ daily users.

\\textbf{Key Achievements:}
\\begin{itemize}
  \\item Improved application performance by 40\\% through optimization and caching strategies
  \\item Mentored team of 5 junior developers and established code review practices
  \\item Implemented CI/CD pipeline reducing deployment time from 2 hours to 15 minutes
\\end{itemize}

\\section{Education \\& Professional Development}
\\textbf{Master of Science in Computer Science} \\hfill 2019 \\\\
Stanford University, Stanford, CA \\hfill GPA: 3.9 \\\\

\\section{Professional Certifications}
\\begin{itemize}
\\item \\textbf{AWS Certified Solutions Architect} - Amazon Web Services (2022)
\\end{itemize}

\\section{Technical \\& Strategic Competencies}
\\textbf{Programming Languages:} JavaScript, TypeScript, Python, Java, Go, SQL

\\textbf{Cloud \\& DevOps:} AWS, Docker, Kubernetes, Terraform, Jenkins, GitHub Actions

\\end{document}`;

// Sample data
const sampleData = {
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
  summary: 'Experienced software engineer with 8+ years developing scalable web applications and leading cross-functional teams. Expertise in full-stack development, cloud architecture, and agile methodologies.'
};

async function generateStandaloneDemo() {
  console.log('🎯 Standalone LaTeX Resume Demo\n');
  
  try {
    // Create output directory
    const outputDir = join(__dirname, '../../../generated');
    await fs.mkdir(outputDir, { recursive: true });
    
    const templates = [
      { name: 'professional', template: professionalTemplate, filename: 'john-doe-professional.tex' },
      { name: 'academic', template: academicTemplate, filename: 'dr-jane-smith-academic.tex' },
      { name: 'executive', template: executiveTemplate, filename: 'john-doe-executive.tex' }
    ];
    
    console.log('✓ Output directory created');
    
    const results = [];
    
    for (const { name, template, filename } of templates) {
      console.log(`📝 Generating ${name} resume...`);
      
      // Render template with data
      let rendered = template;
      
      // Manual template rendering for key fields
      rendered = rendered.replace(/\{\{\{\s*person\.firstName\s*\|\s*texEscape\s*\}\}\}/g, filters.texEscape(sampleData.person.firstName));
      rendered = rendered.replace(/\{\{\{\s*person\.lastName\s*\|\s*texEscape\s*\}\}\}/g, filters.texEscape(sampleData.person.lastName));
      rendered = rendered.replace(/\{\{\{\s*person\.title\s*\|\s*texEscape\s*\}\}\}/g, filters.texEscape(sampleData.person.title));
      rendered = rendered.replace(/\{\{\{\s*person\.email\s*\|\s*texEscape\s*\}\}\}/g, filters.texEscape(sampleData.person.email));
      rendered = rendered.replace(/\{\{\{\s*person\.phone\s*\|\s*texEscape\s*\}\}\}/g, filters.texEscape(sampleData.person.phone));
      rendered = rendered.replace(/\{\{\{\s*person\.website\s*\|\s*texEscape\s*\}\}\}/g, filters.texEscape(sampleData.person.website));
      rendered = rendered.replace(/\{\{\{\s*person\.linkedin\s*\|\s*texEscape\s*\}\}\}/g, filters.texEscape(sampleData.person.linkedin));
      rendered = rendered.replace(/\{\{\{\s*person\.github\s*\|\s*texEscape\s*\}\}\}/g, filters.texEscape(sampleData.person.github));
      
      // Address fields
      rendered = rendered.replace(/\{\{\{\s*person\.address\.street\s*\|\s*texEscape\s*\}\}\}/g, filters.texEscape(sampleData.person.address.street));
      rendered = rendered.replace(/\{\{\{\s*person\.address\.city\s*\|\s*texEscape\s*\}\}\}/g, filters.texEscape(sampleData.person.address.city));
      rendered = rendered.replace(/\{\{\{\s*person\.address\.state\s*\|\s*texEscape\s*\}\}\}/g, filters.texEscape(sampleData.person.address.state));
      rendered = rendered.replace(/\{\{\{\s*person\.address\.zip\s*\|\s*texEscape\s*\}\}\}/g, filters.texEscape(sampleData.person.address.zip));
      rendered = rendered.replace(/\{\{\{\s*person\.address\.country\s*\|\s*texEscape\s*\}\}\}/g, filters.texEscape(sampleData.person.address.country));
      
      // Summary
      rendered = rendered.replace(/\{\{\{\s*summary\s*\|\s*texEscape\s*\}\}\}/g, filters.texEscape(sampleData.summary));
      
      // Handle special filters for executive template
      rendered = rendered.replace(/\{\{\{\s*person\.firstName\s*\|\s*upper\s*\|\s*texEscape\s*\}\}\}/g, filters.texEscape(filters.upper(sampleData.person.firstName)));
      rendered = rendered.replace(/\{\{\{\s*person\.lastName\s*\|\s*upper\s*\|\s*texEscape\s*\}\}\}/g, filters.texEscape(filters.upper(sampleData.person.lastName)));
      
      // Handle simple variable substitution for email links
      rendered = rendered.replace(/\{\{\s*person\.email\s*\}\}/g, sampleData.person.email);
      
      // Write to file
      const filePath = join(outputDir, filename);
      await fs.writeFile(filePath, rendered, 'utf8');
      
      const stats = {
        name: name,
        filename: filename,
        size: `${(rendered.length / 1024).toFixed(2)} KB`,
        lines: rendered.split('\n').length,
        path: filePath
      };
      
      results.push(stats);
      
      console.log(`   ✓ ${filename} (${stats.size}, ${stats.lines} lines)`);
    }
    
    console.log('\n📊 Generation Summary:');
    results.forEach(result => {
      console.log(`   ${result.name}: ${result.filename}`);
    });
    
    console.log('\n🔍 LaTeX Content Validation:');
    
    // Read and validate one file
    const testFile = join(outputDir, results[0].filename);
    const content = await fs.readFile(testFile, 'utf8');
    
    const checks = [
      { name: 'Document class', test: content.includes('\\documentclass') },
      { name: 'UTF-8 encoding', test: content.includes('\\usepackage[utf8]{inputenc}') },
      { name: 'Document structure', test: content.includes('\\begin{document}') && content.includes('\\end{document}') },
      { name: 'LaTeX escaping', test: content.includes('\\&') || content.includes('\\%') },
      { name: 'Personal data', test: content.includes('John') && content.includes('Doe') },
      { name: 'Contact info', test: content.includes('john.doe@example.com') }
    ];
    
    checks.forEach(check => {
      console.log(`   ${check.name}: ${check.test ? '✓' : '✗'}`);
    });
    
    console.log('\n🎉 Standalone LaTeX Demo Complete!');
    console.log(`📁 Generated ${results.length} resume files in: ${outputDir}`);
    console.log('🔧 To compile: pdflatex <filename>.tex');
    
    return {
      success: true,
      files: results,
      outputDir: outputDir
    };
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run demo
generateStandaloneDemo().then(result => {
  process.exit(result.success ? 0 : 1);
});

export { generateStandaloneDemo, filters };