/**
 * Cycling bio word for the landing hero.
 *
 * Displays "Your friendly <word> on the internet" where <word> cycles every
 * 5 seconds. "noodle dragon" is always first; the rest are shuffled per run.
 *
 * The timer starts only when the hero is actually visible — i.e. after the
 * intro splash finishes (listens for `koga:intro-complete`) or immediately if
 * the intro didn't play (SPA navigation / reduced motion).
 */

const WORDS = [
  'noodle dragon',
  'developer',
  'streamer',
  'goober',
  'dragon lover',
  'gamer',
  'furry',
  'beer enjoyer',
  'mirror dweller',
  'button masher',
  'ramen connoisseur',
  'energy drink addict',
  'pokefan',
  'avatar collector',
  'topology terrorist',
  'mesh mangler',
  'console.log enjoyer',
  'callback hell survivor',
  'flexbox flailer',
  'CSS art wannabe',
  'Tailwind tail chaser',
  'sleep-deprived entity',
] as const;

const CYCLE_MS = 5000;
const FADE_MS = 280;

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let timer: number | null = null;
let failsafe: number | null = null;

function clearAll(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  if (failsafe !== null) {
    clearTimeout(failsafe);
    failsafe = null;
  }
}

function start(el: HTMLElement): void {
  clearAll();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // "noodle dragon" is always first; the remainder is randomized.
  const [first, ...rest] = WORDS;
  const order = [first, ...shuffle(rest)];
  let i = 0;

  el.textContent = order[0];
  el.style.opacity = '1';

  timer = window.setInterval(() => {
    const advance = () => {
      i = (i + 1) % order.length;
      el.textContent = order[i];
      el.style.opacity = '1';
    };
    if (reduce) {
      advance();
    } else {
      el.style.opacity = '0';
      window.setTimeout(advance, FADE_MS);
    }
  }, CYCLE_MS);
}

export function runHeroCycling(): void {
  // Clear any previous run (e.g. navigating away and back).
  clearAll();

  const el = document.querySelector<HTMLElement>('[data-cycling-word]');
  if (!el) return; // not on the landing page

  const begin = () => {
    clearAll();
    window.removeEventListener('koga:intro-complete', begin);
    start(el);
  };

  // If the intro isn't active (SPA nav, reduced motion, or already done),
  // start immediately. Otherwise wait for the intro to complete.
  if (!document.documentElement.classList.contains('intro-active')) {
    begin();
    return;
  }
  window.addEventListener('koga:intro-complete', begin);
  // Failsafe: start even if the intro event never fires.
  failsafe = window.setTimeout(begin, 7000);
}
