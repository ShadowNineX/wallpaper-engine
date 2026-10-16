import { describe, expect, it, vi } from 'vitest';
import { isConditionVisible } from '../src/conditions';

describe('property display conditions', () => {
  it('evaluates documented boolean and combo comparisons with precedence', () => {
    const values = {
      showclock: { value: true },
      backgroundsource: { value: 'image' },
      quality: { value: 3 },
    };

    expect(isConditionVisible('showclock.value == true', values)).toBe(true);
    expect(isConditionVisible('backgroundsource.value == \'image\'', values)).toBe(true);
    expect(isConditionVisible('backgroundsource.value === \'video\' || quality.value >= 3 && !false', values)).toBe(true);
    expect(isConditionVisible('backgroundsource.value !== \'image\'', values)).toBe(false);
  });

  it('supports parenthesized numeric comparisons and strict equality', () => {
    const values = { speed: { value: 2 }, text: { value: '2' } };

    expect(isConditionVisible('(speed.value > 1 && speed.value <= 2)', values)).toBe(true);
    expect(isConditionVisible('speed.value === text.value', values)).toBe(false);
    expect(isConditionVisible('speed.value == text.value', values)).toBe(true);
  });

  it('leaves malformed and missing-reference conditions visible while warning once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const values = { enabled: { value: true } };

    expect(isConditionVisible('enabled.value &&', values)).toBe(true);
    expect(isConditionVisible('enabled.value &&', values)).toBe(true);
    expect(isConditionVisible('missing.value == true', values)).toBe(true);
    expect(isConditionVisible('missing.value == true', values)).toBe(true);

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenNthCalledWith(
      1,
      '[WE Dev] Unable to evaluate property display condition; leaving it visible.',
      expect.objectContaining({ condition: 'enabled.value &&' }),
    );
  });
});
