import { computeGeometry, STRIP_COUNT, type StripGeometry, type Viewport } from './blindsGeometry';

const PER_STRIP = 0.1;      // seconds per strip slide (must match --strip-duration in CSS)
const EXIT_STAGGER = 0.08;  // seconds between strips on the exit wave
const ROOT2 = Math.SQRT2;
const ENTRY_DURATION = STRIP_COUNT * PER_STRIP; // 0.9s — holds the VT old-page pseudo

/** Layout viewport the fixed overlay actually covers. `clientWidth/Height`
 *  excludes any scrollbar gutter, matching a `position: fixed; inset: 0`
 *  overlay. */
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

/** Set CSS custom properties on each strip for the CSS-driven enter/exit
 *  animations. No GSAP — all motion is GPU-accelerated CSS keyframes. */
function setStripGeometry(strips: HTMLElement[], geom: StripGeometry[]): void {
  geom.forEach((g, i) => {
    const enter = stripAt(g.enterStart, g);
    const rest = stripAt(g.restPos, g);
    const exit = stripAt(g.exitEnd, g);
    const s = strips[i].style;
    s.setProperty('--length', `${g.length}px`);
    s.setProperty('--thickness', `${g.thickness}px`);
    s.setProperty('--enter-x', `${enter.x}px`);
    s.setProperty('--enter-y', `${enter.y}px`);
    s.setProperty('--rest-x', `${rest.x}px`);
    s.setProperty('--rest-y', `${rest.y}px`);
    s.setProperty('--exit-x', `${exit.x}px`);
    s.setProperty('--exit-y', `${exit.y}px`);
    s.setProperty('--enter-delay', `${i * PER_STRIP}s`);
    s.setProperty('--exit-delay', `${i * EXIT_STAGGER}s`);
  });
}

let exitTimeout: number | undefined;

function hideOverlay(overlay: HTMLElement): void {
  overlay.style.visibility = 'hidden';
  overlay.hidden = true;
  delete overlay.dataset.phase;
  if (exitTimeout !== undefined) {
    window.clearTimeout(exitTimeout);
    exitTimeout = undefined;
  }
}

/**
 * Rainbow blinds route transition (CSS-driven). Entry plays during the VT
 * (old page held visible behind strips via static VT pseudos). The DOM swaps
 * normally — we do NOT defer event.swap. Exit plays on astro:page-load AFTER
 * the VT ends, so the new page (live DOM) is visible behind the exiting strips.
 */
export function runBlindsTransition(): void {
  const w = window as unknown as { __kogaBlindsBound?: boolean };
  if (w.__kogaBlindsBound) return;
  w.__kogaBlindsBound = true;

  // Set the VT hold duration so the old-page pseudo stays visible for the
  // entire entry phase. Read by transitions.css (::view-transition-old).
  document.documentElement.style.setProperty(
    '--blinds-vt-duration',
    `${ENTRY_DURATION}s`
  );

  const reduce = (): boolean =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. START ENTRY — strips slide in sequentially, covering the old page.
  //    The VT old-page pseudo is held visible (static) behind the strips.
  //    We don't touch event.swap — Astro swaps whenever it wants.
  document.addEventListener('astro:before-swap', () => {
    if (reduce()) return;
    if (document.documentElement.classList.contains('intro-active')) return;

    const overlay = document.getElementById('blinds-overlay');
    if (!overlay) return;
    const strips = Array.from(
      overlay.querySelectorAll<HTMLElement>('.blinds-strip')
    );
    if (!strips.length) return;

    if (exitTimeout !== undefined) {
      window.clearTimeout(exitTimeout);
      exitTimeout = undefined;
    }

    const geom = computeGeometry(viewport());
    setStripGeometry(strips, geom);
    overlay.style.setProperty('--strip-duration', `${PER_STRIP}s`);

    overlay.hidden = false;
    overlay.style.visibility = 'visible';
    overlay.dataset.phase = 'enter';
  });

  // 2. START EXIT — after the VT ends, the new page (live DOM) is visible.
  //    Strips cascade out in a wave, revealing the new page.
  document.addEventListener('astro:page-load', () => {
    const overlay = document.getElementById('blinds-overlay');
    if (!overlay || overlay.hidden || overlay.dataset.phase !== 'enter') return;

    const lastStrip =
      overlay.querySelector<HTMLElement>('.blinds-strip:last-child');

    const onEnd = (e: AnimationEvent): void => {
      if (e.animationName !== 'blinds-exit') return;
      lastStrip?.removeEventListener('animationend', onEnd);
      hideOverlay(overlay);
    };
    lastStrip?.addEventListener('animationend', onEnd);

    overlay.dataset.phase = 'exit';

    // Failsafe in case animationend doesn't fire.
    const exitTotal = (STRIP_COUNT - 1) * EXIT_STAGGER + PER_STRIP + 0.2;
    exitTimeout = window.setTimeout(() => {
      lastStrip?.removeEventListener('animationend', onEnd);
      hideOverlay(overlay);
    }, exitTotal * 1000);
  });

  // 3. FAILSAFE — never leave the overlay stuck open.
  document.addEventListener('astro:after-swap', () => {
    const overlay = document.getElementById('blinds-overlay');
    if (!overlay || overlay.hidden) return;
    exitTimeout = window.setTimeout(() => {
      if (!overlay.hidden) hideOverlay(overlay);
    }, 4000);
  });
}
