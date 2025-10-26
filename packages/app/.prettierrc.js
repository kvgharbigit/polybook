module.exports = {
  // Basic formatting
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
  tabWidth: 2,
  useTabs: false,
  
  // React/JSX specific
  jsxSingleQuote: false,
  jsxBracketSameLine: false,
  
  // Line length and wrapping
  printWidth: 100,
  
  // Other formatting options
  bracketSpacing: true,
  arrowParens: 'avoid',
  endOfLine: 'lf',
  
  // File-specific overrides
  overrides: [
    {
      files: '*.{ts,tsx}',
      options: {
        parser: 'typescript',
      },
    },
    {
      files: '*.{js,jsx}',
      options: {
        parser: 'babel',
      },
    },
    {
      files: '*.json',
      options: {
        parser: 'json',
        tabWidth: 2,
      },
    },
  ],
};