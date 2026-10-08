module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
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
      files: ['**/*.spec.*'],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {},
}
