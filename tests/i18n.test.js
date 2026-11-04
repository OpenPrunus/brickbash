import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DICT, LANGS, t, setLang, getLang } from '../web/js/i18n.js';
import { POWERUPS } from '../web/js/engine.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('le français et l\'anglais ont exactement les mêmes clés, non vides, avec les mêmes variables', () => {
  assert.deepEqual(Object.keys(DICT.fr).sort(), Object.keys(DICT.en).sort());
  const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const lang of LANGS) for (const [k, v] of Object.entries(DICT[lang])) assert.ok(v.trim().length > 0, `${lang}.${k}`);
  for (const k of Object.keys(DICT.fr)) assert.deepEqual(vars(DICT.fr[k]), vars(DICT.en[k]), k);
});

test('toutes les clés utilisées par la page et par le code existent', () => {
  const html = read('web/index.html');
  const used = [...html.matchAll(/data-i18n(?:-aria|-title)?="(\w+)"/g)].map((m) => m[1]);
  assert.ok(used.length > 15);
  for (const k of used) assert.ok(k in DICT.fr, `clé de la page inconnue : ${k}`);
  for (const f of ['web/js/main.js']) for (const m of read(f).matchAll(/\bt\('(\w+)'/g)) assert.ok(m[1] in DICT.fr, `${f} : ${m[1]}`);
  for (const k of ['wide', 'slow', 'catch', 'laser']) assert.ok(`fx_${k}` in DICT.fr, k);
  assert.ok(POWERUPS.length === 6);
});

test('t() remplace les variables, retombe sur l\'anglais puis sur la clé ; langue inconnue ignorée', () => {
  setLang('fr');
  assert.match(t('briefing', { n: 42 }), /42/);
  assert.equal(t('cle-inconnue'), 'cle-inconnue');
  setLang('xx');
  assert.equal(getLang(), 'fr');
  setLang('en');
  assert.match(t('won'), /cleared/i);
});
