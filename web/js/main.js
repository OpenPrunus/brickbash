// Brickbash — interface : écrans, boucle à 60 pas par seconde, souris, doigt et clavier.
import { Game, TPS, W } from './engine.js';
import { LEVELS } from './levels.js';
import { Renderer } from './render.js';
import * as audio from './audio.js';
import * as i18n from './i18n.js';

const { t } = i18n;
const $ = (sel) => document.querySelector(sel);
const SCREENS = ['title', 'levels', 'help', 'game'];
const KEY_SPEED = 5;                                                         // pixels par pas avec les flèches

// ---------------------------------------------------------------- progression (gardée dans le navigateur)
const progress = { v: 1, best: {} };                                          // best[id] = { score, stars }
try { Object.assign(progress, JSON.parse(localStorage.getItem('brickbash.progress') ?? '{}')); } catch { /* stockage indisponible */ }
const saveProgress = () => { try { localStorage.setItem('brickbash.progress', JSON.stringify(progress)); } catch { /* ignoré */ } };
const done = (i) => progress.best[LEVELS[i].id] !== undefined;
const unlocked = (i) => i === 0 || done(i - 1);
const firstOpen = () => { for (let i = 0; i < LEVELS.length; i++) if (!done(i)) return i; return LEVELS.length - 1; };

// ---------------------------------------------------------------- état
const app = { idx: 0, game: null, renderer: null, paused: true, acc: 0, last: 0, keys: new Set(), resultTimer: null };

function show(name) {
  for (const id of SCREENS) $(`#${id}`).hidden = id !== name;
}

function refreshLabels() {
  i18n.apply();
  $('#opt-sound').textContent = t(audio.isMuted() ? 'soundOff' : 'soundOn');
  $('#btn-sound').setAttribute('aria-label', t(audio.isMuted() ? 'soundOff' : 'soundOn'));
  $('#btn-sound').classList.toggle('on', audio.isMuted());
  $('#opt-lang').textContent = t('langToggle');
  $('#btn-continue').textContent = Object.keys(progress.best).length > 0 ? t('continue') : t('play');
  buildLevelGrid();
  if (app.game) { setTexts(); updateBar(); }
}

// ---------------------------------------------------------------- niveaux
const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

function buildLevelGrid() {
  const grid = $('#level-grid');
  grid.replaceChildren();
  LEVELS.forEach((lv, i) => {
    const b = document.createElement('button');
    b.className = `level-card${done(i) ? ' done' : ''}`;
    b.disabled = !unlocked(i);
    const n = document.createElement('b');
    n.textContent = t('level', { n: lv.id });
    const name = document.createElement('span');
    name.textContent = i18n.pick(lv.name);
    const info = document.createElement('small');
    const best = progress.best[lv.id];
    info.textContent = !unlocked(i) ? t('locked') : best ? t('best', { n: best.score }) : '';
    b.append(n, name, info);
    if (best) {
      const st = document.createElement('small');
      st.className = 'stars';
      st.textContent = starText(best.stars);
      b.append(st);
    }
    b.addEventListener('click', () => { audio.unlock(); audio.play('click'); startLevel(i); });
    grid.append(b);
  });
}

function setTexts() {
  const lv = LEVELS[app.idx];
  $('#lvl-name').textContent = `${t('level', { n: lv.id })} · ${i18n.pick(lv.name)}`;
  $('#brief-title').textContent = i18n.pick(lv.name);
  $('#brief-hint').textContent = i18n.pick(lv.hint);
  $('#brief-goal').textContent = t('briefing', { n: app.game.total });
}

function startLevel(i) {
  clearTimeout(app.resultTimer);
  app.resultTimer = null;
  app.idx = i;
  app.game = new Game(LEVELS[i], { seed: (Date.now() & 0xffff) + 1 });
  app.renderer = new Renderer($('#canvas'), app.game);
  app.paused = true;
  app.acc = 0;
  setTexts();
  $('#briefing').hidden = false;
  $('#result').hidden = true;
  $('#pausebox').hidden = true;
  $('#btn-pause').classList.remove('on');
  show('game');
  updateBar();
}

function begin() {
  $('#briefing').hidden = true;
  app.paused = false;
  audio.unlock();
}

// ---------------------------------------------------------------- barre du haut
function updateBar() {
  const g = app.game;
  $('#st-score').textContent = String(g.score);
  $('#st-lives').textContent = '♥'.repeat(Math.max(0, g.lives));
  $('#st-lives').setAttribute('aria-label', String(g.lives));
  const fire = g.effects.laser > 0 && !g.stuck;
  const hint = g.over ? '' : g.stuck ? t('tapLaunch') : fire ? t('tapFire') : i18n.pick(LEVELS[app.idx].hint);
  if ($('#hint').textContent !== hint) $('#hint').textContent = hint;
}

// ---------------------------------------------------------------- fin de partie
function showResult() {
  const g = app.game;
  const lv = LEVELS[app.idx];
  let record = false;
  if (g.won) {
    const prev = progress.best[lv.id];
    record = !prev || g.score > prev.score;
    progress.best[lv.id] = { score: Math.max(g.score, prev?.score ?? 0), stars: Math.max(g.stars, prev?.stars ?? 0) };
    saveProgress();
    buildLevelGrid();
  }
  $('#res-title').textContent = t(g.won ? 'won' : 'lost');
  $('#res-stars').textContent = g.won ? starText(g.stars) : '';
  const last = app.idx === LEVELS.length - 1;
  $('#res-detail').textContent = [t(g.won ? 'wonDetail' : 'lostDetail', { score: g.score, n: g.remaining }), record && g.won ? t('newBest') : '', g.won && last ? t('finished') : ''].filter(Boolean).join(' ');
  const main = $('#res-main');
  if (g.won && !last) { main.textContent = t('next'); main.dataset.action = 'next'; } else { main.textContent = t('retry'); main.dataset.action = 'restart'; }
  $('#result').hidden = false;
  audio.play(g.won ? 'win' : 'lose');
}

const SOUNDS = { paddle: 'paddle', wall: 'wall', hit: 'hit', break: 'break', boom: 'boom', clang: 'clang', powerup: 'powerup', 'lost-ball': 'lostBall', launch: 'launch', laser: 'laser' };

function handleEvents() {
  const g = app.game;
  app.renderer.feed(g.events);
  const seen = new Set();
  for (const e of g.events) {
    const s = SOUNDS[e.type];
    if (s && !seen.has(s)) { seen.add(s); audio.play(s); }
  }
  g.events.length = 0;
}

// ---------------------------------------------------------------- boucle
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(100, now - (app.last || now));
  app.last = now;
  const g = app.game;
  if (!g || $('#game').hidden) return;
  if (!app.paused && !g.over) {
    app.acc += dt;
    const stepMs = 1000 / TPS;
    let guard = 0;
    while (app.acc >= stepMs && !g.over && guard++ < 8) {
      const dir = (app.keys.has('right') ? 1 : 0) - (app.keys.has('left') ? 1 : 0);
      if (dir) g.moveBy(dir * KEY_SPEED);
      g.step();
      app.acc -= stepMs;
    }
    handleEvents();
    updateBar();
    if (g.over && $('#result').hidden && !app.resultTimer) app.resultTimer = setTimeout(() => { app.resultTimer = null; showResult(); }, 800);
  }
  app.renderer.draw(now);
}

// ---------------------------------------------------------------- pointeur : souris (position absolue) et doigt (glissement relatif)
const canvasX = (clientX) => {
  const r = $('#canvas').getBoundingClientRect();
  return ((clientX - r.left) * W) / r.width;
};
const touch = { id: null, x: 0, moved: 0, t0: 0 };

document.addEventListener('pointermove', (e) => {
  const g = app.game;
  if (!g || $('#game').hidden || app.paused || g.over) return;
  if (e.pointerType === 'mouse') { g.moveTo(canvasX(e.clientX)); return; }
  if (e.pointerId !== touch.id) return;
  const r = $('#canvas').getBoundingClientRect();
  const dx = e.clientX - touch.x;
  touch.x = e.clientX;
  touch.moved += Math.abs(dx);
  g.moveBy((dx * W) / r.width * 1.15);
});

$('#canvas').addEventListener('pointerdown', (e) => {
  audio.unlock();
  const g = app.game;
  if (!g || !$('#briefing').hidden || app.paused || g.over) return;
  if (e.pointerType === 'mouse') { g.moveTo(canvasX(e.clientX)); g.launch(); return; }
  touch.id = e.pointerId;
  touch.x = e.clientX;
  touch.moved = 0;
  touch.t0 = performance.now();
  try { e.target.setPointerCapture(e.pointerId); } catch { /* ignoré */ }
});

const release = (e) => {
  if (e.pointerId !== touch.id) return;
  touch.id = null;
  const g = app.game;
  if (e.type === 'pointerup' && g && !app.paused && !g.over && touch.moved < 10 && performance.now() - touch.t0 < 600) g.launch();   // un simple toucher lance (ou tire)
};
document.addEventListener('pointerup', release);
document.addEventListener('pointercancel', release);

// ---------------------------------------------------------------- commandes
function togglePause() {
  if (!app.game || !$('#briefing').hidden || app.game.over) return;
  app.paused = !app.paused;
  $('#btn-pause').classList.toggle('on', app.paused);
  $('#pausebox').hidden = !app.paused;
  app.acc = 0;
}

const ACTIONS = {
  continue: () => startLevel(firstOpen()),
  levels: () => { clearTimeout(app.resultTimer); app.resultTimer = null; app.paused = true; buildLevelGrid(); show('levels'); },
  help: () => show('help'),
  title: () => show('title'),
  begin,
  next: () => startLevel(Math.min(LEVELS.length - 1, app.idx + 1)),
  restart: () => { startLevel(app.idx); begin(); },
  pause: togglePause,
  toggleSound: () => { audio.setMuted(!audio.isMuted()); refreshLabels(); },
  toggleLang: () => { i18n.setLang(i18n.getLang() === 'fr' ? 'en' : 'fr'); refreshLabels(); },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  audio.unlock();
  audio.play('click');
  ACTIONS[el.dataset.action]?.();
});

const KEYS = { ArrowLeft: 'left', a: 'left', A: 'left', q: 'left', Q: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
document.addEventListener('keydown', (e) => {
  if ($('#game').hidden) return;
  if (KEYS[e.key]) { app.keys.add(KEYS[e.key]); e.preventDefault(); return; }
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!$('#briefing').hidden) begin();
    else if (!app.paused && app.game) app.game.launch();
  } else if (e.key === 'p' || e.key === 'P') togglePause();
  else if (e.key === 'r' || e.key === 'R') ACTIONS.restart();
  else if (e.key === 'Escape') ACTIONS.levels();
});
document.addEventListener('keyup', (e) => { if (KEYS[e.key]) app.keys.delete(KEYS[e.key]); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !app.paused && app.game && !app.game.over) togglePause(); });
window.addEventListener('blur', () => app.keys.clear());

// ---------------------------------------------------------------- démarrage
i18n.setLang(i18n.detectLang());
refreshLabels();
show('title');
requestAnimationFrame(frame);

// Accès pour les tests de bout en bout dans le navigateur.
window.__brick = { app, progress, LEVELS };
