/** Convert WE's `"R G B"` (0–1 floats) to `#rrggbb`. */
export function weColorToHex(s: string): string {
  const parts = s.split(" ");
  const ch = (i: number): string => {
    const v = Math.max(
      0,
      Math.min(255, Math.ceil(Number.parseFloat(parts[i] ?? "0") * 255)),
    );
    return v.toString(16).padStart(2, "0");
  };
  return "#" + ch(0) + ch(1) + ch(2);
}

/** Convert `#rrggbb` to WE's `"R G B"` (0–1 floats). */
export function hexToWeColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "0 0 0";
  const n = Number.parseInt(m[1] as string, 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const f = (x: number): string => (Math.round(x * 1000) / 1000).toString();
  return `${f(r)} ${f(g)} ${f(b)}`;
}
