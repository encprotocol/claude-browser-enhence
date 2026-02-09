/**
 * Check if a hex color is light (luminance > 0.5).
 */
export function isLightColor(color: string): boolean {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

/**
 * Darken a hex color by a given amount (0-1).
 */
export function darken(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - 255 * amount);
  const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - 255 * amount);
  const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - 255 * amount);
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

/**
 * Lighten a hex color by a given amount (0-1).
 */
export function lighten(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + 255 * amount);
  const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + 255 * amount);
  const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + 255 * amount);
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

/**
 * WCAG relative luminance of a hex color.
 */
export function relativeLuminance(hex: string): number {
  const c = (h: string) => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * c(hex.slice(1, 3)) +
    0.7152 * c(hex.slice(3, 5)) +
    0.0722 * c(hex.slice(5, 7))
  );
}

/**
 * WCAG contrast ratio between two hex colors.
 */
export function wcagContrast(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Ensure fg has at least minRatio contrast against bg.
 * Blends toward target if needed.
 */
export function ensureContrast(
  fg: string,
  bg: string,
  target: string,
  minRatio: number,
): string {
  if (wcagContrast(fg, bg) >= minRatio) return fg;
  const parse = (h: string): [number, number, number] => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [fr, fg2, fb] = parse(fg);
  const [tr, tg, tb] = parse(target);
  for (let t = 0.05; t <= 1.0; t += 0.05) {
    const r = Math.round(fr + (tr - fr) * t);
    const g = Math.round(fg2 + (tg - fg2) * t);
    const b = Math.round(fb + (tb - fb) * t);
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    if (wcagContrast(hex, bg) >= minRatio) return hex;
  }
  return target;
}
