import { describe, it, expect } from 'vitest';
import { computeGeometry, STRIP_COUNT } from './blindsGeometry';

const ROOT2 = Math.SQRT2;
const viewports = [
  { name: 'mobile', w: 375, h: 667 },
  { name: 'tablet', w: 768, h: 1024 },
  { name: 'desktop', w: 1920, h: 1080 },
  { name: 'ultrawide', w: 3440, h: 1440 },
];

describe('computeGeometry', () => {
  it.each(viewports)('covers $name with 9 contiguous strips', ({ w, h }) => {
    const g = computeGeometry({ w, h });
    expect(g).toHaveLength(STRIP_COUNT);
    const extent = (w + h) / ROOT2;
    const margin = 48;

    // Perpendicular coverage: band length spans the viewport diagonal projection.
    for (const s of g) {
      expect(s.length).toBeGreaterThanOrEqual(extent);
      expect(s.thickness).toBeGreaterThan(0);
    }

    // Contiguous tiling along the slide axis, covering [-margin, extent+margin].
    expect(g[0].restPos - g[0].thickness / 2).toBeCloseTo(-margin, 5);
    for (let i = 1; i < g.length; i++) {
      expect(g[i].restPos - g[i].thickness / 2).toBeCloseTo(
        g[i - 1].restPos + g[i - 1].thickness / 2,
        5
      );
    }
    const last = g[g.length - 1];
    expect(last.restPos + last.thickness / 2).toBeGreaterThanOrEqual(extent + margin - 1);

    // Entry: every band starts fully offscreen beyond the top-left corner.
    for (const s of g) {
      expect(s.enterStart + s.thickness / 2).toBeLessThanOrEqual(0);
      expect(s.enterStart).toBeLessThan(s.restPos);
    }

    // Exit: every band ends fully offscreen beyond the bottom-right corner.
    for (const s of g) {
      expect(s.exitEnd - s.thickness / 2).toBeGreaterThanOrEqual(extent);
      expect(s.exitEnd).toBeGreaterThan(s.restPos);
    }
  });

  it('honors a custom strip count and margin', () => {
    const g = computeGeometry({ w: 1000, h: 1000 }, { stripCount: 5, margin: 20 });
    expect(g).toHaveLength(5);
    expect(g[0].restPos - g[0].thickness / 2).toBeCloseTo(-20, 5);
  });
});
