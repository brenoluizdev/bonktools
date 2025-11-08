module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  plugins: [
    '@typescript-eslint'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking'
  ],
  env: {
    node: true,
    es2020: true
  },
  rules: {
    // ============================================================================
    // TYPESCRIPT RULES
    // ============================================================================
    
    // Require explicit return types on functions
    '@typescript-eslint/explicit-function-return-type': ['warn', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
      allowHigherOrderFunctions: true
    }],
    
    // Require explicit accessibility modifiers
    '@typescript-eslint/explicit-member-accessibility': ['error', {
      accessibility: 'explicit',
      overrides: {
        constructors: 'no-public'
      }
    }],
    
    // Enforce naming conventions
    '@typescript-eslint/naming-convention': [
      'error',
      // Classes, interfaces, type aliases: PascalCase
      {
        selector: 'typeLike',
        format: ['PascalCase']
      },
      // Variables and functions: camelCase
      {
        selector: ['variable', 'function'],
        format: ['camelCase'],
        leadingUnderscore: 'allow'
      },
      // Constants: UPPER_SNAKE_CASE or camelCase
      {
        selector: 'variable',
        modifiers: ['const'],
        format: ['camelCase', 'UPPER_CASE']
      },
      // Private members: _camelCase
      {
        selector: 'memberLike',
        modifiers: ['private'],
        format: ['camelCase'],
        leadingUnderscore: 'require'
      },
      // Enum members: PascalCase
      {
        selector: 'enumMember',
        format: ['PascalCase', 'UPPER_CASE']
      }
    ],
    
    // Prefer nullish coalescing
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    
    // Prefer optional chaining
    '@typescript-eslint/prefer-optional-chain': 'warn',
    
    // Require consistent type imports
    '@typescript-eslint/consistent-type-imports': ['warn', {
      prefer: 'type-imports',
      disallowTypeAnnotations: false
    }],
    
    // No explicit any (warn instead of error for flexibility)
    '@typescript-eslint/no-explicit-any': 'warn',
    
    // No unused vars (ignore vars starting with _)
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }],
    
    // Allow empty functions (useful for stubs)
    '@typescript-eslint/no-empty-function': 'off',
    
    // Require await in async functions
    '@typescript-eslint/require-await': 'warn',
    
    // No floating promises
    '@typescript-eslint/no-floating-promises': 'error',
    
    // No misused promises
    '@typescript-eslint/no-misused-promises': 'error',
    
    // ============================================================================
    // GENERAL RULES
    // ============================================================================
    
    // Require semicolons
    'semi': ['error', 'always'],
    
    // Enforce single quotes
    'quotes': ['error', 'single', { avoidEscape: true }],
    
    // Require const for variables that are never reassigned
    'prefer-const': 'error',
    
    // No var, use let or const
    'no-var': 'error',
    
    // Require === and !==
    'eqeqeq': ['error', 'always'],
    
    // No console (warn instead of error)
    'no-console': 'off', // We use logger instead
    
    // Curly braces for all control statements
    'curly': ['error', 'all'],
    
    // Consistent brace style
    'brace-style': ['error', '1tbs'],
    
    // Consistent indentation (2 spaces)
    'indent': ['error', 2, { SwitchCase: 1 }],
    
    // Max line length (soft limit)
    'max-len': ['warn', {
      code: 100,
      ignoreComments: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true
    }],
    
    // Require trailing commas in multiline
    'comma-dangle': ['error', {
      arrays: 'never',
      objects: 'never',
      imports: 'never',
      exports: 'never',
      functions: 'never'
    }],
    
    // No multiple empty lines
    'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
    
    // Require newline at end of file
    'eol-last': ['error', 'always'],
    
    // No trailing spaces
    'no-trailing-spaces': 'error',
    
    // Object curly spacing
    'object-curly-spacing': ['error', 'always'],
    
    // Array bracket spacing
    'array-bracket-spacing': ['error', 'never'],
    
    // Arrow function spacing
    'arrow-spacing': 'error',
    
    // Keyword spacing
    'keyword-spacing': 'error',
    
    // Space before blocks
    'space-before-blocks': 'error',
    
    // No multi spaces
    'no-multi-spaces': 'error',
    
    // Prefer template literals
    'prefer-template': 'warn',
    
    // Prefer arrow callbacks
    'prefer-arrow-callback': 'warn',
    
    // No useless constructor
    'no-useless-constructor': 'off', // Handled by TypeScript
    '@typescript-eslint/no-useless-constructor': 'error'
  },
  
  overrides: [
    // Test files
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      env: {
        jest: true
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off'
      }
    },
    
    // Example files
    {
      files: ['examples/**/*.ts'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-floating-promises': 'off'
      }
    },
    
    // Config files
    {
      files: ['*.config.js', '*.config.ts'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off'
      }
    }
  ]
};