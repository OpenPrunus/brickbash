// Brickbash — le moteur : simulation à 60 pas par seconde, sans dessin ni navigateur (testable sous Node).
// La seule part de hasard (les bonus lâchés par les briques) vient d'un générateur à graine : une partie est rejouable.

export const W = 300;
export const H = 400;
export const TPS = 60;
export const COLS = 12;
export const BRICK_W = 24;
export const BRICK_H = 12;
export const X0 = 6;
export const Y0 = 44;
export const PADDLE_Y = 372;
export const PADDLE_H = 8;
export const PADDLE_W = 48;
export const PADDLE_WIDE = 80;
export const BALL_R = 4;
export const MAX_BALLS = 6;
export const MAX_LIVES = 5;
export const POWERUPS = ['wide', 'multi', 'slow', 'catch', 'laser', 'life'];

export const DURATION = { wide: 600, slow: 600, catch: 720, laser: 600 };   // en pas (10 s, 10 s, 12 s, 10 s)
const DROP_CHANCE = 0.2;
const FALL_SPEED = 1.5;
const LASER_SPEED = 7;
const LASER_COOLDOWN = 16;
const MIN_VERTICAL = 0.24;            // la balle ne reste jamais (presque) horizontale

/** Générateur à graine (xorshift32). */
export class Rng {
  constructor(seed = 1) { this.s = (seed >>> 0) || 1; }
  next() {
    let x = this.s;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    this.s = x;
    return x / 4294967296;
  }
}

/** Briques d'un niveau : « 1 », « 2 », « 3 » = points de vie, « # » = acier (indestructible), « x » = explosive, « . » = vide. */
export function parseBricks(rows) {
  const bricks = [];
  rows.forEach((row, r) => {
    for (let c = 0; c < COLS; c++) {
      const ch = row[c] ?? '.';
      if (ch === '.' || ch === ' ') continue;
      const kind = ch === '#' ? 'steel' : ch === 'x' ? 'bomb' : 'normal';
      const hp = kind === 'normal' ? Number(ch) : kind === 'bomb' ? 1 : Infinity;
      bricks.push({ c, r, kind, hp, max: hp, x: X0 + c * BRICK_W, y: Y0 + r * BRICK_H });
    }
  });
  return bricks;
}

export class Game {
  /** level : { rows, speed }. options : { seed, lives }. */
  constructor(level, { seed = 1, lives = 3 } = {}) {
    this.level = level;
    this.rng = new Rng(seed);
    this.bricks = parseBricks(level.rows);
    this.grid = new Map(this.bricks.map((b) => [b.r * COLS + b.c, b]));
    this.remaining = this.bricks.filter((b) => b.kind !== 'steel').length;
    this.total = this.remaining;
    this.lives = lives;
    this.livesLost = 0;
    this.score = 0;
    this.combo = 0;
    this.tick = 0;
    this.hits = 0;                       // rebonds sur la raquette : la balle accélère un peu
    this.paddle = { x: W / 2, w: PADDLE_W };
    this.balls = [];
    this.drops = [];                     // bonus qui tombent
    this.bullets = [];                   // tirs du laser
    this.effects = { wide: 0, slow: 0, catch: 0, laser: 0 };   // pas restants
    this.cooldown = 0;
    this.events = [];                    // pour les sons et les effets : { type, ... }
    this.status = 'play';                // play | won | lost
    this.serve();
  }

  get over() { return this.status !== 'play'; }
  get won() { return this.status === 'won'; }
  get stuck() { return this.balls.length > 0 && this.balls.every((b) => b.stuck); }
  get baseSpeed() { return this.level.speed * (1 + Math.min(0.3, this.hits * 0.01)); }
  get speed() { return this.baseSpeed * (this.effects.slow > 0 ? 0.7 : 1); }
  get stars() { return this.livesLost === 0 ? 3 : this.livesLost === 1 ? 2 : 1; }

  emit(type, extra = {}) { this.events.push({ type, ...extra }); }

  /** Pose une balle collée au milieu de la raquette. */
  serve() {
    this.balls = [{ x: this.paddle.x, y: PADDLE_Y - BALL_R, vx: 0, vy: 0, stuck: true, off: 0 }];
    this.combo = 0;
  }

  /** Place la raquette (centre). */
  moveTo(x) {
    const half = this.paddle.w / 2;
    this.paddle.x = Math.max(half, Math.min(W - half, x));
  }

  moveBy(dx) { this.moveTo(this.paddle.x + dx); }

  /** Lance les balles collées ; sinon tire si le laser est actif. */
  launch() {
    if (this.over) return false;
    let launched = false;
    for (const b of this.balls) {
      if (!b.stuck) continue;
      b.stuck = false;
      const ang = (b.off / (this.paddle.w / 2)) * 0.5;                // un peu de côté selon l'endroit où elle est posée
      b.vx = Math.sin(ang) * this.speed;
      b.vy = -Math.cos(ang) * this.speed;
      launched = true;
    }
    if (launched) { this.emit('launch'); return true; }
    if (this.effects.laser > 0 && this.cooldown <= 0) {
      const half = this.paddle.w / 2;
      this.bullets.push({ x: this.paddle.x - half + 4, y: PADDLE_Y }, { x: this.paddle.x + half - 4, y: PADDLE_Y });
      this.cooldown = LASER_COOLDOWN;
      this.emit('laser');
      return true;
    }
    return false;
  }

  brickAt(c, r) { return this.grid.get(r * COLS + c); }

  /** Un point de score par brique abîmée, davantage à la destruction, multiplié par l'enchaînement. */
  addScore(base) {
    this.combo++;
    this.score += base * Math.min(8, 1 + Math.floor(this.combo / 4));
  }

  damage(b, amount = 1) {
    if (b.kind === 'steel') { this.emit('clang'); return false; }
    b.hp -= amount;
    if (b.hp > 0) { this.addScore(5); this.emit('hit', { x: b.x, y: b.y }); return false; }
    this.destroy(b);
    return true;
  }

  destroy(b) {
    const queue = [b];
    while (queue.length > 0) {
      const cur = queue.pop();
      if (!this.grid.has(cur.r * COLS + cur.c)) continue;
      this.grid.delete(cur.r * COLS + cur.c);
      cur.hp = 0;
      this.remaining--;
      this.addScore(10 * cur.max);
      this.emit(cur.kind === 'bomb' ? 'boom' : 'break', { x: cur.x, y: cur.y, kind: cur.kind, max: cur.max });
      if (cur.kind === 'bomb') {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const n = this.brickAt(cur.c + dc, cur.r + dr);
            if (!n || n === cur || n.kind === 'steel') continue;
            if (n.kind === 'bomb') queue.push(n);
            else { n.hp -= 1; if (n.hp <= 0) queue.push(n); else this.emit('hit', { x: n.x, y: n.y }); }
          }
        }
      } else if (this.rng.next() < DROP_CHANCE) {
        const kinds = this.lives >= MAX_LIVES ? POWERUPS.filter((k) => k !== 'life') : POWERUPS;
        const kind = this.rng.next() < 0.08 && this.lives < MAX_LIVES ? 'life' : kinds[Math.floor(this.rng.next() * kinds.length)];
        this.drops.push({ x: cur.x + BRICK_W / 2, y: cur.y + BRICK_H / 2, kind });
      }
    }
    if (this.remaining <= 0) { this.status = 'won'; this.emit('won'); }
  }

  applyPowerup(kind) {
    this.emit('powerup', { kind });
    this.score += 25;
    switch (kind) {
      case 'wide': this.effects.wide = DURATION.wide; this.paddle.w = PADDLE_WIDE; this.moveTo(this.paddle.x); break;
      case 'slow': this.effects.slow = DURATION.slow; break;
      case 'catch': this.effects.catch = DURATION.catch; break;
      case 'laser': this.effects.laser = DURATION.laser; break;
      case 'life': this.lives = Math.min(MAX_LIVES, this.lives + 1); break;
      case 'multi': {
        const src = this.balls.filter((b) => !b.stuck);
        const copies = [];
        for (const b of src) {
          for (const turn of [0.35, -0.35]) {
            if (this.balls.length + copies.length >= MAX_BALLS) break;
            const c = Math.cos(turn); const s = Math.sin(turn);
            copies.push({ x: b.x, y: b.y, vx: b.vx * c - b.vy * s, vy: b.vx * s + b.vy * c, stuck: false, off: 0 });
          }
        }
        this.balls.push(...copies);
        break;
      }
      default: break;
    }
  }

  /** Remet la vitesse au module voulu et empêche une trajectoire presque horizontale. */
  fix(b) {
    const sp = this.speed;
    const m = Math.hypot(b.vx, b.vy) || 1;
    b.vx = (b.vx / m) * sp;
    b.vy = (b.vy / m) * sp;
    if (Math.abs(b.vy) < MIN_VERTICAL * sp) {
      b.vy = (b.vy < 0 ? -1 : 1) * MIN_VERTICAL * sp;
      b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(sp * sp - b.vy * b.vy);
    }
  }

  /** Avance d'une demi-balle de pas : murs, raquette, briques. Renvoie false si la balle est perdue. */
  moveBall(b, dt) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); this.emit('wall'); }
    if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); this.emit('wall'); }
    if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); this.emit('wall'); }
    if (b.y - BALL_R > H) return false;

    // raquette
    const half = this.paddle.w / 2;
    if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && b.y + BALL_R <= PADDLE_Y + PADDLE_H + b.vy * dt + 1
      && b.x >= this.paddle.x - half - BALL_R * 0.6 && b.x <= this.paddle.x + half + BALL_R * 0.6) {
      this.hits++;
      this.combo = 0;
      const rel = Math.max(-1, Math.min(1, (b.x - this.paddle.x) / half));
      b.y = PADDLE_Y - BALL_R;
      const ang = rel * 1.05;                                         // jusqu'à 60° de la verticale
      const sp = this.speed;
      b.vx = Math.sin(ang) * sp;
      b.vy = -Math.cos(ang) * sp;
      this.emit('paddle');
      if (this.effects.catch > 0) { b.stuck = true; b.off = b.x - this.paddle.x; b.vx = 0; b.vy = 0; }
      return true;
    }

    // briques : la plus enfoncée gagne
    const c0 = Math.floor((b.x - BALL_R - X0) / BRICK_W);
    const c1 = Math.floor((b.x + BALL_R - X0) / BRICK_W);
    const r0 = Math.floor((b.y - BALL_R - Y0) / BRICK_H);
    const r1 = Math.floor((b.y + BALL_R - Y0) / BRICK_H);
    let best = null; let bestD = Infinity; let bx = 0; let by = 0;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const k = this.brickAt(c, r);
        if (!k) continue;
        const nx = Math.max(k.x, Math.min(b.x, k.x + BRICK_W));
        const ny = Math.max(k.y, Math.min(b.y, k.y + BRICK_H));
        const d = Math.hypot(b.x - nx, b.y - ny);
        if (d < BALL_R && d < bestD) { best = k; bestD = d; bx = nx; by = ny; }
      }
    }
    if (best) {
      let dx = b.x - bx; let dy = b.y - by;
      if (dx === 0 && dy === 0) { dx = -b.vx; dy = -b.vy; }              // centre dans la brique : on ressort par où on est entré
      if (Math.abs(dx) > Math.abs(dy)) { b.vx = Math.abs(b.vx) * (dx < 0 ? -1 : 1); b.x = bx + (dx < 0 ? -1 : 1) * BALL_R; }
      else { b.vy = Math.abs(b.vy) * (dy < 0 ? -1 : 1); b.y = by + (dy < 0 ? -1 : 1) * BALL_R; }
      this.damage(best);
    }
    return true;
  }

  step() {
    if (this.over) return;
    this.tick++;
    for (const k of Object.keys(this.effects)) {
      if (this.effects[k] > 0 && --this.effects[k] === 0) {
        if (k === 'wide') { this.paddle.w = PADDLE_W; this.moveTo(this.paddle.x); }
        if (k === 'catch') this.launchAfterCatch();
      }
    }
    if (this.cooldown > 0) this.cooldown--;

    // balles
    const alive = [];
    for (const b of this.balls) {
      if (b.stuck) {
        b.x = Math.max(BALL_R, Math.min(W - BALL_R, this.paddle.x + b.off));
        b.y = PADDLE_Y - BALL_R;
        alive.push(b);
        continue;
      }
      const sub = Math.max(1, Math.ceil(this.speed / 2));
      let ok = true;
      this.fix(b);
      for (let i = 0; i < sub && ok && !this.over; i++) {
        ok = this.moveBall(b, 1 / sub);
        if (!b.stuck) this.fix(b);
        else break;
      }
      if (ok) alive.push(b);
    }
    this.balls = alive;
    if (this.over) return;

    // bonus
    this.drops = this.drops.filter((d) => {
      d.y += FALL_SPEED;
      const half = this.paddle.w / 2;
      if (d.y >= PADDLE_Y - 4 && d.y <= PADDLE_Y + PADDLE_H + 4 && Math.abs(d.x - this.paddle.x) <= half + 8) { this.applyPowerup(d.kind); return false; }
      return d.y < H + 10;
    });

    // tirs
    this.bullets = this.bullets.filter((s) => {
      s.y -= LASER_SPEED;
      if (s.y < 0) return false;
      const k = this.brickAt(Math.floor((s.x - X0) / BRICK_W), Math.floor((s.y - Y0) / BRICK_H));
      if (k) { this.damage(k); return false; }
      return true;
    });
    if (this.over) return;

    if (this.balls.length === 0) this.loseLife();
  }

  /** Quand le temps de la colle est écoulé, les balles collées partent. */
  launchAfterCatch() {
    for (const b of this.balls) {
      if (!b.stuck) continue;
      b.stuck = false;
      b.vx = 0;
      b.vy = -this.speed;
    }
  }

  loseLife() {
    this.lives--;
    this.livesLost++;
    this.drops = [];
    this.bullets = [];
    this.effects = { wide: 0, slow: 0, catch: 0, laser: 0 };
    this.paddle.w = PADDLE_W;
    this.moveTo(this.paddle.x);
    this.emit('lost-ball');
    if (this.lives <= 0) { this.status = 'lost'; this.emit('lost'); return; }
    this.serve();
  }
}

/** Joueur automatique : suit la balle la plus basse en la renvoyant sous des angles variés (sert aux tests et à la démonstration). */
export function autoplay(game, { maxSteps = 60 * 60 * 6, aim = 0.6 } = {}) {
  let k = 0;
  while (!game.over && game.tick < maxSteps) {
    if (game.stuck) game.launch();
    let target = null;
    for (const b of game.balls) if (!b.stuck && b.vy > 0 && (!target || b.y > target.y)) target = b;
    if (!target) for (const b of game.balls) if (!b.stuck && (!target || b.y > target.y)) target = b;
    if (target) {
      // on vise un point de la raquette qui varie d'un rebond à l'autre, pour ne pas boucler
      const rel = Math.sin(++k * 0.013 + game.hits * 2.399) * aim;
      game.moveTo(target.x - rel * (game.paddle.w / 2));
    }
    if (game.effects.laser > 0) game.launch();
    game.step();
  }
  return game;
}
