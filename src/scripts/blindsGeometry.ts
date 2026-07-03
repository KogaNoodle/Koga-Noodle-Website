export interface StripGeometry {
  length: number;     // px, long axis incl. overhang (perpendicular coverage)
  thickness: number;  // px, short axis
  restPos: number;    // px along 45° slide axis, band CENTER at rest
  enterStart: number; // px, band CENTER at entry start (offscreen, top-left)
  exitEnd: number;    // px, band CENTER at exit end (offscreen, bottom-right)
}

export interface Viewport {
  w: number;
  h: number;
}

export const STRIP_COUNT = 9;
const ROOT2 = Math.SQRT2;

export function computeGeometry(
  vp: Viewport,
  opts: { stripCount?: number; margin?: number } = {}
): StripGeometry[] {
  const n = opts.stripCount ?? STRIP_COUNT;
  const margin = opts.margin ?? 48;
  const extent = (vp.w + vp.h) / ROOT2; // viewport span along the 45° slide axis
  const span = extent + 2 * margin;     // total slide span incl. overhang
  const thickness = span / n;
  // Long axis must reach the farthest corner from the strip's center (v=0).
  // The farthest corner's perpendicular distance is max(w,h)/√2, so length
  // must be ≥ max(w,h)*√2. Using that + overhang guarantees full coverage
  // on any aspect ratio (the old (w+h)/√2+margin left corners uncovered on
  // wide/tall viewports).
  const length = Math.max(vp.w, vp.h) * ROOT2 + 2 * margin;
  const travel = extent + margin + thickness; // uniform offscreen travel (clears both ends)

  const out: StripGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const restPos = -margin + thickness / 2 + i * thickness;
    out.push({
      length,
      thickness,
      restPos,
      enterStart: restPos - travel,
      exitEnd: restPos + travel,
    });
  }
  return out;
}
