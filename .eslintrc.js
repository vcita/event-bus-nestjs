module.exports = {
  extends: ['@vcita/eslint-config-nestjs'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    'import/no-extraneous-dependencies': 'off',
    'max-len': 'off',
    'func-names': 'off',
  },
};
