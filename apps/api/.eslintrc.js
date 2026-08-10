module.exports = {
  ...require('../../packages/eslint-config/base.js'),
  parserOptions: {
    project: './tsconfig.json',
    sourceType: 'module',
  },
};
