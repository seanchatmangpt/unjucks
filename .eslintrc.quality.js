/**
 * ESLint Configuration for Code Quality Validation
 * Enterprise-grade JavaScript linting with comprehensive rules
 */

module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
    commonjs: true,
    worker: true,
    serviceworker: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2023,
    sourceType: 'module',
    allowImportExportEverywhere: true,
    ecmaFeatures: {
      impliedStrict: true,
      jsx: false
    }
  },
  globals: {
    // Node.js globals
    global: 'readonly',
    process: 'readonly',
    Buffer: 'readonly',
    __dirname: 'readonly',
    __filename: 'readonly',
    console: 'readonly',
    
    // Modern JavaScript globals
    fetch: 'readonly',
    performance: 'readonly',
    URL: 'readonly',
    URLSearchParams: 'readonly',
    AbortController: 'readonly',
    AbortSignal: 'readonly',
    TextEncoder: 'readonly',
    TextDecoder: 'readonly',
    FormData: 'readonly',
    Headers: 'readonly',
    Request: 'readonly',
    Response: 'readonly',
    
    // Testing globals
    describe: 'readonly',
    it: 'readonly',
    test: 'readonly',
    expect: 'readonly',
    beforeEach: 'readonly',
    afterEach: 'readonly',
    beforeAll: 'readonly',
    afterAll: 'readonly',
    vi: 'readonly',
    vitest: 'readonly',
    jest: 'readonly',
    
    // CommonJS
    require: 'readonly',
    module: 'writable',
    exports: 'writable'
  },
  
  // Quality-focused rules configuration
  rules: {
    // ===== ERROR LEVEL RULES (MUST FIX) =====
    
    // Security & Safety
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-proto': 'error',
    'no-caller': 'error',
    'no-extend-native': 'error',
    'no-global-assign': 'error',
    'no-implicit-globals': 'error',
    
    // Code Quality
    'no-unused-vars': ['error', { 
      args: 'after-used',
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_',
      caughtErrors: 'all',
      caughtErrorsIgnorePattern: '^_'
    }],
    'no-undef': 'error',
    'no-redeclare': 'error',
    'no-shadow': 'error',
    'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
    
    // Modern JavaScript
    'prefer-const': 'error',
    'no-var': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    'template-curly-spacing': ['error', 'never'],
    'object-shorthand': ['error', 'always'],
    'prefer-destructuring': ['error', { 
      array: false, 
      object: true 
    }, { 
      enforceForRenamedProperties: false 
    }],
    
    // Control Flow
    'no-unreachable': 'error',
    'no-fallthrough': 'error',
    'default-case': 'error',
    'no-case-declarations': 'error',
    'curly': ['error', 'all'],
    'brace-style': ['error', '1tbs', { allowSingleLine: false }],
    
    // ===== WARNING LEVEL RULES (SHOULD FIX) =====
    
    // Complexity & Maintainability
    'complexity': ['warn', { max: 15 }],
    'max-depth': ['warn', { max: 4 }],
    'max-nested-callbacks': ['warn', { max: 3 }],
    'max-params': ['warn', { max: 5 }],
    'max-statements': ['warn', { max: 25 }],
    'max-lines-per-function': ['warn', { 
      max: 100, 
      skipBlankLines: true, 
      skipComments: true 
    }],
    'max-lines': ['warn', { 
      max: 500, 
      skipBlankLines: true, 
      skipComments: true 
    }],
    
    // Code Style & Readability
    'camelcase': ['warn', { 
      properties: 'always',
      ignoreDestructuring: false,
      ignoreImports: false,
      ignoreGlobals: false,
      allow: ['^UNSAFE_', '^unstable_']
    }],
    'consistent-return': 'warn',
    'no-magic-numbers': ['warn', { 
      ignore: [-1, 0, 1, 2],
      ignoreArrayIndexes: true,
      enforceConst: true,
      detectObjects: false
    }],
    'no-nested-ternary': 'warn',
    'no-unneeded-ternary': 'warn',
    'prefer-exponentiation-operator': 'warn',
    
    // Error Handling
    'no-throw-literal': 'warn',
    'prefer-promise-reject-errors': 'warn',
    'no-return-await': 'warn',
    
    // Performance
    'no-loop-func': 'warn',
    'no-await-in-loop': 'warn',
    
    // Documentation
    'spaced-comment': ['warn', 'always', { 
      line: { markers: ['/', '#'] },
      block: { markers: ['*'], balanced: true }
    }],
    'multiline-comment-style': ['warn', 'starred-block'],
    
    // ===== INFO LEVEL RULES (OPTIONAL) =====
    
    'no-console': 'off', // Allow console for CLI tool
    'no-debugger': 'warn',
    'no-alert': 'warn',
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-useless-catch': 'warn',
    'no-useless-escape': 'warn',
    'no-constant-condition': ['warn', { checkLoops: false }],
    'no-prototype-builtins': 'warn',
    
    // Spacing and Formatting (handled by Prettier)
    'indent': 'off',
    'quotes': 'off',
    'semi': 'off',
    'comma-dangle': 'off',
    'object-curly-spacing': 'off',
    'array-bracket-spacing': 'off'
  },
  
  overrides: [
    // Test files - relaxed rules
    {
      files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js', '**/test/**/*.js'],
      env: {
        jest: true,
        vitest: true
      },
      rules: {
        'no-magic-numbers': 'off',
        'max-lines-per-function': 'off',
        'max-statements': 'off',
        'prefer-arrow-callback': 'off',
        'no-unused-expressions': 'off'
      }
    },
    
    // Configuration files - relaxed rules  
    {
      files: ['**/*.config.js', '**/*.config.mjs', '**/config/**/*.js'],
      rules: {
        'no-magic-numbers': 'off',
        'camelcase': 'off'
      }
    },
    
    // CLI and bin files - specific rules
    {
      files: ['**/cli/**/*.js', '**/bin/**/*.js', '**/scripts/**/*.js'],
      rules: {
        'no-process-exit': 'off',
        'no-console': 'off'
      }
    },
    
    // Template files - no linting
    {
      files: ['**/_templates/**/*.js', '**/templates/**/*.js'],
      rules: {
        'no-undef': 'off',
        'no-unused-vars': 'off'
      }
    },
    
    // Generated or external files
    {
      files: ['**/dist/**/*.js', '**/build/**/*.js', '**/node_modules/**/*.js'],
      rules: {}
    }
  ],
  
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '.output/',
    'test-output/',
    'output/',
    '*.min.js',
    '*.bundle.js',
    'docs/book/book/html/**',
    '.claude-flow/',
    '.swarm/',
    'examples/**',
    'my-citty-cli/**',
    'citty-project/**',
    'generated/**',
    'temp/**',
    '*.md',
    '*.json',
    '*.yaml',
    '*.yml'
  ],
  
  settings: {
    // JSDoc validation settings
    jsdoc: {
      preferredTypes: {
        'object': 'Object',
        'array': 'Array',
        'function': 'Function'
      },
      tagNamePreference: {
        'returns': 'return',
        'arg': 'param',
        'argument': 'param'
      }
    }
  }
};