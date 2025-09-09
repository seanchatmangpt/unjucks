module.exports = {
  extends: [
    'eslint:recommended',
    '@eslint/js',
    'plugin:security/recommended',
    'plugin:security-node/recommended'
  ],
  plugins: [
    'security',
    'security-node',
    'no-unsafe-innerhtml',
    'xss'
  ],
  env: {
    node: true,
    es2022: true
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    // Security-focused rules
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-new-buffer': 'error',
    'security/detect-child-process': 'error',
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-unsafe-regex': 'error',
    
    // Node.js security rules
    'security-node/detect-crlf': 'error',
    'security-node/detect-dangerous-redirects': 'error',
    'security-node/detect-insecure-randomness': 'error',
    'security-node/detect-security-md5': 'error',
    'security-node/detect-security-sha1': 'error',
    'security-node/detect-unhandled-async-errors': 'error',
    'security-node/detect-unhandled-event-errors': 'error',
    
    // XSS prevention
    'xss/no-mixed-html': 'error',
    'xss/no-location-href-assign': 'error',
    
    // Additional security rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-caller': 'error',
    'no-extend-native': 'error',
    'no-proto': 'error',
    'no-iterator': 'error',
    'no-restricted-globals': ['error',
      {
        name: 'eval',
        message: 'eval() is dangerous and should not be used.'
      },
      {
        name: 'Function',
        message: 'Function constructor can be used like eval().'
      }
    ],
    'no-restricted-syntax': [
      'error',
      {
        selector: 'CallExpression[callee.name="require"][arguments.0.type="TemplateLiteral"]',
        message: 'Dynamic require() with template literals can be dangerous.'
      },
      {
        selector: 'CallExpression[callee.property.name="exec"]',
        message: 'Direct use of exec() can be dangerous. Consider using execFile() or spawn().'
      }
    ]
  },
  overrides: [
    {
      files: ['tests/**/*.js', 'tests/**/*.ts'],
      rules: {
        'security/detect-non-literal-fs-filename': 'off',
        'security/detect-object-injection': 'off'
      }
    },
    {
      files: ['src/**/*.ts', 'src/**/*.js'],
      rules: {
        'security/detect-object-injection': 'error',
        'security/detect-non-literal-require': 'error'
      }
    }
  ]
};