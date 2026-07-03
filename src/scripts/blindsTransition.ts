import gsap from 'gsap';
import { computeGeometry, type StripGeometry, type Viewport } from './blindsGeometry';

const PER_STRIP = 0.1;      // seconds per strip slide (9 sequential + wave ≈ 1.64s total)
const EXIT_STAGGER = 0.08;  // seconds between strips on the exit wave
const ROOT2 = Math.SQRT2;

let active: gsap.core.Timeline | null = null;
let pendingExit = false;

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

/** Screen x/y translate that places a strip's CENTER at slide-axis position
 *  `pos`. The element starts at top-left (0,0) with size g.length × g.thickness,
 *  so its center is at (g.length/2, g.thickness/2). We translate to put the
 *  center at (pos/√2, pos/√2) — the screen point for slide-axis pos. */
function stripAt(pos: number, g: StripGeometry): { x: number; y: number } {
  return {
    x: pos / ROOT2 - g.length / 2,
    y: pos / ROOT2 - g.thickness / 2,
  };
}

/** Size + position a strip (center at slide-axis `pos`). */
function placeStrip(el: HTMLElement, g: StripGeometry, pos: number): void {
  gsap.set(el, {
    width: g.length,
    height: g.thickness,
    rotation: -45, // long axis → top-right↔bottom-left (⊥ to the TL→BR slide)
    ...stripAt(pos, g),
  });
}

function playEntry(
  strips: HTMLElement[],
  geom: StripGeometry[]
): Promise<void> {
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve });
    geom.forEach((g, i) => {
      placeStrip(strips[i], g, g.enterStart); // park at entry start (offscreen)
      // Sequential: strip i+1 starts after strip i parks.
      tl.to(
        strips[i],
        { ...stripAt(g.restPos, g), duration: PER_STRIP, ease: 'power3.out' }
      );
    });
    active = tl;
  });
}

function playExit(
  strips: HTMLElement[],
  geom: StripGeometry[]
): Promise<void> {
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve });
    geom.forEach((g, i) => {
      // Wave: each strip starts slightly after the previous.
      tl.to(
        strips[i],
        { ...stripAt(g.exitEnd, g), duration: PER_STRIP, ease: 'power3.in' },
        i * EXIT_STAGGER
      );
    });
    active = tl;
  });
}

/**
 * Rainbow blinds route transition. Entry plays inside the VT swap callback
 * (old page visible behind strips via static VT pseudos). The DOM swaps under
 * full cover. Exit plays on astro:page-load AFTER the VT ends, so the new
 * page (live DOM) is visible behind the exiting strips.
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
    const strips = Array.from(
      overlay.querySelectorAll<HTMLElement>('.blinds-strip')
    );
    if (!strips.length) return;

    // Kill any in-flight transition (rapid re-navigation).
    active?.kill();
    active = null;
    pendingExit = false;

    const geom = computeGeometry(viewport());
    const evt = event as unknown as { swap: () => void | Promise<void> };
    const originalSwap = evt.swap;

    evt.swap = async () => {
      overlay.hidden = false;
      overlay.style.visibility = 'visible';
      // 1. Cover (sequential entry) — old page shows behind strips via VT pseudos.
      await playEntry(strips, geom);
      // 2. Swap under full cover.
      await originalSwap();
      // 3. Signal exit to play after the VT ends (astro:page-load).
      pendingExit = true;
    };
  });

  // Exit plays AFTER the VT ends — the live DOM (new page) is visible behind
  // the exiting strips, so the user sees the new page revealed.
  document.addEventListener('astro:page-load', () => {
    if (!pendingExit) return;
    pendingExit = false;

    const overlay = document.getElementById('blinds-overlay');
    if (!overlay || overlay.hidden) return;
    const strips = Array.from(
      overlay.querySelectorAll<HTMLElement>('.blinds-strip')
    );
    if (!strips.length) return;

    const geom = computeGeometry(viewport());
    playExit(strips, geom).then(() => {
      overlay.style.visibility = 'hidden';
      overlay.hidden = true;
      active = null;
    });
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
