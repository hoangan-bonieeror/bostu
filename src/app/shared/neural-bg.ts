import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';

/** A neuron: drifts slowly around its home position and flashes when a signal reaches it. */
interface Neuron {
  hx: number; // home position
  hy: number;
  x: number;
  y: number;
  phase: number; // drift phase
  speed: number;
  r: number; // radius
  fire: number; // 0..1 glow after firing, decays
  hue: 0 | 1; // which accent colour
}

/** A signal travelling along a connection, like an action potential. */
interface Pulse {
  from: number;
  to: number;
  t: number; // 0..1 progress
  speed: number;
  energy: number; // how many more hops it may trigger
}

const LINK_DIST = 165; // px: neurons closer than this are connected
const MAX_PULSES = 70;
const MOUSE_RADIUS = 180;

/**
 * Full-screen animated neural network drawn on a canvas behind the page.
 * - Neurons drift; nearby neurons are linked by faint synapses.
 * - Signals travel along links and make the target neuron fire, sometimes cascading further.
 * - The pointer acts as a neuron: it links to nearby cells; clicking sends a burst of signals.
 * - Respects prefers-reduced-motion (draws one still frame) and pauses when the tab is hidden.
 * Colours come from the CSS variables --neuron-a / --neuron-b, so the theme controls them.
 */
@Component({
  selector: 'app-neural-bg',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #cv class="neural-bg" aria-hidden="true"></canvas>`,
})
export class NeuralBackground {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.start());
  }

  private start(): void {
    const canvas = this.canvas().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let w = 0;
    let h = 0;
    let dpr = 1;
    let neurons: Neuron[] = [];
    let links: number[][] = []; // adjacency list, rebuilt every few frames
    const pulses: Pulse[] = [];
    const mouse = { x: -1e4, y: -1e4, active: false };
    let colors = { a: '#22d3ee', b: '#a78bfa', line: 'rgba(148,163,255,0.14)' };
    let raf = 0;
    let last = performance.now();
    let frame = 0;
    let nextSpontaneous = 0;

    const readColors = () => {
      const s = getComputedStyle(document.documentElement);
      colors = {
        a: s.getPropertyValue('--neuron-a').trim() || colors.a,
        b: s.getPropertyValue('--neuron-b').trim() || colors.b,
        line: s.getPropertyValue('--neuron-line').trim() || colors.line,
      };
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Density scales with screen area; fewer cells on phones keeps it smooth.
      const count = Math.max(28, Math.min(110, Math.round((w * h) / 12500)));
      neurons = Array.from({ length: count }, () => {
        const x = Math.random() * w;
        const y = Math.random() * h;
        return {
          hx: x,
          hy: y,
          x,
          y,
          phase: Math.random() * Math.PI * 2,
          speed: 0.15 + Math.random() * 0.35,
          r: 1.2 + Math.random() * 1.8,
          fire: 0,
          hue: Math.random() < 0.6 ? 0 : 1,
        };
      });
      pulses.length = 0;
      rebuildLinks();
      if (reduceMotion.matches) draw(0);
    };

    const rebuildLinks = () => {
      links = neurons.map(() => []);
      for (let i = 0; i < neurons.length; i++)
        for (let j = i + 1; j < neurons.length; j++) {
          const dx = neurons[i].x - neurons[j].x;
          const dy = neurons[i].y - neurons[j].y;
          if (dx * dx + dy * dy < LINK_DIST * LINK_DIST) {
            links[i].push(j);
            links[j].push(i);
          }
        }
    };

    /** Make neuron i fire and send signals to some of its neighbours. */
    const fire = (i: number, energy: number) => {
      neurons[i].fire = 1;
      if (energy <= 0) return;
      const targets = [...links[i]].sort(() => Math.random() - 0.5).slice(0, energy > 2 ? 3 : 2);
      for (const to of targets) {
        if (pulses.length >= MAX_PULSES) break;
        pulses.push({ from: i, to, t: 0, speed: 0.6 + Math.random() * 0.6, energy: energy - 1 });
      }
    };

    const nearestNeuron = (x: number, y: number) => {
      let best = -1;
      let bestD = Infinity;
      neurons.forEach((n, i) => {
        const d = (n.x - x) ** 2 + (n.y - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best;
    };

    const step = (dt: number, time: number) => {
      for (const n of neurons) {
        n.phase += dt * n.speed;
        n.x = n.hx + Math.cos(n.phase) * 14 + Math.sin(n.phase * 0.7) * 8;
        n.y = n.hy + Math.sin(n.phase * 0.9) * 12;
        // Pointer gently pulls cells, like attention.
        if (mouse.active) {
          const dx = mouse.x - n.x;
          const dy = mouse.y - n.y;
          const d = Math.hypot(dx, dy);
          if (d < MOUSE_RADIUS && d > 1) {
            const k = (1 - d / MOUSE_RADIUS) * 10;
            n.x += (dx / d) * k;
            n.y += (dy / d) * k;
          }
        }
        n.fire = Math.max(0, n.fire - dt * 1.4);
      }
      if (++frame % 10 === 0) rebuildLinks();

      for (let k = pulses.length - 1; k >= 0; k--) {
        const p = pulses[k];
        p.t += dt * p.speed;
        if (p.t >= 1) {
          pulses.splice(k, 1);
          // Not every signal propagates: keeps cascades organic instead of exploding.
          if (Math.random() < 0.72) fire(p.to, p.energy);
          else neurons[p.to].fire = Math.max(neurons[p.to].fire, 0.5);
        }
      }

      // Spontaneous activity every so often.
      if (time > nextSpontaneous && neurons.length) {
        fire(Math.floor(Math.random() * neurons.length), 3 + Math.floor(Math.random() * 2));
        nextSpontaneous = time + 900 + Math.random() * 1400;
      }
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, w, h);
      const glow = (i: number) => Math.max(neurons[i].fire, 0);

      // Synapses
      ctx.lineWidth = 1;
      for (let i = 0; i < neurons.length; i++) {
        const a = neurons[i];
        for (const j of links[i]) {
          if (j < i) continue;
          const b = neurons[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          const fade = 1 - d / LINK_DIST;
          if (fade <= 0) continue;
          const active = Math.max(glow(i), glow(j));
          ctx.globalAlpha = Math.min(1, fade * (0.55 + active * 1.2));
          ctx.strokeStyle = active > 0.15 ? (a.hue ? colors.b : colors.a) : colors.line;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Pointer synapses
      if (mouse.active) {
        for (const n of neurons) {
          const d = Math.hypot(n.x - mouse.x, n.y - mouse.y);
          if (d > MOUSE_RADIUS) continue;
          ctx.globalAlpha = (1 - d / MOUSE_RADIUS) * 0.55;
          ctx.strokeStyle = colors.a;
          ctx.beginPath();
          ctx.moveTo(mouse.x, mouse.y);
          ctx.lineTo(n.x, n.y);
          ctx.stroke();
        }
      }

      // Signals: a bright head with a short fading tail.
      for (const p of pulses) {
        const a = neurons[p.from];
        const b = neurons[p.to];
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        const tail = Math.max(0, p.t - 0.25);
        const tx = a.x + (b.x - a.x) * tail;
        const ty = a.y + (b.y - a.y) * tail;
        const c = a.hue ? colors.b : colors.a;
        const grad = ctx.createLinearGradient(tx, ty, x, y);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, c);
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = c;
        ctx.shadowColor = c;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1;
      }

      // Neurons: soft halo when firing, plus a slow "breathing" core.
      for (const n of neurons) {
        const c = n.hue ? colors.b : colors.a;
        if (n.fire > 0.02) {
          const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 22 * n.fire + 6);
          halo.addColorStop(0, c);
          halo.addColorStop(1, 'transparent');
          ctx.globalAlpha = 0.55 * n.fire;
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(n.x, n.y, 22 * n.fire + 6, 0, Math.PI * 2);
          ctx.fill();
        }
        const breathe = 0.55 + 0.25 * Math.sin(time / 900 + n.phase * 3);
        ctx.globalAlpha = Math.min(1, breathe + n.fire);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + n.fire * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(dt, now);
      draw(now);
      raf = requestAnimationFrame(loop);
    };

    const play = () => {
      cancelAnimationFrame(raf);
      if (reduceMotion.matches || document.hidden) {
        draw(0);
        return;
      }
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = e.pointerType === 'mouse';
    };
    const onLeave = () => (mouse.active = false);
    const onDown = (e: PointerEvent) => {
      // Ignore clicks on interactive elements; only "empty" clicks send a burst.
      if ((e.target as HTMLElement).closest('a, button, input, textarea, select, .sql-runner'))
        return;
      const i = nearestNeuron(e.clientX, e.clientY);
      if (i >= 0) fire(i, 5);
    };

    /** Bursts requested by the rest of the app (MotionService fires one on every link click). */
    const onBurst = (e: Event) => {
      const {
        x,
        y,
        energy = 3,
      } = (e as CustomEvent<{ x: number; y: number; energy?: number }>).detail;
      const i = nearestNeuron(x, y);
      if (i >= 0) fire(i, energy);
    };

    readColors();
    resize();
    play();

    const themeObserver = new MutationObserver(() => {
      readColors();
      if (reduceMotion.matches) draw(0);
    });
    themeObserver.observe(document.documentElement, { attributeFilter: ['data-theme'] });
    let resizeTimer = 0;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 150);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('neural:burst', onBurst);
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', play);
    reduceMotion.addEventListener('change', play);

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(raf);
      themeObserver.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('neural:burst', onBurst);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', play);
      reduceMotion.removeEventListener('change', play);
    });
  }
}
