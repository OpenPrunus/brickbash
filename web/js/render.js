// Brickbash — dessin : briques, raquette, balles, bonus, éclats. Le canvas fait 2× la taille logique pour rester net.
import { W, H, BRICK_W, BRICK_H, PADDLE_Y, PADDLE_H, BALL_R, POWERUPS } from './engine.js';

export const SCALE = 2;
const HP_COLORS = { 1: ['#59d98a', '#2f9e5a'], 2: ['#ffd24a', '#c9981a'], 3: ['#ff7b7b', '#c04444'] };
const POWER = {
  wide: ['W', '#4aa8ff'], multi: ['M', '#c77dff'], slow: ['S', '#4fe0d0'], catch: ['C', '#ffb347'], laser: ['L', '#ff5d8f'], life: ['♥', '#ff6b6b'],
};
export const POWER_LABELS = Object.fromEntries(POWERUPS.map((k) => [k, POWER[k][0]]));

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    this.sparks = [];
    this.trail = [];
    this.shake = 0;
    this.seed = 1;
  }

  rand() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }

  /** Éclats pour les événements du moteur (purement visuel, sans effet sur la partie). */
  feed(events) {
    for (const e of events) {
      if (e.type === 'break' || e.type === 'boom') {
        const color = e.kind === 'bomb' ? '#ffa24a' : HP_COLORS[e.max]?.[0] ?? '#fff';
        for (let i = 0; i < (e.type === 'boom' ? 18 : 8); i++) {
          const a = this.rand() * Math.PI * 2;
          const s = 0.6 + this.rand() * (e.type === 'boom' ? 3 : 1.8);
          this.sparks.push({ x: e.x + BRICK_W / 2, y: e.y + BRICK_H / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.5, life: 24 + this.rand() * 16, color });
        }
        if (e.type === 'boom') this.shake = 10;
      } else if (e.type === 'lost-ball') this.shake = 8;
    }
  }

  brick(ctx, b) {
    const { x, y } = b;
    if (b.kind === 'steel') {
      ctx.fillStyle = '#8b97a8'; ctx.fillRect(x + 1, y + 1, BRICK_W - 2, BRICK_H - 2);
      ctx.fillStyle = '#c7d0dc'; ctx.fillRect(x + 1, y + 1, BRICK_W - 2, 2);
      ctx.fillStyle = '#5d6878'; ctx.fillRect(x + 1, y + BRICK_H - 3, BRICK_W - 2, 2);
      ctx.fillStyle = '#e9eef5';
      for (const dx of [4, BRICK_W - 5]) ctx.fillRect(x + dx, y + 5, 2, 2);
      return;
    }
    if (b.kind === 'bomb') {
      ctx.fillStyle = '#ff8a3d'; ctx.fillRect(x + 1, y + 1, BRICK_W - 2, BRICK_H - 2);
      ctx.fillStyle = '#ffd08a'; ctx.fillRect(x + 1, y + 1, BRICK_W - 2, 2);
      ctx.fillStyle = '#2b1a0a';
      ctx.beginPath(); ctx.arc(x + BRICK_W / 2, y + BRICK_H / 2 + 0.5, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff2a8'; ctx.fillRect(x + BRICK_W / 2 + 1, y + 1.5, 2, 2);
      return;
    }
    const [light, dark] = HP_COLORS[Math.min(3, b.hp)] ?? HP_COLORS[1];
    ctx.fillStyle = dark; ctx.fillRect(x + 1, y + 1, BRICK_W - 2, BRICK_H - 2);
    ctx.fillStyle = light; ctx.fillRect(x + 1, y + 1, BRICK_W - 2, BRICK_H - 4);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + 2, y + 2, BRICK_W - 4, 1.5);
  }

  draw(now = 0) {
    const { ctx, game: g } = this;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    const sh = this.shake > 0 ? (this.rand() - 0.5) * this.shake * 0.5 : 0;
    if (this.shake > 0) this.shake -= 0.5;
    ctx.translate(sh, sh);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#16203a'); bg.addColorStop(1, '#0c1226');
    ctx.fillStyle = bg;
    ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.strokeStyle = 'rgba(255,255,255,.04)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }

    for (const b of g.grid.values()) this.brick(ctx, b);

    // bonus qui tombent
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const d of g.drops) {
      const [label, color] = POWER[d.kind];
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(d.x - 11, d.y - 6, 22, 12, 6); ctx.fill();
      ctx.fillStyle = '#10182c';
      ctx.fillText(label, d.x, d.y + 0.5);
    }

    // tirs
    ctx.fillStyle = '#ff5d8f';
    for (const s of g.bullets) ctx.fillRect(s.x - 1, s.y - 5, 2, 7);

    // raquette
    const px = g.paddle.x - g.paddle.w / 2;
    const glow = g.effects.laser > 0 ? '#ff5d8f' : g.effects.catch > 0 ? '#ffb347' : '#7fc4ff';
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.roundRect(px, PADDLE_Y, g.paddle.w, PADDLE_H, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.fillRect(px + 4, PADDLE_Y + 1, g.paddle.w - 8, 2);
    if (g.effects.laser > 0) { ctx.fillStyle = '#ffd1e0'; ctx.fillRect(px + 2, PADDLE_Y - 3, 4, 4); ctx.fillRect(px + g.paddle.w - 6, PADDLE_Y - 3, 4, 4); }

    // balles et leur traînée
    this.trail.push(g.balls.filter((b) => !b.stuck).map((b) => ({ x: b.x, y: b.y })));
    if (this.trail.length > 5) this.trail.shift();
    this.trail.forEach((pts, i) => {
      ctx.fillStyle = `rgba(255,255,255,${(i + 1) * 0.05})`;
      for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, BALL_R * (0.5 + i * 0.08), 0, Math.PI * 2); ctx.fill(); }
    });
    for (const b of g.balls) {
      ctx.fillStyle = g.effects.slow > 0 ? '#9ff3ea' : '#fff';
      ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill();
    }

    // éclats
    this.sparks = this.sparks.filter((s) => s.life > 0);
    for (const s of this.sparks) {
      s.x += s.vx; s.y += s.vy; s.vy += 0.06; s.life--;
      ctx.globalAlpha = Math.max(0, s.life / 30);
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x - 1, s.y - 1, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;

    // bonus actifs : une petite jauge par effet
    let ox = 6;
    for (const k of ['wide', 'slow', 'catch', 'laser']) {
      const left = g.effects[k];
      if (left <= 0) continue;
      const [label, color] = POWER[k];
      ctx.fillStyle = color; ctx.fillRect(ox, 8, 16, 12);
      ctx.fillStyle = '#10182c'; ctx.fillText(label, ox + 8, 14.5);
      ctx.fillStyle = color; ctx.fillRect(ox, 22, 16 * Math.min(1, left / 600), 2);
      ox += 20;
    }
    void now;
  }
}
