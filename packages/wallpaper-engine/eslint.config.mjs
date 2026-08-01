import antfu from '@antfu/eslint-config';

export default antfu(
  {
    type: 'lib',
    typescript: true,
    vue: false,
    stylistic: {
      quotes: 'single',
      semi: true,
    },
  },
  {
    files: ['src/image-color.ts', 'src/types/window.ts'],
    rules: {
      'ts/method-signature-style': 'off',
      'vars-on-top': 'off',
    },
  },
);
