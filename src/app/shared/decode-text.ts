import { Directive, ElementRef, effect, inject, input } from '@angular/core';

const GLYPHS = 'アイウエオカキクケコ01<>/\\[]{}#$%&*+=?ΔΣΨΩ';

/**
 * "Decrypts" text into place: characters start as random glyphs and resolve left to right.
 * Re-runs whenever the text changes (e.g. switching VI/EN). Screen readers get the final text
 * straight away through aria-label. Skipped when the user prefers reduced motion.
 *
 *   <h1 [appDecode]="title"></h1>
 */
@Directive({ selector: '[appDecode]' })
export class DecodeText {
  readonly appDecode = input.required<string>();
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private raf = 0;

  constructor() {
    effect((onCleanup) => {
      const text = this.appDecode();
      this.el.setAttribute('aria-label', text);
      const reduce =
        typeof matchMedia === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce || !text) {
        this.el.textContent = text;
        return;
      }
      const chars = [...text];
      const start = performance.now();
      const duration = Math.min(1400, 350 + chars.length * 28);
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const done = Math.floor(p * chars.length);
        let out = '';
        for (let i = 0; i < chars.length; i++) {
          const c = chars[i];
          if (i < done || c === ' ') out += c;
          else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        this.el.textContent = out;
        if (p < 1) this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
      onCleanup(() => cancelAnimationFrame(this.raf));
    });
  }
}
