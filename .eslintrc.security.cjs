module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    browser: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    allowImportExportEverywhere: true
  },
  rules: {
    // ============================================================================
    // CRITICAL SECURITY RULES (Zero Tolerance)
    // ============================================================================
    
    // Prevent code injection
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    
    // Prevent prototype pollution
    'no-proto': 'error',
    'no-extend-native': 'error',
    'no-prototype-builtins': 'error',
    
    // Type safety
    'eqeqeq': ['error', 'always'],
    'no-eq-null': 'error',
    
    // ============================================================================
    // HIGH SEVERITY SECURITY RULES
    // ============================================================================
    
    // Variable security
    'no-unused-vars': ['error', { 
      vars: 'all', 
      args: 'after-used',
      ignoreRestSiblings: false,
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    'no-undef': 'error',
    'no-global-assign': 'error',
    'no-implicit-globals': 'error',
    
    // Function security
    'no-caller': 'error',
    'no-constructor-return': 'error',
    'no-return-assign': 'error',
    
    // Control flow security
    'no-unreachable': 'error',
    'no-fallthrough': 'error',
    'default-case': 'error',
    
    // ============================================================================
    // MEDIUM SEVERITY SECURITY RULES
    // ============================================================================
    
    // Prevent dangerous patterns
    'no-console': 'warn', // Prevent information leakage
    'no-debugger': 'error',
    'no-alert': 'error',
    
    // Require strict mode for security
    'strict': 'off', // Handled by ES modules
    
    // Prevent insecure practices
    'no-with': 'error',
    'no-void': 'error',
    'no-sequences': 'error',
    'no-multi-str': 'error',
    
    // Async security
    'require-await': 'warn',
    'no-async-promise-executor': 'error',
    'no-promise-executor-return': 'error',
    
    // Error handling security
    'no-empty': ['error', { allowEmptyCatch: false }],
    'no-ex-assign': 'error',
    
    // Regular expression security
    'no-invalid-regexp': 'error',
    'no-regex-spaces': 'error',
    'prefer-regex-literals': 'error',
    
    // Template security
    'no-template-curly-in-string': 'error',
    'prefer-template': 'error',
    'no-useless-concat': 'error',
    
    // Memory safety
    'no-magic-numbers': ['warn', { 
      ignore: [0, 1, -1], 
      ignoreArrayIndexes: true,
      detectObjects: false 
    }]
  },
  
  overrides: [
    // ES Module files
    {
      files: ['**/*.mjs'],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      env: {
        es2022: true,
        node: true
      }
    },
    
    // CommonJS files
    {
      files: ['**/*.cjs'],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'script'
      },
      env: {
        es2022: true,
        node: true,
        commonjs: true
      }
    },
    
    // Regular JS files
    {
      files: ['**/*.js'],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    
    // Test files - slightly relaxed rules
    {
      files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js', '**/test/**/*.js'],
      env: {
        jest: true,
        mocha: true
      },
      globals: {
        vi: 'readonly',
        vitest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly'
      },
      rules: {
        'no-console': 'off', // Allow console in tests
        'no-magic-numbers': 'off'
      }
    },
    
    // Configuration files
    {
      files: ['**/*config*.js', '**/*config*.cjs', '**/*config*.mjs', '**/.eslintrc*.cjs'],
      rules: {
        // Config files may use dynamic keys and patterns
      }
    },
    
    // Scripts and CLI files
    {
      files: ['**/scripts/**/*.js', '**/cli/**/*.js', '**/bin/**/*.js'],
      rules: {
        // Allow process operations in scripts
        'no-console': 'off' // CLI tools need console output
      }
    },
    
    // Semantic web and RDF files - special handling
    {
      files: ['**/lib/rdf-filters.js', '**/lib/semantic/**/*.js', '**/src/lib/semantic/**/*.js'],
      rules: {
        // SPARQL patterns may require dynamic property access
        'no-prototype-builtins': 'warn' // May need hasOwnProperty checks for RDF data
      }
    }
  ],
  
  globals: {
    // Node.js globals
    global: 'readonly',
    process: 'readonly',
    Buffer: 'readonly',
    __dirname: 'readonly',
    __filename: 'readonly',
    console: 'readonly',
    
    // CommonJS
    require: 'readonly',
    module: 'writable',
    exports: 'writable',
    
    // Testing globals
    describe: 'readonly',
    it: 'readonly',
    test: 'readonly',
    expect: 'readonly',
    beforeEach: 'readonly',
    afterEach: 'readonly',
    beforeAll: 'readonly',
    afterAll: 'readonly'
  },
  
  ignorePatterns: [
    'node_modules/',
    'node_modules.backup/',
    'dist/',
    'build/',
    'coverage/',
    '.output/',
    'test-output/',
    'output/',
    '*.min.js',
    '*.bundle.js',
    '.claude-flow/',
    '.swarm/',
    'examples/**',
    'generated/**',
    'temp/**',
    '*.md',
    '*.json',
    '*.yaml',
    '*.yml'
  ]
};