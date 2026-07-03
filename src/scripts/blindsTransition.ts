import gsap from 'gsap';
import { computeGeometry, type StripGeometry, type Viewport } from './blindsGeometry';

const PER_STRIP = 0.42;     // seconds per strip slide
const EXIT_STAGGER = 0.08;  // seconds between strips on the exit wave
const ROOT2 = Math.SQRT2;

let active: gsap.core.Timeline | null = null;

function viewport(): Viewport {
  return { w: window.innerWidth, h: window.innerHeight };
}

/** Layout viewport the fixed overlay actually covers (excludes the scrollbar
 *  gutter on the width axis; innerHeight has no horizontal scrollbar). */
function base(): { w: number; h: number } {
  return { w: document.documentElement.clientWidth, h: window.innerHeight };
}

/** Screen x/y delta (from overlay-center) that places a strip's CENTER at the
 *  given slide-axis position. Slide axis = TL→BR, so a position `pos` maps to
 *  screen (pos/√2, pos/√2); overlay-center is at screen (w/2, h/2). */
function posToXY(pos: number, b: { w: number; h: number }): { x: number; y: number } {
  return { x: pos / ROOT2 - b.w / 2, y: pos / ROOT2 - b.h / 2 };
}

/** Size + position a strip (center at slide-axis `pos`). */
function placeStrip(
  el: HTMLElement,
  g: StripGeometry,
  pos: number,
  b: { w: number; h: number }
): void {
  const { x, y } = posToXY(pos, b);
  gsap.set(el, {
    scaleX: g.length / b.w,
    scaleY: g.thickness / b.h,
    rotation: -45, // long axis → top-right↔bottom-left (⊥ to the TL→BR slide)
    xPercent: -50,
    yPercent: -50,
    x,
    y,
  });
}

function playEntry(
  strips: HTMLElement[],
  geom: StripGeometry[],
  b: { w: number; h: number }
): Promise<void> {
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve });
    geom.forEach((g, i) => {
      placeStrip(strips[i], g, g.enterStart, b); // park at entry start (offscreen)
      const { x, y } = posToXY(g.restPos, b);
      // Sequential: strip i+1 starts after strip i parks.
      tl.to(strips[i], { x, y, duration: PER_STRIP, ease: 'power3.out' });
    });
    active = tl;
  });
}

function playExit(
  strips: HTMLElement[],
  geom: StripGeometry[],
  b: { w: number; h: number }
): Promise<void> {
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve });
    geom.forEach((g, i) => {
      const { x, y } = posToXY(g.exitEnd, b);
      // Wave: each strip starts slightly after the previous.
      tl.to(strips[i], { x, y, duration: PER_STRIP, ease: 'power3.in' }, i * EXIT_STAGGER);
    });
    active = tl;
  });
}

export async function runBlindsCycle(overlay: HTMLElement): Promise<void> {
  const strips = Array.from(overlay.querySelectorAll<HTMLElement>('.blinds-strip'));
  const geom = computeGeometry(viewport());
  const b = base();
  overlay.hidden = false;
  overlay.style.visibility = 'visible';
  await playEntry(strips, geom, b);
  await playExit(strips, geom, b);
  overlay.style.visibility = 'hidden';
  overlay.hidden = true;
  active = null;
}

// DEBUG HOOK (temporary, replaced in Task 5): trigger from devtools console via
// window.__kogaBlindsDebug() to validate the visual before wiring the swap.
export function runBlindsTransition(): void {
  (window as unknown as { __kogaBlindsDebug?: () => void }).__kogaBlindsDebug = () => {
    const overlay = document.getElementById('blinds-overlay');
    if (overlay) void runBlindsCycle(overlay);
  };
}
