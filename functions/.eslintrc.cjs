module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  extends: ['eslint:recommended', 'google'],
  rules: {
    'no-restricted-globals': ['error', 'name', 'length'],
    'prefer-arrow-callback': 'error',
    quotes: ['error', 'single', { allowTemplateLiterals: true }],
    semi: ['error', 'never'],
    'object-curly-spacing': ['error', 'always'],
    'quote-props': ['error', 'as-needed'],
    'require-jsdoc': 'off',
    'max-len': 'off',
    indent: 'off',
  },
  overrides: [
    {
      files: ['shared/**/*.js', 'features/**/*.js'],
      rules: {
        // Financial modules use concise descriptive JSDoc. Requiring redundant type tags in
        // this JavaScript-only code makes the domain explanation harder to scan.
        'valid-jsdoc': 'off',
      },
    },
    {
      files: ['**/*.spec.*'],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {},
}
