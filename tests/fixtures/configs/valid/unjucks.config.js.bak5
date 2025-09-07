export default {
  templatesDir: '_templates',
  outputDir: 'src',
  defaultVariables: {
    author: 'Test Author',
    license: 'MIT',
    year: new Date().getFullYear()
  },
  filters: {
    upperCase: (str) => str.toUpperCase(),
    reverse: (str) => str.split('').reverse().join(''),
    repeat: (str, times = 1) => str.repeat(times)
  },
  helpers: {
    formatDate: (date) => new Date(date).toISOString().split('T')[0],
    pluralize: (word) => {
      const plurals = {
        'user': 'users',
        'post': 'posts',
        'comment': 'comments',
        'category': 'categories'
      };
      return plurals[word.toLowerCase()] || `${word}s`;
    }
  },
  hooks: {
    beforeGenerate: (context) => {
      console.log('Before generate:', context.templateName);
    },
    afterGenerate: (context) => {
      console.log('After generate:', context.outputPath);
    }
  },
  validation: {
    validateVariables: true,
    strictMode: false
  }
};