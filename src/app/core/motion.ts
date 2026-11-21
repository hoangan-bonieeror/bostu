import { DOCUMENT, Injectable, inject } from '@angular/core';

/** Elements that fade/slide in the first time they scroll into view. */
const REVEAL_SELECTOR = [
  '.side-block',
  '.prose > h2',
  '.prose > h3',
  '.prose > p',
  '.prose > ul',
  '.prose > ol',
  '.prose > blockquote',
  '.prose .figure',
  '.prose .code-block',
  '.prose .table-scroll',
  '.prose .callout',
  '.prose .diagram',
  '.sql-runner',
  '.post-nav-card',
  '.series-box',
  '.archive-month',
  '.cat-switch',
].join(',');

/** Cards that tilt in 3D and get a spotlight under the pointer. */
const TILT_SELECTOR = '.pc, .post-nav-card, .radar-mini, .news-mini';
const MAX_TILT = 6; // degrees

/**
 * Site-wide motion effects, implemented once with event delegation and observers so pages and
 * components stay free of animation code:
 *  - scroll reveal (IntersectionObserver; new elements are picked up by a MutationObserver)
 *  - 3D tilt + cursor spotlight on cards
 *  - a soft "aura" of light that follows the pointer
 *  - a neural burst (see neural-bg.ts) wherever a link or button is clicked
 * Everything is skipped when the user prefers reduced motion or uses touch only.
 */
@Injectable({ providedIn: 'root' })
export class MotionService {
  private readonly doc = inject(DOCUMENT);
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    const win = this.doc.defaultView;
    if (!win || win.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.doc.documentElement.classList.add('motion');
    this.reveal(win);
    if (win.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      this.tilt();
      this.aura();
    }
    this.clickBursts(win);
  }

  private reveal(win: Window): void {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    const scan = () => {
      this.doc.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((el) => {
        if (el.dataset['reveal']) return;
        el.dataset['reveal'] = '1';
        // Already on screen at load → show immediately, no flash of hidden content.
        const r = el.getBoundingClientRect();
        if (r.top < win.innerHeight * 0.92 && r.bottom > 0) {
          el.classList.add('in');
          return;
        }
        el.classList.add('reveal');
        io.observe(el);
      });
    };
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        scan();
      });
    }).observe(this.doc.body, { childList: true, subtree: true });
    scan();
  }

  private tilt(): void {
    let current: HTMLElement | null = null;
    this.doc.addEventListener(
      'pointermove',
      (e) => {
        const card = (e.target as HTMLElement).closest<HTMLElement>(TILT_SELECTOR);
        if (current && current !== card) this.resetTilt(current);
        current = card;
        if (!card) return;
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width; // 0..1
        const py = (e.clientY - r.top) / r.height;
        // Big cards tilt less so they don't feel wobbly.
        const k = Math.min(1, 420 / Math.max(r.width, 1));
        card.style.setProperty('--rx', `${((0.5 - py) * MAX_TILT * k).toFixed(2)}deg`);
        card.style.setProperty('--ry', `${((px - 0.5) * MAX_TILT * k).toFixed(2)}deg`);
        card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
        card.classList.add('tilting');
      },
      { passive: true },
    );
    this.doc.addEventListener('pointerleave', () => current && this.resetTilt(current));
  }

  private resetTilt(card: HTMLElement): void {
    card.classList.remove('tilting');
    card.style.removeProperty('--rx');
    card.style.removeProperty('--ry');
  }

  private aura(): void {
    const el = this.doc.createElement('div');
    el.className = 'cursor-aura';
    el.setAttribute('aria-hidden', 'true');
    this.doc.body.appendChild(el);
    let x = -500;
    let y = -500;
    let tx = x;
    let ty = y;
    let raf = 0;
    const follow = () => {
      // Ease towards the pointer so the light trails it slightly.
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(follow) : 0;
    };
    this.doc.addEventListener(
      'pointermove',
      (e) => {
        tx = e.clientX;
        ty = e.clientY;
        el.classList.add('on');
        if (!raf) raf = requestAnimationFrame(follow);
      },
      { passive: true },
    );
    this.doc.addEventListener('pointerleave', () => el.classList.remove('on'));
  }

  private clickBursts(win: Window): void {
    this.doc.addEventListener(
      'click',
      (e) => {
        const t = (e.target as HTMLElement).closest('a, button');
        if (!t || t.closest('.sql-runner')) return;
        win.dispatchEvent(
          new CustomEvent('neural:burst', { detail: { x: e.clientX, y: e.clientY, energy: 3 } }),
        );
      },
      { passive: true },
    );
  }
}
