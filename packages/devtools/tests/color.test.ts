import { describe, expect, it } from "vitest";
import { hexToWeColor, weColorToHex } from "../src/color";

describe("Wallpaper Engine color conversion", () => {
  it.each([
    ["0 0 0", "#000000"],
    ["1 1 1", "#ffffff"],
    ["1 0.5 0", "#ff8000"],
    ["-1 2 0.1", "#00ff1a"],
    ["invalid", "#000000"],
  ])("converts %s to %s", (input, expected) => {
    expect(weColorToHex(input)).toBe(expected);
  });

  it.each([
    ["#000000", "0 0 0"],
    ["ffffff", "1 1 1"],
    ["#ff8000", "1 0.502 0"],
    ["not-a-color", "0 0 0"],
  ])("converts %s to Wallpaper Engine channels", (input, expected) => {
    expect(hexToWeColor(input)).toBe(expected);
  });

  it("round-trips byte colors without changing the rendered color", () => {
    const original = "#5b86ed";
    expect(weColorToHex(hexToWeColor(original))).toBe(original);
  });
});
