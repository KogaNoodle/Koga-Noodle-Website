import { navigate } from 'astro:transitions/client';
import {
  computeGeometry,
  STRIP_COUNT,
  type StripGeometry,
  type Viewport,
} from './blindsGeometry';

const PER_STRIP = 0.1; // seconds per strip slide
const EXIT_STAGGER = 0.08; // seconds between strips on the exit wave
const ROOT2 = Math.SQRT2;
const ENTRY_DURATION = STRIP_COUNT * PER_STRIP; // 0.9s — entry phase total

type Phase = 'enter' | 'exit' | null;

let blindsActive = false;
let pendingHref: string | null = null;
let phase: Phase = null;
let phaseTimer: number | undefined;

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
 *  animations. All motion is GPU-accelerated CSS keyframes (no GSAP). */
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

function clearPhaseTimer(): void {
  if (phaseTimer !== undefined) {
    window.clearTimeout(phaseTimer);
    phaseTimer = undefined;
  }
}

function hideOverlay(): void {
  const overlay = document.getElementById('blinds-overlay');
  if (overlay) {
    overlay.style.visibility = 'hidden';
    overlay.hidden = true;
    delete overlay.dataset.phase;
  }
  clearPhaseTimer();
  phase = null;
  blindsActive = false;
  pendingHref = null;
}

function startEntry(href: string): void {
  const overlay = document.getElementById('blinds-overlay');
  if (!overlay) {
    navigate(href);
    return;
  }
  const strips = Array.from(
    overlay.querySelectorAll<HTMLElement>('.blinds-strip')
  );
  if (!strips.length) {
    navigate(href);
    return;
  }

  clearPhaseTimer();
  setStripGeometry(strips, computeGeometry(viewport()));
  overlay.style.setProperty('--strip-duration', `${PER_STRIP}s`);
  overlay.hidden = false;
  overlay.style.visibility = 'visible';
  overlay.dataset.phase = 'enter';
  phase = 'enter';
  blindsActive = true;
  pendingHref = href;

  // Navigate after the entry animation completes. navigate() triggers
  // before-swap (skipVT) → instant swap under cover → page-load (startExit).
  phaseTimer = window.setTimeout(() => {
    if (phase !== 'enter') return;
    const h = pendingHref;
    pendingHref = null;
    if (h) {
      navigate(h).catch(() => hideOverlay());
    }
  }, ENTRY_DURATION * 1000);
}

function startExit(): void {
  const overlay = document.getElementById('blinds-overlay');
  if (!overlay) {
    hideOverlay();
    return;
  }
  overlay.dataset.phase = 'exit';
  phase = 'exit';
  const exitTotal = (STRIP_COUNT - 1) * EXIT_STAGGER + PER_STRIP + 0.15;
  phaseTimer = window.setTimeout(() => hideOverlay(), exitTotal * 1000);
}

/**
 * Rainbow blinds route transition (CSS-driven, VT skipped).
 *
 * 1. Intercept internal link clicks (capture phase, before ClientRouter).
 * 2. Play the CSS entry animation on the live DOM (old page visible).
 * 3. On entry complete, call navigate() — Astro fetches + swaps instantly
 *    (the View Transition is skipped so the live DOM stays visible).
 * 4. On astro:page-load (swap done), play the CSS exit animation (new page
 *    visible behind the exiting strips).
 */
export function runBlindsTransition(): void {
  const w = window as unknown as { __kogaBlindsBound?: boolean };
  if (w.__kogaBlindsBound) return;
  w.__kogaBlindsBound = true;

  const reduce = (): boolean =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Intercept internal link clicks — CAPTURE phase so this runs before
  //    ClientRouter's bubble-phase listener. preventDefault() makes
  //    ClientRouter bail (it checks ev.defaultPrevented).
  document.addEventListener(
    'click',
    (ev: MouseEvent) => {
      if (reduce()) return;
      if (document.documentElement.classList.contains('intro-active')) return;
      if (ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey)
        return;

      const target = (ev.composed ? ev.composedPath()[0] : ev.target) as
        | Element
        | null;
      const anchor = target instanceof Element ? target.closest('a') : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search)
        return;

      ev.preventDefault();

      // Entry in progress: just update the destination.
      if (phase === 'enter') {
        pendingHref = anchor.href;
        return;
      }
      // Exit in progress: let it finish (ignore rapid re-click).
      if (phase === 'exit') return;

      startEntry(anchor.href);
    },
    true // CAPTURE
  );

  // 2. Skip the View Transition — instant swap under the blinds cover.
  //    Without this, the VT would hide the live DOM (and the overlay).
  document.addEventListener('astro:before-swap', (event) => {
    if (!blindsActive) return;
    const evt = event as unknown as { viewTransition: ViewTransition };
    try {
      evt.viewTransition.skipTransition();
    } catch {
      // ignore — some browsers may not support skipTransition
    }
  });

  // 3. Start exit after the swap completes (new page is now the live DOM).
  document.addEventListener('astro:page-load', () => {
    if (!blindsActive || phase !== 'enter') return;
    startExit();
  });

  // 4. Failsafe — if page-load didn't fire, force exit on after-swap.
  document.addEventListener('astro:after-swap', () => {
    if (!blindsActive) return;
    if (phase === 'enter') startExit();
  });
}
