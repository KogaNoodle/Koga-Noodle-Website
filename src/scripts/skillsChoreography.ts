import gsap from 'gsap';

/**
 * Staggered reveal for the Skills section cards + timeline items.
 * Plays immediately on load (no scroll dependency) so content is never trapped
 * invisible when the scroll container isn't the window.
 */
export function runSkillsChoreography(): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cards = document.querySelectorAll<HTMLElement>(
    '.skill-group, .timeline-item'
  );
  if (!cards.length || reduce) return;

  gsap.from(cards, {
    autoAlpha: 0,
    y: 30,
    duration: 0.5,
    stagger: 0.08,
    ease: 'power2.out',
  });
}
