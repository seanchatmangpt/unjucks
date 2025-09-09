module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:security/recommended',
    'plugin:node/recommended'
  ],
  plugins: [
    'security',
    'no-secrets',
    'anti-trojan-source'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    // Security rules
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-new-buffer': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-non-literal-require': 'warn',
    'security/detect-object-injection': 'error',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-bidi-characters': 'error',
    
    // No secrets rules
    'no-secrets/no-secrets': ['error', {
      'tolerance': 4.2,
      'ignoreContent': '^EXAMPLE_|^TEST_|^PLACEHOLDER_',
      'ignoreModules': true,
      'ignoreIdentifiers': ['example', 'test', 'placeholder', 'mock']
    }],
    
    // Anti-trojan source
    'anti-trojan-source/no-bidi': 'error',
    
    // Node.js security
    'node/no-deprecated-api': 'error',
    'node/no-extraneous-import': 'off', // Conflicts with monorepo
    'node/no-missing-import': 'off', // Handled by module resolution
    'node/no-unpublished-import': 'off',
    'node/no-unsupported-features/es-syntax': 'off',
    
    // General security best practices
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'strict': ['error', 'global'],
    
    // Prevent dangerous operations
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',
    
    // Input validation
    'no-empty': 'error',
    'no-ex-assign': 'error',
    'no-extra-boolean-cast': 'error',
    'no-invalid-regexp': 'error',
    'no-irregular-whitespace': 'error',
    'no-obj-calls': 'error',
    'no-sparse-arrays': 'error',
    'no-unreachable': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',
    
    // Prevent prototype pollution
    'no-prototype-builtins': 'error',
    
    // Prevent unintended global variables
    'no-undef': 'error',
    'no-unused-vars': ['error', { 
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_' 
    }],
    
    // File system security
    'no-path-concat': 'error'
  },
  overrides: [
    {
      files: ['*.test.js', '*.spec.js', 'test/**/*.js', 'tests/**/*.js'],
      rules: {
        'no-secrets/no-secrets': 'off',
        'security/detect-non-literal-fs-filename': 'off',
        'no-console': 'off'
      }
    },
    {
      files: ['.env.example', '*.example.*'],
      rules: {
        'no-secrets/no-secrets': 'off'
      }
    }
  ],
  settings: {
    'import/resolver': {
      'node': {
        'extensions': ['.js', '.json']
      }
    }
  }
};