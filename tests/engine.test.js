import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, Rng, parseBricks, autoplay, W, H, PADDLE_Y, PADDLE_W, PADDLE_WIDE, BALL_R, MAX_BALLS, MAX_LIVES, X0, Y0, BRICK_W, BRICK_H } from '../web/js/engine.js';

const lvl = (rows, speed = 3) => ({ rows, speed });
const run = (g, n) => { for (let i = 0; i < n && !g.over; i++) g.step(); };

test('parseBricks : points de vie, acier, explosives, vides', () => {
  const b = parseBricks(['12#x.', '..3']);
  assert.deepEqual(b.map((k) => [k.c, k.r, k.kind, k.hp]), [[0, 0, 'normal', 1], [1, 0, 'normal', 2], [2, 0, 'steel', Infinity], [3, 0, 'bomb', 1], [2, 1, 'normal', 3]]);
  assert.equal(b[0].x, X0);
  assert.equal(b[4].y, Y0 + BRICK_H);
});

test('Rng : déterministe et dans [0, 1[', () => {
  const a = new Rng(7); const b = new Rng(7);
  for (let i = 0; i < 100; i++) { const v = a.next(); assert.equal(v, b.next()); assert.ok(v >= 0 && v < 1); }
});

test('au départ la balle est collée à la raquette ; lancer la détache ; la raquette reste dans le terrain', () => {
  const g = new Game(lvl(['1']));
  assert.equal(g.stuck, true);
  g.moveTo(-50);
  assert.equal(g.paddle.x, PADDLE_W / 2);
  g.moveTo(9999);
  assert.equal(g.paddle.x, W - PADDLE_W / 2);
  g.step();
  assert.equal(g.balls[0].x, g.paddle.x, 'la balle suit la raquette');
  assert.equal(g.launch(), true);
  assert.equal(g.stuck, false);
  assert.ok(g.balls[0].vy < 0);
  assert.ok(Math.abs(Math.hypot(g.balls[0].vx, g.balls[0].vy) - 3) < 1e-9);
});

test('la balle rebondit sur les murs et le plafond', () => {
  const g = new Game(lvl(['1'], 3));
  g.launch();
  const b = g.balls[0];
  Object.assign(b, { x: 5, y: 200, vx: -3, vy: -1 });
  g.step();
  assert.ok(b.vx > 0 && b.x >= BALL_R);
  Object.assign(b, { x: 200, y: 5, vx: 1, vy: -3 });
  g.step();
  assert.ok(b.vy > 0);
});

test('la raquette renvoie la balle selon l\'endroit touché', () => {
  for (const [dx, sign] of [[-20, -1], [20, 1], [0, 0]]) {
    const g = new Game(lvl(['1'], 3));
    g.launch();
    const b = g.balls[0];
    Object.assign(b, { x: g.paddle.x + dx, y: PADDLE_Y - BALL_R - 2, vx: 0, vy: 3 });
    run(g, 4);
    assert.ok(b.vy < 0, 'renvoyée vers le haut');
    if (sign) assert.equal(Math.sign(b.vx), sign); else assert.ok(Math.abs(b.vx) < 0.2);
    assert.equal(g.hits, 1);
  }
});

test('une brique à plusieurs coups résiste, puis casse ; le score monte ; gagner = plus aucune brique destructible', () => {
  const g = new Game(lvl(['2'], 3));
  const k = g.bricks[0];
  g.launch();
  const b = g.balls[0];
  const shoot = () => Object.assign(b, { x: k.x + 12, y: k.y + BRICK_H + 6, vx: 0, vy: -3 });
  shoot(); run(g, 6);
  assert.equal(k.hp, 1);
  assert.equal(g.status, 'play');
  shoot(); run(g, 6);
  assert.equal(g.remaining, 0);
  assert.equal(g.status, 'won');
  assert.ok(g.score >= 25);
});

test('l\'acier ne casse jamais, même si c\'est la seule brique restante : on gagne quand le reste a disparu', () => {
  const g = new Game(lvl(['#1'], 3));
  assert.equal(g.remaining, 1);
  g.launch();
  const steel = g.bricks[0];
  Object.assign(g.balls[0], { x: steel.x + 12, y: steel.y + BRICK_H + 6, vx: 0, vy: -3 });
  run(g, 6);
  assert.equal(g.grid.size, 2, 'l\'acier est toujours là');
  assert.ok(g.balls[0].vy > 0, 'la balle a rebondi dessus');
});

test('une brique explosive détruit ses voisines (sauf l\'acier) et enchaîne avec les autres explosives', () => {
  const g = new Game(lvl(['1x1', '1x#'], 3));
  const bomb = g.bricks.find((k) => k.kind === 'bomb' && k.r === 0);
  g.launch();
  Object.assign(g.balls[0], { x: bomb.x + 12, y: bomb.y + BRICK_H + 6, vx: 0, vy: -3 });
  run(g, 3);
  assert.equal(g.remaining, 0, 'tout ce qui n\'est pas en acier a explosé');
  assert.equal(g.won, true);
  assert.ok(g.grid.has(1 * 12 + 2), 'l\'acier reste');
});

test('perdre la balle coûte une vie, remet une balle collée ; plus de vie = défaite', () => {
  const g = new Game(lvl(['1'], 3), { lives: 2 });
  g.launch();
  Object.assign(g.balls[0], { x: 20, y: H - 5, vx: 0, vy: 3 });
  g.moveTo(250);
  run(g, 10);
  assert.equal(g.lives, 1);
  assert.equal(g.stuck, true);
  assert.equal(g.livesLost, 1);
  assert.equal(g.stars, 2);
  g.launch();
  Object.assign(g.balls[0], { x: 20, y: H - 5, vx: 0, vy: 3 });
  run(g, 10);
  assert.equal(g.status, 'lost');
  assert.equal(g.stars, 1);
});

test('la balle ne reste jamais horizontale', () => {
  const g = new Game(lvl(['1'], 3));
  g.launch();
  Object.assign(g.balls[0], { x: 100, y: 200, vx: 3, vy: 0.01 });
  g.step();
  assert.ok(Math.abs(g.balls[0].vy) >= 0.24 * 3 - 1e-9);
  assert.ok(Math.abs(Math.hypot(g.balls[0].vx, g.balls[0].vy) - 3) < 1e-9);
});

test('bonus : raquette large (puis retour à la normale), ralentissement, vie, multibille plafonnée', () => {
  const g = new Game(lvl(['1'], 3), { lives: 3 });
  g.launch();
  g.applyPowerup('wide');
  assert.equal(g.paddle.w, PADDLE_WIDE);
  run(g, 601);
  assert.equal(g.paddle.w, PADDLE_W);
  g.applyPowerup('slow');
  assert.ok(Math.abs(g.speed - g.baseSpeed * 0.7) < 1e-9);
  g.applyPowerup('life');
  assert.equal(g.lives, 4);
  for (let i = 0; i < 3; i++) g.applyPowerup('life');
  assert.equal(g.lives, MAX_LIVES);
  for (let i = 0; i < 5; i++) g.applyPowerup('multi');
  assert.ok(g.balls.length > 1 && g.balls.length <= MAX_BALLS);
  assert.ok(g.balls.every((b) => Math.abs(Math.hypot(b.vx, b.vy) - 3) < 0.5));
});

test('un bonus qui tombe sur la raquette est attrapé ; à côté, il disparaît', () => {
  const g = new Game(lvl(['1'], 3));
  g.launch();
  g.drops.push({ x: g.paddle.x, y: PADDLE_Y - 20, kind: 'wide' });
  g.drops.push({ x: 10, y: PADDLE_Y - 20, kind: 'life' });
  g.moveTo(250);
  g.drops[0].x = 250;
  run(g, 30);
  assert.equal(g.effects.wide > 0, true);
  assert.equal(g.lives, 3);
  run(g, 60);
  assert.equal(g.drops.length, 0);
});

test('colle : la balle reste sur la raquette jusqu\'au prochain lancer', () => {
  const g = new Game(lvl(['1'], 3));
  g.launch();
  g.applyPowerup('catch');
  Object.assign(g.balls[0], { x: g.paddle.x + 10, y: PADDLE_Y - BALL_R - 2, vx: 0, vy: 3 });
  run(g, 4);
  assert.equal(g.stuck, true);
  assert.ok(Math.abs(g.balls[0].x - (g.paddle.x + 10)) < 1e-9);
  g.moveTo(g.paddle.x + 30);
  g.step();
  assert.ok(Math.abs(g.balls[0].x - (g.paddle.x + 10)) < 1e-9, 'elle suit la raquette');
  assert.equal(g.launch(), true);
  assert.ok(g.balls[0].vy < 0);
});

test('laser : tire deux projectiles qui abîment la brique du dessus, avec un temps de recharge ; l\'acier les arrête', () => {
  const g = new Game(lvl(['1', '#'], 3));
  g.launch();
  g.applyPowerup('laser');
  g.moveTo(X0 + 12);
  g.balls[0].x = 250; g.balls[0].y = 200; g.balls[0].vx = 0; g.balls[0].vy = -3;
  assert.equal(g.launch(), true);
  assert.equal(g.bullets.length, 2);
  assert.equal(g.launch(), false, 'recharge');
  run(g, 60);
  assert.equal(g.bullets.length, 0);
  assert.ok(g.grid.has(1 * 12), 'l\'acier tient');
});

test('les bonus ne tombent que des briques détruites et leur tirage est reproductible', () => {
  const drops = (seed) => {
    const g = new Game(lvl(['1'.repeat(12), '1'.repeat(12)], 3), { seed });
    for (const k of [...g.bricks]) g.destroy(k);
    return g.drops.map((d) => `${d.kind}@${d.x}`);
  };
  assert.deepEqual(drops(5), drops(5));
  const none = new Game(lvl(['#', '#'], 3));
  assert.equal(none.drops.length, 0);
});

test('le joueur automatique est déterministe', () => {
  const run1 = autoplay(new Game(lvl(['1111', '2222'], 3), { seed: 3 }));
  const run2 = autoplay(new Game(lvl(['1111', '2222'], 3), { seed: 3 }));
  assert.equal(run1.tick, run2.tick);
  assert.equal(run1.score, run2.score);
});
