module.exports = {
  root: true,
  extends: [
    '@react-native/eslint-config',
  ],
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'react',
    'react-native',
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  env: {
    'react-native/react-native': true,
    es6: true,
    node: true,
    jest: true,
  },
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    
    // React specific rules
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
    'react/prop-types': 'off', // Using TypeScript instead
    
    // React Native specific rules
    'react-native/no-unused-styles': 'warn',
    'react-native/no-inline-styles': 'warn',
    'react-native/no-color-literals': 'off',
    'react-native/no-raw-text': 'off',
    
    // General code quality rules
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'off', // Allow console logs for debugging
    'no-debugger': 'warn',
    'no-unused-expressions': 'error',
    'no-unreachable': 'error',
    
    // Styling and formatting
    'semi': ['error', 'always'],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'comma-dangle': ['error', 'always-multiline'],
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.expo/',
    'metro.config.js',
    'babel.config.js',
    '*.config.js',
  ],
};