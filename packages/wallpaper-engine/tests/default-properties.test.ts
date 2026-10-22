import type { DefaultWEProps as DefaultWEPropertyDefinitions } from '../src/index';
import { expect, expectTypeOf, it } from 'vitest';
import { DefaultWEProps } from '../src/helpers';

it('exports built-in property defaults for browser initialization', () => {
  expectTypeOf(DefaultWEProps).toEqualTypeOf<Required<DefaultWEPropertyDefinitions>>();
  expect(Object.fromEntries(
    Object.entries(DefaultWEProps).map(([key, definition]) => [key, definition.value]),
  )).toEqual({
    audioprocessing: true,
    schemecolor: '0 0 0',
    alignmentfliph: false,
    wec_e: false,
    wec_brs: 50,
    wec_con: 50,
    wec_sa: 50,
    wec_hue: 50,
  });
  for (const key of ['wec_brs', 'wec_con', 'wec_sa', 'wec_hue'] as const) {
    expect(DefaultWEProps[key]).toMatchObject({
      type: 'slider',
      min: 0,
      max: 100,
      condition: 'wec_e.value',
    });
  }
});
