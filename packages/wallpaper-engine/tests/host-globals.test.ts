import type { WallpaperCuePlugin, WallpaperLedPlugin } from '../src/index';
import { expectTypeOf, it } from 'vitest';

it('requires guards before using optional hardware plugin globals', () => {
  type Plugins = { led?: WallpaperLedPlugin } | undefined;
  expectTypeOf<Window['wpPlugins']>().toEqualTypeOf<Plugins>();
  expectTypeOf<typeof globalThis.wpPlugins>().toEqualTypeOf<Plugins>();
  expectTypeOf<Window['cue']>().toEqualTypeOf<WallpaperCuePlugin | undefined>();
  expectTypeOf<typeof globalThis.cue>().toEqualTypeOf<WallpaperCuePlugin | undefined>();

  function checkGuardedAccess(host: Window): void {
    const led = host.wpPlugins?.led;
    if (led)
      led.setAllDevicesByImageData('', 0, 0);
    const cue = host.cue;
    if (cue)
      cue.getDeviceCount(count => count.toFixed());

    // @ts-expect-error Plugin presence must be checked even inside a load callback.
    host.wpPlugins.led.setAllDevicesByImageData('', 0, 0);
    // @ts-expect-error The host may not have loaded the iCUE plugin.
    host.cue.getDeviceCount(() => {});
  }
  void checkGuardedAccess;
});
