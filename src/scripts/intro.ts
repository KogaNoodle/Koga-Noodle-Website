import gsap from 'gsap';

/**
 * Intro splash animation (CSS + GSAP, no video).
 *
 * Concept: the logo starts tiny and transparent, elastically zooms in —
 * extrapolating past its final size and bouncing back to settle — then flips
 * a full turn, forcing the background pattern into view as a radial ripple
 * from the logo center. After a hold, a 3D zoom-through exit reveals the
 * landing page. Plays on every full page load.
 */
export function runIntro(): void {
  const overlay = document.getElementById('intro-overlay');
  if (!overlay) return;

  if (!document.documentElement.classList.contains('intro-active')) {
    return;
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    finishIntro(overlay);
    return;
  }

  const pattern = overlay.querySelector<HTMLElement>('.intro-pattern');
  const logo = overlay.querySelector<HTMLElement>('.intro-logo');
  const skipBtn = overlay.querySelector<HTMLElement>('[data-intro-skip]');

  // Reveal radius = half the viewport diagonal, so the ripple reaches every
  // corner. Computed in px for reliable GSAP clip-path interpolation.
  const revealR = Math.hypot(window.innerWidth, window.innerHeight) / 2 + 4;

  // Initial states.
  if (logo) gsap.set(logo, { autoAlpha: 0, scale: 0.02 });
  if (pattern) {
    // Pattern opacity is fixed (set in CSS) — only the clip animates, so the
    // reveal reads as a clean ripple instead of a uniform fade.
    gsap.set(pattern, { clipPath: `circle(0px at 50% 50%)` });
  }

  const tl = gsap.timeline({
    onComplete: () => finishIntro(overlay),
  });

  // 1. Zoom in elastically — from tiny + transparent, extrapolating past the
  //    final size and bouncing back to settle (amplitude 2 = more overshoot).
  tl.to(logo, {
    autoAlpha: 1,
    scale: 1,
    duration: 1.2,
    ease: 'elastic.out(2, 0.5)',
  })

    // 2. Flip a full turn, rippling the pattern outward from the logo center.
    .to(logo, { rotation: 360, duration: 0.7, ease: 'power3.inOut' })
    .fromTo(
      pattern,
      { clipPath: 'circle(0px at 50% 50%)' },
      {
        clipPath: `circle(${revealR}px at 50% 50%)`,
        duration: 1.0,
        ease: 'power2.out',
      },
      '<'
    )

    // 3. Hold — logo pulsating over the revealed pattern.
    .to({}, { duration: 1.0 })

    // 4. 3D zoom-through exit: splash flies into the screen revealing landing.
    .to(overlay, {
      autoAlpha: 0,
      scale: 1.3,
      rotateY: 10,
      rotateX: -4,
      filter: 'blur(10px)',
      duration: 0.8,
      ease: 'power2.inOut',
    });

  // Failsafe: guarantee the overlay is removed even if the timeline stalls,
  // so content is never trapped behind it.
  window.setTimeout(() => finishIntro(overlay), 6500);

  skipBtn?.addEventListener('click', () => {
    tl.kill();
    finishIntro(overlay);
  });
}

function finishIntro(overlay: HTMLElement): void {
  if (!overlay.parentNode) return; // already removed — idempotent
  document.documentElement.classList.remove('intro-active');
  overlay.remove();
  // Signal that the intro is done so dependent components (e.g. the hero
  // cycling bio) can start their timers only once the hero is visible.
  window.dispatchEvent(new Event('koga:intro-complete'));
}
