import antfu from '@antfu/eslint-config';

export default antfu({
  type: 'app',
  typescript: true,
  vue: true,
  stylistic: {
    quotes: 'single',
    semi: true,
  },
});
