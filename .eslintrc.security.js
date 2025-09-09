// ESLint Security Configuration for Fortune 5 Standards
// This configuration focuses on security-related linting rules

module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:security/recommended',
    '@microsoft/eslint-plugin-sdl'
  ],
  plugins: [
    'security',
    'no-unsanitized',
    '@microsoft/sdl'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // ============================================================================
    // CRITICAL SECURITY RULES (Zero Tolerance)
    // ============================================================================
    
    // Prevent hardcoded secrets and credentials
    'security/detect-hardcoded-secrets': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-unsafe-regex': 'error',
    
    // SQL Injection prevention
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-possible-timing-attacks': 'error',
    
    // XSS prevention
    'no-unsanitized/method': 'error',
    'no-unsanitized/property': 'error',
    
    // Microsoft SDL rules
    '@microsoft/sdl/no-insecure-url': 'error',
    '@microsoft/sdl/no-unsafe-innerHTML': 'error',
    '@microsoft/sdl/no-msapp-exec-unsafe': 'error',
    
    // Crypto and hash security
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-insecure-randomness': 'error',
    
    // ============================================================================
    // HIGH SEVERITY SECURITY RULES
    // ============================================================================
    
    // Node.js specific security
    'security/detect-child-process': 'warn',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    
    // Buffer security
    'security/detect-buffer-noassert': 'error',
    'security/detect-new-buffer': 'error',
    
    // Object injection and prototype pollution
    'security/detect-object-injection': 'warn',
    
    // ============================================================================
    // MEDIUM SEVERITY SECURITY RULES
    // ============================================================================
    
    // General security practices
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    
    // Prototype pollution prevention
    'no-proto': 'error',
    'no-extend-native': 'error',
    
    // Type safety
    'eqeqeq': ['error', 'always'],
    'no-eq-null': 'error',
    
    // ============================================================================
    // CUSTOM SECURITY PATTERNS
    // ============================================================================
    
    // Prevent dangerous patterns
    'no-console': 'warn', // Prevent information leakage
    'no-debugger': 'error',
    'no-alert': 'error',
    
    // Variable security
    'no-unused-vars': ['error', { 
      vars: 'all', 
      args: 'after-used',
      ignoreRestSiblings: false 
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
    // CUSTOM RULES FOR FORTUNE 5 COMPLIANCE
    // ============================================================================
    
    // Require strict mode
    'strict': ['error', 'global'],
    
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
    'no-regex-spaces': 'error'
  },
  
  // ============================================================================
  // SECURITY-FOCUSED OVERRIDES
  // ============================================================================
  overrides: [
    {
      // Stricter rules for security-sensitive files
      files: [
        '**/auth/**/*.js',
        '**/security/**/*.js', 
        '**/crypto/**/*.js',
        '**/validation/**/*.js'
      ],
      rules: {
        'security/detect-object-injection': 'error',
        'security/detect-child-process': 'error',
        'no-console': 'error',
        'no-debugger': 'error'
      }
    },
    {
      // Configuration files
      files: ['**/*config*.js', '**/.eslintrc*.js'],
      rules: {
        'security/detect-object-injection': 'off' // Config files may use dynamic keys
      }
    },
    {
      // Test files - slightly relaxed rules
      files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js'],
      rules: {
        'security/detect-non-literal-regexp': 'warn',
        'security/detect-object-injection': 'warn',
        'no-console': 'off' // Allow console in tests
      }
    }
  ],
  
  // ============================================================================
  // SECURITY SETTINGS
  // ============================================================================
  settings: {
    'security': {
      // Configure security plugin settings
      'detect-unsafe-regex': {
        enabled: true
      }
    }
  },
  
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '*.min.js',
    'test_output/',
    '.output/',
    'coverage/',
    // Don't ignore security test files
    '!**/security-tests/**'
  ]
};