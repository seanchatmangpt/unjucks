module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:security/recommended'
  ],
  plugins: ['security'],
  env: {
    node: true,
    es2022: true
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    // Security-specific rules
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-new-buffer': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-non-literal-require': 'warn',
    'security/detect-object-injection': 'warn',
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-unsafe-regex': 'error',
    
    // Additional security patterns
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    
    // Prevent potential XSS
    'no-inner-declarations': 'error',
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    
    // Input validation
    'no-prototype-builtins': 'error',
    'no-extend-native': 'error',
    
    // File system security
    'no-process-exit': 'error',
    'no-process-env': 'warn',
    
    // Template injection prevention
    'no-template-curly-in-string': 'error',
    
    // SQL injection prevention patterns
    'prefer-template': 'error',
    'no-useless-concat': 'error',
    
    // RDF/SPARQL injection prevention
    'no-multi-str': 'error',
    'quotes': ['error', 'single', { 'avoidEscape': true }],
    
    // Memory safety
    'no-global-assign': 'error',
    'no-implicit-globals': 'error',
    
    // Cryptographic security
    'no-magic-numbers': ['warn', { 
      'ignore': [0, 1, -1], 
      'ignoreArrayIndexes': true,
      'detectObjects': false 
    }]
  },
  overrides: [
    {
      files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
      env: {
        jest: true,
        mocha: true
      },
      rules: {
        // Relax some rules for tests
        'security/detect-non-literal-fs-filename': 'off',
        'security/detect-non-literal-require': 'off',
        'no-process-env': 'off',
        'no-magic-numbers': 'off'
      }
    },
    {
      files: ['scripts/**/*.js'],
      rules: {
        // Allow process operations in scripts
        'no-process-exit': 'off',
        'no-process-env': 'off',
        'security/detect-child-process': 'warn'
      }
    },
    {
      files: ['src/lib/rdf-filters.js', 'src/lib/semantic/**/*.js'],
      rules: {
        // Special handling for RDF processing
        'security/detect-object-injection': 'warn', // May need dynamic property access
        'security/detect-non-literal-regexp': 'warn' // SPARQL patterns may be dynamic
      }
    }
  ],
  globals: {
    // Production environment globals
    'process': 'readonly',
    'Buffer': 'readonly',
    '__dirname': 'readonly',
    '__filename': 'readonly',
    'console': 'readonly',
    'global': 'readonly'
  }
};