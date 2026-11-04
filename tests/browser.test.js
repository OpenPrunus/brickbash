// Navigateur : un vrai Chrome (headless) piloté par DevTools, sans dépendance. Le site est statique : un petit serveur Node le sert.
//   npm run test:browser          (CHROME_BIN réglable ; SHOTS=/dossier enregistre des captures d'écran)
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  s.on('error', reject);
});
async function waitFor(fn, ms, what) {
  const t0 = Date.now();
  let last;
  for (;;) {
    try { last = await fn(); if (last) return last; } catch (e) { last = `erreur : ${e.message}`; }
    if (Date.now() - t0 > ms) throw new Error(`délai dépassé : ${what} (dernière valeur : ${JSON.stringify(last)})`);
    await sleep(50);
  }
}

let BASE, server, chrome, tmpDir, cdp, nextId = 0;
const pending = new Map();
const errors = [];

before(async () => {
  server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] ?? 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  const port = await freePort();
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  BASE = `http://localhost:${port}`;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brick-chrome-'));
  const dbg = await freePort();
  chrome = spawn(process.env.CHROME_BIN || 'google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    `--remote-debugging-port=${dbg}`, `--user-data-dir=${tmpDir}`, 'about:blank',
  ], { stdio: 'ignore' });
  const tab = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${dbg}/json`)).json()).find((t) => t.type === 'page'), 15000, 'Chrome');
  cdp = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { cdp.onopen = resolve; cdp.onerror = () => reject(new Error('DevTools')); });
  cdp.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(`${m.params.entry.text} ${m.params.entry.url ?? ''}`);
  };
  await call('Page.enable'); await call('Runtime.enable'); await call('Log.enable');
});
after(() => {
  try { cdp.close(); } catch { /* déjà fermé */ }
  try { chrome?.kill(); } catch { /* déjà arrêté */ }
  server?.close();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignoré */ }
});

function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    cdp.send(JSON.stringify({ id, method, params }));
  });
}
async function ev(expr) {
  const r = await call('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`page : ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
  return r.result.value;
}
async function shot(name) {
  if (!process.env.SHOTS) return;
  fs.mkdirSync(process.env.SHOTS, { recursive: true });
  const { data } = await call('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(process.env.SHOTS, `${name}.png`), Buffer.from(data, 'base64'));
}
const DESKTOP = { w: 1100, h: 760, touch: false };
const PHONE_PORTRAIT = { w: 390, h: 844, touch: true };
const PHONE_LANDSCAPE = { w: 844, h: 390, touch: true };

async function open(device, lang = 'fr', progress = null) {
  await call('Emulation.setDeviceMetricsOverride', { width: device.w, height: device.h, deviceScaleFactor: 1, mobile: !!device.touch });
  await call('Emulation.setTouchEmulationEnabled', device.touch ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
  await call('Storage.clearDataForOrigin', { origin: new URL(BASE).origin, storageTypes: 'local_storage' });
  await call('Page.navigate', { url: `${BASE}/` });
  await waitFor(() => ev('document.readyState === "complete" && !!window.__brick'), 10000, 'page chargée');
  await ev(`localStorage.setItem('brickbash.lang', ${JSON.stringify(lang)}); ${progress ? `localStorage.setItem('brickbash.progress', ${JSON.stringify(JSON.stringify(progress))});` : ''} location.reload()`);
  await waitFor(() => ev('document.readyState === "complete" && !!window.__brick'), 10000, 'page rechargée');
}
const click = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
const visible = (sel) => ev(`!document.querySelector(${JSON.stringify(sel)}).hidden`);
const text = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).textContent`);
const game = () => ev('(() => { const g = window.__brick.app.game; return { tick: g.tick, released: g.released, saved: g.saved, dead: g.dead, over: g.over, won: g.won, skills: g.skills }; })()');
const ALL_UNLOCKED = { v: 1, best: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => [i, { score: 100, stars: 2 }])) };
const state = () => ev('(() => { const a = window.__brick.app; const g = a.game; return { tick: g.tick, score: g.score, lives: g.lives, stuck: g.stuck, remaining: g.remaining, px: g.paddle.x, status: g.status, paused: a.paused, balls: g.balls.length }; })()');

/** Position d'un point du terrain (coordonnées logiques) à l'écran. */
const screenPoint = (x, y) => ev(`(() => { const r = document.querySelector('#canvas').getBoundingClientRect(); return { x: r.left + (${x} / 300) * r.width, y: r.top + (${y} / 400) * r.height }; })()`);
async function mouseAt(x, y, press = false) {
  const p = await screenPoint(x, y);
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
  if (press) {
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  }
}
const key = (k, type = 'keydown') => ev(`document.dispatchEvent(new KeyboardEvent(${JSON.stringify(type)}, { key: ${JSON.stringify(k)} }))`);

describe('pages et menus', () => {
  test('le menu s\'affiche, sans erreur, en français puis en anglais ; le niveau 2 est verrouillé', async () => {
    errors.length = 0;
    await open(DESKTOP);
    assert.equal(await ev('document.title'), 'Brickbash');
    assert.match(await text('#btn-continue'), /Jouer/);
    assert.equal(await ev('document.querySelector("#title a.all").href'), 'https://games.prunus.dev/');
    await shot('title');
    await click('[data-action=levels]');
    assert.equal(await ev('document.querySelectorAll(".level-card").length'), 10);
    assert.equal(await ev('document.querySelectorAll(".level-card")[0].disabled'), false);
    assert.equal(await ev('document.querySelectorAll(".level-card")[1].disabled'), true);
    await shot('levels');
    await open(DESKTOP, 'en');
    assert.match(await text('#btn-continue'), /Play/);
    assert.deepEqual(errors, []);
  });
});

describe('jouer', () => {
  test('niveau 1 à la souris : briefing, la raquette suit la souris, un clic lance la balle, une brique est cassée', async () => {
    errors.length = 0;
    await open(DESKTOP);
    await click('#btn-continue');
    assert.equal(await visible('#briefing'), true);
    assert.match(await text('#brief-goal'), /48/);
    await click('[data-action=begin]');
    assert.equal((await state()).stuck, true);
    assert.match(await text('#hint'), /Touchez l'écran/);
    await mouseAt(80, 300);
    await waitFor(async () => Math.abs((await state()).px - 80) < 1, 2000, 'la raquette suit la souris');
    await mouseAt(80, 300, true);                                           // un clic lance la balle
    assert.equal((await state()).stuck, false);
    await shot('level1');
    // la raquette suit la balle (un joueur automatique côté page) jusqu'à ce qu'une brique tombe
    await ev(`window.__follow = setInterval(() => { const g = window.__brick.app.game; const b = g.balls[0]; if (b) g.moveTo(b.x); }, 4)`);
    await waitFor(async () => (await state()).score > 0, 20000, 'une brique est abîmée');
    assert.deepEqual(errors, []);
    await ev('clearInterval(window.__follow)');
  });

  test('un niveau se gagne en jouant : victoire, étoiles et record gardés, niveau suivant', async () => {
    errors.length = 0;
    await open(DESKTOP);
    await click('#btn-continue');
    await click('[data-action=begin]');
    await key(' ');                                                           // Espace lance la balle
    await ev(`window.__follow = setInterval(() => { const a = window.__brick.app; const g = a.game; if (g.stuck) g.launch(); const b = g.balls[0]; if (b) g.moveTo(b.x - Math.sin(g.tick * 0.05) * 20); }, 2)`);
    await ev('window.__brick.app.game.bricks.forEach((b) => { if (b.r > 0 || b.c > 2) { window.__brick.app.game.grid.delete(b.r * 12 + b.c); window.__brick.app.game.remaining--; } })');   // on n'en laisse que trois
    await waitFor(() => visible('#result'), 90000, 'fin du niveau');
    await ev('clearInterval(window.__follow)');
    assert.match(await text('#res-title'), /terminé/);
    assert.match(await text('#res-stars'), /★/);
    const saved = await ev('JSON.parse(localStorage.getItem("brickbash.progress")).best[1]');
    assert.ok(saved.score > 0 && saved.stars >= 1);
    await shot('won');
    await click('#res-main');
    assert.match(await text('#lvl-name'), /Niveau 2/);
    assert.deepEqual(errors, []);
  });

  test('perdre toutes ses vies propose de réessayer ; pause, clavier (flèches, Échap)', async () => {
    await open(DESKTOP, 'fr', ALL_UNLOCKED);
    await click('#btn-continue');
    await click('[data-action=begin]');
    const x0 = (await state()).px;
    await key('ArrowLeft');
    await sleep(250);
    await key('ArrowLeft', 'keyup');
    assert.ok((await state()).px < x0 - 10, 'la flèche déplace la raquette');
    await key('p');
    assert.equal(await visible('#pausebox'), true);
    const t0 = (await state()).tick;
    await sleep(250);
    assert.equal((await state()).tick, t0, 'en pause, rien ne bouge');
    await key('p');
    await sleep(200);
    assert.ok((await state()).tick > t0);
    // trois balles perdues d'affilée
    await ev('window.__brick.app.game.lives = 1');
    await key(' ');
    await ev('window.__brick.app.game.moveTo(20); window.__brick.app.game.balls[0].x = 280');
    await waitFor(() => visible('#result'), 20000, 'résultat');
    assert.match(await text('#res-title'), /Perdu/);
    assert.match(await text('#res-main'), /Réessayer/);
    await click('#res-main');
    assert.equal(await visible('#result'), false);
    assert.equal((await state()).lives, 3, 'la partie repart de zéro');
    await key('Escape');
    assert.equal(await visible('#levels'), true);
  });
});

describe('téléphone : tout tient à l\'écran et se joue au doigt', () => {
  for (const [name, device] of [['portrait', PHONE_PORTRAIT], ['paysage', PHONE_LANDSCAPE]]) {
    test(`${name} : le terrain et les commandes sont entiers et sans défilement`, async () => {
      await open(device, 'fr', ALL_UNLOCKED);
      await click('[data-action=levels]');
      await ev('document.querySelectorAll(".level-card")[1].click()');
      await click('[data-action=begin]');
      const box = await ev(`(() => {
        const r = (s) => document.querySelector(s).getBoundingClientRect();
        const c = r('#canvas'); const ct = r('#controls'); const h = r('#hint');
        return { cw: c.width, ch: c.height, cb: c.bottom, ctBottom: ct.bottom, ctRight: ct.right, hintBottom: h.bottom, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, btn: document.querySelector('.ctl').getBoundingClientRect().height };
      })()`);
      assert.ok(device.w < device.h ? box.cw > device.w * 0.9 : box.ch > device.h * 0.8, `terrain de ${box.cw}×${box.ch}px sur ${device.w}×${device.h}`);
      assert.ok(box.cb <= device.h + 0.5, `terrain entier : ${box.cb} sur ${device.h}`);
      assert.ok(box.ctBottom <= device.h + 0.5, `commandes visibles : ${box.ctBottom} sur ${device.h}`);
      assert.ok(box.ctRight <= device.w + 0.5 && box.sw <= device.w, 'pas de défilement horizontal');
      assert.ok(box.sh <= device.h + 1, `pas de défilement vertical (${box.sh} sur ${device.h})`);
      assert.ok(box.btn >= 40, `bouton de ${box.btn}px`);
      await shot(`phone-${name}`);
    });
  }

  test('au doigt : glisser déplace la raquette, un simple toucher lance la balle', async () => {
    await open(PHONE_PORTRAIT, 'fr', ALL_UNLOCKED);
    await click('#btn-continue');
    await click('[data-action=begin]');
    const start = await screenPoint(150, 300);
    const x0 = (await state()).px;
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x, y: start.y }] });
    for (let i = 1; i <= 10; i++) await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + i * 8, y: start.y }] });
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const x1 = (await state()).px;
    assert.ok(x1 > x0 + 30, `la raquette a suivi le doigt (${x0} → ${x1})`);
    assert.equal((await state()).stuck, true, 'glisser ne lance pas la balle');
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x, y: start.y }] });
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await waitFor(async () => !(await state()).stuck, 2000, 'un toucher lance la balle');
  });
});

describe('hors ligne (PWA)', () => {
  test('après une première visite, la page se charge sans réseau et un niveau se joue', async () => {
    await open(DESKTOP);
    assert.equal(await ev('navigator.serviceWorker.ready.then(() => true)'), true);
    await call('Page.navigate', { url: `${BASE}/` });
    await waitFor(() => ev('!!window.__brick && !!navigator.serviceWorker.controller'), 10000, 'page contrôlée par le service worker');
    await call('Network.enable');
    await call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    try {
      await call('Page.navigate', { url: `${BASE}/` });
      await waitFor(() => ev('!!window.__brick'), 8000, 'page chargée hors ligne');
      await click('#btn-continue');
      await click('[data-action=begin]');
      await key(' ');
      await waitFor(async () => (await state()).tick >= 30, 5000, 'le niveau tourne hors ligne');
    } finally {
      await call('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    }
  });
});
