// ESLint Complexity Configuration for Fortune 5 Standards
// This configuration focuses on complexity and maintainability rules

module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
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
    // CYCLOMATIC COMPLEXITY RULES
    // ============================================================================
    
    // Maximum cyclomatic complexity per function
    'complexity': ['error', {
      max: 10 // Fortune 5 standard: max complexity 10
    }],
    
    // Maximum nested depth
    'max-depth': ['error', {
      max: 4 // Maximum nesting depth of 4
    }],
    
    // Maximum number of statements per function
    'max-statements': ['warn', {
      max: 20, // Maximum 20 statements per function
      ignoreTopLevelFunctions: false
    }],
    
    // Maximum parameters per function
    'max-params': ['error', {
      max: 5 // Maximum 5 parameters per function
    }],
    
    // Maximum lines per function
    'max-lines-per-function': ['warn', {
      max: 50,
      skipBlankLines: true,
      skipComments: true,
      IIFEs: true
    }],
    
    // ============================================================================
    // FILE-LEVEL COMPLEXITY RULES
    // ============================================================================
    
    // Maximum lines per file
    'max-lines': ['warn', {
      max: 500, // Fortune 5 standard: max 500 lines per file
      skipBlankLines: true,
      skipComments: true
    }],
    
    // Maximum number of classes per file
    'max-classes-per-file': ['error', {
      max: 3 // Maximum 3 classes per file
    }],
    
    // ============================================================================
    // COGNITIVE COMPLEXITY RULES
    // ============================================================================
    
    // Control logical expression complexity
    'max-len': ['warn', {
      code: 120, // Maximum line length
      tabWidth: 2,
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true
    }],
    
    // Nested ternary operators
    'no-nested-ternary': 'error',
    
    // Multiple ternary operators
    'no-unneeded-ternary': 'error',
    
    // ============================================================================
    // CONTROL FLOW COMPLEXITY
    // ============================================================================
    
    // Switch statement complexity
    'default-case': 'error',
    'no-fallthrough': 'error',
    
    // Loop complexity
    'no-continue': 'warn', // Prefer early returns
    'no-labels': 'error',
    'no-label-var': 'error',
    
    // Conditional complexity
    'no-else-return': ['error', {
      allowElseIf: false
    }],
    'no-lonely-if': 'error',
    
    // ============================================================================
    // FUNCTION COMPLEXITY RULES
    // ============================================================================
    
    // Function definition complexity
    'func-style': ['error', 'declaration', {
      allowArrowFunctions: true
    }],
    
    // Arrow function complexity
    'arrow-body-style': ['error', 'as-needed'],
    'prefer-arrow-callback': ['error', {
      allowNamedFunctions: false,
      allowUnboundThis: true
    }],
    
    // ============================================================================
    // VARIABLE COMPLEXITY
    // ============================================================================
    
    // Variable declarations
    'one-var': ['error', 'never'],
    'no-multi-assign': 'error',
    
    // Variable naming complexity
    'id-length': ['warn', {
      min: 2,
      max: 50,
      exceptions: ['i', 'j', 'k', '_', 'x', 'y', 'z']
    }],
    
    // ============================================================================
    // ERROR HANDLING COMPLEXITY
    // ============================================================================
    
    // Try-catch complexity
    'no-useless-catch': 'error',
    'prefer-promise-reject-errors': 'error',
    
    // ============================================================================
    // MAINTAINABILITY RULES
    // ============================================================================
    
    // Code duplication prevention
    'no-duplicate-imports': 'error',
    'no-useless-constructor': 'error',
    'no-useless-return': 'error',
    'no-useless-rename': 'error',
    
    // Simplification rules
    'prefer-const': 'error',
    'prefer-template': 'error',
    'prefer-destructuring': ['error', {
      VariableDeclarator: {
        array: false,
        object: true
      },
      AssignmentExpression: {
        array: false,
        object: false
      }
    }],
    
    // ============================================================================
    // PERFORMANCE-RELATED COMPLEXITY
    // ============================================================================
    
    // Regular expression optimization
    'prefer-regex-literals': 'error',
    'no-regex-spaces': 'error',
    
    // Object creation optimization
    'no-new-object': 'error',
    'no-array-constructor': 'error',
    
    // ============================================================================
    // CUSTOM COMPLEXITY PATTERNS
    // ============================================================================
    
    // Reduce nesting through guard clauses
    'curly': ['error', 'all'],
    'brace-style': ['error', '1tbs', { 
      allowSingleLine: false 
    }],
    
    // Consistent return patterns
    'consistent-return': 'error',
    'no-unreachable': 'error',
    
    // Function organization
    'no-inner-declarations': 'error',
    'no-implicit-coercion': 'error'
  },
  
  // ============================================================================
  // COMPLEXITY OVERRIDES BY FILE TYPE
  // ============================================================================
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
    
    // Configuration files - relaxed complexity rules
    {
      files: ['**/*config*.js', '**/*config*.cjs', '**/*config*.mjs', '**/.eslintrc*.cjs', '**/webpack*.js'],
      rules: {
        'max-lines': ['warn', { max: 200 }],
        'complexity': ['warn', { max: 15 }],
        'max-statements': 'off'
      }
    },
    {
      // Test files - slightly relaxed rules
      files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js', '**/test/**/*.js'],
      rules: {
        'max-lines': ['warn', { max: 300 }],
        'max-statements': ['warn', { max: 30 }],
        'complexity': ['warn', { max: 12 }],
        'max-nested-callbacks': ['warn', { max: 5 }]
      }
    },
    {
      // CLI and script files - moderate complexity allowed
      files: ['**/cli/**/*.js', '**/scripts/**/*.js', '**/bin/**/*.js'],
      rules: {
        'max-lines': ['warn', { max: 400 }],
        'complexity': ['warn', { max: 12 }],
        'max-statements': ['warn', { max: 25 }]
      }
    },
    {
      // Core library files - strictest rules
      files: ['**/src/core/**/*.js', '**/src/lib/**/*.js'],
      rules: {
        'complexity': ['error', { max: 8 }],
        'max-depth': ['error', { max: 3 }],
        'max-statements': ['error', { max: 15 }],
        'max-lines-per-function': ['error', { max: 40 }]
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
    expect: 'readonly'
  },
  
  ignorePatterns: [
    'node_modules/',
    'node_modules.backup/',
    'dist/',
    'build/',
    '*.min.js',
    'test_output/',
    '.output/',
    'coverage/',
    'generated/**',
    'temp/**',
    '*.md',
    '*.json',
    '*.yaml',
    '*.yml'
  ]
};