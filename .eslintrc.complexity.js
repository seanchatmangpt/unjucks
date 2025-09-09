// ESLint Complexity Configuration for Fortune 5 Standards
// This configuration focuses on complexity and maintainability rules

module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended'
  ],
  plugins: [
    'complexity'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
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
    'default-case-last': 'error',
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
    
    // Callback complexity
    'callback-return': 'warn',
    'no-callback-literal': 'error',
    
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
    'one-var-declaration-per-line': ['error', 'always'],
    'no-multi-assign': 'error',
    
    // Variable naming complexity
    'id-length': ['warn', {
      min: 2,
      max: 50,
      exceptions: ['i', 'j', 'k', '_', 'x', 'y', 'z']
    }],
    
    // ============================================================================
    // OBJECT AND ARRAY COMPLEXITY
    // ============================================================================
    
    // Object property complexity
    'object-property-newline': ['error', {
      allowAllPropertiesOnSameLine: false
    }],
    'object-curly-newline': ['error', {
      ObjectExpression: { 
        multiline: true, 
        minProperties: 3,
        consistent: true 
      },
      ObjectPattern: { 
        multiline: true, 
        minProperties: 3,
        consistent: true 
      }
    }],
    
    // Array complexity
    'array-element-newline': ['error', {
      ArrayExpression: { minItems: 4 },
      ArrayPattern: { minItems: 4 }
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
    {
      // Configuration files - relaxed complexity rules
      files: ['**/*config*.js', '**/.eslintrc*.js', '**/webpack*.js'],
      rules: {
        'max-lines': ['warn', { max: 200 }],
        'complexity': ['warn', { max: 15 }],
        'max-statements': 'off',
        'object-property-newline': 'off'
      }
    },
    {
      // Test files - slightly relaxed rules
      files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js'],
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
  
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '*.min.js',
    'test_output/',
    '.output/',
    'coverage/'
  ]
};