module.exports = {
  prompt: ({ inquirer }) => {
    const questions = [
      {
        type: 'input',
        name: 'candidateName',
        message: 'Candidate full name:',
        validate: input => input.length > 0 || 'Name is required'
      },
      {
        type: 'input',
        name: 'jobTitle',
        message: 'Job title/position:',
        default: 'Software Engineer'
      },
      {
        type: 'input',
        name: 'email',
        message: 'Email address:',
        validate: input => /\S+@\S+\.\S+/.test(input) || 'Valid email required'
      },
      {
        type: 'input',
        name: 'phone',
        message: 'Phone number:',
        default: '+1 (555) 123-4567'
      },
      {
        type: 'input',
        name: 'location',
        message: 'Location (city, state):',
        default: 'San Francisco, CA'
      },
      {
        type: 'input',
        name: 'linkedinUrl',
        message: 'LinkedIn URL:',
        default: 'https://linkedin.com/in/username'
      },
      {
        type: 'input',
        name: 'githubUrl',
        message: 'GitHub URL:',
        default: 'https://github.com/username'
      },
      {
        type: 'input',
        name: 'portfolioUrl',
        message: 'Portfolio URL:',
        default: 'https://portfolio.com'
      },
      {
        type: 'list',
        name: 'format',
        message: 'Resume format:',
        choices: [
          { name: 'LaTeX (PDF)', value: 'latex' },
          { name: 'HTML (Web)', value: 'html' },
          { name: 'JSON-LD (Semantic)', value: 'json-ld' },
          { name: 'All formats', value: 'all' }
        ],
        default: 'all'
      },
      {
        type: 'list',
        name: 'industry',
        message: 'Industry/Job type:',
        choices: [
          { name: 'Software Engineering', value: 'software' },
          { name: 'Data Science', value: 'data-science' },
          { name: 'Product Management', value: 'product' },
          { name: 'Design', value: 'design' },
          { name: 'Marketing', value: 'marketing' },
          { name: 'Finance', value: 'finance' },
          { name: 'Healthcare', value: 'healthcare' },
          { name: 'Education', value: 'education' },
          { name: 'Generic', value: 'generic' }
        ],
        default: 'software'
      },
      {
        type: 'confirm',
        name: 'includeSemanticData',
        message: 'Include semantic/structured data?',
        default: true
      },
      {
        type: 'confirm',
        name: 'generateVariants',
        message: 'Generate industry-specific variants?',
        default: false
      }
    ];

    return inquirer.prompt(questions);
  }
};