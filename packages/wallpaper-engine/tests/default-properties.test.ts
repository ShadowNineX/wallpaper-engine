import type { DefaultWEPropertyDefinitions } from '../src/index';
import { expect, expectTypeOf, it } from 'vitest';
import { DefaultWEProps } from '../src/helpers';
import nativeWebProperties from './fixtures/native-web-properties.json';

it('matches the native audio recording property metadata', () => {
  expect(DefaultWEProps.audioprocessing).toEqual({
    type: 'bool',
    order: -21,
    text: 'ui_browse_properties_audio_recording',
    icon: 'fa-microphone',
    value: true,
  });
});

it('exports complete native default definitions including Font Awesome icons and the divider', () => {
  expect(DefaultWEProps).toEqual(nativeWebProperties.properties);
});

it('exports built-in property defaults for browser initialization', () => {
  expectTypeOf(DefaultWEProps).toEqualTypeOf<Required<DefaultWEPropertyDefinitions>>();
  expect(Object.fromEntries(
    Object.entries(DefaultWEProps).flatMap(([key, definition]) => 'value' in definition ? [[key, definition.value]] : []),
  )).toEqual({
    audioprocessing: true,
    schemecolor: '0.5 0.5 0.5',
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

it('keeps the native default divider value-free', () => {
  expect(DefaultWEProps._d0).toEqual({ type: 'divider', order: 0 });
  expect(DefaultWEProps._d0).not.toHaveProperty('value');
  expectTypeOf(DefaultWEProps._d0).toEqualTypeOf<DefaultWEPropertyDefinitions['_d0']>();
});
