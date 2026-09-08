import type { WallpaperPropertyListener, WallpaperPropertyRuntimeValue } from '../src/index';
import { expect, expectTypeOf, it } from 'vitest';

it('keeps arbitrary callback keys optional in the public type itself', () => {
  type Update = Parameters<NonNullable<WallpaperPropertyListener['applyUserProperties']>>[0];

  // Indexed-access types do not depend on noUncheckedIndexedAccess. A plain
  // Record would fail this assertion even when that compiler flag is enabled.
  expectTypeOf<Update[string]>().toEqualTypeOf<WallpaperPropertyRuntimeValue | undefined>();

  let enabled = true;
  const listener: WallpaperPropertyListener = {
    applyUserProperties(properties) {
      if (properties.enabled) {
        expectTypeOf(properties.enabled).toEqualTypeOf<WallpaperPropertyRuntimeValue>();
        enabled = Boolean(properties.enabled.value);
      }
    },
  };

  listener.applyUserProperties?.({});
  expect(enabled).toBe(true);
  listener.applyUserProperties?.({ enabled: { value: false } });
  expect(enabled).toBe(false);
});
