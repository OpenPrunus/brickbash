// Brickbash — sons synthétisés (aucun fichier audio). Les navigateurs exigent un geste utilisateur : unlock().
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('brickbash.muted') === '1'; } catch { /* ignoré */ }

export function unlock() {
  if (ctx || typeof AudioContext === 'undefined') {
    if (ctx?.state === 'suspended') ctx.resume();
    return;
  }
  ctx = new AudioContext();
}

export const isMuted = () => muted;

export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('brickbash.muted', m ? '1' : '0'); } catch { /* ignoré */ }
}

function tone(freq, dur, { type = 'square', gain = 0.06, slide = 0, delay = 0 } = {}) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function play(name) {
  switch (name) {
    case 'paddle': tone(260, 0.06, { type: 'triangle', gain: 0.1 }); break;
    case 'wall': tone(200, 0.04, { type: 'triangle', gain: 0.05 }); break;
    case 'hit': tone(420, 0.05, { gain: 0.05 }); break;
    case 'break': tone(620, 0.07, { gain: 0.06 }); tone(840, 0.06, { gain: 0.05, delay: 0.04 }); break;
    case 'boom': tone(100, 0.35, { type: 'sawtooth', gain: 0.12, slide: -60 }); break;
    case 'clang': tone(980, 0.05, { type: 'square', gain: 0.03 }); break;
    case 'powerup': [660, 880, 1100].forEach((f, i) => tone(f, 0.08, { type: 'triangle', gain: 0.07, delay: i * 0.06 })); break;
    case 'lostBall': tone(300, 0.35, { type: 'sawtooth', gain: 0.08, slide: -220 }); break;
    case 'launch': tone(500, 0.06, { gain: 0.04, slide: 200 }); break;
    case 'laser': tone(1200, 0.08, { type: 'sawtooth', gain: 0.03, slide: -700 }); break;
    case 'click': tone(700, 0.04, { gain: 0.04 }); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { gain: 0.08, delay: i * 0.12 })); break;
    case 'lose': [392, 330, 262].forEach((f, i) => tone(f, 0.22, { gain: 0.08, delay: i * 0.16 })); break;
    default: break;
  }
}
