import type { WallpaperPropertyListener, WallpaperUserProperties } from '../src/index';
import { expect, expectTypeOf, it } from 'vitest';

it('accepts native layout descriptors and guards missing runtime values', () => {
  const properties = {
    enabled: { value: true },
    separator: { type: 'divider', order: 102 },
    layout: { type: 'group', text: 'Layout', value: '', index: 3, order: 130 },
  } satisfies WallpaperUserProperties;
  const delivered: unknown[] = [];
  const listener: WallpaperPropertyListener = {
    applyUserProperties(values) {
      for (const property of Object.values(values)) {
        if (property && 'value' in property)
          delivered.push(property.value);
      }
    },
  };
  listener.applyUserProperties?.(properties);
  expect(delivered).toEqual([true, '']);

  function checkRawAccess(values: WallpaperUserProperties): void {
    const property = values.separator;
    if (property) {
      // @ts-expect-error Native dividers are descriptors without a value.
      void property.value;
      if ('value' in property)
        expectTypeOf(property.value).toEqualTypeOf<string | number | boolean>();
    }
  }
  void checkRawAccess;
});
