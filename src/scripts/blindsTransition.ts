import gsap from 'gsap';
import { computeGeometry, type StripGeometry, type Viewport } from './blindsGeometry';

const PER_STRIP = 0.10;     // seconds per strip slide (9 sequential + wave ≈ 1.64s total)
const EXIT_STAGGER = 0.08;  // seconds between strips on the exit wave
const ROOT2 = Math.SQRT2;

let active: gsap.core.Timeline | null = null;

/** Layout viewport the fixed overlay actually covers. `clientWidth/Height`
 *  excludes any scrollbar gutter, matching a `position: fixed; inset: 0`
 *  overlay. Used for BOTH geometry (computeGeometry) and strip placement so
 *  the two never diverge. */
function viewport(): Viewport {
  return {
    w: document.documentElement.clientWidth,
    h: document.documentElement.clientHeight,
  };
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

/**
 * Rainbow blinds route transition. Takes over Astro's `astro:before-swap`:
 * strips cover the viewport (entry), the DOM swaps under full cover, then the
 * strips cascade out (exit wave). Native View Transitions pseudos are
 * neutralized via CSS so they never render over the overlay.
 */
export function runBlindsTransition(): void {
  const w = window as unknown as { __kogaBlindsBound?: boolean };
  if (w.__kogaBlindsBound) return;
  w.__kogaBlindsBound = true;

  const reduce = (): boolean =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.addEventListener('astro:before-swap', (event) => {
    if (reduce()) return; // let Astro's reduced-motion VT handle it
    if (document.documentElement.classList.contains('intro-active')) return;

    const overlay = document.getElementById('blinds-overlay');
    if (!overlay) return;
    const strips = Array.from(overlay.querySelectorAll<HTMLElement>('.blinds-strip'));
    if (!strips.length) return;

    // Kill any in-flight transition (rapid re-navigation).
    active?.kill();
    active = null;

    const b = viewport();
    const geom = computeGeometry(b);
    const evt = event as unknown as { swap: () => void | Promise<void> };
    const originalSwap = evt.swap;

    evt.swap = async () => {
      overlay.hidden = false;
      overlay.style.visibility = 'visible';
      // 1. Cover (sequential entry).
      await playEntry(strips, geom, b);
      // 2. Swap under full cover (await in case Astro ever makes it async).
      await originalSwap();
      // 3. Wave out.
      await playExit(strips, geom, b);
      overlay.style.visibility = 'hidden';
      overlay.hidden = true;
      active = null;
    };
  });

  // Failsafe: never leave the overlay stuck open.
  document.addEventListener('astro:after-swap', () => {
    const overlay = document.getElementById('blinds-overlay');
    if (!overlay || overlay.hidden) return;
    window.setTimeout(() => {
      if (!overlay.hidden) {
        active?.kill();
        overlay.style.visibility = 'hidden';
        overlay.hidden = true;
      }
    }, 4000);
  });
}
