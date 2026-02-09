import { describe, it, expect } from 'vitest';
import { isLightColor, darken, lighten, wcagContrast, ensureContrast } from '@/lib/colorUtils';

describe('isLightColor', () => {
  it('detects white as light', () => {
    expect(isLightColor('#ffffff')).toBe(true);
  });

  it('detects black as dark', () => {
    expect(isLightColor('#000000')).toBe(false);
  });

  it('detects typical dark theme background as dark', () => {
    expect(isLightColor('#1a1a2e')).toBe(false);
  });

  it('detects typical light theme background as light', () => {
    expect(isLightColor('#fafafa')).toBe(true);
  });
});

describe('darken', () => {
  it('darkens white by 50%', () => {
    const result = darken('#ffffff', 0.5);
    // Should be roughly #808080
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
    const r = parseInt(result.slice(1, 3), 16);
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(140);
  });

  it('does not go below zero', () => {
    const result = darken('#000000', 0.5);
    expect(result).toBe('#000000');
  });
});

describe('lighten', () => {
  it('lightens black by 50%', () => {
    const result = lighten('#000000', 0.5);
    const r = parseInt(result.slice(1, 3), 16);
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(140);
  });

  it('does not exceed 255', () => {
    const result = lighten('#ffffff', 0.5);
    expect(result).toBe('#ffffff');
  });
});

describe('wcagContrast', () => {
  it('white on black is ~21', () => {
    const ratio = wcagContrast('#ffffff', '#000000');
    expect(ratio).toBeGreaterThan(20);
    expect(ratio).toBeLessThan(22);
  });

  it('same color is 1', () => {
    const ratio = wcagContrast('#888888', '#888888');
    expect(ratio).toBeCloseTo(1, 1);
  });
});

describe('ensureContrast', () => {
  it('returns fg if contrast is already sufficient', () => {
    const result = ensureContrast('#ffffff', '#000000', '#ffffff', 3.0);
    expect(result).toBe('#ffffff');
  });

  it('blends toward target if contrast is insufficient', () => {
    // Gray on gray - low contrast
    const result = ensureContrast('#888888', '#777777', '#ffffff', 3.0);
    // Should be lighter than the original
    const r = parseInt(result.slice(1, 3), 16);
    expect(r).toBeGreaterThan(parseInt('88', 16));
  });
});
